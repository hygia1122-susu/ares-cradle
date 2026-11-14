import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compile = (path, localRequire, cache = new Map()) => {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const source = require('node:fs').readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};

const makeHarness = ({ initialEntries = [], failWrites = false, isBriefingOpen = false } = {}) => {
  const values = new Map(initialEntries);
  const writes = [];
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => {
      writes.push([key, value]);
      if (failWrites) throw new Error('quota exceeded');
      values.set(key, value);
    }
  };
  globalThis.window = { localStorage: storage };
  globalThis.document = { hidden: false, pointerLockElement: null, querySelector: () => false, exitPointerLock: () => { globalThis.document.pointerLockElement = null; } };
  const cache = new Map();
  const localRequire = (id) => {
    if (id === 'zustand') return { create: (initialize) => {
      let state;
      const set = (update) => {
        const patch = typeof update === 'function' ? update(state) : update;
        if (patch) state = { ...state, ...patch };
      };
      const get = () => state;
      state = initialize(set, get);
      return { getState: get, setState: set };
    } };
    if (id === '@/modules/character/physicsEngine') return compile(resolve(root, 'src/modules/character/physicsEngine.ts'), localRequire, cache);
    if (id === '@/modules/outpost-3d/worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'), localRequire, cache);
    if (id === './expeditionProgress') return compile(resolve(root, 'src/modules/store/expeditionProgress.ts'), localRequire, cache);
    if (id === './explorationProgress') return compile(resolve(root, 'src/modules/store/explorationProgress.ts'), localRequire, cache);
    if (id === '../outpost-3d/scienceCatalog') return compile(resolve(root, 'src/modules/outpost-3d/scienceCatalog.ts'), localRequire, cache);
    if (id === '../../game/mission/activities/rules') return compile(resolve(root, 'src/game/mission/activities/rules.ts'), localRequire, cache);
    if (id === '../outpost-3d/worldRegions' || id === './worldRegions') return compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'), localRequire, cache);
    if (id === '@/modules/simulation-engine/formulas') return {
      SIM_CONSTANTS: { SOL_DURATION_SECONDS: 60 },
      calculateSimulationStep: ({ currentState }) => ({ nextState: {
        ...currentState, batteryPercent: currentState.batteryPercent - 1, batteryKwh: currentState.batteryKwh - 1
      }, warnings: [] }),
      calculateDebriefReport: () => ({ score: 0 }),
      determineSolPhase: () => 'Morning'
    };
    if (id === '@/services/api') return { missionService: { submitStageResult: () => {} } };
    if (id === '@/services/api/MockMissionService') return { STAGES_FIXTURES: [null, {
      sol: 1, initialBatteryKwh: 80, batteryCapacityKwh: 100, initialOxygenPercent: 20.9,
      initialTemperatureCelsius: 20, initialDustCoverage: 0, events: [], durationSeconds: 60
    }] };
    if (id === '@/modules/audio/soundEngine') return { soundEngine: new Proxy({}, { get: () => () => {} }) };
    if (id === '@/modules/story-engine/services/marsWeatherService') return {};
    if (id === './useStoryStore') return { useStoryStore: { getState: () => ({
      isBriefingOpen, isLabStationOpen: false, isScienceCardOpen: false, isChapterSelectOpen: false,
      getCurrentChapter: () => ({ objectives: [] }), completeObjective: () => {}
    }) } };
    if (id === '@/modules/survival-ui/itemRegistry') return {};
    throw new Error(`Unexpected import in expedition store test: ${id}`);
  };
  const storeModule = compile(resolve(root, 'src/modules/store/useOutpostStore.ts'), localRequire, cache);
  const world = compile(resolve(root, 'src/modules/outpost-3d/worldRegions.ts'), localRequire, cache);
  const progress = compile(resolve(root, 'src/modules/store/expeditionProgress.ts'), localRequire, cache);
  const exploration = compile(resolve(root, 'src/modules/store/explorationProgress.ts'), localRequire, cache);
  const science = compile(resolve(root, 'src/modules/outpost-3d/scienceCatalog.ts'), localRequire, cache);
  return { store: storeModule.useOutpostStore, values, writes, world, progress, exploration, science };
};

