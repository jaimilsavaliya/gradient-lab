(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,28128,e=>{"use strict";let t="https://app.backgrounds.supply",a=`${t}/api/track/gradient-lab`,o="gl_vid";function i(){try{let e=localStorage.getItem(o);return e||(e=crypto.randomUUID?.()??String(Math.random()).slice(2)+Date.now().toString(36),localStorage.setItem(o,e)),e}catch{return"anon"}}let l=`${t}/api/gradient-lab/lead`,n="gl_email";async function r(e,t){let a=e.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))return{ok:!1,error:"Enter a valid email address."};try{let e=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:a,visitorId:i(),source:t})});if(!e.ok){let t=await e.json().catch(()=>({}));return{ok:!1,error:t.error||"Something went wrong. Try again."}}try{localStorage.setItem(n,a)}catch{}return{ok:!0}}catch{try{localStorage.setItem(n,a)}catch{}return{ok:!0}}}e.s(["captureLead",0,r,"hasCapturedEmail",0,function(){try{return!!localStorage.getItem(n)}catch{return!1}},"trackGL",0,function(e){try{let t=JSON.stringify({...e,visitorId:i()});"u">typeof navigator&&navigator.sendBeacon?navigator.sendBeacon(a,new Blob([t],{type:"text/plain"})):fetch(a,{method:"POST",body:t,keepalive:!0,mode:"no-cors"}).catch(()=>{})}catch{}}])},46775,92328,1205,59544,e=>{"use strict";let t=`#version 300 es
in vec2 a_pos;
// Sub-rectangle of the full image this draw covers, in 0..1 uv:
// xy = min corner, zw = size. (0,0,1,1) = the whole frame (live canvas).
// The exporter renders big stills tile by tile and passes each tile's rect,
// so v_uv0 is always a GLOBAL uv and every mode tiles seamlessly.
uniform vec4 u_uvRect;
out vec2 v_uv0;
void main() {
  vec2 uv01 = a_pos * 0.5 + 0.5;
  vec4 r = (u_uvRect.z == 0.0) ? vec4(0.0, 0.0, 1.0, 1.0) : u_uvRect;
  v_uv0 = r.xy + uv01 * r.zw;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`,a=`
precision highp float;
precision highp int;

in vec2 v_uv0;
out vec4 outColor;
// Every mode reads v_uv. main() (in the footer) sets it from v_uv0 before the
// mode runs; the dither-art mode snaps it to cell centres, and a framing
// window (u_view) maps it into the design frame's uv.
vec2 v_uv;
// The same point in OUTPUT-frame uv (0..1 across the exported image). Frame
// effects (the vignette) use this, so they hug the output, not the design.
vec2 v_uvOut;

// --- Common uniforms (every mode gets these) ---
uniform float u_time;
uniform vec2  u_resolution;   // FULL output size, also while rendering a tile
uniform int   u_blobCount;
uniform vec3  u_colors[8];
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_grain;

// --- V2 engine uniforms. Zero/neutral values = legacy behaviour. ---
uniform vec2  u_tileOffset;   // this tile's bottom-left pixel inside the full image
uniform float u_ditherLSB;    // anti-banding dither amplitude in LSB (host sets 1)
uniform vec4  u_view;         // framing window in design uv (xy min, zw size); zw = 0 means none
uniform vec2  u_outSize;      // FULL output size in pixels (u_resolution is the design frame's)

// Colour pipeline (paletteAt / rampLin). LAB_PAL (compile-time) selects the
// V2 ramp inside paletteAt; the legacy variant compiles the legacy maths only.
uniform int   u_palSpace;     // 0 sRGB, 1 linear light, 2 OKLab, 3 OKLCH
uniform float u_stops[8];     // stop positions 0..1 (always filled by the host)
uniform float u_palBias;      // 0..1, 0.5 = neutral (gamma 1)
uniform float u_palSharp;     // 0..1, 0 = legacy smoothstep transition
uniform vec3  u_colLin[8];    // palette in linear light (host precomputed)
uniform vec3  u_colLab[8];    // palette in OKLab (host precomputed)

// Global post stack. LAB_FX (compile-time) selects the V2 output path; the
// legacy variant compiles the legacy writeColor maths only.
uniform int   u_tone;         // 0 none, 1 ACES
uniform float u_exposure;     // linear multiplier (2^EV)
uniform int   u_grainType;    // 0 classic simplex (legacy), 1 film grain
uniform float u_grainSize;    // film grain size in OUTPUT pixels
uniform float u_grainChroma;  // 0 mono .. 1 full RGB grain
uniform float u_grainTone;    // 0 flat .. 1 mid-tones only
uniform float u_grainSeed;
uniform float u_grainFrame;   // 0 = static grain; >0 = animated frame index
uniform float u_vigAmount;    // 0 = off
uniform float u_vigSize;
uniform float u_vigSoft;
uniform int   u_ditherOn;     // ordered-dither art mode
uniform int   u_ditherBits;   // Bayer matrix = 2^bits (1, 2, 3 -> 2x2, 4x4, 8x8)
uniform float u_ditherCell;   // cell size in OUTPUT pixels
uniform float u_ditherLevels; // levels per channel (2..8)
uniform int   u_ditherPal;    // 0 per channel, 1 two nearest palette colours (OKLab)

/*
 * 2D simplex noise: webgl-noise by Ian McEwan (Ashima Arts) and
 * Stefan Gustavson. https://github.com/stegu/webgl-noise
 *
 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
 * Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
vec3 _mod289_3(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 _mod289_2(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 _permute(vec3 x){ return _mod289_3(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = _mod289_2(i);
  vec3 p = _permute(_permute( i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// FBM (fractional Brownian motion) — sums octaves of simplex noise.
float fbm(vec2 p, int octaves, float lacunarity, float gain) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += amp * snoise(p);
    p *= lacunarity;
    amp *= gain;
  }
  return v;
}

// ------------------------------------------------------------------------
// Colour helpers (V2). OKLab matrices: Bjorn Ottosson (public domain / MIT).
// ------------------------------------------------------------------------
vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLinear(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return max(vec3( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                  -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                  -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0);
}

// Transition shaping for one ramp segment (V2 ramps only; the legacy
// paletteAt keeps its own smoothstep). Bias = gamma. Sharpness 0 = linear
// (no flat spots at the stops, so smooth fields never terrace), 0.25 = the
// classic smoothstep S-curve, 1 = nearly hard steps.
float shapeT(float f) {
  f = clamp(f, 0.0, 1.0);
  if (u_palBias != 0.5) {
    float g = u_palBias < 0.5 ? 1.0 + 3.0 * (1.0 - 2.0 * u_palBias)
                              : 1.0 - 1.5 * (u_palBias - 0.5);
    f = pow(f, g);
  }
  float sh = clamp(u_palSharp, 0.0, 1.0);
  if (sh <= 0.0) return f;
  float h = 0.5 - 0.48 * clamp((sh - 0.25) / 0.75, 0.0, 1.0);
  return mix(f, smoothstep(0.5 - h, 0.5 + h, f), clamp(sh * 4.0, 0.0, 1.0));
}

// Mix palette entries i and j in the selected space. Returns LINEAR light.
vec3 mixPaletteLin(int i, int j, float f) {
  if (u_palSpace == 0) return srgbToLinear(mix(u_colors[i], u_colors[j], f));
  if (u_palSpace == 1) return mix(u_colLin[i], u_colLin[j], f);
  if (u_palSpace == 2) return oklabToLinear(mix(u_colLab[i], u_colLab[j], f));
  // OKLCH: lightness + chroma linear, hue along the shorter arc. Achromatic
  // guard (CSS Color 4 "powerless hue"): a stop with ~zero chroma borrows its
  // neighbour's hue, so black/white/grey stops never drag the blend grey.
  vec3 a = u_colLab[i], b = u_colLab[j];
  float ca = length(a.yz), cb = length(b.yz);
  float ha = ca < 1e-4 ? 0.0 : atan(a.z, a.y);
  float hb = cb < 1e-4 ? 0.0 : atan(b.z, b.y);
  if (ca < 1e-4) ha = hb;
  if (cb < 1e-4) hb = ha;
  float dh = hb - ha;
  dh -= 6.28318530718 * floor((dh + 3.14159265359) / 6.28318530718);
  float h = ha + dh * f;
  float c = mix(ca, cb, f);
  return oklabToLinear(vec3(mix(a.x, b.x, f), c * cos(h), c * sin(h)));
}

// V2 gradient map: explicit stop positions, chosen space, shaped transitions.
// Returns LINEAR light. New generators call this directly.
vec3 rampLin(float t) {
  t = clamp(t, 0.0, 1.0);
  int n = max(u_blobCount, 1);
  if (n == 1) return u_colLin[0];
  if (t <= u_stops[0]) return u_colLin[0];
  for (int i = 0; i < 7; i++) {
    if (i + 1 >= n) break;
    float a = u_stops[i], b = u_stops[i + 1];
    if (t <= b) {
      float f = (t - a) / max(b - a, 1e-5);
      return mixPaletteLin(i, i + 1, shapeT(f));
    }
  }
  return u_colLin[n - 1];
}

// The palette as a loop: evenly spaced, the last colour blends back into the
// first. Used by angular generators (Burst). Returns LINEAR light.
vec3 rampLinCyclic(float t) {
  int n = max(u_blobCount, 1);
  if (n == 1) return u_colLin[0];
  float ft = fract(t) * float(n);
  int i0 = int(floor(ft));
  if (i0 >= n) i0 = n - 1;
  int i1 = i0 + 1;
  if (i1 >= n) i1 = 0;
  return mixPaletteLin(i0, i1, shapeT(fract(ft)));
}

// Sample a color from the active palette by a 0..1 scalar t.
// Maps t across u_blobCount entries with smooth interpolation.
vec3 paletteAt(float t) {
#if LAB_PAL
  return linearToSrgb(rampLin(t));
#else
  t = clamp(t, 0.0, 1.0);
  float n = float(max(u_blobCount - 1, 1));
  float ft = t * n;
  int i0 = int(floor(ft));
  int i1 = int(min(float(u_blobCount - 1), float(i0 + 1)));
  float f = ft - float(i0);
  vec3 c0 = u_colors[i0];
  vec3 c1 = u_colors[i1];
  return mix(c0, c1, smoothstep(0.0, 1.0, f));
#endif
}

// ------------------------------------------------------------------------
// Hashing (V2). lowbias32 by Chris Wellons (public domain). Integer hashes
// stay exact at any resolution, so grain and dither are identical across
// export tiles and across 4K / 8K renders.
// ------------------------------------------------------------------------
uint _hash32(uint x) {
  x ^= x >> 16; x *= 0x7feb352dU;
  x ^= x >> 15; x *= 0x846ca68bU;
  x ^= x >> 16;
  return x;
}
uint hashPixel(ivec2 p, uint seed) {
  return _hash32(uint(p.x) + _hash32(uint(p.y) + _hash32(seed)));
}
float hashToUnit(uint h) { return float(h >> 8) * (1.0 / 16777216.0); }
// Continuous-coordinate hash in [0,1): lattice points of value noise.
float hash12(vec2 p, float seed) {
  return hashToUnit(hashPixel(ivec2(floor(p)), uint(seed) * 2654435761U));
}
// Smooth value noise in [0,1) (quintic fade) for generators that want
// cheap organic variation with an explicit seed.
float vnoise(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i, seed), b = hash12(i + vec2(1.0, 0.0), seed);
  float c = hash12(i + vec2(0.0, 1.0), seed), d = hash12(i + vec2(1.0, 1.0), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Rotated-octave simplex FBM in [-1, 1]-ish. The per-octave rotation breaks
// up the axis-aligned repetition you get from plain scaling.
float fbmr(vec2 p, int octaves) {
  float v = 0.0, amp = 0.5;
  mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += amp * snoise(p);
    p = rot * p;
    amp *= 0.5;
  }
  return v;
}
float gauss(float x, float s) { return exp(-(x * x) / (2.0 * s * s)); }

// Global (whole-image) pixel coordinate of this fragment, exact integers.
ivec2 globalPixel() { return ivec2(floor(gl_FragCoord.xy + u_tileOffset)); }

vec3 applyGrade(vec3 col) {
  col *= u_brightness;
  col = (col - 0.5) * u_contrast + 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, u_saturation);
  return col;
}

// ------------------------------------------------------------------------
// Post stack (V2, original code)
// ------------------------------------------------------------------------

// Anti-banding: triangular-PDF dither of strictly less than 1 LSB peak before
// the 8-bit write, one independent sample per channel. It fades out at exact
// 0 and 1 so flat black / white stay exact. Static per pixel.
vec3 antiBand(vec3 c) {
  if (u_ditherLSB <= 0.0) return c;
  uint h0 = hashPixel(globalPixel(), 0x68e31da4U);
  uint h1 = _hash32(h0), h2 = _hash32(h1), h3 = _hash32(h2), h4 = _hash32(h3), h5 = _hash32(h4);
  vec3 r1 = vec3(hashToUnit(h0), hashToUnit(h1), hashToUnit(h2));
  vec3 r2 = vec3(hashToUnit(h3), hashToUnit(h4), hashToUnit(h5));
  vec3 n = r1 + r2 - 1.0;                                  // (-1, 1)
  vec3 a = clamp(min(c, 1.0 - c) * 255.0, 0.0, 1.0);
  return clamp(c + n * a * (min(u_ditherLSB, 1.0) / 255.0), 0.0, 1.0);
}

vec3 acesFilm(vec3 x) {   // Narkowicz fit of the ACES RRT+ODT
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toneMapLin(vec3 lin) {
  lin *= u_exposure;
  if (u_tone == 1) lin = acesFilm(lin);
  return lin;
}

// Film grain: per-pixel integer-hash noise sized in OUTPUT pixels (smooth
// clumps above 1 px), mono/RGB mix, weighted toward the mid-tones.
vec4 _grainSample(ivec2 cell, uint seed) {
  uint h0 = hashPixel(cell, seed);
  uint h1 = _hash32(h0), h2 = _hash32(h1), h3 = _hash32(h2);
  return vec4(hashToUnit(h0), hashToUnit(h1), hashToUnit(h2), hashToUnit(h3));
}
vec3 filmGrain(vec3 s) {
  vec2 gp = gl_FragCoord.xy + u_tileOffset;
  if (u_ditherOn == 1 && u_ditherCell > 1.0) gp = (floor(gp / u_ditherCell) + 0.5) * u_ditherCell;
  uint seed = uint(max(u_grainSeed, 0.0)) * 747796405U + uint(max(u_grainFrame, 0.0)) * 2891336453U + 1U;
  float size = max(u_grainSize, 1.0);
  vec4 n;
  if (size < 1.01) {
    n = _grainSample(ivec2(floor(gp)), seed) - 0.5;
  } else {
    vec2 q = gp / size;
    vec2 i = floor(q), f = fract(q);
    vec2 u = f * f * (3.0 - 2.0 * f);
    ivec2 ii = ivec2(i);
    vec4 a = _grainSample(ii, seed), b = _grainSample(ii + ivec2(1, 0), seed);
    vec4 c = _grainSample(ii + ivec2(0, 1), seed), d = _grainSample(ii + ivec2(1, 1), seed);
    n = (mix(mix(a, b, u.x), mix(c, d, u.x), u.y) - 0.5) * 1.6;
  }
  float lum = dot(clamp(s, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
  float resp = mix(1.0 - u_grainTone, 1.0, 1.0 - abs(lum * 2.0 - 1.0));
  return mix(vec3(n.x), n.yzw, u_grainChroma) * u_grain * resp;
}

// Bayer index 0..N*N-1 for an N = 2^k matrix (bit interleave of x^y and y).
int bayerIndex(ivec2 p, int k) {
  int v = 0;
  int xy = p.x ^ p.y;
  for (int i = 0; i < 3; i++) {
    if (i >= k) break;
    v = (v << 2) | (((xy >> i) & 1) << 1) | ((p.y >> i) & 1);
  }
  return v;
}

// Palette-limited dither: pick between the two palette colours nearest to
// the pixel in OKLab, using the Bayer threshold along the segment joining them.
vec3 paletteDither(vec3 c, float th) {
  vec3 lab = linearToOklab(srgbToLinear(c));
  float d1 = 1e9, d2 = 1e9;
  int i1 = 0, i2 = 0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_blobCount) break;
    vec3 e = lab - u_colLab[i];
    float d = dot(e, e);
    if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = i; }
    else if (d < d2) { d2 = d; i2 = i; }
  }
  vec3 a = u_colLab[i1], b = u_colLab[i2];
  vec3 ab = b - a;
  float t = clamp(dot(lab - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
  return (t > th) ? u_colors[i2] : u_colors[i1];
}

vec3 orderedDither(vec3 c) {
  vec2 gp = gl_FragCoord.xy + u_tileOffset;
  ivec2 cell = ivec2(floor(gp / max(u_ditherCell, 1.0)));
  int k = clamp(u_ditherBits, 1, 3);
  int n = 1 << k;
  int idx = bayerIndex(cell & ivec2(n - 1), k);
  float th = (float(idx) + 0.5) / float(n * n);
  if (u_ditherPal == 1 && u_blobCount > 1) return paletteDither(c, th);
  float L = max(u_ditherLevels - 1.0, 1.0);
  return clamp(floor(c * L + th) / L, 0.0, 1.0);
}

// Display-space tail shared by both entry points: grade, vignette, grain,
// then either the dither-art quantiser or the invisible anti-banding dither.
void _finishDisplay(vec3 col) {
  col = applyGrade(col);
  if (u_vigAmount > 0.0) {
    float d = length((v_uvOut - 0.5) * 2.0) * 0.70710678;   // 0 centre, 1 corners
    col *= 1.0 - clamp(u_vigAmount, 0.0, 1.0) * smoothstep(u_vigSize, u_vigSize + max(u_vigSoft, 0.01), d);
  }
  if (u_grainType == 0) {
    float g = (snoise(v_uv * u_resolution.y * 0.6 + u_time * 137.0) - 0.5) * u_grain;
    col += g;
  } else if (u_grain > 0.0) {
    col += filmGrain(col);
  }
  vec3 c = clamp(col, 0.0, 1.0);
  c = (u_ditherOn == 1) ? orderedDither(c) : antiBand(c);
  outColor = vec4(c, 1.0);
}

// Final write for legacy modes (display-referred, sRGB-ish values).
// Each mode must call this (or writeColorLinear).
void writeColor(vec3 col) {
#if LAB_FX
  if (u_tone != 0 || u_exposure != 1.0) col = linearToSrgb(toneMapLin(srgbToLinear(col)));
  _finishDisplay(col);
#else
  // Legacy path, verbatim, plus the always-on anti-banding dither.
  col = applyGrade(col);
  float g = (snoise(v_uv * u_resolution.y * 0.6 + u_time * 137.0) - 0.5) * u_grain;
  col += g;
  outColor = vec4(antiBand(clamp(col, 0.0, 1.0)), 1.0);
#endif
}

// Final write for V2 generators, which do their maths in LINEAR light.
void writeColorLinear(vec3 lin) {
  _finishDisplay(linearToSrgb(toneMapLin(max(lin, 0.0))));
}
`,o=`
void main() {
  v_uv = v_uv0;
#if LAB_FX
  if (u_ditherOn == 1 && u_ditherCell > 1.0) {
    // Dither art: evaluate the generator once per cell so the lattice reads as
    // big, clean pixels (cell size is in output pixels, global coordinates).
    vec2 g = gl_FragCoord.xy + u_tileOffset;
    g = (floor(g / u_ditherCell) + 0.5) * u_ditherCell;
    v_uv = g / u_outSize;
  }
  v_uvOut = v_uv;
  // Framing window: the output shows u_view (a rect in design uv), so a phone
  // or square frame is another window onto the same unbounded field.
  if (u_view.z != 0.0) v_uv = u_view.xy + v_uv * u_view.zw;
#else
  v_uvOut = v_uv;
#endif
  _modeMain();
}
`;e.s(["FRAG_FOOTER",0,o,"FRAG_HEADER",0,a,"VERTEX_SHADER",0,t],92328);let i={id:"mesh",name:"Mesh",hasBlobs:!0,uniforms:[{name:"u_noiseScale",label:"Noise scale",min:.5,max:4,step:.05,default:1.4,group:"shape"},{name:"u_softness",label:"Softness",min:0,max:1,step:.01,default:.7,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:.5,step:.005,default:.18,group:"motion"},{name:"u_flowSpeed",label:"Flow speed",min:0,max:1.5,step:.01,default:.18,group:"motion"}],fragment:`
uniform vec2  u_blobOffsets[8];
uniform float u_noiseScale;
uniform float u_flowSpeed;
uniform float u_warp;
uniform float u_softness;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_flowSpeed;

  vec2 q = vec2(
    snoise(p * u_noiseScale + vec2(t,        0.0)),
    snoise(p * u_noiseScale + vec2(5.2,      t * 0.7) + vec2(1.3))
  );
  vec2 r = vec2(
    snoise(p * u_noiseScale + 4.0 * q + vec2(1.7 + t * 0.4, 9.2)),
    snoise(p * u_noiseScale + 4.0 * q + vec2(8.3, 2.8 + t * 0.5))
  );
  vec2 warped = p + r * u_warp;

  vec3 col = vec3(0.0);
  float totalWeight = 0.0;
  float falloff = mix(12.0, 2.5, clamp(u_softness, 0.0, 1.0));
  for (int i = 0; i < 8; i++) {
    if (i >= u_blobCount) break;
    float fi = float(i);
    vec2 base = u_blobOffsets[i] * vec2(aspect, 1.0);
    vec2 orbit = 0.32 * vec2(
      sin(t * 0.5 + fi * 1.7) * aspect * 0.5,
      cos(t * 0.6 + fi * 2.3) * 0.5
    );
    vec2 center = base + orbit;
    float d = distance(warped, center);
    float w = 1.0 / (d * d * falloff + 0.04);
    col += u_colors[i] * w;
    totalWeight += w;
  }
  col /= max(totalWeight, 1e-4);

  writeColor(col);
}
`},l={id:"soft",name:"Soft",hasBlobs:!0,uniforms:[{name:"u_blur",label:"Blur",min:0,max:1,step:.01,default:.7,group:"shape"},{name:"u_spread",label:"Spread",min:.4,max:1.6,step:.01,default:1,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:.5,step:.002,default:.05,group:"motion"}],fragment:`
uniform vec2  u_blobOffsets[8];
uniform float u_blur;
uniform float u_spread;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // No domain warp — just clean radial blending. Larger blur = softer falloff.
  float falloff = mix(8.0, 1.2, clamp(u_blur, 0.0, 1.0));

  vec3 col = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_blobCount) break;
    float fi = float(i);
    vec2 base = u_blobOffsets[i] * vec2(aspect, 1.0) * u_spread * 1.4;
    // Tiny breathing motion; mostly static.
    vec2 drift = 0.04 * vec2(
      sin(t + fi * 1.7),
      cos(t * 1.1 + fi * 2.3)
    );
    vec2 center = base + drift;
    float d = distance(p, center);
    float w = 1.0 / (d * d * falloff + 0.012);
    col += u_colors[i] * w;
    total += w;
  }
  col /= max(total, 1e-4);

  writeColor(col);
}
`},n={id:"smoke",name:"Smoke",uniforms:[{name:"u_density",label:"Density",min:.5,max:4,step:.05,default:1.6,group:"shape"},{name:"u_octaves",label:"Detail",min:2,max:7,step:1,default:5,group:"shape"},{name:"u_contrast2",label:"Cloud bite",min:.5,max:2.5,step:.02,default:1.4,group:"shape"},{name:"u_speed",label:"Drift speed",min:0,max:1,step:.005,default:.12,group:"motion"},{name:"u_swirl",label:"Swirl",min:0,max:1.5,step:.01,default:.5,group:"motion"}],fragment:`
uniform float u_density;
uniform float u_octaves;   // float; cast to int
uniform float u_contrast2;
uniform float u_speed;
uniform float u_swirl;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_density;

  float t = u_time * u_speed;

  // Domain-warp the FBM input by another FBM evaluation — gives swirly
  // smoke shapes instead of a uniform cloud field.
  int oct = int(u_octaves);
  vec2 warp = vec2(
    fbm(p + vec2(t,         0.0), oct, 2.0, 0.5),
    fbm(p + vec2(0.0,  t * 0.8) + vec2(5.2, 1.3), oct, 2.0, 0.5)
  ) * u_swirl;

  float n = fbm(p + warp + vec2(0.0, -t * 0.5), oct, 2.0, 0.5);

  // Map noise [-1,1] → [0,1] and bias for cloudy bite.
  float k = 0.5 + 0.5 * n;
  k = clamp(pow(k, u_contrast2), 0.0, 1.0);

  vec3 col = paletteAt(k);

  writeColor(col);
}
`},r={id:"aurora",name:"Aurora",uniforms:[{name:"u_bandWidth",label:"Band width",min:.4,max:4,step:.02,default:1.6,group:"shape"},{name:"u_curtains",label:"Curtains",min:.2,max:2,step:.02,default:1,group:"shape"},{name:"u_glow",label:"Glow",min:0,max:1,step:.01,default:.5,group:"shape"},{name:"u_speed",label:"Drift speed",min:0,max:1,step:.005,default:.18,group:"motion"},{name:"u_wave",label:"Wave amount",min:0,max:.5,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_bandWidth;
uniform float u_curtains;
uniform float u_glow;
uniform float u_speed;
uniform float u_wave;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Horizontal coordinate, scaled by aspect so bands are uniform width.
  float x = (uv.x - 0.5) * aspect;
  float y = uv.y;

  float t = u_time * u_speed;

  // Curtain wave — horizontal band position oscillates with height.
  float wave = snoise(vec2(y * 2.5 - t, t * 0.5)) * u_wave;
  float bandX = x + wave;

  // Multi-frequency horizontal sweep gives that "shifting curtain" look.
  float band =
      0.6 * snoise(vec2(bandX * u_bandWidth - t, 0.7))
    + 0.3 * snoise(vec2(bandX * u_bandWidth * 2.1 + t * 0.6, 1.7))
    + 0.1 * snoise(vec2(bandX * u_bandWidth * 4.0 + t * 1.5, 3.7));

  // Vertical curtain falloff — concentrated in the middle vertically.
  // Tweakable via u_curtains: lower = tall curtains, higher = compressed band.
  float verticalFall = 1.0 - pow(abs(y - 0.5) * 2.0, u_curtains);
  verticalFall = clamp(verticalFall, 0.0, 1.0);

  // 0..1 scalar through the palette — biased so darker palette entries
  // dominate near the edges and brighter ones glow in the band's core.
  float t01 = clamp(0.5 + band * 0.55, 0.0, 1.0);
  vec3 base = paletteAt(t01);

  // Multiply by curtain falloff so the band fades into darkness at top/bottom.
  vec3 col = base * mix(0.15, 1.0, verticalFall);

  // Soft additive glow at the band centerline.
  float glowT = clamp(0.5 + band * 0.4, 0.0, 1.0);
  vec3 glowCol = paletteAt(glowT);
  float glowBand = exp(-pow((y - 0.5) * 3.5, 2.0)) * (0.5 + 0.5 * band);
  col += glowCol * glowBand * u_glow;

  writeColor(col);
}
`},s={id:"plasma",name:"Plasma",uniforms:[{name:"u_zoom",label:"Zoom",min:.3,max:4,step:.05,default:1.4,group:"shape"},{name:"u_complexity",label:"Complexity",min:1,max:6,step:.05,default:3,group:"shape"},{name:"u_smooth",label:"Smoothness",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.4,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_complexity;
uniform float u_smooth;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  // Classic plasma — sum of multiple sinusoidal fields at different
  // frequencies / orientations. u_complexity controls high-frequency mix.
  float v = sin(p.x * 4.0 + t);
  v += sin(4.0 * (p.y + 0.5 * sin(t * 0.7)));
  v += sin(u_complexity * (p.x + p.y) + t * 1.3);
  // Concentric ripple from the origin
  float r = length(p + vec2(sin(t * 0.5), cos(t * 0.4)) * 0.4);
  v += sin(r * (4.0 + u_complexity) - t * 1.2);

  v *= 0.25; // average out the four contributions

  // Map -1..1 → 0..1, with optional smoothstep for a softer transition.
  float k = 0.5 + 0.5 * v;
  k = mix(k, smoothstep(0.0, 1.0, k), u_smooth);

  vec3 col = paletteAt(k);

  writeColor(col);
}
`},u={id:"rays",name:"Rays",uniforms:[{name:"u_density",label:"Ray density",min:4,max:80,step:1,default:24,group:"shape"},{name:"u_intensity",label:"Intensity",min:.2,max:2,step:.01,default:.9,group:"shape"},{name:"u_falloff",label:"Falloff",min:.4,max:4,step:.02,default:1.6,group:"shape"},{name:"u_focusJitter",label:"Focus drift",min:0,max:.5,step:.005,default:.18,group:"motion"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.4,group:"motion"},{name:"u_twist",label:"Twist",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_density;     // ray count
uniform float u_intensity;   // overall ray brightness
uniform float u_falloff;     // how fast rays fade outward
uniform float u_focusJitter; // amount the focal point drifts
uniform float u_speed;
uniform float u_twist;       // angular noise modulation

#define PI 3.14159265359

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // Drifting focal point.
  vec2 focus = vec2(
    sin(t * 0.4) * u_focusJitter * aspect,
    cos(t * 0.5) * u_focusJitter
  );
  vec2 d = p - focus;
  float r = length(d);
  float a = atan(d.y, d.x);

  // Twist the angle with noise so rays aren't perfectly straight.
  float twistN = snoise(vec2(r * 4.0, t * 0.6));
  float angle = a + twistN * u_twist;

  // Rays — sin wave at u_density frequency, +rotation over time.
  float ray = 0.5 + 0.5 * sin(angle * u_density + t);
  ray = pow(ray, 3.0); // sharpen the spokes

  // Radial falloff — bright at center, fading outward.
  float rad = exp(-r * u_falloff);

  // Background base color — palette index by radial distance.
  vec3 base = paletteAt(clamp(r * 0.9, 0.0, 1.0));
  // Bright ray color — from the brightest end of the palette.
  vec3 rayCol = paletteAt(0.0);

  vec3 col = base + rayCol * ray * rad * u_intensity;

  writeColor(col);
}
`},f={id:"caustics",name:"Caustics",uniforms:[{name:"u_zoom",label:"Zoom",min:.5,max:6,step:.05,default:2.5,group:"shape"},{name:"u_complexity",label:"Complexity",min:1,max:6,step:.05,default:3,group:"shape"},{name:"u_brightness2",label:"Light",min:.4,max:2.5,step:.02,default:1.4,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:1.5,step:.005,default:.35,group:"motion"},{name:"u_chaos",label:"Chaos",min:0,max:1,step:.01,default:.4,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_complexity;
uniform float u_brightness2;
uniform float u_speed;
uniform float u_chaos;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  // Domain warp the input lightly with simplex noise — gives the
  // "drifting refraction" rather than a static caustics grid.
  vec2 warp = vec2(
    snoise(p + vec2(t, 0.0)),
    snoise(p + vec2(0.0, t * 1.1) + 5.2)
  ) * u_chaos;
  p += warp;

  // Sum cross-bands of sine waves rotating at different angles.
  float c = 0.0;
  float a = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) > u_complexity) break;
    float fi = float(i) + 1.0;
    vec2 dir = vec2(cos(fi * 1.7), sin(fi * 1.3));
    float v = sin(dot(p, dir) * (3.0 + fi) + t * (1.0 + fi * 0.2));
    // Sharpen each band into bright lines: 1.0 - |v| then power.
    c += pow(1.0 - abs(v), 8.0);
    a += 1.0;
  }
  c /= a;
  c *= u_brightness2;

  // Background base from palette index (radial-ish), with caustics
  // additively brightening on top — picks the brightest palette entry.
  float r = clamp(length(p) * 0.18, 0.0, 1.0);
  vec3 base = paletteAt(0.5 + r * 0.5);
  vec3 light = paletteAt(0.0);
  vec3 col = base + light * c;

  writeColor(col);
}
`},m={id:"marble",name:"Marble",uniforms:[{name:"u_zoom",label:"Zoom",min:.5,max:4,step:.05,default:1.6,group:"shape"},{name:"u_turbulence",label:"Turbulence",min:.3,max:4,step:.02,default:1.8,group:"shape"},{name:"u_veining",label:"Veining",min:.5,max:4,step:.02,default:2.2,group:"shape"},{name:"u_sharpness",label:"Sharpness",min:1,max:30,step:.5,default:8,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:.5,step:.002,default:.05,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_turbulence;
uniform float u_veining;
uniform float u_sharpness;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  // Domain-warp using FBM, then run a sine through it.
  // Gives stretched, twisted veining unlike isotropic FBM clouds.
  vec2 warp = vec2(
    fbm(p + vec2(t * 0.6, 0.0), 5, 2.0, 0.5),
    fbm(p + vec2(0.0, t * 0.5) + 5.2, 5, 2.0, 0.5)
  ) * u_turbulence;

  float v = sin(p.y * u_veining + warp.x * 4.0 + t);

  // Bias: 1 - |v| then power to sharpen into thin bright veins.
  float vein = pow(1.0 - abs(v), u_sharpness);

  // Smooth body color across the palette.
  float bodyT = clamp(0.5 + warp.x * 0.3, 0.0, 1.0);
  vec3 body = paletteAt(bodyT);

  // Vein color from the brightest palette entry.
  vec3 vColor = paletteAt(0.0);

  vec3 col = mix(body, vColor, vein);

  writeColor(col);
}
`},p={id:"halftone",name:"Halftone",uniforms:[{name:"u_dotDensity",label:"Dot density",min:8,max:80,step:1,default:32,group:"shape"},{name:"u_dotScale",label:"Dot size",min:.4,max:1.6,step:.01,default:.95,group:"shape"},{name:"u_zoom",label:"Zoom",min:.4,max:3,step:.02,default:1.4,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.18,group:"motion"},{name:"u_warp",label:"Warp",min:0,max:.5,step:.005,default:.15,group:"motion"},{name:"u_invert",label:"Invert",min:0,max:1,step:1,default:0,group:"extra"}],fragment:`
uniform float u_dotDensity;
uniform float u_dotScale;
uniform float u_zoom;
uniform float u_speed;
uniform float u_warp;
uniform float u_invert;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  // Domain-warped gradient field — same machinery as Mesh, simpler.
  vec2 warp = vec2(
    snoise(p + vec2(t, 0.0)),
    snoise(p + vec2(0.0, t * 0.7) + 4.0)
  ) * u_warp;
  vec2 warped = p + warp;

  // 0..1 scalar — drives both BG color AND dot size.
  float k = 0.5 + 0.5 * snoise(warped * 1.2);
  if (u_invert > 0.5) k = 1.0 - k;

  // Background — smooth gradient through palette.
  vec3 bg = paletteAt(k);

  // Dot lattice. Use uv coordinates (NOT p) so dots stay at fixed
  // screen-space positions — the gradient flows underneath them.
  vec2 cell = uv * vec2(aspect, 1.0) * u_dotDensity;
  vec2 cf = fract(cell) - 0.5;
  float d = length(cf);

  // Dot radius scales with darkness of the gradient at this point.
  float radius = (1.0 - k) * 0.55 * u_dotScale;
  // Antialiased dot edge.
  float aa = 1.0 / max(u_dotDensity, 1.0);
  float dot = 1.0 - smoothstep(radius - aa, radius + aa, d);

  // Dot color — darkest palette entry.
  vec3 dotCol = paletteAt(1.0);

  vec3 col = mix(bg, dotCol, dot);

  writeColor(col);
}
`},c={id:"waves",name:"Waves",uniforms:[{name:"u_zoom",label:"Zoom",min:.4,max:4,step:.05,default:1.6,group:"shape"},{name:"u_frequency",label:"Frequency",min:2,max:40,step:.5,default:14,group:"shape"},{name:"u_decay",label:"Decay",min:0,max:3,step:.02,default:1,group:"shape"},{name:"u_count",label:"Sources",min:1,max:4,step:1,default:3,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.7,group:"motion"},{name:"u_drift",label:"Source drift",min:0,max:.5,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_frequency;
uniform float u_decay;
uniform float u_count;   // 1..4
uniform float u_speed;
uniform float u_drift;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;
  int count = int(u_count);

  // Sum ripples from N drifting source points.
  float wave = 0.0;
  float totalWeight = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= count) break;
    float fi = float(i);
    vec2 src = vec2(
      sin(t * 0.3 + fi * 1.3) * aspect * u_drift,
      cos(t * 0.4 + fi * 1.7) * u_drift
    );
    float r = distance(p, src);
    float w = exp(-r * u_decay);
    wave += sin(r * u_frequency - t * 2.0 - fi * 1.7) * w;
    totalWeight += w;
  }
  wave /= max(totalWeight, 0.001);

  float k = 0.5 + 0.5 * wave;
  vec3 col = paletteAt(k);

  writeColor(col);
}
`},d={id:"bands",name:"Bands",uniforms:[{name:"u_angle",label:"Angle",min:0,max:360,step:1,default:30,group:"shape"},{name:"u_softness",label:"Softness",min:0,max:1,step:.01,default:.85,group:"shape"},{name:"u_repeats",label:"Repeats",min:.5,max:4,step:.05,default:1,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.005,default:.18,group:"motion"},{name:"u_wobble",label:"Wobble",min:0,max:.4,step:.005,default:.08,group:"motion"}],fragment:`
uniform float u_angle;     // degrees
uniform float u_softness;  // smoothness of band boundaries
uniform float u_repeats;   // number of palette traversals across the canvas
uniform float u_speed;
uniform float u_wobble;

#define PI 3.14159265359

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // Project p onto the angle direction → 1D coordinate.
  float a = u_angle * PI / 180.0;
  vec2 dir = vec2(cos(a), sin(a));
  float k = dot(p, dir);

  // Add a slow noise wobble so it isn't a perfectly straight gradient.
  k += snoise(p * 1.2 + t * 0.4) * u_wobble;

  // Wrap into [0..1], scaled by repeats and shifted over time.
  k = k * u_repeats + t * 0.3;
  k = fract(k * 0.5 + 0.5);
  // smoothstep for a softer palette blend.
  float s = mix(k, smoothstep(0.0, 1.0, k), u_softness);

  vec3 col = paletteAt(s);

  writeColor(col);
}
`},h={id:"glass",name:"Glass",uniforms:[{name:"u_ribFreq",label:"Ribs",min:8,max:80,step:1,default:30,group:"shape"},{name:"u_refract",label:"Refraction",min:0,max:.3,step:.005,default:.07,group:"shape"},{name:"u_highlight",label:"Highlight",min:0,max:1,step:.01,default:.4,group:"shape"},{name:"u_angle",label:"Angle",min:0,max:360,step:1,default:90,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:.5,step:.005,default:.06,group:"motion"}],fragment:`
uniform float u_ribFreq;
uniform float u_refract;
uniform float u_highlight;
uniform float u_angle;
uniform float u_speed;

#define PI 3.14159265359

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;
  float a = u_angle * PI / 180.0;
  vec2 dir  = vec2(cos(a), sin(a));     // along ribs
  vec2 perp = vec2(-sin(a), cos(a));    // across ribs

  // Rib coordinate — perpendicular distance from the rib axis.
  float ribCoord = dot(p, perp);
  float ribN = sin(ribCoord * u_ribFreq * PI);

  // Refract: shift sample point along the rib direction by ribN.
  vec2 sampleP = p + dir * ribN * u_refract;

  // Underlying smooth gradient — radial-ish soft mesh of palette colors.
  vec3 base = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_blobCount) break;
    float fi = float(i);
    vec2 c = vec2(
      cos(fi * 1.7 + t * 0.3) * 0.4 * aspect,
      sin(fi * 1.3 + t * 0.4) * 0.4
    );
    float d = distance(sampleP, c);
    float w = 1.0 / (d * d * 4.0 + 0.05);
    base += u_colors[i] * w;
    total += w;
  }
  base /= max(total, 1e-4);

  // Specular highlight at rib peaks — sharp white sheen.
  float hl = pow(max(0.0, ribN), 6.0) * u_highlight;
  // Soft shadow at rib troughs.
  float sh = pow(max(0.0, -ribN), 2.0) * 0.35;

  vec3 col = base * (1.0 - sh) + vec3(hl);

  writeColor(col);
}
`},_={id:"concentric",name:"Concentric",uniforms:[{name:"u_ringFreq",label:"Ring density",min:20,max:240,step:1,default:80,group:"shape"},{name:"u_ringDepth",label:"Ring depth",min:0,max:.5,step:.005,default:.12,group:"shape"},{name:"u_centerX",label:"Center X",min:-.5,max:.5,step:.005,default:0,group:"shape"},{name:"u_centerY",label:"Center Y",min:-.5,max:.5,step:.005,default:0,group:"shape"},{name:"u_speed",label:"Pulse",min:0,max:1.5,step:.005,default:.18,group:"motion"},{name:"u_warp",label:"Warp",min:0,max:.3,step:.005,default:.06,group:"motion"}],fragment:`
uniform float u_ringFreq;
uniform float u_ringDepth;
uniform float u_centerX;
uniform float u_centerY;
uniform float u_speed;
uniform float u_warp;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // Ring origin (off-center capable).
  vec2 origin = vec2(u_centerX * aspect, u_centerY);
  vec2 d = p - origin;

  // Tiny domain warp so rings aren't perfectly geometric.
  vec2 q = d + vec2(
    snoise(d * 1.5 + vec2(t * 0.4, 0.0)),
    snoise(d * 1.5 + vec2(0.0, t * 0.5) + 4.0)
  ) * u_warp;
  float r = length(q);

  // Base palette gradient by radius.
  vec3 base = paletteAt(clamp(r * 1.2, 0.0, 1.0));

  // Concentric rings — sharp sine modulating the base lightness.
  float ring = sin(r * u_ringFreq - t * 2.5);
  float depth = 1.0 + ring * u_ringDepth;

  vec3 col = base * depth;

  writeColor(col);
}
`},g={id:"ribbon",name:"Ribbon",uniforms:[{name:"u_thickness",label:"Thickness",min:.02,max:.4,step:.005,default:.12,group:"shape"},{name:"u_amplitude",label:"Amplitude",min:0,max:.5,step:.005,default:.22,group:"shape"},{name:"u_frequency",label:"Frequency",min:.5,max:5,step:.05,default:1.4,group:"shape"},{name:"u_complexity",label:"Complexity",min:0,max:1,step:.01,default:.5,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.45,group:"motion"},{name:"u_glow",label:"Glow",min:0,max:1,step:.01,default:.55,group:"extra"}],fragment:`
uniform float u_thickness;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_complexity;
uniform float u_speed;
uniform float u_glow;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // Multi-frequency sine ribbon centerline.
  float curve =
      u_amplitude * sin(p.x * u_frequency + t)
    + u_amplitude * 0.5 * u_complexity * sin(p.x * u_frequency * 2.3 + t * 1.4 + 1.7)
    + u_amplitude * 0.25 * u_complexity * sin(p.x * u_frequency * 4.7 + t * 2.1 + 3.3);

  float d = abs(p.y - curve);

  // Soft Gaussian-ish glow falloff.
  float core = exp(-pow(d / u_thickness, 2.0));
  // Wider outer halo.
  float halo = exp(-pow(d / (u_thickness * 3.0), 2.0)) * 0.4;
  float intensity = (core + halo) * u_glow;

  // Color along ribbon length — palette swept by horizontal position+time.
  float colT = clamp(0.5 + 0.5 * sin(p.x * 0.7 + t * 0.5), 0.0, 1.0);
  vec3 ribbonCol = paletteAt(colT);

  // Background — darkest palette entry, very dim.
  vec3 bg = paletteAt(1.0) * 0.12;

  vec3 col = bg + ribbonCol * intensity;

  writeColor(col);
}
`},v={id:"prism",name:"Prism",uniforms:[{name:"u_position",label:"Position",min:-.5,max:.5,step:.005,default:0,group:"shape"},{name:"u_width",label:"Width",min:.05,max:.6,step:.005,default:.18,group:"shape"},{name:"u_intensity",label:"Intensity",min:.4,max:3,step:.02,default:1.5,group:"shape"},{name:"u_chroma",label:"Chromatic",min:0,max:.4,step:.005,default:.12,group:"shape"},{name:"u_streaks",label:"Streaks",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_fade",label:"Top fade",min:0,max:1,step:.01,default:.4,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.7,group:"motion"}],fragment:`
uniform float u_position;
uniform float u_width;
uniform float u_intensity;
uniform float u_chroma;
uniform float u_streaks;
uniform float u_fade;
uniform float u_speed;

float beamAt(vec2 p, float xOffset) {
  // Horizontal Gaussian falloff — bright at column center, dark at edges.
  float horiz = exp(-pow((p.x - u_position - xOffset) / u_width, 2.0));
  // Fine vertical streaks via narrow noise.
  float t = u_time * u_speed;
  float n = snoise(vec2((p.x + xOffset) * 80.0, p.y * 6.0 + t * 3.5));
  float streak = mix(0.55, 1.0, smoothstep(-1.0, 1.0, n) * u_streaks);
  // Top fade so the beam dissolves into the sky.
  float topFade = smoothstep(-0.5, -0.5 + u_fade, p.y);
  // Bottom fade-out for a soft ground shadow.
  float botFade = 1.0 - smoothstep(0.3, 0.5, p.y);
  return horiz * streak * topFade * botFade;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // Sample R, G, B channels at slightly offset positions for chromatic split.
  float r = beamAt(p, -u_chroma);
  float g = beamAt(p,  0.0);
  float b = beamAt(p,  u_chroma);

  // Tint each channel by a palette pull so user palette colors the rainbow.
  vec3 hot = paletteAt(0.0);  // brightest palette entry tints peak
  vec3 mid = paletteAt(0.5);
  vec3 cold = paletteAt(1.0);

  vec3 col =
      r * mix(vec3(1.0, 0.6, 0.5), hot, 0.4) +
      g * mix(vec3(0.6, 1.0, 0.7), mid, 0.4) +
      b * mix(vec3(0.5, 0.7, 1.0), cold, 0.4);
  col *= u_intensity;

  writeColor(col);
}
`},b={id:"vortex",name:"Vortex",uniforms:[{name:"u_radius",label:"Radius",min:.1,max:.5,step:.005,default:.32,group:"shape"},{name:"u_thickness",label:"Thickness",min:.01,max:.2,step:.002,default:.04,group:"shape"},{name:"u_perspective",label:"Tilt",min:.2,max:1,step:.01,default:.42,group:"shape"},{name:"u_arms",label:"Arms",min:1,max:24,step:1,default:8,group:"shape"},{name:"u_glow",label:"Glow",min:0,max:2,step:.02,default:1,group:"shape"},{name:"u_chroma",label:"Chromatic",min:0,max:.05,step:.001,default:.012,group:"shape"},{name:"u_speed",label:"Spin speed",min:0,max:3,step:.01,default:1,group:"motion"}],fragment:`
uniform float u_radius;
uniform float u_thickness;
uniform float u_perspective;  // y-axis squash factor
uniform float u_arms;         // number of bright streaks around the ring
uniform float u_glow;
uniform float u_chroma;
uniform float u_speed;

#define PI 3.14159265359

float ringField(vec2 p, float xOffset) {
  vec2 q = p + vec2(xOffset, 0.0);
  // Squash y for perspective — gives the ring a tilted-disc appearance.
  q.y /= u_perspective;
  float r = length(q);
  // Tube — distance from ring radius.
  float ringDist = abs(r - u_radius);
  float ring = exp(-pow(ringDist / u_thickness, 2.0));

  // Flowing arms around the ring.
  float angle = atan(q.y, q.x);
  float t = u_time * u_speed;
  float arm = 0.5 + 0.5 * sin(angle * u_arms + t * 4.0);
  arm = pow(arm, 3.0);

  // Halo — softer, wider than the ring core.
  float halo = exp(-pow(ringDist / (u_thickness * 4.0), 2.0)) * 0.5;

  return ring * (0.35 + 0.65 * arm) + halo * 0.4;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // Chromatic split: R/G/B sampled with horizontal offsets.
  float r = ringField(p, -u_chroma);
  float g = ringField(p,  0.0);
  float b = ringField(p,  u_chroma);

  vec3 hot  = paletteAt(0.0);
  vec3 mid  = paletteAt(0.4);
  vec3 cold = paletteAt(0.8);

  vec3 col =
      r * mix(vec3(1.0, 0.55, 0.45), hot,  0.45) +
      g * mix(vec3(0.55, 1.0, 0.7),  mid,  0.45) +
      b * mix(vec3(0.45, 0.7, 1.0),  cold, 0.5);
  col *= u_glow;

  writeColor(col);
}
`},x={id:"voronoi",name:"Voronoi",uniforms:[{name:"u_zoom",label:"Cell density",min:1.5,max:12,step:.05,default:5,group:"shape"},{name:"u_softness",label:"Border soft",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_jitter",label:"Jitter",min:0,max:1,step:.01,default:.85,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_softness;
uniform float u_jitter;
uniform float u_speed;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  vec2 cellId = floor(p);
  vec2 frac = fract(p);

  float minD = 8.0;
  float secondD = 8.0;
  vec2 closestCell = cellId;
  for (int yi = -1; yi <= 1; yi++) {
    for (int xi = -1; xi <= 1; xi++) {
      vec2 nb = vec2(float(xi), float(yi));
      vec2 hashed = hash22(cellId + nb);
      // Animate seed positions for a slow boil.
      vec2 seed = nb + 0.5 + u_jitter * (sin(t + hashed * 6.2831 * vec2(1.0, 1.7)) * 0.5);
      float d = length(seed - frac);
      if (d < minD) {
        secondD = minD;
        minD = d;
        closestCell = cellId + nb;
      } else if (d < secondD) {
        secondD = d;
      }
    }
  }

  // Cell color via hash of lattice coord — assigns a palette index per cell.
  float cellT = hash21(closestCell);
  vec3 cellCol = paletteAt(cellT);

  // Border darkening: where minD ≈ secondD, we're near a Voronoi edge.
  // u_softness controls how much border darkening is visible.
  float edge = smoothstep(0.0, 0.2, secondD - minD);
  float borderMix = mix(0.7, 1.0, edge);

  vec3 col = cellCol * mix(borderMix, 1.0, u_softness);

  writeColor(col);
}
`},w={id:"strands",name:"Strands",uniforms:[{name:"u_thickness",label:"Thickness",min:.005,max:.08,step:.001,default:.018,group:"shape"},{name:"u_amplitude",label:"Amplitude",min:0,max:.5,step:.005,default:.18,group:"shape"},{name:"u_frequency",label:"Frequency",min:.4,max:5,step:.05,default:1.6,group:"shape"},{name:"u_glow",label:"Glow",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:2,step:.01,default:.4,group:"motion"}],fragment:`
uniform float u_thickness;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_glow;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;

  // Background — almost-black, tinted by the darkest palette entry.
  vec3 bg = paletteAt(1.0) * 0.08;
  vec3 col = bg;

  // Each active color = one strand. Distribute strand baseline Y values
  // evenly across the vertical extent.
  float n = float(max(u_blobCount, 1));
  for (int i = 0; i < 8; i++) {
    if (i >= u_blobCount) break;
    float fi = float(i);
    float baseY = (fi / max(n - 1.0, 1.0) - 0.5) * 0.85;
    // Per-strand wave with unique phase so they don't move in lockstep.
    float curveY = baseY
      + u_amplitude * sin(p.x * u_frequency + t * (1.0 + fi * 0.07) + fi * 1.7)
      + u_amplitude * 0.4 * sin(p.x * u_frequency * 2.3 + t * 0.7 + fi * 2.3);
    float d = abs(p.y - curveY);
    // Thin core + wider halo for that silk-glow look.
    float core = exp(-pow(d / u_thickness, 2.0));
    float halo = exp(-pow(d / (u_thickness * 4.0), 2.0)) * 0.35;
    float intensity = (core + halo) * u_glow;
    col += u_colors[i] * intensity;
  }

  writeColor(col);
}
`},y={id:"tunnel",name:"Tunnel",uniforms:[{name:"u_density",label:"Ring density",min:2,max:16,step:.1,default:6,group:"shape"},{name:"u_spokes",label:"Spokes",min:0,max:64,step:1,default:16,group:"shape"},{name:"u_centerGlow",label:"Center glow",min:0,max:2,step:.02,default:.85,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:3,step:.01,default:1,group:"motion"},{name:"u_swirl",label:"Swirl",min:0,max:2,step:.01,default:.4,group:"motion"}],fragment:`
uniform float u_density;
uniform float u_spokes;
uniform float u_centerGlow;
uniform float u_speed;
uniform float u_swirl;

#define PI 3.14159265359

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float t = u_time * u_speed;
  float r = max(length(p), 0.001);
  float a = atan(p.y, p.x);

  // Logarithmic radius so rings get tighter toward center — gives the
  // illusion of infinite depth (each step inward is a smaller fraction
  // of total radius).
  float lr = log(r);

  // Rings scroll outward (- t) so the user perceives forward motion.
  float rings = 0.5 + 0.5 * sin(lr * u_density - t * 2.5);
  rings = pow(rings, 2.5);

  // Angular swirl — angle warped by radius creates a slight twist.
  float angleWarped = a + u_swirl * sin(lr + t * 0.5);
  // Spokes — alternating bright/dim arcs around the tube. u_spokes < 1
  // disables the effect (everything multiplied by 1).
  float spokeBand = u_spokes > 0.5 ? 0.5 + 0.5 * sin(angleWarped * u_spokes + t) : 1.0;

  // Body color along radius — palette indexed by tunnel depth.
  vec3 body = paletteAt(clamp(r * 1.1, 0.0, 1.0));

  // Center glow — bright vignette pulling the eye into the tunnel mouth.
  float core = exp(-r * 4.0) * u_centerGlow;
  vec3 centerCol = paletteAt(0.0);

  vec3 col = body * (0.25 + 0.85 * rings) * mix(0.55, 1.0, spokeBand) + centerCol * core;

  writeColor(col);
}
`},S={id:"iridescent",name:"Iridescent",uniforms:[{name:"u_zoom",label:"Scale",min:.4,max:4,step:.05,default:1.2,group:"shape"},{name:"u_swirl",label:"Swirl",min:0,max:.4,step:.005,default:.14,group:"shape"},{name:"u_filmDensity",label:"Film density",min:1,max:12,step:.05,default:4.5,group:"shape"},{name:"u_shimmer",label:"Shimmer",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_swirl;
uniform float u_filmDensity;
uniform float u_shimmer;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_zoom;

  float t = u_time * u_speed;

  // Slow domain warp — gives the liquid film surface its drifting curvature.
  vec2 q = vec2(
    snoise(p + vec2(t, 0.0)),
    snoise(p + vec2(0.0, t * 0.7) + 5.2)
  );
  vec2 warped = p + q * u_swirl;

  // Slow base palette traversal — sets the dominant hue at each position.
  float baseT = 0.5 + 0.5 * snoise(warped * 0.9);

  // Thin-film interference — a much higher-frequency sine modulated by
  // local FBM "thickness". Different surface "thickness" → different
  // interference offset → palette traversal rolls fast in shimmery bands.
  float thickness = fbm(warped * 1.4, 4, 2.0, 0.5);
  float interference = sin(thickness * u_filmDensity * 6.2831 + t * 1.5);
  float palT = fract(baseT + interference * u_shimmer * 0.32);

  vec3 col = paletteAt(palT);

  writeColor(col);
}
`},k={id:"lava",name:"Lava",uniforms:[{name:"u_zoom",label:"Zoom",min:.5,max:4,step:.05,default:1.6,group:"shape"},{name:"u_glow",label:"Glow",min:0,max:2,step:.02,default:1,group:"shape"},{name:"u_crust",label:"Crust",min:0,max:1,step:.01,default:.5,group:"shape"},{name:"u_speed",label:"Flow",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_glow;
uniform float u_crust;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * u_zoom;
  float t = u_time * u_speed;

  // Rising, slowly-churning heat field.
  vec2 q = p + vec2(fbm(p * 0.8 - vec2(0.0, t), 4, 2.0, 0.5) * 0.6, -t);
  float heat = fbm(q * 1.6, 6, 2.0, 0.55) * 0.5 + 0.5;

  // Crust: darker where heat is low; threshold controlled by u_crust.
  float core = smoothstep(0.35 + u_crust * 0.25, 0.85, heat);

  vec3 crustCol = paletteAt(0.92);   // darkest palette entry = cooled rock
  vec3 hotCol   = paletteAt(0.0);    // brightest = molten core
  vec3 midCol   = paletteAt(0.35);

  vec3 col = mix(crustCol, midCol, smoothstep(0.15, 0.6, heat));
  col = mix(col, hotCol, core);
  // Bright veins where the field peaks.
  col += hotCol * pow(core, 3.0) * u_glow;

  writeColor(col);
}
`},T={id:"kaleidoscope",name:"Kaleidoscope",uniforms:[{name:"u_segments",label:"Facets",min:3,max:16,step:1,default:8,group:"shape"},{name:"u_zoom",label:"Zoom",min:.5,max:4,step:.05,default:1.6,group:"shape"},{name:"u_detail",label:"Detail",min:1,max:5,step:.05,default:2.2,group:"shape"},{name:"u_speed",label:"Spin",min:0,max:1.5,step:.005,default:.3,group:"motion"}],fragment:`
uniform float u_segments;
uniform float u_zoom;
uniform float u_detail;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * u_zoom;
  float t = u_time * u_speed;

  float rad = length(p);
  float ang = atan(p.y, p.x) + t * 0.3;

  // Fold the angle into a single wedge, mirrored — the kaleidoscope core.
  float seg = 6.2831853 / u_segments;
  ang = mod(ang, seg);
  ang = abs(ang - seg * 0.5);

  vec2 q = vec2(cos(ang), sin(ang)) * rad;

  // Drifting layered noise inside the folded wedge.
  float n = fbm(q * u_detail + vec2(t * 0.4, -t * 0.3), 5, 2.0, 0.5);
  n = fbm(q * u_detail * 1.7 + n + t * 0.2, 4, 2.0, 0.5);

  vec3 col = paletteAt(fract(n * 1.4 + rad * 0.4 + t * 0.05));
  writeColor(col);
}
`},C={id:"embers",name:"Embers",uniforms:[{name:"u_count",label:"Particles",min:8,max:140,step:1,default:55,group:"shape"},{name:"u_sizeMin",label:"Min size",min:.002,max:.03,step:.001,default:.004,group:"shape"},{name:"u_sizeMax",label:"Max size",min:.004,max:.06,step:.001,default:.018,group:"shape"},{name:"u_trail",label:"Trail",min:0,max:.35,step:.005,default:.07,group:"shape"},{name:"u_spread",label:"Spread",min:.2,max:1.4,step:.02,default:.9,group:"shape"},{name:"u_glowShape",label:"Glow shape",min:0,max:2,step:1,default:0,group:"shape"},{name:"u_bed",label:"Glow reach",min:0,max:2,step:.01,default:.9,group:"shape"},{name:"u_angle",label:"Direction",min:-80,max:80,step:1,default:0,group:"motion"},{name:"u_rise",label:"Reach",min:.3,max:1.6,step:.02,default:1,group:"motion"},{name:"u_glow",label:"Glow",min:.2,max:3,step:.02,default:1.2,group:"motion"},{name:"u_bedFlicker",label:"Glow flicker",min:0,max:1,step:.01,default:.25,group:"motion"},{name:"u_speed",label:"Spark flicker",min:0,max:3,step:.02,default:1.2,group:"motion"}],fragment:`
uniform float u_count;
uniform float u_sizeMin;
uniform float u_sizeMax;
uniform float u_trail;
uniform float u_spread;
uniform float u_glowShape;
uniform float u_bed;
uniform float u_angle;
uniform float u_rise;
uniform float u_glow;
uniform float u_bedFlicker;
uniform float u_speed;

float hash11(float n) { return fract(sin(n * 78.233) * 43758.5453); }

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y);   // y: 0 bottom .. 1 top
  float t = u_time;

  // Direction of travel (0\xb0 = straight up). dir.y stays positive so sparks
  // always leave the bed; angle tilts the stream left/right.
  float a = radians(u_angle);
  vec2 dir = normalize(vec2(sin(a), cos(a)));
  vec2 perp = vec2(dir.y, -dir.x);

  // Bottom-anchored bed glow with a selectable shape (u_glowShape):
  //   0 = band  — full width, fades bottom→top (reach 2 fills to the top)
  //   1 = cone  — bright at the bottom-centre, narrowing to a peak going up
  //   2 = dome  — radial glow from the bottom-centre (a rising circle)
  // u_bed is the reach (how high/far it climbs); u_bedFlicker its pulse.
  vec3 col = paletteAt(0.95) * 0.22;
  float gx = p.x;              // centred x (-aspect/2 .. aspect/2)
  float gy = v_uv.y;          // 0 bottom .. 1 top
  float reach = max(u_bed, 0.001);
  float glowMask;
  if (u_glowShape < 0.5) {
    glowMask = smoothstep(reach, 0.0, gy);
  } else if (u_glowShape < 1.5) {
    float halfW = mix(0.7, 0.02, clamp(gy / reach, 0.0, 1.0));
    float horiz = smoothstep(halfW, halfW * 0.25, abs(gx));
    glowMask = smoothstep(reach, 0.0, gy) * horiz;
  } else {
    glowMask = smoothstep(reach, 0.0, length(vec2(gx, gy)));
  }
  float bedFlick = 1.0 - u_bedFlicker * 0.5 *
    (0.5 + 0.5 * sin(t * 1.6 + fbm(vec2(v_uv.x * 4.0, t * 0.5), 2, 2.0, 0.5) * 3.0));
  col += paletteAt(0.15) * glowMask * bedFlick * u_glow;

  for (int i = 0; i < 140; i++) {
    if (float(i) >= u_count) break;
    float fi = float(i) + 1.0;
    float s1 = hash11(fi);
    float s2 = hash11(fi + 11.0);
    float s3 = hash11(fi + 23.0);

    // Life cycles 0->1; each particle has its own launch phase and speed.
    float life = fract(t * u_rise * (0.18 + 0.30 * s1) + s1);
    float travel = life * 1.35;                       // how far up the reach goes
    float startX = (s2 - 0.5) * u_spread * aspect;
    // Position = launch point + travel along dir + a little wander.
    vec2 pos = vec2(startX, 0.0) + dir * travel;
    pos += perp * 0.05 * sin(t * (1.0 + s3) + fi);

    // Elongate the spark into a trail behind its direction of travel.
    vec2 d = p - pos;
    float along = dot(d, dir);       // >0 ahead, <0 behind (the trail)
    float side  = dot(d, perp);
    float size  = mix(u_sizeMin, u_sizeMax, s3);
    float back  = max(u_trail * (0.4 + 0.6 * s1), size);
    float len   = along < 0.0 ? back : size;
    float dist  = length(vec2(side / size, along / len));

    float spark = smoothstep(1.0, 0.0, dist);
    float flick = 0.55 + 0.45 * sin(t * u_speed * 6.0 + fi * 3.1);
    // Fade in just off the bed, fade out as it reaches the top.
    float fade  = smoothstep(0.0, 0.06, life) * smoothstep(1.0, 0.45, life);
    // Cooler colour as the ember ages/rises.
    vec3 spCol  = paletteAt(mix(0.05, 0.42, s1 * 0.5 + life * 0.5));
    col += spCol * spark * flick * fade * u_glow * 1.7;
  }

  writeColor(col);
}
`},A={id:"holographic",name:"Holographic",uniforms:[{name:"u_sheen",label:"Sheen",min:1,max:12,step:.1,default:5,group:"shape"},{name:"u_crinkle",label:"Crinkle",min:0,max:3,step:.02,default:1,group:"shape"},{name:"u_angle",label:"Angle",min:0,max:180,step:1,default:35,group:"shape"},{name:"u_speed",label:"Shift",min:0,max:2,step:.01,default:.5,group:"motion"}],fragment:`
uniform float u_sheen;
uniform float u_crinkle;
uniform float u_angle;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Diagonal axis the sheen sweeps along.
  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float axis = dot(p, dir);

  // Foil crinkle: warped fbm perturbs the axis so the bands ripple.
  float crink = fbm(p * 3.5 + t * 0.3, 4, 2.0, 0.5) * u_crinkle * 0.35;
  float band = axis * u_sheen + crink + t;

  // Rainbow sheen cycled through the palette, with a bright specular streak.
  float hue = fract(band);
  vec3 col = paletteAt(hue);
  float spec = pow(0.5 + 0.5 * sin(band * 6.2831853), 6.0);
  col += vec3(spec) * 0.5;

  // Subtle darkening toward the edges for a metallic falloff.
  col *= 1.0 - 0.25 * length(p);

  writeColor(col);
}
`},L={id:"nebula",name:"Nebula",uniforms:[{name:"u_zoom",label:"Scale",min:.5,max:4,step:.05,default:1.6,group:"shape"},{name:"u_warp",label:"Billow",min:0,max:3,step:.02,default:1.4,group:"shape"},{name:"u_gasContrast",label:"Contrast",min:.5,max:3,step:.05,default:1.6,group:"shape"},{name:"u_stars",label:"Stars",min:0,max:2,step:.02,default:1,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:1,step:.005,default:.12,group:"motion"}],fragment:`
uniform float u_zoom;
uniform float u_warp;
uniform float u_gasContrast;
uniform float u_stars;
uniform float u_speed;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// Ridged fbm — folds the noise so bright filaments form along zero-crossings.
float ridged(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 6; i++) {
    float n = 1.0 - abs(snoise(p));
    v += amp * n * n;
    p *= 2.0; amp *= 0.5;
  }
  return v;
}

// Layer of stars on a grid; density/threshold set rarity, returns brightness.
float starLayer(vec2 p, float cells, float thresh, float twinkle, float t) {
  vec2 g = floor(p * cells);
  float h = hash21(g);
  if (h < thresh) return 0.0;
  vec2 c = fract(p * cells) - 0.5;
  float d = length(c);
  float core = smoothstep(0.16, 0.0, d);
  float tw = 0.6 + 0.4 * sin(t * 3.0 + h * 40.0) * twinkle;
  return core * tw * (0.4 + 0.6 * hash21(g + 3.1));
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * u_zoom;
  float t = u_time * u_speed;

  // Domain-warp so the gas billows, then carve filaments with ridged noise.
  vec2 q = vec2(fbm(p + t * 0.2, 4, 2.0, 0.5), fbm(p + vec2(5.2, 1.3) - t * 0.15, 4, 2.0, 0.5));
  float gas = ridged(p * 1.1 + u_warp * q);
  gas = pow(clamp(gas - 0.2, 0.0, 1.0), u_gasContrast);

  // Dark void base → gas colour by density, hot cores on the brightest ridges.
  vec3 col = paletteAt(0.97) * 0.08;
  col = mix(col, paletteAt(fract(0.15 + gas * 0.7)), smoothstep(0.02, 0.6, gas));
  col += paletteAt(0.08) * pow(gas, 3.0) * 0.7;

  // Two parallax star layers, drifting at different speeds.
  vec2 sp = p + vec2(t * 0.3, 0.0);
  col += vec3(1.0) * starLayer(sp, 26.0, 0.90, 1.0, u_time) * 0.7 * u_stars;         // fine dust
  vec3 brightStar = vec3(1.0);
  float bs = starLayer(p * 0.6 + vec2(t * 0.5, 0.0), 9.0, 0.972, 1.0, u_time);
  // Cross-flare on the bright foreground stars.
  vec2 fp = fract((p * 0.6 + vec2(t * 0.5, 0.0)) * 9.0) - 0.5;
  float flare = (smoothstep(0.5, 0.0, abs(fp.x)) + smoothstep(0.5, 0.0, abs(fp.y))) * bs;
  col += brightStar * (bs + flare * 0.4) * u_stars;

  writeColor(col);
}
`},R={id:"raindrops",name:"Raindrops",uniforms:[{name:"u_count",label:"Drops",min:2,max:16,step:1,default:7,group:"shape"},{name:"u_freq",label:"Ripple",min:8,max:60,step:.5,default:26,group:"shape"},{name:"u_depth",label:"Depth",min:.05,max:1,step:.01,default:.4,group:"shape"},{name:"u_speed",label:"Rate",min:.1,max:3,step:.02,default:1,group:"motion"}],fragment:`
uniform float u_count;
uniform float u_freq;
uniform float u_depth;
uniform float u_speed;

float hash11(float n) { return fract(sin(n * 78.233) * 43758.5453); }
vec2  hash21(float n) { return vec2(hash11(n), hash11(n + 7.1)); }

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Accumulate a height field from every active droplet's expanding ring.
  float h = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= u_count) break;
    float fi = float(i) + 1.0;
    // Each drop re-lands at a fresh spot every cycle.
    float cycle = floor(t * (0.3 + 0.2 * hash11(fi)) + fi);
    vec2 c = (hash21(fi + cycle * 3.7) - 0.5) * vec2(aspect, 1.0) * 1.6;
    float age = fract(t * (0.3 + 0.2 * hash11(fi)) + fi);

    float d = length(p - c);
    float front = age * 1.2;                       // ring radius grows with age
    // Ring: a decaying sine wave trailing behind the wavefront.
    float wave = sin((front - d) * u_freq) * exp(-6.0 * abs(front - d));
    float fade = (1.0 - age) * smoothstep(0.0, 0.05, age);
    h += wave * fade;
  }

  h *= u_depth;

  // Shade the water surface by wave height; crests catch the light.
  float shade = 0.5 + h;
  vec3 col = paletteAt(clamp(shade, 0.0, 1.0));
  col += vec3(1.0) * pow(clamp(h * 2.0, 0.0, 1.0), 2.0) * 0.3;  // glints on crests

  writeColor(col);
}
`},M={id:"aura",name:"Aura",uniforms:[{name:"u_freq",label:"Waves",min:.5,max:8,step:.05,default:2.6,group:"shape"},{name:"u_strength",label:"Flow",min:0,max:2.5,step:.02,default:1.1,group:"shape"},{name:"u_sheen",label:"Sheen",min:0,max:1.5,step:.02,default:.5,group:"shape"},{name:"u_angle",label:"Angle",min:0,max:180,step:1,default:45,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_freq;
uniform float u_strength;
uniform float u_sheen;
uniform float u_angle;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Gradient axis (rotatable).
  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float axis = dot(p, dir);

  // Gentle multi-wave warp — the soft "water plane" undulation.
  float wave =
      0.55 * sin(axis * u_freq + t) +
      0.30 * sin(dot(p, vec2(-dir.y, dir.x)) * u_freq * 0.8 - t * 0.8) +
      0.20 * fbm(p * 1.6 + t * 0.2, 3, 2.0, 0.5);
  wave *= u_strength * 0.35;

  // Smooth, single (non-repeating) colour sweep — soft and luminous.
  float g = clamp(0.5 + axis * 0.9 + wave, 0.0, 1.0);
  vec3 col = paletteAt(g);

  // Broad satin sheen riding the crests (soft, not a hard line).
  float crest = 0.5 + 0.5 * sin((axis + wave) * 6.2831853 * 1.5 + t * 0.5);
  col += vec3(smoothstep(0.55, 1.0, crest)) * 0.14 * u_sheen;
  // Airy lift so it never crushes to black.
  col = mix(col, paletteAt(0.15), 0.06);

  writeColor(col);
}
`},z={id:"bloom",name:"Bloom",uniforms:[{name:"u_spread",label:"Spread",min:.4,max:2,step:.02,default:1,group:"shape"},{name:"u_offX",label:"Center X",min:-.6,max:.6,step:.02,default:0,group:"shape"},{name:"u_offY",label:"Center Y",min:-.6,max:.6,step:.02,default:0,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:1,step:.01,default:.25,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:1,step:.005,default:.16,group:"motion"}],fragment:`
uniform float u_spread;
uniform float u_offX;
uniform float u_offY;
uniform float u_warp;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  vec2 c = vec2(u_offX, u_offY) + 0.06 * vec2(sin(t * 0.8), cos(t * 0.6));
  float d = length(p - c);

  // Soft warp so the bloom isn't a perfect circle.
  float warp = fbm(p * 1.3 + t * 0.2, 3, 2.0, 0.5) * u_warp * 0.4;

  // Single smooth radial sweep: centre = paletteAt(0), edge = paletteAt(1).
  float g = clamp(d / u_spread + warp, 0.0, 1.0);
  vec3 col = paletteAt(g);

  // Gentle luminous lift near the core.
  col += paletteAt(0.15) * smoothstep(u_spread, 0.0, d) * 0.12;

  writeColor(col);
}
`},F={id:"drape",name:"Drape",uniforms:[{name:"u_folds",label:"Folds",min:1,max:12,step:.1,default:4,group:"shape"},{name:"u_depth",label:"Depth",min:0,max:1,step:.01,default:.4,group:"shape"},{name:"u_shade",label:"Shading",min:0,max:1,step:.01,default:.4,group:"shape"},{name:"u_speed",label:"Sway",min:0,max:1,step:.005,default:.18,group:"motion"}],fragment:`
uniform float u_folds;
uniform float u_depth;
uniform float u_shade;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Soft warp so folds sway like cloth.
  float warp = fbm(p * 1.2 + t * 0.2, 3, 2.0, 0.5) * 0.4;
  // Horizontal fold displacement.
  float fold = sin(p.x * u_folds + warp * 2.0 + t);

  // Smooth vertical colour sweep, pushed by the folds.
  float g = clamp(0.5 + p.y * 0.85 + fold * u_depth * 0.35, 0.0, 1.0);
  vec3 col = paletteAt(g);

  // Soft shading in the fold valleys → the fabric feel.
  float shade = 0.5 + 0.5 * sin(p.x * u_folds * 2.0 + warp * 2.0 + t);
  col *= 1.0 - u_shade * 0.25 * (1.0 - shade);
  // Satin highlight on the crests.
  col += vec3(pow(shade, 6.0)) * 0.08 * u_shade;

  writeColor(col);
}
`},E={id:"conic",name:"Conic",uniforms:[{name:"u_arms",label:"Arms",min:1,max:6,step:1,default:1,group:"shape"},{name:"u_warp",label:"Curve",min:0,max:1.5,step:.02,default:.4,group:"shape"},{name:"u_zoom",label:"Scale",min:.3,max:2,step:.02,default:1,group:"shape"},{name:"u_speed",label:"Spin",min:0,max:1.5,step:.005,default:.2,group:"motion"}],fragment:`
uniform float u_arms;
uniform float u_warp;
uniform float u_zoom;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) * u_zoom;
  float t = u_time * u_speed;

  float r = length(p);
  // Soft warp curves the arms.
  float warp = fbm(p * 1.3 + t * 0.3, 3, 2.0, 0.5) * u_warp;
  float ang = atan(p.y, p.x) + t + warp + r * u_warp;

  // Seamless mirror sweep — cos is periodic, so no hard 0/2π seam.
  float g = 0.5 + 0.5 * cos(ang * u_arms);
  vec3 col = paletteAt(clamp(g, 0.0, 1.0));

  writeColor(col);
}
`},D={id:"duo",name:"Duo",uniforms:[{name:"u_gap",label:"Spread",min:.2,max:1.2,step:.02,default:.55,group:"shape"},{name:"u_blend",label:"Blend",min:.2,max:3,step:.02,default:1.4,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:1,step:.01,default:.3,group:"shape"},{name:"u_speed",label:"Drift",min:0,max:1,step:.005,default:.2,group:"motion"}],fragment:`
uniform float u_gap;
uniform float u_blend;
uniform float u_warp;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Two drifting pool centres.
  vec2 c1 = vec2(-u_gap, 0.0) + 0.12 * vec2(sin(t), cos(t * 0.8));
  vec2 c2 = vec2( u_gap, 0.0) + 0.12 * vec2(cos(t * 0.9), sin(t * 1.1));

  float warp = fbm(p * 1.4 + t * 0.3, 3, 2.0, 0.5) * u_warp * 0.4;
  float d1 = length(p - c1);
  float d2 = length(p - c2);

  // Smooth 0..1 field between the two centres → clean two-tone blend.
  float g = clamp(pow(d1 / (d1 + d2 + 1e-3), u_blend) + warp, 0.0, 1.0);
  vec3 col = paletteAt(g);
  // Soft luminous lift where the pools are strongest.
  col += paletteAt(0.15) * (smoothstep(0.7, 0.0, d1) + smoothstep(0.7, 0.0, d2)) * 0.06;

  writeColor(col);
}
`},B={id:"sheen",name:"Sheen",uniforms:[{name:"u_angle",label:"Angle",min:0,max:180,step:1,default:60,group:"shape"},{name:"u_soft",label:"Blend",min:.3,max:1.5,step:.02,default:.9,group:"shape"},{name:"u_sheen",label:"Sheen",min:0,max:1.5,step:.02,default:.7,group:"shape"},{name:"u_width",label:"Width",min:.5,max:4,step:.05,default:1.8,group:"shape"},{name:"u_speed",label:"Sweep",min:0,max:1.2,step:.005,default:.25,group:"motion"}],fragment:`
uniform float u_angle;
uniform float u_soft;
uniform float u_sheen;
uniform float u_width;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float axis = dot(p, dir);

  // Clean diagonal colour sweep.
  float g = clamp(0.5 + axis * u_soft, 0.0, 1.0);
  vec3 col = paletteAt(g);

  // Soft light band travelling across (gaussian, gently oscillating).
  float pos = sin(t) * 0.6;
  float band = exp(-pow((axis - pos) / (0.18 * u_width), 2.0));
  col += vec3(band) * 0.16 * u_sheen;

  writeColor(col);
}
`},O={id:"lightbeam",name:"Light Beam",v2:!0,uniforms:[{name:"u_angle",label:"Angle",min:-180,max:180,step:1,default:-32,group:"shape"},{name:"u_offset",label:"Offset",min:-.8,max:.8,step:.005,default:-.04,group:"shape"},{name:"u_soft",label:"Softness",min:.03,max:1.2,step:.01,default:.45,group:"shape"},{name:"u_curve",label:"Curve",min:-1.2,max:1.2,step:.01,default:.22,group:"shape"},{name:"u_band",label:"Band width",min:0,max:1,step:.005,default:0,group:"shape"},{name:"u_bands",label:"Streaks",min:0,max:16,step:.1,default:3.2,group:"shape"},{name:"u_depth",label:"Streak depth",min:0,max:1,step:.01,default:.38,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:.6,step:.005,default:.08,group:"shape"},{name:"u_fade",label:"Fade along",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_hot",label:"Hot spot",min:0,max:1.5,step:.01,default:.55,group:"extra"},{name:"u_hotX",label:"Hot spot X",min:-1,max:1,step:.005,default:.55,group:"extra"},{name:"u_hotY",label:"Hot spot Y",min:-.7,max:.7,step:.005,default:-.5,group:"extra"},{name:"u_hotSize",label:"Hot spot size",min:.05,max:1.2,step:.01,default:.42,group:"extra"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:7,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.08,group:"motion"}],fragment:`
uniform float u_angle;
uniform float u_offset;
uniform float u_soft;
uniform float u_curve;
uniform float u_band;
uniform float u_bands;
uniform float u_depth;
uniform float u_warp;
uniform float u_fade;
uniform float u_hot;
uniform float u_hotX;
uniform float u_hotY;
uniform float u_hotSize;
uniform float u_seed;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;
  vec2 sd = vec2(u_seed * 7.13, u_seed * 3.71);

  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a));   // along the beam
  vec2 nrm = vec2(-dir.y, dir.x);    // across the beam
  float u = dot(p, dir);
  float v = dot(p, nrm);

  // Bend the beam into a gentle arc, then let very low-frequency noise
  // breathe through the edge so it never reads as a ruler line.
  v += u_curve * u * u;
  float w = fbmr(p * 0.55 + sd + vec2(t * 0.25, -t * 0.15), 2);
  float vw = v + u_warp * w;

  // Logistic edge: the lit side (v < offset) eases into shadow with a long
  // tail, like light scattering past a soft occluder.
  float s = max(u_soft, 0.02);
  float lit = 1.0 / (1.0 + exp((vw - u_offset) / (0.3 * s)));
  // Band width > 0: a lit strip with a second soft edge (a streak of light
  // instead of a lit half of the frame).
  if (u_band > 0.0) {
    lit *= 1.0 / (1.0 + exp(-(vw - (u_offset - u_band)) / (0.3 * s)));
    // Normalise by the band's peak so narrow bands still reach full light.
    float pk = 1.0 / (1.0 + exp(-u_band / (0.6 * s)));
    lit = min(lit / (pk * pk), 1.0);
  }

  // Streaks: broad noise stretched far along the beam (long, straight light
  // shafts), a weak second octave for texture, drifting along the beam.
  // They follow the unwarped axis, so they stay parallel and calm.
  float vs = v + 0.35 * u_warp * w;
  float n1 = snoise(vec2(u * 0.32 - t * 0.5, vs * u_bands) + sd);
  float n2 = snoise(vec2(u * 0.5 - t * 0.7, vs * u_bands * 2.07) + sd.yx + 11.0);
  float streak = 0.5 + 0.5 * (0.8 * n1 + 0.2 * n2);
  float bands = 1.0 - u_depth * smoothstep(0.1, 0.95, streak);

  // Brighter toward one end of the beam.
  float along = mix(1.0, smoothstep(-0.9, 0.7, -u), u_fade);

  // Hot spot where the light pools.
  vec2 hp = p - vec2(u_hotX * aspect * 0.5, u_hotY);
  float hot = u_hot * exp(-dot(hp, hp) / (2.0 * u_hotSize * u_hotSize)) * (0.35 + 0.65 * lit);

  float I = 0.03 + 0.8 * lit * bands * along + hot;
  // Soft knee: above 0.8 the value eases toward the top of the ramp
  // instead of clipping (C1-continuous, never reaches a hard white band).
  I = I < 0.8 ? I : 0.8 + 0.2 * (1.0 - exp(-(I - 0.8) / 0.2));

  writeColorLinear(rampLin(I));
}
`},I={id:"edgeglow",name:"Edge Glow",v2:!0,uniforms:[{name:"u_edge",label:"Source",min:0,max:7,step:1,default:0,group:"shape",options:[{value:0,label:"Bottom"},{value:1,label:"Top"},{value:2,label:"Left"},{value:3,label:"Right"},{value:4,label:"Bottom L"},{value:5,label:"Bottom R"},{value:6,label:"Top L"},{value:7,label:"Top R"}]},{name:"u_height",label:"Height",min:.08,max:1.6,step:.01,default:.6,group:"shape"},{name:"u_falloff",label:"Falloff",min:.6,max:3,step:.01,default:1.15,group:"shape"},{name:"u_curve",label:"Bow",min:-1,max:1,step:.01,default:.25,group:"shape"},{name:"u_wave",label:"Waves",min:0,max:.6,step:.005,default:.14,group:"shape"},{name:"u_waveScale",label:"Wave size",min:.5,max:8,step:.05,default:2.4,group:"shape"},{name:"u_mist",label:"Mist",min:0,max:1,step:.01,default:.45,group:"shape"},{name:"u_gain",label:"Intensity",min:.4,max:1.8,step:.01,default:1,group:"shape"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:11,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.07,group:"motion"}],fragment:`
uniform float u_edge;
uniform float u_height;
uniform float u_falloff;
uniform float u_curve;
uniform float u_wave;
uniform float u_waveScale;
uniform float u_mist;
uniform float u_gain;
uniform float u_seed;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = v_uv;
  float t = u_time * u_speed;
  vec2 sd = vec2(u_seed * 5.31, u_seed * 2.17);
  int e = int(u_edge + 0.5);

  // d = distance from the source (0 at the edge / corner), s = position
  // along the source (0..1).
  float d, s;
  if (e == 0)      { d = uv.y;       s = uv.x; }
  else if (e == 1) { d = 1.0 - uv.y; s = uv.x; }
  else if (e == 2) { d = uv.x;       s = uv.y; }
  else if (e == 3) { d = 1.0 - uv.x; s = uv.y; }
  else {
    vec2 c = vec2(e == 5 || e == 7 ? 1.0 : 0.0, e >= 6 ? 1.0 : 0.0);
    vec2 q = (uv - c) * vec2(aspect, 1.0);
    d = length(q) / max(aspect, 1.0) * 1.15;
    s = atan(abs(q.y), abs(q.x)) / 1.5707963;
  }
  // Past the source edge (a framing window can reach there) the glow holds
  // its full strength; pow() of a negative distance would be undefined.
  d = max(d, 0.0);

  // Bow: the glow reaches further in the middle of the edge (or less).
  float mid = 1.0 - 4.0 * (s - 0.5) * (s - 0.5);
  float h = u_height * (1.0 + u_curve * (mid - 0.5));

  // Soft, lumpy boundary: the glow HEIGHT varies gently along the source.
  // Scaling (instead of displacing) keeps every iso-line proportional to its
  // distance from the source, so the bright base stays smooth and clean and
  // the lumps only show where the glow fades out.
  float wv = 0.7 * snoise(vec2(s * u_waveScale, 3.7) + sd + vec2(t, 0.0))
           + 0.3 * snoise(vec2(s * u_waveScale * 2.1, 9.1) + sd.yx - vec2(t * 0.7, 0.0));
  float hs = max(h * (1.0 + 1.2 * u_wave * wv), 0.02);

  float I = exp(-pow(d / hs, u_falloff) * 1.6);

  // Mist: faint, broad columns of light rising through the glow body
  // (stretched away from the source, low contrast, mid tones only).
  float sh = snoise(vec2(s * u_waveScale * 1.3, d * 0.6 - t * 0.3) + sd * 1.7 + 5.0);
  I *= 1.0 + u_mist * 0.22 * sh * smoothstep(0.05, 0.4, I) * (1.0 - 0.7 * I);

  I = clamp(I * u_gain, 0.0, 1.2);
  I = I < 0.85 ? I : 0.85 + 0.15 * (1.0 - exp(-(I - 0.85) / 0.15));
  writeColorLinear(rampLin(I));
}
`},P={id:"curtains",name:"Curtains",v2:!0,uniforms:[{name:"u_variant",label:"Style",min:0,max:1,step:1,default:0,group:"shape",options:[{value:0,label:"Rays"},{value:1,label:"Arcs"}]},{name:"u_from",label:"Light from",min:0,max:1,step:1,default:0,group:"shape",options:[{value:0,label:"Bottom"},{value:1,label:"Top"}]},{name:"u_count",label:"Rays",min:.5,max:12,step:.05,default:2.5,group:"shape"},{name:"u_rayContrast",label:"Contrast",min:.3,max:3,step:.01,default:.95,group:"shape"},{name:"u_length",label:"Length",min:.2,max:3,step:.01,default:.9,group:"shape"},{name:"u_strength",label:"Ray light",min:0,max:2,step:.01,default:.85,group:"shape"},{name:"u_glow",label:"Base glow",min:0,max:2,step:.01,default:.9,group:"shape"},{name:"u_sway",label:"Sway",min:0,max:1,step:.01,default:.25,group:"shape"},{name:"u_spacing",label:"Arc spacing",min:1,max:14,step:.05,default:4.5,group:"extra"},{name:"u_thickness",label:"Arc width",min:.05,max:1,step:.01,default:.4,group:"extra"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:4,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.08,group:"motion"}],fragment:`
uniform float u_variant;
uniform float u_from;
uniform float u_count;
uniform float u_rayContrast;
uniform float u_length;
uniform float u_strength;
uniform float u_glow;
uniform float u_sway;
uniform float u_spacing;
uniform float u_thickness;
uniform float u_seed;
uniform float u_speed;

