import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const catalog = await loadTsModule('../../src/modules/outpost-3d/scienceCatalog.ts', import.meta.url);
const progress = await loadTsModule('../../src/modules/store/explorationProgress.ts', import.meta.url);
const { WORLD_REGIONS, sampleWorldGround } = world;
const { SCIENTIFIC_ELEMENTS, getScientificElement } = catalog;
const {
  EXPLORATION_SAVE_LIMIT_BYTES, EXPLORATION_STORAGE_KEY, SURVIVAL_CAPACITY, SURVIVAL_DRAIN_PER_SECOND,
  SURVIVAL_SUPPLY_PACKAGE, collectScientificElement, consumeExplorationItem, createInitialExplorationProgress,
  parseExplorationProgress, serializeExplorationProgress, tickExplorationProgress,
} = progress;
const atElement = (element, overrides = {}) => ({
  position: [element.position.x, sampleWorldGround(element.position.x, element.position.z), element.position.z],
  isRemote: false,
  remoteRegionId: null,
  isGrounded: true,
  ...overrides,
});
const collect = (state, element, context = atElement(element)) => collectScientificElement(state, element.id, context);

test('starts an isolated exploration save with explicit rates and no actor state', () => {
  const state = createInitialExplorationProgress();
  assert.equal(EXPLORATION_STORAGE_KEY, 'ares-cradle-exploration-v1');
  assert.deepEqual(state, {
    schemaVersion: 1, revision: 0,
    survival: { air: 100, meals: 12, energyEU: 100 },
    collected: [], completedRegions: [], rewardedRegions: [], activeSeconds: 0,
    supplies: { air_canister: 2, space_apple: 6, backup_battery: 2 },
  });
  assert.equal(SURVIVAL_CAPACITY.air, 100);
  assert.equal(SURVIVAL_DRAIN_PER_SECOND.air, 100 / 10800);
  assert.equal(SURVIVAL_DRAIN_PER_SECOND.meals, 12 / 14400);
  assert.equal(SURVIVAL_DRAIN_PER_SECOND.energyEU, 100 / 14400);
  for (const key of ['player', 'playerPos', 'cameraYaw', 'actors', 'rover']) assert.equal(Object.hasOwn(state, key), false);
});

test('drains slowly over 15 active minutes, clamps frame delta, and ignores paused or invalid time', () => {
  let state = createInitialExplorationProgress();
  for (let second = 0; second < 900; second += 1) state = tickExplorationProgress(state, 1);
  assert.ok(100 - state.survival.air < 10);
  assert.ok(12 - state.survival.meals < 1);
  assert.ok(100 - state.survival.energyEU < 10);
  assert.equal(state.activeSeconds, 900);
  assert.equal(state.revision, 0);
  assert.deepEqual(tickExplorationProgress(state, 100000), tickExplorationProgress(state, 1));
  for (const dt of [0, -1, Number.NaN, Infinity, -Infinity]) assert.strictEqual(tickExplorationProgress(state, dt), state);
  assert.strictEqual(tickExplorationProgress(state, 1, true), state);
});

test('three-hour air and four-hour ration/energy rates clamp at zero without offline catchup', () => {
  let state = createInitialExplorationProgress();
  for (let second = 0; second < 10800; second += 1) state = tickExplorationProgress(state, 1);
  assert.ok(state.survival.air <= 1e-8);
  assert.ok(Math.abs(state.survival.meals - 3) < 1e-8);
  assert.ok(Math.abs(state.survival.energyEU - 25) < 1e-8);
  const stopped = tickExplorationProgress(state, 1, true);
  assert.strictEqual(stopped, state);
  const afterLongFrame = tickExplorationProgress(state, 1e9);
  assert.equal(afterLongFrame.activeSeconds, state.activeSeconds + 1);
  assert.ok(afterLongFrame.survival.air >= 0);
});

