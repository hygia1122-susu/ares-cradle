import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const cache = new Map();
const regionalParked = {
  impact: { position: [-223, -0.4, -246], heading: 0 }, ice: { position: [223, -0.4, -246], heading: 0 },
  volcano: { position: [-223, -0.4, 246], heading: 0 }, lake: { position: [223, -0.4, 246], heading: 0 },
  dust: { position: [18, -0.4, -242], heading: 0 },
};
const store = {
  isDrivingRover: false, remoteRegionId: null, regionalRoverPoses: structuredClone(regionalParked),
  roverPos: [0, -0.4, 8.5], roverHeading: 0, roverSpeed: 0, cameraYaw: Math.PI, playerPos: [2, -0.4, 3],
  isMouseDriving: false, joystickVector: { x: 0, y: 0 }, isSimulating: true,
  isBackpackOpen: false, isManualOpen: false, activeScienceEntryId: null,
  isClassroomOpen: false, isBrownoutQuizOpen: false, isDatapadOpen: false, isGameOver: false, isVictory: false,
  roverHeadlightMode: 'low', toggleCalls: 0, toggleAllowed: true, publishes: [], legacyPositionWrites: 0,
};
const resetStore = (patch = {}) => {
  Object.assign(store, {
    isDrivingRover: false, remoteRegionId: null, regionalRoverPoses: structuredClone(regionalParked),
    roverPos: [0, -0.4, 8.5], roverHeading: 0, roverSpeed: 0, cameraYaw: Math.PI, playerPos: [2, -0.4, 3],
    isMouseDriving: false, joystickVector: { x: 0, y: 0 }, isSimulating: true,
    isBackpackOpen: false, isManualOpen: false, activeScienceEntryId: null,
    isClassroomOpen: false, isBrownoutQuizOpen: false, isDatapadOpen: false, isGameOver: false, isVictory: false,
    roverHeadlightMode: 'low', toggleCalls: 0, toggleAllowed: true, publishes: [], legacyPositionWrites: 0, ...patch,
  });
  if (store.isDrivingRover && !store.remoteRegionId) store.remoteRegionId = 'impact';
  if (store.remoteRegionId) {
    const pose = store.regionalRoverPoses[store.remoteRegionId];
    store.roverPos = [...pose.position]; store.roverHeading = pose.heading;
  }
  return store;
};
const useOutpostStore = (selector) => selector(store);
useOutpostStore.getState = () => store;
store.getState = () => store;
store.setRoverPos = (pos) => { store.roverPos = [...pos]; };
store.setIsMouseDriving = (value) => { store.isMouseDriving = value; };
store.setJoystickVector = (value) => { store.joystickVector = value; };
store.setPlayerPos = () => { store.legacyPositionWrites++; throw new Error('legacy player-position setter used'); };
store.publishRoverState = (pose, speed) => {
  if (!store.remoteRegionId || ![pose.x, pose.y, pose.z, pose.heading, speed].every(Number.isFinite)) return;
  store.publishes.push({ pose: { ...pose }, speed });
  store.roverPos = [pose.x, pose.y, pose.z]; store.roverHeading = pose.heading; store.roverSpeed = speed;
  store.regionalRoverPoses[store.remoteRegionId] = { position: [...store.roverPos], heading: pose.heading };
};
store.toggleDrivingRover = () => {
  store.toggleCalls++;
  if (!store.toggleAllowed) return;
  store.isDrivingRover = !store.isDrivingRover;
  store.remoteRegionId = store.isDrivingRover ? 'impact' : null;
  if (store.remoteRegionId) store.roverPos = [...store.regionalRoverPoses[store.remoteRegionId].position];
};

class ElementStub { closest() { return null; } }
class EventHub {
  listeners = new Map();
  addEventListener(type, fn) { const list = this.listeners.get(type) ?? new Set(); list.add(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners.get(type) ?? []) fn(event); }
  clear() { this.listeners.clear(); }
}
const win = new EventHub();
const doc = Object.assign(new EventHub(), { hidden: false, dialog: false,
  querySelector(selector) { return selector === '[role="dialog"]' && this.dialog ? {} : null; } });
