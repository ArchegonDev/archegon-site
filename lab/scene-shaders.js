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
  'vec3 thermal(float h){',
  '  h = clamp(h, 0.0, 1.0);',
  '  vec3 c = mix(uColdCol, uWarmCol, smoothstep(0.05, 0.62, h));',
  '  c = mix(c, uHotCol, smoothstep(0.55, 0.97, h));',
  '  return c;',
  '}',

  /* Depth tint: near the datum the rock picks up daylight; far below it
     loses all of it. This is what makes the section read as a section
     rather than as an object floating in a void. */
  'vec3 daylight(vec3 c, float worldY){',
  '  float d = smoothstep(uDepth - 5.0, uDepth + 0.6, worldY);',
  '  return mix(c, mix(c, uSurfCol, 0.55), d);',
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
  '  float bed = fbm(vec3(vPos.x * 0.12, vPos.y * 1.9, vPos.z * 0.12));',
  '  float h = vHeat * (0.72 + 0.55 * grain) - bed * 0.06;',

  /* slow convective breathing, strongest where it is hottest */
  '  h += sin(uTime * 0.5 + vPos.y * 1.4 + grain * 6.0) * 0.022 * vHeat;',

  '  vec3 col = thermal(h);',
  /* bedding planes: thin darker laminae give the mass a stratigraphy */
  '  float lam = smoothstep(0.42, 0.5, fract(vPos.y * 0.85 + bed * 0.5));',
  '  col *= 0.82 + 0.18 * lam;',
  /* grazing light picks out the cut face */
  '  float rim = pow(1.0 - abs(vNor.z), 2.4);',
  '  col += uWarmCol * rim * 0.05 * (0.3 + h);',
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
  '  float band = smoothstep(0.0, 0.28, travel) * smoothstep(1.0, 0.62, travel);',

  '  float h = 0.30 + 0.34 * band + uPulse * 0.22;',
  '  vec3 col = thermal(h);',

  /* The tube edge blooms, but gently. These are additively blended and
     there are ~200 of them overlapping in depth; anything above ~0.2 here
     stacks into a white fireball rather than a legible network. */
  '  col += uHotCol * pow(1.0 - facing, 3.5) * 0.10;',
  '  col *= 0.22 + 0.30 * band;',
  '  col = daylight(col, vPos.y);',
  '  gl_FragColor = vec4(col * uGain, 1.0);',
  '}'
].join('\n');
