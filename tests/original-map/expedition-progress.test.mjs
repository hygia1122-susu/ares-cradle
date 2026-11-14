import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const progress = await loadTsModule('../../src/modules/store/expeditionProgress.ts', import.meta.url);
const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const activityRules = await loadTsModule('../../src/game/mission/activities/rules.ts', import.meta.url);
const { WORLD_REGIONS, sampleWorldGround } = world;
const { BASE_STOCK_FLOORS, EXPEDITION_STORAGE_KEY, createInitialExpeditionProgress,
  parseExpeditionProgress, serializeExpeditionProgress, transitionExpeditionProgress } = progress;
const { isActivityComplete } = activityRules;
const region = (id) => WORLD_REGIONS.find((candidate) => candidate.id === id);
const atConsole = (id) => {
  const { baseConsole } = region(id);
  return { player: { x: baseConsole.x, y: sampleWorldGround(baseConsole.x, baseConsole.z), z: baseConsole.z }, isDrivingRover: false, isGrounded: true, actualRegion: id };
};
const started = () => transitionExpeditionProgress(createInitialExpeditionProgress(), { type: 'START' }).state;

 test('creates an isolated five-base campaign with explicit EU stock floors', () => {
  const initial = createInitialExpeditionProgress();
  assert.equal(EXPEDITION_STORAGE_KEY, 'ares-cradle-expedition-v1');
  assert.equal(initial.enabled, false);
  assert.deepEqual(Object.keys(initial.bases).sort(), ['dust', 'ice', 'impact', 'lake', 'volcano']);
  for (const base of Object.values(initial.bases)) {
    assert.equal(base.active, false);
    assert.deepEqual(base.stock, BASE_STOCK_FLOORS);
    assert.deepEqual(base.checks, [false, false, false]);
  }
  assert.equal(Object.hasOwn(initial, 'playerPos'), false);
  assert.equal(Object.hasOwn(initial, 'cameraYaw'), false);
});

test('START enables once without charging resources or changing actor state', () => {
  const initial = createInitialExpeditionProgress();
  const first = transitionExpeditionProgress(initial, { type: 'START' });
  const repeated = transitionExpeditionProgress(first.state, { type: 'START' });
  assert.equal(first.changed, true);
  assert.equal(first.state.enabled, true);
  assert.equal(first.state.revision, 1);
  assert.deepEqual(first.state.bases.dust.stock, BASE_STOCK_FLOORS);
  assert.equal(first.state.transactions.filter((id) => id === 'campaign:start').length, 1);
  assert.equal(repeated.changed, false);
  assert.strictEqual(repeated.state, first.state);
  assert.equal(initial.enabled, false);
});

test('ACTIVATE requires campaign start and a grounded on-foot visit to that console', () => {
  const fresh = createInitialExpeditionProgress();
  const beforeStart = transitionExpeditionProgress(fresh, { type: 'ACTIVATE', regionId: 'dust' }, atConsole('dust'));
  assert.equal(beforeStart.error, 'campaign-not-started');
  const state = started();
  const result = transitionExpeditionProgress(state, { type: 'ACTIVATE', regionId: 'dust' }, atConsole('dust'));
  assert.equal(result.changed, true);
  assert.equal(result.state.bases.dust.active, true);
  assert.deepEqual(result.state.bases.dust.stock, BASE_STOCK_FLOORS);
  assert.deepEqual(result.state.bases.dust.checks, [false, false, false]);
  assert.equal(result.state.revision, state.revision + 1);
  assert.equal(parseExpeditionProgress(serializeExpeditionProgress(result.state)).ok, true);
  assert.equal(state.bases.dust.active, false);
});

