/* 炭黑生产工艺流程动画 — 时间轴引擎与绘图工具
 * 所有画面都是时间 t 的纯函数：seek(t) 可以跳到任意时刻，
 * 浏览器播放与逐帧渲染视频用的是同一套代码。 */
'use strict';

const W = 1920, H = 1080, XF = 0.6;           // 画布尺寸、转场交叠时长（秒）
const NS = 'http://www.w3.org/2000/svg';

/* ---------- 调色 ---------- */
const C = {
  ink: '#1E2328', sub: '#5B6470', line: '#56606B', pipe: '#8B96A2',
  oil: '#C8861B', oilHot: '#E36414', gas: '#E4572E', fuel: '#0CA678',
  air: '#4DABF7', airHot: '#F76707', water: '#1C7ED6', cb: '#1A1B1E',
  tail: '#7048E8', steam: '#ADB5BD', k2co3: '#2F9E44', co: '#B42318'
};
const SEC = {                                   // 五道工序的主题色
  0: '#343A40', 1: '#B7791F', 2: '#C2410C', 3: '#334155', 4: '#0F766E', 5: '#6D28D9'
};

/* ---------- 数学 ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const fract = x => x - Math.floor(x);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b); t = clamp(t);
  return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')';
}
function mixN(stops, t) {                       // 多色渐变取色：stops = ['#..', '#..', ...]
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(Math.floor(t), stops.length - 2);
  return mix(stops[i], stops[i + 1], t - i);
}

/* ---------- DOM ---------- */
let _uid = 0;
const uid = p => (p || 'u') + (++_uid);
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function div(parent, cls, html, style) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  if (style) d.setAttribute('style', style);
  parent.appendChild(d);
  return d;
}
function vis(node, a) {                         // 透明度 + 自动隐藏
  a = clamp(a);
  node.style.opacity = a;
  node.style.display = a <= 0.002 ? 'none' : '';
  return a;
}
function popG(node, lt, t0, cx, cy, d = 0.45) {  // SVG 组：淡入 + 轻微放大
  const k = eo(seg(lt, t0, t0 + d));
  vis(node, k);
  const s = 0.9 + 0.1 * k;
  node.setAttribute('transform', `translate(${cx},${cy}) scale(${s}) translate(${-cx},${-cy})`);
  return k;
}
function popH(node, lt, t0, d = 0.5, dy = 18) {  // HTML 卡片：淡入 + 上移
  const k = eo(seg(lt, t0, t0 + d));
  node.style.opacity = k;
  node.style.transform = `translateY(${(1 - k) * dy}px)`;
  node.style.visibility = k <= 0.002 ? 'hidden' : 'visible';
  return k;
}

/* 估算文字宽度（用于标签底板），避免依赖字体加载时机 */
function textW(s, size) {
  let w = 0;
  for (const ch of s) {
    if (/[⺀-鿿＀-￯　-〿℃①-⑳‘-‟]/.test(ch)) w += size;
    else if (/[A-Z0-9%≈≤≥±→×]/.test(ch)) w += size * 0.62;
    else if (ch === ' ') w += size * 0.28;
    else w += size * 0.5;
  }
  return w;
}

/* 文字标签：支持底板（pill）与 K_2 这样的下标写法 */
function tlabel(g, x, y, s, o = {}) {
  const size = o.size || 24, anchor = o.anchor || 'middle';
  const grp = el('g', {}, g);
  const plain = s.replace(/_(\d)/g, '$1');
  if (o.pill) {
    const px = o.padX ?? 14, py = o.padY ?? 7;
    const w = textW(plain, size) + px * 2, h = size + py * 2;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + px : x - px;
    el('rect', {
      x: x0, y: y - h / 2, width: w, height: h, rx: o.rx ?? h / 2,
      fill: o.pill, stroke: o.stroke || 'none', 'stroke-width': o.sw || 2
    }, grp);
  }
  const t = el('text', {
    x, y, 'text-anchor': anchor, 'dominant-baseline': 'central',
    'font-size': size, 'font-weight': o.weight || 700, fill: o.fill || C.ink
  }, grp);
  if (o.ls) t.setAttribute('letter-spacing', o.ls);
  s.split(/(_\d)/).forEach(part => {
    if (!part) return;
    const ts = el('tspan', {}, t);
    if (/^_\d$/.test(part)) {
      ts.textContent = part[1];
      ts.setAttribute('font-size', size * 0.66);
      ts.setAttribute('dy', size * 0.22);
      const back = el('tspan', { dy: -size * 0.22 }, t);
      back.textContent = '​';
    } else ts.textContent = part;
  });
  return grp;
}
/* 设备铭牌：白底描边 */
function plate(g, x, y, s, o = {}) {
  return tlabel(g, x, y, s, Object.assign({ pill: '#FFFFFF', stroke: o.color || '#C9D0D8', sw: 2, size: 25, weight: 800, rx: 10, padX: 14, padY: 8 }, o));
}

