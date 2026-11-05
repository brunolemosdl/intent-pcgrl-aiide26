// AIIDE-26 deck engine. One fixed 1920×1080 stage; steps reveal [data-s]
// elements; a canvas of Mario tiles morphs between real generated levels.
import M from "./levels/manifest.js";
import CHUNKS from "./levels/chunks.js";
import { DATA } from "./charts.js";
import { SLIDES_URL } from "./links.js";

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const SL = [...document.querySelectorAll(".slide")];
const CAPTURE = new URLSearchParams(location.search).has("capture");
const byName = Object.fromEntries(M.cases.map((c) => [c.name, c]));
const last = (c) => c.frames[c.frames.length - 1];
const DIMS = ["enemies", "coins", "blocks", "pipes", "gaps", "verticality", "smoothness", "platforms"];
const f3 = (x) => x.toFixed(3);

/* ---------------- timers (cleared on every step change) ---------------- */
let TIMERS = [];
const later = (ms, fn) => { if (CAPTURE) return fn(); TIMERS.push(setTimeout(fn, ms)); };
const clearTimers = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };

/* ---------------- sprites ---------------- */
const SPR = { X: "solid", S: "brick", D: "used_block", o: "coin", g: "goomba", "?": "question_block_coin", Q: "question_block_empty",
  "<": "pipe_top_left", ">": "pipe_top_right", "[": "pipe_body_left", "]": "pipe_body_right", M: "player", F: "flagpole" };
const IMG = {};
for (const k in SPR) { const im = new Image(); im.src = SPR[k] === "flagpole" ? "" : `assets/sprites/${SPR[k]}.png`; IMG[k] = im; }

/* ---------------- tile particle field ---------------- */
const cv = $("tiles"), ctx = cv.getContext("2d");
let DPR = 1, P = new Map(), PANELS = new Map(), MARKS = [], markA = 0, markTA = 0;
const AMB = [];
let ambA = 1, ambTA = 1;
{
  const kinds = ["S", "?", "o", "X", "S", "o", "g", "Q"];
  for (let i = 0; i < 46; i++) {
    AMB.push({ ch: kinds[i % kinds.length], x: Math.random() * 1920, y: Math.random() * 1080, s: 22 + Math.random() * 22,
      a: 0.05 + Math.random() * 0.06, w: 0.15 + Math.random() * 0.3, ph: Math.random() * 6.28 });
  }
}
const now = () => performance.now();
function retarget(p, t) { p.tx = t.x; p.ty = t.y; p.ts = t.s; p.ta = 1; p.dead = false; p.start = now() + (t.d || 0); }
/** Move the field to a new set of tile targets {key, ch, x, y, s, d}. */
function setTiles(targets, panels = [], { fall = 70, morph = true } = {}) {
  const want = new Map(targets.map((t) => [t.key, t]));
  const next = new Map(), free = [];
  for (const [k, p] of P) {
    const t = want.get(k);
    if (t && !p.dead) { retarget(p, t); next.set(k, p); want.delete(k); } else free.push(p);
  }
  const pool = {};
  for (const p of free) if (!p.dead) (pool[p.ch] ??= []).push(p);
  for (const a of Object.values(pool)) a.sort((u, v) => u.x - v.x || u.y - v.y);
  const rest = [...want.values()].sort((u, v) => u.x - v.x || u.y - v.y);
  for (const t of rest) {
    const a = pool[t.ch];
    if (morph && a && a.length) { const p = a.shift(); p.key = t.key; retarget(p, t); next.set(t.key, p); }
    else next.set(t.key, { key: t.key, ch: t.ch, x: t.x, y: t.y - 70, s: t.s, ts: t.s, tx: t.x, ty: t.y, a: 0, ta: 1, start: now() + (t.d || 0) });
  }
  let n = 0;
  for (const a of Object.values(pool)) for (const p of a) { p.dead = true; p.ta = 0; p.ty = p.y + fall; p.start = now(); next.set(`~${n++}${p.key}`, p); }
  for (const p of free) if (p.dead && p.a > 0.01) next.set(`~${n++}${p.key}`, p);
  P = next;
  const pw = new Map(panels.map((q) => [q.key, q]));
  for (const [k, q] of PANELS) if (!pw.has(k)) q.ta = 0;
  for (const q of panels) { const o = PANELS.get(q.key); if (o) Object.assign(o, { x: q.x, y: q.y, w: q.w, h: q.h, ta: 1 }); else PANELS.set(q.key, { ...q, a: 0, ta: 1 }); }
  if (CAPTURE) snap();
}
function snap() { for (const p of P.values()) { p.x = p.tx; p.y = p.ty; p.s = p.ts; p.a = p.ta; p.start = 0; } for (const q of PANELS.values()) q.a = q.ta; markA = markTA; ambA = ambTA; }
/** Two stacked halves (76 columns each) keep a 152-column level readable. */
function levelLayout(rows, { x, y, tile, ns, cols = 152, gap = 18, wave = 0 }) {
  const half = 76, targets = [];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const ch = rows[r][c];
    if (ch === "-" || c >= cols || !SPR[ch]) continue;
    const h = c >= half ? 1 : 0, cc = c - h * half;
    targets.push({ key: `${ns}${ch}${c},${r}`, ch, x: x + cc * tile, y: y + h * (14 * tile + gap) + r * tile, s: tile, d: wave * c });
  }
  const panels = [0, 1].map((h) => ({ key: `${ns}panel${h}`, x, y: y + h * (14 * tile + gap), w: half * tile, h: 14 * tile }));
  return { targets, panels, cell: (c, r) => { const h = c >= half ? 1 : 0; return [x + (c - h * half) * tile, y + h * (14 * tile + gap) + r * tile]; } };
}
function showLevel(rows, geo, opts) { const L = levelLayout(rows, geo); setTiles(L.targets, L.panels, opts); return L; }
function clearLevel() { setTiles([], []); MARKS = []; markTA = 0; }

