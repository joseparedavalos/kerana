import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import { hash, uploadAtlas } from '../../systems/pixelArt';
import { SaveManager } from '../../systems/SaveManager';
import {
  FLASH_FRAME,
  HALO_FRAME,
  type MoteKind,
  moteFrame,
  PAINT_K,
  STAFF_FRAME,
  starAtlasFrames,
  starFrame,
  trailMoteKind,
} from './jasyPaint';

// Estrellas de siesta de Jasy Jatere (S103): solo el dibujo. Las chispas que dañan (posición, velocidad y vida)
// siguen en JasyJatere.ts; acá se dibuja cada una con su halo, su estela y su estallido, y el aviso en la punta del
// bastón. Todo sale de un atlas pintado una vez y de pools: nada se crea por cuadro ni se usa Math.random.
const LOOK = GAMEPLAY.jasyJatereLook;
const STAR = LOOK.star;
export const STAR_ATLAS = 'jasy_star_fx';
export { STAFF_FRAME };
const INV_K = 1 / PAINT_K;
const FRAME_DEG = 90 / STAR.frames;
// Una profundidad fija por pool: cambiarla al vuelo obliga a Phaser a reordenar toda la escena en ese cuadro.
const DEPTH = { mote: 6.8, ghost: 6.85, halo: 6.9, star: 7, gatherGlow: 7.1, gatherStar: 7.15, flash: 7.2 };

interface StarView {
  star: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  ghosts: Phaser.GameObjects.Image[];
  on: boolean;
  ageMs: number;
  /** Desfase del vaivén y del giro (cada estrella distinta). */
  seed: number;
  /** Distancia recorrida desde la última mota y cuántas van (el ritmo de la estela). */
  dist: number;
  count: number;
  /** Del extremo del bastón al camino que daña: desplazamiento al salir. */
  offX: number;
  offY: number;
  /** Última posición dibujada (de ahí revienta). */
  x: number;
  y: number;
}

type MoteMode = 'trail' | 'burst' | 'gather';

interface Mote {
  img: Phaser.GameObjects.Image;
  on: boolean;
  mode: MoteMode;
  big: boolean;
  ageMs: number;
  lifeMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aviso: ángulo y radio de partida alrededor de la punta. */
  angle: number;
  r0: number;
}

interface Flash {
  img: Phaser.GameObjects.Image;
  on: boolean;
  ageMs: number;
  soft: boolean;
}

/** «Destellos» de Opciones, leído en cada cuadro (se puede cambiar en la pausa). */
const flashesOn = (): boolean => SaveManager.current.settings.flashes;