/* 圆角折线路径 */
function poly(pts, r = 18) {
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0), d2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = x1 - (x1 - x0) / d1 * rr, ay = y1 - (y1 - y0) / d1 * rr;
    const bx = x1 + (x2 - x1) / d2 * rr, by = y1 + (y2 - y1) / d2 * rr;
    d += ` L ${ax},${ay} Q ${x1},${y1} ${bx},${by}`;
  }
  const L = pts[pts.length - 1];
  return d + ` L ${L[0]},${L[1]}`;
}

/* 管道：灰色管壁 + 流动的彩色虚线 + 末端箭头
 * set(t, draw, flow)：draw = 管道画出比例，flow = 介质流动的可见度 */
function pipe(g, d, color, o = {}) {
  const w = o.w ?? 9;
  const grp = el('g', {}, g);
  const outer = el('path', { d, fill: 'none', stroke: o.wall || C.pipe, 'stroke-width': w + 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }, grp);
  const inner = el('path', { d, fill: 'none', stroke: '#E4E8EC', 'stroke-width': w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }, grp);
  const fl = el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dash || '15 11' }, grp);
  let arrow = null;
  if (o.arrow !== false) {
    const L = fl.getTotalLength();
    const p1 = fl.getPointAtLength(L), p0 = fl.getPointAtLength(Math.max(0, L - 3));
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
    const s = Math.max(w, 8);
    arrow = el('path', {
      d: `M ${s * 1.9},0 L ${-s * 0.6},${-s * 1.35} L ${-s * 0.6},${s * 1.35} Z`,
      fill: color, stroke: '#fff', 'stroke-width': 2.5, 'stroke-linejoin': 'round',
      transform: `translate(${p1.x},${p1.y}) rotate(${ang})`
    }, grp);
  }
  const speed = o.speed ?? 70;
  return {
    g: grp, path: fl,
    set(t, draw = 1, flow = 1) {
      if (draw <= 0.002) { grp.style.display = 'none'; return; }
      grp.style.display = '';
      grp.style.opacity = o.opacity ?? 1;
      outer.setAttribute('stroke-dasharray', `${draw} 2`);
      inner.setAttribute('stroke-dasharray', `${draw} 2`);
      const f = draw >= 0.999 ? clamp(flow) : 0;
      fl.style.opacity = f;
      if (arrow) arrow.style.opacity = f;
      fl.setAttribute('stroke-dashoffset', -t * speed);
    }
  };
}
/* 概念箭头（无管壁） */
function flowArrow(g, d, color, o = {}) {
  return pipe(g, d, color, Object.assign({ wall: 'rgba(0,0,0,0)', w: o.w ?? 7 }, o));
}

/* 沿路径运动的颗粒流 */
function stream(g, d, o) {
  const grp = el('g', {}, g);
  const p = el('path', { d, fill: 'none', stroke: 'none' }, grp);
  const L = p.getTotalLength();
  const R = rng(o.seed || 7);
  const parts = [];
  for (let i = 0; i < o.n; i++) {
    const c = el('circle', { r: 2, fill: o.fill || 'url(#cbBall)' }, grp);
    parts.push({ c, off: i / o.n + R() * 0.5 / o.n, jx: R() - 0.5, jy: R() - 0.5, k: 0.7 + 0.6 * R(), ph: R() * 6.28 });
  }
  return {
    g: grp,
    set(t, a = 1, front = 1) {
      if (vis(grp, a) <= 0) return;
      for (const q of parts) {
        const s = fract(q.off + t * o.speed / L);
        if (s > front) { q.c.style.display = 'none'; continue; }
        q.c.style.display = '';
        const pt = p.getPointAtLength(s * L);
        const j = o.jit || 0, wob = o.wob ? Math.sin(t * 6 + q.ph) * o.wob : 0;
        q.c.setAttribute('cx', pt.x + q.jx * j);
        q.c.setAttribute('cy', pt.y + q.jy * j + wob);
        q.c.setAttribute('r', (typeof o.r === 'function' ? o.r(s) : o.r) * q.k);
      }
    }
  };
}

