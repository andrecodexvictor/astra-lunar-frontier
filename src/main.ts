import './presentation/style.css';
import { SOURCE_REPOSITORY_URL, RELEASE_LABEL } from './app/release';
import type {
  AuxBayPortType,
  AuxVisualState,
  CadetAppearance,
  CometaRuntimeMode,
  CometaRuntimeState,
  FieldKitPieceId,
  GameWorld,
  RegionId,
  WorldMetrics,
  WorldTarget,
} from './contracts';
import { REGIONS } from './world/manifest';
import {
  applyAction,
  AUX_BAY_PORTS,
  AUX_PORT_INSTALL_KWH,
  BEAT_IDS,
  CARGO_CAPACITY_KG,
  DEFAULT_CARGO_IDS,
  DEFAULT_LOADOUT_IDS,
  FIELD_KIT_COST_KWH,
  FIELD_KIT_PIECES,
  FIELD_KIT_SLOTS,
  FIELD_LOCKER_ITEMS,
  getActiveEpisodeBeat,
  getObjectives,
  getReport,
  LOADOUT_CAPACITY_KG,
  ORBIT_CARGO_ITEMS,
  stepGame,
  type Action,
  type BeatId,
  type CargoCatalogItem,
  type DiscoveryClassification,
  type DiscoveryId,
  type DiscoveryStatus,
  type GameState,
} from './simulation';
import { MissionClock } from './app/clock';
import {
  defaultCadetAppearance,
  loadSavedFile,
  newSave,
  persistSavedFile,
  snapshot,
  type SaveFile,
} from './app/save';
import {
  auxBayPortLabels,
  cadetAppearanceOptions,
  cargoCatalogLabels,
  discoveryCatalogLabels,
  episode01Beats,
  fieldKitPieceLabels,
  fieldLockerCatalogLabels,
  objectiveNames,
  regionNames,
  speakerPortraits,
  stations,
  targetNames,
  topicFacts,
  type EpisodeBeatSpec,
  type SpeakerPortraitId,
} from './app/catalogue';
import { renderPortraitSvg } from './presentation/portraits';
import { renderResourceHud, resourceReminder, resourceReminderTarget } from './presentation/resourceHud';

export type TouchControlsPref = 'auto' | 'on' | 'off';

export interface ScienceSource {
  id: string;
  title: string;
  url: string;
  classification?: string;
  parameterProvenance?: string;
  fact: string;
  simplification: string;
  usageNotes: string;
}

const TOUCH_PREF_KEY = 'astra-touch-controls-pref';

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

export function fmtPt(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function computeMassSelection(
  selectedIds: readonly string[],
  catalog: Record<string, CargoCatalogItem>,
  capacityKg: number,
): { ids: string[]; massKg: number; overLimit: boolean; remainingKg: number } {
  const uniqueIds = Array.from(new Set(selectedIds)).filter((id) => Boolean(catalog[id]));
  const massKg = uniqueIds.reduce((sum, id) => sum + catalog[id].massKg, 0);
  return {
    ids: uniqueIds,
    massKg,
    overLimit: massKg > capacityKg,
    remainingKg: capacityKg - massKg,
  };
}

export function isPressurizedArea(s: GameState): boolean {
  return (
    s.region === 'academy' ||
    s.region === 'greenhouse' ||
    (s.region === 'habitat' && s.flags.sheltered)
  );
}

export function computeAuxVisualState(s: GameState): AuxVisualState {
  const powerLive = s.modules.power.connected && s.modules.power.enabled && s.modules.power.integrity >= 0.8;
  const auxSolarKw =
    (s.auxBay.ports.power && powerLive ? 0.5 : 0) +
    (s.fieldKit.slots.includes('sensor_pylon') && powerLive ? 0.3 : 0);
  return {
    ports: { ...s.auxBay.ports },
    fieldKitSlots: [...s.fieldKit.slots],
    auxSolarKw,
    stormShieldActive: s.fieldKit.slots.includes('thermal_shield'),
    telemetryRangeM: s.pipTelemetryRangeM,
  };
}

export function buildCometaRuntimeState(
  s: GameState,
  lastCue: CometaRuntimeState['lastCue'] = null,
): CometaRuntimeState {
  return {
    enabled: s.cometa.enabled,
    mode: s.cometa.mode,
    region: s.cometa.region,
    safePos: { ...s.cometa.safePos },
    heading: s.cometa.heading,
    targetId: s.cometa.safeTargetId,
    safeTargetId: s.cometa.safeTargetId,
    pressurized: isPressurizedArea(s),
    lastCue,
  };
}

export function getEpisodeBeatDisplay(
  s: GameState,
  requestedBeatId?: BeatId,
): {
  beat: EpisodeBeatSpec;
  activeBeatId: BeatId;
  visited: boolean;
  skipped: boolean;
  canSkip: boolean;
  stormOverride: boolean;
  toneSelected?: string;
} {
  const activeBeatId = getActiveEpisodeBeat(s);
  const beatId = requestedBeatId && episode01Beats[requestedBeatId] ? requestedBeatId : activeBeatId;
  const beat = episode01Beats[beatId];
  return {
    beat,
    activeBeatId,
    visited: s.episode.visitedBeats.includes(beatId),
    skipped: s.episode.skippedBeats.includes(beatId),
    canSkip: beat.skippable,
    stormOverride:
      (s.storm === 'warning' || s.storm === 'active') &&
      s.phase === 'lunar' &&
      !s.flags.sheltered,
    toneSelected: s.episode.choices.tone[beatId],
  };
}

export function getScienceProvenanceBadge(provenance?: string): {
  label: string;
  kind: 'hypothesis' | 'fiction' | 'verified';
} {
  if (provenance === 'verified_source_media' || provenance === 'verified_telemetry') {
    return { label: 'Telemetria / Mídia Verificada', kind: 'verified' };
  }
  if (provenance === 'fictional_abstraction') {
    return { label: 'Ficção de Treinamento', kind: 'fiction' };
  }
  return { label: 'Hipótese Didática', kind: 'hypothesis' };
}

export function getDiscoveryStatusLabel(status: DiscoveryStatus): string {
  const labels: Record<DiscoveryStatus, string> = {
    unavailable: 'Indisponível nesta região',
    detectable: 'Detectável no campo',
    observed: 'Evidência observada',
    investigating: 'Sonda medida — classificar',
    resolved: 'Resolvida (+25 XP)',
    deferred: 'Adiada (opcional)',
  };
  return labels[status];
}

export function computeVirtualStickAxes(
  dx: number,
  dz: number,
  radiusPx: number,
  deadzone = 0.2,
): { x: number; z: number } {
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(radiusPx) || radiusPx <= 0) {
    return { x: 0, z: 0 };
  }
  const safeDeadzone = Math.max(0, Math.min(0.95, deadzone));
  const nx = dx / radiusPx;
  const nz = dz / radiusPx;
  const mag = Math.hypot(nx, nz);
  if (mag <= safeDeadzone || mag === 0) {
    return { x: 0, z: 0 };
  }
  const rescaled = Math.min((mag - safeDeadzone) / (1 - safeDeadzone), 1);
  return {
    x: Number(((nx / mag) * rescaled).toFixed(4)),
    z: Number(((nz / mag) * rescaled).toFixed(4)),
  };
}

export function shouldShowTouchControls(
  pref: TouchControlsPref,
  isCoarsePointer: boolean,
  viewportWidth: number,
): boolean {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return isCoarsePointer || viewportWidth <= 800;
}

export function computeUniformPaused(opts: {
  started: boolean;
  menu: string | null;
  transitioning: boolean;
  hidden: boolean;
  phase: GameState['phase'];
}): boolean {
  return (
    !opts.started ||
    Boolean(opts.menu) ||
    opts.transitioning ||
    opts.hidden ||
    opts.phase === 'failed' ||
    opts.phase === 'complete'
  );
}

export function shouldPersistOnBackground(started: boolean): boolean {
  return started === true;
}

export function shouldUpdateMarkup(
  cache: Map<string, string>,
  key: string,
  nextHtml: string,
): boolean {
  if (cache.get(key) === nextHtml) return false;
  cache.set(key, nextHtml);
  return true;
}

export function stabilizePortraitIds(svg: string, stablePrefix: string): string {
  return svg.replace(/\bp\d+-/g, `${stablePrefix}-`);
}

const PORTAL_DESTINATIONS: Record<string, RegionId> = {
  'academy-launch': 'orbit',
  'lunar-transfer': 'habitat',
  'expedition-gate': 'canyon',
  'greenhouse-door': 'greenhouse',
  'return-gate': 'habitat',
  'return-habitat': 'habitat',
};

const PORTAL_PORTRAITS: Record<string, SpeakerPortraitId> = {
  'academy-launch': 'reyes',
  'lunar-transfer': 'reyes',
  'expedition-gate': 'lia',
  'greenhouse-door': 'elena',
  'return-gate': 'pip',
  'return-habitat': 'elena',
};

const ACTION_CLIP_MAP: Partial<
  Record<Action, Array<{ actorId: string; clip: string; loop?: boolean }>>
> = {
  petCometa: [
    { actorId: 'astronaut', clip: 'PetCometa', loop: false },
    { actorId: 'cometa', clip: 'ReceivePet', loop: false },
  ],
  cometaSniff: [{ actorId: 'cometa', clip: 'Sniff', loop: false }],
  cometaLookBeacon: [{ actorId: 'cometa', clip: 'LookAtBeacon', loop: false }],
  diagnoseAcademy: [
    { actorId: 'astronaut', clip: 'Inspect', loop: false },
    { actorId: 'pip', clip: 'Scan', loop: false },
  ],
  scanSolar: [
    { actorId: 'astronaut', clip: 'Inspect', loop: false },
    { actorId: 'pip', clip: 'Scan', loop: false },
  ],
  scanWater: [
    { actorId: 'astronaut', clip: 'Inspect', loop: false },
    { actorId: 'pip', clip: 'Scan', loop: false },
  ],
  inspectEvidence: [
    { actorId: 'astronaut', clip: 'Inspect', loop: false },
    { actorId: 'pip', clip: 'Scan', loop: false },
  ],
  runFieldProbe: [
    { actorId: 'astronaut', clip: 'Inspect', loop: false },
    { actorId: 'pip', clip: 'Scan', loop: false },
  ],
  repairPower: [{ actorId: 'astronaut', clip: 'Repair', loop: false }],
  repairWater: [{ actorId: 'astronaut', clip: 'Repair', loop: false }],
  repairOxygen: [{ actorId: 'astronaut', clip: 'Repair', loop: false }],
  repairCompanion: [{ actorId: 'astronaut', clip: 'Repair', loop: false }],
  dispatchScoutScan: [{ actorId: 'scout', clip: 'Scan', loop: false }],
  recruitCompanion: [{ actorId: 'scout', clip: 'Acknowledge', loop: false }],
};

function loadTouchPref(): TouchControlsPref {
  try {
    const raw = localStorage.getItem(TOUCH_PREF_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'auto') return raw;
  } catch {
    // Ignore storage block and keep default auto preference.
  }
  return 'auto';
}

function saveTouchPref(pref: TouchControlsPref): void {
  try {
    localStorage.setItem(TOUCH_PREF_KEY, pref);
  } catch {
    // Ignore storage block cleanly.
  }
}