test('ACTIVATE rejects home, distant, mismatched, driving, non-finite, and airborne contexts', () => {
  const state = started();
  const cases = [
    [{ player: { x: 0, y: -0.4, z: 0 }, isDrivingRover: false, isGrounded: true, actualRegion: 'home' }, 'home-has-no-expedition-base'],
    [{ player: { x: 0, y: -0.4, z: -212 }, isDrivingRover: false, isGrounded: true, actualRegion: 'dust' }, 'too-far-from-console'],
    [{ ...atConsole('ice'), actualRegion: 'ice' }, 'wrong-region'],
    [{ ...atConsole('dust'), isDrivingRover: true }, 'rover-required-on-foot'],
    [{ ...atConsole('dust'), player: { x: NaN, y: -0.4, z: -255 } }, 'invalid-context'],
    [{ ...atConsole('dust'), player: { ...atConsole('dust').player, y: 99 } }, 'not-grounded'],
    [{ ...atConsole('dust'), player: { ...atConsole('dust').player, y: atConsole('dust').player.y + 2.5 } }, 'not-grounded'],
    [{ ...atConsole('dust'), isGrounded: false }, 'not-grounded'],
    [(({ isGrounded: _isGrounded, ...context }) => context)(atConsole('dust')), 'invalid-context'],

  ];
  for (const [context, error] of cases) {
    const result = transitionExpeditionProgress(state, { type: 'ACTIVATE', regionId: 'dust' }, context);
    assert.equal(result.error, error);
    assert.equal(result.changed, false);
    assert.strictEqual(result.state, state);
  }
});

test('ACTIVATE is idempotent and preserves the initialized stock/check floors', () => {
  const state = started();
  const first = transitionExpeditionProgress(state, { type: 'ACTIVATE', regionId: 'impact' }, atConsole('impact'));
  const second = transitionExpeditionProgress(first.state, { type: 'ACTIVATE', regionId: 'impact' }, atConsole('impact'));
  assert.equal(first.state.transactions.filter((id) => id === 'base:activate:impact').length, 1);
  assert.deepEqual(first.state.bases.impact.stock, { energyEU: 12, meals: 4, water: 5, air: 4 });
  assert.deepEqual(first.state.bases.impact.checks, [false, false, false]);
  assert.equal(second.changed, false);
  assert.strictEqual(second.state, first.state);
});

test('strict persistence parsing preserves corrupt, future, oversized, or malformed data', () => {
  const state = started();
  const raw = serializeExpeditionProgress(state);
  assert.deepEqual(parseExpeditionProgress(raw), { ok: true, state: JSON.parse(raw) });
  for (const value of [
    '{broken',
    JSON.stringify({ ...state, schemaVersion: 2 }),
    JSON.stringify({ ...state, extra: true }),
    JSON.stringify({ ...state, transactions: ['same', 'same'] }),
    JSON.stringify({ ...state, bases: { ...state.bases, dust: { ...state.bases.dust, stock: { ...BASE_STOCK_FLOORS, energyEU: 11 } } } }),
    'x'.repeat(progress.EXPEDITION_SAVE_LIMIT_BYTES + 1),
  ]) {
    const parsed = parseExpeditionProgress(value);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.canOverwrite, false);
    assert.equal(parsed.raw, value);
  }
  assert.throws(() => serializeExpeditionProgress({ ...state, revision: Number.NaN }));
});

test('persistence rejects forged disabled progress and unimplemented milestones on parse and serialize', () => {
  const initial = createInitialExpeditionProgress();
  const forgedDisabledActive = {
    ...initial,
    bases: { ...initial.bases, dust: { ...initial.bases.dust, active: true } },
    transactions: ['base:activate:dust'],
    revision: 1,
  };
  const forgedDisabledTransaction = { ...initial, transactions: ['campaign:start'] };
  const startedState = started();
  const forgedOrphanActivation = {
    ...startedState,
    revision: 2,
    transactions: [...startedState.transactions, 'base:activate:dust'],
  };
  const forgedPaidSurvey = {
    ...startedState,
    surveys: { ...startedState.surveys, dust: { ...startedState.surveys.dust, paid: true } },
  };
  const forgedCompletion = {
    ...startedState,
    surveys: { ...startedState.surveys, dust: { ...startedState.surveys.dust, activityDone: true } },
  };
  const forgedReport = {
    ...startedState,
    bases: { ...startedState.bases, dust: { ...startedState.bases.dust, active: true, report: { complete: true } } },
  };

  for (const forged of [forgedDisabledActive, forgedDisabledTransaction, forgedOrphanActivation, forgedPaidSurvey, forgedCompletion, forgedReport]) {
    const raw = JSON.stringify(forged);
    assert.equal(parseExpeditionProgress(raw).ok, false);
    assert.throws(() => serializeExpeditionProgress(forged));
  }
});

