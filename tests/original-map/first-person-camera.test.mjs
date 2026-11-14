import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();
let frame;
let hooks = [];
let hookIndex = 0;
let effects = [];
let modal = false;

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

const documentStub = Object.assign(new EventHub(), {
  body: { style: { touchAction: 'pan-y', overscrollBehavior: 'auto' } },
  hidden: false,
  pointerLockElement: null,
  querySelector(selector) { return selector === '[role="dialog"]' && modal ? {} : null; },
  exitPointerLock() {
    this.pointerLockElement = null;
    this.dispatch('pointerlockchange');
  },
});
const windowStub = new EventHub();
globalThis.document = documentStub;
globalThis.window = windowStub;

let pointerLockRequest;
const canvas = Object.assign(new EventHub(), {
  title: '',
  requestPointerLock() {
    if (pointerLockRequest) return pointerLockRequest();
    documentStub.pointerLockElement = canvas;
    documentStub.dispatch('pointerlockchange');
  },
});
const camera = new THREE.PerspectiveCamera();
const store = {
  cameraYaw: 0,
  cameraPitch: 0,
  isPointerLocked: false,
  isDrivingRover: false,
  roverHeading: 0,
  roverPos: [4, -0.32, -2],
  playerPos: [1, -0.4, 2],
  looks: [],
  setCameraLook: (yaw, pitch) => {
    store.cameraYaw = yaw;
    store.cameraPitch = pitch;
    store.looks.push([yaw, pitch]);
  },
  setPointerLocked: (value) => { store.isPointerLocked = value; },
  toggleSkyView() {},
};
const useOutpostStore = (selector) => selector(store);
useOutpostStore.getState = () => store;

