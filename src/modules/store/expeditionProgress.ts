/** Persistable expedition campaign progress, isolated from actor and camera state. */
import {
  getRegionByPosition,
  sampleWorldGround,
  WORLD_REGIONS,
  type RegionId,
} from '../outpost-3d/worldRegions';
import {
  IMPACT_CONTEXTS,
  IMPACT_SIGNALS,
  initialActivityProgress,
  isActivityComplete,
  isActivityProgressValid,
  recordImpactMatch,
  type ImpactContextId,
  type ImpactProgress,
  type ImpactSignalId,
} from '../../game/mission/activities/rules';
export type { ImpactContextId, ImpactSignalId } from '../../game/mission/activities/rules';

export const EXPEDITION_STORAGE_KEY = 'ares-cradle-expedition-v1';
export const EXPEDITION_SCHEMA_VERSION = 1 as const;
export const EXPEDITION_CAMPAIGN_ID = 'ares-original-expedition' as const;
export const EXPEDITION_CONTENT_VERSION = 1 as const;
export const EXPEDITION_SAVE_LIMIT_BYTES = 2 * 1024 * 1024;
export const BASE_CONSOLE_RADIUS = 8;
export const BASE_GROUND_TOLERANCE = 0.25;
export const IMPACT_OBSERVATION_IDS = ['rim-inspection', 'dated-image-comparison', 'sample-comparison'] as const;
export type ImpactObservationId = (typeof IMPACT_OBSERVATION_IDS)[number];
export const IMPACT_CHANGED_FEATURES = ['rim-edge', 'rock-position', 'shadow-boundary', 'surface-mark'] as const;
export type ImpactChangedFeature = (typeof IMPACT_CHANGED_FEATURES)[number];
export const IMPACT_SAMPLE_CONCLUSION = 'appearance-alone-cannot-determine-origin' as const;
export const IMPACT_TRAINING_NOTICE = 'TRAINING schematic data only; not NASA imagery, measurements, or scientific provenance.' as const;
export const IMPACT_OBSERVATION_GUIDE: Readonly<Record<ImpactObservationId, { title: string; discoveryIndex: 0 | 1 | 2; instruction: string; accessibilityHint: string }>> = {
  'rim-inspection': { title: 'Rim inspection', discoveryIndex: 0, instruction: 'Inspect both the wide and close training views of the rim.', accessibilityHint: 'At the rim discovery, record one wide and one close inspection frame.' },
  'dated-image-comparison': { title: 'Dated image comparison', discoveryIndex: 1, instruction: 'Compare before and after frames; identify two distinct changed features.', accessibilityHint: 'At the dated-image discovery, inspect both frames and select two different changed features.' },
  'sample-comparison': { title: 'Sample comparison', discoveryIndex: 2, instruction: 'Record candidate and reference measurements; appearance alone cannot determine origin.', accessibilityHint: 'At the sample discovery, enter finite candidate and reference values and state that appearance alone cannot determine origin.' },
};
export type ImpactToolEvidence =
  | { tool: 'inspection-camera'; wide: { action: 'inspect-frame'; framing: 'wide'; target: 'rim'; frameId: string }; close: { action: 'inspect-frame'; framing: 'close'; target: 'rim'; frameId: string } }
  | { tool: 'dated-image-comparison'; before: { frame: 'before'; frameId: string }; after: { frame: 'after'; frameId: string }; changedFeatures: ImpactChangedFeature[] }
  | { tool: 'sample-comparison'; candidate: { measurement: number; unit: 'relative signal units' }; reference: { measurement: number; unit: 'relative signal units' }; conclusion: typeof IMPACT_SAMPLE_CONCLUSION };

