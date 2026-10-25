// App state, shared by every screen. Live telemetry comes in over the
// gateway's sockets; library data (profiles, beans, categories, workflow) is
// loaded over REST on boot and refreshed after every write.

import { resolveGateway } from '../api/config';
import { createHttpGateway, type Gateway } from '../api/gateway';
import { createMockGateway } from '../api/mock';
import type { SocketStatus } from '../api/socket';
import type {
  Bean, BeanBatch, DeviceInfo, MachineSnapshot, Profile, ProfileRecord, ScaleFrame, ShotPage, ShotQuery, ShotRecord,
  SteamSettings, Workflow,
} from '../api/types';
import { CATEGORIES_KEY, parseCategories, type CategoryDoc } from '../lib/categories';
import { withDialIn, type DialIn } from '../lib/dialIn';
import { photoKey, toJpegDataUrl } from '../lib/photo';
import { fitDataUrl, SCREENSAVER_BRIGHTNESS, SCREENSAVER_KEY } from '../lib/screensaver';
import { saveProfile, type SaveResult } from '../lib/profileEdit';
import { GUIDE_KEY, parseGuideSetup, type GuideSetup } from '../lib/guide';
import { indexProfiles, latestPerLineage, lineageRoot, shiftTemperature } from '../lib/profiles';
import { ShotRecorder, type ShotSample } from '../lib/shot';
import { clampSteamFlow, clampSteamTemp, LAST_STEAM_TEMP_KEY, STEAM_DEFAULT_C } from '../lib/steam';

const config = resolveGateway();
export const gateway: Gateway = config.mock ? createMockGateway() : createHttpGateway(config);

export type Tab = 'home' | 'profiles' | 'history' | 'beans' | 'settings';

class AppState {
  // Navigation
  tab = $state<Tab>('home');

  // Live
  machine = $state<MachineSnapshot>({});
  sockets = $state<Record<'machine' | 'scale' | 'devices', SocketStatus>>({ machine: 'connecting', scale: 'connecting', devices: 'connecting' });
  devices = $state<DeviceInfo[]>([]);
  scanning = $state(false);
  scaleConnected = $state(false);
  weight = $state<number | null>(null);
  /** Flow into the cup in g/s, from the scale. */
  weightFlow = $state<number | null>(null);
  scaleBattery = $state<number | null>(null);
  shot = $state<ShotSample[]>([]);
  shotActive = $state(false);
  /** Bumped when a pull ends, so History knows to refetch. */
  shotsFinished = $state(0);

  // Library
  profiles = $state<ProfileRecord[]>([]);
  categories = $state<CategoryDoc>({ version: 1, categories: [] });
  beans = $state<Bean[]>([]);
  batches = $state<BeanBatch[]>([]);
  workflow = $state<Workflow>({});
  loaded = $state(false);
  error = $state<string | null>(null);

  // Derived
  machineDevice = $derived(this.devices.find((d) => d.type === 'machine'));
  scaleDevice = $derived(this.devices.find((d) => d.type === 'scale'));
  machineConnected = $derived(this.machineDevice?.state === 'connected');
  gatewayOnline = $derived(this.sockets.devices === 'open');
  profilesById = $derived(indexProfiles(this.profiles));
  /** Lineage root → newest visible version. One entry per profile you'd recognise. */
  profileLineages = $derived(latestPerLineage(this.profiles));
  steam = $derived<SteamSettings | undefined>(this.workflow.steamSettings);
  asleep = $derived(this.machine.state?.state === 'sleeping');
  /** Group Head Controller fitted: start shots at the group head, so the skin hides Start. */
  ghc = $state(false);

  /** Screensaver photo (JPEG data URL), or null when none is chosen. */
  screensaverImage = $state<string | null>(null);
  /** Profile editor: the record being edited, `null` for a new profile, undefined when closed. */
  editing = $state<ProfileRecord | null | undefined>(undefined);

  /** "Guide me": the profile + coffee it's set to (null until set up), and whether it's running. */
  guide = $state<GuideSetup | null>(null);
  guiding = $state(false);

  /** Settings' "Preview" shows the screensaver without the machine asleep. */
  screensaverPreview = $state(false);

  private recorder = new ShotRecorder();
  private unsubscribe: (() => void) | null = null;

