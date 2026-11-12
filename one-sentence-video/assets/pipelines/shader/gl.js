// 管道层：一张全屏的片元着色器，多次采样累加到浮点缓冲，再过一遍调色输出。
// 场景着色器只要提供 vec3 scene(vec3 ro, vec3 rd, vec2 px)，返回线性的高动态颜色。
// 画面只由传进来的时刻、镜头和帧号决定：抖动的种子来自帧号和采样序号，不读系统时间、不用 Math.random。

const HEAD = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uRes; uniform float uTime; uniform float uSeed; uniform vec2 uJit;
uniform vec3 uCamPos, uCamTgt; uniform float uFov, uRoll; uniform vec4 uP0, uP1;
uniform sampler3D uN3;
out vec4 fragColor;
const float PI = 3.14159265;
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
// 二维值噪声，同时给出对 x、y 的导数（地形、水面的法线用）
vec3 noised(vec2 x) {
  vec2 i = floor(x), f = fract(x), u = f * f * f * (f * (f * 6. - 15.) + 10.), du = 30. * f * f * (f * (f - 2.) + 1.);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}
float noise2(vec2 x) { return noised(x).x; }
// 三维噪声：查一张 64 立方的可平铺噪声纹理（种子固定，页面启动时生成）
float noise3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return texture(uN3, (i + f + .5) / 64.).r; }
float fbm3(vec3 p, int oct) { float v = 0., a = .5; for (int k = 0; k < oct; k++) { v += a * noise3(p); p = p * 2.03 + vec3(7.1, 3.3, 5.7); a *= .5; } return v; }
float fbm2(vec2 p, int oct) { float v = 0., a = .5; mat2 m = mat2(.8, .6, -.6, .8); for (int k = 0; k < oct; k++) { v += a * noise2(p); p = m * p * 2.02 + 11.3; a *= .5; } return v; }
`;
const MAIN = `
void main() {
  vec2 fc = gl_FragCoord.xy + uJit;
  vec2 uv = (fc * 2. - uRes) / uRes.y;
  vec3 f = normalize(uCamTgt - uCamPos), r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
  float cr = cos(uRoll), sr = sin(uRoll); vec3 r2 = r * cr + u * sr, u2 = u * cr - r * sr;
  vec3 rd = normalize(uv.x * r2 + uv.y * u2 + f / tan(radians(uFov) * .5));
  vec3 col = scene(uCamPos, rd, fc);
  fragColor = vec4(max(col, 0.), 1.);
}`;
const VS = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
// 输出：平均、曝光、色调映射、暗角、颗粒抖动、黑场淡入淡出
const POST = `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform vec2 uRes; uniform float uInv, uExp, uFade, uFrame, uVig, uGrain; uniform vec3 uTint;
out vec4 o;
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 tone(vec3 x) { x *= .6; return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uAcc, uv).rgb * uInv * uExp;
  float l = dot(c, vec3(.2126, .7152, .0722)); c = mix(vec3(l), c, 1.06) * uTint;
  c = tone(c);
  vec2 q = uv - .5; c *= 1. - uVig * dot(q, q) * 1.6;
  c = pow(c, vec3(1. / 2.2));
  float g = hash12(gl_FragCoord.xy + uFrame * 17.13) + hash12(gl_FragCoord.xy * 1.7 + uFrame * 3.71) - 1.;
  c += g * (uGrain + 1. / 255.);
  o = vec4(c * uFade, 1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s); const m = /ERROR: \d+:(\d+)/.exec(log); const ln = m ? Number(m[1]) : 0;
    throw new Error('着色器编译失败：' + log + (ln ? '\n>> ' + src.split('\n').slice(Math.max(0, ln - 2), ln + 1).join('\n>> ') : ''));
  }
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('着色器链接失败：' + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
// 种子固定的随机数：噪声纹理和采样抖动用
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createStage(canvas, sceneSrc, W = 1920, H = 1080) {
  canvas.width = W; canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('这个浏览器开不了 WebGL2');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('不支持浮点渲染目标');
  const scene = program(gl, HEAD + sceneSrc + MAIN), post = program(gl, POST);
  // 64 立方的噪声纹理，16 位浮点，线性过滤，三个方向都平铺
  const N = 64, r = mulberry(20261112), data = new Float32Array(N * N * N); for (let i = 0; i < data.length; i++) data[i] = r();
  const n3 = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, n3);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, N, N, N, 0, gl.RED, gl.FLOAT, data);
  for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // 累加缓冲
  const acc = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, acc);
  // 32 位浮点缓冲上做叠加混合要另一个扩展；没有就退到 16 位浮点（采样数多时精度差一些）
  if (gl.getExtension('EXT_float_blend')) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('累加缓冲建不起来');
  gl.bindVertexArray(gl.createVertexArray());
  const set3 = (loc, v) => loc && gl.uniform3f(loc, v[0], v[1], v[2]);

  // frame：帧号；camAt(时刻) 返回 {pos, tgt, fov, roll, p0, p1}；shutter 是快门占一帧的比例（运动模糊）
  function render({ time, frame = 0, spp = 8, camAt, fps = 30, shutter = 0.5, exposure = 1, fade = 1, vignette = 0.35, grain = 0.012, tint = [1, 1, 1] }) {
    gl.viewport(0, 0, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(scene.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, n3); gl.uniform1i(scene.u.uN3, 0);
    gl.uniform2f(scene.u.uRes, W, H);
    for (let s = 0; s < spp; s++) {
      // 子像素抖动用 R2 低差异序列，时间在快门内均匀铺开
      const jx = ((0.5 + 0.7548776662 * (s + 1)) % 1) - 0.5, jy = ((0.5 + 0.5698402910 * (s + 1)) % 1) - 0.5;
      const ts = time + ((s + 0.5) / spp - 0.5) * shutter / fps, c = camAt(ts);
      gl.uniform1f(scene.u.uTime, ts); gl.uniform1f(scene.u.uSeed, frame * 64 + s); gl.uniform2f(scene.u.uJit, jx, jy);
      set3(scene.u.uCamPos, c.pos); set3(scene.u.uCamTgt, c.tgt); gl.uniform1f(scene.u.uFov, c.fov || 45); gl.uniform1f(scene.u.uRoll, c.roll || 0);
      const p0 = c.p0 || [0, 0, 0, 0], p1 = c.p1 || [0, 0, 0, 0];
      if (scene.u.uP0) gl.uniform4f(scene.u.uP0, p0[0], p0[1], p0[2], p0[3]);
      if (scene.u.uP1) gl.uniform4f(scene.u.uP1, p1[0], p1[1], p1[2], p1[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(post.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc); gl.uniform1i(post.u.uAcc, 0);
    gl.uniform2f(post.u.uRes, W, H); gl.uniform1f(post.u.uInv, 1 / spp); gl.uniform1f(post.u.uExp, exposure); gl.uniform1f(post.u.uFade, fade);
    gl.uniform1f(post.u.uFrame, frame); gl.uniform1f(post.u.uVig, vignette); gl.uniform1f(post.u.uGrain, grain); gl.uniform3f(post.u.uTint, tint[0], tint[1], tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    return true;
  }
  return { gl, render, W, H };
}