const STORAGE_KEY = 'ares-cradle-expedition-v1';
const EXPLORATION_KEY = 'ares-cradle-exploration-v1';
const LEGACY_KEYS = [
  ['ares-cradle-story-v1', '{"chapter":1}'],
  ['ares-cradle-mission-v2', '{"stage":2}'],
  ['ares-cradle-story-v3', '{"chapter":3,"evidence":"preserve-current-story"}']
];
const atConsole = (world, regionId) => {
  const { baseConsole } = world.WORLD_REGIONS.find((region) => region.id === regionId);
  return [baseConsole.x, world.sampleWorldGround(baseConsole.x, baseConsole.z), baseConsole.z];
};
const impactEvidence = {
  'rim-inspection': { tool: 'inspection-camera', wide: { action: 'inspect-frame', framing: 'wide', target: 'rim', frameId: 'training-rim-wide' }, close: { action: 'inspect-frame', framing: 'close', target: 'rim', frameId: 'training-rim-close' } },
  'dated-image-comparison': { tool: 'dated-image-comparison', before: { frame: 'before', frameId: 'training-before' }, after: { frame: 'after', frameId: 'training-after' }, changedFeatures: ['rim-edge', 'rock-position'] },
  'sample-comparison': { tool: 'sample-comparison', candidate: { measurement: 2.4, unit: 'relative signal units' }, reference: { measurement: 1.8, unit: 'relative signal units' }, conclusion: 'appearance-alone-cannot-determine-origin' }
};
const atImpactDiscovery = (world, progress, observationId) => {
  const index = progress.IMPACT_OBSERVATION_GUIDE[observationId].discoveryIndex;
  const { x, z } = world.WORLD_REGIONS.find((region) => region.id === 'impact').discoveries[index];
  return [x, world.sampleWorldGround(x, z), z];
};

test('loads and writes only the nested expedition save while preserving legacy records', () => {
  const harness = makeHarness({ initialEntries: LEGACY_KEYS });
  const { store, values, writes, world } = harness;
  const before = store.getState();
  const telemetry = ['solTime', 'battery', 'batteryKwh', 'oxygen', 'temperature', 'dustCoverage'];
  const originalTelemetry = Object.fromEntries(telemetry.map((key) => [key, before[key]]));
  before.startExpedition();
  assert.equal(store.getState().expeditionProgress.enabled, true);
  assert.deepEqual(Object.fromEntries(telemetry.map((key) => [key, store.getState()[key]])), originalTelemetry);
  assert.deepEqual([...values.entries()].filter(([key]) => key !== STORAGE_KEY), LEGACY_KEYS);
  assert.deepEqual(writes.map(([key]) => key), [STORAGE_KEY]);

  const active = atConsole(world, 'dust');
  store.setState({ playerPos: active, isPlayerGrounded: true, isDrivingRover: false });
  assert.equal(store.getState().activateExpeditionBase('dust'), true);
  assert.equal(store.getState().expeditionProgress.bases.dust.active, true);
  const saved = JSON.parse(values.get(STORAGE_KEY));
  assert.equal(saved.bases.dust.active, true);
  assert.equal(Object.hasOwn(saved, 'playerPos'), false);
  assert.equal(store.getState().activateExpeditionBase('dust'), false, 'activation is idempotent');
  assert.equal(writes.length, 2);
  assert.deepEqual([...values.entries()].filter(([key]) => key !== STORAGE_KEY), LEGACY_KEYS);
});

test('blocks overwrite of corrupt expedition bytes but keeps accepted progress in memory', () => {
  const raw = '{not-json\n';
  const harness = makeHarness({ initialEntries: [...LEGACY_KEYS, [STORAGE_KEY, raw]] });
  const { store, values, writes } = harness;
  assert.equal(store.getState().expeditionPersistenceBlocked, true);
  assert.match(store.getState().expeditionStorageWarning, /corrupt/);
  store.getState().startExpedition();
  assert.equal(store.getState().expeditionProgress.enabled, true);
  assert.equal(values.get(STORAGE_KEY), raw);
  assert.equal(writes.length, 0);
  assert.deepEqual([...values.entries()].filter(([key]) => key !== STORAGE_KEY), LEGACY_KEYS);
});

