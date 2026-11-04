import M from "./levels/manifest.js";
import { rq1, rq2, rq3, rq4, vectorBars } from "./charts.js";
import { SLIDES_URL, REPO_URL } from "./links.js";

const $ = (id) => document.getElementById(id);
const PRINT = new URLSearchParams(location.search).has("print");
const LV = "assets/levels/";
const byName = Object.fromEntries(M.cases.map((c) => [c.name, c]));
const last = (c) => c.frames[c.frames.length - 1];
const f3 = (x) => x.toFixed(3);

/* ---------------- speaker notes (≈ 5 min, ~650 words) ---------------- */
const NOTES = [
  `[0:00–0:30] Hi, I'm Bruno, from UFMG. Our question is simple: when a designer asks a generator for a level, did they get the level they asked for? On the right: someone typed "packed with enemies and wide pits", our system built this level, and an external A* agent is playing it right now.`,
  `[0:30–1:05] Here is the failure we started from. Ask a corpus-trained Mario generator for "flat, empty, smooth". You get enemies, gaps, coins and hills. (click "Ours") With our system, the same request gives exactly that, error zero, still playable. (advance) The reason is that these generators are material-bound: if every chunk in the corpus contains an enemy, no recombination of chunks contains none.`,
  `[1:05–1:50] So we split the problem. (advance through A to D) First, an LLM, GPT-5.2, translates the request into eight numbers: enemies, coins, blocks, pipes, gaps, verticality, smoothness and platforms. Second, a MaskablePPO policy composes about ten real corpus chunks, which keeps the Mario style. Third, the same policy edits the stitched level with macro-edits, and every edit that breaks geometry or reachability is reverted on the spot. Finally, a deterministic polish step and an A* agent gate the release. The key point: the LLM never touches a tile, so we can measure translation error and generation error separately.`,
  `[1:50–2:35] This is one real episode for the flat-empty target. (press Play) Green is composition: chunks come in, and the error goes up because the corpus brings enemies and gaps. Purple is the edit phase: the policy removes enemies, fills gaps and strips coins, and the error drops. Polish closes the residual, and every bar meets its target. One terminal reward for both phases, no intermediate shaping.`,
  `[2:35–3:15] And this works from language. (click a few chips) These are recorded GPT-5.2 translations, replayed exactly. Each request becomes a vector, then a level, and every level shown here was completed by the A* agent. "Coin heaven" gets coins. "A vertical climbing stage" gets platforms and height.`,
  `[3:15–3:50] Control also reaches the boundaries. (drag the slider) Enemies from zero to maximum: zero really means zero, which composition alone cannot express. The final policy passes all eight sweeps. Polish makes count-like dimensions near-exact, and when targets conflict, like smoothness against pipes and platforms, the system reports the residual instead of hiding it.`,
  `[3:50–4:30] In numbers. Learning beats beam search over the same chunk space on all three seeds, with p equal to ten to the minus four, and is seven times faster. On corpus-hostile requests, compose-only error rises 48 percent; editing cuts it, and polish reaches 0.004 on flat-empty. And the language bridge translates with mean error 0.053, monotonic end-to-end.`,
  `[4:30–5:00] The takeaway: the request becomes a numeric contract. When something goes wrong, you can tell whether translation missed, the generator missed, or the request itself is in conflict. Code, models and this interactive demo are behind the QR code. Come talk to us at the poster. Thank you!`,
];

/* ---------------- deck & steps ---------------- */
const slides = [...document.querySelectorAll(".slide")];
let cur = 0, step = 0;
const maxStep = (s) => Math.max(0, ...[...s.querySelectorAll("[data-step]")].map((e) => +e.dataset.step));
const onEnter = {};

function render() {
  slides.forEach((s, i) => s.classList.toggle("active", i === cur));
  slides[cur].querySelectorAll("[data-step]").forEach((e) => e.classList.toggle("hidden", +e.dataset.step > step));
  $("hudN").textContent = `${cur + 1} / ${slides.length}`;
  $("prTitle").textContent = `${cur + 1}. ${slides[cur].dataset.title}`;
  $("prNotes").textContent = NOTES[cur] || "";
  history.replaceState(null, "", `#${cur + 1}`);
}
function go(i, s = 0) {
  const changed = i !== cur;
  cur = Math.max(0, Math.min(slides.length - 1, i));
  step = s === "end" ? maxStep(slides[cur]) : s;
  render();
  if (changed && onEnter[cur]) onEnter[cur]();
}
const next = () => (step < maxStep(slides[cur]) ? (step++, render()) : cur < slides.length - 1 && go(cur + 1));
const prev = () => (step > 0 ? (step--, render()) : cur > 0 && go(cur - 1, "end"));

