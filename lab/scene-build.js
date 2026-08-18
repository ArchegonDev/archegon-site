/* ======================================================================
 * Archegon — geometry
 *
 * Everything is measured against a datum at y = 0 (the ground surface).
 * Depth is negative y. The reservoir sits around y = -7.
 * ====================================================================== */
'use strict';

var DATUM = 0.0;
var RESERVOIR_Y = -7.2;

/* ----------------------------------------------------------------------
 * Sweep a conduit into triangles.
 * -------------------------------------------------------------------- */
function sweepConduit(C, bag) {
  var S = C.segs, R = C.radial;
  var base = bag.pos.length / 3;
  var fr = C.fr;
  var p = new THREE.Vector3(), n = new THREE.Vector3();
  var b = new THREE.Vector3();
  var i, j;

  for (i = 0; i <= S; i++) {
    var t = i / S;
    var ctr = fr.pts[i], tan = fr.tans[i], nrm = fr.nrms[i];
    b.crossVectors(tan, nrm).normalize();
    var r = C.radius(t);
    for (j = 0; j <= R; j++) {
      var th = (j / R) * TAU;
      var c = Math.cos(th), s = Math.sin(th);
      n.set(
        nrm.x * c + b.x * s,
        nrm.y * c + b.y * s,
        nrm.z * c + b.z * s
      ).normalize();
      p.copy(ctr).addScaledVector(n, r);
      bag.pos.push(p.x, p.y, p.z);
      bag.nor.push(n.x, n.y, n.z);
      bag.flow.push(t + i * 0.0);
    }
  }
  for (i = 0; i < S; i++) {
    for (j = 0; j < R; j++) {
      var q0 = base + i * (R + 1) + j, q1 = q0 + R + 1;
      bag.idx.push(q0, q1, q0 + 1, q1, q1 + 1, q0 + 1);
    }
  }
}

/* ----------------------------------------------------------------------
 * The well pair.
 *
 * Injector goes down on the left, turns horizontal through the reservoir.
 * Producer mirrors it on the right. The horizontal legs are what actually
 * intersect the fracture network — this is the geometry that makes an EGS
 * doublet legible at a glance.
 * -------------------------------------------------------------------- */
function buildWells() {
  var wells = [];

  /* Injector: vertical, a build section through the curve, then a LONG
     horizontal lateral. The lateral is the point — it is what exposes
     kilometres of hard rock instead of a single vertical intercept. */
  wells.push(makeConduit([
    [-4.35,  1.05, 0.0],
    [-4.35, -0.80, 0.0],
    [-4.33, -3.00, 0.0],
    [-4.28, -5.00, 0.0],
    [-4.14, -6.35, 0.0],
    [-3.80, -7.30, 0.0],
    [-3.15, -7.80, 0.0],
    [-2.30, -7.96, 0.0],
    [-1.00, -8.00, 0.0],
    [ 1.20, -8.00, 0.0],
    [ 3.40, -7.99, 0.0],
    [ 5.05, -7.98, 0.0]
  ], {
    segs: 260, radial: 16,
    radius: table([0.105, 0.100, 0.096, 0.092, 0.088, 0.084, 0.080, 0.078, 0.076, 0.074, 0.072, 0.070]),
    kind: 'well'
  }));

  /* Producer: drilled from the same pad and landed in a parallel lateral
     stacked above the injector. Same-pad, parallel laterals are the
     defining geometry of a next-generation EGS doublet. */
  wells.push(makeConduit([
    [-3.55,  1.05, 0.0],
    [-3.55, -0.80, 0.0],
    [-3.53, -2.90, 0.0],
    [-3.48, -4.70, 0.0],
    [-3.34, -5.85, 0.0],
    [-3.02, -6.55, 0.0],
    [-2.45, -6.86, 0.0],
    [-1.60, -6.96, 0.0],
    [-0.20, -6.99, 0.0],
    [ 2.00, -6.99, 0.0],
    [ 4.05, -6.98, 0.0],
    [ 5.05, -6.98, 0.0]
  ], {
    segs: 260, radial: 16,
    radius: table([0.108, 0.103, 0.099, 0.095, 0.091, 0.087, 0.083, 0.081, 0.079, 0.077, 0.075, 0.073]),
    kind: 'well'
  }));

  return wells;
}

/* ----------------------------------------------------------------------
 * The stimulated volume: fracture wings propagating off both laterals.
 * -------------------------------------------------------------------- */
/* ----------------------------------------------------------------------
 * Engineered fractures.
 *
 * This is the whole distinction. Conventional geothermal hunts for
 * naturally occurring fractures and accepts whatever the subsurface
 * happens to provide. Next-generation EGS drills into hard, non-permeable
 * rock and CREATES the flow path: evenly spaced stimulation stages along
 * the lateral, each opening a near-vertical fracture that connects the
 * injector to the producer above it.
 *
 * So these are not grown with a random walk. They are a designed pattern:
 * regular spacing, consistent height, mild variation only.
 * -------------------------------------------------------------------- */
