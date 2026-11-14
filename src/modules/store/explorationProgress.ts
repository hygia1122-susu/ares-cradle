import { getScientificElement, SCIENTIFIC_ELEMENTS } from '../outpost-3d/scienceCatalog';
import { sampleWorldGround, WORLD_REGIONS, type RegionId } from '../outpost-3d/worldRegions';

export const EXPLORATION_STORAGE_KEY = 'ares-cradle-exploration-v1';
export const EXPLORATION_SCHEMA_VERSION = 1 as const;
export const EXPLORATION_SAVE_LIMIT_BYTES = 2 * 1024 * 1024;
export const SURVIVAL_CAPACITY = { air: 100, meals: 12, energyEU: 100 } as const;
export const SURVIVAL_DRAIN_PER_SECOND = {
  air: 100 / 10800,
  meals: 12 / 14400,
  energyEU: 100 / 14400,
} as const;
export const SURVIVAL_SUPPLY_PACKAGE = { air: 35, meals: 4, energyEU: 35 } as const;
export const EXPLORATION_ITEM_EFFECTS = {
  space_apple: { meals: 2 },
  backup_battery: { energyEU: 25 },
  air_canister: { air: 30 },
} as const;
export type ExplorationItemId = keyof typeof EXPLORATION_ITEM_EFFECTS;

export interface Supplies {
  air_canister: number;
  space_apple: number;
  backup_battery: number;
}

const INITIAL_SUPPLIES: Supplies = { air_canister: 2, space_apple: 6, backup_battery: 2 };
const LEGACY_EXPLORATION_KEYS = ['schemaVersion', 'revision', 'survival', 'collected', 'completedRegions', 'rewardedRegions', 'activeSeconds'] as const;

export interface SurvivalState {
  air: number;
  meals: number;
  energyEU: number;
}

export interface ExplorationProgress {
  schemaVersion: 1;
  revision: number;
  survival: SurvivalState;
  collected: string[];
  completedRegions: RegionId[];
  rewardedRegions: RegionId[];
  activeSeconds: number;
  supplies: Supplies;
}

export interface ExplorationContext {
  position: readonly [number, number, number];
  isRemote: boolean;
  remoteRegionId: RegionId | null;
  isGrounded: boolean;
}

export interface ExplorationResult {
  state: ExplorationProgress;
  changed: boolean;
  error?: string;
  completedRegion?: RegionId;
}

const regionIds = WORLD_REGIONS.map(({ id }) => id);
const scienceIds = new Set(SCIENTIFIC_ELEMENTS.map(({ id }) => id));
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function createInitialExplorationProgress(): ExplorationProgress {
  return {
    schemaVersion: EXPLORATION_SCHEMA_VERSION,
    revision: 0,
    survival: { ...SURVIVAL_CAPACITY },
    collected: [],
    completedRegions: [],
    rewardedRegions: [],
    activeSeconds: 0,
    supplies: { ...INITIAL_SUPPLIES },
  };
}

export function tickExplorationProgress(state: ExplorationProgress, dt: number, paused = false): ExplorationProgress {
  if (paused || !Number.isFinite(dt) || dt <= 0) return state;
  const elapsed = Math.min(dt, 1);
  const survival = {
    air: clamp(state.survival.air - SURVIVAL_DRAIN_PER_SECOND.air * elapsed, 0, SURVIVAL_CAPACITY.air),
    meals: clamp(state.survival.meals - SURVIVAL_DRAIN_PER_SECOND.meals * elapsed, 0, SURVIVAL_CAPACITY.meals),
    energyEU: clamp(state.survival.energyEU - SURVIVAL_DRAIN_PER_SECOND.energyEU * elapsed, 0, SURVIVAL_CAPACITY.energyEU),
  };
  return {
    ...state,
    survival,
    activeSeconds: Number.isFinite(state.activeSeconds + elapsed) ? state.activeSeconds + elapsed : state.activeSeconds,
  };
}

