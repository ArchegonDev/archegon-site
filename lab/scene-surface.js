/* ======================================================================
 * Archegon — the surface layer
 *
 * Above the datum: a thin ground line, a row of data-centre halls, and the
 * two wellheads. Deliberately small and quiet. The halls are the payload,
 * not the subject; the subject is the heat that feeds them.
 * ====================================================================== */
'use strict';

/* ----------------------------------------------------------------------
 * Data-centre halls: extruded boxes with a slight roof pitch, in a row
 * along the datum. Kept low-poly and unlit-ish so they read as a clean
 * industrial silhouette against the sky, not as a rendered 3D object.
 * -------------------------------------------------------------------- */
function buildCampus(rng) {
  var group = new THREE.Group();

  /* Long, low, and repeated. A hyperscale hall is ~5x longer than it is
     tall; the earlier boxes were nearly cubic, which is why they read as
     luggage rather than as buildings. Everything here is silhouette. */
  var halls = [
    { x: -2.62, w: 1.34, d: 0.62, h: 0.20 },
    { x: -1.12, w: 1.34, d: 0.62, h: 0.20 },
    { x:  0.38, w: 1.34, d: 0.62, h: 0.20 },
    { x:  1.88, w: 1.34, d: 0.62, h: 0.20 },
    { x:  3.30, w: 0.86, d: 0.54, h: 0.17 }
  ];

  var shell = new THREE.MeshBasicMaterial({ color: 0x101418 });
  var trim  = new THREE.MeshBasicMaterial({ color: 0x3a4048 });
  var i, j;

  for (i = 0; i < halls.length; i++) {
    var H = halls[i];

    var m = new THREE.Mesh(new THREE.BoxGeometry(H.w, H.h, H.d), shell);
    m.position.set(H.x, DATUM + H.h / 2, 0);
    group.add(m);

    /* parapet: a slightly wider, thinner slab on top reads as a roofline
       and stops the box looking like a solid brick */
    var cap = new THREE.Mesh(new THREE.BoxGeometry(H.w * 1.03, 0.022, H.d * 1.05), trim);
    cap.position.set(H.x, DATUM + H.h + 0.011, 0);
    group.add(cap);

    /* roof plant: chillers in a row, the visual signature of a data hall */
    for (j = 0; j < 5; j++) {
      var u = (j + 0.5) / 5;
      var unit = new THREE.Mesh(new THREE.BoxGeometry(H.w * 0.13, 0.045, H.d * 0.42), trim);
      unit.position.set(H.x - H.w / 2 + u * H.w, DATUM + H.h + 0.045, -0.02);
      group.add(unit);
    }
  }

  return group;
}

/* ----------------------------------------------------------------------
 * The datum: a single hairline across the full width. This one line is
 * what tells the viewer they are looking at a section rather than a cave.
 * -------------------------------------------------------------------- */
function buildDatum() {
  var group = new THREE.Group();

  /* The ground line is the heaviest rule in the drawing: on a printed
     section the datum is what every depth is measured from. */
  var line = new THREE.Mesh(
    new THREE.PlaneGeometry(15.0, 0.020),
    new THREE.MeshBasicMaterial({ color: 0x101418, transparent: true, opacity: 0.72 })
  );
  line.position.set(0, DATUM, 0.02);
  group.add(line);

  return group;
}

/* ----------------------------------------------------------------------
 * Rising thermal particles: convection in the rock mass. Slow, sparse,
 * and confined to the heated region so they read as physics rather than
 * as decoration.
 * -------------------------------------------------------------------- */
function buildThermals(rng, count) {
  var pos = new Float32Array(count * 3);
  var seed = new Float32Array(count);
  var i;
  for (i = 0; i < count; i++) {
    var a = rng();
    pos[i * 3]     = -4.2 + rng() * 8.4;
    pos[i * 3 + 1] = RESERVOIR_Y + rng() * 5.5;
    pos[i * 3 + 2] = -0.5 + rng() * 1.0;
    seed[i] = a;
  }

  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  var mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uScale: { value: 400 },
      uSize:  { value: 7 },
      uCol:   { value: new THREE.Color(0xd66b35) }
    },
    vertexShader: [
      'attribute float aSeed;',
      'uniform float uTime, uScale, uSize;',
      'varying float vA;',
      'void main(){',
      '  vec3 p = position;',
      /* rise, wrap, and drift sideways as they cool */
      '  float life = fract(aSeed + uTime * 0.045);',
      '  p.y += life * 5.2;',
      '  p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.28 * life;',
      '  vA = sin(life * 3.14159) * (0.30 + 0.55 * (1.0 - life));',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = uSize * (uScale / -mv.z) * (0.5 + aSeed);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uCol; varying float vA;',
      'void main(){',
      '  vec2 d = gl_PointCoord - 0.5;',
      '  float r = dot(d, d);',
      '  if (r > 0.25) discard;',
      '  float a = smoothstep(0.25, 0.0, r) * vA;',
      '  gl_FragColor = vec4(uCol, a);',
      '}'
    ].join('\n')
  });

  return new THREE.Points(g, mat);
}
