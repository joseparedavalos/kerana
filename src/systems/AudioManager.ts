import { GAMEPLAY } from '../config/gameplay';
import { BOSS_LAYER, BOSS_LEVEL_TRACKS, INSTRUMENTS, JINGLES, TRACKS, type MusicKey, type TrackId } from '../data/music';
import { bossVariant, normalize, peak, renderJingle, renderTrack, rms, type JingleDef, type TrackDef } from './musicLogic';
import { SaveManager } from './SaveManager';
import type { MusicJob, MusicResult } from './musicWorker';
import { SFX_LAYERS, SFX_PRESETS, SFX_STOP_FADE_MS, type SfxKey } from './sfxPresets';
import { FOOTSTEP_SOURCES, SAMPLE_DIR, SAMPLE_EXT, SFX_SAMPLES, sampleName, type SampleDef, type Surface } from '../data/sfxSamples';
import { gainFor, jitter, loudness, pickVariant, soundSpan } from './sfxLogic';

// AudioManager (GDD §10.4): efectos y música, los dos generados por código con ZzFX.
// S37: una pista por escena con fundidos, música más baja durante los diálogos, pausa al perder el foco,
// desbloqueo con el primer toque o tecla y volúmenes de Opciones. Si algo falla, el juego sigue en silencio.
// S106: los efectos físicos son grabaciones (`src/data/sfxSamples.ts`), llevadas a la sonoridad del ZzFX que reemplazan.
// Mientras cargan, o si faltan, suena el ZzFX. Los pasos de Kerana solo existen grabados.
// S107: los jingles (`JINGLES` en src/data/music.ts) se generan al arrancar con los instrumentos de la música y suenan
// como el efecto de su clave (la liberación), a la sonoridad de su ZzFX. Mientras se generan, suena el ZzFX.