test('catalog has exactly three stable, distinct canonical discoveries per outer region', () => {
  assert.equal(SCIENTIFIC_ELEMENTS.length, WORLD_REGIONS.length * 3);
  assert.deepEqual(SCIENTIFIC_ELEMENTS.map(({ regionId }) => regionId), WORLD_REGIONS.flatMap(({ id }) => [id, id, id]));
  assert.equal(new Set(SCIENTIFIC_ELEMENTS.map(({ id }) => id)).size, 15);
  for (const region of WORLD_REGIONS) {
    const elements = SCIENTIFIC_ELEMENTS.filter((element) => element.regionId === region.id);
    assert.deepEqual(elements.map(({ id }) => id), [1, 2, 3].map((n) => `${region.id}.science-${n}`));
    assert.deepEqual(elements.map(({ position }) => position), region.discoveries);
    assert.ok(elements.every(({ title, summary, explanation, sourceTitle, sourceUrl, credit, scienceBoundary }) =>
      [title, summary, explanation, sourceTitle, sourceUrl, credit, scienceBoundary].every((text) => typeof text === 'string' && text.length > 0)));
  }
  assert.equal(getScientificElement('impact.science-1').kind, 'impact-rock');
  assert.equal(getScientificElement('missing'), undefined);
});

test('NASA catalog citations use official hosts, canonical sources, and reviewed credits', () => {
  const byId = new Map(SCIENTIFIC_ELEMENTS.map((element) => [element.id, element]));
  for (const element of SCIENTIFIC_ELEMENTS) {
    const source = new URL(element.sourceUrl);
    assert.equal(source.protocol, 'https:');
    assert.ok(['science.nasa.gov', 'www.nasa.gov'].includes(source.hostname), `${element.id} has non-NASA source host`);
  }
  const reviewedSources = [
    ['impact.science-1', 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/', 'NASA/JPL/Arizona State University'],
    ['impact.science-2', 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/', 'NASA/JPL/Arizona State University'],
    ['impact.science-3', 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/', 'NASA/JPL/Arizona State University'],
    ['ice.science-1', 'https://science.nasa.gov/photojournal/swim-map-shows-subsurface-water-ice-on-mars/', 'NASA/JPL-Caltech/Planetary Science Institute'],
    ['ice.science-2', 'https://science.nasa.gov/photojournal/swim-map-shows-subsurface-water-ice-on-mars/', 'NASA/JPL-Caltech/Planetary Science Institute'],
    ['lake.science-1', 'https://science.nasa.gov/blog/studying-the-jezero-delta-from-a-distance/', 'NASA/JPL-Caltech/ASU/MSSS'],
    ['lake.science-2', 'https://science.nasa.gov/blog/studying-the-jezero-delta-from-a-distance/', 'NASA/JPL-Caltech/ASU/MSSS'],
    ['lake.science-3', 'https://science.nasa.gov/photojournal/perseverances-three-forks-sample-depot-map/', 'NASA/JPL-Caltech/University of Arizona'],
    ['dust.science-1', 'https://science.nasa.gov/resource/curiosity-observes-whirlwinds-carrying-martian-dust/', 'NASA/JPL-Caltech/TAMU'],
  ];
  for (const [id, sourceUrl, credit] of reviewedSources) {
    assert.equal(byId.get(id).sourceUrl, sourceUrl, `${id} uses canonical NASA URL`);
    assert.equal(byId.get(id).credit, credit, `${id} has reviewed source credit`);
  }
  assert.equal(byId.get('volcano.science-1').title, 'Volcanic flow rock');
  assert.match(byId.get('volcano.science-1').explanation, /does not confirm its composition/i);
  assert.match(byId.get('volcano.science-2').explanation, /younger plain truncating older flow/i);
  assert.match(byId.get('lake.science-1').explanation, /not evidence that life existed/i);
  assert.match(byId.get('lake.science-3').explanation, /2022–23/);
});

test('the third unique discovery in each region atomically awards one capped package', () => {
  let state = createInitialExplorationProgress();
  for (const region of WORLD_REGIONS) {
    const elements = SCIENTIFIC_ELEMENTS.filter((element) => element.regionId === region.id);
    for (const element of elements.slice(0, 2)) {
      const result = collect(state, element);
      assert.equal(result.changed, true);
      assert.equal(result.completedRegion, undefined);
      state = result.state;
    }
    state = {
      ...state,
      survival: {
        air: Math.min(80, SURVIVAL_CAPACITY.air - SURVIVAL_SUPPLY_PACKAGE.air),
        meals: Math.min(8, SURVIVAL_CAPACITY.meals - SURVIVAL_SUPPLY_PACKAGE.meals),
        energyEU: Math.min(80, SURVIVAL_CAPACITY.energyEU - SURVIVAL_SUPPLY_PACKAGE.energyEU),
      },
    };
    const final = collect(state, elements[2]);
    assert.equal(final.changed, true);
    assert.equal(final.completedRegion, region.id);
    assert.deepEqual(final.state.survival, {
      air: Math.min(SURVIVAL_CAPACITY.air, state.survival.air + SURVIVAL_SUPPLY_PACKAGE.air),
      meals: Math.min(SURVIVAL_CAPACITY.meals, state.survival.meals + SURVIVAL_SUPPLY_PACKAGE.meals),
      energyEU: Math.min(SURVIVAL_CAPACITY.energyEU, state.survival.energyEU + SURVIVAL_SUPPLY_PACKAGE.energyEU),
    });
    assert.ok(final.state.completedRegions.includes(region.id));
    assert.ok(final.state.rewardedRegions.includes(region.id));
    const duplicate = collect(final.state, elements[2]);
    assert.equal(duplicate.changed, false);
    assert.strictEqual(duplicate.state, final.state);
    assert.equal(duplicate.state.revision, final.state.revision);
    assert.deepEqual(duplicate.state.survival, final.state.survival);
    state = final.state;
  }
  assert.equal(state.completedRegions.length, 5);
  assert.deepEqual(state.rewardedRegions, state.completedRegions);
  assert.equal(state.collected.length, 15);
});

test('collection validates exact proximity, grounded height, remote region, and finite actual context', () => {
  const element = SCIENTIFIC_ELEMENTS[0];
  const state = createInitialExplorationProgress();
  const boundary = atElement(element, { position: [element.position.x + 4.5, sampleWorldGround(element.position.x + 4.5, element.position.z), element.position.z] });
  assert.equal(collect(state, element, boundary).changed, true);
  const invalid = [
    [atElement(element, { position: [element.position.x + 4.50001, sampleWorldGround(element.position.x + 4.50001, element.position.z), element.position.z] }), 'too-far-from-element'],
    [atElement(element, { position: [element.position.x, sampleWorldGround(element.position.x, element.position.z) + 2.5001, element.position.z] }), 'not-grounded'],
    [atElement(element, { isGrounded: false }), 'not-grounded'],
    [atElement(element, { position: [Number.NaN, -0.4, element.position.z] }), 'invalid-context'],
    [atElement(element, { isRemote: true, remoteRegionId: 'ice' }), 'wrong-region'],
    [atElement(element, { isRemote: true, remoteRegionId: null }), 'wrong-region'],
    [atElement(element, { remoteRegionId: 'impact' }), 'invalid-context'],
  ];
  for (const [context, error] of invalid) {
    const result = collect(state, element, context);
    assert.equal(result.error, error);
    assert.equal(result.changed, false);
    assert.strictEqual(result.state, state);
  }
  const remote = atElement(element, { isRemote: true, remoteRegionId: element.regionId });
  assert.equal(collect(state, element, remote).changed, true);
  assert.equal(collect(state, 'not-a-science-id', remote).error, 'unknown-element');
});

test('duplicates and reloads cannot farm a reward; empty-survival states remain valid', () => {
  let state = createInitialExplorationProgress();
  const items = SCIENTIFIC_ELEMENTS.filter((element) => element.regionId === 'impact');
  for (const element of items) state = collect(state, element).state;
  const raw = serializeExplorationProgress(state);
  const loaded = parseExplorationProgress(raw);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, JSON.parse(raw));
  const duplicate = collect(loaded.state, items[2]);
  assert.equal(duplicate.changed, false);
  assert.strictEqual(duplicate.state, loaded.state);
  const depleted = { ...loaded.state, survival: { air: 0, meals: 0, energyEU: 0 } };
  assert.deepEqual(depleted.survival, { air: 0, meals: 0, energyEU: 0 });
  assert.equal(parseExplorationProgress(serializeExplorationProgress(depleted)).ok, true);
});

test('consumables apply bounded effects and decrement their persisted count once', () => {
  const initial = createInitialExplorationProgress();
  for (const [itemId, resource] of [['space_apple', 'meals'], ['backup_battery', 'energyEU'], ['air_canister', 'air']]) {
    const full = consumeExplorationItem(initial, itemId);
    assert.equal(full.changed, false);
    assert.strictEqual(full.state, initial);
    const low = { ...initial, survival: { ...initial.survival, [resource]: 1 } };
    const consumed = consumeExplorationItem(low, itemId);
    assert.equal(consumed.changed, true);
    assert.ok(consumed.state.survival[resource] <= SURVIVAL_CAPACITY[resource]);
    assert.equal(consumed.state.revision, low.revision + 1);
    assert.equal(consumed.state.supplies[itemId], initial.supplies[itemId] - 1);
    assert.equal(consumeExplorationItem(consumed.state, itemId).state.supplies[itemId], initial.supplies[itemId] - 2);
  }
  const empty = { ...initial, supplies: { ...initial.supplies, air_canister: 0 }, survival: { air: 1, meals: 12, energyEU: 100 } };
  assert.equal(consumeExplorationItem(empty, 'air_canister').error, 'no-supplies');
  assert.equal(consumeExplorationItem(initial, 'unknown').error, 'unknown-item');
});

test('exact old v1 snapshot migrates supplies in memory without losing ledgers', () => {
  let state = createInitialExplorationProgress();
  for (const element of SCIENTIFIC_ELEMENTS.filter((entry) => entry.regionId === 'impact')) state = collect(state, element).state;
  const legacy = { ...state };
  delete legacy.supplies;
  const raw = JSON.stringify(legacy);
  const loaded = parseExplorationProgress(raw);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.supplies, { air_canister: 2, space_apple: 6, backup_battery: 2 });
  assert.deepEqual(loaded.state.collected, legacy.collected);
  assert.deepEqual(loaded.state.completedRegions, ['impact']);
  assert.deepEqual(loaded.state.rewardedRegions, ['impact']);
  assert.equal(loaded.state.revision, legacy.revision);
  const duplicate = collect(loaded.state, SCIENTIFIC_ELEMENTS.find((element) => element.id === 'impact.science-3'));
  assert.equal(duplicate.changed, false, 'legacy completed-region reward is not issued again after migration');
  assert.strictEqual(duplicate.state, loaded.state);
});

test('persistence rejects corrupt, future, oversized, forged, and actor-bearing payloads without overwrite', () => {
  const initial = createInitialExplorationProgress();
  const valid = serializeExplorationProgress(initial);
  assert.deepEqual(parseExplorationProgress(valid), { ok: true, state: JSON.parse(valid) });
  const cases = [
    ['{broken', 'corrupt'],
    [JSON.stringify({ ...initial, schemaVersion: 2 }), 'unsupported'],
    [JSON.stringify({ ...initial, extra: true }), 'corrupt'],
    [JSON.stringify({ ...initial, survival: { ...initial.survival, air: 101 } }), 'corrupt'],
    [JSON.stringify({ ...initial, revision: -1 }), 'corrupt'],
    [JSON.stringify({ ...initial, supplies: { ...initial.supplies, air_canister: -1 } }), 'corrupt'],
    [JSON.stringify({ ...initial, supplies: { ...initial.supplies, air_canister: Number.NaN } }), 'corrupt'],
    [JSON.stringify({ ...initial, supplies: { ...initial.supplies, extra: 1 } }), 'corrupt'],
    [JSON.stringify({ ...initial, supplies: { ...initial.supplies, space_apple: 10000 } }), 'corrupt'],
    [JSON.stringify({ ...initial, completedRegions: ['impact'] }), 'corrupt'],
    [JSON.stringify({ ...initial, activeSeconds: -1 }), 'corrupt'],
    [JSON.stringify({ ...initial, collected: ['impact.science-1', 'impact.science-1'] }), 'corrupt'],
    [JSON.stringify({ ...initial, collected: ['unlisted'] }), 'corrupt'],
    [JSON.stringify({ ...initial, playerPos: [1, 2, 3] }), 'corrupt'],
    ['x'.repeat(EXPLORATION_SAVE_LIMIT_BYTES + 1), 'oversized'],
  ];
  for (const [raw, reason] of cases) {
    const parsed = parseExplorationProgress(raw);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.reason, reason);
    assert.equal(parsed.canOverwrite, false);
    assert.equal(parsed.raw, raw);
  }
  for (const invalid of [
    { ...initial, revision: Number.NaN },
    { ...initial, survival: { ...initial.survival, meals: Infinity } },
    { ...initial, completedRegions: ['impact'] },
    { ...initial, rewardedRegions: ['impact'] },
    { ...initial, activeSeconds: -1 },
    { ...initial, player: { position: [0, 0, 0] } },
  ]) assert.throws(() => serializeExplorationProgress(invalid));
});
