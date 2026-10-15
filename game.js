/* Sky Stack - YouTube Playable. Vanilla JS + Canvas 2D. All art & audio procedural. */
(function () {
  'use strict';
  // ---------- Platform layer (Playables SDK with local fallback) ----------
  var SDK = (typeof ytgame !== 'undefined') ? ytgame : null;
  var IN_ENV = !!(SDK && SDK.IN_PLAYABLES_ENV);
  var SAVE_KEY = 'skystack_save_v1';
  var Platform = {
    firstFrameReady: function () { if (IN_ENV) try { SDK.game.firstFrameReady(); } catch (e) {} },
    gameReady: function () { if (IN_ENV) try { SDK.game.gameReady(); } catch (e) {} },
    loadData: function () {
      if (IN_ENV) return SDK.game.loadData();
      try { return Promise.resolve(window.localStorage.getItem(SAVE_KEY) || ''); } catch (e) { return Promise.resolve(''); }
    },
    saveData: function (str) {
      if (IN_ENV) return SDK.game.saveData(str);
      try { window.localStorage.setItem(SAVE_KEY, str); } catch (e) {}
      return Promise.resolve();
    },
    sendScore: function (v) { if (IN_ENV) return SDK.engagement.sendScore({ value: v }).catch(function () {}); return Promise.resolve(); },
    getLanguage: function () {
      if (IN_ENV) return SDK.system.getLanguage().catch(function () { return 'en'; });
      // Outside YouTube: optional ?lang=es for testing (never navigator.language per i18n rules)
      var m = /[?&]lang=([a-zA-Z-]+)/.exec(location.search);
      return Promise.resolve(m ? m[1] : 'en');
    },
    isAudioEnabled: function () { if (IN_ENV) { try { return SDK.system.isAudioEnabled(); } catch (e) {} } return true; },
    onAudioEnabledChange: function (cb) { if (IN_ENV) try { SDK.system.onAudioEnabledChange(cb); } catch (e) {} },
    onPause: function (cb) { if (IN_ENV) try { SDK.system.onPause(cb); } catch (e) {} },
    onResume: function (cb) { if (IN_ENV) try { SDK.system.onResume(cb); } catch (e) {} },
    logError: function () { if (IN_ENV) try { SDK.health.logError(); } catch (e) {} }
  };
  window.addEventListener('error', function () { Platform.logError(); });

  // ---------- Strings ----------
  var STR = {
    en: { title: 'SKY STACK', loading: 'Loading…', tap: 'Tap, click or press Space to start', drop: 'Tap to drop the block', best: 'BEST', score: 'FLOORS', perfect: 'PERFECT!', over: 'TOWER FELL!', retry: 'Tap to play again', newBest: 'NEW BEST!', world: 'NEW WORLD', worldsOf: 'Worlds', paused: 'Paused', resume: 'Tap or press Esc to resume', complete: 'You reached the top of the sky! All worlds unlocked — keep stacking for a higher score.', hint: 'Line up perfectly 3 times in a row to grow your block',
      worlds: ['Dawn Meadow', 'Blue Day', 'Golden Sunset', 'Starry Night', 'Aurora', 'Outer Space'] },
    es: { title: 'SKY STACK', loading: 'Cargando…', tap: 'Tocá, hacé clic o presioná Espacio', drop: 'Tocá para soltar el bloque', best: 'RÉCORD', score: 'PISOS', perfect: '¡PERFECTO!', over: '¡SE CAYÓ LA TORRE!', retry: 'Tocá para jugar de nuevo', newBest: '¡NUEVO RÉCORD!', world: 'NUEVO MUNDO', worldsOf: 'Mundos', paused: 'Pausa', resume: 'Tocá o presioná Esc para seguir', complete: '¡Llegaste a la cima del cielo! Todos los mundos desbloqueados — seguí apilando para superar tu récord.', hint: 'Acertá perfecto 3 veces seguidas para agrandar el bloque',
      worlds: ['Pradera del Alba', 'Día Azul', 'Atardecer Dorado', 'Noche Estrellada', 'Aurora', 'Espacio Exterior'] }
  };
  var T = STR.en;

  // ---------- Canvas ----------
  var cv = document.getElementById('c'), cx = cv.getContext('2d');
  var CW = 0, CH = 0, DPR = 1, S = 1;
  var needResize = false;
  function resize() {
    if (paused) { needResize = true; return; } // no rendering while paused; applied on resume
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    CW = Math.max(1, window.innerWidth); CH = Math.max(1, window.innerHeight);
    cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
    S = Math.min(CW / 440, CH / 560);
    draw();
  }

  // ---------- Audio (WebAudio synth) ----------
  var AC = null, master = null, audioOn = true;
  function ensureAudio() {
    if (AC || !audioOn) return;
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    AC = new A(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  }
  function setAudio(on) {
    audioOn = !!on;
    if (master) master.gain.value = audioOn ? 0.5 : 0;
    if (AC) { if (!audioOn || paused) AC.suspend(); else AC.resume(); }
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (!audioOn || paused) return; ensureAudio(); if (!AC) return;
    var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!audioOn || paused) return; ensureAudio(); if (!AC) return;
    var n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; s.buffer = b; g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  var PENTA = [0, 2, 4, 7, 9];
  function note(i) { return 261.63 * Math.pow(2, (PENTA[i % 5] + 12 * Math.floor(i / 5)) / 12); }
  var SFX = {
    place: function () { tone(220, 0.12, 'triangle', 0.25, 0.6); noise(0.08, 0.15); },
    perfect: function (c) { tone(note(Math.min(c, 14) + 5), 0.25, 'sine', 0.3); tone(note(Math.min(c, 14) + 7), 0.3, 'triangle', 0.12, 1, 0.05); },
    fail: function () { tone(300, 0.6, 'sawtooth', 0.15, 0.25); noise(0.4, 0.3); },
    world: function () { for (var i = 0; i < 5; i++) tone(note(5 + i * 2), 0.3, 'triangle', 0.2, 1, i * 0.08); },
    click: function () { tone(660, 0.06, 'square', 0.08); }
  };

  // ---------- Worlds (procedural palettes) ----------
  var WORLD_EVERY = 15;
  var WORLDS = [
    { sky: ['#ffd6a5', '#fdffb6'], hue: 20, stars: 0, ground: '#6a994e' },
    { sky: ['#4cc9f0', '#caf0f8'], hue: 200, stars: 0, ground: '#2d6a4f' },
    { sky: ['#f8961e', '#f9c74f'], hue: 330, stars: 0.2, ground: '#7f4f24' },
    { sky: ['#03045e', '#2b2d6e'], hue: 260, stars: 1, ground: '#1b1b3a' },
    { sky: ['#0b3d2e', '#1a1a40'], hue: 150, stars: 1, ground: '#10302a' },
    { sky: ['#000000', '#120a2a'], hue: 280, stars: 1.5, ground: '#222' }
  ];

  // ---------- Save data ----------
  var save = { v: 1, best: 0, games: 0, floors: 0, worlds: 1, completeSeen: false };
  function parseSave(str) {
    try { var o = JSON.parse(str); if (o && typeof o === 'object') {
      save.best = +o.best || 0; save.games = +o.games || 0; save.floors = +o.floors || 0;
      save.worlds = Math.max(1, Math.min(WORLDS.length, +o.worlds || 1)); save.completeSeen = !!o.completeSeen; } } catch (e) {}
  }
  var loaded = false, saving = Promise.resolve();
  function persist() { if (!loaded) return; var s = JSON.stringify(save); saving = saving.then(function () { return Platform.saveData(s); }).catch(function () {}); }

  // ---------- Game state ----------
  var BH = 26, BASEW = 200;
  var state = 'loading', paused = false, userPaused = false;
  var stack, cur, debris, parts, floats, score, combo, camY, shake, flash, overT, newBest, worldIdx, banner, speed, dir, t0, rings;
  var bgStars = []; for (var i = 0; i < 120; i++) bgStars.push({ x: Math.random(), y: Math.random() * 3, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 });
  var clouds = []; for (i = 0; i < 9; i++) clouds.push({ x: Math.random(), y: Math.random() * 2.4, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.01 });

  function blockColor(i) { var w = WORLDS[Math.min(WORLDS.length - 1, Math.floor(i / WORLD_EVERY))]; return 'hsl(' + ((w.hue + i * 7) % 360) + ',70%,' + (58 + Math.sin(i * 0.5) * 6) + '%)'; }
  function reset() {
    stack = [{ x: 0, w: BASEW, c: blockColor(0) }];
    debris = []; parts = []; floats = []; rings = []; score = 0; combo = 0; camY = 0; shake = 0; flash = 0; newBest = false; worldIdx = 0; banner = null;
    speed = 150; dir = 1; spawn();
  }
  function range() { return Math.min(230, CW / S / 2 - 10); }
  function spawn() {
    var top = stack[stack.length - 1];
    dir = (stack.length % 2) ? 1 : -1;
    cur = { x: -dir * range(), w: top.w, c: blockColor(stack.length) };
    speed = Math.min(420, 150 + stack.length * 4.5);
  }
  function burst(x, y, col, n, pow) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (pow || 160); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 60, life: 0.6 + Math.random() * 0.5, t: 0, c: col, r: 2 + Math.random() * 3 }); } }
  function drop() {
    var top = stack[stack.length - 1], y = stack.length * BH - BH / 2;
    var d = cur.x - top.x, ad = Math.abs(d);
    if (ad >= top.w) { // miss
      debris.push({ x: cur.x, y: y, w: cur.w, c: cur.c, vx: dir * 60, vy: 0, r: 0, vr: dir * 2 });
      gameOver(); return;
    }
    if (ad <= 4) { // perfect
      cur.x = top.x; combo++;
      var w = cur.w; if (combo >= 3) w = Math.min(BASEW, w + 10);
      stack.push({ x: top.x, w: w, c: cur.c });
      SFX.perfect(combo); flash = 0.25;
      rings.push({ x: top.x, y: y + BH / 2, w: w, t: 0 });
      floats.push({ txt: T.perfect + (combo > 1 ? ' x' + combo : ''), x: top.x, y: y + BH * 2, t: 0 });
      burst(top.x, y + BH, '#fff', 14, 120);
    } else {
      combo = 0;
      var nw = top.w - ad, nx = top.x + d / 2;
      var cutW = ad, cutX = d > 0 ? nx + nw / 2 + cutW / 2 : nx - nw / 2 - cutW / 2;
      debris.push({ x: cutX, y: y, w: cutW, c: cur.c, vx: (d > 0 ? 1 : -1) * 50, vy: 0, r: 0, vr: (d > 0 ? 1 : -1) * 3 });
      stack.push({ x: nx, w: nw, c: cur.c });
      SFX.place(); shake = 4; burst(nx, y + BH / 2, cur.c, 8, 90);
    }
    score = stack.length - 1;
    var wi = Math.min(WORLDS.length - 1, Math.floor(score / WORLD_EVERY));
    if (wi !== worldIdx) {
      worldIdx = wi; SFX.world();
      banner = { txt: T.world + ': ' + T.worlds[wi], t: 0 };
      if (wi + 1 > save.worlds) { save.worlds = wi + 1; persist(); }
      if (wi === WORLDS.length - 1 && !save.completeSeen) { save.completeSeen = true; banner = { txt: T.complete, t: -2, big: true }; persist(); }
    }
    spawn();
  }
  function gameOver() {
    state = 'over'; overT = 0; SFX.fail(); shake = 12;
    save.games++; save.floors += score;
    if (score > save.best) { save.best = score; newBest = score > 0; }
    persist();
    if (save.best > 0) Platform.sendScore(save.best);
  }

  // ---------- Input ----------
  function action() {
    ensureAudio(); if (AC && AC.state === 'suspended' && audioOn && !paused) AC.resume();
    if (paused) return;
    if (userPaused) { userPaused = false; return; }
    if (state === 'menu') { reset(); state = 'play'; SFX.click(); }
    else if (state === 'play') drop();
    else if (state === 'over' && overT > 0.7) { reset(); state = 'play'; SFX.click(); }
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); action(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (state === 'play') userPaused = !userPaused; return; } // no preventDefault on Esc
    if (e.repeat) return;
    if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); action(); }
  });
  window.addEventListener('resize', resize);
  Platform.onPause(function () { paused = true; if (AC) AC.suspend(); persist(); });
  Platform.onResume(function () { paused = false; if (needResize) { needResize = false; resize(); } last = performance.now(); if (AC && audioOn) AC.resume(); requestAnimationFrame(loop); });
  Platform.onAudioEnabledChange(function (on) { setAudio(on); });

  // ---------- Update ----------
  function update(dt) {
    var t = performance.now() / 1000;
    for (var i = 0; i < clouds.length; i++) { clouds[i].x += clouds[i].v * dt; if (clouds[i].x > 1.3) clouds[i].x = -0.3; }
    if (state === 'play' && !userPaused) {
      var R = range(); cur.x += dir * speed * dt;
      if (cur.x > R) { cur.x = R; dir = -1; } else if (cur.x < -R) { cur.x = -R; dir = 1; }
    }
    if (state === 'over') overT += dt;
    if (userPaused) return;
    var target = Math.max(0, stack.length * BH - 120);
    if (state === 'over') { // zoom out to show the whole tower
      target = stack.length * BH / 2;
    }
    camY += (target - camY) * Math.min(1, dt * 4);
    for (i = debris.length - 1; i >= 0; i--) { var d = debris[i]; d.vy -= 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; if (d.y < camY - 2000) debris.splice(i, 1); }
    for (i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.t += dt; p.vy -= 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) parts.splice(i, 1); }
    for (i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; floats[i].y += 40 * dt; if (floats[i].t > 1) floats.splice(i, 1); }
    for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.5) rings.splice(i, 1); }
    if (banner) { banner.t += dt; if (banner.t > 2.5) banner = null; }
    shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt);
  }

  // ---------- Render ----------
  function zoom() { if (state === 'over' && stack) { var h = stack.length * BH + 200; return Math.min(1, (CH / S) / h * 0.9); } return 1; }
  var Z = 1;
  function sx(x) { return CW / 2 + x * S * Z; }
  function sy(y) { return CH * 0.62 - (y - camY) * S * Z; }
  function lerpC(a, b, t) { var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); function ch(s) { return Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); } return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')'; }
  function skyFor(h) { var f = h / (WORLD_EVERY * BH), i = Math.min(WORLDS.length - 1, Math.floor(f)), j = Math.min(WORLDS.length - 1, i + 1), t = Math.min(1, Math.max(0, (f - i - 0.6) / 0.4)); return [lerpC(WORLDS[i].sky[0], WORLDS[j].sky[0], t), lerpC(WORLDS[i].sky[1], WORLDS[j].sky[1], t), WORLDS[i].stars * (1 - t) + WORLDS[j].stars * t, i]; }
  function block(x, y, w, c, a) {
    var X = sx(x - w / 2), Y = sy(y + BH), W = w * S * Z, H = BH * S * Z;
    cx.globalAlpha = a == null ? 1 : a;
    cx.fillStyle = c; cx.fillRect(X, Y, W, H);
    cx.fillStyle = 'rgba(255,255,255,0.35)'; cx.fillRect(X, Y, W, Math.max(1, H * 0.22));
    cx.fillStyle = 'rgba(0,0,0,0.18)'; cx.fillRect(X, Y + H * 0.8, W, H * 0.2);
    cx.globalAlpha = 1;
  }
  function text(s, x, y, size, col, align, weight) {
    cx.font = (weight || '800') + ' ' + Math.round(size) + 'px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    cx.textAlign = align || 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = Math.max(2, size / 7); cx.strokeStyle = 'rgba(0,0,0,0.35)'; cx.strokeText(s, x, y);
    cx.fillStyle = col || '#fff'; cx.fillText(s, x, y);
  }
  function wrap(s, x, y, size, maxW, col) {
    cx.font = '700 ' + Math.round(size) + 'px system-ui,sans-serif'; var words = s.split(' '), line = '', lines = [];
    for (var i = 0; i < words.length; i++) { var tl = line ? line + ' ' + words[i] : words[i]; if (cx.measureText(tl).width > maxW && line) { lines.push(line); line = words[i]; } else line = tl; }
    lines.push(line); for (i = 0; i < lines.length; i++) text(lines[i], x, y + (i - (lines.length - 1) / 2) * size * 1.25, size, col, 'center', '700');
  }
  function draw() {
    if (!cx || !CW) return;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var u = Math.min(CW, CH), t = performance.now() / 1000;
    if (state === 'loading') {
      cx.fillStyle = '#0b1026'; cx.fillRect(0, 0, CW, CH);
      text(T.loading, CW / 2, CH / 2, u * 0.06, '#fff');
      return;
    }
    Z = stack ? Z + (zoom() - Z) * 0.08 : 1;
    var sky = skyFor(camY + 200);
    var g = cx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    cx.fillStyle = g; cx.fillRect(0, 0, CW, CH);
    if (sky[2] > 0) { cx.fillStyle = '#fff'; for (var i = 0; i < bgStars.length; i++) { var st = bgStars[i], yy = ((st.y * CH - camY * S * 0.15) % (CH * 3) + CH * 3) % (CH * 3); if (yy > CH) continue; cx.globalAlpha = Math.min(1, sky[2]) * (0.5 + 0.5 * Math.sin(t * 2 + st.p)); cx.beginPath(); cx.arc(st.x * CW, yy, st.r, 0, 7); cx.fill(); } cx.globalAlpha = 1; }
    if (sky[2] < 1) { cx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - Math.min(1, sky[2]))) + ')'; for (i = 0; i < clouds.length; i++) { var c = clouds[i], cyy = ((c.y * CH + camY * S * 0.3) % (CH * 2.4)) - CH * 0.2, ccx = c.x * CW, r = u * 0.05 * c.s; cx.beginPath(); cx.arc(ccx, cyy, r, 0, 7); cx.arc(ccx + r, cyy + r * 0.2, r * 0.8, 0, 7); cx.arc(ccx - r, cyy + r * 0.3, r * 0.7, 0, 7); cx.fill(); } }
    cx.save();
    if (shake > 0) cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    // ground hills
    var gy = sy(0); if (gy < CH + 50) { cx.fillStyle = WORLDS[0].ground; cx.beginPath(); cx.moveTo(0, CH); for (var x = 0; x <= CW + 20; x += 20) cx.lineTo(x, gy + 6 + Math.sin(x * 0.012) * 10 * S); cx.lineTo(CW, CH); cx.fill(); }
    if (stack) {
      for (i = 0; i < stack.length; i++) { var b = stack[i], by = i * BH; if (sy(by) < -50 || sy(by + BH) > CH + 50) continue; block(b.x, by - BH, b.w, b.c); }
      for (i = 0; i < rings.length; i++) { var rg = rings[i], k = rg.t / 0.5; cx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; cx.lineWidth = 3; var pad = k * 30; cx.strokeRect(sx(rg.x - rg.w / 2 - pad), sy(rg.y + BH / 2 + pad), (rg.w + pad * 2) * S * Z, (BH + pad * 2) * S * Z); }
      if (state === 'play') { block(cur.x, stack.length * BH - BH, cur.w, cur.c); }
      for (i = 0; i < debris.length; i++) { var d = debris[i]; cx.save(); cx.translate(sx(d.x), sy(d.y)); cx.rotate(d.r); cx.fillStyle = d.c; cx.fillRect(-d.w * S * Z / 2, -BH * S * Z / 2, d.w * S * Z, BH * S * Z); cx.restore(); }
      for (i = 0; i < parts.length; i++) { var p = parts[i]; cx.globalAlpha = 1 - p.t / p.life; cx.fillStyle = p.c; cx.fillRect(sx(p.x), sy(p.y), p.r * S, p.r * S); } cx.globalAlpha = 1;
      for (i = 0; i < floats.length; i++) { var f = floats[i]; cx.globalAlpha = 1 - f.t; text(f.txt, sx(f.x), sy(f.y), u * 0.05, '#fff'); } cx.globalAlpha = 1;
    }
    cx.restore();
    if (flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + flash * 0.6 + ')'; cx.fillRect(0, 0, CW, CH); }
    // HUD / screens
    var big = u * 0.14;
    if (state === 'menu') {
      var bob = Math.sin(t * 2) * u * 0.01;
      text(T.title, CW / 2, CH * 0.26 + bob, u * 0.13, '#fff');
      text(T.best + ': ' + save.best, CW / 2, CH * 0.38, u * 0.05, '#fff', 'center', '700');
      text(T.worldsOf + ': ' + save.worlds + '/' + WORLDS.length, CW / 2, CH * 0.44, u * 0.04, '#fff', 'center', '600');
      cx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); text(T.tap, CW / 2, CH * 0.85, u * 0.042, '#fff', 'center', '700'); cx.globalAlpha = 1;
      wrap(T.hint, CW / 2, CH * 0.92, u * 0.03, CW * 0.9, '#fff');
    } else if (state === 'play' || state === 'over') {
      text(String(score), CW / 2, CH * 0.12, big, '#fff');
      text(T.best + ' ' + Math.max(save.best, score), CW / 2, CH * 0.12 + big * 0.7, u * 0.035, '#fff', 'center', '700');
      if (state === 'play' && score === 0) wrap(T.drop, CW / 2, CH * 0.85, u * 0.045, CW * 0.9, '#fff');
      if (banner) { var a = banner.t < 0 ? 1 : Math.min(1, (2.5 - banner.t) * 2); cx.globalAlpha = Math.max(0, a); cx.fillStyle = 'rgba(0,0,0,0.35)'; var bh = banner.big ? u * 0.24 : u * 0.1; cx.fillRect(0, CH * 0.36 - bh / 2, CW, bh); wrap(banner.txt, CW / 2, CH * 0.36, u * (banner.big ? 0.042 : 0.05), CW * 0.88, '#ffe66d'); cx.globalAlpha = 1; }
      if (state === 'over' && overT > 0.4) {
        cx.fillStyle = 'rgba(0,0,0,' + Math.min(0.45, overT) + ')'; cx.fillRect(0, 0, CW, CH);
        text(T.over, CW / 2, CH * 0.36, u * 0.08, '#ff6b6b');
        text(T.score + ': ' + score, CW / 2, CH * 0.46, u * 0.06, '#fff');
        if (newBest) text(T.newBest, CW / 2, CH * 0.53, u * 0.055, '#ffe66d');
        else text(T.best + ': ' + save.best, CW / 2, CH * 0.53, u * 0.045, '#fff', 'center', '700');
        if (overT > 0.7) { cx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); text(T.retry, CW / 2, CH * 0.85, u * 0.045, '#fff', 'center', '700'); cx.globalAlpha = 1; }
      }
      if (userPaused) { cx.fillStyle = 'rgba(0,0,0,0.5)'; cx.fillRect(0, 0, CW, CH); text(T.paused, CW / 2, CH * 0.45, u * 0.09, '#fff'); text(T.resume, CW / 2, CH * 0.55, u * 0.04, '#fff', 'center', '700'); }
    }
  }

  // ---------- Loop ----------
  var last = performance.now();
  function loop(now) {
    if (paused) return; // fully halt execution until onResume
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  // ---------- Boot ----------
  resize(); draw(); Platform.firstFrameReady();
  setAudio(Platform.isAudioEnabled());
  Promise.all([
    Platform.getLanguage().then(function (l) { T = (String(l || 'en').toLowerCase().indexOf('es') === 0) ? STR.es : STR.en; document.documentElement.lang = T === STR.es ? 'es' : 'en'; }),
    Platform.loadData().then(function (s) { if (s) parseSave(s); }).catch(function () {})
  ]).then(function () {
    loaded = true; state = 'menu'; reset(); last = performance.now(); draw();
    Platform.gameReady();
    requestAnimationFrame(loop);
  });

  // Test hook (read-only snapshot + helpers for automated QA)
  window.__skystack = { get state() { return state; }, get score() { return score; }, get save() { return JSON.parse(JSON.stringify(save)); }, get paused() { return paused; }, get audioOn() { return audioOn; }, get lang() { return T === STR.es ? 'es' : 'en'; }, get cur() { return cur; }, get top() { return stack && stack[stack.length - 1]; } };
})();
