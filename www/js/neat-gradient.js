/**
 * Neat 3D Animated Fluid Wave Gradient (WebGL)
 * Inspired by https://neat.firecms.co/
 * Customized for MCGI Production Monitoring System
 * Colors: Deep Sapphire Blue, Pure Crisp White, Vibrant Royal Blue, and Soft Ice White
 */

class NeatGradientController {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('loginNeatCanvas');
    if (!this.canvas) return;

    this.colors = options.colors || [
      '#ffffff', // Pure Crisp White Base
      '#f0f7ff', // Luminous Light Sky Blue
      '#3b82f6', // Clean Vibrant Azure/Blue Accent
      '#dbeafe', // Gentle Pastel Ice Blue
      '#ffffff'  // Radiant White Crest Accent
    ];
    this.speed = options.speed || 0.0018;
    this.waveAmplitude = options.waveAmplitude || 0.65;
    this.isRunning = false;
    this.animationFrameId = null;
    this.time = 0;

    this.init();
  }

  init() {
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (this.gl) {
      this.initWebGL();
    } else {
      this.init2DFallback();
    }

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.resize();
  }

  hexToRgb(hex) {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255
    ];
  }

  initWebGL() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color0;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_color4;
      uniform float u_amplitude;

      // Simplex 2D noise generator
      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = vec2(uv.x * aspect, uv.y);

        // Fluid 3D wave motion
        float t = u_time * 0.45;
        
        float n1 = snoise(p * 1.3 + vec2(t * 0.25, -t * 0.18));
        float n2 = snoise(p * 2.2 - vec2(-t * 0.22, t * 0.35) + vec2(n1 * u_amplitude));
        float n3 = snoise(p * 3.5 + vec2(t * 0.15, t * 0.12) - vec2(n2 * u_amplitude * 0.5));

        float wave = sin((uv.x + uv.y) * 3.0 + t + n1 * 1.8) * 0.5 + 0.5;
        float blend1 = clamp(n1 * 0.5 + 0.5 + wave * 0.35, 0.0, 1.0);
        float blend2 = clamp(n2 * 0.5 + 0.5, 0.0, 1.0);
        float blend3 = clamp(n3 * 0.5 + 0.5, 0.0, 1.0);

        // Multi-color fluid blending across palette (dominant white & light blue, subtle blue wave accents)
        vec3 col = mix(u_color0, u_color1, blend1);
        col = mix(col, u_color2, blend2 * 0.32);
        col = mix(col, u_color3, blend3 * 0.40);
        
        // Radiant crest highlights
        float crestHighlight = smoothstep(0.68, 0.98, n2 * 0.5 + 0.5);
        col = mix(col, u_color4, crestHighlight * 0.75);

        // Pristine bright ambient falloff: keeps canvas luminous and clean across the entire viewport
        float vignette = smoothstep(1.4, 0.35, length(uv - 0.5));
        col *= vignette * 0.08 + 0.92;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.warn('Neat WebGL link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
    this.timeLocation = gl.getUniformLocation(this.program, 'u_time');
    this.resLocation = gl.getUniformLocation(this.program, 'u_resolution');
    this.ampLocation = gl.getUniformLocation(this.program, 'u_amplitude');

    this.colorLocations = [
      gl.getUniformLocation(this.program, 'u_color0'),
      gl.getUniformLocation(this.program, 'u_color1'),
      gl.getUniformLocation(this.program, 'u_color2'),
      gl.getUniformLocation(this.program, 'u_color3'),
      gl.getUniformLocation(this.program, 'u_color4')
    ];
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Neat shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  init2DFallback() {
    this.ctx = this.canvas.getContext('2d');
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 400);

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  animate() {
    if (!this.isRunning) return;

    this.time += this.speed * 16.6;

    if (this.gl && this.program) {
      const gl = this.gl;
      gl.useProgram(this.program);

      gl.enableVertexAttribArray(this.positionLocation);
      gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(this.timeLocation, this.time);
      gl.uniform2f(this.resLocation, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.ampLocation, this.waveAmplitude);

      this.colors.forEach((hex, i) => {
        if (this.colorLocations[i]) {
          const rgb = this.hexToRgb(hex);
          gl.uniform3f(this.colorLocations[i], rgb[0], rgb[1], rgb[2]);
        }
      });

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (this.ctx) {
      this.render2D();
    }

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  setColors(newColors) {
    if (Array.isArray(newColors) && newColors.length) {
      this.colors = [...newColors];
      while (this.colors.length < 5) {
        this.colors.push(this.colors[this.colors.length - 1]);
      }
    }
  }

  render2D() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.time;
    const c0 = this.colors[0] || '#050508';
    const c2 = this.colors[2] || '#f59e0b';
    const c3 = this.colors[3] || '#b45309';

    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, w, h);

    const grad1 = ctx.createRadialGradient(
      w * 0.3 + Math.sin(t * 0.3) * w * 0.2,
      h * 0.4 + Math.cos(t * 0.25) * h * 0.2,
      20,
      w * 0.3,
      h * 0.4,
      w * 0.6
    );
    grad1.addColorStop(0, c2);
    grad1.addColorStop(1, 'transparent');

    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);

    const grad2 = ctx.createRadialGradient(
      w * 0.7 + Math.cos(t * 0.35) * w * 0.2,
      h * 0.6 + Math.sin(t * 0.4) * h * 0.2,
      10,
      w * 0.7,
      h * 0.6,
      w * 0.5
    );
    grad2.addColorStop(0, c3);
    grad2.addColorStop(1, 'transparent');

    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
  }
}

window.NeatGradientController = NeatGradientController;