/* ---------- 设备 ---------- */
/* 立式储罐：椭圆封头，可选锥底；setLevel(p) 设置液位/料位 */
function vtank(g, x, y, w, h, o = {}) {
  const grp = el('g', {}, g);
  const ry = o.ry ?? w * 0.15, cone = o.cone || 0, outW = o.outW || 40;
  let d = `M ${x},${y + ry} A ${w / 2},${ry} 0 0 1 ${x + w},${y + ry} V ${y + h}`;
  d += cone ? ` L ${x + w / 2 + outW / 2},${y + h + cone} H ${x + w / 2 - outW / 2} L ${x},${y + h} Z`
    : ` A ${w / 2},${ry} 0 0 1 ${x},${y + h} Z`;
  el('path', { d, fill: 'url(#steelV)', stroke: 'none', filter: 'url(#shadow)' }, grp);
  let fill = null, surf = null;
  const bottom = y + h + (cone || ry);
  if (o.fill) {
    const id = uid('tk');
    const cp = el('clipPath', { id }, grp);
    el('path', { d }, cp);
    const lg = el('g', { 'clip-path': `url(#${id})` }, grp);
    el('rect', { x: x + w * 0.1, y, width: w * 0.8, height: h + (cone || ry), fill: 'rgba(255,255,255,.55)' }, lg);
    fill = el('rect', { x: x - 4, y: bottom, width: w + 8, height: h + ry + cone + 8, fill: o.fill }, lg);
    if (o.surface !== false) surf = el('ellipse', { cx: x + w / 2, cy: bottom, rx: w / 2, ry: ry * 0.55, fill: o.surf || o.fill, opacity: 0.9 }, lg);
  }
  el('path', { d, fill: 'none', stroke: C.line, 'stroke-width': 3 }, grp);
  el('path', { d: `M ${x + w * 0.16},${y + ry * 1.5} V ${y + h - 6}`, stroke: 'rgba(255,255,255,.55)', 'stroke-width': Math.max(4, w * 0.05), 'stroke-linecap': 'round' }, grp);
  const top = y + ry * 0.6;
  return {
    g: grp, x, y, w, h, cone, bottom,
    setLevel(p) {
      if (!fill) return;
      const ly = lerp(bottom, top, clamp(p));
      fill.setAttribute('y', ly);
      if (surf) { surf.setAttribute('cy', ly); surf.style.display = p > 0.01 ? '' : 'none'; }
    }
  };
}
/* 卧式圆筒（换热器、造粒机等） */
function hcyl(g, x, y, w, h, o = {}) {
  const grp = el('g', {}, g);
  const rx = o.rx ?? Math.min(h * 0.22, 30);
  const d = `M ${x + rx},${y} H ${x + w - rx} A ${rx},${h / 2} 0 0 1 ${x + w - rx},${y + h} H ${x + rx} A ${rx},${h / 2} 0 0 1 ${x + rx},${y} Z`;
  el('path', { d, fill: o.fill || 'url(#steelH)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, grp);
  el('path', { d: `M ${x + rx},${y + h * 0.18} H ${x + w - rx}`, stroke: 'rgba(255,255,255,.6)', 'stroke-width': Math.max(3, h * 0.05), 'stroke-linecap': 'round' }, grp);
  return { g: grp, d, x, y, w, h, rx };
}
/* 离心泵：叶轮旋转 */
function pumpShape(g, cx, cy, r) {
  const grp = el('g', {}, g);
  el('rect', { x: cx - r * 1.9, y: cy - r * 0.45, width: r * 1.2, height: r * 0.9, rx: 6, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 2.5 }, grp);
  el('circle', { cx, cy, r, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, grp);
  el('circle', { cx, cy, r: r * 0.72, fill: '#F1F3F5', stroke: '#9AA4AE', 'stroke-width': 2 }, grp);
  const imp = el('g', {}, grp);
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    el('path', { d: `M 0,0 Q ${r * 0.35},${-r * 0.25} ${r * 0.62},${-r * 0.1}`, stroke: '#495057', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', transform: `rotate(${a})` }, imp);
  }
  el('circle', { cx: 0, cy: 0, r: r * 0.14, fill: '#495057' }, imp);
  return { g: grp, set(t, on) { imp.setAttribute('transform', `translate(${cx},${cy}) rotate(${t * 360 * 1.4 * on})`); } };
}
/* 火焰舌（向右），用于反应炉、燃烧炉 */
function flameD(x, y, len, wid, t, ph) {
  const w = wid * (0.86 + 0.14 * Math.sin(t * 9.1 + ph));
  const L = len * (0.84 + 0.16 * Math.sin(t * 7.3 + ph * 1.7));
  const wob = 7 * Math.sin(t * 11 + ph * 2.3);
  return `M ${x},${y - w / 2} C ${x + L * 0.35},${y - w * 0.72 + wob} ${x + L * 0.72},${y - w * 0.3 + wob} ${x + L},${y + wob * 0.5} ` +
    `C ${x + L * 0.72},${y + w * 0.3 + wob} ${x + L * 0.35},${y + w * 0.72 + wob} ${x},${y + w / 2} Z`;
}
/* 旋转阀（气密阀） */
function rotaryValve(g, cx, cy, r) {
  const grp = el('g', {}, g);
  el('rect', { x: cx - r - 8, y: cy - r - 6, width: 2 * r + 16, height: 2 * r + 12, rx: 8, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 2.5 }, grp);
  el('circle', { cx, cy, r, fill: '#F1F3F5', stroke: '#8A949E', 'stroke-width': 2 }, grp);
  const v = el('g', {}, grp);
  for (let i = 0; i < 6; i++) el('line', { x1: 0, y1: 0, x2: r - 2, y2: 0, stroke: '#495057', 'stroke-width': 3.5, transform: `rotate(${i * 60})` }, v);
  return { g: grp, set(t, on) { v.setAttribute('transform', `translate(${cx},${cy}) rotate(${t * 120 * on})`); } };
}
/* 喷淋：锥形水雾 + 下落水滴 */
function sprayCone(g, x, y, len, spread, color, n = 14, seed = 3) {
  const grp = el('g', {}, g);
  const gid = uid('spr');
  const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, grp);
  el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0.55 }, lg);
  el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }, lg);
  el('path', { d: `M ${x - 6},${y} L ${x - spread},${y + len} L ${x + spread},${y + len} L ${x + 6},${y} Z`, fill: `url(#${gid})` }, grp);
  const R = rng(seed), drops = [];
  for (let i = 0; i < n; i++) drops.push({ c: el('circle', { r: 3, fill: color }, grp), off: i / n, dx: R() * 2 - 1 });
  return {
    g: grp,
    set(t, a) {
      if (vis(grp, a) <= 0) return;
      for (const q of drops) {
        const s = fract(q.off + t * 1.7);
        q.c.setAttribute('cx', x + q.dx * spread * s);
        q.c.setAttribute('cy', y + s * len);
        q.c.setAttribute('r', 3.4 * (1 - 0.45 * s));
        q.c.style.opacity = 1 - s;
      }
    }
  };
}
/* 蒸汽/烟气缕 */
function wisps(g, x, y, n, o = {}) {
  const grp = el('g', {}, g);
  const R = rng(o.seed || 5), ps = [];
  for (let i = 0; i < n; i++) ps.push({ c: el('circle', { r: 10, fill: o.color || '#CED4DA' }, grp), off: i / n, dx: R() - 0.5 });
  return {
    g: grp,
    set(t, a) {
      if (vis(grp, a) <= 0) return;
      for (const q of ps) {
        const s = fract(q.off + t * (o.speed || 0.35));
        q.c.setAttribute('cx', x + q.dx * (o.spread || 30) + s * (o.drift || 30) + Math.sin(t * 2 + q.off * 9) * 6);
        q.c.setAttribute('cy', y - s * (o.rise || 120));
        q.c.setAttribute('r', (o.r || 10) * (0.6 + s * 1.4));
        q.c.style.opacity = (o.op || 0.55) * Math.sin(Math.PI * s);
      }
    }
  };
}

