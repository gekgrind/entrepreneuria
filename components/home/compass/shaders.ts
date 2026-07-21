/**
 * The compass hero shader — one fullscreen pass, one draw call.
 *
 * The compass body is a raymarched SDF (solid of revolution: puck, rim lip,
 * recessed face, center cap) with an analytically-intersected glass dome.
 * The needle is fully analytic (solid core + glow on the dial plane), the
 * gold beam is a volumetric ray-to-ray distance, and the blueprint grid
 * background is 2D — no post-processing pipeline needed anywhere.
 *
 * Two hard-won constraints shape this file:
 *
 * 1. GLSL ES 3.00 with a UNIFORM step count (uSteps). A constant-bound
 *    march loop gets force-unrolled by ANGLE/FXC on Windows and the shader
 *    takes minutes to compile, wedging the whole GPU process. A dynamic
 *    bound compiles as a real loop in milliseconds — and it makes the
 *    quality ladder free (no program rebuilds). ES 3.00 requires WebGL2;
 *    the component bails to the static CSS hero on WebGL1.
 *
 * 2. The dial is a plane, so rays that land on it clear of the rim annulus
 *    and center cap are shaded directly with NO marching — that's most of
 *    the compass area. The march only runs for the metal ring and cap.
 *
 * Local space: face plane = XY, +Z = face normal.
 * Everything animatable is a uniform, ready for GSAP scrubbing in the
 * scroll phase: uNeedle (angle), uTrail (chaos smear), uBeam (gold beam),
 * uGrid (blueprint grid strength), uGlow (emissive level).
 */

export const COMPASS_VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const COMPASS_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2  uRes;
uniform sampler2D uTex;
uniform vec2  uCenter;   // compass center, px (from bottom-left)
uniform float uRadius;   // compass radius, px
uniform mat3  uModel;    // local -> world
uniform mat3  uModelT;   // world -> local
uniform int   uSteps;    // march budget (quality ladder, no recompiles)
uniform float uNeedle;   // needle angle, radians (local)
uniform float uTrail;    // 0 locked .. 1 chaos smear
uniform float uBeam;     // gold beam opacity
uniform float uGrid;     // blueprint grid strength
uniform float uGlow;     // emissive multiplier
uniform vec3  uBeamO;    // beam origin (object units)
uniform vec3  uBeamD;    // beam direction (unit)

const float CAM_DIST = 4.0;
const float FACE_R   = 0.86;
const float FACE_TOP = -0.047;
const float NEEDLE_Z = -0.027;
const float NEEDLE_L = 0.66;
const vec3  CYAN     = vec3(0.0, 0.831, 1.0);
const vec3  CYAN_HI  = vec3(0.62, 0.93, 1.0);
const vec3  GOLD     = vec3(1.0, 0.78, 0.36);
const vec3  L_DIR    = normalize(vec3(-0.5, 0.75, 0.45)); // key light, world

/* ------------------------------ helpers ------------------------------ */

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec2 rot2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdRoundedCyl(vec3 p, float ra, float rb, float h) {
  vec2 d = vec2(length(p.xy) - ra + rb, abs(p.z) - h + rb);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0))) - rb;
}
float sdRoundedBox2D(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
}

/* distance only — kept slim: this runs uSteps times per marched pixel */
float map(vec3 p) {
  float r = length(p.xy);
  float body = sdRoundedCyl(p - vec3(0.0, 0.0, -0.16), 0.965, 0.07, 0.24);
  float plug = max(r - FACE_R, -(p.z + 0.05));
  body = max(body, -plug);
  float rim = sdRoundedBox2D(vec2(r - 0.935, p.z - 0.03), vec2(0.065, 0.055), 0.03);
  float face = sdRoundedCyl(p - vec3(0.0, 0.0, -0.075), FACE_R, 0.01, 0.028);
  float cap = min(
    sdRoundedCyl(p - vec3(0.0, 0.0, -0.01), 0.075, 0.02, 0.035),
    sdRoundedCyl(p - vec3(0.0, 0.0, -0.038), 0.12, 0.012, 0.016));
  return min(min(body, rim), min(face, cap));
}

