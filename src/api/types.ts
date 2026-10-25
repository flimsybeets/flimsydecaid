// Types for the parts of the Decaid API this skin uses.
// Source of truth: decaid assets/api/rest_v1.yml and assets/api/websocket_v1.yml.
// Treat every telemetry field as optional: Decaid adds fields often and older
// gateways may omit newer ones.

export type MachineState =
  | 'idle' | 'booting' | 'sleeping' | 'heating' | 'preheating' | 'espresso'
  | 'hotWater' | 'flush' | 'steam' | 'skipStep' | 'cleaning' | 'descaling'
  | 'transportMode' | 'needsWater' | 'error';

export type MachineSubstate =
  | 'idle' | 'preparingForShot' | 'preinfusion' | 'pouring' | 'pouringDone'
  | 'cleaningStart' | 'cleaingGroup' | 'cleanSoaking' | 'cleaningSteam'
  | 'pausedSteam' | 'puffing';

/** ws/v1/machine/snapshot frame (~10 Hz). Temperatures are always °C. */
export interface MachineSnapshot {
  timestamp?: string;
  state?: { state?: MachineState; substate?: MachineSubstate };
  pressure?: number;
  flow?: number;
  targetPressure?: number;
  targetFlow?: number;
  /** Water as it enters the group (after mixing). */
  mixTemperature?: number;
  /** Group head sensor, the closest reading to the puck. */
  groupTemperature?: number;
  targetMixTemperature?: number;
  targetGroupTemperature?: number;
  steamTemperature?: number;
  profileFrame?: number;
}

/** ws/v1/scale/snapshot sends two kinds of frame on one socket. */
export interface ScaleStatusFrame { status: 'connected' | 'disconnected' }
export interface ScaleWeightFrame {
  timestamp?: string;
  weight: number;
  weightFlow?: number;
  battery?: number | null;
  timerValue?: number | null;
}
export type ScaleFrame = ScaleStatusFrame | ScaleWeightFrame;

export type DeviceType = 'machine' | 'scale' | 'sensor' | 'grinder';
export type DeviceState = 'discovered' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected';

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  state: DeviceState;
  available?: boolean;
}

/** ws/v1/devices frame. Use this, not telemetry silence, for connection state. */
export interface DevicesState {
  timestamp?: string;
  devices: DeviceInfo[];
  scanning: boolean;
  connectionStatus?: { phase?: 'idle' | 'scanning' | 'connectingMachine' | 'connectingScale' | 'ready' };
}

export interface ProfileStep {
  name: string;
  pump: 'pressure' | 'flow';
  transition: 'fast' | 'smooth';
  volume: number;
  seconds: number;
  weight?: number | null;
  /** Target temperature in °C. */
  temperature: number;
  sensor: 'coffee' | 'water';
  pressure?: number;
  flow?: number;
  exit?: unknown;
  limiter?: unknown;
  [key: string]: unknown;
}

export interface Profile {
  title: string;
  author?: string;
  notes?: string;
  beverage_type?: 'espresso' | 'calibrate' | 'cleaning' | 'manual' | 'pourover';
  steps: ProfileStep[];
  target_volume?: number | null;
  target_weight?: number | null;
  target_volume_count_start: number;
  tank_temperature: number;
  [key: string]: unknown;
}

/** GET /api/v1/profiles item. `id` is a content hash: edits produce a new id. */
export interface ProfileRecord {
  id: string;
  profile: Profile;
  parentId?: string | null;
  visibility: 'visible' | 'hidden' | 'deleted';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowContext {
  targetDoseWeight?: number | null;
  targetYield?: number | null;
  targetWaterVolume?: number | null;
  grinderId?: string | null;
  grinderModel?: string | null;
  grinderSetting?: string | null;
  beanBatchId?: string | null;
  coffeeName?: string | null;
  coffeeRoaster?: string | null;
  finalBeverageType?: string | null;
  baristaName?: string | null;
  drinkerName?: string | null;
}

export interface SteamSettings {
  /** 0 = steam heater off. Enabled range 135–160 °C on DE1, 135–165 on Bengle. */
  targetTemperature: number;
  /** Maximum steam run time in seconds; does not control the heater. */
  duration: number;
  flow: number;
  stopAtTemperature?: number;
}

export interface Workflow {
  name?: string;
  description?: string;
  profile?: Profile;
  context?: WorkflowContext;
  steamSettings?: SteamSettings;
  hotWaterData?: { targetTemperature: number; duration: number; volume: number; flow: number };
  rinseData?: { targetTemperature: number; duration: number; flow: number };
}

/**
 * PUT /api/v1/workflow body. Deep-merged: omitted fields are preserved.
 * Never send `null` for targetYield or any steamSettings field (rejected);
 * other context fields accept null, which clears them on the machine.
 */
export interface WorkflowPatch {
  profile?: Profile;
  context?: Partial<WorkflowContext> & { targetYield?: number };
  steamSettings?: Partial<SteamSettings>;
}

export interface Bean {
  id: string;
  roaster: string;
  name: string;
  species?: string | null;
  decaf: boolean;
  decafProcess?: string | null;
  country?: string | null;
  region?: string | null;
  producer?: string | null;
  variety?: string[] | null;
  altitude?: number[] | null;
  processing?: string | null;
  notes?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  extras?: Record<string, unknown> | null;
}

/** A bag: one purchase or roast of a Bean. */
export interface BeanBatch {
  id: string;
  beanId: string;
  roastDate?: string | null;
  roastLevel?: string | null;
  weight?: number | null;
  weightRemaining?: number | null;
  buyDate?: string | null;
  openDate?: string | null;
  bestBeforeDate?: string | null;
  freezeDate?: string | null;
  unfreezeDate?: string | null;
  frozen: boolean;
  archived: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  extras?: Record<string, unknown> | null;
}

export interface Grinder {
  id: string;
  model: string;
  burrs?: string | null;
  settingType: 'numeric' | 'preset';
  settingValues?: string[] | null;
  settingSmallStep?: number | null;
  settingBigStep?: number | null;
  archived: boolean;
}

/** Post-shot notes and measurements. Enjoyment is Decaid's 0–10 scale. */
export interface ShotAnnotations {
  actualDoseWeight?: number | null;
  actualYield?: number | null;
  drinkTds?: number | null;
  drinkEy?: number | null;
  enjoyment?: number | null;
  espressoNotes?: string | null;
  extras?: Record<string, unknown> | null;
}

/** GET /api/v1/shots item: a shot without its measurements. */
export interface ShotSummary {
  id: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  /** The workflow as it was when the shot was pulled. Context fields can be null. */
  workflow?: Workflow;
  annotations?: ShotAnnotations | null;
  /** Open set: targetWeight, targetVolume, apiStop, appStop, machineEnded, error, … */
  stopReason?: string | null;
}

/** One recorded sample: the machine frame plus the scale reading at that moment. */
export interface ShotMeasurement {
  machine: MachineSnapshot;
  scale?: ScaleWeightFrame | null;
  volume?: number | null;
}

/** GET /api/v1/shots/{id} */
export interface ShotRecord extends ShotSummary {
  measurements: ShotMeasurement[];
}

export interface ShotPage {
  items: ShotSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Query for GET /api/v1/shots. Newest first. limit is 1–100. */
export interface ShotQuery {
  limit?: number;
  offset?: number;
  beanBatchId?: string;
  beanId?: string;
}