let lastT = now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const k = 1 - Math.pow(0.02, dt * 1.7);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, 1920, 1080);
  ctx.imageSmoothingEnabled = false;
  ambA += (ambTA - ambA) * k;
  for (const p of AMB) {
    const im = IMG[p.ch]; if (!im.complete || ambA < 0.01) continue;
    ctx.globalAlpha = p.a * ambA;
    ctx.drawImage(im, p.x + Math.sin(t / 1000 * p.w + p.ph) * 14, p.y + Math.cos(t / 1000 * p.w * 0.8 + p.ph) * 10, p.s, p.s);
  }
  for (const [key, q] of PANELS) {
    q.a += (q.ta - q.a) * k;
    if (q.ta === 0 && q.a < 0.01) { PANELS.delete(key); continue; }
    ctx.globalAlpha = q.a; ctx.fillStyle = "#5C94FC";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - 4, q.y - 4, q.w + 8, q.h + 8, 10) : ctx.rect(q.x, q.y, q.w, q.h); ctx.fill();
  }
  for (const [key, p] of P) {
    if (t >= p.start) {
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.s += (p.ts - p.s) * k;
      p.a += (p.ta - p.a) * Math.min(1, k * 1.4);
    }
    if (p.dead && p.a < 0.01) { P.delete(key); continue; }
    if (p.a < 0.01) continue;
    ctx.globalAlpha = p.a;
    if (p.ch === "F") { // flagpole: pole up 9 tiles + ball
      ctx.fillStyle = "#7CE07C"; ctx.fillRect(p.x + p.s * 0.44, p.y - p.s * 9, p.s * 0.12, p.s * 10);
      ctx.fillStyle = "#1E9E2E"; ctx.beginPath(); ctx.arc(p.x + p.s * 0.5, p.y - p.s * 9, p.s * 0.28, 0, 6.283); ctx.fill();
      continue;
    }
    const im = IMG[p.ch]; if (im.complete) ctx.drawImage(im, p.x, p.y, p.s, p.s);
  }
  markA += (markTA - markA) * k;
  if (markA > 0.01) for (const m of MARKS) {
    const pulse = 1 + 0.12 * Math.sin(t / 260 + m.x);
    ctx.globalAlpha = markA; ctx.strokeStyle = m.c; ctx.lineWidth = 4;
    if (m.w) { ctx.beginPath(); ctx.roundRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(m.x, m.y, m.r * pulse, 0, 6.283); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

/* ---------------- small UI helpers ---------------- */
let typeTok = 0;
function typeText(el, text, cps = 38) {
  const tok = ++typeTok;
  el.classList.add("caret");
  if (CAPTURE) { el.textContent = text; el.classList.remove("caret"); return; }
  el.textContent = "";
  let i = 0;
  const tick = () => { if (tok !== typeTok) return; el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 1000 / cps); else setTimeout(() => tok === typeTok && el.classList.remove("caret"), 900); };
  tick();
}
function tween(el, to, digits = 3, dur = 450) {
  const from = parseFloat(el.textContent) || 0, t0 = now();
  if (CAPTURE) { el.textContent = to.toFixed(digits); return; }
  const f = (t) => { const q = Math.min(1, (t - t0) / dur), v = from + (to - from) * (1 - Math.pow(1 - q, 3)); el.textContent = v.toFixed(digits); if (q < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
const ICON = { enemies: "goomba", coins: "coin", blocks: "question_block_coin", pipes: "pipe_top_left", gaps: null, verticality: null, smoothness: null, platforms: "brick" };
function makeGauges(el, labW = 150) {
  el.innerHTML = DIMS.map((d) => `<div class="gauge" style="grid-template-columns:${labW}px 1fr 58px"><span>${d}</span><div class="tr"><div class="m"></div><div class="t"></div></div><span class="v">0.00</span></div>`).join("");
  const G = [...el.children];
  return (target, measured) => G.forEach((g, i) => {
    const m = measured ? measured[i] : target[i];
    g.querySelector(".m").style.width = `${Math.max(0.6, m * 100)}%`;
    g.querySelector(".t").style.left = `${target[i] * 100}%`;
    g.querySelector(".v").textContent = m.toFixed(2);
    g.classList.toggle("ok", !!measured && Math.abs(m - target[i]) <= 0.05);
  });
}
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) k === "text" ? (e.textContent = attrs[k]) : e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const T = (p, x, y, s, a = {}) => svgEl("text", { x, y, fill: "var(--ink2)", "font-size": 24, "font-family": "Poppins", ...a, text: s }, p);

/* ---------------- hooks: one per slide, called on every step ---------------- */
const HOOK = {};
const GEO = { x: 120, y: 340, tile: 17 };

HOOK.title = () => { ambTA = 1; clearLevel(); };

// 2 · the ask
const FE = byName.flat_empty, FE_STITCH = FE.frames.find((f) => f.phase === "stitched");
HOOK.ask = (st, enter) => {
  ambTA = st ? 0.25 : 1;
  if (enter || st === 0) typeText($("askQ"), "“Make me a flat, empty, smooth level.”");
  else { $("askQ").textContent = "“Make me a flat, empty, smooth level.”"; $("askQ").classList.remove("caret"); }
  if (st === 0) return clearLevel();
  const L = showLevel(FE_STITCH.rows, { x: 120, y: 400, tile: 20, ns: "A", wave: 7 });
  MARKS = []; markTA = 0;
  const rows = FE_STITCH.rows, cnt = { enemies: 0, gaps: 0, coins: 0, blocks: 0 };
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === "g") { cnt.enemies++; const [x, y] = L.cell(c, r); MARKS.push({ x: x + 10, y: y + 10, r: 22, c: "#FF5A4E" }); }
    if (ch === "o") cnt.coins++;
    if ("S?QD".includes(ch)) cnt.blocks++;
  }));
  const bottom = rows[rows.length - 1];
  for (let c = 0; c < bottom.length; c++) if (bottom[c] !== "X" && (c === 0 || bottom[c - 1] === "X")) {
    let e = c; while (e < bottom.length && bottom[e] !== "X") e++;
    cnt.gaps++; const [x, y] = L.cell(c, 13); MARKS.push({ x, y: y - 20, w: (e - c) * 20, h: 40, c: "#FF5A4E" });
  }
  $("askCounts").innerHTML = Object.entries(cnt).map(([k, v]) => `<div style="margin-bottom:22px"><div class="num red" style="font-size:64px;line-height:1">${v}</div><div class="lbl" style="font-size:22px">${k}</div></div>`).join("");
  if (st >= 2) markTA = 1;
};

