import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();
const compile = (path) => {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const source = require('node:fs').readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const localRequire = (id) => {
    if (id === 'zustand') return { create: (initialize) => {
      let state;
      const listeners = new Set();
      const set = (update) => {
        const previous = state;
        const patch = typeof update === 'function' ? update(state) : update;
        if (!patch) return;
        state = { ...state, ...patch };
        for (const listener of listeners) listener(state, previous);
      };
      const get = () => state;
      state = initialize(set, get);
      return {
        getState: get,
        setState: set,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }
      };
    } };
    if (id === '@/modules/character/physicsEngine') return compile(resolve(root, 'src/modules/character/physicsEngine.ts'));
    if (id === '@/modules/outpost-3d/worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'));
    if (id === '../outpost-3d/worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'));
    if (id === '@/modules/simulation-engine/formulas') return {};
    if (id === '@/services/api') return { missionService: {} };
    if (id === '@/services/api/MockMissionService') return { STAGES_FIXTURES: [null, {
      sol: 1, initialBatteryKwh: 80, batteryCapacityKwh: 100, initialOxygenPercent: 20.9,
      initialTemperatureCelsius: 20, initialDustCoverage: 0, events: []
    }] };
    if (id === '@/modules/audio/soundEngine') return { soundEngine: new Proxy({}, { get: () => () => {} }) };
    if (id === '@/modules/story-engine/services/marsWeatherService') return {};
    if (id === './useStoryStore') return { useStoryStore: { getState: () => ({}) } };
    if (id === '@/modules/survival-ui/itemRegistry') return {};
    throw new Error(`Unexpected import in store test: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};

const storeModule = compile(resolve(root, 'src/modules/store/useOutpostStore.ts'));
const store = storeModule.useOutpostStore;
const cleanState = () => store.setState({
  isDrivingRover: false,
  roverPos: [3.8, -0.32, -2.2],
  roverHeading: 0,
  roverSpeed: 0,
  playerPos: [0, -0.4, 1.55],
  isInsideHabitat: true,
  isMouseDriving: false,
  joystickVector: { x: 0, y: 0 },
  inventory: { backup_battery: 1 },
  batteryKwh: 80
});

 test('publishes a bounded rover pose atomically to rover and legacy player state', () => {
  cleanState();
  store.setState({ isDrivingRover: true });
  const before = store.getState();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  before.publishRoverState({ x: 8, y: -0.4, z: 12, heading: Math.PI / 2 }, 2.5);
  unsubscribe();

  const after = store.getState();
  assert.equal(notifications, 1, 'pose and legacy location publish in one store update');
  assert.strictEqual(after.roverPos, after.playerPos);
  assert.deepEqual(after.roverPos, [8, -0.4, 12]);
  assert.equal(after.roverHeading, Math.PI / 2);
  assert.equal(after.roverSpeed, 2.5);
  assert.equal(after.isInsideHabitat, false);
  assert.deepEqual(after.inventory, before.inventory);
  assert.equal(after.batteryKwh, before.batteryKwh);
});

test('rejects invalid or unbounded poses and never publishes while on foot', () => {
  cleanState();
  store.setState({ isDrivingRover: true });
  const publish = store.getState().publishRoverState;
  const before = store.getState();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  for (const [pose, speed] of [
    [{ x: NaN, y: 0, z: 0, heading: 0 }, 1],
    [{ x: 301, y: 0, z: 0, heading: 0 }, 1],
    [{ x: 0, y: 101, z: 0, heading: 0 }, 1],
    [{ x: 0, y: 0, z: 0, heading: Infinity }, 1],
    [{ x: 0, y: 0, z: 0, heading: 0 }, 5.1]
  ]) publish(pose, speed);
  store.setState({ isDrivingRover: false });
  const afterToggle = store.getState();
  notifications = 0;
  publish({ x: 4, y: -0.4, z: 9, heading: 0 }, 1);
  unsubscribe();

  const after = store.getState();
  assert.equal(notifications, 0, 'invalid pose and on-foot publish cause no update');
  assert.strictEqual(after.roverPos, before.roverPos);
  assert.strictEqual(after.playerPos, before.playerPos);
  assert.equal(after.roverHeading, before.roverHeading);
  assert.equal(after.roverSpeed, before.roverSpeed);
  assert.strictEqual(after.playerPos, afterToggle.playerPos);
});

test('dismount chooses a clear heading-relative side spot on sampled ground', () => {
  cleanState();
  store.setState({ isDrivingRover: true, roverPos: [50, -0.4, 50], roverHeading: Math.PI / 2,
    roverSpeed: 2, isMouseDriving: true, joystickVector: { x: 1, y: 1 } });
  store.getState().toggleDrivingRover();
  const state = store.getState();
  assert.equal(state.isDrivingRover, false);
  assert.ok(state.playerPos[2] > 52, 'heading-relative left side points toward +Z at heading π/2');
  assert.ok(Math.abs(state.playerPos[1] + 0.4) < 1e-9);
  assert.equal(state.isMouseDriving, false);
  assert.deepEqual(state.joystickVector, { x: 0, y: 0 });
  assert.equal(state.roverSpeed, 0);
  assert.deepEqual(state.inventory, { backup_battery: 1 });
  assert.equal(state.batteryKwh, 80);
});

test('keeps driving state when every bounded dismount candidate is blocked', () => {
  cleanState();
  const roverPos = [299, -0.4, 299];
  store.setState({ isDrivingRover: true, roverPos, roverHeading: 0, playerPos: [290, -0.4, 290] });
  store.getState().toggleDrivingRover();
  const state = store.getState();
  assert.equal(state.isDrivingRover, true);
  assert.strictEqual(state.roverPos, roverPos);
  assert.deepEqual(state.playerPos, [290, -0.4, 290]);
});