// Smooth 1D ray field in 0..1 across x (two octaves only: more reads jagged).
float rayField(float x, float t, float seed) {
  float n = 0.84 * snoise(vec2(x * u_count + t * 0.6, seed))
          + 0.16 * snoise(vec2(x * u_count * 2.31 - t * 0.4, seed + 13.7));
  return clamp(0.5 + 0.55 * n, 0.0, 1.0);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = v_uv;
  float t = u_time * u_speed;
  float seed = u_seed * 3.17;
  float y = u_from > 0.5 ? 1.0 - uv.y : uv.y;   // 0 at the light source
  float xs = (uv.x - 0.5) * aspect;

  float E;
  if (u_variant < 0.5) {
    // Columns lean and curve a little as they rise.
    float x = xs + u_sway * 0.35 * y * snoise(vec2(xs * 0.6 + seed, y * 0.7 - t * 0.2));
    float r = rayField(x, t, seed);
    float rays = pow(smoothstep(0.02, 0.98, r), u_rayContrast);
    // Near the source the columns melt into their mean, so the base is one
    // continuous glow instead of a row of blocks or pointed tongues.
    rays = mix(rays, 0.5, exp(-y * 3.2) * 0.8);
    float up = exp(-y * 2.2 / max(u_length, 0.05));
    float base = exp(-y * 3.6) * (0.8 + 0.2 * exp(-xs * xs * 1.2));
    E = 0.12 + 0.2 * (1.0 - y) + u_strength * rays * up + u_glow * base;
  } else {
    // Arcs: soft rings centred below the frame, streaked by the ray field
    // sampled around the centre (seamless: noise on a circle).
    vec2 c = vec2(0.0, -0.5 - 0.35);
    vec2 q = vec2(xs, y - 0.5) - c;
    float d = length(q);
    float ang = atan(q.x, q.y);
    float ph = d * u_spacing - t * 0.5;
    float ring = max(0.5 + 0.5 * cos(ph * 6.2831853), 0.0);
    ring = pow(ring, 1.0 / max(u_thickness, 0.05) * 0.6 + 0.4);
    // Every arc gets its own brightness, and arcs thin out toward the sides.
    ring *= 0.55 + 0.75 * vnoise(vec2(ph, 0.5), u_seed + 17.0);
    ring *= mix(1.0, smoothstep(1.35, 0.25, abs(ang)), 0.55);
    float streak = rayField(ang * 0.9, t, seed);
    float fade = exp(-(d - 0.35) * 2.2 / max(u_length, 0.05));
    float base = exp(-(d - 0.35) * 5.0);
    E = 0.08 + u_strength * ring * fade * mix(0.55, 1.15, streak) + u_glow * base;
  }

  // Filmic shoulder (E -> I in 0..1): the base goes white-hot smoothly.
  float I = 1.0 - exp(-max(E, 0.0) * 1.25);
  I /= 1.0 - exp(-2.6 * 1.25);
  // A little extra depth at the far end.
  I *= 1.0 - 0.18 * smoothstep(0.65, 1.0, y);
  writeColorLinear(rampLin(clamp(I, 0.0, 1.0)));
}
`},q={id:"meshflow",name:"Flow Mesh",v2:!0,hasBlobs:!0,pointHandles:!0,pointRadiusUniforms:["u_rad0","u_rad1","u_rad2","u_rad3","u_rad4","u_rad5","u_rad6","u_rad7"],uniforms:[{name:"u_flow",label:"Flow angle",min:-90,max:90,step:1,default:35,group:"shape"},{name:"u_stretch",label:"Stretch",min:1,max:4,step:.01,default:1.8,group:"shape"},{name:"u_soft",label:"Softness",min:.3,max:3,step:.01,default:1,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:.5,step:.005,default:.1,group:"shape"},{name:"u_warpScale",label:"Warp size",min:.3,max:4,step:.01,default:1.3,group:"shape"},{name:"u_silk",label:"Silk",min:0,max:1,step:.01,default:.3,group:"shape"},{name:"u_silkScale",label:"Fold scale",min:.3,max:4,step:.01,default:1.1,group:"shape"},{name:"u_light",label:"Light angle",min:-180,max:180,step:1,default:125,group:"shape"},{name:"u_shine",label:"Shine",min:0,max:1,step:.01,default:.15,group:"shape"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:5,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:.6,step:.005,default:.05,group:"motion"},{name:"u_rad0",label:"Point 1 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad1",label:"Point 2 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad2",label:"Point 3 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad3",label:"Point 4 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad4",label:"Point 5 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad5",label:"Point 6 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad6",label:"Point 7 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0},{name:"u_rad7",label:"Point 8 size",min:.04,max:1.2,step:.005,default:.35,hidden:!0}],fragment:`
uniform vec2  u_blobOffsets[8];
uniform float u_flow;
uniform float u_stretch;
uniform float u_soft;
uniform float u_warp;
uniform float u_warpScale;
uniform float u_silk;
uniform float u_silkScale;
uniform float u_light;
uniform float u_shine;
uniform float u_seed;
uniform float u_speed;
uniform float u_rad0, u_rad1, u_rad2, u_rad3, u_rad4, u_rad5, u_rad6, u_rad7;

