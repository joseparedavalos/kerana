import { GAMEPLAY } from '../config/gameplay';
import { BOSS_LAYER, INSTRUMENTS, TRACKS, type MusicKey, type TrackId } from '../data/music';
import { bossVariant, normalize, peak, renderTrack, rms, type TrackDef } from './musicLogic';
import { SaveManager } from './SaveManager';
import type { MusicJob, MusicResult } from './musicWorker';
import { SFX_PRESETS, type SfxKey } from './sfxPresets';

// AudioManager (GDD §10.4): efectos y música, los dos generados por código con ZzFX.
// S37: una pista por escena con fundidos, música más baja durante los diálogos, pausa al perder el foco,
// desbloqueo con el primer toque o tecla y volúmenes de Opciones. Si algo falla, el juego sigue en silencio.

type ZzfxModule = typeof import('zzfx');
type Playing = { key: MusicKey; source: AudioBufferSourceNode; gain: GainNode };

const CFG = GAMEPLAY.audio;
/** Gestos que cuentan para los navegadores (en iOS, el de soltar el dedo). */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

export class AudioManager {
  private static muted = false;
  private static installed = false;
  private static zz: ZzfxModule | null = null;
  private static zzfxPromise: Promise<ZzfxModule> | null = null;
  /** Hubo un gesto: ya se puede crear y reanudar el AudioContext. */
  private static gestured = false;
  /** La pestaña está oculta o la ventana perdió el foco. */
  private static away = false;
  private static ducked = false;
  /** La pista que pidió la escena (puede no estar sonando todavía: falta el gesto o se está generando). */
  private static wanted: MusicKey | null = null;
  private static playing: Playing | null = null;
  private static musicBus: GainNode | null = null;
  private static readonly buffers = new Map<MusicKey, AudioBuffer>();
  private static readonly rendering = new Map<MusicKey, Promise<AudioBuffer | null>>();
  /** Para la prueba de humo: pistas que arrancaron, en orden, y errores de audio. */
  private static readonly started: MusicKey[] = [];
  private static readonly failures: string[] = [];

