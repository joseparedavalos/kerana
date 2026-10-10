// Piloto automático para la prueba de humo (S19, ampliado en S22). Corre DENTRO de la página (page.evaluate): no
// puede usar nada de fuera de la función. Maneja a Kerana con las mismas teclas que el jugador (flechas, Espacio, X)
// en cada paso del juego, así el recorrido no depende del reloj del headless. Mide el tiempo en el juego
// (suma de los `delta` de la escena, como `playTimeMs`). El recorrido de cada nivel es un plan de datos
// (tools/lib/pilot-plans.mjs); el estado queda en window.__KERANA_PILOT__ (done, timeMs, splits, respawns, log).
//
// Plan: { hitSwitches: [[x, y]…], noGapJump: [[x0, x1]…], splits: [[nombre, x]…], aim?, steps: [paso…] }, en tiles.
// `aim` (S22): al saltar un hueco busca dónde caer y frena en el aire para no pasarse (camalotes, juncos);
// si el camalote de enfrente está hundido, espera en el borde.
// `wind` (S25): antes de saltar un hueco con viento en contra espera la calma; con `ride`, un hueco con viento a favor
// se salta solo con la ráfaga (la cueva del viento de l3).
// Pasos:
//   { run: 1 | -1, untilX?, untilTop?, untilFight? }  corre saltando paredes de hasta 3 tiles, huecos y espinas
//                                                     y ataca lo que tenga delante (enemigos, lianas, fardos);
//                                                     termina al pasar untilX (en el sentido de la carrera), al
//                                                     tener la cabeza más abajo de la fila untilTop o al empezar
//                                                     la pelea del jefe.
//   { mover: [x, y], dir, at?, power?, exit: 'jump' | 'walk' | 'none', landX?, exitDir?, safe? }
//                                                     plataforma móvil cuyo origen ocupa (x, y): golpea su piedra si
//                                                     power, espera a que esté en la punta `at` ('origin' o 'end'),
//                                                     sube hacia dir (saltando si hay un hueco), viaja quieta hasta la
//                                                     otra punta y baja hacia exitDir (por defecto, dir) saltando
//                                                     (hasta pisar más allá de landX), caminando, o no baja ('none':
//                                                     el paso siguiente salta a otra plataforma). Si la plataforma
//                                                     queda encima de la cabeza (un ascensor), sube saltando desde abajo.
//                                                     Con safe: [x, y] (S24) espera también a que el jakare que sale
//                                                     en esa celda se hunda antes de subir (zona de ritmo de l2).
//                                                     Con calm: [x, y] (S25) espera a que amaine el viento de la zona que
//                                                     tiene esa celda (zona de ritmo de l3).
//   { charge: 1 | -1 }                                tajo cargado mirando hacia ese lado (mantiene X hasta cargar).
//   { jumpTo: [x, fila], hold?, double? }             salta a una repisa o una penca: se acerca, salta (manteniendo
//                                                     Espacio `hold` ms, 340 por defecto) y en el aire va hacia x;
//                                                     termina al pisar con los pies en esa fila. Con double (S27), salto
//                                                     doble en el ápice.
//   S27: un paso mover también puede ser una vaca (la celda de donde nace); con double, la bajada `jump` lleva salto
//   doble en el ápice.
//   Además, un paso run puede llevar wait: [x, y] (espera en el lugar a que esa plataforma esté por llegar a su
//   origen o esperando ahí) y untilMover: [x, y] (termina al quedar parada sobre esa plataforma).
//   { bounce: [x, y], wait?: { mover, at }, onto?: [x, y], landX?, landTop? }
//                                                     hongo que ocupa (x, y): si wait, espera a que esa plataforma
//                                                     esté en esa punta; pisa el hongo y en el aire va hacia la
//                                                     plataforma `onto` (termina al estar sobre ella) o hacia landX
//                                                     (termina al pisar con los pies en la fila landTop o más arriba).
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

  const st = { done: false, timeMs: 0, splits: {}, respawns: 0, log: [], trace: [], step: 0, phase: 'start', jumpMs: 0, jumpCool: 0, attackCool: 0, aim: null, charging: false };
  window.__KERANA_PILOT__ = st;
  const origRespawn = scene.respawn;
  scene.respawn = function (reason) {
    st.respawns++;
    st.log.push(`caída (${reason}) en x ${Math.round(player.body.center.x / T)}`);
    // Tras una caída el paso empieza de nuevo (si no, una plataforma perdida se persigue para siempre).
    st.phase = 'start';
    st.aim = null;
    st.doubled = false;
    return origRespawn.call(this, reason);
  };

  const onBlock = (blk, b) => Math.abs(blk.y - b.bottom) <= 3 && b.right > blk.x && b.left < blk.x + blk.width;
  const onMover = (b) => scene.movers.some((m) => onBlock(m.block, b));
  // Vacas (S27): el lomo es una plataforma que camina; se la trata como una plataforma móvil más.
  const cowBlock = (c) => ({ x: c.body.left, y: c.body.top, width: c.body.width });
  const onCow = (b) => (scene.cows ?? []).some((c) => onBlock(cowBlock(c), b));
  // Camalotes (S22): sostienen mientras no se hundieron.
  const onSinker = (b) => scene.sinkers.some((s) => s.isStoodOn(b));
  const inRect = (r, x, y) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
  const solid = (x, y) =>
    scene.isSolidAt(x, y) || scene.movers.some((m) => inRect(m.block, x, y)) || scene.sinkers.some((s) => s.motor.solid && inRect(s.zone, x, y));
  const hazard = (x, y) => scene.tileAt('Hazards', x, y);
  const body = () => player.body;
  // touching.down también se enciende al pasar por un pickup o un enemigo (overlap): solo cuentan el mapa y las plataformas.
  const grounded = () => body().blocked.down || onMover(body()) || onSinker(body()) || onCow(body());

  const move = (dir) => {
    set('right', dir > 0);
    set('left', dir < 0);
  };
  // Va hacia x y se queda quieta al llegar (también en el aire).
  const seek = (x) => {
    const dx = x - body().center.x;
    move(Math.abs(dx) <= 3 ? 0 : Math.sign(dx));
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
  // Salto doble (S27): en el aire, cerca del ápice, suelta y vuelve a pulsar Espacio en el mismo cuadro (una vez por paso).
  const doubleAtApex = () => {
    if (st.doubled || grounded() || body().velocity.y < -40) return;
    st.doubled = true;
    set('jump', false);
    set('jump', true);
    st.jumpMs = 340;
  };

  /** Superficie (y) en la columna x entre 3 tiles arriba y 3 abajo de los pies, o null. */
  const surfaceAt = (x, feet) => {
    for (let dy = -3; dy <= 3; dy++) {
      const y = feet + dy * T + 4;
      // S25: un piso con espinas encima no es dónde caer (la zanja con karaguatá de l3).
      if (solid(x, y) && !solid(x, y - T)) return hazard(x, y - T) ? null : Math.floor(y / T) * T;
    }
    return null;
  };
  /** Dónde caer al saltar un hueco hacia dir: un poco adentro del primer piso (o al medio si es corto). */
  const landingAim = (dir, front, feet) => {
    for (let k = 1; k <= 16; k++) {
      const x = front + dir * k * (T / 2);
      const top = surfaceAt(x, feet);
      if (top === null) continue;
      let len = 0;
      while (len < 6 && surfaceAt(x + dir * (len + 1) * (T / 2), feet) === top) len++;
      return x + dir * Math.min((len * T) / 4, T * 1.25);
    }
    return null;
  };
  // Un camalote hundido entre el borde y donde se cae: mejor esperar a que vuelva.
  const sunkAhead = (dir, front) =>
    scene.sinkers.some((s) => !s.motor.solid && dir * (s.zone.centerX - front) > 0 && dir * (s.zone.centerX - front) < 7 * T);

  // Viento (S25): la zona de viento que cruza el salto (las 6 columnas de delante, a la altura de Kerana).
  const windAhead = (dir, front, y) =>
    (scene.windZones ?? []).find((z) => z.zone.top <= y && z.zone.bottom >= y && (dir > 0 ? z.zone.right > front && z.zone.left < front + 6 * T : z.zone.left < front && z.zone.right > front - 6 * T));
  // Calma con tiempo para el salto entero.
  const calmIn = (z) => z.cycle.phase === 'calm' && z.cycle.leftMs > 700;
  const windCalm = ([x, y]) => {
    const z = (scene.windZones ?? []).find((w) => w.zone.contains((x + 0.5) * T, (y + 0.5) * T));
    return !z || calmIn(z);
  };
  // Espera en el borde: con viento en contra hasta la calma; con `ride` y viento a favor, hasta la ráfaga.
  const windWait = (dir, front, y) => {
    if (!plan.wind) return false;
    const z = windAhead(dir, front, y);
    if (!z) return false;
    if (z.dir !== dir) return !calmIn(z);
    return !!plan.ride && !(z.cycle.phase === 'gust' && z.cycle.leftMs > 900);
  };

  const run = (dir) => {
    const b = body();
    const cx = b.center.x;
    const feet = b.bottom;
    // Piedra por golpear delante: se frena y ataca. Solo en el piso (S23): en el aire la golpeaba al pasar y la balsa de
    // l1 salía antes de que Kerana llegara.
    const sw = grounded() && hitSwitches.find((s) => !s.motor.powered && dir * (s.zone.centerX - cx) > -4 && dir * (s.zone.centerX - cx) < 26);
    if (sw) {
      move(0);
      tapAttack();
      return;
    }
    // En el aire con un punto de caída: frena al llegar encima.
    if (!grounded() && st.aim !== null) {
      move(dir * (st.aim - cx) <= 2 ? 0 : dir);
      return;
    }
    if (grounded() && st.jumpMs <= 0) st.aim = null;
    move(dir);
    for (const e of scene.enemies) {
      if (!e.active || e.purified) continue;
      const dx = dir * (e.x - cx);
      if (dx > 0 && dx < 40 && Math.abs(e.y - b.center.y) < 32) tapAttack();
    }
    // Lianas y fardos (los que ceden al tajo normal) delante.
    for (const br of scene.breakables) {
      if (br.broken || br.needsCharge) continue;
      const dx = dir * (br.zone.centerX - cx);
      if (dx > 0 && dx < 30 && br.zone.bottom > b.top && br.zone.top < b.bottom) tapAttack();
    }
    if (!grounded() || st.jumpMs > 0) return;
    const tx = cx / T;
    const front = cx + dir * (b.halfWidth + 4);
    const wall = solid(front + dir * 4, feet - 6) || solid(front + dir * 4, feet - 22);
    const gapOk = !noGapJump.some(([a, z]) => tx >= a && tx <= z);
    const noFloor = gapOk && !solid(front + dir * 2, feet + 4);
    const spikes = hazard(cx + dir * 20, feet - 4) || hazard(cx + dir * 34, feet - 4);
    if (noFloor && plan.aim && sunkAhead(dir, front)) {
      move(0);
      return;
    }
    if (noFloor && !wall && windWait(dir, front, b.center.y)) {
      move(0);
      return;
    }
    if (wall || noFloor || spikes) {
      if (st.jumpCool <= 0) st.log.push(`salto en x ${tx.toFixed(1)}${wall ? ' pared' : ''}${noFloor ? ' hueco' : ''}${spikes ? ' espinas' : ''}`);
      if (plan.aim && noFloor && !wall) st.aim = landingAim(dir, front, feet);
      startJump();
    }
  };

  const cowAt = ([x, y]) => {
    const c = (scene.cows ?? []).find((cw) => Math.floor((cw.x - cw.motor.offsetX + cw.motor.spec.startPos) / T) === x && Math.floor((cw.y - 1) / T) === y);
    if (!c) return undefined;
    return { motor: c.motor, get block() { return cowBlock(c); } };
  };
  const moverAt = ([x, y]) => scene.movers.find((mv) => inZone(mv.zone, [x, y])) ?? cowAt([x, y]);
  // El jakare que sale del agua en la celda (x, y) está abajo, recién hundido (S24, jakare guasu).
  const lurkerDown = ([x, y]) => {
    const e = scene.enemies.find((en) => en.def.archetype === 'lurker' && Math.floor(en.spawnX / T) === x && Math.floor((en.spawnY - 1) / T) === y);
    return !e || !e.active || e.purified || e.lurkState === 'cooldown';
  };
  // La plataforma está en la punta pedida (o llegando, o recién salida).
  const atEnd = (m, at) => {
    const mm = m.motor;
    if (at === 'end') return mm.pos >= mm.length - T && (mm.dir === -1 || mm.pos >= mm.length - 1);
    return mm.pos <= T && (mm.dir === 1 || mm.pos <= 1);
  };
  // Parada sobre esa plataforma: con el centro encima (rozarla de costado parada en el piso no cuenta) y sin pisar el
  // suelo de al lado. S24: con el juego lento el paso anterior terminaba tarde y Kerana frenaba con el centro sobre la
  // plataforma vertical de l1 pero parada en el borde del piso; la plataforma bajaba sin ella y el paso terminaba arriba.
  const onGroundTile = (b) => scene.isSolidAt(b.left + 1, b.bottom + 2) || scene.isSolidAt(b.right - 1, b.bottom + 2);
  const onThis = (m, b) =>
    onBlock(m.block, b) && b.center.x > m.block.x && b.center.x < m.block.x + m.block.width && grounded() && !onGroundTile(b);

  // Un paso del plan; devuelve true cuando terminó.
  const doStep = (s) => {
    const b = body();
    if (s.run !== undefined) {
      if (st.phase === 'start' && s.wait) {
        move(0);
        const mm = moverAt(s.wait).motor;
        const ready = (mm.dir === -1 && mm.pos < 1.5 * T) || (mm.pos < 1 && mm.waitLeftMs > 800);
        if (!ready) return false;
      }
      st.phase = 'run';
      if (s.untilMover && onThis(moverAt(s.untilMover), b)) {
        move(0);
        return true;
      }
      run(s.run);
      if (s.untilX !== undefined && s.run * (b.center.x - s.untilX * T) >= 0 && grounded()) return true;
      if (s.untilTop !== undefined && b.top > s.untilTop * T) return true;
      if (s.untilFight && scene.fighting) return true;
      return false;
    }
    if (s.charge !== undefined) return doCharge(s);
    if (s.jumpTo !== undefined) return doJumpTo(s, b);
    if (s.bounce !== undefined) return doBounce(s, b);
    const m = moverAt(s.mover);
    const mm = m.motor;
    const at = s.at ?? 'origin';
    switch (st.phase) {
      case 'start':
      case 'wait': {
        st.phase = 'wait';
        // Primero la piedra (S23: aunque ya esté parada en la plataforma, como cuando el salto anterior la deja encima):
        // se acerca, la mira y la golpea.
        if (s.power && !mm.powered) {
          const sw = hitSwitches.filter((h) => !h.motor.powered).sort((p, q) => Math.abs(p.zone.centerX - b.center.x) - Math.abs(q.zone.centerX - b.center.x))[0];
          const dx = sw ? sw.zone.centerX - b.center.x : 0;
          if (sw && Math.abs(dx) > 20) {
            move(Math.sign(dx));
            return false;
          }
          move(0);
          if (sw && grounded()) player.motor.facing = dx < 0 ? -1 : 1;
          tapAttack();
          return false;
        }
        if (onThis(m, b)) {
          st.phase = 'ride';
          return false;
        }
        move(0);
        // S24: con `safe`, además espera a que el jakare de esa celda se hunda (como una persona en la zona de ritmo).
        if (s.safe && !lurkerDown(s.safe)) return false;
        // S25: con `calm`, espera a que amaine el viento del encuentro (zona de ritmo de l3).
        if (s.calm && !windCalm(s.calm)) return false;
        // Sale a 40-60 px/s: recién salida de la punta se la alcanza caminando.
        if (atEnd(m, at)) st.phase = 'board';
        return false;
      }
      case 'board': {
        const mid = m.block.x + m.block.width / 2;
        if (onThis(m, b)) {
          move(0);
          st.phase = 'ride';
          return false;
        }
        if (!grounded()) {
          seek(mid);
          return false;
        }
        // Plataforma encima de la cabeza (S23: el ascensor del tronco baja hasta sobre Kerana): se sube saltando desde abajo.
        if (m.block.y + T / 2 < b.top) {
          seek(mid);
          if (Math.abs(mid - b.center.x) < m.block.width / 2 - 6) startJump();
          return false;
        }
        const d = Math.abs(mid - b.center.x) < 4 ? s.dir : Math.sign(mid - b.center.x);
        const front = b.center.x + d * (b.halfWidth + 4);
        // S23: si se alejó de su punta mientras Kerana llegaba (el tajo a la piedra la frena), se frena antes del borde
        // (a 14 px: no resbala) y la espera otra vez. Antes saltaba igual hacia la plataforma lejana y caía al pozo una
        // y otra vez (smoke de l1).
        const away = at === 'end' ? mm.length - mm.pos : mm.pos;
        const near = d > 0 ? m.block.x : m.block.x + m.block.width;
        if (!solid(front + d * 14, b.bottom + 4) && (away > 1.5 * T || d * (near - front) > 4 * T)) {
          move(0);
          st.phase = 'wait';
          return false;
        }
        move(d);
        if (!solid(front + d * 2, b.bottom + 4)) startJump();
        return false;
      }
      case 'ride': {
        move(0);
        const arrived = at === 'end' ? mm.pos <= 1 : mm.pos >= mm.length - 1;
        if (!arrived) return false;
        if (s.exit === 'none') return true;
        st.phase = 'exit';
        return false;
      }
      default: {
        const dir = s.exitDir ?? s.dir;
        // S23: si la plataforma ya se va de la punta de llegada antes de que Kerana baje, sigue viaje y lo intenta en la
        // próxima llegada (con el juego lento, saltar desde una balsa que vuelve dejaba corto el salto).
        const arrivedNow = at === 'end' ? mm.pos <= 1 : mm.pos >= mm.length - 1;
        if (onThis(m, b) && !arrivedNow && st.jumpMs <= 0) {
          move(0);
          st.phase = 'ride';
          return false;
        }
        move(dir);
        if (s.exit === 'jump') {
          const edge = dir > 0 ? m.block.x + m.block.width : m.block.x;
          // En el aire apunta a landX desde que despega (un poste angosto no perdona pasarse).
          if (!grounded()) {
            seek(s.landX * T);
            if (s.double) doubleAtApex();
          } else if (onThis(m, b) && dir * (b.center.x - edge) >= -10) startJump();
          return dir * (b.center.x - s.landX * T) >= -3 && grounded() && !onThis(m, b);
        }
        return !onMover(b) && !onCow(b) && grounded();
      }
    }
  };

  const doJumpTo = (s, b) => {
    const [x, row] = s.jumpTo;
    const tx = x * T;
    if (grounded() && Math.abs(b.bottom - row * T) <= 3 && Math.abs(b.center.x - tx) < T) {
      move(0);
      return true;
    }
    if (!grounded() || st.jumpMs > 0) {
      seek(tx);
      if (s.double && !grounded()) doubleAtApex();
      return false;
    }
    // Se acerca hasta 2,5 tiles, o salta desde el borde si se acaba el piso antes (S27: o si tiene un pretil delante).
    const d = Math.sign(tx - b.center.x);
    const edge = !solid(b.center.x + d * (b.halfWidth + 6), b.bottom + 4);
    const wall = solid(b.center.x + d * (b.halfWidth + 4), b.bottom - 6);
    if (Math.abs(b.center.x - tx) > 2.5 * T && !edge && !wall) {
      seek(tx);
      return false;
    }
    startJump(s.hold);
    seek(tx);
    return false;
  };

  const doCharge = (s) => {
    switch (st.phase) {
      case 'start':
        move(0);
        if (!grounded()) return false;
        player.motor.facing = s.charge;
        st.charging = true;
        set('attack', true);
        st.phase = 'hold';
        return false;
      case 'hold':
        if (player.motor.chargeFraction < 1) return false;
        set('attack', false);
        st.charging = false;
        st.phase = 'release';
        st.waitMs = 0;
        return false;
      default:
        // Que termine el tajo y la onda recorra su camino.
        st.waitMs += st.dt;
        return player.motor.state !== 'attack' && st.waitMs > 450;
    }
  };

  const doBounce = (s, b) => {
    const cap = scene.bouncers.find((h) => inZone(h.zone, s.bounce));
    const hx = cap.zone.centerX;
    const target = s.onto ? moverAt(s.onto) : null;
    switch (st.phase) {
      case 'start': {
        move(0);
        if (s.wait && !atEnd(moverAt(s.wait.mover), s.wait.at ?? 'origin')) return false;
        if (!cap.canBounce) return false;
        st.phase = 'go';
        return false;
      }
      case 'go':
        seek(hx);
        if (body().velocity.y < -300) st.phase = 'air';
        return false;
      default: {
        if (target) {
          if (onThis(target, b)) return true;
          const mid = target.block.x + target.block.width / 2;
          // Lejos: rebota en el lugar hasta que la plataforma pase por encima.
          seek(Math.abs(mid - hx) < 3 * T ? mid : hx);
        } else {
          seek(s.landX * T);
          if (grounded() && (s.landTop === undefined || b.bottom <= s.landTop * T + 2) && Math.abs(b.center.x - s.landX * T) < T) return true;
        }
        // Volvió al piso sin llegar (hongo de un uso desinflado): a esperar otra vez.
        if (grounded() && body().velocity.y >= 0 && !cap.isStoodOn(b) && b.bottom > cap.zone.top + 4) st.phase = 'start';
        return false;
      }
    }
  };

  const onStep = (_time, d) => {
    if (st.done) return;
    st.dt = d;
    st.timeMs += d;
    st.jumpCool = Math.max(0, st.jumpCool - d);
    st.attackCool = Math.max(0, st.attackCool - d);
    if (held.attack && !st.charging) set('attack', false);
    const tx = body().center.x / T;
    // Rastro (ms, x, pies) cada ≈ 100 ms, en tiles.
    if (st.trace.length === 0 || st.timeMs - st.trace[st.trace.length - 1][0] >= 100) st.trace.push([Math.round(st.timeMs), +tx.toFixed(1), +(body().bottom / T).toFixed(1)]);
    for (const [name, x] of splits) if (st.splits[name] === undefined && tx >= x) st.splits[name] = Math.round(st.timeMs);
    const finished = doStep(steps[st.step]);
    // Un salto decidido justo cuando el paso termina en el piso no se hace: lo decide el paso siguiente.
    if (finished && grounded() && held.jump === false) st.jumpMs = 0;
    if (st.jumpMs > 0) {
      set('jump', true);
      st.jumpMs -= d;
      if (st.jumpMs <= 0) st.jumpCool = 120;
    } else set('jump', false);
    if (!finished) return;
    st.log.push(`paso ${st.step} listo (x ${tx.toFixed(1)}, ${Math.round(st.timeMs)} ms)`);
    st.step++;
    st.phase = 'start';
    st.aim = null;
    st.doubled = false;
    if (st.step >= steps.length) {
      st.done = true;
      for (const k of Object.keys(held)) set(k, false);
      scene.events.off('preupdate', onStep);
    }
  };
  scene.events.on('preupdate', onStep);
}
