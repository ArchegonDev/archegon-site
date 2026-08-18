/* ======================================================================
 * Archegon — section annotation
 *
 * A depth scale, horizon labels, and a temperature callout at the
 * reservoir. This is the layer that turns a picture into a drawing: it
 * says the thing has been surveyed, logged, and reasoned about.
 *
 * Rendered as one canvas texture on a plane rather than as DOM, so it
 * shares the scene's parallax and cannot desynchronise from the geometry.
 * ====================================================================== */
'use strict';

/* world-space extents the annotation plane covers */
var ANN = { w: 15.0, top: 1.9, bottom: -11.1 };

function buildAnnotations(opts) {
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var PX = 1024;
  var H = Math.round(PX * (ANN.top - ANN.bottom) / ANN.w);

  var c = document.createElement('canvas');
  c.width = Math.round(PX * DPR);
  c.height = Math.round(H * DPR);
  var g = c.getContext('2d');
  g.scale(DPR, DPR);

  /* world -> canvas */
  function cx(x) { return (x + ANN.w / 2) / ANN.w * PX; }
  function cy(y) { return (ANN.top - y) / (ANN.top - ANN.bottom) * H; }

  var INK = 'rgba(16,20,24,';
  var EMBER = 'rgba(214,107,53,';

  g.clearRect(0, 0, PX, H);
  g.font = '500 10px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';

  /* Depth scale rides just inside the injector, not out at the frame
     edge: with the section shifted right for the copy column, the far
     left of the annotation plane is off-screen. */
  var sx = cx(-4.55);
  var depths = [0, -1, -2, -3, -4, -5];        /* km */
  var i;

  g.strokeStyle = INK + '0.30)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(sx, cy(0));
  g.lineTo(sx, cy(-10.4));
  g.stroke();

  for (i = 0; i < depths.length; i++) {
    var wy = depths[i] * 2.08;                  /* 1 km ~ 2.08 world units */
    var y = cy(wy);
    var major = i % 1 === 0;

    g.strokeStyle = INK + (major ? '0.48)' : '0.24)');
    g.beginPath();
    g.moveTo(sx, y);
    g.lineTo(sx + (major ? 9 : 5), y);
    g.stroke();

    if (major) {
      g.fillStyle = INK + '0.62)';
      g.textAlign = 'right';
      g.fillText(depths[i] === 0 ? '0' : String(-depths[i]) + ' km', sx - 7, y);
    }
  }

  g.save();
  g.translate(sx - 34, cy(-5.2));
  g.rotate(-Math.PI / 2);
  g.textAlign = 'center';
  g.fillStyle = INK + '0.46)';
  g.font = '500 9px Inter, system-ui, sans-serif';
  g.setLineDash([]);
  g.fillText('DEPTH BELOW DATUM', 0, 0);
  g.restore();

  /* ---- horizon labels along the right ------------------------------ */
  var horizons = [
    { y: -0.05, label: 'SURFACE DATUM', tone: 0.46 },
    { y: -5.90, label: 'UNCONFORMITY', tone: 0.34 },
    { y: -7.20, label: 'GRANITE BASEMENT', tone: 0.34 }
  ];

  g.textAlign = 'left';
  g.font = '500 9px Inter, system-ui, sans-serif';
  for (i = 0; i < horizons.length; i++) {
    var hz = horizons[i];
    var hy = cy(hz.y);
    g.strokeStyle = INK + '0.20)';
    g.setLineDash([2, 4]);
    g.beginPath();
    g.moveTo(cx(4.15), hy);
    g.lineTo(cx(5.45), hy);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = INK + hz.tone + ')';
    g.fillText(hz.label, cx(5.55), hy);
  }

  /* ---- reservoir callout ------------------------------------------- */
  var rx = cx(0.15), ry = cy(-7.25);
  g.strokeStyle = EMBER + '0.55)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(rx, ry + 26);
  g.lineTo(rx, ry + 62);
  g.lineTo(rx + 74, ry + 62);
  g.stroke();

  g.fillStyle = EMBER + '0.95)';
  g.font = '700 13px Inter, system-ui, sans-serif';
  g.fillText('190 \u00B0C', rx + 80, ry + 62);

  g.fillStyle = INK + '0.54)';
  g.font = '500 9px Inter, system-ui, sans-serif';
  g.fillText('STIMULATED RESERVOIR VOLUME', rx + 80, ry + 76);

  /* ---- well labels -------------------------------------------------- */
  g.font = '500 9px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = INK + '0.58)';
  g.fillText('INJECTOR', cx(-3.30), cy(1.42));
  g.fillText('PRODUCER', cx(3.42), cy(1.42));

  /* ---- flow direction arrows along the doublet ---------------------- */
  function arrow(x, y, dir) {
    var ax = cx(x), ay = cy(y);
    g.strokeStyle = EMBER + '0.62)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(ax - 4 * dir, ay - 4);
    g.lineTo(ax + 4 * dir, ay);
    g.lineTo(ax - 4 * dir, ay + 4);
    g.stroke();
  }
  arrow(-3.30, -2.5, -1);
  arrow(-3.28, -4.6, -1);
  arrow( 3.40, -4.6,  1);
  arrow( 3.42, -2.5,  1);

  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if ('anisotropy' in tex) tex.anisotropy = 4;

  var plane = new THREE.Mesh(
    new THREE.PlaneGeometry(ANN.w, ANN.top - ANN.bottom),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false
    })
  );
  plane.position.set(0, (ANN.top + ANN.bottom) / 2, 0.9);
  plane.renderOrder = 40;
  return plane;
}
