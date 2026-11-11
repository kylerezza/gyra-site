// gyra.io — the deadliest cat. A procedural black-footed cat that hunts your cursor (or your tap).
// She catches about six in ten, like the real one. No libraries, no tracking, no storage, no network.
(() => {
  "use strict";
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;
  const cv = stage.querySelector("canvas");
  const ctx = cv.getContext("2d");
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");
  const tallyEl = document.querySelector("[data-tally]");
  const sayEl = document.querySelector("[data-say]");

  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let reduce = mqReduce.matches, dark = mqDark.matches;

  const C = () => dark
    ? { sky: "#12141c", ground: "#191c26", line: "#2a2d38", grass: "#3a3f4e", mound: "#2b2a31", coat: "#b99a6c", spot: "#17110c", sole: "#0a0806", eye: "#e8b04b", glow: "rgba(232,176,75,0.55)", moth: "#f3e3a8", far: "#20232e" }
    : { sky: "#f4efe6", ground: "#ece4d6", line: "#d8cfc2", grass: "#b9ab94", mound: "#d4c3a5", coat: "#c8a574", spot: "#2a1f17", sole: "#15100c", eye: "#d9822b", glow: "rgba(217,130,43,0.35)", moth: "#d9822b", far: "#e6dccb" };
  let col = C();

  console.log("%cgyra%c\nThe deadliest cat. She catches about six in ten. Say hi: hello@gyra.io",
    "font: 500 22px ui-serif, Georgia, serif", "font: 12px system-ui");

  // ---------------------------------------------------------------- helpers
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const now = () => performance.now() / 1000;

  // ---------------------------------------------------------------- poses (local units, facing right, floor at y=0, up is negative)
  // fn = front near, ff = front far, hn = hind near, hf = hind far
  const POSES = {
    stand:  { hx: -34, hy: -46, sx: 28, sy: -48, kx: 50, ky: -66, ka: 0,    t: 14, ears: 0, t0: -2.25, k: 0.13, fn: [32, 0], ff: [24, 0], hn: [-30, 0], hf: [-38, 0] },
    sit:    { hx: -22, hy: -16, sx: 18, sy: -50, kx: 28, ky: -78, ka: -0.05, t: 14, ears: 0, t0: 2.75, k: -0.33, fn: [24, 0], ff: [17, 0], hn: [-4, 0], hf: [-12, 0] },
    stalk:  { hx: -36, hy: -40, sx: 26, sy: -33, kx: 49, ky: -40, ka: 0.08, t: 13, ears: 1, t0: -2.95, k: 0.02, fn: [40, 0], ff: [30, 0], hn: [-30, 0], hf: [-40, 0] },
    crouch: { hx: -32, hy: -28, sx: 26, sy: -22, kx: 46, ky: -26, ka: 0.1,  t: 14, ears: 1, t0: -3.0, k: 0.0, fn: [34, 0], ff: [28, 0], hn: [-22, 0], hf: [-28, 0] },
    leap:   { hx: -40, hy: -44, sx: 34, sy: -52, kx: 58, ky: -60, ka: -0.1, t: 13, ears: 0.6, t0: -2.7, k: 0.04, fn: [70, -38], ff: [64, -30], hn: [-74, -26], hf: [-68, -20] },
    loaf:   { hx: -22, hy: -15, sx: 14, sy: -15, kx: 24, ky: -16, ka: 0.35, t: 16, ears: 0.2, t0: 2.95, k: -0.5, fn: [14, -4], ff: [10, -4], hn: [-16, -4], hf: [-20, -4] },
    stretch:{ hx: -30, hy: -54, sx: 30, sy: -24, kx: 50, ky: -28, ka: -0.15, t: 13, ears: 0, t0: -1.9, k: 0.08, fn: [64, 0], ff: [56, 0], hn: [-30, 0], hf: [-36, 0] },
  };
  const KEYS = ["hx", "hy", "sx", "sy", "kx", "ky", "ka", "t", "ears", "t0", "k"];
  const clone = (p) => ({ ...p, fn: [...p.fn], ff: [...p.ff], hn: [...p.hn], hf: [...p.hf] });
  function blend(cur, tgt, a) {
    for (const k of KEYS) cur[k] = lerp(cur[k], tgt[k], a);
    for (const f of ["fn", "ff", "hn", "hf"]) { cur[f][0] = lerp(cur[f][0], tgt[f][0], a); cur[f][1] = lerp(cur[f][1], tgt[f][1], a); }
  }

  // two-bone IK: joint j, foot f, bone lengths, bend sign -> knee point
  function knee(jx, jy, fx, fy, l1, l2, bend) {
    let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) { fx = jx + (dx / d) * max; fy = jy + (dy / d) * max; d = max; }
    const a = Math.atan2(fy - jy, fx - jx);
    const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1));
    return [jx + Math.cos(a + bend * b) * l1, jy + Math.sin(a + bend * b) * l1, fx, fy];
  }

  // ---------------------------------------------------------------- world
  let W = 0, H = 0, floor = 0, s = 1;
  let mound = { x: 0, w: 0, h: 0 };
  function layout() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || (w === W && h === H)) return;
    W = w; H = h;
    floor = H - Math.max(28, H * 0.12);
    s = clamp(W * 0.00135, 0.82, 1.45);
    for (const c of [cv, layer]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    mound = { x: W * 0.84, w: clamp(W * 0.14, 90, 170), h: clamp(H * 0.34, 70, 120) };
    grass = Array.from({ length: Math.ceil(W / 26) }, (_, i) => ({ x: i * 26 + ((i * 37) % 13), h: 6 + ((i * 53) % 11), l: (i * 7) % 3 - 1 }));
    stars = Array.from({ length: 26 }, (_, i) => ({ x: ((i * 131) % 997) / 997 * W, y: ((i * 71) % 467) / 467 * floor * 0.7, r: 0.6 + ((i * 17) % 10) / 12 }));
    if (cat.x === null) cat.x = -80 * s;
    kick();
  }
  let grass = [], stars = [];

  // ---------------------------------------------------------------- the cat
  const cat = {
    x: null, y: 0, vx: 0, vy: 0, dir: 1, turn: 1, state: "enter", t0: now(),
    pose: clone(POSES.stand), phase: 0, eye: 1, blinkAt: now() + 3, slowBlink: 0, air: false, lastStep: [0, 0, 0, 0],
  };
  const moth = { x: 0, y: 0, on: false, still: 0, lastMove: 0, gone: 0 };
  let caught = 0, tries = 0, lastInput = now(), prints = [];
  let toss = null, holdOnCat = 0;

  function setState(st) { cat.state = st; cat.t0 = now(); }
  const inState = () => now() - cat.t0;
  function say(text) { if (sayEl) sayEl.textContent = text; }
  function tally() {
    if (!tallyEl) return;
    tallyEl.hidden = false;
    tallyEl.textContent = `She has caught ${caught} of ${tries}.`;
  }

  function face(tx) { const d = tx > cat.x ? 1 : -1; if (d !== cat.dir && !cat.air) { cat.dir = d; cat.turn = -1; } }

  function startPounce(tx) {
    tries++;
    const hit = Math.random() < 0.6;
    const dist = clamp(tx - cat.x, -230 * s, 230 * s);
    const T = 0.5;
    cat.vx = dist / T; cat.vy = -(2 * 70 * s) / (T / 2); cat.air = true; cat.hit = hit; cat.target = cat.x + dist;
    setState("pounce");
    if (!hit && moth.on) { moth.dart = 1; }
  }

  // ---------------------------------------------------------------- input
  function stagePoint(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom }; }
  function wake() {
    lastInput = now();
    if (cat.state === "sleep" || cat.state === "circle") { setState("stretch"); say("She’s up."); }
  }
  if (fine) {
    window.addEventListener("pointermove", (e) => {
      const p = stagePoint(e);
      moth.on = p.inside;
      if (p.inside) {
        if (Math.hypot(p.x - moth.x, p.y - moth.y) > 3) { moth.lastMove = now(); }
        moth.x = p.x; moth.y = Math.min(p.y, floor - 6);
        if (Math.abs(p.x - cat.x) < 220 * s) wake();
        lastInput = now();
        kick();
      }
    }, { passive: true });
    cv.addEventListener("pointerleave", () => { moth.on = false; });
  }
  cv.addEventListener("click", (e) => {
    const p = stagePoint(e);
    wake();
    toss = { x: clamp(p.x, 20, W - 20), y: Math.min(p.y, floor - 6), at: now() };
    if (!fine) { moth.on = true; moth.x = toss.x; moth.y = toss.y; moth.lastMove = now() - 1; }
    kick();
  });
  let typed = "";
  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === "pspsps") { wake(); toss = { x: W / 2, y: floor - 20, at: now(), call: true }; say("She heard that."); kick(); }
  });

  // ---------------------------------------------------------------- behaviour
  function think(dt) {
    const t = now(), st = cat.state, idle = t - lastInput;
    const target = toss ? toss.x : moth.on ? moth.x : null;
    const still = moth.on && t - moth.lastMove > 0.6;

    if (t > cat.blinkAt) { cat.eye = 0; if (t > cat.blinkAt + 0.12) { cat.eye = 1; cat.blinkAt = t + 2.5 + Math.random() * 4; } }
    if (cat.slowBlink > 0) { cat.slowBlink -= dt; cat.eye = cat.slowBlink > 0.5 ? clamp((cat.slowBlink - 0.5) / 0.5, 0.05, 1) : clamp(1 - cat.slowBlink / 0.5, 0.05, 1); }

    switch (st) {
      case "enter": {
        const goal = W * 0.3;
        walkTo(goal, dt, 1);
        if (Math.abs(cat.x - goal) < 4) { setState("sit"); say(fine ? "She’s watching your cursor." : "Tap the ground. She’s watching."); }
        break;
      }
      case "sit": {
        if (toss) { face(toss.x); setState(Math.abs(toss.x - cat.x) > 260 * s ? "walk" : "stalk"); break; }
        if (target !== null && still) {
          const d = Math.abs(target - cat.x);
          face(target);
          if (d > 300 * s) setState("walk");
          else if (d > 90 * s) setState("stalk");
        }
        if (idle > 14) setState("tomound");
        break;
      }
      case "walk": {
        if (target === null) { setState("sit"); break; }
        const goal = target - Math.sign(target - cat.x) * 200 * s;
        walkTo(goal, dt, toss && toss.call ? 2 : 1);
        if (Math.abs(cat.x - goal) < 6) setState("stalk");
        break;
      }
      case "stalk": {
        if (target === null) { setState("sit"); break; }
        face(target);
        const d = Math.abs(target - cat.x);
        if (d > 240 * s) { walkTo(target - Math.sign(target - cat.x) * 200 * s, dt, 0.45); }
        else if (inState() > 1.1) { setState("crouch"); }
        else walkTo(cat.x + cat.dir * 20, dt, 0.25);
        break;
      }
      case "crouch": {
        if (target === null) { setState("sit"); break; }
        face(target);
        if (inState() > 0.6) { startPounce(target); toss = null; }
        break;
      }
      case "pounce": {
        cat.vy += 2400 * s * dt; cat.x += cat.vx * dt; cat.y += cat.vy * dt;
        if (moth.dart) { moth.y -= 260 * dt; moth.x += 140 * dt * cat.dir; }
        if (cat.y >= 0 && cat.vy > 0) {
          cat.y = 0; cat.vy = 0; cat.vx = 0; cat.air = false;
          if (cat.hit) { caught++; moth.gone = 1.6; say(caught === 1 ? "Got it." : ["Got it.", "Another one.", "Of course she did.", "Clean."][caught % 4]); }
          else { say(["Missed. She’ll pretend that was on purpose.", "Not this time.", "It got away."][tries % 3]); }
          moth.dart = 0; tally();
          setState("land");
        }
        break;
      }
      case "land": if (inState() > 0.35) setState("sit"); break;
      case "tomound": {
        const goal = mound.x - mound.w * 0.05;
        walkTo(goal, dt, 0.8);
        if (Math.abs(cat.x - goal) < 4) { setState("circle"); say("She’s turning in a circle. That’s the gyra."); }
        if (target !== null && idle < 1) setState("sit");
        break;
      }
      case "circle": {
        const p = inState() / 1.8; // two turns
        cat.turn = Math.cos(p * Math.PI * 4);
        if (p >= 1) { cat.turn = 1; setState("sleep"); say("Asleep in the termite mound. Move near her to wake her."); }
        break;
      }
      case "sleep": break;
      case "stretch": if (inState() > 0.7) setState("sit"); break;
    }
    if (st !== "circle") cat.turn = Math.min(1, cat.turn + dt * 7);

    // hold the cursor on her for 3s: she slow-blinks at you
    if (moth.on && Math.abs(moth.x - cat.x) < 40 * s && (st === "sit") && t - moth.lastMove > 3 && holdOnCat === 0) { holdOnCat = 1; cat.slowBlink = 1; say("A slow blink. She trusts you."); }
    if (t - moth.lastMove < 0.2) holdOnCat = 0;
    if (toss && t - toss.at > 6) toss = null;
    if (moth.gone > 0) { moth.gone -= dt; if (moth.gone <= 0 && !fine) moth.on = false; }
  }

  function walkTo(goal, dt, speed) {
    const d = goal - cat.x;
    if (Math.abs(d) < 2) { cat.vx = 0; return; }
    face(goal);
    const vmax = 150 * s * speed;
    const want = clamp(d * 4, -vmax, vmax);
    cat.vx += clamp(want - cat.vx, -700 * s * dt, 700 * s * dt);
    cat.x += cat.vx * dt;
    cat.phase += (Math.abs(cat.vx) * dt) / (54 * s);
  }

  // ---------------------------------------------------------------- pose for this frame
  function targetPose() {
    const st = cat.state, moving = Math.abs(cat.vx) > 8;
    let base = st === "sit" ? POSES.sit : st === "stalk" ? POSES.stalk : st === "crouch" ? POSES.crouch : st === "pounce" ? POSES.leap
      : st === "land" ? POSES.crouch : st === "sleep" ? POSES.loaf : st === "stretch" ? POSES.stretch
      : st === "circle" ? POSES.stand : POSES.stand;
    const p = clone(base);
    if ((moving && st !== "pounce") || st === "circle") {
      const stride = st === "stalk" ? 26 : 34;
      const offs = { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 };
      const ph = st === "circle" ? inState() * 2.2 : cat.phase;
      for (const leg of ["fn", "ff", "hn", "hf"]) {
        const q = (ph + offs[leg]) % 1, jx = leg[0] === "f" ? p.sx : p.hx;
        if (q < 0.62) { p[leg][0] = jx + 6 + stride * (0.5 - q / 0.62); p[leg][1] = 0; }
        else { const u = (q - 0.62) / 0.38; p[leg][0] = jx + 6 + stride * (-0.5 + u); p[leg][1] = -Math.sin(u * Math.PI) * 9; }
      }
      const bob = Math.sin(ph * Math.PI * 4) * 1.6;
      p.hy += bob; p.sy += bob; p.ky += bob;
    }
    if (st === "crouch") { const w = Math.sin(now() * 26) * 3; p.hx += w; }  // the butt wiggle
    if (moth.on && (st === "sit" || st === "stalk" || st === "crouch")) {   // look at the moth
      const dy = (moth.y - (floor + p.ky * s)) / (s * 120);
      p.ka += clamp(dy, -0.5, 0.4);
    }
    if (st === "sleep") { const b = Math.sin(now() * 1.6) * 0.6; p.t += b * 0.6; p.hy -= b * 0.4; p.sy -= b * 0.4; }
    return p;
  }

  // ---------------------------------------------------------------- drawing
  const SPOTS = [ // along the spine: [u 0=hip..1=shoulder, v -1 top..1 bottom, size]
    [0.05, -0.55, 3.2], [0.22, -0.65, 2.8], [0.4, -0.6, 3], [0.58, -0.62, 2.6], [0.76, -0.55, 2.8], [0.92, -0.4, 2.4],
    [0.12, 0.05, 3.6], [0.32, 0.0, 3.2], [0.52, 0.05, 3.4], [0.72, 0.0, 3], [0.88, 0.15, 2.8],
    [0.2, 0.55, 3], [0.45, 0.6, 2.8], [0.68, 0.55, 2.6], [-0.08, 0.2, 4], [-0.05, -0.3, 3.6],
  ];

  function drawCat(g, p) {
    const cx = cat.x, cy = floor + cat.y;
    g.save();
    g.translate(cx, cy);
    g.scale(cat.dir * s * cat.turn, s);
    g.lineCap = "round"; g.lineJoin = "round";
    const coat = col.coat, spot = col.spot;
    const legs = [
      ["hf", p.hx + 3, p.hy + 4, 22, 25, 1, 9], ["ff", p.sx, p.sy + 7, 20, 24, 1, 7],
      ["hn", p.hx + 3, p.hy + 4, 22, 25, 1, 9], ["fn", p.sx, p.sy + 7, 20, 24, 1, 7],
    ];
    // tail (behind the body)
    const tail = []; let tx = p.hx - p.t * 0.85, ty = p.hy - p.t * 0.25, a = p.t0;
    const sway = cat.state === "crouch" ? Math.sin(now() * 18) * 0.12 : cat.state === "stalk" ? Math.sin(now() * 10) * 0.08 : Math.sin(now() * 3.8) * 0.05;
    tail.push([tx, ty]);
    for (let i = 0; i < 9; i++) { a += p.k + sway * (i / 9); tx += Math.cos(a) * 10; ty += Math.sin(a) * 10; if (ty > -2) ty = -2; tail.push([tx, ty]); }
    g.strokeStyle = coat;
    for (let i = 0; i < tail.length - 1; i++) {
      g.lineWidth = lerp(7.5, 4.2, i / tail.length); g.beginPath(); g.moveTo(...tail[i]); g.lineTo(...tail[i + 1]); g.stroke();
    }
    // far legs first
    const legDraw = (L) => {
      const [name, jx, jy, l1, l2, bend, w] = L, f = p[name];
      const [kx2, ky2, fx, fy] = knee(jx, jy, f[0], f[1], l1, l2, name[0] === "h" ? -bend : bend);
      g.strokeStyle = coat;
      g.lineWidth = w; g.beginPath(); g.moveTo(jx, jy); g.lineTo(kx2, ky2); g.stroke();
      g.lineWidth = w * 0.72; g.beginPath(); g.moveTo(kx2, ky2); g.lineTo(fx, fy); g.stroke();
      return [jx, jy, kx2, ky2, fx, fy, w];
    };
    const drawn = legs.map(legDraw);
    // body
    g.fillStyle = coat;
    g.beginPath(); g.arc(p.hx, p.hy, p.t * 1.06, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(p.sx, p.sy, p.t * 0.92, 0, 6.2832); g.fill();
    const mx = (p.hx + p.sx) / 2, my = (p.hy + p.sy) / 2;
    g.beginPath();
    g.moveTo(p.hx, p.hy - p.t * 1.0);
    g.quadraticCurveTo(mx, my - p.t * 0.82, p.sx, p.sy - p.t * 0.9);
    g.lineTo(p.sx, p.sy + p.t * 0.9);
    g.quadraticCurveTo(mx, my + p.t * 1.0, p.hx, p.hy + p.t * 1.0);
    g.closePath(); g.fill();
    // neck and head
    g.strokeStyle = coat; g.lineWidth = p.t * 1.15;
    g.beginPath(); g.moveTo(p.sx + 2, p.sy - 4); g.lineTo(p.kx - 4, p.ky + 4); g.stroke();
    g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka);
    g.beginPath(); g.arc(0, 0, 12.5, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(9.5, 4, 7, 5.6, 0, 0, 6.2832); g.fill();
    const ear = (bx1, by1, bx2, by2, tipx, tipy) => { g.beginPath(); g.moveTo(bx1, by1); g.lineTo(tipx, tipy); g.lineTo(bx2, by2); g.closePath(); g.fill(); };
    const fl = p.ears * 9;
    ear(-9, -6, 1, -12, -8 - fl * 0.6, -25 + fl);
    ear(2, -12, 10, -6, 7 - fl * 0.4, -24 + fl);
    g.restore();
    // near legs on top of the body
    // (already drawn; near legs were last in the list)

    // markings: spots, leg bars, black soles, tail rings, painted only where the coat is
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = spot;
    for (const [u, v, r] of SPOTS) {
      const x = lerp(p.hx, p.sx, u), y = lerp(p.hy, p.sy, u) + v * p.t;
      g.beginPath(); g.ellipse(x, y, r * 0.95, r * 0.62, 0.3, 0, 6.2832); g.fill();
    }
    g.strokeStyle = spot;
    for (const [jx, jy, kx2, ky2, fx, fy, w] of drawn) {
      for (const tpos of [0.35, 0.7]) {
        const x = lerp(jx, kx2, tpos), y = lerp(jy, ky2, tpos), ang = Math.atan2(ky2 - jy, kx2 - jx) + Math.PI / 2;
        g.lineWidth = 1.7; g.beginPath(); g.moveTo(x - Math.cos(ang) * w, y - Math.sin(ang) * w); g.lineTo(x + Math.cos(ang) * w, y + Math.sin(ang) * w); g.stroke();
      }
      g.fillStyle = col.sole; g.beginPath(); g.arc(fx, fy - 1, w * 0.48, 0, 6.2832); g.fill(); g.fillStyle = spot;
    }
    for (const i of [3, 5, 7]) { const [x, y] = tail[i]; g.beginPath(); g.arc(x, y, 3.6, 0, 6.2832); g.fill(); }
    const [ex, ey] = tail[tail.length - 1]; g.fillStyle = col.sole; g.beginPath(); g.arc(ex, ey, 3.4, 0, 6.2832); g.fill();
    // cheek stripes on the head
    g.save(); g.translate(p.kx, p.ky); g.rotate(p.ka); g.strokeStyle = spot; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(-2, 3); g.lineTo(-9, 1); g.moveTo(-1, 7); g.lineTo(-8, 7); g.stroke();
    g.globalCompositeOperation = "source-over";
    // the eye (one slit, side view); eyeshine at night
    if (cat.state !== "sleep") {
      const open = cat.eye * (cat.state === "crouch" ? 0.7 : 1);
      if (dark) { g.fillStyle = col.glow; g.beginPath(); g.arc(5.5, -2.5, 4.5, 0, 6.2832); g.fill(); }
      g.fillStyle = col.eye; g.beginPath(); g.ellipse(5.5, -2.5, 3.6, Math.max(0.4, 2.2 * open), -0.15, 0, 6.2832); g.fill();
    } else {
      g.strokeStyle = col.spot; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2.5, -2); g.quadraticCurveTo(5.5, 0, 8.5, -2); g.stroke();
    }
    g.restore();
    g.restore();
  }

  function drawScene(t) {
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col.sky; g.fillRect(0, 0, W, H);
    if (dark) {
      g.fillStyle = "rgba(243,227,168,0.75)";
      for (const st of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.7 + st.x); g.beginPath(); g.arc(st.x, st.y, st.r, 0, 6.2832); g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = "#e9e1c8"; g.beginPath(); g.arc(W * 0.16, H * 0.22, 15, 0, 6.2832); g.fill();
      g.fillStyle = col.sky; g.beginPath(); g.arc(W * 0.16 + 6, H * 0.22 - 3, 13, 0, 6.2832); g.fill();
    } else {
      const sun = g.createRadialGradient(W * 0.18, floor, 4, W * 0.18, floor, H * 0.9);
      sun.addColorStop(0, "rgba(217,130,43,0.20)"); sun.addColorStop(1, "rgba(217,130,43,0)");
      g.fillStyle = sun; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(217,130,43,0.55)"; g.beginPath(); g.arc(W * 0.18, floor - 2, 22, Math.PI, 0); g.fill();
    }
    // far acacia on the horizon
    g.fillStyle = col.far;
    const ax = W * 0.58, ay = floor;
    g.fillRect(ax - 1.5, ay - 40, 3, 40);
    g.beginPath(); g.ellipse(ax, ay - 44, 46, 8, 0, 0, 6.2832); g.fill();
    // ground
    g.fillStyle = col.ground; g.fillRect(0, floor, W, H - floor);
    g.strokeStyle = col.line; g.lineWidth = 1; g.beginPath(); g.moveTo(0, floor + 0.5); g.lineTo(W, floor + 0.5); g.stroke();
    // termite mound
    g.fillStyle = col.mound;
    const m = mound;
    g.beginPath(); g.moveTo(m.x - m.w / 2, floor);
    g.bezierCurveTo(m.x - m.w * 0.35, floor - m.h * 0.7, m.x - m.w * 0.18, floor - m.h, m.x - m.w * 0.05, floor - m.h);
    g.bezierCurveTo(m.x + m.w * 0.12, floor - m.h * 1.02, m.x + m.w * 0.3, floor - m.h * 0.6, m.x + m.w / 2, floor);
    g.closePath(); g.fill();
    g.fillStyle = col.sky; g.globalAlpha = 0.45; g.beginPath(); g.ellipse(m.x - m.w * 0.08, floor - 12, m.w * 0.17, 12, 0, Math.PI, 0); g.fill(); g.globalAlpha = 1;
    // grass
    g.strokeStyle = col.grass; g.lineWidth = 1.2;
    for (const gr of grass) { g.beginPath(); g.moveTo(gr.x, floor); g.quadraticCurveTo(gr.x + gr.l * 3, floor - gr.h * 0.6, gr.x + gr.l * 5 + Math.sin(t * 1.3 + gr.x) * 1.5, floor - gr.h); g.stroke(); }
    // paw prints
    prints = prints.filter((pr) => t - pr.t < 3);
    for (const pr of prints) { g.fillStyle = col.spot; g.globalAlpha = 0.25 * (1 - (t - pr.t) / 3); g.beginPath(); g.ellipse(pr.x, floor + 6, 3.2 * s, 1.6 * s, 0, 0, 6.2832); g.fill(); }
    g.globalAlpha = 1;
    // shadow
    const sh = clamp(1 + cat.y / (90 * s), 0.3, 1);
    g.fillStyle = "rgba(20,12,6," + (dark ? 0.35 : 0.14) * sh + ")";
    g.beginPath(); g.ellipse(cat.x, floor + 3, 52 * s * sh, 5 * s * sh, 0, 0, 6.2832); g.fill();
  }

  function drawMoth(t) {
    if (!moth.on || moth.gone > 0) return;
    const g = ctx, flick = 0.65 + 0.35 * Math.sin(t * 9);
    const glow = g.createRadialGradient(moth.x, moth.y, 0, moth.x, moth.y, 18);
    glow.addColorStop(0, dark ? "rgba(243,227,168,0.55)" : "rgba(217,130,43,0.35)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(moth.x, moth.y, 18, 0, 6.2832); g.fill();
    g.fillStyle = col.moth; g.globalAlpha = flick; g.beginPath(); g.arc(moth.x, moth.y, 3, 0, 6.2832); g.fill(); g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- loop
  let raf = 0, last = now(), visible = true, sleepFrame = 0;
  function kick() { if (!raf && visible && !reduce) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    const t = now(), dt = Math.min(0.05, t - last); last = t;
    if (cat.state === "sleep" && !moth.on && (sleepFrame++ % 4)) { kick(); return; } // breathe at ~15fps
    think(dt);
    const before = [...cat.pose.fn, ...cat.pose.ff, ...cat.pose.hn, ...cat.pose.hf];
    blend(cat.pose, targetPose(), cat.state === "pounce" ? 1 - Math.exp(-dt * 18) : 1 - Math.exp(-dt * 11));
    // drop a fading paw print when a near foot lands
    if (Math.abs(cat.vx) > 8 && !cat.air) for (const [i, leg] of [[0, "fn"], [2, "hn"]]) {
      const was = before[i * 2 + 1], is = cat.pose[leg][1];
      if (was < -2 && is >= -0.5 && t - cat.lastStep[i] > 0.2) { cat.lastStep[i] = t; prints.push({ x: cat.x + cat.pose[leg][0] * s * cat.dir, t }); }
    }
    render(t);
    kick();
  }
  function render(t) {
    drawScene(t);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H);
    drawCat(lctx, cat.pose);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMoth(t);
  }

  function still() { // reduced motion: asleep at the mound, drawn once
    layout();
    cat.x = mound.x - mound.w * 0.05; cat.y = 0; cat.dir = -1; cat.state = "sleep";
    cat.pose = clone(POSES.loaf);
    render(now());
    say("Asleep in the termite mound.");
  }

  // ---------------------------------------------------------------- start
  if ("ResizeObserver" in window) new ResizeObserver(() => { layout(); if (reduce) still(); }).observe(cv);
  layout();
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; last = now(); kick(); });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting) && !document.hidden; last = now(); kick(); });
    io.observe(cv); window.__gyraIO = io;
  }
  mqDark.addEventListener && mqDark.addEventListener("change", (e) => { dark = e.matches; col = C(); if (reduce) still(); kick(); });
  mqReduce.addEventListener && mqReduce.addEventListener("change", (e) => { reduce = e.matches; if (reduce) still(); else kick(); });
  if (reduce) still(); else kick();

  // her tail flicks once when the footer comes into view
  const foot = document.querySelector(".foot");
  if (foot && "IntersectionObserver" in window) {
    const fo = new IntersectionObserver((es) => { if (es[0].isIntersecting) { foot.classList.add("seen"); fo.disconnect(); } }, { threshold: 0.5 });
    fo.observe(foot); window.__gyraFoot = fo;
  }
})();