function deriveRegionLedger(collected: readonly string[]): { completedRegions: RegionId[]; rewardedRegions: RegionId[] } {
  const completedRegions = WORLD_REGIONS.filter((region) =>
    SCIENTIFIC_ELEMENTS.filter((element) => element.regionId === region.id).every((element) => collected.includes(element.id)),
  ).map(({ id }) => id);
  return { completedRegions, rewardedRegions: [...completedRegions] };
}

function validContext(context: ExplorationContext): boolean {
  return !!context && typeof context === 'object' && Array.isArray(context.position) && context.position.length === 3 &&
    context.position.every(Number.isFinite) && typeof context.isRemote === 'boolean' &&
    (context.remoteRegionId === null || regionIds.includes(context.remoteRegionId)) && typeof context.isGrounded === 'boolean';
}

export function collectScientificElement(
  state: ExplorationProgress,
  elementId: string,
  context: ExplorationContext,
): ExplorationResult {
  const element = getScientificElement(elementId);
  if (!element) return { state, changed: false, error: 'unknown-element' };
  if (!validContext(context)) return { state, changed: false, error: 'invalid-context' };
  if (state.collected.includes(elementId)) return { state, changed: false };
  if (!context.isGrounded) return { state, changed: false, error: 'not-grounded' };
  if (context.isRemote && context.remoteRegionId !== element.regionId) {
    return { state, changed: false, error: 'wrong-region' };
  }
  if (!context.isRemote && context.remoteRegionId !== null) return { state, changed: false, error: 'invalid-context' };
  const [x, y, z] = context.position;
  if (Math.hypot(x - element.position.x, z - element.position.z) > 4.5) {
    return { state, changed: false, error: 'too-far-from-element' };
  }
  if (Math.abs(y - sampleWorldGround(x, z)) > 2.5) return { state, changed: false, error: 'not-grounded' };

  if (state.revision >= 1_000_000_000) return { state, changed: false, error: 'revision-limit' };
  const collected = [...state.collected, elementId];
  const { completedRegions, rewardedRegions } = deriveRegionLedger(collected);
  const previousCompleted = new Set(state.completedRegions);
  const completedRegion = completedRegions.find((id) => !previousCompleted.has(id));
  const survival = completedRegion && !state.rewardedRegions.includes(completedRegion)
    ? {
      air: Math.min(SURVIVAL_CAPACITY.air, state.survival.air + SURVIVAL_SUPPLY_PACKAGE.air),
      meals: Math.min(SURVIVAL_CAPACITY.meals, state.survival.meals + SURVIVAL_SUPPLY_PACKAGE.meals),
      energyEU: Math.min(SURVIVAL_CAPACITY.energyEU, state.survival.energyEU + SURVIVAL_SUPPLY_PACKAGE.energyEU),
    }
    : state.survival;
  const next: ExplorationProgress = {
    ...state,
    revision: state.revision + 1,
    collected,
    completedRegions,
    rewardedRegions,
    survival,
  };
  return { state: next, changed: true, ...(completedRegion ? { completedRegion } : {}) };
}

export function consumeExplorationItem(state: ExplorationProgress, itemId: string): ExplorationResult {
  if (!Object.prototype.hasOwnProperty.call(EXPLORATION_ITEM_EFFECTS, itemId)) return { state, changed: false, error: 'unknown-item' };
  const effect = EXPLORATION_ITEM_EFFECTS[itemId as ExplorationItemId];
  const resource = Object.keys(effect)[0] as keyof SurvivalState;
  if (!Number.isSafeInteger(state.supplies[itemId as ExplorationItemId]) || state.supplies[itemId as ExplorationItemId] <= 0) {
    return { state, changed: false, error: 'no-supplies' };
  }
  if (state.survival[resource] >= SURVIVAL_CAPACITY[resource]) return { state, changed: false };
  const amount = effect[resource as keyof typeof effect] as number;
  if (state.revision >= 1_000_000_000) return { state, changed: false, error: 'revision-limit' };
  const item = itemId as ExplorationItemId;
  const next: ExplorationProgress = {
    ...state,
    revision: state.revision + 1,
    survival: { ...state.survival, [resource]: Math.min(SURVIVAL_CAPACITY[resource], state.survival[resource] + amount) },
    supplies: { ...state.supplies, [item]: state.supplies[item] - 1 },
  };
  return { state: next, changed: true };
}