const compile = (path) => {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
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
        useEffect(callback) { effects.push(callback); },
      };
      return { ...reactHooks, __esModule: true, default: reactHooks };
    }
    if (id === 'react/jsx-runtime') return { jsx() {}, jsxs() {} };
    if (id === '@react-three/fiber') return {
      useFrame(callback) { frame = callback; },
      useThree() { return { camera, gl: { domElement: canvas } }; },
    };
    if (id === 'three') return THREE;
    if (id === '@/modules/store/useOutpostStore') return { useOutpostStore };
    if (id.startsWith('.')) {
      let child = resolve(dirname(path), id);
      if (!/\.tsx?$/.test(child)) child += '.ts';
      if (existsSync(child)) return compile(child);
    }
    throw new Error(`Unexpected import in camera harness: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};

const cameraModule = compile(resolve(root, 'src/modules/character/CameraRig.tsx'));
const mount = () => {
  hooks = [];
  hookIndex = 0;
  effects = [];
  frame = undefined;
  modal = false;
  documentStub.hidden = false;
  documentStub.pointerLockElement = null;
  pointerLockRequest = undefined;
  canvas.title = '';
  store.cameraYaw = 0;
  store.cameraPitch = 0;
  store.isPointerLocked = false;
  store.isDrivingRover = false;
  store.roverHeading = 0;
  store.looks = [];
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  cameraModule.CameraRig();
  const cleanups = effects.map((effect) => effect()).filter((cleanup) => typeof cleanup === 'function');
  return {
    tick(dt = 0.05) { frame({}, dt); },
    close() { cleanups.forEach((cleanup) => cleanup()); },
  };
};
const move = (movementX, movementY) => documentStub.dispatch('mousemove', { movementX, movementY });
const canvasClick = (target = canvas, isTrusted = true) => canvas.dispatch('click', { target, isTrusted });
const pointer = (type, pointerId, clientX, clientY) => canvas.dispatch(type, {
  pointerType: 'touch', pointerId, clientX, clientY, preventDefault() {},
});

 test('look math uses non-inverted Y, rightward yaw, wrapping, and bounded pitch', () => {
  const { updateCameraLook, wrapCameraYaw, clampCameraPitch } = cameraModule;
  assert.ok(updateCameraLook(0, 0, 0, -10).pitch > 0, 'mouse up raises pitch to look up');
  assert.ok(updateCameraLook(0, 0, 10, 0).yaw < 0, 'mouse right turns view right from north');
  assert.ok(Math.abs(wrapCameraYaw(Math.PI * 5)) <= Math.PI);
  assert.equal(clampCameraPitch(99), 1.45);
  assert.equal(clampCameraPitch(-99), -1.45);
  assert.ok(Number.isFinite(updateCameraLook(0, 0, 1e12, -1e12).yaw));
});

test('only a trusted canvas click requests pointer lock; unlocked mouse does not look', () => {
  const app = mount();
  canvasClick(canvas, false);
  assert.equal(documentStub.pointerLockElement, null);
  canvasClick({ tagName: 'BUTTON' }, true);
  assert.equal(documentStub.pointerLockElement, null);
  move(80, -40);
  app.tick();
  assert.deepEqual(store.looks.at(-1), [0, 0]);

  canvasClick();
  assert.equal(documentStub.pointerLockElement, canvas);
  assert.equal(store.isPointerLocked, true);
  move(10, -10);
  app.tick();
  assert.ok(store.cameraYaw < 0);
  assert.ok(store.cameraPitch > 0);
  app.close();
});

test('modal opening releases lock and ignores subsequent mouse motion', () => {
  const app = mount();
  canvasClick();
  move(4, -4);
  for (let i = 0; i < 30; i += 1) app.tick();
  const lookBeforeModal = [...store.looks.at(-1)];
  modal = true;
  app.tick();
  assert.equal(documentStub.pointerLockElement, null);
  assert.equal(store.isPointerLocked, false);
  move(-100, 100);
  app.tick();
  const lookAfterModalMotion = store.looks.at(-1);
  assert.ok(Math.abs(lookAfterModalMotion[0] - lookBeforeModal[0]) < 1e-9);
  assert.ok(Math.abs(lookAfterModalMotion[1] - lookBeforeModal[1]) < 1e-9);
  canvasClick();
  assert.equal(documentStub.pointerLockElement, null, 'canvas click cannot relock while dialog is open');
  app.close();
});

test('rejected pointer-lock request stays unlocked and exposes a retry hint', async () => {
  const app = mount();
  pointerLockRequest = () => Promise.reject(new Error('denied'));
  canvasClick();
  await Promise.resolve();
  assert.equal(documentStub.pointerLockElement, null);
  assert.equal(store.isPointerLocked, false);
  assert.match(canvas.title, /Mouse capture unavailable/);
  move(80, -40);
  app.tick();
  assert.deepEqual(store.looks.at(-1), [0, 0]);
  app.close();
});

test('touch drag adjusts rover look and modal entry cancels the active drag', () => {
  const app = mount();
  store.isDrivingRover = true;
  app.tick();
  pointer('pointerdown', 7, 20, 20);
  pointer('pointermove', 7, 40, 0);
  for (let i = 0; i < 30; i += 1) app.tick();
  assert.notEqual(store.cameraYaw, -Math.PI, 'touch drag pans rover view');
  assert.ok(store.cameraPitch > 0, 'touch drag upward raises rover view');

  modal = true;
  app.tick();
  const lookBeforeMove = [...store.looks.at(-1)];
  pointer('pointermove', 7, 40, 100);
  app.tick();
  assert.ok(Math.abs(store.looks.at(-1)[0] - lookBeforeMove[0]) < 1e-9, 'modal cancels touch yaw');
  assert.ok(Math.abs(store.looks.at(-1)[1] - lookBeforeMove[1]) < 1e-9, 'modal cancels touch pitch');
  app.close();
});

test('rover look is independent and on-foot look restores without moving astronaut pose', () => {
  const app = mount();
  canvasClick();
  move(20, -12);
  for (let i = 0; i < 30; i += 1) app.tick();
  const humanLook = [...store.looks.at(-1)];
  const humanPosition = [...store.playerPos];

  store.isDrivingRover = true;
  store.roverHeading = 0.25;
  app.tick();
  assert.equal(documentStub.pointerLockElement, null, 'remote enter releases pointer lock');
  assert.ok(Math.abs(store.cameraYaw - (0.25 - Math.PI)) < 1e-9, 'remote view immediately faces rover forward');
  assert.equal(store.cameraPitch, 0, 'remote pitch resets on enter');
  assert.ok(Math.abs(camera.position.x - (store.roverPos[0] - 0.273 * Math.cos(0.25) + 0.55 * Math.sin(0.25))) < 1e-9);
  assert.ok(Math.abs(camera.position.y - (store.roverPos[1] + 1.48)) < 1e-9);
  assert.ok(Math.abs(camera.position.z - (store.roverPos[2] + 0.273 * Math.sin(0.25) + 0.55 * Math.cos(0.25))) < 1e-9);
  canvasClick();
  move(100, -40);
  for (let i = 0; i < 30; i += 1) app.tick();
  assert.notEqual(store.cameraYaw, humanLook[0], 'remote view can pan independently');
  assert.ok(store.cameraPitch > 0, 'remote mouse-up looks upward');
  move(0, 100000);
  for (let i = 0; i < 30; i += 1) app.tick();
  assert.ok(Math.abs(store.cameraPitch + 1.45) < 1e-9, 'remote pitch is clamped at its lower limit');
  move(0, -100000);
  for (let i = 0; i < 30; i += 1) app.tick();
  assert.ok(Math.abs(store.cameraPitch - 1.45) < 1e-9, 'remote pitch is clamped at its upper limit');
  assert.deepEqual(store.playerPos, humanPosition, 'camera never writes astronaut position');

  store.isDrivingRover = false;
  for (let i = 0; i < 30; i += 1) app.tick();
  assert.ok(Math.abs(store.cameraYaw - humanLook[0]) < 0.002);
  assert.ok(Math.abs(store.cameraPitch - humanLook[1]) < 0.002);
  assert.deepEqual(store.playerPos, humanPosition);
  app.close();
});

test('MarsCanvas disables browser gestures on its actual WebGL canvas', () => {
  const element = (type, props) => ({ type, props });
  const react = { __esModule: true, default: {}, useMemo: (callback) => callback(), useEffect() {} };
  const component = (name) => ({ name });
  const components = new Map([
    ['react', react], ['react/jsx-runtime', { jsx: element, jsxs: element }],
    ['@react-three/fiber', { Canvas: component('Canvas'), useFrame() {}, useThree() {} }],
    ['@react-three/drei', { OrbitControls: component('OrbitControls') }],
    ['three', THREE], ['@react-three/postprocessing', { EffectComposer: component('EffectComposer'), Bloom: component('Bloom') }],
    ['leva', { useControls: () => [{}], Leva: component('Leva') }],
    ['@/modules/store/useOutpostStore', { useOutpostStore: (selector) => selector({ graphicsQuality: 'high' }) }],
  ]);
  for (const name of [
    './LightingRig', './MarsTerrain', './OuterRegions', './ScientificElements', '@/modules/mission-control/ScientificInteractionPrompt',
    './HabitatDome', './HabitatInterior', './SolarArray', './BatteryBank', './DustStormParticles', './MarsRover',
    './ResourceDrops', './SpecimenNode', './SpaceSkybox', '@/modules/character/AstronautPlayer',
    '@/modules/character/CameraRig', './PhysicsDebugHitboxes',
  ]) components.set(name, component(name));

  const path = resolve(root, 'src/modules/outpost-3d/MarsCanvas.tsx');
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (!components.has(name)) throw new Error(`Unexpected import in MarsCanvas harness: ${name}`);
    return components.get(name);
  }, module, module.exports);

  window.location = { search: '' };
  window.devicePixelRatio = 1;
  const tree = module.exports.MarsCanvas();
  const findCanvas = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type.name === 'Canvas') return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = findCanvas(child);
      if (found) return found;
    }
    return null;
  };
  const canvasElement = findCanvas(tree);
  assert.ok(canvasElement, 'the Mars scene renders a Canvas');
  const domElement = { style: {} };
  canvasElement.props.onCreated({ gl: { domElement, setPixelRatio() {}, setClearColor() {} }, scene: {} });
  assert.equal(domElement.style.touchAction, 'none');
  assert.equal(domElement.style.overscrollBehavior, 'none');
  assert.equal(documentStub.body.style.touchAction, 'pan-y', 'manual-scroll UI keeps its document gesture policy');
  assert.equal(documentStub.body.style.overscrollBehavior, 'auto', 'document overscroll behavior remains unchanged');
});
