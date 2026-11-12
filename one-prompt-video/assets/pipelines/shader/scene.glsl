// 最小的场景：日出时的一片丘陵。单位随意。uP0 = (太阳仰角 弧度, 太阳方位 弧度, 0, 0)
// 管道（gl.js）给了这些：uTime、noised()、fbm2()、fbm3()、hash12()。场景只要写 scene()。
float terr(vec2 x) {                       // 地形：分形噪声，每层按累计坡度衰减，出来是有脊有沟的山
  vec2 p = x * .25, d = vec2(0.); float a = 0., b = 1.;
  for (int i = 0; i < 7; i++) { vec3 n = noised(p); d += n.yz; a += b * n.x / (1. + dot(d, d)); b *= .5; p = mat2(.8, -.6, .6, .8) * p * 2.; }
  return a * 1.6;
}
vec3 skyBase(vec3 rd) {                      // 天空的底色：地平线偏橙，天顶偏蓝
  return mix(vec3(.95, .55, .28), vec3(.10, .22, .52), pow(smoothstep(0., .5, max(rd.y, 0.)), .6));
}
vec3 sky(vec3 rd, vec3 sun) {               // 底色加太阳和它周围的光晕
  float mu = max(dot(rd, sun), 0.);
  return skyBase(rd) + vec3(1., .6, .3) * (pow(mu, 40.) * .6 + pow(mu, 900.) * 6.);
}
vec3 scene(vec3 ro, vec3 rd, vec2 px) {
  vec3 sun = normalize(vec3(cos(uP0.x) * sin(uP0.y), sin(uP0.x), -cos(uP0.x) * cos(uP0.y)));
  vec3 col = sky(rd, sun);
  float t = .05; bool hit = false;
  for (int i = 0; i < 160; i++) {            // 沿视线一步步走，走到地面以下就算碰到
    vec3 p = ro + rd * t; float h = p.y - terr(p.xz);
    if (h < .002 * t) { hit = true; break; }
    t += max(.01, .4 * h); if (t > 60.) break;
  }
  if (hit) {
    vec3 p = ro + rd * t; float e = .002 * t;
    vec3 n = normalize(vec3(terr(p.xz - vec2(e, 0.)) - terr(p.xz + vec2(e, 0.)), 2. * e, terr(p.xz - vec2(0., e)) - terr(p.xz + vec2(0., e))));
    vec3 alb = mix(vec3(.20, .17, .14), vec3(.34, .38, .22), smoothstep(.55, .9, n.y));
    vec3 lit = alb * (vec3(1., .62, .36) * 3.2 * max(dot(n, sun), 0.) + vec3(.10, .16, .30) * (.5 + .5 * n.y));
    col = mix(lit, skyBase(normalize(vec3(rd.x, .03, rd.z))), 1. - exp(-t * .045));   // 远处化进天色（用不带太阳的底色，否则太阳下方会出一道光柱）
  }
  return col;
}