test('keeps in-memory progress and warns when browser storage rejects a save', () => {
  const harness = makeHarness({ initialEntries: LEGACY_KEYS, failWrites: true });
  const { store, values, writes, world } = harness;
  store.getState().startExpedition();
  assert.equal(store.getState().expeditionProgress.enabled, true);
  assert.equal(store.getState().expeditionPersistenceBlocked, true);
  assert.equal(store.getState().expeditionStorageWarning, 'Progress is not saved');
  store.setState({ playerPos: atConsole(world, 'impact'), isPlayerGrounded: true });
  assert.equal(store.getState().activateExpeditionBase('impact'), true);
  assert.equal(store.getState().expeditionProgress.bases.impact.active, true);
  assert.equal(writes.length, 1, 'failed persistence is not retried to risk overwriting');
  assert.deepEqual([...values.entries()], LEGACY_KEYS);
});

test('base activation rejects wrong, distant, rover, and airborne runtime contexts', () => {
  const { store, world } = makeHarness();
  store.getState().startExpedition();
  const initial = store.getState().expeditionProgress;
  store.setState({ playerPos: atConsole(world, 'dust'), isPlayerGrounded: true, isDrivingRover: false });
  assert.equal(store.getState().activateExpeditionBase('ice'), false);
  store.setState({ playerPos: [0, -0.4, -212] });
  assert.equal(store.getState().activateExpeditionBase('dust'), false);
  store.setState({ playerPos: atConsole(world, 'dust'), isDrivingRover: true });
  assert.equal(store.getState().activateExpeditionBase('dust'), false);
  store.setState({ isDrivingRover: false, isPlayerGrounded: false });
  assert.equal(store.getState().activateExpeditionBase('dust'), false);
  assert.strictEqual(store.getState().expeditionProgress, initial);
});

test('Impact store actions validate, persist, reload, and charge only once', () => {
  const harness = makeHarness({ initialEntries: LEGACY_KEYS });
  const { store, values, writes, world, progress } = harness;
  const initialTelemetry = ['battery', 'batteryKwh', 'oxygen', 'temperature', 'dustCoverage'];
  const telemetryBefore = Object.fromEntries(initialTelemetry.map((key) => [key, store.getState()[key]]));
  store.getState().startExpedition();
  store.setState({ playerPos: atConsole(world, 'impact'), isPlayerGrounded: true, isDrivingRover: false });
  assert.equal(store.getState().activateExpeditionBase('impact'), true);
  for (const observationId of ['rim-inspection', 'dated-image-comparison']) {
    store.setState({ playerPos: atImpactDiscovery(world, progress, observationId) });
    assert.equal(store.getState().observeImpact(observationId, impactEvidence[observationId]), true);
  }
  const beforePayment = store.getState().expeditionProgress;
  const writesBeforePayment = writes.length;
  assert.equal(store.getState().payImpactSurvey(false), false);
  assert.equal(store.getState().expeditionProgress.bases.impact.stock.energyEU, 12);
  assert.equal(writes.length, writesBeforePayment);
  assert.equal(store.getState().expeditionActionError, 'invalid-evidence');
  store.setState({ playerPos: atConsole(world, 'impact') });
  assert.equal(store.getState().payImpactSurvey(true, beforePayment.revision - 1), false, 'stale modal revision is forwarded');
  assert.equal(store.getState().expeditionActionError, 'stale-revision');
  assert.equal(writes.length, writesBeforePayment);
  assert.equal(store.getState().payImpactSurvey(true), true);
  assert.deepEqual(store.getState().expeditionProgress.bases.impact.stock, { energyEU: 10, meals: 3, water: 4, air: 3 });
  const afterPaymentWrites = writes.length;
  assert.equal(store.getState().payImpactSurvey(true), false, 'duplicate payment is not a new transaction');
  assert.equal(writes.length, afterPaymentWrites);
  for (const [signal, context] of [['signal-rim', 'frame-rim'], ['signal-basin', 'frame-basin'], ['signal-slope', 'frame-slope']]) {
    assert.equal(store.getState().matchImpactRecords(signal, context), true);
  }
  const final = store.getState().expeditionProgress;
  assert.equal(final.surveys.impact.activityDone, true);
  assert.deepEqual(Object.fromEntries(initialTelemetry.map((key) => [key, store.getState()[key]])), telemetryBefore);
  assert.deepEqual([...values.entries()].filter(([key]) => key !== STORAGE_KEY), LEGACY_KEYS);
  assert.deepEqual(writes.map(([key]) => key), Array(writes.length).fill(STORAGE_KEY));
  const raw = values.get(STORAGE_KEY);
  assert.equal(progress.parseExpeditionProgress(raw).ok, true);
  assert.deepEqual(progress.parseExpeditionProgress(raw).state, JSON.parse(raw));
  const reloaded = makeHarness({ initialEntries: [...LEGACY_KEYS, [STORAGE_KEY, raw]] });
  assert.deepEqual(reloaded.store.getState().expeditionProgress, final);
  assert.deepEqual([...reloaded.values.entries()].filter(([key]) => key !== STORAGE_KEY), LEGACY_KEYS);
  assert.equal(store.getState().matchImpactRecords('signal-rim', 'frame-rim'), false, 'duplicate match is not persisted');
  assert.equal(writes.length, 8, 'start, activation, two observations, payment, and three matches');
});

