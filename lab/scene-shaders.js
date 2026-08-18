/* ======================================================================
 * Archegon — thermal shading
 *
 * The section is lit by heat, not by a sun. There is no key light above;
 * the dominant term is emission from the reservoir, falling off with
 * distance through rock. Rock that is near a fracture glows; rock far
 * from one stays cold and blue.
 * ====================================================================== */
'use strict';

var GLSL_COMMON = [
  'uniform float uTime;',
  'uniform vec3 uHotCol;',      /* ember at the reservoir */
  'uniform vec3 uWarmCol;',     /* amber mid-field */
  'uniform vec3 uColdCol;',     /* deep rock, unheated */
  'uniform vec3 uSurfCol;',     /* daylight at the datum line */
  'uniform float uDepth;',      /* world y of the surface datum */
  'uniform float uReach;',      /* how far heat carries through rock */

  /* cheap value noise — enough for rock mottling, no texture upload */
  'float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }',
  'float vnoise(vec3 p){',
  '  vec3 i = floor(p), f = fract(p);',
  '  f = f * f * (3.0 - 2.0 * f);',
  '  float n = mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),',
  '                    mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),',
  '                mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),',
  '                    mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);',
  '  return n;',
  '}',
  'float fbm(vec3 p){',
  '  float s = 0.0, a = 0.5;',
  '  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }',
  '  return s;',
  '}',

  /* Thermal ramp: cold -> warm -> hot, driven by a 0..1 heat field.
     Deliberately non-linear. A linear ramp reads as a plastic gradient;
     real incandescence spends most of its range in the dull-red band and
     then climbs fast, so the hot core stays small and precious. */
  /* Incandescence is expensive. Almost all of the section is country rock
     that has never seen a fracture, and it must stay genuinely black or
     the hot core has nothing to be hot against. The warm band does not
     open until 0.55 and full ember is reserved for the top 8%. */
  /* Paper -> slate -> ember. Ember is an accent, not a light source: it
     appears only where the reservoir has actually been stimulated, and
     even then it tints rather than glows. */
  /* Paper -> slate -> ember. The unheated rock must still sit clearly
     below the page tone or the section dissolves into the background;
     a printed figure needs a solid mid-grey field to draw on. */
  'vec3 thermal(float h){',
  '  h = clamp(h, 0.0, 1.0);',
  '  vec3 base = mix(uColdCol, uWarmCol, 0.55);',
  '  vec3 c = mix(base, uWarmCol, smoothstep(0.25, 0.85, h) * 0.75);',
  '  c = mix(c, uHotCol, smoothstep(0.60, 1.0, h) * 0.88);',
  '  return c;',
  '}',

  /* Depth tint: near the datum the rock picks up daylight; far below it
     loses all of it. This is what makes the section read as a section
     rather than as an object floating in a void. */
  /* Daylight does not penetrate rock. Only the top ~1.2 units of the cut
     face catch any, and even then it is a dim cool wash, not a paper-white
     mix — pushing 55% toward the page colour clipped the entire shallow
     section to 255 and destroyed the strata. */
  /* On paper, depth reads as tone: the section gets very slightly denser
     with depth so the eye knows which way is down without any lighting. */
  'vec3 daylight(vec3 c, float worldY){',
  '  float d = smoothstep(uDepth + 0.4, uDepth - 10.0, worldY);',
  '  return mix(c, mix(c, uSurfCol, 0.30), d);',
  '}'
].join('\n');

/* ----------------------------------------------------------------------
 * Rock mass: the body of the section. Receives heat from the fracture
 * network through a per-vertex heat attribute computed on the CPU, then
 * mottles it so the isotherms are not smooth blobs.
 * -------------------------------------------------------------------- */