// 3 · corpus mosaic
const MZ = { cv: $("mosaic"), st: 0, t0: 0, raf: 0, thumbs: null };
MZ.cv.width = 2322; MZ.cv.height = 1118;
const COL = { X: "#C84C0C", S: "#B8501C", D: "#8C4A1A", "?": "#F8B800", Q: "#C08A40", o: "#FFD54A", g: "#E0442C", "<": "#2FB24C", ">": "#2FB24C", "[": "#249A3E", "]": "#249A3E", M: "#FF3B30", F: "#7CE07C" };
function mosaicThumbs() {
  return CHUNKS.map((c) => {
    const o = document.createElement("canvas"); o.width = 96; o.height = 84; const g = o.getContext("2d");
    g.fillStyle = "#5C94FC"; g.fillRect(0, 0, 96, 84);
    c.rows.forEach((row, r) => [...row].forEach((ch, x) => { if (COL[ch]) { g.fillStyle = COL[ch]; g.fillRect(x * 6, r * 6, 6, 6); } }));
    return o;
  });
}
function mosaicDraw(t) {
  const g = MZ.cv.getContext("2d"); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 1161, 559);
  CHUNKS.forEach((c, i) => {
    const col = i % 22, row = Math.floor(i / 22), x = col * 53, y = row * 47;
    const appear = Math.min(1, Math.max(0, (t - MZ.t0 - (col + row) * 28) / 300));
    let a = appear;
    if (MZ.st === 1) a *= c.enemy ? 1 : 0.3;
    if (MZ.st === 2) a *= c.flat_empty ? 1 : 0.22;
    g.globalAlpha = a; g.drawImage(MZ.thumbs[i], x, y, 48, 42);
    if ((MZ.st === 1 && c.enemy) || (MZ.st === 2 && c.flat_empty)) {
      g.globalAlpha = appear; g.strokeStyle = MZ.st === 1 ? "#FF5A4E" : "#FFC83D"; g.lineWidth = MZ.st === 1 ? 2 : 4;
      g.strokeRect(x - 1, y - 1, 50, 44);
    }
  });
  g.globalAlpha = 1;
  if (SL[si].dataset.hook === "mosaic" && !CAPTURE) MZ.raf = requestAnimationFrame(mosaicDraw);
}
HOOK.mosaic = (st, enter) => {
  ambTA = 0.25; clearLevel();
  MZ.thumbs ??= mosaicThumbs();
  if (enter) MZ.t0 = CAPTURE ? -1e9 : now();
  MZ.st = st; cancelAnimationFrame(MZ.raf);
  if (CAPTURE) { MZ.t0 = -1e9; mosaicDraw(0); } else MZ.raf = requestAnimationFrame(mosaicDraw);
};