var INJ_Y = -8.00;
var PROD_Y = -6.99;

function buildFractures(rng) {
  var out = [];

  var x0 = -1.85, x1 = 4.65;
  var stages = 13;
  var i;

  for (i = 0; i < stages; i++) {
    var t = stages === 1 ? 0.5 : i / (stages - 1);
    var x = x0 + (x1 - x0) * t;

    /* Each stage spans from the injector up past the producer, so the
       fracture visibly ties the two laterals together. Slight per-stage
       variation keeps it from looking like a printed grid without
       implying the geometry is uncontrolled. */
    var jitter = (rng() - 0.5) * 0.10;
    var over = 0.62 + rng() * 0.26;
    var under = 0.30 + rng() * 0.16;

    var bot = INJ_Y - under;
    var top = PROD_Y + over;

    out.push(makeConduit([
      [x + jitter * 0.6, bot,  0.0],
      [x + jitter,       INJ_Y + 0.35, 0.0],
      [x,                (INJ_Y + PROD_Y) / 2, 0.0],
      [x - jitter * 0.4, PROD_Y - 0.30, 0.0],
      [x - jitter * 0.8, top,  0.0]
    ], {
      segs: 54, radial: 7,
      /* widest in the middle of the stage, tapering at both tips —
         a propped fracture is lens-shaped, not a parallel slot */
      radius: function (tt) {
        return (0.014 + 0.030 * Math.sin(Math.PI * clamp01(tt)));
      },
      kind: 'fracture'
    }));

    /* a short secondary wing either side, as stimulation rarely opens a
       single perfectly planar face */
    if (rng() > 0.42) {
      var side = rng() > 0.5 ? 1 : -1;
      var wx = x + side * (0.14 + rng() * 0.10);
      out.push(makeConduit([
        [wx, INJ_Y + 0.20, 0.0],
        [wx + side * 0.06, (INJ_Y + PROD_Y) / 2, 0.0],
        [wx + side * 0.02, PROD_Y + 0.18, 0.0]
      ], {
        segs: 30, radial: 6,
        radius: function (tt) { return 0.008 + 0.014 * Math.sin(Math.PI * clamp01(tt)); },
        kind: 'fracture'
      }));
    }
  }

  return out;
}

/* ----------------------------------------------------------------------
 * The rock mass.
 *
 * A subdivided plane standing in the z = 0 plane, with a per-vertex heat
 * attribute accumulated from every fracture conduit. Distance falloff is
 * 1/(1+kd^2), summed and then saturated — cheap, and it produces the soft
 * merged isotherms that a real thermal field has.
 * -------------------------------------------------------------------- */
function buildRock(fractures, wells) {
  /* the mass runs from the datum down; sky is drawn separately */
  var W = 15.0, H = 11.4;
  var NX = 150, NY = 130;
  var geo = new THREE.PlaneGeometry(W, H, NX, NY);
  geo.translate(0, DATUM - H / 2, -0.55);

  var pos = geo.attributes.position;
  var heat = new Float32Array(pos.count);

  /* sample every fracture centreline into a flat list once, so the
     per-vertex loop is a straight distance test rather than curve
     evaluation (150x130 vertices x hundreds of curve samples otherwise) */
  var samples = [];
  var i, j, k;
  for (i = 0; i < fractures.length; i++) {
    var C = fractures[i];
    var n = Math.max(6, Math.round(C.len * 7));
    for (j = 0; j <= n; j++) {
      var t = j / n;
      var p = C.curve.getPoint(t);
      samples.push(p.x, p.y, p.z, C.radius(t) * 9.0);
    }
  }

  var v = new THREE.Vector3();
  for (i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    var acc = 0;
    for (k = 0; k < samples.length; k += 4) {
      var dx = v.x - samples[k];
      var dy = v.y - samples[k + 1];
      var dz = v.z - samples[k + 2];
      var d2 = dx * dx + dy * dy * 1.35 + dz * dz;
      /* Tight falloff. A soft 1/(1+kd^2) with small k spreads heat across
         the entire section and the result reads as fog, not as a thermal
         anomaly. Real conductive halos around a fracture are narrow — a
         metre or two of altered rock, then country rock. */
      acc += samples[k + 3] / (1.0 + d2 * 46.0);
      if (acc > 3.0) break;
    }
    /* regional geothermal gradient underneath the local anomaly */
    var grad = clamp01((-v.y - 3.5) / 10.0);
    grad = grad * grad * 0.17;
    heat[i] = clamp01(Math.sqrt(clamp01(acc * 0.62)) * 0.92 + grad);
  }

  geo.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1));
  return geo;
}
