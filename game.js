/* Sky Stack v2 - YouTube Playables / web portals. Vanilla JS + Canvas 2D. All art & audio procedural. */
(function () {
  'use strict';
  // ================= Platform layer =================
  var SDK = (typeof ytgame !== 'undefined') ? ytgame : null;
  var IN_ENV = !!(SDK && SDK.IN_PLAYABLES_ENV);
  var SAVE_KEY = 'skystack_save_v1';
  function portal() { return window.PokiSDK ? 'poki' : (window.CrazyGames && window.CrazyGames.SDK) ? 'crazy' : null; }
  var Platform = {
    firstFrameReady: function () { if (IN_ENV) try { SDK.game.firstFrameReady(); } catch (e) {} },
    gameReady: function () { if (IN_ENV) try { SDK.game.gameReady(); } catch (e) {} },
    loadData: function () {
      if (IN_ENV) return SDK.game.loadData();
      try { return Promise.resolve(window.localStorage.getItem(SAVE_KEY) || ''); } catch (e) { return Promise.resolve(''); }
    },
    saveData: function (s) {
      if (IN_ENV) return SDK.game.saveData(s);
      try { window.localStorage.setItem(SAVE_KEY, s); } catch (e) {}
      return Promise.resolve();
    },
    sendScore: function (v) { if (IN_ENV) return SDK.engagement.sendScore({ value: v }).catch(function () {}); return Promise.resolve(); },
    getLanguage: function () {
      if (IN_ENV) return SDK.system.getLanguage().catch(function () { return 'en'; });
      var m = /[?&]lang=([a-zA-Z-]+)/.exec(location.search); // never navigator.language (Playables i18n rule)
      return Promise.resolve(m ? m[1] : 'en');
    },
    isAudioEnabled: function () { if (IN_ENV) { try { return SDK.system.isAudioEnabled(); } catch (e) {} } return true; },
    onAudioEnabledChange: function (cb) { if (IN_ENV) try { SDK.system.onAudioEnabledChange(cb); } catch (e) {} },
    onPause: function (cb) { if (IN_ENV) try { SDK.system.onPause(cb); } catch (e) {} },
    onResume: function (cb) { if (IN_ENV) try { SDK.system.onResume(cb); } catch (e) {} },
    logError: function () { if (IN_ENV) try { SDK.health.logError(); } catch (e) {} },
    gameplayStart: function () { try { var p = portal(); if (p === 'poki') PokiSDK.gameplayStart(); else if (p === 'crazy') CrazyGames.SDK.game.gameplayStart(); } catch (e) {} },
    gameplayStop: function () { try { var p = portal(); if (p === 'poki') PokiSDK.gameplayStop(); else if (p === 'crazy') CrazyGames.SDK.game.gameplayStop(); } catch (e) {} }
  };
  window.addEventListener('error', function () { Platform.logError(); });

  // ================= Ads (Playables / Poki / CrazyGames, no-op fallback) =================
  var adActive = false, lastAdAt = Date.now(), AD_GAP = 180000;
  var Ads = {
    interstitial: function () {
      if (Date.now() - lastAdAt < AD_GAP) return Promise.resolve(false);
      lastAdAt = Date.now(); Analytics.track('ad_interstitial');
      var p = portal(), pr;
      if (IN_ENV && SDK.ads && SDK.ads.requestInterstitialAd) pr = SDK.ads.requestInterstitialAd();
      else if (p === 'poki') pr = PokiSDK.commercialBreak();
      else if (p === 'crazy') pr = new Promise(function (r) { CrazyGames.SDK.ad.requestAd('midgame', { adFinished: r, adError: r }); });
      else return Promise.resolve(false);
      return wrapAd(pr).then(function () { return true; }, function () { return false; });
    },
    rewarded: function (id) {
      Analytics.track('ad_rewarded_request', { id: id });
      var p = portal(), pr;
      if (IN_ENV && SDK.ads && SDK.ads.requestRewardedAd) pr = SDK.ads.requestRewardedAd(id);
      else if (p === 'poki') pr = PokiSDK.rewardedBreak();
      else if (p === 'crazy') pr = new Promise(function (r) { CrazyGames.SDK.ad.requestAd('rewarded', { adFinished: function () { r(true); }, adError: function () { r(false); } }); });
      else pr = Promise.resolve(true); // standalone/dev: grant reward
      return wrapAd(pr).then(function (ok) { lastAdAt = Date.now(); return ok !== false; }, function () { return false; });
    }
  };
  function wrapAd(pr) {
    adActive = true; if (AC) AC.suspend();
    function done() { adActive = false; if (AC && audioOn && !paused) AC.resume(); }
    return Promise.resolve(pr).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
  }

  // ================= Analytics (local hooks only, no network) =================
  var sessionStart = Date.now();
  var Analytics = {
    events: [],
    track: function (name, data) {
      var e = { e: name, t: Math.round((Date.now() - sessionStart) / 1000), d: data || null };
      this.events.push(e); if (this.events.length > 300) this.events.shift();
      try { if (typeof window.SkyStackAnalytics === 'function') window.SkyStackAnalytics(e); } catch (x) {}
    }
  };

  // ================= Strings =================
  var STR = {
    en: { loading: 'Loading…', hook: 'How high can you build?', play: 'PLAY', again: 'PLAY AGAIN', cont: 'CONTINUE', ad: 'AD', dbl: '2× STARS', best: 'BEST', newRec: 'NEW RECORD!', fell: 'TOWER FELL!', soClose: 'SO CLOSE!', floorsTo: '{n} more floors to {w}!', allWorlds: 'All worlds unlocked!',
      perfect: 'PERFECT!', nice: 'NICE!', combo: 'COMBO', world: 'WORLD UNLOCKED', tut: 'Tap when the block lines up!', paused: 'PAUSED', resume: 'RESUME', escHint: 'Esc to resume',
      daily: 'DAILY', dailyDone: 'Daily goals done! Come back tomorrow', goalDone: 'Goal complete! +{n}★', vib: 'Vibration', on: 'ON', off: 'OFF', unlock: 'UNLOCK', locked: 'Need {n}★',
      complete: 'You reached the top of the sky! Keep stacking for a new record.',
      g_floors: 'Reach {n} floors', g_perfect: '{n} perfects in one run', g_runs: 'Play {n} runs', g_combo: 'Hit a ×{n} combo', g_total: 'Stack {n} floors today',
      worlds: ['Dawn Meadow', 'Blue Day', 'Golden Sunset', 'Starry Night', 'Aurora Peaks', 'Outer Space'],
      skins: ['Classic', 'Candy', 'Ice', 'Neon', 'Lava', 'Gold'] },
    es: { loading: 'Cargando…', hook: '¿Hasta dónde podés construir?', play: 'JUGAR', again: 'OTRA VEZ', cont: 'CONTINUAR', ad: 'AD', dbl: '2× ESTRELLAS', best: 'RÉCORD', newRec: '¡NUEVO RÉCORD!', fell: '¡SE CAYÓ!', soClose: '¡CASI!', floorsTo: '¡{n} pisos más para {w}!', allWorlds: '¡Todos los mundos desbloqueados!',
      perfect: '¡PERFECTO!', nice: '¡BIEN!', combo: 'COMBO', world: 'MUNDO NUEVO', tut: '¡Tocá cuando el bloque esté alineado!', paused: 'PAUSA', resume: 'SEGUIR', escHint: 'Esc para seguir',
      daily: 'DIARIO', dailyDone: '¡Metas del día listas! Volvé mañana', goalDone: '¡Meta cumplida! +{n}★', vib: 'Vibración', on: 'SÍ', off: 'NO', unlock: 'DESBLOQUEAR', locked: 'Faltan {n}★',
      complete: '¡Llegaste a la cima del cielo! Seguí apilando para un nuevo récord.',
      g_floors: 'Llegá a {n} pisos', g_perfect: '{n} perfectos en una partida', g_runs: 'Jugá {n} partidas', g_combo: 'Hacé un combo ×{n}', g_total: 'Apilá {n} pisos hoy',
      worlds: ['Pradera del Alba', 'Día Azul', 'Atardecer Dorado', 'Noche Estrellada', 'Picos de Aurora', 'Espacio Exterior'],
      skins: ['Clásico', 'Caramelo', 'Hielo', 'Neón', 'Lava', 'Oro'] }
  };
  var T = STR.en;
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k]; }); }

  // ================= Canvas / layout =================
  var cv = document.getElementById('c'), cx = cv.getContext('2d');
  var CW = 1, CH = 1, DPR = 1, S = 1, K = 1, WIDE = false, needResize = false;
  var FONT = "'Fredoka','Trebuchet MS','Arial Rounded MT Bold',sans-serif";
  function resize() {
    if (paused) { needResize = true; return; }
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    CW = Math.max(1, window.innerWidth); CH = Math.max(1, window.innerHeight);
    cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
    WIDE = CW / CH > 1.25;
    S = Math.min(CW / 430, CH / 520);
    K = WIDE ? Math.min(CW * 0.5 / 380, CH / 440) : Math.min(CW / 400, CH / 700);
    K = Math.max(0.55, K);
    draw();
  }

  // ================= Audio =================
  var AC = null, master = null, sfxBus = null, musBus = null, audioOn = true, noiseBuf = null;
  function ensureAudio() {
    if (AC || !audioOn) return;
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    try { AC = new A(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = AC.createGain(); musBus.gain.value = 0.22; musBus.connect(master);
    var n = AC.sampleRate; noiseBuf = AC.createBuffer(1, n, n); var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    nextBeat = AC.currentTime + 0.1;
  }
  function setAudio(on) {
    audioOn = !!on;
    if (master) master.gain.value = audioOn ? 0.7 : 0;
    if (AC) { if (!audioOn || paused || adActive) AC.suspend(); else AC.resume(); }
  }
  function canPlay() { return audioOn && !paused && !adActive && AC && AC.state !== 'closed'; }
  function tone(f, dur, type, vol, slide, delay, bus) {
    if (!canPlay()) return;
    var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, type, delay, bus) {
    if (!canPlay()) return;
    var t = AC.currentTime + (delay || 0), s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
    f.type = type || 'lowpass'; f.frequency.value = freq || 1000; s.buffer = noiseBuf;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  var PENTA = [0, 2, 4, 7, 9];
  function pn(i, base) { return (base || 261.63) * Math.pow(2, (PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12); }
  var SFX = {
    place: function () { tone(140, 0.14, 'sine', 0.5, 0.5); noise(0.07, 0.25, 1800); tone(520, 0.05, 'square', 0.04); },
    nice: function () { SFX.place(); tone(pn(7), 0.18, 'triangle', 0.12); },
    perfect: function (c) { var k = Math.min(c, 15); tone(120, 0.12, 'sine', 0.45, 0.5); tone(pn(5 + k), 0.4, 'sine', 0.22); tone(pn(7 + k), 0.45, 'triangle', 0.1, 1, 0.04); tone(pn(10 + k) * 2, 0.25, 'sine', 0.05, 1, 0.08); noise(0.15, 0.06, 6000, 'highpass'); },
    comboUp: function () { for (var i = 0; i < 3; i++) tone(pn(10 + i * 2), 0.18, 'square', 0.05, 1, i * 0.05); },
    chop: function () { noise(0.18, 0.2, 700); tone(90, 0.2, 'sine', 0.3, 0.6); },
    fail: function () { noise(0.6, 0.35, 500); tone(330, 0.7, 'sawtooth', 0.08, 0.2); tone(80, 0.5, 'sine', 0.4, 0.5); },
    world: function () { for (var i = 0; i < 6; i++) tone(pn(5 + i * 2), 0.35, 'triangle', 0.14, 1, i * 0.07); noise(0.6, 0.08, 7000, 'highpass', 0.3); },
    record: function () { [0, 2, 4, 7].forEach(function (n, i) { tone(pn(10 + n), 0.5, 'triangle', 0.14, 1, i * 0.1); }); },
    click: function () { tone(880, 0.05, 'sine', 0.15); tone(1320, 0.04, 'sine', 0.06, 1, 0.03); },
    coin: function () { tone(1320, 0.08, 'square', 0.05); tone(1760, 0.18, 'square', 0.05, 1, 0.07); }
  };
  // light music loop, scheduled from the game loop (so it stops with it on pause)
  var nextBeat = 0, beatN = 0;
  var PROG = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
  function musicTick() {
    if (!canPlay() || AC.state !== 'running') return;
    var spb = 60 / 104 / 2;
    if (nextBeat < AC.currentTime) nextBeat = AC.currentTime + 0.05;
    while (nextBeat < AC.currentTime + 0.2) {
      var bar = Math.floor(beatN / 8) % 4, st = beatN % 8, ch = PROG[bar], key = 220 * Math.pow(2, (worldIdx % 3) * 2 / 12);
      var dly = nextBeat - AC.currentTime;
      if (st === 0 || st === 4) tone(key / 2 * Math.pow(2, ch[0] / 12), 0.35, 'triangle', 0.5, 1, dly, musBus);
      var arp = ch[[0, 1, 2, 1, 0, 2, 1, 2][st]] + 12;
      tone(key * Math.pow(2, arp / 12), 0.18, 'sine', 0.22, 1, dly, musBus);
      if (st % 2 === 1) noise(0.03, 0.06, 8000, 'highpass', dly, musBus);
      nextBeat += spb; beatN++;
    }
  }
  function vib(ms) { if (save.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ================= Worlds / skins =================
  var WORLD_EVERY = 15;
  // Curated palettes: sky (top, mid, horizon), 3 mountain layers (far->near), haze, block ramp, grade tint
  var WORLDS = [
    { sky: ['#ff9e7d', '#ffc89a', '#ffe8c2'], mt: ['#f2a7a0', '#c97f8e', '#6d4a6b'], haze: '#ffd9bf', ground: '#4f7a4a', pal: ['#ff7a59', '#ffa45c', '#ffd166', '#ff8fa3', '#f25f7a'], grade: 'rgba(255,170,120,0.10)', sun: '#fff3d1', birds: 1, rays: 1 },
    { sky: ['#3d8bff', '#79b8ff', '#d4ecff'], mt: ['#a9c8f0', '#6f97c9', '#3f6b8f'], haze: '#d8ecff', ground: '#3f8f5a', pal: ['#3a86ff', '#4cc9f0', '#80ed99', '#57cc99', '#38a3a5'], grade: 'rgba(120,180,255,0.08)', sun: '#ffffff', birds: 1, rays: 1 },
    { sky: ['#5b2a86', '#e0607e', '#ffb067'], mt: ['#c7698a', '#8a3f6d', '#3e1f47'], haze: '#ff9e7a', ground: '#2e1a35', pal: ['#ff6b6b', '#ff9f43', '#feca57', '#ff6fa8', '#c56cf0'], grade: 'rgba(255,110,90,0.12)', sun: '#ffe6a8', birds: 1, rays: 1, stars: 0.25 },
    { sky: ['#0a0f2e', '#1d2461', '#45307a'], mt: ['#3a3474', '#28245a', '#151338'], haze: '#4a3a8a', ground: '#0f0d26', pal: ['#7b6cf6', '#9d8cff', '#5f8dff', '#c38dff', '#6fd6ff'], grade: 'rgba(90,80,200,0.12)', sun: '#f4f1ff', moon: 1, stars: 1 },
    { sky: ['#03121f', '#08303d', '#0f5049'], mt: ['#16505a', '#0e3640', '#062027'], haze: '#1d6b62', ground: '#041519', pal: ['#2ee6a6', '#38d9ff', '#7c6cff', '#4dffd2', '#5aa9ff'], grade: 'rgba(40,220,170,0.08)', stars: 1, aurora: 1 },
    { sky: ['#04020c', '#140733', '#2c0a52'], mt: ['#2a1a40', '#1b1030', '#0e0820'], haze: '#3a1466', ground: '#08040f', pal: ['#ff4fd8', '#b14dff', '#6f5bff', '#ff7ac6', '#4dd0ff'], grade: 'rgba(200,80,255,0.10)', stars: 1.6, space: 1 }
  ];
  var SKINS = [{ id: 'classic', cost: 0 }, { id: 'candy', cost: 25 }, { id: 'ice', cost: 50 }, { id: 'neon', cost: 90 }, { id: 'lava', cost: 140 }, { id: 'gold', cost: 220 }];
  // ---- color helpers
  function hx(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb(a, al) { return al == null ? 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')' : 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function shade(a, f) { return f > 0 ? mix(a, [255, 255, 255], f) : mix(a, [12, 4, 30], -f); }
  function sat(a, f) { var m = (a[0] + a[1] + a[2]) / 3; return [Math.max(0, Math.min(255, m + (a[0] - m) * f)), Math.max(0, Math.min(255, m + (a[1] - m) * f)), Math.max(0, Math.min(255, m + (a[2] - m) * f))]; }
  function palAt(pal, t) { var n = pal.length, f = ((t % n) + n) % n, i = Math.floor(f), j = (i + 1) % n; return mix(hx(pal[i]), hx(pal[j]), f - i); }
  function skinCols(skin, i) {
    switch (skin) {
      case 'candy': return { base: hx(i % 2 ? '#ff8fc7' : '#7fe3ff'), stripe: 1, gloss: 0.9 };
      case 'ice': return { base: mix(hx('#bdf3ff'), hx('#6ccbff'), (Math.sin(i * 0.7) + 1) / 2), alpha: 0.93, gloss: 1.2, frost: 1 };
      case 'neon': var g = palAt(['#ff3df2', '#3dfff2', '#ffe93d', '#7a3dff'], i * 0.35); return { base: hx('#1b1036'), glow: rgb(g), glowC: g, gloss: 0.6 };
      case 'lava': return { base: mix(hx('#ff5a1f'), hx('#ffb02e'), (Math.sin(i * 1.3) + 1) / 2), crack: 1, gloss: 0.5 };
      case 'gold': return { base: hx('#f4b81c'), gloss: 1.5, metal: 1 };
      default: var w = WORLDS[Math.min(5, Math.floor(i / WORLD_EVERY))]; return { base: palAt(w.pal, i * 0.22), gloss: 1 };
    }
  }

  // ================= Drawing primitives (pixel space; reused for store art) =================
  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // grain/noise texture tile generated once
  var NOISE = (function () { var c = document.createElement('canvas'); c.width = c.height = 96; var x = c.getContext('2d'), d = x.createImageData(96, 96), r = rng(99);
    for (var i = 0; i < d.data.length; i += 4) { var v = 128 + (r() - 0.5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; })();
  var noisePat = null;
  // Glossy plastic block with bevels, light from top-left. x,y = top-left of FRONT face; d = depth px
  function drawBlock(c, x, y, w, h, d, col, alpha, ao) {
    if (w <= 0.5) return;
    var dy = d * 0.55, B = col.base, r = Math.min(h * 0.18, w * 0.2), bev = Math.max(1, h * 0.09);
    c.save(); c.globalAlpha = (alpha == null ? 1 : alpha) * (col.alpha || 1);
    if (col.glow) { c.shadowColor = col.glow; c.shadowBlur = h * 0.9; }
    // side face (in shadow)
    var gs = c.createLinearGradient(x + w, 0, x + w + d, 0); gs.addColorStop(0, rgb(shade(sat(B, 1.15), -0.42))); gs.addColorStop(1, rgb(shade(sat(B, 1.15), -0.58)));
    c.fillStyle = gs; c.beginPath(); c.moveTo(x + w - 1, y); c.lineTo(x + w + d, y - dy); c.lineTo(x + w + d, y + h - dy - r * 0.3); c.quadraticCurveTo(x + w + d, y + h - dy, x + w + d - r * 0.3, y + h - dy + r * 0.15); c.lineTo(x + w - 1, y + h); c.closePath(); c.fill();
    // top face (lit)
    var gt = c.createLinearGradient(0, y - dy, 0, y); gt.addColorStop(0, rgb(shade(B, 0.5))); gt.addColorStop(1, rgb(shade(B, 0.28)));
    c.fillStyle = gt; c.beginPath(); c.moveTo(x, y); c.lineTo(x + d, y - dy); c.lineTo(x + w + d, y - dy); c.lineTo(x + w, y); c.closePath(); c.fill();
    c.shadowBlur = 0;
    // front face
    rr(c, x, y, w, h, r * 0.6);
    var gf = c.createLinearGradient(0, y, 0, y + h); gf.addColorStop(0, rgb(shade(sat(B, 1.1), 0.06))); gf.addColorStop(0.5, rgb(sat(B, 1.15))); gf.addColorStop(1, rgb(shade(sat(B, 1.2), -0.3)));
    c.fillStyle = gf; c.fill();
    c.save(); c.clip();
    // horizontal light falloff
    var gh = c.createLinearGradient(x, 0, x + w, 0); gh.addColorStop(0, 'rgba(255,255,255,0.10)'); gh.addColorStop(0.6, 'rgba(255,255,255,0)'); gh.addColorStop(1, 'rgba(20,0,40,0.12)'); c.fillStyle = gh; c.fillRect(x, y, w, h);
    if (col.stripe) { c.fillStyle = 'rgba(255,255,255,0.38)'; for (var s0 = x - h; s0 < x + w; s0 += h * 1.2) { c.beginPath(); c.moveTo(s0, y + h); c.lineTo(s0 + h * 0.5, y + h); c.lineTo(s0 + h * 1.5, y); c.lineTo(s0 + h, y); c.fill(); } }
    if (col.crack) { c.strokeStyle = 'rgba(255,245,170,0.85)'; c.lineWidth = Math.max(1, h * 0.06); c.shadowColor = '#ffcc33'; c.shadowBlur = h * 0.3; for (var q = x + h * 0.6; q < x + w; q += h * 2.3) { c.beginPath(); c.moveTo(q, y + h * 0.15); c.lineTo(q + h * 0.25, y + h * 0.5); c.lineTo(q + h * 0.05, y + h * 0.9); c.stroke(); } c.shadowBlur = 0; }
    if (col.glow) { c.strokeStyle = col.glow; c.lineWidth = Math.max(1.5, h * 0.1); c.strokeRect(x + h * 0.08, y + h * 0.08, w - h * 0.16, h - h * 0.16); }
    // material grain
    if (!noisePat) noisePat = c.createPattern(NOISE, 'repeat');
    c.globalCompositeOperation = 'overlay'; c.globalAlpha *= 0.12; c.fillStyle = noisePat; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = (alpha == null ? 1 : alpha) * (col.alpha || 1);
    // ambient occlusion under the block above
    if (ao) { var ga = c.createLinearGradient(0, y, 0, y + h * 0.45); ga.addColorStop(0, 'rgba(15,0,35,0.38)'); ga.addColorStop(1, 'rgba(15,0,35,0)'); c.fillStyle = ga; c.fillRect(x, y, w, h * 0.45); }
    // glossy specular band
    var gl = col.gloss || 1;
    var gg = c.createLinearGradient(0, y + bev, 0, y + h * 0.42); gg.addColorStop(0, 'rgba(255,255,255,' + 0.38 * gl + ')'); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gg; rr(c, x + bev * 1.5, y + bev, w - bev * 3, h * 0.36, h * 0.15); c.fill();
    if (col.metal) { var gm = c.createLinearGradient(x, y, x + w, y + h); gm.addColorStop(0.3, 'rgba(255,255,255,0)'); gm.addColorStop(0.42, 'rgba(255,255,255,0.55)'); gm.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = gm; c.fillRect(x, y, w, h); }
    if (col.frost) { c.fillStyle = 'rgba(255,255,255,0.7)'; for (var k = 0; k < w / h; k++) { star4(c, x + (k + 0.5) * h * 1.1, y + h * (0.35 + 0.3 * ((k * 7) % 3) / 2), h * 0.12); } }
    c.restore();
    // bevel lines: top highlight, bottom dark
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,' + Math.min(0.85, 0.55 * gl) + ')'; c.lineWidth = bev * 0.8; c.beginPath(); c.moveTo(x + r * 0.6, y + bev * 0.5); c.lineTo(x + w - r * 0.6, y + bev * 0.5); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(x + bev * 0.5, y + r * 0.6); c.lineTo(x + bev * 0.5, y + h - r); c.stroke();
    c.strokeStyle = rgb(shade(B, -0.55), 0.55); c.lineWidth = Math.max(1, h * 0.04); rr(c, x, y, w, h, r * 0.6); c.stroke();
    // rim light on the right edge of the top
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = Math.max(1, h * 0.04); c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + d, y - dy); c.stroke();
    c.restore();
  }
  function star4(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); }
  function star(c, x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } c.closePath(); c.fill(); }
  // Mascot "Bloop": x,y = feet center; s = height px
  function drawMascot(c, x, y, s, o) {
    o = o || {}; var e = o.expr || 'happy', t = o.t || 0, sq = o.sq || 0, lk = o.look || 0;
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(1 + sq, 1 - sq);
    var blink = e === 'happy' && (t % 3.3) < 0.12, arms = o.arms || (e === 'cheer' || e === 'wow' || e === 'ko') ? 1 : 0;
    c.lineCap = 'round'; c.lineJoin = 'round';
    var OL = '#5a1f12', lw = s * 0.045, k;
    c.fillStyle = '#d9542a'; c.strokeStyle = OL; c.lineWidth = lw;
    for (k = -1; k <= 1; k += 2) { c.beginPath(); c.ellipse(k * s * 0.2, -s * 0.05, s * 0.14, s * 0.075, 0, 0, 7); c.fill(); c.stroke(); }
    function arm(col, wdt) { c.strokeStyle = col; c.lineWidth = wdt; for (var j = -1; j <= 1; j += 2) { c.beginPath(); c.moveTo(j * s * 0.36, -s * 0.4); c.lineTo(j * s * 0.62, arms ? -s * (0.8 + 0.06 * Math.sin(t * 14 + j)) : -s * 0.2); c.stroke(); } }
    arm(OL, s * 0.16); arm('#ff8a4c', s * 0.08);
    var g = c.createRadialGradient(-s * 0.15, -s * 0.6, s * 0.05, 0, -s * 0.42, s * 0.55);
    g.addColorStop(0, '#ffc08a'); g.addColorStop(0.55, '#ff8a4c'); g.addColorStop(1, '#ec5b2b');
    c.fillStyle = g; c.strokeStyle = OL; c.lineWidth = lw;
    c.beginPath(); c.ellipse(0, -s * 0.42, s * 0.44, s * 0.41, 0, 0, 7); c.fill();
    c.save(); c.clip(); var bs = c.createLinearGradient(0, -s * 0.3, 0, 0); bs.addColorStop(0, 'rgba(120,20,10,0)'); bs.addColorStop(1, 'rgba(120,20,10,0.35)'); c.fillStyle = bs; c.fillRect(-s * 0.5, -s * 0.3, s, s * 0.3);
    c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = s * 0.05; c.beginPath(); c.ellipse(-s * 0.02, -s * 0.44, s * 0.42, s * 0.39, 0, -0.35 * Math.PI, 0.15 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-s * 0.24, -s * 0.66, s * 0.08, s * 0.045, -0.7, 0, 7); c.fill(); c.restore();
    c.strokeStyle = OL; c.lineWidth = lw; c.beginPath(); c.ellipse(0, -s * 0.42, s * 0.44, s * 0.41, 0, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,230,200,0.6)'; c.beginPath(); c.ellipse(0, -s * 0.22, s * 0.24, s * 0.14, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,90,120,0.45)'; for (k = -1; k <= 1; k += 2) { c.beginPath(); c.ellipse(k * s * 0.29, -s * 0.36, s * 0.07, s * 0.045, 0, 0, 7); c.fill(); }
    var ey = -s * 0.5, ex = s * 0.16;
    c.strokeStyle = OL; c.lineWidth = s * 0.05;
    if (e === 'ko') {
      for (k = -1; k <= 1; k += 2) { var X = k * ex; c.beginPath(); c.moveTo(X - s * 0.07, ey - s * 0.07); c.lineTo(X + s * 0.07, ey + s * 0.07); c.moveTo(X + s * 0.07, ey - s * 0.07); c.lineTo(X - s * 0.07, ey + s * 0.07); c.stroke(); }
    } else if (e === 'cheer' || blink) {
      for (k = -1; k <= 1; k += 2) { c.beginPath(); if (blink) { c.moveTo(k * ex - s * 0.08, ey); c.lineTo(k * ex + s * 0.08, ey); } else c.arc(k * ex, ey + s * 0.03, s * 0.075, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    } else {
      var big = e === 'wow' ? 1.15 : 1, pr = e === 'worry' ? 0.045 : 0.07;
      for (k = -1; k <= 1; k += 2) {
        c.fillStyle = '#fff'; c.lineWidth = lw * 0.8;
        c.beginPath(); c.ellipse(k * ex, ey, s * 0.115 * big, s * 0.135 * big, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#1d1030'; c.beginPath(); c.arc(k * ex + lk * s * 0.04, ey + s * 0.015, s * pr * big, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(k * ex + lk * s * 0.04 - s * 0.02, ey - s * 0.02, s * 0.025 * big, 0, 7); c.fill();
      }
      if (e === 'worry') { c.lineWidth = s * 0.035; for (k = -1; k <= 1; k += 2) { c.beginPath(); c.moveTo(k * s * 0.08, ey - s * 0.17); c.lineTo(k * s * 0.24, ey - s * 0.12); c.stroke(); } }
    }
    c.lineWidth = s * 0.04; c.fillStyle = '#7a1630';
    var my = -s * 0.3;
    if (e === 'happy') { c.beginPath(); c.arc(0, my - s * 0.04, s * 0.08, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    else if (e === 'wow') { c.beginPath(); c.ellipse(0, my, s * 0.06, s * 0.08, 0, 0, 7); c.fill(); c.stroke(); }
    else if (e === 'cheer') { c.beginPath(); c.moveTo(-s * 0.12, my - s * 0.04); c.quadraticCurveTo(0, my + s * 0.18, s * 0.12, my - s * 0.04); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ff6b8a'; c.beginPath(); c.ellipse(0, my + s * 0.05, s * 0.05, s * 0.03, 0, 0, 7); c.fill(); }
    else if (e === 'worry') { c.beginPath(); c.moveTo(-s * 0.09, my); for (var i = 1; i <= 4; i++) c.lineTo(-s * 0.09 + i * s * 0.045, my + (i % 2 ? -1 : 1) * s * 0.02); c.stroke();
      c.fillStyle = '#7fd3ff'; c.beginPath(); c.moveTo(s * 0.42, -s * 0.8); c.quadraticCurveTo(s * 0.52, -s * 0.64, s * 0.42, -s * 0.62); c.quadraticCurveTo(s * 0.32, -s * 0.64, s * 0.42, -s * 0.8); c.fill(); }
    else if (e === 'ko') { c.beginPath(); c.ellipse(0, my, s * 0.09, s * 0.06, 0, 0, 7); c.fill(); c.stroke(); }
    var hy = -s * 0.78;
    var hg = c.createLinearGradient(0, hy - s * 0.26, 0, hy); hg.addColorStop(0, '#fff07a'); hg.addColorStop(1, '#ffb800');
    c.fillStyle = hg; c.lineWidth = lw;
    c.beginPath(); c.ellipse(0, hy, s * 0.33, s * 0.25, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd21f'; rr(c, -s * 0.46, hy - s * 0.035, s * 0.92, s * 0.08, s * 0.04); c.fill(); c.stroke();
    c.fillStyle = '#ff9f1c'; c.fillRect(-s * 0.04, hy - s * 0.25, s * 0.08, s * 0.21);
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(-s * 0.15, hy - s * 0.15, s * 0.07, s * 0.04, -0.5, 0, 7); c.fill();
    if (e === 'ko') { c.fillStyle = '#ffe66d'; for (var j = 0; j < 3; j++) { var a = t * 4 + j * 2.1; star(c, Math.cos(a) * s * 0.42, hy - s * 0.28 + Math.sin(a) * s * 0.08, s * 0.07); } }
    c.restore();
  }
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var R0 = rng(7), STARS = [], CLOUDS = [], BIRDS = [];
  for (var i0 = 0; i0 < 140; i0++) STARS.push({ x: R0(), y: R0(), r: R0() * 1.5 + 0.5, p: R0() * 6 });
  for (i0 = 0; i0 < 7; i0++) CLOUDS.push({ x: R0(), y: R0(), s: 0.6 + R0() * 0.9, v: 0.006 + R0() * 0.012, d: 0.2 + R0() * 0.5 });
  for (i0 = 0; i0 < 5; i0++) BIRDS.push({ x: R0(), y: 0.12 + R0() * 0.3, v: 0.02 + R0() * 0.03, p: R0() * 6 });
  // ---- volumetric cloud sprites (cached per world)
  var CLOUDSPR = {};
  function cloudSprite(wi) {
    if (CLOUDSPR[wi]) return CLOUDSPR[wi];
    var w = WORLDS[wi], cv2 = document.createElement('canvas'); cv2.width = 360; cv2.height = 170; var c = cv2.getContext('2d'), r = rng(11 + wi);
    var hz = hx(w.haze), lit = mix([255, 255, 255], hx(w.sky[2]), 0.15), sh = mix(hz, hx(w.sky[0]), 0.35);
    var blobs = [[180, 95, 62], [120, 110, 46], [240, 108, 50], [80, 125, 32], [285, 124, 34], [150, 75, 44], [215, 70, 40]];
    blobs.forEach(function (b) {
      var g = c.createRadialGradient(b[0] - b[2] * 0.35, b[1] - b[2] * 0.45, b[2] * 0.1, b[0], b[1], b[2]);
      g.addColorStop(0, rgb(lit)); g.addColorStop(0.65, rgb(mix(lit, sh, 0.25))); g.addColorStop(1, rgb(mix(lit, sh, 0.6)));
      c.fillStyle = g; c.beginPath(); c.arc(b[0], b[1], b[2], 0, 7); c.fill();
    });
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(0, 140, 360, 40);
    c.globalCompositeOperation = 'source-atop'; var gb = c.createLinearGradient(0, 100, 0, 140); gb.addColorStop(0, rgb(sh, 0)); gb.addColorStop(1, rgb(sh, 0.45)); c.fillStyle = gb; c.fillRect(0, 100, 360, 40);
    CLOUDSPR[wi] = cv2; return cv2;
  }
  function cloud(c, x, y, r, a, wi) { var sp = cloudSprite(wi || 0), w = r * 5.2, h = w * 170 / 360; c.globalAlpha = a; c.drawImage(sp, x - w / 2, y - h * 0.6, w, h); c.globalAlpha = 1; }
  function ridge(seed, x, sharp) { var v = 0, a = 1, f = 0.004; for (var o = 0; o < 4; o++) { var s = Math.sin(x * f + seed * (o + 1.7)) * 0.5 + Math.sin(x * f * 1.9 + seed * 3.1 + o) * 0.5; v += (sharp ? 1 - Math.abs(s) : s * 0.5 + 0.5) * a; a *= 0.5; f *= 2.1; } return v / 1.9; }
  function drawSky(c, W, H, wi, t, camPx, alpha) {
    var w = WORLDS[wi], u = Math.min(W, H), i;
    c.save(); c.globalAlpha = alpha;
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, w.sky[0]); g.addColorStop(0.6, w.sky[1]); g.addColorStop(1, w.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (w.space) { [[0.22, 0.32, [255, 62, 165]], [0.78, 0.62, [62, 139, 255]], [0.5, 0.15, [140, 60, 255]]].forEach(function (n) { var rg = c.createRadialGradient(n[0] * W, n[1] * H, 0, n[0] * W, n[1] * H, u * 0.7); rg.addColorStop(0, rgb(n[2], 0.28)); rg.addColorStop(1, rgb(n[2], 0)); c.fillStyle = rg; c.fillRect(0, 0, W, H); }); }
    if (w.stars) { c.globalCompositeOperation = 'lighter'; var ns = Math.floor(STARS.length * Math.min(1, w.stars)); for (i = 0; i < ns; i++) { var s = STARS[i], yy = ((s.y * H + camPx * 0.05) % H + H) % H, tw = 0.55 + 0.45 * Math.sin(t * 2 + s.p); c.globalAlpha = alpha * tw * (w.stars < 1 ? w.stars * 2 : 1); c.fillStyle = '#fff'; if (s.r > 1.6) { star4(c, s.x * W, yy, s.r * 2.6); } else { c.beginPath(); c.arc(s.x * W, yy, s.r * 0.8, 0, 7); c.fill(); } } c.globalAlpha = alpha; c.globalCompositeOperation = 'source-over';
      if (!w.space) { var ph = (t * 0.22) % 3; if (ph < 0.5) { var kk = ph / 0.5, x0 = W * (0.9 - kk * 0.5), y0 = H * (0.06 + kk * 0.18); var sg = c.createLinearGradient(x0, y0, x0 + u * 0.18, y0 - u * 0.07); sg.addColorStop(0, 'rgba(255,255,255,' + (1 - kk) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = sg; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + u * 0.18, y0 - u * 0.07); c.stroke(); } } }
    if (w.aurora) { c.globalCompositeOperation = 'lighter'; for (var b = 0; b < 4; b++) { var ag = c.createLinearGradient(0, H * 0.05, 0, H * 0.6); var cc = b % 2 ? [150, 90, 255] : [50, 255, 170]; ag.addColorStop(0, rgb(cc, 0)); ag.addColorStop(0.55, rgb(cc, 0.2)); ag.addColorStop(1, rgb(cc, 0)); c.fillStyle = ag; c.beginPath(); c.moveTo(0, H * 0.6); for (var x = 0; x <= W + 12; x += 12) c.lineTo(x, H * (0.18 + b * 0.06) + Math.sin(x / W * 5 + t * 0.5 + b * 2) * H * 0.05 + Math.sin(x / W * 13 + t * 0.9) * H * 0.012); c.lineTo(W, H * 0.6); c.closePath(); c.fill(); } c.globalCompositeOperation = 'source-over'; }
    var sx0 = W * 0.78, sy0 = H * 0.2;
    if (w.space) { var pr = u * 0.13, px = W * 0.8, py = H * 0.2; var pg = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); pg.addColorStop(0, '#ffe0b0'); pg.addColorStop(0.6, '#f07a3a'); pg.addColorStop(1, '#7a2318'); c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,215,170,0.7)'; c.lineWidth = pr * 0.1; c.beginPath(); c.ellipse(px, py, pr * 1.75, pr * 0.38, -0.35, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
      var mg = c.createRadialGradient(W * 0.14, H * 0.6, 0, W * 0.14, H * 0.6, u * 0.05); mg.addColorStop(0, '#c8f0ff'); mg.addColorStop(1, '#3b7bd6'); c.fillStyle = mg; c.beginPath(); c.arc(W * 0.14, H * 0.6, u * 0.045, 0, 7); c.fill(); }
    else if (w.sun) { var sr = u * (w.moon ? 0.065 : 0.085);
      c.globalCompositeOperation = 'lighter'; var sg2 = c.createRadialGradient(sx0, sy0, 0, sx0, sy0, sr * 5); sg2.addColorStop(0, rgb(hx(w.sun), 0.55)); sg2.addColorStop(0.3, rgb(hx(w.sun), 0.18)); sg2.addColorStop(1, rgb(hx(w.sun), 0)); c.fillStyle = sg2; c.fillRect(sx0 - sr * 5, sy0 - sr * 5, sr * 10, sr * 10);
      if (w.rays) { c.save(); c.translate(sx0, sy0); c.rotate(t * 0.03); for (i = 0; i < 9; i++) { c.rotate(Math.PI * 2 / 9); var rgr = c.createLinearGradient(0, 0, u * 1.3, 0); rgr.addColorStop(0, rgb(hx(w.sun), 0.13)); rgr.addColorStop(1, rgb(hx(w.sun), 0)); c.fillStyle = rgr; c.beginPath(); c.moveTo(0, 0); c.lineTo(u * 1.3, -u * 0.07); c.lineTo(u * 1.3, u * 0.07); c.fill(); } c.restore(); }
      c.globalCompositeOperation = 'source-over'; c.fillStyle = w.sun; c.beginPath(); c.arc(sx0, sy0, sr, 0, 7); c.fill();
      if (w.moon) { c.fillStyle = 'rgba(160,150,210,0.35)'; [[0.3, -0.2, 0.22], [-0.25, 0.3, 0.15], [0.1, 0.45, 0.1]].forEach(function (m) { c.beginPath(); c.arc(sx0 + m[0] * sr, sy0 + m[1] * sr, m[2] * sr, 0, 7); c.fill(); }); } }
    if (!w.space && !w.aurora) { var ca = w.moon ? 0.14 : 0.97; for (i = 0; i < CLOUDS.length; i++) { var cl = CLOUDS[i]; var cy = ((cl.y * H * 1.4 + camPx * cl.d) % (H * 1.4)) - H * 0.15; cloud(c, ((cl.x + t * cl.v) % 1.4 - 0.2) * W, cy, u * 0.05 * cl.s, ca * alpha * (0.75 + cl.d * 0.5), wi); } }
    if (w.birds) { c.strokeStyle = rgb(shade(hx(w.mt[2]), -0.3), 0.75); c.lineWidth = Math.max(1.5, u * 0.0045); c.lineCap = 'round'; c.globalAlpha = alpha; for (i = 0; i < BIRDS.length; i++) { var bd = BIRDS[i], bx = ((bd.x + t * bd.v) % 1.2 - 0.1) * W, by = bd.y * H + Math.sin(t + bd.p) * 6, fl = Math.sin(t * 9 + bd.p) * u * 0.009, bs = u * 0.015; c.beginPath(); c.moveTo(bx - bs, by - fl); c.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.35, bx, by); c.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.35, bx + bs, by - fl); c.stroke(); } }
    c.restore();
  }
  // layered mountains with atmospheric haze + ground
  function drawHills(c, W, H, wi, groundY) {
    var w = WORLDS[wi], hz = hx(w.haze); if (groundY > H + 400) return;
    for (var L = 0; L < 3; L++) {
      var p = [0.25, 0.5, 0.8][L], base = H * [0.6, 0.7, 0.8][L] + (groundY - H * 0.86) * p;
      if (base - H * 0.3 > H) continue;
      var amp = H * [0.22, 0.17, 0.11][L], col = hx(w.mt[L]), sharp = L < 2;
      c.beginPath(); c.moveTo(0, H + 2);
      for (var x = -10; x <= W + 12; x += 6) c.lineTo(x, base - ridge(L * 13.7 + 2 + wi, x / Math.max(1, W) * 1600, sharp) * amp);
      c.lineTo(W, H + 2); c.closePath();
      var g = c.createLinearGradient(0, base - amp, 0, base + H * 0.2); g.addColorStop(0, rgb(mix(col, hz, 0.12 - L * 0.04))); g.addColorStop(1, rgb(mix(col, hz, 0.55 - L * 0.15)));
      c.fillStyle = g; c.fill();
      if (L === 0 && !w.stars) { c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, base - amp, W, amp * 0.25); c.restore(); }
      // haze band at the foot
      var hg = c.createLinearGradient(0, base - amp * 0.3, 0, base + amp * 0.4); hg.addColorStop(0, rgb(hz, 0)); hg.addColorStop(1, rgb(hz, 0.35 - L * 0.08)); c.fillStyle = hg; c.fillRect(0, base - amp * 0.3, W, amp * 0.7 + H * 0.2);
    }
    if (groundY < H + 40) {
      var gc = hx(w.ground), gg = c.createLinearGradient(0, groundY, 0, H); gg.addColorStop(0, rgb(shade(gc, 0.12))); gg.addColorStop(1, rgb(shade(gc, -0.35)));
      c.fillStyle = gg; c.beginPath(); c.moveTo(0, H); for (var x2 = 0; x2 <= W + 16; x2 += 16) c.lineTo(x2, groundY + Math.sin(x2 * 0.008) * 5 - Math.sin(x2 * 0.021) * 3); c.lineTo(W, H); c.closePath(); c.fill();
      c.strokeStyle = rgb(shade(gc, 0.35), 0.8); c.lineWidth = 2; c.beginPath(); for (x2 = 0; x2 <= W + 16; x2 += 16) c.lineTo(x2, groundY + Math.sin(x2 * 0.008) * 5 - Math.sin(x2 * 0.021) * 3); c.stroke();
    }
  }

  // ================= Save =================
  function today() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  var save = { v: 2, best: 0, games: 0, floors: 0, worlds: 1, completeSeen: false, stars: 0, skins: ['classic'], skin: 'classic', haptics: true, tut: false, daily: null,
    stats: { runs: 0, retries: 0, perfects: 0, maxWorld: 0, playSec: 0, sessions: 0, continues: 0 } };
  function parseSave(str) {
    try { var o = JSON.parse(str); if (!o || typeof o !== 'object') return;
      save.best = +o.best || 0; save.games = +o.games || 0; save.floors = +o.floors || 0;
      save.worlds = Math.max(1, Math.min(WORLDS.length, +o.worlds || 1)); save.completeSeen = !!o.completeSeen;
      save.stars = +o.stars || 0;
      if (Array.isArray(o.skins)) save.skins = o.skins.filter(function (s) { return SKINS.some(function (k) { return k.id === s; }); });
      if (save.skins.indexOf('classic') < 0) save.skins.unshift('classic');
      if (save.skins.indexOf(o.skin) >= 0) save.skin = o.skin;
      if (o.haptics === false) save.haptics = false;
      save.tut = !!o.tut || save.games > 0;
      if (o.daily && o.daily.day && Array.isArray(o.daily.goals)) save.daily = o.daily;
      if (o.stats) for (var k in save.stats) save.stats[k] = +o.stats[k] || 0;
    } catch (e) {}
  }
  var loaded = false, saving = Promise.resolve();
  function persist() { if (!loaded) return; var s = JSON.stringify(save); saving = saving.then(function () { return Platform.saveData(s); }).catch(function () {}); }
  var GOALS = [['floors', [15, 25, 40]], ['perfect', [5, 8, 12]], ['runs', [3, 5]], ['combo', [3, 5, 7]], ['total', [60, 100]]];
  function ensureDaily() {
    var d = today(); if (save.daily && save.daily.day === d) return;
    var r = rng(d % 2147483646 + 1), pool = GOALS.slice(), goals = [];
    r(); r();
    for (var i = 0; i < 3; i++) { var k = Math.floor(r() * pool.length), g = pool.splice(k, 1)[0]; goals.push({ k: g[0], n: g[1][Math.floor(r() * g[1].length)], p: 0, done: false }); }
    save.daily = { day: d, goals: goals };
  }
  function goalText(g) { return fmt(T['g_' + g.k], { n: g.n }); }
  function goalProgress(kind, val, mode) {
    ensureDaily();
    save.daily.goals.forEach(function (g) {
      if (g.done || g.k !== kind) return;
      g.p = mode === 'add' ? g.p + val : Math.max(g.p, val);
      if (g.p >= g.n) { g.p = g.n; g.done = true; save.stars += 10; toast(fmt(T.goalDone, { n: 10 })); SFX.coin(); Analytics.track('daily_complete', { k: g.k, n: g.n }); persist(); }
    });
  }

  // ================= Game state =================
  var BH = 26, BASEW = 200, DEPTH = 22;
  var state = 'loading', paused = false, userPaused = false;
  var stack = [], cur = null, debris = [], parts = [], pops = [], rings = [], toasts = [];
  var score = 0, combo = 0, maxCombo = 0, runPerfects = 0, camY = 0, camX = 0, anchorY = 0, shake = 0, flash = 0, overT = 0, newBest = false, worldIdx = 0, banner = null, speed = 150, dir = 1;
  var runStars = 0, starsDoubled = false, continued = false, runStart = 0, scorePop = 0, Z = 1, prevBest = 0, previewSkin = 0;
  var M = { x: 0, y: 0, expr: 'happy', exprT: 0, sq: 0, jump: null, fall: null, rot: 0 };
  var buttons = [], pressed = null, pressT = 0, time = 0;
  var CONF = ['#ff4e7a', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'];

  function skinNow() { return state === 'menu' ? SKINS[previewSkin].id : save.skin; }
  function setExpr(e, d) { M.expr = e; M.exprT = d || 0.8; }
  function newRun() {
    stack = [{ x: 0, w: BASEW, pop: 0 }]; debris = []; parts = []; pops = []; rings = [];
    score = 0; combo = 0; maxCombo = 0; runPerfects = 0; shake = 0; flash = 0; newBest = false; worldIdx = 0; banner = null;
    runStars = 0; starsDoubled = false; continued = false; runStart = Date.now(); prevBest = save.best;
    M.fall = null; M.rot = 0; setExpr('happy', 0.1);
    spawn(); M.jump = null; M.x = cur.x; M.y = BH * 2;
  }
  function range() { return Math.min(240, CW / S / 2 - 10); }
  function spawn() {
    var top = stack[stack.length - 1];
    dir = (stack.length % 2) ? 1 : -1;
    cur = { x: -dir * range(), w: top.w };
    speed = (!save.tut && stack.length <= 3) ? 95 : Math.min(430, 140 + stack.length * 4);
    M.jump = { t: 0, fromX: M.x, fromY: M.y };
  }
  function startRun() {
    newRun(); state = 'play'; Platform.gameplayStart();
    save.stats.runs++; Analytics.track('run_start', { n: save.stats.runs });
  }
  function burst(x, y, n, pow, cols, conf) {
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (pow || 160);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (conf ? 200 : 60), life: conf ? 1.6 + Math.random() : 0.6 + Math.random() * 0.5, t: 0, c: cols[i % cols.length], r: conf ? 5 + Math.random() * 4 : 2 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, conf: conf }); }
  }
  function pop(txt, x, y, col, size) { pops.push({ txt: txt, x: x, y: y, t: 0, col: col || '#fff', size: size || 1 }); }
  function toast(txt) { toasts.push({ txt: txt, t: 0 }); }
  function drop() {
    var top = stack[stack.length - 1], y = stack.length * BH;
    var d = cur.x - top.x, ad = Math.abs(d);
    if (!save.tut && stack.length >= 4) { save.tut = true; persist(); }
    if (ad >= top.w) {
      debris.push({ x: cur.x, y: y + BH / 2, w: cur.w, vx: dir * 80, vy: 50, r: 0, vr: dir * 2.5, i: stack.length });
      M.jump = null; M.fall = { vx: dir * 120, vy: 380, vr: dir * 6 }; setExpr('ko', 99);
      gameOver(); return;
    }
    var placed;
    if (ad <= 5) {
      combo++; runPerfects++; maxCombo = Math.max(maxCombo, combo);
      var w = cur.w; if (combo >= 3) w = Math.min(BASEW, w + 12);
      placed = { x: top.x, w: w, pop: 1 }; stack.push(placed);
      SFX.perfect(combo); flash = 0.18; vib(15);
      rings.push({ x: top.x, y: y, w: w, t: 0 });
      pops.length = 0; pop(T.perfect, top.x, y + BH * 6.6, '#fff', 1.1);
      if (combo >= 2) { pop('×' + combo + ' ' + T.combo, top.x, y + BH * 5.3, combo >= 5 ? '#ff4e7a' : '#ffd166', 0.75 + Math.min(combo, 8) * 0.06); if (combo % 3 === 0) SFX.comboUp(); }
      burst(top.x, y + BH, 18, 150, ['#fff', '#ffe66d']);
      setExpr(combo >= 3 ? 'cheer' : 'wow', 0.7); goalProgress('combo', combo);
    } else {
      combo = 0;
      var nw = top.w - ad, nx = top.x + d / 2, cutX = d > 0 ? nx + nw / 2 + ad / 2 : nx - nw / 2 - ad / 2;
      debris.push({ x: cutX, y: y + BH / 2, w: ad, vx: (d > 0 ? 1 : -1) * 70, vy: 60, r: 0, vr: (d > 0 ? 1 : -1) * 3.5, i: stack.length });
      placed = { x: nx, w: nw, pop: 1 }; stack.push(placed);
      if (ad < 14) { SFX.nice(); pops.length = 0; pop(T.nice, nx, y + BH * 6, '#c7f9ff', 0.85); setExpr('happy', 0.5); }
      else { SFX.chop(); setExpr(nw < 70 ? 'worry' : 'wow', 0.6); }
      shake = 5; vib(8); burst(cutX, y + BH / 2, 8, 90, ['#fff']);
    }
    M.x = placed.x; M.y = stack.length * BH; M.sq = 0.25; scorePop = 1;
    score = stack.length - 1;
    goalProgress('floors', score); goalProgress('perfect', runPerfects);
    var wi = Math.min(WORLDS.length - 1, Math.floor(score / WORLD_EVERY));
    if (wi !== worldIdx) {
      worldIdx = wi; SFX.world(); vib([20, 40, 20]); setExpr('cheer', 1.5);
      banner = { a: T.world, b: T.worlds[wi], t: 0 }; burst(placed.x, y, 50, 320, CONF, true);
      if (wi + 1 > save.worlds) { save.worlds = wi + 1; persist(); }
      if (wi > save.stats.maxWorld) save.stats.maxWorld = wi;
      Analytics.track('world_reached', { w: wi, floors: score });
      if (wi === WORLDS.length - 1 && !save.completeSeen) { save.completeSeen = true; toast(T.complete); persist(); }
    }
    spawn();
  }
  function gameOver() {
    state = 'over'; overT = 0; SFX.fail(); shake = 14; vib(120);
    Platform.gameplayStop();
    var gain = Math.floor(score / 5) + Math.floor(runPerfects / 4);
    if (!continued) { save.games++; goalProgress('runs', 1, 'add'); }
    save.floors += score; goalProgress('total', score, 'add');
    runStars += gain; save.stars += gain; save.stats.perfects += runPerfects;
    if (score > save.best) { save.best = score; newBest = true;
      setTimeout(function () { if (state === 'over') { SFX.record(); burst(stack[stack.length - 1].x, stack.length * BH, 80, 380, CONF, true); } }, 450); }
    persist();
    if (save.best > 0) Platform.sendScore(save.best);
    Analytics.track('run_end', { floors: score, world: worldIdx, perfects: runPerfects, maxCombo: maxCombo, dur: Math.round((Date.now() - runStart) / 1000), best: save.best });
  }
  function doContinue() {
    if (continued || state !== 'over') return;
    Ads.rewarded('continue').then(function (ok) {
      if (!ok || state !== 'over') return;
      continued = true; save.stats.continues++; Analytics.track('continue', { floors: score });
      save.floors -= score; runStars = 0; state = 'play'; debris = []; M.fall = null; M.rot = 0; setExpr('cheer', 1); Platform.gameplayStart();
      var top = stack[stack.length - 1]; M.x = top.x; M.y = stack.length * BH + 200; spawn(); SFX.world();
    });
  }
  function doDouble() {
    if (starsDoubled || runStars <= 0) return;
    Ads.rewarded('double_stars').then(function (ok) { if (!ok) return; starsDoubled = true; save.stars += runStars; runStars *= 2; SFX.coin(); persist(); Analytics.track('reward', { id: 'double_stars', n: runStars }); });
  }
  function playAgain() {
    save.stats.retries++; Analytics.track('retry', { n: save.stats.retries });
    Ads.interstitial().then(startRun);
  }

  // ================= Input =================
  function hit(px, py) { for (var i = buttons.length - 1; i >= 0; i--) { var b = buttons[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; } return null; }
  function selectSkin() { var id = SKINS[previewSkin].id; if (save.skins.indexOf(id) >= 0) { save.skin = id; persist(); } setExpr('wow', 0.4); }
  function onButton(b) {
    pressed = b.id; pressT = 0.15; SFX.click(); vib(5);
    switch (b.id) {
      case 'play': if (save.skins.indexOf(SKINS[previewSkin].id) < 0) previewSkin = Math.max(0, SKINS.findIndex(function (s) { return s.id === save.skin; })); startRun(); break;
      case 'again': playAgain(); break;
      case 'continue': doContinue(); break;
      case 'double': doDouble(); break;
      case 'skinL': previewSkin = (previewSkin + SKINS.length - 1) % SKINS.length; selectSkin(); break;
      case 'skinR': previewSkin = (previewSkin + 1) % SKINS.length; selectSkin(); break;
      case 'buy': var sk = SKINS[previewSkin]; if (save.stars >= sk.cost && save.skins.indexOf(sk.id) < 0) { save.stars -= sk.cost; save.skins.push(sk.id); save.skin = sk.id; SFX.record(); setExpr('cheer', 1.2); burst(0, 7 * BH, 30, 250, CONF, true); Analytics.track('skin_unlock', { id: sk.id }); persist(); } break;
      case 'haptic': save.haptics = !save.haptics; vib(30); persist(); break;
      case 'resume': userPaused = false; break;
    }
  }
  function action(px, py) {
    ensureAudio(); if (AC && AC.state === 'suspended' && audioOn && !paused && !adActive) AC.resume();
    if (paused || adActive) return;
    if (px != null) { var b = hit(px, py); if (b) { onButton(b); return; } }
    if (userPaused) { if (px == null) userPaused = false; return; }
    if (state === 'menu') onButton({ id: 'play' });
    else if (state === 'play') drop();
    else if (state === 'over' && overT > 0.8 && px == null) onButton({ id: 'again' });
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); action(e.clientX, e.clientY); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (state === 'play') userPaused = !userPaused; return; } // never preventDefault on Esc
    if (e.repeat) return;
    if (state === 'menu' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { onButton({ id: e.key === 'ArrowLeft' ? 'skinL' : 'skinR' }); return; }
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); action(); }
  });
  window.addEventListener('resize', resize);
  Platform.onPause(function () { paused = true; if (AC) AC.suspend(); save.stats.playSec += Math.round((Date.now() - sessionStart) / 1000); Analytics.track('session_pause', { sec: save.stats.playSec }); persist(); });
  Platform.onResume(function () { paused = false; if (needResize) { needResize = false; resize(); } last = performance.now(); if (AC && audioOn && !adActive) AC.resume(); requestAnimationFrame(loop); });
  Platform.onAudioEnabledChange(function (on) { setAudio(on); });

  // ================= Update =================
  function update(dt) {
    time += dt;
    if (pressT > 0) pressT -= dt;
    if (state === 'play' && !userPaused) {
      var Rg = range(); cur.x += dir * speed * dt;
      if (cur.x > Rg) { cur.x = Rg; dir = -1; } else if (cur.x < -Rg) { cur.x = -Rg; dir = 1; }
    }
    if (state === 'over') overT += dt;
    if (userPaused) return;
    if (M.exprT > 0) { M.exprT -= dt; if (M.exprT <= 0 && state !== 'over') M.expr = (state === 'play' && cur && cur.w < 70) ? 'worry' : 'happy'; }
    M.sq *= Math.pow(0.0005, dt); if (Math.abs(M.sq) < 0.005) M.sq = 0;
    var rideY = (stack.length + 1) * BH;
    if (M.fall) { M.fall.vy -= 1100 * dt; M.x += M.fall.vx * dt; M.y += M.fall.vy * dt; M.rot += M.fall.vr * dt; }
    else if (state === 'play' && M.jump) { M.jump.t += dt / 0.28; var k = Math.min(1, M.jump.t); M.x = M.jump.fromX + (cur.x - M.jump.fromX) * k; M.y = M.jump.fromY + (rideY - M.jump.fromY) * k + Math.sin(k * Math.PI) * 34; if (k >= 1) { M.jump = null; M.sq = 0.2; } }
    else if (state === 'play') { M.x = cur.x; M.y = rideY; }
    else if (state === 'menu') { M.x = stack[stack.length - 1].x; M.y = stack.length * BH + Math.abs(Math.sin(time * 3)) * 12; M.sq = -Math.cos(time * 6) * 0.05; }
    var topH = stack.length * BH;
    var anchorT = state === 'menu' ? (WIDE ? CH * 0.66 : CH * 0.5) : CH * (WIDE ? 0.6 : 0.56);
    var camT = Math.max(topH, (CH * 0.88 - anchorT) / S);
    if (state === 'over') camT = topH / 2 + 40;
    if (state === 'menu') camT = ((WIDE ? CH * 0.86 : CH * 0.64) - anchorT) / (S * Z);
    camY += (camT - camY) * Math.min(1, dt * 4); anchorY += (anchorT - anchorY) * Math.min(1, dt * 5);
    var camXT = (state === 'menu' && WIDE) ? CW * 0.74 : CW / 2; camX += (camXT - camX) * Math.min(1, dt * 5);
    var zT = state === 'over' ? Math.min(1, (CH / S) / (topH + 300) * 0.9) : state === 'menu' ? (WIDE ? 1.15 : 1.3) : 1;
    Z += (zT - Z) * Math.min(1, dt * 3);
    var i;
    for (i = debris.length - 1; i >= 0; i--) { var d = debris[i]; d.vy -= 1000 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; if (d.y < camY - 3000) debris.splice(i, 1); }
    for (i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.t += dt; if (p.conf) { p.vy -= 300 * dt; p.vx *= Math.pow(0.4, dt); p.vy = Math.max(p.vy, -140); p.x += (p.vx + Math.sin(p.t * 6 + p.rot) * 40) * dt; } else { p.vy -= 400 * dt; p.x += p.vx * dt; } p.y += p.vy * dt; p.rot += p.vr * dt; if (p.t > p.life) parts.splice(i, 1); }
    for (i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; pops[i].y += 30 * dt; if (pops[i].t > 1) pops.splice(i, 1); }
    for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.45) rings.splice(i, 1); }
    for (i = 0; i < stack.length; i++) if (stack[i].pop > 0) stack[i].pop = Math.max(0, stack[i].pop - dt * 5);
    for (i = toasts.length - 1; i >= 0; i--) { toasts[i].t += dt; if (toasts[i].t > 3) toasts.splice(i, 1); }
    if (banner) { banner.t += dt; if (banner.t > 2.4) banner = null; }
    scorePop = Math.max(0, scorePop - dt * 4);
    shake = Math.max(0, shake - dt * 35); flash = Math.max(0, flash - dt);
  }

  // ================= Render =================
  function sx(x) { return camX + x * S * Z; }
  function sy(y) { return anchorY - (y - camY) * S * Z; }
  function worldBlock(x, y, w, i, alpha, popv, ao) {
    var sc = S * Z, X = sx(x - w / 2), H = BH * sc, Y = sy(y + BH), W = w * sc;
    if (popv) { var q = Math.sin(popv * Math.PI) * 0.14; Y += H * q; H *= 1 - q; X -= W * q * 0.15; W *= 1 + q * 0.3; }
    drawBlock(cx, X, Y, W, H, DEPTH * sc, skinCols(skinNow(), i), alpha, ao);
  }
  function setFont(size) { cx.font = '700 ' + Math.round(size) + 'px ' + FONT; }
  function txtW(s, size) { setFont(size); return cx.measureText(s).width; }
  function txt(s, x, y, size, o) {
    o = o || {}; setFont(size); cx.textAlign = o.align || 'center'; cx.textBaseline = 'middle';
    if (o.max) { var mw = cx.measureText(s).width; if (mw > o.max) { size *= o.max / mw; setFont(size); } }
    cx.lineJoin = 'round';
    if (o.shadow !== false) { cx.fillStyle = 'rgba(30,10,60,0.4)'; cx.fillText(s, x, y + size * 0.1); }
    if (o.stroke !== false) { cx.lineWidth = size * (o.sw || 0.16); cx.strokeStyle = o.strokeCol || '#2b1055'; cx.strokeText(s, x, y); }
    cx.fillStyle = o.fill || '#fff'; cx.fillText(s, x, y);
  }
  function logo(x, y, size, maxW) {
    var word = 'SKY STACK'; var w = txtW(word, size) * 1.04; if (w > maxW) { size *= maxW / w; w = maxW; }
    setFont(size); cx.textBaseline = 'middle'; cx.textAlign = 'center'; cx.lineJoin = 'round';
    var px = x - w / 2, ext = Math.max(3, size * 0.11);
    for (var i = 0; i < word.length; i++) {
      var ch = word[i], cw = cx.measureText(ch).width * 1.04;
      if (ch !== ' ') {
        var ly = y + Math.sin(time * 2.4 + i * 0.55) * size * 0.035, rot = Math.sin(time * 1.7 + i * 0.9) * 0.035;
        var face = i < 3 ? ['#fff6d6', '#ffd23f', '#ff9f1c'] : ['#e8fbff', '#62d8ff', '#2f7bff'], sideC = i < 3 ? '#c45a12' : '#1b3fa8';
        cx.save(); cx.translate(px + cw / 2, ly); cx.rotate(rot);
        // soft drop shadow
        cx.fillStyle = 'rgba(20,0,50,0.35)'; cx.fillText(ch, size * 0.04, ext + size * 0.08);
        // outer outline
        cx.lineWidth = size * 0.26; cx.strokeStyle = '#24104f'; for (var e = ext; e >= 0; e -= ext / 3) cx.strokeText(ch, 0, e);
        // extrusion
        for (e = ext; e > 0; e -= 1) { cx.fillStyle = e > ext * 0.5 ? shadeCss(sideC, -0.25) : sideC; cx.fillText(ch, 0, e); }
        // face
        var g = cx.createLinearGradient(0, -size * 0.42, 0, size * 0.38); g.addColorStop(0, face[0]); g.addColorStop(0.45, face[1]); g.addColorStop(1, face[2]);
        cx.fillStyle = g; cx.fillText(ch, 0, 0);
        cx.lineWidth = Math.max(1, size * 0.025); cx.strokeStyle = 'rgba(255,255,255,0.6)'; cx.strokeText(ch, 0, -size * 0.01);
        cx.save(); cx.beginPath(); cx.rect(-cw, -size * 0.55, cw * 2, size * 0.3); cx.clip(); cx.fillStyle = 'rgba(255,255,255,0.45)'; cx.fillText(ch, 0, 0); cx.restore();
        cx.restore();
      }
      px += cw;
    }
    // sparkle glint traveling across the logo
    var gx = x - w / 2 + ((time * 0.35) % 1.6) * w; cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,255,255,0.9)'; star4(cx, gx, y - size * 0.3, size * 0.12); cx.restore();
  }
  function shadeCss(c, f) { return rgb(shade(hx(c), f)); }
  function btn(id, x, y, w, h, label, col, opt) {
    opt = opt || {}; var sc = (pressed === id && pressT > 0) ? 0.92 : (opt.pulse ? 1 + Math.sin(time * 5) * 0.04 : 1);
    var X = x - w * sc / 2, Y = y - h * sc / 2, W = w * sc, H = h * sc, r = H * 0.42;
    buttons.push({ id: id, x: x - w / 2, y: y - h / 2, w: w, h: h });
    cx.save(); if (opt.dim) cx.globalAlpha *= 0.6;
    cx.fillStyle = 'rgba(20,0,40,0.3)'; rr(cx, X, Y + H * 0.16, W, H, r); cx.fill();
    cx.fillStyle = col[2]; rr(cx, X, Y + H * 0.1, W, H, r); cx.fill();
    var g = cx.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); cx.fillStyle = g; rr(cx, X, Y, W, H, r); cx.fill();
    cx.lineWidth = Math.max(2, H * 0.06); cx.strokeStyle = '#2b1055'; rr(cx, X, Y, W, H * 1.1, r); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.4)'; rr(cx, X + H * 0.25, Y + H * 0.1, W - H * 0.5, H * 0.2, H * 0.1); cx.fill();
    var ls = H * (opt.small ? 0.38 : 0.48);
    if (opt.icon === 'play') { var tw = txtW(label, ls), ix = X + W / 2 - tw / 2 - ls * 0.5; cx.fillStyle = '#2b1055'; cx.beginPath(); cx.moveTo(ix - ls * 0.05, Y + H / 2 - ls * 0.48); cx.lineTo(ix + ls * 0.7, Y + H / 2); cx.lineTo(ix - ls * 0.05, Y + H / 2 + ls * 0.48); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(ix + ls * 0.05, Y + H / 2 - ls * 0.32); cx.lineTo(ix + ls * 0.55, Y + H / 2); cx.lineTo(ix + ls * 0.05, Y + H / 2 + ls * 0.32); cx.fill(); txt(label, X + W / 2 + ls * 0.4, Y + H / 2, ls, { sw: 0.2, max: W * 0.66 }); }
    else txt(label, X + W / 2, Y + H / 2, ls, { sw: 0.2, max: W * 0.84 });
    if (opt.badge) { var bw = H * 0.62, bh = H * 0.36; cx.fillStyle = '#ffd23f'; rr(cx, X + W - bw * 0.9, Y - bh * 0.55, bw, bh, bh * 0.3); cx.fill(); cx.strokeStyle = '#2b1055'; cx.lineWidth = 2; cx.stroke(); txt(opt.badge, X + W - bw * 0.4, Y - bh * 0.05, bh * 0.62, { stroke: false, shadow: false, fill: '#2b1055' }); }
    cx.restore();
  }
  function chip(x, y, w, h, alpha) { cx.fillStyle = 'rgba(25,8,55,' + (alpha || 0.45) + ')'; rr(cx, x - w / 2, y - h / 2, w, h, h / 2); cx.fill(); }
  function starIcon(x, y, r) { cx.fillStyle = '#2b1055'; star(cx, x, y + r * 0.15, r * 1.25); cx.fillStyle = '#ffd23f'; star(cx, x, y, r); cx.fillStyle = 'rgba(255,255,255,0.6)'; star(cx, x - r * 0.15, y - r * 0.2, r * 0.35); }
  function worldStrip(x, y, r, gap, reached) {
    var n = WORLDS.length, x0 = x - (n - 1) * gap / 2, i;
    cx.strokeStyle = '#2b1055'; cx.lineWidth = r * 0.45; cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x0 + (n - 1) * gap, y); cx.stroke();
    cx.strokeStyle = '#ffd23f'; cx.lineWidth = r * 0.22; cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x0 + Math.max(0, reached - 1) * gap, y); cx.stroke();
    for (i = 0; i < n; i++) {
      var X = x0 + i * gap, un = i < reached, w = WORLDS[i];
      cx.beginPath(); cx.arc(X, y, r * 1.1, 0, 7); cx.fillStyle = '#2b1055'; cx.fill();
      cx.save(); cx.beginPath(); cx.arc(X, y, r * 0.9, 0, 7); cx.clip();
      var g = cx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, w.sky[0]); g.addColorStop(1, w.sky[2]); cx.fillStyle = un ? g : '#5d5277'; cx.fillRect(X - r, y - r, r * 2, r * 2);
      if (un) { cx.fillStyle = w.ground; cx.beginPath(); cx.arc(X, y + r * 1.05, r * 0.75, 0, 7); cx.fill(); }
      cx.restore();
      if (un) txt(String(i + 1), X, y - r * 0.08, r * 1.05, { sw: 0.22 });
      else { cx.fillStyle = '#d6cfee'; rr(cx, X - r * 0.32, y - r * 0.08, r * 0.64, r * 0.5, r * 0.1); cx.fill(); cx.strokeStyle = '#d6cfee'; cx.lineWidth = r * 0.14; cx.beginPath(); cx.arc(X, y - r * 0.1, r * 0.22, Math.PI, 0); cx.stroke(); }
    }
  }
  function hapticBtn(x, y, s) {
    buttons.push({ id: 'haptic', x: x - s / 2, y: y - s / 2, w: s, h: s });
    cx.fillStyle = 'rgba(25,8,55,0.5)'; rr(cx, x - s / 2, y - s / 2, s, s, s * 0.3); cx.fill();
    cx.strokeStyle = '#fff'; cx.lineWidth = s * 0.07; cx.lineCap = 'round'; rr(cx, x - s * 0.12, y - s * 0.28, s * 0.24, s * 0.4, s * 0.05); cx.stroke();
    for (var k = -1; k <= 1; k += 2) { cx.beginPath(); cx.moveTo(x + k * s * 0.22, y - s * 0.18); cx.lineTo(x + k * s * 0.3, y - s * 0.08); cx.lineTo(x + k * s * 0.22, y + s * 0.02); cx.stroke(); }
    if (!save.haptics) { cx.strokeStyle = '#ff4e7a'; cx.lineWidth = s * 0.09; cx.beginPath(); cx.moveTo(x - s * 0.3, y + s * 0.12); cx.lineTo(x + s * 0.3, y - s * 0.34); cx.stroke(); }
    txt(save.haptics ? T.on : T.off, x, y + s * 0.3, s * 0.22, { sw: 0.2 });
  }
  function dailyLine(x, y, w, h) {
    ensureDaily(); var gs = save.daily.goals, next = null;
    gs.forEach(function (g) { if (!g.done && !next) next = g; });
    chip(x, y, w, h, 0.55);
    var fs = h * 0.44, lx = x - w / 2 + h * 0.4;
    txt(T.daily, lx, y, fs * 0.85, { align: 'left', fill: '#ffd23f', sw: 0.22 });
    lx += txtW(T.daily, fs * 0.85) + h * 0.3;
    var label = next ? goalText(next) + '  ' + Math.min(next.p, next.n) + '/' + next.n : T.dailyDone;
    var right = x + w / 2 - h * 1.5;
    txt(label, lx, y, fs, { align: 'left', sw: 0.2, max: right - lx - h * 0.2 });
    for (var i = 0; i < 3; i++) { var X = right + h * 0.25 + i * h * 0.4; if (gs[i].done) starIcon(X, y, h * 0.17); else { cx.fillStyle = 'rgba(255,255,255,0.35)'; cx.beginPath(); cx.arc(X, y, h * 0.1, 0, 7); cx.fill(); } }
  }
  function starsBadge(x, y, k) { var s = String(save.stars), w = txtW(s, 22 * k) + 54 * k; chip(x + w / 2, y, w, 38 * k, 0.55); starIcon(x + 20 * k, y, 12 * k); txt(s, x + 38 * k, y, 22 * k, { align: 'left', sw: 0.2 }); return w; }
  function draw() {
    if (!CW) return;
    buttons = [];
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var u = Math.min(CW, CH), i;
    if (state === 'loading') {
      drawSky(cx, CW, CH, 0, time, 0, 1); drawHills(cx, CW, CH, 0, CH * 0.86);
      drawMascot(cx, CW / 2, CH * 0.62, u * 0.22, { expr: 'happy', t: time });
      chip(CW / 2, CH * 0.74, u * 0.5, u * 0.07, 0.55); txt(T.loading, CW / 2, CH * 0.74, u * 0.045);
      return;
    }
    var wf = Math.max(0, (camY + 60) / (WORLD_EVERY * BH)), wi = Math.min(5, Math.floor(wf)), wj = Math.min(5, wi + 1), bl = Math.max(0, Math.min(1, (wf - wi - 0.6) / 0.4));
    if (state !== 'menu' && state !== 'loading') { wi = Math.min(wi, Math.max(worldIdx, 0)); }
    if (state === 'menu') { wi = 0; wj = 0; bl = 0; }
    var camPx = camY * S;
    drawSky(cx, CW, CH, wi, time, camPx, 1); if (bl > 0 && wj !== wi) drawSky(cx, CW, CH, wj, time, camPx, bl);
    cx.save();
    if (shake > 0) cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawHills(cx, CW, CH, wi, sy(0));
    var tyS = sy(stack.length * BH), gr = cx.createRadialGradient(camX, tyS, 0, camX, tyS, u * 0.45); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, CW, CH);
    var gyS = sy(0); if (gyS < CH + 30) { cx.fillStyle = 'rgba(0,0,0,0.2)'; cx.beginPath(); cx.ellipse(sx(stack[0].x) + DEPTH * S * Z * 0.5, gyS + 2, stack[0].w * S * Z * 0.62, 9 * S * Z, 0, 0, 7); cx.fill(); }
    for (i = 0; i < stack.length; i++) { var b = stack[i], by = i * BH; if (sy(by) < -80 || sy(by + BH) > CH + 80) continue; worldBlock(b.x, by, b.w, i, 1, b.pop, i < stack.length - 1 || state === 'play'); }
    for (i = 0; i < rings.length; i++) { var rg = rings[i], k = rg.t / 0.45, pad = k * 26; cx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; cx.lineWidth = 4 * (1 - k) + 1; rr(cx, sx(rg.x - rg.w / 2 - pad), sy(rg.y + BH + pad), (rg.w + pad * 2) * S * Z, (BH + pad * 2) * S * Z, 6); cx.stroke(); }
    if (state === 'play' && cur) {
      if (!save.tut) { var top = stack[stack.length - 1]; cx.setLineDash([8, 6]); cx.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.45 * Math.sin(time * 8)) + ')'; cx.lineWidth = 3; cx.strokeRect(sx(top.x - top.w / 2), sy(stack.length * BH + BH), top.w * S * Z, BH * S * Z); cx.setLineDash([]); }
      var tp = stack[stack.length - 1], l0 = Math.max(tp.x - tp.w / 2, cur.x - cur.w / 2), r0 = Math.min(tp.x + tp.w / 2, cur.x + cur.w / 2);
      if (r0 > l0) { var sc0 = S * Z, yT = sy(stack.length * BH), dd = DEPTH * sc0; cx.fillStyle = 'rgba(20,0,40,0.28)'; cx.beginPath(); cx.moveTo(sx(l0), yT); cx.lineTo(sx(l0) + dd, yT - dd * 0.55); cx.lineTo(sx(r0) + dd, yT - dd * 0.55); cx.lineTo(sx(r0), yT); cx.closePath(); cx.fill(); }
      worldBlock(cur.x, stack.length * BH, cur.w, stack.length, 1, 0);
    }
    for (i = 0; i < debris.length; i++) { var d = debris[i]; cx.save(); cx.translate(sx(d.x), sy(d.y)); cx.rotate(d.r); var dw = d.w * S * Z, dh = BH * S * Z; drawBlock(cx, -dw / 2, -dh / 2, dw, dh, DEPTH * S * Z, skinCols(skinNow(), d.i)); cx.restore(); }
    if (stack.length) { var ms = 50 * S * Z * (state === 'menu' ? 1.3 : 1), mX = sx(M.x) + DEPTH * S * Z * 0.45, mY = sy(M.y) - DEPTH * S * Z * 0.3;
      if (!M.fall) { var hgt = Math.max(0, (M.y - Math.round(M.y / BH) * BH)) ; cx.fillStyle = 'rgba(20,0,40,' + (0.3 - Math.min(0.2, hgt / 120)) + ')'; cx.beginPath(); cx.ellipse(mX, sy(Math.round(M.y / BH) * BH) - DEPTH * S * Z * 0.3, ms * 0.4 * (1 - Math.min(0.4, hgt / 100)), ms * 0.08, 0, 0, 7); cx.fill(); }
      var breathe = Math.sin(time * 3.2) * 0.025; drawMascot(cx, mX, mY, ms, { expr: M.expr, t: time, sq: M.sq + breathe, look: state === 'play' ? dir : Math.sin(time * 0.8), rot: M.rot + Math.sin(time * 1.6) * 0.03 }); }
    for (i = 0; i < parts.length; i++) { var p = parts[i], lf = p.t / p.life, ea = 1 - lf * lf; cx.globalAlpha = Math.max(0, ea); cx.fillStyle = p.c; if (!p.conf) { cx.globalCompositeOperation = 'lighter'; star4(cx, sx(p.x), sy(p.y), p.r * S * 1.6 * (1 - lf * 0.6)); cx.globalCompositeOperation = 'source-over'; continue; } if (p.conf) { cx.save(); cx.translate(sx(p.x), sy(p.y)); cx.rotate(p.rot); cx.fillRect(-p.r * S / 2, -p.r * S / 4, p.r * S, p.r * S * 0.5 * Math.abs(Math.cos(p.rot * 1.3)) + 1); cx.restore(); } else { cx.beginPath(); cx.arc(sx(p.x), sy(p.y), p.r * S * 0.6, 0, 7); cx.fill(); } }
    cx.globalAlpha = 1;
    for (i = 0; i < pops.length; i++) { var f = pops[i], el = f.t < 0.15 ? 0.3 + (f.t / 0.15) : 1.3 - Math.min(0.3, (f.t - 0.15) * 1.5); cx.globalAlpha = Math.max(0, Math.min(1, (1 - f.t) * 2.5)); var fxp = Math.max(CW * 0.2, Math.min(CW * 0.8, sx(f.x))), bgl = cx.createRadialGradient(fxp, sy(f.y), 0, fxp, sy(f.y), 90 * K * f.size); bgl.addColorStop(0, 'rgba(255,240,200,0.35)'); bgl.addColorStop(1, 'rgba(255,240,200,0)'); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = bgl; cx.fillRect(fxp - 90 * K * f.size, sy(f.y) - 90 * K * f.size, 180 * K * f.size, 180 * K * f.size); cx.globalCompositeOperation = 'source-over'; txt(f.txt, fxp, Math.max(CH * (WIDE ? 0.12 : 0.1) + 112 * K + (f.size < 1.05 ? 46 * K : 0), sy(f.y)), 34 * K * f.size * el, { fill: f.col, sw: 0.2 }); }
    cx.globalAlpha = 1;
    cx.restore();
    if (flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + flash * 0.5 + ')'; cx.fillRect(0, 0, CW, CH); }
    var GW = WORLDS[state === 'menu' ? 0 : Math.min(5, worldIdx)]; cx.fillStyle = GW.grade; cx.globalCompositeOperation = 'soft-light'; cx.fillRect(0, 0, CW, CH); cx.globalCompositeOperation = 'source-over';
    var vg = cx.createRadialGradient(CW / 2, CH / 2, u * 0.4, CW / 2, CH / 2, Math.max(CW, CH) * 0.8); vg.addColorStop(0, 'rgba(20,0,40,0)'); vg.addColorStop(1, 'rgba(20,0,40,0.3)'); cx.fillStyle = vg; cx.fillRect(0, 0, CW, CH);
    if (state === 'menu') drawMenu(); else drawHUD();
    for (i = 0; i < toasts.length; i++) { var to = toasts[i], ty = (state === 'play' ? CH * 0.78 : 100 * K) + 46 * K * i, sl = Math.max(0, Math.min(1, to.t * 5, (3 - to.t) * 4)); cx.globalAlpha = sl; var tw = Math.min(CW * 0.92, txtW(to.txt, 18 * K) + 40 * K); chip(CW / 2, ty - (1 - sl) * 30, tw, 38 * K, 0.8); txt(to.txt, CW / 2, ty - (1 - sl) * 30, 18 * K, { max: tw - 24 * K, fill: '#ffe66d' }); }
    cx.globalAlpha = 1;
  }
  function drawMenu() {
    var k = K, cxm = WIDE ? CW * 0.3 : CW / 2, colW = WIDE ? CW * 0.56 : CW;
    var L = WIDE ? { logo: 0.23, hook: 0.37, play: 0.55, daily: 0.72, strip: 0.87 } : { logo: 0.15, hook: 0.225, play: 0.76, daily: 0.855, strip: 0.93 };
    logo(cxm, CH * L.logo, 84 * k, Math.min(colW * 0.92, 600 * k));
    chip(cxm, CH * L.hook, Math.min(colW * 0.9, txtW(T.hook, 24 * k) + 44 * k), 42 * k, 0.4);
    txt(T.hook, cxm, CH * L.hook, 24 * k, { max: colW * 0.84, sw: 0.2 });
    // skin selector beside the mascot tower
    var sk = SKINS[previewSkin], owned = save.skins.indexOf(sk.id) >= 0;
    var tx = sx(0) + DEPTH * S * 0.5, ty = sy(stack.length * BH * 0.5);
    var aX = stack[0].w * S * Z * 0.5 + 40 * k;
    var lX = Math.max(30 * k, tx - aX), rX = Math.min(CW - 30 * k, tx + aX);
    btn('skinL', lX, ty, 48 * k, 54 * k, '‹', ['#c4a1ff', '#8b5cf6', '#5b21b6']);
    btn('skinR', rX, ty, 48 * k, 54 * k, '›', ['#c4a1ff', '#8b5cf6', '#5b21b6']);
    var nameY = sy(0) + 26 * k;
    if (nameY > CH - 30 * k) nameY = CH - 30 * k;
    if (!owned) { var can = save.stars >= sk.cost; btn('buy', tx, nameY, 190 * k, 42 * k, can ? T.unlock + ' ' + sk.cost + '★' : T.skins[previewSkin] + ' · ' + fmt(T.locked, { n: sk.cost - save.stars }), can ? ['#ffe14d', '#ffb800', '#c77d00'] : ['#9a90b5', '#6f6590', '#4a4266'], { small: true }); }
    else if (WIDE) { chip(tx, nameY, txtW(T.skins[previewSkin], 18 * k) + 30 * k, 32 * k, 0.5); txt(T.skins[previewSkin], tx, nameY, 18 * k, { sw: 0.2 }); }
    btn('play', cxm, CH * L.play, Math.min(colW * 0.66, 290 * k), 80 * k, T.play, ['#8dff6a', '#22c55e', '#15803d'], { pulse: true, icon: 'play' });
    dailyLine(cxm, CH * L.daily, Math.min(colW * 0.92, 430 * k), 40 * k);
    worldStrip(cxm, CH * L.strip, 15 * k, Math.min(colW * 0.86 / 6, 54 * k), save.worlds);
    var sbw = starsBadge(12 * k, 30 * k, k);
    var bt = T.best + ' ' + save.best, bw = txtW(bt, 17 * k) + 30 * k; chip(12 * k + sbw + 8 * k + bw / 2, 30 * k, bw, 34 * k, 0.5); txt(bt, 12 * k + sbw + 8 * k + bw / 2, 30 * k, 17 * k, { sw: 0.2 });
    if (WIDE) hapticBtn(CW - 40 * k, CH - 40 * k, 50 * k); else hapticBtn(CW - 34 * k, CH * L.play, 46 * k);
  }
  function drawHUD() {
    var k = K, sy0 = CH * (WIDE ? 0.12 : 0.1);
    if (state === 'play' || overT < 0.4) {
      txt(String(score), CW / 2, sy0, 78 * k * (1 + scorePop * 0.3), { sw: 0.14 });
      var next = (worldIdx + 1) * WORLD_EVERY, pr = worldIdx >= 5 ? 1 : (score - worldIdx * WORLD_EVERY) / WORLD_EVERY, bw = Math.min(200 * k, CW * 0.45), by = sy0 + 52 * k;
      chip(CW / 2, by, bw + 10 * k, 18 * k, 0.55); var pg = cx.createLinearGradient(CW / 2 - bw / 2, 0, CW / 2 + bw / 2, 0); pg.addColorStop(0, '#ffd23f'); pg.addColorStop(1, '#ff4e7a'); cx.fillStyle = pg; rr(cx, CW / 2 - bw / 2, by - 5 * k, Math.max(10 * k, bw * pr), 10 * k, 5 * k); cx.fill();
      txt(worldIdx >= 5 ? T.worlds[5] : T.worlds[worldIdx + 1] + ' · ' + (next - score), CW / 2, by + 22 * k, 15 * k, { sw: 0.22, max: CW * 0.6 });
      starsBadge(12 * k, 30 * k, k);
      if (combo >= 2) txt('×' + combo, CW - 46 * k, sy0 + 70 * k, 34 * k, { fill: combo >= 5 ? '#ff4e7a' : '#ffd166' });
    }
    if (state === 'play' && !save.tut) {
      var hy = CH * (WIDE ? 0.88 : 0.86), hx = CW / 2, tap = (time * 1.4) % 1, tw = Math.min(CW * 0.92, txtW(T.tut, 22 * k) + 50 * k);
      chip(hx, hy, tw, 50 * k, 0.65); txt(T.tut, hx, hy, 22 * k, { max: tw - 30 * k });
      var fx = hx + tw / 2 - 10 * k, fy = hy - 44 * k + (tap < 0.25 ? tap * 40 * k : 10 * k);
      cx.fillStyle = '#fff'; cx.strokeStyle = '#2b1055'; cx.lineWidth = 3 * k; rr(cx, fx - 8 * k, fy - 26 * k, 16 * k, 40 * k, 8 * k); cx.fill(); cx.stroke(); rr(cx, fx - 16 * k, fy + 2 * k, 34 * k, 30 * k, 11 * k); cx.fill(); cx.stroke();
      if (tap < 0.3) { cx.strokeStyle = 'rgba(255,255,255,' + (1 - tap / 0.3) + ')'; cx.lineWidth = 3; cx.beginPath(); cx.arc(fx, fy - 26 * k, 24 * k * (tap / 0.3) + 6, 0, 7); cx.stroke(); }
    }
    if (banner) { var bt = banner.t, sc = bt < 0.25 ? 0.5 + bt * 2 : 1, al = Math.max(0, Math.min(1, (2.4 - bt) * 3)); cx.globalAlpha = al;
      var bh = 96 * k; cx.save(); cx.translate(CW / 2, CH * 0.34); cx.scale(sc, sc);
      var g = cx.createLinearGradient(-CW / 2, 0, CW / 2, 0); g.addColorStop(0, 'rgba(255,78,122,0)'); g.addColorStop(0.2, 'rgba(255,78,122,0.92)'); g.addColorStop(0.8, 'rgba(124,77,255,0.92)'); g.addColorStop(1, 'rgba(124,77,255,0)'); cx.fillStyle = g; cx.fillRect(-CW / 2, -bh / 2, CW, bh);
      txt(banner.a, 0, -bh * 0.22, 20 * k, { fill: '#ffe66d', max: CW * 0.8 }); txt(banner.b, 0, bh * 0.16, 40 * k, { max: CW * 0.86 }); cx.restore(); cx.globalAlpha = 1; }
    if (state === 'over' && overT > 0.4) drawOver();
    if (userPaused) { cx.fillStyle = 'rgba(20,0,40,0.65)'; cx.fillRect(0, 0, CW, CH); txt(T.paused, CW / 2, CH * 0.3, 56 * k); btn('resume', CW / 2, CH * 0.48, 230 * k, 68 * k, T.resume, ['#8dff6a', '#22c55e', '#15803d'], { icon: 'play' }); txt(T.escHint, CW / 2, CH * 0.6, 16 * k); hapticBtn(CW / 2, CH * 0.76, 52 * k); }
  }
  function drawOver() {
    var a = Math.min(1, (overT - 0.4) * 4);
    cx.fillStyle = 'rgba(20,0,40,' + 0.5 * a + ')'; cx.fillRect(0, 0, CW, CH);
    var k = Math.min(K, CH * 0.95 / 440, CW * 0.94 / 360), pw = Math.min(CW * 0.94, 380 * k), ph = 440 * k;
    var ea = a < 1 ? 1 + 2.7 * Math.pow(a - 1, 3) + 1.7 * Math.pow(a - 1, 2) : 1; var px = CW / 2, top = (CH - ph) / 2 + (1 - ea) * 90;
    cx.save(); cx.globalAlpha = a;
    cx.fillStyle = 'rgba(20,0,40,0.45)'; rr(cx, px - pw / 2, top + 10 * k, pw, ph, 30 * k); cx.fill();
    var g = cx.createLinearGradient(0, top, 0, top + ph); g.addColorStop(0, '#6a35e8'); g.addColorStop(1, '#2a1170'); cx.fillStyle = g; rr(cx, px - pw / 2, top, pw, ph, 30 * k); cx.fill();
    cx.lineWidth = 4 * k; cx.strokeStyle = '#2b1055'; cx.stroke(); cx.strokeStyle = 'rgba(255,255,255,0.2)'; cx.lineWidth = 2; rr(cx, px - pw / 2 + 6 * k, top + 6 * k, pw - 12 * k, ph - 12 * k, 25 * k); cx.stroke();
    var y = top + 42 * k, rec = newBest;
    var title = rec ? T.newRec : ((save.best - score) <= 3 && score > 0 ? T.soClose : T.fell);
    txt(title, px, y, 38 * k * (rec ? 1 + Math.sin(time * 6) * 0.05 : 1), { fill: rec ? '#ffe66d' : '#ff8fab', max: pw * 0.88 }); y += 72 * k;
    var cu = Math.min(1, Math.max(0, (overT - 0.5) / 0.8)); cu = 1 - Math.pow(1 - cu, 3); txt(String(Math.round(score * cu)), px, y, 90 * k * (1 + (cu < 1 ? 0.04 * Math.sin(time * 30) : 0)), { sw: 0.12 }); y += 58 * k;
    txt(T.best + ' ' + save.best, px, y, 22 * k, { fill: '#d8c8ff', sw: 0.2 }); y += 38 * k;
    var bw = pw * 0.78, wi2 = Math.min(5, Math.floor(score / WORLD_EVERY)), nextAt = (wi2 + 1) * WORLD_EVERY, pr = wi2 >= 5 ? 1 : (score - wi2 * WORLD_EVERY) / WORLD_EVERY;
    chip(px, y, bw + 8 * k, 20 * k, 0.6); var pg = cx.createLinearGradient(px - bw / 2, 0, px + bw / 2, 0); pg.addColorStop(0, '#ffd23f'); pg.addColorStop(1, '#ff4e7a'); cx.fillStyle = pg; rr(cx, px - bw / 2, y - 6 * k, Math.max(12 * k, bw * pr), 12 * k, 6 * k); cx.fill();
    y += 26 * k; txt(wi2 >= 5 ? T.allWorlds : fmt(T.floorsTo, { n: nextAt - score, w: T.worlds[wi2 + 1] }), px, y, 17 * k, { max: pw * 0.9, sw: 0.22 }); y += 44 * k;
    var hasDbl = !starsDoubled && runStars > 0, sxp = hasDbl ? px - pw * 0.22 : px;
    starIcon(sxp - 26 * k, y, 15 * k); txt('+' + Math.round(runStars * cu), sxp - 6 * k, y, 28 * k, { align: 'left', fill: '#ffe66d' });
    if (hasDbl) btn('double', px + pw * 0.2, y, pw * 0.42, 42 * k, T.dbl, ['#ffe14d', '#ffb800', '#c77d00'], { small: true, badge: T.ad });
    y += 62 * k;
    if (!continued && score >= 3) { btn('again', px - pw * 0.215, y, pw * 0.41, 66 * k, T.again, ['#8dff6a', '#22c55e', '#15803d'], { small: true, pulse: overT > 0.9 }); btn('continue', px + pw * 0.215, y, pw * 0.39, 66 * k, T.cont, ['#d4b8ff', '#8b5cf6', '#5b21b6'], { small: true, badge: T.ad }); }
    else btn('again', px, y, pw * 0.72, 68 * k, T.again, ['#8dff6a', '#22c55e', '#15803d'], { pulse: overT > 0.9, icon: 'play' });
    cx.restore();
  }

  // ================= Loop =================
  var last = performance.now();
  function loop(now) {
    if (paused) return; // fully halt until onResume
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); musicTick(); draw();
    requestAnimationFrame(loop);
  }

  // ================= Boot =================
  resize(); draw(); Platform.firstFrameReady();
  setAudio(Platform.isAudioEnabled());
  var fontP = (window.FontFace && document.fonts) ? new FontFace('Fredoka', 'url(fredoka-bold.woff)', { weight: '700' }).load().then(function (f) { document.fonts.add(f); }).catch(function () {}) : Promise.resolve();
  Promise.all([
    fontP,
    Platform.getLanguage().then(function (l) { T = (String(l || 'en').toLowerCase().indexOf('es') === 0) ? STR.es : STR.en; document.documentElement.lang = T === STR.es ? 'es' : 'en'; }),
    Platform.loadData().then(function (s) { if (s) parseSave(s); }).catch(function () {})
  ]).then(function () {
    loaded = true; ensureDaily(); save.stats.sessions++;
    previewSkin = Math.max(0, SKINS.findIndex(function (s) { return s.id === save.skin; }));
    stack = []; for (var i = 0; i < 6; i++) stack.push({ x: i ? (i % 2 ? 5 : -5) : 0, w: BASEW - i * 8, pop: 0 });
    state = 'menu'; Z = WIDE ? 1.15 : 1.3; anchorY = WIDE ? CH * 0.66 : CH * 0.5; camY = ((WIDE ? CH * 0.86 : CH * 0.64) - anchorY) / (S * Z); camX = WIDE ? CW * 0.74 : CW / 2;
    M.x = 0; M.y = stack.length * BH;
    last = performance.now(); draw();
    Platform.gameReady(); Analytics.track('session_start', { sessions: save.stats.sessions, best: save.best });
    requestAnimationFrame(loop);
  });

  // QA / art hook
  window.__skystack = { get state() { return state; }, get score() { return score; }, get save() { return JSON.parse(JSON.stringify(save)); }, get paused() { return paused; }, get audioOn() { return audioOn; },
    get lang() { return T === STR.es ? 'es' : 'en'; }, get cur() { return cur; }, get top() { return stack && stack[stack.length - 1]; }, get buttons() { return buttons.slice(); }, get events() { return Analytics.events.slice(); },
    art: { drawBlock: drawBlock, drawMascot: drawMascot, drawSky: drawSky, drawHills: drawHills, skinCols: skinCols, star: star } };
})();
