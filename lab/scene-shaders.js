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
  'vec3 thermal(float h){',
  '  h = clamp(h, 0.0, 1.0);',
  '  vec3 c = mix(uColdCol, uWarmCol, smoothstep(0.55, 0.90, h));',
  '  c = mix(c, uHotCol, smoothstep(0.92, 1.0, h));',
  '  return c;',
  '}',

  /* Depth tint: near the datum the rock picks up daylight; far below it
     loses all of it. This is what makes the section read as a section
     rather than as an object floating in a void. */
  /* Daylight does not penetrate rock. Only the top ~1.2 units of the cut
     face catch any, and even then it is a dim cool wash, not a paper-white
     mix — pushing 55% toward the page colour clipped the entire shallow
     section to 255 and destroyed the strata. */
  'vec3 daylight(vec3 c, float worldY){',
  '  float d = smoothstep(uDepth - 1.4, uDepth + 0.15, worldY);',
  '  return c + uSurfCol * d * 0.055;',
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
  '  float grain = fbm(vPos * 0.42);',
  /* Bedding: gently folded, so strata drape rather than run dead level.
     Low amplitude on purpose — this is a sedimentary basin over granite,
     not a fold belt. */
  '  float warp = fbm(vec3(vPos.x * 0.19, 0.0, 0.0)) * 1.1;',
  '  float yb = vPos.y + warp;',

  '  float h = vHeat * (0.86 + 0.28 * grain);',
  '  h += sin(uTime * 0.45 + vPos.y * 1.2 + grain * 6.0) * 0.012 * vHeat;',

  '  vec3 col = thermal(h);',

  /* Strata as drawn lines, not as noise. A sharp periodic band with a
     little thickness variation reads as a logged section; smooth mottle
     reads as smoke. */
  '  float band = fract(yb * 0.62);',
  '  float lam = smoothstep(0.0, 0.05, band) * smoothstep(0.16, 0.10, band);',
  '  col += vec3(0.052, 0.055, 0.066) * lam;',
  '  col *= 0.90 + 0.10 * fbm(vec3(vPos.x * 0.9, yb * 3.4, 0.0));',

  /* The granite basement: below the unconformity the fabric changes from
     layered to massive, which is the geological reason the reservoir is
     where it is. Worth one line to make that legible. */
  '  float base = smoothstep(-5.6, -6.2, vPos.y);',
  '  col = mix(col, col * vec3(0.86, 0.88, 1.00) + vec3(0.012, 0.012, 0.020) * grain, base);',

  '  col = daylight(col, vPos.y);',
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
  '  float core = pow(facing, 1.6);',

  '  float h = 0.58 + 0.30 * band + uPulse * 0.18;',
  '  vec3 col = thermal(h) * core;',
  '  col += uHotCol * band * core * 0.30;',

  '  col = daylight(col, vPos.y);',
  /* alpha, not additive: overlapping fractures occlude instead of summing */
  '  float a = clamp(core * (0.34 + 0.52 * band), 0.0, 1.0) * uGain;',
  '  gl_FragColor = vec4(col, a);',
  '}'
].join('\n');