/** Mission stock is tracked in explicit units; energy is EU, never a battery percentage. */
export const BASE_STOCK_FLOORS = {
  energyEU: 12,
  meals: 4,
  water: 5,
  air: 4,
} as const;
export const IMPACT_SURVEY_STOCK_COST = { energyEU: 2, meals: 1, water: 1, air: 1 } as const;
export const EXPEDITION_REGION_IDS: readonly RegionId[] = WORLD_REGIONS.map(({ id }) => id);
export type ArrivalStatus = 'none' | 'sent' | 'approved' | 'arrived' | 'departed';
export type BaseStock = { energyEU: number; meals: number; water: number; air: number };
export type BaseProgress = {
  active: boolean;
  stock: BaseStock;
  checks: [boolean, boolean, boolean];
  operation: null;
  deferred: string[];
  report: null;
};
export type SurveyProgress = {
  observations: string[];
  assists: string[];
  paid: boolean;
  activityProgress: unknown;
  activityDone: boolean;
};

/** Only campaign data belongs here. Player/rover/camera poses stay runtime-only. */
export type ExpeditionProgress = {
  schemaVersion: typeof EXPEDITION_SCHEMA_VERSION;
  campaignId: typeof EXPEDITION_CAMPAIGN_ID;
  contentVersion: typeof EXPEDITION_CONTENT_VERSION;
  revision: number;
  enabled: boolean;
  bases: Record<RegionId, BaseProgress>;
  surveys: Record<RegionId, SurveyProgress>;
  transactions: string[];
  researchGoal: string | null;
  arrivalBase: RegionId | null;
  arrival: ArrivalStatus;
  message: string;
};

export type ExpeditionCommand =
  | { type: 'START' }
  | { type: 'ACTIVATE'; regionId: RegionId }
  | { type: 'OBSERVE_IMPACT'; observationId: ImpactObservationId; evidence: ImpactToolEvidence; expectedRevision: number }
  | { type: 'PAY_IMPACT'; confirmed: true; expectedRevision: number }
  | { type: 'MATCH_IMPACT'; signal: ImpactSignalId; context: ImpactContextId; expectedRevision: number };

/** Ephemeral command context; deliberately never copied into progress or saves. */
export type ExpeditionRuntimeContext = {
  player: { x: number; y: number; z: number };
  isDrivingRover: boolean;
  isGrounded: boolean;
  actualRegion?: RegionId | 'home';
};

export type ExpeditionError =
  | 'invalid-context' | 'rover-required-on-foot' | 'campaign-not-started' | 'home-has-no-expedition-base'
  | 'wrong-region' | 'too-far-from-console' | 'not-grounded' | 'base-not-active'
  | 'stale-revision' | 'invalid-evidence' | 'not-enough-observations' | 'insufficient-stock'
  | 'payment-required' | 'unsupported-region-command';
export type ExpeditionTransition = { state: ExpeditionProgress; changed: boolean; error?: ExpeditionError | 'unsupported-command' };
export type ExpeditionParseResult =
  | { ok: true; state: ExpeditionProgress }
  | { ok: false; reason: 'corrupt' | 'unsupported' | 'oversized'; raw: string; canOverwrite: false };

const ids = EXPEDITION_REGION_IDS;
const ownKeysAre = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => ownKeys.includes(key));
};
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSafeCount = (value: unknown, min = 0, max = 1_000_000): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length <= 512);
const isRegionId = (value: unknown): value is RegionId => ids.includes(value as RegionId);
const isObservationId = (value: unknown): value is ImpactObservationId => IMPACT_OBSERVATION_IDS.includes(value as ImpactObservationId);
const isImpactSignal = (value: unknown): value is ImpactSignalId => IMPACT_SIGNALS.some(({ id }) => id === value);
const isImpactContext = (value: unknown): value is ImpactContextId => IMPACT_CONTEXTS.some(({ id }) => id === value);
const isFeature = (value: unknown): value is ImpactChangedFeature => IMPACT_CHANGED_FEATURES.includes(value as ImpactChangedFeature);
const validFrameId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;

