// gyra.io — the deadliest cat. A procedural black-footed cat living in a full-screen savanna.
// Her first prey is the dot on the "i" in the headline. Then she hunts fireflies, your cursor, or your tap.
// Sky follows the visitor's local hour; nights show the real moon phase. No libraries, no tracking, no network.
(() => {
  "use strict";
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;
  const cv = stage.querySelector("canvas");
  const ctx = cv.getContext("2d");
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");
  const bg = document.createElement("canvas");
  const bctx = bg.getContext("2d");
  const $ = (s) => document.querySelector(s);
  const sayEl = $("[data-say]"), logEl = $("[data-log]"), rateEl = $("[data-rate]"), ticksEl = $("[data-ticks]"), stampEl = $("[data-stamp]");
  const preyEl = $("[data-prey]");

  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let reduce = mqReduce.matches, dark = mqDark.matches, dpr = 1;

  console.log("%cgyra%c\nApps with a killer instinct. Say hi: hello@gyra.io", "font: 500 22px ui-serif, Georgia, serif", "font: 12px system-ui");

  // ---------------------------------------------------------------- helpers
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return "rgb(" + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(",") + ")"; };
  const clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

  // ---------------------------------------------------------------- time of day and moon
  const hour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  // light-mode sky keyframes by local hour: [hour, top, bottom, glow]
  const SKY = [
    [0, "#e9e2df", "#f3ece4", "#c98a6b"], [5, "#efdcd6", "#f6e8de", "#e09a86"], [7.5, "#f3dfd2", "#f7eee4", "#eca883"],
    [10, "#eeede6", "#f7f3ea", "#f2d6a2"], [15, "#f0e9dd", "#f7f1e6", "#efc98d"], [18, "#f2cf9f", "#f6e6d0", "#e2843a"],
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
    const p = ((days % 29.530588) + 29.530588) % 29.530588 / 29.530588;
    const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
    const name = p < 0.03 || p > 0.97 ? "new moon" : p < 0.22 ? "waxing crescent" : p < 0.28 ? "first quarter" : p < 0.47 ? "waxing gibbous"
      : p < 0.53 ? "full moon" : p < 0.72 ? "waning gibbous" : p < 0.78 ? "last quarter" : "waning crescent";
    return { p, lit, name };
  }

  const C = () => dark
    ? { ground: "#171a23", line: "#262a35", grass: "#343a49", grassFg: "#0d0f15", mound: "#22242c", far: "#1b1e28", coat: "#b99a6c", spot: "#17110c", sole: "#0a0806", eye: "#e8b04b", glow: "rgba(232,176,75,0.55)", fly: [243, 227, 168] }
    : { ground: "#ece4d6", line: "#d8cfc2", grass: "#b9ab94", grassFg: "#8d7f68", mound: "#d4c3a5", far: "#d9ccb6", coat: "#c8a574", spot: "#2a1f17", sole: "#15100c", eye: "#d9822b", glow: "rgba(217,130,43,0.35)", fly: [217, 130, 43] };
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

  // ---------------------------------------------------------------- world
  let W = 0, H = 0, floor = 0, s = 1, mound = { x: 0, w: 0, h: 0 }, sun = { x: 0, y: 0, up: false };
  let fg = [], stars = [], shooting = null;
  const flies = [];

  function layout() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || (w === W && h === H)) return;
    const first = !W;
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W * H * dpr * dpr > 2.6e6) dpr = 1.5;
    floor = H - Math.max(56, H * 0.15);
    s = clamp(W * 0.0012, 0.86, 1.55);
    for (const c of [cv, layer, bg]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    mound = { x: W * (W < 700 ? 0.86 : 0.84), w: clamp(W * 0.13, 90, 190), h: clamp(H * 0.2, 80, 150) };
    fg = [];
    for (let c = 0; c < Math.ceil(W / 150) + 1; c++) { // sparse clumps, not a fence
      const cx = c * 150 + ((c * 97) % 70) - 20, n = 4 + (c % 4);
      for (let i = 0; i < n; i++) fg.push({ x: cx + i * 5 + ((i * 13) % 7), h: (18 + ((c * 31 + i * 17) % 26)) * s, l: (i - n / 2) * 1.6 });
    }
    stars = Array.from({ length: W < 700 ? 70 : 120 }, (_, i) => ({ x: ((i * 131) % 997) / 997 * W, y: Math.pow(((i * 71) % 467) / 467, 1.4) * floor * 0.85, r: [0.6, 0.9, 1.4][i % 3] }));
    if (first) { cat.x = -90 * s; for (let i = 0; i < 5; i++) flies.push(newFly()); }
    measurePrey();
    paintBackdrop();
    kick();
  }

  function newFly() {
    return { x: W * (0.15 + Math.random() * 0.7), y: floor - (14 + Math.random() * 90) * s, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.6, alive: true, back: 0, dart: 0 };
  }

  // the static backdrop is painted once per layout/theme change, not every frame
  function paintBackdrop() {
    const g = bctx, h = hour();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dark) {
      const sky = g.createLinearGradient(0, 0, 0, floor);
      sky.addColorStop(0, "#0b0d14"); sky.addColorStop(1, "#171a26");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const st of stars) { g.globalAlpha = 0.35 + (st.r / 1.4) * 0.5; g.fillStyle = "#f3e9c8"; g.beginPath(); g.arc(st.x, st.y, st.r, 0, 6.2832); g.fill(); }
      g.globalAlpha = 1;
      drawMoon(g, W * 0.78, floor * 0.22, clamp(W * 0.022, 16, 30));
    } else {
      const [top, bot, glow] = skyAt(h);
      const sky = g.createLinearGradient(0, 0, 0, floor);
      sky.addColorStop(0, top); sky.addColorStop(1, bot);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const dayT = (h - 6) / 13; // sun from 6:00 to 19:00
      sun.up = dayT > -0.05 && dayT < 1.05;
      sun.x = W * clamp(0.08 + 0.84 * dayT, 0.04, 0.96);
      sun.y = floor - Math.sin(clamp(dayT, 0, 1) * Math.PI) * floor * 0.72 + (sun.up ? 0 : 30);
      const rg = g.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, Math.max(W, H) * 0.55);
      const [r, gg, b] = (glow.match(/\d+/g) || [226, 132, 58]).map(Number);
      rg.addColorStop(0, `rgba(${r},${gg},${b},0.38)`); rg.addColorStop(0.35, `rgba(${r},${gg},${b},0.12)`); rg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      if (sun.up) {
        const sr = clamp(W * 0.028, 18, 34);
        const core = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sr);
        core.addColorStop(0, "rgba(255,246,226,1)"); core.addColorStop(0.7, `rgba(${r},${gg},${b},0.9)`); core.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        g.fillStyle = core; g.beginPath(); g.arc(sun.x, sun.y, sr, 0, 6.2832); g.fill();
      }
    }
    // distant hills and acacias
    g.fillStyle = col.far;
    g.beginPath(); g.moveTo(0, floor);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, floor - 18 * s - Math.sin(x / 210) * 10 * s - Math.sin(x / 67) * 4 * s);
    g.lineTo(W, floor); g.fill();
    acacia(g, W * 0.6, floor - 8 * s, 1.0 * s);
    acacia(g, W * 0.27, floor - 14 * s, 0.55 * s);
    // ground
    g.fillStyle = col.ground; g.fillRect(0, floor, W, H - floor);
    // termite mound with a dark entrance
    const m = mound; g.fillStyle = col.mound;
    g.beginPath(); g.moveTo(m.x - m.w / 2, floor + 2);
    g.bezierCurveTo(m.x - m.w * 0.36, floor - m.h * 0.62, m.x - m.w * 0.2, floor - m.h * 1.02, m.x - m.w * 0.04, floor - m.h);
    g.bezierCurveTo(m.x + m.w * 0.06, floor - m.h * 1.22, m.x + m.w * 0.16, floor - m.h * 0.9, m.x + m.w * 0.22, floor - m.h * 0.7);
    g.bezierCurveTo(m.x + m.w * 0.34, floor - m.h * 0.45, m.x + m.w * 0.42, floor - m.h * 0.2, m.x + m.w / 2, floor + 2);
    g.closePath(); g.fill();
    g.fillStyle = dark ? "rgba(0,0,0,0.45)" : "rgba(80,55,30,0.28)";
    g.beginPath(); g.ellipse(m.x - m.w * 0.06, floor - 1, m.w * 0.15, m.h * 0.13, 0, Math.PI, 0); g.fill();
    // back grass
    g.strokeStyle = col.grass; g.lineWidth = 1.2;
    for (let x = 0; x < W; x += 9) { const hh = (5 + ((x * 13) % 9)) * s; g.beginPath(); g.moveTo(x, floor + 1); g.quadraticCurveTo(x + 1, floor - hh * 0.6, x + ((x % 5) - 2) * 1.5, floor - hh); g.stroke(); }
  }

  function acacia(g, x, y, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.strokeStyle = col.far; g.fillStyle = col.far; g.lineCap = "round";
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, -26, -6, -50); g.stroke();
    g.lineWidth = 2.6;
    for (const [a, b, c, d] of [[-2, -30, -30, -58], [-1, -34, 26, -60], [-5, -46, -8, -62], [-3, -40, 12, -64]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    for (const [cx, cy, rx, ry] of [[-30, -64, 34, 8], [6, -68, 46, 9], [34, -63, 28, 7], [-8, -72, 30, 6]]) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); g.fill(); }
    g.restore();
  }

  function drawMoon(g, x, y, r) {
    const m = moon();
    const halo = g.createRadialGradient(x, y, r, x, y, r * 5);
    halo.addColorStop(0, "rgba(233,225,200,0.16)"); halo.addColorStop(1, "rgba(233,225,200,0)");
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 5, 0, 6.2832); g.fill();
    g.fillStyle = "#252836"; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    g.save(); g.translate(x, y); if (m.p > 0.5) g.scale(-1, 1);
    const rx = r * Math.abs(Math.cos(2 * Math.PI * m.p));
    g.fillStyle = "#ece4c9";
    g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, m.lit < 0.5);
    g.fill(); g.restore();
  }

  // ---------------------------------------------------------------- the cat and her prey
  const cat = { x: 0, y: 0, vx: 0, vy: 0, dir: 1, turn: 1, state: "enter", t0: now(), pose: clone(POSES.stand), phase: 0, eye: 1, blinkAt: now() + 3, slowBlink: 0, air: false, lastStep: [0, 0] };
  const cursor = { x: 0, y: 0, on: false, lastMove: 0, trail: [] };
  const dot = { x: 0, y: 0, alive: !!preyEl && !reduce, r: 4 };
  let caught = 0, tries = 0, restUntil = 0, lastInput = now(), prints = [], target = null, tooHighSaid = false, held = 0;
  const log = [];

  function measurePrey() {
    if (!preyEl) return;
    const r = preyEl.getBoundingClientRect(), c = cv.getBoundingClientRect();
    dot.x = r.left - c.left + r.width * 0.56; dot.y = r.top - c.top + r.height * 0.27; dot.r = clamp(r.height * 0.06, 3, 7);
  }

  const setState = (st) => { cat.state = st; cat.t0 = now(); };
  const inState = () => now() - cat.t0;
  const say = (t) => { if (sayEl) sayEl.textContent = t; };
  const maxLeap = () => floor * 0.62;

  function record(hit, meters) {
    log.unshift(`No. ${String(tries).padStart(3, "0")} · ${clock()} · ${hit ? "Caught" : "Missed"} · ${meters.toFixed(1)} m`);
    if (logEl) logEl.innerHTML = log.slice(0, 3).map((l) => `<li>${l}</li>`).join("");
    if (rateEl) rateEl.textContent = `Her rate ${Math.round((caught / tries) * 100)}%`;
    if (ticksEl) {
      ticksEl.innerHTML = log.slice(0, 18).reverse().map((l) => l.includes("Caught") ? '<i class="hit"></i>' : '<i class="miss"></i>').join("");
    }
    if (hit) { const st = $(".stamp"); if (st) { st.classList.remove("go"); void st.offsetWidth; st.classList.add("go"); } }
  }

  function face(tx) { const d = tx > cat.x ? 1 : -1; if (d !== cat.dir && !cat.air) { cat.dir = d; cat.turn = -1; } }

  function startPounce(t) {
    tries++;
    const g = 2400 * s;
    const h = Math.max(70 * s, floor - (t.y + 62 * s));
    const vy = -Math.sqrt(2 * g * h), tA = -vy / g;
    let vx = (t.x - cat.x) / tA;
    const land = cat.x + vx * 2 * tA;
    if (land < 30 || land > W - 30) vx = (clamp(land, 30, W - 30) - cat.x) / (2 * tA);
    vx = clamp(vx, -1100 * s, 1100 * s);
    cat.vx = vx; cat.vy = vy; cat.air = true; cat.apex = now() + tA; cat.resolved = false;
    cat.hit = t.kind === "dot" ? true : Math.random() < 0.6;
    cat.prey = t; cat.leap = Math.hypot(vx * 2 * tA, h) / (200 * s);
    cat.high = h > 140 * s;
    setState("pounce");
  }

  function resolve() {
    cat.resolved = true;
    const t = cat.prey, hit = cat.hit;
    if (hit) caught++;
    if (t.kind === "dot") { dot.alive = false; say("Got it. Rarely misses."); }
    else if (t.kind === "fly") { if (hit) { t.ref.alive = false; t.ref.back = now() + 5 + Math.random() * 5; } else { t.ref.dart = 1; } }
    else if (t.kind === "cursor") { if (hit) cursor.gone = now() + 1.4; else cursor.dart = now() + 0.6; }
    if (t.kind !== "dot") say(hit ? ["Got it.", "Another one.", "Of course she did.", "Clean."][caught % 4] : ["Missed. It won’t happen twice.", "That one bought itself a second.", "Noted. The next one’s hers."][tries % 3]);
    record(hit, cat.leap);
  }

  // ---------------------------------------------------------------- input
  function stagePoint(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom }; }
  function wake() {
    lastInput = now();
    if (cat.state === "sleep" || cat.state === "circle" || cat.state === "tomound") { setState("stretch"); say("She’s up."); }
  }
  if (fine) {
    window.addEventListener("pointermove", (e) => {
      const p = stagePoint(e);
      cursor.on = p.inside;
      if (!p.inside) return;
      if (Math.hypot(p.x - cursor.x, p.y - cursor.y) > 3) cursor.lastMove = now();
      cursor.x = p.x; cursor.y = p.y;
      if (dark) { cursor.trail.push({ x: p.x, y: p.y, t: now() }); if (cursor.trail.length > 16) cursor.trail.shift(); }
      if (Math.abs(p.x - cat.x) < 240 * s) wake();
      lastInput = now(); kick();
    }, { passive: true });
    cv.addEventListener("pointerleave", () => { cursor.on = false; });
  }
  cv.addEventListener("click", (e) => {
    const p = stagePoint(e);
    wake();
    // a tap releases a firefly where you touched; she goes after it
    const f = newFly(); f.x = clamp(p.x, 24, W - 24); f.y = clamp(p.y, floor - maxLeap(), floor - 12); f.tap = true;
    flies.push(f); if (flies.length > 9) flies.splice(0, flies.length - 9);
    target = { kind: "fly", ref: f }; kick();
  });
  let typed = "";
  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === "pspsps") { wake(); target = { kind: "call", x: W / 2 }; say("She heard that. She’ll allow it."); kick(); }
  });

  // ---------------------------------------------------------------- choosing what to hunt
  function pickTarget(t) {
    if (target && target.kind === "fly" && target.ref.alive && !target.ref.dart) return target;
    if (target && target.kind === "call") return target;
    if (fine && cursor.on && !cursor.gone && t - cursor.lastMove > 0.6) {
      if (floor - cursor.y < maxLeap()) return { kind: "cursor", x: cursor.x, y: cursor.y };
      if (!tooHighSaid) { tooHighSaid = true; say("Too high. She’s studying it."); }
    }
    if (dot.alive && cat.state !== "enter") return { kind: "dot", x: dot.x, y: dot.y };
    if (t - lastInput > 4 && t - lastInput < 32 && t > restUntil) {
      let best = null, bd = 1e9;
      for (const f of flies) if (f.alive && !f.dart) { const d = Math.abs(f.x - cat.x); if (d < bd) { bd = d; best = f; } }
      if (best) return { kind: "fly", ref: best };
    }
    return null;
  }
  const tx = (tg) => tg.kind === "fly" ? tg.ref.x : tg.x;
  const ty = (tg) => tg.kind === "fly" ? tg.ref.y : tg.kind === "call" ? floor : tg.y;

  // ---------------------------------------------------------------- behaviour
  function think(dt) {
    const t = now(), st = cat.state, idle = t - lastInput;
    if (cursor.gone && t > cursor.gone) cursor.gone = 0;
    if (t > cat.blinkAt) { cat.eye = 0; if (t > cat.blinkAt + 0.12) { cat.eye = 1; cat.blinkAt = t + 2.5 + Math.random() * 4; } }
    if (cat.slowBlink > 0) { cat.slowBlink -= dt; cat.eye = cat.slowBlink > 0.5 ? clamp((cat.slowBlink - 0.5) / 0.5, 0.05, 1) : clamp(1 - cat.slowBlink / 0.5, 0.05, 1); }

    const tg = (st === "sit" || st === "walk" || st === "stalk" || st === "crouch") ? pickTarget(t) : null;
    switch (st) {
      case "enter": {
        const goal = dot.alive ? clamp(dot.x - 260 * s, W * 0.12, W * 0.6) : W * 0.3;
        walkTo(goal, dt, 1);
        if (Math.abs(cat.x - goal) < 4) { setState("sit"); say(dot.alive ? "She’s spotted something." : fine ? "She’s tracking your cursor." : "Tap the ground. She’s locked on."); }
        break;
      }
      case "sit": {
        if (tg) { face(tx(tg)); setState(Math.abs(tx(tg) - cat.x) > 320 * s ? "walk" : "stalk"); }
        else if (idle > 32) setState("tomound");
        break;
      }
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
        else if (inState() > 0.9) setState("crouch");
        break;
      }
      case "crouch": {
        if (!tg) { setState("sit"); break; }
        face(tx(tg));
        if (inState() > 0.65) { startPounce({ kind: tg.kind, ref: tg.ref, x: tx(tg), y: ty(tg) }); target = null; }
        break;
      }
      case "pounce": {
        cat.vy += 2400 * s * dt; cat.x += cat.vx * dt; cat.y += cat.vy * dt;
        if (!cat.resolved && cat.vy >= 0) resolve(); // decide at the top of the arc
        if (cat.y >= 0 && cat.vy > 0) { cat.y = 0; cat.vy = 0; cat.vx = 0; cat.air = false; setState("land"); restUntil = t + 3 + Math.random() * 3; }
        break;
      }
      case "land": if (inState() > 0.35) setState("sit"); break;
      case "tomound": {
        const goal = mound.x - mound.w * 0.06;
        walkTo(goal, dt, 0.8);
        if (Math.abs(cat.x - goal) < 4) { setState("circle"); say("One circle before she rests. That’s the gyra."); }
        break;
      }
      case "circle": {
        const p = inState() / 1.8;
        cat.turn = Math.cos(p * Math.PI * 4);
        if (p >= 1) { cat.turn = 1; setState("sleep"); say("Resting between hunts. Move near her to wake her."); }
        break;
      }
      case "stretch": if (inState() > 0.7) setState("sit"); break;
    }
    if (cat.state !== "circle") cat.turn = Math.min(1, cat.turn + dt * 7);

    // hold the cursor on her for 3 seconds: a slow blink
    if (fine && cursor.on && cat.state === "sit" && Math.abs(cursor.x - cat.x) < 50 * s && t - cursor.lastMove > 3 && !held) { held = 1; cat.slowBlink = 1; say("A slow blink. You’re on her side."); }
    if (t - cursor.lastMove < 0.2) held = 0;

    // fireflies drift; misses dart off and come back later
    for (const f of flies) {
      if (!f.alive) { if (f.back && t > f.back) Object.assign(f, newFly()); continue; }
      if (f.dart) { f.y -= 220 * dt; f.x += 90 * dt * (f.ph > 3 ? 1 : -1); if (f.y < -20) { f.alive = false; f.back = t + 4; f.dart = 0; } continue; }
      f.ph += dt * f.sp;
      f.x += Math.cos(f.ph * 1.3) * 18 * dt * s; f.y += Math.sin(f.ph * 2.1) * 12 * dt * s;
      f.x = clamp(f.x, 20, W - 20); f.y = clamp(f.y, floor - (f.tap ? maxLeap() : 120 * s), floor - 10);
    }
  }

  function walkTo(goal, dt, speed) {
    const d = goal - cat.x;
    if (Math.abs(d) < 2) { cat.vx = 0; return; }
    face(goal);
    const vmax = 150 * s * speed, want = clamp(d * 4, -vmax, vmax);
    cat.vx += clamp(want - cat.vx, -700 * s * dt, 700 * s * dt);
    cat.x += cat.vx * dt;
    cat.phase += (Math.abs(cat.vx) * dt) / (54 * s);
  }

  function targetPose() {
    const st = cat.state, moving = Math.abs(cat.vx) > 8;
    const base = st === "sit" ? POSES.sit : st === "stalk" ? POSES.stalk : st === "crouch" || st === "land" ? POSES.crouch
      : st === "pounce" ? (cat.high ? POSES.rise : POSES.leap) : st === "sleep" ? POSES.loaf : st === "stretch" ? POSES.stretch : POSES.stand;
    const p = clone(base);
    if ((moving && st !== "pounce") || st === "circle") {
      const stride = st === "stalk" ? 26 : 34, offs = { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 };
      const ph = st === "circle" ? inState() * 2.2 : cat.phase;
      for (const leg of ["fn", "ff", "hn", "hf"]) {
        const q = (ph + offs[leg]) % 1, jx = leg[0] === "f" ? p.sx : p.hx;
        if (q < 0.62) { p[leg][0] = jx + 6 + stride * (0.5 - q / 0.62); p[leg][1] = 0; }
        else { const u = (q - 0.62) / 0.38; p[leg][0] = jx + 6 + stride * (-0.5 + u); p[leg][1] = -Math.sin(u * Math.PI) * 9; }
      }
      const bob = Math.sin(ph * Math.PI * 4) * 1.6; p.hy += bob; p.sy += bob; p.ky += bob;
    }
    if (st === "crouch") p.hx += Math.sin(now() * 26) * 3;
    if (st === "sit" || st === "stalk" || st === "crouch") {
      const tg = pickTarget(now());
      if (tg) p.ka += clamp((ty(tg) - (floor + p.ky * s)) / (s * 160), -0.7, 0.4);
    }
    if (st === "sleep") { const b = Math.sin(now() * 1.6) * 0.6; p.t += b * 0.6; p.hy -= b * 0.4; p.sy -= b * 0.4; }
    return p;
  }

  // ---------------------------------------------------------------- drawing
  const SPOTS = [
    [0.05, -0.55, 3.2], [0.22, -0.65, 2.8], [0.4, -0.6, 3], [0.58, -0.62, 2.6], [0.76, -0.55, 2.8], [0.92, -0.4, 2.4],
    [0.12, 0.05, 3.6], [0.32, 0.0, 3.2], [0.52, 0.05, 3.4], [0.72, 0.0, 3], [0.88, 0.15, 2.8],
    [0.2, 0.55, 3], [0.45, 0.6, 2.8], [0.68, 0.55, 2.6], [-0.08, 0.2, 4], [-0.05, -0.3, 3.6],
  ];
  function drawCat(g, p) {
    g.save();
    g.translate(cat.x, floor + cat.y);
    g.scale(cat.dir * s * cat.turn, s);
    g.lineCap = "round"; g.lineJoin = "round";
    const coat = col.coat, spot = col.spot;
    const legs = [["hf", p.hx + 3, p.hy + 4, 22, 25, 1, 9], ["ff", p.sx, p.sy + 7, 20, 24, 1, 7], ["hn", p.hx + 3, p.hy + 4, 22, 25, 1, 9], ["fn", p.sx, p.sy + 7, 20, 24, 1, 7]];
    const tail = []; let tx2 = p.hx - p.t * 0.85, ty2 = p.hy - p.t * 0.25, a = p.t0;
    const sway = cat.state === "crouch" ? Math.sin(now() * 18) * 0.12 : cat.state === "stalk" ? Math.sin(now() * 10) * 0.08 : Math.sin(now() * 3.8) * 0.05;
    tail.push([tx2, ty2]);
    for (let i = 0; i < 9; i++) { a += p.k + sway * (i / 9); tx2 += Math.cos(a) * 10; ty2 += Math.sin(a) * 10; if (!cat.air && ty2 > -2) ty2 = -2; tail.push([tx2, ty2]); }
    g.strokeStyle = coat;
    for (let i = 0; i < tail.length - 1; i++) { g.lineWidth = lerp(7.5, 4.2, i / tail.length); g.beginPath(); g.moveTo(...tail[i]); g.lineTo(...tail[i + 1]); g.stroke(); }
    const drawn = legs.map(([name, jx, jy, l1, l2, bend, w]) => {
      const f = p[name], [kx2, ky2, fx, fy] = knee(jx, jy, f[0], f[1], l1, l2, name[0] === "h" ? -bend : bend);
      g.strokeStyle = coat; g.lineWidth = w; g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx2, ky2); g.stroke();
      g.lineWidth = w * 0.72; g.beginPath(); g.moveTo(kx2, ky2); g.lineTo(fx, fy); g.stroke();
      return [jx, jy, kx2, ky2, fx, fy, w];
    });
    g.fillStyle = coat;
    g.beginPath(); g.arc(p.hx, p.hy, p.t * 1.06, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(p.sx, p.sy, p.t * 0.92, 0, 6.2832); g.fill();
    const mx = (p.hx + p.sx) / 2, my = (p.hy + p.sy) / 2;
    g.beginPath(); g.moveTo(p.hx, p.hy - p.t); g.quadraticCurveTo(mx, my - p.t * 0.82, p.sx, p.sy - p.t * 0.9);
    g.lineTo(p.sx, p.sy + p.t * 0.9); g.quadraticCurveTo(mx, my + p.t, p.hx, p.hy + p.t); g.closePath(); g.fill();
    g.strokeStyle = coat; g.lineWidth = p.t * 1.15; g.beginPath(); g.moveTo(p.sx + 2, p.sy - 4); g.lineTo(p.kx - 4, p.ky + 4); g.stroke();
    g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka);
    g.beginPath(); g.arc(0, 0, 12.5, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(9.5, 4, 7, 5.6, 0, 0, 6.2832); g.fill();
    const ear = (a1, b1, a2, b2, c1, c2) => { g.beginPath(); g.moveTo(a1, b1); g.lineTo(c1, c2); g.lineTo(a2, b2); g.closePath(); g.fill(); };
    const fl = p.ears * 9; ear(-9, -6, 1, -12, -8 - fl * 0.6, -25 + fl); ear(2, -12, 10, -6, 7 - fl * 0.4, -24 + fl);
    g.restore();
    g.globalCompositeOperation = "source-atop"; g.fillStyle = spot;
    for (const [u, v, r] of SPOTS) { const x = lerp(p.hx, p.sx, u), y = lerp(p.hy, p.sy, u) + v * p.t; g.beginPath(); g.ellipse(x, y, r * 0.95, r * 0.62, 0.3, 0, 6.2832); g.fill(); }
    g.strokeStyle = spot;
    for (const [jx, jy, kx2, ky2, fx, fy, w] of drawn) {
      for (const tp of [0.35, 0.7]) { const x = lerp(jx, kx2, tp), y = lerp(jy, ky2, tp), an = Math.atan2(ky2 - jy, kx2 - jx) + Math.PI / 2; g.lineWidth = 1.7; g.beginPath(); g.moveTo(x - Math.cos(an) * w, y - Math.sin(an) * w); g.lineTo(x + Math.cos(an) * w, y + Math.sin(an) * w); g.stroke(); }
      g.fillStyle = col.sole; g.beginPath(); g.arc(fx, fy - 1, w * 0.48, 0, 6.2832); g.fill(); g.fillStyle = spot;
    }
    for (const i of [3, 5, 7]) { const [x, y] = tail[i]; g.beginPath(); g.arc(x, y, 3.6, 0, 6.2832); g.fill(); }
    const [ex, ey] = tail[tail.length - 1]; g.fillStyle = col.sole; g.beginPath(); g.arc(ex, ey, 3.4, 0, 6.2832); g.fill();
    g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka); g.strokeStyle = spot; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-2, 3); g.lineTo(-9, 1); g.moveTo(-1, 7); g.lineTo(-8, 7); g.stroke();
    g.globalCompositeOperation = "source-over";
    if (cat.state !== "sleep") {
      const open = cat.eye * (cat.state === "crouch" ? 0.7 : 1);
      if (dark) { g.fillStyle = col.glow; g.beginPath(); g.arc(5.5, -2.5, 4.5, 0, 6.2832); g.fill(); }
      g.fillStyle = col.eye; g.beginPath(); g.ellipse(5.5, -2.5, 3.6, Math.max(0.4, 2.2 * open), -0.15, 0, 6.2832); g.fill();
    } else { g.strokeStyle = col.spot; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2.5, -2); g.quadraticCurveTo(5.5, 0, 8.5, -2); g.stroke(); }
    g.restore(); g.restore();
  }

  function glowDot(g, x, y, r, a) {
    const [cr, cg, cb] = col.fly;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 5);
    halo.addColorStop(0, `rgba(${cr},${cg},${cb},${0.5 * a})`); halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 5, 0, 6.2832); g.fill();
    g.fillStyle = dark ? `rgba(255,244,210,${a})` : `rgba(181,90,24,${a})`; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }

  function render(t) {
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // a shooting star, once per night visit
    if (dark && shooting) {
      const u = (t - shooting.t) / 0.9;
      if (u >= 0 && u <= 1) { const x = lerp(shooting.x, shooting.x - 260, u), y = lerp(shooting.y, shooting.y + 110, u); const gr = g.createLinearGradient(x, y, x + 90, y - 38); gr.addColorStop(0, "rgba(255,248,225,0.9)"); gr.addColorStop(1, "rgba(255,248,225,0)"); g.strokeStyle = gr; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 38); g.stroke(); }
    }
    prints = prints.filter((pr) => t - pr.t < 3);
    for (const pr of prints) { g.fillStyle = col.spot; g.globalAlpha = 0.22 * (1 - (t - pr.t) / 3); g.beginPath(); g.ellipse(pr.x, floor + 7, 3.4 * s, 1.7 * s, 0, 0, 6.2832); g.fill(); }
    g.globalAlpha = 1;
    // shadow leans away from the sun
    const sh = clamp(1 + cat.y / (110 * s), 0.25, 1), lean = dark ? 0 : clamp((cat.x - sun.x) / W, -0.5, 0.5) * 50 * s;
    g.fillStyle = `rgba(20,12,6,${(dark ? 0.35 : 0.15) * sh})`;
    g.beginPath(); g.ellipse(cat.x + lean, floor + 4, (52 + Math.abs(lean) * 0.6) * s * sh, 5 * s * sh, 0, 0, 6.2832); g.fill();
    // the headline dot, her first prey
    if (dot.alive) glowDot(g, dot.x, dot.y, dot.r, 0.85 + 0.15 * Math.sin(t * 3));
    // the cat
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H);
    drawCat(lctx, cat.pose);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fireflies
    for (const f of flies) if (f.alive) glowDot(g, f.x, f.y, 2.4 * s, 0.55 + 0.45 * Math.sin(t * 4 + f.ph * 3));
    // the cursor firefly and its trail at night
    if (fine && cursor.on && !cursor.gone) {
      if (dark && cursor.trail.length) {
        g.globalCompositeOperation = "lighter";
        for (const pt of cursor.trail) { const a = 1 - (t - pt.t) / 0.45; if (a > 0) { g.fillStyle = `rgba(243,227,168,${0.22 * a})`; g.beginPath(); g.arc(pt.x, pt.y, 2.6 * a + 0.6, 0, 6.2832); g.fill(); } }
        g.globalCompositeOperation = "source-over";
      }
      const dx = cursor.dart && t < cursor.dart ? (cursor.dart - t) * 60 : 0;
      glowDot(g, cursor.x + dx, cursor.y - dx, 3, 0.7 + 0.3 * Math.sin(t * 9));
    }
    // foreground grass, in front of her
    g.strokeStyle = col.grassFg; g.lineWidth = 1.5 * s; g.globalAlpha = dark ? 0.9 : 0.55;
    const base = floor + (H - floor) * 0.7;
    for (const b of fg) { const sw = Math.sin(t * 1.2 + b.x * 0.05) * 2; g.beginPath(); g.moveTo(b.x, base); g.quadraticCurveTo(b.x + b.l, base - b.h * 0.6, b.x + b.l * 3 + sw, base - b.h); g.stroke(); }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- loop
  let raf = 0, last = now(), visible = true, frameN = 0;
  function kick() { if (!raf && visible && !reduce) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    const t = now(), dt = Math.min(0.05, t - last);
    if (cat.state === "sleep" && !cursor.on && (frameN++ % 2)) { kick(); return; } // 30fps while she sleeps
    last = t;
    think(dt);
    const before = [cat.pose.fn[1], cat.pose.hn[1]];
    blend(cat.pose, targetPose(), cat.state === "pounce" ? 1 - Math.exp(-dt * 16) : 1 - Math.exp(-dt * 11));
    if (Math.abs(cat.vx) > 8 && !cat.air) [["fn", 0], ["hn", 1]].forEach(([leg, i]) => {
      if (before[i] < -2 && cat.pose[leg][1] >= -0.5 && t - cat.lastStep[i] > 0.2) { cat.lastStep[i] = t; prints.push({ x: cat.x + cat.pose[leg][0] * s * cat.dir, t }); }
    });
    render(t);
    kick();
  }

  function stamp() {
    if (!stampEl) return;
    const m = moon();
    stampEl.textContent = dark ? `Tonight: ${m.name}, ${Math.round(m.lit * 100)}%` : `Local time ${clock()} · ${partOfDay(hour())}`;
  }

  function still() {
    layout(); paintBackdrop();
    cat.x = mound.x - mound.w * 0.06; cat.y = 0; cat.dir = -1; cat.state = "sleep"; cat.pose = clone(POSES.loaf);
    render(now());
    say("Resting between hunts.");
  }

  // ---------------------------------------------------------------- start
  if (preyEl && !reduce) preyEl.textContent = "ı"; // the dot becomes her prey
  stamp();
  layout();
  if ("ResizeObserver" in window) new ResizeObserver(() => { layout(); if (reduce) still(); }).observe(cv);
  window.addEventListener("resize", measurePrey, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measurePrey);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; last = now(); kick(); });
  const observers = [];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting) && !document.hidden; last = now(); kick(); });
    io.observe(cv); observers.push(io);
    const foot = $(".foot");
    if (foot) { const fo = new IntersectionObserver((es) => { if (es[0].isIntersecting) { foot.classList.add("seen"); fo.disconnect(); } }, { threshold: 0.5 }); fo.observe(foot); observers.push(fo); }
  }
  window.__gyra = observers;
  if (dark) shooting = { t: now() + 7, x: W * 0.62, y: floor * 0.12 };
  mqDark.addEventListener && mqDark.addEventListener("change", (e) => { dark = e.matches; col = C(); stamp(); paintBackdrop(); if (reduce) still(); kick(); });
  mqReduce.addEventListener && mqReduce.addEventListener("change", (e) => { reduce = e.matches; if (reduce) still(); else kick(); });
  setInterval(() => { stamp(); if (!dark) paintBackdrop(); }, 60000);
  if (reduce) still(); else kick();
})();
