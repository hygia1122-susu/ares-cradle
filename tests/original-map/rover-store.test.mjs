import assert from 'node:assert/strict';
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
      return { getState: get, setState: set, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } };
    } };
    if (id === '@/modules/character/physicsEngine') return compile(resolve(root, 'src/modules/character/physicsEngine.ts'));
    if (id === '@/modules/outpost-3d/worldRegions' || id === '../outpost-3d/worldRegions' || id === './worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'));
    if (id === './expeditionProgress') return compile(resolve(root, 'src/modules/store/expeditionProgress.ts'));
    if (id === './explorationProgress') return compile(resolve(root, 'src/modules/store/explorationProgress.ts'));
    if (id === '../outpost-3d/scienceCatalog') return compile(resolve(root, 'src/modules/outpost-3d/scienceCatalog.ts'));
    if (id === './worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'));
    if (id === '../../game/mission/activities/rules') return compile(resolve(root, 'src/game/mission/activities/rules.ts'));
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

const store = compile(resolve(root, 'src/modules/store/useOutpostStore.ts')).useOutpostStore;
const world = compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'));
const reset = () => store.setState({
  isDrivingRover: false,
  isManualOpen: false,
  remoteRegionId: null,
  regionalRoverPoses: Object.fromEntries(world.WORLD_REGIONS.map((region) => [region.id, {
    position: [region.safeParking.x, world.sampleWorldGround(region.safeParking.x, region.safeParking.z), region.safeParking.z], heading: 0
  }])),
  roverPos: [world.WORLD_REGIONS.find(({ id }) => id === 'dust').safeParking.x, world.sampleWorldGround(18, -242), -242],
  roverHeading: 0,
  roverSpeed: 0,
  playerPos: [0, -0.4, 1.55],
  isPlayerGrounded: true,
  isInsideHabitat: true,
  isMouseDriving: false,
  joystickVector: { x: 0, y: 0 },
  isPointerLocked: false
});
const atConsole = (region) => [
  region.baseConsole.x,
  world.sampleWorldGround(region.baseConsole.x, region.baseConsole.z),
  region.baseConsole.z
];
const roverPoseAt = (region, xOffset = 2) => ({
  x: region.center.x + xOffset,
  y: world.sampleWorldGround(region.center.x + xOffset, region.center.z),
  z: region.center.z,
  heading: Math.PI / 4
});

test('remote rover leaves human pose untouched across entry, travel, and exit', () => {
  reset();
  const region = world.WORLD_REGIONS.find(({ id }) => id === 'ice');
  const humanPose = atConsole(region);
  store.setState({ playerPos: humanPose, isPointerLocked: true, isMouseDriving: true, joystickVector: { x: 1, y: -1 } });
  store.getState().toggleDrivingRover();
  let state = store.getState();
  assert.equal(state.isDrivingRover, true);
  assert.equal(state.remoteRegionId, 'ice');
  assert.deepEqual(state.playerPos, humanPose);
  assert.deepEqual(state.roverPos, state.regionalRoverPoses.ice.position);
  store.getState().publishRoverState(roverPoseAt(region, 12), 2.5);
  state = store.getState();
  const traveledPose = [region.center.x + 12, world.sampleWorldGround(region.center.x + 12, region.center.z), region.center.z];
  assert.deepEqual(state.roverPos, traveledPose);
  assert.deepEqual(state.playerPos, humanPose, 'remote movement never moves human on foot');
  assert.equal(state.isInsideHabitat, true);
  assert.deepEqual(state.regionalRoverPoses.ice.position, traveledPose);
  store.getState().toggleDrivingRover();
  state = store.getState();
  assert.equal(state.isDrivingRover, false);
  assert.equal(state.remoteRegionId, null);
  assert.deepEqual(state.playerPos, humanPose, 'exit does not dismount or teleport human');
  assert.deepEqual(state.roverPos, traveledPose);
  assert.equal(state.roverSpeed, 0);
  assert.equal(state.isMouseDriving, false);
  assert.deepEqual(state.joystickVector, { x: 0, y: 0 });
  assert.equal(state.isPointerLocked, false);
});

