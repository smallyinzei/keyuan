/* 炭黑生产工艺流程动画 — 分镜
 * 工艺内容依据：培训课件《炭黑的工艺与分析》第 7 页工艺说明与流程图；
 * 公司数据依据：《浙江长鸿炭黑介绍资料》、长鸿炭黑 TDS；
 * 行业通用数据（反应温度、收率规律）参考 US EPA AP-42 §6.1。 */
'use strict';

const head = (tags, title) => `<div style="display:flex;gap:8px;margin-bottom:8px">${tags.map(([c, x]) => `<span class="tag ${c}">${x}</span>`).join('')}</div><h4>${title}</h4>`;

/* ================= 片头 ================= */
scene({
  key: 'title', section: 0, chap: null, menu: '片头', dur: 7.5,
  build(svg, html, S) {
    S.aggs = [];
    const conf = [[250, 330, 1.15, 11, 22], [1690, 790, 1.3, 23, 24], [1600, 240, 0.78, 37, 16], [290, 850, 0.8, 41, 18], [1820, 500, 0.55, 53, 12], [100, 610, 0.6, 61, 12]];
    for (const [x, y, sc, seed, n] of conf) {
      const g = el('g', {}, svg);
      drawAggregate(g, makeAggregate(n, 20, seed), 20);
      S.aggs.push({ g, x, y, sc });
    }
    html.innerHTML = `<div class="title-wrap">
      <div class="kicker">油炉法 · OIL FURNACE PROCESS</div>
      <h1>炭黑生产工艺流程</h1>
      <div class="subtitle">从原料油到成品入库 · 五道工序全流程</div>
      <div class="schips">
        <span class="schip" style="--c:${SEC[1]}"><i>1</i>供料</span>
        <span class="schip" style="--c:${SEC[2]}"><i>2</i>反应</span>
        <span class="schip" style="--c:${SEC[3]}"><i>3</i>收集</span>
        <span class="schip" style="--c:${SEC[4]}"><i>4</i>造粒·干燥·包装</span>
        <span class="schip" style="--c:${SEC[5]}"><i>5</i>尾气处理</span>
      </div></div>
      <div class="tfoot">内部学习资料 ｜ 依据培训课件《炭黑的工艺与分析》、长鸿炭黑介绍资料及 TDS 整理</div>`;
  },
  update(t, S) {
    S.aggs.forEach((a, i) => {
      const dx = Math.sin(t * 0.5 + i) * 10, dy = Math.cos(t * 0.4 + i * 1.3) * 8, rot = t * 4 * (i % 2 ? 1 : -1);
      a.g.setAttribute('transform', `translate(${a.x + dx},${a.y + dy}) rotate(${rot}) scale(${a.sc})`);
    });
  }
});

/* ================= 导入：什么是炭黑 ================= */
scene({
  key: 'what', section: 0, dur: 15, menu: '导入 · 什么是炭黑',
  chap: { num: '导入', t: '什么是炭黑', s: '定义 · 微观形态 · 分类', c: SEC[0] },
  caps: [
    [0.3, 6.9, '炭黑是烃类原料经不完全燃烧或热裂解生成的黑色粉末，主要成分是碳。'],
    [7.0, 14.6, '放大看，它是纳米级近球形的原生粒子，<br>熔结成“葡萄串”状的聚集体；主要用于橡胶补强。']
  ],
  build(svg, html, S) {
    const R = rng(7);
    S.pile = el('g', {}, svg);
    el('ellipse', { cx: 360, cy: 716, rx: 240, ry: 24, fill: 'rgba(30,35,40,.10)' }, S.pile);
    S.pellets = [];
    [[15, 700], [13, 677], [11, 654], [9, 631], [7, 608], [5, 585], [3, 562]].forEach(([n, y], ri) => {
      for (let i = 0; i < n; i++) {
        const x = 360 + (i - (n - 1) / 2) * 27 + (R() - 0.5) * 6;
        const c = el('circle', { cx: x, cy: y + (R() - 0.5) * 5, r: 12 + R() * 3, fill: 'url(#cbBall)' }, S.pile);
        S.pellets.push({ c, t0: 0.05 + ri * 0.1 + i * 0.012 });
      }
    });
    S.pileLbl = tlabel(svg, 360, 772, '炭黑成品（颗粒状）', { size: 26, weight: 800 });
    S.mag = el('g', {}, svg);
    el('line', { x1: 540, y1: 650, x2: 606, y2: 716, stroke: '#3A4148', 'stroke-width': 20, 'stroke-linecap': 'round' }, S.mag);
    el('circle', { cx: 480, cy: 590, r: 84, fill: 'rgba(255,255,255,.35)', stroke: '#3A4148', 'stroke-width': 10 }, S.mag);
    S.conn = el('g', {}, svg);
    el('line', { x1: 480, y1: 506, x2: 1010, y2: 258, stroke: '#8A929C', 'stroke-width': 2.5, 'stroke-dasharray': '9 9' }, S.conn);
    el('line', { x1: 480, y1: 674, x2: 1010, y2: 803, stroke: '#8A929C', 'stroke-width': 2.5, 'stroke-dasharray': '9 9' }, S.conn);
    const cx = 1090, cy = 530, rr = 285;
    S.big = el('g', {}, svg);
    el('circle', { cx, cy, r: rr, fill: '#FCFCFA', stroke: '#3A4148', 'stroke-width': 8, filter: 'url(#shadow)' }, S.big);
    const cid = uid('big'); const cp = el('clipPath', { id: cid }, S.big); el('circle', { cx, cy, r: rr - 4 }, cp);
    const inner = el('g', { 'clip-path': `url(#${cid})` }, S.big);
    for (let k = -6; k <= 6; k++) {
      el('line', { x1: cx + k * 50, y1: cy - rr, x2: cx + k * 50, y2: cy + rr, stroke: 'rgba(30,35,40,.05)', 'stroke-width': 1.5 }, inner);
      el('line', { x1: cx - rr, y1: cy + k * 50, x2: cx + rr, y2: cy + k * 50, stroke: 'rgba(30,35,40,.05)', 'stroke-width': 1.5 }, inner);
    }
    S.side = [];
    [[cx + 210, cy - 165, 9, 3], [cx - 205, cy + 170, 8, 9]].forEach(([x, y, n, sd]) => {
      const a = drawAggregate(inner, makeAggregate(n, 24, sd), 24);
      a.g.setAttribute('transform', `translate(${x},${y})`);
      S.side.push(a);
    });
    const pts = makeAggregate(15, 31, 5);
    S.agg = drawAggregate(inner, pts, 31);
    S.agg.g.setAttribute('transform', `translate(${cx},${cy})`);
    let tp = pts[0]; pts.forEach(p => { if (p.x * 0.4 + p.y < tp.x * 0.4 + tp.y) tp = p; });
    S.lblA = el('g', {}, svg);
    el('circle', { cx: cx + tp.x, cy: cy + tp.y, r: 38, fill: 'none', stroke: '#F08C00', 'stroke-width': 4 }, S.lblA);
    el('line', { x1: cx + tp.x, y1: cy + tp.y - 38, x2: 1110, y2: 318, stroke: '#F08C00', 'stroke-width': 3 }, S.lblA);
    tlabel(S.lblA, 1110, 297, '原生粒子：纳米级、近球形', { size: 25, pill: '#fff', stroke: '#F08C00', sw: 3 });
    S.lblB = el('g', {}, svg);
    tlabel(S.lblB, 1130, 760, '聚集体：熔结成“葡萄串”', { size: 25, pill: '#fff', stroke: '#1E2328', sw: 3 });
    S.catTitle = div(html, '', '炭黑的三大类别（课件）', 'position:absolute;left:1432px;top:196px;font-size:24px;font-weight:800;color:#5B6470;letter-spacing:2px');
    S.cards = [
      ['橡胶用炭黑', '补强 · N220、N330、N326、N375 等'],
      ['色素炭黑', '着色 · 涂料、油墨、塑料、化纤、皮革'],
      ['乙炔炭黑', '导电 · 低电阻或高电阻性能']
    ].map(([h, l], i) => div(html, 'card', `<h4>${h}</h4><div style="font-size:22px;color:#3E4650">${l}</div>`, `left:1430px;top:${244 + i * 172}px;width:440px;padding:16px 24px 18px`));
  },
  update(t, S) {
    S.pellets.forEach(p => { p.c.style.opacity = eo(seg(t, p.t0, p.t0 + 0.35)); });
    vis(S.pileLbl, seg(t, 0.8, 1.3));
    popG(S.mag, t, 1.3, 480, 590);
    vis(S.conn, seg(t, 1.8, 2.4));
    popG(S.big, t, 2.1, 1090, 530, 0.6);
    S.agg.spheres.forEach((s, i) => { s.s.style.opacity = eo(seg(t, 2.6 + i * 0.12, 2.95 + i * 0.12)); });
    S.agg.necks.forEach(nk => { const k = Math.max(nk.i, nk.j) * 0.12; nk.e.style.opacity = eo(seg(t, 2.85 + k, 3.3 + k)); });
    S.side.forEach(a => vis(a.g, 0.5 * seg(t, 4.3, 5.1)));
    vis(S.lblA, seg(t, 7.0, 7.6));
    vis(S.lblB, seg(t, 8.3, 8.9));
    popH(S.catTitle, t, 10.0);
    S.cards.forEach((c, i) => popH(c, t, 10.3 + i * 0.5));
  }
});

/* ================= 总览 ================= */
const ICON = {
  feed: c => `<svg width="120" height="92" viewBox="0 0 120 92"><path d="M35 15 A25 9 0 0 1 85 15 V77 A25 9 0 0 1 35 77 Z" fill="#F1F3F5" stroke="${c}" stroke-width="4"/><path d="M37 48 Q60 55 83 48 V77 A23 8 0 0 1 37 77 Z" fill="#E3A33A"/><path d="M85 60 H112" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`,
  react: c => `<svg width="210" height="92" viewBox="0 0 210 92"><path d="M8 20 H82 L98 36 H112 L128 22 H202 V70 H128 L112 56 H98 L82 72 H8 Z" fill="#3B2A26" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M14 34 C40 26 62 38 80 46 C62 54 40 66 14 58 Z" fill="#FFC857"/><path d="M14 40 C34 36 50 42 64 46 C50 50 34 56 14 52 Z" fill="#FFF3C4"/><g fill="#0F0F10"><circle cx="140" cy="40" r="4"/><circle cx="152" cy="52" r="5"/><circle cx="166" cy="42" r="5"/><circle cx="178" cy="54" r="5"/><circle cx="190" cy="44" r="5"/></g><path d="M170 8 V22 M186 8 V22" stroke="#1C7ED6" stroke-width="4"/></svg>`,
  collect: c => `<svg width="120" height="92" viewBox="0 0 120 92"><path d="M20 6 H100 V60 L72 86 H48 L20 60 Z" fill="#F1F3F5" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><g fill="#2B2D31"><rect x="30" y="14" width="10" height="40" rx="5"/><rect x="48" y="14" width="10" height="40" rx="5"/><rect x="66" y="14" width="10" height="40" rx="5"/><rect x="84" y="14" width="10" height="40" rx="5"/></g><path d="M50 70 H70 L64 84 H56 Z" fill="#1A1B1E"/></svg>`,
  finish: c => `<svg width="190" height="92" viewBox="0 0 190 92"><rect x="6" y="26" width="112" height="40" rx="14" fill="#F1F3F5" stroke="${c}" stroke-width="4"/><rect x="28" y="22" width="10" height="48" rx="3" fill="${c}"/><rect x="86" y="22" width="10" height="48" rx="3" fill="${c}"/><g fill="#1A1B1E"><circle cx="50" cy="52" r="5"/><circle cx="64" cy="55" r="5"/><circle cx="76" cy="51" r="5"/></g><path d="M136 30 Q134 22 142 20 H170 Q178 22 176 30 L180 84 H132 Z" fill="#fff" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M142 44 H170" stroke="${c}" stroke-width="3"/></svg>`,
  tail: c => `<svg width="170" height="92" viewBox="0 0 170 92"><rect x="10" y="44" width="56" height="44" rx="6" fill="#F1F3F5" stroke="${c}" stroke-width="4"/><path d="M38 80 C24 68 34 58 38 50 C42 58 52 68 38 80 Z" fill="#FFB347"/><path d="M66 66 H100" stroke="${c}" stroke-width="6"/><path d="M104 88 L110 12 H128 L134 88 Z" fill="#F1F3F5" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><circle cx="124" cy="8" r="6" fill="#DEE2E6"/><circle cx="138" cy="4" r="4" fill="#E9ECEF"/></svg>`
};

scene({
  key: 'overview', section: 0, dur: 16, menu: '总览 · 工艺全流程',
  chap: { num: '总览', t: '油炉法工艺全流程', s: '五道工序 · 物料与能量流向', c: SEC[0] },
  caps: [
    [0.3, 7.6, '橡胶用炭黑绝大多数采用油炉法生产：<br>原料油在反应炉内高温裂解，生成炭黑。'],
    [7.7, 15.6, '全流程分为五道工序：供料、反应、收集、造粒·干燥·包装，以及尾气处理。']
  ],
  build(svg, html, S) {
    const B = [
      { x: 70, y: 300, w: 300, h: 250, c: SEC[1], n: 1, t: '供料', i: ICON.feed, l: '储罐 → 过滤<br>→ 泵送 → 预热' },
      { x: 480, y: 300, w: 420, h: 250, c: SEC[2], n: 2, t: '反应', i: ICON.react, l: '燃烧 · 喉管 · 反应 · 急冷<br>→ 换热降温至 ≤250 ℃' },
      { x: 1010, y: 300, w: 320, h: 250, c: SEC[3], n: 3, t: '收集', i: ICON.collect, l: '主袋滤器 → 粉碎<br>→ 粉状炭黑储罐' },
      { x: 1440, y: 300, w: 410, h: 250, c: SEC[4], n: 4, t: '造粒·干燥·包装', i: ICON.finish, l: '造粒 → 干燥 → 筛选<br>→ 磁选 → 包装入库' },
      { x: 1010, y: 660, w: 840, h: 176, c: SEC[5], n: 5, t: '尾气处理', i: ICON.tail, l: '' }
    ];
    S.blocks = B.map((b, k) => {
      const d = div(html, 'blk', '', `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;--c:${b.c}`);
      if (k < 4) d.innerHTML = `<div class="bh"><span class="bn">${b.n}</span>${b.t}</div><div class="bi">${b.i(b.c)}</div><div class="bl">${b.l}</div>`;
      else d.innerHTML = `<div style="display:flex;align-items:center;gap:26px;height:100%;text-align:left"><div class="bi" style="margin:0">${b.i(b.c)}</div><div><div class="bh" style="justify-content:flex-start"><span class="bn">5</span>${b.t}</div><div class="bl" style="margin-top:8px">约 1/3 尾气作干燥机热源 · 约 2/3 进锅炉产蒸汽<br>燃烧烟气经脱硫脱硝处理后排放</div></div></div>`;
      return d;
    });
    const A = (d, c, lbl, lx, ly, o = {}) => ({ p: flowArrow(svg, d, c, Object.assign({ w: 8, speed: 60 }, o)), l: lbl ? tlabel(svg, lx, ly, lbl, { size: 22, pill: '#fff', stroke: c, sw: 2.5, anchor: o.anchor || 'middle' }) : null });
    S.arrows = [
      A(poly([[378, 425], [470, 425]]), C.oilHot, '原料油', 425, 390),
      A(poly([[908, 425], [1000, 425]]), '#7A3E2E', '炭黑烟气', 955, 390),
      A(poly([[1338, 425], [1430, 425]]), C.cb, '粉状炭黑', 1385, 390),
      A(poly([[1170, 558], [1170, 650]]), C.tail, '尾气', 1190, 604, { anchor: 'start' }),
      A(poly([[1645, 652], [1645, 560]]), C.airHot, '热风 → 干燥机', 1665, 606, { anchor: 'start' }),
      A(poly([[690, 292], [690, 236], [220, 236], [220, 292]], 26), C.gas, '烟气余热 → 预热空气与原料油', 455, 236, { dash: '10 10' })
    ];
    S.order = [[0, 0.7], ['a', 0, 1.5], [1, 2.0], ['a', 1, 2.8], [2, 3.3], ['a', 2, 4.1], [3, 4.6], ['a', 3, 5.4], [4, 5.9], ['a', 4, 6.6], ['a', 5, 7.2]];
  },
  update(t, S) {
    for (const o of S.order) {
      if (o[0] === 'a') {
        const a = S.arrows[o[1]], k = seg(t, o[2], o[2] + 0.5);
        a.p.set(t, k, seg(t, o[2] + 0.4, o[2] + 0.8));
        if (a.l) vis(a.l, seg(t, o[2] + 0.4, o[2] + 0.8));
      } else popH(S.blocks[o[0]], t, o[1], 0.5);
    }
    const hi = t > 8 && t < 15.4 ? Math.floor((t - 8) / 1.5) % 5 : -1;
    S.blocks.forEach((b, i) => b.classList.toggle('glow', i === hi));
  }
});

