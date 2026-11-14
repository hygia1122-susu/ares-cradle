import { create } from 'zustand';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import {
  RegionId,
  ResearchGoalId,
  SafetyCheckId,
  MiraStatus,
  BaseResources,
  BaseState,
  RegionSurveyState,
  INITIAL_BASE_RESOURCES,
  ESSENTIAL_SHIFT_COST,
  SECONDARY_JOB_COST,
  GO_ARRIVAL_THRESHOLD,
  TransactionRecord,
} from '../contract';

export type ActiveModal = 'map' | 'notebook' | 'base' | 'decision' | 'minigame' | 'recovery' | 'finale' | null;

interface MissionStoreState {
  // Campaign Metadata
  schemaVersion: number;
  campaignId: string;
  solDay: number;
  timeOfDay: string;

  // Active Context
  currentRegion: RegionId;
  supportBaseId: RegionId;
  activeControl: 'leo' | 'rover';
  solRelayActive: boolean;

  // World & Bases
  bases: Record<RegionId, BaseState>;
  surveys: Record<RegionId, RegionSurveyState>;
  completedReports: RegionId[];

  // Poses for Leo and rovers
  leoPose: [number, number, number];
  leoSavedReturnPose: [number, number, number];
  roverPoses: Record<RegionId, [number, number, number]>;

  // Finale & Readiness
  selectedGoal: ResearchGoalId | null;
  chosenArrivalBase: RegionId | null;
  miraStatus: MiraStatus;
  miraMessage: string | null;
  isTransmittingProposal: boolean;

  // Modals & Activities
  activeModal: ActiveModal;
  activeMinigameId: string | null;
  recentNotification: string | null;

  // Transactions Ledger
  transactions: TransactionRecord[];

  // Actions / Commands
  setModal: (modal: ActiveModal) => void;
  setNotification: (text: string | null) => void;
  setCurrentRegion: (regionId: RegionId) => void;
  setSupportBase: (baseId: RegionId) => void;
  setLeoPose: (pose: [number, number, number]) => void;
  setRoverPose: (regionId: RegionId, pose: [number, number, number]) => void;
  
  // Base Discovery & Travel
  discoverBase: (regionId: RegionId) => void;
  fastTravel: (regionId: RegionId) => boolean;

  // Actor Control
  enterRoverControl: () => void;
  exitRoverControl: () => void;
  toggleControl: () => void;

  // Science Observations & Perks
  recordObservation: (regionId: RegionId, pointId: string) => boolean;
  recordBranch: (regionId: RegionId, branchId: string, perkId: string) => boolean;

  // Shifts, Minigames & Engineering Jobs
  startShift: (regionId: RegionId) => boolean;
  completeMinigame: (regionId: RegionId) => void;
  selectSecondaryJob: (regionId: RegionId, jobId: string, jobDef: any) => boolean;
  completeRegionReport: (regionId: RegionId) => boolean;

  // Safety Checks & Logistics
  runSafetyCheck: (baseId: RegionId, checkId: SafetyCheckId) => void;
  transferCargo: (fromBase: RegionId, toBase: RegionId, resource: keyof BaseResources, amount: number) => boolean;
  requestRecoverySupport: (baseId: RegionId) => void;

  // Finale Review & Touchdown
  selectResearchGoal: (goalId: ResearchGoalId) => void;
  selectArrivalBase: (baseId: RegionId) => void;
  submitArrivalProposal: () => void;
  resetCampaign: () => void;
}

const REGION_COORDINATES: Record<RegionId, [number, number, number]> = {
  dust: [0, 0, 0],
  ice: [210, 0, -180],
  lake: [200, 0, 170],
};

const DEFAULT_ROVER_POSES: Record<RegionId, [number, number, number]> = {
  dust: [5, 0, 8],
  ice: [215, 0, -175],
  lake: [205, 0, 175],
};

