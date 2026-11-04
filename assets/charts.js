// Shared SVG charts for the poster (print) and the slides (screen).
// Every number below is copied from the camera-ready paper.
// Units are abstract: the caller sets the SVG's CSS width; `fs` is the base
// font size in the same units as `w`/`h`.

export const C = {
  red: "#DC2626", indigo: "#6366F1", gold: "#B98900", green: "#0E9F6E",
  ink: "#111418", ink2: "#4A5260", muted: "#7B8494", grid: "#E3E6EB", base: "#9AA3B2",
  gray: "#A3AAB6", surface: "#FFFFFF",
};

export const DATA = {
  // Fig. "Search baselines vs. the two-phase policy" (36-target suite)
  rq1: [
    { sys: "Markov", r: 5.85, sd: 0.77, e: 0.289, g: "base" },
    { sys: "Random", r: 6.02, sd: 1.09, e: 0.218, g: "base" },
    { sys: "Replay", r: 6.06, sd: 0.50, e: 0.338, g: "base" },
    { sys: "Greedy", r: 6.18, sd: 0.91, e: 0.208, g: "base" },
    { sys: "Beam w=8", r: 6.87, sd: 0.38, e: 0.138, g: "beam" },
    { sys: "PPO 1.5M", r: 7.80, sd: 0.20, e: 0.075, g: "med" },
    { sys: "+ best-of-5", r: 7.90, sd: 0.17, e: 0.065, g: "med" },
    { sys: "PPO 10M", r: 8.12, sd: 0.13, e: 0.035, g: "fin" },
    { sys: "+ polish", r: 8.05, sd: 0.33, e: 0.029, g: "fin" },
  ],
  // Fig. "Final-tier sweep error" (10M, seed 42)
  rq2: [
    { d: "enemies", raw: 0.048, pol: 0.017 },
    { d: "coins", raw: 0.036, pol: 0.015 },
    { d: "blocks", raw: 0.038, pol: 0.017 },
    { d: "pipes", raw: 0.055, pol: 0.022 },
    { d: "gaps", raw: 0.029, pol: 0.019 },
    { d: "verticality", raw: 0.073, pol: 0.103 },
    { d: "smoothness", raw: 0.057, pol: 0.141 },
    { d: "platforms", raw: 0.029, pol: 0.046 },
  ],
  // Fig. "Edit-phase ablation" (standard vs corpus-hostile suite)
  rq3: [
    { s: "Beam search", a: 0.138, b: 0.180, c: "red" },
    { s: "Compose-only", a: 0.075, b: 0.111, c: "gold" },
    { s: "Compose + edit", a: 0.062, b: 0.078, c: "indigo" },
    { s: "+ polish", a: 0.045, b: 0.045, c: "green" },
  ],
  // Fig. "Impact monotonicity" (final model, 5 bands x 3 seeds)
  rq4: [
    { d: "enemies", rho: ".99", v: [0.159, 0.252, 0.412, 0.717, 0.850], c: "red", m: "circle" },
    { d: "blocks", rho: ".99", v: [0.109, 0.197, 0.394, 0.715, 0.941], c: "indigo", m: "square" },
    { d: "pipes", rho: ".97", v: [0.156, 0.234, 0.390, 0.659, 0.667], c: "green", m: "diamond" },
    { d: "coins", rho: ".97", v: [0.080, 0.221, 0.382, 0.543, 0.563], c: "gold", m: "triangle" },
  ],
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f3 = (x) => x.toFixed(3).replace(/^0/, "");
const t = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.fs}" fill="${o.fill || C.ink2}" text-anchor="${o.a || "start"}"` +
  ` font-weight="${o.w || 400}" dominant-baseline="${o.b || "middle"}"${o.mono ? ' font-family="var(--mono)"' : ""}>${esc(s)}</text>`;