function isValidState(value: unknown, allowLegacySupplies = false): value is ExplorationProgress {
  const legacyShape = exactKeys(value, LEGACY_EXPLORATION_KEYS);
  if (!legacyShape && !exactKeys(value, [...LEGACY_EXPLORATION_KEYS, 'supplies'])) return false;
  if (legacyShape && !allowLegacySupplies) return false;
  const state = value as unknown as ExplorationProgress;
  if (state.schemaVersion !== EXPLORATION_SCHEMA_VERSION || !Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision > 1_000_000_000) return false;
  if (!legacyShape && (!exactKeys(state.supplies, ['air_canister', 'space_apple', 'backup_battery']) ||
      Object.values(state.supplies as Record<string, unknown>).some((count) => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 9999))) return false;
  if (!exactKeys(state.survival, ['air', 'meals', 'energyEU'])) return false;
  if (!Number.isFinite(state.survival.air) || state.survival.air < 0 || state.survival.air > SURVIVAL_CAPACITY.air ||
      !Number.isFinite(state.survival.meals) || state.survival.meals < 0 || state.survival.meals > SURVIVAL_CAPACITY.meals ||
      !Number.isFinite(state.survival.energyEU) || state.survival.energyEU < 0 || state.survival.energyEU > SURVIVAL_CAPACITY.energyEU) return false;
  if (!Number.isFinite(state.activeSeconds) || state.activeSeconds < 0 || state.activeSeconds > Number.MAX_SAFE_INTEGER) return false;
  if (!Array.isArray(state.collected) || state.collected.length > SCIENTIFIC_ELEMENTS.length || state.collected.some((id) => typeof id !== 'string' || !scienceIds.has(id)) || new Set(state.collected).size !== state.collected.length) return false;
  const derived = deriveRegionLedger(state.collected);
  return Array.isArray(state.completedRegions) && Array.isArray(state.rewardedRegions) &&
    JSON.stringify(state.completedRegions) === JSON.stringify(derived.completedRegions) &&
    JSON.stringify(state.rewardedRegions) === JSON.stringify(derived.rewardedRegions);
}

export type ParseExplorationProgressResult =
  | { ok: true; state: ExplorationProgress }
  | { ok: false; reason: 'corrupt' | 'unsupported' | 'oversized'; raw: string; canOverwrite: false };

export function parseExplorationProgress(raw: string): ParseExplorationProgressResult {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > EXPLORATION_SAVE_LIMIT_BYTES) {
    return { ok: false, reason: 'oversized', raw, canOverwrite: false };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt', raw, canOverwrite: false };
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, 'schemaVersion') && (value as { schemaVersion?: unknown }).schemaVersion !== EXPLORATION_SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupported', raw, canOverwrite: false };
  }
  if (isValidState(value, true)) {
    const state = exactKeys(value, LEGACY_EXPLORATION_KEYS)
      ? { ...value, supplies: { ...INITIAL_SUPPLIES } } as ExplorationProgress
      : value;
    return { ok: true, state };
  }
  return { ok: false, reason: 'corrupt', raw, canOverwrite: false };
}

export function serializeExplorationProgress(state: ExplorationProgress): string {
  if (!isValidState(state)) throw new TypeError('Invalid exploration progress');
  const raw = JSON.stringify(state);
  if (new TextEncoder().encode(raw).byteLength > EXPLORATION_SAVE_LIMIT_BYTES) throw new RangeError('Exploration progress exceeds save limit');
  return raw;
}