test('Impact store actions reject invalid context, stale evidence, and terminal state without writes', () => {
  const { store, world, progress, writes } = makeHarness();
  store.getState().startExpedition();
  store.setState({ playerPos: atConsole(world, 'impact'), isPlayerGrounded: true, isDrivingRover: false });
  store.getState().activateExpeditionBase('impact');
  const id = 'rim-inspection';
  const discovery = atImpactDiscovery(world, progress, id);
  const stateBefore = store.getState().expeditionProgress;
  const writeCount = writes.length;
  assert.equal(store.getState().observeImpact(id, impactEvidence[id], stateBefore.revision - 1), false);
  assert.equal(store.getState().expeditionActionError, 'stale-revision');
  for (const patch of [
    { playerPos: atConsole(world, 'dust') },
    { playerPos: discovery, isDrivingRover: true },
    { playerPos: discovery, isDrivingRover: false, isPlayerGrounded: false },
    { playerPos: [0, -0.4, -212], isPlayerGrounded: true }
  ]) {
    store.setState({ ...patch, isDrivingRover: patch.isDrivingRover ?? false, isPlayerGrounded: patch.isPlayerGrounded ?? true });
    assert.equal(store.getState().observeImpact(id, impactEvidence[id]), false);
  }
  store.setState({ isGameOver: true, playerPos: discovery, isPlayerGrounded: true, isDrivingRover: false });
  assert.equal(store.getState().observeImpact(id, impactEvidence[id]), false);
  store.setState({ isGameOver: false, isVictory: true });
  assert.equal(store.getState().observeImpact(id, impactEvidence[id]), false);
  assert.equal(store.getState().expeditionProgress, stateBefore);
  assert.equal(writes.length, writeCount);
});

