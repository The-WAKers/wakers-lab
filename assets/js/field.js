/* The WAKers — "confocal field": procedurally drawn organoids for the hero and page bands,
   plus the small eyepiece specimens on research cards. No dependencies. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var CH = { dapi: [91, 130, 255], ck8: [46, 230, 160], ck5: [242, 75, 208] };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  /* ------------------------------------------------------------ geometry (unit radius = 1) */
  function cystGeometry(rand) {
    var p1 = rand() * TAU, p2 = rand() * TAU;
    var rad = function (t) { return 1 + 0.06 * Math.sin(3 * t + p1) + 0.04 * Math.sin(5 * t + p2); };
    var g = { kind: 'cyst', rad: rad, basal: [], luminal: [], debris: [] };
    var nb = 30 + Math.floor(rand() * 8);
    for (var i = 0; i < nb; i++) {
      var th = TAU * (i + (rand() - 0.5) * 0.5) / nb, r = rad(th) * 0.93;
      g.basal.push({ x: r * Math.cos(th), y: r * Math.sin(th), a: th + Math.PI / 2, b: 0.8 + rand() * 0.2 });
    }
    var nl = Math.round(nb * 1.25);
    for (var j = 0; j < nl; j++) {
      var t2 = TAU * (j + (rand() - 0.5) * 0.6) / nl, r2 = rad(t2) * (0.76 + rand() * 0.04);
      g.luminal.push({ x: r2 * Math.cos(t2), y: r2 * Math.sin(t2), a: t2 + Math.PI / 2, t: t2, b: 0.8 + rand() * 0.2 });
    }
    for (var k = 0; k < 12; k++) {
      var a3 = rand() * TAU, d3 = rand() * 0.5;
      g.debris.push({ x: d3 * Math.cos(a3), y: d3 * Math.sin(a3), r: 0.012 + rand() * 0.01 });
    }
    return g;
  }
  function sphereGeometry(rand) {
    var g = { kind: 'sphere', cells: [] };
    var step = 0.105, rows = Math.ceil(2 / (step * 0.866));
    for (var r = 0; r <= rows; r++) {
      var y = -1 + r * step * 0.866;
      for (var x = -1 + (r % 2 ? step / 2 : 0); x <= 1; x += step) {
        var jx = x + (rand() - 0.5) * step * 0.45, jy = y + (rand() - 0.5) * step * 0.45;
        var d = Math.sqrt(jx * jx + jy * jy);
        if (d < 0.95) g.cells.push({ x: jx, y: jy, d: d, a: rand() * TAU, ki: rand() < 0.16, b: 0.75 + rand() * 0.25 });
      }
    }
    return g;
  }

  function neuronGeometry(rand) {
    var g = { kind: 'neuron', dend: [], axon: [], soma: 0.10 + rand() * 0.03 };
    function branch(x, y, ang, len, w, depth, out) {
      var steps = Math.max(3, Math.round(len / 0.055)), pts = [[x, y]];
      for (var i = 0; i < steps; i++) {
        ang += (rand() - 0.5) * 0.34;
        x += 0.055 * Math.cos(ang); y += 0.055 * Math.sin(ang);
        pts.push([x, y]);
        if (depth < 2 && rand() < 0.15) branch(x, y, ang + (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.5), len * 0.55, w * 0.68, depth + 1, out);
      }
      out.push({ pts: pts, w: w });
    }
    var n = 4 + Math.floor(rand() * 3), base = rand() * TAU;
    for (var i = 0; i < n; i++) branch(0, 0, base + TAU * (i + rand() * 0.4) / n, 0.42 + rand() * 0.34, 0.021, 0, g.dend);
    branch(0, 0, rand() * TAU, 0.95 + rand() * 0.25, 0.013, 2, g.axon);
    return g;
  }

  /* ------------------------------------------------------------ drawing a geometry into a sprite */
  function drawGeometry(ctx, g, R, cx, cy, on, gain) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var s = R / 230;
    if (g.kind === 'cyst') {
      if (on.ck5) {
        ctx.fillStyle = rgba(CH.ck5, 0.34 * gain);
        g.basal.forEach(function (c) { ctx.beginPath(); ctx.ellipse(cx + c.x * R, cy + c.y * R, 19 * s, 12 * s, c.a, 0, TAU); ctx.fill(); });
      }
      if (on.ck8) {
        ctx.fillStyle = rgba(CH.ck8, 0.26 * gain);
        g.luminal.forEach(function (c) {
          var rc = g.rad(c.t) * 0.77;
          ctx.beginPath(); ctx.ellipse(cx + rc * Math.cos(c.t) * R, cy + rc * Math.sin(c.t) * R, 10 * s, 23 * s, c.a, 0, TAU); ctx.fill();
        });
        ctx.strokeStyle = rgba(CH.ck8, 0.75 * gain);
        ctx.lineWidth = Math.max(1.2, R / 80);
        ctx.beginPath();
        for (var t = 0; t <= TAU + 0.01; t += TAU / 160) {
          var rr = g.rad(t) * 0.68 * R;
          if (t === 0) ctx.moveTo(cx + rr, cy); else ctx.lineTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
        }
        ctx.stroke();
      }
      if (on.dapi) {
        g.basal.forEach(function (c) { ctx.fillStyle = rgba(CH.dapi, 0.8 * c.b * gain); ctx.beginPath(); ctx.ellipse(cx + c.x * R, cy + c.y * R, 13 * s, 7.5 * s, c.a, 0, TAU); ctx.fill(); });
        g.luminal.forEach(function (c) { ctx.fillStyle = rgba(CH.dapi, 0.85 * c.b * gain); ctx.beginPath(); ctx.ellipse(cx + c.x * R, cy + c.y * R, 7.5 * s, 12 * s, c.a, 0, TAU); ctx.fill(); });
        ctx.fillStyle = rgba(CH.dapi, 0.35 * gain);
        g.debris.forEach(function (d) { ctx.beginPath(); ctx.arc(cx + d.x * R, cy + d.y * R, Math.max(1, d.r * R), 0, TAU); ctx.fill(); });
      }
    } else if (g.kind === 'neuron') {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var stroke = function (list, col, alpha, mul) {
        list.forEach(function (b) {
          ctx.strokeStyle = rgba(col, alpha * gain);
          ctx.lineWidth = Math.max(1, b.w * R * mul);
          ctx.beginPath();
          b.pts.forEach(function (p, i) { if (i) ctx.lineTo(cx + p[0] * R, cy + p[1] * R); else ctx.moveTo(cx + p[0] * R, cy + p[1] * R); });
          ctx.stroke();
        });
      };
      if (on.ck5) stroke(g.axon, CH.ck5, 0.85, 1);
      if (on.ck8) {
        stroke(g.dend, CH.ck8, 0.82, 1);
        ctx.fillStyle = rgba(CH.ck8, 0.6 * gain);
        ctx.beginPath(); ctx.ellipse(cx, cy, g.soma * R * 1.25, g.soma * R, 0.4, 0, TAU); ctx.fill();
      }
      if (on.dapi) {
        ctx.fillStyle = rgba(CH.dapi, 0.9 * gain);
        ctx.beginPath(); ctx.ellipse(cx, cy, g.soma * R * 0.72, g.soma * R * 0.62, 0.4, 0, TAU); ctx.fill();
      }
    } else {
      var cr = 0.052 * R;
      if (on.ck8) {
        ctx.lineWidth = Math.max(1, R / 120);
        g.cells.forEach(function (c) {
          ctx.strokeStyle = rgba(CH.ck8, (0.22 + 0.5 * Math.pow(c.d, 3)) * gain);
          ctx.beginPath(); ctx.arc(cx + c.x * R, cy + c.y * R, cr * 1.3, 0, TAU); ctx.stroke();
        });
      }
      if (on.dapi) {
        g.cells.forEach(function (c) { ctx.fillStyle = rgba(CH.dapi, 0.78 * c.b * gain); ctx.beginPath(); ctx.ellipse(cx + c.x * R, cy + c.y * R, cr, cr * 0.84, c.a, 0, TAU); ctx.fill(); });
      }
      if (on.ck5) {
        ctx.fillStyle = rgba(CH.ck5, 0.7 * gain);
        g.cells.forEach(function (c) { if (c.ki) { ctx.beginPath(); ctx.ellipse(cx + c.x * R, cy + c.y * R, cr * 0.82, cr * 0.7, c.a, 0, TAU); ctx.fill(); } });
      }
    }
    ctx.restore();
  }

  // cheap, cross-browser blur: shrink then enlarge with smoothing
  function soften(src, factor) {
    var w = Math.max(2, Math.round(src.width / factor)), h = Math.max(2, Math.round(src.height / factor));
    var small = makeCanvas(w, h), sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, w, h);
    var out = makeCanvas(src.width, src.height), octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
    octx.drawImage(small, 0, 0, out.width, out.height);
    return out;
  }

  function buildSprites(g, R, scale, on, gain) {
    var S = Math.ceil(R * 2.5 * scale);
    var core = makeCanvas(S, S), ctx = core.getContext('2d');
    drawGeometry(ctx, g, R * scale, S / 2, S / 2, on, gain);
    var glow = soften(core, 7);
    var sharp = makeCanvas(S, S), sh = sharp.getContext('2d');
    sh.globalCompositeOperation = 'lighter';
    sh.globalAlpha = 0.85; sh.drawImage(glow, 0, 0);
    sh.globalAlpha = 1; sh.drawImage(core, 0, 0);
    var soft = soften(sharp, 5);
    var soft2 = makeCanvas(S, S), s2 = soft2.getContext('2d');
    s2.globalCompositeOperation = 'lighter';
    s2.drawImage(soft, 0, 0); s2.globalAlpha = 0.5; s2.drawImage(soften(soft, 3), 0, 0);
    return { size: S, scale: scale, sharp: sharp, soft: soft2 };
  }

  /* ------------------------------------------------------------ the field */
  function layout(W, H, variant) {
    var narrow = W < 700;
    if (variant === 'band') {
      var ub = Math.min(W * 0.09, H * 0.34);
      return [
        { kind: 'cyst', x: 0.84, y: 0.52, R: 1.05 * ub, z: 0.3, seed: 11 },
        { kind: 'neuron', x: 0.62, y: 0.28, R: 0.95 * ub, z: 0.62, seed: 12 },
        { kind: 'cyst', x: 0.98, y: 0.08, R: 0.6 * ub, z: 0.85, seed: 13 },
        { kind: 'sphere', x: 0.6, y: 0.9, R: 0.5 * ub, z: 0.5, seed: 14 }
      ];
    }
    var u = narrow ? Math.min(W * 0.2, H * 0.17) : Math.min(W * 0.105, H * 0.24);
    if (narrow) {
      return [
        { kind: 'cyst', x: 0.86, y: 0.16, R: 1.0 * u, z: 0.35, seed: 3 },
        { kind: 'neuron', x: 0.82, y: 0.9, R: 1.0 * u, z: 0.5, seed: 21 },
        { kind: 'sphere', x: 0.2, y: 0.93, R: 0.5 * u, z: 0.25, seed: 5 },
        { kind: 'cyst', x: 0.98, y: 0.92, R: 0.8 * u, z: 0.85, seed: 7 }
      ];
    }
    return [
      { kind: 'cyst', x: 0.70, y: 0.50, R: 1.2 * u, z: 0.34, seed: 3 },
      { kind: 'neuron', x: 0.91, y: 0.19, R: 1.15 * u, z: 0.48, seed: 21 },
      { kind: 'neuron', x: 0.56, y: 0.86, R: 0.82 * u, z: 0.66, seed: 22 },
      { kind: 'sphere', x: 0.88, y: 0.74, R: 0.5 * u, z: 0.22, seed: 6 },
      { kind: 'cyst', x: 0.50, y: 0.12, R: 0.42 * u, z: 0.86, seed: 4 },
      { kind: 'sphere', x: 1.0, y: 0.44, R: 0.45 * u, z: 0.92, seed: 5 },
      { kind: 'cyst', x: 1.07, y: 0.92, R: 1.3 * u, z: 1.0, seed: 8 }
    ];
  }

  function Field(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.variant = this.opts.variant || 'hero';
    this.on = { dapi: true, ck8: true, ck5: true };
    this.gain = this.variant === 'band' ? 0.8 : 1;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.t0 = performance.now();
    this.running = false;
    this.visible = true;
    this.resize();
    var self = this;
    if (window.ResizeObserver) {
      var tm;
      new ResizeObserver(function () { clearTimeout(tm); tm = setTimeout(function () { self.resize(); }, 120); }).observe(canvas);
    }
    if (!reduceMotion && this.variant === 'hero') {
      canvas.parentElement.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        self.pointer.tx = (e.clientX - r.left) / r.width - 0.5;
        self.pointer.ty = (e.clientY - r.top) / r.height - 0.5;
      });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; if (self.visible) self.start(); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) self.start(); });
    this.start();
  }
  Field.prototype.resize = function () {
    var c = this.canvas, r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    this.items = layout(this.W, this.H, this.variant).map(function (o) {
      var rand = rng(o.seed * 7919);
      return {
        spec: o, g: o.kind === 'cyst' ? cystGeometry(rand) : (o.kind === 'neuron' ? neuronGeometry(rand) : sphereGeometry(rand)),
        ph: rand() * TAU, ph2: rand() * TAU, rot: rand() * TAU, amp: 10 + rand() * 16, w: 0.05 + rand() * 0.05
      };
    });
    var pr = rng(99);
    this.cells = [];
    var n = Math.round((this.W * this.H) / (this.variant === 'band' ? 9000 : 6000));
    for (var i = 0; i < n; i++) this.cells.push({ x: pr(), y: pr(), r: 1 + pr() * 2.2, z: pr(), ph: pr() * TAU });
    this.rebuild();
    this.draw(this.lastT || 0);
  };
  Field.prototype.rebuild = function () {
    var self = this;
    this.items.forEach(function (it) { it.spr = buildSprites(it.g, it.spec.R, Math.min(self.dpr, 1.25), self.on, self.gain); });
    var cyst = this.items.filter(function (it) { return it.spec.kind === 'cyst'; })[0];
    if (typeof this.opts.onScale === 'function' && cyst) {
      // the leading organoid is drawn at roughly 150 µm radius
      this.opts.onScale(cyst.spec.R / 1.5);
    }
  };
  Field.prototype.setChannel = function (ch, value) {
    this.on[ch] = value;
    this.rebuild();
    this.draw(this.lastT || 0);
  };
  Field.prototype.start = function () {
    if (reduceMotion || this.running) return;
    this.running = true;
    var self = this, last = 0;
    function frame(now) {
      if (!self.visible || document.hidden) { self.running = false; return; }
      if (now - last > 33) { last = now; self.draw((now - self.t0) / 1000); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  Field.prototype.draw = function (t) {
    this.lastT = t;
    var ctx = this.ctx, W = this.W, H = this.H, dpr = this.dpr;
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var p = this.pointer;
    p.x += (p.tx - p.x) * 0.06; p.y += (p.ty - p.y) * 0.06;
    ctx.globalCompositeOperation = 'lighter';
    // loose single cells
    var cellA = this.variant === 'band' ? 0.4 : 0.55;
    for (var i = 0; i < this.cells.length; i++) {
      var c = this.cells[i];
      var x = c.x * W + Math.sin(t * 0.08 + c.ph) * 8 - p.x * 10 * (1 - c.z);
      var y = c.y * H + Math.cos(t * 0.07 + c.ph) * 6 - p.y * 10 * (1 - c.z);
      ctx.fillStyle = rgba(CH.dapi, (this.on.dapi ? cellA : 0.12) * (0.4 + 0.6 * (1 - c.z)));
      ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.fill();
    }
    // slow focus pull through the depth of the gel
    var focus = 0.5 + 0.38 * Math.sin(t * 0.13);
    for (var k = 0; k < this.items.length; k++) {
      var it = this.items[k], s = it.spec, spr = it.spr;
      if (!spr) continue;
      var blur = Math.min(1, Math.abs(s.z - focus) * 2.3);
      if (s.z >= 0.99) blur = 1;
      var bright = (0.55 + 0.45 * (1 - s.z * 0.6)) * (this.variant === 'band' ? 0.85 : 1);
      var ox = Math.sin(t * it.w + it.ph) * it.amp - p.x * 22 * (1 - s.z);
      var oy = Math.cos(t * it.w * 0.8 + it.ph2) * it.amp * 0.7 - p.y * 16 * (1 - s.z);
      var breathe = 1 + 0.015 * Math.sin(t * 0.25 + it.ph);
      var size = spr.size / spr.scale * breathe;
      ctx.save();
      ctx.translate(s.x * W + ox, s.y * H + oy);
      ctx.rotate(it.rot + Math.sin(t * 0.03 + it.ph) * 0.08);
      ctx.globalAlpha = bright * (1 - blur);
      if (ctx.globalAlpha > 0.01) ctx.drawImage(spr.sharp, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = bright * blur * 0.95;
      if (ctx.globalAlpha > 0.01) ctx.drawImage(spr.soft, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------ eyepiece specimens (research cards) */
  function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function drawSpecimen(canvas, type, glowHex, seed) {
    var size = canvas.clientWidth || canvas.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var col = hexToRgb(glowHex || '#5B82FF'), blue = CH.dapi, cx = size / 2, cy = size / 2, R = size * 0.34;
    var rand = rng(seed || 7);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = rgba(col, 0.9); ctx.shadowBlur = size * 0.08;
    function dot(x, y, r, c, a) { ctx.fillStyle = rgba(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    var i, t, n;
    if (type === 'organoid') {
      n = 16;
      for (i = 0; i < n; i++) { t = TAU * i / n; ctx.fillStyle = rgba(col, 0.55); ctx.beginPath(); ctx.ellipse(cx + Math.cos(t) * R, cy + Math.sin(t) * R, size * 0.05, size * 0.085, t + Math.PI / 2, 0, TAU); ctx.fill(); }
      ctx.shadowColor = rgba(blue, 0.9);
      for (i = 0; i < n; i++) { t = TAU * (i + 0.5) / n; dot(cx + Math.cos(t) * R * 0.98, cy + Math.sin(t) * R * 0.98, size * 0.025, blue, 0.9); }
    } else if (type === 'sphere') {
      for (i = 0; i < 26; i++) {
        var a = rand() * TAU, d = Math.sqrt(rand()) * R * 1.05;
        dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * 0.042, i % 5 === 0 ? col : blue, i % 5 === 0 ? 0.95 : 0.7);
      }
      ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.stroke();
    } else if (type === 'gland') {
      [[-0.38, -0.2, 0.46], [0.36, -0.28, 0.4], [0.02, 0.36, 0.5]].forEach(function (g) {
        var gx = cx + g[0] * size * 0.62, gy = cy + g[1] * size * 0.62, gr = g[2] * R * 0.95;
        for (var j = 0; j < 10; j++) { var tt = TAU * j / 10; dot(gx + Math.cos(tt) * gr, gy + Math.sin(tt) * gr, size * 0.03, j % 2 ? blue : col, 0.85); }
      });
    } else if (type === 'urothelium') {
      for (var row = 0; row < 3; row++) {
        for (i = 0; i < 6 - (row === 2 ? 1 : 0); i++) {
          var x = cx + (i - 2.5 + (row === 2 ? 0.5 : 0)) * size * 0.12, y = cy + (0.22 - row * 0.18) * size;
          if (row === 2) { ctx.fillStyle = rgba(col, 0.75); ctx.beginPath(); ctx.ellipse(x, y, size * 0.07, size * 0.04, 0, 0, TAU); ctx.fill(); }
          else dot(x, y, size * 0.034, blue, 0.8);
        }
      }
    } else if (type === 'neuron') {
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      function br(x0, y0, ang, len, depth) {
        var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (depth < 2) { br(x1, y1, ang - 0.5, len * 0.62, depth + 1); br(x1, y1, ang + 0.45, len * 0.6, depth + 1); }
      }
      for (i = 0; i < 5; i++) br(cx, cy, TAU * i / 5 + 0.3, size * 0.16, 0);
      dot(cx, cy, size * 0.07, col, 0.9);
      ctx.shadowColor = rgba(blue, 0.9); dot(cx, cy, size * 0.04, blue, 0.95);
    } else if (type === 'molecule') {
      ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = 1.5;
      var hr = R * 0.62, pts = [];
      for (i = 0; i < 6; i++) { t = TAU * i / 6 + Math.PI / 6; pts.push([cx + Math.cos(t) * hr, cy + Math.sin(t) * hr]); }
      ctx.beginPath(); pts.forEach(function (q, k) { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke();
      [0, 3].forEach(function (k) { var q = pts[k], dx = q[0] - cx, dy = q[1] - cy; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + dx * 0.55, q[1] + dy * 0.55); ctx.stroke(); dot(q[0] + dx * 0.6, q[1] + dy * 0.6, size * 0.035, blue, 0.95); });
      pts.forEach(function (q) { dot(q[0], q[1], size * 0.028, col, 0.95); });
    } else if (type === 'neurosphere') {
      ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (i = 0; i < 16; i++) {          // processes radiating from the sphere edge
        t = TAU * i / 16 + rand() * 0.2;
        var L = size * (0.09 + rand() * 0.12), x0 = cx + Math.cos(t) * R * 0.92, y0 = cy + Math.sin(t) * R * 0.92;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(t + rand() * 0.4 - 0.2) * L, y0 + Math.sin(t + rand() * 0.4 - 0.2) * L);
        ctx.stroke();
      }
      for (i = 0; i < 22; i++) {
        var aa = rand() * TAU, dd = Math.sqrt(rand()) * R * 0.86;
        dot(cx + Math.cos(aa) * dd, cy + Math.sin(aa) * dd, size * 0.04, i % 4 === 0 ? col : blue, i % 4 === 0 ? 0.9 : 0.72);
      }
    } else if (type === 'gbm') {
      // pseudopalisading: elongated nuclei crowding around a dark necrotic core
      var ph = rand() * TAU;
      var rr = function (a) { return R * (0.52 + 0.1 * Math.sin(2 * a + ph) + 0.06 * Math.sin(3 * a)); };
      for (i = 0; i < 22; i++) {
        t = TAU * i / 22 + rand() * 0.06;
        for (var ring = 0; ring < 2; ring++) {
          var d2 = rr(t) + ring * size * 0.075;
          ctx.fillStyle = rgba(ring ? col : blue, ring ? 0.7 : 0.88);
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(t) * d2, cy + Math.sin(t) * d2, size * 0.052, size * 0.022, t + Math.PI / 2, 0, TAU);
          ctx.fill();
        }
      }
      for (i = 0; i < 9; i++) {           // infiltrating cells at the margin
        var a4 = rand() * TAU, d4 = R * (1.05 + rand() * 0.25);
        dot(cx + Math.cos(a4) * d4, cy + Math.sin(a4) * d4, size * 0.025, blue, 0.55);
      }
    }
  }

  window.WAKField = {
    mount: function (canvas, opts) { try { return new Field(canvas, opts); } catch (e) { if (window.console) console.warn('Field disabled:', e); return null; } },
    specimen: drawSpecimen,
    channels: CH
  };
})();

