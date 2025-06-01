import { VERTEX_SHADER, FRAGMENT_SHADER } from '../shaders/shaders.js';

class CountryHUD {
  constructor() {
    this.hudElement = document.getElementById("country-hud");
    this.countryNameElement = document.getElementById("country-name");
    this.canvas = document.getElementById("Foreign-Status");
    this.gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
    this.currentCountry = null;
    this.isVisible = false;
    
    // Shader properties
    this.program = null;
    this.startTime = Date.now();
    
    // Uniform locations
    this.timeLocation = null;
    this.resolutionLocation = null;
    this.colorLocation = null;
    
    // Current shader uniforms
    this.uniforms = {
      color: [0.2, 0.8, 1.0]
    };
    
    this.init();
  }
  
  init() {
    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }
    
    this.setupCanvas();
    this.setupShaders();
  }
  
  setCountry(country) {
    if (this.currentCountry !== country) {
      this.currentCountry = country;
      this.countryNameElement.textContent = country;
      this.hudElement.style.display = "block";
      this.isVisible = true;
      this.pulse();
      this.startAnimation();
    }
  }
  
  pulse() {
    this.hudElement.classList.add("pulse");
    setTimeout(() => {
      this.hudElement.classList.remove("pulse");
    }, 600);
  }
  
  setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = 75 * dpr;
    this.canvas.height = 75 * dpr;
    this.canvas.style.width = '75px';
    this.canvas.style.height = '75px';
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  
  setupShaders() {
    this.compileShader();
  }
  
  compileShader() {
    if (!this.gl) return;
    
    // Compile vertex shader
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    if (!vertexShader) return;
    
    // Compile fragment shader
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!fragmentShader) return;
    
    // Create program
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Setup buffers and uniforms
    this.setupBuffers();
    this.getUniformLocations();
  }
  
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  setupBuffers() {
    // Create full-screen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    
    // Setup position attribute
    const positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
  }
  
  getUniformLocations() {
    this.gl.useProgram(this.program);
    this.timeLocation = this.gl.getUniformLocation(this.program, "u_time");
    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
    this.colorLocation = this.gl.getUniformLocation(this.program, "u_color");
  }
  
  startAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.startTime = Date.now();
    this.animate();
  }
  
  animate() {
    if (!this.isVisible || !this.program) {
      return;
    }
    
    const currentTime = (Date.now() - this.startTime) / 1000.0;
    
    this.gl.useProgram(this.program);
    
    // Set all uniforms
    if (this.timeLocation) {
      this.gl.uniform1f(this.timeLocation, currentTime);
    }
    
    if (this.resolutionLocation) {
      this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    }
    
    if (this.colorLocation) {
      this.gl.uniform3fv(this.colorLocation, this.uniforms.color);
    }
    
    
    // Clear and draw
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
  }
  
  // Method to update shader uniforms
  updateUniforms(newUniforms) {
    Object.assign(this.uniforms, newUniforms);
  }
  
  hide() {
    this.hudElement.style.display = "none";
    this.isVisible = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  // Cleanup method
  destroy() {
    this.hide();
    
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
    
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
    }
  }
}

export default CountryHUD;