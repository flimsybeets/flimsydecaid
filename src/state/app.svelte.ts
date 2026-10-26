// App state, shared by every screen. Live telemetry comes in over the
// gateway's sockets; library data (profiles, beans, categories, workflow) is
// loaded over REST on boot and refreshed after every write.

import { resolveGateway } from '../api/config';
import { createHttpGateway, type Gateway } from '../api/gateway';
import { createMockGateway } from '../api/mock';
import type { SocketStatus } from '../api/socket';
import type {
  Bean, BeanBatch, DeviceInfo, MachineSnapshot, Profile, ProfileRecord, ScaleFrame, ShotAnnotations, ShotPage, ShotQuery, ShotRecord, ShotSummary,
  SteamSettings, WaterLevels, Workflow,
} from '../api/types';
import { CATEGORIES_KEY, parseCategories, removeProfileEverywhere, type CategoryDoc } from '../lib/categories';
import { applyDecrement, applyGiveback, doseOf, shouldDecrement } from '../lib/bagWeight';
import { withDialIn, type DialIn } from '../lib/dialIn';
import { shotStats } from '../lib/history';
import { photoKey, toJpegDataUrl } from '../lib/photo';
import { parseTheme, THEME_KEY } from '../lib/theme';
import { clampDim, dimTarget, fitDataUrl, parseDim, SCREENSAVER_BRIGHTNESS, SCREENSAVER_DIM_KEY, SCREENSAVER_KEY } from '../lib/screensaver';
import { clampRefill, waterState } from '../lib/water';
import { parseSettings, pluginState, VISUALIZER_ID, type PluginState, type VisualizerSettings } from '../lib/visualizer';
import { saveProfile, type SaveResult } from '../lib/profileEdit';
import { GUIDE_KEY, parseGuideSetup, type GuideSetup } from '../lib/guide';
import { hideOrder, indexProfiles, latestPerLineage, lineageRoot, shiftTemperature } from '../lib/profiles';
import { ShotRecorder, samplesFromMeasurements, type ShotSample } from '../lib/shot';
import { clampSteamFlow, clampSteamTemp, LAST_STEAM_TEMP_KEY, STEAM_DEFAULT_C } from '../lib/steam';

const config = resolveGateway();
export const gateway: Gateway = config.mock ? createMockGateway() : createHttpGateway(config);

export type Tab = 'home' | 'profiles' | 'history' | 'beans' | 'settings';

class AppState {
  // Navigation
  tab = $state<Tab>('home');
  /** Beans → Shots: the bag History should open filtered to (read once, then cleared). */
  historyBag = $state<string | null>(null);

  // Live
  // Replaced whole with every frame (about 10 Hz), never mutated: $state.raw skips the deep proxy.
  machine = $state.raw<MachineSnapshot>({});
  sockets = $state<Record<'machine' | 'scale' | 'devices', SocketStatus>>({ machine: 'connecting', scale: 'connecting', devices: 'connecting' });
  devices = $state<DeviceInfo[]>([]);
  scanning = $state(false);
  scaleConnected = $state(false);
  weight = $state<number | null>(null);
  /** Flow into the cup in g/s, from the scale. */
  weightFlow = $state<number | null>(null);
  scaleBattery = $state<number | null>(null);
  // A fresh array each tick (see onMachine), so raw is enough.
  shot = $state.raw<ShotSample[]>([]);
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

  /** Screen brightness (0-100) while the screensaver shows. 100 = don't dim. */
  screensaverDim = $state(SCREENSAVER_BRIGHTNESS);
  /** Tank water level and refill threshold (mm), null until Decaid reports. */
  water = $state.raw<WaterLevels | null>(null);
  waterStatus = $derived(waterState(this.water, this.machine.state?.state === 'needsWater'));

  /** Theme option: ghosts instead of the clock on the screensaver. */
  halloween = $state(false);

  /** Settings' "Preview" shows the screensaver without the machine asleep. */
  screensaverPreview = $state(false);

  private recorder = new ShotRecorder();
  private unsubscribe: (() => void) | null = null;
  private shotStartedAt = 0;
  private settleChain: Promise<void> = Promise.resolve();

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
      onWater: (w) => {
        // Keep the last known threshold if a frame lacks it, and skip identical frames.
        const next = { currentLevel: w.currentLevel, refillLevel: Number.isFinite(w.refillLevel) ? w.refillLevel : (this.water?.refillLevel ?? NaN) };
        if (this.water?.currentLevel !== next.currentLevel || this.water?.refillLevel !== next.refillLevel) this.water = next;
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
    if (wasActive && !this.recorder.active) {
      this.shotsFinished++;
      void this.settleShot(this.shotStartedAt);
    }
    if (!wasActive && this.recorder.active) this.shotStartedAt = Date.now();
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
    // The graph's weight trace follows the scale frame by frame, not just per machine frame.
    if (this.recorder.onScale(f)) this.shot = this.recorder.samples.slice();
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
    await this.updateBag(batchId, { archived: true, weightRemaining: 0 });
  }