function validEvidence(observationId: ImpactObservationId, value: unknown): value is ImpactToolEvidence {
  if (!isObject(value)) return false;
  if (observationId === 'rim-inspection') {
    if (!ownKeysAre(value, ['tool', 'wide', 'close']) || value.tool !== 'inspection-camera' || !isObject(value.wide) || !isObject(value.close)) return false;
    const validFrame = (frame: Record<string, unknown>, framing: 'wide' | 'close'): boolean =>
      ownKeysAre(frame, ['action', 'framing', 'target', 'frameId']) && frame.action === 'inspect-frame'
      && frame.framing === framing && frame.target === 'rim' && validFrameId(frame.frameId);
    return validFrame(value.wide, 'wide') && validFrame(value.close, 'close') && value.wide.frameId !== value.close.frameId;
  }
  if (observationId === 'dated-image-comparison') {
    if (!ownKeysAre(value, ['tool', 'before', 'after', 'changedFeatures']) || value.tool !== 'dated-image-comparison'
      || !isObject(value.before) || !isObject(value.after) || !Array.isArray(value.changedFeatures)) return false;
    return ownKeysAre(value.before, ['frame', 'frameId']) && value.before.frame === 'before' && validFrameId(value.before.frameId)
      && ownKeysAre(value.after, ['frame', 'frameId']) && value.after.frame === 'after' && validFrameId(value.after.frameId)
      && value.before.frameId !== value.after.frameId && value.changedFeatures.length >= 2
      && value.changedFeatures.every(isFeature) && new Set(value.changedFeatures).size === value.changedFeatures.length;
  }
  if (!ownKeysAre(value, ['tool', 'candidate', 'reference', 'conclusion']) || value.tool !== 'sample-comparison'
    || !isObject(value.candidate) || !isObject(value.reference) || value.conclusion !== IMPACT_SAMPLE_CONCLUSION) return false;
  const validMeasurement = (measurement: Record<string, unknown>): boolean => ownKeysAre(measurement, ['measurement', 'unit'])
    && typeof measurement.measurement === 'number' && Number.isFinite(measurement.measurement) && measurement.unit === 'relative signal units';
  return validMeasurement(value.candidate) && validMeasurement(value.reference);
}

export function createInitialExpeditionProgress(): ExpeditionProgress {
  const bases = Object.fromEntries(ids.map((id) => [id, {
    active: false, stock: { ...BASE_STOCK_FLOORS }, checks: [false, false, false], operation: null, deferred: [], report: null,
  }])) as unknown as Record<RegionId, BaseProgress>;
  const surveys = Object.fromEntries(ids.map((id) => [id, {
    observations: [], assists: [], paid: false, activityProgress: null, activityDone: false,
  }])) as unknown as Record<RegionId, SurveyProgress>;
  return {
    schemaVersion: EXPEDITION_SCHEMA_VERSION, campaignId: EXPEDITION_CAMPAIGN_ID, contentVersion: EXPEDITION_CONTENT_VERSION,
    revision: 0, enabled: false, bases, surveys, transactions: [], researchGoal: null, arrivalBase: null, arrival: 'none', message: '',
  };
}

function validBase(value: unknown, id: RegionId, paid: boolean): value is BaseProgress {
  if (!isObject(value) || !ownKeysAre(value, ['active', 'stock', 'checks', 'operation', 'deferred', 'report'])) return false;
  const stock = value.stock;
  const expectedStock = id === 'impact' && paid
    ? { energyEU: 10, meals: 3, water: 4, air: 3 } : BASE_STOCK_FLOORS;
  return typeof value.active === 'boolean' && isObject(stock) && ownKeysAre(stock, ['energyEU', 'meals', 'water', 'air'])
    && stock.energyEU === expectedStock.energyEU && stock.meals === expectedStock.meals && stock.water === expectedStock.water && stock.air === expectedStock.air
    && Array.isArray(value.checks) && value.checks.length === 3 && value.checks.every((check) => check === false)
    && value.operation === null && Array.isArray(value.deferred) && value.deferred.length === 0 && value.report === null;
}
function validSurveyShape(value: unknown): value is SurveyProgress {
  return isObject(value) && ownKeysAre(value, ['observations', 'assists', 'paid', 'activityProgress', 'activityDone'])
    && Array.isArray(value.observations) && value.observations.every(isObservationId) && new Set(value.observations).size === value.observations.length
    && Array.isArray(value.assists) && value.assists.length === 0
    && typeof value.paid === 'boolean' && typeof value.activityDone === 'boolean';
}

