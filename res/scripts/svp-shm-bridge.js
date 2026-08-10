
const createSvpShmBridge = () => {
  const fs = require('node:fs');
  const path = require('node:path');
  let addon;
  let addonError = '';
  let playback;

  const loadAddon = () => {
    if (addon || addonError) return addon;
    if (process.platform !== 'linux') {
      addonError = 'POSIX shared memory is only available on Linux';
      return undefined;
    }
    const fileName = `svp-shm-linux-${process.arch}.node`;
    const candidates = [...new Set([
      path.resolve(__dirname, `../../svp-shm-linux-${process.arch}.node`),
      typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, 'extensions', 'bilibili', fileName) : '',
      typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, 'app.asar.unpacked', fileName) : '',
      typeof process.execPath === 'string' ? path.join(path.dirname(process.execPath), 'resources', 'extensions', 'bilibili', fileName) : '',
      process.env.APPDIR ? path.join(process.env.APPDIR, 'resources', 'extensions', 'bilibili', fileName) : '',
      path.resolve(process.cwd(), 'native/svp-shm/build/Release/svp_shm.node'),
    ].filter(Boolean))];
    const failures = [];
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) {
          failures.push(`${candidate}: missing`);
          continue;
        }
        const loaded = require(candidate);
        if (typeof loaded.openRing === 'function' && typeof loaded.readFrameInto === 'function') {
          addon = loaded;
          return addon;
        }
        failures.push(`${candidate}: incompatible exports`);
      } catch (error) {
        failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    addonError = `svp-shm native module unavailable (${failures.join('; ')})`;
    return undefined;
  };

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL2 shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'WebGL2 shader compilation failed');
    }
    return shader;
  };

  const createRenderer = (canvas, width, height, pixelFormat) => {
    const tenBit = pixelFormat === 'I420P10LE';
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 is unavailable');
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL2 program allocation failed');
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texCoord;
out vec2 uv;
void main() {
  uv = texCoord;
  gl_Position = vec4(position, 0.0, 1.0);
}`));
    const fragment = tenBit ? `#version 300 es
precision highp float;
precision highp usampler2D;
in vec2 uv;
uniform usampler2D textureY;
uniform usampler2D textureU;
uniform usampler2D textureV;
out vec4 color;
float samplePlane(usampler2D plane, vec2 coord) {
  ivec2 size = textureSize(plane, 0);
  vec2 position = coord * vec2(size) - vec2(0.5);
  ivec2 base = ivec2(floor(position));
  vec2 weight = fract(position);
  ivec2 maximum = size - ivec2(1);
  float p00 = float(texelFetch(plane, clamp(base, ivec2(0), maximum), 0).r);
  float p10 = float(texelFetch(plane, clamp(base + ivec2(1, 0), ivec2(0), maximum), 0).r);
  float p01 = float(texelFetch(plane, clamp(base + ivec2(0, 1), ivec2(0), maximum), 0).r);
  float p11 = float(texelFetch(plane, clamp(base + ivec2(1, 1), ivec2(0), maximum), 0).r);
  return mix(mix(p00, p10, weight.x), mix(p01, p11, weight.x), weight.y);
}
void main() {
  // 10-bit limited BT.709 uses 64..940/64..960 code ranges. These are the
  // 10-bit equivalents of the 8-bit coefficients below.
  float y = 1.16780822 * (samplePlane(textureY, uv) / 1023.0 - 64.0 / 1023.0);
  float u = samplePlane(textureU, uv) / 1023.0 - 512.0 / 1023.0;
  float v = samplePlane(textureV, uv) / 1023.0 - 512.0 / 1023.0;
  vec3 rgb = vec3(y + 1.79801384 * v, y - 0.21387550 * u - 0.53447640 * v, y + 2.11861473 * u);
  color = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}` : `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D textureY;
uniform sampler2D textureU;
uniform sampler2D textureV;
out vec4 color;
void main() {
  float y = 1.16438356 * (texture(textureY, uv).r - 0.06274510);
  float u = texture(textureU, uv).r - 0.50196078;
  float v = texture(textureV, uv).r - 0.50196078;
  vec3 rgb = vec3(y + 1.79274107 * v, y - 0.21324861 * u - 0.53290933 * v, y + 2.11240179 * u);
  color = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}`;
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'WebGL2 program linking failed');
    }
    gl.useProgram(program);
    const vertexArray = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    if (!vertexArray || !vertexBuffer) throw new Error('WebGL2 vertex buffer allocation failed');
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    const textures = [];
    const createTexture = (unit, textureWidth, textureHeight) => {
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL2 texture allocation failed');
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tenBit ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tenBit ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, tenBit ? gl.R16UI : gl.R8, textureWidth, textureHeight);
    };
    createTexture(0, width, height);
    createTexture(1, width / 2, height / 2);
    createTexture(2, width / 2, height / 2);
    gl.uniform1i(gl.getUniformLocation(program, 'textureY'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'textureU'), 1);
    gl.uniform1i(gl.getUniformLocation(program, 'textureV'), 2);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.viewport(0, 0, width, height);
    const lumaSamples = width * height;
    const chromaSamples = lumaSamples / 4;
    return {
      backend: tenBit ? 'Shared memory/WebGL2 YUV10' : 'Shared memory/WebGL2 YUV',
      draw(data) {
        if (gl.isContextLost()) throw new Error('WebGL2 context was lost');
        const uploadFormat = tenBit ? gl.RED_INTEGER : gl.RED;
        const uploadType = tenBit ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE;
        const samples = tenBit
          ? new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2)
          : data;
        gl.activeTexture(gl.TEXTURE0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, uploadFormat, uploadType, samples, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, uploadFormat, uploadType, samples, lumaSamples);
        gl.activeTexture(gl.TEXTURE2);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, uploadFormat, uploadType, samples, lumaSamples + chromaSamples);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      release() {
        textures.forEach(texture => gl.deleteTexture(texture));
        gl.deleteBuffer(vertexBuffer);
        gl.deleteVertexArray(vertexArray);
        gl.deleteProgram(program);
      },
    };
  };

  const stop = () => {
    if (!playback) return;
    const current = playback;
    playback = undefined;
    if (current.animationFrame) cancelAnimationFrame(current.animationFrame);
    try { current.renderer.release(); } catch (_error) { /* already released */ }
    try { current.addon.closeRing(current.ring); } catch (_error) { /* already closed */ }
  };

  const start = async options => {
    stop();
    const loaded = loadAddon();
    if (!loaded) return { ok: false, error: addonError };
    const width = Number(options?.width);
    const height = Number(options?.height);
    const frameBytes = Number(options?.frameBytes);
    const capacity = Number(options?.capacity);
    const targetFps = Number(options?.targetFps);
    const startTime = Number(options?.startTime);
    const baseIndex = Number(options?.baseIndex || 0);
    const pixelFormat = options?.pixelFormat;
    if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(frameBytes)
      || !Number.isInteger(capacity) || !Number.isFinite(targetFps) || !Number.isFinite(startTime)
      || !Number.isSafeInteger(baseIndex) || baseIndex < 0
      || !['I420', 'I420P10LE'].includes(pixelFormat)) {
      return { ok: false, error: 'Invalid shared-memory playback parameters' };
    }
    const canvas = document.getElementById(String(options.canvasId || ''));
    const video = document.querySelector(`[data-bili-svp-source="${CSS.escape(String(options.sourceToken || ''))}"]`);
    if (!(canvas instanceof HTMLCanvasElement) || !(video instanceof HTMLVideoElement)) {
      return { ok: false, error: 'Shared-memory playback elements were not found' };
    }
    try {
      const ring = loaded.openRing(String(options.name || ''));
      const stats = loaded.getStats(ring);
      if (stats.frameBytes !== frameBytes || stats.capacity !== capacity) {
        loaded.closeRing(ring);
        throw new Error('Shared-memory header does not match the requested stream');
      }
      const renderer = createRenderer(canvas, width, height, pixelFormat);
      const alignedStartTime = baseIndex > 0 ? video.currentTime : startTime;
      const state = {
        addon: loaded,
        animationFrame: 0,
        backend: renderer.backend,
        baseIndex,
        capacity,
        copies: 0,
        copyMs: 0,
        drawMs: 0,
        drawn: 0,
        error: '',
        firstFrameAt: 0,
        frame: Buffer.allocUnsafe(frameBytes),
        frameBytes,
        lastAbsoluteDrawnIndex: baseIndex - 1,
        lastDrawnIndex: -1,
        name: options.name,
        renderer,
        ring,
        source: video,
        stalls: 0,
        startTime: alignedStartTime,
        startedAt: performance.now(),
        targetFps,
      };
      playback = state;
      const render = () => {
        if (playback !== state) return;
        try {
          const relative = Math.max(0, Math.floor((video.currentTime - state.startTime) * state.targetFps + 0.001));
          const desired = state.baseIndex + relative;
          if (desired > state.lastAbsoluteDrawnIndex) {
            const copyStarted = performance.now();
            const selected = loaded.readFrameInto(ring, desired, state.frame);
            state.copyMs += performance.now() - copyStarted;
            if (selected >= 0) {
              state.copies += 1;
              const drawStarted = performance.now();
              renderer.draw(state.frame);
              state.drawMs += performance.now() - drawStarted;
              state.drawn += 1;
              state.lastAbsoluteDrawnIndex = selected;
              state.lastDrawnIndex = selected - state.baseIndex;
              if (!state.firstFrameAt) state.firstFrameAt = performance.now();
            } else if (!video.paused) {
              state.stalls += 1;
            }
          }
          state.animationFrame = requestAnimationFrame(render);
        } catch (error) {
          state.error = error instanceof Error ? error.message : String(error);
        }
      };
      render();
      const deadline = performance.now() + 15000;
      while (!state.firstFrameAt && !state.error && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (state.error) throw new Error(state.error);
      if (!state.firstFrameAt) throw new Error('Shared-memory playback timed out waiting for a frame');
      return { backend: state.backend, ok: true, startTime: state.startTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stop();
      return { ok: false, error: message };
    }
  };

  const status = () => {
    if (!playback) return { available: Boolean(loadAddon()), error: addonError, running: false };
    const state = playback;
    let ringStats = {};
    try { ringStats = state.addon.getStats(state.ring); } catch (error) {
      state.error ||= error instanceof Error ? error.message : String(error);
    }
    return {
      ...ringStats,
      available: true,
      backend: state.backend,
      copies: state.copies,
      copyMs: state.copyMs,
      drawMs: state.drawMs,
      drawn: state.drawn,
      error: state.error,
      firstFrameMs: state.firstFrameAt ? state.firstFrameAt - state.startedAt : 0,
      lastDrawnIndex: state.lastDrawnIndex,
      running: true,
      startTime: state.startTime,
      stalls: state.stalls,
    };
  };

  const seek = (startTime, baseIndex) => {
    if (!playback || !Number.isFinite(startTime) || !Number.isSafeInteger(baseIndex) || baseIndex < 0) return false;
    playback.startTime = startTime;
    playback.baseIndex = baseIndex;
    playback.lastAbsoluteDrawnIndex = baseIndex - 1;
    playback.lastDrawnIndex = -1;
    playback.firstFrameAt = 0;
    return true;
  };

  return {
    available: () => Boolean(loadAddon()),
    seek,
    start,
    status,
    stop,
  };
};
