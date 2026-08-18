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

  /* injector: vertical, then a build section, then lateral */
  wells.push(makeConduit([
    [-3.30,  1.10, 0.0],
    [-3.30, -0.60, 0.0],
    [-3.28, -2.60, 0.0],
    [-3.22, -4.40, 0.0],
    [-3.05, -5.80, 0.0],
    [-2.70, -6.75, 0.0],
    [-2.05, -7.15, 0.0],
    [-1.15, -7.24, 0.0],
    [-0.35, -7.26, 0.0]
  ], {
    segs: 190, radial: 16,
    radius: table([0.115, 0.108, 0.100, 0.092, 0.086, 0.080, 0.074, 0.070, 0.066]),
    kind: 'well'
  }));

  /* producer: mirrored, lands slightly deeper so the pair is not symmetric */
  wells.push(makeConduit([
    [ 3.42,  1.10, 0.0],
    [ 3.42, -0.60, 0.0],
    [ 3.40, -2.40, 0.0],
    [ 3.32, -4.20, 0.0],
    [ 3.14, -5.65, 0.0],
    [ 2.78, -6.65, 0.0],
    [ 2.10, -7.05, 0.0],
    [ 1.20, -7.14, 0.0],
    [ 0.40, -7.17, 0.0]
  ], {
    segs: 190, radial: 16,
    radius: table([0.118, 0.110, 0.102, 0.094, 0.088, 0.082, 0.076, 0.072, 0.068]),
    kind: 'well'
  }));

  return wells;
}

/* ----------------------------------------------------------------------
 * The stimulated volume: fracture wings propagating off both laterals.
 * -------------------------------------------------------------------- */
function buildFractures(rng) {
  var out = [];
  var i;

  /* stimulation stages along the injector lateral */
  var stages = [-2.05, -1.45, -0.90, -0.35];
  for (i = 0; i < stages.length; i++) {
    var x = stages[i];
    var y = RESERVOIR_Y - 0.02 + (rng() - 0.5) * 0.08;

    /* each stage opens wings on both sides of the wellbore */
    growFractures(rng, new THREE.Vector3(x, y, 0),
      new THREE.Vector3(0.72, 0.10, 0.68).normalize(),
      1.55 + rng() * 0.5, 0.052, 0, out, { maxGen: 3 });

    growFractures(rng, new THREE.Vector3(x, y, 0),
      new THREE.Vector3(0.68, -0.06, -0.72).normalize(),
      1.40 + rng() * 0.5, 0.046, 0, out, { maxGen: 3 });
  }

  /* a few wings reaching back from the producer, closing the loop */
  var pstages = [1.95, 1.25, 0.60];
  for (i = 0; i < pstages.length; i++) {
    growFractures(rng,
      new THREE.Vector3(pstages[i], RESERVOIR_Y + 0.06 + (rng() - 0.5) * 0.08, 0),
      new THREE.Vector3(-0.78, 0.04, (rng() - 0.5) * 1.2).normalize(),
      1.30 + rng() * 0.45, 0.042, 0, out, { maxGen: 2 });
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
  var W = 15.0, H = 13.0;
  var NX = 150, NY = 130;
  var geo = new THREE.PlaneGeometry(W, H, NX, NY);
  geo.translate(0, -4.2, -0.55);

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