function reconstructTransactions(transactions: string[]): { paid: boolean; observations: string[]; matches: ImpactProgress['matches']; activated: Set<RegionId> } | null {
  if (new Set(transactions).size !== transactions.length) return null;
  const activated = new Set<RegionId>();
  const observations: string[] = [];
  const matches: ImpactProgress['matches'] = [];
  let started = false;
  let paid = false;
  for (const [index, transaction] of transactions.entries()) {
    if (transaction === 'campaign:start') {
      if (started || index !== 0) return null;
      started = true;
      continue;
    }
    if (!started) return null;
    const activation = /^base:activate:(impact|ice|volcano|lake|dust)$/.exec(transaction);
    if (activation) {
      const regionId = activation[1] as RegionId;
      if (activated.has(regionId)) return null;
      activated.add(regionId);
      continue;
    }
    if (!activated.has('impact')) return null;
    if (transaction.startsWith('impact:observe:')) {
      const observationId = transaction.slice('impact:observe:'.length);
      if (!isObservationId(observationId) || observations.includes(observationId)) return null;
      observations.push(observationId);
    } else if (transaction === 'impact:pay') {
      if (paid || observations.length < 2) return null;
      paid = true;
    } else if (transaction.startsWith('impact:match:')) {
      if (!paid) return null;
      const match = /^impact:match:(signal-rim|signal-basin|signal-slope):(frame-rim|frame-basin|frame-slope)$/.exec(transaction);
      if (!match) return null;
      const recorded = recordImpactMatch({ kind: 'impact', version: 1, matches }, match[1] as ImpactSignalId, match[2] as ImpactContextId);
      if (!recorded.accepted) return null;
      matches.push({ signal: match[1] as ImpactSignalId, context: match[2] as ImpactContextId });
    } else return null;
  }
  return { paid, observations, matches, activated };
}

function validProgress(value: unknown): value is ExpeditionProgress {
  if (!isObject(value) || !ownKeysAre(value, ['schemaVersion', 'campaignId', 'contentVersion', 'revision', 'enabled', 'bases', 'surveys', 'transactions', 'researchGoal', 'arrivalBase', 'arrival', 'message'])) return false;
  if (value.schemaVersion !== EXPEDITION_SCHEMA_VERSION || value.campaignId !== EXPEDITION_CAMPAIGN_ID || value.contentVersion !== EXPEDITION_CONTENT_VERSION
    || !isSafeCount(value.revision) || typeof value.enabled !== 'boolean' || !isObject(value.bases) || !isObject(value.surveys)
    || !isStringArray(value.transactions) || !(value.researchGoal === null || (typeof value.researchGoal === 'string' && value.researchGoal.length <= 256))
    || !(value.arrivalBase === null || isRegionId(value.arrivalBase)) || !['none', 'sent', 'approved', 'arrived', 'departed'].includes(value.arrival as string)
    || typeof value.message !== 'string' || value.message.length > 2048) return false;
  const transactions = value.transactions as string[];
  const reconstructed = reconstructTransactions(transactions);
  if (!reconstructed || value.revision !== transactions.length || value.enabled !== transactions.includes('campaign:start')
    || value.researchGoal !== null || value.arrivalBase !== null || value.arrival !== 'none' || value.message !== '') return false;
  if (!value.enabled && transactions.length !== 0) return false;
  const bases = value.bases as Record<string, unknown>;
  const surveys = value.surveys as Record<string, unknown>;
  if (!ownKeysAre(bases, ids) || !ownKeysAre(surveys, ids)) return false;
  if (!ids.every((id) => validBase(bases[id], id, id === 'impact' && reconstructed.paid))) return false;
  if (!ids.every((id) => validSurveyShape(surveys[id]))) return false;
  for (const id of ids) {
    const survey = surveys[id] as SurveyProgress;
    if (id !== 'impact') {
      if (survey.observations.length !== 0 || survey.paid || survey.activityProgress !== null || survey.activityDone) return false;
      continue;
    }
    if (survey.observations.length !== reconstructed.observations.length
      || survey.observations.some((observation, index) => observation !== reconstructed.observations[index])
      || survey.paid !== reconstructed.paid) return false;
    if ((survey.observations.length > 0 || survey.paid || survey.activityProgress !== null || survey.activityDone)
      && !reconstructed.activated.has('impact')) return false;
    if (!reconstructed.paid) {
      if (survey.activityProgress !== null || survey.activityDone) return false;
    } else {
      if (!isActivityProgressValid('impact', survey.activityProgress)) return false;
      const progress = survey.activityProgress as ImpactProgress;
      if (JSON.stringify(progress.matches) !== JSON.stringify(reconstructed.matches)) return false;
      if (survey.activityDone !== isActivityComplete('impact', progress)) return false;
    }
  }
  return ids.every((id) => (bases[id] as BaseProgress).active === reconstructed.activated.has(id));
}