/* ================= ① 供料工序 ================= */
scene({
  key: 'feed', section: 1, dur: 29, menu: '① 供料工序',
  chap: { num: '01', t: '供料工序', s: '储罐 → 过滤 → 泵送 → 预热 → 喷入反应炉', c: SEC[1] },
  caps: [
    [0.3, 6.8, '原料油（煤焦油、乙烯焦油、富芳烃油、催化油浆等）<br>先储存在原料油储罐中。'],
    [6.9, 12.2, '原料油经过滤器滤除油渣，再由原料油泵加压送出。'],
    [12.3, 17.6, '在原料油预热器中，与急冷后的高温炭黑烟气换热，预热到约 280 ℃。'],
    [17.7, 22.4, '预热后的原料油经喷嘴，喷入反应炉的喉管段。'],
    [22.5, 28.6, '长鸿炭黑：国内首家以富芳烃油为原料，<br>工艺可去除原料杂质，重金属检测未检出。']
  ],
  build(svg, html, S) {
    S.pIn = pipe(svg, poly([[0, 330], [158, 330]]), C.oil);
    S.inLbl = tlabel(svg, 22, 292, '原料油', { size: 22, anchor: 'start', pill: '#FFF4E0', stroke: C.oil });
    S.tank = vtank(svg, 160, 280, 230, 420, { fill: '#D08F2A', surf: '#E0A544' });
    S.tankPlate = plate(svg, 275, 470, '原料油储罐', { color: SEC[1] });
    S.chipsTitle = div(html, '', '常见原料：', 'position:absolute;left:160px;top:168px;font-size:24px;font-weight:800;color:#5B6470');
    S.chips = ['煤焦油', '乙烯焦油', '富芳烃油', '催化油浆'].map((s, i) => div(html, 'chip', s, `position:absolute;left:${288 + [0, 132, 290, 448][i]}px;top:158px;--c:${SEC[1]}`));
    // 过滤器
    S.p1 = pipe(svg, poly([[392, 650], [502, 650]]), C.oil);
    S.filter = el('g', {}, svg);
    vtank(S.filter, 505, 575, 90, 170);
    el('rect', { x: 520, y: 612, width: 60, height: 92, rx: 6, fill: '#F8F9FA', stroke: '#8A949E', 'stroke-width': 2 }, S.filter);
    el('rect', { x: 526, y: 618, width: 48, height: 58, fill: 'url(#mesh)' }, S.filter);
    S.sludge = [];
    const R = rng(21);
    for (let i = 0; i < 16; i++) S.sludge.push(el('circle', { cx: 528 + R() * 44, cy: 698 - Math.floor(i / 6) * 7 - R() * 3, r: 3 + R() * 2.5, fill: '#5C4A3A' }, S.filter));
    S.filterPlate = plate(svg, 550, 790, '原料油过滤器', { color: SEC[1] });
    S.filterNote = tlabel(svg, 550, 540, '滤除油渣', { size: 22, pill: '#FFF', stroke: '#8A949E' });
    // 泵
    S.p2 = pipe(svg, poly([[598, 700], [688, 700]]), C.oil);
    S.pump = pumpShape(svg, 745, 700, 52);
    S.pumpPlate = plate(svg, 745, 790, '原料油泵', { color: SEC[1] });
    // 预热器
    S.p3 = pipe(svg, poly([[745, 646], [745, 440], [858, 440]]), C.oil);
    S.ph = hcyl(svg, 860, 370, 420, 140);
    S.phIn = el('g', {}, svg);
    for (let k = 0; k < 4; k++) el('line', { x1: 895, y1: 398 + k * 28, x2: 1245, y2: 398 + k * 28, stroke: '#9AA4AE', 'stroke-width': 5, 'stroke-linecap': 'round' }, S.phIn);
    S.phOil = el('path', { d: 'M 890,440 H 1250', stroke: C.oil, 'stroke-width': 9, 'stroke-dasharray': '15 11', fill: 'none', 'stroke-linecap': 'round' }, svg);
    S.phPlate = plate(svg, 1070, 548, '原料油预热器', { color: SEC[1] });
    S.pGas = pipe(svg, poly([[1215, 238], [1215, 368]]), C.gas);
    S.gasLbl = tlabel(svg, 1215, 212, '急冷后的高温炭黑烟气', { size: 22, pill: '#FFF1EC', stroke: C.gas });
    S.pGasOut = pipe(svg, poly([[925, 512], [925, 600]]), '#D9480F');
    S.gasOutLbl = tlabel(svg, 945, 604, '→ 二次急冷', { size: 21, anchor: 'start', fill: C.sub, weight: 700 });
    S.badge = tlabel(svg, 1352, 398, '≈280 ℃', { size: 26, pill: C.oilHot, fill: '#fff', weight: 900 });
    // 反应炉喉管（局部）
    S.p4 = pipe(svg, poly([[1282, 440], [1440, 440], [1440, 250], [1640, 250], [1640, 388]]), C.oilHot);
    S.rx = el('g', {}, svg);
    const out = 'M 1480,330 H 1580 L 1612,392 H 1668 L 1700,335 H 1920 V 525 H 1700 L 1668,468 H 1612 L 1580,530 H 1480 Z';
    const inn = 'M 1480,344 H 1574 L 1606,404 H 1674 L 1706,349 H 1920 V 511 H 1706 L 1674,456 H 1606 L 1574,516 H 1480 Z';
    el('path', { d: out, fill: 'url(#bricks)', stroke: C.line, 'stroke-width': 4, filter: 'url(#shadow)' }, S.rx);
    const gid = uid('fg');
    const lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 1480, y1: 0, x2: 1920, y2: 0 }, S.rx);
    [['0', '#FFC857'], ['.35', '#FF9B45'], ['.55', '#F0642F'], ['1', '#9E3524']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, lg));
    el('path', { d: inn, fill: `url(#${gid})` }, S.rx);
    const rc = uid('rc'); const rcp = el('clipPath', { id: rc }, S.rx); el('path', { d: inn }, rcp);
    S.rxIn = el('g', { 'clip-path': `url(#${rc})` }, S.rx);
    S.rxFl = [0, 1, 2].map(() => el('path', { fill: 'url(#flameLin)', opacity: .85 }, S.rxIn));
    S.rxStreak = [0, 1, 2, 3].map(i => el('line', { x1: 1480, y1: 380 + i * 30, x2: 1920, y2: 380 + i * 30, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '26 60', opacity: .35 }, S.rxIn));
    S.drops = [];
    for (let i = 0; i < 26; i++) S.drops.push(el('circle', { r: 4, fill: 'url(#oilBall)' }, S.rxIn));
    S.rxPlate = plate(svg, 1700, 585, '反应炉 · 喉管段', { color: SEC[2] });
    // 公司卡片
    S.card = div(html, 'card co-card', `<h4><span class="tag co">长鸿炭黑</span>原料优势</h4><ul><li>国内首家以<span class="em">富芳烃油</span>为原料生产炭黑</li><li>工艺可去除原料杂质，<span class="em">重金属检测未检出（ND）</span></li></ul>`, 'left:1000px;top:648px;width:640px');
  },
  update(t, S) {
    S.pIn.set(t, seg(t, 0, 0.6), seg(t, 0.3, 0.8));
    vis(S.inLbl, seg(t, 0.3, 0.8));
    popG(S.tank.g, t, 0, 275, 490, 0.01);
    S.tank.setLevel(0.12 + 0.62 * eio(seg(t, 0.2, 3.0)));
    vis(S.tankPlate, seg(t, 0.4, 0.9));
    popH(S.chipsTitle, t, 1.1);
    S.chips.forEach((c, i) => popH(c, t, 1.4 + i * 0.4));
    S.p1.set(t, seg(t, 6.9, 7.5), seg(t, 7.3, 7.7));
    popG(S.filter, t, 7.0, 550, 660);
    vis(S.filterPlate, seg(t, 7.3, 7.8));
    vis(S.filterNote, seg(t, 8.0, 8.5));
    const sl = seg(t, 8.0, 12.5);
    S.sludge.forEach((s, i) => { s.style.opacity = clamp(sl * 16 - i); });
    S.p2.set(t, seg(t, 9.2, 9.7), seg(t, 9.6, 10.0));
    popG(S.pump.g, t, 9.2, 745, 700);
    S.pump.set(t, t > 9.6 ? 1 : 0);
    vis(S.pumpPlate, seg(t, 9.5, 10.0));
    S.p3.set(t, seg(t, 12.3, 13.0), seg(t, 12.9, 13.3));
    popG(S.ph.g, t, 12.4, 1070, 440);
    vis(S.phIn, seg(t, 12.6, 13.0));
    vis(S.phPlate, seg(t, 12.8, 13.3));
    S.pGas.set(t, seg(t, 13.1, 13.7), seg(t, 13.6, 14.0));
    vis(S.gasLbl, seg(t, 13.6, 14.1));
    S.pGasOut.set(t, seg(t, 13.9, 14.4), seg(t, 14.3, 14.7));
    vis(S.gasOutLbl, seg(t, 14.3, 14.8));
    S.phOil.style.opacity = seg(t, 13.3, 13.8);
    const heat = seg(t, 14.0, 16.5);
    S.phOil.setAttribute('stroke', mix('#C8861B', '#E36414', heat));
    S.phOil.setAttribute('stroke-dashoffset', -t * 70);
    popG(S.badge, t, 16.2, 1352, 398);
    S.p4.set(t, seg(t, 17.7, 18.6), seg(t, 18.4, 18.8));
    popG(S.rx, t, 17.8, 1700, 430);
    vis(S.rxPlate, seg(t, 18.1, 18.6));
    S.rxFl.forEach((f, i) => f.setAttribute('d', flameD(1482, 395 + i * 32, 150 + i * 20, 34, t, i * 2.1)));
    S.rxStreak.forEach((s, i) => s.setAttribute('stroke-dashoffset', -t * (360 + i * 40)));
    const sp = seg(t, 18.8, 19.3);
    S.drops.forEach((d, i) => {
      const s = fract(i / S.drops.length + t * 1.4);
      const side = i % 2;
      const x0 = 1630 + side * 20, y0 = 406;
      const x = x0 + s * 170 + s * s * 90, y = y0 + (1 - Math.pow(1 - s, 2)) * (side ? 44 : 30) + Math.sin(i * 1.7) * 6 * s;
      d.setAttribute('cx', x); d.setAttribute('cy', y);
      d.setAttribute('r', Math.max(0.5, 5.2 * Math.pow(1 - s, 0.7)));
      d.style.opacity = sp * (1 - s);
    });
    popH(S.card, t, 22.6);
  }
});

