// Archegon anatomy figure. Built with the Anatomy kit (MIT, (c) 2026 Ryan,
// https://github.com/wheresryan22/anatomy); kit copied unchanged in ./kit with its LICENSE.
// Usage: node tools/anatomy/build.mjs   (run tools/anatomy/model_figures.py first)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "..");
const M = JSON.parse(readFileSync(join(HERE, "model.json"), "utf8"));
const f1 = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
const fibreKm = Math.round(M.fibre_km_line * M.fibre_route_factor);

const W = 960, H = 640;
const EARTH = { x: -300, y: -130, w: 600, d: 260, r: 6 };
const EZ = -165; // bottom of the cut block (not to scale: real wells ~4 km deep)
const FRONT = EARTH.y + EARTH.d; // cut face plane y
const P = k.fitProjection([...k.boxCorners(EARTH, EZ, 0), [-250, FRONT - 20, 140]], W, H, { pad: 34, azimuth: 45, elevation: 30 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const seg = (pts) => k.pathOf(pts.map(at));
const box = (plan, z, h, tone = "mid", extra = {}) => S(k.slabOf(plan, z, h, P, 4, 0.6), { tone, ...extra });
const cyl = (x, y, r, z, h, tone = "mid", extra = {}) => S(k.cylinder(x, y, r, z, h, P, 28), { tone, ...extra });
const pipe = (pts, cls, w = 2.6) => `<path class="an-pipe ${cls}" d="${seg(pts)}" style="stroke-width:${w}"/>`;
const depth = (x, y) => k.depthOf([x, y, 0], P);

// ---------- earth block and cut face ----------
const Zp = -100, Zi = -132; // producer and injector lateral depths (drawn)
const WELLS = { p: [-262, -214], i: [-238, -190] }; // wellhead x on the front edge
const LAT = [-120, 230]; // lateral x range
function earth() {
  const o = [`<path class="iso-halo" d="${k.haloOf(EARTH, EZ, -EZ, P)}"/>`];
  o.push(S(k.slabOf(EARTH, EZ, -EZ, P, 6, 0), { tone: "lo" }));
  // strata bands on both visible faces
  for (const z of [-18, -45, -75, -120, -150]) {
    o.push(L(seg([[EARTH.x, FRONT, z], [EARTH.x + EARTH.w, FRONT, z]]), { tone: "faint" }));
    o.push(L(seg([[EARTH.x + EARTH.w, FRONT, z], [EARTH.x + EARTH.w, EARTH.y, z]]), { tone: "faint" }));
  }
  o.push(`<g class="an-txt">${k.faceTextSvg(k.sideMatrix([EARTH.x + 150, FRONT], -12, P, "left"), "sediments", { size: 7, tone: "mid" })}${k.faceTextSvg(k.sideMatrix([EARTH.x + 150, FRONT], -60, P, "left"), "granite (hot rock)", { size: 7, tone: "mid" })}</g>`);
  // surface pad
  o.push(S(k.slabOf({ x: -290, y: -120, w: 580, d: 240, r: 4 }, 0, 0.6, P, 4), { tone: "mid", flat: true }));
  return o.join("");
}

// ---------- wells on the cut face (stage: reservoir/drilling) ----------
function wells() {
  const o = [];
  const fz = [];
  for (let x = LAT[0] + 14; x < LAT[1]; x += 11) for (let j = 0; j < 4; j++) fz.push(at([x + (j % 2) * 5, FRONT, Zi + 6 + j * 7]));
  o.push(`<g data-stage="reservoir">${D(fz, { size: 1.4, tone: "hi", pulse: true })}${[0, 1].map((n) => { const x0 = LAT[0] + 30 + n * 120; return L(seg([[x0, FRONT, Zi + 2], [x0 + 6, FRONT, Zp - 2]]), { tone: "mid" }) + L(seg([[x0 + 60, FRONT, Zi + 2], [x0 + 52, FRONT, Zp - 2]]), { tone: "mid" }); }).join("")}</g>`);
  const well = (x, z, cls) => {
    const bend = 24;
    const pts = [[x, FRONT, 0], [x, FRONT, z + bend], [x + bend * 0.7, FRONT, z + 4], [x + bend * 1.6, FRONT, z], [LAT[1], FRONT, z]];
    return `<path class="an-casing" d="${seg(pts.slice(0, 2))}"/>` + pipe(pts, cls, 2.2) + D([at([LAT[1], FRONT, z])], { size: 1.6, tone: "hi" });
  };
  o.push(`<g data-stage="production">${WELLS.p.map((x, n) => well(x, Zp + n * 6, "hot")).join("")}</g>`);
  o.push(`<g data-stage="reinjection">${WELLS.i.map((x, n) => well(x, Zi - n * 6, "cold")).join("")}</g>`);
  // casing strings: concentric rings at surface + shoe marks
  o.push(`<g data-stage="drilling">${[...WELLS.p, ...WELLS.i].map((x) => L(seg([[x - 3, FRONT, -2], [x - 3, FRONT, -50]]), { tone: "hi" }) + L(seg([[x + 3, FRONT, -2], [x + 3, FRONT, -50]]), { tone: "hi" }) + D([at([x - 3, FRONT, -50]), at([x + 3, FRONT, -50])], { size: 0.9, tone: "hi" })).join("")}</g>`);
  return o.join("");
}

// ---------- surface items, each a stage group, painted back to front ----------
const items = [];
const add = (stage, x, y, svg) => items.push({ stage, d: depth(x, y), svg });

// drilling rig over first producer
{
  const x = WELLS.p[0], y = FRONT - 14;
  let s = box({ x: x - 22, y: y - 20, w: 44, d: 30, r: 1 }, 0, 14, "mid");
  s += box({ x: x - 16, y: y - 15, w: 32, d: 20, r: 1 }, 14, 4, "mid");
  for (const [dx, dy] of [[-9, -9], [9, -9], [-9, 3], [9, 3]]) s += box({ x: x + dx - 1.4, y: y + dy - 1.4, w: 2.8, d: 2.8, r: 0.4 }, 18, 110, "mid");
  for (let z = 28; z < 120; z += 22) s += L(seg([[x - 9, y + 4.4, z], [x + 9, y + 4.4, z + 18]]) + seg([[x + 9, y + 4.4, z], [x - 9, y + 4.4, z + 18]]), { tone: "lo" });
  s += box({ x: x - 12, y: y - 12, w: 24, d: 18, r: 1 }, 128, 6, "hi", { lit: false });
  s += box({ x: x + 24, y: y - 18, w: 36, d: 14, r: 1 }, 0, 12, "mid"); // mud pumps
  s += cyl(x + 34, y - 11, 4, 12, 6, "lo") + cyl(x + 50, y - 11, 4, 12, 6, "lo");
  add("drilling", x, y, s);
}
// wellheads (christmas trees)
for (const x of [...WELLS.p.slice(1), ...WELLS.i]) {
  const hot = WELLS.p.includes(x);
  add(hot ? "production" : "reinjection", x, FRONT - 4, cyl(x, FRONT - 4, 5, 0, 4, "mid") + cyl(x, FRONT - 4, 2.6, 4, 14, "hi") + box({ x: x - 6, y: FRONT - 5.5, w: 12, d: 3, r: 0.6 }, 10, 3, "mid"));
}
// make-up water bore
{
  const x = -150, y = -80;
  let s = cyl(x, y, 7, 0, 3, "lo") + cyl(x, y, 3, 3, 12, "mid") + box({ x: x + 6, y: y - 5, w: 16, d: 10, r: 1 }, 0, 8, "mid");
  s += box({ x: x - 26, y: y - 34, w: 28, d: 20, r: 2 }, 0, 18, "mid"); // tank
  s += L(k.ring(x - 12, y - 24, 6, 18, P, 24), { tone: "lo" });
  add("makeup", x, y, s);
}
// ORC plant
const ORC = { x: -40, y: -10, w: 90, d: 70, r: 2 };
{
  let s = box(ORC, 0, 4, "lo");
  s += box({ x: -34, y: 30, w: 50, d: 22, r: 2 }, 4, 18, "mid"); // evaporator/preheater skid
  for (const xx of [-28, -10, 8]) s += L(seg([[xx, 52, 6], [xx, 52, 20]]), { tone: "lo" });
  s += cyl(30, 40, 9, 4, 26, "mid"); // separator / recuperator vessel
  s += box({ x: -34, y: -4, w: 40, d: 26, r: 2 }, 4, 14, "mid"); // turbine casing
  s += cyl(-14, 9, 8, 18, 6, "hi", { lit: true });
  add("orc", 5, 25, s);
}
// generator
add("electrical", 25, 0, box({ x: 14, y: -4, w: 26, d: 22, r: 4 }, 4, 18, "mid") + L(k.knurl(27, 7, 9, 10, 20, 24, P), { tone: "lo" }));
// air-cooled condenser (raised bay of fans)
{
  const A = { x: -40, y: -118, w: 110, d: 56, r: 1 };
  let s = "";
  for (const [x, y] of [[A.x + 3, A.y + 3], [A.x + A.w - 6, A.y + 3], [A.x + 3, A.y + A.d - 6], [A.x + A.w - 6, A.y + A.d - 6]]) s += box({ x, y, w: 3, d: 3, r: 0.4 }, 0, 34, "lo");
  s += box(A, 34, 8, "mid");
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const cx = A.x + 15 + i * 27, cy = A.y + 15 + j * 26; s += cyl(cx, cy, 11, 42, 3, "mid") + L(k.ring(cx, cy, 8.5, 45, P, 28), { tone: "lo" }) + D([at([cx, cy, 45])], { size: 1.2, tone: "hi" }); }
  add("condenser", A.x + A.w / 2, A.y + A.d / 2, s);
}
// transformer and switchgear
add("electrical", 95, 10, box({ x: 80, y: -4, w: 26, d: 24, r: 2 }, 0, 22, "mid") + [0, 1, 2, 3].map((i) => box({ x: 82 + i * 6, y: 20, w: 2, d: 4, r: 0.3 }, 3, 16, "lo")).join("") + [0, 1, 2].map((i) => cyl(86 + i * 7, 6, 1.6, 22, 7, "hi")).join(""));
add("electrical", 130, 30, box({ x: 116, y: 18, w: 30, d: 30, r: 1 }, 0, 26, "mid") + [0, 1, 2].map((i) => L(seg([[116 + 30, 22 + i * 9, 3], [116 + 30, 22 + i * 9, 23]]), { tone: "lo" })).join(""));
// backup: battery containers + gas engine
{
  let s = "";
  for (let i = 0; i < 2; i++) { const p = { x: 84 + i * 34, y: -110, w: 30, d: 52, r: 1 }; s += box(p, 0, 22, "mid"); s += L(seg([[p.x + p.w, p.y + 6, 4], [p.x + p.w, p.y + p.d - 6, 4]]), { tone: "lo" }); for (let j = 1; j < 5; j++) s += L(seg([[p.x + p.w, p.y + j * 10.4, 4], [p.x + p.w, p.y + j * 10.4, 18]]), { tone: "faint" }); }
  s += box({ x: 84, y: -50, w: 64, d: 22, r: 1 }, 0, 20, "mid") + cyl(140, -40, 3, 20, 14, "lo");
  add("backup", 116, -80, s);
}
// data-centre modules
const MODS = [0, 1, 2, 3].map((i) => ({ x: 178, y: -118 + i * 60, w: 100, d: 48, r: 1.5 }));
MODS.forEach((m, i) => {
  let s = box(m, 0, 4, "lo") + box({ x: m.x + 2, y: m.y + 2, w: m.w - 4, d: m.d - 4, r: 1.5 }, 4, 26, "mid");
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) s += box({ x: m.x + 10 + c * 10.5, y: m.y + 10 + r * 18, w: 8, d: 10, r: 0.5 }, 30, 2.5, "hi");
  for (let c = 0; c < 3; c++) s += cyl(m.x + 20 + c * 30, m.y + m.d / 2, 4.5, 32.5, 2, "lo");
  s += L(seg([[m.x + m.w - 2, m.y + 6, 8], [m.x + m.w - 2, m.y + m.d - 6, 8]]), { tone: "lo" });
  s = `<path class="an-cable" d="${seg([[162, m.y + m.d / 2, 2], [m.x, m.y + m.d / 2, 8]])}"/>` + s;
  s += k.faceTextSvg(k.sideMatrix([m.x + m.w - 2, m.y + m.d - 8], 14, P, "right"), `MODULE ${i + 1}`, { size: 4.2, tone: "mid" });
  add("datacentre", m.x + m.w / 2, m.y + m.d / 2, `<g data-module="${i + 1}">${s}</g>`);
});
// fibre hut at the edge
add("fibre", 288, 112, box({ x: 280, y: 100, w: 14, d: 14, r: 1 }, 0, 12, "mid") + cyl(287, 107, 2, 12, 10, "hi"));
items.sort((a, b) => a.d - b.d);