const svg = (w, h, body, label) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">${body}</svg>`;
// Horizontal bar with a rounded data end and a square baseline end.
const hbar = (x0, y, len, th, fill, r, tip) => {
  r = Math.min(r, th / 2, len);
  const x1 = x0 + len;
  return `<path d="M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + th - r} Q${x1},${y + th} ${x1 - r},${y + th} H${x0} Z" fill="${fill}"${tip ? ` data-tip="${esc(tip)}"` : ""}/>`;
};
const marker = (shape, x, y, r, fill, ring) => {
  const st = `fill="${fill}" stroke="${ring}" stroke-width="${r * 0.45}"`;
  if (shape === "square") return `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="${r * 0.25}" ${st}/>`;
  if (shape === "diamond") return `<path d="M${x},${y - r * 1.2} L${x + r * 1.2},${y} L${x},${y + r * 1.2} L${x - r * 1.2},${y} Z" ${st}/>`;
  if (shape === "triangle") return `<path d="M${x},${y - r * 1.25} L${x + r * 1.15},${y + r * 0.85} L${x - r * 1.15},${y + r * 0.85} Z" ${st}/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" ${st}/>`;
};

/** RQ1: reward (dot ± sd) and intent error (bars), shared system rows. */
export function rq1({ w = 400, h = 210, fs = 9 } = {}) {
  const rows = DATA.rq1, labW = fs * 6.4, gap = fs * 2.2, top = fs * 1.6, bot = fs * 2.6;
  const pw1 = (w - labW - gap) * 0.56, pw2 = (w - labW - gap) * 0.44;
  const x1 = labW, x2 = labW + pw1 + gap, rowH = (h - top - bot) / rows.length;
  const col = (g) => (g === "beam" ? C.red : g === "med" ? C.indigo : g === "fin" ? C.green : C.gray);
  const rx = (v) => x1 + ((v - 5) / (9 - 5)) * pw1;
  const ex = (v) => x2 + (v / 0.44) * pw2;
  let b = "";
  // grid + ticks
  for (const v of [5, 6, 7, 8, 9]) b += `<line x1="${rx(v)}" x2="${rx(v)}" y1="${top}" y2="${h - bot}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>` + t(rx(v), h - bot + fs * 0.9, v, { fs: fs * 0.85, a: "middle", fill: C.muted });
  for (const v of [0, 0.1, 0.2, 0.3]) b += `<line x1="${ex(v)}" x2="${ex(v)}" y1="${top}" y2="${h - bot}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>` + t(ex(v), h - bot + fs * 0.9, v === 0 ? "0" : f3(v).slice(0, 2), { fs: fs * 0.85, a: "middle", fill: C.muted });
  b += t(x1 + pw1 / 2, h - fs * 0.5, "terminal reward  ↑", { fs: fs * 0.9, a: "middle", fill: C.ink2, w: 600 });
  b += t(x2 + pw2 / 2, h - fs * 0.5, "mean intent error  ↓", { fs: fs * 0.9, a: "middle", fill: C.ink2, w: 600 });
  b += `<line x1="${rx(6.87)}" x2="${rx(6.87)}" y1="${top - fs * 0.6}" y2="${h - bot}" stroke="${C.red}" stroke-width="${fs * 0.12}" stroke-dasharray="${fs * 0.4} ${fs * 0.3}"/>`;
  b += t(rx(6.87), top - fs * 1.0, "beam", { fs: fs * 0.8, a: "middle", fill: C.ink2 });
  rows.forEach((r, i) => {
    const cy = top + rowH * (i + 0.5), c = col(r.g), strong = r.g !== "base";
    if (i === 5 || i === 7) b += `<line x1="0" x2="${w}" y1="${top + rowH * i}" y2="${top + rowH * i}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>`;
    b += t(labW - fs * 0.6, cy, r.sys, { fs: fs * 0.95, a: "end", fill: strong ? C.ink : C.ink2, w: strong ? 650 : 400 });
    b += `<line x1="${rx(r.r - r.sd)}" x2="${rx(r.r + r.sd)}" y1="${cy}" y2="${cy}" stroke="${c}" stroke-width="${fs * 0.2}" stroke-linecap="round"/>`;
    b += `<g data-tip="${esc(`${r.sys}: reward ${r.r.toFixed(2)} ± ${r.sd.toFixed(2)}`)}">${marker("circle", rx(r.r), cy, fs * 0.42, c, C.surface)}</g>`;
    const th = Math.min(rowH * 0.56, fs * 1.4);
    b += hbar(x2, cy - th / 2, ex(r.e) - x2, th, c, fs * 0.3, `${r.sys}: intent error ${f3(r.e)}`);
    b += t(ex(r.e) + fs * 0.4, cy, f3(r.e), { fs: fs * 0.85, fill: strong ? C.ink : C.muted, w: strong ? 650 : 400, mono: true });
  });
  return svg(w, h, b, "Terminal reward and intent error for baselines and PPO policies");
}