test('unknown command payloads fail closed without mutation', () => {
  const state = started();
  const result = transitionExpeditionProgress(state, { type: 'PAY' });
  assert.equal(result.error, 'unsupported-command');
  assert.equal(result.changed, false);
  assert.strictEqual(result.state, state);
});

const impact = region('impact');
const atPoint = (point, actualRegion = 'impact') => ({
  player: { x: point.x, y: sampleWorldGround(point.x, point.z), z: point.z },
  isDrivingRover: false, isGrounded: true, actualRegion,
});
const impactBase = () => {
  const state = started();
  return transitionExpeditionProgress(state, { type: 'ACTIVATE', regionId: 'impact' }, atPoint(impact.baseConsole)).state;
};
const evidenceFor = {
  'rim-inspection': { tool: 'inspection-camera', wide: { action: 'inspect-frame', framing: 'wide', target: 'rim', frameId: 'training-rim-wide' }, close: { action: 'inspect-frame', framing: 'close', target: 'rim', frameId: 'training-rim-close' } },
  'dated-image-comparison': { tool: 'dated-image-comparison', before: { frame: 'before', frameId: 'training-before' }, after: { frame: 'after', frameId: 'training-after' }, changedFeatures: ['rim-edge', 'rock-position'] },
  'sample-comparison': { tool: 'sample-comparison', candidate: { measurement: 2.4, unit: 'relative signal units' }, reference: { measurement: 1.8, unit: 'relative signal units' }, conclusion: 'appearance-alone-cannot-determine-origin' },
};
const observe = (state, id, expectedRevision = state.revision) => transitionExpeditionProgress(state, {
  type: 'OBSERVE_IMPACT', observationId: id, evidence: structuredClone(evidenceFor[id]), expectedRevision,
}, atPoint(impact.discoveries[progress.IMPACT_OBSERVATION_GUIDE[id].discoveryIndex]));
const pay = (state, expectedRevision = state.revision) => transitionExpeditionProgress(state, { type: 'PAY_IMPACT', confirmed: true, expectedRevision }, atPoint(impact.baseConsole));
const observationIds = ['rim-inspection', 'dated-image-comparison', 'sample-comparison'];

test('Impact observation evidence and site gates accept every two-of-three combination', () => {
  for (const pair of [['rim-inspection', 'dated-image-comparison'], ['rim-inspection', 'sample-comparison'], ['dated-image-comparison', 'sample-comparison']]) {
    let state = impactBase();
    for (const id of pair) {
      const result = observe(state, id);
      assert.equal(result.changed, true);
      state = result.state;
    }
    assert.deepEqual(state.surveys.impact.observations, pair);
    const paid = pay(state);
    assert.equal(paid.changed, true);
    assert.deepEqual(paid.state.bases.impact.stock, { energyEU: 10, meals: 3, water: 4, air: 3 });
    assert.equal(paid.state.surveys.impact.paid, true);
    const thirdId = observationIds.find((candidate) => !pair.includes(candidate));
    const optionalThird = observe(paid.state, thirdId);
    assert.equal(optionalThird.changed, true);
    assert.equal(optionalThird.state.surveys.impact.observations.length, 3);
  }
});