  get mock(): boolean { return gateway.mock; }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = gateway.subscribe({
      onMachine: (f) => this.onMachine(f),
      onScale: (f) => this.onScale(f),
      onDevices: (d) => {
        const wasConnected = this.machineConnected;
        this.devices = d.devices;
        this.scanning = d.scanning;
        // Machine info (GHC) is read once at connect, so ask each time the machine connects.
        if (!wasConnected && this.machineConnected) void this.loadMachineInfo();
      },
      onSocketStatus: (ch, s) => { this.sockets[ch] = s; },
    });
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [profiles, workflow, categories, beans, batches, guide] = await Promise.all([
        gateway.getProfiles(),
        gateway.getWorkflow(),
        gateway.storeGet(CATEGORIES_KEY),
        gateway.getBeans(),
        gateway.getBatches(),
        gateway.storeGet(GUIDE_KEY).catch(() => null),
      ]);
      this.guide = parseGuideSetup(guide);
      this.profiles = profiles;
      this.workflow = workflow;
      this.categories = parseCategories(categories);
      this.beans = beans;
      this.batches = batches;
      this.error = null;
      this.loaded = true;
      // Big, and only needed once the machine sleeps, so it loads after everything else.
      void this.loadScreensaver();
    } catch (e) {
      this.error = `Couldn't reach Decaid: ${(e as Error).message}`;
    }
  }

  private onMachine(f: MachineSnapshot): void {
    this.machine = f;
    const wasActive = this.recorder.active;
    if (this.recorder.onMachine(f)) {
      this.shot = this.recorder.samples.slice();
    }
    this.shotActive = this.recorder.active;
    if (wasActive && !this.recorder.active) this.shotsFinished++;
    if (!wasActive && this.recorder.active && this.scaleConnected) {
      // Tare once as the pull begins, in case the cup wasn't zeroed.
      void gateway.tareScale().catch(() => {});
    }
  }

  private onScale(f: ScaleFrame): void {
    if ('status' in f) {
      // A status frame is not a reading: don't show 0 g on connect.
      this.scaleConnected = f.status === 'connected';
      if (!this.scaleConnected) { this.weight = null; this.weightFlow = null; }
      return;
    }
    this.scaleConnected = true;
    this.weight = f.weight;
    this.weightFlow = f.weightFlow ?? null;
    this.scaleBattery = f.battery ?? null;
    this.recorder.onScale(f);
  }

  rootOf(profileId: string): string {
    return lineageRoot(profileId, this.profilesById);
  }

  // ---- Actions -----------------------------------------------------------

  async saveCategories(doc: CategoryDoc): Promise<void> {
    const previous = this.categories;
    this.categories = doc;
    try {
      await gateway.storeSet(CATEGORIES_KEY, doc);
    } catch (e) {
      this.categories = previous;
      throw e;
    }
  }

  /**
   * Load a profile + bag + dial-in onto the machine. The profile is sent
   * inline with the temperature offset applied, so no new profile is saved.
   */
  async applySelection(profileRoot: string, batch: BeanBatch | null, dialIn: DialIn): Promise<void> {
    const record = this.profileLineages.get(profileRoot);
    if (!record) throw new Error('Profile not found');
    const bean = batch ? this.beans.find((b) => b.id === batch.beanId) : undefined;

    const context: NonNullable<Parameters<Gateway['updateWorkflow']>[0]['context']> = {
      beanBatchId: batch?.id ?? null,
      coffeeName: bean?.name ?? null,
      coffeeRoaster: bean?.roaster ?? null,
      grinderSetting: dialIn.grind ?? null,
      targetDoseWeight: dialIn.dose ?? null,
    };
    // targetYield must never be null in a PUT. Only send it when we have a value;
    // otherwise fall back to the profile's own stop-at-weight (0 = off).
    const yieldTarget = dialIn.yield ?? record.profile.target_weight ?? 0;
    context.targetYield = yieldTarget;

    this.workflow = await gateway.updateWorkflow({
      profile: shiftTemperature(record.profile, dialIn.tempOffset ?? 0),
      context,
    });
  }

  async saveDialIn(batch: BeanBatch, profileRoot: string, dialIn: DialIn): Promise<void> {
    const updated = await gateway.updateBatch(batch.id, { extras: withDialIn(batch, profileRoot, dialIn) });
    this.batches = this.batches.map((b) => (b.id === updated.id ? updated : b));
  }

  /** Bag photos by batch id, loaded on demand from the key-value store. */
  photos = $state<Record<string, string | null>>({});

  async loadPhoto(batchId: string): Promise<void> {
    if (batchId in this.photos) return;
    this.photos[batchId] = null;
    const url = await gateway.storeGet<string>(photoKey(batchId)).catch(() => null);
    this.photos[batchId] = typeof url === 'string' && url.startsWith('data:image/') ? url : null;
  }

  async savePhoto(batchId: string, dataUrl: string): Promise<void> {
    await gateway.storeSet(photoKey(batchId), dataUrl);
    this.photos[batchId] = dataUrl;
  }

  /** Add a bag of an existing bean (pass its id) or of a new one (pass roaster + name). */
  async addBag(bean: string | { roaster: string; name: string }, bag: Partial<BeanBatch>): Promise<BeanBatch> {
    let beanId: string;
    if (typeof bean === 'string') {
      beanId = bean;
    } else {
      const created = await gateway.createBean(bean);
      this.beans = [...this.beans, created];
      beanId = created.id;
    }
    const batch = await gateway.createBatch(beanId, bag);
    this.batches = [...this.batches, batch];
    return batch;
  }

  /** Mark a bag as used up. It stays in Decaid (and in shot history), just hidden. */
  async finishBag(batchId: string): Promise<void> {
    const updated = await gateway.updateBatch(batchId, { archived: true, weightRemaining: 0 });
    this.batches = this.batches.map((b) => (b.id === updated.id ? updated : b));
  }

  // Shot history is read straight from Decaid; nothing to keep in memory.
  getShots(query: ShotQuery): Promise<ShotPage> { return gateway.getShots(query); }
  getShot(id: string): Promise<ShotRecord> { return gateway.getShot(id); }

  async saveGuide(setup: GuideSetup): Promise<void> {
    await gateway.storeSet(GUIDE_KEY, setup);
    this.guide = setup;
  }

  async loadMachineInfo(): Promise<void> {
    const info = await gateway.getMachineInfo().catch(() => null);
    if (info) this.ghc = info.GHC === true;
  }

  async loadScreensaver(): Promise<void> {
    const url = await gateway.storeGet<string>(SCREENSAVER_KEY).catch(() => null);
    this.screensaverImage = typeof url === 'string' && url.startsWith('data:image/') ? url : null;
  }

  /** Shrink a picked photo to fit the store, save it, and use it. */
  async setScreensaver(file: Blob): Promise<void> {
    const url = await fitDataUrl((edge, quality) => toJpegDataUrl(file, edge, quality));
    await gateway.storeSet(SCREENSAVER_KEY, url);
    this.screensaverImage = url;
  }

  async removeScreensaver(): Promise<void> {
    await gateway.storeDelete(SCREENSAVER_KEY);
    this.screensaverImage = null;
  }

  async keepScreenOn(on: boolean): Promise<void> {
    await gateway.keepScreenOn(on).catch(() => {});
  }

  /** Brightness to go back to after the screensaver; null while not dimmed. */
  private brightnessBeforeDim: number | null = null;

  private dimQueue: Promise<void> = Promise.resolve();

  /**
   * Dim the screen for the screensaver, and put it back exactly as it was
   * afterwards. Calls run one after another, so a quick close can't restore
   * before the dim lands and leave the screen dark.
   */
  dimScreen(on: boolean): Promise<void> {
    this.dimQueue = this.dimQueue.then(() => this.applyDim(on));
    return this.dimQueue;
  }

  private async applyDim(on: boolean): Promise<void> {
    try {
      if (on) {
        if (this.brightnessBeforeDim !== null) return;
        const display = await gateway.getDisplay();
        if (display.platformSupported?.brightness === false) return;
        this.brightnessBeforeDim = display.requestedBrightness ?? 100;
        await gateway.setBrightness(SCREENSAVER_BRIGHTNESS);
      } else if (this.brightnessBeforeDim !== null) {
        const back = this.brightnessBeforeDim;
        this.brightnessBeforeDim = null;
        await gateway.setBrightness(back);
      }
    } catch { /* brightness is a nicety; never block the screensaver on it */ }
  }

  /** Save an edited or new profile, then refresh the list. See lib/profileEdit saveProfile. */
  async saveProfile(draft: Profile, original: ProfileRecord | null, asCopy = false): Promise<SaveResult> {
    const result = await saveProfile(
      { create: (p, parentId) => gateway.createProfile(p, parentId), update: (id, p) => gateway.updateProfile(id, p) },
      draft, original, asCopy,
    );
    this.profiles = await gateway.getProfiles();
    return result;
  }

  /** The most recent shot pulled with a profile of this title, with measurements. */
  async lastShotFor(title: string): Promise<ShotRecord | null> {
    const page = await gateway.getShots({ profileTitle: title, limit: 1 }).catch(() => null);
    const id = page?.items[0]?.id;
    return id ? gateway.getShot(id).catch(() => null) : null;
  }

  async wake(): Promise<void> { await gateway.requestState('idle'); }

  async startEspresso(): Promise<void> { await gateway.requestState('espresso'); }
  async stop(): Promise<void> { await gateway.requestState('idle'); }
  async tare(): Promise<void> { await gateway.tareScale(); }
  scanForScale(): void { gateway.scanDevices(); }

  async setSteam(patch: { on?: boolean; temperature?: number; flow?: number }): Promise<void> {
    const current = this.workflow.steamSettings;
    const next: Partial<SteamSettings> = {};
    if (patch.flow !== undefined) next.flow = clampSteamFlow(patch.flow);
    if (patch.temperature !== undefined) {
      next.targetTemperature = clampSteamTemp(patch.temperature);
      void gateway.storeSet(LAST_STEAM_TEMP_KEY, next.targetTemperature).catch(() => {});
    }
    if (patch.on === false) {
      if (current && current.targetTemperature > 0) {
        void gateway.storeSet(LAST_STEAM_TEMP_KEY, current.targetTemperature).catch(() => {});
      }
      next.targetTemperature = 0;
    } else if (patch.on === true && next.targetTemperature === undefined) {
      const last = await gateway.storeGet<number>(LAST_STEAM_TEMP_KEY).catch(() => null);
      next.targetTemperature = clampSteamTemp(last ?? STEAM_DEFAULT_C);
    }
    this.workflow = await gateway.updateWorkflow({ steamSettings: next });
  }
}

export const app = new AppState();