/** RQ2: per-dimension sweep MAE, raw vs polished, tolerance line. */
export function rq2({ w = 400, h = 230, fs = 9 } = {}) {
  const rows = DATA.rq2, labW = fs * 6.2, top = fs * 2.6, bot = fs * 2.4;
  const pw = w - labW - fs * 4.2, rowH = (h - top - bot) / rows.length, max = 0.16;
  const x = (v) => labW + (v / max) * pw;
  const th = Math.min(rowH * 0.36, fs * 1.1);
  let b = "";
  for (const v of [0, 0.05, 0.1, 0.15]) b += `<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${h - bot}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>` + t(x(v), h - bot + fs * 0.9, v === 0 ? "0" : f3(v).replace(/0$/, ""), { fs: fs * 0.85, a: "middle", fill: C.muted });
  b += t(labW + pw / 2, h - fs * 0.4, "mean abs. error across the 0→1 sweep  ↓", { fs: fs * 0.9, a: "middle", w: 600 });
  // legend
  const lg = (lx, c, s) => `<rect x="${lx}" y="${fs * 0.35}" width="${fs * 1.1}" height="${fs * 0.8}" rx="${fs * 0.2}" fill="${c}"/>` + t(lx + fs * 1.5, fs * 0.78, s, { fs: fs * 0.9 });
  b += lg(labW, C.indigo, "raw policy") + lg(labW + fs * 8, C.green, "policy + polish");
  rows.forEach((r, i) => {
    const cy = top + rowH * (i + 0.5);
    b += t(labW - fs * 0.6, cy, r.d, { fs: fs * 0.95, a: "end", fill: C.ink });
    b += hbar(labW, cy - th - fs * 0.06, x(r.raw) - labW, th, C.indigo, fs * 0.25, `${r.d}: raw ${f3(r.raw)}`);
    b += hbar(labW, cy + fs * 0.06, x(r.pol) - labW, th, C.green, fs * 0.25, `${r.d}: polished ${f3(r.pol)}`);
    const over = r.pol > 0.1;
    b += t(x(Math.max(r.raw, r.pol)) + fs * 0.4, cy, over ? `${f3(r.pol)} ▲` : "", { fs: fs * 0.8, fill: C.ink2, mono: true });
  });
  b += `<line x1="${x(0.1)}" x2="${x(0.1)}" y1="${top - fs * 0.8}" y2="${h - bot}" stroke="${C.red}" stroke-width="${fs * 0.14}" stroke-dasharray="${fs * 0.4} ${fs * 0.3}"/>`;
  b += t(x(0.1) + fs * 0.3, top - fs * 0.8, "pass ≤ 0.10", { fs: fs * 0.8, fill: C.ink2 });
  return svg(w, h, b, "Controllability sweep error per dimension");
}

