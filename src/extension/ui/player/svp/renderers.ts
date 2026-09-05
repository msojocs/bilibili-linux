import type { RawFrameRenderer } from "./types";

export const createCanvasRawRenderer = (canvas: HTMLCanvasElement, width: number, height: number): RawFrameRenderer => {
  if (typeof VideoFrame !== 'function') throw new Error('当前 Chromium 不支持原始 VideoFrame')
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('浏览器无法创建 Canvas 原始帧渲染层')
  return {
    backend: 'VideoFrame/Canvas',
    draw: (data, timestamp) => {
      const videoFrame = new VideoFrame(data, {
        codedHeight: height,
        codedWidth: width,
        colorSpace: {
          fullRange: false,
          matrix: 'bt709',
          primaries: 'bt709',
          transfer: 'bt709',
        },
        displayHeight: height,
        displayWidth: width,
        format: 'I420',
        timestamp,
      })
      try {
        context.drawImage(videoFrame, 0, 0, width, height)
      } finally {
        videoFrame.close()
      }
    },
  }
}

export const createWebGlRawRenderer = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelFormat: 'I420' | 'I420P10LE',
): RawFrameRenderer => {
  const tenBit = pixelFormat === 'I420P10LE'
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    stencil: false,
  })
  if (!gl) throw new Error('WebGL2 不可用')
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('WebGL2 无法创建着色器')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'WebGL2 着色器编译失败')
    }
    return shader
  }
  const program = gl.createProgram()
  if (!program) throw new Error('WebGL2 无法创建程序')
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texCoord;
out vec2 uv;
void main() {
  uv = texCoord;
  gl_Position = vec4(position, 0.0, 1.0);
}`))
  const fragmentShader = tenBit ? `#version 300 es
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
  float y = 1.16438356 * (samplePlane(textureY, uv) / 1023.0 - 64.0 / 1023.0);
  float u = samplePlane(textureU, uv) / 1023.0 - 512.0 / 1023.0;
  float v = samplePlane(textureV, uv) / 1023.0 - 512.0 / 1023.0;
  vec3 rgb = vec3(
    y + 1.79274107 * v,
    y - 0.21324861 * u - 0.53290933 * v,
    y + 2.11240179 * u
  );
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
  vec3 rgb = vec3(
    y + 1.79274107 * v,
    y - 0.21324861 * u - 0.53290933 * v,
    y + 2.11240179 * u
  );
  color = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}`
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'WebGL2 程序链接失败')
  }
  gl.useProgram(program)
  const vertexArray = gl.createVertexArray()
  const vertexBuffer = gl.createBuffer()
  if (!vertexArray || !vertexBuffer) throw new Error('WebGL2 无法创建顶点缓冲')
  gl.bindVertexArray(vertexArray)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 1,
    1, -1, 1, 1,
    -1, 1, 0, 0,
    1, 1, 1, 0,
  ]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
  const createTexture = (unit: number, textureWidth: number, textureHeight: number) => {
    const texture = gl.createTexture()
    if (!texture) throw new Error('WebGL2 无法创建 YUV 纹理')
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tenBit ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tenBit ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texStorage2D(gl.TEXTURE_2D, 1, tenBit ? gl.R16UI : gl.R8, textureWidth, textureHeight)
    return texture
  }
  createTexture(0, width, height)
  createTexture(1, width / 2, height / 2)
  createTexture(2, width / 2, height / 2)
  gl.uniform1i(gl.getUniformLocation(program, 'textureY'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'textureU'), 1)
  gl.uniform1i(gl.getUniformLocation(program, 'textureV'), 2)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.viewport(0, 0, width, height)
  const lumaSamples = width * height
  const chromaSamples = lumaSamples / 4
  return {
    backend: tenBit ? 'WebGL2 YUV10' : 'WebGL2 YUV',
    draw: data => {
      if (gl.isContextLost()) throw new Error('WebGL2 上下文已丢失')
      const uploadFormat = tenBit ? gl.RED_INTEGER : gl.RED
      const uploadType = tenBit ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE
      const samples = tenBit
        ? new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2)
        : data
      gl.activeTexture(gl.TEXTURE0)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, uploadFormat, uploadType, samples, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, uploadFormat, uploadType, samples, lumaSamples)
      gl.activeTexture(gl.TEXTURE2)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, uploadFormat, uploadType, samples, lumaSamples + chromaSamples)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}

export const createRawRenderer = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelFormat: 'I420' | 'I420P10LE',
  preference: 'auto' | 'canvas' | 'webgl',
) => {
  if (pixelFormat === 'I420P10LE' && preference === 'canvas') {
    throw new Error('10-bit 原始帧需要 WebGL2 渲染器')
  }
  if (preference !== 'canvas') {
    try {
      return { canvas, renderer: createWebGlRawRenderer(canvas, width, height, pixelFormat) }
    } catch (error) {
      if (preference === 'webgl') throw error
      const replacement = canvas.cloneNode(false) as HTMLCanvasElement
      canvas.replaceWith(replacement)
      if (pixelFormat === 'I420P10LE') throw error
      return { canvas: replacement, renderer: createCanvasRawRenderer(replacement, width, height) }
    }
  }
  return { canvas, renderer: createCanvasRawRenderer(canvas, width, height) }
}