float pointRadius(int i) {
  if (i == 0) return u_rad0;
  if (i == 1) return u_rad1;
  if (i == 2) return u_rad2;
  if (i == 3) return u_rad3;
  if (i == 4) return u_rad4;
  if (i == 5) return u_rad5;
  if (i == 6) return u_rad6;
  return u_rad7;
}

// Height field for the lit silk: FBM squeezed along the flow so the folds
// run with the colour.
float silkHeight(vec2 q, mat2 toFlow, vec2 sd, float t) {
  vec2 f = toFlow * q;
  f.x /= 3.6;
  return fbmr(f * u_silkScale + sd + vec2(t * 0.3, -t * 0.2), 2);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;
  vec2 sd = vec2(u_seed * 4.37, u_seed * 1.93);

  float a = radians(u_flow);
  mat2 toFlow = mat2(cos(a), -sin(a), sin(a), cos(a));   // rotates into flow space

  // Domain warp of the lookup: organic, never geometric.
  vec2 q = p + u_warp * vec2(
    fbmr(p * u_warpScale + sd + vec2(t, 0.0), 3),
    fbmr(p * u_warpScale + sd.yx + 7.3 - vec2(0.0, t), 3)
  );

  // Soft-max Gaussian RBF weights (exponents relative to the closest point).
  int n = max(min(u_blobCount, 8), 1);
  float e[8];
  float emin = 1e9;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    vec2 d = toFlow * (q - u_blobOffsets[i] * vec2(aspect, 1.0));
    d.x /= max(u_stretch, 1.0);
    float r = max(pointRadius(i) * u_soft, 0.02);
    e[i] = dot(d, d) / (2.0 * r * r);
    emin = min(emin, e[i]);
  }
  vec3 acc = vec3(0.0);
  float chroma = 0.0, wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float w = exp(-(e[i] - emin));
    if (u_palSpace == 0) acc += w * u_colors[i];
    else if (u_palSpace == 1) acc += w * u_colLin[i];
    else acc += w * u_colLab[i];
    chroma += w * length(u_colLab[i].yz);
    wsum += w;
  }
  acc /= wsum;
  vec3 col;
  if (u_palSpace == 0) col = srgbToLinear(acc);
  else if (u_palSpace == 1) col = acc;
  else if (u_palSpace == 2) col = oklabToLinear(acc);
  else {
    // OKLCH: chroma-weighted hue (the mean a/b direction) with the mean
    // chroma, so mixes stay vivid instead of drifting to grey.
    float c = chroma / wsum;
    float h = atan(acc.z, acc.y);
    col = oklabToLinear(vec3(acc.x, c * cos(h), c * sin(h)));
  }

  // Lit silk: height field -> normals -> Lambert + a soft specular sheen.
  if (u_silk > 0.0 || u_shine > 0.0) {
    float eps = 0.01;
    float h0 = silkHeight(q, toFlow, sd, t);
    float hx = silkHeight(q + vec2(eps, 0.0), toFlow, sd, t);
    float hy = silkHeight(q + vec2(0.0, eps), toFlow, sd, t);
    vec3 N = normalize(vec3(-(hx - h0) / eps * 0.12, -(hy - h0) / eps * 0.12, 1.0));
    float la = radians(u_light);
    vec3 L = normalize(vec3(cos(la), sin(la), 0.9));
    float lambert = max(dot(N, L), 0.0);
    float flat0 = L.z;                       // a flat surface stays unchanged
    col *= max(1.0 + u_silk * 2.2 * (lambert - flat0), 0.0);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(N, H), 0.0), 18.0) * (1.0 - smoothstep(0.0, 0.25, 1.0 - dot(N, H)));
    // Sheen proportional to the local light: lit areas glint, shadows stay
    // clean (a white highlight on near-black would read as grey haze).
    vec3 hue = col / max(max(col.r, max(col.g, col.b)), 1e-4);
    col += u_shine * spec * (col * 2.2 + 0.03 * hue);
  }

  writeColorLinear(col);
}
`},W={id:"eclipse",name:"Eclipse",v2:!0,uniforms:[{name:"u_radius",label:"Radius",min:.08,max:.6,step:.005,default:.3,group:"shape"},{name:"u_width",label:"Thickness",min:.01,max:.3,step:.001,default:.1,group:"shape"},{name:"u_disp",label:"Dispersion",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_tilt",label:"Tilt",min:.35,max:1,step:.01,default:.92,group:"shape"},{name:"u_depth",label:"Depth",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_asym",label:"Asymmetry",min:0,max:1,step:.01,default:.85,group:"shape"},{name:"u_litAngle",label:"Lit side",min:-180,max:180,step:1,default:90,group:"shape"},{name:"u_highlight",label:"Highlight",min:0,max:2,step:.01,default:.7,group:"shape"},{name:"u_inner",label:"Inner ring",min:0,max:1.5,step:.01,default:.6,group:"shape"},{name:"u_rays",label:"Rays",min:0,max:1,step:.01,default:.2,group:"shape"},{name:"u_rayScale",label:"Ray detail",min:1,max:24,step:.1,default:9,group:"shape"},{name:"u_halo",label:"Halo",min:0,max:1.5,step:.01,default:.35,group:"shape"},{name:"u_outer",label:"Outer ring",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_occ",label:"Occluder shift",min:-.6,max:.6,step:.005,default:.04,group:"shape"},{name:"u_occSize",label:"Occluder size",min:0,max:1.2,step:.01,default:0,group:"shape"},{name:"u_intensity",label:"Intensity",min:.2,max:3,step:.01,default:1,group:"shape"},{name:"u_cx",label:"Center X",min:-.8,max:.8,step:.005,default:0,group:"extra"},{name:"u_cy",label:"Center Y",min:-.5,max:.5,step:.005,default:.02,group:"extra"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:9,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:1,step:.005,default:.06,group:"motion"}],fragment:`
uniform float u_radius;
uniform float u_width;
uniform float u_disp;
uniform float u_tilt;
uniform float u_depth;
uniform float u_asym;
uniform float u_litAngle;
uniform float u_highlight;
uniform float u_inner;
uniform float u_rays;
uniform float u_rayScale;
uniform float u_halo;
uniform float u_outer;
uniform float u_occ;
uniform float u_occSize;
uniform float u_intensity;
uniform float u_cx;
uniform float u_cy;
uniform float u_seed;
uniform float u_speed;