/** RQ3: slope chart, standard -> corpus-hostile suite. */
export function rq3({ w = 400, h = 220, fs = 9 } = {}) {
  const top = fs * 1.2, bot = fs * 3.0, lx = fs * 8.5, rx = w - fs * 11;
  const y = (v) => top + (1 - (v - 0.03) / (0.19 - 0.03)) * (h - top - bot);
  // spread labels that would collide (min gap = 1.05 × font size)
  const spread = (ys) => {
    const idx = ys.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), out = [...ys];
    for (let k = 1; k < idx.length; k++) {
      const prev = out[idx[k - 1][1]];
      if (out[idx[k][1]] - prev < fs * 1.2) out[idx[k][1]] = prev + fs * 1.2;
    }
    return out;
  };
  const L = spread(DATA.rq3.map((r) => y(r.a))), R = spread(DATA.rq3.map((r) => y(r.b)));
  let b = "";
  for (const v of [0.05, 0.1, 0.15]) b += `<line x1="${lx}" x2="${rx}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>`;
  b += t(lx, h - fs * 0.6, "standard", { fs: fs * 0.95, a: "middle", w: 600 });
  b += t(rx, h - fs * 0.6, "corpus-hostile", { fs: fs * 0.95, a: "middle", w: 600 });
  DATA.rq3.forEach((r, i) => {
    const c = C[r.c];
    b += `<line x1="${lx}" y1="${y(r.a)}" x2="${rx}" y2="${y(r.b)}" stroke="${c}" stroke-width="${fs * 0.26}" stroke-linecap="round"/>`;
    b += `<g data-tip="${esc(`${r.s}: ${f3(r.a)} → ${f3(r.b)}`)}">${marker("circle", lx, y(r.a), fs * 0.45, c, C.surface)}${marker("circle", rx, y(r.b), fs * 0.45, c, C.surface)}</g>`;
    b += t(lx - fs * 0.9, L[i], f3(r.a), { fs: fs * 0.85, a: "end", mono: true });
    b += t(rx + fs * 0.9, R[i], `${f3(r.b)}  ${r.s}`, { fs: fs * 0.9, fill: C.ink, w: r.s === "Compose + edit" ? 700 : 400 });
  });
  b += t(lx - fs * 0.9, top - fs * 0.1, "intent error ↓", { fs: fs * 0.8, a: "end", fill: C.muted });
  return svg(w, h, b, "Intent error on standard vs corpus-hostile suites");
}

/** RQ4: requested band -> measured density for four dimensions. */
export function rq4({ w = 400, h = 220, fs = 9 } = {}) {
  const lx = fs * 3.2, rx = w - fs * 8.2, top = fs * 1.0, bot = fs * 2.8;
  const x = (i) => lx + (i / 4) * (rx - lx), y = (v) => top + (1 - v) * (h - top - bot);
  const bands = ["“none”", "few", "some", "many", "“max”"];
  let b = "";
  for (const v of [0, 0.25, 0.5, 0.75, 1]) b += `<line x1="${lx}" x2="${rx}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="${fs * 0.08}"/>` + t(lx - fs * 0.5, y(v), v === 0 ? "0" : v === 1 ? "1" : String(v).replace(/^0/, ""), { fs: fs * 0.8, a: "end", fill: C.muted });
  bands.forEach((s, i) => (b += t(x(i), h - bot + fs * 1.0, s, { fs: fs * 0.85, a: "middle", fill: C.ink2 })));
  b += t((lx + rx) / 2, h - fs * 0.3, "intensity word in the request", { fs: fs * 0.9, a: "middle", w: 600 });
  const ends = [];
  for (const r of DATA.rq4) {
    const c = C[r.c];
    b += `<polyline points="${r.v.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="${fs * 0.24}" stroke-linejoin="round" stroke-linecap="round"/>`;
    r.v.forEach((v, i) => (b += `<g data-tip="${esc(`${r.d} @ ${bands[i]}: ${f3(v)}`)}">${marker(r.m, x(i), y(v), fs * 0.4, c, C.surface)}</g>`));
    ends.push({ y: y(r.v[4]), s: `${r.d}  ρ=${r.rho}` });
  }
  ends.sort((a, b2) => a.y - b2.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < fs * 1.15) ends[i].y = ends[i - 1].y + fs * 1.15;
  ends.forEach((e) => (b += t(rx + fs * 0.9, e.y, e.s, { fs: fs * 0.9, fill: C.ink })));
  b += t(lx - fs * 0.5, top - fs * 0.2, "", { fs });
  return svg(w, h, b, "Measured density rises monotonically with the requested intensity");
}