/* ---------------- scale-to-fit ---------------- */
function fit() {
  if (PRINT) return;
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  $("deck").style.transform = `scale(${k})`;
}

/* ---------------- split level helper ---------------- */
function splitLevel(el, src, maskCols = null) {
  if (!el.children.length) el.innerHTML = `<div class="half"><img class="px" alt=""><div class="mask"></div></div><div class="half"><img class="px" alt=""><div class="mask"></div></div>`;
  el.querySelectorAll("img").forEach((im) => { if (im.getAttribute("src") !== src) im.src = src; });
  const masks = el.querySelectorAll(".mask");
  // mask the not-yet-composed columns (level = 152 cols, each half = 76)
  const cols = maskCols == null ? 152 : maskCols;
  masks[0].style.width = `${(Math.max(0, 76 - cols) / 76) * 100}%`;
  masks[1].style.width = `${(Math.max(0, 152 - Math.max(76, cols)) / 76) * 100}%`;
}

/* ---------------- slide 1 / 3: gameplay + pipeline images ---------------- */
document.querySelectorAll("[data-play]").forEach((im) => {
  im.src = PRINT ? `assets/gameplay/${im.dataset.play}_still.png` : `assets/gameplay/${im.dataset.play}.webp`;
});
const fe = byName.flat_empty;
$("pcomp").src = LV + fe.frames.find((f) => f.phase === "stitched").file;
$("pedit").src = LV + fe.frames.filter((f) => f.phase === "edit").at(-1).file;
$("pvec").innerHTML = vectorBars(byName.peaceful.target, null, { w: 360, h: 220, fs: 17, dark: true });

/* ---------------- slide 2: before / after toggle ---------------- */
document.querySelectorAll("[data-ba]").forEach((b) =>
  b.addEventListener("click", () => {
    const k = +b.dataset.ba;
    document.querySelectorAll("[data-ba]").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".ba-img").forEach((x, i) => x.classList.toggle("on", i === k));
    document.querySelectorAll(".ba-cap > div").forEach((x, i) => x.classList.toggle("on", i === k));
  })
);

/* ---------------- slide 4: episode player ---------------- */
const EP_CASES = [["flat_empty", "flat & empty"], ["hilly_rich", "hilly & rich"], ["chaos", "max chaos"]].filter(([n]) => byName[n]);
let ep = byName[EP_CASES[0][0]], epI = 0, epTimer = null;
const PHASE = { compose: "Compose", stitched: "Stitched", edit: "Gated edit", polish: "Polish" };
function epShow(i) {
  epI = i;
  const f = ep.frames[i];
  splitLevel($("epLevel"), LV + f.file, f.phase === "compose" ? f.cols : 152);
  $("epPhase").textContent = PHASE[f.phase] + (f.op ? ` · ${f.op.replace(/_/g, " ")}` : "");
  $("epPhase").className = `ep-phase ${f.phase}`;
  $("epErr").textContent = f3(f.error);
  $("epBars").innerHTML = vectorBars(ep.target, f.measured, { w: 410, h: 380, fs: 21, dark: true });
  $("epSlider").max = ep.frames.length - 1;
  $("epSlider").value = i;
  $("epStep").textContent = `${i + 1} / ${ep.frames.length}`;
}
function epStop() { clearInterval(epTimer); epTimer = null; $("epPlay").textContent = "▶ Play"; }
function epPlay() {
  if (epTimer) return epStop();
  if (epI >= ep.frames.length - 1) epShow(0);
  $("epPlay").textContent = "❚❚ Pause";
  epTimer = setInterval(() => (epI < ep.frames.length - 1 ? epShow(epI + 1) : epStop()), 650);
}
$("epCases").innerHTML = EP_CASES.map(([n, l]) => `<button data-n="${n}">${l}</button>`).join("");
$("epCases").addEventListener("click", (e) => {
  const n = e.target.closest("button")?.dataset.n;
  if (!n) return;
  epStop(); ep = byName[n];
  $("epCases").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.n === n));
  epShow(0);
});
$("epCases").firstElementChild.classList.add("on");
$("epPlay").addEventListener("click", epPlay);
$("epSlider").addEventListener("input", (e) => { epStop(); epShow(+e.target.value); });
epShow(PRINT ? ep.frames.length - 1 : 0);
onEnter[3] = () => { epStop(); epShow(0); };

