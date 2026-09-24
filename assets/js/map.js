/* The WAKers — dotted world map for "Where are WAKers now?".
   Uses window.WAK_GEO (assets/js/geo-data.js). Natural Earth I projection, drawn on canvas. */
(function () {
  'use strict';
  var TAU = Math.PI * 2, RAD = Math.PI / 180;

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[’'`.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function ne1(lambda, phi) {
    var phi2 = phi * phi, phi4 = phi2 * phi2;
    return [
      lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
      phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)))
    ];
  }
  function project(lon, lat) {
    var P = window.WAK_GEO.proj, xy = ne1(lon * RAD, Math.max(P.latMin, Math.min(P.latMax, lat)) * RAD);
    return [(xy[0] + P.xMax) / (2 * P.xMax), (P.yTop - xy[1]) / (P.yTop - P.yBot)];
  }

  /* Resolve a place typed by a person into coordinates: explicit lat/lng > city > country. */
  function resolve(city, country, lat, lng) {
    var G = window.WAK_GEO;
    if (!G) return null;
    var la = parseFloat(lat), lo = parseFloat(lng);
    var cc = G.aliases[norm(country)] || (String(country || '').length === 2 ? String(country).toUpperCase() : null);
    if (isFinite(la) && isFinite(lo)) return { lon: lo, lat: la, cc: cc, precision: 'exact' };
    if (city) {
      var key = norm(city);
      if (cc && G.cities[key + '|' + cc]) { var c = G.cities[key + '|' + cc]; return { lon: c[0], lat: c[1], cc: cc, precision: 'city' }; }
      if (!cc) {
        for (var k in G.cities) { if (k.split('|')[0] === key) { var c2 = G.cities[k]; return { lon: c2[0], lat: c2[1], cc: k.split('|')[1], precision: 'city' }; } }
      }
    }
    if (cc && G.countries[cc]) return { lon: G.countries[cc][0], lat: G.countries[cc][1], cc: cc, precision: 'country' };
    return null;
  }
  function countryName(cc) { var G = window.WAK_GEO; return (G && G.countryNames[cc]) || cc || ''; }

  function WorldMap(wrap, opts) {
    this.wrap = wrap;
    this.opts = opts;
    this.canvas = wrap.querySelector('canvas');
    this.tip = wrap.querySelector('.map-tip');
    this.ctx = this.canvas.getContext('2d');
    this.progress = 1; // drawn complete: the map reads at rest, no intro animation
    var self = this;
    this.resize();
    if (window.ResizeObserver) {
      var tm;
      new ResizeObserver(function () { clearTimeout(tm); tm = setTimeout(function () { self.resize(); }, 100); }).observe(this.canvas);
    }
    this.canvas.addEventListener('pointermove', function (e) { self.hover(e); });
    this.canvas.addEventListener('pointerleave', function () { self.hideTip(); });
    this.canvas.addEventListener('click', function (e) { self.hover(e); });
  }
  WorldMap.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    var G = window.WAK_GEO, dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width; this.H = r.width / G.proj.aspect; this.dpr = dpr;
    this.canvas.width = Math.round(this.W * dpr); this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.height = this.H + 'px';
    var self = this;
    this.markers = (this.opts.points || []).map(function (p) {
      var uv = project(p.lon, p.lat);
      return Object.assign({ x: uv[0] * self.W, y: uv[1] * self.H }, p);
    });
    if (this.opts.home) { var h = project(this.opts.home.lon, this.opts.home.lat); this.home = { x: h[0] * this.W, y: h[1] * this.H }; }
    this.draw();
  };
  WorldMap.prototype.draw = function () {
    var G = window.WAK_GEO, ctx = this.ctx, W = this.W, H = this.H, dpr = this.dpr;
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var cols = G.grid.cols, step = W / cols, rstep = G.grid.rowStep * H, dotR = Math.max(1, step * 0.26);
    ctx.fillStyle = 'rgba(150, 168, 205, 0.26)';
    for (var r = 0; r < G.grid.runs.length; r++) {
      var runs = G.grid.runs[r], y = (r + 0.5) * rstep, off = (r % 2) ? 0.5 : 0;
      for (var i = 0; i < runs.length; i += 2) {
        for (var c = runs[i]; c < runs[i] + runs[i + 1]; c++) {
          ctx.beginPath(); ctx.arc((c + 0.5 + off) * step, y, dotR, 0, TAU); ctx.fill();
        }
      }
    }
    var home = this.home, pr = this.progress, self = this;
    // arcs from Beirut
    if (home) {
      ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      this.markers.forEach(function (m, idx) {
        var dx = m.x - home.x, dy = m.y - home.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 6) return;
        var local = pr >= 1 ? 1 : Math.max(0, Math.min(1, pr * 1.6 - idx * 0.04));
        if (local <= 0) return;
        var mx = (home.x + m.x) / 2, my = (home.y + m.y) / 2 - dist * 0.28;
        var grad = ctx.createLinearGradient(home.x, home.y, m.x, m.y);
        grad.addColorStop(0, 'rgba(91,130,255,0.75)'); grad.addColorStop(1, m.example ? 'rgba(242,75,208,0.35)' : 'rgba(242,75,208,0.8)');
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(home.x, home.y);
        var N = 40, lim = Math.round(N * local);
        for (var s = 1; s <= lim; s++) {
          var t = s / N, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t;
          ctx.lineTo(a * home.x + b * mx + cc * m.x, a * home.y + b * my + cc * m.y);
        }
        ctx.stroke();
      });
    }
    // markers
    this.markers.forEach(function (m, idx) {
      if (pr < 1 && pr * 1.6 - idx * 0.04 - 0.35 <= 0) return;
      var rad = 3.5 + Math.min(4, Math.sqrt(m.count || 1) * 1.4);
      var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rad * 3.2);
      g.addColorStop(0, m.example ? 'rgba(242,75,208,0.35)' : 'rgba(242,75,208,0.6)'); g.addColorStop(1, 'rgba(242,75,208,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, rad * 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = m.example ? 'rgba(242,120,220,0.55)' : '#F7A8E6';
      ctx.beginPath(); ctx.arc(m.x, m.y, rad, 0, TAU); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#04060B'; ctx.stroke();
      if ((m.count || 1) > 1) {
        ctx.fillStyle = '#04060B'; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(m.count), m.x, m.y + 0.5);
      }
    });
    if (home) {
      var hg = ctx.createRadialGradient(home.x, home.y, 0, home.x, home.y, 22);
      hg.addColorStop(0, 'rgba(91,130,255,0.7)'); hg.addColorStop(1, 'rgba(91,130,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(home.x, home.y, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#AFC3FF'; ctx.beginPath(); ctx.arc(home.x, home.y, 5, 0, TAU); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#04060B'; ctx.stroke();
      ctx.strokeStyle = 'rgba(175,195,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(home.x, home.y, 10, 0, TAU); ctx.stroke();
    }
  };
  WorldMap.prototype.hover = function (e) {
    var r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var best = null, bd = 18 * 18;
    var cands = this.markers.slice();
    if (this.home) cands.push(Object.assign({ isHome: true }, this.home, this.opts.home));
    cands.forEach(function (m) { var d = (m.x - x) * (m.x - x) + (m.y - y) * (m.y - y); if (d < bd) { bd = d; best = m; } });
    if (!best) return this.hideTip();
    var tip = this.tip;
    tip.textContent = '';
    var head = document.createElement('b');
    head.textContent = best.isHome ? best.label : best.place;
    tip.appendChild(head);
    function row(text) { var r = document.createElement('div'); r.className = 'row'; r.textContent = text; tip.appendChild(r); }
    var people = best.people || [];
    if (best.isHome && best.sub) row(best.sub);
    if (best.isHome && people.length) row(people.length + (people.length === 1 ? ' WAKer' : ' WAKers') + ' still in Lebanon');
    people.slice(0, 4).forEach(row);
    if (people.length > 4) row('+' + (people.length - 4) + ' more');
    tip.hidden = false;
    var left = Math.max(90, Math.min(this.W - 90, best.x));
    tip.style.left = left + 'px'; tip.style.top = best.y + 'px';
  };
  WorldMap.prototype.hideTip = function () { if (this.tip) this.tip.hidden = true; };

  window.WAKMap = {
    resolve: resolve,
    countryName: countryName,
    mount: function (wrap, opts) { if (!window.WAK_GEO) return null; try { return new WorldMap(wrap, opts); } catch (e) { if (window.console) console.warn('Map disabled:', e); return null; } }
  };
})();