test('Impact rejects invalid tools, wrong sites, regions, airborne, driving, distant, and non-finite context', () => {
  const state = impactBase();
  const id = 'rim-inspection';
  const discovery = impact.discoveries[0];
  const wrongTool = { ...evidenceFor[id], tool: 'observed:true' };
  const invalidEvidence = [wrongTool, { ...evidenceFor[id], close: { ...evidenceFor[id].close, target: 'basin' } }];
  for (const evidence of invalidEvidence) {
    const result = transitionExpeditionProgress(state, { type: 'OBSERVE_IMPACT', observationId: id, evidence, expectedRevision: state.revision }, atPoint(discovery));
    assert.equal(result.error, 'invalid-evidence');
    assert.strictEqual(result.state, state);
  }
  const badContexts = [
    [atPoint(impact.baseConsole, 'ice'), 'wrong-region'],
    [{ ...atPoint(discovery), isGrounded: false }, 'not-grounded'],
    [{ ...atPoint(discovery), isDrivingRover: true }, 'rover-required-on-foot'],
    [atPoint({ x: discovery.x + 9, z: discovery.z }), 'too-far-from-console'],
    [{ ...atPoint(discovery), player: { ...atPoint(discovery).player, x: Infinity } }, 'invalid-context'],
    [{ ...atPoint(discovery), player: { ...atPoint(discovery).player, y: atPoint(discovery).player.y + 1 } }, 'not-grounded'],
  ];
  for (const [context, error] of badContexts) {
    const result = transitionExpeditionProgress(state, { type: 'OBSERVE_IMPACT', observationId: id, evidence: evidenceFor[id], expectedRevision: state.revision }, context);
    assert.equal(result.error, error);
    assert.strictEqual(result.state, state);
  }
  const badComparison = { ...evidenceFor['dated-image-comparison'], changedFeatures: ['rim-edge', 'rim-edge'] };
  assert.equal(transitionExpeditionProgress(state, { type: 'OBSERVE_IMPACT', observationId: 'dated-image-comparison', evidence: badComparison, expectedRevision: state.revision }, atPoint(impact.discoveries[1])).error, 'invalid-evidence');
  const badSample = { ...evidenceFor['sample-comparison'], candidate: { measurement: Number.NaN, unit: 'relative signal units' } };
  assert.equal(transitionExpeditionProgress(state, { type: 'OBSERVE_IMPACT', observationId: 'sample-comparison', evidence: badSample, expectedRevision: state.revision }, atPoint(impact.discoveries[2])).error, 'invalid-evidence');
});

test('Impact requires activation, enabled campaign, explicit payment confirmation, and fresh revision', () => {
  const state = started();
  const unactivated = observe(state, 'rim-inspection');
  assert.equal(unactivated.error, 'base-not-active');
  const active = impactBase();
  assert.equal(observe(active, 'rim-inspection', active.revision - 1).error, 'stale-revision');
  assert.equal(transitionExpeditionProgress(active, { type: 'PAY_IMPACT', confirmed: false, expectedRevision: active.revision }, atPoint(impact.baseConsole)).error, 'invalid-evidence');
  const one = observe(active, 'rim-inspection').state;
  assert.equal(pay(one).error, 'not-enough-observations');
  const two = observe(one, 'dated-image-comparison').state;
  assert.equal(pay(two, two.revision - 1).error, 'stale-revision');
  const paid = pay(two).state;
  assert.equal(pay(paid, paid.revision).changed, false);
  assert.strictEqual(pay(paid, paid.revision).state, paid);
  const duplicate = observe(paid, 'rim-inspection', -1);
  assert.equal(duplicate.changed, false);
  assert.strictEqual(duplicate.state, paid);
});

test('Impact payment rejects insufficient stock atomically', () => {
  let state = impactBase();
  state = observe(state, 'rim-inspection').state;
  state = observe(state, 'sample-comparison').state;
  const lowStock = { ...state, bases: { ...state.bases, impact: { ...state.bases.impact, stock: { energyEU: 1, meals: 1, water: 1, air: 1 } } } };
  const result = pay(lowStock);
  assert.equal(result.error, 'insufficient-stock');
  assert.equal(result.changed, false);
  assert.strictEqual(result.state, lowStock);
});