globalThis.Element = ElementStub; globalThis.window = win; globalThis.document = doc;

let frame;
let effect;
let layoutEffect;
let hooks;
let hookIndex;
let legacyStoryState = {};
const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};
const fixtureCraft = () => {
  const craft = new THREE.Group(); craft.name = 'fixture-rover';
  for (const side of [-1, 1]) {
    const suspension = new THREE.Group();
    suspension.name = side < 0 ? 'suspension-minus-x' : 'suspension-plus-x';
    suspension.position.set(side * 1.02, 0.69, 0.15);
    const bogie = new THREE.Group(); bogie.name = 'bogie-pivot';
    bogie.position.set(0, -0.1, -0.43);
    suspension.add(bogie);
    const addWheel = (parent, position) => {
      const knuckle = new THREE.Group(); knuckle.name = 'steering-knuckle';
      knuckle.position.set(...position);
      const wheel = new THREE.Group(); wheel.name = 'rolling-wheel'; knuckle.add(wheel);
      parent.add(knuckle);
    };
    addWheel(suspension, [side * 0.13, -0.42, 0.87]);
    addWheel(bogie, [side * 0.13, -0.32, 0.28]);
    addWheel(bogie, [side * 0.13, -0.32, -0.62]);
    craft.add(suspension);
  }
  return craft;
};
const compile = (path) => {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (id === 'react') return {
      useRef(initial) { const index = hookIndex++; return hooks[index] ?? (hooks[index] = { current: initial }); },
      useMemo(fn) { const index = hookIndex++; return hooks[index] ?? (hooks[index] = fn()); },
      useEffect(fn) { effect = fn; }, useLayoutEffect(fn) { layoutEffect = fn; },
    };
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === '@react-three/fiber') return { useFrame(fn) { frame = fn; } };
    if (id === 'three') return THREE;
    if (id.endsWith('/RealRoverCraft') || id === '../../game/art/realism/RealRoverCraft') return { RealRoverCraft: fixtureCraft };
    if (id === '../../modules/store/useOutpostStore' || id === '../store/useOutpostStore') return { useOutpostStore,
      PLAYABLE_ROVER_SPEC: { radius: 1.55, scale: 0.7, wheelbase: 1.7, trackWidth: 1.6, groundOffset: 0 } };
    if (id === '../store/useStoryStore') return { useStoryStore: { getState: () => legacyStoryState } };
    if (id.startsWith('.')) {
      let child = resolve(dirname(path), id);
      if (!/\.tsx?$/.test(child)) child += '.ts';
      return compile(child);
    }
    throw new Error(`Unexpected import in watch-controller harness: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};
const component = compile(resolve(root, 'src/modules/outpost-3d/PlayableWatchRover.tsx')).PlayableWatchRover;
const materialize = (node, parent = null) => {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((child) => materialize(child, parent));
  if (node.isObject3D) { if (parent) parent.add(node); return node; }
  if (typeof node.type === 'function') return materialize(node.type(node.props), parent);
  if (typeof node.type !== 'string') return node;
  const object = node.type === 'group' ? new THREE.Group() : new THREE.Group();
  const props = node.props ?? {};
  if (props.name) object.name = props.name;
  if (props.position) object.position.set(...props.position);
  if (props.rotation) object.rotation.set(...props.rotation);
  if (props.scale) object.scale.set(...(Array.isArray(props.scale) ? props.scale : [props.scale, props.scale, props.scale]));
  if (typeof props.onClick === 'function') object.userData.onClick = props.onClick;
  if (parent) parent.add(object);
  if (props.ref) props.ref.current = object;
  materialize(props.children, object);
  return object;
};
const mount = (patch = {}) => {
  resetStore(patch); win.clear(); doc.clear(); doc.hidden = false; doc.dialog = false; frame = null; effect = null; layoutEffect = null; hooks = []; hookIndex = 0;
  const tree = component();
  const rootObject = materialize(tree);
  layoutEffect?.();
  const cleanup = effect?.();
  assert.equal(typeof frame, 'function');
  return { rootObject, cleanup, tick: (dt = 0.05) => { frame({}, dt); return rootObject; }, close: () => cleanup?.() };
};
const key = (code, extra = {}) => ({ code, repeat: false, target: null, prevented: false, preventDefault() { this.prevented = true; }, ...extra });
const activeRoot = (rootObject) => rootObject.children.find((child) => child.name === 'regional-rover-impact');
const knuckles = (rootObject) => {
  const result = []; activeRoot(rootObject)?.traverse((object) => { if (object.name === 'steering-knuckle') result.push(object); });
  return result;
};
const axleKnuckles = (rootObject, axle) => {
  const root = activeRoot(rootObject), model = root?.children[0]; model?.updateWorldMatrix(true, true);
  return knuckles(rootObject).filter((knuckle) => {
    const local = model.worldToLocal(knuckle.getWorldPosition(new THREE.Vector3()));
    return (local.z > 0.6 ? 'front' : local.z > -0.15 ? 'middle' : 'rear') === axle;
  });
};
const finitePose = () => [store.roverPos[0], store.roverPos[1], store.roverPos[2], store.roverHeading, store.roverSpeed]
  .forEach((value) => assert.ok(Number.isFinite(value), `non-finite rover value ${value}`));

test('component accepts W movement as finite forward +Z pose on the active regional rover', () => {
  const playerPos = [...store.playerPos];
  const app = mount({ isDrivingRover: true, remoteRegionId: 'impact' }); app.tick();
  const before = store.roverPos[2];
  win.dispatch('keydown', key('KeyW')); app.tick();
  assert.ok(store.roverPos[2] > before); assert.ok(store.roverSpeed > 0); finitePose();
  assert.deepEqual(store.playerPos, playerPos, 'remote rover publication does not teleport the human');
  assert.equal(store.publishes.length, 2, 'one atomic store publication per active frame');
  assert.equal(store.legacyPositionWrites, 0); app.close();
});

test('stationary A steers only the two front knuckles; idle wheels stay unrolled on flat ground', () => {
  const app = mount({ isDrivingRover: true }); app.tick(); win.dispatch('keydown', key('KeyA')); app.tick(0.1);
  const wheels = knuckles(app.rootObject), front = axleKnuckles(app.rootObject, 'front');
  assert.equal(wheels.length, 6); assert.equal(front.length, 2); assert.ok(front.every((wheel) => wheel.rotation.y > 0));
  assert.ok(wheels.filter((wheel) => !front.includes(wheel)).every((wheel) => wheel.rotation.y === 0));
  assert.equal(store.roverHeading, 0); assert.equal(store.roverSpeed, 0);
  win.dispatch('keyup', key('KeyA')); app.tick();
  assert.ok(wheels.every((wheel) => wheel.getObjectByName('rolling-wheel').rotation.x === 0));
  assert.ok(Math.abs(activeRoot(app.rootObject).children[0].rotation.x) < 1e-12); assert.ok(Math.abs(activeRoot(app.rootObject).children[0].rotation.z) < 1e-12); app.close();
});

test('regional idle pose samples canonical terrain and does not animate wheels', () => {
  const app = mount({ isDrivingRover: true });
  app.tick();
  assert.ok(Math.abs(activeRoot(app.rootObject).position.y - store.roverPos[1]) < 1e-12,
    'regional rover root follows its published canonical ground pose');
  assert.ok(knuckles(app.rootObject).every((wheel) => Number.isFinite(wheel.position.y)));
  assert.ok(knuckles(app.rootObject).every((wheel) => wheel.getObjectByName('rolling-wheel').rotation.x === 0),
    'zero accepted travel leaves all wheels unrolled');
  app.close();
});

test('W+D curves while moving and accepted travel rolls all six wheels', () => {
  const app = mount({ isDrivingRover: true }); app.tick(); win.dispatch('keydown', key('KeyW')); win.dispatch('keydown', key('KeyD'));
  for (let i = 0; i < 35; i++) app.tick();
  assert.ok(store.roverPos[0] < regionalParked.impact.position[0] && store.roverHeading < 0 && store.roverPos[2] > regionalParked.impact.position[2]);
  const wheels = knuckles(app.rootObject);
  assert.ok(axleKnuckles(app.rootObject, 'front').every((wheel) => wheel.rotation.y < 0), 'positive D steering is negative model rotation');
  assert.ok(wheels.every((wheel) => wheel.getObjectByName('rolling-wheel').rotation.x > 0));
  finitePose(); app.close();
});

test('S reverses immediately, and a modal pause cannot retain or catch up input', () => {
  let app = mount({ isDrivingRover: true }); app.tick(); win.dispatch('keydown', key('KeyW'));
  for (let i = 0; i < 80; i++) app.tick(); win.dispatch('keyup', key('KeyW')); app.tick(); win.dispatch('keydown', key('KeyS'));
  app.tick(); assert.ok(store.roverSpeed < 0, 'S starts reverse directly');
  win.dispatch('keyup', key('KeyS')); win.dispatch('keydown', key('KeyW')); app.tick();
  doc.dialog = true; app.tick(); assert.equal(store.roverSpeed, 0); const pausedZ = store.roverPos[2];
  doc.dialog = false; app.tick(); assert.equal(store.roverSpeed, 0); assert.equal(store.roverPos[2], pausedZ);
  finitePose(); app.close();
});

test('blur clears keys, mouse, joystick and velocity before focus resumes', () => {
  const app = mount({ isDrivingRover: true, isMouseDriving: true, joystickVector: { x: 0.5, y: 1 } });
  app.tick(); win.dispatch('keydown', key('KeyW')); app.tick(); assert.ok(store.roverSpeed > 0);
  win.dispatch('blur'); app.tick(); assert.equal(store.roverSpeed, 0);
  assert.equal(store.isMouseDriving, false); assert.deepEqual(store.joystickVector, { x: 0, y: 0 });
  const z = store.roverPos[2]; win.dispatch('focus'); app.tick(); assert.equal(store.roverPos[2], z);
  app.close();
});

test('canvas click on scout cannot board or exit remote control', () => {
  for (const patch of [{}, { isDrivingRover: true }]) {
    const app = mount(patch);
    const roverGroup = app.rootObject.children.find((child) => child.name === 'regional-rover-impact');
    assert.ok(roverGroup, 'rendered regional rover group exists');
    const playerPos = [...store.playerPos];
    const roverPos = [...store.roverPos];
    if (typeof roverGroup.userData.onClick === 'function') roverGroup.userData.onClick({ stopPropagation() {} });
    assert.equal(store.toggleCalls, 0, 'rover mesh click never changes remote-control mode');
    assert.equal(store.isDrivingRover, Boolean(patch.isDrivingRover));
    assert.deepEqual(store.playerPos, playerPos, 'click does not move the human');
    assert.deepEqual(store.roverPos, roverPos, 'click does not move the rover');
    app.close();
  }
});

test('R delegates exactly one guarded enter/exit action; Space blocks only while driving', () => {
  const app = mount();
  const enter = key('KeyR'); win.dispatch('keydown', enter); assert.equal(store.toggleCalls, 1); assert.equal(store.isDrivingRover, true);
  win.dispatch('keydown', key('KeyR', { repeat: true })); assert.equal(store.toggleCalls, 1);
  const drivingSpace = key('Space'); win.dispatch('keydown', drivingSpace); assert.equal(drivingSpace.prevented, true);
  const exit = key('KeyR'); win.dispatch('keydown', exit); assert.equal(store.toggleCalls, 2); assert.equal(store.isDrivingRover, false);
  const footSpace = key('Space'); win.dispatch('keydown', footSpace); assert.equal(footSpace.prevented, false);
  store.toggleAllowed = false; win.dispatch('keydown', key('KeyR')); assert.equal(store.toggleCalls, 3); assert.equal(store.isDrivingRover, false);
  app.close();
});

test('stale story and unmounted legacy flags do not block exploration rover controls', () => {
  legacyStoryState = { isBriefingOpen: true, isLabStationOpen: true, isScienceCardOpen: true, isChapterSelectOpen: true };
  const app = mount({ isClassroomOpen: true, isBrownoutQuizOpen: true, isDatapadOpen: true });
  const enter = key('KeyR'); win.dispatch('keydown', enter);
  assert.equal(store.toggleCalls, 1); assert.equal(store.isDrivingRover, true);
  app.tick(); const before = store.roverPos[2];
  win.dispatch('keydown', key('KeyW')); app.tick();
  assert.ok(store.roverPos[2] > before, 'stale legacy flags cannot pause normal exploration motion');
  legacyStoryState = {}; app.close();
});

test('manual and science-entry overlays block entry and pause motion without catch-up', () => {
  for (const pause of [{ isManualOpen: true }, { activeScienceEntryId: 'sample-entry' }]) {
    const app = mount(pause);
    win.dispatch('keydown', key('KeyR'));
    assert.equal(store.toggleCalls, 0, 'visible new exploration overlays block rover entry');
    app.close();
  }

  for (const pause of [{ isManualOpen: true }, { activeScienceEntryId: 'sample-entry' }]) {
    const app = mount({ isDrivingRover: true }); app.tick();
    win.dispatch('keydown', key('KeyW')); app.tick(); assert.ok(store.roverSpeed > 0);
    Object.assign(store, pause); app.tick();
    assert.equal(store.roverSpeed, 0, 'opening a current exploration overlay pauses the rover');
    const pausedZ = store.roverPos[2];
    for (const keyCode of ['KeyW', 'KeyS']) win.dispatch('keydown', key(keyCode));
    Object.assign(store, { isManualOpen: false, activeScienceEntryId: null }); app.tick();
    assert.equal(store.roverSpeed, 0); assert.equal(store.roverPos[2], pausedZ, 'cleared controls do not catch up');
    app.close();
  }
});

test('legacy rover:uturn event is ignored without assisted turning', () => {
  const app = mount({ isDrivingRover: true }); app.tick();
  win.dispatch('keydown', key('KeyW'));
  for (let i = 0; i < 20; i++) app.tick();
  const before = { x: store.roverPos[0], heading: store.roverHeading };
  win.dispatch('rover:uturn'); app.tick();
  assert.ok(Math.abs(store.roverHeading - before.heading) < 1e-12);
  assert.ok(Math.abs(store.roverPos[0] - before.x) < 0.5);
  app.close();
});

test('legacy rover:uturn events remain ignored while driving', () => {
  const app = mount({ isDrivingRover: true }); app.tick();
  win.dispatch('keydown', key('KeyW')); app.tick();
  const heading = store.roverHeading;
  win.dispatch('rover:uturn'); app.tick();
  assert.ok(Math.abs(store.roverHeading - heading) < 1e-12);
  finitePose(); app.close();
});

test('modal pause clears controls and the ignored legacy uturn cannot resume', () => {
  let app = mount({ isDrivingRover: true }); app.tick();
  win.dispatch('keydown', key('KeyW'));
  for (let i = 0; i < 8; i++) app.tick();
  const beforeS = store.roverSpeed;
  win.dispatch('rover:uturn'); win.dispatch('keydown', key('KeyS')); app.tick();
  assert.ok(store.roverSpeed < beforeS, 'S immediately decreases forward velocity');
  app.close();

  app = mount({ isDrivingRover: true }); app.tick();
  win.dispatch('keydown', key('KeyW'));
  for (let i = 0; i < 8; i++) app.tick();
  win.dispatch('rover:uturn'); doc.dialog = true; app.tick();
  assert.equal(store.roverSpeed, 0, 'modal pause stops the rover');
  const pausedHeading = store.roverHeading;
  doc.dialog = false; win.dispatch('keydown', key('KeyW'));
  for (let i = 0; i < 20; i++) app.tick();
  assert.ok(Math.abs(store.roverHeading - pausedHeading) < 1e-12, 'resuming input cannot continue the canceled assist');
  finitePose(); app.close();
});
