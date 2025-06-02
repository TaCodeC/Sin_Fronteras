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
    this.animationId = null; // Track animation frame
    
    // Uniform locations
    this.timeLocation = null;
    this.resolutionLocation = null;
    this.colorLocation = null;

    this.u_net_migrationLocation = null;
    this.u_percent_changeLocation = null;
    this.u_migration_trendLocation = null;
    this.u_population_ratioLocation = null;
    this.u_has_dataLocation = null;

    // Current shader uniforms
    this.uniforms = {
      u_net_migration: 0.0,
      u_percent_change: 0.0,
      u_migration_trend: 0.5, 
      u_population_ratio: 0.0,
      u_has_data: 0.0,
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

    this.u_net_migrationLocation = this.gl.getUniformLocation(this.program, "u_net_migration");
    this.u_percent_changeLocation = this.gl.getUniformLocation(this.program, "u_percent_change");
    this.u_migration_trendLocation = this.gl.getUniformLocation(this.program, "u_migration_trend");
    this.u_population_ratioLocation = this.gl.getUniformLocation(this.program, "u_population_ratio");
    this.u_has_dataLocation = this.gl.getUniformLocation(this.program, "u_has_data");
    
    this.setInitialUniforms();
  }
  
  startAnimation() {
    // Cancel any existing animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.startTime = Date.now();
    this.animate();
  }
  
  setInitialUniforms() {
    if (!this.program || !this.gl) return;
    
    this.gl.useProgram(this.program);
    
    if (this.colorLocation) {
      this.gl.uniform3fv(this.colorLocation, this.uniforms.color);
    }
    if (this.u_net_migrationLocation) {
      this.gl.uniform1f(this.u_net_migrationLocation, this.uniforms.u_net_migration);
    }
    if (this.u_percent_changeLocation) {
      this.gl.uniform1f(this.u_percent_changeLocation, this.uniforms.u_percent_change);
    }
    if (this.u_migration_trendLocation) {
      this.gl.uniform1f(this.u_migration_trendLocation, this.uniforms.u_migration_trend);
    }
    if (this.u_population_ratioLocation) {
      this.gl.uniform1f(this.u_population_ratioLocation, this.uniforms.u_population_ratio);
    }
    if (this.u_has_dataLocation) {
      this.gl.uniform1f(this.u_has_dataLocation, this.uniforms.u_has_data);
    }
  }
  
  animate() {
    if (!this.isVisible || !this.program) {
      this.animationId = null;
      return;
    }
    
    const currentTime = (Date.now() - this.startTime) / 1000.0;
    
    this.gl.useProgram(this.program);
    
    // Set time-based uniforms
    if (this.timeLocation) {
      this.gl.uniform1f(this.timeLocation, currentTime);
    }
    
    if (this.resolutionLocation) {
      this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    }
    
    // Clear and draw
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Continue animation loop
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  // Method to update shader uniforms
  updateUniforms(newUniforms) {
    // Update local uniforms object
    Object.assign(this.uniforms, newUniforms);
    
    // Immediately update GPU uniforms
    if (this.program && this.gl) {
      this.gl.useProgram(this.program);
      
      // Only update uniforms that have changed
      if (newUniforms.u_net_migration !== undefined && this.u_net_migrationLocation) {
        this.gl.uniform1f(this.u_net_migrationLocation, newUniforms.u_net_migration);
      }
      if (newUniforms.u_percent_change !== undefined && this.u_percent_changeLocation) {
        this.gl.uniform1f(this.u_percent_changeLocation, newUniforms.u_percent_change);
      }
      if (newUniforms.u_migration_trend !== undefined && this.u_migration_trendLocation) {
        this.gl.uniform1f(this.u_migration_trendLocation, newUniforms.u_migration_trend);
      }
      if (newUniforms.u_population_ratio !== undefined && this.u_population_ratioLocation) {
        this.gl.uniform1f(this.u_population_ratioLocation, newUniforms.u_population_ratio);
      }
      if (newUniforms.u_has_data !== undefined && this.u_has_dataLocation) {
        this.gl.uniform1f(this.u_has_dataLocation, newUniforms.u_has_data);
      }
    }
    
    console.log("Updated uniforms:", this.uniforms);
  }
  
  hide() {
    this.hudElement.style.display = "none";
    this.isVisible = false;
    
    // Stop animation
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