/* 炭黑聚集体：原生粒子熔结成“葡萄串” */
function makeAggregate(n, r, seed) {
  const R = rng(seed), pts = [{ x: 0, y: 0 }];
  let tries = 0;
  while (pts.length < n && tries++ < 4000) {
    const base = R() < 0.65 ? pts[pts.length - 1 - Math.floor(R() * Math.min(3, pts.length))] : pts[Math.floor(R() * pts.length)];
    const a = R() * Math.PI * 2, d = r * (1.5 + R() * 0.12);
    const p = { x: base.x + Math.cos(a) * d, y: base.y + Math.sin(a) * d };
    if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= r * 1.42)) pts.push(p);
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
}
function drawAggregate(g, pts, r, o = {}) {
  const grp = el('g', {}, g);
  const necks = [], spheres = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < r * 1.75)
      necks.push({ e: el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#141517', 'stroke-width': r * 1.15, 'stroke-linecap': 'round' }, grp), i, j });
  }
  pts.forEach((p, i) => {
    const s = el('g', { transform: `translate(${p.x},${p.y})` }, grp);
    el('circle', { cx: 0, cy: 0, r, fill: 'url(#cbBall)' }, s);
    if (o.rings) for (let k = 1; k <= 3; k++)
      el('circle', { cx: 0, cy: 0, r: r * (1 - k * 0.24), fill: 'none', stroke: 'rgba(210,215,222,.35)', 'stroke-width': 1.4 }, s);
    spheres.push({ s, p, i });
  });
  return { g: grp, necks, spheres };
}