// ---------- pipes and cables on the surface (drawn last, on the pad) ----------
function runs() {
  const z = 2;
  const hot = `<g data-stage="production">${WELLS.p.map((x) => pipe([[x, FRONT - 4, z], [x, 70, z], [-20, 70, z], [-20, 52, 8]], "hot")).join("")}</g>`;
  const cold = `<g data-stage="reinjection">${WELLS.i.map((x) => pipe([[40, 30, 8], [60, 30, z], [60, 88, z], [x, 88, z], [x, FRONT - 4, z]], "cold")).join("")}</g>`;
  const cond = `<g data-stage="condenser">${pipe([[-20, -4, 14], [-20, -62, 34]], "work", 2) + pipe([[30, -62, 34], [30, 31, 20]], "work", 2)}</g>`;
  const mk = `<g data-stage="makeup">${pipe([[-136, -80, 3], [-120, -80, z], [-120, 88, z], [-238, 88, z]], "make", 1.6)}</g>`;
  const ac = (pts) => `<path class="an-cable" d="${seg(pts)}"/>`;
  const el = `<g data-stage="electrical">${ac([[40, 7, 12], [80, 7, 12]])}${ac([[106, 8, 14], [116, 30, 14]])}${ac([[146, 33, 10], [162, 33, 2], [162, MODS[0].y + 24, 2]]) + ac([[162, 33, 2], [162, MODS[3].y + 24, 2]])}</g>`;
  const bk = `<g data-stage="backup">${ac([[116, -58, 2], [131, -28, 2], [131, 18, 8]])}</g>`;
  const fb = `<g data-stage="fibre"><path class="an-fibre" d="${seg([[278, 90, 6], [287, 100, 6]])}"/><path class="an-fibre" d="${seg([[294, 107, 2], [300, 107, 2]])}"/></g>`;
  return { ground: mk + hot + cold + el + bk + fb, raised: cond };
}

