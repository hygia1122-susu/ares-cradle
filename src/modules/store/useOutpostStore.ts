/**
 * Ares Cradle - Reactive Outpost Store (Zustand)
 * Drives 3D Canvas, Tactile HUD, and Game Simulation Loop.
 */

import { create } from 'zustand';
import { SolPhase, StageConfig, GameEvent } from '@/modules/simulation-engine/types';
import { missionService } from '@/services/api';
import { STAGES_FIXTURES } from '@/services/api/MockMissionService';
import { soundEngine } from '@/modules/audio/soundEngine';
import { MarsWeatherTelemetry, fetchMarsWeather } from '@/modules/story-engine/services/marsWeatherService';
import { useStoryStore } from './useStoryStore';
import { getRegionByPosition, sampleWorldGround, WORLD_BOUNDS, WORLD_REGIONS, type RegionId } from '@/modules/outpost-3d/worldRegions';
import {
  createInitialExplorationProgress,
  EXPLORATION_STORAGE_KEY,
  parseExplorationProgress,
  serializeExplorationProgress,
  tickExplorationProgress,
  collectScientificElement,
  consumeExplorationItem,
  type ExplorationProgress
} from './explorationProgress';
import {
  createInitialExpeditionProgress,
  EXPEDITION_STORAGE_KEY,
  parseExpeditionProgress,
  serializeExpeditionProgress,
  transitionExpeditionProgress,
  type ExpeditionCommand,
  type ExpeditionProgress,
  type ImpactObservationId,
  type ImpactToolEvidence,
  type ImpactSignalId,
  type ImpactContextId
} from './expeditionProgress';

export const PLAYABLE_ROVER_SPEC = {
  scale: 0.7,
  radius: 1.55,
  wheelbase: 1.7,
  trackWidth: 1.6,
  groundOffset: 0
} as const;

import {
  ItemActionResult,
  evaluateItemTransaction,
  evaluateCargoTransfer
} from '@/modules/survival-ui/itemRegistry';

export interface OutpostStoreState {
  // Sol Clock & Diurnal Cycle
  solTime: number;              // Current second in Sol (0 to 60+)
  currentSol: number;           // Sol number (1, 5, 9, 12, 20)
  solPhase: SolPhase;           // 'Morning' | 'Noon' | 'Sunset' | 'Night'
  
  // Primary Telemetry Resources
  battery: number;              // 0 to 100% (always derived from batteryKwh / batteryCapacityKwh)
  batteryKwh: number;           // kWh (Single Source of Truth)
  batteryCapacityKwh: number;   // Max kWh
  oxygen: number;               // 0 to 25% (nominal ~20.9%)
  temperature: number;          // °C (nominal ~20°C)
  solarIntake: number;          // Instantaneous kW generated
  dustCoverage: number;         // 0.0 to 1.0 (0% to 100%)
  netPower: number;             // Instantaneous net kW

  // Player Allocations & Controls
  powerPriorityOxygen: number;  // 0 to 100%
  powerPriorityHeaters: number; // 0 to 100%
  emergencyPowerSaver: boolean; // Preserves 15% base battery drain

  // Mission State & Events
  activeStageId: number;
  stageConfig: StageConfig;
  activeEvents: GameEvent[];
  isSimulating: boolean;
  isGameOver: boolean;
  isVictory: boolean;
  failureReason: string | null;
  debriefReport: import('@/modules/simulation-engine/types').DebriefReport | null;
  activeWarnings: string[];
  isMuted: boolean;

  // Graphics Quality & Performance Tier (Prompt 1 Section 12)
  graphicsQuality: 'low' | 'medium' | 'high';
  setGraphicsQuality: (quality: 'low' | 'medium' | 'high') => void;

  // Backpack, Rover Cargo & Quickbar State (Prompt 2)
  isBackpackOpen: boolean;
  inventory: Record<string, number>;
  roverInventory: Record<string, number>;
  quickbarSlots: string[];
  lastItemActionResult: ItemActionResult | null;
  toggleBackpack: () => void;
  openBackpack: () => void;
  closeBackpack: () => void;
  useItem: (itemId: string) => boolean;
  executeItemAction: (itemId: string) => ItemActionResult;
  transferCargoItem: (
    itemId: string,
    direction: 'to_rover' | 'to_backpack'
  ) => { ok: boolean; reason: string };
  assignQuickbarSlot: (slotIndex: number, itemId: string) => void;
  addBatteryKwh: (kwhDelta: number) => number;

  // Reward Celebration State
  isCelebrationOpen: boolean;
  celebrationData: { title: string; subtitle: string; stars: number } | null;
  triggerCelebration: (title: string, subtitle: string, stars?: number) => void;
  dismissCelebration: () => void;

  // Real-Time NASA Mars Weather Telemetry
  marsWeather: MarsWeatherTelemetry | null;
  initMarsWeather: () => Promise<void>;

  // Classroom Session PIN Modal State
  isClassroomOpen: boolean;
  openClassroom: () => void;
  closeClassroom: () => void;
  toggleClassroom: () => void;

  // Character, Movement, Physics & Habitat State (Phase 12)
  playerPos: [number, number, number];
  joystickVector: { x: number; y: number };
  isInsideHabitat: boolean;
  isPlayerGrounded: boolean;
  isPlayerBlocked: boolean;
  blockedByLabel: string | null;
  standingOnLabel: string | null;
  jumpRequestCount: number;
  isPhysicsDebugVisible: boolean;
  isSprinting: boolean;
  sprintInputActive: boolean;
  thrusterEnergy: number;
  playerSpeedMps: number;
  airJumpsLeft: number;
  hudColorTheme: 'cerenkov-cyan' | 'solar-amber' | 'biodome-emerald' | 'phobos-plasma';
  setPlayerPos: (pos: [number, number, number]) => void;
  setJoystickVector: (vec: { x: number; y: number }) => void;
  setIsInsideHabitat: (isInside: boolean) => void;
  requestJump: () => void;
  setSprintInput: (active: boolean) => void;
  togglePhysicsDebug: () => void;
  setHudColorTheme: (theme: 'cerenkov-cyan' | 'solar-amber' | 'biodome-emerald' | 'phobos-plasma') => void;
  cycleHudColorTheme: () => void;
  setPhysicsStatus: (status: {
    isGrounded: boolean;
    isBlocked: boolean;
    blockedByLabel: string | null;
    standingOnLabel: string | null;
    isSprinting?: boolean;
    thrusterEnergy?: number;
    playerSpeedMps?: number;
    airJumpsLeft?: number;
  }) => void;

