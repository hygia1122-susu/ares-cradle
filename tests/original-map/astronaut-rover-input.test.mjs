import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const moduleCache = new Map();
const physicsCalls = [];
const physicsResults = [];
const store = {
  playerPos: [0, -0.4, 1.55], roverPos: [3.8, -0.32, -2.2], joystickVector: { x: 0, y: 0 },
  isInsideHabitat: false, isDrivingRover: false, cameraYaw: 0, isMouseDriving: false,
  isFlashlightOn: false, jumpRequestCount: 0, sprintInputActive: false,
  exploration: { survival: { air: 100, meals: 12, energyEU: 100 } },
  setPlayerPos(value) { store.playerPos = value; },
  setIsInsideHabitat(value) { store.isInsideHabitat = value; },
  setPhysicsStatus() {}, toggleFlashlight() {},
};
const useOutpostStore = (selector) => selector(store);
useOutpostStore.getState = () => store;
store.getState = () => store;

class EventHub {
  listeners = new Map();
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
class HTMLElementStub {
  tagName = 'DIV';
  closest() { return null; }
  blur() {}
}
const win = new EventHub();
const doc = Object.assign(new EventHub(), {
  hidden: false, activeElement: null,
  querySelector() { return null; },
});
globalThis.window = win;
globalThis.document = doc;
globalThis.HTMLElement = HTMLElementStub;

let hooks = [];
let hookIndex = 0;
let effects = [];
let frame;
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const compile = (path) => {
  if (moduleCache.has(path)) return moduleCache.get(path).exports;
  const module = { exports: {} };
  moduleCache.set(path, module);
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (id === 'react') {
      const reactHooks = {
        useRef(initial) {
          const index = hookIndex++;
          return hooks[index] ?? (hooks[index] = { current: initial });
        },
        useState(initial) {
          const index = hookIndex++;
          if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
          return [hooks[index], () => {}];
        },
        useEffect(callback) { effects.push(callback); },
      };
      return { ...reactHooks, __esModule: true, default: reactHooks };
    }
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === '@react-three/fiber') return { useFrame(callback) { frame = callback; } };
    if (id === 'three') return THREE;
    if (id === '@/modules/store/useOutpostStore') return { useOutpostStore };
    if (id === '@/modules/audio/soundEngine') return { soundEngine: new Proxy({}, { get: () => () => {} }) };
    if (id === './physicsEngine') {
      const physics = compile(resolve(dirname(path), 'physicsEngine.ts'));
      return { ...physics, stepPlayerPhysics: (...args) => {
        physicsCalls.push(args[1]);
        const result = physics.stepPlayerPhysics(...args);
        physicsResults.push(result);
        return result;
      } };
    }
    if (id.startsWith('.')) {
      let child = resolve(dirname(path), id);
      if (!/\.tsx?$/.test(child)) child += '.ts';
      if (existsSync(child)) return compile(child);
    }
    throw new Error(`Unexpected import in astronaut harness: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};
const AstronautPlayer = compile(resolve(root, 'src/modules/character/AstronautPlayer.tsx')).AstronautPlayer;
const render = () => {
  hookIndex = 0;
  effects = [];
  const tree = AstronautPlayer();
  const rootObject = new THREE.Group();
  rootObject.position.set(...tree.props.position);
  tree.props.ref.current = rootObject;
  return { effects, rootObject };
};
const mount = () => {
  hooks = [];
  physicsCalls.length = 0;
  physicsResults.length = 0;
  store.playerPos = [0, -0.4, 1.55];
  store.roverPos = [3.8, -0.32, -2.2];
  store.joystickVector = { x: 0, y: 0 };
  store.isDrivingRover = false;
  store.jumpRequestCount = 0;
  store.exploration = { survival: { air: 100, meals: 12, energyEU: 100 } };
  win.listeners.clear();
  doc.listeners.clear();
  const mounted = render();
  mounted.effects[0]();
  mounted.effects[1]();
  const cleanup = mounted.effects[2]();
  return {
    rerender: render,
    tick(dt = 0.03) { frame({ clock: { getElapsedTime: () => 0 } }, dt); },
    close() { cleanup?.(); },
  };
};
const key = (code) => ({ code, repeat: false, target: null, preventDefault() {} });
const press = (code) => win.dispatch('keydown', key(code));
const release = (code) => win.dispatch('keyup', key(code));

test('driving Space and touch jump requests are consumed before rover exit', () => {
  const app = mount();
  store.isDrivingRover = true;
  press('Space');
  release('Space');
  store.jumpRequestCount += 1;
  let current = app.rerender();
  current.effects[1]();
  app.tick();
  store.isDrivingRover = false;
  app.rerender();
  app.tick();
  assert.equal(physicsCalls.at(-1).jumpJustPressed, false,
    'no astronaut jump input from the driving mode may reach on-foot physics after dismount');
  assert.equal(physicsResults.at(-1).isGrounded, true, 'the dismounted astronaut remains grounded');
  assert.equal(physicsResults.at(-1).vy, 0, 'no spontaneous upward velocity after dismount');
  app.close();
});

test('depleted air or meals prevent sprint while keeping normal walking available', () => {
  const app = mount();
  press('KeyW');
  press('ShiftLeft');
  app.tick();
  assert.equal(physicsCalls.at(-1).moveZ, -6.6, 'healthy supplies allow normal sprint speed');

  store.exploration = { survival: { air: 0, meals: 12, energyEU: 100 } };
  app.rerender();
  app.tick();
  assert.equal(physicsCalls.at(-1).moveZ, -4.2, 'empty air disables sprint but preserves walking speed');

  store.exploration = { survival: { air: 100, meals: 0, energyEU: 100 } };
  app.rerender();
  app.tick();
  assert.equal(physicsCalls.at(-1).moveZ, -4.2, 'empty meals also disables sprint');

  store.exploration = { survival: { air: 100, meals: 12, energyEU: 0 } };
  app.rerender();
  app.tick();
  assert.equal(physicsCalls.at(-1).moveZ, -4.2, 'empty energy also disables sprint');
  app.close();
});

test('on-foot Space and a released mid-air second press still reach physics', () => {
  const app = mount();
  press('Space');
  app.tick();
  assert.equal(physicsCalls.at(-1).jumpJustPressed, true, 'first on-foot Space queues a jump');
  assert.equal(store.playerPos[1] > -0.4, true, 'first press starts the normal jump');

  release('Space');
  app.tick();
  press('Space');
  app.tick();
  assert.equal(physicsCalls.at(-1).jumpJustPressed, true, 'a fresh mid-air Space press still queues');
  app.close();
});