// heat path for "follow the heat": screen points per step
const STEPS = [
  { id: "drilling", t: "1 · Drill", body: `A land rig drills ${M.producers} producers and ${M.injectors} injectors (two doublets), each turning horizontal in hot granite. Steel casing strings, cemented in stages, isolate each well from the sediments and aquifers above.`, fig: `${M.producers + M.injectors} wells · drawn depth not to scale`, path: [[WELLS.p[0], FRONT, 120], [WELLS.p[0], FRONT, Zp + 30], [WELLS.p[0] + 48, FRONT, Zp], [LAT[1], FRONT, Zp]] },
  { id: "reservoir", t: "2 · Stimulated fracture zone", body: `Between each injector (lower lateral) and producer (upper lateral), stimulated fractures let water sweep heat from the rock. Flow, decline and seismicity are proven in the Gate 1 test before any plant is bought.`, fig: `decline the well margin absorbs: ≤${f1(M.decline_threshold_c)} °C/yr (model default ${f1(M.decline_default_c)} °C/yr)`, path: [[LAT[1] - 40, FRONT, Zi], [LAT[1] - 40, FRONT, Zp]] },
  { id: "production", t: "3 · Production", body: `Hot brine rises in the producers at about ${M.t_prod_c} °C and is piped across the pad to the power block.`, fig: `${M.producers} producers × ${M.per_well_net_mw} MW net (base ASSUMPTION) = ${M.producers_x_net} MW · margin over plant ${f1(M.well_margin_mw)} MW`, path: [[LAT[1], FRONT, Zp], [WELLS.p[1] + 48, FRONT, Zp], [WELLS.p[1], FRONT, Zp + 30], [WELLS.p[1], FRONT, 0], [WELLS.p[1], 70, 2], [-20, 70, 2], [-20, 52, 8]] },
  { id: "orc", t: "4 · ORC binary plant", body: `The brine heats a separate organic working fluid in the evaporator; its vapour spins the turbine. Brine and working fluid never mix.`, fig: `${f1(M.net_nameplate_mw)} MW net nameplate × ${M.cf} capacity factor = ${f1(M.avg_mw)} MW average`, path: [[-20, 52, 8], [-20, 30, 20], [-14, 9, 24]] },
  { id: "condenser", t: "5 · Air-cooled condenser", body: `The working fluid is condensed by fans and returned to the evaporator. Air cooling uses almost no water but loses output on hot days (vendor derate curve still needed).`, fig: `illustrative 20% hot-day derate with one producer out → 2 of 4 modules lit`, path: [[-20, -4, 14], [-20, -62, 34], [15, -90, 45], [30, -62, 34], [30, 31, 20]] },
  { id: "reinjection", t: "6 · Reinjection", body: `Cooled brine is pumped back down the injectors into the fracture zone, closing the loop.`, fig: `closed loop · pumping power ≤10% of gross is a Gate 1 test (ASSUMPTION)`, path: [[40, 30, 8], [60, 30, 2], [60, 88, 2], [WELLS.i[1], 88, 2], [WELLS.i[1], FRONT, 0], [WELLS.i[1], FRONT, Zi + 30], [WELLS.i[1] + 48, FRONT, Zi], [LAT[1], FRONT, Zi]] },
  { id: "makeup", t: "7 · Make-up water", body: `A bore and tank top up whatever the reservoir does not return, and supply stimulation water.`, fig: `bore ~A$${(M.bore_aud / 1000).toFixed(0)}k (PUBLIC PROXY) · 1% loss ≈ ${Math.round(M.makeup_1pct_ml)} ML/yr · ~${f1(M.stim_water_ml)} ML per stimulation`, path: [[-150, -80, 14], [-120, -80, 2], [-120, 88, 2], [-238, 88, 2]] },
  { id: "electrical", t: "8 · Generator, transformer, switchgear", body: `The generator feeds a step-up transformer and the site switchboard, which splits power to the four data-centre modules.`, fig: `${f1(M.avg_mw)} MW average = facility load ${f1(M.facility_mw)} MW (zero margin at the fence)`, path: [[27, 7, 14], [93, 8, 22], [131, 33, 26], [162, 33, 2]] },
  { id: "backup", t: "9 · Battery and gas backup", body: `Batteries and a standby gas engine cover the hours the plant is down. They are costed only at public-proxy rates and are not in the headline raise; until they are contracted, modules 3–4 are sold as interruptible.`, fig: `${M.uncovered_h} h/yr not covered at ${M.cf} CF · one producer out leaves ${f1(M.n1_mw)} MW → ${f1(M.n1_it_mw)} MW IT`, path: [[116, -80, 22], [131, -28, 2], [131, 18, 8]] },
  { id: "datacentre", t: "10 · Modular data centre", body: `Four ${M.module_it_mw} MW IT modules with racks and liquid-cooling units. Each module is energised only when measured power supports it.`, fig: `${M.modules} × ${M.module_it_mw} MW IT × PUE ${M.pue} (ASSUMPTION) = ${f1(M.modules * M.module_it_mw * M.pue)} MW facility`, path: [[162, 33, 2], [162, -94, 2], [178, -94, 8], [228, -94, 34]] },
  { id: "fibre", t: "11 · Fibre to Moomba", body: `Data leaves by fibre to Moomba. Third-party access is not yet confirmed; the fallback route to Lyndhurst is far longer.`, fig: `${M.fibre_km_line} km straight line × ${M.fibre_route_factor} route factor ≈ ${fibreKm} km (ASSUMPTION)`, path: [[278, 90, 6], [287, 107, 22], [300, 107, 2]] },
];
const stagePaths = Object.fromEntries(STEPS.map((s) => [s.id, s.path.map(at).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])]));