const createInitialBases = (): Record<RegionId, BaseState> => ({
  dust: {
    id: 'dust',
    name: 'Wind Basin Central Outpost',
    isDiscovered: true, // Starting base
    resources: { ...INITIAL_BASE_RESOURCES },
    safetyChecks: { diagnostics: false, shelter: false, comms: false },
    sampleLayout: 'standard',
    panelsClean: false,
    thermalUpgrade: 'standard',
    coreAnalysis: 'none',
    waterCleaned: false,
    transmit: 'standard',
    roverInspection: 'none',
  },
  ice: {
    id: 'ice',
    name: 'Sealed Ice Cliff Facility',
    isDiscovered: false,
    resources: { ...INITIAL_BASE_RESOURCES },
    safetyChecks: { diagnostics: false, shelter: false, comms: false },
    sampleLayout: 'standard',
    panelsClean: false,
    thermalUpgrade: 'standard',
    coreAnalysis: 'none',
    waterCleaned: false,
    transmit: 'standard',
    roverInspection: 'none',
  },
  lake: {
    id: 'lake',
    name: 'Ancient Lake Shore Hub',
    isDiscovered: false,
    resources: { ...INITIAL_BASE_RESOURCES },
    safetyChecks: { diagnostics: false, shelter: false, comms: false },
    sampleLayout: 'standard',
    panelsClean: false,
    thermalUpgrade: 'standard',
    coreAnalysis: 'none',
    waterCleaned: false,
    transmit: 'standard',
    roverInspection: 'none',
  },
});

const createInitialSurveys = (): Record<RegionId, RegionSurveyState> => ({
  dust: {
    regionId: 'dust',
    supportBaseId: 'dust',
    focalPointsDone: [],
    optionalBranchesDone: [],
    unlockedPerkIds: [],
    essentialShiftPaid: false,
    minigameCompleted: false,
    secondaryJobSelected: null,
    secondaryJobDeferred: null,
    reportCompleted: false,
  },
  ice: {
    regionId: 'ice',
    supportBaseId: 'ice',
    focalPointsDone: [],
    optionalBranchesDone: [],
    unlockedPerkIds: [],
    essentialShiftPaid: false,
    minigameCompleted: false,
    secondaryJobSelected: null,
    secondaryJobDeferred: null,
    reportCompleted: false,
  },
  lake: {
    regionId: 'lake',
    supportBaseId: 'lake',
    focalPointsDone: [],
    optionalBranchesDone: [],
    unlockedPerkIds: [],
    essentialShiftPaid: false,
    minigameCompleted: false,
    secondaryJobSelected: null,
    secondaryJobDeferred: null,
    reportCompleted: false,
  },
});

const STORAGE_KEY = 'ares-cradle-mission-v2';

const loadSavedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion === 2) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load mission-v2 save:', e);
  }
  return null;
};

const saveState = (state: Partial<MissionStoreState>) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      schemaVersion: 2,
      campaignId: 'five-frontiers',
      solDay: state.solDay,
      timeOfDay: state.timeOfDay,
      currentRegion: state.currentRegion,
      supportBaseId: state.supportBaseId,
      bases: state.bases,
      surveys: state.surveys,
      completedReports: state.completedReports,
      selectedGoal: state.selectedGoal,
      chosenArrivalBase: state.chosenArrivalBase,
      miraStatus: state.miraStatus,
      transactions: state.transactions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to commit mission-v2 save:', e);
  }
};

