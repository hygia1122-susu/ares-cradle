/**
 * Ares Cradle - Reactive Outpost Store (Zustand)
 * Drives 3D Canvas, Tactile HUD, and Game Simulation Loop.
 */

import { create } from 'zustand';
import {
  ResourceState,
  PowerAllocationState,
  SolPhase,
  StageConfig,
  GameEvent,
  DebriefReport
} from '@/modules/simulation-engine/types';
import {
  calculateSimulationStep,
  calculateDebriefReport,
  determineSolPhase,
  SIM_CONSTANTS
} from '@/modules/simulation-engine/formulas';
import { missionService } from '@/services/api';
import { STAGES_FIXTURES } from '@/services/api/MockMissionService';
import { soundEngine } from '@/modules/audio/soundEngine';
import { MarsWeatherTelemetry, fetchMarsWeather } from '@/modules/story-engine/services/marsWeatherService';
import { useStoryStore } from './useStoryStore';
import { buildWorldColliders, isOverColliderFootprint, PHYSICS_CONSTANTS } from '@/modules/character/physicsEngine';
import { sampleWorldGround, WORLD_BOUNDS } from '@/modules/outpost-3d/worldRegions';

export const PLAYABLE_ROVER_SPEC = {
  scale: 0.7,
  radius: 1.55,
  wheelbase: 1.7,
  trackWidth: 1.6,
  groundOffset: 0
} as const;

function findSafeRoverDismount(
  roverPos: [number, number, number],
  heading: number
): [number, number, number] | null {
  const clearance = PLAYABLE_ROVER_SPEC.radius + 0.65;
  const directions: Array<[number, number]> = [
    [-Math.cos(heading), Math.sin(heading)],
    [Math.cos(heading), -Math.sin(heading)],
    [-Math.sin(heading), -Math.cos(heading)],
    [Math.sin(heading), Math.cos(heading)]
  ];
  const colliders = buildWorldColliders(roverPos, true);

  for (const [dx, dz] of directions) {
    const x = roverPos[0] + dx * clearance;
    const z = roverPos[2] + dz * clearance;
    if (
      x < WORLD_BOUNDS.minX + PLAYABLE_ROVER_SPEC.radius ||
      x > WORLD_BOUNDS.maxX - PLAYABLE_ROVER_SPEC.radius ||
      z < WORLD_BOUNDS.minZ + PLAYABLE_ROVER_SPEC.radius ||
      z > WORLD_BOUNDS.maxZ - PLAYABLE_ROVER_SPEC.radius ||
      Math.hypot(x - roverPos[0], z - roverPos[2]) < clearance
    ) continue;
    if (colliders.some((collider) =>
      sampleWorldGround(x, z) < collider.topY - PHYSICS_CONSTANTS.STEP_UP_TOLERANCE &&
      isOverColliderFootprint(x, z, collider, PHYSICS_CONSTANTS.PLAYER_RADIUS)
    )) continue;

    const y = sampleWorldGround(x, z);
    const slope = Math.max(
      Math.abs(sampleWorldGround(x + PHYSICS_CONSTANTS.PLAYER_RADIUS, z) - y),
      Math.abs(sampleWorldGround(x - PHYSICS_CONSTANTS.PLAYER_RADIUS, z) - y),
      Math.abs(sampleWorldGround(x, z + PHYSICS_CONSTANTS.PLAYER_RADIUS) - y),
      Math.abs(sampleWorldGround(x, z - PHYSICS_CONSTANTS.PLAYER_RADIUS) - y)
    ) / PHYSICS_CONSTANTS.PLAYER_RADIUS;
    if (slope > 0.35) continue;
    return [x, y, z];
  }
  return null;
}

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
  debriefReport: DebriefReport | null;
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