// Body profile across the band: s = 0 inner edge, 1 outer edge. Light
// builds toward the outer shoulder (like light scattered inside glass) and
// fades softly into the core; the outer edge is crisper.
float bandProfile(float s) {
  return pow(smoothstep(-0.2, 0.86, s), 1.5) * (1.0 - smoothstep(0.84, 1.03, s));
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  // Portrait frames: measure in units of the short side so the ring still
  // fits (fit == 1 for landscape, so 16:9 compositions are unchanged).
  float fit = min(aspect, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) / fit;
  float t = u_time * u_speed;
  vec2 sd = vec2(u_seed * 2.91, u_seed * 6.07);

  vec2 q = p - vec2(u_cx, u_cy);
  vec2 qe = vec2(q.x, q.y / max(u_tilt, 0.2));   // ellipse: seen from above
  float r = length(qe);
  float th = atan(qe.y, qe.x);
  float la = radians(u_litAngle);

  // 1 on the lit (far) side, 0 on the near side.
  float tp = 0.5 + 0.5 * cos(th - la);
  float lit = mix(1.0, 0.04 + 0.96 * pow(tp, 2.1) + 0.2 * pow(1.0 - tp, 6.0), u_asym);
  // Torus depth: the far side shows more of the tube, the near side less.
  float W = max(u_width, 0.004) * mix(1.0, mix(0.55, 1.3, tp), u_depth);
  float R = u_radius * (1.0 + 0.06 * u_depth * (tp - 0.5));

  // Seamless angular rays: noise sampled on a circle (no seam at +-pi),
  // drifting slowly around the ring.
  vec2 circ = vec2(cos(th - t * 0.15), sin(th - t * 0.15));
  float nr = fbmr(circ * u_rayScale * 0.4 + sd, 3);
  float rays = 1.0 + u_rays * 0.6 * nr;

  // Dispersion: one shifted copy of the band per spectrum colour, each
  // weighted by a broad window around its place in the spectrum, so inner
  // colours live inside the band, outer colours outside, and the middle of
  // the band is the (usually neutral) middle of the palette.
  int n = max(u_blobCount, 1);
  int m = max(n - 1, 1);
  float sMid = (r - (R - W)) / (2.0 * W);
  vec3 body = vec3(0.0);
  float wsum = 0.0;
  for (int j = 1; j < 8; j++) {
    if (j >= n) break;
    float sj = m > 1 ? float(j - 1) / float(m - 1) : 0.5;
    float shift = u_disp * W * 0.9 * (sj - 0.5) * (sj < 0.5 ? 1.2 : 2.0);
    float s = (r - (R - W + shift)) / (2.0 * W);
    float win = exp(-pow(sMid - (0.12 + 0.8 * sj), 2.0) / (2.0 * 0.3 * 0.3));
    // Warm inner colours glow mostly on the near side (glass reflection).
    win *= mix(1.0, 0.12 + 0.88 * pow(1.0 - tp, 1.5), (1.0 - sj) * u_asym);
    body += u_colLin[j] * bandProfile(s) * win;
    wsum += win;
  }
  body *= 1.5 / max(wsum, 0.35);
  vec3 light = body * lit * rays;

  vec3 innerCol = u_colLin[min(1, n - 1)];
  vec3 outerCol = u_colLin[n - 1];

  // White highlight riding the lit outer rim.
  light += vec3(1.0) * gauss(sMid - 0.86, 0.045) * pow(tp, 5.0) * u_highlight * 1.4;
  // Thin reflection lines inside the near rim (glass-torus depth): a warm
  // line from the inner colour, a whiter one just outside it.
  float near = pow(1.0 - tp, 3.0);
  light += innerCol * gauss(sMid - 0.12, 0.034) * near * u_inner * 1.1;
  light += mix(innerCol, vec3(1.0), 0.6) * gauss(sMid - 0.23, 0.022) * near * u_inner * 0.7;

  // Soft halo just outside the ring, a faint outline ring beyond it.
  float out1 = max(r - (R + W), 0.0);
  light += outerCol * u_halo * 0.35 * exp(-out1 / (0.25 * W + 0.01)) * step(R + W * 0.6, r) * (0.7 + 0.3 * rays);
  light += mix(outerCol, vec3(1.0), 0.4) * gauss(r - (R + W * 1.12), 0.006 + 0.04 * W) * u_outer * 0.55 * (0.5 + 0.5 * lit);

  // Offset occluder (0 size = off): a dark disc pushed toward the near side
  // (positive shift) so the lit side shows as a crescent.
  if (u_occSize > 0.0) {
    vec2 occDir = vec2(cos(la), sin(la));
    float occR = R * u_occSize;
    float occ = smoothstep(occR * 0.92, occR * 1.04, length(qe + occDir * u_occ * R));
    light *= mix(0.02, 1.0, occ);
  }

  vec3 bg = u_colLin[0] * (1.0 - 0.35 * smoothstep(0.2, 1.2, length(p)));
  writeColorLinear(bg + light * u_intensity);
}
`},N={id:"burst",name:"Burst",v2:!0,uniforms:[{name:"u_petals",label:"Petals",min:2,max:14,step:1,default:7,group:"shape"},{name:"u_twist",label:"Twist",min:-4,max:4,step:.01,default:1.1,group:"shape"},{name:"u_petalSoft",label:"Petal softness",min:0,max:1,step:.01,default:.65,group:"shape"},{name:"u_blend",label:"Colour blend",min:0,max:1,step:.01,default:.7,group:"shape"},{name:"u_gap",label:"Gap light",min:0,max:1,step:.01,default:.12,group:"shape"},{name:"u_ambient",label:"Fill light",min:0,max:1.5,step:.01,default:.12,group:"shape"},{name:"u_sat",label:"Saturation",min:0,max:1.4,step:.01,default:.8,group:"shape"},{name:"u_core",label:"Core",min:0,max:2.5,step:.01,default:1,group:"shape"},{name:"u_coreSize",label:"Core size",min:.02,max:.6,step:.005,default:.1,group:"shape"},{name:"u_highlight",label:"Highlights",min:0,max:1.5,step:.01,default:.35,group:"shape"},{name:"u_calm",label:"Calm centre",min:0,max:1,step:.01,default:0,group:"shape"},{name:"u_reach",label:"Reach",min:.2,max:2,step:.01,default:.9,group:"shape"},{name:"u_vignette",label:"Vignette",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_cx",label:"Center X",min:-.8,max:.8,step:.005,default:-.02,group:"extra"},{name:"u_cy",label:"Center Y",min:-.5,max:.5,step:.005,default:.03,group:"extra"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:3,group:"extra"},{name:"u_speed",label:"Spin",min:-1,max:1,step:.005,default:.06,group:"motion"}],fragment:`
uniform float u_petals;
uniform float u_twist;
uniform float u_petalSoft;
uniform float u_blend;
uniform float u_gap;
uniform float u_ambient;
uniform float u_sat;
uniform float u_core;
uniform float u_coreSize;
uniform float u_highlight;
uniform float u_calm;
uniform float u_reach;
uniform float u_vignette;
uniform float u_cx;
uniform float u_cy;
uniform float u_seed;
uniform float u_speed;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  // Portrait frames: short-side units keep the bloom centred and whole
  // (fit == 1 for landscape).
  float fit = min(aspect, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) / fit;
  float t = u_time * u_speed;

  vec2 q = p - vec2(u_cx, u_cy);
  float r = length(q);
  float th = atan(q.y, q.x);

  // Calm centre (0 = off): inside a soft radius the twist relaxes and the
  // petals melt into one continuous glow, so the core reads quiet instead of
  // a tight pinwheel. calm = 0 at the centre, 1 outside the calm zone.
  float calm = 1.0;
  if (u_calm > 0.0) calm = smoothstep(0.0, u_calm * 0.34, r);

  // Twist concentrated near the core: petals curl out of the centre and
  // straighten as they reach outward.
  float a = th + u_twist * sqrt(r + 0.01) * 1.6 + t;
  if (u_calm > 0.0) a = th + u_twist * sqrt(r + 0.01) * 1.6 * mix(0.3, 1.0, calm) + t;
  float n = max(floor(u_petals + 0.5), 1.0);
  float k = a * n / 6.2831853;          // petal coordinate: centres at integers

  // Organic variation, sampled on a circle of the (twisted) angle so it is
  // seamless all the way round: petals differ a little in width and light.
  vec2 circ = vec2(cos(a), sin(a));
  float jit = snoise(circ * 1.25 + vec2(u_seed * 1.7, u_seed * 0.6));
  float kk = k + 0.1 * jit;

  // Soft lobes. Softness widens the lobes and fills the gaps.
  float lobe = max(0.5 + 0.5 * cos(kk * 6.2831853), 0.0);
  lobe = pow(lobe, mix(3.2, 0.8, u_petalSoft));
  if (u_calm > 0.0) lobe = mix(0.66, lobe, calm);
  float vary = 0.82 + 0.3 * snoise(circ * 2.1 + vec2(3.1 + u_seed, 7.3));
  float bright = mix(u_gap * 0.9, 1.0, lobe) * vary;

  // Colour: petal i takes palette colour (i mod colours). Across each gap the
  // colour crossfades to the next petal's; Blend sets how wide that fade is
  // (narrow = distinct petals, wide = a continuous colour wheel). Indices wrap
  // at the petal count, so any petal/colour combination closes seamlessly.
  float m = float(max(u_blobCount, 1));
  float i0 = mod(floor(kk), n);
  float i1 = mod(i0 + 1.0, n);
  float bw = mix(0.02, 0.5, u_blend);
  if (u_calm > 0.0) bw = mix(0.5, bw, calm);
  float S = smoothstep(0.5 - bw, 0.5 + bw, fract(kk));
  vec3 ca = rampLinCyclic(mod(i0, m) / m);
  vec3 cb = rampLinCyclic(mod(i1, m) / m);
  vec3 col = oklabToLinear(mix(linearToOklab(ca), linearToOklab(cb), S));

  // Saturation in OKLab (chroma scale), so lowering it keeps lightness.
  vec3 lab = linearToOklab(col);
  col = oklabToLinear(vec3(lab.x, lab.yz * u_sat));

  // Radial light: bright toward the core, falling off by Reach.
  float radial = exp(-r / max(u_reach * 0.45, 0.05));
  vec3 light = col * bright * (u_ambient + 1.15 * radial);
  // Brighter, whiter lobe centres (specular-like streaks).
  if (u_calm > 0.0) light += mix(col, vec3(1.0), 0.35) * pow(lobe, 10.0) * u_highlight * radial * calm;
  else light += mix(col, vec3(1.0), 0.35) * pow(lobe, 10.0) * u_highlight * radial;
  // White-hot core.
  light += vec3(1.0) * u_core * exp(-(r * r) / (2.0 * u_coreSize * u_coreSize));

  // Built-in vignette (on top of the global one): corners fall away.
  float vd = length((v_uv - 0.5) * 2.0);
  light *= 1.0 - u_vignette * smoothstep(0.35, 1.25, vd);

  writeColorLinear(light);
}
`},U={id:"spectralarc",name:"Spectral",v2:!0,hasBlobs:!0,pointHandles:!0,uniforms:[{name:"u_ax",label:"Arc center X",min:-2,max:2,step:.005,default:.95,group:"shape"},{name:"u_ay",label:"Arc center Y",min:-2,max:2,step:.005,default:-.62,group:"shape"},{name:"u_radius",label:"Arc radius",min:.2,max:3,step:.005,default:1.2,group:"shape"},{name:"u_width",label:"Arc width",min:.02,max:.6,step:.005,default:.22,group:"shape"},{name:"u_order",label:"Spectrum",min:0,max:1,step:1,default:0,group:"shape",options:[{value:0,label:"Red outside"},{value:1,label:"Red inside"}]},{name:"u_sat",label:"Saturation",min:0,max:1.5,step:.01,default:.9,group:"shape"},{name:"u_vivid",label:"Vividness",min:0,max:1,step:.01,default:0,group:"shape"},{name:"u_blend",label:"Blend",min:0,max:1,step:.01,default:.75,group:"shape"},{name:"u_fade",label:"Fade",min:0,max:1,step:.01,default:.65,group:"shape"},{name:"u_fadeAngle",label:"Bright side",min:-180,max:180,step:1,default:160,group:"shape"},{name:"u_baseSoft",label:"Base softness",min:.2,max:2,step:.01,default:1,group:"shape"},{name:"u_warp",label:"Warp",min:0,max:.4,step:.005,default:.06,group:"shape"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:2,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:.6,step:.005,default:.05,group:"motion"}],fragment:`
uniform vec2  u_blobOffsets[8];
uniform float u_ax;
uniform float u_ay;
uniform float u_radius;
uniform float u_width;
uniform float u_order;
uniform float u_sat;
uniform float u_vivid;
uniform float u_blend;
uniform float u_fade;
uniform float u_fadeAngle;
uniform float u_baseSoft;
uniform float u_warp;
uniform float u_seed;
uniform float u_speed;

