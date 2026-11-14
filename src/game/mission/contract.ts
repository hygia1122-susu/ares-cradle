/**
 * Ares Cradle - Five Frontiers Campaign Contract
 * Definitive specifications conforming to MASTER_PLAN.md & Invariants I01 - I09.
 */

export type RegionId = 'dust' | 'ice' | 'lake';

export type ResearchGoalId = 'geology' | 'water_ops' | 'ancient_life';

export type SafetyCheckId = 'diagnostics' | 'shelter' | 'comms';

export type MiraStatus = 'idle' | 'transmitting' | 'GO' | 'HOLD';

export interface BaseResources {
  energy: number;   // EU (Energy Units)
  meals: number;    // Packaged food rations
  water: number;    // Clean, tested potable water portions
  airPacks: number; // Consumable EVA/Airlock air packs
}

/**
 * Invariant I09 Resource Standard Constants
 */
export const INITIAL_BASE_RESOURCES: BaseResources = {
  energy: 12,
  meals: 4,
  water: 5,
  airPacks: 4,
};

export const ESSENTIAL_SHIFT_COST: BaseResources = {
  energy: 2,
  meals: 1,
  water: 1,
  airPacks: 1,
};

export const SECONDARY_JOB_COST: BaseResources = {
  energy: 2,
  meals: 0,
  water: 0,
  airPacks: 0,
};

export const GO_ARRIVAL_THRESHOLD: BaseResources = {
  energy: 8,
  meals: 3,
  water: 3,
  airPacks: 3,
};

export interface BaseState {
  id: RegionId;
  name: string;
  isDiscovered: boolean;
  resources: BaseResources;
  safetyChecks: Record<SafetyCheckId, boolean>;
  // Dynamic 3D & operational state upgrades
  sampleLayout: 'standard' | 'protected' | 'accessible';
  panelsClean: boolean;
  thermalUpgrade: 'standard' | 'passive' | 'active';
  coreAnalysis: 'none' | 'complete';
  waterCleaned: boolean;
  transmit: 'standard' | 'summary' | 'full';
  roverInspection: 'none' | 'complete';
}

export interface RegionSurveyState {
  regionId: RegionId;
  supportBaseId: RegionId;
  focalPointsDone: string[];       // Needs >= 2 of 3 to unlock minigame
  optionalBranchesDone: string[];   // Unlocks accessibility / mnemonic perks
  unlockedPerkIds: string[];
  essentialShiftPaid: boolean;     // 2 EU + 1 Meal + 1 Water + 1 Air paid once
  minigameCompleted: boolean;
  secondaryJobSelected: string | null;
  secondaryJobDeferred: string | null;
  reportCompleted: boolean;
}

export interface FocalPointDefinition {
  id: string;
  title: string;
  coordinates: [number, number, number];
  type: string;
  summary: string;
  kidNote: string;
  fieldNote: string;
  sourceId: string;
}

export interface OptionalBranchDefinition {
  id: string;
  title: string;
  coordinates: [number, number, number];
  perkId: string;
  perkTitle: string;
  benefit: string;
}

export interface SecondaryJobDefinition {
  id: string;
  title: string;
  description: string;
  cost: BaseResources;
  outputKey: string;
  outputValue: any;
  energyBonus?: number;
  waterBonus?: number;
  readout: string;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  coordinates: [number, number, number];
  color: string;
  landmark: string;
  roverId: string;
  roverName: string;
  roverTool: string;
  pedagogicalQuestion: string;
  coreLesson: string;
  focalPoints: FocalPointDefinition[];
  optionalBranches: OptionalBranchDefinition[];
  minigame: any;
  secondaryJobs: SecondaryJobDefinition[];
}

export interface ResearchGoalDefinition {
  id: ResearchGoalId;
  title: string;
  recommendedBases: RegionId[];
  description: string;
  focalQuestion: string;
}

export interface ScientificSourceDefinition {
  id: string;
  mission: string;
  title: string;
  url: string;
  credit: string;
  keyFact: string;
  interpretationBoundary: string;
}

export interface MissionDataPack {
  schemaVersion: number;
  campaignId: string;
  contentVersion: string;
  rulesVersion: string;
  title: string;
  targetAudience: string;
  language: string;
  balance: {
    initialBaseResources: BaseResources;
    essentialShiftCost: BaseResources;
    secondaryJobCost: BaseResources;
    arrivalGoThreshold: BaseResources;
    requiredSafetyChecks: { id: SafetyCheckId; label: string; description: string; }[];
  };
  researchGoals: ResearchGoalDefinition[];
  regions: RegionDefinition[];
  scientificSources: ScientificSourceDefinition[];
}

export interface TransactionRecord {
  id: string;
  timestamp: number;
  regionId: RegionId;
  supportBaseId: RegionId;
  action: 'ESSENTIAL_SHIFT' | 'SECONDARY_JOB' | 'CARGO_TRANSFER' | 'RECOVERY_SUPPORT';
  cost: BaseResources;
  yieldResources?: Partial<BaseResources>;
  details: string;
}