/** Mean intent error after every decision of one episode, shaded by phase. */
export function errorTrace(frames, { w = 400, h = 120, fs = 9, dark = false } = {}) {
  const ink = dark ? "#F4F5F7" : C.ink, ink2 = dark ? "#C3C8D1" : C.ink2, grid = dark ? "#2C313B" : C.grid;
  const lx = fs * 3.4, rx = w - fs * 3.6, top = fs * 2.2, bot = fs * 1.9;
  const n = frames.length, maxE = Math.max(0.1, ...frames.map((f) => f.error)) * 1.08;
  const x = (i) => lx + (i / (n - 1)) * (rx - lx), y = (v) => top + (1 - v / maxE) * (h - top - bot);
  const PH = { compose: ["compose", C.green], stitched: ["compose", C.green], edit: ["gated edit", "#7E3AF2"], polish: ["polish", C.gold] };
  let b = "";
  let s = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || PH[frames[i].phase][0] !== PH[frames[s].phase][0]) {
      const [lab, col] = PH[frames[s].phase];
      const x0 = s === 0 ? lx : (x(s - 1) + x(s)) / 2, x1 = i === n ? rx : (x(i - 1) + x(i)) / 2;
      b += `<rect x="${x0}" y="${top - fs * 0.4}" width="${x1 - x0}" height="${h - top - bot + fs * 0.4}" fill="${col}" opacity="${dark ? 0.16 : 0.09}"/>`;
      b += t((x0 + x1) / 2, top - fs * 1.2, lab, { fs: fs * 0.9, a: "middle", fill: ink, w: 700 });
      s = i;
    }
  }
  for (const v of [0, 0.05]) b += `<line x1="${lx}" x2="${rx}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}" stroke-width="${fs * 0.08}"/>` + t(lx - fs * 0.5, y(v), v === 0 ? "0" : ".05", { fs: fs * 0.8, a: "end", fill: C.muted });
  b += `<polyline points="${frames.map((f, i) => `${x(i)},${y(f.error)}`).join(" ")}" fill="none" stroke="${ink}" stroke-width="${fs * 0.2}" stroke-linejoin="round"/>`;
  frames.forEach((f, i) => (b += `<g data-tip="step ${i + 1} · ${f.phase} · error ${f3(f.error)}">${marker("circle", x(i), y(f.error), fs * 0.36, PH[f.phase][1], dark ? "#1F232B" : C.surface)}</g>`));
  const pk = frames.reduce((a, f, i) => (f.error > frames[a].error ? i : a), 0);
  b += t(x(pk), y(frames[pk].error) - fs * 0.9, f3(frames[pk].error), { fs: fs * 0.85, a: "middle", fill: ink2, mono: true });
  b += t(x(n - 1) + fs * 0.6, y(frames[n - 1].error), f3(frames[n - 1].error), { fs: fs * 0.85, fill: ink2, mono: true, w: 700 });
  b += t((lx + rx) / 2, h - fs * 0.5, "decision →", { fs: fs * 0.8, a: "middle", fill: C.muted });
  return svg(w, h, b, "Mean intent error after each decision of the episode");
}

/** Target vs measured 8-dim bars (used by episode/demo widgets). */
export function vectorBars(target, measured, { w = 300, h = 160, fs = 9, dims, dark = false } = {}) {
  dims = dims || ["enemies", "coins", "blocks", "pipes", "gaps", "verticality", "smoothness", "platforms"];
  const ink = dark ? "#F4F5F7" : C.ink, ink2 = dark ? "#C3C8D1" : C.ink2, track = dark ? "#2C313B" : "#EEF0F4";
  const bar = dark ? "#818CF8" : C.indigo;
  const labW = fs * 6.6, rowH = h / dims.length, pw = w - labW - fs * 3.4;
  let b = "";
  dims.forEach((d, i) => {
    const cy = rowH * (i + 0.5), th = Math.min(rowH * 0.5, fs * 1.1);
    b += t(labW - fs * 0.6, cy, d, { fs: fs * 0.95, a: "end", fill: ink });
    b += `<rect x="${labW}" y="${cy - th / 2}" width="${pw}" height="${th}" rx="${th / 2}" fill="${track}"/>`;
    if (measured) {
      const m = Math.max(0.004, measured[i]);
      b += `<rect class="vb-m" x="${labW}" y="${cy - th / 2}" width="${m * pw}" height="${th}" rx="${th / 2}" fill="${bar}"/>`;
    }
    const tx = labW + target[i] * pw;
    b += `<line x1="${tx}" x2="${tx}" y1="${cy - th * 0.95}" y2="${cy + th * 0.95}" stroke="${ink}" stroke-width="${fs * 0.22}" stroke-linecap="round"/>`;
    b += t(labW + pw + fs * 0.6, cy, (measured ? measured[i] : target[i]).toFixed(2), { fs: fs * 0.85, fill: ink2, mono: true });
  });
  return svg(w, h, b, "Target and measured intent vector");
}