// Perceptual spectrum: hue sweeps violet -> blue -> cyan -> green -> yellow
// -> orange -> red in OKLCH at a gentle, even lightness. s = 0..1.
vec3 spectrumLin(float s, float sat) {
  s = clamp(s, 0.0, 1.0);
  float h = radians(mix(305.0, 25.0, s));
  float L = 0.8 + 0.06 * sin(s * 3.14159);
  float C = 0.12 * sat * (0.75 + 0.25 * sin(s * 3.14159));
  return oklabToLinear(vec3(L, C * cos(h), C * sin(h)));
}

// OKLab -> linear sRGB without the clamp, so the vivid spectrum can test
// whether a colour is inside the sRGB gamut.
vec3 _okRaw(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return vec3( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
              -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
              -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

bool _outOfGamut(vec3 c) {
  return min(c.r, min(c.g, c.b)) < 0.0 || max(c.r, max(c.g, c.b)) > 1.0;
}

// Vivid spectrum: rainbow lightness (yellow brightest, violet deepest), a hue
// sweep that lingers on the warm yellows (a wide, clear yellow band), greens
// held back so they never go neon, and chroma as high as sRGB allows. The
// gamut mapping bisects chroma only (hue and lightness hold) and is
// continuous across the band, so the arc never terraces. s = 0..1.
vec3 vividSpectrumLin(float s, float sat) {
  s = clamp(s, 0.0, 1.0);
  float hd = mix(305.0, 25.0, s);
  float dy = hd - 92.0;
  hd -= 0.62 * dy * exp(-(dy * dy) / (2.0 * 44.0 * 44.0));
  float h = radians(hd);
  vec2 dir = vec2(cos(h), sin(h));
  float L = 0.75 + 0.13 * cos(radians(hd - 100.0));
  float dg = hd - 150.0;
  float C = 0.21 * sat * (1.0 - 0.4 * exp(-(dg * dg) / (2.0 * 28.0 * 28.0)));
  vec3 lin = _okRaw(vec3(L, C * dir));
  if (_outOfGamut(lin)) {
    float lo = 0.0, hi = C;
    for (int i = 0; i < 14; i++) {
      float mid = 0.5 * (lo + hi);
      if (_outOfGamut(_okRaw(vec3(L, mid * dir)))) hi = mid;
      else lo = mid;
    }
    lin = _okRaw(vec3(L, lo * dir));
  }
  return clamp(lin, 0.0, 1.0);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  // Portrait frames: short-side units keep the arc in view (fit == 1 for
  // landscape).
  float fit = min(aspect, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5) / fit;
  float t = u_time * u_speed;
  vec2 sd = vec2(u_seed * 3.3, u_seed * 1.1);

  // Pastel base: soft RBF mesh of the palette colours at the point handles,
  // blended in OKLab, gently warped.
  vec2 q = p + u_warp * vec2(fbmr(p * 1.1 + sd + vec2(t, 0.0), 3), fbmr(p * 1.1 + sd.yx - vec2(0.0, t), 3));
  int n = max(min(u_blobCount, 8), 1);
  float e[8];
  float emin = 1e9;
  float rr = 0.34 * u_baseSoft;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    vec2 d = q - u_blobOffsets[i] * vec2(aspect, 1.0) / fit;
    e[i] = dot(d, d) / (2.0 * rr * rr);
    emin = min(emin, e[i]);
  }
  vec3 lab = vec3(0.0);
  float wsum = 0.0, chroma = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float w = exp(-(e[i] - emin));
    lab += w * u_colLab[i];
    chroma += w * length(u_colLab[i].yz);
    wsum += w;
  }
  lab /= wsum;
  // OKLCH palettes keep more of their chroma between points (a pink pool next
  // to a blue sky stays vivid instead of passing through grey-lilac). The
  // OKLab mean is boosted by (2 - coherence), where coherence = |mean a,b| /
  // mean chroma: full chroma where the hues agree, fading smoothly to zero
  // exactly where opposite hues cancel, so the hue flip there never shows as
  // a seam.
  if (u_palSpace == 3) {
    float coh = clamp(length(lab.yz) / max(chroma / wsum, 1e-5), 0.0, 1.0);
    lab.yz *= 2.0 - coh;
  }
  vec3 base = oklabToLinear(lab);

  // The arc: a band around a big circle; hue sweeps across the band.
  vec2 c = vec2(u_ax * aspect * 0.5, u_ay) / fit;
  vec2 rel = q - c;
  float dist = length(rel) - u_radius;
  float w = max(u_width, 0.01);
  float band = gauss(dist, w * 0.6);
  float s = 0.5 + dist / (w * 2.2);
  if (u_order > 0.5) s = 1.0 - s;
  vec3 spec = spectrumLin(s, u_sat);
  if (u_vivid > 0.0) spec = mix(spec, vividSpectrumLin(s, u_sat), u_vivid);

  // Fade along the arc: brightest toward the Bright side direction.
  float fa = radians(u_fadeAngle);
  float along = dot(normalize(rel + 1e-5), vec2(cos(fa), sin(fa)));
  float fade = mix(1.0, smoothstep(-0.35, 0.75, along), u_fade);

  float k = band * fade * u_blend;
  // Mix in OKLab (luminous, no grey midpoints) plus a whisper of added light.
  vec3 col = oklabToLinear(mix(linearToOklab(base), linearToOklab(spec), k));
  col += spec * band * fade * 0.06;

  writeColorLinear(col);
}
`},j={id:"contour",name:"Contour",v2:!0,uniforms:[{name:"u_scale",label:"Scale",min:.3,max:4,step:.01,default:1,group:"shape"},{name:"u_relief",label:"Relief",min:0,max:1.5,step:.01,default:.5,group:"shape"},{name:"u_lines",label:"Contours",min:4,max:60,step:1,default:18,group:"shape"},{name:"u_weight",label:"Line weight",min:.2,max:4,step:.01,default:1,group:"shape"},{name:"u_index",label:"Index lines",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_fill",label:"Fill range",min:.2,max:1,step:.01,default:.7,group:"shape"},{name:"u_lineTone",label:"Line tone",min:-1,max:1,step:.01,default:.7,group:"shape"},{name:"u_glow",label:"Line glow",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_terrace",label:"Terracing",min:0,max:1,step:.01,default:.3,group:"shape"},{name:"u_shade",label:"Hill shade",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_light",label:"Light angle",min:-180,max:180,step:1,default:135,group:"extra"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:7,group:"extra"},{name:"u_speed",label:"Drift",min:0,max:.6,step:.005,default:.04,group:"motion"}],fragment:`
uniform float u_scale;
uniform float u_relief;
uniform float u_lines;
uniform float u_weight;
uniform float u_index;
uniform float u_fill;
uniform float u_lineTone;
uniform float u_glow;
uniform float u_terrace;
uniform float u_shade;
uniform float u_light;
uniform float u_seed;
uniform float u_speed;