test('scientific inspection uses the actual rover pose, persists full progress, and rewards a region once', () => {
  const harness = makeHarness({ initialEntries: LEGACY_KEYS });
  const { store, values, writes, science, world } = harness;
  const first = science.SCIENTIFIC_ELEMENTS.find((element) => element.regionId === 'dust');
  const secondAndThird = science.SCIENTIFIC_ELEMENTS.filter((element) => element.regionId === 'dust').slice(1);
  const region = world.WORLD_REGIONS.find(({ id }) => id === 'dust');
  store.setState({
    isManualOpen: false,
    exploration: { ...store.getState().exploration, survival: { air: 85, meals: 10, energyEU: 80 } },
    playerPos: [region.baseConsole.x, world.sampleWorldGround(region.baseConsole.x, region.baseConsole.z), region.baseConsole.z],
    isPlayerGrounded: true
  });
  store.getState().toggleDrivingRover();
  const pose = (element) => ({ x: element.position.x, y: world.sampleWorldGround(element.position.x, element.position.z), z: element.position.z, heading: 0 });
  store.getState().publishRoverState(pose(first), 0);
  assert.equal(store.getState().inspectScientificElement(first.id), true);
  assert.equal(store.getState().playerPos[0], region.baseConsole.x, 'actual human actor remains at console');
  assert.equal(store.getState().exploration.collected.includes(first.id), true);
  for (const element of secondAndThird) {
    store.getState().publishRoverState(pose(element), 0);
    assert.equal(store.getState().inspectScientificElement(element.id), true);
  }
  const saved = JSON.parse(values.get(EXPLORATION_KEY));
  assert.deepEqual(saved, store.getState().exploration, 'complete nested progress snapshot is persisted');
  assert.deepEqual(saved.completedRegions, ['dust']);
  assert.deepEqual(saved.rewardedRegions, ['dust']);
  assert.deepEqual(saved.survival, { air: 100, meals: 12, energyEU: 100 }, 'reward is capped at capacity');
  const beforeDuplicate = writes.filter(([key]) => key === EXPLORATION_KEY).length;
  store.getState().publishRoverState(pose(first), 0);
  assert.equal(store.getState().inspectScientificElement(first.id), true, 'already-unlocked entry can be reopened');
  assert.equal(writes.filter(([key]) => key === EXPLORATION_KEY).length, beforeDuplicate, 'duplicate inspect does not persist or reward again');
  assert.equal(store.getState().activeScienceEntryId, first.id);
  assert.deepEqual([...values.entries()].filter(([key]) => key !== EXPLORATION_KEY), LEGACY_KEYS);
});

test('science inspection checks range, grounding and remote region, and failure does not persist', () => {
  const { store, values, writes, science, world } = makeHarness({ initialEntries: LEGACY_KEYS });
  const element = science.SCIENTIFIC_ELEMENTS.find((candidate) => candidate.regionId === 'ice');
  const before = store.getState().exploration;
  const position = (x, z, y = world.sampleWorldGround(x, z)) => [x, y, z];
  store.setState({ playerPos: position(element.position.x - 6, element.position.z), isPlayerGrounded: true });
  assert.equal(store.getState().inspectScientificElement(element.id), false, 'inspection is out of 4.5m range');
  store.setState({ playerPos: position(element.position.x, element.position.z), isPlayerGrounded: false });
  assert.equal(store.getState().inspectScientificElement(element.id), false, 'airborne on-foot actor cannot inspect');
  store.setState({ playerPos: position(element.position.x, element.position.z), isPlayerGrounded: true, isDrivingRover: true, remoteRegionId: 'dust', roverPos: position(element.position.x, element.position.z) });
  assert.equal(store.getState().inspectScientificElement(element.id), false, 'wrong remote sector is rejected');
  assert.strictEqual(store.getState().exploration, before);
  assert.equal(values.has(EXPLORATION_KEY), false);
  assert.equal(writes.some(([key]) => key === EXPLORATION_KEY), false);
});