export const useMissionStore = create<MissionStoreState>((set, get) => {
  const saved = loadSavedState();

  const initialState = {
    schemaVersion: 2,
    campaignId: 'five-frontiers',
    solDay: saved?.solDay || 1,
    timeOfDay: saved?.timeOfDay || '14:20 MTC',
    currentRegion: (saved?.currentRegion as RegionId) || 'dust',
    supportBaseId: (saved?.supportBaseId as RegionId) || 'dust',
    activeControl: 'leo' as const,
    solRelayActive: false,
    bases: saved?.bases || createInitialBases(),
    surveys: saved?.surveys || createInitialSurveys(),
    completedReports: saved?.completedReports || [],
    leoPose: [0, 0, 5] as [number, number, number],
    leoSavedReturnPose: [0, 0, 5] as [number, number, number],
    roverPoses: DEFAULT_ROVER_POSES,
    selectedGoal: saved?.selectedGoal || null,
    chosenArrivalBase: saved?.chosenArrivalBase || null,
    miraStatus: (saved?.miraStatus as MiraStatus) || 'idle',
    miraMessage: null,
    isTransmittingProposal: false,
    activeModal: null,
    activeMinigameId: null,
    recentNotification: 'Touchdown confirmed at Wind Basin Outpost. 3 regions await survey.',
    transactions: saved?.transactions || [],
  };

  return {
    ...initialState,

    setModal: (modal) => set({ activeModal: modal }),
    setNotification: (text) => set({ recentNotification: text }),
    setCurrentRegion: (regionId) => set({ currentRegion: regionId }),
    setSupportBase: (baseId) => set({ supportBaseId: baseId }),
    setLeoPose: (pose) => set({ leoPose: pose }),
    setRoverPose: (regionId, pose) => set((state) => ({
      roverPoses: { ...state.roverPoses, [regionId]: pose },
    })),

    discoverBase: (regionId) => {
      const state = get();
      if (state.bases[regionId].isDiscovered) return;
      const updatedBases = {
        ...state.bases,
        [regionId]: { ...state.bases[regionId], isDiscovered: true },
      };
      set({
        bases: updatedBases,
        recentNotification: `New Outpost Discovered: ${state.bases[regionId].name}! Checkpoint & Fast Travel unlocked.`,
      });
      saveState({ bases: updatedBases });
    },

    fastTravel: (regionId) => {
      const state = get();
      if (!state.bases[regionId].isDiscovered) {
        set({ recentNotification: `Fast Travel unavailable: ${regionId} outpost has not been reached on foot yet.` });
        return false;
      }

      // Exit rover if currently driving
      const baseCoords = REGION_COORDINATES[regionId];
      const targetPose: [number, number, number] = [baseCoords[0], baseCoords[1], baseCoords[2] + 4];

      useOutpostStore.getState().setIsDrivingRover(false);
      useOutpostStore.getState().setPlayerPos(targetPose);
      useOutpostStore.getState().setRoverPos([targetPose[0] + 3.5, -0.32, targetPose[2] + 1.5]);

      set({
        currentRegion: regionId,
        activeControl: 'leo',
        solRelayActive: false,
        leoPose: targetPose,
        leoSavedReturnPose: targetPose,
        activeModal: null,
        recentNotification: `Relocated to ${state.bases[regionId].name}.`,
      });
      saveState(get());
      return true;
    },

    enterRoverControl: () => {
      const state = get();
      const currentReg = state.currentRegion;
      useOutpostStore.getState().setIsDrivingRover(true);
      set({
        activeControl: 'rover',
        solRelayActive: true,
        leoSavedReturnPose: [...state.leoPose],
        recentNotification: `Sol Relay linked to ${currentReg} rover. Direct exploration engaged.`,
      });
    },

    exitRoverControl: () => {
      const state = get();
      useOutpostStore.getState().setIsDrivingRover(false);
      useOutpostStore.getState().setPlayerPos(state.leoSavedReturnPose);
      set({
        activeControl: 'leo',
        solRelayActive: false,
        leoPose: [...state.leoSavedReturnPose],
        recentNotification: `Returned control to Cadet Leo at saved coordinates.`,
      });
    },

    toggleControl: () => {
      const state = get();
      if (state.activeControl === 'leo') {
        state.enterRoverControl();
      } else {
        state.exitRoverControl();
      }
    },

    recordObservation: (regionId, pointId) => {
      const state = get();
      const survey = state.surveys[regionId];
      if (survey.focalPointsDone.includes(pointId)) return false;

      const newFocal = [...survey.focalPointsDone, pointId];
      const updatedSurveys = {
        ...state.surveys,
        [regionId]: { ...survey, focalPointsDone: newFocal },
      };

      let notice = `Observation logged: [${pointId}] secured.`;
      if (newFocal.length >= 2 && !survey.minigameCompleted) {
        notice += ` Sufficient evidence collected (>=2). Science activity unlocked!`;
      }

      set({ surveys: updatedSurveys, recentNotification: notice });
      saveState({ surveys: updatedSurveys });
      return true;
    },

    recordBranch: (regionId, branchId, perkId) => {
      const state = get();
      const survey = state.surveys[regionId];
      if (survey.optionalBranchesDone.includes(branchId)) return false;

      const newBranches = [...survey.optionalBranchesDone, branchId];
      const newPerks = [...survey.unlockedPerkIds, perkId];

      const updatedSurveys = {
        ...state.surveys,
        [regionId]: {
          ...survey,
          optionalBranchesDone: newBranches,
          unlockedPerkIds: newPerks,
        },
      };

      set({
        surveys: updatedSurveys,
        recentNotification: `Exploration Branch [${branchId}] mapped! Unlocked scientific advantage: ${perkId}.`,
      });
      saveState({ surveys: updatedSurveys });
      return true;
    },

    startShift: (regionId) => {
      const state = get();
      const survey = state.surveys[regionId];
      if (survey.essentialShiftPaid) return true; // Already paid

      const supportBase = state.bases[survey.supportBaseId];
      const cost = ESSENTIAL_SHIFT_COST;

      // Check invariant I09
      if (
        supportBase.resources.energy < cost.energy ||
        supportBase.resources.meals < cost.meals ||
        supportBase.resources.water < cost.water ||
        supportBase.resources.airPacks < cost.airPacks
      ) {
        set({
          activeModal: 'recovery',
          recentNotification: `Insufficient resources at ${supportBase.name} to start shift! Emergency recovery required.`,
        });
        return false;
      }

      // Deduct atomically
      const updatedResources: BaseResources = {
        energy: supportBase.resources.energy - cost.energy,
        meals: supportBase.resources.meals - cost.meals,
        water: supportBase.resources.water - cost.water,
        airPacks: supportBase.resources.airPacks - cost.airPacks,
      };

      const updatedBases = {
        ...state.bases,
        [survey.supportBaseId]: {
          ...supportBase,
          resources: updatedResources,
        },
      };

      const updatedSurveys = {
        ...state.surveys,
        [regionId]: { ...survey, essentialShiftPaid: true },
      };

      const tx: TransactionRecord = {
        id: `tx-shift-${regionId}-${Date.now()}`,
        timestamp: Date.now(),
        regionId,
        supportBaseId: survey.supportBaseId,
        action: 'ESSENTIAL_SHIFT',
        cost,
        details: `Essential shift pack paid (-2 EU, -1 Meal, -1 Water, -1 Air).`,
      };

      set({
        bases: updatedBases,
        surveys: updatedSurveys,
        transactions: [tx, ...state.transactions],
        recentNotification: `Essential shift committed. Operations running on ${supportBase.name} reserves.`,
      });

      saveState({ bases: updatedBases, surveys: updatedSurveys });
      return true;
    },

    completeMinigame: (regionId) => {
      const state = get();
      const survey = state.surveys[regionId];
      if (survey.minigameCompleted) return;

      const updatedSurveys = {
        ...state.surveys,
        [regionId]: { ...survey, minigameCompleted: true },
      };

      set({
        surveys: updatedSurveys,
        activeModal: 'decision', // Seamlessly transition to the secondary engineering choice!
        recentNotification: `Scientific activity completed! Priority engineering decision required.`,
      });

      saveState({ surveys: updatedSurveys });
    },

    selectSecondaryJob: (regionId, jobId, jobDef) => {
      const state = get();
      const survey = state.surveys[regionId];
      if (survey.secondaryJobSelected) return false;

      const supportBase = state.bases[survey.supportBaseId];
      const cost = SECONDARY_JOB_COST;

      if (supportBase.resources.energy < cost.energy) {
        set({
          activeModal: 'recovery',
          recentNotification: `Insufficient energy (need 2 EU) at ${supportBase.name} to execute secondary engineering job!`,
        });
        return false;
      }

      // Determine deferred job
      const otherJobId = jobId.endsWith('clean') ? jobId.replace('clean', 'water') :
                        jobId.endsWith('water') ? jobId.replace('water', 'clean') :
                        jobId.endsWith('protect') ? jobId.replace('protect', 'access') :
                        jobId.endsWith('access') ? jobId.replace('access', 'protect') :
                        jobId.endsWith('passive') ? jobId.replace('passive', 'active') :
                        jobId.endsWith('active') ? jobId.replace('active', 'passive') :
                        jobId.endsWith('scan') ? jobId.replace('scan', 'water') :
                        jobId.endsWith('water') ? jobId.replace('water', 'scan') :
                        jobId.endsWith('summary') ? jobId.replace('summary', 'full') :
                        jobId.replace('full', 'summary');

      // Update resources
      let energyChange = -cost.energy;
      let waterChange = 0;
      if (jobDef.energyBonus) energyChange += jobDef.energyBonus;
      if (jobDef.waterBonus) waterChange += jobDef.waterBonus;

      const updatedResources: BaseResources = {
        ...supportBase.resources,
        energy: supportBase.resources.energy + energyChange,
        water: supportBase.resources.water + waterChange,
      };

      // Base visual upgrade
      const baseUpgrades: Partial<BaseState> = {};
      if (jobDef.outputKey) {
        (baseUpgrades as any)[jobDef.outputKey] = jobDef.outputValue;
      }

      const updatedBases = {
        ...state.bases,
        [survey.supportBaseId]: {
          ...supportBase,
          ...baseUpgrades,
          resources: updatedResources,
        },
      };

      const updatedSurveys = {
        ...state.surveys,
        [regionId]: {
          ...survey,
          secondaryJobSelected: jobId,
          secondaryJobDeferred: otherJobId,
        },
      };

      const tx: TransactionRecord = {
        id: `tx-job-${jobId}-${Date.now()}`,
        timestamp: Date.now(),
        regionId,
        supportBaseId: survey.supportBaseId,
        action: 'SECONDARY_JOB',
        cost,
        yieldResources: { energy: jobDef.energyBonus || 0, water: jobDef.waterBonus || 0 },
        details: `Executed [${jobDef.title}]. Other option marked Deferred.`,
      };

      set({
        bases: updatedBases,
        surveys: updatedSurveys,
        transactions: [tx, ...state.transactions],
        activeModal: null,
        recentNotification: `Engineering job [${jobDef.title}] committed. Operational consequences applied.`,
      });

      // Automatically check if region report is ready
      get().completeRegionReport(regionId);
      saveState({ bases: updatedBases, surveys: updatedSurveys });
      return true;
    },

    completeRegionReport: (regionId) => {
      const state = get();
      const survey = state.surveys[regionId];

      if (survey.focalPointsDone.length >= 2 && survey.minigameCompleted && survey.secondaryJobSelected) {
        if (!state.completedReports.includes(regionId)) {
          const newReports = [...state.completedReports, regionId];
          const updatedSurveys = {
            ...state.surveys,
            [regionId]: { ...survey, reportCompleted: true },
          };

          set({
            completedReports: newReports,
            surveys: updatedSurveys,
            recentNotification: `🌟 REGION REPORT COMPLETE: ${regionId.toUpperCase()}! (${newReports.length}/3 regions completed).`,
          });

          if (newReports.length === 3) {
            set({
              activeModal: 'finale',
              recentNotification: `🚀 ALL 3 REGION REPORTS SUBMITTED! Base Arrival & Ares-1 Landing Review unlocked!`,
            });
          }

          saveState({ completedReports: newReports, surveys: updatedSurveys });
          return true;
        }
      }
      return false;
    },

    runSafetyCheck: (baseId, checkId) => {
      const state = get();
      const base = state.bases[baseId];
      const updatedChecks = { ...base.safetyChecks, [checkId]: true };
      const updatedBases = {
        ...state.bases,
        [baseId]: { ...base, safetyChecks: updatedChecks },
      };

      set({
        bases: updatedBases,
        recentNotification: `Safety check verified: [${checkId.toUpperCase()}] passed at ${base.name}.`,
      });
      saveState({ bases: updatedBases });
    },

    transferCargo: (fromBase, toBase, resource, amount) => {
      const state = get();
      if (fromBase === toBase || amount <= 0) return false;

      const src = state.bases[fromBase];
      const dst = state.bases[toBase];

      if (src.resources[resource] < amount) {
        set({ recentNotification: `Transfer failed: Insufficient ${resource} at ${src.name}.` });
        return false;
      }

      // Check that source base doesn't fall below GO threshold if it is intended for Ares-1
      const updatedSrcResources = {
        ...src.resources,
        [resource]: src.resources[resource] - amount,
      };
      const updatedDstResources = {
        ...dst.resources,
        [resource]: dst.resources[resource] + amount,
      };

      const updatedBases = {
        ...state.bases,
        [fromBase]: { ...src, resources: updatedSrcResources },
        [toBase]: { ...dst, resources: updatedDstResources },
      };

      const tx: TransactionRecord = {
        id: `tx-cargo-${Date.now()}`,
        timestamp: Date.now(),
        regionId: state.currentRegion,
        supportBaseId: fromBase,
        action: 'CARGO_TRANSFER',
        cost: { energy: 0, meals: 0, water: 0, airPacks: 0 },
        details: `Transferred ${amount} ${resource} from ${src.name} to ${dst.name}.`,
      };

      set({
        bases: updatedBases,
        transactions: [tx, ...state.transactions],
        recentNotification: `Cargo transfer committed: ${amount} ${resource} moved to ${dst.name}.`,
      });

      saveState({ bases: updatedBases });
      return true;
    },

    requestRecoverySupport: (baseId) => {
      const state = get();
      const base = state.bases[baseId];

      // Recovery grants minimum replenishment up to initial shift capability
      const res = base.resources;
      const replenished: BaseResources = {
        energy: Math.max(res.energy, 4),
        meals: Math.max(res.meals, 2),
        water: Math.max(res.water, 2),
        airPacks: Math.max(res.airPacks, 2),
      };

      const updatedBases = {
        ...state.bases,
        [baseId]: { ...base, resources: replenished },
      };

      const tx: TransactionRecord = {
        id: `tx-recovery-${Date.now()}`,
        timestamp: Date.now(),
        regionId: state.currentRegion,
        supportBaseId: baseId,
        action: 'RECOVERY_SUPPORT',
        cost: { energy: 0, meals: 0, water: 0, airPacks: 0 },
        details: `Emergency reserve allocation delivered by Sol autonomous logistics network.`,
      };

      set({
        bases: updatedBases,
        transactions: [tx, ...state.transactions],
        activeModal: null,
        recentNotification: `Emergency support delivered to ${base.name}. Essential shift reserves restored.`,
      });

      saveState({ bases: updatedBases });
    },

    selectResearchGoal: (goalId) => {
      set({ selectedGoal: goalId });
      saveState({ selectedGoal: goalId });
    },

    selectArrivalBase: (baseId) => {
      set({ chosenArrivalBase: baseId });
      saveState({ chosenArrivalBase: baseId });
    },

    submitArrivalProposal: () => {
      const state = get();
      const { chosenArrivalBase, bases, completedReports } = state;

      if (!chosenArrivalBase) {
        set({ recentNotification: 'Please select an arrival base outpost first.' });
        return;
      }

      set({ isTransmittingProposal: true, miraStatus: 'transmitting' });

      // Simulated radio transmission delay across deep space (2.5s)
      setTimeout(() => {
        const base = bases[chosenArrivalBase];
        const res = base.resources;
        const thresh = GO_ARRIVAL_THRESHOLD;

        const allReports = completedReports.length >= 5;
        const hasEnergy = res.energy >= thresh.energy;
        const hasMeals = res.meals >= thresh.meals;
        const hasWater = res.water >= thresh.water;
        const hasAir = res.airPacks >= thresh.airPacks;
        const allChecks = base.safetyChecks.diagnostics && base.safetyChecks.shelter && base.safetyChecks.comms;

        if (allReports && hasEnergy && hasMeals && hasWater && hasAir && allChecks) {
          set({
            isTransmittingProposal: false,
            miraStatus: 'GO',
            miraMessage: `TRANSMISSION RECEIVED FROM COMMANDER MIRA: "Cadet Leo, Earth Command verifies all 5 region survey reports and certified readiness criteria at ${base.name}. Life support buffers confirmed for 3 crew members (Leo + Ares-1). You are GO for Ares-1 touchdown!"`,
            recentNotification: `🎉 FLIGHT DIRECTIVE: GO FOR TOUCHDOWN! Ares-1 transport cleared for final descent!`,
          });
        } else {
          const defects: string[] = [];
          if (!allReports) defects.push(`Only ${completedReports.length}/5 regional survey reports completed`);
          if (!hasEnergy) defects.push(`Energy EU buffer below minimum (${res.energy}/${thresh.energy} EU)`);
          if (!hasMeals) defects.push(`Meal rations below minimum (${res.meals}/${thresh.meals} Meals)`);
          if (!hasWater) defects.push(`Clean water below minimum (${res.water}/${thresh.water} Water)`);
          if (!hasAir) defects.push(`Air packs below minimum (${res.airPacks}/${thresh.airPacks} Packs)`);
          if (!allChecks) defects.push(`Required safety checks incomplete (Diagnostics, Shelter, or Comms)`);

          set({
            isTransmittingProposal: false,
            miraStatus: 'HOLD',
            miraMessage: `TRANSMISSION RECEIVED FROM COMMANDER MIRA: "Cadet Leo, mission safety guidelines hold Ares-1 in pre-landing orbit. Deficiencies identified: ${defects.join('; ')}. Rectify before re-submitting proposal."`,
            recentNotification: `⚠️ FLIGHT DIRECTIVE: HOLD. Review safety checklist and adjust base resources.`,
          });
        }
        saveState(get());
      }, 2500);
    },

    resetCampaign: () => {
      localStorage.removeItem(STORAGE_KEY);
      set((state) => ({
        ...state,
        schemaVersion: 2,
        campaignId: 'five-frontiers',
        solDay: 1,
        timeOfDay: '14:20 MTC',
        currentRegion: 'dust',
        supportBaseId: 'dust',
        activeControl: 'leo',
        solRelayActive: false,
        bases: createInitialBases(),
        surveys: createInitialSurveys(),
        completedReports: [],
        leoPose: [0, 0, 5],
        leoSavedReturnPose: [0, 0, 5],
        roverPoses: DEFAULT_ROVER_POSES,
        selectedGoal: null,
        chosenArrivalBase: null,
        miraStatus: 'idle',
        miraMessage: null,
        isTransmittingProposal: false,
        activeModal: null,
        activeMinigameId: null,
        recentNotification: 'Touchdown confirmed at Wind Basin Outpost. 3 regions await survey.',
        transactions: [],
      }));
    },
  };
});
