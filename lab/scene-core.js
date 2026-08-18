/* ======================================================================
 * Archegon hero scene — geological section
 *
 * A vertical slice through the crust: cool surface at the top carrying a
 * data-centre campus, hot granite below, and a closed circulation loop
 * running injector -> stimulated fracture volume -> producer.
 *
 * Written for Archegon. The tube-sweeping and instancing approach follows
 * the Sylva study (MIT-spirit, open source); the geometry, fracture growth,
 * thermal shading, and circulation are new work for this project.
 * ====================================================================== */
'use strict';

var TAU = Math.PI * 2;

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function sstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function mix(a, b, t) { return a + (b - a) * t; }

/* deterministic RNG so every visitor sees the same reservoir */
function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/* piecewise-linear table sampled over t in [0,1] */
function table(vals) {
  var n = vals.length - 1;
  return function (t) {
    var f = clamp01(t) * n;
    var i = Math.min(n - 1, Math.floor(f));
    return mix(vals[i], vals[i + 1], f - i);
  };
}

/* ----------------------------------------------------------------------
 * Parallel-transport frames: carry a stable normal along a curve without
 * the flipping that Frenet frames produce at inflection points. Fracture
 * paths have many inflections, so this matters more here than it did for
 * a tree root.
 * -------------------------------------------------------------------- */
function transportFrames(curve, segs) {
  var pts = [], tans = [], nrms = [];
  var i;
  for (i = 0; i <= segs; i++) {
    var t = i / segs;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  /* seed a normal that is not parallel to the first tangent */
  var up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tans[0].dot(up)) > 0.92) up.set(1, 0, 0);
  var n0 = new THREE.Vector3().crossVectors(tans[0], up).normalize();
  n0.crossVectors(n0, tans[0]).normalize();
  nrms.push(n0);

  for (i = 1; i <= segs; i++) {
    var prev = nrms[i - 1].clone();
    var t0 = tans[i - 1], t1 = tans[i];
    var axis = new THREE.Vector3().crossVectors(t0, t1);
    var sin = axis.length();
    if (sin > 1e-7) {
      axis.divideScalar(sin);
      var ang = Math.atan2(sin, Math.max(-1, Math.min(1, t0.dot(t1))));
      prev.applyAxisAngle(axis, ang);
    }
    prev.addScaledVector(t1, -prev.dot(t1)).normalize();
    nrms.push(prev);
  }
  return { pts: pts, tans: tans, nrms: nrms };
}

/* ----------------------------------------------------------------------
 * A conduit: any swept tube in the section. Used for well casing, for
 * fracture branches, and for the circulation loop.
 * -------------------------------------------------------------------- */
function makeConduit(pts, opt) {
  var v3 = pts.map(function (q) { return new THREE.Vector3(q[0], q[1], q[2] || 0); });
  var curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal', 0.5);
  var segs = opt.segs || 120;
  var radius = typeof opt.radius === 'function' ? opt.radius : table(opt.radius || [1, 1]);
  return {
    curve: curve,
    segs: segs,
    radial: opt.radial || 14,
    radius: radius,
    heat: typeof opt.heat === 'function' ? opt.heat : table(opt.heat || [0, 1]),
    fr: transportFrames(curve, segs),
    len: curve.getLength(),
    kind: opt.kind || 'fracture'
  };
}

/* ----------------------------------------------------------------------
 * Fracture growth.
 *
 * Fractures do not branch like plants. They propagate along the plane
 * perpendicular to the minimum principal stress, which in a normal-faulting
 * regime is close to horizontal. So each generation biases hard toward the
 * bedding plane, splits at shallow angles, and loses aperture quickly.
 * -------------------------------------------------------------------- */
function growFractures(rng, origin, dir, len, aperture, gen, out, opt) {
  if (gen > (opt.maxGen || 3) || len < 0.18 || aperture < 0.006) return;

  var pts = [];
  var p = origin.clone();
  var d = dir.clone().normalize();
  var steps = 4 + Math.floor(rng() * 3);
  var i;

  for (i = 0; i <= steps; i++) {
    pts.push([p.x, p.y, p.z]);
    /* wander within the bedding plane, resist climbing */
    var wander = new THREE.Vector3(
      (rng() - 0.5) * 0.55,
      (rng() - 0.5) * 0.16 - 0.05,
      (rng() - 0.5) * 0.45
    );
    d.add(wander).normalize();
    d.y *= 0.62;                    /* stress-plane bias: stay horizontal */
    d.normalize();
    p.addScaledVector(d, len / steps);
  }

  var a0 = aperture, a1 = aperture * 0.28;
  out.push(makeConduit(pts, {
    segs: Math.max(26, steps * 9),
    radial: gen === 0 ? 12 : 8,
    radius: function (t) { return mix(a0, a1, t) * (0.85 + 0.3 * Math.sin(t * 31 + gen)); },
    heat: function (t) { return 1 - t * 0.35; },
    kind: 'fracture'
  }));

  /* split: two to three wings at shallow angle, echelon-offset */
  var wings = 2 + (rng() > 0.55 ? 1 : 0);
  for (i = 0; i < wings; i++) {
    var tt = 0.35 + rng() * 0.5;
    var anchor = new THREE.Vector3().fromArray(pts[Math.floor(tt * steps)]);
    var side = new THREE.Vector3(0, 1, 0);
    var axis = new THREE.Vector3().crossVectors(d, side).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    var kdir = d.clone().applyAxisAngle(axis, (rng() - 0.5) * 1.1);
    kdir.applyAxisAngle(d, rng() * TAU);
    kdir.y *= 0.5;
    kdir.normalize();
    growFractures(
      rng, anchor, kdir,
      len * (0.48 + rng() * 0.24),
      aperture * (0.42 + rng() * 0.26),
      gen + 1, out, opt
    );
  }
}