test('depleted air and meals warn once without ending the expedition or overwriting notices', () => {
  const { store } = makeHarness();
  store.setState({ isManualOpen: false, explorationNotice: 'NASA supply acknowledgement.', exploration: {
    ...store.getState().exploration,
    survival: { ...store.getState().exploration.survival, air: 0, meals: 0 }
  } });

  store.getState().tick(1);
  const airNotice = 'Air reserve depleted. Use an air canister in your backpack; sprint is unavailable.';
  assert.equal(store.getState().explorationNotice, 'NASA supply acknowledgement.', 'depletion does not overwrite an existing notice');
  store.getState().dismissExplorationNotice();
  store.getState().tick(1);
  assert.equal(store.getState().explorationNotice, airNotice);
  assert.equal(store.getState().isGameOver, false);
  store.getState().tick(1);
  assert.equal(store.getState().explorationNotice, airNotice, 'repeated depleted ticks do not overwrite the first notice');

  assert.equal(store.getState().consumeSurvivalItem('air_canister'), true);
  assert.equal(store.getState().exploration.survival.air, 30);
  assert.equal(store.getState().explorationNotice, null, 'using a supply clears the depletion notice');
  store.getState().tick(1);
  const mealsNotice = 'Food reserve depleted. Use a space apple in your backpack; sprint is unavailable.';
  assert.equal(store.getState().explorationNotice, mealsNotice);
  store.getState().tick(1);
  assert.equal(store.getState().explorationNotice, mealsNotice, 'each depleted resource is announced once while continuously empty');
  assert.equal(store.getState().isGameOver, false, 'depletion remains recoverable');
});

test('exploration tick is universal across legacy opt-in, ignores invisible legacy briefing, and pauses active UI', () => {
  const { store, values, writes } = makeHarness({ initialEntries: LEGACY_KEYS, isBriefingOpen: true });
  store.setState({ isManualOpen: false, expeditionProgress: { ...store.getState().expeditionProgress, enabled: true } });
  const initial = store.getState().exploration;
  store.getState().tick(60);
  assert.equal(store.getState().exploration.activeSeconds, initial.activeSeconds + 1);
  assert.equal(store.getState().exploration.survival.air, initial.survival.air - 100 / 10800);
  assert.equal(store.getState().isGameOver, false);
  const afterActiveTick = store.getState().exploration;
  store.setState({ isBackpackOpen: true });
  store.getState().tick(1);
  assert.strictEqual(store.getState().exploration, afterActiveTick, 'modal pauses active-time resources');
  store.setState({ isBackpackOpen: false });
  globalThis.document.hidden = true;
  store.getState().tick(30);
  globalThis.document.hidden = false;
  assert.strictEqual(store.getState().exploration, afterActiveTick, 'hidden time is not caught up later');
  assert.equal(store.getState().isGameOver, false);
  assert.equal(writes.some(([key]) => key === EXPLORATION_KEY), false, 'writes are throttled before five active seconds');
  store.getState().tick(1);
  store.getState().tick(1);
  store.getState().tick(1);
  store.getState().tick(1);
  assert.equal(writes.filter(([key]) => key === EXPLORATION_KEY).length, 1);
});

test('corrupt exploration bytes remain intact and block all snapshots; quota failure keeps memory usable', () => {
  const raw = '{future-progress-bytes';
  const corrupt = makeHarness({ initialEntries: [...LEGACY_KEYS, [EXPLORATION_KEY, raw]] });
  assert.equal(corrupt.store.getState().explorationPersistenceBlocked, true);
  assert.match(corrupt.store.getState().explorationWarning, /preserved/);
  const element = corrupt.science.SCIENTIFIC_ELEMENTS.find((candidate) => candidate.regionId === 'dust');
  const region = corrupt.world.WORLD_REGIONS.find(({ id }) => id === 'dust');
  corrupt.store.setState({ playerPos: [region.baseConsole.x, -0.4, region.baseConsole.z] });
  corrupt.store.getState().toggleDrivingRover();
  corrupt.store.getState().publishRoverState({ x: element.position.x, y: -0.4, z: element.position.z, heading: 0 }, 0);
  corrupt.store.getState().inspectScientificElement(element.id);
  assert.equal(corrupt.values.get(EXPLORATION_KEY), raw);
  assert.equal(corrupt.writes.some(([key]) => key === EXPLORATION_KEY), false);

  const quota = makeHarness({ initialEntries: LEGACY_KEYS, failWrites: true });
  quota.store.setState({ exploration: { ...quota.store.getState().exploration, survival: { air: 70, meals: 8, energyEU: 70 } } });
  const originalSupplyCount = quota.store.getState().exploration.supplies.air_canister;
  assert.equal(quota.store.getState().consumeSurvivalItem('air_canister'), true);
  assert.equal(quota.store.getState().exploration.survival.air, 100);
  assert.equal(quota.store.getState().inventory.air_canister, originalSupplyCount - 1);
  assert.equal(quota.store.getState().exploration.supplies.air_canister, originalSupplyCount - 1);
  assert.equal(quota.store.getState().explorationPersistenceBlocked, true);
  assert.equal(quota.store.getState().explorationWarning, 'Progress is not saved');
  assert.equal(quota.writes.length, 1);
  assert.equal(quota.values.has(EXPLORATION_KEY), false, 'failed quota write does not claim the snapshot is durable');
});