/* ---------------- slide 5: ask & get ---------------- */
const DEMO_LABELS = { coins: "Coin heaven", vertical: "Vertical climb", pipes: "Pipe garden", hard: "Real challenge",
  peaceful: "Peaceful stroll", chaos: "Max chaos", hilly_rich: "Hilly & rich", flat_empty: "Speedrunner's dream" };
const DEMO = Object.keys(DEMO_LABELS).filter((n) => byName[n]);
function demoShow(n) {
  const c = byName[n];
  splitLevel($("demoLevel"), LV + last(c).file);
  $("demoErr").textContent = `mean intent error ${f3(last(c).error)}`;
  $("demoPrompt").textContent = `“${c.prompt}”`;
  $("demoPlay").src = PRINT ? `assets/gameplay/${n}_still.png` : `assets/gameplay/${n}.webp`;
  $("demoBars").innerHTML = vectorBars(c.target, last(c).measured, { w: 360, h: 210, fs: 16, dark: true });
  $("chips").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.n === n));
}
$("chips").innerHTML = DEMO.map((n) => `<button data-n="${n}">${DEMO_LABELS[n]}</button>`).join("");
$("chips").addEventListener("click", (e) => { const n = e.target.closest("button")?.dataset.n; if (n) demoShow(n); });
demoShow(DEMO[0]);

/* ---------------- slide 6: sweeps ---------------- */
const SW = Object.keys(M.sweeps).filter((d) => M.sweeps[d].length);
const DIMI = { enemies: 0, coins: 1, gaps: 4, verticality: 5 };
let swD = SW[0];
function swShow() {
  const arr = M.sweeps[swD], i = Math.min(+$("swSlider").value, arr.length - 1), c = arr[i];
  splitLevel($("swLevel"), LV + last(c).file);
  $("swT").textContent = c.target[DIMI[swD]].toFixed(2);
  $("swM").textContent = last(c).measured[DIMI[swD]].toFixed(2);
  $("swSlider").max = arr.length - 1;
  $("swDims").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.d === swD));
}
$("swDims").innerHTML = SW.map((d) => `<button data-d="${d}">${d}</button>`).join("");
$("swDims").addEventListener("click", (e) => { const d = e.target.closest("button")?.dataset.d; if (d) { swD = d; swShow(); } });
$("swSlider").addEventListener("input", swShow);
swShow();
$("sRq2").innerHTML = rq2({ w: 580, h: 560, fs: 21 });

/* ---------------- slide 7 / 8 ---------------- */
$("sRq1").innerHTML = rq1({ w: 640, h: 500, fs: 19 });
$("sRq3").innerHTML = rq3({ w: 600, h: 440, fs: 18 });
$("sRq4").innerHTML = rq4({ w: 480, h: 420, fs: 18 });
{
  const q = qrcode(0, "M");
  q.addData(SLIDES_URL); q.make();
  $("qrEnd").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $("repoTxt").textContent = REPO_URL.replace("https://", "");
}

/* ---------------- tooltips on chart marks ---------------- */
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest?.("[data-tip]"), tip = $("tip");
  if (!el) return (tip.hidden = true);
  tip.textContent = el.dataset.tip; tip.hidden = false;
  tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 14 + "px";
});

/* ---------------- presenter + timer ---------------- */
let t0 = null;
setInterval(() => {
  if (t0 == null) return;
  const left = 300 - Math.floor((Date.now() - t0) / 1000), a = Math.abs(left);
  $("prTimer").textContent = `${left < 0 ? "-" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}, 250);

/* ---------------- input ---------------- */
addEventListener("keydown", (e) => {
  if (e.target.matches("input")) { if (!["ArrowLeft", "ArrowRight"].includes(e.key) || e.target.type === "range") return; }
  const k = e.key;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); if (t0 == null) t0 = Date.now(); next(); }
  else if (["ArrowLeft", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
  else if (k === "Home") go(0);
  else if (k === "End") go(slides.length - 1);
  else if (k === "n" || k === "N") $("presenter").hidden = !$("presenter").hidden;
  else if (k === "r" || k === "R") { t0 = Date.now(); }
  else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
$("next").addEventListener("click", next);
$("prev").addEventListener("click", prev);
let tx = null;
addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
addEventListener("touchend", (e) => {
  if (tx == null) return;
  const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
});

/* ---------------- boot ---------------- */
if (PRINT) {
  document.body.classList.add("print");
  slides.forEach((s) => s.classList.add("active"));
} else {
  addEventListener("resize", fit); fit();
  const h = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(h) ? h - 1 : 0);
}
document.body.dataset.ready = "1";
