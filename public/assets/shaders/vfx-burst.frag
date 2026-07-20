#version 100
#pragma phaserTemplate(shaderName)

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform vec4 uColorA;
uniform vec4 uColorB;
uniform float uOpacity;
uniform float uVariant;
uniform sampler2D uNoise;
varying vec2 outTexCoord;

float noise2(vec2 uv) { return texture2D(uNoise, fract(uv)).r; }

void main() {
  vec2 uv = outTexCoord;
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = clamp(uProgress, 0.0, 1.0);
  float enter = smoothstep(0.0, 0.08, t);
  float exitFade = 1.0 - smoothstep(0.56, 1.0, t);
  float n = noise2(uv * 4.0 + uDirection * uTime * 0.035);
  float rays = pow(max(0.0, 0.5 + 0.5 * sin(a * 10.0 + n * 5.0)), 5.0);
  float ringRadius = mix(0.08, 0.92, pow(t, 0.62));
  float ring = exp(-abs(r - ringRadius) * mix(42.0, 18.0, t));
  float core = exp(-r * mix(12.0, 4.0, t));
  float energy = 0.0;

  if (uVariant < 0.5) {
    float flame = max(0.0, 1.0 - r / max(0.05, ringRadius)) * (0.45 + rays * 1.3);
    energy = ring * 0.8 + flame * exitFade + core * (1.0 - t) * 1.8;
  } else if (uVariant < 1.5) {
    float spikes = pow(abs(cos(a * 6.0 + n * 1.8)), 18.0) * smoothstep(0.08, 0.9, r);
    energy = ring * 1.2 + spikes * smoothstep(ringRadius + 0.16, ringRadius - 0.24, r) + core * 0.7;
  } else if (uVariant < 2.5) {
    float blobs = smoothstep(0.25, 0.85, n + 0.35 * sin(a * 5.0 - uTime * 2.0));
    energy = ring * 0.55 + blobs * smoothstep(ringRadius, 0.05, r) * 0.85 + core * 0.65;
  } else if (uVariant < 3.5) {
    float halo = exp(-abs(r - ringRadius * 0.76) * 28.0);
    float cross = exp(-abs(p.x) * 28.0) + exp(-abs(p.y) * 28.0);
    energy = halo + cross * smoothstep(0.8, 0.12, r) * (1.0 - t) + core;
  } else if (uVariant < 4.5) {
    float petals = pow(max(0.0, cos(a * 8.0 + uTime * 4.0)), 8.0);
    energy = ring + petals * smoothstep(ringRadius + 0.12, ringRadius - 0.26, r) + core * 1.25;
  } else {
    float fracture = pow(abs(sin(a * 13.0 + n * 3.0)), 14.0) * smoothstep(0.95, 0.08, r);
    energy = ring * 1.35 + fracture * 1.1 + core * 1.8;
  }

  float mixValue = clamp(n * 0.7 + core * 0.55 + ring * 0.35, 0.0, 1.0);
  vec4 color = mix(uColorA, uColorB, mixValue);
  color.a *= energy * enter * exitFade * uOpacity * uIntensity;
  color.rgb *= color.a;
  gl_FragColor = color;
}