// Elevation in ~0..1: rotated-octave FBM, domain-warped by a slower FBM so
// the terrain folds into ridges and basins instead of round blobs.
float elevation(vec2 p, vec2 sd, float t) {
  vec2 w = vec2(fbmr(p * 0.45 + sd + vec2(t, 0.0), 2),
                fbmr(p * 0.45 + sd.yx + 9.2 - vec2(0.0, t), 2));
  float h = fbmr(p * 0.7 + u_relief * w + sd * 1.3, 3);
  return clamp(0.5 + 0.7 * h, 0.0, 1.0);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 q = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);   // frame-height units
  vec2 p = q * u_scale;
  float t = u_time * u_speed;
  // Seed offsets stay small: finite differences below need float precision,
  // which large noise coordinates (seed * constant) would eat.
  vec2 sd = 3.0 + 14.0 * fract(vec2(u_seed * 0.6180339, u_seed * 0.3819660 + 0.5));

  float h = elevation(p, sd, t);
  // Slope by finite differences in frame units (resolution independent).
  float e = 0.0015;
  float hx = elevation(p + vec2(e * u_scale, 0.0), sd, t);
  float hy = elevation(p + vec2(0.0, e * u_scale), sd, t);
  vec2 g = vec2(hx - h, hy - h) / e;                      // dh / d(frame units)

  // Fill: gradient map of height, softly terraced between contours.
  float f = h * u_lines;
  float fq = (floor(f) + smoothstep(0.3, 0.7, fract(f))) / u_lines;
  vec3 fill = rampLin(mix(h, fq, u_terrace) * u_fill);

  // Hill shade from the slope (a flat plain keeps its colour).
  float la = radians(u_light);
  vec3 N = normalize(vec3(-g * 0.06, 1.0));
  vec3 L = normalize(vec3(cos(la), sin(la), 0.9));
  fill *= mix(1.0, 0.55 + 0.75 * max(dot(N, L), 0.0) / L.z, u_shade);

  // Contour lines: distance to the nearest isoline in frame units, lines a
  // fixed fraction of the frame wide, anti-aliased over one output pixel.
  float dist = abs(fract(f - 0.5) - 0.5) / max(length(g) * u_lines, 1e-3);
  float isIndex = step(abs(mod(floor(f + 0.5), 5.0)), 0.5);
  float w = u_weight * 0.00075 * (1.0 + 1.1 * u_index * isIndex);
  float aa = 1.0 / u_resolution.y;
  float line = 1.0 - smoothstep(w - aa, w + aa, dist);
  // Where the slope collapses (hilltops, saddles) the isolines close into tiny
  // loops that a line of this width would fill solid: fade them out there.
  line *= smoothstep(0.2, 0.6, length(g));
  float halo = exp(-pow(dist / (w * 7.0 + aa), 2.0));

  vec3 inkCol = fill * 0.12;
  vec3 lightCol = rampLin(1.0) * 1.25;
  vec3 lineCol = u_lineTone < 0.0 ? mix(fill, inkCol, -u_lineTone) : mix(fill, lightCol, u_lineTone);
  vec3 col = mix(fill, lineCol, line);
  col += lightCol * halo * u_glow * 0.22 * max(u_lineTone, 0.0);

  writeColorLinear(col);
}
`},G={id:"bokehnight",name:"Bokeh",v2:!0,uniforms:[{name:"u_count",label:"Lights",min:6,max:64,step:1,default:48,group:"shape"},{name:"u_size",label:"Size",min:.3,max:2.5,step:.01,default:1,group:"shape"},{name:"u_depth",label:"Depth",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_band",label:"Band",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_bandY",label:"Band height",min:-.5,max:.5,step:.005,default:-.05,group:"shape"},{name:"u_blades",label:"Aperture",min:0,max:8,step:1,default:0,group:"shape",options:[{value:0,label:"Round"},{value:5,label:"5"},{value:6,label:"6"},{value:8,label:"8"}]},{name:"u_soft",label:"Softness",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_rim",label:"Rim",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_glow",label:"Intensity",min:.1,max:3,step:.01,default:1,group:"shape"},{name:"u_wash",label:"Wash",min:0,max:1.5,step:.01,default:.6,group:"shape"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:3,group:"extra"},{name:"u_speed",label:"Drift",min:0,max:.5,step:.005,default:.03,group:"motion"}],fragment:`
uniform float u_count;
uniform float u_size;
uniform float u_depth;
uniform float u_band;
uniform float u_bandY;
uniform float u_blades;
uniform float u_soft;
uniform float u_rim;
uniform float u_glow;
uniform float u_wash;
uniform float u_seed;
uniform float u_speed;

float orbRand(float i, float k) {
  return hash12(vec2(i * 7.13 + k * 131.7, k * 3.1 + 11.0), u_seed + 1.0);
}

// Distance field of the aperture shape: round (blades 0) or a regular
// polygon, normalised so the inscribed circle has radius 1.
float aperture(vec2 d, float rot) {
  if (u_blades < 2.5) return length(d);
  float n = floor(u_blades + 0.5);
  float a = atan(d.y, d.x) + rot;
  float seg = 6.2831853 / n;
  float m = mod(a, seg) - 0.5 * seg;
  return length(d) * cos(m) / cos(0.5 * seg);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Dark ground (the first palette colour) with a soft haze along the band,
  // as if the lights lit the air around them.
  float bandDist = p.y - u_bandY;
  vec3 ground = rampLin(0.0);
  vec3 col = ground + (rampLin(0.2) - ground) * u_wash * 0.55 * exp(-bandDist * bandDist * 7.0);

  float n = floor(u_count + 0.5);
  float rot = u_seed * 0.37;
  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float z = orbRand(fi, 1.0);                          // 0 far .. 1 near
    float x = (orbRand(fi, 2.0) - 0.5) * aspect * 1.15;
    float yr = orbRand(fi, 3.0) - 0.5;
    float y = mix(yr * 1.1, u_bandY + yr * 0.34 * (0.6 + z), u_band);
    vec2 c = vec2(x, y) + 0.04 * vec2(sin(t + fi * 1.7), cos(t * 0.8 + fi * 2.3));
    float r = u_size * mix(0.014, 0.07, pow(z, 1.4)) * mix(1.0, 1.0 + 1.8 * z, u_depth);
    vec2 d = (p - c) / r;
    float dd = aperture(d, rot);
    if (dd > 1.6) continue;
    // Near orbs defocus more: softer edge, fainter body.
    float edge = mix(0.06, 0.45, u_soft) * mix(0.6, 1.4, z * u_depth);
    float body = 1.0 - smoothstep(1.0 - edge, 1.0 + edge * 0.35, dd);
    float rim = exp(-pow((dd - 0.93) / 0.07, 2.0)) * u_rim * body;
    float bright = mix(0.9, 0.3, z * u_depth) * (0.45 + 0.55 * orbRand(fi, 4.0));
    vec3 oc = rampLin(0.45 + 0.55 * orbRand(fi, 5.0));
    col += oc * (body * (0.42 + 0.18 * dd * dd) + rim) * bright * u_glow;
  }

  writeColorLinear(col);
}
`},H={id:"liquidmetal",name:"Mercury",v2:!0,uniforms:[{name:"u_scale",label:"Scale",min:.3,max:3,step:.01,default:1,group:"shape"},{name:"u_flow",label:"Flow",min:0,max:2,step:.01,default:.9,group:"shape"},{name:"u_relief",label:"Relief",min:.1,max:2,step:.01,default:.8,group:"shape"},{name:"u_bands",label:"Softboxes",min:0,max:6,step:.05,default:2.2,group:"shape"},{name:"u_envAngle",label:"Light angle",min:-180,max:180,step:1,default:120,group:"shape"},{name:"u_gloss",label:"Gloss",min:0,max:1,step:.01,default:.7,group:"shape"},{name:"u_fresnel",label:"Edge light",min:0,max:1,step:.01,default:.35,group:"shape"},{name:"u_bright",label:"Brightness",min:.3,max:2,step:.01,default:1,group:"shape"},{name:"u_seed",label:"Seed",min:0,max:99,step:1,default:5,group:"extra"},{name:"u_speed",label:"Speed",min:0,max:.6,step:.005,default:.05,group:"motion"}],fragment:`
uniform float u_scale;
uniform float u_flow;
uniform float u_relief;
uniform float u_bands;
uniform float u_envAngle;
uniform float u_gloss;
uniform float u_fresnel;
uniform float u_bright;
uniform float u_seed;
uniform float u_speed;

// Molten surface: low-frequency FBM, domain-warped twice so it folds and
// pools like a liquid rather than a noise texture.
float surface(vec2 p, vec2 sd, float t) {
  vec2 w1 = vec2(fbmr(p * 0.5 + sd + vec2(t, 0.0), 2), fbmr(p * 0.5 + sd.yx + 4.1 - vec2(0.0, t), 2));
  vec2 w2 = vec2(fbmr(p * 0.7 + u_flow * w1 + sd * 0.7 + 1.7, 2), fbmr(p * 0.7 + u_flow * w1 + sd.yx * 0.7 + 8.3, 2));
  return fbmr(p * 0.6 + u_flow * w2 + sd * 1.9, 3);
}