const RUNS = runs();
const body = [earth(), wells(), RUNS.ground, ...items.map((i) => `<g data-stage="${i.stage}">${i.svg}</g>`), RUNS.raised, `<circle class="an-pulse" r="4" cx="-20" cy="-20"/>`];
const STYLE = `
.an-pipe{fill:none;stroke-linecap:round;stroke-linejoin:round}
.an-pipe.hot{stroke:#c2410c}.an-pipe.cold{stroke:#1d4ed8}.an-pipe.work{stroke:#7c3aed}.an-pipe.make{stroke:#0e7490;stroke-dasharray:4 3}
.an-casing{fill:none;stroke:var(--anatomy-hi);stroke-width:6;stroke-opacity:.25}
.an-cable{fill:none;stroke:#b45309;stroke-width:1.4;stroke-linejoin:round}
.an-fibre{fill:none;stroke:#059669;stroke-width:1.6;stroke-dasharray:3 2}
.an-pulse{fill:#f97316;stroke:#fff;stroke-width:1.5;opacity:0;pointer-events:none}
[data-stage]{transition:opacity .35s var(--anatomy-ease);cursor:pointer}
svg[data-focus] [data-stage]{opacity:.28}
svg[data-focus] [data-stage].on{opacity:1}
@media (prefers-reduced-motion:reduce){[data-stage]{transition:none}}
`;
const label = "Isometric cutaway of an Archegon enhanced geothermal site: a drilling rig and two well pairs turning horizontal in hot granite with a stimulated fracture zone between them; hot brine piped to an ORC binary plant with an air-cooled condenser; reinjection and a make-up water bore; generator, transformer, switchgear, battery and gas backup; four 1.25 MW data-centre modules; and a fibre link towards Moomba. Illustrative, not to scale.";
const svgLive = k.figureSvg({ width: W, height: H, label, body: [`<style>${STYLE}</style>`, ...body] });
const svgStatic = k.figureSvg({ width: W, height: H, label, body: [`<style>${STYLE}</style>`, ...body], standalone: "light" });

