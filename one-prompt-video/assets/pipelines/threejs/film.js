// three.js 短片的最小工程：几个方块落在地面上，镜头慢慢绕过去，6 秒。
// 画质的办法：每帧渲 SPP 次，每次把镜头挪一个子像素、把时刻挪到快门里的另一点，累加再平均——抗锯齿和运动模糊都从这里来。
// 要景深、软阴影，就在同一个循环里再抖镜头在光圈上的位置、灯的位置。画面只由时刻决定，随机数从种子算。
import * as THREE from 'three'
const W = 1920, H = 1080, FPS = 30
window.DUR = 6
const SPP = Number(new URLSearchParams(location.search).get('spp')) || 8
try {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true })
  renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fb4c8); scene.fog = new THREE.Fog(0x9fb4c8, 18, 60)
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 200)
  scene.add(new THREE.HemisphereLight(0xdfe8f5, 0x4a4036, 0.9))
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2); sun.position.set(6, 10, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); scene.add(sun)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground)
  const hash = (a, b = 0) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d); return ((h ^ (h >>> 13)) >>> 0) / 4294967296 }
  const boxes = []
  for (let i = 0; i < 7; i++) {
    const s = 0.7 + hash(i, 1) * 0.9, m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.06 + hash(i, 2) * 0.08, 0.6, 0.5), roughness: 0.6 }))
    m.castShadow = m.receiveShadow = true; m.userData = { x: (i - 3) * 1.9, z: (hash(i, 4) - 0.5) * 5, s,   // 横向按格子排开，方块之间不会互相穿进去
      t0: 0.3 + i * 0.35, r: hash(i, 5) * 3 }; scene.add(m); boxes.push(m)
  }
  // 摆好第 t 秒的所有东西：位置都是 t 的函数，不靠上一帧
  function animate(t) {
    for (const m of boxes) { const d = m.userData, u = Math.min(1, Math.max(0, (t - d.t0) / 0.6)), fall = 1 - (1 - u) ** 2, bounce = u >= 1 ? Math.max(0, Math.sin((t - d.t0 - 0.6) * 9)) * Math.exp(-(t - d.t0 - 0.6) * 5) * 0.25 : 0; m.position.set(d.x, d.s / 2 + (1 - fall) * 8 + bounce, d.z); m.rotation.y = d.r + (1 - fall) * 2 }
    const a = -0.5 + t / window.DUR * 0.9; cam.position.set(Math.sin(a) * 15, 4.2 + t * 0.15, Math.cos(a) * 15); cam.lookAt(0, 0.8, 0)
  }
  // 累加：每次采样渲到 rtS，再按 1/SPP 的权重叠加到浮点的 rtA 上，最后把 rtA 画到屏幕
  const rtS = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }), rtA = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, w: { value: 1 }, fin: { value: 0 } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    // fin=1 是最后画到屏幕的那一遍：自写的着色器不会自动做色调映射和伽马，要在这里做，否则画面发暗
    fragmentShader: 'uniform sampler2D tex; uniform float w, fin; varying vec2 v; void main(){ vec3 c = texture2D(tex, v).rgb * w; if (fin > .5) { c = clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.); c = pow(c, vec3(1. / 2.2)); } gl_FragColor = vec4(c, 1.); }' }))
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  window.renderAt = (t) => {
    t = Math.min(Math.max(Number(t) || 0, 0), window.DUR - 1e-6)
    const frame = Math.round(t * FPS), tone = renderer.toneMapping
    renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 1); renderer.clear()
    for (let s = 0; s < SPP; s++) {
      animate(t + ((s + 0.5) / SPP - 0.5) * 0.5 / FPS)                      // 时刻铺在半帧长的快门里
      cam.setViewOffset(W, H, hash(frame, s * 2 + 1) - 0.5, hash(frame, s * 2 + 2) - 0.5, W, H)   // 子像素偏移
      renderer.toneMapping = THREE.NoToneMapping
      renderer.setRenderTarget(rtS); renderer.render(scene, cam)
      quad.material.uniforms.tex.value = rtS.texture; quad.material.uniforms.w.value = 1 / SPP; quad.material.uniforms.fin.value = 0; quad.material.blending = THREE.CustomBlending
      renderer.autoClear = false; renderer.setRenderTarget(rtA); renderer.render(qScene, qCam); renderer.autoClear = true
    }
    cam.clearViewOffset(); renderer.toneMapping = tone
    quad.material.uniforms.tex.value = rtA.texture; quad.material.uniforms.w.value = Math.min(1, t / 0.5) * Math.min(1, (window.DUR - t) / 0.6); quad.material.uniforms.fin.value = 1; quad.material.blending = THREE.NoBlending
    renderer.setRenderTarget(null); renderer.render(qScene, qCam)
  }
  window.renderAt(Number(new URLSearchParams(location.search).get('t')) || 0)
  window.ready = true
} catch (e) { window.fatal = String(e && e.message || e) }