test('Impact legal matching preserves accepted pairs and completes only at three', () => {
  let state = impactBase();
  state = observe(state, 'rim-inspection').state;
  state = observe(state, 'dated-image-comparison').state;
  state = pay(state).state;
  const first = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-rim', context: 'frame-rim', expectedRevision: state.revision }, atPoint(impact.baseConsole));
  assert.equal(first.changed, true);
  state = first.state;
  const duplicate = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-rim', context: 'frame-rim', expectedRevision: -1 }, atPoint(impact.baseConsole));
  assert.equal(duplicate.changed, false);
  assert.strictEqual(duplicate.state, state);
  const wrong = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-basin', context: 'frame-slope', expectedRevision: state.revision }, atPoint(impact.baseConsole));
  assert.equal(wrong.error, 'invalid-evidence');
  assert.strictEqual(wrong.state, state);
  const stale = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-basin', context: 'frame-basin', expectedRevision: state.revision - 1 }, atPoint(impact.baseConsole));
  assert.equal(stale.error, 'stale-revision');
  for (const [signal, context] of [['signal-basin', 'frame-basin'], ['signal-slope', 'frame-slope']]) {
    const result = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal, context, expectedRevision: state.revision }, atPoint(impact.baseConsole));
    assert.equal(result.changed, true);
    state = result.state;
  }
  assert.equal(state.surveys.impact.activityProgress.matches.length, 3);
  assert.equal(state.surveys.impact.activityDone, true);
  assert.equal(isActivityComplete('impact', state.surveys.impact.activityProgress), true);
  assert.equal(parseExpeditionProgress(serializeExpeditionProgress(state)).ok, true);
  const wrongRegionPair = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-rim', context: 'frame-basin', expectedRevision: state.revision }, atPoint(impact.baseConsole));
  assert.equal(wrongRegionPair.error, 'invalid-evidence');
  assert.strictEqual(wrongRegionPair.state, state);
});

test('Impact progress survives serialization and legacy v1 saves remain valid', () => {
  const initial = createInitialExpeditionProgress();
  assert.equal(parseExpeditionProgress(serializeExpeditionProgress(initial)).ok, true);
  const startedSave = started();
  assert.equal(parseExpeditionProgress(serializeExpeditionProgress(startedSave)).ok, true);
  const activated = transitionExpeditionProgress(startedSave, { type: 'ACTIVATE', regionId: 'impact' }, atPoint(impact.baseConsole)).state;
  assert.equal(parseExpeditionProgress(serializeExpeditionProgress(activated)).ok, true);
  let state = observe(activated, 'rim-inspection').state;
  state = observe(state, 'dated-image-comparison').state;
  state = pay(state).state;
  state = transitionExpeditionProgress(state, { type: 'MATCH_IMPACT', signal: 'signal-rim', context: 'frame-rim', expectedRevision: state.revision }, atPoint(impact.baseConsole)).state;
  const raw = serializeExpeditionProgress(state);
  const loaded = parseExpeditionProgress(raw);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, JSON.parse(raw));
});

test('Impact save validation rejects forged ledger order, stock, observations, and completion', () => {
  let state = impactBase();
  state = observe(state, 'rim-inspection').state;
  state = observe(state, 'dated-image-comparison').state;
  state = pay(state).state;
  const forged = [
    { ...state, transactions: [...state.transactions].reverse() },
    { ...state, revision: state.revision + 1 },
    { ...state, transactions: [...state.transactions, 'impact:pay'], revision: state.revision + 1 },
    { ...state, bases: { ...state.bases, impact: { ...state.bases.impact, stock: { energyEU: 11, meals: 3, water: 4, air: 3 } } } },
    { ...state, surveys: { ...state.surveys, impact: { ...state.surveys.impact, observations: ['sample-comparison'] } } },
    { ...state, surveys: { ...state.surveys, impact: { ...state.surveys.impact, activityProgress: { kind: 'impact', version: 1, matches: [{ signal: 'signal-rim', context: 'frame-rim' }] }, activityDone: true } } },
    { ...state, surveys: { ...state.surveys, dust: { ...state.surveys.dust, observations: ['rim-inspection'] } } },
  ];
  for (const value of forged) {
    assert.equal(parseExpeditionProgress(JSON.stringify(value)).ok, false);
    assert.throws(() => serializeExpeditionProgress(value));
  }
});