  // Phase 13: Exploration Rover & Orrery Sky View
  isDrivingRover: boolean;
  roverPos: [number, number, number];
  roverHeading: number;
  roverSpeed: number;
  roverHeadlightMode: 'low' | 'high';
  isSkyViewActive: boolean;
  cameraYaw: number;
  isMouseDriving: boolean;
  toggleDrivingRover: () => void;
  toggleRoverHeadlightMode: () => void;
  setRoverPos: (pos: [number, number, number]) => void;
  publishRoverState: (pose: { x: number; y: number; z: number; heading: number }, speed: number) => void;
  toggleSkyView: () => void;
  setCameraYaw: (yaw: number) => void;
  setIsMouseDriving: (driving: boolean) => void;

  // Phase 15: Emergency Brownout STEM Quiz
  isBrownoutQuizOpen: boolean;
  hasUsedBrownoutQuiz: boolean;
  openBrownoutQuiz: () => void;
  closeBrownoutQuiz: () => void;
  handleBrownoutQuizSuccess: () => void;

  // Ares Cradle Optimization (v3.0)
  isFlashlightOn: boolean;
  toggleFlashlight: () => void;
  isDatapadOpen: boolean;
  toggleDatapad: () => void;
  openDatapad: () => void;
  closeDatapad: () => void;
  isStormShutterClosed: boolean;
  toggleStormShutter: () => void;
  setStormShutter: (closed: boolean) => void;
  isRoverDocked: boolean;
  setIsRoverDocked: (docked: boolean) => void;

  // 4-Phase Sortie & Visual Evolution (v3.2)
  domeEvolutionLevel: number;
  roverUpgradeLevel: number;
  currentSortiePhase: 'briefing' | 'field' | 'return' | 'lab';
  expeditionProgress: ExpeditionProgress;
  expeditionStorageWarning: string | null;
  expeditionPersistenceBlocked: boolean;
  expeditionActionError: string | null;
  exploration: ExplorationProgress;
  explorationWarning: string | null;
  explorationPersistenceBlocked: boolean;
  inspectScientificElement: (id: string) => boolean;
  activeScienceEntryId: string | null;
  openScienceEntry: (id: string | null) => void;
  consumeSurvivalItem: (itemId: string) => boolean;
  remoteRegionId: RegionId | null;
  regionalRoverPoses: Record<RegionId, { position: [number, number, number]; heading: number }>;
  cameraPitch: number;
  setCameraLook: (yaw: number, pitch: number) => void;
  isPointerLocked: boolean;
  setPointerLocked: (locked: boolean) => void;
  isManualOpen: boolean;
  setManualOpen: (open: boolean) => void;
  activeWaypointRegionId: RegionId;
  setWaypointRegion: (id: RegionId) => void;
  explorationNotice: string | null;
  dismissExplorationNotice: () => void;
  startExpedition: () => void;
  activateExpeditionBase: (regionId: RegionId) => boolean;
  observeImpact: (observationId: ImpactObservationId, evidence: ImpactToolEvidence, expectedRevision?: number) => boolean;
  payImpactSurvey: (confirmed: boolean, expectedRevision?: number) => boolean;
  matchImpactRecords: (signal: ImpactSignalId, context: ImpactContextId, expectedRevision?: number) => boolean;
  setDomeEvolutionLevel: (lvl: number) => void;
  setRoverUpgradeLevel: (lvl: number) => void;
  setSortiePhase: (phase: 'briefing' | 'field' | 'return' | 'lab') => void;

  // Actions
  addWater: (amount?: number) => void;
  restoreFullOxygen: () => void;
  tick: (deltaSeconds?: number) => void;
  tickTelemetry: (delta: number) => void;
  setPowerAllocation: (oxygen: number, heaters: number) => void;
  setPowerPriorities: (oxygen: number, heaters: number) => void;
  toggleEmergencySaver: () => void;
  cleanDust: (amount?: number | unknown) => void;
  setStage: (stageId: number) => Promise<void>;
  resetCurrentStage: () => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  toggleMute: () => void;
}

const defaultStageConfig = STAGES_FIXTURES[1];

function loadExpeditionProgress(): {
  progress: ExpeditionProgress;
  warning: string | null;
  persistenceBlocked: boolean;
} {
  const initial = createInitialExpeditionProgress();
  if (typeof window === 'undefined') return { progress: initial, warning: null, persistenceBlocked: false };
  try {
    const raw = window.localStorage.getItem(EXPEDITION_STORAGE_KEY);
    if (raw === null) return { progress: initial, warning: null, persistenceBlocked: false };
    const parsed = parseExpeditionProgress(raw);
    if (parsed.ok) return { progress: parsed.state, warning: null, persistenceBlocked: false };
    return {
      progress: initial,
      warning: `Saved expedition data is ${parsed.reason} and was preserved.`,
      persistenceBlocked: true
    };
  } catch {
    return { progress: initial, warning: 'Progress is not saved', persistenceBlocked: true };
  }
}

const initialExpedition = loadExpeditionProgress();

