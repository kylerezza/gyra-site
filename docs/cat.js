// gyra.io — the deadliest cat, framed as a film.
// A procedural black-footed cat lives in the hero. Her first prey is the dot on the "i" in the headline.
// Below the fold: a pose plate drawn by the same engine, a trotting silhouette, eyes in the footer at night.
// No libraries, no tracking, no storage, no network.
(() => {
  "use strict";
  const $ = (q) => document.querySelector(q);
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let reduce = mqReduce.matches, dark = mqDark.matches;
  document.documentElement.classList.add("js");
  const keep = [], themeHooks = [], reduceHooks = [];

  console.log("%cgyra%c\nApps with a killer instinct. hello@gyra.io", "font: 500 22px ui-serif, Georgia, serif", "font: 12px system-ui");

  // ---------------------------------------------------------------- helpers
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return "rgb(" + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(",") + ")"; };
  const clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const hour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

  // ---------------------------------------------------------------- sky and moon
  const SKY = [
    [0, "#e9e2df", "#f3ece4", "#c98a6b"], [5, "#efdcd6", "#f6e8de", "#e09a86"], [7.5, "#f3dfd2", "#f7eee4", "#eca883"],
    [10, "#eeede6", "#f7f3ea", "#f2d6a2"], [15, "#f0e9dd", "#f7f1e6", "#efc98d"], [18, "#f4dcb8", "#f7ecdc", "#e2843a"],
    [20.5, "#ead6cf", "#f3e7dc", "#cf7b62"], [24, "#e9e2df", "#f3ece4", "#c98a6b"],
  ];
  function skyAt(h) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [h0, t0, b0, g0] = SKY[i], [h1, t1, b1, g1] = SKY[i + 1];
      if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return [mix(t0, t1, t), mix(b0, b1, t), mix(g0, g1, t)]; }
    }
    return [SKY[0][1], SKY[0][2], SKY[0][3]];
  }
  const partOfDay = (h) => h < 5 ? "night" : h < 8 ? "dawn" : h < 11 ? "morning" : h < 15 ? "midday" : h < 17.5 ? "afternoon" : h < 20 ? "golden hour" : h < 22 ? "dusk" : "night";
  function moon() {
    const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
    const p = (((days % 29.530588) + 29.530588) % 29.530588) / 29.530588;
    const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
    const name = p < 0.03 || p > 0.97 ? "new moon" : p < 0.22 ? "waxing crescent" : p < 0.28 ? "first quarter" : p < 0.47 ? "waxing gibbous"
      : p < 0.53 ? "full moon" : p < 0.72 ? "waning gibbous" : p < 0.78 ? "last quarter" : "waning crescent";
    return { p, lit, name };
  }
  const C = () => dark
    ? { ground: "#141720", grass: "#2f3442", mound: "#1f222b", far: "#191c26", coat: "#b99a6c", spot: "#17110c", sole: "#0a0806", eye: "#e8b04b", glow: "rgba(232,176,75,0.55)", fly: [243, 227, 168], bone: "#e2a948", hair: "#252935", ink: "#ece6da" }
    : { ground: "#ebe3d5", grass: "#b9ab94", mound: "#d4c3a5", far: "#dacdb7", coat: "#c8a574", spot: "#2a1f17", sole: "#15100c", eye: "#d9822b", glow: "rgba(217,130,43,0.35)", fly: [181, 96, 30], bone: "#a3561a", hair: "#d9d0c3", ink: "#16130f" };
  let col = C();

  // ---------------------------------------------------------------- poses (local units, facing right, floor y=0, up negative)
  const POSES = {
    stand:  { hx: -34, hy: -46, sx: 28, sy: -48, kx: 50, ky: -66, ka: 0,    t: 14, ears: 0, t0: -2.25, k: 0.13, fn: [32, 0], ff: [24, 0], hn: [-30, 0], hf: [-38, 0] },
    sit:    { hx: -22, hy: -16, sx: 18, sy: -50, kx: 28, ky: -78, ka: -0.05, t: 14, ears: 0, t0: 2.75, k: -0.33, fn: [24, 0], ff: [17, 0], hn: [-4, 0], hf: [-12, 0] },
    stalk:  { hx: -36, hy: -40, sx: 26, sy: -33, kx: 49, ky: -40, ka: 0.08, t: 13, ears: 1, t0: -2.95, k: 0.02, fn: [40, 0], ff: [30, 0], hn: [-30, 0], hf: [-40, 0] },
    crouch: { hx: -32, hy: -28, sx: 26, sy: -22, kx: 46, ky: -26, ka: 0.1,  t: 14, ears: 1, t0: -3.0, k: 0.0, fn: [34, 0], ff: [28, 0], hn: [-22, 0], hf: [-28, 0] },
    leap:   { hx: -40, hy: -44, sx: 34, sy: -52, kx: 58, ky: -60, ka: -0.1, t: 13, ears: 0.6, t0: -2.7, k: 0.04, fn: [70, -38], ff: [64, -30], hn: [-74, -26], hf: [-68, -20] },
    rise:   { hx: -26, hy: -40, sx: 22, sy: -74, kx: 34, ky: -98, ka: -0.55, t: 13, ears: 0.4, t0: 2.4, k: 0.06, fn: [40, -112], ff: [30, -106], hn: [-40, -6], hf: [-34, 0] },
    loaf:   { hx: -22, hy: -15, sx: 14, sy: -15, kx: 24, ky: -16, ka: 0.35, t: 16, ears: 0.2, t0: 2.95, k: -0.5, fn: [14, -4], ff: [10, -4], hn: [-16, -4], hf: [-20, -4] },
    stretch:{ hx: -30, hy: -54, sx: 30, sy: -24, kx: 50, ky: -28, ka: -0.15, t: 13, ears: 0, t0: -1.9, k: 0.08, fn: [64, 0], ff: [56, 0], hn: [-30, 0], hf: [-36, 0] },
  };
  const KEYS = ["hx", "hy", "sx", "sy", "kx", "ky", "ka", "t", "ears", "t0", "k"];
  const clone = (p) => ({ ...p, fn: [...p.fn], ff: [...p.ff], hn: [...p.hn], hf: [...p.hf] });
  function blend(cur, tgt, a) {
    for (const k of KEYS) cur[k] = lerp(cur[k], tgt[k], a);
    for (const f of ["fn", "ff", "hn", "hf"]) { cur[f][0] = lerp(cur[f][0], tgt[f][0], a); cur[f][1] = lerp(cur[f][1], tgt[f][1], a); }
  }
  function knee(jx, jy, fx, fy, l1, l2, bend) {
    let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) { fx = jx + (dx / d) * max; fy = jy + (dy / d) * max; d = max; }
    const a = Math.atan2(fy - jy, fx - jx);
    const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1));
    return [jx + Math.cos(a + bend * b) * l1, jy + Math.sin(a + bend * b) * l1, fx, fy];
  }
  const LEGS = (p) => [["hf", p.hx + 3, p.hy + 4, 22, 25, 9], ["ff", p.sx, p.sy + 7, 20, 24, 7], ["hn", p.hx + 3, p.hy + 4, 22, 25, 9], ["fn", p.sx, p.sy + 7, 20, 24, 7]];
  const legIK = (p, L) => { const [name, jx, jy, l1, l2] = L, f = p[name]; return knee(jx, jy, f[0], f[1], l1, l2, name[0] === "h" ? -1 : 1); };

  // ---------------------------------------------------------------- the cat, drawable anywhere
  const SPOTS = [
    [0.05, -0.55, 3.2], [0.22, -0.65, 2.8], [0.4, -0.6, 3], [0.58, -0.62, 2.6], [0.76, -0.55, 2.8], [0.92, -0.4, 2.4],
    [0.12, 0.05, 3.6], [0.32, 0.0, 3.2], [0.52, 0.05, 3.4], [0.72, 0.0, 3], [0.88, 0.15, 2.8],
    [0.2, 0.55, 3], [0.45, 0.6, 2.8], [0.68, 0.55, 2.6], [-0.08, 0.2, 4], [-0.05, -0.3, 3.6],
  ];
  // o: { x, y, dir, turn, sc, eye, sleep, air, sway, flat } — flat draws a one-colour silhouette
  function drawCat(g, p, o) {
    g.save();
    g.translate(o.x, o.y);
    g.scale(o.dir * o.sc * (o.turn ?? 1), o.sc);
    g.lineCap = "round"; g.lineJoin = "round";
    const coat = o.flat || col.coat, spot = col.spot;
    const tail = []; let tx = p.hx - p.t * 0.85, ty = p.hy - p.t * 0.25, a = p.t0;
    tail.push([tx, ty]);
    for (let i = 0; i < 9; i++) { a += p.k + (o.sway || 0) * (i / 9); tx += Math.cos(a) * 10; ty += Math.sin(a) * 10; if (!o.air && ty > -2) ty = -2; tail.push([tx, ty]); }
    g.strokeStyle = coat;
    for (let i = 0; i < tail.length - 1; i++) { g.lineWidth = lerp(7.5, 4.2, i / tail.length); g.beginPath(); g.moveTo(...tail[i]); g.lineTo(...tail[i + 1]); g.stroke(); }
    const drawn = LEGS(p).map((L) => {
      const [kx, ky, fx, fy] = legIK(p, L), [, jx, jy, , , w] = L;
      g.lineWidth = w; g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx, ky); g.stroke();
      g.lineWidth = w * 0.72; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      return [jx, jy, kx, ky, fx, fy, w];
    });
    g.fillStyle = coat;
    g.beginPath(); g.arc(p.hx, p.hy, p.t * 1.06, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(p.sx, p.sy, p.t * 0.92, 0, 6.2832); g.fill();
    const mx = (p.hx + p.sx) / 2, my = (p.hy + p.sy) / 2;
    g.beginPath(); g.moveTo(p.hx, p.hy - p.t); g.quadraticCurveTo(mx, my - p.t * 0.82, p.sx, p.sy - p.t * 0.9);
    g.lineTo(p.sx, p.sy + p.t * 0.9); g.quadraticCurveTo(mx, my + p.t, p.hx, p.hy + p.t); g.closePath(); g.fill();
    g.lineWidth = p.t * 1.15; g.beginPath(); g.moveTo(p.sx + 2, p.sy - 4); g.lineTo(p.kx - 4, p.ky + 4); g.stroke();
    g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka);
    g.beginPath(); g.arc(0, 0, 12.5, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(9.5, 4, 7, 5.6, 0, 0, 6.2832); g.fill();
    const ear = (a1, b1, a2, b2, c1, c2) => { g.beginPath(); g.moveTo(a1, b1); g.lineTo(c1, c2); g.lineTo(a2, b2); g.closePath(); g.fill(); };
    const fl = p.ears * 9; ear(-9, -6, 1, -12, -8 - fl * 0.6, -25 + fl); ear(2, -12, 10, -6, 7 - fl * 0.4, -24 + fl);
    g.restore();
    if (!o.flat) {
      g.globalCompositeOperation = "source-atop"; g.fillStyle = spot;
      for (const [u, v, r] of SPOTS) { const x = lerp(p.hx, p.sx, u), y = lerp(p.hy, p.sy, u) + v * p.t; g.beginPath(); g.ellipse(x, y, r * 0.95, r * 0.62, 0.3, 0, 6.2832); g.fill(); }
      g.strokeStyle = spot;
      for (const [jx, jy, kx, ky, fx, fy, w] of drawn) {
        for (const tp of [0.35, 0.7]) { const x = lerp(jx, kx, tp), y = lerp(jy, ky, tp), an = Math.atan2(ky - jy, kx - jx) + Math.PI / 2; g.lineWidth = 1.7; g.beginPath(); g.moveTo(x - Math.cos(an) * w, y - Math.sin(an) * w); g.lineTo(x + Math.cos(an) * w, y + Math.sin(an) * w); g.stroke(); }
        g.fillStyle = col.sole; g.beginPath(); g.arc(fx, fy - 1, w * 0.48, 0, 6.2832); g.fill(); g.fillStyle = spot;
      }
      for (const i of [3, 5, 7]) { const [x, y] = tail[i]; g.beginPath(); g.arc(x, y, 3.6, 0, 6.2832); g.fill(); }
      const [ex, ey] = tail[tail.length - 1]; g.fillStyle = col.sole; g.beginPath(); g.arc(ex, ey, 3.4, 0, 6.2832); g.fill();
      g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka); g.strokeStyle = spot; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-2, 3); g.lineTo(-9, 1); g.moveTo(-1, 7); g.lineTo(-8, 7); g.stroke();
      g.globalCompositeOperation = "source-over";
      if (!o.sleep) {
        if (dark) { g.fillStyle = col.glow; g.beginPath(); g.arc(5.5, -2.5, 4.5, 0, 6.2832); g.fill(); }
        g.fillStyle = col.eye; g.beginPath(); g.ellipse(5.5, -2.5, 3.6, Math.max(0.4, 2.2 * (o.eye ?? 1)), -0.15, 0, 6.2832); g.fill();
      } else { g.strokeStyle = col.spot; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2.5, -2); g.quadraticCurveTo(5.5, 0, 8.5, -2); g.stroke(); }
      g.restore();
    }
    g.restore();
  }

  // the skeleton, for the pose plate
  function drawBones(g, p, o) {
    g.save(); g.translate(o.x, o.y); g.scale(o.sc, o.sc);
    g.strokeStyle = col.bone; g.fillStyle = col.bone; g.lineWidth = 1.2 / o.sc; g.lineCap = "round";
    const dotAt = (x, y) => { g.beginPath(); g.arc(x, y, 2 / o.sc + 0.8, 0, 6.2832); g.fill(); };
    g.beginPath(); g.moveTo(p.hx, p.hy); g.quadraticCurveTo((p.hx + p.sx) / 2, (p.hy + p.sy) / 2 - 6, p.sx, p.sy); g.lineTo(p.kx, p.ky); g.stroke();
    for (const L of LEGS(p)) { const [kx, ky, fx, fy] = legIK(p, L), [, jx, jy] = L; g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke(); dotAt(kx, ky); dotAt(fx, fy); }
    for (const [x, y] of [[p.hx, p.hy], [p.sx, p.sy], [p.kx, p.ky]]) dotAt(x, y);
    g.restore();
  }

  // a soft firefly glow, pre-rendered once per theme
  let glowSprite = null;
  function makeGlow() {
    const c = document.createElement("canvas"), n = 64; c.width = c.height = n;
    const g = c.getContext("2d"), [r, gg, b] = col.fly;
    const rg = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    rg.addColorStop(0, `rgba(${r},${gg},${b},0.55)`); rg.addColorStop(0.18, `rgba(${r},${gg},${b},0.35)`); rg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = rg; g.fillRect(0, 0, n, n);
    g.fillStyle = dark ? "rgba(255,244,210,1)" : "rgba(150,74,18,1)"; g.beginPath(); g.arc(n / 2, n / 2, 3.2, 0, 6.2832); g.fill();
    glowSprite = c;
  }
  const glow = (g, x, y, size, a) => { g.globalAlpha = clamp(a, 0, 1); g.drawImage(glowSprite, x - size / 2, y - size / 2, size, size); g.globalAlpha = 1; };
  makeGlow();

  // ================================================================= HERO
  const stage = $("[data-stage]");
  if (stage) hero(stage);

  function hero(stage) {
    const cv = stage.querySelector("canvas"), ctx = cv.getContext("2d");
    const bg = document.createElement("canvas"), bctx = bg.getContext("2d");
    const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
    const preyEl = $("[data-prey]"), capEl = $("[data-caption]"), pauseEl = $("[data-pause]");
    const copyEls = [...document.querySelectorAll(".sky-copy h1, .sky-copy .lede, .sky-copy .def, .sky-copy .links")];
    let W = 0, H = 0, dpr = 1, floor = 0, s = 1, mound = {}, sun = { x: 0 }, stars = [], shooting = null, copyRects = [], paused = false;
    const flies = [];
    const cat = { x: 0, y: 0, vx: 0, vy: 0, dir: 1, turn: 1, state: "wait", t0: now(), pose: clone(POSES.stand), phase: 0, eye: 1, blinkAt: now() + 3, slowBlink: 0, air: false };
    const pointer = { x: 0, y: 0, on: false, gx: 0, gy: 0, ga: 0, restSince: 0 };
    const dot = { x: 0, y: 0, r: 4, alive: !!preyEl && !reduce, back: 0, a: 0 };
    let tries = 0, caught = 0, lastInput = now(), restUntil = now() + 20, target = null, captionTimer = 0, tg = null;

    function newFly() { return { x: W * (0.15 + Math.random() * 0.7), y: floor - (14 + Math.random() * 80) * s, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.5, alive: true, back: 0, dart: 0 }; }

    function layout() {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || (w === W && h === H)) return;
      const first = !W; W = w; H = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2); if (W * H * dpr * dpr > 2.6e6) dpr = 1.5;
      floor = H - Math.max(52, H * 0.14);
      s = clamp(W * 0.0012, 0.86, 1.5);
      for (const c of [cv, bg, layer]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      mound = { x: W * (W < 700 ? 0.86 : 0.85), w: clamp(W * 0.12, 86, 180), h: clamp(H * 0.19, 78, 145) };
      stars = Array.from({ length: W < 700 ? 70 : 120 }, (_, i) => ({ x: ((i * 131) % 997) / 997 * W, y: Math.pow(((i * 71) % 467) / 467, 1.4) * floor * 0.85, r: [0.6, 0.9, 1.4][i % 3] }));
      if (first) { cat.x = -100 * s; for (let i = 0; i < 3; i++) flies.push(newFly()); }
      measure(); paintBackdrop(); kick();
    }
    function measure() {
      const c = cv.getBoundingClientRect();
      copyRects = copyEls.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left - c.left - 12, t: r.top - c.top - 12, r: r.right - c.left + 12, b: r.bottom - c.top + 12 }; });
      if (preyEl) { const r = preyEl.getBoundingClientRect(); dot.x = r.left - c.left + r.width * 0.56; dot.y = r.top - c.top + r.height * 0.27; dot.r = clamp(r.height * 0.06, 3, 7); }
    }
    const overCopy = (x, y) => copyRects.some((r) => x > r.l && x < r.r && y > r.t && y < r.b);

    function paintBackdrop() {
      const g = bctx, h = hour();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dark) {
        const sky = g.createLinearGradient(0, 0, 0, floor); sky.addColorStop(0, "#0a0c12"); sky.addColorStop(1, "#151824");
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        for (const st of stars) { g.globalAlpha = 0.3 + (st.r / 1.4) * 0.5; g.fillStyle = "#f3e9c8"; g.beginPath(); g.arc(st.x, st.y, st.r, 0, 6.2832); g.fill(); }
        g.globalAlpha = 1;
        drawMoon(g, W * 0.8, floor * 0.24, clamp(W * 0.02, 15, 28));
      } else {
        const [top, bot, gl] = skyAt(h);
        const sky = g.createLinearGradient(0, 0, 0, floor); sky.addColorStop(0, top); sky.addColorStop(1, bot);
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        const dayT = (h - 6) / 13, up = dayT > -0.05 && dayT < 1.05;
        sun.x = W * clamp(0.08 + 0.84 * dayT, 0.04, 0.96);
        const sy = floor - Math.sin(clamp(dayT, 0, 1) * Math.PI) * floor * 0.7 + (up ? 0 : 30);
        const [r, gg, b] = gl.match(/\d+/g).map(Number);
        const rg = g.createRadialGradient(sun.x, sy, 4, sun.x, sy, Math.max(W, H) * 0.55);
        rg.addColorStop(0, `rgba(${r},${gg},${b},0.32)`); rg.addColorStop(0.35, `rgba(${r},${gg},${b},0.1)`); rg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, W, H);
        if (up) { const sr = clamp(W * 0.026, 16, 32), core = g.createRadialGradient(sun.x, sy, 0, sun.x, sy, sr); core.addColorStop(0, "rgba(255,246,226,1)"); core.addColorStop(0.7, `rgba(${r},${gg},${b},0.85)`); core.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = core; g.beginPath(); g.arc(sun.x, sy, sr, 0, 6.2832); g.fill(); }
      }
      g.fillStyle = col.far; g.beginPath(); g.moveTo(0, floor);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, floor - 16 * s - Math.sin(x / 210) * 9 * s - Math.sin(x / 67) * 3 * s);
      g.lineTo(W, floor); g.fill();
      acacia(g, W * 0.6, floor - 8 * s, 1.0 * s); acacia(g, W * 0.27, floor - 13 * s, 0.55 * s);
      g.fillStyle = col.ground; g.fillRect(0, floor, W, H - floor);
      const m = mound; g.fillStyle = col.mound;
      g.beginPath(); g.moveTo(m.x - m.w / 2, floor + 2);
      g.bezierCurveTo(m.x - m.w * 0.36, floor - m.h * 0.62, m.x - m.w * 0.2, floor - m.h * 1.02, m.x - m.w * 0.04, floor - m.h);
      g.bezierCurveTo(m.x + m.w * 0.06, floor - m.h * 1.22, m.x + m.w * 0.16, floor - m.h * 0.9, m.x + m.w * 0.22, floor - m.h * 0.7);
      g.bezierCurveTo(m.x + m.w * 0.34, floor - m.h * 0.45, m.x + m.w * 0.42, floor - m.h * 0.2, m.x + m.w / 2, floor + 2);
      g.closePath(); g.fill();
      g.strokeStyle = col.grass; g.lineWidth = 1.1;
      for (let x = 0; x < W; x += 9) { const hh = (5 + ((x * 13) % 9)) * s; g.beginPath(); g.moveTo(x, floor + 1); g.quadraticCurveTo(x + 1, floor - hh * 0.6, x + ((x % 5) - 2) * 1.5, floor - hh); g.stroke(); }
    }
    function acacia(g, x, y, k) {
      g.save(); g.translate(x, y); g.scale(k, k); g.strokeStyle = col.far; g.fillStyle = col.far; g.lineCap = "round";
      g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, -26, -6, -50); g.stroke();
      g.lineWidth = 2.6; for (const [a, b, c, d] of [[-2, -30, -30, -58], [-1, -34, 26, -60], [-5, -46, -8, -62], [-3, -40, 12, -64]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
      for (const [cx, cy, rx, ry] of [[-30, -64, 34, 8], [6, -68, 46, 9], [34, -63, 28, 7], [-8, -72, 30, 6]]) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); g.fill(); }
      g.restore();
    }
    function drawMoon(g, x, y, r) {
      const m = moon(), halo = g.createRadialGradient(x, y, r, x, y, r * 5);
      halo.addColorStop(0, "rgba(233,225,200,0.14)"); halo.addColorStop(1, "rgba(233,225,200,0)");
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 5, 0, 6.2832); g.fill();
      g.fillStyle = "#232634"; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      g.save(); g.translate(x, y); if (m.p > 0.5) g.scale(-1, 1);
      g.fillStyle = "#ece4c9"; g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      g.ellipse(0, 0, r * Math.abs(Math.cos(2 * Math.PI * m.p)), r, 0, Math.PI / 2, -Math.PI / 2, m.lit < 0.5); g.fill(); g.restore();
    }

    // ---------------------------------------------------------------- caption: one quiet timecode line
    const baseCaption = () => { const m = moon(); return (dark ? `${clock()} · ${m.name} · ${Math.round(m.lit * 100)}% lit` : `${clock()} · ${partOfDay(hour())}`) + " · 6 in 10"; };
    function caption(text, hold) {
      if (!capEl) return;
      capEl.textContent = text;
      clearTimeout(captionTimer); captionTimer = 0;
      if (hold) captionTimer = setTimeout(() => { captionTimer = 0; capEl.textContent = baseCaption(); }, hold);
    }

    // ---------------------------------------------------------------- behaviour
    const setState = (st) => { cat.state = st; cat.t0 = now(); };
    const inState = () => now() - cat.t0;
    const maxLeap = () => floor * 0.62;
    function face(x) { const d = x > cat.x ? 1 : -1; if (d !== cat.dir && !cat.air) { cat.dir = d; cat.turn = -1; } }
    const tx = (t) => t.kind === "fly" ? t.ref.x : t.x;
    const ty = (t) => t.kind === "fly" ? t.ref.y : t.kind === "call" ? floor : t.y;

    function pickTarget(t) {
      if (target && target.kind === "fly" && target.ref.alive && !target.ref.dart) return target;
      if (target && target.kind === "call") return target;
      if (dot.alive && cat.state !== "enter" && cat.state !== "wait") return { kind: "dot", x: dot.x, y: dot.y };
      // the pointer's firefly: only once it has rested low in the scene, never while you are reading
      if (fine && pointer.on && pointer.ga > 0.5 && pointer.gy > H * 0.55 && t - pointer.restSince > 1.5 && floor - pointer.gy < maxLeap()) return { kind: "cursor", x: pointer.gx, y: pointer.gy };
      if (t > restUntil && t - lastInput < 45) {
        let best = null, bd = 1e9;
        for (const f of flies) if (f.alive && !f.dart) { const d = Math.abs(f.x - cat.x); if (d < bd) { bd = d; best = f; } }
        if (best) return { kind: "fly", ref: best };
      }
      return null;
    }
    function startPounce(t) {
      tries++;
      const g = 2400 * s, h = Math.max(70 * s, floor - (t.y + 62 * s));
      const vy = -Math.sqrt(2 * g * h), tA = -vy / g;
      let vx = (t.x - cat.x) / tA;
      const land = cat.x + vx * 2 * tA;
      if (land < 30 || land > W - 30) vx = (clamp(land, 30, W - 30) - cat.x) / (2 * tA);
      cat.vx = clamp(vx, -1100 * s, 1100 * s); cat.vy = vy; cat.air = true; cat.resolved = false;
      cat.hit = t.kind === "dot" ? true : Math.random() < 0.66;
      cat.prey = t; cat.leap = Math.hypot(cat.vx * 2 * tA, h) / (200 * s); cat.high = h > 140 * s;
      setState("pounce");
    }
    function resolve() {
      cat.resolved = true;
      const t = cat.prey, hit = cat.hit;
      if (hit) caught++;
      if (t.kind === "dot") { dot.alive = false; dot.back = now() + 1.2; caption("Rarely misses.", 4000); return; }
      if (t.kind === "fly") { if (hit) { t.ref.alive = false; t.ref.back = now() + 8; } else t.ref.dart = 1; }
      if (t.kind === "cursor") { pointer.ga = 0; pointer.restSince = now() + 2; }
      caption(`Attempt ${String(tries).padStart(3, "0")} · ${hit ? "landed" : "escaped"} · ${cat.leap.toFixed(1)} m`, 4000);
    }

    function think(dt) {
      const t = now(), st = cat.state, idle = t - lastInput;
      if (t > cat.blinkAt) { cat.eye = 0; if (t > cat.blinkAt + 0.12) { cat.eye = 1; cat.blinkAt = t + 2.5 + Math.random() * 4; } }
      if (cat.slowBlink > 0) { cat.slowBlink -= dt; cat.eye = cat.slowBlink > 0.5 ? clamp((cat.slowBlink - 0.5) / 0.5, 0.05, 1) : clamp(1 - cat.slowBlink / 0.5, 0.05, 1); }
      tg = (st === "sit" || st === "walk" || st === "stalk" || st === "crouch") ? pickTarget(t) : null;
      switch (st) {
        case "wait": if (inState() > 1.2) setState("enter"); break; // let the headline settle first
        case "enter": {
          const goal = dot.alive ? clamp(dot.x - 260 * s, W * 0.1, W * 0.6) : W * 0.3;
          walkTo(goal, dt, 1);
          if (Math.abs(cat.x - goal) < 4) setState("sit");
          break;
        }
        case "sit": if (tg) { face(tx(tg)); setState(Math.abs(tx(tg) - cat.x) > 320 * s ? "walk" : "stalk"); } else if (idle > 45) setState("tomound"); break;
        case "walk": {
          if (!tg) { setState("sit"); break; }
          const goal = tx(tg) - Math.sign(tx(tg) - cat.x) * 200 * s;
          walkTo(goal, dt, tg.kind === "call" ? 2 : 1);
          if (Math.abs(cat.x - goal) < 6) { if (tg.kind === "call") { target = null; setState("sit"); cat.slowBlink = 1; } else setState("stalk"); }
          break;
        }
        case "stalk": {
          if (!tg) { setState("sit"); break; }
          if (tg.kind === "call") { setState("walk"); break; }
          face(tx(tg));
          const d = Math.abs(tx(tg) - cat.x), near = (floor - ty(tg) > 140 * s ? 70 : 150) * s;
          if (d > near + 20 * s) walkTo(tx(tg) - Math.sign(tx(tg) - cat.x) * near, dt, d > 260 * s ? 0.9 : 0.45);
          else if (inState() > 0.6) setState("crouch");
          break;
        }
        case "crouch": {
          if (!tg) { setState("sit"); break; }
          face(tx(tg));
          if (inState() > 0.4) { startPounce({ kind: tg.kind, ref: tg.ref, x: tx(tg), y: ty(tg) }); target = null; }
          break;
        }
        case "pounce": {
          cat.vy += 2400 * s * dt; cat.x += cat.vx * dt; cat.y += cat.vy * dt;
          if (!cat.resolved && cat.vy >= 0) resolve();
          if (cat.y >= 0 && cat.vy > 0) { cat.y = 0; cat.vy = 0; cat.vx = 0; cat.air = false; setState("land"); restUntil = t + 20 + Math.random() * 10; }
          break;
        }
        case "land": if (inState() > 0.35) { setState("sit"); if (caught === 1 && tries === 1) cat.slowBlink = 1; } break;
        case "tomound": { const goal = mound.x - mound.w * 0.06; walkTo(goal, dt, 0.8); if (Math.abs(cat.x - goal) < 4) setState("circle"); break; }
        case "circle": { const p = inState() / 1.8; cat.turn = Math.cos(p * Math.PI * 4); if (p >= 1) { cat.turn = 1; setState("sleep"); } break; }
        case "stretch": if (inState() > 0.7) setState("sit"); break;
      }
      if (cat.state !== "circle") cat.turn = Math.min(1, cat.turn + dt * 7);
      for (const f of flies) {
        if (!f.alive) { if (f.back && t > f.back) Object.assign(f, newFly()); continue; }
        if (f.dart) { f.y -= 200 * dt; f.x += 80 * dt * (f.ph > 3 ? 1 : -1); if (f.y < -20) { f.alive = false; f.back = t + 6; f.dart = 0; } continue; }
        f.ph += dt * f.sp; f.x += Math.cos(f.ph * 1.3) * 16 * dt * s; f.y += Math.sin(f.ph * 2.1) * 10 * dt * s;
        f.x = clamp(f.x, 20, W - 20); f.y = clamp(f.y, floor - (f.tap ? maxLeap() : 110 * s), floor - 10);
      }
      // the dot comes back after the catch, so the word never reads as a typo
      if (dot.back && t > dot.back) { dot.a = Math.min(1, dot.a + dt / 0.3); if (dot.a >= 1) { dot.back = 0; if (preyEl) preyEl.textContent = "i"; } }
      // the pointer's firefly follows on a soft spring and hides over the words
      if (fine) {
        const k = 1 - Math.exp(-dt * 14);
        pointer.gx = lerp(pointer.gx, pointer.x, k); pointer.gy = lerp(pointer.gy, pointer.y, k);
        const want = pointer.on && !overCopy(pointer.x, pointer.y) ? 1 : 0;
        pointer.ga = clamp(pointer.ga + (want - pointer.ga) * Math.min(1, dt / 0.12), 0, 1);
      }
    }
    function walkTo(goal, dt, speed) {
      const d = goal - cat.x;
      if (Math.abs(d) < 2) { cat.vx = 0; return; }
      face(goal);
      const vmax = 150 * s * speed, want = clamp(d * 4, -vmax, vmax);
      cat.vx += clamp(want - cat.vx, -700 * s * dt, 700 * s * dt);
      cat.x += cat.vx * dt; cat.phase += (Math.abs(cat.vx) * dt) / (54 * s);
    }
    function targetPose() {
      const st = cat.state, moving = Math.abs(cat.vx) > 8;
      const base = st === "sit" ? POSES.sit : st === "stalk" ? POSES.stalk : st === "crouch" || st === "land" ? POSES.crouch
        : st === "pounce" ? (cat.high ? POSES.rise : POSES.leap) : st === "sleep" ? POSES.loaf : st === "stretch" ? POSES.stretch : POSES.stand;
      const p = clone(base);
      if ((moving && st !== "pounce") || st === "circle") {
        const stride = st === "stalk" ? 26 : 34, offs = { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 }, ph = st === "circle" ? inState() * 2.2 : cat.phase;
        for (const leg of ["fn", "ff", "hn", "hf"]) {
          const q = (ph + offs[leg]) % 1, jx = leg[0] === "f" ? p.sx : p.hx;
          if (q < 0.62) { p[leg][0] = jx + 6 + stride * (0.5 - q / 0.62); p[leg][1] = 0; } else { const u = (q - 0.62) / 0.38; p[leg][0] = jx + 6 + stride * (-0.5 + u); p[leg][1] = -Math.sin(u * Math.PI) * 9; }
        }
        const bob = Math.sin(ph * Math.PI * 4) * 1.6; p.hy += bob; p.sy += bob; p.ky += bob;
      }
      if (tg && (st === "sit" || st === "stalk" || st === "crouch")) p.ka += clamp((ty(tg) - (floor + p.ky * s)) / (s * 160), -0.7, 0.4);
      if (st === "sleep") { const b = Math.sin(now() * 1.6) * 0.6; p.t += b * 0.6; p.hy -= b * 0.4; p.sy -= b * 0.4; }
      return p;
    }

    function render(t) {
      const g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dark && shooting) { const u = (t - shooting.t) / 0.9; if (u >= 0 && u <= 1) { const x = lerp(shooting.x, shooting.x - 260, u), y = lerp(shooting.y, shooting.y + 110, u), gr = g.createLinearGradient(x, y, x + 90, y - 38); gr.addColorStop(0, "rgba(255,248,225,0.85)"); gr.addColorStop(1, "rgba(255,248,225,0)"); g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 38); g.stroke(); } }
      const sh = clamp(1 + cat.y / (110 * s), 0.25, 1), lean = dark ? 0 : clamp((cat.x - sun.x) / W, -0.5, 0.5) * 46 * s;
      g.fillStyle = `rgba(20,12,6,${(dark ? 0.35 : 0.14) * sh})`; g.beginPath(); g.ellipse(cat.x + lean, floor + 4, (50 + Math.abs(lean) * 0.6) * s * sh, 5 * s * sh, 0, 0, 6.2832); g.fill();
      if (dot.alive) glow(g, dot.x, dot.y, dot.r * 9, 0.85 + 0.15 * Math.sin(t * 2.1));
      else if (dot.back) glow(g, dot.x, dot.y, dot.r * 9, dot.a);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H);
      const sway = cat.state === "crouch" ? Math.sin(t * 16) * 0.12 : cat.state === "stalk" ? Math.sin(t * 9) * 0.07 : Math.sin(t * 3.4) * 0.05;
      drawCat(lctx, cat.pose, { x: cat.x, y: floor + cat.y, dir: cat.dir, turn: cat.turn, sc: s, eye: cat.eye * (cat.state === "crouch" ? 0.7 : 1), sleep: cat.state === "sleep", air: cat.air, sway });
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const f of flies) if (f.alive) glow(g, f.x, f.y, 22 * s, 0.55 + 0.45 * Math.sin(t * 3.2 + f.ph * 3));
      if (fine && pointer.ga > 0.02) glow(g, pointer.gx + 10, pointer.gy + 12, 26, pointer.ga * (0.75 + 0.25 * Math.sin(t * 6)));
    }

    // ---------------------------------------------------------------- input
    function wake() { lastInput = now(); if (cat.state === "sleep" || cat.state === "circle" || cat.state === "tomound") setState("stretch"); }
    const point = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom }; };
    if (fine) {
      window.addEventListener("pointermove", (e) => {
        const p = point(e); pointer.on = p.inside; if (!p.inside) return;
        if (Math.hypot(p.x - pointer.x, p.y - pointer.y) > 4) pointer.restSince = now();
        pointer.x = p.x; pointer.y = p.y;
        if (Math.abs(p.x - cat.x) < 240 * s) wake();
        lastInput = now(); kick();
      }, { passive: true });
      document.addEventListener("mouseleave", () => { pointer.on = false; });
    }
    cv.addEventListener("click", (e) => {
      const p = point(e); wake();
      const f = newFly(); f.x = clamp(p.x, 24, W - 24); f.y = clamp(p.y, floor - maxLeap(), floor - 12); f.tap = true;
      flies.push(f); if (flies.length > 6) flies.splice(0, flies.length - 6);
      target = { kind: "fly", ref: f }; kick();
    });
    let typed = "";
    window.addEventListener("keydown", (e) => {
      if (e.key.length !== 1 || /input|textarea|select/i.test(e.target.tagName)) return;
      typed = (typed + e.key.toLowerCase()).slice(-6);
      if (typed === "pspsps") { wake(); target = { kind: "call", x: W / 2 }; caption("She heard that. She’ll allow it.", 4000); kick(); }
    });
    if (pauseEl) pauseEl.addEventListener("click", () => {
      paused = !paused; pauseEl.textContent = paused ? "Play" : "Pause"; pauseEl.setAttribute("aria-pressed", paused ? "true" : "false");
      last = now(); kick();
    });

    // ---------------------------------------------------------------- loop: 60fps while she moves, 30 while she watches, 15 asleep
    let raf = 0, last = now(), visible = true, skip = 0;
    function kick() { if (!raf && visible && !reduce && !paused) raf = requestAnimationFrame(frame); }
    function frame() {
      raf = 0;
      const t = now(), busy = cat.state === "pounce" || cat.state === "enter" || cat.state === "circle" || Math.abs(cat.vx) > 8 || (fine && pointer.on);
      const every = cat.state === "sleep" && !pointer.on ? 4 : busy ? 1 : 2;
      if ((skip++ % every) !== 0) { kick(); return; }
      const dt = Math.min(0.05, t - last); last = t;
      think(dt);
      blend(cat.pose, targetPose(), cat.state === "pounce" ? 1 - Math.exp(-dt * 16) : 1 - Math.exp(-dt * 11));
      render(t); kick();
    }
    function still() {
      layout(); paintBackdrop();
      cat.x = mound.x - mound.w * 0.06; cat.y = 0; cat.dir = -1; cat.state = "sleep"; cat.pose = clone(POSES.loaf);
      render(now());
    }

    if (preyEl && !reduce) preyEl.textContent = "ı";
    layout();
    caption(baseCaption());
    if ("ResizeObserver" in window) new ResizeObserver(() => { layout(); if (reduce) still(); }).observe(cv);
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; last = now(); kick(); });
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting) && !document.hidden; last = now(); kick(); }); io.observe(cv); keep.push(io); }
    if (dark) shooting = { t: now() + 8, x: W * 0.62, y: floor * 0.12 };
    themeHooks.push(() => { paintBackdrop(); caption(baseCaption()); if (reduce) still(); });
    reduceHooks.push(() => { if (reduce) still(); else kick(); });
    setInterval(() => { if (!dark) paintBackdrop(); if (!captionTimer) caption(baseCaption()); }, 60000);
    if (reduce) still(); else kick();
  }

  // ================================================================= POSE PLATE (section 02)
  const plate = $("[data-plate]");
  function drawPlate() {
    if (!plate) return;
    plate.querySelectorAll("canvas[data-pose]").forEach((c) => {
      const w = c.clientWidth, h = c.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
      if (!w) return;
      c.width = Math.round(w * d); c.height = Math.round(h * d);
      const g = c.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
      const p = POSES[c.dataset.pose], sc = Math.min(w / 190, h / 150), fy = h * 0.82;
      g.strokeStyle = col.hair; g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy + 0.5); g.lineTo(w, fy + 0.5); g.stroke();
      drawCat(g, p, { x: w * 0.5, y: fy, dir: 1, sc, eye: 1, sleep: c.dataset.pose === "loaf", air: c.dataset.pose === "leap" || c.dataset.pose === "rise" });
      if (c.closest("figure").classList.contains("on")) drawBones(g, p, { x: w * 0.5, y: fy, sc });
    });
  }
  if (plate) {
    drawPlate();
    if ("ResizeObserver" in window) new ResizeObserver(drawPlate).observe(plate);
    plate.querySelectorAll("figure").forEach((f) => {
      const on = () => { f.classList.add("on"); drawPlate(); }, off = () => { f.classList.remove("on"); drawPlate(); };
      f.addEventListener("mouseenter", on); f.addEventListener("mouseleave", off);
      f.addEventListener("focus", on); f.addEventListener("blur", off);
      f.addEventListener("click", () => { f.classList.toggle("on"); drawPlate(); });
    });
    themeHooks.push(drawPlate);
  }

  // ================================================================= TROTTING SILHOUETTE (divider above the principles)
  const trot = $("[data-trot]");
  function makeTrot() {
    if (!trot) return;
    const fw = 120, fh = 80, frames = 6, d = 2, c = document.createElement("canvas");
    c.width = fw * frames * d; c.height = fh * d;
    const g = c.getContext("2d"); g.scale(d, d);
    for (let i = 0; i < frames; i++) {
      const p = clone(POSES.stand), ph = i / frames, offs = { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 };
      for (const leg of ["fn", "ff", "hn", "hf"]) {
        const q = (ph + offs[leg]) % 1, jx = leg[0] === "f" ? p.sx : p.hx;
        if (q < 0.55) { p[leg][0] = jx + 6 + 40 * (0.5 - q / 0.55); p[leg][1] = 0; } else { const u = (q - 0.55) / 0.45; p[leg][0] = jx + 6 + 40 * (-0.5 + u); p[leg][1] = -Math.sin(u * Math.PI) * 12; }
      }
      p.t0 = -2.6; p.k = 0.08;
      drawCat(g, p, { x: i * fw + fw * 0.55, y: fh - 4, dir: 1, sc: 0.62, flat: col.ink });
    }
    trot.style.setProperty("--sprite", `url(${c.toDataURL()})`);
  }
  if (trot) {
    makeTrot(); themeHooks.push(makeTrot);
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { trot.classList.add("go"); io.disconnect(); } }, { rootMargin: "0px 0px -35% 0px" });
      io.observe(trot); keep.push(io);
    }
  }

  // ================================================================= SCROLL REVEALS, FOOTER EYES, FILM GRAIN
  const reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el)); keep.push(io);
    const foot = $(".foot");
    if (foot) { const fo = new IntersectionObserver((es) => { foot.classList.toggle("seen", es[0].isIntersecting); }, { threshold: 0.35 }); fo.observe(foot); keep.push(fo); }
  } else reveals.forEach((el) => el.classList.add("in"));

  const grain = $("[data-grain]");
  if (grain) {
    const c = document.createElement("canvas"); c.width = c.height = 160;
    const g = c.getContext("2d"), img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  window.__gyra = keep;
  mqDark.addEventListener && mqDark.addEventListener("change", (e) => { dark = e.matches; col = C(); makeGlow(); themeHooks.forEach((f) => f()); });
  mqReduce.addEventListener && mqReduce.addEventListener("change", (e) => { reduce = e.matches; reduceHooks.forEach((f) => f()); });
})();