type ZzfxModule = typeof import('zzfx');
type Playing = { key: MusicKey; source: AudioBufferSourceNode; gain: GainNode };
/** Un efecto que se puede cortar; sin `source` todavía mientras carga ZzFX. */
type Voice = { source?: AudioBufferSourceNode; gain?: GainNode };
/** Las variantes grabadas de un efecto: cada una con la ganancia que la lleva a la sonoridad pedida. */
type Bank = { buffers: AudioBuffer[]; gains: number[]; last: number; refLufs: number };
type BankKey = SfxKey | `step_${Surface}`;

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
  /** Pistas que la escena va a pedir pronto: se generan de antemano para que el cambio sea un fundido cruzado. */
  private static upcoming: MusicKey[] = [];
  private static playing: Playing | null = null;
  private static musicBus: GainNode | null = null;
  private static readonly buffers = new Map<MusicKey, AudioBuffer>();
  private static readonly rendering = new Map<MusicKey, Promise<AudioBuffer | null>>();
  /** Para la prueba de humo: pistas que arrancaron, en orden, y errores de audio. */
  private static readonly started: MusicKey[] = [];
  private static readonly failures: string[] = [];
  /** Efectos cortables sonando (S95): uno por clave. Van directo a la salida, como ZzFX; la música no pasa por acá. */
  private static readonly voices = new Map<SfxKey, Voice>();
  /** Grabaciones ya decodificadas (S106), por efecto y por suelo. */
  private static readonly banks = new Map<BankKey, Bank>();
  private static samplesLoading: Promise<void> | null = null;
  private static readonly missingSamples: string[] = [];
  /** Jingles ya generados (S107), por efecto: un solo buffer cada uno, a la sonoridad de su ZzFX. */
  private static readonly jingles = new Map<SfxKey, Bank>();
  /** Para la prueba de humo: jingles que sonaron, en orden. */
  private static readonly jinglesPlayed: SfxKey[] = [];
  /** Para la prueba de humo: pasos que sonaron, por suelo. */
  private static readonly stepsPlayed: Partial<Record<Surface, number>> = {};

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
      samples: () => this.debugSamples(),
    };
    void this.loadSamples();
  }

  /** `pan`: -1 (izquierda) a 1 (derecha); el silbido de Jasy Jatere lo usa como pista (GDD §6.4). */
  static play(key: SfxKey, pan = 0): void {
    const volume = SaveManager.current.settings.sfx;
    if (this.muted || volume <= 0) return;
    const p = Math.max(-1, Math.min(1, pan));
    const jingle = this.jingles.get(key);
    if (jingle && this.zz) {
      this.jinglesPlayed.push(key);
      this.playBank(this.zz.ZZFX.audioContext, jingle, volume, p, 1, 0, 0);
      return;
    }
    const bank = this.banks.get(key);
    const def = SFX_SAMPLES[key];
    if (bank && def && this.zz) {
      const { ZZFX } = this.zz;
      this.playBank(ZZFX.audioContext, bank, volume, p, def.rate ?? 1, def.pitchJitter ?? 0, 0);
      // Lo mágico que acompaña al golpe grabado (el brillo del tajo cargado, el «ding» del farol).
      const extra = def.zzfx === 'preset' ? sfxSamples(ZZFX, key) : def.zzfx === 'layers' ? layerSamples(ZZFX, key) : null;
      if (extra) ZZFX.playSamples([extra], volume * dbToGain(def.zzfxDb ?? 0), 1, p);
      return;
    }
    void this.zzfxModule()
      .then(({ ZZFX }) => {
        ZZFX.playSamples([sfxSamples(ZZFX, key)], volume, 1, p);
      })
      .catch(() => {
        /* sin audio disponible: se ignora */
      });
  }

  /** Un paso de Kerana en `surface` (S106). `db`: más fuerte o más suave que un paso común. Sin grabación, nada. */
  static step(surface: Surface, db = 0): void {
    const volume = SaveManager.current.settings.sfx;
    const bank = this.banks.get(`step_${surface}`);
    if (this.muted || volume <= 0 || !bank || !this.zz) return;
    const f = CFG.footsteps;
    this.stepsPlayed[surface] = (this.stepsPlayed[surface] ?? 0) + 1;
    const vary = jitter(db, f.volumeJitterDb, Math.random());
    this.playBank(this.zz.ZZFX.audioContext, bank, volume, 0, 1, f.pitchJitter, vary);
  }

  /** Una variante al azar del banco (nunca la misma dos veces seguidas), con su ganancia y un poco de variación. */
  private static playBank(ctx: AudioContext, bank: Bank, volume: number, pan: number, rate: number, pitchJitter: number, db: number): void {
    try {
      const i = pickVariant(bank.buffers.length, bank.last, Math.random());
      bank.last = i;
      const source = ctx.createBufferSource();
      source.buffer = bank.buffers[i];
      source.playbackRate.value = jitter(rate, rate * pitchJitter, Math.random());
      const gain = ctx.createGain();
      gain.gain.value = bank.gains[i] * volume * dbToGain(db);
      source.connect(gain);
      let out: AudioNode = gain;
      if (pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        out = gain.connect(panner);
      }
      out.connect(ctx.destination);
      source.onended = () => {
        gain.disconnect();
        if (out !== gain) out.disconnect();
      };
      source.start();
    } catch (e) {
      this.fail(`sample: ${String(e)}`);
    }
  }

  /**
   * Las grabaciones (S106): se bajan y decodifican una vez al arrancar, sin esperar el gesto (decodificar no suena).
   * Cada una se lleva a la sonoridad del ZzFX que reemplaza (los pasos, a la del aterrizaje más `footsteps.db`).
   * Los jingles (S107) se generan a la vez y se llevan igual a la sonoridad de su ZzFX.
   */
  private static loadSamples(): Promise<void> {
    if (this.samplesLoading) return this.samplesLoading;
    this.samplesLoading = this.zzfxModule()
      .then(async ({ ZZFX }) => {
        const ctx = ZZFX.audioContext;
        const jobs: Promise<void>[] = [];
        for (const [key, def] of Object.entries(SFX_SAMPLES) as [SfxKey, SampleDef][]) {
          const ref = zzfxLufs(ZZFX, key) + (def.db ?? 0);
          jobs.push(this.loadBank(ctx, key, def.sources.map((_, i) => sampleName(key, i)), ref));
        }
        const stepRef = zzfxLufs(ZZFX, 'land') + CFG.footsteps.db;
        for (const [surface, sources] of Object.entries(FOOTSTEP_SOURCES) as [Surface, unknown[]][]) {
          const key = `step_${surface}` as const;
          jobs.push(this.loadBank(ctx, key, sources.map((_, i) => sampleName(key, i)), stepRef));
        }
        for (const [key, def] of Object.entries(JINGLES) as [SfxKey, JingleDef & { db?: number }][]) {
          jobs.push(this.loadJingle(ctx, key, def, zzfxLufs(ZZFX, key) + (def.db ?? 0)));
        }
        await Promise.all(jobs);
      })
      .catch((e: unknown) => this.fail(`samples: ${String(e)}`));
    return this.samplesLoading;
  }

  private static async loadBank(ctx: AudioContext, key: BankKey, names: string[], refLufs: number): Promise<void> {
    const loaded = await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(SAMPLE_DIR + name + SAMPLE_EXT);
          if (!res.ok) throw new Error(String(res.status));
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          return { buffer, gain: gainFor(loudness(buffer.getChannelData(0), buffer.sampleRate), refLufs) };
        } catch {
          this.missingSamples.push(name);
          console.warn(`[ASSET FALTANTE] ${SAMPLE_DIR}${name}${SAMPLE_EXT}: suena el ZzFX.`);
          return null;
        }
      }),
    );
    const ok = loaded.filter((x): x is { buffer: AudioBuffer; gain: number } => x !== null);
    if (ok.length === 0) return;
    this.banks.set(key, { buffers: ok.map((x) => x.buffer), gains: ok.map((x) => x.gain), last: -1, refLufs });
  }

  /** Un jingle (S107): se genera fuera del hilo del juego, sin normalizar, y se lleva a `refLufs`. */
  private static async loadJingle(ctx: AudioContext, key: SfxKey, def: JingleDef, refLufs: number): Promise<void> {
    try {
      const samples = await this.renderSamples(def, true);
      const rate = CFG.musicSampleRate;
      const buffer = ctx.createBuffer(1, samples.length, rate);
      buffer.getChannelData(0).set(samples);
      this.jingles.set(key, { buffers: [buffer], gains: [gainFor(loudness(samples, rate), refLufs)], last: -1, refLufs });
    } catch (e) {
      this.fail(`jingle ${key}: ${String(e)}`);
    }
  }

  /**
   * Un efecto que se puede cortar con `stop` (S95: el zumbido de la carga). Una voz por clave: si ya sonaba,
   * la anterior se corta. `offsetSec`: desde dónde empieza. Mismo volumen que `play`.
   */
  static start(key: SfxKey, offsetSec = 0): void {
    this.stop(key);
    const volume = SaveManager.current.settings.sfx;
    if (this.muted || volume <= 0) return;
    const voice: Voice = {};
    this.voices.set(key, voice);
    void this.zzfxModule()
      .then(({ ZZFX }) => {
        // Se cortó (o se pidió otra) antes de que cargara ZzFX.
        if (this.voices.get(key) !== voice) return;
        const samples = sfxSamples(ZZFX, key);
        const offset = Math.max(0, offsetSec);
        if (offset * ZZFX.sampleRate >= samples.length) {
          this.voices.delete(key);
          return;
        }
        const ctx = ZZFX.audioContext;
        const buffer = ctx.createBuffer(1, samples.length, ZZFX.sampleRate);
        buffer.getChannelData(0).set(samples);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = ZZFX.volume * volume;
        source.connect(gain).connect(ctx.destination);
        source.onended = () => {
          gain.disconnect();
          if (this.voices.get(key) === voice) this.voices.delete(key);
        };
        source.start(0, offset);
        voice.source = source;
        voice.gain = gain;
      })
      .catch(() => {
        this.voices.delete(key);
      });
  }

  /** Corta un efecto de `start` (con un fundido corto, sin clic). Si no suena, no hace nada. */
  static stop(key: SfxKey): void {
    const voice = this.voices.get(key);
    if (!voice) return;
    this.voices.delete(key);
    const { source, gain } = voice;
    if (!source || !gain) return;
    const now = gain.context.currentTime;
    const end = now + SFX_STOP_FADE_MS / 1000;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, end);
    try {
      source.stop(end);
    } catch {
      /* ya estaba parada */
    }
  }

  static setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) for (const key of [...this.voices.keys()]) this.stop(key);
    this.refreshVolumes();
  }

  /**
   * La música de la escena. La misma pista que ya suena sigue sin cortarse; otra entra con fundido y la
   * anterior se va con el suyo. `null` = silencio (con fundido).
   * `upcoming`: las que la escena va a pedir después (S61: la pelea y la liberación). Se generan de antemano, detrás de
   * esta, para que al pedirlas la anterior se vaya y la nueva entre a la vez, sin hueco mientras se genera.
   */
  static music(key: MusicKey | null, upcoming: MusicKey[] = []): void {
    this.upcoming = upcoming;
    if (key === this.wanted) {
      this.prefetchUpcoming();
      return;
    }
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
    this.prefetchUpcoming();
  }

  /** Después de la pista pedida (el worker las genera en orden): las que vienen, si no están ya. */
  private static prefetchUpcoming(): void {
    const ctx = this.zz?.ZZFX.audioContext;
    if (!ctx || !this.gestured) return;
    for (const key of this.upcoming) if (key !== this.wanted && !this.buffers.has(key)) void this.buffer(ctx, key);
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

    // Si existe un MP3 en public/assets/audio/music/, se usa; si no, se genera.
    const fileJob = this.loadMusicFile(ctx, key).then((buf) => {
      if (buf) {
        this.buffers.set(key, buf);
        while (this.buffers.size > CFG.cacheTracks) this.buffers.delete(this.buffers.keys().next().value!);
        return buf;
      }
      return this.renderProcedural(ctx, key);
    });
    this.rendering.set(key, fileJob);
    return fileJob;
  }

  /** Carga `public/assets/audio/music/<key>.mp3`. `null` si no existe. */
  private static async loadMusicFile(ctx: AudioContext, key: MusicKey): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(`/assets/audio/music/${key}.mp3`);
      if (!res.ok) return null;
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      return buffer;
    } catch {
      return null;
    }
  }

  /** Genera la pista con ZzFX (el camino de siempre). */
  private static renderProcedural(ctx: AudioContext, key: MusicKey): Promise<AudioBuffer | null> {
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

  /** Genera en el worker; si el navegador no lo deja, en el hilo principal (en pedazos). `jingle`: sin bucle ni normalizar. */
  private static renderSamples(def: TrackDef, jingle = false): Promise<Float32Array> {
    const worker = this.musicWorker();
    if (!worker) return this.renderHere(def, jingle);
    const id = ++this.nextJob;
    const job: MusicJob = { id, def, sampleRate: CFG.musicSampleRate, rms: CFG.musicRms, ceiling: CFG.musicCeiling, jingle };
    return new Promise<Float32Array>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      worker.postMessage(job);
    }).catch(() => this.renderHere(def, jingle));
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

  private static async renderHere(def: TrackDef, jingle = false): Promise<Float32Array> {
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
    const opts = { sampleRate: CFG.musicSampleRate, yieldEvery: () => new Promise<void>((r) => setTimeout(r, 0)) };
    if (jingle) return renderJingle(def as JingleDef, INSTRUMENTS, synth, opts);
    const samples = await renderTrack(def, INSTRUMENTS, synth, opts);
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
      cached: [...this.buffers.keys()],
      failures: [...this.failures],
      busGain: this.musicBus?.gain.value ?? 0,
      voices: [...this.voices.keys()],
      steps: { ...this.stepsPlayed },
      jingles: [...this.jinglesPlayed],
      renderer: this.worker ? 'worker' : this.worker === null ? 'hilo principal' : 'sin usar',
    };
  }

  /** Genera todas las pistas y las variantes de jefe; devuelve duración, intensidad y pico de cada una. */
  private static async debugRenderAll() {
    const out: { key: string; seconds: number; rms: number; peak: number }[] = [];
    const keys: MusicKey[] = [...(Object.keys(TRACKS) as TrackId[]), ...BOSS_LEVEL_TRACKS.map((id) => `${id}_boss` as const)];
    for (const key of keys) {
      const samples = await this.renderSamples(trackDef(key)!);
      out.push({ key, seconds: samples.length / CFG.musicSampleRate, rms: rms(samples), peak: peak(samples) });
    }
    return { tracks: out, musicGain: CFG.musicGain };
  }

  /** Las grabaciones cargadas: cuántas, qué sonoridad tienen ya con su ganancia y cuánto silencio traen al principio. */
  private static async debugSamples() {
    await this.loadSamples();
    const banks = [...this.banks.entries()].map(([key, b]) => ({
      key,
      count: b.buffers.length,
      refLufs: b.refLufs,
      lufs: b.buffers.map((buf, i) => loudness(buf.getChannelData(0).map((v) => v * b.gains[i]), buf.sampleRate)),
      leadMs: b.buffers.map((buf) => (soundSpan(buf.getChannelData(0), buf.sampleRate)[0] / buf.sampleRate) * 1000),
    }));
    // S107: los jingles, aparte (no son archivos): duración, sonoridad con su ganancia y silencio al principio.
    const jingles = [...this.jingles.entries()].map(([key, b]) => {
      const buf = b.buffers[0];
      const data = buf.getChannelData(0);
      return {
        key,
        seconds: buf.duration,
        refLufs: b.refLufs,
        lufs: loudness(data.map((v) => v * b.gains[0]), buf.sampleRate),
        leadMs: (soundSpan(data, buf.sampleRate)[0] / buf.sampleRate) * 1000,
      };
    });
    return { banks, jingles, missing: [...this.missingSamples] };
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

/** Las muestras de un efecto: el preset y, si tiene, sus capas mezcladas encima. */
function sfxSamples(ZZFX: ZzfxModule['ZZFX'], key: SfxKey): number[] {
  const base = ZZFX.buildSamples(...SFX_PRESETS[key]);
  const layers = SFX_LAYERS[key];
  if (!layers) return base;
  for (const params of layers) {
    const layer = ZZFX.buildSamples(...params);
    for (let i = 0; i < layer.length; i++) base[i] = (base[i] ?? 0) + layer[i];
  }
  return base;
}

/** Solo las capas de un efecto (sin el preset), o `null` si no tiene. */
function layerSamples(ZZFX: ZzfxModule['ZZFX'], key: SfxKey): number[] | null {
  const layers = SFX_LAYERS[key];
  if (!layers) return null;
  let out: number[] = [];
  for (const params of layers) {
    const layer = ZZFX.buildSamples(...params);
    if (layer.length > out.length) out = out.concat(new Array<number>(layer.length - out.length).fill(0));
    for (let i = 0; i < layer.length; i++) out[i] += layer[i];
  }
  return out;
}

/** Sonoridad (LUFS) de un preset tal como suena: sin azar y con el volumen de ZzFX dos veces, como en `playSamples`. */
function zzfxLufs(ZZFX: ZzfxModule['ZZFX'], key: SfxKey): number {
  const s = ZZFX.buildSamples(...SFX_PRESETS[key].map((v, i) => (i === 1 ? 0 : v)));
  return loudness(
    s.map((v) => v * ZZFX.volume),
    ZZFX.sampleRate,
  );
}

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

function trackDef(key: MusicKey): TrackDef | null {
  const boss = key.endsWith('_boss');
  const base = TRACKS[(boss ? key.slice(0, -'_boss'.length) : key) as TrackId];
  if (!base) return null;
  return boss ? bossVariant(base, BOSS_LAYER, INSTRUMENTS) : base;
}
