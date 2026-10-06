// Piloto automático para la prueba de humo (S19). Corre DENTRO de la página (page.evaluate): no puede usar
// nada de fuera de la función. Maneja a Kerana con las mismas teclas que el jugador (flechas, Espacio, X)
// en cada paso del juego, así el recorrido no depende del reloj del headless. Mide el tiempo en el juego
// (suma de los `delta` de la escena, como `playTimeMs`). El recorrido de cada nivel es un plan de datos
// (tools/lib/pilot-plans.mjs); el estado queda en window.__KERANA_PILOT__ (done, timeMs, splits, respawns, log).
//
// Plan: { hitSwitches: [[x, y]…], noGapJump: [[x0, x1]…], splits: [[nombre, x]…], steps: [paso…] }, en tiles.
// Pasos:
//   { run: 1 | -1, untilX?, untilTop?, untilFight? }  corre saltando paredes de hasta 3 tiles, huecos y espinas
//                                                     y ataca lo que tenga delante; termina al pasar untilX
//                                                     (en el sentido de la carrera), al tener la cabeza más abajo
//                                                     de la fila untilTop o al empezar la pelea del jefe.
//   { mover: [x, y], dir, power?, exit: 'jump' | 'walk', landX?, exitDir? }
//                                                     plataforma móvil cuyo origen ocupa (x, y): golpea su piedra
//                                                     si power, sube hacia dir cuando está en el origen (o recién
//                                                     salida), viaja quieta hasta el otro extremo y baja hacia
//                                                     exitDir (por defecto, dir) saltando (hasta pisar más allá
//                                                     de landX) o caminando.
export function installPilot(plan) {
  const T = 16;
  const scene = window.__KERANA_DEBUG__.scene;
  const player = window.__KERANA_DEBUG__.player;
  const kb = scene.input.keyboard;
  const keys = { left: kb.addKey(37), right: kb.addKey(39), jump: kb.addKey(32), attack: kb.addKey(88) };
  const held = { left: false, right: false, jump: false, attack: false };
  const set = (name, on) => {
    if (held[name] === on) return;
    const k = keys[name];
    k.isDown = on;
    k.isUp = !on;
    k.emit(on ? 'down' : 'up', k);
    held[name] = on;
  };

  const inZone = (zone, [x, y]) =>
    Math.floor(zone.x / T) <= x && x < Math.ceil(zone.right / T) && Math.floor(zone.y / T) <= y && y < Math.ceil(zone.bottom / T);
  const hitSwitches = scene.switches.filter((s) => (plan.hitSwitches ?? []).some((p) => inZone(s.zone, p)));
  const noGapJump = plan.noGapJump ?? [];
  const splits = plan.splits ?? [];
  const steps = plan.steps;

  const st = { done: false, timeMs: 0, splits: {}, respawns: 0, log: [], trace: [], step: 0, phase: 'start', jumpMs: 0, jumpCool: 0, attackCool: 0 };
  window.__KERANA_PILOT__ = st;
  const origRespawn = scene.respawn;
  scene.respawn = function (reason) {
    st.respawns++;
    st.log.push(`caída (${reason}) en x ${Math.round(player.body.center.x / T)}`);
    return origRespawn.call(this, reason);
  };

  const onMover = (b) => scene.movers.some((m) => Math.abs(m.block.y - b.bottom) <= 3 && b.right > m.block.x && b.left < m.block.x + m.block.width);
  const solid = (x, y) => scene.isSolidAt(x, y) || scene.movers.some((m) => x >= m.block.x && x < m.block.x + m.block.width && y >= m.block.y && y < m.block.y + m.block.height);
  const hazard = (x, y) => scene.tileAt('Hazards', x, y);
  const body = () => player.body;
  // touching.down también se enciende al pasar por un pickup o un enemigo (overlap): solo cuentan el mapa y las plataformas.
  const grounded = () => body().blocked.down || onMover(body());

  const move = (dir) => {
    set('right', dir > 0);
    set('left', dir < 0);
  };
  const tapAttack = () => {
    if (st.attackCool > 0) return;
    set('attack', true);
    st.attackCool = 320;
  };
  const startJump = (ms = 340) => {
    if (st.jumpCool > 0 || st.jumpMs > 0) return;
    st.jumpMs = ms;
  };

  const run = (dir) => {
    const b = body();
    const cx = b.center.x;
    const feet = b.bottom;
    // Piedra por golpear delante: se frena y ataca.
    const sw = hitSwitches.find((s) => !s.motor.powered && dir * (s.zone.centerX - cx) > -4 && dir * (s.zone.centerX - cx) < 26);
    if (sw) {
      move(0);
      tapAttack();
      return;
    }
    move(dir);
    for (const e of scene.enemies) {
      if (!e.active || e.purified) continue;
      const dx = dir * (e.x - cx);
      if (dx > 0 && dx < 40 && Math.abs(e.y - b.center.y) < 32) tapAttack();
    }
    for (const br of scene.breakables) {
      if (br.broken || !br.block) continue;
      const dx = dir * (br.zone.centerX - cx);
      if (dx > 0 && dx < 30) tapAttack();
    }
    if (!grounded() || st.jumpMs > 0) return;
    const tx = cx / T;
    const front = cx + dir * (b.halfWidth + 4);
    const wall = solid(front + dir * 4, feet - 6) || solid(front + dir * 4, feet - 22);
    const gapOk = !noGapJump.some(([a, z]) => tx >= a && tx <= z);
    const noFloor = gapOk && !solid(front + dir * 2, feet + 4);
    const spikes = hazard(cx + dir * 20, feet - 4) || hazard(cx + dir * 34, feet - 4);
    if (wall || noFloor || spikes) {
      if (st.jumpCool <= 0) st.log.push(`salto en x ${tx.toFixed(1)}${wall ? ' pared' : ''}${noFloor ? ' hueco' : ''}${spikes ? ' espinas' : ''}`);
      startJump();
    }
  };

  // Un paso del plan; devuelve true cuando terminó.
  const doStep = (s) => {
    const b = body();
    if (s.run !== undefined) {
      run(s.run);
      if (s.untilX !== undefined && s.run * (b.center.x - s.untilX * T) >= 0 && grounded()) return true;
      if (s.untilTop !== undefined && b.top > s.untilTop * T) return true;
      if (s.untilFight && scene.fighting) return true;
      return false;
    }
    const m = scene.movers.find((mv) => inZone(mv.zone, s.mover));
    const mm = m.motor;
    switch (st.phase) {
      case 'start':
      case 'wait':
        st.phase = 'wait';
        move(0);
        if (s.power && !mm.powered) tapAttack();
        // Sale a 40-60 px/s: recién salida del origen se la alcanza caminando.
        else if (mm.pos <= T && (mm.dir === 1 || mm.pos <= 1)) st.phase = 'board';
        return false;
      case 'board': {
        move(s.dir);
        const mid = m.block.x + m.block.width / 2;
        if (s.dir * (b.center.x - mid) >= -T / 2) st.phase = 'ride';
        return false;
      }
      case 'ride':
        move(0);
        if (mm.pos >= mm.length - 1) st.phase = 'exit';
        return false;
      default: {
        const dir = s.exitDir ?? s.dir;
        move(dir);
        if (s.exit === 'jump') {
          const edge = dir > 0 ? m.block.x + m.block.width : m.block.x;
          if (dir * (b.center.x - edge) >= -10) startJump();
          return dir * (b.center.x - s.landX * T) >= 0 && grounded();
        }
        return !onMover(b) && grounded();
      }
    }
  };

  const onStep = (_time, d) => {
    if (st.done) return;
    st.timeMs += d;
    st.jumpCool = Math.max(0, st.jumpCool - d);
    st.attackCool = Math.max(0, st.attackCool - d);
    if (held.attack) set('attack', false);
    const tx = body().center.x / T;
    // Rastro (ms, x, pies) cada ≈ 100 ms, en tiles.
    if (st.trace.length === 0 || st.timeMs - st.trace[st.trace.length - 1][0] >= 100) st.trace.push([Math.round(st.timeMs), +tx.toFixed(1), +(body().bottom / T).toFixed(1)]);
    for (const [name, x] of splits) if (st.splits[name] === undefined && tx >= x) st.splits[name] = Math.round(st.timeMs);
    const finished = doStep(steps[st.step]);
    if (st.jumpMs > 0) {
      set('jump', true);
      st.jumpMs -= d;
      if (st.jumpMs <= 0) st.jumpCool = 120;
    } else set('jump', false);
    if (!finished) return;
    st.log.push(`paso ${st.step} listo (x ${tx.toFixed(1)}, ${Math.round(st.timeMs)} ms)`);
    st.step++;
    st.phase = 'start';
    if (st.step >= steps.length) {
      st.done = true;
      for (const k of Object.keys(held)) set(k, false);
      scene.events.off('preupdate', onStep);
    }
  };
  scene.events.on('preupdate', onStep);
}
