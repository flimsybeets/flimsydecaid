// App state, shared by every screen. Live telemetry comes in over the
// gateway's sockets; library data (profiles, beans, categories, workflow) is
// loaded over REST on boot and refreshed after every write.

import { resolveGateway } from '../api/config';
import { createHttpGateway, HttpError, type Gateway } from '../api/gateway';
import { createMockGateway } from '../api/mock';
import type { SocketStatus } from '../api/socket';
import type {
  Bean, BeanBatch, DeviceInfo, Grinder, MachineSnapshot, Profile, ProfileRecord, ScaleFrame, ShotAnnotations, ShotPage, ShotQuery, ShotRecord, ShotSummary,
  SteamSettings, WaterLevels, Workflow, WorkflowPatch,
} from '../api/types';
import { CATEGORIES_KEY, parseCategories, removeProfileEverywhere, type CategoryDoc } from '../lib/categories';
import { huntDelay, shouldHunt } from '../lib/scaleHunt';
import { allReads, clampLookAhead, KEEP_READS, lookAheadFor, parseTune, stopRead, suggestFor, withAuto, withLookAhead, withRead, type TuneDoc } from '../lib/stopTuning';
import { findProfileRoot } from '../lib/brewAgain';
import { parseAppSettings } from '../lib/decaidSettings';
import type { TilePreview } from '../lib/miniGraph';
import { APP_BACKGROUND_KEY, clampTone, DEFAULT_TONE } from '../lib/background';
import { DEFAULT_BAGS_KEY, parseDefaultBags, type DefaultBags } from '../lib/defaultBag';
import { skinUpdateResult, updateErrorText, type SkinUpdateResult } from '../lib/skinUpdate';
import { applyDecrement, applyGiveback, doseOf, shouldDecrement } from '../lib/bagWeight';
import { withDialIn, type DialIn } from '../lib/dialIn';
import { shotStats } from '../lib/history';
import { beanPhotoKey, photoKey, toJpegDataUrl, vividColourOfDataUrl } from '../lib/photo';
import { COFFEE_COLOURS_KEY, parseBagColours, type BagColours } from '../lib/bagColour';
import { parseTheme, THEME_KEY, type PanelTint } from '../lib/theme';
import { clampDim, dimTarget, fitDataUrl, parseDim, SCREENSAVER_BRIGHTNESS, SCREENSAVER_DIM_KEY, SCREENSAVER_KEY } from '../lib/screensaver';
import { clampRefill, waterState } from '../lib/water';
import { parseSettings, pluginState, VISUALIZER_ID, type PluginState, type VisualizerSettings } from '../lib/visualizer';
import { saveProfile, type SaveResult } from '../lib/profileEdit';
import { GUIDE_KEY, parseGuideSetup, type GuideSetup } from '../lib/guide';
import { EDITION } from '../edition';
import { cloneWorkflow } from '../lib/workflowPresets';
import { normaliseWorkflow, orphanedStepIds, stepPhotoKey, WORKFLOW_KEY, type TemplateKey, type Workflow as GuideWorkflow } from '../lib/workflow';
import { currentGrinder, grindControl as grindControlOf } from '../lib/grinder';
import { hideOrder, indexProfiles, latestPerLineage, lineageRoot, shiftTemperature } from '../lib/profiles';
import { ShotRecorder, samplesFromMeasurements, type ShotSample } from '../lib/shot';
import { clampSteamFlow, clampSteamTemp, LAST_STEAM_TEMP_KEY, STEAM_DEFAULT_C } from '../lib/steam';

/** Set once the old per-bag photos have been moved to their coffees. */
const PHOTOS_MOVED_KEY = 'photosMoved';
const STOP_TUNE_KEY = 'stopTune';
const config = resolveGateway();
export const gateway: Gateway = config.mock ? createMockGateway() : createHttpGateway(config);

export type Tab = 'home' | 'profiles' | 'history' | 'beans' | 'settings';

class AppState {
  // Navigation
  tab = $state<Tab>('home');
  /** Which Settings tab is open (kept while the skin runs). */
  settingsTab = $state<string>('look');
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
  /** Bumped when the Home tab is tapped while already on Home: back to the category tiles. */
  homeReset = $state(0);
  /** Profile lineage root → the bag its brew panel starts on (Set as default). */
  defaultBags = $state<DefaultBags>({});
  /** Coffee colours from their photos, by bean id (KV coffeeColours); null = computed or picked: no colour. */
  coffeeColours = $state<BagColours>({});
  /** Starting point for a new profile (Duplicate on Profiles); null = blank. */
  editSeed = $state<Profile | null>(null);