/* ---------- 场景管理 ---------- */
const SCENES = [];
function scene(def) { SCENES.push(def); }
let TOTAL = 0;
const UI = {};

function initStage() {
  const stage = document.getElementById('stage');
  const layer = document.getElementById('scenes');
  let T0 = 0;
  SCENES.forEach((s, i) => {
    s.index = i;
    s.start = T0; s.end = T0 + s.dur; T0 = s.end - XF;
    s.div = div(layer, 'scene');
    s.svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, s.div);
    s.html = div(s.div, 'html');
    s.build(s.svg, s.html, s);
  });
  TOTAL = SCENES[SCENES.length - 1].end;
  UI.cap = document.getElementById('cap');
  UI.capText = UI.cap.querySelector('span');
  UI.chap = document.getElementById('chap');
  UI.chapNum = UI.chap.querySelector('.num');
  UI.chapT = UI.chap.querySelector('.t');
  UI.chapS = UI.chap.querySelector('.s');
  UI.brand = document.getElementById('brand');
  // 进度条：每个场景一段，按工序着色
  const prog = document.getElementById('prog');
  UI.progFill = [];
  SCENES.forEach(s => {
    const len = s.dur - (s.index < SCENES.length - 1 ? XF : 0);
    const segDiv = div(prog, 'pseg', null, `flex:${len};--c:${SEC[s.section || 0]}`);
    UI.progFill.push({ f: div(segDiv, 'pfill'), s, len });
  });
}

function chapKey(c) { return c ? c.num + '|' + c.t : ''; }

function seek(T) {
  T = clamp(T, 0, TOTAL);
  let cap = '', capA = 0, best = null, bestA = -1;
  const active = [];
  for (const s of SCENES) {
    const lt = T - s.start;
    if (lt < -1e-6 || lt > s.dur + 1e-6) { s.div.style.display = 'none'; continue; }
    s.div.style.display = 'block';
    let a = 1;
    if (s.index > 0) a = Math.min(a, clamp(lt / XF));
    if (s.index < SCENES.length - 1) a = Math.min(a, clamp((s.dur - lt) / XF));
    s.div.style.opacity = a;
    s.update(lt, s);
    active.push({ s, a });
    for (const c of (s.caps || [])) {
      if (lt >= c[0] && lt <= c[1]) {
        const ca = Math.min(clamp((lt - c[0]) / 0.22), clamp((c[1] - lt) / 0.22)) * a;
        if (ca > capA) { capA = ca; cap = c[2]; }
      }
    }
    if (a > bestA) { bestA = a; best = s; }
  }
  // 字幕
  if (UI.capText.dataset.v !== cap) { UI.capText.innerHTML = cap; UI.capText.dataset.v = cap; }
  UI.cap.style.opacity = cap ? capA : 0;
  UI.cap.style.visibility = cap && capA > 0.002 ? 'visible' : 'hidden';
  // 章节标题：同一章节内保持不动，只在换章时淡入淡出
  const ch = best && best.chap;
  let chA = 0;
  if (ch) {
    const same = active.every(x => chapKey(x.s.chap) === chapKey(ch));
    chA = same ? 1 : bestA;
    if (!same) {
      const other = active.find(x => x.s !== best);
      if (other && chapKey(other.s.chap) === chapKey(ch)) chA = 1;
    }
    if (best.index === 0 || !best.chap) chA = 0;
    UI.chapNum.textContent = ch.num;
    UI.chapNum.style.background = ch.c || SEC[best.section || 0];
    UI.chapNum.classList.toggle('wide', ch.num.length > 2);
    UI.chapT.textContent = ch.t;
    if (UI.chapS.dataset.v !== ch.s) { UI.chapS.textContent = ch.s; UI.chapS.dataset.v = ch.s; }
  }
  UI.chap.style.opacity = chA;
  UI.chap.style.transform = `translateX(${(1 - chA) * -24}px)`;
  UI.brand.style.opacity = best && best.index === 0 ? 0 : 1;
  // 进度条
  for (const p of UI.progFill) p.f.style.width = (clamp((T - p.s.start) / p.len) * 100) + '%';
  return T;
}

function allCaptions() {
  const out = [];
  for (const s of SCENES) for (const c of (s.caps || [])) out.push({ start: s.start + c[0], end: s.start + c[1], text: c[2] });
  return out;
}