test('exploration supply count and resource effect persist atomically across reload', () => {
  const { store, values, writes } = makeHarness({ initialEntries: LEGACY_KEYS });
  store.setState({ exploration: { ...store.getState().exploration, survival: { air: 50, meals: 12, energyEU: 100 } } });
  assert.equal(store.getState().inventory.air_canister, 2);
  assert.equal(store.getState().consumeSurvivalItem('air_canister'), true);
  assert.equal(store.getState().exploration.survival.air, 80);
  assert.equal(store.getState().exploration.supplies.air_canister, 1);
  assert.equal(store.getState().inventory.air_canister, 1);
  assert.equal(writes.filter(([key]) => key === EXPLORATION_KEY).length, 1);
  const raw = values.get(EXPLORATION_KEY);
  const reloaded = makeHarness({ initialEntries: [...LEGACY_KEYS, [EXPLORATION_KEY, raw]] });
  assert.equal(reloaded.store.getState().exploration.survival.air, 80);
  assert.equal(reloaded.store.getState().exploration.supplies.air_canister, 1);
  assert.equal(reloaded.store.getState().inventory.air_canister, 1);
});

test('active exploration tick advances a slow sol clock without legacy simulation drains', () => {
  const { store, exploration } = makeHarness();
  store.setState({
    solTime: 17.25, battery: 42, batteryKwh: 42, oxygen: 18.7, temperature: 3.5, dustCoverage: 0.45, netPower: -2,
    isSimulating: true, isManualOpen: false, isBackpackOpen: false, isDatapadOpen: false,
    isClassroomOpen: false, isBrownoutQuizOpen: false, activeScienceEntryId: null
  });
  const before = store.getState();
  assert.equal(before.isManualOpen, false);
  assert.equal(before.isSimulating, true);
  assert.equal(before.isBackpackOpen, false);
  assert.equal(before.isDatapadOpen, false);
  assert.equal(before.isClassroomOpen, false);
  assert.equal(before.isBrownoutQuizOpen, false);
  assert.equal(before.activeScienceEntryId, null);
  assert.equal(before.exploration.activeSeconds, 0);

  store.getState().tick(0.1);
  const after = store.getState();
  assert.ok(after.exploration.activeSeconds > before.exploration.activeSeconds);
  assert.equal(after.exploration.activeSeconds, before.exploration.activeSeconds + 0.1);
  assert.ok(Math.abs(after.solTime - (17.25 + 0.1 / 90)) <= 1e-10);
  assert.equal(after.solPhase, before.solPhase, 'the active tick preserves the current sol phase');
  for (const resource of ['air', 'meals', 'energyEU']) {
    const expected = before.exploration.survival[resource] - exploration.SURVIVAL_DRAIN_PER_SECOND[resource] * 0.1;
    assert.ok(after.exploration.survival[resource] < before.exploration.survival[resource], `${resource} drains during active exploration`);
    assert.ok(Math.abs(after.exploration.survival[resource] - expected) <= 1e-12, `${resource} uses the configured exploration drain`);
  }
  for (const key of ['battery', 'batteryKwh', 'oxygen', 'temperature', 'dustCoverage', 'netPower', 'isSimulating']) {
    assert.equal(after[key], before[key], `${key} remains unchanged in active exploration`);
  }
});