export class JasyStarFx {
  private readonly views: StarView[] = [];
  private readonly motes: Mote[] = [];
  private readonly flashes: Flash[] = [];
  private nextMote = 0;
  private nextFlash = 0;
  private rnd = 0;
  /** Aviso en curso: punta del bastón y avance 0..1. */
  private gathering = false;
  private gatherMs = 0;
  private gatherSpawnMs = 0;
  private tipX = 0;
  private tipY = 0;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly tipStar: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, stars: number) {
    uploadAtlas(scene, STAR_ATLAS, starAtlasFrames());
    for (let i = 0; i < stars; i++) {
      const halo = scene.add.image(0, 0, STAR_ATLAS, HALO_FRAME).setDepth(DEPTH.halo).setTint(LOOK.halo).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const star = scene.add.image(0, 0, STAR_ATLAS, starFrame(0, false)).setDepth(DEPTH.star).setScale(INV_K).setVisible(false);
      const ghosts = LOOK.trail.ghosts.map((g) => scene.add.image(0, 0, STAR_ATLAS, starFrame(0, false)).setDepth(DEPTH.ghost).setScale(INV_K * g.scale).setAlpha(g.alpha).setVisible(false));
      this.views.push({ star, halo, ghosts, on: false, ageMs: 0, seed: i * 0.37, dist: 0, count: 0, offX: 0, offY: 0, x: 0, y: 0 });
    }
    for (let i = 0; i < LOOK.motePool; i++) {
      const img = scene.add.image(0, 0, STAR_ATLAS, moteFrame('hot')).setDepth(DEPTH.mote).setScale(INV_K).setVisible(false);
      this.motes.push({ img, on: false, mode: 'trail', big: false, ageMs: 0, lifeMs: 1, x: 0, y: 0, vx: 0, vy: 0, angle: 0, r0: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const img = scene.add.image(0, 0, STAR_ATLAS, FLASH_FRAME).setDepth(DEPTH.flash).setVisible(false);
      this.flashes.push({ img, on: false, ageMs: 0, soft: false });
    }
    this.glow = scene.add.image(0, 0, STAR_ATLAS, HALO_FRAME).setDepth(DEPTH.gatherGlow).setTint(LOOK.halo).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.tipStar = scene.add.image(0, 0, STAR_ATLAS, starFrame(0, false)).setDepth(DEPTH.gatherStar).setVisible(false);
  }

  /** Azar estable propio (0..1): no toca Math.random, que sortea la pelea. */
  private next(): number {
    this.rnd += 1;
    return hash(this.rnd, 7.3);
  }

  // ── Estrellas ─────────────────────────────────────────────────────────────

  /** La chispa `i` sale de (x, y); se dibuja desde la punta del bastón (fromX, fromY) y se funde con su camino. */
  launch(i: number, x: number, y: number, fromX: number, fromY: number): void {
    const v = this.views[i];
    v.on = true;
    v.ageMs = 0;
    v.dist = 0;
    v.count = 0;
    v.seed = this.next() * 10;
    v.offX = fromX - x;
    v.offY = fromY - y;
    v.x = fromX;
    v.y = fromY;
    v.star.setVisible(true).setPosition(fromX, fromY);
    v.halo.setVisible(true).setPosition(fromX, fromY);
  }

  /** Dibuja la chispa `i` en su posición de juego (x, y) con velocidad (vx, vy) y la vida que le queda. */
  place(i: number, x: number, y: number, vx: number, vy: number, lifeMs: number, deltaMs: number): void {
    const v = this.views[i];
    if (!v.on) return;
    v.ageMs += deltaMs;
    const speed = Math.hypot(vx, vy) || 1;
    // Vaivén perpendicular al vuelo: el camino que daña no cambia, el dibujo se mece a sus lados.
    const nx = vx / speed;
    const ny = vy / speed;
    const sway = this.sway(v, v.ageMs);
    const px = x - ny * sway + v.offX * this.blend(v.ageMs);
    const py = y + nx * sway + v.offY * this.blend(v.ageMs);
    // Estela: una mota cada `gap` unidades, con el ritmo grande, chica, chica.
    const step = Math.hypot(px - v.x, py - v.y);
    v.dist += step;
    const T = LOOK.trail;
    while (v.dist >= T.gap) {
      v.dist -= T.gap;
      const back = v.dist / Math.max(step, 0.001);
      const big = T.pattern[v.count % T.pattern.length] > 1;
      v.count += 1;
      this.trailMote(px - (px - v.x) * back, py - (py - v.y) * back, vx / speed, vy / speed, big);
    }
    v.x = px;
    v.y = py;
    const flashes = flashesOn();
    const spin = flashes ? STAR.spinDegPerS : STAR.calmSpinDegPerS;
    const deg = ((v.ageMs / 1000) * spin + v.seed * 31) % 90;
    const frame = Math.floor(deg / FRAME_DEG) % STAR.frames;
    const flare = flashes && frame === 0;
    const fade = lifeMs < STAR.fadeMs ? 0.6 + 0.4 * (lifeMs / STAR.fadeMs) : 1;
    v.star.setFrame(starFrame(frame, flare)).setPosition(px, py).setScale(INV_K * fade);
    // La cola: copias más chicas y tenues donde estaba la estrella hace `back` unidades (con su vaivén de entonces).
    const ghosts = LOOK.trail.ghosts;
    for (let g = 0; g < ghosts.length; g++) {
      const back = Math.min(ghosts[g].back, (v.ageMs / 1000) * speed);
      const age = v.ageMs - (back / speed) * 1000;
      const gs = this.sway(v, age);
      const gx = x - nx * back - ny * gs + v.offX * this.blend(age);
      const gy = y - ny * back + nx * gs + v.offY * this.blend(age);
      v.ghosts[g]
        .setVisible(back > 0.5)
        .setPosition(gx, gy)
        .setFrame(starFrame((frame + g + 1) % STAR.frames, false))
        .setScale(INV_K * ghosts[g].scale * fade);
    }
    const haloScale = (flare ? STAR.haloFlareScale : 1) * fade;
    v.halo.setPosition(px, py).setScale(INV_K * haloScale).setAlpha(STAR.haloAlpha * fade);
  }

  /** Vaivén a un lado del camino (unidades, sobre la normal del vuelo) a la edad `ageMs`. */
  private sway(v: StarView, ageMs: number): number {
    return Math.sin((ageMs / STAR.wobbleMs) * Math.PI * 2 + v.seed) * STAR.wobble;
  }

  /** Cuánto queda del desplazamiento de salida (de la punta del bastón al camino) a la edad `ageMs`. */
  private blend(ageMs: number): number {
    return Math.exp(-Math.max(0, ageMs) / (STAR.launchBlendMs / 3));
  }

  /** La chispa `i` revienta donde está dibujada: un puñado de motas y un destello breve. */
  burst(i: number): void {
    const v = this.views[i];
    if (!v.on) return;
    this.hide(i);
    this.burstAt(v.x, v.y);
  }

  hide(i: number): void {
    const v = this.views[i];
    v.on = false;
    v.star.setVisible(false);
    v.halo.setVisible(false);
    for (const g of v.ghosts) g.setVisible(false);
  }

  burstAt(x: number, y: number): void {
    const B = LOOK.burst;
    const flashes = flashesOn();
    this.flash(x, y, !flashes);
    const turn = this.next() * Math.PI * 2;
    for (let k = 0; k < B.motes; k++) {
      const a = turn + (k / B.motes) * Math.PI * 2 + (this.next() - 0.5) * 0.5;
      const sp = B.speed[0] + (B.speed[1] - B.speed[0]) * this.next();
      const m = this.spawnMote('burst', x, y, B.lifeMs * (0.75 + 0.25 * this.next()), k % 3 === 0);
      if (!m) break;
      m.vx = Math.cos(a) * sp;
      m.vy = Math.sin(a) * sp - 8;
    }
  }

  private trailMote(x: number, y: number, dirX: number, dirY: number, big: boolean): void {
    const T = LOOK.trail;
    const m = this.spawnMote('trail', x, y, T.lifeMs * (big ? 1 : 0.8), big);
    if (!m) return;
    const side = (this.next() - 0.5) * 2 * T.drift;
    m.vx = -dirX * T.drift * 0.6 - dirY * side;
    m.vy = -dirY * T.drift * 0.6 + dirX * side;
  }

  private flash(x: number, y: number, soft: boolean): void {
    const f = this.flashes[this.nextFlash];
    this.nextFlash = (this.nextFlash + 1) % this.flashes.length;
    f.on = true;
    f.ageMs = 0;
    f.soft = soft;
    // «Destellos: no»: un resplandor dorado tibio que se apaga, sin el blanco.
    f.img
      .setFrame(soft ? HALO_FRAME : FLASH_FRAME)
      .setBlendMode(soft ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setTint(soft ? LOOK.halo : 0xffffff)
      .setPosition(x, y)
      .setVisible(true);
    this.stepFlash(f, 0);
  }

  private spawnMote(mode: MoteMode, x: number, y: number, lifeMs: number, big: boolean): Mote | null {
    for (let n = 0; n < this.motes.length; n++) {
      const m = this.motes[this.nextMote];
      this.nextMote = (this.nextMote + 1) % this.motes.length;
      if (m.on) continue;
      m.on = true;
      m.mode = mode;
      m.big = big;
      m.ageMs = 0;
      m.lifeMs = lifeMs;
      m.x = x;
      m.y = y;
      m.vx = 0;
      m.vy = 0;
      m.img.setPosition(x, y).setAlpha(1).setVisible(true);
      return m;
    }
    return null;
  }

  // ── Aviso ─────────────────────────────────────────────────────────────────

  /** Aviso de las chispas: la punta del bastón (x, y) junta luz; `progress` 0..1 a lo largo del aviso. */
  gather(x: number, y: number, progress: number, deltaMs: number): void {
    const G = LOOK.gather;
    const p = Phaser.Math.Clamp(progress, 0, 1);
    this.tipX = x;
    this.tipY = y;
    if (!this.gathering) {
      this.gathering = true;
      this.gatherMs = 0;
      this.gatherSpawnMs = 0;
    }
    this.gatherMs += deltaMs;
    const flashes = flashesOn();
    // Las motas vienen a la punta hasta que falta un viaje para el tiro.
    this.gatherSpawnMs -= deltaMs;
    // Anillos de motas que se cierran sobre la punta, uno cada `everyMs`, hasta que falta un viaje para el tiro.
    while (this.gatherSpawnMs <= 0 && p < 0.9) {
      this.gatherSpawnMs += G.everyMs;
      const turn = this.next() * Math.PI * 2;
      for (let k = 0; k < G.motes; k++) {
        const m = this.spawnMote('gather', x, y, G.travelMs * (0.9 + 0.2 * this.next()), k % 2 === 0);
        if (!m) break;
        m.angle = turn + (k / G.motes) * Math.PI * 2;
        m.r0 = G.radius * (0.85 + 0.15 * this.next());
      }
    }
    const ease = p * p * (3 - 2 * p);
    const pulse = flashes && p > 0.82 ? 1 + 0.25 * Math.sin(this.gatherMs / 28) : 1;
    const glow = G.glowScale[0] + (G.glowScale[1] - G.glowScale[0]) * ease;
    this.glow
      .setVisible(true)
      .setPosition(x, y)
      .setScale(INV_K * glow * pulse)
      .setAlpha(G.glowAlpha[0] + (G.glowAlpha[1] - G.glowAlpha[0]) * ease);
    const spin = (flashes ? STAR.spinDegPerS * 1.6 : STAR.calmSpinDegPerS) * (0.4 + p);
    const deg = ((this.gatherMs / 1000) * spin) % 90;
    const frame = Math.floor(deg / FRAME_DEG) % STAR.frames;
    const starScale = G.starScale[0] + (G.starScale[1] - G.starScale[0]) * ease;
    this.tipStar
      .setVisible(true)
      .setPosition(x, y)
      .setFrame(starFrame(frame, flashes && frame === 0))
      .setScale(INV_K * starScale);
  }

  /** Termina el aviso. `fired`: se lanzaron las chispas (un destello chico en la punta). */
  stopGather(fired: boolean): void {
    if (!this.gathering) return;
    this.gathering = false;
    this.glow.setVisible(false);
    this.tipStar.setVisible(false);
    for (const m of this.motes) if (m.on && m.mode === 'gather') this.freeMote(m);
    if (fired) this.flash(this.tipX, this.tipY, !flashesOn());
  }

  // ── Cada cuadro ───────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const B = LOOK.burst;
    const T = LOOK.trail;
    const drag = Math.exp(-B.drag * dt);
    for (const m of this.motes) {
      if (!m.on) continue;
      m.ageMs += deltaMs;
      const left = 1 - m.ageMs / m.lifeMs;
      if (left <= 0) {
        this.freeMote(m);
        continue;
      }
      let kind: MoteKind;
      if (m.mode === 'gather') {
        // Hacia la punta, cada vez más rápido y con un poco de giro.
        const q = 1 - left;
        const r = m.r0 * (1 - Math.pow(q, 1.7));
        const a = m.angle + q * 0.9;
        m.x = this.tipX + Math.cos(a) * r;
        m.y = this.tipY + Math.sin(a) * r;
        m.img.setAlpha(Math.min(1, q * 3));
        kind = m.big ? (q < 0.35 ? 'gold' : q < 0.7 ? 'hot' : 'big') : 'tiny';
      } else {
        if (m.mode === 'burst') {
          m.vx *= drag;
          m.vy = m.vy * drag + B.fall * dt;
        } else m.vy += T.fall * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.img.setAlpha(Math.pow(left, 0.6));
        kind = trailMoteKind(left, m.big);
      }
      m.img.setFrame(moteFrame(kind)).setPosition(m.x, m.y);
    }
    for (const f of this.flashes) if (f.on) this.stepFlash(f, deltaMs);
  }

  private stepFlash(f: Flash, deltaMs: number): void {
    const B = LOOK.burst;
    f.ageMs += deltaMs;
    const q = f.ageMs / B.flashMs;
    if (q >= 1) {
      f.on = false;
      f.img.setVisible(false);
      return;
    }
    const s = B.flashScale[0] + (B.flashScale[1] - B.flashScale[0]) * Math.sqrt(q);
    f.img.setScale(INV_K * s * (f.soft ? 0.9 : 1)).setAlpha(f.soft ? 0.6 * (1 - q) : 1 - q * q);
  }

  private freeMote(m: Mote): void {
    m.on = false;
    m.img.setVisible(false);
  }

  /** Todo apagado (reinicio de la pelea). */
  reset(): void {
    for (let i = 0; i < this.views.length; i++) this.hide(i);
    for (const m of this.motes) this.freeMote(m);
    for (const f of this.flashes) {
      f.on = false;
      f.img.setVisible(false);
    }
    this.gathering = false;
    this.glow.setVisible(false);
    this.tipStar.setVisible(false);
  }
}