/** Parse without destroying malformed or newer saves: failures are always non-overwritable. */
export function parseExpeditionProgress(raw: string): ExpeditionParseResult {
  if (new TextEncoder().encode(raw).byteLength > EXPEDITION_SAVE_LIMIT_BYTES) return { ok: false, reason: 'oversized', raw, canOverwrite: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupt', raw, canOverwrite: false }; }
  if (isObject(parsed) && (parsed.schemaVersion !== EXPEDITION_SCHEMA_VERSION || parsed.campaignId !== EXPEDITION_CAMPAIGN_ID || parsed.contentVersion !== EXPEDITION_CONTENT_VERSION)) {
    return { ok: false, reason: 'unsupported', raw, canOverwrite: false };
  }
  if (!validProgress(parsed)) return { ok: false, reason: 'corrupt', raw, canOverwrite: false };
  return { ok: true, state: parsed };
}
export function serializeExpeditionProgress(state: ExpeditionProgress): string {
  if (!validProgress(state)) throw new TypeError('Invalid expedition progress; refusing to overwrite save.');
  const raw = JSON.stringify(state);
  if (new TextEncoder().encode(raw).byteLength > EXPEDITION_SAVE_LIMIT_BYTES) throw new RangeError('Expedition progress exceeds the 2 MiB save limit.');
  return raw;
}

function validContext(context: ExpeditionRuntimeContext | undefined): context is ExpeditionRuntimeContext {
  return !!context && !!context.player && typeof context.isDrivingRover === 'boolean' && typeof context.isGrounded === 'boolean'
    && [context.player.x, context.player.y, context.player.z].every(Number.isFinite);
}
function contextError(context: ExpeditionRuntimeContext | undefined, regionId: RegionId, target: { x: number; z: number }): ExpeditionError | undefined {
  if (!validContext(context)) return 'invalid-context';
  if (context.isDrivingRover) return 'rover-required-on-foot';
  if (!context.isGrounded) return 'not-grounded';
  const region = getRegionByPosition(context.player.x, context.player.z);
  const actualRegion = context.actualRegion ?? region.id;
  if (actualRegion === 'home') return 'home-has-no-expedition-base';
  if (!isRegionId(actualRegion) || actualRegion !== regionId || region.id !== regionId) return 'wrong-region';
  if (Math.hypot(context.player.x - target.x, context.player.z - target.z) > BASE_CONSOLE_RADIUS) return 'too-far-from-console';
  if (Math.abs(context.player.y - sampleWorldGround(context.player.x, context.player.z)) > BASE_GROUND_TOLERANCE) return 'not-grounded';
  return undefined;
}
function rejected(state: ExpeditionProgress, error: ExpeditionError | 'unsupported-command'): ExpeditionTransition { return { state, changed: false, error }; }
function appendTransaction(state: ExpeditionProgress, transaction: string, patch: Partial<ExpeditionProgress>): ExpeditionTransition {
  return { state: { ...state, ...patch, revision: state.revision + 1, transactions: [...state.transactions, transaction] }, changed: true };
}

export function transitionExpeditionProgress(state: ExpeditionProgress, command: ExpeditionCommand, context?: ExpeditionRuntimeContext): ExpeditionTransition {
  if (command?.type === 'START') {
    if (state.enabled) return { state, changed: false };
    return appendTransaction(state, 'campaign:start', { enabled: true });
  }
  if (command?.type === 'ACTIVATE' && isRegionId(command.regionId)) {
    if (!state.enabled) return rejected(state, 'campaign-not-started');
    const base = state.bases[command.regionId];
    if (base.active) return { state, changed: false };
    const error = contextError(context, command.regionId, WORLD_REGIONS.find(({ id }) => id === command.regionId)!.baseConsole);
    if (error) return rejected(state, error);
    return appendTransaction(state, `base:activate:${command.regionId}`, { bases: { ...state.bases, [command.regionId]: { ...base, active: true } } });
  }
  if (command?.type !== 'OBSERVE_IMPACT' && command?.type !== 'PAY_IMPACT' && command?.type !== 'MATCH_IMPACT') return rejected(state, 'unsupported-command');
  if (!state.enabled) return rejected(state, 'campaign-not-started');
  if (!state.bases.impact.active) return rejected(state, 'base-not-active');
  const survey = state.surveys.impact;
  if (command.type === 'OBSERVE_IMPACT') {
    if (!isObservationId(command.observationId)) return rejected(state, 'invalid-evidence');
    if (survey.observations.includes(command.observationId)) return { state, changed: false };
    if (!validEvidence(command.observationId, command.evidence)) return rejected(state, 'invalid-evidence');
    if (!isSafeCount(command.expectedRevision) || command.expectedRevision !== state.revision) return rejected(state, 'stale-revision');
    const discovery = WORLD_REGIONS.find(({ id }) => id === 'impact')!.discoveries[IMPACT_OBSERVATION_GUIDE[command.observationId].discoveryIndex];
    const error = contextError(context, 'impact', discovery);
    if (error) return rejected(state, error);
    const observations = [...survey.observations, command.observationId];
    return appendTransaction(state, `impact:observe:${command.observationId}`, { surveys: { ...state.surveys, impact: { ...survey, observations } } });
  }
  if (command.type === 'PAY_IMPACT' && survey.paid) return { state, changed: false };
  if (command.type === 'MATCH_IMPACT' && isImpactSignal(command.signal) && isImpactContext(command.context)
    && (survey.activityProgress as ImpactProgress | null)?.matches.some(({ signal, context: matchedContext }) => signal === command.signal && matchedContext === command.context)) {
    return { state, changed: false };
  }
  const error = contextError(context, 'impact', WORLD_REGIONS.find(({ id }) => id === 'impact')!.baseConsole);
  if (error) return rejected(state, error);
  if (command.type === 'PAY_IMPACT') {
    if (!isSafeCount(command.expectedRevision) || command.expectedRevision !== state.revision) return rejected(state, 'stale-revision');
    if (command.confirmed !== true) return rejected(state, 'invalid-evidence');
    if (survey.observations.length < 2) return rejected(state, 'not-enough-observations');
    const stock = state.bases.impact.stock;
    if (stock.energyEU < IMPACT_SURVEY_STOCK_COST.energyEU || stock.meals < 1 || stock.water < 1 || stock.air < 1) return rejected(state, 'insufficient-stock');
    return appendTransaction(state, 'impact:pay', {
      bases: { ...state.bases, impact: { ...state.bases.impact, stock: { energyEU: stock.energyEU - 2, meals: stock.meals - 1, water: stock.water - 1, air: stock.air - 1 } } },
      surveys: { ...state.surveys, impact: { ...survey, paid: true, activityProgress: initialActivityProgress('impact') } },
    });
  }
  if (!survey.paid) return rejected(state, 'payment-required');
  if (!isSafeCount(command.expectedRevision) || command.expectedRevision !== state.revision) return rejected(state, 'stale-revision');
  if (!isImpactSignal(command.signal) || !isImpactContext(command.context)) return rejected(state, 'invalid-evidence');
  const result = recordImpactMatch(survey.activityProgress, command.signal, command.context);
  if (!result.accepted) return rejected(state, 'invalid-evidence');
  const activityDone = isActivityComplete('impact', result.progress);
  return appendTransaction(state, `impact:match:${command.signal}:${command.context}`, {
    surveys: { ...state.surveys, impact: { ...survey, activityProgress: result.progress, activityDone } },
  });
}
