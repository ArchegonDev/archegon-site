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

  var halls = [
    { x: -2.30, w: 1.55, d: 0.95, h: 0.40 },
    { x: -0.62, w: 1.42, d: 0.90, h: 0.37 },
    { x:  0.92, w: 1.60, d: 0.95, h: 0.42 },
    { x:  2.58, w: 1.30, d: 0.85, h: 0.35 }
  ];

  var mat = new THREE.MeshBasicMaterial({ color: 0x0d1015 });
  var i;

  for (i = 0; i < halls.length; i++) {
    var H = halls[i];
    var box = new THREE.BoxGeometry(H.w, H.h, H.d);
    var m = new THREE.Mesh(box, mat);
    m.position.set(H.x, DATUM + H.h / 2, 0);
    group.add(m);

    /* a thin warm strip along the eaves: the only sign of life up here */
    var strip = new THREE.Mesh(
      new THREE.PlaneGeometry(H.w * 0.88, 0.030),
      new THREE.MeshBasicMaterial({ color: 0xf0b35a, transparent: true, opacity: 0.85 })
    );
    strip.position.set(H.x, DATUM + H.h * 0.72, H.d / 2 + 0.002);
    group.add(strip);
  }

  /* cooling banks: small fins between the halls */
  for (i = 0; i < 7; i++) {
    var fx = -2.95 + i * 0.98;
    var fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.16, 0.5),
      mat
    );
    fin.position.set(fx, DATUM + 0.08, 0.62);
    group.add(fin);
  }

  return group;
}

/* ----------------------------------------------------------------------
 * The datum: a single hairline across the full width. This one line is
 * what tells the viewer they are looking at a section rather than a cave.
 * -------------------------------------------------------------------- */
function buildDatum() {
  var group = new THREE.Group();

  var g = new THREE.PlaneGeometry(15.0, 0.016);
  var m = new THREE.MeshBasicMaterial({
    color: 0xd8cfc0, transparent: true, opacity: 0.5
  });
  var line = new THREE.Mesh(g, m);
  line.position.set(0, DATUM, 0.02);
  group.add(line);

  /* a soft band of daylight sitting on the surface */
  var band = new THREE.Mesh(
    new THREE.PlaneGeometry(15.0, 1.5),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uCol: { value: new THREE.Color(0xf5f1ea) } },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uCol; varying vec2 vUv;',
        'void main(){',
        '  float a = smoothstep(0.0, 0.55, vUv.y) * 0.16;',
        '  gl_FragColor = vec4(uCol, a);',
        '}'
      ].join('\n')
    })
  );
  band.position.set(0, DATUM + 0.75, -0.3);
  group.add(band);

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