  /** "Guide me": the profile + coffee it's set to (null until set up), and whether it's running. */
  guide = $state<GuideSetup | null>(null);
  guiding = $state(false);
  /** The kind of step Guide me is on (null while it is closed): steam and flush views leave the guide's own steps alone. */
  guideTemplate = $state<TemplateKey | null>(null);
  /** Guide me steps editor open (full screen, over the setup dialog, which steps aside meanwhile). */
  editingSteps = $state(false);
  /** The guide's steps (KV guideWorkflow); the edition's first preset until one is saved. */
  guideWorkflow = $state<GuideWorkflow>(cloneWorkflow(EDITION.guide.presets[0]!.workflow));
  /** Step photos by step id (KV guidePhoto:<id>), loaded on demand. Missing = not known yet, null = none. */
  stepPhotos = $state<Record<string, string | null>>({});
  private stepPhotoLoads = new Set<string>();
  /** The grinders Decaid has on record. */
  grinders = $state<Grinder[]>([]);
  /** Step, range and name for the grind stepper: from the grinder the workflow names (or the only one), else today's defaults. */
  grindControl = $derived(grindControlOf(currentGrinder(this.grinders, this.workflow.context?.grinderId)));

  /** Screen brightness (0-100) while the screensaver shows. 100 = don't dim. */
  screensaverDim = $state(SCREENSAVER_BRIGHTNESS);
  /** Tank water level and refill threshold (mm), null until Decaid reports. */
  water = $state.raw<WaterLevels | null>(null);
  waterStatus = $derived(waterState(this.water, this.machine.state?.state === 'needsWater'));

  /** Theme option: the edition's screensaver art instead of the clock (EDITION.screensaverExtra; stored as theme.halloween). */
  screensaverArt = $state(false);
  /** Show the big clock on the screensaver (Settings → Screensaver). */
  screensaverClock = $state(true);
  /** Graph on each profile tile on Home (theme.tilePreview). */
  tilePreview = $state<TilePreview>('shot');
  /** Theme option: hue of the big glass sheets (theme.panelTint). */
  panelTint = $state<PanelTint>('dark');
  /** Photo behind the whole app, or null for the usual colour pools. */
  appBackground = $state<string | null>(null);
  /** −100 darken … 100 lighten over that photo. */
  bgTone = $state(DEFAULT_TONE);

  /** Settings' "Preview" shows the screensaver without the machine asleep. */
  screensaverPreview = $state(false);

  private recorder = new ShotRecorder();
  private unsubscribe: (() => void) | null = null;
  private shotStartedAt = 0;
  private settleChain: Promise<void> = Promise.resolve();

  get mock(): boolean { return gateway.mock; }