  async reopenBag(batchId: string): Promise<void> {
    await this.updateBag(batchId, { archived: false });
  }

  async updateBag(batchId: string, patch: Partial<BeanBatch>): Promise<void> {
    const updated = await gateway.updateBatch(batchId, patch);
    this.batches = this.batches.map((b) => (b.id === updated.id ? updated : b));
  }

  /** Gone for good, photo too. Shots keep the coffee's name but lose the link to the bag. */
  async deleteBag(batchId: string): Promise<void> {
    await gateway.deleteBatch(batchId);
    this.batches = this.batches.filter((b) => b.id !== batchId);
    void gateway.storeDelete(photoKey(batchId)).catch(() => {});
    delete this.photos[batchId];
  }

  async updateBean(beanId: string, patch: Partial<Bean>): Promise<void> {
    const updated = await gateway.updateBean(beanId, patch);
    this.beans = this.beans.map((b) => (b.id === updated.id ? updated : b));
  }

  /**
   * Remove a coffee from the skin: it and its bags are archived, not deleted,
   * so shot history and other skins keep their records.
   */
  async removeCoffee(beanId: string): Promise<void> {
    try {
      for (const b of this.batches.filter((x) => x.beanId === beanId && !x.archived)) {
        await this.updateBag(b.id, { archived: true });
      }
      await this.updateBean(beanId, { archived: true });
    } catch (e) {
      // Show what Decaid actually has; trying again finishes the job.
      await this.refreshBeans();
      throw e;
    }
    if (this.guide?.beanId === beanId) await this.removeGuide();
  }

  private async refreshBeans(): Promise<void> {
    try {
      const [beans, batches] = await Promise.all([gateway.getBeans(), gateway.getBatches()]);
      this.beans = beans;
      this.batches = batches;
    } catch { /* keep what we have; the caller reports the original error */ }
  }

  /**
   * Delete a profile: every version of it is hidden in Decaid (reversible
   * there; Decaid refuses to delete its own defaults), and it leaves its
   * categories and the guide. One request at a time, so Decaid isn't flooded.
   */
  async deleteProfile(profileRoot: string): Promise<void> {
    const versions = this.profiles.filter((r) => this.rootOf(r.id) === profileRoot);
    try {
      // Newest first: if this stops partway, the rest still hang off the same root.
      for (const r of hideOrder(versions, this.profilesById)) await gateway.setProfileVisibility(r.id, 'hidden');
    } catch (e) {
      this.profiles = await gateway.getProfiles().catch(() => this.profiles);
      throw e;
    }
    if (this.categories.categories.some((c) => c.profiles.includes(profileRoot))) {
      await this.saveCategories(removeProfileEverywhere(this.categories, profileRoot));
    }
    if (this.guide?.profileRoot === profileRoot) await this.removeGuide();
    this.profiles = await gateway.getProfiles();
  }

  annotateShot(id: string, annotations: Partial<ShotAnnotations>): Promise<ShotSummary> { return gateway.updateShot(id, annotations); }

  /**
   * Delete a shot. With `giveBack`, the dose that was taken off its bag goes
   * back (only if the bag's ledger says it was taken; see lib/bagWeight).
   */
  async deleteShot(id: string, giveBack = false, batchId?: string | null): Promise<void> {
    await gateway.deleteShot(id);
    if (giveBack && batchId) await this.giveBackToBag(batchId, id).catch(() => {});
  }

  private async giveBackToBag(batchId: string, shotId: string): Promise<void> {
    const fresh = await gateway.getBatch(batchId);
    const update = applyGiveback(fresh, shotId);
    if (update) this.replaceBatch(await gateway.updateBatch(batchId, update));
  }

  private replaceBatch(updated: BeanBatch): void {
    this.batches = this.batches.map((b) => (b.id === updated.id ? updated : b));
  }

