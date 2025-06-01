export const VERTEX_SHADER = `
  precision mediump float;
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;  
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    gl_FragColor = vec4(u_color, 0.8);
  }
`;