mkdirSync(join(SITE, "assets/diagrams"), { recursive: true });
writeFileSync(join(SITE, "assets/diagrams/anatomy.svg"), svgStatic);

const plate = k.plateHtml({
  fig: "Fig 6",
  title: "Anatomy of an Archegon site",
  hint: "Hover or tap a part · or follow the heat",
  readout: "",
  keys: [],
  caption: "",
  body: `<div class="iso-stage">${svgLive}</div>`,
});
const steps = STEPS.map(({ path, ...s }) => s);
const live = `
const STEPS=${JSON.stringify(steps)};const PATHS=${JSON.stringify(stagePaths)};
const svg=document.querySelector('.an-wrap .iso-stage svg'),panel=document.getElementById('an-panel'),ro=document.querySelector('.an-wrap [data-readout]');
const pulse=svg.querySelector('.an-pulse'),still=matchMedia('(prefers-reduced-motion: reduce)');
let cur=-1,pinned=false,raf=0,timer=0,playing=false;
const groups=id=>svg.querySelectorAll('[data-stage="'+id+'"]');
svg.querySelectorAll('[data-stage]').forEach(g=>{g.setAttribute('tabindex','0');g.setAttribute('role','button');const s=STEPS.find(x=>x.id===g.dataset.stage);g.setAttribute('aria-label',s.t);});
function show(i,anim){cur=i;const s=STEPS[i];svg.setAttribute('data-focus','');svg.querySelectorAll('[data-stage]').forEach(g=>g.classList.toggle('on',g.dataset.stage===s.id));
 panel.innerHTML='<h3>'+s.t+'</h3><p>'+s.body+'</p><p class="an-fig">'+s.fig+'</p>';ro.textContent=s.t;document.getElementById('an-step').textContent=(i+1)+' / '+STEPS.length;run(PATHS[s.id],anim);}
function clear(){if(pinned||playing)return;svg.removeAttribute('data-focus');svg.querySelectorAll('.on').forEach(g=>g.classList.remove('on'));pulse.style.opacity=0;}
function run(pts,anim){cancelAnimationFrame(raf);if(!pts||pts.length<1)return;pulse.style.opacity=1;
 if(still.matches||!anim){const p=pts[pts.length-1];pulse.setAttribute('cx',p[0]);pulse.setAttribute('cy',p[1]);return;}
 const lens=[0];for(let i=1;i<pts.length;i++)lens.push(lens[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const tot=lens[lens.length-1]||1,dur=Math.max(900,tot*6),t0=performance.now();
 const step=now=>{let u=Math.min(1,(now-t0)/dur);u=1-Math.pow(1-u,3);const d=u*tot;let j=1;while(j<lens.length-1&&lens[j]<d)j++;const a=pts[j-1],b=pts[j]||a,f=(d-lens[j-1])/((lens[j]-lens[j-1])||1);
  pulse.setAttribute('cx',a[0]+(b[0]-a[0])*f);pulse.setAttribute('cy',a[1]+(b[1]-a[1])*f);if(u<1)raf=requestAnimationFrame(step);};raf=requestAnimationFrame(step);}
svg.addEventListener('pointerover',e=>{const g=e.target.closest('[data-stage]');if(g&&!pinned&&!playing)show(STEPS.findIndex(s=>s.id===g.dataset.stage),false);});
svg.addEventListener('pointerleave',clear);
svg.addEventListener('click',e=>{const g=e.target.closest('[data-stage]');if(!g){pinned=false;clear();return;}stop();pinned=true;show(STEPS.findIndex(s=>s.id===g.dataset.stage),true);});
svg.addEventListener('keydown',e=>{const g=e.target.closest('[data-stage]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();stop();pinned=true;show(STEPS.findIndex(s=>s.id===g.dataset.stage),true);}});
svg.addEventListener('focusin',e=>{const g=e.target.closest('[data-stage]');if(g&&!playing)show(STEPS.findIndex(s=>s.id===g.dataset.stage),false);});
const go=d=>{stop();pinned=true;show((cur+d+STEPS.length)%STEPS.length,true);};
document.getElementById('an-prev').onclick=()=>go(-1);document.getElementById('an-next').onclick=()=>go(1);
const playBtn=document.getElementById('an-play');
function stop(){playing=false;clearTimeout(timer);playBtn.textContent='Follow the heat ▶';playBtn.setAttribute('aria-pressed','false');}
function tour(){if(!playing)return;show((cur+1)%STEPS.length,true);timer=setTimeout(tour,still.matches?6000:3600);}
playBtn.onclick=()=>{if(playing){stop();return;}playing=true;pinned=true;playBtn.textContent='Pause ❚❚';playBtn.setAttribute('aria-pressed','true');if(cur<0||cur===STEPS.length-1)cur=-1;tour();};
document.querySelector('.an-wrap').addEventListener('keydown',e=>{if(e.target.closest('[data-stage]'))return;if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);});
`;
const fragment = `<div class="an-wrap iso" data-theme="light">${plate}
<div class="an-ctl"><button id="an-prev" aria-label="Previous stage">◀</button><button id="an-play" aria-pressed="false">Follow the heat ▶</button><button id="an-next" aria-label="Next stage">▶</button><span id="an-step" aria-live="polite"></span></div>
<div id="an-panel" class="an-panel" aria-live="polite"><h3>Follow the heat</h3><p>Hover or tap any part of the site, or press <b>Follow the heat</b> to step from the rig to the fibre link. Arrow keys step too.</p></div>
<ol class="an-list">${STEPS.map((s) => `<li><b>${s.t.replace(/^\d+ · /, "")}</b>: ${s.body} <span class="an-fig">${s.fig}</span></li>`).join("")}</ol>
</div>`;
writeFileSync(join(HERE, "fragment.html"), fragment);
writeFileSync(join(HERE, "fragment.css"), k.ISO_CSS + `
.an-wrap{margin:8px 0 24px}.an-wrap .iso-figure{margin:0}
.an-ctl{display:flex;gap:8px;align-items:center;margin:12px 0}.an-ctl button{font:inherit;padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer}
.an-ctl button:focus-visible,.an-wrap [data-stage]:focus-visible{outline:2px solid #0b6b5c;outline-offset:2px}
.an-panel{border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;background:#fff;min-height:120px}.an-panel h3{margin:0 0 6px;font-size:17px}
.an-fig{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#0b6b5c}.an-list{margin-top:20px;font-size:15px}.an-list li{margin-bottom:6px}
`);
writeFileSync(join(HERE, "fragment.js"), k.ISO_CSS ? live : live);
// kit runtime is not needed live (no geometry rebuilt in the page); only the interaction script ships.
console.log("anatomy built:", items.length, "surface items,", STEPS.length, "stages");
