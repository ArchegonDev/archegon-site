/* ======================================================================
 * Archegon — scene runtime
 * ====================================================================== */
'use strict';

var ArchegonScene = (function () {

  var renderer, scene, camera, clock;
  var rockMesh, fracMesh, wellMesh, thermals, campus, datum, annotations;
  var uniforms, fracUniforms, wellUniforms;
  var pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var host, running = false;
  var pulse = 0, pulseActive = false;
  var SHIFT = 0, VSHIFT = 0, NARROW = false;

  var PALETTE = {
    hot:   [1.00, 0.47, 0.19],   /* ember  #d66b35 pushed hotter */
    warm:  [0.50, 0.22, 0.10],
    cold:  [0.085, 0.095, 0.125],
    surf:  [0.96, 0.945, 0.918]  /* paper  #f5f1ea */
  };

  function buildMaterials() {
    uniforms = {
      uTime:    { value: 0 },
      uHotCol:  { value: new THREE.Color().fromArray(PALETTE.hot) },
      uWarmCol: { value: new THREE.Color().fromArray(PALETTE.warm) },
      uColdCol: { value: new THREE.Color().fromArray(PALETTE.cold) },
      uSurfCol: { value: new THREE.Color().fromArray(PALETTE.surf) },
      uDepth:   { value: DATUM },
      uReach:   { value: 3.0 }
    };
    fracUniforms = {
      uTime:    uniforms.uTime,
      uHotCol:  uniforms.uHotCol,
      uWarmCol: uniforms.uWarmCol,
      uColdCol: uniforms.uColdCol,
      uSurfCol: uniforms.uSurfCol,
      uDepth:   uniforms.uDepth,
      uReach:   uniforms.uReach,
      uPulse:   { value: 0 },
      uGain:    { value: 1.0 }
    };
    /* the wells are casing, not fluid: opaque, cooler, drawn normally */
    wellUniforms = {
      uTime:    uniforms.uTime,
      uHotCol:  uniforms.uHotCol,
      uWarmCol: uniforms.uWarmCol,
      uColdCol: uniforms.uColdCol,
      uSurfCol: uniforms.uSurfCol,
      uDepth:   uniforms.uDepth,
      uReach:   uniforms.uReach,
      uPulse:   fracUniforms.uPulse,
      uGain:    { value: 2.4 }
    };
  }

  function conduitMesh(list, mat) {
    var bag = { pos: [], nor: [], flow: [], idx: [] };
    var i;
    for (i = 0; i < list.length; i++) sweepConduit(list[i], bag);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bag.pos), 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(bag.nor), 3));
    g.setAttribute('aFlow',    new THREE.BufferAttribute(new Float32Array(bag.flow), 1));
    g.setIndex(bag.idx);
    return new THREE.Mesh(g, mat);
  }

  function build() {
    var rng = makeRng(20260818);

    buildMaterials();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08090c);

    var wells = buildWells();
    var fractures = buildFractures(rng);

    /* rock mass first: it is the backdrop everything else sits in */
    var rockGeo = buildRock(fractures, wells);
    rockMesh = new THREE.Mesh(rockGeo, new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: ROCK_VERT,
      fragmentShader: ROCK_FRAG
    }));
    scene.add(rockMesh);

    /* fractures: emissive, additive so they bloom into the rock */
    fracMesh = conduitMesh(fractures, new THREE.ShaderMaterial({
      uniforms: fracUniforms,
      vertexShader: FRAC_VERT,
      fragmentShader: FRAC_FRAG,
      transparent: true,
      depthWrite: false
    }));
    scene.add(fracMesh);

    /* wells: solid casing, cooler than the fractures */
    wellMesh = conduitMesh(wells, new THREE.ShaderMaterial({
      uniforms: wellUniforms,
      vertexShader: FRAC_VERT,
      fragmentShader: FRAC_FRAG
    }));
    scene.add(wellMesh);

    thermals = buildThermals(rng, 260);
    scene.add(thermals);

    campus = buildCampus(rng);
    scene.add(campus);

    datum = buildDatum();
    scene.add(datum);

    annotations = buildAnnotations();
    scene.add(annotations);
  }

  function layout() {
    var w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / h;

    /* Frame the section so the datum sits high and the reservoir sits on
       the lower third. Fit to whichever axis is binding, then pad, so a
       tall phone viewport does not crop the wellheads off the top nor the
       fracture wings off the sides. */
    var vFov = 34;
    camera.fov = vFov;
    var tan = 2 * Math.tan(vFov * Math.PI / 360);
    NARROW = camera.aspect < 1.05;

    /* On a phone the section cannot compete with the copy for the same
       pixels. Zoom into the reservoir and doublet, drop the composition
       low, and let the type own the top half. */
    var needH = NARROW ? 7.6 : 11.0;
    var needW = NARROW ? 9.4 : 13.0;
    var fitH = needH / tan;
    var fitW = (needW / camera.aspect) / tan;
    camera.position.z = Math.max(fitH, fitW) * 1.02;

    /* Wide: push the section right so the headline sits over undisturbed
       rock. Narrow: push it down instead. */
    SHIFT = NARROW ? 0 : 2.15;
    VSHIFT = NARROW ? -1.45 : 0;
    camera.setViewOffset(
      w, h,
      -SHIFT * (w / needW),
      VSHIFT * (h / needH),
      w, h
    );
    camera.updateProjectionMatrix();

    /* the annotation plane carries fine 9px type; hide it when the scene
       is scaled down far enough that it would only read as noise */
    if (annotations) annotations.visible = !NARROW;

    thermals.material.uniforms.uScale.value = h * 0.5;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    var dt = Math.min(clock.getDelta(), 0.05);
    if (!REDUCED) uniforms.uTime.value += dt;
    thermals.material.uniforms.uTime.value = uniforms.uTime.value;

    smooth.x += (pointer.x - smooth.x) * 0.055;
    smooth.y += (pointer.y - smooth.y) * 0.055;

    var cy = NARROW ? -6.1 : -4.2;
    if (!REDUCED) {
      camera.position.x = smooth.x * 0.55;
      camera.position.y = cy + smooth.y * 0.35;
      camera.lookAt(smooth.x * 0.18, cy + smooth.y * 0.10, 0);
    } else {
      camera.position.x = 0;
      camera.position.y = cy;
      camera.lookAt(0, cy, 0);
    }

    if (pulseActive) {
      pulse += dt / 1.6;
      fracUniforms.uPulse.value = Math.sin(Math.min(pulse, 1) * Math.PI) * 0.9;
      if (pulse >= 1) { pulseActive = false; fracUniforms.uPulse.value = 0; }
    }

    renderer.render(scene, camera);
  }

  function onPointer(e) {
    var r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  return {
    mount: function (el) {
      host = el;
      var canvas = document.createElement('canvas');
      host.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

      camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
      clock = new THREE.Clock();

      build();
      layout();
      window.addEventListener('resize', layout);
      window.addEventListener('pointermove', onPointer, { passive: true });

      running = true;
      frame();
      return this;
    },
    pulse: function () { pulse = 0; pulseActive = true; },
    dispose: function () { running = false; },
    /* lab-only introspection */
    _debug: function () {
      return { camera: camera, scene: scene, renderer: renderer, host: host };
    }
  };
})();