/* material at a known hit point (1 metal, 2 face, 3 cap) — runs once */
float matAt(vec3 p) {
  float r = length(p.xy);
  float body = sdRoundedCyl(p - vec3(0.0, 0.0, -0.16), 0.965, 0.07, 0.24);
  body = max(body, -max(r - FACE_R, -(p.z + 0.05)));
  float rim = sdRoundedBox2D(vec2(r - 0.935, p.z - 0.03), vec2(0.065, 0.055), 0.03);
  float metal = min(body, rim);
  float face = sdRoundedCyl(p - vec3(0.0, 0.0, -0.075), FACE_R, 0.01, 0.028);
  float cap = min(
    sdRoundedCyl(p - vec3(0.0, 0.0, -0.01), 0.075, 0.02, 0.035),
    sdRoundedCyl(p - vec3(0.0, 0.0, -0.038), 0.12, 0.012, 0.016));
  if (cap < metal && cap < face) return 3.0;
  if (face < metal) return 2.0;
  return 1.0;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

/* Fake studio environment — one hot cool band upper-left, faint warm floor */
vec3 envColor(vec3 d) {
  vec3 c = vec3(0.012, 0.02, 0.038);
  float b1 = max(dot(d, normalize(vec3(-0.45, 0.8, 0.3))), 0.0);
  c += vec3(0.55, 0.7, 0.88) * pow(b1, 3.0) * 0.8;
  c += vec3(0.9, 0.96, 1.0) * pow(b1, 14.0) * 1.1;
  float b2 = max(dot(d, normalize(vec3(0.55, -0.6, 0.15))), 0.0);
  c += vec3(0.22, 0.19, 0.17) * pow(b2, 6.0) * 0.15;
  return c;
}

/* Ray / sphere, nearest positive t or -1 */
float raySphere(vec3 ro, vec3 rd, vec3 ce, float ra) {
  vec3 oc = ro - ce;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - ra * ra;
  float h = b * b - c;
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}
/* Both intersections (march bounds) */
vec2 raySphere2(vec3 ro, vec3 rd, vec3 ce, float ra) {
  vec3 oc = ro - ce;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - ra * ra;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

/* soft outer glow around the needle blades (dial-plane space) */
float bladeGlowShape(vec2 q) {
  float inSeg = smoothstep(NEEDLE_L + 0.08, NEEDLE_L - 0.1, abs(q.x));
  float d = abs(q.y);
  float g = exp(-d * d * 150.0) * 0.85 + exp(-d * d * 20.0) * 0.32;
  float side = q.x > 0.0 ? 1.0 : 0.6;
  return g * inSeg * side;
}

/* hard, AA'd needle silhouette — the tapered double blade */
float needleSolid(vec2 q) {
  float x = abs(q.x);
  float t = clamp(x / NEEDLE_L, 0.0, 1.0);
  float hw = mix(0.046, 0.005, t);
  float sd = max(abs(q.y) - hw, x - NEEDLE_L);
  return 1.0 - smoothstep(-0.005, 0.005, sd);
}

/* ------------------------------ shading ------------------------------ */

vec3 shadeMetal(vec3 p, vec3 n, vec3 v, vec3 l, float lighter) {
  vec3 base = vec3(0.040, 0.052, 0.078) * (1.0 + lighter * 1.1);

  /* brushed circularly: kill the tangential component of the halfway vector */
  vec3 tang = normalize(vec3(-p.y, p.x, 0.001));
  vec3 h = normalize(l + v);
  vec3 hp = normalize(h - tang * dot(h, tang) * 0.88);
  float ndh = max(dot(n, hp), 0.0);
  float ang = atan(p.y, p.x);
  float grain = 0.72 + 0.55 * hash12(vec2(floor(ang * 260.0), floor(p.z * 90.0)));
  float spec = (pow(ndh, 46.0) * 0.9 + pow(ndh, 8.0) * 0.15) * grain;

  float diff = max(dot(n, l), 0.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 env = envColor(uModel * reflect(-v, n));

  vec3 col = base * (0.35 + 0.85 * diff);
  col += spec * vec3(0.82, 0.90, 1.0);
  col += env * (0.10 + fres * 0.6);
  col += fres * vec3(0.5, 0.72, 0.95) * 0.22 * (0.25 + 0.75 * diff);
  return col;
}

vec3 shadeFace(vec2 pxy, float glow) {
  /* flipY texture upload: +y local maps to canvas top */
  vec2 uv = pxy / FACE_R * 0.5 + 0.5;
  vec3 tex = texture(uTex, uv).rgb;
  vec3 col = tex * (0.75 + glow * 1.05);
  /* inner-rim contact shadow */
  col *= 1.0 - 0.35 * smoothstep(0.68, FACE_R, length(pxy));
  return col;
}

/* --------------------------- background ------------------------------ */

/* analytic AA */
float gridLines(vec2 gp, float aa) {
  vec2 dl = vec2(0.5) - abs(fract(gp) - 0.5); /* distance to nearest line */
  vec2 l = vec2(1.0) - smoothstep(vec2(0.0), vec2(aa), dl);
  return max(l.x, l.y);
}

vec3 background(vec2 uv, vec2 psC, float aspect) {
  /* navy wash — light source upper-left, settles toward page navy below */
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 c = mix(vec3(0.020, 0.045, 0.094), vec3(0.048, 0.082, 0.152),
               clamp(uv.y * 0.9 + 0.1 - q.x * 0.18, 0.0, 1.0));

  /* halo behind the compass */
  c += vec3(0.035, 0.09, 0.16) * exp(-dot(psC, psC) * 2.1) * 0.55;

  /* blueprint grid — coarse + fine, slightly rotated, pseudo-receding */
  if (uGrid > 0.003) {
    vec2 gp = rot2(q - vec2(-0.15, -0.1), -0.09);
    float persp = 1.0 + gp.y * 0.3;
    float scale = 3.4 * persp;
    gp *= scale;
    float px = scale / uRes.y; /* grid units per pixel */
    float coarse = gridLines(gp, px * 1.6);
    float fine = gridLines(gp * 5.0, px * 5.0 * 1.6) * (1.0 - smoothstep(4.0, 5.2, scale));

    float mask = (0.62 + 0.38 * smoothstep(0.9, -0.4, q.x)) *
                 smoothstep(-0.75, -0.05, q.y) *
                 (0.35 + 0.65 * smoothstep(0.0, 0.75, length(psC)));
    c += CYAN * (coarse * 0.16 + fine * 0.05) * uGrid * mask;
  }

  /* sparse star specks */
  vec2 sp = q * 9.0 + 3.7;
  vec2 id = floor(sp);
  float h = hash12(id);
  if (h > 0.978) {
    vec2 pt = fract(sp) - vec2(hash12(id + 1.3), hash12(id + 2.7));
    float star = exp(-dot(pt, pt) * 520.0);
    c += vec3(0.5, 0.62, 0.75) * star * 0.5 * (0.4 + 0.6 * hash12(id + 4.1));
  }

  /* the small grey four-point sparkle, bottom-right */
  vec2 sd = (uv - vec2(0.945, 0.16)) * vec2(aspect, 1.0);
  float s4 = exp(-abs(sd.x) * 320.0) * exp(-abs(sd.y) * 42.0) +
             exp(-abs(sd.y) * 320.0) * exp(-abs(sd.x) * 42.0);
  c += vec3(0.62, 0.66, 0.72) * min(s4, 1.0) * 0.5;

  /* vignette */
  c *= 1.0 - 0.32 * smoothstep(0.45, 1.15, length(q));
  return c;
}

/* ------------------------------- main -------------------------------- */

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 frag = vUv * uRes;

  /* compass-centered coords in viewport-height units */
  vec2 ps = (frag - uCenter) / uRes.y;
  float rho = uRadius / uRes.y;

  vec3 col = background(vUv, ps / max(rho, 1e-4) * 0.5, aspect);

  /* camera ray (object space: compass radius 1 at origin) */
  vec3 ro = vec3(0.0, 0.0, CAM_DIST);
  vec3 rd = normalize(vec3(ps.x, ps.y, -CAM_DIST * rho));

  /* ----- compass: bounding-sphere gate ----- */
  vec2 bound = raySphere2(ro, rd, vec3(0.0), 1.22);
  float tHit = -1.0;
  float mat = 0.0;
  vec3 pL = vec3(0.0);

  vec3 roL = uModelT * ro;
  vec3 rdL = uModelT * rd;

  /* glass dome: analytic sphere, valid over the face area only */
  float glassF = 0.0;
  vec3 glassRefl = vec3(0.0);
  vec3 marchO = roL;
  vec3 marchD = rdL;
  float tGlass = -1.0;

  if (bound.y > 0.0) {
    vec3 cG = vec3(0.0, 0.0, -5.77);
    float tG = raySphere(roL, rdL, cG, 5.855);
    if (tG > 0.0) {
      vec3 pG = roL + rdL * tG;
      if (pG.z > 0.012 && length(pG.xy) < 0.895) {
        vec3 nG = normalize(pG - cG);
        float F = 0.035 + 0.965 * pow(1.0 - max(dot(nG, -rdL), 0.0), 5.0);
        glassF = min(F * 1.25, 1.0);
        glassRefl = envColor(uModel * reflect(rdL, nG)) * (glassF * 2.4 + 0.02);
        tGlass = tG;
        vec3 rf = refract(rdL, nG, 0.9);
        marchD = dot(rf, rf) > 0.0 ? rf : rdL;
        marchO = pG + marchD * 0.002;
      }
    }

    /* fast path: the dial is a plane — no marching where the ray lands
       clear of the rim annulus and the center cap */
    bool resolved = false;
    if (marchD.z < -1e-4) {
      float tF = (FACE_TOP - marchO.z) / marchD.z;
      if (tF > 0.0) {
        vec2 f2 = (marchO + marchD * tF).xy;
        float r2 = length(f2);
        if (r2 < 0.80 && r2 > 0.16) {
          tHit = tF;
          mat = 2.0;
          pL = vec3(f2, FACE_TOP);
          resolved = true;
        }
      }
    }

    /* march only the rim/body annulus and cap region */
    if (!resolved) {
      float t = tGlass > 0.0 ? 0.0 : max(bound.x, 0.0);
      float tMax = bound.y - max(tGlass, 0.0) + 0.4;
      for (int i = 0; i < uSteps; i++) {
        vec3 pp = marchO + marchD * t;
        float d = map(pp);
        if (d < 0.0018 * (1.0 + t)) {
          tHit = t;
          pL = pp;
          mat = matAt(pp);
          break;
        }
        t += d;
        if (t > tMax) break;
      }
    }
  }

  float flicker = 1.0 - uTrail * (0.25 + 0.30 * hash12(vec2(floor(uTime * 23.0), 2.0)));

  if (tHit > 0.0) {
    if (mat == 2.0) {
      col = shadeFace(pL.xy, uGlow);
    } else {
      vec3 n = calcNormal(pL);
      col = shadeMetal(pL, n, -marchD, uModelT * L_DIR, mat == 3.0 ? 1.0 : 0.0);
    }
  }

  /* ----- the needle: analytic solid + glow on the dial plane ----- */
  if (bound.y > 0.0 && marchD.z < -1e-4) {
    float tP = (NEEDLE_Z - marchO.z) / marchD.z;
    if (tP > 0.0) {
      vec2 p2 = (marchO + marchD * tP).xy;
      if (length(p2) < 0.86) {
        /* occlusion: the face (behind the needle) draws it fully; metal rim
           or cap hit in front of the plane hides the solid, dims the glow */
        bool inFront = tHit > 0.0 && tHit < tP - 0.01 && mat != 2.0;
        vec2 q0 = rot2(p2, -uNeedle);

        float g = bladeGlowShape(q0);
        if (uTrail > 0.01) {
          g += bladeGlowShape(rot2(p2, -(uNeedle - 0.38))) * 0.55 * uTrail;
          g += bladeGlowShape(rot2(p2, -(uNeedle - 0.85))) * 0.28 * uTrail;
          g += bladeGlowShape(rot2(p2, -(uNeedle - 1.45))) * 0.12 * uTrail;
        }

        if (!inFront) {
          float solid = needleSolid(q0);
          float bt = clamp(abs(q0.x) / NEEDLE_L, 0.0, 1.0);
          vec3 nCol = mix(CYAN_HI, CYAN, bt * 0.8) *
                      (q0.x > 0.0 ? 2.2 : 1.35) * flicker * uGlow;
          col = mix(col, nCol, solid);
        }
        col += CYAN * g * uGlow * flicker * (inFront ? 0.2 : 1.0);
      }
    }
  }

  /* glass reflection layer */
  if (tGlass > 0.0) {
    col = col * (1.0 - glassF * 0.6) + glassRefl;
  }

  /* ----- the gold beam — always composited on top ----- */
  if (uBeam > 0.003) {
    vec3 w0 = ro - uBeamO;
    float b = dot(rd, uBeamD);
    float d0 = dot(rd, w0);
    float e = dot(uBeamD, w0);
    float denom = max(1.0 - b * b, 1e-4);
    float s = clamp((e * b - d0) * b / denom + e, 0.03, 5.0);
    float tv = max(s * b - d0, 0.0);
    vec3 w = w0 + rd * tv - uBeamD * s;
    float dd = dot(w, w);
    float core = exp(-dd * 9000.0) * 1.3 + exp(-dd * 700.0) * 0.26 +
                 exp(-dd * 60.0) * 0.05;
    float fs = smoothstep(0.02, 0.2, s) * (1.0 - s * 0.055);
    vec3 toO = uBeamO - ro;
    float db = length(cross(rd, toO));
    float flare = exp(-db * db * 34.0) * 0.55;
    col += GOLD * (core * fs + flare) * uBeam;
  }

  /* dither against banding */
  col += (hash12(frag + fract(uTime)) - 0.5) * 0.012;

  fragColor = vec4(col, 1.0);
}
`;