// A soft studio environment seen by the mirror: a gradient map across the
// reflected direction with bright softbox bands.
vec3 environment(vec3 R, float ang) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float s = 0.5 + 0.5 * dot(R.xy, dir);              // 0 away from the light, 1 toward it
  float boxes = u_bands > 0.0 ? pow(0.5 + 0.5 * cos(s * u_bands * 6.2831853), 6.0) : 0.0;
  float tt = clamp(s * 0.85 + 0.15 * R.z + boxes * 0.35, 0.0, 1.0);
  return rampLin(tt) * (0.75 + 0.9 * boxes * s);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 q = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  vec2 p = q * u_scale * 1.6;
  float t = u_time * u_speed;
  // Seed offsets stay small: the mirror normals come from finite
  // differences, which large noise coordinates would make noisy.
  vec2 sd = 3.0 + 14.0 * fract(vec2(u_seed * 0.6180339, u_seed * 0.3819660 + 0.5));

  // Normal by finite differences in frame units (resolution independent).
  float e = 0.002;
  float h = surface(p, sd, t);
  float hx = surface(p + vec2(e * u_scale * 1.6, 0.0), sd, t);
  float hy = surface(p + vec2(0.0, e * u_scale * 1.6), sd, t);
  vec3 N = normalize(vec3(-(hx - h) / e * 0.045 * u_relief, -(hy - h) / e * 0.045 * u_relief, 1.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, N);
  float ang = radians(u_envAngle);
  vec3 col = environment(R, ang);

  // Tight specular glint from the key light, and a Fresnel lift where the
  // surface turns away from the viewer.
  vec3 Ldir = normalize(vec3(cos(ang), sin(ang), 1.3));
  float spec = pow(max(dot(R, Ldir), 0.0), mix(12.0, 180.0, u_gloss)) * mix(0.6, 2.4, u_gloss);
  float fres = pow(1.0 - max(N.z, 0.0), 2.0);
  col += rampLin(1.0) * spec;
  col += rampLin(0.8) * fres * u_fresnel * 1.5;

  writeColorLinear(col * u_bright);
}
`},X={id:"draw",name:"Draw",v2:!0,strokes:!0,uniforms:[{name:"u_bg",label:"Background",min:0,max:3,step:1,default:0,group:"shape",options:[{value:0,label:"Deep"},{value:1,label:"Wash"},{value:2,label:"Black"},{value:3,label:"Light"}]},{name:"u_goo",label:"Goo",min:0,max:1,step:.01,default:.55,group:"shape"},{name:"u_mix",label:"Blend",min:0,max:1,step:.01,default:.6,group:"shape"},{name:"u_depth",label:"Depth",min:0,max:1,step:.01,default:.7,group:"shape"},{name:"u_glow",label:"Glow strength",min:0,max:2,step:.01,default:.9,group:"shape"},{name:"u_flow",label:"Flow",min:0,max:1,step:.01,default:.35,group:"motion"},{name:"u_speed",label:"Speed",min:0,max:1,step:.01,default:.12,group:"motion"}],fragment:`
uniform highp sampler2D u_strokeTex;
uniform int   u_strokeCount;
uniform float u_bg;
uniform float u_goo;
uniform float u_mix;
uniform float u_depth;
uniform float u_glow;
uniform float u_flow;
uniform float u_speed;

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  float t = u_time * u_speed;

  // Slow liquid drift of the whole drawing (never moves the strokes' data).
  vec2 q = p + u_flow * 0.045 * vec2(
    snoise(p * 1.4 + vec2(t, 1.7)),
    snoise(p * 1.4 + vec2(4.3, -t) + 2.9)
  );

  int n = max(u_blobCount, 1);
  vec3 bgLab;
  if (u_bg < 0.5)      bgLab = u_colLab[0];
  else if (u_bg < 1.5) bgLab = linearToOklab(rampLin(clamp(0.08 + 0.3 * v_uv.y, 0.0, 1.0)));
  else if (u_bg < 2.5) bgLab = vec3(0.13, 0.0, 0.0);
  else                 bgLab = u_colLab[n - 1];

  float field = 0.0;
  vec3 labSum = vec3(0.0);
  float wSum = 0.0;
  vec3 glow = vec3(0.0);
  float pw = mix(4.0, 0.8, clamp(u_mix, 0.0, 1.0));

  for (int i = 0; i < 24; i++) {
    if (i >= u_strokeCount) break;
    vec4 m1 = texelFetch(u_strokeTex, ivec2(1, i), 0);      // bounds centre xy, bounds radius, point count
    if (length(q - m1.xy) > m1.z) continue;
    vec4 m0 = texelFetch(u_strokeTex, ivec2(0, i), 0);      // colour index, half width, softness, opacity
    vec4 m2 = texelFetch(u_strokeTex, ivec2(2, i), 0);      // closed, glow
    int np = int(m1.w + 0.5);
    bool closed = m2.x > 0.5 && np > 2;

    vec2 a = texelFetch(u_strokeTex, ivec2(3, i), 0).xy;
    vec2 first = a;
    float d = length(q - a);
    bool inside = false;
    for (int k = 1; k < 32; k++) {
      if (k >= np) break;
      vec2 b = texelFetch(u_strokeTex, ivec2(3 + k, i), 0).xy;
      d = min(d, sdSeg(q, a, b));
      if ((a.y > q.y) != (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      a = b;
    }
    if (closed) {
      d = min(d, sdSeg(q, a, first));
      if ((a.y > q.y) != (first.y > q.y) && q.x < (first.x - a.x) * (q.y - a.y) / (first.y - a.y) + a.x) inside = !inside;
    } else {
      inside = false;
    }

    float s = (inside ? -d : d) - m0.y;           // signed distance to the stroke's edge
    float sig = max(m0.z, 0.004);
    float so = max(s, 0.0);
    float g = exp(-(so * so) / (sig * sig)) * m0.w;

    int ci = clamp(int(m0.x + 0.5), 0, n - 1);
    int cj = ci + 1 < n ? ci + 1 : max(ci - 1, 0);
    // Core shading: toward the neighbour colour the deeper inside we are.
    float core = clamp(-s / max(m0.y + sig, 1e-3), 0.0, 1.0);
    vec3 lab = mix(u_colLab[ci], u_colLab[cj], u_depth * core * 0.9);

    if (m2.y > 0.5) {
      glow += oklabToLinear(lab) * g * u_glow;
    } else {
      field += g;
      float w = pow(max(g, 1e-6), pw) * (1.0 + 0.2 * float(i));
      labSum += lab * w;
      wSum += w;
    }
  }

  float soft = clamp(field, 0.0, 1.0);
  float gooey = smoothstep(0.32, 0.68, field);
  float alpha = mix(soft, gooey, clamp(u_goo, 0.0, 1.0));
  vec3 lab = wSum > 1e-6 ? labSum / wSum : bgLab;
  vec3 col = oklabToLinear(mix(bgLab, lab, alpha)) + glow;
  writeColorLinear(col);
}
`};e.s(["DRAW",0,X,"DRAW_MAX_POINTS",0,32,"DRAW_MAX_STROKES",0,24,"DRAW_TEX_W",0,35],1205);let V=[l,i,d,h,_,p,n,r,s,u,v,b,f,m,c,g,x,w,y,S,k,T,C,A,L,R,M,z,F,E,D,B],K=[X,O,I,P,q,W,N,U,j,G,H],Y=[...K,...V],$={fx:!1,pal:!1};e.s(["DEFAULT_MODE_LIMIT",0,12,"MODES",0,V,"NEW_MODES",0,K,"buildFragmentSource",0,function(e,t=$){let i=!!e.v2;return`#version 300 es
#define LAB_FX ${i||t.fx?1:0}
#define LAB_PAL ${i||t.pal?1:0}
`+a+"\n#define main _modeMain\n"+e.fragment+"\n#undef main\n"+o},"getMode",0,function(e){return Y.find(t=>t.id===e)??i},"variantKey",0,function(e,t){return`${e.id}|${+!!t.fx}${+!!t.pal}`}],46775);let Z="srgb",J={grainType:"classic",grainSize:1,grainChroma:.25,grainTone:.45,grainSeed:1,grainAnimate:!1,tonemap:"none",exposure:0,vignette:0,vignetteSize:.45,vignetteSoft:.7,dither:!1,ditherMatrix:8,ditherCell:4,ditherLevels:6,ditherPalette:!1},Q=["srgb","linear","oklab","oklch"],ee=(e,t,a)=>Math.min(a,Math.max(t,e)),et=e=>"number"==typeof e&&Number.isFinite(e);function ea(e){let t=Math.max(1,Math.min(8,Math.round(e)));return 1===t?[0]:Array.from({length:t},(e,a)=>a/(t-1))}e.s(["FX_DEFAULTS",0,J,"compactFx",0,function(e){if(!e)return;let t={};for(let[a,o]of Object.entries(e))void 0!==o&&J[a]!==o&&(t[a]=o);return Object.keys(t).length?t:void 0},"compactPalette",0,function(e){if(!e)return;let t={};return e.space&&e.space!==Z&&(t.space=e.space),e.stops&&e.stops.length&&(t.stops=e.stops.map(e=>Math.round(1e3*e)/1e3)),et(e.bias)&&.5!==e.bias&&(t.bias=e.bias),et(e.sharp)&&0!==e.sharp&&(t.sharp=e.sharp),Object.keys(t).length?t:void 0},"compactView",0,function(e){if(!e)return;let t=e=>Math.round(1e4*e)/1e4;return{aspect:t(e.aspect),x:t(e.x),y:t(e.y),h:t(e.h)}},"evenStops",0,ea,"isFxActive",0,function(e){return"classic"!==e.grainType||"none"!==e.tonemap||0!==e.exposure||e.vignette>0||e.dither},"resolveFx",0,function(e){let t=(e,t,a,o)=>et(e)?ee(e,a,o):t;return{grainType:e?.grainType==="film"?"film":"classic",grainSize:t(e?.grainSize,J.grainSize,1,8),grainChroma:t(e?.grainChroma,J.grainChroma,0,1),grainTone:t(e?.grainTone,J.grainTone,0,1),grainSeed:Math.round(t(e?.grainSeed,J.grainSeed,0,9999)),grainAnimate:e?.grainAnimate===!0,tonemap:e?.tonemap==="aces"?"aces":"none",exposure:t(e?.exposure,J.exposure,-3,3),vignette:t(e?.vignette,J.vignette,0,1),vignetteSize:t(e?.vignetteSize,J.vignetteSize,0,1.5),vignetteSoft:t(e?.vignetteSoft,J.vignetteSoft,.05,1.5),dither:e?.dither===!0,ditherMatrix:e?.ditherMatrix===2||e?.ditherMatrix===4?e.ditherMatrix:8,ditherCell:t(e?.ditherCell,J.ditherCell,1,64),ditherLevels:Math.round(t(e?.ditherLevels,J.ditherLevels,2,8)),ditherPalette:e?.ditherPalette===!0}},"resolvePalette",0,function(e,t){let a=Math.max(1,Math.min(8,Math.round(t)||1)),o=e?.space&&Q.includes(e.space)?e.space:Z,i=et(e?.bias)?ee(e.bias,0,1):.5,l=et(e?.sharp)?ee(e.sharp,0,1):0,n=ea(a),r=!1;if(Array.isArray(e?.stops)&&e.stops.length>=a&&e.stops.slice(0,a).every(et)){let t=0;n=e.stops.slice(0,a).map(e=>t=Math.max(t,ee(e,0,1))),r=!0}let s="srgb"===o&&!r&&.5===i&&0===l;return{space:o,stops:n,explicitStops:r,bias:i,sharp:l,legacy:s}},"resolveView",0,function(e,t,a){if(!e)return null;let o=ee(e.aspect,.1,10),i=ee(e.h,.05,20),l=t/Math.max(a,1)*i/o,n=Math.max(a,1)/i;return{rect:[e.x-l/2,e.y-i/2,l,i],res:[n*o,n]}},"sanitizeFx",0,function(e){if(!e||"object"!=typeof e)return;let t={};for(let a of(("classic"===e.grainType||"film"===e.grainType)&&(t.grainType=e.grainType),("none"===e.tonemap||"aces"===e.tonemap)&&(t.tonemap=e.tonemap),(2===e.ditherMatrix||4===e.ditherMatrix||8===e.ditherMatrix)&&(t.ditherMatrix=e.ditherMatrix),["grainAnimate","dither","ditherPalette"]))"boolean"==typeof e[a]&&(t[a]=e[a]);for(let[a,o,i]of[["grainSize",1,8],["grainChroma",0,1],["grainTone",0,1],["grainSeed",0,9999],["exposure",-3,3],["vignette",0,1],["vignetteSize",0,1.5],["vignetteSoft",.05,1.5],["ditherCell",1,64],["ditherLevels",2,8]]){let l=e[a];et(l)&&(t[a]=ee(l,o,i))}return Object.keys(t).length?t:void 0},"sanitizePalette",0,function(e){if(!e||"object"!=typeof e)return;let t={};return"string"==typeof e.space&&Q.includes(e.space)&&(t.space=e.space),Array.isArray(e.stops)&&e.stops.length>0&&e.stops.length<=8&&e.stops.every(et)&&(t.stops=e.stops.map(e=>ee(e,0,1))),et(e.bias)&&(t.bias=ee(e.bias,0,1)),et(e.sharp)&&(t.sharp=ee(e.sharp,0,1)),Object.keys(t).length?t:void 0},"sanitizeView",0,function(e){if(e&&"object"==typeof e&&et(e.aspect)&&et(e.x)&&et(e.y)&&et(e.h))return{aspect:ee(e.aspect,.1,10),x:ee(e.x,-10,10),y:ee(e.y,-10,10),h:ee(e.h,.05,20)}}],59544)},60889,e=>{"use strict";var t=e.i(1205);let a={size:.05,soft:.07,opacity:1,blend:0},o=(e,t,a)=>Math.min(a,Math.max(t,e)),i=e=>Math.round(1e4*e)/1e4;function l(e){let t=e.length/2;if(!t)return[0,0];let a=0,o=0;for(let t=0;t<e.length;t+=2)a+=e[t],o+=e[t+1];return[a/t,o/t]}function n(e){let[t,a]=l(e.pts),o=Array(e.pts.length);for(let i=0;i<e.pts.length;i+=2)o[i]=t+(e.pts[i]-t)*e.scale+e.dx,o[i+1]=a+(e.pts[i+1]-a)*e.scale+e.dy;return o}function r(e){let t=n(e),[a,o]=l(t),i=0;for(let e=0;e<t.length;e+=2)i=Math.max(i,Math.hypot(t[e]-a,t[e+1]-o));return{cx:a,cy:o,r:i+e.size*e.scale}}function s(e,t,a){let i=a?[...e,e[0]]:e,l=[0];for(let e=1;e<i.length;e++)l.push(l[e-1]+Math.hypot(i[e][0]-i[e-1][0],i[e][1]-i[e-1][1]));let n=l[l.length-1];if(n<1e-6||i.length<2)return[e[0]];let r=[],s=a?t:t-1,u=1;for(let e=0;e<t;e++){let t=e/s*n;for(;u<l.length-1&&l[u]<t;)u++;let a=l[u]-l[u-1]||1,f=o((t-l[u-1])/a,0,1),m=i[u-1],p=i[u];r.push([m[0]+(p[0]-m[0])*f,m[1]+(p[1]-m[1])*f])}return r}e.s(["BRUSH_DEFAULTS",0,a,"buildPath",0,function(e,a){if(0===e.length)return{pts:[],closed:!1};if(1===e.length)return{pts:[i(e[0][0]),i(e[0][1])],closed:!1};let o=0;for(let t=1;t<e.length;t++)o+=Math.hypot(e[t][0]-e[t-1][0],e[t][1]-e[t-1][1]);let l=e[0],n=e[e.length-1],r=a&&e.length>6&&o>.25&&Math.hypot(l[0]-n[0],l[1]-n[1])<Math.max(.07,.12*o),u=Math.max(2,Math.min(t.DRAW_MAX_POINTS,Math.round(o/.025)+2)),f=s(e,Math.min(64,Math.max(2*u,4)),r);return{pts:(f=s(f=function(e,t){let a=e;for(let e=0;e<2&&a.length>2;e++){let e=[],o=a.length;t||e.push(a[0]);let i=t?o:o-1;for(let t=0;t<i;t++){let i=a[t],l=a[(t+1)%o];e.push([.75*i[0]+.25*l[0],.75*i[1]+.25*l[1]]),e.push([.25*i[0]+.75*l[0],.25*i[1]+.75*l[1]])}t||e.push(a[o-1]),a=e}return a}(f,r),u,r)).flatMap(([e,t])=>[i(e),i(t)]),closed:r}},"cloneStrokes",0,function(e){return e.map(e=>({...e,pts:[...e.pts]}))},"compactStrokes",0,function(e){if(e?.length)return e.slice(0,t.DRAW_MAX_STROKES).map(e=>({p:n(e).map(e=>Math.round(1e3*e)/1e3),c:e.color,w:Math.round(e.size*e.scale*1e3)/1e3,f:Math.round(1e3*e.soft)/1e3,o:Math.round(100*e.opacity)/100,...e.closed?{z:1}:{},...e.blend?{b:1}:{}}))},"hitStroke",0,function(e,t,a,i=.02){for(let l=e.length-1;l>=0;l--){let r=e[l];if(function(e,t,a){let i=n(e),l=i.length/2;if(!l)return 1/0;let r=Math.hypot(t-i[0],a-i[1]),s=!1,u=(e,i,l,n)=>{let u,f,m,p;r=Math.min(r,(p=(m=(u=l-e)*u+(f=n-i)*f)>1e-12?o(((t-e)*u+(a-i)*f)/m,0,1):0,Math.hypot(t-e-u*p,a-i-f*p))),i>a!=n>a&&t<(l-e)*(a-i)/(n-i)+e&&(s=!s)};for(let e=1;e<l;e++)u(i[2*e-2],i[2*e-1],i[2*e],i[2*e+1]);let f=e.closed&&l>2;return f&&u(i[2*l-2],i[2*l-1],i[0],i[1]),(f&&s?-r:r)-e.size*e.scale}(r,t,a)<=Math.max(i,.35*r.soft))return l}return null},"packStrokes",0,function(e,a){a.fill(0);let o=(e??[]).slice(0,t.DRAW_MAX_STROKES);return o.forEach((e,o)=>{let i=n(e),l=Math.min(t.DRAW_MAX_POINTS,i.length/2),s=r(e),u=o*t.DRAW_TEX_W*4,f=e.size*e.scale,m=e.soft*Math.sqrt(e.scale);a.set([e.color,f,m,e.opacity],u),a.set([s.cx,s.cy,s.r+3.2*m+.01,l],u+4),a.set([+!!e.closed,e.blend,0,0],u+8);for(let e=0;e<l;e++)a.set([i[2*e],i[2*e+1],0,0],u+12+4*e)}),o.length},"sanitizeStrokes",0,function(e){if(!Array.isArray(e))return;let i=[];for(let l of e.slice(0,t.DRAW_MAX_STROKES)){if(!l||"object"!=typeof l)continue;let e=Array.isArray(l.p)?l.p.filter(e=>"number"==typeof e&&Number.isFinite(e)):[];if(e.length<2)continue;let n=(e,t,a,i)=>"number"==typeof e&&Number.isFinite(e)?o(e,a,i):t;i.push({pts:e.slice(0,Math.min(e.length-e.length%2,2*t.DRAW_MAX_POINTS)).map(e=>o(e,-4,4)),closed:1===l.z,color:Math.round(n(l.c,1,0,7)),size:n(l.w,a.size,.005,.6),soft:n(l.f,a.soft,.005,.6),opacity:n(l.o,1,0,1),blend:+(1===l.b),dx:0,dy:0,scale:1})}return i.length?i:void 0},"strokeBounds",0,r])},65469,e=>{"use strict";function t(e){let t=String(e??"").replace("#",""),a=parseInt(3===t.length?t.split("").map(e=>e+e).join(""):6===t.length?t:"000000",16);return Number.isFinite(a)?[(a>>16&255)/255,(a>>8&255)/255,(255&a)/255]:[0,0,0]}function a([e,t,o]){let i=e=>Math.round(255*Math.min(1,Math.max(0,e))).toString(16).padStart(2,"0");return`#${i(e)}${i(t)}${i(o)}`}function o(e){return(e=Math.max(0,e))<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)}function i(e){return(e=Math.max(0,e))<=.0031308?12.92*e:1.055*Math.pow(e,1/2.4)-.055}function l([e,t,a]){let o=Math.cbrt(Math.max(0,.4122214708*e+.5363325363*t+.0514459929*a)),i=Math.cbrt(Math.max(0,.2119034982*e+.6806995451*t+.1073969566*a)),n=Math.cbrt(Math.max(0,.0883024619*e+.2817188376*t+.6299787005*a));return[.2104542553*o+.793617785*i-.0040720468*n,1.9779984951*o-2.428592205*i+.4505937099*n,.0259040371*o+.7827717662*i-.808675766*n]}function n([e,t,a]){let o=e+.3963377774*t+.2158037573*a,i=e-.1055613458*t-.0638541728*a,l=e-.0894841775*t-1.291485548*a,r=o*o*o,s=i*i*i,u=l*l*l;return[Math.max(0,4.0767416621*r-3.3077115913*s+.2309699292*u),Math.max(0,-1.2684380046*r+2.6097574011*s-.3413193965*u),Math.max(0,-.0041960863*r-.7034186147*s+1.707614701*u)]}function r(e){let[a,i,l]=t(e);return[o(a),o(i),o(l)]}function s(e){return l(r(e))}let u=(e,t,a)=>{let o=Math.min(1,Math.max(0,(a-e)/(t-e)));return o*o*(3-2*o)};e.s(["hexToOklab",0,s,"hexToRgb01",0,t,"linearToOklab",0,l,"linearToSrgb1",0,i,"oklabToLinear",0,n,"rampCss",0,function(e,l,f,m=48){let p=[];for(let c=0;c<=m;c++){let d=c/m;p.push(`${a(function(e,a,l,f){let m=Math.max(1,Math.min(8,Math.round(a)));if(f=Math.min(1,Math.max(0,f)),l.legacy){let a=f*Math.max(m-1,1),o=Math.floor(a),i=Math.min(m-1,o+1),l=u(0,1,a-o),n=t(e[o]??"#000000"),r=t(e[i]??"#000000");return[0,1,2].map(e=>n[e]+(r[e]-n[e])*l)}let p=e=>[i(e[0]),i(e[1]),i(e[2])];if(1===m||f<=l.stops[0])return p(r(e[0]??"#000000"));for(let a=0;a+1<m;a++){let i=l.stops[a],m=l.stops[a+1];if(f<=m){let c=(f-i)/Math.max(m-i,1e-5);return p(function(e,a,i,l){if("srgb"===e){let e=t(a),n=t(i);return[0,1,2].map(t=>o(e[t]+(n[t]-e[t])*l))}if("linear"===e){let e=r(a),t=r(i);return[0,1,2].map(a=>e[a]+(t[a]-e[a])*l)}let u=s(a),f=s(i);if("oklab"===e)return n([0,1,2].map(e=>u[e]+(f[e]-u[e])*l));let m=Math.hypot(u[1],u[2]),p=Math.hypot(f[1],f[2]),c=m<1e-4?0:Math.atan2(u[2],u[1]),d=p<1e-4?0:Math.atan2(f[2],f[1]);m<1e-4&&(c=d),p<1e-4&&(d=c);let h=d-c;h-=2*Math.PI*Math.floor((h+Math.PI)/(2*Math.PI));let _=c+h*l,g=m+(p-m)*l;return n([u[0]+(f[0]-u[0])*l,g*Math.cos(_),g*Math.sin(_)])}(l.space,e[a]??"#000000",e[a+1]??"#000000",function(e,t,a){e=Math.min(1,Math.max(0,e)),.5!==t&&(e=Math.pow(e,t<.5?1+3*(1-2*t):1-1.5*(t-.5)));let o=Math.min(1,Math.max(0,a));if(o<=0)return e;let i=.5-.48*Math.min(1,Math.max(0,(o-.25)/.75)),l=Math.min(1,4*o);return e+(u(.5-i,.5+i,e)-e)*l}(c,l.bias,l.sharp)))}}return p(r(e[m-1]??"#000000"))}(e,l,f,d))} ${(100*d).toFixed(2)}%`)}return`linear-gradient(90deg, ${p.join(", ")})`},"rgb01ToHex",0,a,"srgbToLinear1",0,o])},22827,4123,74027,e=>{"use strict";var t=e.i(46775),a=e.i(92328),o=e.i(59544),i=e.i(65469),l=e.i(1205),n=e.i(60889);let r=["u_time","u_resolution","u_blobCount","u_colors","u_brightness","u_contrast","u_saturation","u_grain","u_blobOffsets","u_uvRect","u_tileOffset","u_ditherLSB","u_view","u_outSize","u_palSpace","u_stops","u_palBias","u_palSharp","u_colLin","u_colLab","u_tone","u_exposure","u_grainType","u_grainSize","u_grainChroma","u_grainTone","u_grainSeed","u_grainFrame","u_vigAmount","u_vigSize","u_vigSoft","u_ditherOn","u_ditherBits","u_ditherCell","u_ditherLevels","u_ditherPal"];function s(e,t,a){let o=e.createShader(t);if(!o)throw Error("createShader failed (context lost?)");if(e.shaderSource(o,a),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(o);throw e.deleteShader(o),Error(`Shader compile error: ${t}`)}return o}function u(e,t){if(e.v2)return{fx:!0,pal:!0};let a=Math.max(1,Math.min(8,Math.round(t.blobCount)||1));return{fx:(0,o.isFxActive)((0,o.resolveFx)(t.fx))||!!t.view,pal:!(0,o.resolvePalette)(t.palette,a).legacy}}function f(e,o,i={fx:!1,pal:!1}){let n,u,m=s(e,e.VERTEX_SHADER,a.VERTEX_SHADER);try{n=s(e,e.FRAGMENT_SHADER,(0,t.buildFragmentSource)(o,i))}catch(t){throw e.deleteShader(m),t}let p=e.createProgram();if(!p)throw Error("createProgram failed (context lost?)");if(e.attachShader(p,m),e.attachShader(p,n),e.linkProgram(p),!e.getProgramParameter(p,e.LINK_STATUS)){let t=e.getProgramInfoLog(p);throw e.deleteProgram(p),e.deleteShader(m),e.deleteShader(n),Error(`Program link error: ${t}`)}let c=e.createVertexArray();e.bindVertexArray(c);let d=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,d),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),e.STATIC_DRAW);let h=e.getAttribLocation(p,"a_pos");e.enableVertexAttribArray(h),e.vertexAttribPointer(h,2,e.FLOAT,!1,0,0);let _={};for(let t of r)_[t]=e.getUniformLocation(p,t);let g={};for(let t of o.uniforms)g[t.name]=e.getUniformLocation(p,t.name);if(o.strokes){let t=e.createTexture(),a=new Float32Array(l.DRAW_TEX_W*l.DRAW_MAX_STROKES*4);e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,l.DRAW_TEX_W,l.DRAW_MAX_STROKES,0,e.RGBA,e.FLOAT,a),u={tex:t,data:a,locTex:e.getUniformLocation(p,"u_strokeTex"),locCount:e.getUniformLocation(p,"u_strokeCount"),packed:null,count:0}}return{strokes:u,mode:o,variant:i,key:(0,t.variantKey)(o,i),program:p,vs:m,fs:n,vao:c,vbo:d,loc:_,params:g,scratch:{colors:new Float32Array(24),colLin:new Float32Array(24),colLab:new Float32Array(24),stops:new Float32Array(8),offs:new Float32Array(16)}}}function m(e,t,a,r){let{loc:s,scratch:u}=t;e.useProgram(t.program);let f=(0,o.resolveView)(a.view,r.width,r.height);s.u_time&&e.uniform1f(s.u_time,r.time),s.u_resolution&&(f?e.uniform2f(s.u_resolution,f.res[0],f.res[1]):e.uniform2f(s.u_resolution,r.width,r.height)),s.u_blobCount&&e.uniform1i(s.u_blobCount,a.blobCount),s.u_brightness&&e.uniform1f(s.u_brightness,a.brightness),s.u_contrast&&e.uniform1f(s.u_contrast,a.contrast),s.u_saturation&&e.uniform1f(s.u_saturation,a.saturation),s.u_grain&&e.uniform1f(s.u_grain,a.grain);let m=Math.max(1,Math.min(8,Math.round(a.blobCount)||1));for(let e=0;e<8;e++){let[t,o,l]=(0,i.hexToRgb01)(a.colors[e]??"#000000");u.colors[3*e]=t,u.colors[3*e+1]=o,u.colors[3*e+2]=l;let n=(0,i.srgbToLinear1)(t),r=(0,i.srgbToLinear1)(o),s=(0,i.srgbToLinear1)(l);u.colLin[3*e]=n,u.colLin[3*e+1]=r,u.colLin[3*e+2]=s;let f=(0,i.linearToOklab)([n,r,s]);u.colLab[3*e]=f[0],u.colLab[3*e+1]=f[1],u.colLab[3*e+2]=f[2]}if(s.u_colors&&e.uniform3fv(s.u_colors,u.colors),s.u_blobOffsets&&t.mode.hasBlobs){for(let e=0;e<8;e++){let t=a.blobOffsets[e]??[0,0];u.offs[2*e]=t[0],u.offs[2*e+1]=t[1]}e.uniform2fv(s.u_blobOffsets,u.offs)}for(let o of t.mode.uniforms){let i=t.params[o.name];i&&e.uniform1f(i,a.params[o.name]??o.default)}if(t.strokes){let o=t.strokes;e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,o.tex),o.packed!==(a.strokes??null)&&(o.count=(0,n.packStrokes)(a.strokes,o.data),e.texSubImage2D(e.TEXTURE_2D,0,0,0,l.DRAW_TEX_W,l.DRAW_MAX_STROKES,e.RGBA,e.FLOAT,o.data),o.packed=a.strokes??null),o.locTex&&e.uniform1i(o.locTex,0),o.locCount&&e.uniform1i(o.locCount,o.count)}let p=r.uvRect??[0,0,1,1];s.u_uvRect&&e.uniform4f(s.u_uvRect,p[0],p[1],p[2],p[3]);let c=r.tileOffset??[0,0];s.u_tileOffset&&e.uniform2f(s.u_tileOffset,c[0],c[1]),s.u_ditherLSB&&e.uniform1f(s.u_ditherLSB,r.ditherLSB??1),s.u_view&&(f?e.uniform4f(s.u_view,f.rect[0],f.rect[1],f.rect[2],f.rect[3]):e.uniform4f(s.u_view,0,0,0,0)),s.u_outSize&&e.uniform2f(s.u_outSize,r.width,r.height);let d=(0,o.resolvePalette)(a.palette,m);s.u_palSpace&&e.uniform1i(s.u_palSpace,["srgb","linear","oklab","oklch"].indexOf(d.space));for(let e=0;e<8;e++)u.stops[e]=e<d.stops.length?d.stops[e]:1;s.u_stops&&e.uniform1fv(s.u_stops,u.stops),s.u_palBias&&e.uniform1f(s.u_palBias,d.bias),s.u_palSharp&&e.uniform1f(s.u_palSharp,d.sharp),s.u_colLin&&e.uniform3fv(s.u_colLin,u.colLin),s.u_colLab&&e.uniform3fv(s.u_colLab,u.colLab);let h=(0,o.resolveFx)(a.fx);s.u_tone&&e.uniform1i(s.u_tone,+("aces"===h.tonemap)),s.u_exposure&&e.uniform1f(s.u_exposure,Math.pow(2,h.exposure)),s.u_grainType&&e.uniform1i(s.u_grainType,+("film"===h.grainType)),s.u_grainSize&&e.uniform1f(s.u_grainSize,h.grainSize),s.u_grainChroma&&e.uniform1f(s.u_grainChroma,h.grainChroma),s.u_grainTone&&e.uniform1f(s.u_grainTone,h.grainTone),s.u_grainSeed&&e.uniform1f(s.u_grainSeed,h.grainSeed);let _=h.grainAnimate&&!r.staticGrain?Math.floor(24*Math.max(0,r.time))+1:0;s.u_grainFrame&&e.uniform1f(s.u_grainFrame,_),s.u_vigAmount&&e.uniform1f(s.u_vigAmount,h.vignette),s.u_vigSize&&e.uniform1f(s.u_vigSize,h.vignetteSize),s.u_vigSoft&&e.uniform1f(s.u_vigSoft,h.vignetteSoft),s.u_ditherOn&&e.uniform1i(s.u_ditherOn,+!!h.dither),s.u_ditherBits&&e.uniform1i(s.u_ditherBits,2===h.ditherMatrix?1:4===h.ditherMatrix?2:3),s.u_ditherCell&&e.uniform1f(s.u_ditherCell,h.ditherCell),s.u_ditherLevels&&e.uniform1f(s.u_ditherLevels,h.ditherLevels),s.u_ditherPal&&e.uniform1i(s.u_ditherPal,+!!h.ditherPalette)}function p(e,t){e.useProgram(t.program),e.bindVertexArray(t.vao),e.drawArrays(e.TRIANGLES,0,6)}e.s(["applyStateUniforms",0,m,"createModeProgram",0,f,"deleteModeProgram",0,function(e,t){e.deleteProgram(t.program),e.deleteShader(t.vs),e.deleteShader(t.fs),e.deleteBuffer(t.vbo),e.deleteVertexArray(t.vao),t.strokes&&e.deleteTexture(t.strokes.tex)},"drawModeProgram",0,p,"stateVariant",0,u,"stateVariantKey",0,function(e,a){return(0,t.variantKey)(e,u(e,a))}],22827);let c=null;function d(e,t=0xffffffff){let a=function(){if(c)return c;let e=new Uint32Array(256);for(let t=0;t<256;t++){let a=t;for(let e=0;e<8;e++)a=1&a?0xedb88320^a>>>1:a>>>1;e[t]=a>>>0}return c=e,e}();for(let o=0;o<e.length;o++)t=a[(t^e[o])&255]^t>>>8;return t}let h=new TextEncoder;function _(e){return new Uint8Array([e>>>24&255,e>>>16&255,e>>>8&255,255&e])}function g(e,t){let a=h.encode(e),o=new Uint8Array(12+t.length);o.set(_(t.length),0),o.set(a,4),o.set(t,8);let i=0xffffffff^d(t,d(a));return o.set(_(i>>>0),8+t.length),o}let v=new Uint8Array([137,80,78,71,13,10,26,10]);class b{width;height;head=[];idat=[];writer;reading;prev;cur;rowsWritten=0;constructor(e,t){this.width=e,this.height=t;const a=new Uint8Array(13);a.set(_(e),0),a.set(_(t),4),a[8]=8,a[9]=2,a[10]=0,a[11]=0,a[12]=0,this.head.push(v,g("IHDR",a));const o=new CompressionStream("deflate");this.writer=o.writable.getWriter();const i=o.readable.getReader();this.reading=(async()=>{for(;;){let{value:e,done:t}=await i.read();if(t)break;e&&e.length&&this.idat.push(g("IDAT",e))}})(),this.prev=new Uint8Array(3*e),this.cur=new Uint8Array(3*e)}async addRows(e,t){let a=this.width,o=3*a,i=new Uint8Array(t*(o+1)),l=0;for(let n=0;n<t;n++){let t=n*a*4,r=this.cur;for(let o=0,i=t,l=0;o<a;o++,i+=4,l+=3)r[l]=e[i],r[l+1]=e[i+1],r[l+2]=e[i+2];let s=this.prev,u=0===this.rowsWritten;i[l++]=4;for(let e=0;e<o;e++){let t=e>=3?r[e-3]:0,a=u?0:s[e],o=!u&&e>=3?s[e-3]:0,n=t+a-o,f=Math.abs(n-t),m=Math.abs(n-a),p=Math.abs(n-o),c=f<=m&&f<=p?t:m<=p?a:o;i[l++]=r[e]-c&255}this.prev=r,this.cur=s,this.rowsWritten++}await this.writer.write(i)}async finish(){if(this.rowsWritten!==this.height)throw Error(`PNG encoder got ${this.rowsWritten} of ${this.height} rows`);await this.writer.close(),await this.reading;let e=g("IEND",new Uint8Array(0));return new Blob([...this.head,...this.idat,e].map(e=>e),{type:"image/png"})}async abort(){try{await this.writer.abort()}catch{}}}let x=new Set(["IHDR","PLTE","tRNS","IDAT","IEND"]);class w extends Error{code;constructor(e,t){super(e),this.code=t}}function y(e,t){let a=e=>Math.round(Math.min(8192,Math.max(16,e||0)));return[a(e),a(t)]}let S=new Map;async function k(e){let a,[o,i]=y(e.width,e.height),l=()=>{if(e.signal?.aborted)throw new w("Export cancelled","aborted")},n=document.createElement("canvas");n.width=1,n.height=1;let r=n.getContext("webgl2",{antialias:!1,alpha:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,premultipliedAlpha:!1});if(!r)throw new w("WebGL2 isn't available in this browser.","webgl");let s=()=>r.getExtension("WEBGL_lose_context")?.loseContext(),c=Number(r.getParameter(r.MAX_RENDERBUFFER_SIZE))||4096,d=r.getParameter(r.MAX_VIEWPORT_DIMS),h=[Number(d?.[0])||c,Number(d?.[1])||c],_=Math.max(64,Math.min(e.maxTile??2048,2048,c,h[0],h[1]));n.width=Math.min(_,o),n.height=Math.min(_,i);let g=r.drawingBufferWidth,S=r.drawingBufferHeight;(g<n.width||S<n.height)&&(_=Math.max(128,Math.min(g,S)));let k=(0,t.getMode)(e.state.mode);try{a=f(r,k,u(k,e.state))}catch(e){throw s(),new w(`Shader failed to compile: ${e.message}`,"shader")}let T=Math.ceil(o/_)*Math.ceil(i/_),C="png"===e.format&&"u">typeof CompressionStream,A=null,L=null,R=null;if(C)A=new b(o,i);else if((R=document.createElement("canvas")).width=o,R.height=i,!(L=R.getContext("2d"))||R.width!==o||R.height!==i)throw s(),new w(`This browser can't hold a ${o}\xd7${i} image for ${e.format.toUpperCase()}. Try PNG or a smaller size.`,"size");let M=new Uint8Array(o*Math.min(_,i)*4),z=new Uint8Array(Math.min(_,o)*Math.min(_,i)*4),F=0,E=C?.9:.8;try{for(let t=0;t<i;t+=_){let n=Math.min(_,i-t);for(let s=0;s<o;s+=_){l();let u=Math.min(_,o-s),f=s,c=i-t-n;m(r,a,e.state,{time:e.time,width:o,height:i,tileOffset:[f,c],uvRect:[f/o,c/i,u/o,n/i],staticGrain:!0}),r.viewport(0,0,u,n),p(r,a);let d=z.subarray(0,u*n*4);if(r.readPixels(0,0,u,n,r.RGBA,r.UNSIGNED_BYTE,d),r.isContextLost())throw new w("The GPU dropped the WebGL context mid-export.","webgl");for(let e=0;e<n;e++)M.set(d.subarray(e*u*4,(e+1)*u*4),((n-1-e)*o+s)*4);F++,e.onProgress?.(F/T*E),await new Promise(e=>{if("u"<typeof MessageChannel)return setTimeout(e,0);let t=new MessageChannel;t.port1.onmessage=()=>{t.port1.close(),e()},t.port2.postMessage(0)})}if(l(),A)await A.addRows(M,n);else if(L){let e=new ImageData(new Uint8ClampedArray(M.buffer,0,o*n*4),o,n);L.putImageData(e,0,t)}}}catch(e){if(await A?.abort(),s(),e instanceof w)throw e;throw new w(`Render failed: ${e.message}`,"webgl")}s();let D=null;try{if(A)D=await A.finish();else if(R){let t="jpg"===e.format?"image/jpeg":"image/png",a=await new Promise(a=>R.toBlob(a,t,"jpg"===e.format?e.quality??.93:void 0));if(a){let o=new Uint8Array(await a.arrayBuffer()),i="jpg"===e.format?function(e){if(255!==e[0]||216!==e[1])return e;let t=[e.subarray(0,2)],a=2;for(;a+4<=e.length;){if(255!==e[a])return e;let o=e[a+1];if(218===o){t.push(e.subarray(a));break}let i=e[a+2]<<8|e[a+3],l=a+2+i;if(l>e.length)return e;254===o||o>=225&&o<=239&&238!==o||t.push(e.subarray(a,l)),a=l}let o=new Uint8Array(t.reduce((e,t)=>e+t.length,0)),i=0;for(let e of t)o.set(e,i),i+=e.length;return o}(o):function(e){for(let t=0;t<8;t++)if(e[t]!==v[t])return e;let t=[e.subarray(0,8)],a=8;for(;a+12<=e.length;){let o=(e[a]<<24|e[a+1]<<16|e[a+2]<<8|e[a+3])>>>0,i=String.fromCharCode(e[a+4],e[a+5],e[a+6],e[a+7]),l=a+12+o;if(l>e.length)return e;if(x.has(i)&&t.push(e.subarray(a,l)),a=l,"IEND"===i)break}let o=new Uint8Array(t.reduce((e,t)=>e+t.length,0)),i=0;for(let e of t)o.set(e,i),i+=e.length;return o}(o);D=new Blob([i],{type:t})}R.width=1,R.height=1}}catch(e){throw new w(`Encoding failed: ${e.message}`,"encode")}if(!D)throw new w("The browser couldn't encode the image.","encode");return e.onProgress?.(1),{blob:D,width:o,height:i,tileSize:_,tiles:T,limits:{maxRenderbuffer:c,maxViewport:h}}}e.s(["STILL_MAX_SIDE",0,8192,"STILL_SIZES",0,[{id:"4k",label:"4K",w:3840,h:2160},{id:"5k",label:"5K",w:5120,h:2880},{id:"6k",label:"6K",w:6144,h:3456},{id:"8k",label:"8K",w:7680,h:4320},{id:"phone",label:"Phone",w:1290,h:2796},{id:"square",label:"Square",w:4096,h:4096}],"StillExportError",0,w,"clampStillSize",0,y,"downloadBlob",0,function(e,t){let a=URL.createObjectURL(e),o=document.createElement("a");o.href=a,o.download=t,document.body.appendChild(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(a),3e4)},"exportStill",0,k,"nextExportName",0,function(e,t){let a=e.replace(/[\\/:*?"<>|\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim()||"Gradient Lab",o=(S.get(a)??0)+1;return S.set(a,o),`${a} ${String(o).padStart(3,"0")}.${t}`}],4123);var T=e.i(43476),C=e.i(1844);function A({active:e,onClick:t,children:a,title:o}){return(0,T.jsx)("button",{type:"button",className:"gl-chip","data-active":e,"aria-pressed":e,title:o,onClick:t,style:{padding:"9px 4px",fontSize:11,fontFamily:"inherit",fontWeight:500,cursor:"pointer",borderRadius:8,border:e?"1px solid rgba(255,255,255,0.6)":"1px solid rgba(255,255,255,0.08)",background:e?C.palette.text:C.palette.surfaceTranslucent,color:e?C.palette.bg:C.palette.text,textAlign:"center",lineHeight:1.2},children:a})}e.s(["ChipRow",0,function({value:e,options:t,onChange:a,columns:o}){return(0,T.jsx)("div",{style:{display:"grid",gridTemplateColumns:`repeat(${o??t.length}, 1fr)`,gap:5,marginBottom:12},children:t.map(t=>(0,T.jsx)(A,{active:t.value===e,title:t.title,onClick:()=>a(t.value),children:t.label},String(t.value)))})},"ChoiceChip",0,A,"NumberInput",0,function({value:e,onChange:t,suffix:a,min:o=1,max:i,ariaLabel:l}){return(0,T.jsxs)("div",{style:{display:"flex",alignItems:"center",flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"0 10px"},children:[(0,T.jsx)("input",{type:"number",className:"gl-num",value:e,min:o,max:i,"aria-label":l??a,onChange:e=>{let a=parseInt(e.target.value,10);Number.isFinite(a)&&a>=o&&(void 0===i||a<=i)&&t(a)},style:{flex:1,minWidth:0,padding:"6px 0",background:"transparent",border:"none",color:C.palette.text,fontSize:13,outline:"none",fontFamily:"inherit"}}),a&&(0,T.jsx)("span",{style:{fontSize:10,color:C.palette.textWhisper,marginLeft:4},children:a})]})},"PanelSection",0,function({title:e,children:t,aside:a}){return(0,T.jsxs)("div",{style:{marginBottom:18},children:[(0,T.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:C.palette.textSubtle,marginBottom:10},children:[(0,T.jsx)("span",{children:e}),a]}),t]})},"ProgressRing",0,function({pct:e,size:t=15,stroke:a=2}){let o=(t-a)/2,i=2*Math.PI*o,l=Math.max(0,Math.min(100,e)),n=t/2;return(0,T.jsxs)("svg",{width:t,height:t,viewBox:`0 0 ${t} ${t}`,style:{display:"block",flexShrink:0},"aria-hidden":!0,children:[(0,T.jsx)("circle",{cx:n,cy:n,r:o,fill:"none",stroke:"currentColor",strokeOpacity:.25,strokeWidth:a}),(0,T.jsx)("circle",{cx:n,cy:n,r:o,fill:"none",stroke:"currentColor",strokeWidth:a,strokeLinecap:"round",strokeDasharray:i,strokeDashoffset:i*(1-l/100),transform:`rotate(-90 ${n} ${n})`,style:{transition:"stroke-dashoffset 0.15s linear"}})]})},"SheetButton",0,function({onClick:e,children:t,primary:a,disabled:o}){return(0,T.jsx)("button",{type:"button",onClick:e,disabled:o,className:a?"gl-btn-primary":"gl-btn",style:{width:"100%",padding:"12px 14px",fontSize:13,fontFamily:"inherit",fontWeight:a?600:500,cursor:o?"default":"pointer",color:a?C.palette.bg:C.palette.text,background:a?C.palette.text:"rgba(255,255,255,0.06)",border:a?"none":"1px solid rgba(255,255,255,0.1)",borderRadius:10,opacity:o?.6:1},children:t})},"Slider",0,function({label:e,value:t,min:a,max:o,step:i,onChange:l,display:n}){return(0,T.jsxs)("div",{style:{marginBottom:10},children:[(0,T.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,fontSize:12},children:[(0,T.jsx)("span",{style:{color:C.palette.textMuted},children:e}),(0,T.jsx)("span",{style:{fontFamily:"ui-monospace,monospace",fontSize:11,opacity:.6},children:n??t.toFixed(i<.01?3:2)})]}),(0,T.jsx)("input",{type:"range",min:a,max:o,step:i,value:t,"aria-label":e,onChange:e=>l(parseFloat(e.target.value)),style:{width:"100%",accentColor:"#FFFFFF",height:4}})]})},"SubLabel",0,function({children:e}){return(0,T.jsx)("div",{style:{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.45)",margin:"4px 0 8px"},children:e})},"SwitchRow",0,function({label:e,checked:t,onChange:a}){return(0,T.jsxs)("label",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:12,color:C.palette.textMuted,marginBottom:12,cursor:"pointer",userSelect:"none"},children:[(0,T.jsx)("span",{children:e}),(0,T.jsxs)("span",{style:{position:"relative",display:"inline-flex"},children:[(0,T.jsx)("input",{type:"checkbox",checked:t,onChange:e=>a(e.target.checked),style:{position:"absolute",opacity:0,width:0,height:0,pointerEvents:"none"}}),(0,T.jsx)("span",{"aria-hidden":!0,className:"bg-toggle-track"})]})]})}],74027)}]);