  /** Una vez, al arrancar el juego: escucha el primer gesto y el foco de la ventana. */
  static install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const onGesture = () => this.onGesture();
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, onGesture, { capture: true, passive: true });
    const onFocus = () => this.setAway(document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('blur', () => this.setAway(true));
    window.addEventListener('focus', onFocus);
    (window as unknown as { __KERANA_AUDIO__: unknown }).__KERANA_AUDIO__ = {
      state: () => this.debugState(),
      renderAll: () => this.debugRenderAll(),
      sfxRms: (keys: SfxKey[]) => this.debugSfxRms(keys),
    };
  }

  /** `pan`: -1 (izquierda) a 1 (derecha); el silbido de Jasy Jatere lo usa como pista (GDD §6.4). */
  static play(key: SfxKey, pan = 0): void {
    const volume = SaveManager.current.settings.sfx;
    if (this.muted || volume <= 0) return;
    void this.zzfxModule()
      .then(({ ZZFX }) => {
        ZZFX.playSamples([ZZFX.buildSamples(...SFX_PRESETS[key])], volume, 1, Math.max(-1, Math.min(1, pan)));
      })
      .catch(() => {
        /* sin audio disponible: se ignora */
      });
  }

  static setMuted(muted: boolean): void {
    this.muted = muted;
    this.refreshVolumes();
  }

  /**
   * La música de la escena. La misma pista que ya suena sigue sin cortarse; otra entra con fundido y la
   * anterior se va con el suyo. `null` = silencio (con fundido).
   */
  static music(key: MusicKey | null): void {
    if (key === this.wanted) return;
    this.wanted = key;
    this.switchMusic();
  }

  /** Diálogo abierto: la música baja y vuelve al cerrarlo. */
  static duck(on: boolean): void {
    if (on === this.ducked) return;
    this.ducked = on;
    this.refreshVolumes(CFG.duckMs);
  }

  /** Relee los volúmenes de Opciones. */
  static refreshVolumes(rampMs = 0): void {
    const bus = this.musicBus;
    if (!bus) return;
    const target = this.muted ? 0 : SaveManager.current.settings.music * CFG.musicGain * (this.ducked ? CFG.duckFactor : 1);
    const now = bus.context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(target, now + Math.max(0.01, rampMs / 1000));
  }

  // ── Desbloqueo y foco ────────────────────────────────────────────────────

  private static onGesture(): void {
    this.gestured = true;
    // Con el módulo ya cargado, se reanuda dentro del gesto (iOS lo exige); si no, apenas cargue.
    if (this.zz) this.resumeContext();
    else void this.zzfxModule().then(() => this.resumeContext(), () => undefined);
  }

  private static resumeContext(): void {
    const ctx = this.zz?.ZZFX.audioContext;
    if (!ctx) return;
    // Sin foco la pista arranca igual, con el contexto en pausa: suena al volver.
    if (!this.away && ctx.state !== 'running') ctx.resume().catch((e: unknown) => this.fail(`resume: ${String(e)}`));
    this.switchMusic();
  }

  private static setAway(away: boolean): void {
    if (away === this.away) return;
    this.away = away;
    const ctx = this.zz?.ZZFX.audioContext;
    if (!ctx || !this.gestured) return;
    if (away) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  }

  // ── Música ───────────────────────────────────────────────────────────────

  private static switchMusic(): void {
    const ctx = this.zz?.ZZFX.audioContext;
    if (!ctx || !this.gestured) return;
    const key = this.wanted;
    if (this.playing?.key === key) return;
    this.fadeOutCurrent(ctx);
    if (!key) return;
    void this.buffer(ctx, key).then((buffer) => {
      // Mientras se generaba, la escena pudo pedir otra pista (o ya está sonando esta).
      if (!buffer || this.wanted !== key || this.playing?.key === key) return;
      this.fadeOutCurrent(ctx);
      this.startTrack(ctx, key, buffer);
    });
  }

  private static startTrack(ctx: AudioContext, key: MusicKey, buffer: AudioBuffer): void {
    try {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + CFG.fadeInMs / 1000);
      gain.connect(this.bus(ctx));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      this.playing = { key, source, gain };
      this.started.push(key);
    } catch (e) {
      this.fail(`start ${key}: ${String(e)}`);
    }
  }

  private static fadeOutCurrent(ctx: AudioContext): void {
    const old = this.playing;
    if (!old) return;
    this.playing = null;
    const now = ctx.currentTime;
    const end = now + CFG.fadeOutMs / 1000;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, end);
    try {
      old.source.stop(end);
    } catch {
      /* ya estaba parada */
    }
    old.source.onended = () => old.gain.disconnect();
  }

  private static bus(ctx: AudioContext): GainNode {
    if (!this.musicBus) {
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(ctx.destination);
      this.refreshVolumes(CFG.fadeInMs);
    }
    return this.musicBus;
  }

  /** La pista ya generada, o la genera (en pedazos, sin trabar cuadros). `null` si falta o falla. */
  private static buffer(ctx: AudioContext, key: MusicKey): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(key);
    if (ready) {
      // Recién usada: al final de la fila (la que se descarta es la más vieja).
      this.buffers.delete(key);
      this.buffers.set(key, ready);
      return Promise.resolve(ready);
    }
    const pending = this.rendering.get(key);
    if (pending) return pending;
    const def = trackDef(key);
    if (!def) {
      console.warn(`[MÚSICA FALTANTE] ${key}: el juego sigue sin música.`);
      return Promise.resolve(null);
    }
    const job = this.renderSamples(def)
      .then((samples) => {
        const buffer = ctx.createBuffer(1, samples.length, CFG.musicSampleRate);
        buffer.getChannelData(0).set(samples);
        this.buffers.set(key, buffer);
        while (this.buffers.size > CFG.cacheTracks) this.buffers.delete(this.buffers.keys().next().value!);
        return buffer;
      })
      .catch((e: unknown) => {
        this.fail(`render ${key}: ${String(e)}`);
        return null;
      })
      .finally(() => this.rendering.delete(key));
    this.rendering.set(key, job);
    return job;
  }

  private static worker: Worker | null | undefined;
  private static nextJob = 0;
  private static readonly jobs = new Map<number, { resolve: (s: Float32Array) => void; reject: (e: Error) => void }>();

  /** Genera en el worker; si el navegador no lo deja, en el hilo principal (en pedazos). */
  private static renderSamples(def: TrackDef): Promise<Float32Array> {
    const worker = this.musicWorker();
    if (!worker) return this.renderHere(def);
    const id = ++this.nextJob;
    const job: MusicJob = { id, def, sampleRate: CFG.musicSampleRate, rms: CFG.musicRms, ceiling: CFG.musicCeiling };
    return new Promise<Float32Array>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      worker.postMessage(job);
    }).catch(() => this.renderHere(def));
  }

  private static musicWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    try {
      const worker = new Worker(new URL('./musicWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<MusicResult>) => {
        const job = this.jobs.get(e.data.id);
        if (!job) return;
        this.jobs.delete(e.data.id);
        if ('samples' in e.data) job.resolve(e.data.samples);
        else job.reject(new Error(e.data.error));
      };
      // Si el worker no arranca, lo pendiente y lo que venga se genera acá.
      worker.onerror = (e) => {
        e.preventDefault();
        this.worker = null;
        worker.terminate();
        for (const job of this.jobs.values()) job.reject(new Error('worker'));
        this.jobs.clear();
      };
      this.worker = worker;
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  private static async renderHere(def: TrackDef): Promise<Float32Array> {
    const { ZZFX } = await this.zzfxModule();
    const synth = (params: number[]) => {
      // ZzFX genera a su `sampleRate`; se cambia solo mientras dura esta nota (los efectos siguen a 44,1 kHz).
      const rate = ZZFX.sampleRate;
      ZZFX.sampleRate = CFG.musicSampleRate;
      try {
        return ZZFX.buildSamples(...params);
      } finally {
        ZZFX.sampleRate = rate;
      }
    };
    const samples = await renderTrack(def, INSTRUMENTS, synth, {
      sampleRate: CFG.musicSampleRate,
      yieldEvery: () => new Promise<void>((r) => setTimeout(r, 0)),
    });
    normalize(samples, CFG.musicRms, CFG.musicCeiling);
    return samples;
  }

  private static fail(msg: string): void {
    this.failures.push(msg);
    console.warn(`[audio] ${msg}`);
  }

  private static zzfxModule(): Promise<ZzfxModule> {
    if (!this.zzfxPromise) {
      this.zzfxPromise = import('zzfx').then((m) => {
        this.zz = m;
        return m;
      });
    }
    return this.zzfxPromise;
  }

  // ── Depuración (prueba de humo) ──────────────────────────────────────────

  private static debugState() {
    return {
      wanted: this.wanted,
      playing: this.playing?.key ?? null,
      context: this.zz?.ZZFX.audioContext.state ?? 'sin cargar',
      gestured: this.gestured,
      ducked: this.ducked,
      started: [...this.started],
      failures: [...this.failures],
      busGain: this.musicBus?.gain.value ?? 0,
      renderer: this.worker ? 'worker' : this.worker === null ? 'hilo principal' : 'sin usar',
    };
  }

  /** Genera las diez pistas y sus variantes de jefe; devuelve duración, intensidad y pico de cada una. */
  private static async debugRenderAll() {
    const out: { key: string; seconds: number; rms: number; peak: number }[] = [];
    for (const id of Object.keys(TRACKS) as TrackId[]) {
      for (const key of [id, `${id}_boss`] as MusicKey[]) {
        const samples = await this.renderSamples(trackDef(key)!);
        out.push({ key, seconds: samples.length / CFG.musicSampleRate, rms: rms(samples), peak: peak(samples) });
      }
    }
    return { tracks: out, musicGain: CFG.musicGain };
  }

  /** Intensidad de unos efectos tal como suenan (con el volumen de ZzFX aplicado dos veces, como en `playSamples`). */
  private static async debugSfxRms(keys: SfxKey[]) {
    const { ZZFX } = await this.zzfxModule();
    return keys.map((k) => {
      const s = ZZFX.buildSamples(...SFX_PRESETS[k].map((v, i) => (i === 1 ? 0 : v)));
      return { key: k, rms: rms(s) * ZZFX.volume, peak: peak(s) * ZZFX.volume };
    });
  }
}

function trackDef(key: MusicKey): TrackDef | null {
  const boss = key.endsWith('_boss');
  const base = TRACKS[(boss ? key.slice(0, -'_boss'.length) : key) as TrackId];
  if (!base) return null;
  return boss ? bossVariant(base, BOSS_LAYER) : base;
}