function loadExplorationProgress(): {
  progress: ExplorationProgress;
  warning: string | null;
  persistenceBlocked: boolean;
} {
  const initial = createInitialExplorationProgress();
  if (typeof window === 'undefined') return { progress: initial, warning: null, persistenceBlocked: false };
  try {
    const raw = window.localStorage.getItem(EXPLORATION_STORAGE_KEY);
    if (raw === null) return { progress: initial, warning: null, persistenceBlocked: false };
    const parsed = parseExplorationProgress(raw);
    if (parsed.ok) return { progress: parsed.state, warning: null, persistenceBlocked: false };
    return { progress: initial, warning: `Saved exploration data is ${parsed.reason} and was preserved.`, persistenceBlocked: true };
  } catch {
    return { progress: initial, warning: 'Progress is not saved', persistenceBlocked: true };
  }
}

function loadManualOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try { return window.localStorage.getItem('ares-cradle-controls-v1') !== 'viewed'; }
  catch { return true; }
}

const initialExploration = loadExplorationProgress();
const initialManualOpen = loadManualOpen();
const initialRegionalRoverPoses = Object.fromEntries(WORLD_REGIONS.map((region) => [region.id, {
  position: [region.safeParking.x, sampleWorldGround(region.safeParking.x, region.safeParking.z), region.safeParking.z] as [number, number, number],
  heading: 0
}])) as Record<RegionId, { position: [number, number, number]; heading: number }>;