export const useOutpostStore = create<OutpostStoreState>((set, get) => ({
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
    sonic_wiper: 3,
    space_tape: 2,
    backup_battery: 1,
    space_apple: 2,
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
  roverPos: [3.8, -0.32, -2.2],
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
    const { isDrivingRover, playerPos, roverPos, roverHeading } = get();
    if (!isDrivingRover) {
      // Proximity check (< 2.5m) to board
      const dist = Math.hypot(playerPos[0] - roverPos[0], playerPos[2] - roverPos[2]);
      if (dist > 2.5) {
        soundEngine.playClick(400);
        return;
      }
      soundEngine.playClick(1400);
      set({ isDrivingRover: true });
    } else {
      const dismountPos = findSafeRoverDismount(roverPos, roverHeading);
      if (!dismountPos) {
        soundEngine.playClick(400);
        return;
      }
      soundEngine.playClick(1100);
      set({
        isDrivingRover: false,
        playerPos: dismountPos,
        isMouseDriving: false,
        joystickVector: { x: 0, y: 0 },
        roverSpeed: 0
      });
    }
  },
  setRoverPos: (pos: [number, number, number]) => set({ roverPos: pos }),
  publishRoverState: (pose, speed) => {
    if (
      !pose || typeof pose !== 'object' ||
      ![pose.x, pose.y, pose.z, pose.heading, speed].every(Number.isFinite) ||
      Math.abs(pose.x) > WORLD_BOUNDS.maxX ||
      Math.abs(pose.z) > WORLD_BOUNDS.maxZ ||
      Math.abs(pose.y) > 100 || Math.abs(pose.heading) > Math.PI || Math.abs(speed) > 5
    ) return;
    if (!get().isDrivingRover) return;
    const roverPos: [number, number, number] = [pose.x, pose.y, pose.z];
    set({
      roverPos,
      playerPos: roverPos,
      roverHeading: pose.heading,
      roverSpeed: speed,
      isInsideHabitat: Math.hypot(pose.x, pose.z) < 3.6
    });
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

    // Unified Modal Pause Gate (Prompt 1 Section 7 & Prompt 2 Section 6):
    // Pause simulation drain whenever the learner is reading a briefing, science card, lab, or inventory dialog.
    const storyModalState = useStoryStore.getState();
    const isModalPausingSim =
      state.isBackpackOpen ||
      state.isDatapadOpen ||
      state.isClassroomOpen ||
      state.isBrownoutQuizOpen ||
      storyModalState.isBriefingOpen ||
      storyModalState.isLabStationOpen ||
      storyModalState.isScienceCardOpen ||
      storyModalState.isChapterSelectOpen;

    if (isModalPausingSim) return;

    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    const nextSolTime = state.solTime + dt;
    const stageDuration = state.stageConfig.durationSeconds || SIM_CONSTANTS.SOL_DURATION_SECONDS;

    // 1. Update and check Game Events status based on solTime
    const updatedEvents = state.activeEvents.map((evt) => {
      const shouldBeActive =
        nextSolTime >= evt.triggerSolTime &&
        nextSolTime < evt.triggerSolTime + evt.durationSeconds;
      const isResolved = nextSolTime >= evt.triggerSolTime + evt.durationSeconds;

      return {
        ...evt,
        active: shouldBeActive,
        resolved: isResolved
      };
    });

    // Sound alert trigger when an event begins
    const hasNewlyActivatedEvent = updatedEvents.some(
      (e) => e.active && !state.activeEvents.find((prev) => prev.id === e.id)?.active
    );
    if (hasNewlyActivatedEvent) {
      soundEngine.playAlarm();
    }

    // 2. Prepare Resource and Allocation objects for simulation step
    const currentResourceState: ResourceState = {
      solarKw: state.solarIntake,
      batteryKwh: state.batteryKwh,
      batteryCapacityKwh: state.batteryCapacityKwh,
      batteryPercent: state.battery,
      oxygenPercent: state.oxygen,
      temperatureCelsius: state.temperature,
      dustCoverage: state.dustCoverage,
      netPowerKw: state.netPower
    };

    const powerAllocations: PowerAllocationState = {
      powerPriorityOxygen: state.powerPriorityOxygen,
      powerPriorityHeaters: state.powerPriorityHeaters,
      emergencySaverActive: state.emergencyPowerSaver
    };

    // 3. Compute simulation step
    const stepResult = calculateSimulationStep({
      currentState: currentResourceState,
      allocations: powerAllocations,
      solTime: nextSolTime,
      baseSolarMaxKw: state.stageConfig.baseSolarMaxKw,
      habBaseLoadKw: state.stageConfig.habBaseLoadKw,
      controllablePowerKw: state.stageConfig.controllablePowerKw,
      ambientTemperatureCelsius: state.stageConfig.ambientTemperatureCelsius,
      activeEvents: updatedEvents,
      deltaSeconds: dt
    });

    const { nextState, warnings } = stepResult;

    // Interior Habitat Sanctuary: Replenish Oxygen & Thermal Balance (architecture.md 3.2)
    if (state.isInsideHabitat) {
      nextState.oxygenPercent = Math.min(20.9, nextState.oxygenPercent + dt * 0.8);
      nextState.temperatureCelsius = Math.min(20.0, nextState.temperatureCelsius + dt * 1.2);
    }

    // Auto Eco-Power Mode during Exploration Expeditions (> 14m from base)
    const isOutOnExpedition = Math.hypot(state.playerPos[0], state.playerPos[2]) > 14;
    if (isOutOnExpedition) {
      // Base non-essential power drain is safely throttled to prevent brownout collapses
      nextState.batteryPercent = Math.max(22.0, nextState.batteryPercent);
      nextState.temperatureCelsius = Math.max(12.0, nextState.temperatureCelsius);
      nextState.oxygenPercent = Math.max(20.0, nextState.oxygenPercent);
    }

    const nextPhase = determineSolPhase(nextSolTime);

    // 4. Evaluate Critical Failure conditions
    let isGameOver = false;
    let failureReason: string | null = null;

    if (nextState.oxygenPercent < 15.0) {
      isGameOver = true;
      failureReason = 'Hypoxia alert: Habitat oxygen dropped below lethal threshold (15%)!';
    } else if (nextState.temperatureCelsius < -30.0) {
      isGameOver = true;
      failureReason = 'Freezing emergency: Habitat heaters failed to prevent deep freeze (-30°C)!';
    } else if (nextState.batteryPercent <= 0 && nextPhase === 'Night') {
      // Extended brownout in freezing dark
      if (nextState.temperatureCelsius < 0 && !isOutOnExpedition) {
        // Emergency Space Quiz intervention before terminal failure
        if (!state.hasUsedBrownoutQuiz) {
          soundEngine.playAlarm();
          soundEngine.stopPowerHum();
          set({
            isSimulating: false,
            isBrownoutQuizOpen: true,
            hasUsedBrownoutQuiz: true,
            battery: 0,
            batteryKwh: 0
          });
          return;
        }
        isGameOver = true;
        failureReason = 'Total outpost brownout during the frigid Martian night!';
      }
    }

    // 5. Objective-Driven Stage Victory:
    // Only triggers when cadet has completed all current Sol objectives AND safely returned to base!
    let isVictory = false;
    let debriefReport: DebriefReport | null = null;

    const isAtBase = Math.hypot(state.playerPos[0], state.playerPos[2]) < 7.0;
    const currentStoryChapter = useStoryStore.getState().getCurrentChapter();

    // Auto-complete return-to-base objective when cadet safely reaches habitat airlock
    const returnObj = currentStoryChapter.objectives.find(
      (o: any) => o.id.includes('return-base') && !o.completed
    );
    if (returnObj && isAtBase) {
      const otherCompleted = currentStoryChapter.objectives
        .filter((o: any) => o.id !== returnObj.id)
        .every((o: any) => o.completed);
      if (otherCompleted) {
        useStoryStore.getState().completeObjective(returnObj.id);
      }
    }

    const allObjectivesCompleted =
      currentStoryChapter.objectives.length > 0 &&
      currentStoryChapter.objectives.every((o: any) => o.completed);

    if (!isGameOver && allObjectivesCompleted && isAtBase && !state.isVictory) {
      isVictory = true;
      soundEngine.playSuccessChime();
      soundEngine.stopPowerHum();
      const nextEvolutionLevel = Math.max(state.domeEvolutionLevel, (currentStoryChapter.chapterNumber || 1) + 1);
      set({
        domeEvolutionLevel: nextEvolutionLevel,
        roverUpgradeLevel: nextEvolutionLevel,
        currentSortiePhase: 'lab'
      });
      get().triggerCelebration(
        `SOL ${state.stageConfig.sol} ACCOMPLISHED!`,
        `Base & Rover upgraded! All mission objectives completed and specimens safely delivered.`,
        3
      );
      const debriefMath = calculateDebriefReport(
        state.activeStageId,
        state.stageConfig.title,
        nextState,
        state.stageConfig.sol,
        true
      );
      debriefReport = {
        stageId: state.activeStageId,
        stageTitle: state.stageConfig.title,
        success: true,
        score: debriefMath.score,
        survivedSols: state.stageConfig.sol,
        finalBatteryPercent: nextState.batteryPercent,
        finalOxygenPercent: nextState.oxygenPercent,
        finalTemperatureCelsius: nextState.temperatureCelsius,
        tradeOffSummary: debriefMath.tradeOffSummary,
        educationalTakeaway: debriefMath.educationalTakeaway
      };
      missionService.submitStageResult(debriefReport);
    } else if (isGameOver) {
      soundEngine.playFailureTone();
      soundEngine.stopPowerHum();
      const debriefMath = calculateDebriefReport(
        state.activeStageId,
        state.stageConfig.title,
        nextState,
        state.stageConfig.sol,
        false,
        failureReason || undefined
      );
      debriefReport = {
        stageId: state.activeStageId,
        stageTitle: state.stageConfig.title,
        success: false,
        score: debriefMath.score,
        survivedSols: state.stageConfig.sol,
        finalBatteryPercent: nextState.batteryPercent,
        finalOxygenPercent: nextState.oxygenPercent,
        finalTemperatureCelsius: nextState.temperatureCelsius,
        tradeOffSummary: debriefMath.tradeOffSummary,
        educationalTakeaway: debriefMath.educationalTakeaway,
        failureReason: failureReason || undefined
      };
      missionService.submitStageResult(debriefReport);
    }

    // Update store state
    set({
      solTime: nextSolTime % stageDuration,
      solPhase: nextPhase,
      battery: nextState.batteryPercent,
      batteryKwh: nextState.batteryKwh,
      batteryCapacityKwh: nextState.batteryCapacityKwh,
      oxygen: nextState.oxygenPercent,
      temperature: nextState.temperatureCelsius,
      solarIntake: nextState.solarKw,
      dustCoverage: nextState.dustCoverage,
      netPower: nextState.netPowerKw,
      activeEvents: updatedEvents,
      activeWarnings: warnings,
      isGameOver,
      isVictory,
      failureReason,
      debriefReport
    });
  },

  // Backwards compatibility alias
  tickTelemetry: (delta: number) => {
    get().tick(delta);
  }
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __outpostStore: typeof useOutpostStore }).__outpostStore = useOutpostStore;
}