/* ================= ② 反应工序 ================= */
scene({
  key: 'reactor', section: 2, dur: 58, menu: '② 炭黑反应工序',
  chap: { num: '02', t: '炭黑反应工序', s: '燃烧段 · 喉管段 · 反应段 · 急冷段', c: SEC[2] },
  caps: [
    [0.3, 5.9, '反应炉是核心设备，依次分为燃烧段、喉管段、反应段和急冷段。'],
    [6.0, 12.4, '燃料（焦炉煤气或天然气）与约 850 ℃ 的预热空气燃烧，<br>产生 1300 ℃ 以上的高温烟气。'],
    [12.5, 19.6, '高温烟气高速穿过喉管，原料油经喷嘴喷入，迅速汽化、裂解，生成炭黑。'],
    [19.7, 26.2, '微观上：油雾汽化裂解 → 成核 → 长成原生粒子 → 碰撞熔结成聚集体。'],
    [26.3, 32.2, '聚集体十分牢固，称为“永久结构”；从油雾到聚集体，全程只需毫秒级时间。'],
    [32.3, 39.8, '在急冷段喷入急冷水，温度骤降，炭黑生成反应随即终止。'],
    [39.9, 46.1, '反应段可加入 K<sub>2</sub>CO<sub>3</sub> 调节结构度（吸油值）；<br>炉型与操作条件决定粒径，也就决定了牌号。'],
    [46.2, 52.0, '粒径越细，比表面积（吸碘值）越高、补强越强，但收率越低、能耗越高。'],
    [52.1, 57.6, '所以价格大致是 N220 ＞ N330 ＞ N550；<br>具体报价还随原料和市场行情变动。']
  ],
  build(svg, html, S) {
    const xL = 230, xC = 660, xT1 = 735, xT2 = 805, xR = 880, xE = 1800, cy = 370;
    S.geo = { xL, xC, xT1, xT2, xR, xE, cy };
    // 进料管线（画在炉体下层）
    S.fuel = pipe(svg, poly([[0, 370], [206, 370]]), C.fuel, { w: 10 });
    S.fuelLbl = el('g', {}, svg);
    tlabel(S.fuelLbl, 100, 326, '燃料', { size: 23, pill: '#E6FCF5', stroke: C.fuel });
    tlabel(S.fuelLbl, 110, 418, '焦炉煤气 / 天然气', { size: 20, fill: C.sub, weight: 700 });
    S.air = pipe(svg, poly([[420, 196], [420, 256]]), C.airHot, { w: 14 });
    S.airLbl = tlabel(svg, 420, 172, '预热空气 ≈850 ℃', { size: 22, pill: '#FFF4E6', stroke: C.airHot });
    S.oil = pipe(svg, poly([[770, 196], [770, 326]]), C.oilHot, { w: 10 });
    S.oilLbl = tlabel(svg, 770, 172, '原料油 ≈280 ℃', { size: 22, pill: '#FFF4E0', stroke: C.oil });
    S.k2 = pipe(svg, poly([[960, 196], [960, 266]]), C.k2co3, { w: 9 });
    S.k2Lbl = tlabel(svg, 960, 172, '添加剂 K_2CO_3', { size: 22, pill: '#EBFBEE', stroke: C.k2co3 });
    S.q1 = pipe(svg, poly([[1450, 196], [1450, 266]]), C.water, { w: 9 });
    S.q2 = pipe(svg, poly([[1630, 196], [1630, 266]]), C.water, { w: 9 });
    S.qLbl = tlabel(svg, 1540, 172, '一次急冷水', { size: 22, pill: '#E7F5FF', stroke: C.water });
    // 炉体
    const outer = `M ${xL},255 H ${xC} L ${xT1},325 H ${xT2} L ${xR},265 H ${xE} V 475 H ${xR} L ${xT2},415 H ${xT1} L ${xC},485 H ${xL} Z`;
    const mid = `M ${xL + 9},264 H ${xC - 4} L ${xT1 - 2},334 H ${xT2 + 2} L ${xR + 4},274 H ${xE} V 466 H ${xR + 4} L ${xT2 + 2},406 H ${xT1 - 2} L ${xC - 4},476 H ${xL + 9} Z`;
    const inner = `M ${xL + 22},277 H ${xC - 9} L ${xT1 - 5},347 H ${xT2 + 5} L ${xR + 9},287 H ${xE} V 453 H ${xR + 9} L ${xT2 + 5},393 H ${xT1 - 5} L ${xC - 9},463 H ${xL + 22} Z`;
    S.body = el('g', {}, svg);
    S.shell = el('path', { d: outer, fill: 'url(#steelH)', stroke: 'none', filter: 'url(#shadow)' }, S.body);
    el('path', { d: mid, fill: 'url(#bricks)' }, S.body);
    const gid = uid('gas');
    const lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: xL, y1: 0, x2: xE, y2: 0 }, svg);
    S.offs = [0, 0.18, 0.3, 0.42, 0.5, 0.62, 0.72, 0.78, 1];
    S.stops = S.offs.map(o => el('stop', { offset: o, 'stop-color': '#3B4048' }, lg));
    el('path', { d: inner, fill: `url(#${gid})` }, S.body);
    const cid = uid('rc'); const cp = el('clipPath', { id: cid }, svg); el('path', { d: inner }, cp);
    S.in = el('g', { 'clip-path': `url(#${cid})` }, S.body);
    S.glow = el('ellipse', { cx: 420, cy: cy, rx: 230, ry: 110, fill: 'url(#hotGlow)' }, S.in);
    S.streaks = [];
    for (let i = 0; i < 7; i++) S.streaks.push(el('line', { x1: xL, y1: 300 + i * 23, x2: xE, y2: 300 + i * 23, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': `${28 + i * 6} ${70 + i * 9}` }, S.in));
    S.flames = [0, 1, 2, 3, 4].map(() => el('path', { fill: 'url(#flameLin)' }, S.in));
    S.drops = [];
    for (let i = 0; i < 40; i++) S.drops.push(el('circle', { r: 4, fill: 'url(#oilBall)' }, S.in));
    const R = rng(99);
    S.cps = [];
    for (let i = 0; i < 120; i++) S.cps.push({ c: el('circle', { r: 2, fill: 'url(#cbBall)' }, S.in), off: R(), yj: R(), sp: 0.85 + 0.3 * R(), ph: R() * 6.28 });
    S.sprays = [sprayCone(S.in, 1450, 287, 160, 62, C.water, 16, 4), sprayCone(S.in, 1630, 287, 160, 62, C.water, 16, 8)];
    S.outline = el('path', { d: outer, fill: 'none', stroke: C.line, 'stroke-width': 4, pathLength: 1, 'stroke-linejoin': 'round' }, S.body);
    el('rect', { x: 204, y: 336, width: 28, height: 68, rx: 5, fill: 'url(#steelDark)', stroke: C.line, 'stroke-width': 2.5 }, S.body);
    // 出口
    S.exit = el('g', {}, svg);
    el('rect', { x: 1800, y: 328, width: 130, height: 84, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 3 }, S.exit);
    S.exitFlow = el('line', { x1: 1800, y1: 370, x2: 1930, y2: 370, stroke: '#6A2B24', 'stroke-width': 26, 'stroke-dasharray': '22 14' }, S.exit);
    tlabel(S.exit, 1900, 296, '→ 空气预热器', { size: 21, anchor: 'end', pill: '#fff', stroke: '#C9D0D8' });
    // 分段标注
    S.secs = [[xL, xC, '燃烧段', '#F59F00'], [xC, xR, '喉管段', '#E8590C'], [xR, 1340, '反应段', '#C92A2A'], [1340, xE, '急冷段', '#1C7ED6']].map(([a, b, s, c]) => {
      const g = el('g', {}, svg);
      el('rect', { x: a + 6, y: 505, width: b - a - 12, height: 7, rx: 3.5, fill: c }, g);
      tlabel(g, (a + b) / 2, 540, s, { size: 27, weight: 900, fill: c });
      return g;
    });
    S.temp = tlabel(svg, 445, 578, '1300 ℃ 以上的高温烟气', { size: 21, fill: '#C2410C', weight: 800 });
    S.stop = tlabel(svg, 1570, 578, '温度骤降 → 反应终止', { size: 21, fill: '#1C7ED6', weight: 800 });
    S.k2ring = el('circle', { cx: 960, cy: 266, r: 20, fill: 'none', stroke: C.k2co3, 'stroke-width': 4 }, svg);
    // 微观放大
    S.inset = el('g', {}, svg);
    el('rect', { x: 120, y: 604, width: 890, height: 262, rx: 20, fill: '#fff', stroke: '#D3D9E0', 'stroke-width': 2, filter: 'url(#shadow)' }, S.inset);
    tlabel(S.inset, 148, 640, '微观放大：炭黑粒子的形成', { size: 26, weight: 900, anchor: 'start' });
    S.timer = tlabel(S.inset, 985, 640, '全程：毫秒级', { size: 22, anchor: 'end', pill: '#FFF4E6', stroke: '#F08C00', fill: '#C2410C' });
    const xs = [220, 400, 578, 756, 918], sy = 740;
    S.stg = [];
    let g = el('g', {}, S.inset);   // 油雾滴
    [[204, 732, 19], [243, 757, 13], [232, 708, 9]].forEach(([x, y, r]) => el('circle', { cx: x, cy: y, r, fill: 'url(#oilBall)' }, g));
    S.stg.push(g);
    g = el('g', {}, S.inset);       // 汽化裂解
    const R2 = rng(12);
    for (let i = 0; i < 18; i++) { const a = R2() * 6.28, d = 8 + R2() * 42; el('circle', { cx: xs[1] + Math.cos(a) * d, cy: sy + Math.sin(a) * d * 0.8, r: 2.5 + R2() * 2.5, fill: i % 3 ? '#F59F3A' : '#FFC857', opacity: .85 }, g); }
    S.stg.push(g);
    g = el('g', {}, S.inset);       // 成核
    for (let i = 0; i < 11; i++) { const a = R2() * 6.28, d = 6 + R2() * 38; el('circle', { cx: xs[2] + Math.cos(a) * d, cy: sy + Math.sin(a) * d * 0.8, r: 3 + R2() * 2.5, fill: '#1A1B1E' }, g); }
    S.stg.push(g);
    g = el('g', {}, S.inset);       // 原生粒子（准石墨同心结构）
    const big = el('g', { transform: `translate(${xs[3] - 8},${sy - 4})` }, g);
    el('circle', { cx: 0, cy: 0, r: 30, fill: 'url(#cbBall)' }, big);
    for (let k = 1; k <= 4; k++) el('circle', { cx: 0, cy: 0, r: 30 - k * 6, fill: 'none', stroke: 'rgba(214,219,226,.42)', 'stroke-width': 1.6 }, big);
    el('circle', { cx: xs[3] + 34, cy: sy + 22, r: 13, fill: 'url(#cbBall)' }, g);
    el('circle', { cx: xs[3] + 30, cy: sy - 30, r: 11, fill: 'url(#cbBall)' }, g);
    S.stg.push(g);
    g = el('g', {}, S.inset);       // 聚集体
    S.aggPts = makeAggregate(9, 13, 17);
    S.agg = drawAggregate(g, S.aggPts, 13);
    S.agg.g.setAttribute('transform', `translate(${xs[4]},${sy})`);
    S.aggScatter = S.aggPts.map((p, i) => ({ dx: Math.cos(i * 2.4) * 34, dy: Math.sin(i * 2.4) * 30 }));
    S.stg.push(g);
    S.chev = [0, 1, 2, 3].map(i => el('path', { d: `M ${(xs[i] + xs[i + 1]) / 2 - 7},${sy - 12} L ${(xs[i] + xs[i + 1]) / 2 + 6},${sy} L ${(xs[i] + xs[i + 1]) / 2 - 7},${sy + 12}`, fill: 'none', stroke: '#98A2B3', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.inset));
    S.stLbl = [['油雾滴', ''], ['汽化 · 裂解', ''], ['成核', ''], ['原生粒子', '准石墨微晶'], ['聚集体', '熔结 · 永久结构']].map(([a, b], i) => {
      const gg = el('g', {}, S.inset);
      tlabel(gg, xs[i], 812, a, { size: 23, weight: 800 });
      if (b) tlabel(gg, xs[i], 842, b, { size: 18, fill: C.sub, weight: 600 });
      return gg;
    });
    // 知识卡
    S.card = div(html, 'card', `<h4><span class="tag gen">通用</span>反应条件决定牌号</h4>
      <table><tr><th>牌号</th><th>粒径（通用）</th><th>吸碘值（长鸿 TDS）</th><th>相对价格</th></tr>
      <tr><td><b>N220</b></td><td>20–25 nm</td><td>121±6 g/kg</td><td>高</td></tr>
      <tr><td><b>N330</b></td><td>26–30 nm</td><td>82±6 g/kg</td><td>中</td></tr>
      <tr><td><b>N550</b></td><td>40–48 nm</td><td>39–47 g/kg</td><td>低</td></tr></table>
      <div class="muted" style="margin-top:8px">粒径越细 → 比表面积越大、补强越强；但收率越低、能耗越高</div>`, 'left:1062px;top:600px;width:738px;padding:16px 24px 16px');
  },
  update(t, S) {
    const { xL, xT2, xR, xE, cy } = S.geo;
    const draw = eio(seg(t, 0.1, 1.8));
    S.outline.setAttribute('stroke-dasharray', `${draw} 2`);
    S.shell.style.opacity = seg(t, 0.8, 2.0);
    [...S.body.children].forEach(ch => { if (ch !== S.outline && ch !== S.shell) ch.style.opacity = seg(t, 1.0, 2.2); });
    S.secs.forEach((g, i) => vis(g, seg(t, 1.6 + i * 0.35, 2.1 + i * 0.35)));
    const fire = eio(seg(t, 6.2, 8.6)), carbon = eio(seg(t, 14.0, 17.0)), quench = eio(seg(t, 33.2, 35.6));
    S.fuel.set(t, seg(t, 5.9, 6.4), seg(t, 6.2, 6.6)); vis(S.fuelLbl, seg(t, 6.0, 6.5));
    S.air.set(t, seg(t, 6.2, 6.7), seg(t, 6.5, 6.9)); vis(S.airLbl, seg(t, 6.3, 6.8));
    S.oil.set(t, seg(t, 12.6, 13.1), seg(t, 12.9, 13.3)); vis(S.oilLbl, seg(t, 12.7, 13.2));
    S.k2.set(t, seg(t, 40.0, 40.6), seg(t, 40.4, 40.8)); vis(S.k2Lbl, seg(t, 40.2, 40.7));
    S.q1.set(t, seg(t, 32.4, 32.9), seg(t, 32.8, 33.2)); S.q2.set(t, seg(t, 32.6, 33.1), seg(t, 33.0, 33.4)); vis(S.qLbl, seg(t, 32.6, 33.1));
    const cold = ['#3B4048', '#3B4048', '#3B4048', '#3B4048', '#3B4048', '#3B4048', '#3B4048', '#3B4048', '#3B4048'];
    const hot = ['#FFF3C4', '#FFC857', '#FF9B45', '#F0642F', '#D9482B', '#C23B26', '#B03424', '#A83224', '#9C2F22'];
    const smoky = ['#FFF3C4', '#FFC857', '#FF9B45', '#E8572C', '#A33A26', '#74302A', '#5E2C28', '#582A28', '#50292A'];
    const cool = ['#FFF3C4', '#FFC857', '#FF9B45', '#E8572C', '#A33A26', '#74302A', '#5E2C28', '#474B52', '#3F434A'];
    S.stops.forEach((s, i) => {
      let c = mix(cold[i], hot[i], fire);
      if (carbon > 0) c = mix(hot[i], smoky[i], carbon);
      if (quench > 0 && i >= 7) c = mix(smoky[i], cool[i], quench);
      s.setAttribute('stop-color', c);
    });
    vis(S.glow, fire * 0.9);
    S.streaks.forEach((l, i) => { l.setAttribute('stroke-dashoffset', -t * (420 + i * 35)); l.style.opacity = 0.28 * fire; });
    S.flames.forEach((f, i) => {
      f.setAttribute('d', flameD(xL + 4, cy + (i - 2) * 33, (250 + (i % 3) * 55) * (0.4 + 0.6 * fire), 36 + (i % 2) * 10, t, i * 1.9));
      f.style.opacity = fire;
    });
    popG(S.temp, t, 8.4, 445, 578);
    const oilOn = seg(t, 13.1, 13.7);
    S.drops.forEach((d, i) => {
      const s = fract(i / S.drops.length + t * 1.5);
      const x0 = 752 + (i % 3) * 18, y0 = 349;
      d.setAttribute('cx', x0 + s * 180 + s * s * 120);
      d.setAttribute('cy', y0 + (1 - Math.pow(1 - s, 2)) * (18 + (i % 5) * 9));
      d.setAttribute('r', Math.max(0.5, 5.5 * Math.pow(1 - s, 0.75)));
      d.style.opacity = oilOn * (1 - s);
    });
    S.cps.forEach(p => {
      const L = xE + 40 - xT2;
      const x = xT2 + 10 + fract(p.off + t * 0.3 * p.sp) * L;
      const hh = x < xR ? lerp(38, 80, (x - xT2) / (xR - xT2)) : 80;
      const y = cy + (p.yj - 0.5) * 2 * hh + Math.sin(t * 3 + p.ph) * 4;
      const grow = clamp((x - xT2) / 420);
      p.c.setAttribute('cx', x); p.c.setAttribute('cy', y);
      p.c.setAttribute('r', 1.4 + 5.2 * grow);
      p.c.style.opacity = carbon * clamp((x - xT2 - 10) / 40);
    });
    S.sprays.forEach(s => s.set(t, quench));
    vis(S.stop, seg(t, 35.4, 36.0));
    vis(S.exit, seg(t, 1.8, 2.6));
    S.exitFlow.setAttribute('stroke-dashoffset', -t * 120);
    S.exitFlow.setAttribute('stroke', mix('#9C2F22', '#474B52', quench));
    S.exitFlow.style.opacity = fire;
    const kr = seg(t, 40.6, 46);
    S.k2ring.style.opacity = kr > 0 && kr < 1 ? 0.9 * (1 - fract(t * 1.2)) : 0;
    S.k2ring.setAttribute('r', 16 + fract(t * 1.2) * 26);
    // 微观放大
    popG(S.inset, t, 19.7, 565, 735, 0.5);
    const ts = [20.2, 21.6, 23.0, 24.4, 25.6];
    S.stg.forEach((g, i) => popG(g, t, ts[i], [220, 400, 578, 756, 918][i], 740, 0.45));
    S.chev.forEach((c, i) => { c.style.opacity = seg(t, ts[i] + 0.4, ts[i + 1]); });
    S.stLbl.forEach((g, i) => vis(g, seg(t, ts[i] + 0.2, ts[i] + 0.6)));
    const conv = eio(seg(t, 25.7, 27.6));
    S.agg.spheres.forEach((s, i) => {
      const sc = S.aggScatter[i];
      s.s.setAttribute('transform', `translate(${s.p.x + sc.dx * (1 - conv)},${s.p.y + sc.dy * (1 - conv)})`);
    });
    S.agg.necks.forEach(n => { n.e.style.opacity = seg(t, 27.2, 27.9); });
    vis(S.timer, seg(t, 27.4, 28.0));
    popH(S.card, t, 46.3);
  }
});

/* ================= ② 换热降温 ================= */
scene({
  key: 'heat', section: 2, dur: 26, menu: '② 换热降温',
  chap: { num: '02', t: '炭黑反应工序', s: '急冷后：换热回收 → 二次急冷 → ≤250 ℃', c: SEC[2] },
  caps: [
    [0.3, 7.5, '急冷后的炭黑烟气仍然很热，先进入空气预热器，<br>把助燃空气加热到约 850 ℃，送回燃烧段。'],
    [7.6, 12.8, '烟气还可以经过余热锅炉，回收热量、产生蒸汽。'],
    [12.9, 18.0, '随后流经原料油预热器，把原料油预热到约 280 ℃。'],
    [18.1, 25.6, '最后经二次喷水急冷，温度降到 250 ℃ 以下，进入炭黑收集系统。']
  ],
  build(svg, html, S) {
    S.stub = el('g', {}, svg);
    el('path', { d: 'M 0,405 H 200 V 555 H 0 Z', fill: 'url(#bricks)', stroke: C.line, 'stroke-width': 3 }, S.stub);
    el('rect', { x: 0, y: 420, width: 200, height: 120, fill: '#5E2C28' }, S.stub);
    tlabel(S.stub, 100, 378, '反应炉急冷段出口', { size: 21, fill: C.sub, weight: 800 });
    const seg5 = [[[200, 480], [298, 480]], [[442, 480], [558, 480]], [[742, 480], [858, 480]], [[1162, 480], [1288, 480]], [[1412, 480], [1556, 480]]];
    const cols = ['#C92A2A', '#E8590C', '#F08C00', '#A07A00', '#5C6670'];
    S.smoke = seg5.map((p, i) => pipe(svg, poly(p), cols[i], { w: 14, dash: '18 12', speed: 90 }));
    S.dots = seg5.map((p, i) => stream(svg, poly(p), { n: 9, r: 3.4, speed: 90, jit: 8, seed: 30 + i }));
    // 空气预热器
    S.ap = vtank(svg, 300, 300, 140, 380);
    S.apPlate = plate(svg, 370, 395, '空气预热器', { color: SEC[2] });
    S.airIn = pipe(svg, poly([[370, 800], [370, 686]]), C.air, { w: 12 });
    S.airInLbl = tlabel(svg, 392, 790, '常温空气', { size: 22, anchor: 'start', pill: '#E7F5FF', stroke: C.air });
    S.airOut = pipe(svg, poly([[370, 298], [370, 222], [30, 222]]), C.airHot, { w: 12 });
    S.airOutLbl = tlabel(svg, 200, 190, '≈850 ℃ 热空气 → 燃烧段', { size: 22, pill: '#FFF4E6', stroke: C.airHot });
    // 余热锅炉（可选）
    S.wb = el('g', {}, svg);
    el('rect', { x: 560, y: 392, width: 180, height: 196, rx: 12, fill: 'rgba(255,255,255,.75)', stroke: '#868E96', 'stroke-width': 3, 'stroke-dasharray': '12 9' }, S.wb);
    el('path', { d: 'M 585,430 C 615,410 625,450 655,430 S 695,450 715,430 M 585,520 C 615,500 625,540 655,520 S 695,540 715,520', stroke: '#74C0FC', 'stroke-width': 5, fill: 'none' }, S.wb);
    hcyl(S.wb, 578, 330, 144, 42);
    S.wbPlate = plate(svg, 650, 556, '余热锅炉（可选）', { size: 22, color: '#ADB5BD' });
    S.steam = wisps(svg, 650, 322, 10, { rise: 130, spread: 40, drift: 20, r: 11, color: '#DEE2E6', op: 0.8 });
    S.steamLbl = tlabel(svg, 730, 262, '蒸汽', { size: 22, anchor: 'start', fill: C.sub, weight: 800 });
    // 原料油预热器
    S.oph = hcyl(svg, 860, 420, 300, 120);
    S.ophPlate = plate(svg, 1010, 480, '原料油预热器', { color: SEC[1] });
    S.oilIn = pipe(svg, poly([[905, 730], [905, 542]]), C.oil, { w: 10 });
    S.oilInLbl = tlabel(svg, 928, 718, '原料油', { size: 22, anchor: 'start', pill: '#FFF4E0', stroke: C.oil });
    S.oilOut = pipe(svg, poly([[1118, 418], [1118, 300]]), C.oilHot, { w: 10 });
    S.oilOutLbl = tlabel(svg, 1118, 268, '≈280 ℃ 原料油 → 喷嘴', { size: 22, pill: '#FFF4E0', stroke: C.oilHot });
    // 二次急冷
    S.qt = vtank(svg, 1290, 300, 120, 360);
    S.qSpray = sprayCone(svg, 1350, 332, 150, 44, C.water, 14, 11);
    S.qtPlate = plate(svg, 1350, 600, '二次急冷', { color: '#1C7ED6' });
    S.qWater = pipe(svg, poly([[1350, 212], [1350, 304]]), C.water, { w: 10 });
    S.qWaterLbl = tlabel(svg, 1350, 188, '二次急冷水', { size: 22, pill: '#E7F5FF', stroke: C.water });
    S.t250 = tlabel(svg, 1484, 436, '≤250 ℃', { size: 26, pill: '#343A40', fill: '#fff', weight: 900 });
    // 主袋滤器（局部）
    S.bf = el('g', {}, svg);
    el('path', { d: 'M 1560,316 Q 1560,300 1576,300 H 1784 Q 1800,300 1800,316 V 640 L 1712,720 H 1648 L 1560,640 Z', fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.bf);
    for (let i = 0; i < 4; i++) el('rect', { x: 1590 + i * 52, y: 360, width: 26, height: 240, rx: 13, fill: '#3A3C40', opacity: .8 }, S.bf);
    S.bfPlate = plate(svg, 1680, 430, '主袋滤器', { color: SEC[3] });
    S.bfLbl = tlabel(svg, 1680, 760, '→ 进入收集系统', { size: 22, fill: C.sub, weight: 800 });
  },
  update(t, S) {
    vis(S.stub, seg(t, 0, 0.5));
    const sT = [0.3, 7.7, 13.0, 18.2, 20.0];
    S.smoke.forEach((p, i) => p.set(t, seg(t, sT[i], sT[i] + 0.6), seg(t, sT[i] + 0.5, sT[i] + 0.9)));
    S.dots.forEach((d, i) => d.set(t, seg(t, sT[i] + 0.5, sT[i] + 0.9)));
    popG(S.ap.g, t, 0.7, 370, 490); vis(S.apPlate, seg(t, 1.0, 1.4));
    S.airIn.set(t, seg(t, 1.8, 2.4), seg(t, 2.2, 2.6)); vis(S.airInLbl, seg(t, 2.0, 2.5));
    S.airOut.set(t, seg(t, 3.0, 4.2), seg(t, 4.0, 4.4)); vis(S.airOutLbl, seg(t, 4.1, 4.6));
    popG(S.wb, t, 7.7, 650, 480); vis(S.wbPlate, seg(t, 8.0, 8.4));
    S.steam.set(t, seg(t, 8.6, 9.4)); vis(S.steamLbl, seg(t, 9.0, 9.5));
    popG(S.oph.g, t, 13.1, 1010, 480); vis(S.ophPlate, seg(t, 13.4, 13.8));
    S.oilIn.set(t, seg(t, 13.9, 14.5), seg(t, 14.4, 14.8)); vis(S.oilInLbl, seg(t, 14.1, 14.6));
    S.oilOut.set(t, seg(t, 15.0, 15.6), seg(t, 15.5, 15.9)); vis(S.oilOutLbl, seg(t, 15.6, 16.1));
    popG(S.qt.g, t, 18.3, 1350, 480); vis(S.qtPlate, seg(t, 18.6, 19.0));
    S.qWater.set(t, seg(t, 18.8, 19.3), seg(t, 19.2, 19.6)); vis(S.qWaterLbl, seg(t, 19.0, 19.5));
    S.qSpray.set(t, seg(t, 19.4, 19.9));
    popG(S.bf, t, 20.2, 1680, 510); vis(S.bfPlate, seg(t, 20.5, 20.9));
    popG(S.t250, t, 21.0, 1484, 436);
    vis(S.bfLbl, seg(t, 21.6, 22.1));
  }
});

/* 袋滤器（带滤袋、灰斗、气密阀） */
function bagFilter(g, x, y, w, h, nb, o = {}) {
  const hop = o.hop || 100, outW = o.outW || 64, grp = el('g', {}, g);
  const d = `M ${x},${y + 16} Q ${x},${y} ${x + 16},${y} H ${x + w - 16} Q ${x + w},${y} ${x + w},${y + 16} V ${y + h} L ${x + w / 2 + outW / 2},${y + h + hop} H ${x + w / 2 - outW / 2} L ${x},${y + h} Z`;
  el('path', { d, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, grp);
  const ins = 14, wy = y + 50;
  const winD = `M ${x + ins},${wy} H ${x + w - ins} V ${y + h - 4} L ${x + w / 2 + outW / 2 - 8},${y + h + hop - 12} H ${x + w / 2 - outW / 2 + 8} L ${x + ins},${y + h - 4} Z`;
  el('path', { d: winD, fill: '#F7F8F9', stroke: '#AEB6BF', 'stroke-width': 2 }, grp);
  const cid = uid('hp'); const cp = el('clipPath', { id: cid }, grp); el('path', { d: winD }, cp);
  const hopG = el('g', { 'clip-path': `url(#${cid})` }, grp);
  const hopFill = el('rect', { x, y: y + h + hop, width: w, height: hop + 20, fill: '#1F2023' }, hopG);
  el('line', { x1: x + ins, y1: wy + 8, x2: x + w - ins, y2: wy + 8, stroke: '#6B7580', 'stroke-width': 6 }, grp);
  const bags = [];
  const span = w - 2 * ins - 16, bw = Math.min(40, span / nb * 0.6);
  for (let i = 0; i < nb; i++) {
    const cx = x + ins + 8 + (i + 0.5) * span / nb;
    const bg = el('g', {}, grp);
    const b = el('rect', { x: cx - bw / 2, y: wy + 12, width: bw, height: h - (wy - y) - 60, rx: bw / 2, fill: '#EEF0F2', stroke: '#98A2AD', 'stroke-width': 2 }, bg);
    bags.push({ g: bg, b, cx, top: wy + 12, bot: wy + 12 + h - (wy - y) - 60 });
  }
  const falls = el('g', {}, grp);
  return {
    g: grp, bags, falls, hopTop: y + h, hopBot: y + h + hop, x, y, w, h,
    setHopper(p) { hopFill.setAttribute('y', lerp(y + h + hop, y + h - 30, clamp(p))); }
  };
}

/* ================= ③ 收集工序 ================= */
scene({
  key: 'collect', section: 3, dur: 28, menu: '③ 炭黑收集工序',
  chap: { num: '03', t: '炭黑收集工序', s: '主袋滤器 → 风送 → 微粒粉碎 → 收集袋滤器 → 粉状炭黑储罐', c: SEC[3] },
  caps: [
    [0.3, 7.0, '炭黑烟气进入主袋滤器：炭黑被滤袋截留，<br>气体穿过滤袋，成为尾气另行处理。'],
    [7.1, 13.5, '反吹风机定期反向吹扫滤袋，炭黑落入贮斗，经气密阀进入风送系统。'],
    [13.6, 20.5, '炭黑用空气输送到微粒粉碎机打碎结块，再由收集袋滤器收集。'],
    [20.6, 27.6, '粉状炭黑存入储罐。此时倾注密度仅 0.03～0.048 g/cm³，又轻又容易飞扬。']
  ],
  build(svg, html, S) {
    S.pIn = pipe(svg, poly([[0, 450], [168, 450]]), '#5C6670', { w: 14, speed: 90 });
    S.inDots = stream(svg, poly([[0, 450], [168, 450]]), { n: 8, r: 3.4, speed: 90, jit: 8, seed: 3 });
    S.inLbl = tlabel(svg, 16, 408, '炭黑烟气 ≤250 ℃', { size: 21, anchor: 'start', pill: '#fff', stroke: '#5C6670' });
    S.bf = bagFilter(svg, 170, 170, 390, 480, 6, { hop: 100, outW: 64 });
    S.bfPlate = plate(svg, 365, 196, '主袋滤器', { color: SEC[3] });
    const R = rng(44);
    S.parts = [];
    for (let i = 0; i < 46; i++) S.parts.push({ c: el('circle', { r: 3, fill: '#1A1B1E' }, S.bf.g), off: R(), bag: Math.floor(R() * 6), y0: 330 + R() * 240, ph: R() * 6.28 });
    S.pulseMarks = S.bf.bags.map(b => { const m = el('path', { d: `M ${b.cx},206 V 236 M ${b.cx - 9},226 L ${b.cx},238 L ${b.cx + 9},226`, stroke: '#1C7ED6', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, svg); return m; });
    S.pulseLbl = tlabel(svg, 620, 262, '反吹', { size: 22, anchor: 'start', pill: '#E7F5FF', stroke: '#1C7ED6' });
    S.fallDots = [];
    for (let i = 0; i < 36; i++) S.fallDots.push({ c: el('circle', { r: 3.4, fill: '#1A1B1E' }, S.bf.falls), bag: i % 6, off: R() });
    S.hopLbl = tlabel(svg, 508, 706, '贮斗', { size: 21, anchor: 'start', fill: C.sub, weight: 800 });
    S.valve = rotaryValve(svg, 365, 776, 24);
    S.valveLbl = tlabel(svg, 408, 776, '气密阀', { size: 21, anchor: 'start', fill: C.sub, weight: 800 });
    S.tail = pipe(svg, poly([[560, 212], [650, 212], [650, 150], [818, 150]]), C.tail, { w: 12 });
    S.tailLbl = tlabel(svg, 832, 150, '尾气 → 尾气处理', { size: 22, anchor: 'start', pill: '#F3F0FF', stroke: C.tail });
    // 风送 → 粉碎机
    S.pneu = pipe(svg, poly([[365, 802], [365, 820], [640, 820], [640, 640], [698, 640]]), '#495057', { w: 10, speed: 110 });
    S.pneuDots = stream(svg, poly([[365, 802], [365, 820], [640, 820], [640, 640], [698, 640]]), { n: 16, r: 3.6, speed: 110, jit: 5, seed: 8 });
    S.pneuLbl = tlabel(svg, 500, 848, '风送系统', { size: 21, fill: C.sub, weight: 800 });
    S.mill = el('g', {}, svg);
    el('rect', { x: 700, y: 560, width: 180, height: 160, rx: 14, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.mill);
    el('circle', { cx: 790, cy: 640, r: 58, fill: '#F1F3F5', stroke: '#8A949E', 'stroke-width': 3 }, S.mill);
    S.rotor = el('g', {}, S.mill);
    for (let i = 0; i < 6; i++) el('rect', { x: -6, y: -50, width: 12, height: 30, rx: 3, fill: '#495057', transform: `rotate(${i * 60})` }, S.rotor);
    el('circle', { cx: 0, cy: 0, r: 16, fill: '#343A40' }, S.rotor);
    S.millPlate = plate(svg, 790, 528, '微粒粉碎机', { color: SEC[3] });
    // 收集袋滤器
    S.p2 = pipe(svg, poly([[880, 640], [960, 640], [960, 300], [1038, 300]]), '#495057', { w: 10, speed: 110 });
    S.p2Dots = stream(svg, poly([[880, 640], [960, 640], [960, 300], [1038, 300]]), { n: 12, r: 3.6, speed: 110, jit: 5, seed: 9 });
    S.cf = bagFilter(svg, 1040, 220, 200, 340, 4, { hop: 80, outW: 44 });
    S.cf.setHopper(0.35);
    S.cf.bags.forEach(b => b.b.setAttribute('fill', '#55585E'));
    S.cfPlate = plate(svg, 1140, 400, '收集袋滤器', { color: SEC[3] });
    S.vent = flowArrow(svg, poly([[1140, 218], [1140, 150]]), '#ADB5BD', { w: 6, speed: 50 });
    S.ventLbl = tlabel(svg, 1162, 158, '排气筒排放', { size: 21, anchor: 'start', fill: C.sub, weight: 800 });
    // 粉状炭黑储罐
    S.p3 = pipe(svg, poly([[1140, 640], [1140, 688], [1290, 688], [1290, 300], [1452, 300], [1452, 332]]), '#495057', { w: 10, speed: 110 });
    S.p3Dots = stream(svg, poly([[1140, 640], [1140, 688], [1290, 688], [1290, 300], [1452, 300], [1452, 332]]), { n: 18, r: 3.6, speed: 110, jit: 5, seed: 10 });
    S.tank = vtank(svg, 1400, 340, 220, 290, { cone: 76, outW: 40, fill: '#1F2023', surf: '#2B2D31' });
    S.tankPlate = plate(svg, 1510, 470, '粉状炭黑储罐', { color: SEC[3] });
    S.card = div(html, 'card', `<h4><span class="tag cw">课件</span>粉状炭黑：又轻又易飞扬</h4><div style="font-size:22px;color:#3E4650">倾注密度仅 0.03～0.048 g/cm³，不便运输和计量<br>—— 所以下一步要造粒</div>`, 'left:1250px;top:716px;width:630px;padding:14px 22px 16px');
  },
  update(t, S) {
    S.pIn.set(t, seg(t, 0.3, 0.9), seg(t, 0.8, 1.2)); S.inDots.set(t, seg(t, 0.9, 1.3)); vis(S.inLbl, seg(t, 0.5, 1.0));
    popG(S.bf.g, t, 0, 365, 460, 0.01); vis(S.bfPlate, seg(t, 0.2, 0.6));
    const pulses = [];
    for (let k = 0; k < 8; k++) for (let j = 0; j < 3; j++) pulses.push({ t: 7.6 + k * 2.6 + j * 0.8, bags: [j * 2, j * 2 + 1] });
    S.bf.bags.forEach((b, i) => {
      let last = -1;
      for (const p of pulses) if (p.bags.includes(i) && t >= p.t) last = p.t;
      const cake = last < 0 ? clamp((t - 1.5) / 5.5) : 0.2 + 0.8 * clamp((t - last - 0.3) / 2.4);
      b.b.setAttribute('fill', mix('#EEF0F2', '#26282C', cake));
      const bulge = last < 0 ? 0 : Math.exp(-Math.pow((t - last) / 0.12, 2));
      b.g.setAttribute('transform', `translate(${b.cx},0) scale(${1 + 0.18 * bulge},1) translate(${-b.cx},0)`);
      S.pulseMarks[i].style.opacity = last < 0 ? 0 : clamp(1 - (t - last) / 0.5);
    });
    vis(S.pulseLbl, seg(t, 7.5, 8.0) * (1 - seg(t, 13.6, 14.0)));
    S.parts.forEach(p => {
      const s = fract(p.off + t * 0.55);
      const b = S.bf.bags[p.bag];
      const x = lerp(184, b.cx - 20, eo(s)), y = lerp(450, p.y0, eo(s)) + Math.sin(t * 5 + p.ph) * 4;
      p.c.setAttribute('cx', x); p.c.setAttribute('cy', y);
      p.c.style.opacity = seg(t, 1.0, 1.6) * (1 - seg(s, 0.8, 1));
    });
    S.fallDots.forEach(f => {
      let last = -1;
      for (const p of pulses) if (p.bags.includes(f.bag) && t >= p.t) last = p.t;
      const b = S.bf.bags[f.bag];
      const age = last < 0 ? 9 : t - last - f.off * 0.35;
      const on = age >= 0 && age < 0.9;
      f.c.style.display = on ? '' : 'none';
      if (on) { f.c.setAttribute('cx', b.cx + (f.off - 0.5) * 16 + (365 - b.cx) * age * 0.6); f.c.setAttribute('cy', b.bot + age * age * 260 + age * 40); }
    });
    const nDone = pulses.filter(p => t >= p.t + 0.6).length;
    S.bf.setHopper(0.05 + Math.min(0.55, nDone * 0.045));
    vis(S.hopLbl, seg(t, 8.5, 9.0));
    popG(S.valve.g, t, 8.6, 365, 776); S.valve.set(t, t > 9 ? 1 : 0); vis(S.valveLbl, seg(t, 9.0, 9.5));
    S.tail.set(t, seg(t, 3.0, 3.8), seg(t, 3.7, 4.1)); vis(S.tailLbl, seg(t, 3.8, 4.3));
    S.pneu.set(t, seg(t, 13.6, 14.4), seg(t, 14.3, 14.7)); S.pneuDots.set(t, seg(t, 14.4, 14.8)); vis(S.pneuLbl, seg(t, 14.0, 14.5));
    popG(S.mill, t, 14.2, 790, 640); vis(S.millPlate, seg(t, 14.5, 14.9));
    S.rotor.setAttribute('transform', `translate(790,640) rotate(${t > 14.6 ? (t - 14.6) * 900 : 0})`);
    S.p2.set(t, seg(t, 16.0, 16.8), seg(t, 16.7, 17.1)); S.p2Dots.set(t, seg(t, 16.8, 17.2));
    popG(S.cf.g, t, 16.3, 1140, 420); vis(S.cfPlate, seg(t, 16.6, 17.0));
    S.vent.set(t, seg(t, 17.4, 17.8), seg(t, 17.7, 18.0)); vis(S.ventLbl, seg(t, 17.7, 18.1));
    S.p3.set(t, seg(t, 20.6, 21.4), seg(t, 21.3, 21.7)); S.p3Dots.set(t, seg(t, 21.4, 21.8));
    popG(S.tank.g, t, 20.8, 1510, 500); vis(S.tankPlate, seg(t, 21.1, 21.5));
    S.tank.setLevel(0.05 + 0.6 * eio(seg(t, 21.6, 27.5)));
    popH(S.card, t, 22.4);
  }
});

/* ================= ④ 造粒 ================= */
scene({
  key: 'pellet', section: 4, dur: 27, menu: '④ 造粒',
  chap: { num: '04', t: '造粒 · 干燥 · 包装', s: '第一步：湿法造粒', c: SEC[4] },
  caps: [
    [0.3, 6.5, '粉状炭黑在储罐中搅拌、提高容重，再由密闭绞龙送入湿法造粒机。'],
    [6.6, 12.8, '造粒水和粘结剂先在静态混合器中混合，再加入造粒机。'],
    [12.9, 19.0, '造粒机高速转动，把炭黑粉末和水滚成湿的小颗粒。'],
    [19.1, 26.6, '造粒后倾注密度提高约十倍，减少飞扬、便于输送；<br>细粉含量、颗粒强度也主要取决于这一步。']
  ],
  build(svg, html, S) {
    S.tank = vtank(svg, 110, 190, 220, 300, { cone: 80, outW: 40, fill: '#1F2023', surf: '#2B2D31' });
    S.tank.setLevel(0.72);
    S.motor = el('g', {}, svg);
    el('rect', { x: 196, y: 150, width: 48, height: 36, rx: 6, fill: 'url(#steelDark)', stroke: C.line, 'stroke-width': 2.5 }, S.motor);
    el('line', { x1: 220, y1: 186, x2: 220, y2: 470, stroke: '#ADB5BD', 'stroke-width': 7 }, S.motor);
    S.paddles = [290, 370, 445].map(y => el('rect', { x: 150, y: y - 6, width: 140, height: 12, rx: 5, fill: '#CED4DA', stroke: '#868E96', 'stroke-width': 2 }, S.motor));
    S.tankLbl = el('g', {}, svg);
    tlabel(S.tankLbl, 350, 256, '粉状炭黑储罐', { size: 25, anchor: 'start', weight: 900 });
    tlabel(S.tankLbl, 350, 294, '搅拌 → 容重增加', { size: 21, anchor: 'start', fill: C.sub, weight: 700 });
    // 密闭绞龙
    S.conv = el('g', {}, svg);
    el('rect', { x: 196, y: 568, width: 48, height: 24, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 2 }, S.conv);
    el('rect', { x: 150, y: 590, width: 710, height: 62, rx: 14, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.conv);
    el('rect', { x: 168, y: 600, width: 674, height: 42, rx: 8, fill: '#F1F3F5', stroke: '#AEB6BF', 'stroke-width': 2 }, S.conv);
    const hc = uid('hx'); const hcp = el('clipPath', { id: hc }, S.conv); el('rect', { x: 168, y: 600, width: 674, height: 42 }, hcp);
    const hg = el('g', { 'clip-path': `url(#${hc})` }, S.conv);
    let hd = 'M 120,604'; for (let x = 120; x < 900; x += 40) hd += ` L ${x + 20},638 L ${x + 40},604`;
    S.helix = el('path', { d: hd, stroke: '#868E96', 'stroke-width': 4, fill: 'none' }, hg);
    S.convDots = stream(hg, poly([[180, 628], [850, 628]]), { n: 30, r: 3.2, speed: 70, jit: 12, seed: 4 });
    S.convLbl = tlabel(svg, 505, 690, '密闭绞龙（主供料输送器）', { size: 22, fill: C.sub, weight: 800 });
    // 造粒机
    S.pz = el('g', {}, svg);
    hcyl(S.pz, 850, 520, 640, 200);
    el('rect', { x: 884, y: 542, width: 572, height: 156, rx: 12, fill: '#F3F4F6', stroke: '#AEB6BF', 'stroke-width': 2 }, S.pz);
    const pc = uid('pz'); const pcp = el('clipPath', { id: pc }, S.pz); el('rect', { x: 884, y: 542, width: 572, height: 156, rx: 12 }, pcp);
    S.pzIn = el('g', { 'clip-path': `url(#${pc})` }, S.pz);
    el('rect', { x: 826, y: 612, width: 690, height: 16, rx: 8, fill: '#868E96' }, S.pz);
    el('rect', { x: 818, y: 596, width: 26, height: 48, rx: 5, fill: 'url(#steelDark)' }, S.pz);
    el('rect', { x: 1496, y: 596, width: 26, height: 48, rx: 5, fill: 'url(#steelDark)' }, S.pz);
    S.pins = [];
    for (let i = 0; i < 15; i++) S.pins.push({ e: el('line', { x1: 905 + i * 37, y1: 620, x2: 905 + i * 37, y2: 560, stroke: '#495057', 'stroke-width': 7, 'stroke-linecap': 'round' }, S.pzIn), x: 905 + i * 37, ph: i * 0.85 });
    const R = rng(66);
    S.pel = [];
    for (let i = 0; i < 80; i++) S.pel.push({ c: el('circle', { r: 3, fill: 'url(#cbBall)' }, S.pzIn), off: R(), ph: R() * 6.28, amp: 0.3 + R() * 0.7 });
    S.pzPlate = plate(svg, 1170, 752, '湿法造粒机', { color: SEC[4] });
    // 造粒水、粘结剂、静态混合器
    S.wt = vtank(svg, 960, 200, 100, 130, { fill: '#4DABF7', surf: '#74C0FC' }); S.wt.setLevel(0.7);
    S.bt = vtank(svg, 1160, 200, 100, 130, { fill: '#A9743B', surf: '#C08A4E' }); S.bt.setLevel(0.66);
    S.wtLbl = plate(svg, 1010, 176, '造粒水', { size: 22, color: '#4DABF7' });
    S.btLbl = plate(svg, 1210, 176, '粘结剂', { size: 22, color: '#A9743B' });
    S.pw = pipe(svg, poly([[1010, 352], [1010, 392], [1062, 392]]), C.water, { w: 8 });
    S.pb = pipe(svg, poly([[1210, 352], [1210, 392], [1160, 392]]), '#A9743B', { w: 8 });
    S.mx = el('g', {}, svg);
    el('rect', { x: 1064, y: 374, width: 94, height: 36, rx: 10, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 2.5 }, S.mx);
    el('path', { d: 'M 1072,392 l 10,-10 l 10,20 l 10,-20 l 10,20 l 10,-20 l 10,20 l 10,-20 l 10,10', stroke: '#495057', 'stroke-width': 3, fill: 'none' }, S.mx);
    S.mxLbl = tlabel(svg, 1132, 446, '静态混合器', { size: 21, anchor: 'start', fill: C.sub, weight: 800 });
    S.pm = pipe(svg, poly([[1111, 412], [1111, 518]]), '#3D8BD4', { w: 8 });
    // 出料
    S.out = stream(svg, poly([[1440, 700], [1440, 790], [1560, 790]]), { n: 10, r: 6, speed: 70, jit: 6, seed: 12 });
    S.outArrow = pipe(svg, poly([[1440, 722], [1440, 790], [1556, 790]]), '#343A40', { w: 12, arrow: false });
    S.outLbl = tlabel(svg, 1576, 790, '湿炭黑粒子 → 干燥机', { size: 22, anchor: 'start', pill: '#fff', stroke: '#343A40' });
    S.card = div(html, 'card', `${head([['cw', '课件'], ['co', '长鸿 TDS']], '为什么要造粒？')}
      <ul style="font-size:22px"><li>倾注密度：粉状 0.03～0.048 → 颗粒 <b>0.3～0.5 g/cm³</b></li><li>少飞扬、好输送、计量投料准</li><li>颗粒强度：太高难分散，太低易碎、细粉多</li><li>长鸿 N330：细粉 ≤7.0%，颗粒强度 30±10 cN</li></ul>`, 'left:1500px;top:168px;width:390px;padding:16px 22px 16px');
  },
  update(t, S) {
    popG(S.tank.g, t, 0, 220, 380, 0.01); vis(S.motor, 1); vis(S.tankLbl, seg(t, 0.3, 0.8));
    S.paddles.forEach((p, i) => { const k = Math.cos(t * 5 + i * 1.1); p.setAttribute('x', 220 - 70 * Math.abs(k)); p.setAttribute('width', 140 * Math.abs(k) + 4); });
    popG(S.conv, t, 0.6, 505, 620); vis(S.convLbl, seg(t, 1.0, 1.5));
    S.helix.setAttribute('transform', `translate(${fract(t * 1.2) * 40},0)`);
    S.convDots.set(t, seg(t, 1.4, 2.0), clamp((t - 1.4) * 0.25));
    popG(S.pz, t, 2.6, 1170, 620); vis(S.pzPlate, seg(t, 3.0, 3.5));
    popG(S.wt.g, t, 6.8, 1010, 270); popG(S.bt.g, t, 7.2, 1210, 270);
    vis(S.wtLbl, seg(t, 7.0, 7.4)); vis(S.btLbl, seg(t, 7.4, 7.8));
    S.pw.set(t, seg(t, 8.0, 8.6), seg(t, 8.5, 8.9)); S.pb.set(t, seg(t, 8.2, 8.8), seg(t, 8.7, 9.1));
    popG(S.mx, t, 7.9, 1111, 392); vis(S.mxLbl, seg(t, 8.4, 8.9));
    S.pm.set(t, seg(t, 9.4, 10.0), seg(t, 9.9, 10.3));
    const run = seg(t, 12.9, 13.6);
    S.pins.forEach(p => {
      const a = p.ph + (t - 12.9) * 9 * run + (t < 12.9 ? 0 : 0);
      const s = Math.sin(a), c = Math.cos(a);
      p.e.setAttribute('y2', 620 - 62 * s);
      p.e.style.opacity = 0.35 + 0.65 * (c > 0 ? 1 : 0.3);
    });
    const feed = seg(t, 2.8, 3.4);
    S.pel.forEach((p, i) => {
      const s = fract(p.off + t * (0.05 + 0.07 * run));
      const x = 896 + s * 548;
      const grow = clamp((s - 0.1) / 0.75) * run;
      const r = lerp(2.2, 8.5, grow);
      const y = 668 - (1 - grow) * 12 + Math.sin(t * (2 + 4 * run) + p.ph) * (8 + 14 * run) * p.amp;
      p.c.setAttribute('cx', x); p.c.setAttribute('cy', Math.min(y, 690 - r));
      p.c.setAttribute('r', r);
      p.c.style.opacity = feed;
    });
    S.outArrow.set(t, seg(t, 15.8, 16.4), 0); S.out.set(t, seg(t, 16.2, 16.8)); vis(S.outLbl, seg(t, 16.4, 16.9));
    popH(S.card, t, 19.3);
  }
});

/* ================= ④ 干燥 ================= */
scene({
  key: 'dry', section: 4, dur: 25, menu: '④ 干燥',
  chap: { num: '04', t: '造粒 · 干燥 · 包装', s: '第二步：回转干燥', c: SEC[4] },
  caps: [
    [0.3, 6.8, '湿颗粒进入回转干燥机；<br>热源来自尾气燃烧炉，燃料正是生产中产生的炭黑尾气。'],
    [6.9, 13.0, '热气在火箱中与滚筒内的湿颗粒逆流换热，把水分烘干；<br>出料温度约 200～300 ℃。'],
    [13.1, 18.4, '干燥废气经干燥废气袋滤器回收炭黑后，由排气筒排放。'],
    [18.5, 24.6, '干燥程度影响加热减量（水分）：长鸿 N220、N330、N326 为 ≤0.8%，国标 ≤2.5%。']
  ],
  build(svg, html, S) {
    const ang = 2.4, pcx = 830, pcy = 430;
    S.inStream = stream(svg, poly([[60, 252], [270, 252], [270, 336]]), { n: 12, r: 5.5, speed: 70, jit: 6, seed: 2 });
    S.inLbl = tlabel(svg, 140, 218, '湿炭黑粒子', { size: 22, pill: '#fff', stroke: '#343A40' });
    S.drum = el('g', { transform: `rotate(${ang},${pcx},${pcy})` }, svg);
    const dg = S.drum;
    el('rect', { x: 236, y: 330, width: 64, height: 200, rx: 8, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3 }, dg);
    el('rect', { x: 1360, y: 330, width: 64, height: 200, rx: 8, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3 }, dg);
    el('rect', { x: 300, y: 350, width: 1060, height: 160, rx: 20, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, dg);
    const cid = uid('dr'); const cp = el('clipPath', { id: cid }, dg); el('rect', { x: 300, y: 350, width: 1060, height: 160, rx: 20 }, cp);
    const inG = el('g', { 'clip-path': `url(#${cid})` }, dg);
    S.lines = [0, 1, 2, 3, 4].map(() => el('line', { x1: 300, x2: 1360, stroke: 'rgba(80,90,100,.35)', 'stroke-width': 3 }, inG));
    el('rect', { x: 330, y: 372, width: 1000, height: 116, rx: 12, fill: 'rgba(241,243,245,.78)', stroke: '#AEB6BF', 'stroke-width': 2 }, inG);
    const R = rng(81);
    S.pel = [];
    for (let i = 0; i < 70; i++) S.pel.push({ c: el('circle', { r: 6, fill: 'url(#cbBall)' }, inG), off: R(), ph: R() * 6.28, a: 0.4 + R() * 0.6 });
    [430, 1230].forEach(x => el('rect', { x: x - 14, y: 338, width: 28, height: 184, rx: 6, fill: 'url(#steelDark)', stroke: C.line, 'stroke-width': 2 }, dg));
    el('rect', { x: 812, y: 334, width: 36, height: 192, rx: 5, fill: '#868E96', stroke: C.line, 'stroke-width': 2 }, dg);
    el('rect', { x: 812, y: 334, width: 36, height: 192, rx: 5, fill: 'url(#mesh)', opacity: .5 }, dg);
    // 火箱（夹套）
    S.jacket = el('g', {}, dg);
    [[560, 316, 240, 34], [560, 510, 240, 34], [870, 316, 270, 34], [870, 510, 270, 34]].forEach(([x, y, w, h]) => el('rect', { x, y, width: w, height: h, rx: 6, fill: 'url(#bricks)', stroke: '#8B5E44', 'stroke-width': 2 }, S.jacket));
    S.hot = [[1136, 333, 564, 333], [1136, 527, 564, 527]].map(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2, stroke: '#F76707', 'stroke-width': 8, 'stroke-dasharray': '16 12', 'stroke-linecap': 'round' }, S.jacket));
    S.jacketLbl = tlabel(svg, 700, 282, '火箱：热气逆流 ←', { size: 21, fill: '#C2410C', weight: 800 });
    S.drumPlate = plate(svg, 1000, 430, '回转干燥机', { color: SEC[4] });
    // 尾气燃烧炉
    S.fur = el('g', {}, svg);
    el('rect', { x: 980, y: 640, width: 200, height: 150, rx: 10, fill: 'url(#bricks)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.fur);
    el('rect', { x: 1004, y: 664, width: 152, height: 102, rx: 8, fill: '#3B2A26' }, S.fur);
    S.furFl = [0, 1, 2, 3].map(() => el('path', { fill: 'url(#flameUp)' }, S.fur));
    S.furPlate = plate(svg, 1080, 818, '尾气燃烧炉', { color: SEC[5] });
    S.tailIn = pipe(svg, poly([[1920, 752], [1184, 752]]), C.tail, { w: 11 });
    S.tailLbl = tlabel(svg, 1560, 718, '炭黑尾气（来自主袋滤器）', { size: 21, pill: '#F3F0FF', stroke: C.tail });
    S.airIn = pipe(svg, poly([[860, 752], [976, 752]]), C.air, { w: 9 });
    S.airLbl = tlabel(svg, 846, 752, '空气', { size: 21, anchor: 'end', fill: C.sub, weight: 800 });
    S.hotDuct = pipe(svg, poly([[1080, 638], [1080, 562]]), C.airHot, { w: 14 });
    // 出料
    S.outStream = stream(svg, poly([[1400, 572], [1400, 624], [1640, 624]]), { n: 12, r: 5.5, speed: 80, jit: 5, seed: 6 });
    S.outT = tlabel(svg, 1520, 586, '200～300 ℃', { size: 22, pill: '#FFF4E6', stroke: C.airHot, fill: '#C2410C' });
    S.outLbl = tlabel(svg, 1656, 624, '→ 提升机 · 筛选', { size: 22, anchor: 'start', fill: C.ink, weight: 800 });
    // 干燥废气袋滤器
    S.exh = pipe(svg, poly([[268, 540], [268, 640], [234, 640]]), '#ADB5BD', { w: 9 });
    S.dbf = bagFilter(svg, 92, 560, 140, 150, 2, { hop: 56, outW: 30 });
    S.dbf.setHopper(0.4); S.dbf.bags.forEach(b => b.b.setAttribute('fill', '#6C7077'));
    S.dbfPlate = plate(svg, 162, 530, '干燥废气袋滤器', { size: 21, color: SEC[4] });
    S.stack = flowArrow(svg, poly([[92, 590], [40, 590], [40, 480]]), '#ADB5BD', { w: 5, speed: 40 });
    S.stackLbl = tlabel(svg, 40, 458, '排气筒', { size: 20, fill: C.sub, weight: 800 });
    S.rec = flowArrow(svg, poly([[162, 770], [162, 828], [236, 828]]), '#343A40', { w: 5, speed: 40 });
    S.recLbl = tlabel(svg, 250, 828, '回收炭黑 → 风送系统', { size: 20, anchor: 'start', fill: C.sub, weight: 800 });
    S.vapor = wisps(svg, 268, 318, 12, { rise: 110, spread: 26, drift: -20, r: 10, color: '#DEE2E6', op: 0.75 });
    S.card = div(html, 'card co-card', `${head([['co', '长鸿 TDS']], '加热减量（水分）')}<ul><li>N220 / N330 / N326：<span class="em">≤0.8%</span></li><li>国标：≤2.5%</li></ul><div class="muted" style="margin-top:6px">水分高 → 混炼慢、易起泡（课件）</div>`, 'left:1476px;top:160px;width:414px');
  },
  update(t, S) {
    popG(S.drum, t, 0, 830, 430, 0.01);
    S.drum.style.opacity = 1; S.drum.setAttribute('transform', 'rotate(2.4,830,430)');
    vis(S.drumPlate, seg(t, 0.3, 0.8));
    S.inStream.set(t, seg(t, 0.5, 1.0)); vis(S.inLbl, seg(t, 0.4, 0.9));
    S.lines.forEach((l, i) => {
      const a = i * 1.2566 + t * 1.6, y = 430 + 74 * Math.sin(a);
      l.setAttribute('y1', y); l.setAttribute('y2', y);
      l.style.opacity = Math.cos(a) > 0 ? 0.9 * Math.cos(a) : 0;
    });
    const feed = seg(t, 0.8, 1.4), heat = seg(t, 5.2, 7.5);
    S.pel.forEach(p => {
      const s = fract(p.off + t * 0.06);
      const x = 340 + s * 980;
      const y = 470 + Math.sin(t * 4 + p.ph) * 10 * p.a - Math.max(0, Math.sin(t * 2 + p.ph * 2)) * 26 * p.a;
      p.c.setAttribute('cx', x); p.c.setAttribute('cy', y);
      p.c.setAttribute('r', 6.2);
      p.c.style.opacity = feed;
      p.c.setAttribute('fill', 'url(#cbBall)');
    });
    popG(S.fur, t, 2.6, 1080, 715); vis(S.furPlate, seg(t, 2.9, 3.3));
    S.tailIn.set(t, seg(t, 3.0, 3.8), seg(t, 3.7, 4.1)); vis(S.tailLbl, seg(t, 3.5, 4.0));
    S.airIn.set(t, seg(t, 3.4, 3.9), seg(t, 3.8, 4.2)); vis(S.airLbl, seg(t, 3.6, 4.0));
    const fl = seg(t, 4.0, 4.6);
    S.furFl.forEach((f, i) => {
      const x = 1030 + i * 34, base = 762;
      const h = (70 + (i % 2) * 18) * (0.85 + 0.15 * Math.sin(t * 8 + i * 1.7)) * fl;
      const w = 26 * (0.9 + 0.1 * Math.sin(t * 9 + i));
      f.setAttribute('d', `M ${x - w / 2},${base} C ${x - w * 0.7},${base - h * 0.4} ${x - w * 0.2},${base - h * 0.7} ${x + Math.sin(t * 7 + i) * 5},${base - h} C ${x + w * 0.2},${base - h * 0.7} ${x + w * 0.7},${base - h * 0.4} ${x + w / 2},${base} Z`);
    });
    S.hotDuct.set(t, seg(t, 4.6, 5.2), seg(t, 5.1, 5.5));
    vis(S.jacket, 1);
    S.hot.forEach(h => { h.setAttribute('stroke-dashoffset', t * 80); h.style.opacity = heat; });
    vis(S.jacketLbl, seg(t, 7.0, 7.5));
    S.vapor.set(t, seg(t, 7.2, 8.0) * (1 - 0.0));
    S.outStream.set(t, seg(t, 9.2, 9.8)); popG(S.outT, t, 10.4, 1520, 586); vis(S.outLbl, seg(t, 10.0, 10.5));
    S.exh.set(t, seg(t, 13.1, 13.7), seg(t, 13.6, 14.0));
    popG(S.dbf.g, t, 13.3, 162, 620); vis(S.dbfPlate, seg(t, 13.6, 14.0));
    S.stack.set(t, seg(t, 14.4, 14.9), seg(t, 14.8, 15.1)); vis(S.stackLbl, seg(t, 14.7, 15.1));
    S.rec.set(t, seg(t, 15.2, 15.7), seg(t, 15.6, 15.9)); vis(S.recLbl, seg(t, 15.5, 15.9));
    popH(S.card, t, 18.6);
  }
});

/* ================= ④ 筛选 · 磁选 · 包装 ================= */
scene({
  key: 'finish', section: 4, dur: 27, menu: '④ 筛选 · 磁选 · 包装',
  chap: { num: '04', t: '造粒 · 干燥 · 包装', s: '第三步：筛选 · 磁选 · 包装入库', c: SEC[4] },
  caps: [
    [0.3, 6.6, '干燥后的颗粒由提升机送到筛选机，<br>不合格颗粒送再处理袋滤器，回收利用。'],
    [6.7, 12.0, '合格颗粒经磁选机除去铁屑，进入产品贮罐。'],
    [12.1, 18.5, '包装成 25 kg 小袋或 500 / 1000 kg 集装袋，整形后由叉车送入成品库。'],
    [18.6, 26.6, '磁选除去铁屑，减少筛余物等硬粒杂质：<br>长鸿 45 µm 筛余物 TDS ≤500 ppm，内控 ≤300 ppm。']
  ],
  build(svg, html, S) {
    // 提升机
    S.inS = stream(svg, poly([[0, 780], [92, 780]]), { n: 6, r: 5.5, speed: 60, jit: 5, seed: 1 });
    S.inLbl = tlabel(svg, 8, 822, '干燥颗粒', { size: 20, anchor: 'start', fill: C.sub, weight: 800 });
    S.elev = el('g', {}, svg);
    el('rect', { x: 92, y: 200, width: 80, height: 610, rx: 12, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.elev);
    el('rect', { x: 102, y: 214, width: 60, height: 582, rx: 8, fill: '#F1F3F5', stroke: '#AEB6BF', 'stroke-width': 2 }, S.elev);
    const ec = uid('ev'); const ecp = el('clipPath', { id: ec }, S.elev); el('rect', { x: 102, y: 214, width: 60, height: 582 }, ecp);
    const eg = el('g', { 'clip-path': `url(#${ec})` }, S.elev);
    el('line', { x1: 118, y1: 214, x2: 118, y2: 796, stroke: '#ADB5BD', 'stroke-width': 3 }, eg);
    el('line', { x1: 146, y1: 214, x2: 146, y2: 796, stroke: '#ADB5BD', 'stroke-width': 3 }, eg);
    S.buckets = [];
    for (let i = 0; i < 12; i++) {
      const up = el('g', {}, eg); el('path', { d: 'M -11,-7 H 11 L 8,7 H -8 Z', fill: '#495057' }, up); el('ellipse', { cx: 0, cy: -8, rx: 10, ry: 4, fill: '#1A1B1E' }, up);
      const dn = el('g', {}, eg); el('path', { d: 'M -11,7 H 11 L 8,-7 H -8 Z', fill: '#868E96' }, dn);
      S.buckets.push({ up, dn, off: i / 12 });
    }
    S.elevPlate = plate(svg, 132, 176, '提升机', { color: SEC[4] });
    S.top = stream(svg, poly([[172, 226], [236, 226], [268, 282]]), { n: 5, r: 5.5, speed: 70, jit: 4, seed: 2 });
    // 筛选机
    S.scr = el('g', {}, svg);
    el('path', { d: 'M 262,276 L 646,352 L 646,398 L 262,322 Z', fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.scr);
    el('path', { d: 'M 276,294 L 632,364', stroke: '#495057', 'stroke-width': 4, 'stroke-dasharray': '4 5' }, S.scr);
    [300, 610].forEach(x => el('path', { d: `M ${x},${322 + (x - 262) * 0.198} l -14,46 h 28 z`, fill: '#ADB5BD', stroke: C.line, 'stroke-width': 2 }, S.scr));
    S.scrDots = [];
    const R = rng(90);
    for (let i = 0; i < 22; i++) S.scrDots.push({ c: el('circle', { r: 5.5, fill: 'url(#cbBall)' }, svg), off: i / 22, bad: i % 7 === 3, ph: R() * 6.28 });
    S.scrPlate = plate(svg, 454, 250, '筛选机', { color: SEC[4] });
    S.rep = el('g', {}, svg);
    el('rect', { x: 340, y: 560, width: 150, height: 120, rx: 10, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.rep);
    for (let i = 0; i < 3; i++) el('rect', { x: 362 + i * 40, y: 580, width: 20, height: 80, rx: 10, fill: '#5F636A' }, S.rep);
    S.repPlate = plate(svg, 415, 712, '再处理袋滤器', { size: 22, color: SEC[4] });
    S.repGuide = el('path', { d: 'M 430,400 Q 436,480 440,552', stroke: '#C92A2A', 'stroke-width': 3, 'stroke-dasharray': '7 7', fill: 'none' }, svg);
    S.repLbl = tlabel(svg, 506, 520, '不合格颗粒 → 回收', { size: 21, anchor: 'start', fill: '#C92A2A', weight: 800 });
    // 磁选机
    S.mag = el('g', {}, svg);
    el('rect', { x: 710, y: 296, width: 250, height: 210, rx: 14, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.mag);
    el('rect', { x: 724, y: 310, width: 222, height: 182, rx: 10, fill: '#F1F3F5', stroke: '#AEB6BF', 'stroke-width': 2 }, S.mag);
    S.drum = el('g', {}, S.mag);
    el('circle', { cx: 0, cy: 0, r: 62, fill: 'url(#steelDark)', stroke: C.line, 'stroke-width': 3 }, S.drum);
    for (let i = 0; i < 8; i++) el('line', { x1: 0, y1: 0, x2: 58, y2: 0, stroke: 'rgba(255,255,255,.25)', 'stroke-width': 3, transform: `rotate(${i * 45})` }, S.drum);
    el('path', { d: 'M 830,400 m -40,-18 a 44,44 0 0 1 80,0', fill: 'none', stroke: '#E03131', 'stroke-width': 10, transform: 'rotate(40,830,400)' }, S.mag);
    el('path', { d: 'M 830,400 m -40,-18 a 44,44 0 0 1 80,0', fill: 'none', stroke: '#1C7ED6', 'stroke-width': 10, transform: 'rotate(130,830,400)' }, S.mag);
    S.magPlate = plate(svg, 835, 268, '磁选机', { color: SEC[4] });
    S.feedM = stream(svg, poly([[646, 380], [700, 380], [812, 336]]), { n: 6, r: 5.5, speed: 70, jit: 3, seed: 5 });
    S.goodPipe = pipe(svg, poly([[912, 508], [912, 556], [990, 556], [990, 222], [1112, 222], [1112, 256]]), '#343A40', { w: 12, arrow: false });
    S.good = stream(svg, poly([[846, 338], [884, 350], [900, 380], [910, 440], [912, 520], [912, 556], [990, 556], [990, 222], [1112, 222], [1112, 262]]), { n: 22, r: 5.5, speed: 80, jit: 3, seed: 6 });
    S.iron = [];
    for (let i = 0; i < 6; i++) S.iron.push({ e: el('path', { d: 'M -6,-3 L 2,-7 L 7,-1 L 3,6 L -5,4 Z', fill: '#8D6E63', stroke: '#495057', 'stroke-width': 1.5 }, svg), off: i / 6 });
    S.bin = el('g', {}, svg);
    el('path', { d: 'M 720,526 H 800 L 792,586 H 728 Z', fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 2.5 }, S.bin);
    S.binLbl = tlabel(svg, 760, 612, '铁屑', { size: 21, fill: '#8D6E63', weight: 900 });
    // 产品贮罐 + 包装
    S.silo = vtank(svg, 1030, 262, 170, 230, { cone: 64, outW: 36, fill: '#1F2023', surf: '#2B2D31' });
    S.siloPlate = plate(svg, 1115, 380, '产品贮罐', { color: SEC[4] });
    S.pack = el('g', {}, svg);
    el('rect', { x: 1066, y: 572, width: 98, height: 64, rx: 8, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3 }, S.pack);
    el('rect', { x: 1105, y: 636, width: 20, height: 22, fill: '#868E96' }, S.pack);
    S.bag = el('path', { fill: '#F8F9FA', stroke: '#495057', 'stroke-width': 3 }, S.pack);
    S.packLbl = tlabel(svg, 1180, 604, '包装机', { size: 24, anchor: 'start', weight: 900 });
    S.siloOut = stream(svg, poly([[1115, 560], [1115, 572]]), { n: 3, r: 4, speed: 30, seed: 7 });
    S.stackG = el('g', {}, svg);
    el('rect', { x: 1232, y: 772, width: 170, height: 16, rx: 3, fill: '#A0785A' }, S.stackG);
    S.small = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const g = el('g', { transform: `translate(${1262 + col * 55},${748 - row * 34})` }, S.stackG);
      el('rect', { x: -26, y: -16, width: 52, height: 32, rx: 8, fill: '#FFFFFF', stroke: '#495057', 'stroke-width': 2.5 }, g);
      el('line', { x1: -16, y1: 0, x2: 16, y2: 0, stroke: '#0F766E', 'stroke-width': 3 }, g);
      S.small.push(g);
    }
    S.smallLbl = tlabel(svg, 1318, 820, '25 kg 小袋', { size: 21, weight: 800 });
    S.jumbo = el('g', {}, svg);
    el('path', { d: 'M 1440,660 Q 1436,648 1448,646 H 1540 Q 1552,648 1548,660 L 1554,782 H 1434 Z', fill: '#FFFFFF', stroke: '#495057', 'stroke-width': 3 }, S.jumbo);
    el('path', { d: 'M 1452,648 q 8,-26 18,0 M 1518,648 q 8,-26 18,0', stroke: '#0F766E', 'stroke-width': 5, fill: 'none' }, S.jumbo);
    el('line', { x1: 1450, y1: 700, x2: 1538, y2: 700, stroke: '#0F766E', 'stroke-width': 3 }, S.jumbo);
    S.jumboLbl = tlabel(svg, 1494, 820, '500/1000 kg 集装袋', { size: 21, weight: 800 });
    // 叉车 + 成品库
    S.wh = el('g', {}, svg);
    el('path', { d: 'M 1648,800 V 612 L 1764,548 L 1880,612 V 800 Z', fill: '#E9ECEF', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.wh);
    el('rect', { x: 1712, y: 680, width: 104, height: 120, fill: '#495057' }, S.wh);
    for (let i = 0; i < 5; i++) el('line', { x1: 1712, y1: 700 + i * 20, x2: 1816, y2: 700 + i * 20, stroke: '#343A40', 'stroke-width': 3 }, S.wh);
    S.whPlate = plate(svg, 1764, 640, '成品库', { color: SEC[4] });
    S.fork = el('g', {}, svg);
    el('rect', { x: -2, y: -64, width: 70, height: 50, rx: 8, fill: '#FAB005', stroke: C.line, 'stroke-width': 2.5 }, S.fork);
    el('rect', { x: 14, y: -96, width: 44, height: 34, rx: 5, fill: 'none', stroke: C.line, 'stroke-width': 4 }, S.fork);
    el('line', { x1: 76, y1: -112, x2: 76, y2: -8, stroke: '#495057', 'stroke-width': 6 }, S.fork);
    el('line', { x1: 76, y1: -12, x2: 132, y2: -12, stroke: '#495057', 'stroke-width': 5 }, S.fork);
    el('circle', { cx: 14, cy: -8, r: 12, fill: '#343A40' }, S.fork); el('circle', { cx: 58, cy: -8, r: 12, fill: '#343A40' }, S.fork);
    S.load = el('g', {}, S.fork);
    el('rect', { x: 80, y: -26, width: 56, height: 10, fill: '#A0785A' }, S.load);
    for (let i = 0; i < 2; i++) el('rect', { x: 84, y: -56 + i * 0, width: 48, height: 28, rx: 7, fill: '#fff', stroke: '#495057', 'stroke-width': 2.5, transform: `translate(0,${-i * 28})` }, S.load);
    S.card = div(html, 'card co-card', `${head([['co', '长鸿 TDS']], '45 µm 水洗筛余物')}<ul><li>TDS：<span class="em">≤500 ppm</span></li><li>内控：<span class="em">≤300 ppm</span></li><li>国标：≤1000 ppm</li></ul><div class="muted" style="margin-top:6px">硬粒杂质：结焦硬碳、铁屑、炉料碎屑等（课件）</div>`, 'left:1476px;top:160px;width:414px');
  },
  update(t, S) {
    S.inS.set(t, seg(t, 0.3, 0.7)); vis(S.inLbl, seg(t, 0.3, 0.8));
    popG(S.elev, t, 0, 132, 505, 0.01); vis(S.elevPlate, seg(t, 0.2, 0.6));
    S.buckets.forEach(b => {
      const s = fract(b.off + t * 0.16);
      b.up.setAttribute('transform', `translate(118,${796 - s * 582})`);
      b.dn.setAttribute('transform', `translate(146,${214 + s * 582})`);
    });
    S.top.set(t, seg(t, 0.8, 1.2));
    popG(S.scr, t, 0.6, 454, 337);
    const vib = Math.sin(t * 38) * 2.2;
    S.scr.setAttribute('transform', `translate(${vib},${Math.cos(t * 38) * 1.2})`);
    vis(S.scrPlate, seg(t, 0.9, 1.3));
    const on = seg(t, 1.2, 1.7);
    S.scrDots.forEach(d => {
      const s = fract(d.off + t * 0.22);
      let x = 280 + s * 360, y = 290 + (x - 262) * 0.198 - 6 - Math.abs(Math.sin(t * 9 + d.ph)) * 6;
      if (d.bad && s > 0.35) { const k = (s - 0.35) / 0.65; x = 280 + 0.35 * 360 + k * 40; y = 322 + 126 * 0.198 + k * k * 240; }
      d.c.setAttribute('cx', x + vib); d.c.setAttribute('cy', y);
      d.c.style.opacity = on * (d.bad ? (s > 0.35 ? seg(t, 3.2, 3.6) : 1) : 1) * (d.bad && s > 0.95 ? 0 : 1);
    });
    popG(S.rep, t, 3.2, 415, 620); vis(S.repPlate, seg(t, 3.4, 3.8)); vis(S.repLbl, seg(t, 3.8, 4.3)); vis(S.repGuide, 0.7 * seg(t, 3.6, 4.1));
    popG(S.mag, t, 6.8, 835, 400); vis(S.magPlate, seg(t, 7.0, 7.4));
    S.drum.setAttribute('transform', `translate(830,400) rotate(${t * 60})`);
    S.feedM.set(t, seg(t, 7.2, 7.6));
    S.goodPipe.set(t, seg(t, 8.6, 9.8), 0);
    S.good.set(t, seg(t, 7.6, 8.0), clamp(0.08 + (t - 7.6) * 0.3));
    S.iron.forEach(ir => {
      const s = fract(ir.off + t * 0.28);
      let x, y;
      if (s < 0.2) { const k = s / 0.2; x = lerp(700, 800, k); y = lerp(380, 340, k); }
      else if (s < 0.75) { const a = lerp(-120, 150, (s - 0.2) / 0.55) * Math.PI / 180; x = 830 + 70 * Math.cos(a); y = 400 + 70 * Math.sin(a); }
      else { const k = (s - 0.75) / 0.25; const a = 150 * Math.PI / 180; x = lerp(830 + 70 * Math.cos(a), 760, k); y = lerp(400 + 70 * Math.sin(a), 552, k * k); }
      ir.e.setAttribute('transform', `translate(${x},${y}) rotate(${t * 200 + ir.off * 300})`);
      ir.e.style.opacity = seg(t, 8.0, 8.5);
    });
    popG(S.bin, t, 8.2, 760, 556); vis(S.binLbl, seg(t, 8.5, 9.0));
    popG(S.silo.g, t, 9.4, 1115, 400); vis(S.siloPlate, seg(t, 9.7, 10.1));
    S.silo.setLevel(0.1 + 0.55 * eio(seg(t, 10.2, 16)));
    popG(S.pack, t, 12.2, 1115, 610); vis(S.packLbl, seg(t, 12.5, 12.9));
    S.siloOut.set(t, seg(t, 12.8, 13.2));
    const cyc = fract((t - 13) / 1.3), fillK = t > 13 ? eo(clamp(cyc / 0.7)) : 0;
    const bh = 20 + 46 * fillK;
    S.bag.setAttribute('d', `M 1094,658 H 1136 L ${1140 + 6 * fillK},${658 + bh} Q 1115,${664 + bh} ${1090 - 6 * fillK},${658 + bh} Z`);
    S.bag.style.opacity = t > 13 ? 1 - seg(cyc, 0.85, 1) : 0;
    const nb = t < 13.8 ? 0 : Math.min(9, Math.floor((t - 13.8) / 0.55) + 1);
    S.small.forEach((g, i) => { g.style.display = i < nb ? '' : 'none'; });
    vis(S.stackG, seg(t, 13.6, 14.0));
    vis(S.smallLbl, seg(t, 14.2, 14.6));
    popG(S.jumbo, t, 15.0, 1494, 714); vis(S.jumboLbl, seg(t, 15.3, 15.7));
    popG(S.wh, t, 16.0, 1764, 680);
    vis(S.whPlate, seg(t, 16.3, 16.7));
    const fx = lerp(1300, 1600, eio(seg(t, 18.0, 22.0)));
    S.fork.setAttribute('transform', `translate(${fx},800)`);
    vis(S.fork, seg(t, 17.0, 17.5) * (1 - seg(t, 22.4, 22.9)));
    popH(S.card, t, 18.8);
  }
});

/* ================= ⑤ 尾气处理 ================= */
scene({
  key: 'tail', section: 5, dur: 31, menu: '⑤ 尾气处理与综合利用',
  chap: { num: '05', t: '尾气处理与综合利用', s: '干燥机热源 · 锅炉产蒸汽 · 脱硫脱硝 · 烟囱排放', c: SEC[5] },
  caps: [
    [0.3, 6.8, '主袋滤器分离出的尾气含 CO、H<sub>2</sub> 等可燃成分，本身就是一种燃料。'],
    [6.9, 13.6, '约 2/3 的尾气送往能源中心燃气锅炉，产生蒸汽，用于集中供热或发电。'],
    [13.7, 18.8, '约 1/3 送入尾气燃烧炉，为干燥机提供热源。'],
    [18.9, 23.8, '燃烧后的烟气经脱硫脱硝处理后，由烟囱排放。'],
    [23.9, 30.6, '长鸿炭黑：尾气替代其他装置所需的天然气，<br>自产蒸汽替代外购蒸汽，降低生产成本。']
  ],
  build(svg, html, S) {
    S.bf = el('g', {}, svg);
    el('path', { d: 'M 70,536 Q 70,520 86,520 H 274 Q 290,520 290,536 V 760 H 70 Z', fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.bf);
    for (let i = 0; i < 4; i++) el('rect', { x: 96 + i * 48, y: 578, width: 24, height: 170, rx: 12, fill: '#3A3C40', opacity: .85 }, S.bf);
    S.bfPlate = plate(svg, 180, 640, '主袋滤器', { color: SEC[3] });
    S.pTail = pipe(svg, poly([[180, 518], [180, 460], [466, 460]]), C.tail, { w: 13 });
    S.comp = tlabel(svg, 322, 418, '尾气：含 CO、H_2 等可燃成分', { size: 22, pill: '#F3F0FF', stroke: C.tail });
    S.node = el('circle', { cx: 480, cy: 460, r: 15, fill: C.tail, stroke: '#fff', 'stroke-width': 4 }, svg);
    S.pUp = pipe(svg, poly([[480, 446], [480, 300], [696, 300]]), C.tail, { w: 12 });
    S.upLbl = tlabel(svg, 580, 270, '约 2/3', { size: 24, pill: C.tail, fill: '#fff', weight: 900 });
    S.pDn = pipe(svg, poly([[480, 474], [480, 640], [696, 640]]), C.tail, { w: 12 });
    S.dnLbl = tlabel(svg, 580, 676, '约 1/3', { size: 24, pill: C.tail, fill: '#fff', weight: 900 });
    // 锅炉
    S.boil = el('g', {}, svg);
    el('rect', { x: 700, y: 212, width: 260, height: 210, rx: 12, fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.boil);
    el('rect', { x: 726, y: 316, width: 208, height: 90, rx: 8, fill: '#3B2A26' }, S.boil);
    S.bFl = [0, 1, 2, 3, 4].map(() => el('path', { fill: 'url(#flameUp)' }, S.boil));
    hcyl(S.boil, 720, 168, 220, 44);
    S.boilPlate = plate(svg, 830, 262, '能源中心 燃气锅炉', { size: 23, color: SEC[5] });
    S.pSteam = pipe(svg, poly([[942, 190], [1062, 190]]), '#ADB5BD', { w: 10 });
    S.steam = wisps(svg, 1080, 184, 10, { rise: 90, spread: 20, drift: 40, r: 10, color: '#DEE2E6', op: 0.85 });
    S.steamLbl = tlabel(svg, 1090, 140, '蒸汽 → 集中供热 / 发电', { size: 22, anchor: 'start', pill: '#F1F3F5', stroke: '#ADB5BD' });
    // 尾气燃烧炉 → 干燥机
    S.fur = el('g', {}, svg);
    el('rect', { x: 700, y: 570, width: 200, height: 150, rx: 10, fill: 'url(#bricks)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.fur);
    el('rect', { x: 722, y: 592, width: 156, height: 106, rx: 8, fill: '#3B2A26' }, S.fur);
    S.fFl = [0, 1, 2, 3].map(() => el('path', { fill: 'url(#flameUp)' }, S.fur));
    S.furPlate = plate(svg, 800, 750, '尾气燃烧炉', { color: SEC[5] });
    S.pHot = pipe(svg, poly([[902, 646], [992, 646]]), C.airHot, { w: 12 });
    S.hotLbl = tlabel(svg, 946, 612, '热风', { size: 21, fill: '#C2410C', weight: 900 });
    S.dry = el('g', {}, svg);
    el('rect', { x: 996, y: 616, width: 130, height: 60, rx: 16, fill: 'url(#steelH)', stroke: C.line, 'stroke-width': 3 }, S.dry);
    [1020, 1100].forEach(x => el('rect', { x: x - 6, y: 610, width: 12, height: 72, rx: 3, fill: 'url(#steelDark)' }, S.dry));
    S.dryLbl = tlabel(svg, 1061, 708, '干燥机', { size: 22, weight: 900 });
    // 脱硫脱硝 + 烟囱
    S.f1 = pipe(svg, poly([[962, 380], [1206, 380]]), '#868E96', { w: 10 });
    S.f2 = pipe(svg, poly([[1128, 646], [1166, 646], [1166, 560], [1206, 560]]), '#868E96', { w: 10 });
    S.fgLbl = tlabel(svg, 1086, 352, '燃烧烟气', { size: 21, fill: C.sub, weight: 800 });
    S.tw = vtank(svg, 1210, 250, 160, 470);
    S.twIn = el('g', {}, svg);
    [330, 420, 510, 600].forEach(y => el('rect', { x: 1230, y, width: 120, height: 34, rx: 4, fill: 'url(#mesh)', stroke: '#8A949E', 'stroke-width': 2 }, S.twIn));
    S.twPlate = plate(svg, 1290, 470, '脱硫脱硝', { color: SEC[5] });
    S.f3 = pipe(svg, poly([[1372, 300], [1490, 300]]), '#ADB5BD', { w: 10 });
    S.chim = el('g', {}, svg);
    el('path', { d: 'M 1490,780 L 1500,130 H 1552 L 1562,780 Z', fill: 'url(#steelV)', stroke: C.line, 'stroke-width': 3, filter: 'url(#shadow)' }, S.chim);
    [210, 250].forEach(y => el('rect', { x: 1499, y, width: 54, height: 12, fill: '#E03131', opacity: .75 }, S.chim));
    S.plume = wisps(svg, 1526, 124, 12, { rise: 120, spread: 18, drift: 60, r: 12, color: '#E9ECEF', op: 0.7, speed: 0.3 });
    S.emitLbl = tlabel(svg, 1526, 820, '烟囱排放', { size: 22, weight: 900, fill: '#2F9E44' });
    S.card = div(html, 'card co-card', `${head([['co', '长鸿炭黑']], '副产利用')}<ul style="font-size:23px"><li>尾气 → 替代其他装置所需的<span class="em">天然气</span></li><li>自产蒸汽 → 替代<span class="em">外购蒸汽</span></li><li>降本增效 · 协同利用</li></ul>`, 'left:1596px;top:300px;width:300px;padding:16px 20px 16px');
  },
  update(t, S) {
    popG(S.bf, t, 0, 180, 640, 0.01); vis(S.bfPlate, seg(t, 0.2, 0.6));
    S.pTail.set(t, seg(t, 0.5, 1.3), seg(t, 1.2, 1.6));
    popG(S.comp, t, 2.0, 322, 418);
    popG(S.node, t, 6.9, 480, 460);
    S.pUp.set(t, seg(t, 7.0, 7.8), seg(t, 7.7, 8.1)); popG(S.upLbl, t, 7.8, 580, 270);
    popG(S.boil, t, 7.4, 830, 300); vis(S.boilPlate, seg(t, 7.7, 8.1));
    const bf = seg(t, 8.0, 8.6);
    S.bFl.forEach((f, i) => {
      const x = 752 + i * 38, base = 402, h = (60 + (i % 2) * 18) * (0.85 + 0.15 * Math.sin(t * 8 + i * 1.3)) * bf, w = 26;
      f.setAttribute('d', `M ${x - w / 2},${base} C ${x - w * 0.7},${base - h * 0.4} ${x - w * 0.2},${base - h * 0.7} ${x + Math.sin(t * 7 + i) * 5},${base - h} C ${x + w * 0.2},${base - h * 0.7} ${x + w * 0.7},${base - h * 0.4} ${x + w / 2},${base} Z`);
    });
    S.pSteam.set(t, seg(t, 9.0, 9.6), seg(t, 9.5, 9.9)); S.steam.set(t, seg(t, 9.6, 10.2)); popG(S.steamLbl, t, 10.2, 1200, 140);
    S.pDn.set(t, seg(t, 13.7, 14.4), seg(t, 14.3, 14.7)); popG(S.dnLbl, t, 14.4, 580, 676);
    popG(S.fur, t, 14.0, 800, 645); vis(S.furPlate, seg(t, 14.3, 14.7));
    const ff = seg(t, 14.6, 15.2);
    S.fFl.forEach((f, i) => {
      const x = 752 + i * 32, base = 694, h = (58 + (i % 2) * 16) * (0.85 + 0.15 * Math.sin(t * 8 + i * 1.7)) * ff, w = 24;
      f.setAttribute('d', `M ${x - w / 2},${base} C ${x - w * 0.7},${base - h * 0.4} ${x - w * 0.2},${base - h * 0.7} ${x + Math.sin(t * 7 + i) * 5},${base - h} C ${x + w * 0.2},${base - h * 0.7} ${x + w * 0.7},${base - h * 0.4} ${x + w / 2},${base} Z`);
    });
    S.pHot.set(t, seg(t, 15.2, 15.8), seg(t, 15.7, 16.1)); vis(S.hotLbl, seg(t, 15.6, 16.0));
    popG(S.dry, t, 15.4, 1061, 646); vis(S.dryLbl, seg(t, 15.7, 16.1));
    S.f1.set(t, seg(t, 18.9, 19.6), seg(t, 19.5, 19.9)); S.f2.set(t, seg(t, 19.1, 19.8), seg(t, 19.7, 20.1)); vis(S.fgLbl, seg(t, 19.4, 19.9));
    popG(S.tw.g, t, 19.2, 1290, 485); vis(S.twIn, seg(t, 19.4, 19.8)); vis(S.twPlate, seg(t, 19.5, 19.9));
    S.f3.set(t, seg(t, 20.0, 20.6), seg(t, 20.5, 20.9));
    popG(S.chim, t, 20.2, 1526, 455); S.plume.set(t, seg(t, 20.8, 21.5)); vis(S.emitLbl, seg(t, 21.2, 21.7));
    popH(S.card, t, 24.0);
  }
});

/* ================= 回顾 ================= */
scene({
  key: 'recap', section: 0, dur: 24, menu: '回顾 · 工序与指标',
  chap: { num: '回顾', t: '工序与质量指标', s: '客户在 COA 上看到的每项指标，都来自某道工序', c: SEC[0] },
  caps: [
    [0.3, 8.6, '回顾全流程：原料油预热后进反应炉生成炭黑，降温后袋滤收集，<br>再粉碎、造粒、干燥、筛选、磁选，最后包装入库。'],
    [8.7, 16.2, '每道工序都对应客户 COA 上的指标：反应决定吸碘值、吸油值和着色强度；<br>造粒和筛选影响细粉、颗粒强度和倾注密度。'],
    [16.3, 23.6, '干燥影响加热减量；粉碎和磁选控制筛余物；<br>原料与工艺水质影响灰分和 pH。']
  ],
  build(svg, html, S) {
    const N = [['原料油', 1], ['预热', 1], ['反应炉', 2], ['换热降温', 2], ['袋滤收集', 3], ['粉碎', 3], ['造粒', 4], ['干燥', 4], ['筛选', 4], ['磁选', 4], ['包装入库', 4]];
    const x0 = 118, dx = 168, y = 238;
    S.nodes = N.map(([s, sec], i) => {
      const g = el('g', {}, svg), x = x0 + i * dx;
      el('circle', { cx: x, cy: y, r: 38, fill: SEC[sec], stroke: '#fff', 'stroke-width': 5, filter: 'url(#shadow)' }, g);
      tlabel(g, x, y + 1, String(i + 1), { size: 30, weight: 900, fill: '#fff' });
      tlabel(g, x, y + 68, s, { size: 25, weight: 900 });
      return { g, x };
    });
    S.links = N.slice(0, -1).map((_, i) => el('path', { d: `M ${x0 + i * dx + 48},${y} H ${x0 + (i + 1) * dx - 50}`, stroke: '#ADB5BD', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg));
    S.dot = el('circle', { r: 12, fill: '#F08C00', stroke: '#fff', 'stroke-width': 4 }, svg);
    S.table = div(html, 'card recap', `<h4>工序 → 客户在 COA 上看到的指标</h4>
      <table>
      <tr><th style="width:36%">工序</th><th style="width:22%">控制的是什么</th><th>对应指标</th></tr>
      <tr><td>反应（温度、油气比、急冷位置、K<sub>2</sub>CO<sub>3</sub>）</td><td>粒径、结构</td><td>吸碘值 / 比表面积、吸油值（OAN / COAN）、着色强度</td></tr>
      <tr><td>造粒、筛选</td><td>颗粒大小与强度</td><td>细粉含量、颗粒强度、倾注密度</td></tr>
      <tr><td>干燥</td><td>水分</td><td>加热减量</td></tr>
      <tr><td>粉碎、磁选</td><td>硬粒、铁屑</td><td>45 µm 筛余物</td></tr>
      <tr><td>原料、急冷水、造粒水</td><td>无机盐、碱性物质</td><td>灰分、pH</td></tr>
      </table>`, 'left:150px;top:372px;width:1620px;padding:18px 30px 14px');
    S.rows = [...S.table.querySelectorAll('tr')].slice(1);
  },
  update(t, S) {
    S.nodes.forEach((n, i) => popG(n.g, t, 0.4 + i * 0.28, n.x, 238, 0.4));
    S.links.forEach((l, i) => { l.style.opacity = seg(t, 0.6 + i * 0.28, 0.9 + i * 0.28); });
    const k = seg(t, 4.2, 8.4);
    const fx = lerp(118, 118 + 10 * 168, eio(k));
    S.dot.setAttribute('cx', fx); S.dot.setAttribute('cy', 238 - 50);
    S.dot.style.opacity = k > 0 && k < 1 ? 1 : 0;
    popH(S.table, t, 8.7);
    const rt = [8.9, 11.6, 16.4, 18.4, 20.4];
    S.rows.forEach((r, i) => { r.style.opacity = seg(t, rt[i], rt[i] + 0.5); });
  }
});

/* ================= 片尾：三大基地 + 资料来源 ================= */
scene({
  key: 'end', section: 0, dur: 13, chap: null, menu: '片尾 · 三大生产基地',
  caps: [
    [0.3, 7.0, '长鸿炭黑：嵊州、宁波生产硬质炭黑，防城港生产软质炭黑，<br>硬质、软质牌号全覆盖。']
  ],
  build(svg, html, S) {
    S.title = div(html, '', '长鸿炭黑 · 三大生产基地', 'position:absolute;left:0;right:0;top:190px;text-align:center;font-size:56px;font-weight:900;letter-spacing:4px');
    const B = [
      ['浙江嵊州', '硬质炭黑', 'N220、N330、N326、N234、N375', '规划：特种纤维炭黑'],
      ['浙江宁波', '硬质炭黑', 'N330、N326', '距宁波港约 5 km'],
      ['广西防城港', '软质炭黑', 'N550、N660、N774', '距港区约 35 km，辐射东南亚；规划：特种导电炭黑']
    ];
    S.cards = B.map(([a, b, c, d], i) => div(html, 'card', `<div style="font-size:36px;font-weight:900">${a}</div>
      <div style="margin:8px 0 14px"><span class="tag" style="background:${i === 2 ? '#0F766E' : '#343A40'};font-size:20px">${b}</span></div>
      <div style="font-size:25px;font-weight:800;color:#1E2328">${c}</div>
      <div class="muted" style="margin-top:10px;font-size:21px">${d}</div>`, `left:${200 + i * 520}px;top:318px;width:480px;height:262px;padding:26px 30px`));
    S.cap = div(html, '', '规划总产能 100 万吨（公司介绍资料）', 'position:absolute;left:0;right:0;top:620px;text-align:center;font-size:30px;font-weight:800;color:#B42318');
    S.src = div(html, '', `资料来源：培训课件《炭黑的工艺与分析》（工艺流程与流程图）；《浙江长鸿炭黑介绍资料》、长鸿炭黑 TDS（公司数据）；<br>US EPA AP-42 §6.1 Carbon Black（反应温度、收率规律等行业通用数据）。画面为原理示意，设备形态与实际装置不同。`,
      'position:absolute;left:180px;right:180px;top:708px;text-align:center;font-size:21px;line-height:1.7;color:#6B7480');
  },
  update(t, S) {
    popH(S.title, t, 0.2);
    S.cards.forEach((c, i) => popH(c, t, 0.7 + i * 0.4));
    popH(S.cap, t, 2.4);
    popH(S.src, t, 3.2);
  }
});