test('remote rover poses are bounded, region-local, and do not mutate actor state', () => {
  reset();
  const region = world.WORLD_REGIONS.find(({ id }) => id === 'lake');
  const humanPose = atConsole(region);
  store.setState({ playerPos: humanPose });
  store.getState().toggleDrivingRover();
  const before = store.getState();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  const publish = store.getState().publishRoverState;
  for (const [pose, speed] of [
    [{ x: NaN, y: 0, z: 0, heading: 0 }, 1],
    [{ x: 301, y: 0, z: 0, heading: 0 }, 1],
    [{ x: 0, y: 101, z: 0, heading: 0 }, 1],
    [{ x: 0, y: 0, z: 0, heading: Infinity }, 1],
    [{ x: region.center.x + 76, y: -0.4, z: region.center.z, heading: 0 }, 1],
    [{ x: region.center.x + 1, y: -0.4, z: region.center.z, heading: 0 }, 5.1],
    [{ x: region.center.x + 1, y: -0.4, z: region.center.z, heading: 0 }, -3.1]
  ]) publish(pose, speed);
  unsubscribe();
  const after = store.getState();
  assert.equal(notifications, 0, 'rejected poses do not publish');
  assert.strictEqual(after.roverPos, before.roverPos);
  assert.strictEqual(after.playerPos, before.playerPos);
  assert.strictEqual(after.regionalRoverPoses, before.regionalRoverPoses);
  publish(roverPoseAt(region, 5), -2.8);
  assert.deepEqual(store.getState().playerPos, humanPose);
  assert.equal(store.getState().roverSpeed, -2.8);
  const forwardFivePose = roverPoseAt(region, 6);
  let acceptedPublications = 0;
  const unsubscribeAccepted = store.subscribe(() => { acceptedPublications += 1; });
  publish(forwardFivePose, 5);
  unsubscribeAccepted();
  assert.equal(acceptedPublications, 1, 'maximum forward dynamics speed publishes a store update');
  assert.equal(store.getState().roverSpeed, 5);
  assert.deepEqual(store.getState().roverPos, [forwardFivePose.x, forwardFivePose.y, forwardFivePose.z]);
  assert.deepEqual(store.getState().playerPos, humanPose, 'max-speed rover publication does not move human actor');
});

test('entry requires the nearest regional console within 18m and a grounded active actor', () => {
  reset();
  const region = world.WORLD_REGIONS.find(({ id }) => id === 'dust');
  const toggle = store.getState().toggleDrivingRover;
  store.setState({ playerPos: [0, -0.4, -212] });
  toggle();
  assert.equal(store.getState().isDrivingRover, false, 'far actor cannot remote-drive');
  store.setState({ playerPos: atConsole(region), isPlayerGrounded: false });
  toggle();
  assert.equal(store.getState().isDrivingRover, false, 'airborne actor cannot remote-drive');
  store.setState({ playerPos: atConsole(region), isPlayerGrounded: true, isBackpackOpen: true });
  toggle();
  assert.equal(store.getState().isDrivingRover, false, 'modal actor cannot remote-drive');
  store.setState({ isBackpackOpen: false, playerPos: atConsole(region), exploration: {
    ...store.getState().exploration,
    survival: { ...store.getState().exploration.survival, energyEU: 0 }
  } });
  toggle();
  assert.equal(store.getState().isDrivingRover, false, 'depleted energy cannot start remote control');
  assert.match(store.getState().explorationNotice, /energy/i);
  store.setState({ exploration: {
    ...store.getState().exploration,
    survival: { ...store.getState().exploration.survival, energyEU: 100 }
  } });
  store.setState({ playerPos: [region.baseConsole.x + 18.5, -0.4, region.baseConsole.z] });
  toggle();
  assert.equal(store.getState().isDrivingRover, false, 'console radius is strict');
  store.setState({ playerPos: atConsole(region) });
  toggle();
  assert.equal(store.getState().isDrivingRover, true);
});

test('each region initializes its rover at its own sampled safe parking point', () => {
  reset();
  const poses = store.getState().regionalRoverPoses;
  assert.deepEqual(Object.keys(poses).sort(), world.WORLD_REGIONS.map(({ id }) => id).sort());
  for (const region of world.WORLD_REGIONS) {
    const expected = [region.safeParking.x, world.sampleWorldGround(region.safeParking.x, region.safeParking.z), region.safeParking.z];
    assert.deepEqual(poses[region.id].position, expected, region.id);
    assert.equal(poses[region.id].heading, 0);
  }
});
