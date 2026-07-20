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
  float n0 = noise2(uv * 3.2 + uDirection * uTime * 0.035);
  float n1 = noise2(uv.yx * 6.1 - uDirection.yx * uTime * 0.055);
  float edge = smoothstep(1.0, 0.72 + n0 * 0.13, r);
  float pulse = 0.82 + 0.18 * sin(uTime * 4.0 + n1 * 6.2831);
  float energy;

  if (uVariant < 0.5) {
    float cracks = pow(max(0.0, sin((atan(p.y, p.x) + n1 * 0.4) * 8.0)), 12.0);
    float hot = smoothstep(0.82, 0.18, r) * (0.32 + cracks * 0.7 + n0 * 0.32);
    energy = edge * hot * pulse;
  } else if (uVariant < 1.5) {
    float bubbles = smoothstep(0.67, 0.96, sin((uv.x + n0) * 29.0 + uTime * 1.7) * 0.5 + 0.5);
    float liquid = 0.26 + n0 * 0.42 + bubbles * n1 * 0.36;
    energy = edge * liquid * pulse;
  } else if (uVariant < 2.5) {
    float angle = atan(p.y, p.x);
    float rings = pow(max(0.0, sin(r * 34.0 - uTime * 7.0 + n0 * 4.0)), 12.0);
    float arcs = pow(max(0.0, sin(angle * 7.0 + uTime * 5.0 + n1 * 6.0)), 18.0);
    float eye = smoothstep(0.3, 0.12, r) * (0.35 + n0 * 0.4);
    energy = edge * (0.12 + rings * 0.56 + arcs * smoothstep(0.94, 0.22, r) * 0.66 + eye) * pulse;
  } else {
    float angle = atan(p.y, p.x);
    float halo = exp(-abs(r - 0.72 - sin(uTime * 2.0) * 0.035) * 24.0);
    float inner = exp(-abs(r - 0.42) * 32.0);
    float rays = pow(max(0.0, cos(angle * 12.0 - uTime * 0.7 + n1)), 22.0);
    energy = edge * (halo * 0.82 + inner * 0.38 + rays * smoothstep(0.92, 0.16, r) * 0.48 + n0 * 0.12) * pulse;
  }

  float life = 0.78 + 0.22 * sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);
  vec4 color = mix(uColorA, uColorB, clamp(n0 * 0.78 + energy * 0.4, 0.0, 1.0));
  color.a *= energy * life * uOpacity * uIntensity;
  color.rgb *= color.a;
  gl_FragColor = color;
}