  /**
   * A pull just ended: once Decaid has stored the shot, take its dose off the
   * bag (lib/bagWeight; the bag's own ledger stops a shot counting twice, even
   * across reloads and other tablets). Only shots from this pull are looked at,
   * so a reload never re-counts old ones. Runs one at a time.
   */
  private settleShot(since: number): Promise<void> {
    this.settleChain = this.settleChain.then(async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, attempt === 0 ? 1800 : 2500));
          const page = await gateway.getShots({ limit: 5 });
          const fresh = page.items.filter((s) => Date.parse(s.timestamp) >= since - 30_000);
          if (fresh.length === 0) continue;
          for (const summary of fresh) await this.takeShotOffBag(summary.id);
          return;
        }
      } catch { /* weight upkeep is best effort; the shot itself is safe in Decaid */ }
    });
    return this.settleChain;
  }

  private async takeShotOffBag(shotId: string): Promise<void> {
    const shot = await gateway.getShot(shotId);
    const batchId = shot.workflow?.context?.beanBatchId;
    const dose = doseOf(shot);
    if (!batchId || dose === null) return;
    const stats = shotStats(samplesFromMeasurements(shot.measurements ?? []));
    // Read the bag fresh: another tablet may have counted this shot already.
    const batch = await gateway.getBatch(batchId).catch(() => undefined);
    if (!shouldDecrement(shot, stats, batch)) return;
    this.replaceBatch(await gateway.updateBatch(batchId, applyDecrement(batch!, shotId, dose)));
  }

  // Shot history is read straight from Decaid; nothing to keep in memory.
  getShots(query: ShotQuery): Promise<ShotPage> { return gateway.getShots(query); }
  getShot(id: string): Promise<ShotRecord> { return gateway.getShot(id); }

  // ---- Visualizer (Decaid's bundled plugin) --------------------------------
  /** Whether the plugin is installed, off, or on. Refreshed by `loadVisualizer`. */
  visualizer = $state<PluginState>('missing');

  async loadVisualizer(): Promise<void> {
    this.visualizer = pluginState(await gateway.getPlugins().catch(() => []));
  }
  async visualizerSettings(): Promise<VisualizerSettings> {
    return parseSettings(await gateway.getPluginSettings(VISUALIZER_ID));
  }
  async saveVisualizerSettings(patch: Record<string, unknown>): Promise<VisualizerSettings> {
    return parseSettings(await gateway.savePluginSettings(VISUALIZER_ID, patch));
  }
  async setVisualizerEnabled(on: boolean): Promise<void> {
    await gateway.setPluginEnabled(VISUALIZER_ID, on);
    await this.loadVisualizer();
  }
  /** Plugin endpoints: status, verifyCredentials, upload. */
  visualizerCall<T>(endpoint: string, body?: unknown): Promise<T> { return gateway.callPlugin<T>(VISUALIZER_ID, endpoint, body); }
  /** Upload one shot through the plugin. Returns the Visualizer id. */
  async uploadToVisualizer(shotId: string): Promise<string> {
    const r = await gateway.callPlugin<{ visualizer_id?: string | number }>(VISUALIZER_ID, 'upload', { shotId });
    return String(r.visualizer_id ?? '');
  }

  async saveGuide(setup: GuideSetup): Promise<void> {
    await gateway.storeSet(GUIDE_KEY, setup);
    this.guide = setup;
  }

  async removeGuide(): Promise<void> {
    await gateway.storeDelete(GUIDE_KEY);
    this.guide = null;
  }

  async loadMachineInfo(): Promise<void> {
    const info = await gateway.getMachineInfo().catch(() => null);
    if (info) this.ghc = info.GHC === true;
  }

  async loadScreensaver(): Promise<void> {
    const url = await gateway.storeGet<string>(SCREENSAVER_KEY).catch(() => null);
    this.screensaverImage = typeof url === 'string' && url.startsWith('data:image/') ? url : null;
    this.screensaverDim = parseDim(await gateway.storeGet(SCREENSAVER_DIM_KEY).catch(() => null));
    this.halloween = parseTheme(await gateway.storeGet(THEME_KEY).catch(() => null)).halloween;
  }

  async setHalloween(on: boolean): Promise<void> {
    this.halloween = on;
    await gateway.storeSet(THEME_KEY, { halloween: on }).catch(() => {});
  }

  private dimSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private refillTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Brightness while the screensaver shows. Applies to an open screensaver at
   * once; the save to the store waits 400 ms after the last change.
   */
  setScreensaverDim(value: number): void {
    this.screensaverDim = clampDim(value);
    this.dimQueue = this.dimQueue.then(() => this.retuneDim());
    if (this.dimSaveTimer) clearTimeout(this.dimSaveTimer);
    this.dimSaveTimer = setTimeout(() => {
      this.dimSaveTimer = null;
      void gateway.storeSet(SCREENSAVER_DIM_KEY, this.screensaverDim).catch(() => {});
    }, 400);
  }

  /** Move the refill warning (mm). Updates the display now, sends to Decaid 400 ms after the last change. */
  setWaterRefill(mm: number): void {
    const level = clampRefill(mm);
    this.water = { currentLevel: this.water?.currentLevel ?? NaN, refillLevel: level };
    if (this.refillTimer) clearTimeout(this.refillTimer);
    this.refillTimer = setTimeout(() => {
      this.refillTimer = null;
      void gateway.setWaterRefillLevel(level).catch(() => {});
    }, 400);
  }

  private async retuneDim(): Promise<void> {
    if (this.brightnessBeforeDim === null) return;
    try { await gateway.setBrightness(dimTarget(this.screensaverDim, this.brightnessBeforeDim)); } catch { /* nicety */ }
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
        await gateway.setBrightness(dimTarget(this.screensaverDim, this.brightnessBeforeDim));
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
  async sleep(): Promise<void> { await gateway.requestState('sleeping'); }

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