var ROCK_VERT = [
  'attribute float aHeat;',
  'varying float vHeat;',
  'varying vec3 vPos;',
  'varying vec3 vNor;',
  'void main(){',
  '  vHeat = aHeat;',
  '  vPos = position;',
  '  vNor = normalize(normalMatrix * normal);',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

var ROCK_FRAG = [
  GLSL_COMMON,
  'varying float vHeat;',
  'varying vec3 vPos;',
  'varying vec3 vNor;',
  'void main(){',
  /* mottle the heat field so isotherms follow the rock fabric */
  /* Flat infographic strata: a small number of discrete tonal bands with
     gently undulating contacts. No per-pixel lighting, no mottling — the
     idiom is vector illustration, not rendered rock. */
  '  float warp = fbm(vec3(vPos.x * 0.17, 0.0, 0.0)) * 0.9;',
  '  float y = vPos.y + warp;',

  '  vec3 topsoil  = vec3(0.780, 0.762, 0.726);',
  '  vec3 sed1     = vec3(0.412, 0.420, 0.430);',
  '  vec3 sed2     = vec3(0.310, 0.320, 0.334);',
  '  vec3 basement = vec3(0.128, 0.138, 0.152);',

  '  vec3 col = topsoil;',
  '  col = mix(col, sed1,     step(y, -0.42));',
  '  col = mix(col, sed2,     step(y, -2.60));',
  '  col = mix(col, basement, step(y, -5.30));',

  /* thin contact rules at each boundary, the way an infographic draws them */
  '  float c1 = smoothstep(0.055, 0.0, abs(y + 0.42));',
  '  float c2 = smoothstep(0.055, 0.0, abs(y + 2.60));',
  '  float c3 = smoothstep(0.070, 0.0, abs(y + 5.30));',
  '  col = mix(col, vec3(0.086, 0.094, 0.106), max(max(c1, c2), c3) * 0.55);',

  /* The heated halo tints the basement toward the hot accent. Kept as a
     wide soft wash so it reads as "this volume is hot", not as glow. */
  '  col = mix(col, uHotCol, clamp(vHeat, 0.0, 1.0) * 0.42);',

  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

/* ----------------------------------------------------------------------
 * Fracture conduits: emissive tubes. These are the thing the eye should
 * land on, so they get a hot core and a bloom-ish falloff at the rim.
 * -------------------------------------------------------------------- */
var FRAC_VERT = [
  'attribute float aFlow;',
  'varying float vFlow;',
  'varying vec3 vPos;',
  'varying vec3 vNor;',
  'varying vec3 vView;',
  'void main(){',
  '  vFlow = aFlow;',
  '  vPos = position;',
  '  vNor = normalize(normalMatrix * normal);',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  vView = -mv.xyz;',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

var FRAC_FRAG = [
  GLSL_COMMON,
  'uniform float uPulse;',
  'uniform float uGain;',
  'uniform vec3 uTint;',
  'varying float vFlow;',
  'varying vec3 vPos;',
  'varying vec3 vNor;',
  'varying vec3 vView;',
  'void main(){',
  '  vec3 V = normalize(vView);',
  '  float facing = abs(dot(normalize(vNor), V));',

  /* working fluid travelling the fracture: a travelling band, not a
     uniform glow, so the network reads as circulating rather than lit */
  '  float travel = fract(vFlow * 0.6 - uTime * 0.16);',
  '  float band = smoothstep(0.0, 0.30, travel) * smoothstep(1.0, 0.64, travel);',

  /* Draw the conduit as a thin filament with a hot centre, not as a glowing
     volume. Grazing angles get DARKER, not brighter: the silhouette edge is
     where the tube turns away, and brightening it is what made 200 overlapping
     wings sum into a blob. */
  /* Flat fill. An infographic conduit is a solid stroke of colour with a
     hard edge, so there is no view-dependent shading at all: uTint picks
     the leg colour (cool injection / hot production) and the travelling
     band only modulates it slightly to show flow direction. */
  '  vec3 col = mix(uTint, uTint * 1.22, band);',
  '  col = mix(col, uHotCol, uPulse * 0.25);',
  '  gl_FragColor = vec4(col, uGain);',
  '}'
].join('\n');