export function mountAstraApp(): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;
  const app = appRoot;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

  app.innerHTML = `<canvas id="world" tabindex="0" aria-label="Mundo ASTRA em terceira pessoa. Use WASD para mover e arraste o mouse para olhar."></canvas>
<div class="vignette" aria-hidden="true"></div>
<div id="hud" class="hud" data-testid="hud-root">
  <header class="top">
    <a class="brand" href="#" data-menu="pause" aria-label="Pausar ASTRA">ASTRA<span>JUNIOR ASTRONAUT ODYSSEY</span></a>
    <div class="location">
      <span class="eyebrow">EXPEDIÇÃO 01 • UMA LUZ DE CADA VEZ</span>
      <strong id="region" data-testid="hud-region">Academia Terra</strong>
      <span id="time" data-testid="hud-time">T+ 00:00 • PAUSADO</span>
    </div>
    <div id="resources" class="resources" data-testid="hud-resources"></div>
  </header>

  <aside class="mission card" aria-label="Diário de bordo">
    <span class="eyebrow">DIÁRIO DE BORDO</span>
    <div id="objective" data-testid="hud-objective"></div>
    <div class="mission-links">
      <button class="text-button" data-menu="quests" data-testid="btn-quests">Ver missão <kbd>Tab</kbd></button>
      <button class="text-button" data-menu="episode" data-testid="btn-episode">Falas <kbd>H</kbd></button>
    </div>
  </aside>

  <div class="side-tools" aria-label="Atalhos da expedição">
    <button data-menu="episode" data-testid="btn-side-episode" aria-label="Abrir diálogo e histórico do Episódio 01">✦<span>Episódio <kbd>H</kbd></span></button>
    <button data-menu="journal" data-testid="btn-journal" aria-label="Abrir diário científico">✧<span>Ciência <kbd>J</kbd></span></button>
    <button data-menu="map" data-testid="btn-map" aria-label="Abrir mapa">⌖<span>Mapa <kbd>M</kbd></span></button>
    <button data-menu="companions" data-testid="btn-companions" aria-label="Equipe de companheiros e Cometa">◉<span>Equipe <kbd>C</kbd></span></button>
    <button data-menu="settings" data-testid="btn-settings" aria-label="Configurações e acessibilidade">⚙<span>Opções</span></button>
    <button data-menu="pause" data-testid="btn-pause" aria-label="Pausar simulação">⏸<span>Pausa <kbd>Esc</kbd></span></button>
  </div>

  <aside id="pip" class="pip card" data-testid="hud-pip" aria-label="Assistente PIP e episódio"></aside>

  <div id="storm" class="storm" data-testid="storm-banner" role="status" aria-live="polite" hidden></div>

  <div id="cometa-strip" class="cometa-strip card" data-testid="cometa-hud-strip" aria-label="Controles do buddy Cometa"></div>

  <div id="interact" class="interaction" data-testid="hud-interact"></div>

  <footer class="bottom">
    <div class="region-map card">
      <canvas id="radar" width="144" height="144" aria-label="Mapa local: você em laranja, estações em ciano"></canvas>
      <span id="map-label">MAPA LOCAL</span>
    </div>
    <div class="inventory card" id="inventory" data-testid="hud-inventory"></div>
    <div class="controls card">
      <span><kbd>WASD</kbd> mover</span>
      <span><kbd>Shift</kbd> correr</span>
      <span><kbd>Espaço</kbd> saltar</span>
      <span><kbd>E</kbd> interagir</span>
      <button class="text-button" data-menu="pause" data-testid="btn-footer-pause"><kbd>Esc</kbd> pausa</button>
    </div>
  </footer>

  <div id="touch-controls" class="touch-controls" data-testid="touch-controls" hidden aria-label="Controles na tela">
    <div class="touch-dpad" data-testid="touch-dpad" role="group" aria-label="Direcional de movimento">
      <button type="button" class="touch-btn up" data-touch-move="forward" aria-label="Mover para frente">▲<span>Frente</span></button>
      <button type="button" class="touch-btn left" data-touch-move="left" aria-label="Mover para esquerda">◀<span>Esq</span></button>
      <button type="button" class="touch-btn right" data-touch-move="right" aria-label="Mover para direita">▶<span>Dir</span></button>
      <button type="button" class="touch-btn down" data-touch-move="back" aria-label="Mover para trás">▼<span>Trás</span></button>
    </div>
    <div class="touch-actions" role="group" aria-label="Ações de exploração">
      <button type="button" class="touch-action" data-testid="touch-sprint" data-touch-sprint aria-pressed="false" aria-label="Alternar corrida">⚡<span>Correr</span></button>
      <button type="button" class="touch-action" data-testid="touch-jump" data-touch-jump aria-label="Saltar">⤒<span>Saltar</span></button>
      <button type="button" class="touch-action primary" data-testid="touch-interact" data-touch-interact aria-label="Interagir com estação próxima">✋<span>Interagir</span></button>
    </div>
  </div>

  <div id="metrics" hidden></div>
</div>
<div id="modal-layer" class="modal-layer" hidden></div>
<div id="toast" class="toast" data-testid="toast" role="status" aria-live="polite"></div>
<div id="loading" class="loading" data-testid="loading-overlay">
  <div class="orbit-mark">A</div>
  <h1>Preparando a expedição</h1>
  <p>Carregando modelos 3D locais e a base de treinamento…</p>
</div>`;

  // Load saved state via src/app/save.ts with v1/v2/v3 -> v4 migration & corrupted/blocked fallback.
  let file: SaveFile = newSave();
  let hasSave = false;
  let saveNotice = '';
  const initialLoad = loadSavedFile();
  if (initialLoad.ok) {
    file = initialLoad.file;
    hasSave = true;
    if (initialLoad.migratedFromVersion) {
      saveNotice = `Save legado v${initialLoad.migratedFromVersion} migrado para v4 preservando reservas reais.`;
    }
  } else {
    file = newSave();
    hasSave = false;
    if (initialLoad.reason === 'corrupted' || initialLoad.reason === 'blocked') {
      saveNotice = initialLoad.message;
    }
  }

  let state: GameState = file.current.simulation;
  let world: GameWorld | undefined;
  let near: WorldTarget | null = null;
  let menu: string | null = 'intro';
  let returnMenu: string | null = null;
  let inspected: WorldTarget | null = null;
  let transitioning = true;
  let started = false;
  let endedShown = false;
  let showMetrics = false;
  let lastSaveTick = state.tick;
  let toastTimer = 0;
  let storageWarned = false;
  let lastCometaCue: CometaRuntimeState['lastCue'] = null;

  let introCometaEnabled = file.cometa.enabled;
  let touchPref: TouchControlsPref = loadTouchPref();
  let journalTab: 'discoveries' | 'evidence' | 'sources' = 'discoveries';
  let episodeTab: 'current' | 'history' | 'all' = 'current';
  let selectedBeatId: BeatId | null = null;
  let cargoDraftIds: string[] =
    state.selectedCargoIds.length > 0 ? [...state.selectedCargoIds] : [...DEFAULT_CARGO_IDS];
  let loadoutDraftIds: string[] =
    state.selectedLoadoutIds.length > 0 ? [...state.selectedLoadoutIds] : [...DEFAULT_LOADOUT_IDS];
  let fieldKitSlotTarget = 0;
  const probeHypothesisDraft: Record<string, string> = {};

  // Active pointer tracking for virtual D-Pad + Jump + Sprint toggle
  const activeMovePointers = new Map<number, 'forward' | 'back' | 'left' | 'right'>();
  const activeJumpPointers = new Set<number>();
  let touchSprintOn = false;

  const clock = new MissionClock();
  let sources: ScienceSource[] = [];
  const hudHtmlCache = new Map<string, string>();

  function setHtmlIfChanged(id: string, html: string): void {
    const el = $(id);
    if (!el) return;
    if (shouldUpdateMarkup(hudHtmlCache, id, html)) {
      el.innerHTML = html;
    }
  }

  function renderStableHudPortrait(
    key: string,
    id: SpeakerPortraitId,
    options: Parameters<typeof renderPortraitSvg>[1],
  ): string {
    return stabilizePortraitIds(renderPortraitSvg(id, options), key);
  }

  const isPaused = (): boolean =>
    computeUniformPaused({
      started,
      menu,
      transitioning,
      hidden: typeof document !== 'undefined' ? document.hidden : false,
      phase: state.phase,
    });

  function syncTouchControlsVisibility(): void {
    const el = $('touch-controls');
    if (!el) return;
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const show =
      started &&
      !menu &&
      !transitioning &&
      shouldShowTouchControls(touchPref, Boolean(coarse), width);
    el.hidden = !show;
  }

  function syncTouchInput(): void {
    let x = 0;
    let z = 0;
    for (const dir of activeMovePointers.values()) {
      if (dir === 'left') x -= 1;
      if (dir === 'right') x += 1;
      if (dir === 'forward') z += 1;
      if (dir === 'back') z -= 1;
    }
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedZ = Math.max(-1, Math.min(1, z));
    const len = Math.hypot(clampedX, clampedZ);
    const normX = len > 1 ? clampedX / len : clampedX;
    const normZ = len > 1 ? clampedZ / len : clampedZ;

    app.querySelectorAll<HTMLElement>('[data-touch-move]').forEach((btn) => {
      const dir = btn.dataset.touchMove as 'forward' | 'back' | 'left' | 'right';
      const active = Array.from(activeMovePointers.values()).includes(dir);
      btn.classList.toggle('active', active);
    });
    const sprintBtn = app.querySelector<HTMLElement>('[data-touch-sprint]');
    if (sprintBtn) {
      sprintBtn.setAttribute('aria-pressed', String(touchSprintOn));
      sprintBtn.classList.toggle('active', touchSprintOn);
    }
    const jumpBtn = app.querySelector<HTMLElement>('[data-touch-jump]');
    if (jumpBtn) {
      jumpBtn.classList.toggle('active', activeJumpPointers.size > 0);
    }

    world?.setInput({
      x: normX,
      z: normZ,
      jump: activeJumpPointers.size > 0,
      sprint: touchSprintOn,
    });
  }

  function clearMovementInputs(): void {
    activeMovePointers.clear();
    activeJumpPointers.clear();
    touchSprintOn = false;
    syncTouchInput();
  }

  function syncPause(): void {
    const paused = isPaused();
    if (paused) {
      clearMovementInputs();
    }
    world?.setPaused(paused);
    syncTouchControlsVisibility();
  }

  function notify(message: string): void {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 6000);
  }

  function safeSave(showSuccessToast = false): void {
    file.current = snapshot(state, world?.getPose(), state.cometa);
    file.cometa = structuredClone(file.current.cometa!);
    const res = persistSavedFile(file);
    if (res.ok) {
      hasSave = true;
      storageWarned = false;
      if (showSuccessToast) notify('Expedição salva neste navegador.');
    } else if (!storageWarned || showSuccessToast) {
      storageWarned = true;
      notify(res.message);
    }
  }

  function safeCheckpoint(): void {
    file.checkpoint = snapshot(state, world?.getPose(), state.cometa);
    safeSave(false);
    notify('Checkpoint completo gravado: posição, recursos, inventário, aparência e equipe.');
  }

  function syncWorldFromState(triggerAction?: Action | string): void {
    if (!world) return;
    world.setCompanionRecruited(state.flags.scoutRecruited);
    world.setCadetAppearance?.(file.cadetAppearance);
    world.setCometaState?.(buildCometaRuntimeState(state, lastCometaCue));
    world.setAuxVisualState?.(computeAuxVisualState(state));

    if (triggerAction) {
      const clips = ACTION_CLIP_MAP[triggerAction as Action];
      if (clips) {
        for (const c of clips) {
          world.triggerActorClip?.(c);
        }
      }
      if (
        (triggerAction === 'repairPower' ||
          triggerAction === 'repairWater' ||
          triggerAction === 'repairOxygen' ||
          triggerAction === 'repairCompanion') &&
        state.cometa.enabled
      ) {
        world.triggerActorClip?.({ actorId: 'cometa', clip: 'WatchRepair', loop: false });
      }
      if (triggerAction === 'setCometaMode' && state.cometa.enabled) {
        const clip =
          state.cometa.mode === 'wait'
            ? 'Wait'
            : state.cometa.mode === 'recall'
              ? 'Recall'
              : 'WagTail';
        world.triggerActorClip?.({ actorId: 'cometa', clip, loop: state.cometa.mode === 'wait' });
      }
    }
  }

  function applySettings(): void {
    document.documentElement.classList.toggle('large-text', file.settings.largeText);
    document.documentElement.classList.toggle('reduced-motion', file.settings.reducedMotion);
    document.documentElement.classList.toggle('compact-hud', file.uiPrefs.compactHud);
    world?.setQuality(file.settings.quality);
    world?.setReducedMotion(file.settings.reducedMotion);
    syncTouchControlsVisibility();
  }

  function setMenu(value: string | null, focusSelector?: string): void {
    if (value && value !== menu && (value === 'settings' || value === 'journal' || value === 'episode')) {
      if (menu && menu !== value) returnMenu = menu;
    } else if (!value) {
      returnMenu = null;
    }
    menu = value;
    const layer = $('modal-layer');
    layer.hidden = !value;
    $('hud').inert = Boolean(value);
    $('world').inert = Boolean(value);
    if (value) {
      clearMovementInputs();
      renderMenu(focusSelector);
    } else {
      layer.innerHTML = '';
      $('world').focus();
    }
    syncPause();
    renderHud();
  }

  function modal(
    title: string,
    sub: string,
    body: string,
    wide = false,
    testId = 'modal-dialog',
    focusSelector?: string,
  ): void {
    const layer = $('modal-layer');
    layer.innerHTML = `<section class="modal ${wide ? 'wide' : ''}" data-testid="${escapeHtml(testId)}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="modal-top">
        <span class="eyebrow">${escapeHtml(sub)}</span>
        ${started ? '<button type="button" class="close" data-close data-testid="modal-close" aria-label="Fechar painel">×</button>' : ''}
      </div>
      <h1 id="dialog-title" data-testid="modal-title">${escapeHtml(title)}</h1>
      ${body}
      <div class="modal-foot">
        <span>⏸ Relógio da missão e mundo 3D pausados durante a leitura.</span>
        ${started ? '<button type="button" data-close data-testid="modal-back-explore">Voltar à exploração</button>' : ''}
      </div>
    </section>`;
    queueMicrotask(() => {
      const target = focusSelector
        ? layer.querySelector<HTMLElement>(focusSelector)
        : layer.querySelector<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])');
      target?.focus();
    });
  }

  function renderCadetCustomizer(context: 'intro' | 'settings'): string {
    const a = file.cadetAppearance;
    return `<div class="customizer card" data-testid="cadet-customizer">
      <div class="customizer-preview" data-testid="cadet-preview">
        ${renderPortraitSvg('cadet', { size: 'lg', appearance: a })}
        <div>
          <span class="eyebrow">CADETE • SEM GÊNERO FIXO</span>
          <strong>Personalize seu traje espacial</strong>
          <p class="fine">Capacete fechado com vedação pressurizada visível em cena e nos diálogos.</p>
        </div>
      </div>
      <div class="customizer-fields">
        <label>Detalhe do traje
          <select data-appearance="suitAccent" data-context="${context}" data-testid="select-suit-accent">
            ${cadetAppearanceOptions.suitAccents
              .map(
                (opt) =>
                  `<option value="${opt.id}" ${a.suitAccent === opt.id ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label>Reflexo do visor
          <select data-appearance="visorTone" data-context="${context}" data-testid="select-visor-tone">
            ${cadetAppearanceOptions.visorTones
              .map(
                (opt) =>
                  `<option value="${opt.id}" ${a.visorTone === opt.id ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label>Tom de pele
          <select data-appearance="skinTone" data-context="${context}" data-testid="select-skin-tone">
            ${cadetAppearanceOptions.skinTones
              .map(
                (opt) =>
                  `<option value="${opt.id}" ${a.skinTone === opt.id ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>
    </div>`;
  }

  function renderCometaControlsBlock(location: 'modal' | 'hud', reminder: string | null = null): string {
    const c = state.cometa;
    const pressurized = isPressurizedArea(state);
    const statusLabel = !c.enabled
      ? '○ Desativado (opcional — campanha 100% concluível sem Cometa)'
      : c.mode === 'wait'
        ? `⏸ Aguardando em ${regionNames[c.region]}`
        : c.mode === 'recall'
          ? `↩ Chamado para ${regionNames[c.region]}`
          : `🐾 Seguindo em ${regionNames[c.region]}`;

    if (location === 'hud') {
      return `<div class="cometa-hud-head">
        <div class="cometa-mini-portrait">${renderStableHudPortrait('hud-cometa', 'cometa', { size: 'sm', decorative: true, status: c.enabled ? 'active' : 'offline' })}</div>
        <div class="cometa-hud-meta">
          <span class="eyebrow">COMETA • BUDDY OPCIONAL</span>
          <strong data-testid="cometa-status-text">${escapeHtml(statusLabel)}</strong>
        </div>
        <button type="button" class="mini-btn" data-action="toggleCometa" data-payload='${escapeHtml(JSON.stringify({ enabled: !c.enabled }))}' data-testid="cometa-toggle">${c.enabled ? 'Desativar' : 'Ativar'}</button>
      </div>
      ${
        c.enabled
          ? `<div class="cometa-hud-actions">
        <button type="button" class="mini-btn ${c.mode === 'follow' ? 'selected' : ''}" data-action="setCometaMode" data-payload='{"mode":"follow"}' data-testid="cometa-mode-follow">Seguir</button>
        <button type="button" class="mini-btn ${c.mode === 'wait' ? 'selected' : ''}" data-action="setCometaMode" data-payload='{"mode":"wait"}' data-testid="cometa-mode-wait">Esperar</button>
        <button type="button" class="mini-btn ${c.mode === 'recall' ? 'selected' : ''}" data-action="setCometaMode" data-payload='{"mode":"recall"}' data-testid="cometa-mode-recall">Chamar</button>
        <button type="button" class="mini-btn" data-action="petCometa" data-testid="cometa-pet">Carinho</button>
        <button type="button" class="mini-btn" data-action="cometaSniff" data-testid="cometa-sniff" title="${pressurized ? 'Área pressurizada' : 'Bloqueado no vácuo'}">${pressurized ? 'Farejar' : 'Farejar (vácuo)'}</button>
        <button type="button" class="mini-btn" data-action="cometaLookBeacon" data-testid="cometa-beacon">Observar farol</button>
      </div>${reminder ? `<p class="cometa-reminder" data-testid="cometa-resource-reminder">${escapeHtml(reminder)}</p>` : ''}`
          : ''
      }`;
    }

    return `<article class="card cometa-card" data-testid="cometa-panel">
      <div class="companion-head">
        ${renderPortraitSvg('cometa', { size: 'lg', status: c.enabled ? 'active' : 'offline' })}
        <div>
          <span class="eyebrow">BUDDY DACHSHUND ASTRONAUTA • OPCIONAL</span>
          <h2>Cometa</h2>
          <p>Dachshund marrom e caramelo em traje pressurizado com capacete fechado. Acompanha, espera e recebe carinho sem nunca criar recursos ou bloquear a missão.</p>
          <p class="status-pill">${escapeHtml(statusLabel)}</p>
          <p class="fine">${pressurized ? '✓ Área pressurizada: farejar seguro.' : '⚠ Vácuo externo: Cometa nunca fareja fora de área pressurizada e não sofre dano.'} Contabilidade no agregado didático da tripulação.</p>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="${c.enabled ? '' : 'primary'}" data-action="toggleCometa" data-payload='${escapeHtml(JSON.stringify({ enabled: !c.enabled }))}' data-testid="modal-cometa-toggle">${c.enabled ? 'Desativar Cometa (opcional)' : 'Ativar Cometa na equipe'}</button>
        ${
          c.enabled
            ? `<button type="button" class="${c.mode === 'follow' ? 'primary' : ''}" data-action="setCometaMode" data-payload='{"mode":"follow"}' data-testid="modal-cometa-follow">Seguir</button>
               <button type="button" class="${c.mode === 'wait' ? 'primary' : ''}" data-action="setCometaMode" data-payload='{"mode":"wait"}' data-testid="modal-cometa-wait">Esperar</button>
               <button type="button" class="${c.mode === 'recall' ? 'primary' : ''}" data-action="setCometaMode" data-payload='{"mode":"recall"}' data-testid="modal-cometa-recall">Chamar para local seguro</button>
               <button type="button" data-action="petCometa" data-testid="modal-cometa-pet">Fazer carinho (${c.petCount})</button>
               <button type="button" data-action="cometaSniff" data-testid="modal-cometa-sniff">Farejar (${pressurized ? 'pressurizado' : 'bloqueado no vácuo'})</button>
               <button type="button" data-action="cometaLookBeacon" data-testid="modal-cometa-beacon">Observar farol (${c.beaconLookCount})</button>`
            : ''
        }
      </div>
    </article>`;
  }

  function renderDiscoveryCards(ids: DiscoveryId[]): string {
    return `<div class="discovery-list" data-testid="discovery-panel">
      ${ids
        .map((id) => {
          const entry = state.discoveries[id];
          const meta = discoveryCatalogLabels[id];
          const badge = getScienceProvenanceBadge(entry.sourceKind);
          const draft = probeHypothesisDraft[id] ?? entry.hypothesis ?? '';
          const canAct = entry.status !== 'unavailable';
          return `<article class="card discovery-card" data-testid="discovery-card-${id}">
            <div class="discovery-head">
              <div>
                <span class="eyebrow">${escapeHtml(regionNames[meta.region])}</span>
                <h3>${escapeHtml(meta.title)}</h3>
              </div>
              <span class="badge ${badge.kind}">${escapeHtml(badge.label)}</span>
            </div>
            <p class="status-line"><strong>Estado:</strong> ${escapeHtml(getDiscoveryStatusLabel(entry.status))}</p>
            <p class="fine">${escapeHtml(meta.note)}</p>
            ${entry.telemetrySummary ? `<p class="telemetry-note"><strong>Telemetria medida:</strong> ${escapeHtml(entry.telemetrySummary)}</p>` : ''}
            ${
              canAct && entry.status !== 'resolved'
                ? `<div class="discovery-controls">
                    <label class="hyp-label">Hipótese observada
                      <input type="text" value="${escapeHtml(draft)}" data-hypothesis-id="${id}" placeholder="Descreva sua hipótese antes da sonda" />
                    </label>
                    <div class="actions compact">
                      <button type="button" data-action="inspectEvidence" data-payload='${escapeHtml(JSON.stringify({ id }))}' data-testid="btn-inspect-${id}">1. Observar pista</button>
                      <button type="button" data-probe-id="${id}" data-testid="btn-probe-${id}">2. Acionar sonda (0,05 kWh)</button>
                      <button type="button" data-action="classifyDiscovery" data-payload='${escapeHtml(JSON.stringify({ id, classification: 'fictional_abstraction' satisfies DiscoveryClassification }))}' data-testid="btn-classify-fiction-${id}">3a. Ficção de treinamento</button>
                      <button type="button" data-action="classifyDiscovery" data-payload='${escapeHtml(JSON.stringify({ id, classification: 'verified_telemetry' satisfies DiscoveryClassification }))}' data-testid="btn-classify-telemetry-${id}">3b. Telemetria verificada</button>
                      <button type="button" data-action="deferDiscovery" data-payload='${escapeHtml(JSON.stringify({ id }))}' data-testid="btn-defer-${id}">Adiar (opcional)</button>
                    </div>
                  </div>`
                : ''
            }
          </article>`;
        })
        .join('')}
    </div>`;
  }

  function renderBeatSection(beatId: BeatId, compact = false): string {
    const info = getEpisodeBeatDisplay(state, beatId);
    const beat = info.beat;
    return `<div class="vn-beat card ${info.stormOverride && beat.id === 'warning' ? 'storm-priority' : ''}" data-testid="station-vn">
      <div class="beat-head">
        <div>
          <span class="eyebrow">EPISÓDIO 01 • BATIDA ${String(beat.order).padStart(2, '0')}/10${beat.optional ? ' • OPCIONAL' : ''}</span>
          <h3>${escapeHtml(beat.title)}</h3>
        </div>
        <div class="beat-badges">
          ${info.visited ? '<span class="badge verified">✓ Lida</span>' : info.skipped ? '<span class="badge fiction">↷ Pulada</span>' : '<span class="badge hypothesis">● Ativa</span>'}
        </div>
      </div>
      ${
        info.stormOverride
          ? `<div class="storm-inline" role="status">⚠ Prioridade dinâmica: radiação em ${state.storm === 'active' ? 'tempestade ativa' : 'alerta'} — priorize o abrigo!</div>`
          : ''
      }
      <div class="beat-lines">
        ${beat.lines
          .map(
            (l) => `<div class="beat-line">
              ${renderPortraitSvg(l.portraitId, { size: compact ? 'sm' : 'md', appearance: file.cadetAppearance, decorative: true })}
              <div>
                <strong>${escapeHtml(l.speaker)}</strong>
                <p>“${escapeHtml(l.line)}”</p>
              </div>
            </div>`,
          )
          .join('')}
      </div>
      <p class="fine"><strong>Critério real:</strong> ${escapeHtml(beat.evidenceNote)}</p>
      ${
        beat.causalChoice
          ? `<div class="causal-box">
              <span class="eyebrow">ESCOLHA CAUSAL • EFEITO NA SIMULAÇÃO</span>
              <p>${escapeHtml(beat.causalChoice.prompt)}</p>
              <div class="actions compact">
                ${beat.causalChoice.options
                  .map(
                    (opt) => `<button type="button" data-action="${opt.action}" data-payload='${escapeHtml(JSON.stringify(opt.payload))}' data-testid="causal-${opt.id}">
                      ${escapeHtml(opt.label)}
                      <small>${escapeHtml(opt.summary)}</small>
                    </button>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }
      <div class="tone-box">
        <span class="eyebrow">RESPOSTA DE TOM (NÃO ALTERA RECURSOS)</span>
        <div class="actions compact">
          ${beat.toneChoices
            .map((tc) => {
              const chosen = info.toneSelected === tc.id;
              return `<button type="button" class="${chosen ? 'primary' : ''}" data-action="recordDialogueTone" data-payload='${escapeHtml(JSON.stringify({ beatId: beat.id, tone: tc.id, choiceLabel: tc.label }))}' data-testid="tone-${beat.id}-${tc.id}">
                ${chosen ? '✓ ' : ''}${escapeHtml(tc.label)}
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="actions compact">
        <button type="button" data-action="advanceBeat" data-payload='${escapeHtml(JSON.stringify({ beatId: beat.id, skipped: false, speaker: beat.lines[0]?.speaker, line: beat.lines[0]?.line }))}' data-testid="btn-mark-beat-read">Registrar fala lida</button>
        ${
          beat.skippable
            ? `<button type="button" data-action="advanceBeat" data-payload='${escapeHtml(JSON.stringify({ beatId: beat.id, skipped: true }))}' data-testid="btn-skip-beat-modal">Pular diálogo opcional ↷</button>`
            : '<span class="fine">⚠ Reparos/decisões físicas desta etapa exigem execução no equipamento.</span>'
        }
        <button type="button" data-menu="episode" data-testid="btn-open-history">Histórico de falas (${state.episode.dialogueHistory.length})</button>
      </div>
    </div>`;
  }

  function renderCargoManifestPanel(): string {
    const summary = computeMassSelection(cargoDraftIds, ORBIT_CARGO_ITEMS, CARGO_CAPACITY_KG);
    const locked = state.flags.cargo;
    return `<section class="card sub-panel" data-testid="cargo-manifest">
      <div class="panel-head">
        <div>
          <span class="eyebrow">ORÇAMENTO DE MASSA ORBITAL</span>
          <h3>Manifesto de carga (${locked ? state.cargoMassKg : summary.massKg} / ${CARGO_CAPACITY_KG} kg)</h3>
        </div>
        <span class="badge ${summary.overLimit && !locked ? 'fiction' : 'verified'}">${locked ? '✓ Fixada' : summary.overLimit ? '⚠ Acima de 45 kg' : `Margem: ${summary.remainingKg} kg`}</span>
      </div>
      <p class="fine">Treinador orbital assistido no plano (<code>orbitAssisted = true</code>): não simula 6DoF. Selecione peças respeitando 45 kg.</p>
      <div class="checklist">
        ${Object.entries(ORBIT_CARGO_ITEMS)
          .map(([id, item]) => {
            const label = cargoCatalogLabels[id];
            const checked = (locked ? state.selectedCargoIds : cargoDraftIds).includes(id);
            return `<label class="check-row">
              <input type="checkbox" data-cargo-item="${id}" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''} />
              <span><strong>${escapeHtml(label?.label ?? id)}</strong> <small>(${item.massKg} kg${item.essential ? ' • essencial' : ' • opcional'}) — ${escapeHtml(label?.note ?? '')}</small></span>
            </label>`;
          })
          .join('')}
      </div>
      ${
        !locked
          ? `<div class="actions compact">
              <button type="button" class="primary" data-cargo-submit data-testid="btn-cargo-submit">Fixar carga selecionada (${summary.massKg}/${CARGO_CAPACITY_KG} kg)</button>
              <button type="button" data-cargo-preset data-testid="btn-cargo-preset">Selecionar conjunto padrão (40 kg)</button>
            </div>`
          : `<p class="fine">Itens embarcados: ${state.selectedCargoIds.map((id) => escapeHtml(cargoCatalogLabels[id]?.label ?? id)).join(', ')}.</p>`
      }
    </section>`;
  }

  function renderLockerLoadoutPanel(): string {
    const summary = computeMassSelection(loadoutDraftIds, FIELD_LOCKER_ITEMS, LOADOUT_CAPACITY_KG);
    const readyPower = state.modules.power.connected && state.modules.power.enabled && state.modules.power.integrity >= 0.8;
    const readyWater = state.modules.water.connected && state.modules.water.enabled && state.modules.water.integrity >= 0.8;
    const readyO2 = state.modules.oxygen.connected && state.modules.oxygen.enabled && state.modules.oxygen.integrity >= 0.8;
    return `<section class="card sub-panel" data-testid="locker-loadout">
      <div class="panel-head">
        <div>
          <span class="eyebrow">PREPARO DO ARMÁRIO DE CAMPO</span>
          <h3>Ferramentas de expedição (${summary.massKg} / ${LOADOUT_CAPACITY_KG} kg)</h3>
        </div>
        <span class="badge ${summary.overLimit ? 'fiction' : 'verified'}">${summary.overLimit ? '⚠ Acima de 18 kg' : `Margem: ${summary.remainingKg} kg`}</span>
      </div>
      <div class="checklist">
        ${Object.entries(FIELD_LOCKER_ITEMS)
          .map(([id, item]) => {
            const label = fieldLockerCatalogLabels[id];
            const checked = loadoutDraftIds.includes(id);
            return `<label class="check-row">
              <input type="checkbox" data-loadout-item="${id}" ${checked ? 'checked' : ''} />
              <span><strong>${escapeHtml(label?.label ?? id)}</strong> <small>(${item.massKg} kg) — ${escapeHtml(label?.note ?? '')}</small></span>
            </label>`;
          })
          .join('')}
      </div>
      <div class="actions compact">
        <button type="button" class="primary" data-loadout-submit data-testid="btn-loadout-submit">Confirmar ferramentas (${summary.massKg}/${LOADOUT_CAPACITY_KG} kg)</button>
        <button type="button" data-loadout-preset data-testid="btn-loadout-preset">Trio padrão (15 kg)</button>
      </div>
      <div class="preconditions" aria-label="Requisitos de saída ao cânion">
        <span class="${readyPower && readyWater && readyO2 ? 'ok' : 'warn'}">${readyPower && readyWater && readyO2 ? '✓' : '○'} Módulos P/H₂O/O₂</span>
        <span class="${state.resources.battery >= 5 ? 'ok' : 'warn'}">${state.resources.battery >= 5 ? '✓' : '○'} Bateria ≥ 5 kWh</span>
        <span class="${state.resources.potable >= 2 ? 'ok' : 'warn'}">${state.resources.potable >= 2 ? '✓' : '○'} Água ≥ 2 kg</span>
        <span class="${state.resources.oxygen >= 0.2 ? 'ok' : 'warn'}">${state.resources.oxygen >= 0.2 ? '✓' : '○'} O₂ ≥ 0,2 kg</span>
        <span class="${state.storm === 'clear' ? 'ok' : 'warn'}">${state.storm === 'clear' ? '✓' : '⚠'} Céu limpo</span>
      </div>
    </section>`;
  }

  function renderModularExpansionPanel(): string {
    return `<div class="expansion-grid">
      <section class="card sub-panel" data-testid="aux-bay-panel">
        <span class="eyebrow">BAÍA DE REDE AUXILIAR (3 PORTAS)</span>
        <h3>Conectores auxiliares (${state.auxBay.installedCount}/3)</h3>
        <p class="fine">Instalar uma porta custa ${fmtPt(AUX_PORT_INSTALL_KWH)} kWh e requer o módulo principal conectado.</p>
        <div class="slot-list">
          ${AUX_BAY_PORTS.map((port: AuxBayPortType) => {
            const installed = state.auxBay.ports[port];
            const meta = auxBayPortLabels[port];
            return `<div class="slot-row">
              <div>
                <strong>${installed ? '✓ ' : '○ '}${escapeHtml(meta.label)}</strong>
                <p class="fine">${escapeHtml(meta.effect)}</p>
              </div>
              <button type="button" data-action="${installed ? 'removeAuxPort' : 'installAuxPort'}" data-payload='${escapeHtml(JSON.stringify({ port }))}' data-testid="btn-aux-${port}">${installed ? 'Remover' : `Instalar (${fmtPt(AUX_PORT_INSTALL_KWH)} kWh)`}</button>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="card sub-panel" data-testid="field-kit-panel">
        <span class="eyebrow">KIT MODULAR DE CAMPO (3 ENCAIXES)</span>
        <h3>Peças encaixadas (${state.fieldKit.slots.filter(Boolean).length}/3 • custódia ${fmtPt(state.fieldKit.escrowKwh)} kWh)</h3>
        <p class="fine">Cada peça custa ${fmtPt(FIELD_KIT_COST_KWH)} kWh (devolvido ao remover/desfazer sem duplicar energia). Alcance PIP atual: ${state.pipTelemetryRangeM} m.</p>
        <div class="slot-selector">
          <label>Encaixe alvo:
            <select data-kit-slot data-testid="select-kit-slot">
              ${[0, 1, 2]
                .map((slot) => {
                  const occupant = state.fieldKit.slots[slot];
                  const occupantName = occupant ? fieldKitPieceLabels[occupant].label : 'vazio';
                  return `<option value="${slot}" ${fieldKitSlotTarget === slot ? 'selected' : ''}>Encaixe ${slot} (${escapeHtml(occupantName)})</option>`;
                })
                .join('')}
            </select>
          </label>
        </div>
        <div class="slot-list">
          ${FIELD_KIT_PIECES.map((pieceId: FieldKitPieceId) => {
            const meta = fieldKitPieceLabels[pieceId];
            const placedAt = state.fieldKit.slots.indexOf(pieceId);
            return `<div class="slot-row">
              <div>
                <strong>${placedAt >= 0 ? `✓ [Encaixe ${placedAt}] ` : '○ '}${escapeHtml(meta.label)}</strong>
                <p class="fine">${escapeHtml(meta.effect)}</p>
              </div>
              ${
                placedAt >= 0
                  ? `<button type="button" data-action="removeFieldKitPiece" data-payload='${escapeHtml(JSON.stringify({ slot: placedAt }))}' data-testid="btn-kit-remove-${pieceId}">Remover (+${fmtPt(FIELD_KIT_COST_KWH)} kWh)</button>`
                  : `<button type="button" data-kit-install="${pieceId}" data-testid="btn-kit-install-${pieceId}">Encaixar (-${fmtPt(FIELD_KIT_COST_KWH)} kWh)</button>`
              }
            </div>`;
          }).join('')}
        </div>
        <div class="actions compact">
          <button type="button" data-action="undoFieldKit" data-testid="btn-kit-undo" ${state.fieldKit.slots.every((s) => s === null) ? 'disabled' : ''}>Desfazer última peça (+${fmtPt(FIELD_KIT_COST_KWH)} kWh)</button>
        </div>
      </section>
    </div>`;
  }

  function stationData(t: WorldTarget) {
    const s = stations[t.id];
    if (s) return s;
    const lines: Record<string, string> = {
      'academy-launch':
        'O ensaio terminou quando a bateria recuperou por 15 segundos. Reyes aguarda na cabine orbital. A viagem é condensada nesta demo.',
      'lunar-transfer':
        'Com a carga fixada, podemos descer até Aurora. O salto entre cenários representa uma sequência narrativa, não uma simulação de lançamento.',
      'expedition-gate':
        'O cânion esconde gelo e o sinal de Scout. Prepare ferramentas e suporte à vida antes da saída. Volte ao abrigo quando houver alerta.',
      'greenhouse-door':
        'À direita da base, Elena cuida do primeiro jardim lunar. O cultivo divide água e energia com o suporte à vida.',
      'return-gate':
        'A amostra ainda precisa ser entregue. O tempo da missão e todos os sistemas continuam passando durante a caminhada.',
      'return-habitat':
        'O jardim depende da base. Volte pelo caminho conhecido para acompanhar o abrigo e a rede elétrica.',
    };
    return {
      speaker: `${speakerPortraits[PORTAL_PORTRAITS[t.id] ?? 'reyes'].name} • Portal`,
      portraitId: PORTAL_PORTRAITS[t.id] ?? ('reyes' as SpeakerPortraitId),
      title: targetNames[t.id] ?? t.name,
      line: lines[t.id] ?? t.description,
      evidence:
        'As passagens seguem a progressão e preservam todos os recursos. Não há teletransporte pelo mapa.',
      choices: [],
      topic: undefined,
      beatId: undefined,
    };
  }

  function readout(): string {
    if (state.phase === 'academy') {
      return `Geração: <strong>${fmtPt(state.academyGenerationKw, 1)} kW</strong> • Demanda: <strong>${fmtPt(state.academyDemandKw, 1)} kW</strong> • Bateria do ensaio: <strong>${fmtPt(state.academyBattery)} kWh</strong> • Estabilidade: <strong>${state.flags.academyStableTicks}/15 s</strong> • Carga secundária ${state.flags.loadShed ? 'suspensa' : 'ativa'}`;
    }
    const r = state.resources;
    return `Bateria <strong>${fmtPt(r.battery)} / 12,00 kWh</strong> • Fluxo ${fmtPt(state.powerSupply, 1)} → ${fmtPt(state.powerDemand, 1)} kW • Água <strong>${fmtPt(r.potable)} kg</strong> • O₂ <strong>${fmtPt(r.oxygen, 3)} kg</strong> • Cultivo <strong>${state.cropGrowth}/180 s (${Math.floor((state.cropGrowth / 180) * 100)}%)</strong> • Scout ${fmtPt(r.companionBattery)} kWh`;
  }

  function renderStation(t: WorldTarget, focusSelector?: string): void {
    const s = stationData(t);
    const portraitId: SpeakerPortraitId = s.portraitId ?? 'reyes';
    const scoutStatus =
      state.flags.scoutStrandedOutOfCharge || !state.flags.scoutRepaired ? 'offline' : 'active';

    let specializedHtml = '';
    if (t.id === 'cargo') {
      specializedHtml += renderCargoManifestPanel();
    } else if (t.id === 'field-locker') {
      specializedHtml += renderLockerLoadoutPanel();
    } else if (t.id === 'mission-console') {
      specializedHtml += renderModularExpansionPanel();
      if (state.discoveries.solar_dust_attenuation.status !== 'unavailable') {
        specializedHtml += renderDiscoveryCards(['solar_dust_attenuation']);
      }
    } else if (t.id === 'battery-bank') {
      specializedHtml += renderDiscoveryCards(['solar_dust_attenuation']);
    } else if (t.id === 'survey-beacon') {
      specializedHtml += renderDiscoveryCards(['com03_unplugged_cable']);
    } else if (t.id === 'ice-deposit') {
      specializedHtml += `<div class="live-readout">Reserva finita local restante: <strong>${fmtPt(state.resources.ice, 1)} / 8,0 kg</strong> • Amostra em mãos: <strong>${fmtPt(state.resources.samples, 1)} kg</strong></div>`;
      specializedHtml += renderDiscoveryCards(['canyon_ice_strata']);
    } else if (t.id === 'damaged-scout') {
      specializedHtml += `<div class="live-readout">Peças sobressalentes: <strong>${state.resources.parts}</strong> • Bateria Scout: <strong>${fmtPt(state.resources.companionBattery)} / 2,00 kWh</strong> • Reparo restante: <strong>${state.scoutRepairRemaining} s</strong> • Estado: <strong>${state.flags.scoutStrandedOutOfCharge ? 'Sem carga (aguarda recarga)' : state.flags.scoutRecruited ? 'Na equipe' : state.flags.scoutRepaired ? 'Reparado' : 'Avariado'}</strong></div>`;
    } else if (t.id === 'habitat-shelter') {
      const nextCycleSec = Math.max(0, 300 - (state.lunarTick % 600));
      specializedHtml += `<div class="live-readout">Previsão: <strong>${state.storm === 'active' ? 'TEMPESTADE ATIVA' : state.storm === 'warning' ? `ALERTA (${nextCycleSec} s até pico)` : 'LIMPA'}</strong> • Abrigo: <strong>${state.flags.sheltered ? 'Protegido (pressurizado)' : 'Externo'}</strong> • Sobrevivência registrada: <strong>${state.flags.stormSurvived ? 'Sim' : 'Não'}</strong></div>`;
    } else if (t.id === 'crop-bed' || t.id === 'grow-lights') {
      specializedHtml += `<div class="live-readout">Estratégia escolhida: <strong>${state.episode.choices.cropTiming === 'early_plant' ? 'Plantio antecipado' : state.episode.choices.cropTiming === 'deferred_plant' ? 'Plantio adiado' : 'Indeciso'}</strong> • Luzes: <strong>${state.modules.crop.enabled ? 'Ligadas (0,8 kW)' : 'Desligadas'}</strong> • Progresso: <strong>${state.cropGrowth}/180 s</strong></div>`;
    }

    const beatIdToShow = s.beatId ?? getActiveEpisodeBeat(state);
    const beatHtml = renderBeatSection(beatIdToShow, true);

    modal(
      s.title,
      s.speaker,
      `<div class="vn">
        <div class="vn-portrait">
          ${renderPortraitSvg(portraitId, {
            size: 'lg',
            appearance: file.cadetAppearance,
            status: portraitId === 'scout' ? scoutStatus : 'active',
          })}
          <span>${escapeHtml(s.speaker)}</span>
        </div>
        <div>
          <p class="dialogue">“${escapeHtml(s.line)}”</p>
          <div class="evidence">
            <span class="eyebrow">OBSERVAR • FORMULAR • TESTAR</span>
            <p>${escapeHtml(s.evidence)}</p>
          </div>
        </div>
      </div>
      <div class="live-readout" data-testid="station-readout">${readout()}</div>
      <div class="actions">
        ${s.choices
          .map((c, idx) => {
            const payloadAttr = c.payload ? ` data-payload='${escapeHtml(JSON.stringify(c.payload))}'` : '';
            return `<button type="button" data-action="${c.action}"${payloadAttr} data-testid="station-choice-${idx}">
              ${escapeHtml(c.label)}${c.note ? `<small>${escapeHtml(c.note)}</small>` : ''}
            </button>`;
          })
          .join('')}
        ${
          PORTAL_DESTINATIONS[t.id]
            ? `<button type="button" class="primary" data-travel="${PORTAL_DESTINATIONS[t.id]}" data-testid="btn-travel-${PORTAL_DESTINATIONS[t.id]}">Seguir para ${escapeHtml(regionNames[PORTAL_DESTINATIONS[t.id]])} →</button>`
            : ''
        }
        ${s.topic ? '<button type="button" data-hint data-testid="btn-pip-hint">Pedir uma pista ao PIP</button>' : ''}
        ${
          t.id === 'mission-console'
            ? '<button type="button" data-checkpoint data-testid="btn-checkpoint">Gravar checkpoint completo</button>'
            : ''
        }
      </div>
      <div id="station-feedback" data-testid="station-feedback" role="status" aria-live="polite"></div>
      ${specializedHtml}
      <details class="beat-details">
        <summary>Episódio 01 • Diálogo e tom desta etapa</summary>
        ${beatHtml}
      </details>
      <p class="fine">Feche o painel para caminhar e avançar o trabalho iniciado. Nenhum reparo termina durante a pausa.</p>`,
      true,
      'station-modal',
      focusSelector,
    );
  }

  function renderEpisodeModal(focusSelector?: string): void {
    const info = getEpisodeBeatDisplay(state, selectedBeatId ?? undefined);
    const history = state.episode.dialogueHistory.slice().reverse();
    modal(
      'Episódio 01 — Uma luz de cada vez',
      'NARRATIVA E HISTÓRICO',
      `<div class="tabs" role="tablist" aria-label="Abas do episódio">
        <button type="button" role="tab" aria-selected="${episodeTab === 'current'}" class="${episodeTab === 'current' ? 'primary' : ''}" data-episode-tab="current" data-testid="tab-episode-current">Batida atual (${String(info.beat.order).padStart(2, '0')}/10)</button>
        <button type="button" role="tab" aria-selected="${episodeTab === 'history'}" class="${episodeTab === 'history' ? 'primary' : ''}" data-episode-tab="history" data-testid="tab-episode-history">Histórico / Backlog (${history.length})</button>
        <button type="button" role="tab" aria-selected="${episodeTab === 'all'}" class="${episodeTab === 'all' ? 'primary' : ''}" data-episode-tab="all" data-testid="tab-episode-all">Todas as 10 batidas</button>
      </div>
      ${
        episodeTab === 'current'
          ? renderBeatSection(info.beat.id, false)
          : episodeTab === 'history'
            ? `<div class="history-panel" data-testid="dialogue-history">
                <ul class="evidence-list">
                  ${
                    history.length > 0
                      ? history
                          .map(
                            (entry) => `<li>
                              <small>T+${entry.tick}s • ${escapeHtml(episode01Beats[entry.beatId]?.historyLabel ?? entry.beatId)}</small>
                              <p><strong>${escapeHtml(entry.speaker)}:</strong> “${escapeHtml(entry.line)}”</p>
                              ${entry.choiceLabel ? `<span class="badge verified">Tom escolhido: ${escapeHtml(entry.choiceLabel)}</span>` : ''}
                            </li>`,
                          )
                          .join('')
                      : '<li>Nenhuma fala registrada no histórico ainda. Avance ou escolha um tom nas batidas do episódio.</li>'
                  }
                </ul>
              </div>`
            : `<div class="beat-index">
                ${BEAT_IDS.map((id) => {
                  const b = episode01Beats[id];
                  const isVisited = state.episode.visitedBeats.includes(id);
                  const isSkipped = state.episode.skippedBeats.includes(id);
                  const isActive = info.activeBeatId === id;
                  return `<article class="card beat-summary ${isActive ? 'current' : ''}">
                    <div class="beat-head">
                      <strong>${escapeHtml(b.historyLabel)}</strong>
                      <span class="badge ${isVisited ? 'verified' : isSkipped ? 'fiction' : 'hypothesis'}">${isActive ? 'Ativa' : isVisited ? 'Lida' : isSkipped ? 'Pulada' : 'Pendente'}</span>
                    </div>
                    <p class="fine">${escapeHtml(regionNames[b.region])} → ${escapeHtml(targetNames[b.targetWorldId] ?? b.targetWorldId)}</p>
                    <button type="button" data-select-beat="${id}" data-testid="btn-view-beat-${id}">Abrir batida</button>
                  </article>`;
                }).join('')}
              </div>`
      }`,
      true,
      'episode-modal',
      focusSelector,
    );
  }

  function renderJournalModal(focusSelector?: string): void {
    const discoveryIds: DiscoveryId[] = [
      'solar_dust_attenuation',
      'com03_unplugged_cable',
      'canyon_ice_strata',
    ];
    modal(
      'Conhecer antes de decidir',
      'DIÁRIO CIENTÍFICO',
      `<p class="lead">Telemetria medida, descobertas de campo e fontes científicas declaradas com proveniência.</p>
      <div class="science-note">Passo fixo de 1 segundo = 0,01 hora de missão. Velocidade ${file.settings.speed}×. Pausa, modal e aba oculta congelam simulação e mundo 3D. Descobertas reconhecem ${state.discoveryXp} XP sem criar recursos físicos.</div>
      <div class="tabs" role="tablist" aria-label="Seções do diário científico">
        <button type="button" role="tab" aria-selected="${journalTab === 'discoveries'}" class="${journalTab === 'discoveries' ? 'primary' : ''}" data-journal-tab="discoveries" data-testid="tab-journal-discoveries">Descobertas (${discoveryIds.filter((id) => state.discoveries[id].status === 'resolved').length}/3)</button>
        <button type="button" role="tab" aria-selected="${journalTab === 'evidence'}" class="${journalTab === 'evidence' ? 'primary' : ''}" data-journal-tab="evidence" data-testid="tab-journal-evidence">Evidências (${state.log.length})</button>
        <button type="button" role="tab" aria-selected="${journalTab === 'sources'}" class="${journalTab === 'sources' ? 'primary' : ''}" data-journal-tab="sources" data-testid="tab-journal-sources">Fontes (${sources.length})</button>
      </div>
      ${
        journalTab === 'discoveries'
          ? `<div data-testid="journal-discoveries">${renderDiscoveryCards(discoveryIds)}</div>`
          : journalTab === 'evidence'
            ? `<div data-testid="journal-evidence">
                <ul class="evidence-list">
                  ${
                    state.log.length > 0
                      ? state.log
                          .slice()
                          .reverse()
                          .map(
                            (e) => `<li>
                              <small>T+${e.tick}s • ${escapeHtml(e.kind)}</small>
                              <p>${escapeHtml(e.text)}</p>
                              ${e.before !== undefined ? `<strong>${fmtPt(e.before)} → ${fmtPt(e.after ?? e.before)} ${escapeHtml(e.unit ?? '')}</strong>` : ''}
                            </li>`,
                          )
                          .join('')
                      : '<li>Investigue o simulador de energia para registrar a primeira observação.</li>'
                  }
                </ul>
              </div>`
            : `<div class="source-grid" data-testid="journal-sources">
                ${sources
                  .map((s) => {
                    const badge = getScienceProvenanceBadge(s.parameterProvenance);
                    return `<article class="source card">
                      <div class="discovery-head">
                        <span class="eyebrow">FONTE DOCUMENTADA</span>
                        <span class="badge ${badge.kind}">${escapeHtml(badge.label)}</span>
                      </div>
                      <h2>${escapeHtml(s.title)}</h2>
                      <p>${escapeHtml(s.fact)}</p>
                      <p class="fine"><strong>No jogo:</strong> ${escapeHtml(s.simplification)}</p>
                      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">Consultar a fonte ↗</a>
                    </article>`;
                  })
                  .join('')}
              </div>`
      }
      <div class="actions">
        <button type="button" data-download="report" data-testid="btn-journal-export">Exportar relatório e evidências (JSON)</button>
        ${returnMenu ? `<button type="button" data-menu="${returnMenu}">Voltar</button>` : ''}
      </div>`,
      true,
      'journal-modal',
      focusSelector,
    );
  }

  function renderCompanionsModal(focusSelector?: string): void {
    const scoutState = state.flags.scoutStrandedOutOfCharge
      ? '⚠ Sem carga (<= 0,10 kWh) — aguarda recarga'
      : state.flags.scoutRecruited
        ? `✓ Na equipe • ${fmtPt(state.resources.companionBattery)} / 2,00 kWh • ${state.scoutScans} varreduras`
        : state.flags.scoutRepaired
          ? '○ Reparado — convide Scout no cânion'
          : '○ À espera de reparo no cânion (1 peça, 0,30 kWh, 5 s)';

    modal(
      'Ninguém explora sozinho',
      'EQUIPE AURORA',
      `<div class="companion-grid">
        <article class="card" data-testid="pip-panel">
          <div class="companion-head">
            ${renderPortraitSvg('pip', { size: 'lg' })}
            <div>
              <span class="eyebrow">ASSISTENTE DE TELEMETRIA</span>
              <h2>PIP</h2>
              <p>Acompanha desde a Academia, lê instrumentos e sugere hipóteses sem criar recursos.</p>
              <p class="status-pill">⚡ Bateria: ${fmtPt(state.pipBattery)} / 1,50 kWh • Alcance: ${state.pipTelemetryRangeM} m</p>
            </div>
          </div>
        </article>

        <article class="card" data-testid="scout-panel">
          <div class="companion-head">
            ${renderPortraitSvg('scout', {
              size: 'lg',
              status: state.flags.scoutStrandedOutOfCharge || !state.flags.scoutRecruited ? 'offline' : 'active',
            })}
            <div>
              <span class="eyebrow">ROBÔ EXPLORADOR S-02</span>
              <h2>Scout</h2>
              <p>Chassi de 4 rodas com antenas duplas. Executa varreduras por 0,40 kWh e recarrega a partir da bateria da base.</p>
              <p class="status-pill">${escapeHtml(scoutState)}</p>
            </div>
          </div>
          ${
            state.flags.scoutRecruited || state.flags.scoutRepaired
              ? `<div class="actions compact">
                  <button type="button" data-action="dispatchScoutScan" data-payload='{"target":"solar"}' data-testid="btn-scout-scan-solar">Varredura solar (-0,40 kWh)</button>
                  <button type="button" data-action="dispatchScoutScan" data-payload='{"target":"beacon"}' data-testid="btn-scout-scan-beacon">Varredura marco (-0,40 kWh)</button>
                  <button type="button" data-action="rechargeScout" data-testid="btn-scout-recharge">Recarregar Scout (0,50 kWh da base)</button>
                </div>`
              : ''
          }
        </article>
      </div>
      ${renderCometaControlsBlock('modal')}
      <p class="fine">Recrutar Scout é um marco único da campanha. Cometa é opcional: desativá-lo ou deixá-lo em espera nunca bloqueia objetivos.</p>`,
      true,
      'companions-modal',
      focusSelector,
    );
  }

  function renderReport(): void {
    const r = getReport(state);
    modal(
      state.phase === 'complete'
        ? 'Aurora está viva.'
        : state.phase === 'failed'
          ? 'Uma decisão pode mudar a próxima tentativa.'
          : 'O que sua expedição revelou',
      'RELATÓRIO DE MISSÃO',
      `<p class="lead">${
        state.phase === 'complete'
          ? 'Você restaurou a cadeia, trouxe Scout, processou gelo, protegeu a equipe e colheu alimento.'
          : state.phase === 'failed'
            ? 'A margem de segurança chegou ao limite. O checkpoint restaura a missão inteira, incluindo custos, aparência e equipe.'
            : 'Este relatório acompanha o estado real da sessão; a missão ainda está em andamento.'
      }</p>
      <div class="report-grid">
        <article class="card">
          <span class="eyebrow">SEGURANÇA QUALITATIVA</span>
          <h2>${fmtPt(r.safety.health, 0)}/100</h2>
          <p>Tempestade protegida: ${r.safety.stormSurvived ? 'sim' : 'ainda não'}<br>Passos sem energia suficiente: ${r.safety.blackoutTicks}</p>
        </article>
        <article class="card">
          <span class="eyebrow">ESTABILIDADE</span>
          <h2>${fmtPt(r.stability.battery)} kWh</h2>
          <p>Água ${fmtPt(r.stability.potable)} kg • O₂ ${fmtPt(r.stability.oxygenReserve, 3)} kg<br>Perda elétrica: ${fmtPt(r.stability.energyLossKwh, 3)} kWh</p>
        </article>
        <article class="card">
          <span class="eyebrow">DESCOBERTA E EQUIPE</span>
          <h2>${state.flags.scoutRecruited ? 'Scout resgatado' : 'Scout aguarda'}</h2>
          <p>Gelo processado: ${fmtPt(state.resources.processedIce)} kg • Varreduras: ${r.decisions.scoutScans}<br>Colheita: ${state.flags.harvested ? 'concluída' : 'pendente'} • Cometa: ${r.decisions.cometaEnabled ? 'ativo' : 'opcional desativado'}</p>
        </article>
        <article class="card">
          <span class="eyebrow">ESCOLHAS & CIÊNCIA</span>
          <h2>${state.discoveryXp} XP</h2>
          <p>Carga academia: ${escapeHtml(r.decisions.academyLoad)}<br>Cultivo: ${escapeHtml(r.decisions.cropTiming)}<br>Portas aux: ${r.decisions.auxPortsInstalled.length}/3 • Kit: ${r.decisions.fieldKitPlaced.length}/3</p>
        </article>
      </div>
      <h2>Reflita para a próxima missão</h2>
      <p>Qual medida mudou depois de sua intervenção? Se a próxima tempestade trouxesse menos geração, que carga você adiaria e qual consequência esperaria na alimentação?</p>
      <p class="fine">${escapeHtml(r.understanding.note)}</p>
      <div class="actions">
        <button type="button" data-download="report" data-testid="btn-download-report">Exportar evidências (JSON)</button>
        <button type="button" data-menu="journal" data-testid="btn-report-journal">Consultar fontes</button>
        <button type="button" data-retry data-testid="btn-retry-checkpoint">Restaurar checkpoint</button>
        <button type="button" data-menu="restart" data-testid="btn-report-restart">Nova expedição</button>
      </div>`,
      true,
      'report-modal',
    );
  }

  function renderMenu(focusSelector?: string): void {
    if (menu === 'intro') {
      modal(
        'Um pequeno passo.\nUm mundo para descobrir.',
        'ASTRA • DEMO INDEPENDENTE',
        `<p class="lead">Uma base silenciosa, uma equipe humana e robótica, e sistemas que só funcionam quando trabalham juntos.</p>
        <div class="pills">
          <span>Exploração em 3ª pessoa</span>
          <span>Episódio 01 • 10 batidas</span>
          <span>Engenharia científica</span>
          <span>Cometa (buddy opcional)</span>
        </div>
        ${renderCadetCustomizer('intro')}
        <div class="intro-options card">
          <label class="check-row">
            <input type="checkbox" data-intro-cometa ${introCometaEnabled ? 'checked' : ''} data-testid="toggle-intro-cometa" />
            <span><strong>Incluir Cometa (dachshund astronauta opcional)</strong> <small>— Acompanha e recebe carinho; a campanha inteira continua concluível sem ele.</small></span>
          </label>
        </div>
        <div class="actions">
          ${hasSave ? '<button type="button" class="primary" data-start="resume" data-testid="btn-start-resume">Continuar expedição</button>' : ''}
          <button type="button" class="${hasSave ? '' : 'primary'}" data-start="new" data-testid="btn-start-new">Nova expedição</button>
          <button type="button" data-menu="settings" data-testid="btn-intro-settings">Acessibilidade e gráficos</button>
        </div>
        <p class="fine">Sem login • save v4 apenas neste navegador • modelos 3D locais. Mundo fictício e parâmetros rotulados como hipótese didática. A cabine orbital usa locomoção assistida (sem 6DoF). ${escapeHtml(saveNotice)}</p><p class="fine"><a data-testid="source-repository-link" href="${escapeHtml(SOURCE_REPOSITORY_URL)}" target="_blank" rel="noopener noreferrer">Código e histórico no GitHub ↗</a> • ${escapeHtml(RELEASE_LABEL)}</p>`,
        true,
        'intro-modal',
        focusSelector,
      );
      return;
    }

    if (menu === 'station' && inspected) {
      renderStation(inspected, focusSelector);
      return;
    }

    if (menu === 'episode') {
      renderEpisodeModal(focusSelector);
      return;
    }

    if (menu === 'quests') {
      const objectives = getObjectives(state);
      modal(
        'Uma missão, muitos sistemas',
        'DIÁRIO DE BORDO',
        `<p class="lead">${objectives.filter((o) => o.complete).length} de ${objectives.length} marcos observáveis</p>
        <ol class="quest-list" data-testid="quest-list">
          ${objectives
            .map(
              (o) => `<li class="${o.complete ? 'done' : ''}">
                <span>${o.complete ? '✓' : '○'}</span>
                <div>
                  <strong>${escapeHtml(objectiveNames[o.id]?.[0] ?? o.title)}</strong>
                  <p>${escapeHtml(objectiveNames[o.id]?.[1] ?? o.description)}</p>
                  <small>⌖ ${escapeHtml(targetNames[o.targetWorldId] ?? o.targetWorldId)}</small>
                </div>
              </li>`,
            )
            .join('')}
        </ol>`,
        false,
        'quests-modal',
        focusSelector,
      );
      return;
    }

    if (menu === 'journal') {
      renderJournalModal(focusSelector);
      return;
    }

    if (menu === 'map') {
      modal(
        'Regiões da expedição',
        'ATLAS AURORA',
        `<div class="atlas" data-testid="map-atlas">
          ${Object.entries(REGIONS)
            .map(
              ([id, plan]) => `<article class="card ${id === state.region ? 'current' : ''}">
                <span class="eyebrow">${id === state.region ? '★ VOCÊ ESTÁ AQUI' : 'REGIÃO CONECTADA'}</span>
                <h2>${escapeHtml(regionNames[id as RegionId])}</h2>
                <p>${plan.targets.map((t) => escapeHtml(targetNames[t.id] ?? t.name)).join(' • ')}</p>
              </article>`,
            )
            .join('')}
        </div>
        <p class="fine">Academia → órbita → base ↔ cânion / estufa. Este mapa não permite teletransporte. Cada passagem é alcançada e ativada no mundo. Geografia autoral, sem DEM lunar medido.</p>`,
        true,
        'map-modal',
        focusSelector,
      );
      return;
    }

    if (menu === 'companions') {
      renderCompanionsModal(focusSelector);
      return;
    }

    if (menu === 'settings') {
      modal(
        'Sua maneira de explorar',
        'ACESSIBILIDADE E DESEMPENHO',
        `${renderCadetCustomizer('settings')}
        <div class="settings" data-testid="settings-panel">
          <label>Qualidade gráfica
            <select data-setting="quality" data-testid="setting-quality">
              <option value="high" ${file.settings.quality === 'high' ? 'selected' : ''}>Padrão</option>
              <option value="low" ${file.settings.quality === 'low' ? 'selected' : ''}>Econômica • menor resolução</option>
            </select>
          </label>
          <label>Texto ampliado
            <input type="checkbox" data-setting="largeText" data-testid="setting-large-text" ${file.settings.largeText ? 'checked' : ''} />
          </label>
          <label>Reduzir movimentos decorativos
            <input type="checkbox" data-setting="reducedMotion" data-testid="setting-reduced-motion" ${file.settings.reducedMotion ? 'checked' : ''} />
          </label>
          <label>HUD compacto
            <input type="checkbox" data-setting="compactHud" data-testid="setting-compact-hud" ${file.uiPrefs.compactHud ? 'checked' : ''} />
          </label>
          <label>Controles na tela (toque / D-pad)
            <select data-setting="touchControls" data-testid="setting-touch-controls">
              <option value="auto" ${touchPref === 'auto' ? 'selected' : ''}>Automático (tela ≤ 800 px ou toque)</option>
              <option value="on" ${touchPref === 'on' ? 'selected' : ''}>Sempre mostrar</option>
              <option value="off" ${touchPref === 'off' ? 'selected' : ''}>Ocultar</option>
            </select>
          </label>
          <label>Relógio da missão
            <select data-setting="speed" data-testid="setting-speed">
              <option value="1" ${file.settings.speed === 1 ? 'selected' : ''}>1× • padrão</option>
              <option value="3" ${file.settings.speed === 3 ? 'selected' : ''}>3× • todos os custos e perigos aceleram</option>
            </select>
          </label>
        </div>
        <p class="fine">Legendas sempre visíveis. Recursos combinam ícone, nome, unidade explícita (kW, kWh, kg, m, s) e cor. Teclado: WASD/setas, Shift correr, Espaço saltar, E interagir, Tab missão, H episódio, J ciência, M mapa, C equipe, Esc pausa.</p>
        <div class="actions">
          <button type="button" data-debug data-testid="btn-toggle-metrics">Mostrar/ocultar métricas 3D</button>
          ${!started ? '<button type="button" data-menu="intro">Voltar ao início</button>' : returnMenu ? `<button type="button" data-menu="${returnMenu}">Voltar</button>` : ''}
        </div>`,
        true,
        'settings-modal',
        focusSelector,
      );
      return;
    }

    if (menu === 'report') {
      renderReport();
      return;
    }

    if (menu === 'restart') {
      modal(
        'Recomeçar a expedição?',
        'NOVO CICLO',
        `<p>Uma nova partida substituirá o save atual neste navegador mantendo suas preferências de acessibilidade e aparência.</p>
        <div class="actions">
          <button type="button" class="primary" data-start="new" data-testid="btn-confirm-restart">Começar na academia</button>
          <button type="button" data-menu="pause">Manter a expedição atual</button>
        </div>`,
        false,
        'restart-modal',
        focusSelector,
      );
      return;
    }

    modal(
      'Respire. Observe. Planeje.',
      'EXPEDIÇÃO PAUSADA',
      `<p>Simulação e mundo 3D estão pausados uniformemente. Nenhum recurso ou perigo avança enquanto este painel estiver aberto.</p>
      <div class="actions">
        <button type="button" class="primary" data-close data-testid="btn-resume-pause">Continuar</button>
        <button type="button" data-save data-testid="btn-save-now">Salvar expedição</button>
        <button type="button" data-menu="episode">Episódio 01 / Histórico</button>
        <button type="button" data-menu="journal">Diário científico</button>
        <button type="button" data-menu="companions">Equipe & Cometa</button>
        <button type="button" data-menu="settings">Opções</button>
        <button type="button" data-menu="report">Relatório da sessão</button>
        <button type="button" data-retry data-testid="btn-pause-retry">Restaurar checkpoint</button>
        <button type="button" data-menu="restart">Começar outra expedição</button>
      </div>`,
      false,
      'pause-modal',
      focusSelector,
    );
  }

  function drawMap(): void {
    if (!world) return;
    const canvas = $<HTMLCanvasElement>('radar');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 144, 144);
    ctx.strokeStyle = '#284456';
    for (let i = 12; i < 144; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 144);
      ctx.moveTo(0, i);
      ctx.lineTo(144, i);
      ctx.stroke();
    }
    const plan = REGIONS[state.region];
    const scale = 60 / plan.bounds;
    for (const t of plan.targets) {
      ctx.fillStyle = near?.id === t.id ? '#ffc86b' : '#65d9e8';
      ctx.fillRect(70 + t.position.x * scale, 70 - t.position.z * scale, 4, 4);
    }
    const p = world.getPose();
    ctx.save();
    ctx.translate(72 + p.position.x * scale, 72 - p.position.z * scale);
    ctx.rotate(p.heading);
    ctx.fillStyle = '#ffae58';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#bcd4df';
    ctx.font = '10px sans-serif';
    ctx.fillText('N', 69, 10);
  }

  function renderHud(): void {
    const r = state.resources;
    const objective = getObjectives(state).find((o) => !o.complete);
    const local = objective ? objectiveNames[objective.id] : undefined;
    const battery = state.phase === 'academy' ? state.academyBattery : r.battery;
    const paused = isPaused();

    const regionEl = $('region');
    const nextRegionText = regionNames[state.region];
    if (regionEl && regionEl.textContent !== nextRegionText) {
      regionEl.textContent = nextRegionText;
    }

    const timeEl = $('time');
    const nextTimeText = `T+ ${Math.floor(state.tick / 60)
      .toString()
      .padStart(2, '0')}:${(state.tick % 60).toString().padStart(2, '0')} • ${
      paused ? '⏸ PAUSADO' : `${file.settings.speed}×`
    }`;
    if (timeEl && timeEl.textContent !== nextTimeText) {
      timeEl.textContent = nextTimeText;
    }

    const hudResources = { oxygen: r.oxygen, battery, potable: r.potable, food: r.food };
    const lowReminder = resourceReminder(hudResources, started && state.phase !== 'complete' && state.phase !== 'failed');
    const reminderTarget = resourceReminderTarget(lowReminder, state.cometa.enabled);
    $('hud').classList.toggle('reserves-low', Boolean(lowReminder));
    setHtmlIfChanged('resources', renderResourceHud(hudResources, started && state.phase !== 'complete' && state.phase !== 'failed'));

    setHtmlIfChanged(
      'objective',
      objective
        ? `<h2>${escapeHtml(local?.[0] ?? objective.title)}</h2>
         <p>${escapeHtml(local?.[1] ?? objective.description)}</p>
         <span class="target-tag">⌖ ${escapeHtml(targetNames[objective.targetWorldId] ?? objective.targetWorldId)}</span>`
        : `<h2>${state.phase === 'complete' ? '✓ Missão concluída' : '⏸ Jornada em pausa'}</h2>
         <p>Consulte o relatório da expedição.</p>`,
    );

    // PIP & Episode 01 live card
    const beatDisplay = getEpisodeBeatDisplay(state);
    const beat = beatDisplay.beat;
    const pipHint = state.flags.sheltered
      ? '🛡 Abrigo ativo: os sistemas seguem funcionando. Aguarde a tempestade passar para sair.'
      : state.storm === 'active'
        ? '⚠ Tempestade de radiação ativa! Volte ao abrigo na Base Aurora imediatamente.'
        : state.storm === 'warning'
          ? '⚠ Alerta de radiação: interrompa tarefas externas e siga para o abrigo.'
          : state.scoutRepairRemaining > 0
            ? `Scout em reparo (${state.scoutRepairRemaining} s). Aguarde com os painéis fechados.`
            : Object.values(state.modules).some((m) => m.repairRemaining > 0)
              ? 'Reparo em andamento. O relógio avança quando os painéis estão fechados.'
              : reminderTarget.pip ?? beat.lines[0]?.line ?? local?.[1] ?? 'Cada medida conta uma parte da história.';

    setHtmlIfChanged(
      'pip',
      `${renderStableHudPortrait('hud-pip', 'pip', { size: 'sm', decorative: true })}
      <div class="pip-body">
        <div class="pip-top">
          <span class="eyebrow" data-testid="episode-beat-badge">EP.01 • ${String(beat.order).padStart(2, '0')}/10 • ${escapeHtml(beat.title)}</span>
        </div>
        <p id="hint">${escapeHtml(pipHint)}</p>
        <div class="pip-actions">
          <button type="button" class="mini-btn" data-menu="episode" data-testid="btn-open-episode">Diálogo</button>
          ${
            beatDisplay.canSkip && !beatDisplay.visited && !beatDisplay.skipped
              ? `<button type="button" class="mini-btn" data-skip-beat="${beat.id}" data-testid="btn-skip-beat">Pular opcional ↷</button>`
              : ''
          }
        </div>
      </div>`,
    );

    const storm = $('storm');
    const showStorm =
      (state.storm === 'warning' || state.storm === 'active') &&
      state.phase !== 'academy' &&
      state.phase !== 'orbit';
    storm.hidden = !showStorm;
    storm.classList.toggle('danger', state.storm === 'active');
    setHtmlIfChanged(
      'storm',
      state.storm === 'active'
        ? `⚠ <strong>TEMPESTADE ATIVA</strong> • ${state.flags.sheltered ? '🛡 EQUIPE ABRIGADA' : 'BUSQUE ABRIGO'} • segurança ${fmtPt(state.health, 0)}/100`
        : `⚠ <strong>ALERTA DE RADIAÇÃO</strong> • abrigo em até ${Math.max(0, 300 - (state.lunarTick % 600))} s da missão`,
    );

    setHtmlIfChanged('cometa-strip', renderCometaControlsBlock('hud', reminderTarget.cometa));

    setHtmlIfChanged(
      'interact',
      state.flags.sheltered
        ? '<button type="button" data-action="exitShelter" data-testid="btn-exit-shelter"><kbd>EVA</kbd><span>🛡 Abrigado • <strong>Sair do abrigo</strong></span></button>'
        : near
          ? `<button type="button" data-interact data-testid="btn-interact"><kbd>E</kbd><span>Inspecionar <strong>${escapeHtml(targetNames[near.id] ?? near.name)}</strong></span></button>`
          : '<span class="walk-hint">Explore • aproxime-se de uma estação para interagir</span>',
    );

    const touchInteract = app.querySelector<HTMLButtonElement>('[data-touch-interact]');
    if (touchInteract) {
      const nextDisabled = !near && !state.flags.sheltered;
      if (touchInteract.disabled !== nextDisabled) {
        touchInteract.disabled = nextDisabled;
      }
      const label = touchInteract.querySelector('span');
      const nextLabel = state.flags.sheltered ? 'Sair' : near ? 'Inspec.' : 'Explorar';
      if (label && label.textContent !== nextLabel) {
        label.textContent = nextLabel;
      }
    }

    setHtmlIfChanged(
      'inventory',
      `<span><b>▧</b> ${fmtPt(r.samples, 1)} kg gelo</span>
      <span><b>⚒</b> ${r.parts} peças</span>
      <span><b>◉</b> ${state.flags.scoutRecruited ? `PIP + Scout (${fmtPt(r.companionBattery, 1)} kWh)` : 'PIP'}</span>
      <span class="power-flow">⚡ ${fmtPt(state.powerSupply, 1)} → ${fmtPt(state.powerDemand, 1)} kW</span>`,
    );

    drawMap();
  }

  function doAction(
    action: Action,
    payload?: Record<string, unknown>,
    focusSelector?: string,
  ): void {
    const before = state;
    const result = applyAction(state, action, payload);

    if (result.ok) {
      state = result.state;
      if (action === 'petCometa') lastCometaCue = 'pet';
      else if (action === 'cometaSniff') lastCometaCue = 'sniff';
      else if (action === 'cometaLookBeacon') lastCometaCue = 'beacon';
      else if (
        action === 'repairPower' ||
        action === 'repairWater' ||
        action === 'repairOxygen' ||
        action === 'repairCompanion'
      ) {
        lastCometaCue = 'watch_repair';
      }
      syncWorldFromState(action);
      safeSave(false);
    } else if (
      action === 'dispatchScoutScan' &&
      result.state.flags.scoutStrandedOutOfCharge &&
      !state.flags.scoutStrandedOutOfCharge
    ) {
      state = result.state;
      syncWorldFromState();
      safeSave(false);
    }

    const message = result.ok
      ? `✓ ${result.message}`
      : `⚠ ${result.message}`;
    notify(result.message);

    if (menu === 'station' && inspected) {
      renderStation(inspected, focusSelector);
      const fb = $('station-feedback');
      if (fb) fb.textContent = message;
    } else if (menu === 'companions') {
      renderCompanionsModal(focusSelector);
    } else if (menu === 'episode') {
      renderEpisodeModal(focusSelector);
    } else if (menu === 'journal') {
      renderJournalModal(focusSelector);
    }

    if (action === 'shelter' && result.ok) {
      setMenu(null);
    }
    if (action === 'exitShelter' && result.ok) {
      syncPause();
    }
    if (before.phase !== state.phase) {
      endedShown = false;
    }
    renderHud();
  }

  async function travel(region: RegionId): Promise<void> {
    const result = applyAction(state, 'travel', { region });
    if (!result.ok) {
      notify(result.message);
      const fb = $('station-feedback');
      if (fb) fb.textContent = `⚠ ${result.message}`;
      return;
    }
    const previous = state;
    const oldPose = world?.getPose();
    clearMovementInputs();
    transitioning = true;
    setMenu(null);
    $('loading').hidden = false;
    $('loading').querySelector('h1')!.textContent = `A caminho de ${regionNames[region]}`;
    try {
      await world?.changeRegion(region);
      state = result.state;
      syncWorldFromState('travel');
      if (
        (previous.phase === 'academy' && region === 'orbit') ||
        (previous.phase === 'orbit' && region === 'habitat')
      ) {
        safeCheckpoint();
      }
      safeSave(false);
      notify(`Você chegou: ${regionNames[region]}.`);
    } catch {
      state = previous;
      await world?.changeRegion(previous.region, oldPose);
      syncWorldFromState();
      notify('A passagem falhou. Sua posição e seus recursos foram preservados.');
    } finally {
      transitioning = false;
      $('loading').hidden = true;
      clock.reset(performance.now());
      syncPause();
      renderHud();
    }
  }

  async function start(fresh: boolean): Promise<void> {
    if (!world) return;
    transitioning = true;
    clearMovementInputs();
    if (fresh) {
      const prevSettings = { ...file.settings };
      const prevAppearance: CadetAppearance = { ...file.cadetAppearance };
      const prevUiPrefs = { ...file.uiPrefs };
      file = newSave({
        cadetAppearance: prevAppearance,
        cometaEnabled: introCometaEnabled,
      });
      file.settings = prevSettings;
      file.uiPrefs = prevUiPrefs;
      state = file.current.simulation;
      cargoDraftIds = [...DEFAULT_CARGO_IDS];
      loadoutDraftIds = [...DEFAULT_LOADOUT_IDS];
      endedShown = false;
    } else {
      state = file.current.simulation;
      cargoDraftIds =
        state.selectedCargoIds.length > 0 ? [...state.selectedCargoIds] : [...DEFAULT_CARGO_IDS];
      loadoutDraftIds =
        state.selectedLoadoutIds.length > 0 ? [...state.selectedLoadoutIds] : [...DEFAULT_LOADOUT_IDS];
    }
    started = true;
    setMenu(null);
    try {
      await world.changeRegion(state.region, file.current.pose);
      syncWorldFromState();
      applySettings();
      safeSave(false);
    } catch {
      notify('Não foi possível abrir esta região. Recarregue a página.');
    } finally {
      transitioning = false;
      clock.reset(performance.now());
      syncPause();
      renderHud();
      if (state.phase === 'complete' || state.phase === 'failed') {
        endedShown = true;
        setMenu('report');
      }
    }
  }

  async function retry(): Promise<void> {
    if (!world) return;
    transitioning = true;
    clearMovementInputs();
    const restoredSnap = snapshot(
      file.checkpoint.simulation,
      file.checkpoint.pose,
      file.checkpoint.cometa,
    );
    state = restoredSnap.simulation;
    file.current = restoredSnap;
    file.cometa = structuredClone(restoredSnap.cometa!);
    cargoDraftIds =
      state.selectedCargoIds.length > 0 ? [...state.selectedCargoIds] : [...DEFAULT_CARGO_IDS];
    loadoutDraftIds =
      state.selectedLoadoutIds.length > 0 ? [...state.selectedLoadoutIds] : [...DEFAULT_LOADOUT_IDS];
    endedShown = false;
    setMenu(null);
    try {
      await world.changeRegion(state.region, file.checkpoint.pose);
      syncWorldFromState();
      safeSave(false);
      notify('Checkpoint restaurado por inteiro. Experimente outra ordem de decisões.');
    } catch {
      notify('Não foi possível restaurar a região do checkpoint.');
    } finally {
      transitioning = false;
      clock.reset(performance.now());
      syncPause();
      renderHud();
    }
  }

  function downloadReport(): void {
    const data = {
      demo: 'ASTRA independent v0.3',
      timeModel: '1 tick = 1 second = 0.01 mission hours',
      report: getReport(state),
      cadetAppearance: file.cadetAppearance,
      cometa: file.cometa,
      assumptions: 'public/science/assumptions.json',
      sourceIds: sources.map((s) => s.id),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'astra-relatorio.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Click delegation
  app.addEventListener('click', (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('button, a[data-menu]');
    if (!el) return;

    // Return focus to canvas after mouse-clicking non-modal HUD quick buttons so WASD works immediately.
    const inModal = Boolean(el.closest('#modal-layer'));
    const pointerTriggered = (event as MouseEvent).detail > 0;

    if (el.hasAttribute('data-menu')) {
      event.preventDefault();
      setMenu(el.dataset.menu!);
      return;
    }
    if (el.hasAttribute('data-close')) {
      setMenu(started ? null : 'intro');
      return;
    }
    if (el.hasAttribute('data-start')) {
      void start(el.dataset.start === 'new');
      return;
    }
    if (el.hasAttribute('data-interact')) {
      world?.interact();
      return;
    }
    if (el.hasAttribute('data-skip-beat')) {
      const beatId = el.dataset.skipBeat as BeatId;
      doAction('advanceBeat', { beatId, skipped: true });
      if (!inModal && pointerTriggered && !menu) $('world').focus();
      return;
    }
    if (el.hasAttribute('data-action')) {
      const action = el.dataset.action as Action;
      let payload: Record<string, unknown> | undefined;
      if (el.dataset.payload) {
        try {
          payload = JSON.parse(el.dataset.payload) as Record<string, unknown>;
        } catch {
          payload = undefined;
        }
      }
      const focusHook = el.dataset.testid ? `[data-testid="${el.dataset.testid}"]` : undefined;
      doAction(action, payload, focusHook);
      if (!inModal && pointerTriggered && !menu) $('world').focus();
      return;
    }
    if (el.hasAttribute('data-probe-id')) {
      const id = el.dataset.probeId as DiscoveryId;
      const hyp = probeHypothesisDraft[id]?.trim() || `Hipótese observada para ${discoveryCatalogLabels[id].title}`;
      doAction('runFieldProbe', { id, hypothesis: hyp }, `[data-testid="btn-probe-${id}"]`);
      return;
    }
    if (el.hasAttribute('data-cargo-preset')) {
      cargoDraftIds = [...DEFAULT_CARGO_IDS];
      if (menu === 'station' && inspected) renderStation(inspected, '[data-testid="btn-cargo-preset"]');
      return;
    }
    if (el.hasAttribute('data-cargo-submit')) {
      doAction('collectCargo', { itemIds: cargoDraftIds }, '[data-testid="btn-cargo-submit"]');
      return;
    }
    if (el.hasAttribute('data-loadout-preset')) {
      loadoutDraftIds = [...DEFAULT_LOADOUT_IDS];
      if (menu === 'station' && inspected) renderStation(inspected, '[data-testid="btn-loadout-preset"]');
      return;
    }
    if (el.hasAttribute('data-loadout-submit')) {
      doAction('chooseLoadout', { itemIds: loadoutDraftIds }, '[data-testid="btn-loadout-submit"]');
      return;
    }
    if (el.hasAttribute('data-kit-install')) {
      const pieceId = el.dataset.kitInstall as FieldKitPieceId;
      doAction(
        'installFieldKitPiece',
        { pieceId, slot: fieldKitSlotTarget },
        `[data-testid="btn-kit-install-${pieceId}"]`,
      );
      return;
    }
    if (el.hasAttribute('data-journal-tab')) {
      journalTab = el.dataset.journalTab as 'discoveries' | 'evidence' | 'sources';
      renderJournalModal(`[data-journal-tab="${journalTab}"]`);
      return;
    }
    if (el.hasAttribute('data-episode-tab')) {
      episodeTab = el.dataset.episodeTab as 'current' | 'history' | 'all';
      renderEpisodeModal(`[data-episode-tab="${episodeTab}"]`);
      return;
    }
    if (el.hasAttribute('data-select-beat')) {
      selectedBeatId = el.dataset.selectBeat as BeatId;
      episodeTab = 'current';
      renderEpisodeModal('[data-testid="tab-episode-current"]');
      return;
    }
    if (el.hasAttribute('data-travel')) {
      void travel(el.dataset.travel as RegionId);
      return;
    }
    if (el.hasAttribute('data-retry')) {
      void retry();
      return;
    }
    if (el.hasAttribute('data-checkpoint')) {
      if (state.storm === 'active') {
        notify('Espere a tempestade terminar antes de atualizar o checkpoint.');
      } else {
        safeCheckpoint();
      }
      return;
    }
    if (el.hasAttribute('data-save')) {
      safeSave(true);
      return;
    }
    if (el.hasAttribute('data-download')) {
      downloadReport();
      return;
    }
    if (el.hasAttribute('data-hint')) {
      const topic = inspected ? stations[inspected.id]?.topic : undefined;
      const feedback = $('station-feedback');
      if (feedback) feedback.textContent = topicFacts[topic ?? 'energy'];
      return;
    }
    if (el.hasAttribute('data-debug')) {
      showMetrics = !showMetrics;
      $('metrics').hidden = !showMetrics;
    }
  });

  // Change & input delegation (settings, customizer, cargo/loadout drafts, hypothesis text, kit slot)
  app.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement | HTMLSelectElement;

    if (el.dataset.setting) {
      const key = el.dataset.setting;
      if (key === 'quality') file.settings.quality = el.value === 'low' ? 'low' : 'high';
      if (key === 'largeText' || key === 'reducedMotion') {
        file.settings[key] = (el as HTMLInputElement).checked;
      }
      if (key === 'compactHud') {
        file.uiPrefs.compactHud = (el as HTMLInputElement).checked;
      }
      if (key === 'touchControls') {
        touchPref = el.value === 'on' || el.value === 'off' ? el.value : 'auto';
        saveTouchPref(touchPref);
      }
      if (key === 'speed') file.settings.speed = el.value === '3' ? 3 : 1;
      applySettings();
      safeSave(false);
      renderHud();
      return;
    }

    if (el.dataset.appearance) {
      const field = el.dataset.appearance as keyof CadetAppearance;
      file.cadetAppearance = {
        ...file.cadetAppearance,
        [field]: el.value || defaultCadetAppearance[field],
      };
      world?.setCadetAppearance?.(file.cadetAppearance);
      safeSave(false);
      const preview = app.querySelector<HTMLElement>('[data-testid="cadet-preview"]');
      if (preview) {
        const svgOld = preview.querySelector('svg');
        if (svgOld) {
          svgOld.outerHTML = renderPortraitSvg('cadet', {
            size: 'lg',
            appearance: file.cadetAppearance,
          });
        }
      }
      return;
    }

    if (el.hasAttribute('data-intro-cometa')) {
      introCometaEnabled = (el as HTMLInputElement).checked;
      return;
    }

    if (el.dataset.cargoItem) {
      const id = el.dataset.cargoItem;
      const checked = (el as HTMLInputElement).checked;
      cargoDraftIds = checked
        ? Array.from(new Set([...cargoDraftIds, id]))
        : cargoDraftIds.filter((item) => item !== id);
      if (menu === 'station' && inspected) {
        renderStation(inspected, `[data-cargo-item="${id}"]`);
      }
      return;
    }

    if (el.dataset.loadoutItem) {
      const id = el.dataset.loadoutItem;
      const checked = (el as HTMLInputElement).checked;
      loadoutDraftIds = checked
        ? Array.from(new Set([...loadoutDraftIds, id]))
        : loadoutDraftIds.filter((item) => item !== id);
      if (menu === 'station' && inspected) {
        renderStation(inspected, `[data-loadout-item="${id}"]`);
      }
      return;
    }

    if (el.hasAttribute('data-kit-slot')) {
      fieldKitSlotTarget = Number(el.value) || 0;
    }
  });

  app.addEventListener('input', (event) => {
    const el = event.target as HTMLInputElement;
    if (el.dataset.hypothesisId) {
      probeHypothesisDraft[el.dataset.hypothesisId] = el.value;
    }
  });

  // Pointer/Touch virtual D-Pad + Jump + Sprint + Interact wiring
  const touchLayer = $('touch-controls');
  touchLayer.addEventListener('pointerdown', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn || isPaused()) return;
    event.preventDefault();
    try {
      btn.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic events where pointerId cannot be captured.
    }
    if (btn.dataset.touchMove) {
      activeMovePointers.set(
        event.pointerId,
        btn.dataset.touchMove as 'forward' | 'back' | 'left' | 'right',
      );
      syncTouchInput();
      return;
    }
    if (btn.hasAttribute('data-touch-jump')) {
      activeJumpPointers.add(event.pointerId);
      syncTouchInput();
      return;
    }
    if (btn.hasAttribute('data-touch-sprint')) {
      touchSprintOn = !touchSprintOn;
      syncTouchInput();
      return;
    }
    if (btn.hasAttribute('data-touch-interact')) {
      if (state.flags.sheltered) {
        doAction('exitShelter');
      } else {
        world?.interact();
      }
    }
  });

  const releaseTouchPointer = (event: PointerEvent) => {
    let changed = false;
    if (activeMovePointers.delete(event.pointerId)) changed = true;
    if (activeJumpPointers.delete(event.pointerId)) changed = true;
    if (changed) syncTouchInput();
  };
  touchLayer.addEventListener('pointerup', releaseTouchPointer);
  touchLayer.addEventListener('pointercancel', releaseTouchPointer);
  touchLayer.addEventListener('lostpointercapture', releaseTouchPointer);

  // Keyboard navigation, modal Tab trap, uniform Esc pause, and shortcuts
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && menu) {
      const focusables = Array.from(
        $('modal-layer').querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (focusables.length === 0) return;
      if (event.shiftKey && (document.activeElement === first || ! $('modal-layer').contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !$('modal-layer').contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (started) {
        event.preventDefault();
        setMenu(menu ? null : 'pause');
      }
      return;
    }

    if ((event.target as HTMLElement)?.closest('input, select, textarea')) return;
    if (!started || menu || event.repeat) return;

    const key = event.key.toLowerCase();
    if (key === 'tab') {
      event.preventDefault();
      setMenu('quests');
    } else if (key === 'j') {
      event.preventDefault();
      setMenu('journal');
    } else if (key === 'm') {
      event.preventDefault();
      setMenu('map');
    } else if (key === 'h') {
      event.preventDefault();
      setMenu('episode');
    } else if (key === 'c') {
      event.preventDefault();
      setMenu('companions');
    } else if (key === 'p') {
      event.preventDefault();
      setMenu('pause');
    }
  });

  // Uniform pause & held-input cleanup on focus loss / hide / pagehide / resize
  window.addEventListener('blur', () => {
    clearMovementInputs();
  });
  window.addEventListener('resize', () => {
    syncTouchControlsVisibility();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearMovementInputs();
      if (shouldPersistOnBackground(started)) safeSave(false);
    }
    clock.reset(performance.now());
    syncPause();
    renderHud();
  });
  window.addEventListener('pagehide', () => {
    clearMovementInputs();
    if (shouldPersistOnBackground(started)) safeSave(false);
  });

  async function boot(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}science/sources.json`);
      const data = await res.json();
      sources = data.sources ?? [];
    } catch {
      notify('Fontes locais indisponíveis. As explicações dos equipamentos continuam disponíveis.');
    }

    try {
      const { createGameWorld } = await import('./world/createGameWorld');
      world = await createGameWorld($<HTMLCanvasElement>('world'), {
        onTarget(t) {
          near = t;
          renderHud();
        },
        onInteract(t) {
          clearMovementInputs();
          inspected = t;
          if (t.id === 'field-locker' && !state.flags.loadout) {
            loadoutDraftIds =
              state.selectedLoadoutIds.length > 0
                ? [...state.selectedLoadoutIds]
                : [...DEFAULT_LOADOUT_IDS];
          }
          if (t.id === 'cargo' && !state.flags.cargo) {
            cargoDraftIds =
              state.selectedCargoIds.length > 0
                ? [...state.selectedCargoIds]
                : [...DEFAULT_CARGO_IDS];
          }
          setMenu('station');
        },
        onRegion() {
          near = null;
        },
        onMetrics(m: WorldMetrics) {
          const extras = [
            m.frameTimeMs !== undefined ? `${fmtPt(m.frameTimeMs, 1)} ms` : null,
            m.triangles !== undefined ? `${m.triangles} tris` : null,
          ]
            .filter(Boolean)
            .join(' • ');
          $('metrics').textContent = `${m.engine} • ${m.fps} FPS • ${m.activeMeshes}/${m.meshes} meshes • ${m.drawCalls} draw calls${extras ? ` • ${extras}` : ''}`;
          drawMap();
        },
        onError(message) {
          notify(`Aviso 3D: ${message}`);
        },
      });

      transitioning = false;
      syncWorldFromState();
      applySettings();
      syncPause();
      $('loading').hidden = true;
      setMenu('intro');
    } catch {
      transitioning = false;
      $('loading').hidden = true;
      modal(
        'A expedição precisa de WebGL 2',
        'MUNDO 3D INDISPONÍVEL',
        `<p>Ative aceleração gráfica no Chrome e recarregue. A demo precisa carregar seus modelos locais e de um navegador com WebGL 2.</p>
        <p>O código e os testes estão no <a href="https://github.com/andrecodexvictor/astra-lunar-frontier">repositório público</a>.</p>`,
        false,
        'webgl-error-modal',
      );
    }
  }

  window.setInterval(() => {
    const elapsed = clock.advance(performance.now(), isPaused(), file.settings.speed);
    if (elapsed > 0) {
      const previousTick = state.tick;
      const previousStorm = state.storm;
      state = stepGame(state, elapsed);
      if (state.storm !== previousStorm) {
        syncWorldFromState();
      }
      if (state.tick - lastSaveTick >= 10) {
        lastSaveTick = state.tick;
        safeSave(false);
      }
      if ((state.phase === 'failed' || state.phase === 'complete') && !endedShown) {
        endedShown = true;
        safeSave(false);
        setMenu('report');
      }
      if (state.tick !== previousTick) {
        renderHud();
      }
    }
  }, 100);

  void boot();
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  mountAstraApp();
}
