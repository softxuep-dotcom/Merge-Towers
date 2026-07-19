#version 100
#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;
uniform float uProgress;
uniform float uAlpha;
uniform float uTime;
uniform float uUltimate;
uniform vec3 uColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float softRing(float d, float radius, float width) {
  return 1.0 - smoothstep(width, width * 2.4, abs(d - radius));
}

void main() {
  vec2 uv = outTexCoord - 0.5;
  uv.x *= 1.0 + 0.08 * uUltimate;
  float d = length(uv);
  float angle = atan(uv.y, uv.x);
  float noise = hash(floor((uv + uTime * 0.03) * 90.0));

  float radius = mix(0.03, 0.63, uProgress);
  float ring = softRing(d, radius, mix(0.022, 0.008, uProgress));
  float inner = softRing(d, radius * 0.62, 0.012) * (1.0 - uProgress);
  float spokes = pow(max(0.0, cos(angle * (6.0 + 4.0 * uUltimate) + uTime * 4.0)), 18.0);
  spokes *= smoothstep(radius + 0.14, radius - 0.08, d) * smoothstep(0.02, 0.16, d);
  float core = exp(-d * 15.0) * (1.0 - uProgress);
  float grain = noise * ring * 0.38;
  float energy = ring + inner * 0.6 + spokes * (0.45 + 0.55 * uUltimate) + core * 0.8 + grain;
  float alpha = clamp(energy * uAlpha, 0.0, 0.92);
  vec3 hot = mix(uColor, vec3(1.0, 0.96, 0.78), clamp(ring + core, 0.0, 1.0));
  gl_FragColor = vec4(hot * alpha, alpha);
}