export const useOutpostStore = create<OutpostStoreState>((set, get) => {
  let lastExplorationPersistSeconds = initialExploration.progress.activeSeconds;
  const shownDepletionNotices = new Set<'air' | 'meals'>();
  const persistExploration = (progress: ExplorationProgress) => {
    const current = get();
    if (current.explorationPersistenceBlocked) return { warning: current.explorationWarning, blocked: true };
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(EXPLORATION_STORAGE_KEY, serializeExplorationProgress(progress));
      lastExplorationPersistSeconds = progress.activeSeconds;
      return { warning: null, blocked: false };
    } catch {
      return { warning: 'Progress is not saved', blocked: true };
    }
  };
  const saveExplorationEvent = (progress: ExplorationProgress) => {
    const result = persistExploration(progress);
    set({ exploration: progress, explorationWarning: result.warning, explorationPersistenceBlocked: result.blocked });
  };
  const openUnlockedScienceEntry = (id: string) => {
    if (get().exploration.collected.includes(id)) set({ activeScienceEntryId: id });
    else set({ explorationNotice: 'Scientific entry is still locked.' });
  };
  const commitImpactCommand = (command: Extract<ExpeditionCommand, { type: 'OBSERVE_IMPACT' | 'PAY_IMPACT' | 'MATCH_IMPACT' }>): boolean => {
    const current = get();
    if (current.isGameOver || current.isVictory) {
      set({ expeditionActionError: 'terminal-state' });
      return false;
    }
    if (command.type === 'PAY_IMPACT' && command.confirmed !== true) {
      set({ expeditionActionError: 'invalid-evidence' });
      return false;
    }
    const [x, y, z] = current.playerPos;
    const result = transitionExpeditionProgress(current.expeditionProgress, command, {
      player: { x, y, z },
      isDrivingRover: current.isDrivingRover,
      isGrounded: current.isPlayerGrounded,
      actualRegion: getRegionByPosition(x, z).id
    });
    if (!result.changed) {
      set({ expeditionActionError: result.error ?? null });
      return false;
    }
    let warning = current.expeditionPersistenceBlocked ? current.expeditionStorageWarning : null;
    let persistenceBlocked = current.expeditionPersistenceBlocked;
    if (!persistenceBlocked) {
      try {
        window.localStorage.setItem(EXPEDITION_STORAGE_KEY, serializeExpeditionProgress(result.state));
      } catch {
        warning = 'Progress is not saved';
        persistenceBlocked = true;
      }
    }
    set({ expeditionProgress: result.state, expeditionStorageWarning: warning, expeditionPersistenceBlocked: persistenceBlocked, expeditionActionError: null });
    return true;
  };

  return {
  expeditionProgress: initialExpedition.progress,
  expeditionStorageWarning: initialExpedition.warning,
  expeditionPersistenceBlocked: initialExpedition.persistenceBlocked,
  expeditionActionError: null,
  exploration: initialExploration.progress,
  explorationWarning: initialExploration.warning,
  explorationPersistenceBlocked: initialExploration.persistenceBlocked,
  inspectScientificElement: (id) => {
    const state = get();
    const position = state.isDrivingRover && state.remoteRegionId
      ? state.roverPos
      : state.playerPos;
    const context = {
      position,
      isRemote: state.isDrivingRover,
      remoteRegionId: state.remoteRegionId,
      isGrounded: state.isDrivingRover || state.isPlayerGrounded
    };
    const alreadyCollected = state.exploration.collected.includes(id);
    const result = alreadyCollected
      ? { state: state.exploration, changed: false }
      : collectScientificElement(state.exploration, id, context);
    if (result.error) {
      set({ explorationNotice: result.error });
      return false;
    }
    if (!result.changed && !alreadyCollected) {
      set({ explorationNotice: 'Scientific element is not within inspection range.' });
      return false;
    }
    if (result.changed) saveExplorationEvent(result.state);
    openUnlockedScienceEntry(id);
    set({ explorationNotice: result.completedRegion
      ? `Regional science complete. Supply package delivered to ${result.completedRegion}.`
      : null });
    if (typeof document !== 'undefined' && document.pointerLockElement && typeof document.exitPointerLock === 'function') document.exitPointerLock();
    return true;
  },
  activeScienceEntryId: null,
  openScienceEntry: (id) => {
    if (id === null) { set({ activeScienceEntryId: null }); return; }
    openUnlockedScienceEntry(id);
    if (get().exploration.collected.includes(id) && typeof document !== 'undefined' && document.pointerLockElement && typeof document.exitPointerLock === 'function') document.exitPointerLock();
  },
  consumeSurvivalItem: (itemId) => {
    if (!['air_canister', 'space_apple', 'backup_battery'].includes(itemId)) return false;
    const state = get();
    if ((state.inventory[itemId] ?? 0) < 1 || (state.exploration.supplies[itemId as keyof typeof state.exploration.supplies] ?? 0) < 1) {
      set({ explorationNotice: 'No supplies of this type remain.' });
      return false;
    }
    const result = consumeExplorationItem(state.exploration, itemId);
    if (result.error || !result.changed) {
      set({ explorationNotice: result.error ?? 'This supply has no effect right now.' });
      return false;
    }
    const persisted = persistExploration(result.state);
    set({
      exploration: result.state,
      explorationWarning: persisted.warning,
      explorationPersistenceBlocked: persisted.blocked,
      inventory: { ...state.inventory, [itemId]: result.state.supplies[itemId as keyof typeof result.state.supplies] },
      explorationNotice: null
    });
    return true;
  },
  remoteRegionId: null,
  regionalRoverPoses: initialRegionalRoverPoses,
  cameraPitch: 0,
  setCameraLook: (yaw, pitch) => {
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    const wrappedYaw = ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    set({ cameraYaw: wrappedYaw, cameraPitch: Math.max(-1.45, Math.min(1.45, pitch)) });
  },
  isPointerLocked: false,
  setPointerLocked: (locked) => set({ isPointerLocked: Boolean(locked) }),
  isManualOpen: initialManualOpen,
  setManualOpen: (open) => {
    set({ isManualOpen: open });
    if (!open && typeof window !== 'undefined') {
      try { window.localStorage.setItem('ares-cradle-controls-v1', 'viewed'); }
      catch { set({ explorationWarning: 'Controls viewed, but this preference could not be saved.' }); }
    }
  },
  activeWaypointRegionId: 'dust',
  setWaypointRegion: (id) => set({ activeWaypointRegionId: id }),
  explorationNotice: null,
  dismissExplorationNotice: () => set({ explorationNotice: null }),
  startExpedition: () => {
    const current = get();
    if (current.isGameOver || current.isVictory) return;
    const result = transitionExpeditionProgress(current.expeditionProgress, { type: 'START' });
    if (!result.changed) return;
    let warning = current.expeditionPersistenceBlocked ? current.expeditionStorageWarning : null;
    let persistenceBlocked = current.expeditionPersistenceBlocked;
    if (!persistenceBlocked) {
      try {
        window.localStorage.setItem(EXPEDITION_STORAGE_KEY, serializeExpeditionProgress(result.state));
      } catch {
        warning = 'Progress is not saved';
        persistenceBlocked = true;
      }
    }
    set({ expeditionProgress: result.state, expeditionStorageWarning: warning, expeditionPersistenceBlocked: persistenceBlocked });
  },
  activateExpeditionBase: (regionId: RegionId) => {
    const current = get();
    const [x, y, z] = current.playerPos;
    const region = getRegionByPosition(x, z);
    const result = transitionExpeditionProgress(current.expeditionProgress, { type: 'ACTIVATE', regionId }, {
      player: { x, y, z },
      isDrivingRover: current.isDrivingRover,
      isGrounded: current.isPlayerGrounded,
      actualRegion: region.id
    });
    if (!result.changed) return false;
    let warning = current.expeditionPersistenceBlocked ? current.expeditionStorageWarning : null;
    let persistenceBlocked = current.expeditionPersistenceBlocked;
    if (!persistenceBlocked) {
      try {
        window.localStorage.setItem(EXPEDITION_STORAGE_KEY, serializeExpeditionProgress(result.state));
      } catch {
        warning = 'Progress is not saved';
        persistenceBlocked = true;
      }
    }
    set({ expeditionProgress: result.state, expeditionStorageWarning: warning, expeditionPersistenceBlocked: persistenceBlocked });
    return true;
  },
  observeImpact: (observationId, evidence, expectedRevision) => commitImpactCommand({
    type: 'OBSERVE_IMPACT', observationId, evidence, expectedRevision: expectedRevision ?? get().expeditionProgress.revision
  }),
  payImpactSurvey: (confirmed, expectedRevision) => {
    if (confirmed !== true) {
      set({ expeditionActionError: 'invalid-evidence' });
      return false;
    }
    return commitImpactCommand({ type: 'PAY_IMPACT', confirmed: true, expectedRevision: expectedRevision ?? get().expeditionProgress.revision });
  },
  matchImpactRecords: (signal, context, expectedRevision) => commitImpactCommand({
    type: 'MATCH_IMPACT', signal, context, expectedRevision: expectedRevision ?? get().expeditionProgress.revision
  }),
  // Initial state derived from Stage 1
  solTime: 0.0,
  currentSol: defaultStageConfig.sol,
  solPhase: 'Morning',
  
  battery: (defaultStageConfig.initialBatteryKwh / defaultStageConfig.batteryCapacityKwh) * 100,
  batteryKwh: defaultStageConfig.initialBatteryKwh,
  batteryCapacityKwh: defaultStageConfig.batteryCapacityKwh,
  oxygen: defaultStageConfig.initialOxygenPercent,
  temperature: defaultStageConfig.initialTemperatureCelsius,
  solarIntake: 0.0,
  dustCoverage: defaultStageConfig.initialDustCoverage,
  netPower: 0.0,

  powerPriorityOxygen: 50,
  powerPriorityHeaters: 50,
  emergencyPowerSaver: false,

  activeStageId: 1,
  stageConfig: defaultStageConfig,
  activeEvents: JSON.parse(JSON.stringify(defaultStageConfig.events)),
  isSimulating: true,
  isGameOver: false,
  isVictory: false,
  failureReason: null,
  debriefReport: null,
  activeWarnings: [],
  isMuted: false,

  graphicsQuality: 'medium',
  setGraphicsQuality: (quality) => {
    soundEngine.playClick(1050);
    set({ graphicsQuality: quality });
  },

  // Backpack, Rover Cargo & 5-Slot Quickbar Initial State (Prompt 2)
  isBackpackOpen: false,
  inventory: {
    flashlight: 1,
    air_canister: initialExploration.progress.supplies.air_canister,
    sonic_wiper: 3,
    space_tape: 2,
    backup_battery: initialExploration.progress.supplies.backup_battery,
    space_apple: initialExploration.progress.supplies.space_apple,
    water_canister: 1,
    mineral_shard: 1,
    thermal_blanket: 1,
    soil_analyzer: 1,
    sample_container: 1,
    gasket_set: 1,
    rover_repair_kit: 1,
    relay_beacon: 1
  },
  roverInventory: {
    backup_battery: 1,
    water_canister: 1,
    space_tape: 1
  },
  quickbarSlots: [
    'flashlight',
    'sonic_wiper',
    'backup_battery',
    'space_tape',
    'soil_analyzer'
  ],
  lastItemActionResult: null,
  toggleBackpack: () => {
    soundEngine.playClick(950);
    set((state) => ({ isBackpackOpen: !state.isBackpackOpen }));
  },
  openBackpack: () => {
    soundEngine.playClick(950);
    set({ isBackpackOpen: true });
  },
  closeBackpack: () => {
    soundEngine.playClick(650);
    set({ isBackpackOpen: false });
  },
  assignQuickbarSlot: (slotIndex: number, itemId: string) => {
    if (slotIndex < 0 || slotIndex >= 5) return;
    soundEngine.playClick(1120);
    set((state) => {
      const updated = [...state.quickbarSlots];
      updated[slotIndex] = itemId;
      return { quickbarSlots: updated };
    });
  },
  addBatteryKwh: (kwhDelta: number) => {
    const state = get();
    const cap = Math.max(0.001, state.batteryCapacityKwh);
    const nextKwh = Math.max(0, Math.min(cap, state.batteryKwh + kwhDelta));
    const added = nextKwh - state.batteryKwh;
    const nextPct = Math.max(0, Math.min(100, (nextKwh / cap) * 100));
    set({
      batteryKwh: nextKwh,
      battery: nextPct
    });
    return added;
  },
  executeItemAction: (itemId: string) => {
    if (['air_canister', 'space_apple', 'backup_battery'].includes(itemId)) {
      const ok = get().consumeSurvivalItem(itemId);
      const result: ItemActionResult = ok
        ? { ok: true, itemId, consumed: 1, feedback: 'Exploration supply consumed.' }
        : { ok: false, itemId, code: 'NO_EFFECT', reason: get().explorationNotice ?? 'Supply had no effect.' };
      set({ lastItemActionResult: result });
      return result;
    }
    const state = get();
    const storyState = useStoryStore.getState();
    const hasActiveLeak = state.activeEvents.some(
      (e) => e.active && !e.resolved && Boolean(e.effects?.leakRateMultiplier)
    );

    const mutation = evaluateItemTransaction(itemId, {
      inventory: state.inventory,
      roverInventory: state.roverInventory,
      batteryKwh: state.batteryKwh,
      batteryCapacityKwh: state.batteryCapacityKwh,
      oxygen: state.oxygen,
      temperature: state.temperature,
      dustCoverage: state.dustCoverage,
      thrusterEnergy: state.thrusterEnergy,
      isInsideHabitat: state.isInsideHabitat,
      isDrivingRover: state.isDrivingRover,
      playerPos: state.playerPos,
      roverPos: state.roverPos,
      hasActiveLeakEvent: hasActiveLeak,
      unlockedSols: storyState.unlockedSols
    });

    if (!mutation.result.ok) {
      soundEngine.playClick(420);
      set({ lastItemActionResult: mutation.result });
      return mutation.result;
    }

    soundEngine.playClick(1320);

    if (mutation.toggleFlashlight) {
      get().toggleFlashlight();
    }

    let nextEvents = state.activeEvents;
    if (mutation.resolveLeakEvents) {
      nextEvents = state.activeEvents.map((evt) =>
        evt.active && evt.effects?.leakRateMultiplier
          ? { ...evt, active: false, resolved: true }
          : evt
      );
    }

    set({
      inventory: mutation.nextInventory,
      batteryKwh: mutation.nextBatteryKwh,
      battery: mutation.nextBatteryPercent,
      oxygen: mutation.nextOxygen,
      temperature: mutation.nextTemperature,
      dustCoverage: mutation.nextDustCoverage,
      thrusterEnergy: mutation.nextThrusterEnergy,
      activeEvents: nextEvents,
      lastItemActionResult: mutation.result
    });

    if (mutation.nextDustCoverage < 0.15 && state.dustCoverage >= 0.15) {
      storyState.completeObjective('sol1-wipe-panels');
      storyState.completeObjective('obj-dust-1');
      storyState.completeObjective('obj-wipe-sol1');
    }

    if (mutation.stemScoreBonus) {
      useStoryStore.setState((s) => ({ stemScore: s.stemScore + (mutation.stemScoreBonus || 0) }));
    }

    storyState.triggerFieldToast({
      title: `${itemId.replace(/_/g, ' ').toUpperCase()}`,
      fact: mutation.result.feedback,
      icon: '🛠️',
      badge: mutation.result.consumed > 0 ? 'CONSUMABLE APPLIED' : 'TOOL ACTIVATED'
    });

    return mutation.result;
  },
  useItem: (itemId: string) => {
    const res = get().executeItemAction(itemId);
    return res.ok;
  },
  transferCargoItem: (itemId, direction) => {
    const state = get();
    const tx = evaluateCargoTransfer({
      itemId,
      direction,
      personalInventory: state.inventory,
      roverInventory: state.roverInventory,
      playerPos: state.playerPos,
      roverPos: state.roverPos,
      isDrivingRover: state.isDrivingRover
    });

    if (!tx.ok) {
      soundEngine.playClick(420);
      return { ok: false, reason: tx.reason };
    }

    soundEngine.playClick(1180);
    set({
      inventory: tx.nextPersonalInventory,
      roverInventory: tx.nextRoverInventory
    });
    return { ok: true, reason: tx.reason };
  },

  // Reward Celebration Initial State
  isCelebrationOpen: false,
  celebrationData: null,
  triggerCelebration: (title: string, subtitle: string, stars = 3) => {
    soundEngine.playSuccessChime();
    set({
      isCelebrationOpen: true,
      celebrationData: { title, subtitle, stars }
    });
  },
  dismissCelebration: () => {
    set({ isCelebrationOpen: false, celebrationData: null });
  },

  // NASA Mars Weather Telemetry Implementation
  marsWeather: null,
  initMarsWeather: async () => {
    try {
      const weather = await fetchMarsWeather();
      set({ marsWeather: weather });
      if (weather.stormRisk === 'severe') {
        set((state) => ({ dustCoverage: Math.min(0.8, state.dustCoverage + 0.15) }));
      }
    } catch (_err) {
      // Resilient fallback guaranteed
    }
  },

  // Classroom Session PIN Modal Implementation
  isClassroomOpen: false,
  openClassroom: () => {
    soundEngine.playClick(1050);
    set({ isClassroomOpen: true });
  },
  closeClassroom: () => {
    soundEngine.playClick(650);
    set({ isClassroomOpen: false });
  },
  toggleClassroom: () => {
    soundEngine.playClick(1050);
    set((state) => ({ isClassroomOpen: !state.isClassroomOpen }));
  },

  // Character, Movement, Physics & Habitat State Implementation
  playerPos: [0, -0.4, 1.55],
  joystickVector: { x: 0, y: 0 },
  isInsideHabitat: true,
  isPlayerGrounded: true,
  isPlayerBlocked: false,
  blockedByLabel: null,
  standingOnLabel: null,
  jumpRequestCount: 0,
  isPhysicsDebugVisible: false,
  isSprinting: false,
  sprintInputActive: false,
  thrusterEnergy: 100,
  playerSpeedMps: 0,
  airJumpsLeft: 1,
  hudColorTheme: 'solar-amber',
  setPlayerPos: (pos: [number, number, number]) => set({ playerPos: pos }),
  setJoystickVector: (vec: { x: number; y: number }) => set({ joystickVector: vec }),
  setIsInsideHabitat: (isInside: boolean) => {
    const prev = get().isInsideHabitat;
    if (prev !== isInside) {
      soundEngine.playAirlock();
    }
    set({ isInsideHabitat: isInside });
  },
  requestJump: () => {
    set((state) => ({ jumpRequestCount: state.jumpRequestCount + 1 }));
  },
  setSprintInput: (active: boolean) => set({ sprintInputActive: active }),
  togglePhysicsDebug: () => {
    soundEngine.playClick(1150);
    set((state) => ({ isPhysicsDebugVisible: !state.isPhysicsDebugVisible }));
  },
  setHudColorTheme: (theme) => {
    soundEngine.playClick(1250);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-hud-theme', theme);
    }
    set({ hudColorTheme: theme });
  },
  cycleHudColorTheme: () => {
    const order: Array<'cerenkov-cyan' | 'solar-amber' | 'biodome-emerald' | 'phobos-plasma'> = [
      'solar-amber',
      'cerenkov-cyan',
      'biodome-emerald',
      'phobos-plasma'
    ];
    const current = get().hudColorTheme;
    const next = order[(order.indexOf(current) + 1) % order.length];
    soundEngine.playClick(1250);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-hud-theme', next);
    }
    set({ hudColorTheme: next });
  },
  setPhysicsStatus: (status) => {
    const state = get();
    const nextSprint = status.isSprinting ?? state.isSprinting;
    const nextEnergy = status.thrusterEnergy !== undefined ? Math.round(status.thrusterEnergy) : state.thrusterEnergy;
    const nextSpeed = status.playerSpeedMps !== undefined ? Number(status.playerSpeedMps.toFixed(1)) : state.playerSpeedMps;
    const nextAirJumps = status.airJumpsLeft ?? state.airJumpsLeft;

    if (
      state.isPlayerGrounded !== status.isGrounded ||
      state.isPlayerBlocked !== status.isBlocked ||
      state.blockedByLabel !== status.blockedByLabel ||
      state.standingOnLabel !== status.standingOnLabel ||
      state.isSprinting !== nextSprint ||
      state.thrusterEnergy !== nextEnergy ||
      state.playerSpeedMps !== nextSpeed ||
      state.airJumpsLeft !== nextAirJumps
    ) {
      set({
        isPlayerGrounded: status.isGrounded,
        isPlayerBlocked: status.isBlocked,
        blockedByLabel: status.blockedByLabel,
        standingOnLabel: status.standingOnLabel,
        isSprinting: nextSprint,
        thrusterEnergy: nextEnergy,
        playerSpeedMps: nextSpeed,
        airJumpsLeft: nextAirJumps
      });
    }
  },

  // Exploration Rover & Orrery Sky View Implementation
  isDrivingRover: false,
  roverPos: initialRegionalRoverPoses.dust.position,
  roverHeading: 0,
  roverSpeed: 0,
  roverHeadlightMode: 'low',
  isSkyViewActive: false,
  toggleRoverHeadlightMode: () => {
    soundEngine.playClick(1200);
    set((state) => ({
      roverHeadlightMode: state.roverHeadlightMode === 'low' ? 'high' : 'low'
    }));
  },
  toggleDrivingRover: () => {
    const state = get();
    if (!state.isDrivingRover) {
      if (state.exploration.survival.energyEU <= 0) {
        set({ explorationNotice: 'Remote rover control requires available energy.' });
        return;
      }
      const [x, , z] = state.playerPos;
      const region = getRegionByPosition(x, z);
      const nearest = WORLD_REGIONS.reduce((best, candidate) => {
        const distance = Math.hypot(x - candidate.baseConsole.x, z - candidate.baseConsole.z);
        return distance < best.distance ? { region: candidate, distance } : best;
      }, { region: WORLD_REGIONS[0], distance: Infinity });
      if (state.isGameOver || state.isVictory || !state.isPlayerGrounded ||
          state.isBackpackOpen || state.isManualOpen || state.activeScienceEntryId !== null || state.isClassroomOpen || state.isDatapadOpen || state.isBrownoutQuizOpen || state.isVictory || state.isGameOver ||
          (typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"]'))) ||
          region.id !== nearest.region.id || nearest.distance > 18) {
        soundEngine.playClick(400);
        return;
      }
      soundEngine.playClick(1400);
      const storedPose = state.regionalRoverPoses[nearest.region.id];
      set({
        isSimulating: true,
        isDrivingRover: true,
        remoteRegionId: nearest.region.id,
        roverPos: storedPose.position,
        roverHeading: storedPose.heading,
        roverSpeed: 0,
        joystickVector: { x: 0, y: 0 },
        isMouseDriving: false,
        isPointerLocked: false
      });
      if (typeof document !== 'undefined' && document.pointerLockElement && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock();
      }
    } else {
      soundEngine.playClick(1100);
      const remoteRegionId = state.remoteRegionId;
      const regionalRoverPoses = remoteRegionId ? {
        ...state.regionalRoverPoses,
        [remoteRegionId]: { position: state.roverPos, heading: state.roverHeading }
      } : state.regionalRoverPoses;
      set({
        isDrivingRover: false,
        remoteRegionId: null,
        regionalRoverPoses,
        isMouseDriving: false,
        joystickVector: { x: 0, y: 0 },
        roverSpeed: 0,
        isPointerLocked: false
      });
      if (typeof document !== 'undefined' && document.pointerLockElement && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock();
      }
    }
  },
  setRoverPos: (pos: [number, number, number]) => {
    const state = get();
    if (!pos.every(Number.isFinite) || pos.some((value) => Math.abs(value) > 300)) return;
    set({ roverPos: pos });
    if (state.isDrivingRover && state.remoteRegionId) set((current) => ({
      regionalRoverPoses: { ...current.regionalRoverPoses, [state.remoteRegionId!]: { position: pos, heading: state.roverHeading } }
    }));
  },
  publishRoverState: (pose, speed) => {
    if (
      !pose || typeof pose !== 'object' ||
      ![pose.x, pose.y, pose.z, pose.heading, speed].every(Number.isFinite) ||
      Math.abs(pose.x) > WORLD_BOUNDS.maxX ||
      Math.abs(pose.z) > WORLD_BOUNDS.maxZ ||
      Math.abs(pose.y) > 100 || Math.abs(pose.heading) > Math.PI || speed < -3 || speed > 5
    ) return;
    const state = get();
    if (!state.isDrivingRover || !state.remoteRegionId) return;
    const actualRegion = getRegionByPosition(pose.x, pose.z);
    const region = WORLD_REGIONS.find(({ id }) => id === state.remoteRegionId);
    if (!region || actualRegion.id !== state.remoteRegionId ||
        Math.hypot(pose.x - region.center.x, pose.z - region.center.z) > 75) return;
    const roverPos: [number, number, number] = [pose.x, pose.y, pose.z];
    const regionalRoverPoses = {
      ...state.regionalRoverPoses,
      [state.remoteRegionId]: { position: roverPos, heading: pose.heading }
    };
    set({ roverPos, roverHeading: pose.heading, roverSpeed: speed, regionalRoverPoses });
  },
  toggleSkyView: () => {
    soundEngine.playClick(900);
    set((state) => ({ isSkyViewActive: !state.isSkyViewActive }));
  },
  cameraYaw: 0,
  isMouseDriving: false,
  setCameraYaw: (yaw: number) => set({ cameraYaw: yaw }),
  setIsMouseDriving: (driving: boolean) => set({ isMouseDriving: driving }),

  // Story Engine Specimen Refining Actions
  addWater: (canisters = 1) => {
    const countToAdd = Math.max(1, Math.round(canisters >= 25 ? canisters / 25 : canisters));
    set((state) => ({
      inventory: {
        ...state.inventory,
        water_canister: (state.inventory['water_canister'] || 0) + countToAdd
      }
    }));
  },
  restoreFullOxygen: () => {
    set({ oxygen: 20.9 });
  },

  // Brownout STEM Quiz Implementation (Phase 15)
  isBrownoutQuizOpen: false,
  hasUsedBrownoutQuiz: false,
  openBrownoutQuiz: () => {
    soundEngine.playAlarm();
    set({ isBrownoutQuizOpen: true, isSimulating: false });
  },
  closeBrownoutQuiz: () => {
    soundEngine.playFailureTone();
    set({
      isBrownoutQuizOpen: false,
      isGameOver: true,
      failureReason: 'Brownout emergency: Backup power initialization failed!'
    });
  },
  handleBrownoutQuizSuccess: () => {
    soundEngine.playSuccessChime();
    const cap = Math.max(0.001, get().batteryCapacityKwh);
    set((state) => {
      const nextKwh = Math.min(cap, state.batteryKwh + cap * 0.2);
      const nextPct = Math.max(0, Math.min(100, (nextKwh / cap) * 100));
      return {
        batteryKwh: nextKwh,
        battery: nextPct,
        isBrownoutQuizOpen: false,
        isSimulating: true
      };
    });
  },

  // Ares Cradle Optimization (v3.0)
  isFlashlightOn: true,
  toggleFlashlight: () => {
    soundEngine.playClick(1200);
    set((state) => ({ isFlashlightOn: !state.isFlashlightOn }));
  },
  isDatapadOpen: false,
  toggleDatapad: () => {
    soundEngine.playClick(900);
    set((state) => ({ isDatapadOpen: !state.isDatapadOpen }));
  },
  openDatapad: () => {
    soundEngine.playClick(900);
    set({ isDatapadOpen: true });
  },
  closeDatapad: () => {
    soundEngine.playClick(650);
    set({ isDatapadOpen: false });
  },
  isStormShutterClosed: false,
  toggleStormShutter: () => {
    soundEngine.playClick(800);
    set((state) => ({ isStormShutterClosed: !state.isStormShutterClosed }));
  },
  setStormShutter: (closed: boolean) => set({ isStormShutterClosed: closed }),
  isRoverDocked: false,
  setIsRoverDocked: (docked: boolean) => set({ isRoverDocked: docked }),

  // 4-Phase Sortie & Visual Evolution (v3.2)
  domeEvolutionLevel: 1,
  roverUpgradeLevel: 1,
  currentSortiePhase: 'briefing',
  setDomeEvolutionLevel: (lvl: number) => set({ domeEvolutionLevel: lvl }),
  setRoverUpgradeLevel: (lvl: number) => set({ roverUpgradeLevel: lvl }),
  setSortiePhase: (phase: 'briefing' | 'field' | 'return' | 'lab') => set({ currentSortiePhase: phase }),

  toggleMute: () => {
    const isNowMuted = soundEngine.toggleMute();
    set({ isMuted: isNowMuted });
  },

  setPowerAllocation: (oxygen: number, heaters: number) => {
    const clampedO2 = Math.max(0, Math.min(100, oxygen));
    const clampedHeat = Math.max(0, Math.min(100, heaters));
    soundEngine.playClick(850);
    set({
      powerPriorityOxygen: clampedO2,
      powerPriorityHeaters: clampedHeat
    });
  },

  // Backwards compatibility alias
  setPowerPriorities: (oxygen: number, heaters: number) => {
    get().setPowerAllocation(oxygen, heaters);
  },

  toggleEmergencySaver: () => {
    soundEngine.playClick(620);
    set((state) => ({ emergencyPowerSaver: !state.emergencyPowerSaver }));
  },

  cleanDust: (amount?: number | unknown) => {
    const state = get();
    if (state.dustCoverage <= 0.01) {
      soundEngine.playClick(500);
      return;
    }
    const dec = typeof amount === 'number' ? amount : 0.25;
    soundEngine.playClick(1200);
    const newDust = Math.max(0, state.dustCoverage - dec);
    set({ dustCoverage: newDust });
    if (newDust < 0.15) {
      useStoryStore.getState().completeObjective('sol1-wipe-panels');
      useStoryStore.getState().completeObjective('obj-dust-1');
      useStoryStore.getState().completeObjective('obj-wipe-sol1');
    }
  },

  setStage: async (stageId: number) => {
    try {
      const config = await missionService.getStageConfig(stageId);
      soundEngine.playClick(1100);
      set({
        activeStageId: stageId,
        stageConfig: config,
        currentSol: config.sol,
        solTime: 0.0,
        solPhase: 'Morning',
        batteryKwh: config.initialBatteryKwh,
        batteryCapacityKwh: config.batteryCapacityKwh,
        battery: (config.initialBatteryKwh / config.batteryCapacityKwh) * 100,
        oxygen: config.initialOxygenPercent,
        temperature: config.initialTemperatureCelsius,
        dustCoverage: config.initialDustCoverage,
        activeEvents: JSON.parse(JSON.stringify(config.events)),
        isSimulating: true,
        isGameOver: false,
        isVictory: false,
        failureReason: null,
        debriefReport: null,
        activeWarnings: [],
        isBrownoutQuizOpen: false,
        hasUsedBrownoutQuiz: false
      });
      soundEngine.startPowerHum();
    } catch (err) {
      console.error(`Failed to load stage ${stageId}:`, err);
    }
  },

  resetCurrentStage: () => {
    const { activeStageId } = get();
    get().setStage(activeStageId);
  },

  startSimulation: () => {
    soundEngine.startPowerHum();
    set({ isSimulating: true });
  },
  pauseSimulation: () => {
    soundEngine.stopPowerHum();
    set({ isSimulating: false });
  },

  tick: (deltaSeconds = 0.1) => {
    const state = get();
    if (!state.isSimulating || state.isGameOver || state.isVictory) return;
    const paused = state.isBackpackOpen || state.isDatapadOpen || state.isClassroomOpen || state.isBrownoutQuizOpen ||
      state.isManualOpen || state.activeScienceEntryId !== null ||
      (typeof document !== 'undefined' && (document.hidden || Boolean(document.querySelector('[role="dialog"]'))));
    if (paused) return;
    const safeDelta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds ?? 0, 1)) : 0;
    const result = tickExplorationProgress(state.exploration, safeDelta);
    if (result !== state.exploration) {
      const nextSolTime = (state.solTime + safeDelta / 90) % 60;
      const nextSolPhase = state.solPhase;
      const shouldPersist = result.activeSeconds - lastExplorationPersistSeconds >= 5;
      if (shouldPersist) {
        const persisted = persistExploration(result);
        set({ exploration: result, explorationWarning: persisted.warning, explorationPersistenceBlocked: persisted.blocked,
          solTime: nextSolTime, solPhase: nextSolPhase });
      } else set({ exploration: result, solTime: nextSolTime, solPhase: nextSolPhase });
      if (result.survival.energyEU <= 0 && state.isDrivingRover) {
        get().toggleDrivingRover();
        set({ explorationNotice: 'Remote rover control ended because available energy was depleted.' });
      }
      for (const resource of ['air', 'meals'] as const) {
        if (result.survival[resource] > 0) shownDepletionNotices.delete(resource);
      }
      const depletion = (['air', 'meals'] as const).find((resource) =>
        result.survival[resource] <= 0 && !shownDepletionNotices.has(resource)
      );
      if (depletion && !get().explorationNotice) {
        shownDepletionNotices.add(depletion);
        set({ explorationNotice: depletion === 'air'
          ? 'Air reserve depleted. Use an air canister in your backpack; sprint is unavailable.'
          : 'Food reserve depleted. Use a space apple in your backpack; sprint is unavailable.' });
      }
    }
  },

  // Backwards compatibility alias
  tickTelemetry: (delta: number) => {
    get().tick(delta);
  }
  };
});

if (typeof window !== 'undefined') {
  (window as unknown as { __outpostStore: typeof useOutpostStore }).__outpostStore = useOutpostStore;
}
