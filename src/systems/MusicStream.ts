import { GAMEPLAY } from '../config/gameplay';
import type { MusicKey } from '../data/music';
import type { MusicFile } from '../data/musicFiles';
import { crossfadeCurves, loopDue } from './musicLoopLogic';

// Una pista en archivo que suena en streaming (S119): dos elementos <audio> que se turnan, conectados al bus de música
// con `createMediaElementSource`. El navegador baja y decodifica de a poco, sin guardar la pista entera decodificada.
// Al llegar al comienzo del fundido final (`fadeStart` en src/data/musicFiles.ts), el otro elemento entra desde
// `start` y los dos se cruzan en `loopCrossfadeMs`: la vuelta siguiente sin el fundido ni el silencio del archivo.

const CFG = GAMEPLAY.audio;
const CURVES = crossfadeCurves(64);

/** Un <audio> del pool con su nodo en el grafo (`createMediaElementSource` va una sola vez por elemento). */
export interface Deck {
  readonly el: HTMLAudioElement;
  node: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
  /** Tiene que estar sonando: se pausa sin foco y se reanuda al volver; si el navegador lo frenó, con el próximo gesto. */
  live: boolean;
}

export interface StreamHooks {
  /** Devuelve el elemento al pool (sin `src`: el navegador suelta lo que tenía bajado). */
  release(deck: Deck): void;
  /** El archivo no se pudo bajar o decodificar. */
  error(stream: MusicStream, message: string): void;
  disposed(stream: MusicStream): void;
}

export class MusicStream {
  /** El volumen de la pista: el AudioManager hace acá los fundidos al cambiar de pista. */
  readonly gain: GainNode;
  /** Vueltas que dio (para la prueba de humo). */
  loops = 0;
  private readonly decks: [Deck, Deck];
  private active = 0;
  /** Cuándo termina (tiempo del AudioContext) el fundido cruzado en curso; -1 sin fundido. */
  private crossfadeEnd = -1;
  private stopTime = Number.POSITIVE_INFINITY;
  private away = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private done = false;

  constructor(
    private readonly ctx: AudioContext,
    readonly key: MusicKey,
    private readonly file: MusicFile,
    first: Deck,
    second: Deck,
    out: AudioNode,
    private readonly hooks: StreamHooks,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
    this.decks = [first, second];
    this.decks.forEach((d, i) => {
      d.gain!.gain.value = i === 0 ? 1 : 0;
      d.gain!.connect(this.gain);
      d.el.onerror = () => this.hooks.error(this, `${key}: código ${d.el.error?.code ?? '?'}`);
      d.el.onended = () => this.onEnded(d);
    });
  }

  /** Arranca la primera vuelta. `away`: sin foco (queda lista y suena al volver). */
  start(away: boolean): void {
    this.away = away;
    this.playDeck(this.decks[this.active]);
    this.timer = setInterval(() => this.tick(), CFG.streamPollMs);
  }

  /** Se va en `time` (tiempo del AudioContext): el AudioManager ya bajó `gain` a 0 para entonces. */
  stopAt(time: number): void {
    this.stopTime = time;
  }

  setAway(away: boolean): void {
    if (away === this.away || this.done) return;
    this.away = away;
    for (const d of this.decks) {
      if (!d.live) continue;
      if (away) d.el.pause();
      else this.resumeDeck(d);
    }
  }

  /** Con un gesto: reintenta lo que el navegador no dejó sonar (iOS, antes de desbloquear el elemento). */
  kick(): void {
    if (this.away || this.done) return;
    for (const d of this.decks) if (d.live && d.el.paused) this.resumeDeck(d);
  }

  dispose(): void {
    if (this.done) return;
    this.done = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const d of this.decks) {
      d.live = false;
      d.el.onerror = null;
      d.el.onended = null;
      d.gain?.disconnect();
      this.hooks.release(d);
    }
    this.gain.disconnect();
    this.hooks.disposed(this);
  }

  /** Para la prueba de humo: salta a `seconds` del archivo (fuera de un fundido cruzado). */
  debugSeek(seconds: number): number {
    const d = this.decks[this.active];
    if (this.crossfadeEnd < 0) d.el.currentTime = Math.max(this.file.start, Math.min(seconds, this.file.duration));
    return d.el.currentTime;
  }

  debugState() {
    const d = this.decks[this.active];
    return {
      key: this.key,
      position: d.el.currentTime,
      paused: d.el.paused,
      loops: this.loops,
      crossfading: this.crossfadeEnd >= 0,
      start: this.file.start,
      fadeStart: this.file.fadeStart,
    };
  }

  private tick(): void {
    if (this.done) return;
    const now = this.ctx.currentTime;
    if (now >= this.stopTime) {
      this.dispose();
      return;
    }
    if (this.away) return;
    if (this.crossfadeEnd >= 0) {
      if (now >= this.crossfadeEnd) this.endCrossfade();
      return;
    }
    const d = this.decks[this.active];
    if (d.live && loopDue(d.el.currentTime, this.file.fadeStart, false)) this.crossfade();
  }

  /** La vuelta siguiente: el otro elemento entra desde el principio y los dos se cruzan. */
  private crossfade(): void {
    const now = this.ctx.currentTime;
    const sec = CFG.loopCrossfadeMs / 1000;
    const from = this.decks[this.active];
    const to = this.decks[1 - this.active];
    if (Math.abs(to.el.currentTime - this.file.start) > 0.05) to.el.currentTime = this.file.start;
    curve(to.gain!.gain, CURVES.fadeIn, now, sec);
    curve(from.gain!.gain, CURVES.fadeOut, now, sec);
    this.playDeck(to);
    this.active = 1 - this.active;
    this.crossfadeEnd = now + sec;
    this.loops++;
  }

  /** El que salió se pausa y vuelve al principio: queda listo para la vuelta que sigue. */
  private endCrossfade(): void {
    const old = this.decks[1 - this.active];
    old.live = false;
    old.el.pause();
    old.el.currentTime = this.file.start;
    this.crossfadeEnd = -1;
  }

  /** Red de seguridad: si el que suena llegó al final sin cruzarse (el temporizador se demoró), entra el otro ya. */
  private onEnded(d: Deck): void {
    if (this.done || d !== this.decks[this.active]) return;
    if (this.crossfadeEnd >= 0) this.endCrossfade();
    this.crossfade();
  }

  private playDeck(d: Deck): void {
    d.live = true;
    if (!this.away) this.resumeDeck(d);
  }

  private resumeDeck(d: Deck): void {
    d.el.play().catch((e: unknown) => {
      // NotAllowedError: falta un gesto (`kick` lo reintenta); AbortError: se pausó o se cambió la fuente antes.
      const name = e instanceof Error ? e.name : '';
      if (name !== 'NotAllowedError' && name !== 'AbortError' && !this.done) this.hooks.error(this, `${this.key}: ${String(e)}`);
    });
  }
}

/** Una curva de volumen desde `at`; si el navegador no la acepta, una rampa lineal al mismo destino. */
function curve(param: AudioParam, values: Float32Array, at: number, seconds: number): void {
  param.cancelScheduledValues(at);
  try {
    param.setValueCurveAtTime(values, at, seconds);
  } catch {
    param.setValueAtTime(param.value, at);
    param.linearRampToValueAtTime(values[values.length - 1], at + seconds);
  }
}