// 4 · the idea: connectors + contract bars
{
  const s = $("ideaSvg");
  const arrow = (x1, x2, y, step) => { const g = svgEl("g", step == null ? {} : { "data-s": step }, s);
    svgEl("path", { d: `M${x1} ${y} H${x2 - 14}`, stroke: "var(--ink3)", "stroke-width": 4, fill: "none", class: "draw", pathLength: 1 }, g);
    svgEl("path", { d: `M${x2 - 16} ${y - 10} L${x2} ${y} L${x2 - 16} ${y + 10} Z`, fill: "var(--ink3)" }, g); };
  arrow(404, 446, 565, 0); arrow(654, 696, 565, 1); arrow(1204, 1246, 565, 2); arrow(1494, 1536, 565, 3);
  svgEl("path", { d: "M120 770 H650", stroke: "var(--ink3)", "stroke-width": 2, "stroke-dasharray": "6 8" }, s);
  const g2 = svgEl("g", { "data-s": 2 }, s); svgEl("path", { d: "M1250 770 H1800", stroke: "var(--ink3)", "stroke-width": 2, "stroke-dasharray": "6 8" }, g2);
  const vec = $("ideaVec"), tv = byName.peaceful.target;
  const icons = ["goomba", "coin", "question_block_coin", "pipe_top_left", null, null, null, "brick"];
  const short = ["enemy", "coin", "block", "pipe", "gap", "vert.", "smth.", "plat."];
  vec.insertAdjacentHTML("beforeend", `<div style="display:flex;gap:12px;align-items:flex-end;height:200px;margin-top:20px;padding:0 6px">${tv.map((v, i) =>
    `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px"><span class="mono" style="font-size:17px">${v.toFixed(2)}</span><div class="vb" style="width:100%;height:${Math.max(4, v * 150)}px;background:var(--gold);border-radius:6px 6px 0 0;transform-origin:bottom;transition:transform .8s cubic-bezier(.3,0,.2,1) ${i * 0.07}s"></div></div>`).join("")}</div>
    <div style="display:flex;gap:12px;padding:8px 6px 0">${short.map((n, i) => `<div style="flex:1;min-width:0;text-align:center;font-size:14px;color:var(--ink2)">${icons[i] ? `<img src="assets/sprites/${icons[i]}.png" style="width:22px;height:22px;image-rendering:pixelated;display:block;margin:0 auto 2px">` : '<div style="height:24px"></div>'}${n}</div>`).join("")}</div>`);
}
HOOK.idea = (st) => { ambTA = 0.35; clearLevel(); document.querySelectorAll("#ideaVec .vb").forEach((b) => (b.style.transform = `scaleY(${st >= 1 ? 1 : 0})`)); };

// 5 · episode
const epG = makeGauges($("epG"), 140);
const PH = { compose: ["compose", "var(--green)"], stitched: ["compose", "var(--green)"], edit: ["gated edit", "var(--purple)"], polish: ["polish", "var(--gold)"] };
function epShow(i) {
  const f = FE.frames[i];
  showLevel(f.rows, { ...GEO, ns: "E", cols: f.phase === "compose" ? f.cols : 152, wave: f.phase === "compose" ? 0 : 3 }, { fall: 90 });
  const [lab, col] = PH[f.phase];
  $("epPhase").textContent = lab; $("epPhase").style.color = col;
  $("epOp").textContent = f.op ? f.op.replace(/_/g, " ") : f.phase === "compose" ? `${f.cols} columns placed` : f.phase === "stitched" ? "level stitched" : "every dimension checked";
  tween($("epErr"), f.error); epG(FE.target, f.measured);
}
function epPlay(a, b, ms) { for (let i = a, k = 0; i <= b; i++, k++) later(k * ms, () => epShow(i)); }
HOOK.episode = (st) => {
  ambTA = 0.15; MARKS = []; markTA = 0;
  const S = FE.frames.findIndex((f) => f.phase === "stitched"), E = FE.frames.length - 2, Pn = FE.frames.length - 1;
  if (st === 0) epPlay(0, S, 620);
  if (st === 1) epPlay(S, E, 700);
  if (st === 2) epShow(Pn);
};

// 6 · sweep
const SW = [...M.sweeps.enemies].sort((a, b) => a.target[0] - b.target[0]);
function swShow(i) {
  const c = SW[i], f = last(c);
  showLevel(f.rows, { ...GEO, ns: "W", wave: 2 }, { fall: 90 });
  tween($("swT"), c.target[0], 2); tween($("swN"), f.rows.join("").split("g").length - 1, 0);
}
HOOK.sweep = (st) => {
  ambTA = 0.15; MARKS = []; markTA = 0;
  if (st === 0) swShow(0);
  if (st === 1) for (let i = 1; i < SW.length; i++) later((i - 1) * 1500, () => swShow(i));
  if (st === 2) swShow(SW.length - 1);
};

// 7 · results charts (slide coordinates)
{
  const s = $("resSvg");
  // RQ1: dot + whisker, reward axis 5–9
  const g1 = svgEl("g", { "data-u": 0 }, s);
  const x = (v) => 440 + ((v - 5) / 4) * 820, top = 360, rh = 60;
  for (const v of [5, 6, 7, 8, 9]) { svgEl("line", { x1: x(v), x2: x(v), y1: top - 10, y2: top + rh * 9, stroke: "rgba(255,255,255,.08)", "stroke-width": 2 }, g1); T(g1, x(v), top + rh * 9 + 34, v, { "text-anchor": "middle", fill: "var(--ink3)", "font-size": 22 }); }
  T(g1, x(7), top + rh * 9 + 72, "terminal reward  ↑", { "text-anchor": "middle", "font-size": 22, fill: "var(--ink2)" });
  svgEl("line", { x1: x(6.87), x2: x(6.87), y1: top - 20, y2: top + rh * 9, stroke: "var(--red)", "stroke-width": 2, "stroke-dasharray": "8 8", opacity: 0.6 }, g1);
  T(g1, 1340, top - 22, "reward", { "text-anchor": "end", fill: "var(--ink3)", "font-size": 18 });
  const colr = { base: "#7B82A8", beam: "#FF5A4E", med: "#8B93FF", fin: "#3DDC84" };
  DATA.rq1.forEach((r, i) => {
    const y = top + rh * i + rh / 2, c = colr[r.g], strong = r.g !== "base";
    T(g1, 410, y + 8, r.sys, { "text-anchor": "end", fill: strong ? "var(--ink)" : "var(--ink2)", "font-weight": strong ? 600 : 400, "font-size": 25 });
    const gg = svgEl("g", { style: `transition:opacity .5s ${0.2 + i * 0.09}s` }, g1);
    svgEl("line", { x1: x(r.r - r.sd), x2: x(r.r + r.sd), y1: y, y2: y, stroke: c, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.55 }, gg);
    svgEl("circle", { cx: x(r.r), cy: y, r: 11, fill: c, stroke: "var(--bg)", "stroke-width": 4 }, gg);
    T(gg, 1340, y + 8, r.r.toFixed(2), { "text-anchor": "end", fill: strong ? "var(--ink)" : "var(--ink3)", "font-size": 23, "font-weight": strong ? 600 : 400, "font-family": "ui-monospace, Menlo, monospace" });
  });
  // RQ3: slope chart
  const g3 = svgEl("g", { "data-s": 1, "data-u": 1 }, s);
  const X1 = 420, X2 = 920, y3 = (v) => 900 - ((v - 0.03) / 0.16) * 520;
  for (const v of [0.05, 0.1, 0.15]) { svgEl("line", { x1: X1, x2: X2, y1: y3(v), y2: y3(v), stroke: "rgba(255,255,255,.08)", "stroke-width": 2 }, g3); T(g3, X1 - 150, y3(v) + 8, v.toFixed(2), { fill: "var(--ink3)", "font-size": 20 }); }
  T(g3, X1, 960, "standard targets", { "text-anchor": "middle", "font-size": 24, fill: "var(--ink)" });
  T(g3, X2, 960, "corpus-hostile targets", { "text-anchor": "middle", "font-size": 24, fill: "var(--ink)" });
  const cc = { red: "#FF5A4E", gold: "#FFC83D", indigo: "#8B93FF", green: "#3DDC84" };
  const spread = (ys) => { const o = ys.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), r = [...ys]; for (let k = 1; k < o.length; k++) if (r[o[k][1]] - r[o[k - 1][1]] < 34) r[o[k][1]] = r[o[k - 1][1]] + 34; return r; };
  const LA = spread(DATA.rq3.map((r) => y3(r.a))), LB = spread(DATA.rq3.map((r) => y3(r.b)));
  DATA.rq3.forEach((r, i) => {
    const c = cc[r.c];
    svgEl("path", { d: `M${X1} ${y3(r.a)} L${X2} ${y3(r.b)}`, stroke: c, "stroke-width": 6, "stroke-linecap": "round", fill: "none", class: "draw", pathLength: 1, style: `transition-delay:${0.2 + i * 0.15}s` }, g3);
    svgEl("circle", { cx: X1, cy: y3(r.a), r: 10, fill: c, stroke: "var(--bg)", "stroke-width": 4 }, g3);
    svgEl("circle", { cx: X2, cy: y3(r.b), r: 10, fill: c, stroke: "var(--bg)", "stroke-width": 4 }, g3);
    T(g3, X1 - 26, LA[i] + 8, r.a.toFixed(3), { "text-anchor": "end", fill: "var(--ink2)", "font-size": 22, "font-family": "ui-monospace, Menlo, monospace" });
    T(g3, X2 + 26, LB[i] + 8, `${r.b.toFixed(3)}  ${r.s}`, { fill: "var(--ink)", "font-size": 24, "font-weight": r.s === "Compose + edit" ? 700 : 400 });
  });
  T(g3, X1 - 150, 330, "mean intent error ↓", { fill: "var(--ink3)", "font-size": 20 });
  // RQ4: monotonic lines
  const g4 = svgEl("g", { "data-s": 2 }, s);
  const bx = (i) => 440 + i * 190, by = (v) => 880 - v * 500, bands = ["“none”", "few", "some", "many", "“max”"];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { svgEl("line", { x1: 420, x2: 1220, y1: by(v), y2: by(v), stroke: "rgba(255,255,255,.08)", "stroke-width": 2 }, g4); T(g4, 400, by(v) + 8, v === 0 ? "0" : String(v).replace(/^0/, ""), { "text-anchor": "end", fill: "var(--ink3)", "font-size": 20 }); }
  bands.forEach((b, i) => T(g4, bx(i), 930, b, { "text-anchor": "middle", "font-size": 24, fill: "var(--ink)" }));
  T(g4, 830, 975, "intensity word in the request", { "text-anchor": "middle", "font-size": 21, fill: "var(--ink3)" });
  T(g4, 400, 350, "measured density", { "text-anchor": "end", fill: "var(--ink3)", "font-size": 20 });
  const cl = { red: "#FF5A4E", indigo: "#8B93FF", green: "#3DDC84", gold: "#FFC83D" };
  const ends = DATA.rq4.map((r) => by(r.v[4])); const E2 = spread(ends);
  DATA.rq4.forEach((r, i) => {
    svgEl("polyline", { points: r.v.map((v, j) => `${bx(j)},${by(v)}`).join(" "), stroke: cl[r.c], "stroke-width": 6, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round", class: "draw", pathLength: 1, style: `transition-delay:${0.15 * i}s` }, g4);
    r.v.forEach((v, j) => svgEl("circle", { cx: bx(j), cy: by(v), r: 8, fill: cl[r.c], stroke: "var(--bg)", "stroke-width": 3 }, g4));
    T(g4, bx(4) + 24, E2[i] + 8, `${r.d}  ρ=${r.rho}`, { fill: "var(--ink)", "font-size": 23 });
  });
}
const RES_SRC = [
  "36-target suite (12 intents × 3 seeds); mean ± std. Medium tier = 1.5M steps (3 seeds); final = 10M steps.",
  "Medium tier, seed 42, best-of-5. Corpus-hostile suite: six corner targets (e.g. flat-empty), n = 18.",
  "Final model; 5 intensity bands × 3 seeds per density dimension. Translation: 46 reference-scored descriptions.",
];
HOOK.results = (st) => { ambTA = 0.3; clearLevel(); $("resSrc").textContent = RES_SRC[st]; };

// 8 · ask & get
const DEMO = ["coins", "vertical", "pipes"].filter((n) => byName[n]);
const dmG = makeGauges($("dmG"), 150);
HOOK.demo = (st) => {
  ambTA = 0.15; MARKS = []; markTA = 0;
  const c = byName[DEMO[Math.min(st, DEMO.length - 1)]], f = last(c);
  typeText($("dmQ"), `“${c.prompt}”`, 45);
  dmG(c.target, null);
  later(CAPTURE ? 0 : 500, () => { showLevel(f.rows, { x: 120, y: 350, tile: 14, gap: 16, ns: "D", wave: 4 }); dmG(c.target, f.measured); });
  $("dmPlay").src = CAPTURE ? `assets/gameplay/${c.name}_still.png` : `assets/gameplay/${c.name}.webp`;
  $("dmCap").textContent = `error ${f3(f.error)} · A* agent finished ✓`;
};

// 9 · end
{
  const q = qrcode(0, "M"); q.addData(SLIDES_URL); q.make();
  $("qrEnd").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $("qrEnd").querySelector("svg").style.cssText = "width:100%;height:100%;display:block";
}
HOOK.end = () => { ambTA = 1; clearLevel(); };

// title gameplay
document.querySelectorAll("[data-play]").forEach((im) => (im.src = CAPTURE ? `assets/gameplay/${im.dataset.play}_still.png` : `assets/gameplay/${im.dataset.play}.webp`));

/* ---------------- speaker notes (≈ 5 min) ---------------- */
const NOTES = [
  "[0:00–0:20] Hi, I'm Bruno, from UFMG. Our question: when a designer asks a generator for a level, did they get the level they asked for? On the right, someone typed “packed with enemies and wide pits”; our system built this level, and an A* agent is playing it.",
  "[0:20–0:50] Say a designer asks for a flat, empty, smooth level. (click) A generator that recombines corpus material hands back this. (click) Enemies, gaps, coins and hills nobody asked for.",
  "[0:50–1:20] Why? (click) Our corpus has 264 chunks, and 190 contain an enemy. (click) Not a single middle chunk is flat and empty. No recombination can satisfy that request: generators are material-bound.",
  "[1:20–2:00] So we split the job. (click) An LLM, GPT-5.2, translates the request into eight numbers: enemies, coins, blocks, pipes, gaps, verticality, smoothness, platforms. That vector is the contract. (click) A MaskablePPO policy builds the level, (click) and an external A* agent must finish it before release. (click) The LLM never touches a tile, so we measure translation and generation error separately.",
  "[2:00–2:40] A real episode for the flat-empty request. The policy composes corpus chunks; watch the error rise as the corpus brings enemies and gaps. (click) The same policy then switches to macro-edits: remove enemies, fill gaps, strip coins; any edit that breaks the level is reverted. (click) Polish closes the residual.",
  "[2:40–3:10] That gives control at the boundaries. Enemy target zero: zero goombas. (click) Up to one: as many as the level supports. (click) The final policy passes all eight dimension sweeps.",
  "[3:10–3:55] Results. Learning beats beam search over the same chunks by about one reward point on all three seeds, seven times faster. (click) On corpus-hostile requests, editing cuts the error by 30% versus composing alone. (click) And the language bridge translates with mean error 0.053, monotonic from “none” to “max”.",
  "[3:55–4:30] And it works from free text. “Coin heaven” gets coins. (click) A vertical climbing stage gets height and platforms. (click) A garden of pipes gets pipes. Every level is completed by the A* agent.",
  "[4:30–5:00] Takeaway: the request becomes a numeric contract. (click) When something goes wrong, you know whether translation missed, the generator missed, or the targets conflict. (click) Come see the poster for the full flow, the limitations and what comes next. Thank you!",
];

/* ---------------- navigation ---------------- */
let si = 0, st = 0, t0 = null;
const steps = (s) => +(s.dataset.steps || 0);
function render(enter) {
  const s = SL[si];
  SL.forEach((x, i) => x.classList.toggle("active", i === si));
  s.querySelectorAll("[data-s]").forEach((e) => e.classList.toggle("on", st >= +e.dataset.s));
  s.querySelectorAll("[data-u]").forEach((e) => e.classList.toggle("off", st > +e.dataset.u));
  $("pg").textContent = `${String(si + 1).padStart(2, "0")} / ${String(SL.length).padStart(2, "0")}`;
  if (!CAPTURE) history.replaceState(null, "", `#${si + 1}.${st}`);
  clearTimers();
  const h = HOOK[s.dataset.hook]; if (h) h(st, enter);
  $("nTitle").textContent = `${si + 1}/${SL.length}`; $("nText").textContent = NOTES[si] || "";
}
function next() { if (t0 == null) t0 = now(); if (st < steps(SL[si])) { st++; render(false); } else if (si < SL.length - 1) { si++; st = 0; render(true); } }
function prev() { if (st > 0) { st--; render(false); } else if (si > 0) { si--; st = steps(SL[si]); render(true); } }
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
  else if (["ArrowLeft", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
  else if (k === "Home") { si = 0; st = 0; render(true); }
  else if (k === "End") { si = SL.length - 1; st = 0; render(true); }
  else if (k === "n" || k === "N") $("notes").classList.toggle("show");
  else if (k === "r" || k === "R") t0 = now();
  else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  else if (k === "?" || k === "h" || k === "H") { const h = $("help"); h.style.opacity = h.style.opacity === "1" ? "0" : "1"; }
});
document.addEventListener("click", (e) => { if (e.target.closest("#notes")) return; e.clientX > innerWidth * 0.25 ? next() : prev(); });
let tx = null;
addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
addEventListener("touchend", (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); }, { passive: true });
setInterval(() => {
  if (t0 == null) return;
  const left = 300 - Math.floor((now() - t0) / 1000), a = Math.abs(left);
  $("nTimer").textContent = `${left < 0 ? "−" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
  $("nTimer").style.color = left < 30 ? "var(--red)" : "var(--gold)";
}, 250);
function fit() {
  const sc = Math.min(innerWidth / 1920, innerHeight / 1080);
  $("stage").style.transform = `translate(-50%,-50%) scale(${sc})`;
  DPR = Math.min(2.5, (devicePixelRatio || 1) * sc);
  cv.width = 1920 * DPR; cv.height = 1080 * DPR;
}
addEventListener("resize", fit); fit();
const h0 = (location.hash || "").slice(1).split(".");
if (h0[0]) { si = Math.max(0, Math.min(SL.length - 1, (+h0[0] || 1) - 1)); st = Math.min(+h0[1] || 0, steps(SL[si])); }
if (CAPTURE) document.body.classList.add("capture");
render(true);
requestAnimationFrame(frame);
setTimeout(() => { if (!CAPTURE && si === 0) { $("help").style.opacity = "1"; setTimeout(() => ($("help").style.opacity = "0"), 4000); } }, 800);
// exposed for the PDF exporter
window.deck = { go: (i, s) => { si = i; st = s; render(true); }, n: () => SL.length, steps: (i) => steps(SL[i]), snap };
document.body.dataset.ready = "1";