  start(): void {
    if (this.unsubscribe) return;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.restartScaleHunt(); });
    this.unsubscribe = gateway.subscribe({
      onMachine: (f) => this.onMachine(f),
      onScale: (f) => this.onScale(f),
      onDevices: (d) => {
        const wasConnected = this.machineConnected;
        this.devices = d.devices;
        this.scanning = d.scanning;
        // Machine info (GHC) is read once at connect, so ask each time the machine connects.
        if (!wasConnected && this.machineConnected) void this.loadMachineInfo();
        this.updateScaleHunt();
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
      const [profiles, workflow, categories, beans, batches, guide, defaultBags, coffeeColours, guideWorkflow, grinders] = await Promise.all([
        gateway.getProfiles(),
        gateway.getWorkflow(),
        gateway.storeGet(CATEGORIES_KEY),
        gateway.getBeans(),
        gateway.getBatches(),
        gateway.storeGet(GUIDE_KEY).catch(() => null),
        gateway.storeGet(DEFAULT_BAGS_KEY).catch(() => null),
        gateway.storeGet(COFFEE_COLOURS_KEY).catch(() => null),
        gateway.storeGet(WORKFLOW_KEY).catch(() => null),
        gateway.getGrinders().catch(() => [] as Grinder[]),
      ]);
      this.guideWorkflow = normaliseWorkflow(guideWorkflow, cloneWorkflow(EDITION.guide.presets[0]!.workflow));
      this.grinders = Array.isArray(grinders) ? grinders : [];
      this.guide = parseGuideSetup(guide);
      this.defaultBags = parseDefaultBags(defaultBags);
      this.coffeeColours = parseBagColours(coffeeColours);
      this.profiles = profiles;
      this.workflow = workflow;
      this.categories = parseCategories(categories);
      this.beans = beans;
      this.batches = batches;
      this.error = null;
      this.loaded = true;
      // Big, so they load after everything else (the background first: it's on screen).
      void this.loadAppBackground().then(() => this.loadScreensaver()).then(() => this.moveBagPhotos());
    } catch (e) {
      this.error = `Couldn't reach Decaid: ${(e as Error).message}`;
    }
  }

  private onMachine(f: MachineSnapshot): void {
    this.machine = f;
    this.updateScaleHunt();
    const wasActive = this.recorder.active;
    if (this.recorder.onMachine(f)) {
      this.shot = this.recorder.samples.slice();
    }
    this.shotActive = this.recorder.active;
    if (wasActive && !this.recorder.active) {
      this.shotsFinished++;
      // The pulled profile's tile preview should show this shot now.
      this.previewAsked.clear();
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
      this.updateScaleHunt();
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
  /** Brew panel "Don't track": the last settings used without a bag, per profile (this session only). */
  untrackedDialIn: Record<string, DialIn> = {};

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
    this.loadedProfileRoot = profileRoot;
    await this.applyLookAhead(profileRoot).catch(() => {});
  }

  async saveDialIn(batch: BeanBatch, profileRoot: string, dialIn: DialIn): Promise<void> {
    const updated = await gateway.updateBatch(batch.id, { extras: withDialIn(batch, profileRoot, dialIn) });
    this.batches = this.batches.map((b) => (b.id === updated.id ? updated : b));
  }

  /** Coffee photos by bean id (KV beanPhoto:<id>), loaded on demand. Missing = not known yet, null = none. */
  beanPhotos = $state<Record<string, string | null>>({});
  private photoLoads = new Set<string>();

  /** Load a coffee's photo, then work out its colour if that hasn't been done. */
  async loadBeanPhoto(beanId: string): Promise<void> {
    if (beanId in this.beanPhotos || this.photoLoads.has(beanId)) return;
    this.photoLoads.add(beanId);
    const raw = await gateway.storeGet<string>(beanPhotoKey(beanId)).catch(() => null);
    this.photoLoads.delete(beanId);
    // A save or remove that finished meanwhile wins over what was read before it.
    if (beanId in this.beanPhotos) return;
    const url = typeof raw === 'string' && raw.startsWith('data:image/') ? raw : null;
    this.beanPhotos[beanId] = url;
    if (url && !(beanId in this.coffeeColours)) void this.computeCoffeeColour(beanId, url);
  }

  /** Bags used to have their own photos (KV photo:<batchId>). Once ever (KV photosMoved),
   *  each coffee without a photo takes over its newest bag's photo. Reads one at a time. */
  private async moveBagPhotos(): Promise<void> {
    try {
      if ((await gateway.storeGet(PHOTOS_MOVED_KEY)) === true) return;
      for (const bean of this.beans) {
        const own = await gateway.storeGet<string>(beanPhotoKey(bean.id)).catch(() => null);
        if (typeof own === 'string' && own.startsWith('data:image/')) continue;
        const bags = this.batches.filter((b) => b.beanId === bean.id).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        for (const b of bags) {
          const old = await gateway.storeGet<string>(photoKey(b.id)).catch(() => null);
          if (typeof old === 'string' && old.startsWith('data:image/')) {
            await gateway.storeSet(beanPhotoKey(bean.id), old);
            if (!this.beanPhotos[bean.id]) {
              this.beanPhotos[bean.id] = old;
              if (!(bean.id in this.coffeeColours)) void this.computeCoffeeColour(bean.id, old);
            }
            break;
          }
        }
      }
      await gateway.storeSet(PHOTOS_MOVED_KEY, true);
    } catch { /* tried again next time the skin loads */ }
  }

  /** Save a coffee photo. Its colour is worked out from it, unless `colour` is given (picked by hand; null = no colour). */
  async saveBeanPhoto(beanId: string, dataUrl: string, colour?: string | null): Promise<void> {
    await gateway.storeSet(beanPhotoKey(beanId), dataUrl);
    this.beanPhotos[beanId] = dataUrl;
    if (colour !== undefined) this.setCoffeeColour(beanId, colour);
    else void this.computeCoffeeColour(beanId, dataUrl);
  }

  async removeBeanPhoto(beanId: string): Promise<void> {
    await gateway.storeDelete(beanPhotoKey(beanId));
    this.beanPhotos[beanId] = null;
    this.setCoffeeColour(beanId, null);
  }

  /** Set a coffee's colour by hand (Edit coffee); null = no colour. Batched like computed ones. */
  setCoffeeColour(beanId: string, colour: string | null): void {
    this.coffeeColours = { ...this.coffeeColours, [beanId]: colour };
    this.pendingColours[beanId] = colour;
    clearTimeout(this.colourTimer);
    this.colourTimer = setTimeout(() => void this.flushColours(), 600);
  }

  private pendingColours: BagColours = {};
  private colourTimer: ReturnType<typeof setTimeout> | undefined;

  private async computeCoffeeColour(beanId: string, dataUrl: string): Promise<void> {
    const colour = await vividColourOfDataUrl(dataUrl);
    if (this.beanPhotos[beanId] !== dataUrl) return;
    this.setCoffeeColour(beanId, colour);
  }

  /** One write per burst, merged with a fresh read so another tablet's colours survive. */
  private async flushColours(): Promise<void> {
    const pending = this.pendingColours;
    this.pendingColours = {};
    try {
      const stored = parseBagColours(await gateway.storeGet(COFFEE_COLOURS_KEY).catch(() => null));
      await gateway.storeSet(COFFEE_COLOURS_KEY, { ...stored, ...pending });
    } catch { /* recomputed next time the photo loads */ }
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
    await this.noteStopRead(shot).catch(() => {});
    const batchId = shot.workflow?.context?.beanBatchId;
    const dose = doseOf(shot);
    if (!batchId || dose === null) return;
    const stats = shotStats(samplesFromMeasurements(shot.measurements ?? []));
    // Read the bag fresh: another tablet may have counted this shot already.
    const batch = await gateway.getBatch(batchId).catch(() => undefined);
    if (!shouldDecrement(shot, stats, batch)) return;
    this.replaceBatch(await gateway.updateBatch(batchId, applyDecrement(batch!, shotId, dose)));
  }

  // ---- Stop-at-weight look-ahead, per profile, tuned from real shots (lib/stopTuning.ts)
  // Decaid has one look-ahead for every shot; the skin keeps one per profile and
  // puts it on Decaid whenever that profile goes on the machine (applySelection).
  tune = $state<TuneDoc>({ auto: false, profiles: {} });
  /** The profile the skin last put on the machine (lineage root). */
  loadedProfileRoot: string | null = null;
  /** What the skin last set Decaid's look-ahead to, so a repeat isn't sent. */
  private lookAheadSent: number | null = null;
  private stopTuneLoaded: Promise<void> | null = null;
  loadStopTune(): Promise<void> {
    this.stopTuneLoaded ??= gateway.storeGet<unknown>(STOP_TUNE_KEY).then((doc) => { this.tune = parseTune(doc); }, () => {});
    return this.stopTuneLoaded;
  }
  private async saveTune(next: TuneDoc): Promise<void> {
    // Before the first profile gets its own value, remember Decaid's as the default for the rest.
    if (next.base === undefined && Object.values(next.profiles).some((t) => t.lookAhead !== undefined)) {
      const now = await this.decaidLookAhead().catch(() => null);
      if (now !== null) next = { ...next, base: now };
    }
    this.tune = next;
    await gateway.storeSet(STOP_TUNE_KEY, $state.snapshot(this.tune));
  }
  private async decaidLookAhead(): Promise<number> {
    return parseAppSettings(await gateway.getAppSettings()).weightFlowMultiplier;
  }
  /** Puts this profile's look-ahead (else the default) on Decaid, when it isn't there already. */
  async applyLookAhead(root: string, force = false): Promise<void> {
    await this.loadStopTune();
    const want = lookAheadFor(this.tune, root);
    if (want === null || (!force && this.lookAheadSent === want)) return;
    await gateway.saveAppSettings({ weightFlowMultiplier: want });
    this.lookAheadSent = want;
  }
  async setAutoTune(on: boolean): Promise<void> {
    await this.loadStopTune();
    await this.saveTune(withAuto(this.tune, on));
    if (on && this.loadedProfileRoot) await this.applyLookAhead(this.loadedProfileRoot, true);
  }
  /** One profile's own look-ahead; null = back to the default. */
  async setProfileLookAhead(root: string, value: number | null): Promise<void> {
    await this.loadStopTune();
    await this.saveTune(withLookAhead(this.tune, root, value));
    if (this.loadedProfileRoot === root) await this.applyLookAhead(root, true);
  }
  /** The look-ahead for profiles without their own (the Settings stepper). */
  async setBaseLookAhead(value: number): Promise<void> {
    await this.loadStopTune();
    await this.saveTune({ ...this.tune, base: clampLookAhead(value) });
    const root = this.loadedProfileRoot;
    if (!root || this.tune.profiles[root]?.lookAhead === undefined) {
      await gateway.saveAppSettings({ weightFlowMultiplier: this.tune.base });
      this.lookAheadSent = this.tune.base ?? null;
    }
  }
  /** The default look-ahead: the saved one, else whatever Decaid has now. */
  async baseLookAhead(): Promise<number> {
    await this.loadStopTune();
    return this.tune.base ?? await this.decaidLookAhead();
  }
  /** After a shot: remember how it landed under its profile; with auto on, that profile's look-ahead follows. */
  private async noteStopRead(shot: ShotRecord): Promise<void> {
    const read = stopRead(shot);
    if (!read) return;
    const root = findProfileRoot(shot.workflow?.profile, this.profileLineages);
    if (!root) return;
    await this.loadStopTune();
    await this.saveTune(withRead(this.tune, root, read));
    if (this.tune.auto && this.loadedProfileRoot === root) await this.applyLookAhead(root);
  }
  /** Fill the reads from recent history (Settings, while there are few). */
  async readRecentStops(): Promise<void> {
    await this.loadStopTune();
    if (allReads(this.tune).length >= KEEP_READS) return;
    const page = await gateway.getShots({ limit: 20 });
    const have = new Set(Object.values(this.tune.profiles).flatMap((t) => t.reads.map((r) => r.id)));
    let doc = this.tune;
    // Oldest first, so each profile's list ends newest first.
    for (const s of page.items.filter((x) => x.stopReason === 'targetWeight' && !have.has(x.id)).slice(0, 10).reverse()) {
      const shot = await gateway.getShot(s.id);
      const read = stopRead(shot);
      const root = read && findProfileRoot(shot.workflow?.profile, this.profileLineages);
      if (read && root) doc = withRead(doc, root, read);
    }
    if (doc !== this.tune) await this.saveTune(doc);
  }
  /** Use a profile's suggestion now (Settings). */
  async useSuggestion(root: string): Promise<void> {
    const s = suggestFor(this.tune, root);
    if (s) await this.setProfileLookAhead(root, s.lookAhead);
  }

  // ---- Skin updates, checked quietly each time the machine wakes -------------
  /** A newer installed version waiting for a reload (shown as Update in the top bar). */
  skinUpdate = $state<string | null>(null);
  async checkUpdatesQuietly(): Promise<void> {
    const r = await this.checkSkinUpdates();
    if (r.kind === 'updated') this.skinUpdate = r.installed;
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
  /**
   * New profile → From Visualizer: the plugin looks up the share code, fetches
   * that shot's profile and saves it in Decaid. Returns the saved record (newest
   * version of its lineage), so the editor can open it.
   */
  async importFromVisualizer(code: string): Promise<ProfileRecord | null> {
    const r = await gateway.callPlugin<{ profileId?: string | null; profileTitle?: string }>(VISUALIZER_ID, 'import', { shareCode: code });
    this.profiles = await gateway.getProfiles();
    const byId = r.profileId ? this.profiles.find((p) => p.id === r.profileId) : undefined;
    const found = byId ?? [...this.profiles].reverse().find((p) => p.profile.title === r.profileTitle);
    if (!found) return null;
    const root = lineageRoot(found.id, this.profilesById);
    return this.profileLineages.get(root) ?? found;
  }
  /** Upload one shot through the plugin. Returns the Visualizer id. */
  async uploadToVisualizer(shotId: string): Promise<string> {
    const r = await gateway.callPlugin<{ visualizer_id?: string | number }>(VISUALIZER_ID, 'upload', { shotId });
    return String(r.visualizer_id ?? '');
  }

  async saveGuide(setup: GuideSetup): Promise<void> {
    await gateway.storeSet(GUIDE_KEY, setup);
    this.guide = setup;
  }

  /** Save the guide's steps. Photos of steps that went away are deleted. */
  async saveGuideWorkflow(next: GuideWorkflow): Promise<void> {
    const before = this.guideWorkflow;
    await gateway.storeSet(WORKFLOW_KEY, next);
    this.guideWorkflow = next;
    for (const id of orphanedStepIds(before, next)) {
      if (this.stepPhotos[id]) void gateway.storeDelete(stepPhotoKey(id)).catch(() => {});
      delete this.stepPhotos[id];
    }
  }

  async loadStepPhoto(stepId: string): Promise<void> {
    if (stepId in this.stepPhotos || this.stepPhotoLoads.has(stepId)) return;
    this.stepPhotoLoads.add(stepId);
    const raw = await gateway.storeGet<string>(stepPhotoKey(stepId)).catch(() => null);
    this.stepPhotoLoads.delete(stepId);
    if (stepId in this.stepPhotos) return; // a save or remove that finished meanwhile wins
    this.stepPhotos[stepId] = typeof raw === 'string' && raw.startsWith('data:image/') ? raw : null;
  }

  async saveStepPhoto(stepId: string, dataUrl: string): Promise<void> {
    await gateway.storeSet(stepPhotoKey(stepId), dataUrl);
    this.stepPhotos[stepId] = dataUrl;
  }

  async removeStepPhoto(stepId: string): Promise<void> {
    await gateway.storeDelete(stepPhotoKey(stepId));
    this.stepPhotos[stepId] = null;
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
    const theme = parseTheme(await gateway.storeGet(THEME_KEY).catch(() => null));
    this.screensaverArt = theme.halloween;
    this.screensaverClock = theme.clock;
    this.tilePreview = theme.tilePreview;
    this.bgTone = theme.bgTone;
    this.panelTint = theme.panelTint;
  }

  async setScreensaverArt(on: boolean): Promise<void> {
    this.screensaverArt = on;
    await this.saveTheme();
  }

  async setPanelTint(tint: PanelTint): Promise<void> {
    this.panelTint = tint;
    await this.saveTheme();
  }

  async setTilePreview(mode: TilePreview): Promise<void> {
    this.tilePreview = mode;
    await this.saveTheme();
  }

  /**
   * Last-shot samples per profile title, for the tile previews: null = no shot
   * (or not loaded yet). Fetched one at a time (Decaid doesn't like bursts),
   * once per title per session, and again after a pull.
   */
  previewShots = $state.raw<Record<string, ShotSample[] | null>>({});
  private previewQueue: string[] = [];
  private previewBusy = false;
  private previewAsked = new Set<string>();
  wantPreviewShot(title: string): void {
    if (this.previewAsked.has(title)) return;
    this.previewAsked.add(title);
    this.previewQueue.push(title);
    void this.drainPreviews();
  }
  private async drainPreviews(): Promise<void> {
    if (this.previewBusy) return;
    this.previewBusy = true;
    try {
      while (this.previewQueue.length) {
        const title = this.previewQueue.shift()!;
        const shot = await this.lastShotFor(title).catch(() => null);
        const samples = shot ? samplesFromMeasurements(shot.measurements ?? []) : [];
        this.previewShots = { ...this.previewShots, [title]: samples.length ? samples : null };
      }
    } finally { this.previewBusy = false; }
  }

  async setScreensaverClock(on: boolean): Promise<void> {
    this.screensaverClock = on;
    await this.saveTheme();
  }

  private saveTheme(): Promise<void> {
    return gateway.storeSet(THEME_KEY, { halloween: this.screensaverArt, clock: this.screensaverClock, tilePreview: this.tilePreview, bgTone: this.bgTone, panelTint: this.panelTint }).catch(() => {});
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

  /** Photo behind the whole app (KV appBackground), shrunk like the screensaver. */
  async setAppBackground(file: Blob): Promise<void> {
    const url = await fitDataUrl((edge, quality) => toJpegDataUrl(file, edge, quality));
    await gateway.storeSet(APP_BACKGROUND_KEY, url);
    this.appBackground = url;
  }

  async removeAppBackground(): Promise<void> {
    await gateway.storeDelete(APP_BACKGROUND_KEY);
    this.appBackground = null;
  }

  async loadAppBackground(): Promise<void> {
    const url = await gateway.storeGet<string>(APP_BACKGROUND_KEY).catch(() => null);
    this.appBackground = typeof url === 'string' && url.startsWith('data:image/') ? url : null;
  }

  /** Darken/lighten slider: applied at once, saved 400 ms after the last move. */
  private toneTimer: ReturnType<typeof setTimeout> | null = null;
  setBgTone(value: number): void {
    this.bgTone = clampTone(value);
    if (this.toneTimer) clearTimeout(this.toneTimer);
    this.toneTimer = setTimeout(() => { this.toneTimer = null; void this.saveTheme(); }, 400);
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

  /** Id of the newest shot pulled with this profile (by title) and this bag, or null. */
  async lastShotIdWith(profileTitle: string, batchId: string): Promise<string | null> {
    const page = await gateway.getShots({ profileTitle, beanBatchId: batchId, limit: 1 });
    return page.items[0]?.id ?? null;
  }

  /** The newest shot pulled with this profile (by title) and this bag, with its graph. */
  async lastShotWith(profileTitle: string, batchId: string): Promise<ShotRecord | null> {
    const id = await this.lastShotIdWith(profileTitle, batchId);
    return id ? gateway.getShot(id) : null;
  }

  async wake(): Promise<void> { await gateway.requestState('idle'); }
  async sleep(): Promise<void> { await gateway.requestState('sleeping'); }

  async startEspresso(): Promise<void> { await gateway.requestState('espresso'); }
  async stop(): Promise<void> { await gateway.requestState('idle'); }
  async tare(): Promise<void> { await gateway.tareScale(); }
  /** Set (or with null, clear) the bag a profile's brew panel starts on. */
  async setDefaultBag(profileRoot: string, batchId: string | null): Promise<void> {
    const before = this.defaultBags;
    const next = { ...before };
    if (batchId) next[profileRoot] = batchId; else delete next[profileRoot];
    this.defaultBags = next;
    try { await gateway.storeSet(DEFAULT_BAGS_KEY, next); } catch (e) { this.defaultBags = before; throw e; }
  }

  /** Settings → Check for skin updates. */
  async checkSkinUpdates(): Promise<SkinUpdateResult> {
    try {
      await gateway.checkSkinUpdates();
      return skinUpdateResult(__APP_VERSION__, await gateway.installedSkinVersion(EDITION.skinId).catch(() => null));
    } catch (e) {
      return { kind: 'failed', message: updateErrorText(e instanceof HttpError ? e.body : (e as Error).message) };
    }
  }

  scanForScale(): void {
    // A scan is already running: another would only supersede it.
    if (this.scanning) return;
    gateway.scanDevices();
  }

  // Automatic scale search (lib/scaleHunt): a few spaced-out scans while the
  // machine is up and awake with no scale, reset each time that changes.
  private huntTimer: ReturnType<typeof setTimeout> | undefined;
  private huntAttempt = 0;
  private hunting = false;
  private updateScaleHunt(): void {
    const want = shouldHunt({ machineConnected: this.machineConnected && !this.mock, asleep: this.asleep, scaleConnected: this.scaleConnected, shotActive: this.shotActive });
    if (want === this.hunting) return;
    this.hunting = want;
    clearTimeout(this.huntTimer);
    this.huntTimer = undefined;
    this.huntAttempt = 0;
    if (want) this.scheduleHunt();
  }
  private scheduleHunt(): void {
    this.huntTimer = setTimeout(() => {
      if (!this.hunting) return;
      this.huntAttempt++;
      this.scanForScale();
      this.scheduleHunt();
    }, huntDelay(this.huntAttempt));
  }
  /** Back to a quick scan when the tablet's screen comes back on. */
  private restartScaleHunt(): void {
    if (!this.hunting) return;
    clearTimeout(this.huntTimer);
    this.huntAttempt = 0;
    this.scheduleHunt();
  }
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

  /** Settings → Machine: hot water and flush, through the workflow (Decaid writes them to the machine). */
  async saveWaterSettings(patch: Pick<WorkflowPatch, 'hotWaterData' | 'rinseData'>): Promise<void> {
    this.workflow = await gateway.updateWorkflow(patch);
  }
}

export const app = new AppState();
