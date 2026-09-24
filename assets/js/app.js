/* The WAKers — site app. Renders every page from the JSON files in /content.
   Pages are static shells (index.html, team/index.html, ...) that set data-page on <html>.
   The private preview bundles everything into one page and switches pages with #hash routes. */
(function () {
  'use strict';

  var PREVIEW = !!window.__WAK_PREVIEW__;
  var HTML = document.documentElement;
  var ROOT = PREVIEW ? '' : (HTML.getAttribute('data-root') || '');
  var PAGES = ['home', 'research', 'team', 'publications', 'news', 'gallery', 'join'];
  var NAV = [['research', 'Research'], ['team', 'Team'], ['publications', 'Publications'], ['news', 'News'], ['gallery', 'Gallery']];
  var ANCHOR_PAGE = { alumni: 'team', members: 'team', spotlight: 'news', apply: 'join', contact: 'join', positions: 'join', platforms: 'research', pipeline: 'research', highlights: 'publications', all: 'publications' };
  var TITLES = { home: 'The WAKers · Abou-Kheir Lab, AUB', research: 'Research · The WAKers', team: 'Team · The WAKers', publications: 'Publications · The WAKers', news: 'News · The WAKers', gallery: 'Gallery · The WAKers', join: 'Join us · The WAKers', notfound: 'Page not found · The WAKers' };
  var NEEDS = {
    home: ['site', 'research', 'publications', 'publications-curated', 'news', 'alumni'],
    research: ['site', 'research', 'publications', 'publications-curated'],
    team: ['site', 'team', 'alumni'],
    publications: ['site', 'research', 'publications', 'publications-curated', 'team', 'alumni'],
    news: ['site', 'news', 'spotlight'],
    gallery: ['site', 'gallery'],
    join: ['site', 'join'],
    notfound: ['site']
  };
  var GROUPS = [
    ['pi', 'Principal investigator', 'Principal investigators'], ['postdoc', 'Postdoctoral fellow', 'Postdocs'], ['phd', 'PhD student', 'PhD'],
    ['ms', 'MS student', 'MS'], ['md', 'Medical student', 'Medical students'], ['ra', 'Research assistant', 'Research assistants'],
    ['staff', 'Lab staff', 'Staff'], ['visiting', 'Visiting researcher', 'Visiting'], ['undergrad', 'Undergraduate', 'Undergraduates'],
    ['volunteer', 'Research volunteer', 'Volunteers']
  ];
  // roles alumni held in the lab (content/alumni.json "group"), most senior first
  var ALUMNI_GROUPS = [['postdoc', 'Postdocs'], ['phd', 'PhD'], ['ra', 'Research assistants'], ['ms', 'MS'], ['md', 'Medical students'],
    ['student', 'Student researchers'], ['exchange', 'Exchange students'], ['highschool', 'High school']];
  var ALUMNI_PREVIEW = 24; // rows shown before "Show all"
  var TOPIC_EXTRA = { cancers: 'Other cancers', neuro: 'Other neuroscience', other: 'Other' };
  var PROGRAM_COLOR = { cancer: 'var(--p1)', brain: 'var(--p2)', bridge: 'var(--p3)' };
  var PROGRAM_GLOW = { cancer: '#F25CD3', brain: '#3BE3A2', bridge: '#FFC24D' };
  var SIDES = [['cells', 'Cancer'], ['neuro', 'Brain'], ['both', 'Both']];
  var NEWS_TAGS = { publication: 'Publication', award: 'Award', event: 'Event', conference: 'Conference', media: 'In the media', people: 'People', 'lab-life': 'Lab life', grant: 'Grant' };
  var GALLERY_CATS = { organoids: 'Organoids', spheres: '3D spheres', culture: '2D culture', neuro: 'Brain and neurons', microscopy: 'Microscopy', 'lab-life': 'Lab life', events: 'Events' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var state = { content: {}, errors: {}, page: null, pubFilter: { q: '', topic: 'all', year: 'all' }, pendingTopic: null };

  /* ------------------------------------------------------------------ utilities */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:|mailto:)/i.test(u) ? u : (/^[\w./-]+$/.test(u) ? u : ''); }
  function inline(s) {
    var out = esc(s);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      var url = safeUrl(u.replace(/&amp;/g, '&'));
      return url ? '<a href="' + esc(url) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>' : t;
    });
    return out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  }
  function md(text) {
    return String(text || '').trim().split(/\n\s*\n/).filter(Boolean).map(function (b) { return '<p>' + inline(b).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function media(p) { p = String(p || ''); if (!p) return ''; if (/^(https?:|data:)/.test(p)) return p; return ROOT + p.replace(/^\/+/, ''); }
  function href(page, anchor) {
    if (PREVIEW) return '#' + (anchor || page);
    var base = page === 'home' ? (ROOT || './') : ROOT + page + '/';
    return anchor ? base + '#' + anchor : base;
  }
  function ext(url) { return /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''; }
  function fmtDate(d) {
    var m = String(d || '').match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
    if (!m) return esc(d || '');
    if (!m[2]) return m[1];
    return (m[3] ? parseInt(m[3], 10) + ' ' : '') + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  function initials(name) {
    return String(name || '').replace(/\b(dr|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function exampleBadge(item) { return item && item.example ? ' <span class="example-badge">Example</span>' : ''; }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H9z"/></svg>',
    scholar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/></svg>',
    orcid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 8v8M12 8h1.5a4 4 0 0 1 0 8H12z" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>'
  };
  function linkIcon(l) {
    var s = (l.label + ' ' + l.url).toLowerCase();
    if (/linkedin/.test(s)) return ICON.linkedin;
    if (/scholar/.test(s)) return ICON.scholar;
    if (/orcid/.test(s)) return ICON.orcid;
    if (/mailto|email/.test(s)) return ICON.mail;
    return ICON.globe;
  }

  /* ------------------------------------------------------------------ content */
  function load(name) {
    if (Object.prototype.hasOwnProperty.call(state.content, name)) return Promise.resolve(state.content[name]);
    var bundled = window.__WAK_CONTENT__;
    if (bundled && Object.prototype.hasOwnProperty.call(bundled, name)) { state.content[name] = bundled[name]; return Promise.resolve(bundled[name]); }
    return fetch(ROOT + 'content/' + name + '.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (text) {
      try { return (state.content[name] = JSON.parse(text)); } catch (e) { throw new Error('the file has a formatting error (' + e.message + ')'); }
    }).catch(function (e) {
      state.errors[name] = e.message;
      state.content[name] = null;
      return null;
    });
  }
  function notice(name) {
    if (!state.errors[name]) return '';
    return '<div class="notice" role="alert"><div><b>This section could not load.</b> content/' + esc(name) + '.json: ' + esc(state.errors[name]) + '. If someone edited it recently, undo the last change in the CMS or on GitHub.</div></div>';
  }

  function themes() { var r = state.content.research; return r ? arr(r.themes) : []; }
  function programs() {
    var r = state.content.research;
    var list = r ? arr(r.programs) : [];
    if (list.length) return list;
    // older content files with no programs: treat every theme as one group
    return [{ id: 'cancer', label: 'Research', title: 'What we study', text: '', themes: themes().map(function (t) { return t.id; }) }];
  }
  function themeById(id) {
    var list = themes();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function programOf(themeId) {
    var list = programs();
    for (var i = 0; i < list.length; i++) if (arr(list[i].themes).indexOf(themeId) >= 0) return list[i];
    return null;
  }
  function programColor(pid) { return PROGRAM_COLOR[pid] || 'var(--t-other)'; }
  function themeColor(id) { var p = programOf(id); return p ? programColor(p.id) : 'var(--t-other)'; }
  function themeGlow(id) { var p = programOf(id); return (p && PROGRAM_GLOW[p.id]) || '#5B82FF'; }
  function topicInfo(id) {
    var t = themeById(id);
    if (t) return { id: id, label: t.title, color: themeColor(id) };
    if (id === 'cancers') return { id: id, label: TOPIC_EXTRA.cancers, color: 'var(--t-cancers)' };
    if (id === 'neuro') return { id: id, label: TOPIC_EXTRA.neuro, color: 'var(--t-neuro)' };
    return { id: id, label: TOPIC_EXTRA[id] || id, color: 'var(--t-other)' };
  }

  function allPubs() {
    var p = state.content.publications, cur = state.content['publications-curated'] || {};
    var items = p ? arr(p.items) : [];
    var extra = arr(cur.extra).map(function (x) { return Object.assign({ manual: true, topics: x.topics || ['other'] }, x); });
    var excluded = {};
    arr(cur.exclude).forEach(function (x) { excluded[String(x && x.pmid ? x.pmid : x)] = true; });
    return items.concat(extra).filter(function (x) { return x && x.title && x.type !== 'correction' && x.type !== 'retraction' && !excluded[String(x.pmid)]; });
  }
  function pubUrl(p) { return p.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(p.pmid) + '/' : (p.doi ? 'https://doi.org/' + p.doi : safeUrl(p.url)); }
  function highlightList() {
    var cur = state.content['publications-curated'] || {}, pubs = allPubs(), byId = {};
    pubs.forEach(function (p) { if (p.pmid) byId[String(p.pmid)] = p; if (p.doi) byId[p.doi.toLowerCase()] = p; });
    return arr(cur.highlights).map(function (h) {
      var p = byId[String(h.pmid || '')] || byId[String(h.doi || '').toLowerCase()];
      return p ? Object.assign({}, p, { summary: h.summary || '' }) : null;
    }).filter(Boolean);
  }
  function labNames() {
    var cur = state.content['publications-curated'] || {}, me = {}, members = {};
    arr((cur.settings || {}).labAuthorNames).forEach(function (n) { me[n.trim()] = true; });
    // pubmedName may hold several spellings separated by ";" (e.g. "Bahmad HF; Bahmad H")
    arr(state.content.team).concat(arr(state.content.alumni)).forEach(function (m) {
      if (m && m.pubmedName && !m.example) String(m.pubmedName).split(';').forEach(function (n) { if (n.trim()) members[n.trim()] = true; });
    });
    return { me: me, members: members };
  }
  function authorsHTML(authors, names) {
    if (!authors) return '';
    return String(authors).split(/,\s*/).map(function (a) {
      var t = a.trim().replace(/\.$/, '');
      if (names.me[t]) return '<span class="me">' + esc(t) + '</span>';
      if (names.members[t]) return '<span class="member-name">' + esc(t) + '</span>';
      return esc(t);
    }).join(', ');
  }

  function resolvedAlumni() {
    var list = arr(state.content.alumni);
    if (!window.WAKMap) return list.map(function (a) { return { a: a, place: null }; });
    return list.map(function (a) { return { a: a, place: window.WAKMap.resolve(a.city, a.country, a.lat, a.lng) }; });
  }
  function mapPoints(res) {
    var groups = {};
    res.forEach(function (r) {
      if (!r.place) return;
      var key = r.place.lon.toFixed(1) + ',' + r.place.lat.toFixed(1);
      var label = [r.a.city, r.place.cc ? window.WAKMap.countryName(r.place.cc) : r.a.country].filter(Boolean).join(', ');
      var g = groups[key] || (groups[key] = { lon: r.place.lon, lat: r.place.lat, place: label, people: [], count: 0, example: true });
      g.people.push((r.a.example ? 'Example · ' : '') + [r.a.name, r.a.now].filter(Boolean).join(' · '));
      g.count++;
      if (!r.a.example) g.example = false;
    });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }
  function alumniCountries(res) {
    var seen = {};
    res.forEach(function (r) { if (r.place && r.place.cc && !r.a.example) seen[r.place.cc] = true; });
    return Object.keys(seen).length;
  }

  /* ------------------------------------------------------------------ chrome: header + footer */
  function renderHeader(page) {
    var site = state.content.site || {};
    var logo = media(site.logo || '/assets/img/wakers-logo.svg');
    var el = $('#site-header');
    var themeBtn = PREVIEW ? '' : '<button class="icon-btn theme-btn" type="button" aria-label="Switch color theme">' + (currentTheme() === 'dark' ? ICON.sun : ICON.moon) + '</button>';
    el.className = 'site-header';
    el.innerHTML = '<div class="wrap">' +
      '<a class="brand" href="' + href('home') + '" aria-label="The WAKers home"><img src="' + esc(logo) + '" alt="The WAKers" width="134" height="46"><span class="brand-text">' + esc(site.labFullName || 'Abou-Kheir Lab') + '<br>' + esc(site.institution || 'American University of Beirut') + '</span></a>' +
      '<button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">' + ICON.menu + '</button>' +
      '<nav id="site-nav" class="nav" aria-label="Main">' +
      NAV.map(function (n) { return '<a href="' + href(n[0]) + '"' + (n[0] === page ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('') +
      '<a class="nav-cta" href="' + href('join') + '"' + (page === 'join' ? ' aria-current="page"' : '') + '>Join us</a>' +
      '</nav>' + themeBtn + '</div>';
    var menu = $('.menu-btn', el), nav = $('#site-nav', el);
    menu.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.innerHTML = open ? ICON.close : ICON.menu;
      updateHeaderTone();
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); menu.innerHTML = ICON.menu; } });
    var tb = $('.theme-btn', el);
    if (tb) tb.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      HTML.setAttribute('data-theme', next);
      try { localStorage.setItem('wakers-theme', next); } catch (e) { /* storage unavailable */ }
      tb.innerHTML = next === 'dark' ? ICON.sun : ICON.moon;
    });
    updateHeaderTone();
  }
  function currentTheme() {
    var t = HTML.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function updateHeaderTone() {
    var el = $('#site-header'); if (!el) return;
    var field = $('#main .field');
    var menuOpen = $('#site-nav.is-open');
    var solid = true;
    if (field && !menuOpen) {
      var bottom = field.getBoundingClientRect().bottom;
      solid = bottom <= el.offsetHeight + 4;
    }
    el.classList.toggle('is-solid', solid);
    el.setAttribute('data-tone', field && !solid ? 'dark' : 'light');
  }

  function renderFooter() {
    var site = state.content.site || {}, c = site.contact || {}, pubs = state.content.publications;
    var logo = media(site.logo || '/assets/img/wakers-logo.svg');
    var email = c.email || '';
    var emailHTML = email ? '<div class="footer-email">' + (PREVIEW ? '<span>' + esc(email) + '</span>' : '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>') + '<button class="copy-btn" type="button" data-copy="' + esc(email) + '">Copy</button></div>' : '';
    var updated = pubs && pubs.meta && pubs.meta.updated ? 'Publications updated from PubMed · ' + esc(fmtDate(pubs.meta.updated)) : '';
    $('#site-footer').innerHTML = '<footer class="site-footer"><div class="wrap">' +
      '<div class="footer-grid">' +
      '<div class="footer-brand"><img src="' + esc(logo) + '" alt="The WAKers" width="220" height="75" loading="lazy"><p>' + esc(site.labFullName || 'Abou-Kheir Lab') + ', ' + esc(site.department || '') + ', ' + esc(site.faculty || '') + ', ' + esc(site.institution || '') + '.</p></div>' +
      '<div><h2>Visit</h2><address>' + arr(c.addressLines).map(esc).join('<br>') + '</address>' + (c.mapUrl ? '<p style="margin-top:10px"><a href="' + esc(safeUrl(c.mapUrl)) + '" target="_blank" rel="noopener">Open in Maps</a></p>' : '') + '</div>' +
      '<div><h2>Contact</h2>' + emailHTML + (c.phone ? '<p style="margin-top:8px">' + esc(c.phone) + '</p>' : '') + '<p style="margin-top:10px"><a href="' + href('join') + '">Join the lab</a></p></div>' +
      '<div><h2>Elsewhere</h2><ul>' + arr(site.links).map(function (l) { var u = safeUrl(l.url); return u ? '<li><a href="' + esc(u) + '"' + ext(u) + '>' + esc(l.label) + '</a></li>' : ''; }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' The WAKers · ' + esc(site.labFullName || 'Abou-Kheir Lab') + ', ' + esc(site.institution || '') + '</span><span>' + updated + '</span></div>' +
      '</div></footer>';
  }

  /* ------------------------------------------------------------------ shared blocks */
  function bandHTML(eyebrow, title, lead, extra, aside) {
    return '<section class="field band on-dark"><canvas class="field-canvas" aria-hidden="true"></canvas><div class="wrap band-grid"><div class="band-inner">' +
      '<span class="eyebrow">' + eyebrow + '</span><h1>' + title + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + (extra || '') + '</div>' +
      (aside ? '<div class="band-aside">' + aside + '</div>' : '') + '</div></section>';
  }
  function sectionHead(eyebrow, title, text, action, id) {
    return '<div class="section-head"><div><span class="eyebrow">' + eyebrow + '</span><h2' + (id ? ' id="' + id + '"' : '') + '>' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (action || '') + '</div>';
  }
  function topicCounts() {
    var counts = {};
    allPubs().forEach(function (p) { arr(p.topics).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    return counts;
  }
  function pubsLink(topic, label) {
    var url = PREVIEW ? '#publications' : ROOT + 'publications/' + (topic ? '?topic=' + encodeURIComponent(topic) : '');
    return '<a class="theme-index" href="' + url + '"' + (topic ? ' data-topic="' + esc(topic) + '"' : '') + '>' + label + '</a>';
  }
  function themeCard(t, i, counts) {
    var n = counts[t.id] || 0;
    return '<article class="theme-card" style="--tc:' + themeColor(t.id) + '">' +
      '<div class="theme-card-top"><canvas class="eyepiece" data-specimen="' + esc(t.icon || 'organoid') + '" data-glow="' + themeGlow(t.id) + '" data-seed="' + (i + 3) + '" aria-hidden="true"></canvas>' +
      (n ? pubsLink(t.id, '<i class="tdot"></i>' + plural(n, 'paper')) : '') + '</div>' +
      '<h3>' + esc(t.title) + '</h3><p>' + esc(t.summary) + '</p>' +
      '<a class="link-arrow" href="' + href('research', 't-' + t.id) + '">Read more</a></article>';
  }
  function programBlocks(counts) {
    var idx = 0;
    return programs().map(function (prog) {
      var list = arr(prog.themes).map(themeById).filter(Boolean);
      if (!list.length) return '';
      return '<section class="program" style="--pc:' + programColor(prog.id) + '">' +
        '<div class="program-head"><span class="program-label"><i class="tdot"></i>' + esc(prog.label) + '</span>' +
        '<h3>' + esc(prog.title) + '</h3>' + (prog.text ? '<p>' + esc(prog.text) + '</p>' : '') + '</div>' +
        '<div class="theme-grid" style="--cols:' + (list.length === 4 ? 2 : Math.min(list.length, 3)) + '">' + list.map(function (t) { return themeCard(t, idx++, counts); }).join('') + '</div></section>';
    }).join('');
  }
  function programFilters(page) {
    return '<nav class="filter-groups" aria-label="Research themes">' + programs().map(function (prog) {
      var list = arr(prog.themes).map(themeById).filter(Boolean);
      if (!list.length) return '';
      return '<div class="filter-group" style="--pc:' + programColor(prog.id) + '"><span class="filter-group-label">' + esc(prog.label) + '</span>' +
        list.map(function (t) { return '<a class="filter" href="' + href(page, 't-' + t.id) + '"><i class="tdot" style="--tc:' + themeColor(t.id) + '"></i>' + esc(t.title) + '</a>'; }).join('') + '</div>';
    }).join('') + '</nav>';
  }
  function pubTopicsHTML(p) {
    return '<div class="pub-topics">' + arr(p.topics).filter(function (t) { return t !== 'other'; }).map(function (t) {
      var info = topicInfo(t);
      return '<span class="topic-tag"><i class="tdot" style="--tc:' + info.color + '"></i>' + esc(info.label) + '</span>';
    }).join('') + '</div>';
  }
  function pubRow(p) {
    var url = pubUrl(p);
    return '<li class="pub-row"><div class="pub-meta"><b>' + esc(p.year || '') + '</b><span>' + esc(p.journal || '') + '</span></div>' +
      '<div><h3><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a></h3>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') + pubTopicsHTML(p) + '</div>' +
      '<a class="link-arrow" href="' + esc(url) + '" target="_blank" rel="noopener">Read</a></li>';
  }
  function newsCard(n) {
    var url = safeUrl(n.link);
    var title = url ? '<a href="' + esc(url) + '"' + ext(url) + '>' + esc(n.title) + '</a>' : esc(n.title);
    return '<article class="news-card' + (n.example ? ' is-example' : '') + '">' +
      (n.image ? '<div class="media"><img src="' + esc(media(n.image)) + '" alt="' + esc(n.imageAlt || '') + '" loading="lazy"></div>' : '<div hidden></div>') +
      '<div class="news-body"><div class="news-top"><time class="news-date" datetime="' + esc(n.date) + '">' + fmtDate(n.date) + '</time>' +
      (n.tag ? '<span class="tag">' + esc(NEWS_TAGS[n.tag] || n.tag) + '</span>' : '') + '</div>' +
      '<h3>' + title + exampleBadge(n) + '</h3>' + md(n.body) + '</div></article>';
  }
  function sortedNews() {
    return arr(state.content.news).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  }
  function avatar(m, cls) {
    var photo = media(m.photo);
    if (photo) return '<div class="avatar ' + (cls || '') + '"><img src="' + esc(photo) + '" alt="" loading="lazy"></div>';
    return '<div class="avatar nucleus ' + (cls || '') + '" aria-hidden="true">' + (m.example ? '' : '<span class="initials">' + esc(initials(m.name)) + '</span>') + '</div>';
  }
  function sideLabel(side) { return side === 'neuro' ? 'Brain' : side === 'both' ? 'Both programs' : 'Cancer'; }
  function sidesPresent(list) {
    return SIDES.filter(function (sd) { return sd[0] !== 'both' && list.some(function (m) { return m.team === sd[0]; }); });
  }
  function ctaHTML() {
    var join = state.content.join || {};
    return '<section class="section"><div class="wrap"><div class="cta"><div><h2>Curious? Come work with us.</h2><p>' + esc(join.intro || 'Students, physicians and scientists train in the lab every year.') + '</p></div>' +
      '<div class="actions"><a class="btn btn-primary" href="' + href('join') + '">Join the WAKers</a><a class="btn btn-secondary" href="' + href('research') + '">See our research</a></div></div></div></section>';
  }
  function trainedValue() {
    return ((state.content.site || {}).facts || []).reduce(function (v, f) { return /trained/i.test(f.label) ? f.value : v; }, '200+');
  }
  function mapBand(id, eyebrow, title, text, res) {
    var pts = mapPoints(res), real = res.filter(function (r) { return !r.a.example && r.place; }).length;
    var anyExample = res.some(function (r) { return r.a.example; });
    var pending = !anyExample && !real && res.length > 0;
    var countries = alumniCountries(res);
    var stats = '<div class="map-stats">' +
      (real ? '<span><b>' + real + '</b>alumni on the map</span>' : '') +
      (countries ? '<span><b>' + countries + '</b>' + (countries === 1 ? 'country' : 'countries') + '</span>' : '') +
      '<span><b>' + esc(trainedValue()) + '</b>trained since 2011</span></div>';
    return '<section class="map-band" id="' + id + '" aria-labelledby="' + id + '-h"><div class="wrap">' +
      sectionHead(eyebrow, title, text, stats, id + '-h') +
      '<div class="map-wrap"><canvas class="map-canvas" role="img" aria-label="World map with ' + pts.length + ' alumni locations connected to Beirut"></canvas><div class="map-tip" hidden></div></div>' +
      '<div class="map-legend"><span class="k"><i style="background:#AFC3FF;box-shadow:0 0 10px #5B82FF"></i>AUB, Beirut</span><span class="k"><i style="background:#F7A8E6;box-shadow:0 0 10px #F24BD0"></i>Where WAKers are now</span>' +
      (anyExample ? '<span class="example-badge">Example locations until the alumni list is added</span>' : '') +
      (pending ? '<span class="example-badge">Alumni locations are being added</span>' : '') + '</div>' +
      '</div></section>';
  }
  var HOME = { lon: 35.48, lat: 33.9 };
  function nearHome(p) { return Math.abs(p.lon - HOME.lon) < 1.2 && Math.abs(p.lat - HOME.lat) < 1.2; }
  function mountMap(section, res) {
    if (!section || !window.WAKMap) return;
    // alumni still in Lebanon sit under the Beirut marker, so list them in its tooltip instead of hiding a dot beneath it
    var pts = mapPoints(res), local = [];
    pts.filter(nearHome).forEach(function (p) { local = local.concat(p.people); });
    window.WAKMap.mount($('.map-wrap', section), { points: pts.filter(function (p) { return !nearHome(p); }),
      home: { lon: HOME.lon, lat: HOME.lat, label: 'American University of Beirut', sub: 'Home of the WAKers since 2011', people: local } });
  }
  function instagram() {
    var ig = (state.content.site || {}).instagram || {};
    var u = safeUrl(ig.url);
    return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Instagram ' + esc(ig.handle || '') + '</a>' : '';
  }

  /* ------------------------------------------------------------------ pages */
  var render = {};

  render.home = function () {
    var s = state.content.site || {}, h = s.hero || {}, r = state.content.research || {}, pubs = allPubs();
    var res = resolvedAlumni(), countries = alumniCountries(res), counts = topicCounts();
    var facts = arr(s.facts).map(function (f) {
      var v = String(f.value || '');
      if (v === '{publications}') v = String(pubs.length || '');
      if (v === '{alumniCountries}') v = countries ? String(countries) : '';
      if (v === '{themes}') v = String(themes().length);
      return v ? { value: v, label: f.label } : null;
    }).filter(Boolean);
    var hl = highlightList();
    var news = sortedNews().slice(0, 3);
    var html = '' +
      '<section class="field hero on-dark" aria-labelledby="hero-h"><canvas class="field-canvas" aria-hidden="true"></canvas>' +
      '<div class="wrap"><div class="hero-inner"><span class="eyebrow">' + esc(h.eyebrow) + '</span><h1 id="hero-h">' + inline(h.title || 'The WAKers') + '</h1>' +
      '<p class="hero-sub">' + esc(h.subtitle) + '</p><div class="hero-actions">' +
      '<a class="btn btn-primary" href="' + href(h.primaryPage || 'research') + '">' + esc(h.primaryLabel || 'Explore our research') + '</a>' +
      '<a class="btn btn-secondary" href="' + href(h.secondaryPage || 'join') + '">' + esc(h.secondaryLabel || 'Join the WAKers') + '</a></div></div></div>' +
      '<div class="scope-ui"><p class="scope-caption">' + esc(h.caption) + '</p><div class="scope-tools">' +
      '<div class="channels" role="group" aria-label="Show or hide fluorescence channels">' +
      (arr(h.channels).length ? arr(h.channels) : [{ id: 'dapi', label: 'DAPI', title: 'Nuclei' }, { id: 'ck8', label: 'GFP', title: 'Luminal cells and neurites' }, { id: 'ck5', label: 'mCherry', title: 'Basal cells and axons' }])
        .map(function (ch) {
          var col = { dapi: '#5B82FF', ck8: '#2EE6A0', ck5: '#F24BD0' }[ch.id] || '#5B82FF';
          return '<button type="button" class="channel" data-ch="' + esc(ch.id) + '" aria-pressed="true" title="' + esc(ch.title || '') + '" style="--c:' + col + '"><span class="swatch"></span>' + esc(ch.label) + '</button>';
        }).join('') + '</div>' +
      '<div class="scalebar" aria-hidden="true"><i style="width:80px"></i><span>100 µm</span></div></div></div></section>' +

      '<section class="section" aria-labelledby="mission-h"><div class="wrap mission"><div class="mission-text"><span class="eyebrow">Who we are</span>' +
      '<h2 id="mission-h" class="visually-hidden">Who we are</h2><p class="big">' + esc(s.mission) + '</p>' + (s.missionSecondary ? '<p class="support">' + esc(s.missionSecondary) + '</p>' : '') + '</div>' +
      '<dl class="facts' + (facts.length % 2 ? ' odd' : '') + '">' + facts.map(function (f) { return '<div class="fact"><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>'; }).join('') + '</dl></div></section>' +

      '<section class="section alt" aria-labelledby="themes-h"><div class="wrap">' + notice('research') +
      sectionHead('Research · ' + plural(themes().length, 'theme'), 'What we study', esc(r.intro || ''), '<a class="link-arrow" href="' + href('research') + '">All research</a>', 'themes-h') +
      programBlocks(counts) + '</div></section>' +

      '<section class="section alt" aria-labelledby="hl-h"><div class="wrap">' + notice('publications') +
      sectionHead('Publication highlights · ' + plural(pubs.length, 'paper') + ' on PubMed', 'Selected papers', '', '<a class="link-arrow" href="' + href('publications') + '">All publications</a>', 'hl-h') +
      (hl.length ? '<ol class="pub-rows">' + hl.slice(0, 6).map(pubRow).join('') + '</ol>' : '<p class="empty">Highlights appear here once they are chosen in the CMS.</p>') + '</div></section>' +

      mapBand('alumni-home', 'Alumni', esc((s.home || {}).mapTitle || 'WAKers around the world'), esc((s.home || {}).mapText || ''), res) +

      (news.length ? '<section class="section" aria-labelledby="news-h"><div class="wrap">' + sectionHead('News', 'Latest from the lab', '', '<a class="link-arrow" href="' + href('news') + '">All news</a>', 'news-h') +
        '<div class="news-grid">' + news.map(newsCard).join('') + '</div></div></section>' : '') +
      ctaHTML();
    return html;
  };
  render.home.after = function (main) {
    var hero = $('.hero', main);
    var bar = $('.scalebar i', hero);
    var field = window.WAKField && window.WAKField.mount($('canvas', hero), { variant: 'hero', onScale: function (px) { if (bar) bar.style.width = Math.round(px) + 'px'; } });
    $$('.channel', hero).forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (field) field.setChannel(b.getAttribute('data-ch'), on);
      });
    });
    mountMap($('#alumni-home', main), resolvedAlumni());
  };

  render.research = function () {
    var r = state.content.research || {}, pubs = allPubs(), counts = topicCounts(), pl = r.pipeline || {};
    var idx = 0;
    function themeArticle(t) {
      var i = idx++;
      var list = pubs.filter(function (p) { return arr(p.topics).indexOf(t.id) >= 0; }).sort(function (a, b) { return String(b.sort || b.year).localeCompare(String(a.sort || a.year)); });
      return '<article class="theme-section" id="t-' + esc(t.id) + '" style="--tc:' + themeColor(t.id) + '">' +
        '<div class="theme-main"><div class="theme-title"><canvas class="eyepiece lg" data-specimen="' + esc(t.icon || 'organoid') + '" data-glow="' + themeGlow(t.id) + '" data-seed="' + (i + 3) + '" aria-hidden="true"></canvas>' +
        '<div><span class="eyebrow"><i class="tdot"></i>' + plural(counts[t.id] || 0, 'paper') + '</span><h3>' + esc(t.title) + '</h3></div></div>' +
        '<div class="prose">' + md(t.description) + '</div>' +
        (arr(t.methods).length ? '<ul class="chips" aria-label="Models and methods">' + arr(t.methods).map(function (m) { return '<li class="chip">' + esc(m) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        '<div class="theme-side">' +
        (arr(t.questions).length ? '<h4 class="side-h">Questions we ask</h4><ul class="q-list">' + arr(t.questions).map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' : '') +
        (list.length ? '<h4 class="side-h">Recent papers</h4><ul class="mini-pubs">' + list.slice(0, 3).map(function (p) {
          return '<li><a href="' + esc(pubUrl(p)) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a><span class="mono muted">' + esc(p.journal) + ' · ' + esc(p.year) + '</span></li>';
        }).join('') + '</ul>' + pubsLink(t.id, 'All ' + plural(list.length, 'paper') + ' on this theme →') : '') +
        '</div></article>';
    }
    var html = bandHTML('Research', 'What we study', esc(r.intro)) +
      '<section class="section"><div class="wrap">' + notice('research') + programFilters('research') +
      programs().map(function (prog) {
        var list = arr(prog.themes).map(themeById).filter(Boolean);
        if (!list.length) return '';
        var n = list.reduce(function (sum, t) { return sum + (counts[t.id] || 0); }, 0);
        return '<section class="program-section" id="p-' + esc(prog.id) + '" style="--pc:' + programColor(prog.id) + '">' +
          '<div class="program-banner"><span class="program-label"><i class="tdot"></i>' + esc(prog.label) + '</span>' +
          '<h2>' + esc(prog.title) + '</h2>' + (prog.text ? '<p>' + esc(prog.text) + '</p>' : '') +
          '<span class="program-count mono">' + plural(list.length, 'theme') + ' · ' + plural(n, 'paper') + '</span></div>' +
          list.map(themeArticle).join('') + '</section>';
      }).join('') + '</div></section>' +
      (arr(pl.steps).length ? '<section class="section alt" id="pipeline" aria-labelledby="pipeline-h"><div class="wrap">' + sectionHead('Patient-derived organoids', esc(pl.title), esc(pl.text), '', 'pipeline-h') +
        '<ol class="pipeline">' + arr(pl.steps).map(function (st) { return '<li><span class="node"></span><h3>' + esc(st.title) + '</h3><p>' + esc(st.text) + '</p></li>'; }).join('') + '</ol></div></section>' : '') +
      (arr(r.platforms).length ? '<section class="section" id="platforms" aria-labelledby="platforms-h"><div class="wrap">' + sectionHead('Models and methods', 'Our platforms', '', '', 'platforms-h') +
        '<ul class="platforms">' + arr(r.platforms).map(function (p) { return '<li><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></li>'; }).join('') + '</ul></div></section>' : '') +
      (arr(r.collaborators).length ? '<section class="section"><div class="wrap">' + sectionHead('Collaborators', 'Who we work with', '', '') +
        '<ul class="chips">' + arr(r.collaborators).map(function (c) { var u = safeUrl(c.url); return '<li class="chip">' + (u ? '<a href="' + esc(u) + '"' + ext(u) + '>' + esc(c.name) + '</a>' : esc(c.name)) + (c.institution ? ' · ' + esc(c.institution) : '') + '</li>'; }).join('') + '</ul></div></section>' : '') +
      ctaHTML();
    return html;
  };

  render.team = function () {
    var team = arr(state.content.team), site = state.content.site || {};
    var pi = team.filter(function (m) { return m.group === 'pi'; });
    var members = team.filter(function (m) { return m.group !== 'pi'; });
    var present = GROUPS.filter(function (g) { return g[0] !== 'pi' && members.some(function (m) { return m.group === g[0]; }); });
    var res = resolvedAlumni(), alumni = arr(state.content.alumni);
    var logo = media(site.logo || '/assets/img/wakers-logo.svg');
    var trainedN = String(trainedValue()).replace(/\D+/g, '');
    var teamPhoto = site.teamPhoto || {};
    var html = bandHTML('Team', 'The WAKers', 'Graduate students, medical students, research assistants and postdocs, led by Dr. Wassim Abou-Kheir.' + (trainedN ? ' More than ' + esc(trainedN) + ' people have trained in the lab since 2011.' : ''),
      '', '<img class="band-logo" src="' + esc(logo) + '" alt="" width="360" height="123">') +
      '<section class="section"><div class="wrap">' + notice('team') + pi.map(function (p) {
        return '<div class="pi"><div class="pi-photo">' + (media(p.photo) ? '<img src="' + esc(media(p.photo)) + '" alt="' + esc(p.name) + '">' : avatar(p, 'lg')) + '</div>' +
          '<div class="pi-body"><span class="pi-role">' + esc(p.role || 'Principal Investigator') + '</span><h2>' + esc(p.name) + (p.degrees ? ', ' + esc(p.degrees) : '') + '</h2>' +
          (p.title ? '<p class="pi-title">' + esc(p.title) + '</p>' : '') + '<div class="prose">' + md(p.bio) + '</div>' +
          '<div class="pi-links">' + (p.email ? '<span class="pi-email"><span>' + esc(p.email) + '</span><button class="copy-btn" type="button" data-copy="' + esc(p.email) + '">Copy</button></span>' : '') +
          arr(p.links).map(function (l) { var u = safeUrl(l.url); return u ? '<a href="' + esc(u) + '"' + ext(u) + '>' + esc(l.label) + '</a>' : ''; }).join('') + '</div></div></div>';
      }).join('') + '</div></section>' +
      (media(teamPhoto.image) ? '<section class="section team-photo-section"><div class="wrap"><figure class="team-photo"><div class="frame"><img src="' + esc(media(teamPhoto.image)) + '" alt="' + esc(teamPhoto.alt || '') + '" loading="lazy"></div>' +
        (teamPhoto.caption ? '<figcaption>' + esc(teamPhoto.caption) + '</figcaption>' : '') + '</figure></div></section>' : '') +
      '<section class="section alt" id="members" aria-labelledby="members-h"><div class="wrap">' +
      sectionHead('Current members' + (function (n) { return n ? ' · ' + n : ''; })(members.filter(function (m) { return !m.example; }).length), 'Who is in the lab', members.some(function (m) { return m.example; }) ? 'Dashed cards are placeholders until the team list and headshots are added.' : '', '', 'members-h') +
      (present.length > 1 ? '<div class="filter-groups"><div class="filter-group" role="group" aria-label="Filter by role"><span class="filter-group-label">Role</span>' +
        '<button type="button" class="filter" data-group="all" aria-pressed="true">Everyone <span class="count">' + members.length + '</span></button>' +
        present.map(function (g) { return '<button type="button" class="filter" data-group="' + g[0] + '" aria-pressed="false">' + esc(g[2]) + ' <span class="count">' + members.filter(function (m) { return m.group === g[0]; }).length + '</span></button>'; }).join('') + '</div>' +
        (sidesPresent(members).length > 1 ? '<div class="filter-group" role="group" aria-label="Filter by program"><span class="filter-group-label">Program</span>' +
          '<button type="button" class="filter" data-side="all" aria-pressed="true">Both</button>' +
          sidesPresent(members).map(function (sd) {
            return '<button type="button" class="filter" data-side="' + sd[0] + '" aria-pressed="false"><i class="tdot" style="--tc:' + (sd[0] === 'neuro' ? 'var(--p2)' : 'var(--p1)') + '"></i>' + esc(sd[1]) + ' <span class="count">' + members.filter(function (m) { return m.team === sd[0] || m.team === 'both'; }).length + '</span></button>';
          }).join('') + '</div>' : '') + '</div>' : '') +
      '<ul class="member-grid">' + members.map(function (m) {
        var links = (m.email ? [{ label: 'Email', url: 'mailto:' + m.email }] : []).concat(arr(m.links));
        return '<li class="member' + (m.example ? ' is-example' : '') + '" data-group="' + esc(m.group) + '" data-side="' + esc(m.team || '') + '">' + avatar(m) +
          '<h3>' + esc(m.name) + (m.degrees ? ', ' + esc(m.degrees) : '') + '</h3><span class="role">' + esc(m.role) + '</span>' +
          (m.team ? '<span class="side-tag"><i class="tdot" style="--tc:' + (m.team === 'neuro' ? 'var(--p2)' : m.team === 'both' ? 'var(--p3)' : 'var(--p1)') + '"></i>' + esc(sideLabel(m.team)) + '</span>' : '') +
          (m.focus ? '<p class="focus">' + esc(m.focus) + '</p>' : '') + (m.example ? '<span class="example-badge">Example</span>' : '') +
          (links.length ? '<div class="links">' + links.map(function (l) { var u = safeUrl(l.url); return u ? '<a href="' + esc(u) + '"' + ext(u) + ' aria-label="' + esc(l.label + ' for ' + m.name) + '" title="' + esc(l.label) + '">' + linkIcon(l) + '</a>' : ''; }).join('') + '</div>' : '') + '</li>';
      }).join('') + '</ul></div></section>' +
      mapBand('alumni', 'Alumni', 'Where are WAKers now?', 'Every trainee who has passed through the lab, and where their work has taken them.', res) +
      '<section class="section" id="alumni-list" aria-labelledby="alumni-list-h"><div class="wrap">' + notice('alumni') +
      sectionHead('Alumni list' + (function (n) { return n ? ' · ' + n : ''; })(alumni.filter(function (a) { return !a.example; }).length), 'Alumni',
        alumni.length > ALUMNI_PREVIEW ? 'Everyone who has trained in the lab, most recent first. Search by name, role or place.' : '', '', 'alumni-list-h') +
      (function () {
        if (alumni.length <= ALUMNI_PREVIEW) return '';
        var present = ALUMNI_GROUPS.filter(function (g) { return alumni.some(function (a) { return a.group === g[0]; }); });
        return '<div class="toolbar"><div class="toolbar-row"><label class="search">' + ICON.search + '<span class="visually-hidden">Search alumni</span>' +
          '<input id="alumni-search" type="search" placeholder="Search names, roles, institutions, cities" autocomplete="off"></label></div>' +
          (present.length > 1 ? '<div class="filter-groups"><div class="filter-group" role="group" aria-label="Filter alumni by role in the lab"><span class="filter-group-label">Role in the lab</span>' +
            '<button type="button" class="filter" data-agroup="all" aria-pressed="true">Everyone <span class="count">' + alumni.length + '</span></button>' +
            present.map(function (g) { return '<button type="button" class="filter" data-agroup="' + g[0] + '" aria-pressed="false">' + esc(g[1]) + ' <span class="count">' + alumni.filter(function (a) { return a.group === g[0]; }).length + '</span></button>'; }).join('') +
            '</div></div>' : '') +
          '<div class="result-line" aria-live="polite"><span class="alumni-count"></span></div></div>';
      })() +
      '<ul class="alumni-list" id="alumni-rows">' + alumni.map(function (a, i) {
        var place = res[i] && res[i].place;
        var where = [a.city, place && place.cc ? window.WAKMap.countryName(place.cc) : a.country].filter(Boolean).join(', ');
        var link = safeUrl(a.link);
        var now = [a.now, a.institution].filter(Boolean).join(', ');
        var hay = [a.name, a.roleInLab, a.years, now, where].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        return '<li class="alumni-row" data-agroup="' + esc(a.group || '') + '" data-search="' + esc(hay) + '"' + (alumni.length > ALUMNI_PREVIEW && i >= ALUMNI_PREVIEW ? ' hidden' : '') + '><span class="who"><b>' + (link ? '<a href="' + esc(link) + '"' + ext(link) + '>' + esc(a.name) + '</a>' : esc(a.name)) + '</b>' + exampleBadge(a) + '</span>' +
          '<span class="lab">' + esc([a.roleInLab, a.years].filter(Boolean).join(', ')) + '</span>' +
          '<span class="now">' + esc(now) + '</span><span class="place">' + esc(where) + '</span></li>';
      }).join('') + '</ul>' +
      '<p class="empty" id="alumni-empty" hidden>No alumni match this search.</p>' +
      (alumni.length > ALUMNI_PREVIEW ? '<div class="alumni-more"><button type="button" class="btn btn-secondary" id="alumni-more" aria-controls="alumni-rows" aria-expanded="false">Show all ' + alumni.length + ' alumni</button></div>' : '') +
      '</div></section>' + ctaHTML();
    return html;
  };
  render.team.after = function (main) {
    var sel = { group: 'all', side: 'all' };
    function applyFilters() {
      $$('.member', main).forEach(function (m) {
        var side = m.getAttribute('data-side');
        var okGroup = sel.group === 'all' || m.getAttribute('data-group') === sel.group;
        var okSide = sel.side === 'all' || side === sel.side || side === 'both';
        m.hidden = !(okGroup && okSide);
      });
    }
    ['group', 'side'].forEach(function (key) {
      var btns = $$('.filter[data-' + key + ']', main);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          sel[key] = b.getAttribute('data-' + key);
          btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          applyFilters();
        });
      });
    });
    mountMap($('#alumni', main), resolvedAlumni());

    // alumni list: search, role filter, and a short list until "Show all"
    var rows = $$('.alumni-row', main), aq = $('#alumni-search', main), more = $('#alumni-more', main);
    var countEl = $('.alumni-count', main), emptyEl = $('#alumni-empty', main);
    var aSel = { q: '', group: 'all', all: false };
    function applyAlumni() {
      var words = aSel.q ? aSel.q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean) : [];
      var filtering = words.length > 0 || aSel.group !== 'all';
      var matches = 0, shown = 0;
      rows.forEach(function (r) {
        var hay = r.getAttribute('data-search') || '';
        var ok = (aSel.group === 'all' || r.getAttribute('data-agroup') === aSel.group) && words.every(function (w) { return hay.indexOf(w) >= 0; });
        if (ok) matches++;
        var vis = ok && (filtering || aSel.all || matches <= ALUMNI_PREVIEW);
        r.hidden = !vis;
        if (vis) shown++;
      });
      if (more) more.hidden = filtering || aSel.all || matches <= ALUMNI_PREVIEW;
      if (emptyEl) emptyEl.hidden = matches > 0;
      if (countEl) countEl.innerHTML = filtering ? '<b>' + plural(matches, 'person', 'people') + '</b> of ' + rows.length
        : (shown < matches ? 'Showing the <b>' + shown + '</b> most recent of ' + matches : '<b>' + plural(matches, 'person', 'people') + '</b>');
    }
    if (rows.length > ALUMNI_PREVIEW) {
      var at;
      if (aq) aq.addEventListener('input', function () { clearTimeout(at); at = setTimeout(function () { aSel.q = aq.value.trim(); applyAlumni(); }, 120); });
      var aBtns = $$('.filter[data-agroup]', main);
      aBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          aSel.group = b.getAttribute('data-agroup');
          aBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          applyAlumni();
        });
      });
      if (more) more.addEventListener('click', function () { aSel.all = true; more.setAttribute('aria-expanded', 'true'); applyAlumni(); });
      applyAlumni();
    }
  };

  render.publications = function () {
    var pubs = allPubs(), meta = (state.content.publications || {}).meta || {}, hl = highlightList();
    var years = pubs.map(function (p) { return p.year; }).filter(Boolean);
    var minY = Math.min.apply(null, years), maxY = Math.max.apply(null, years);
    var counts = topicCounts();
    function topicChip(id) {
      var info = topicInfo(id);
      return '<button type="button" class="filter" data-topic-filter="' + esc(id) + '" aria-pressed="false"><i class="tdot" style="--tc:' + info.color + '"></i>' + esc(info.label) + ' <span class="count">' + counts[id] + '</span></button>';
    }
    var yearsDesc = []; for (var y = maxY; y >= minY; y--) yearsDesc.push(y);
    var lead = plural(pubs.length, 'paper') + (isFinite(minY) ? ' since ' + minY : '') + '.' + (meta.source === 'pubmed' ? ' The list refreshes from PubMed every week.' : ' The list comes from PubMed and refreshes automatically once the site is live.');
    return bandHTML('Publications', 'Publications', esc(lead)) +
      (hl.length ? '<section class="section" id="highlights" aria-labelledby="hl2-h"><div class="wrap">' + notice('publications') + sectionHead('Highlights', 'Selected papers', 'A few papers that show the range of our work.', '', 'hl2-h') +
        '<ol class="pub-rows">' + hl.map(pubRow).join('') + '</ol></div></section>' : '') +
      '<section class="section alt" id="all" aria-labelledby="all-h"><div class="wrap">' + sectionHead('All papers', 'Every paper, newest first', '', '', 'all-h') +
      '<div class="toolbar"><div class="toolbar-row"><label class="search">' + ICON.search + '<span class="visually-hidden">Search publications</span><input id="pub-search" type="search" placeholder="Search titles, authors, journals" autocomplete="off"></label>' +
      '<label class="visually-hidden" for="pub-year">Year</label><select id="pub-year" class="select"><option value="all">All years</option>' + yearsDesc.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="filter-groups"><div class="filter-group"><button type="button" class="filter" data-topic-filter="all" aria-pressed="true">All topics</button></div>' +
      programs().map(function (prog) {
        var ids = arr(prog.themes).filter(function (id) { return counts[id]; });
        if (!ids.length) return '';
        return '<div class="filter-group" style="--pc:' + programColor(prog.id) + '"><span class="filter-group-label">' + esc(prog.label) + '</span>' + ids.map(topicChip).join('') + '</div>';
      }).join('') +
      (function () {
        var rest = ['cancers', 'neuro', 'other'].filter(function (id) { return counts[id]; });
        return rest.length ? '<div class="filter-group"><span class="filter-group-label">Other</span>' + rest.map(topicChip).join('') + '</div>' : '';
      })() + '</div></div>' +
      '<div class="chart-card"><h3>Papers per year</h3><p class="sub">Select a year to filter the list.</p><div class="chart-scroll"><div class="chart-host"></div></div></div>' +
      '<div class="result-line" aria-live="polite"><span class="result-count"></span><button type="button" class="btn-text clear-filters" hidden>Clear filters</button></div>' +
      '<div class="pub-results"></div></div></section>';
  };
  render.publications.after = function (main) {
    var pubs = allPubs(), names = labNames(), f = state.pubFilter;
    var params = PREVIEW ? null : new URLSearchParams(location.search);
    f.q = ''; f.year = 'all'; f.topic = state.pendingTopic || (params && params.get('topic')) || 'all';
    state.pendingTopic = null;
    var search = $('#pub-search', main), yearSel = $('#pub-year', main), host = $('.chart-host', main);
    var years = pubs.map(function (p) { return p.year; }).filter(Boolean), minY = Math.min.apply(null, years), maxY = Math.max.apply(null, years);
    var tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; $('.chart-card', main).appendChild(tip);

    function matches(p, ignoreYear) {
      if (f.topic !== 'all' && arr(p.topics).indexOf(f.topic) < 0) return false;
      if (!ignoreYear && f.year !== 'all' && String(p.year) !== String(f.year)) return false;
      if (f.q) {
        var hay = (p.title + ' ' + (p.authors || '') + ' ' + (p.journal || '') + ' ' + (p.year || '')).toLowerCase();
        return f.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
      }
      return true;
    }
    function drawChart() {
      if (!years.length) { host.innerHTML = ''; return; }
      var counts = {}, max = 0;
      pubs.forEach(function (p) { if (p.year && matches(p, true)) { counts[p.year] = (counts[p.year] || 0) + 1; } });
      for (var k in counts) max = Math.max(max, counts[k]);
      var W = Math.max(520, host.clientWidth || 800), H = 190, padL = 30, padR = 8, padT = 22, padB = 26;
      var n = maxY - minY + 1, slot = (W - padL - padR) / n, bw = Math.min(24, slot - 2);
      var stepV = max <= 5 ? 1 : max <= 12 ? 4 : 5, top = Math.max(stepV, Math.ceil(max / stepV) * stepV);
      var yv = function (v) { return padT + (H - padT - padB) * (1 - v / top); };
      var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="Papers per year">';
      for (var t = 0; t <= top; t += stepV) svg += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yv(t) + '" y2="' + yv(t) + '"/><text class="axis-label" x="' + (padL - 8) + '" y="' + (yv(t) + 4) + '" text-anchor="end">' + t + '</text>';
      var labelEvery = slot >= 34 ? 1 : slot >= 17 ? 2 : 5;
      for (var i = 0; i < n; i++) {
        var yr2 = minY + i, v = counts[yr2] || 0, x = padL + i * slot + (slot - bw) / 2, y = yv(v), base = yv(0);
        var cls = 'col' + (String(f.year) === String(yr2) ? ' is-selected' : '') + (f.year !== 'all' && String(f.year) !== String(yr2) ? ' is-dim' : '');
        svg += '<g class="' + cls + '" tabindex="' + (v ? 0 : -1) + '" role="button" data-year="' + yr2 + '" data-v="' + v + '" aria-label="' + yr2 + ': ' + plural(v, 'paper') + '. Select to filter.">';
        svg += '<rect class="bar-hit" x="' + (padL + i * slot) + '" y="' + padT + '" width="' + slot + '" height="' + (base - padT) + '"/>';
        if (v) {
          var r = Math.min(4, bw / 2, base - y);
          svg += '<path class="bar" d="M' + x + ',' + base + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + base + 'Z"/>';
          if (v === max) svg += '<text class="axis-label" x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" style="fill:var(--ink)">' + v + '</text>';
        }
        if ((yr2 - minY) % labelEvery === 0 || yr2 === maxY) svg += '<text class="axis-label" x="' + (padL + i * slot + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + (labelEvery > 1 ? String(yr2) : "'" + String(yr2).slice(2)) + '</text>';
        svg += '</g>';
      }
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yv(0) + '" y2="' + yv(0) + '" style="stroke:var(--line-2);stroke-width:1"/></svg>';
      host.innerHTML = svg;
      $$('g.col', host).forEach(function (g) {
        var show = function () {
          var v = +g.getAttribute('data-v'); if (!v) { tip.hidden = true; return; }
          var bar = g.querySelector('.bar'), bb = bar.getBoundingClientRect(), cb = $('.chart-card', main).getBoundingClientRect();
          tip.textContent = '';
          var b = document.createElement('b'); b.textContent = plural(v, 'paper'); tip.appendChild(b);
          tip.appendChild(document.createTextNode(' in ' + g.getAttribute('data-year')));
          tip.style.left = (bb.left - cb.left + bb.width / 2) + 'px'; tip.style.top = (bb.top - cb.top) + 'px'; tip.hidden = false;
        };
        g.addEventListener('pointerenter', show); g.addEventListener('focus', show);
        g.addEventListener('pointerleave', function () { tip.hidden = true; }); g.addEventListener('blur', function () { tip.hidden = true; });
        var pick = function () { if (!+g.getAttribute('data-v')) return; f.year = f.year === g.getAttribute('data-year') ? 'all' : g.getAttribute('data-year'); yearSel.value = f.year; update(); };
        g.addEventListener('click', pick);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
    }
    function drawList() {
      var list = pubs.filter(function (p) { return matches(p, false); }).sort(function (a, b) {
        return (b.year || 0) - (a.year || 0) || String(b.sort || '').localeCompare(String(a.sort || ''));
      });
      $('.result-count', main).innerHTML = '<b>' + plural(list.length, 'paper') + '</b>' + (list.length !== pubs.length ? ' of ' + pubs.length : '');
      $('.clear-filters', main).hidden = f.q === '' && f.topic === 'all' && f.year === 'all';
      if (!list.length) { $('.pub-results', main).innerHTML = '<p class="empty">No papers match these filters.</p>'; return; }
      var hlIds = {}; arr((state.content['publications-curated'] || {}).highlights).forEach(function (h) { hlIds[String(h.pmid)] = true; });
      var groups = [], cur = null;
      list.forEach(function (p) { if (!cur || cur.year !== p.year) { cur = { year: p.year, items: [] }; groups.push(cur); } cur.items.push(p); });
      $('.pub-results', main).innerHTML = groups.map(function (g) {
        return '<div class="year-group"><div class="year-label">' + esc(g.year || 'Other') + '<small>' + plural(g.items.length, 'paper') + '</small></div><ol class="pub-items">' + g.items.map(function (p) {
          var url = pubUrl(p);
          var links = (p.pmid ? '<a href="https://pubmed.ncbi.nlm.nih.gov/' + esc(p.pmid) + '/" target="_blank" rel="noopener">PubMed</a>' : '') +
            (p.doi ? '<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener">DOI</a>' : '') +
            (p.pmcid ? '<a href="https://pmc.ncbi.nlm.nih.gov/articles/' + esc(p.pmcid) + '/" target="_blank" rel="noopener">Free full text</a>' : '');
          return '<li class="pub-item"><h3><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a></h3>' +
            (p.authors ? '<p class="pub-authors">' + authorsHTML(p.authors, names) + '</p>' : '') +
            '<p class="pub-journal"><i>' + esc(p.journal) + '</i>' + (p.year ? ' ' + esc(p.year) : '') + (p.details ? ';' + esc(p.details) : '') + '</p>' +
            '<div class="pub-foot">' + (hlIds[String(p.pmid)] ? '<span class="badge star">Highlight</span>' : '') + (p.type === 'review' ? '<span class="badge">Review</span>' : '') +
            '<span class="pub-links">' + links + '</span>' + pubTopicsHTML(p).replace('class="pub-topics"', 'class="pub-topics" style="margin:0"') + '</div></li>';
        }).join('') + '</ol></div>';
      }).join('');
    }
    function syncTopicButtons() { $$('[data-topic-filter]', main).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-topic-filter') === f.topic)); }); }
    function update() { syncTopicButtons(); drawChart(); drawList(); }
    var tm;
    search.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { f.q = search.value.trim(); update(); }, 120); });
    yearSel.addEventListener('change', function () { f.year = yearSel.value; update(); });
    $$('[data-topic-filter]', main).forEach(function (b) { b.addEventListener('click', function () { f.topic = b.getAttribute('data-topic-filter'); update(); }); });
    $('.clear-filters', main).addEventListener('click', function () { f.q = ''; f.topic = 'all'; f.year = 'all'; search.value = ''; yearSel.value = 'all'; update(); });
    if (window.ResizeObserver) { var rt; new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(drawChart, 120); }).observe(host.parentElement); }
    update();
    if (f.topic !== 'all') { var all = $('#all', main); if (all) all.scrollIntoView(); }
  };

  render.news = function () {
    var news = sortedNews(), spot = arr(state.content.spotlight);
    var tags = []; news.forEach(function (n) { if (n.tag && tags.indexOf(n.tag) < 0) tags.push(n.tag); });
    return bandHTML('News', 'News and events', 'Papers, awards, defenses, conferences and life in the lab.' + (instagram() ? ' For day-to-day lab life, follow us on ' + instagram() + '.' : '')) +
      '<section class="section"><div class="wrap">' + notice('news') +
      (tags.length > 1 ? '<div class="filters" role="group" aria-label="Filter news"><button type="button" class="filter" data-tag="all" aria-pressed="true">All</button>' + tags.map(function (t) { return '<button type="button" class="filter" data-tag="' + esc(t) + '" aria-pressed="false">' + esc(NEWS_TAGS[t] || t) + '</button>'; }).join('') + '</div>' : '') +
      (news.length ? '<div class="news-grid">' + news.map(function (n) { return newsCard(n).replace('<article class="news-card', '<article data-tag="' + esc(n.tag || '') + '" class="news-card'); }).join('') + '</div>' : '<p class="empty">No news yet.</p>') +
      '</div></section>' +
      '<section class="section alt" id="spotlight" aria-labelledby="spot-h"><div class="wrap">' + notice('spotlight') +
      sectionHead('Student spotlight', 'Meet the WAKers', 'Four questions for the people who make the lab.', '', 'spot-h') +
      '<div class="spot-grid">' + spot.map(function (s) {
        return '<article class="spot-card' + (s.example ? ' is-example' : '') + '"><div class="spot-head">' + avatar(s) + '<div><h3>' + esc(s.name) + exampleBadge(s) + '</h3><p>' + esc([s.role, s.date ? fmtDate(s.date) : ''].filter(Boolean).join(' · ')) + '</p></div></div>' +
          '<dl class="qa">' + arr(s.qa).map(function (q) { return '<div><dt>' + esc(q.question) + '</dt><dd>' + esc(q.answer) + '</dd></div>'; }).join('') + '</dl></article>';
      }).join('') + '</div></div></section>' + ctaHTML();
  };
  render.news.after = function (main) {
    $$('.filter[data-tag]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tag');
        $$('.filter[data-tag]', main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $$('.news-card[data-tag]', main).forEach(function (c) { c.hidden = t !== 'all' && c.getAttribute('data-tag') !== t; });
      });
    });
  };

  render.gallery = function () {
    var items = arr(state.content.gallery);
    var cats = []; items.forEach(function (g) { if (g.category && cats.indexOf(g.category) < 0) cats.push(g.category); });
    return bandHTML('Gallery', 'Gallery', 'Organoids, 3D spheres, brain sections and life in the lab.' + (items.some(function (g) { return g.example; }) ? ' Micrographs marked Example are illustrations standing in until the lab’s own images are added.' : '') + (instagram() ? ' More on ' + instagram() + '.' : '')) +
      '<section class="section"><div class="wrap">' + notice('gallery') +
      (cats.length > 1 ? '<div class="filters" role="group" aria-label="Filter images"><button type="button" class="filter" data-cat="all" aria-pressed="true">All</button>' + cats.map(function (c) { return '<button type="button" class="filter" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(GALLERY_CATS[c] || c) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="masonry">' + items.map(function (g, i) {
        var img = media(g.image);
        return '<figure class="g-item' + (g.example ? ' is-example' : '') + '" data-cat="' + esc(g.category || '') + '">' +
          (img ? '<button type="button" data-idx="' + i + '" aria-label="Enlarge: ' + esc(g.title) + '"><img src="' + esc(img) + '" alt="' + esc(g.alt || g.title) + '" loading="lazy"></button>' : '<div class="g-placeholder">Add a photo</div>') +
          '<figcaption><b>' + esc(g.title) + exampleBadge(g) + '</b>' + (g.channels ? '<span class="ch">' + esc(g.channels) + '</span>' : '') + (g.caption ? '<p>' + esc(g.caption) + '</p>' : '') + (g.credit ? '<span class="ch">' + esc(g.credit) + '</span>' : '') + '</figcaption></figure>';
      }).join('') + '</div></div></section>' +
      '<dialog class="lightbox" aria-label="Image viewer"><div class="lb-bar"><button type="button" class="icon-btn lb-prev" aria-label="Previous image">' + ICON.prev + '</button><button type="button" class="icon-btn lb-next" aria-label="Next image">' + ICON.next + '</button><button type="button" class="icon-btn lb-close" aria-label="Close">' + ICON.close + '</button></div><figure><img alt=""><figcaption></figcaption></figure></dialog>';
  };
  render.gallery.after = function (main) {
    var items = arr(state.content.gallery), dlg = $('.lightbox', main), idx = 0;
    var withImg = items.map(function (g, i) { return media(g.image) ? i : -1; }).filter(function (i) { return i >= 0; });
    function show(i) {
      idx = i; var g = items[i];
      $('img', dlg).src = media(g.image); $('img', dlg).alt = g.alt || g.title || '';
      $('figcaption', dlg).innerHTML = '<span><b>' + esc(g.title) + '</b>' + (g.caption ? ' · ' + esc(g.caption) : '') + '</span><span class="mono">' + esc([g.channels, g.credit].filter(Boolean).join(' · ')) + '</span>';
    }
    function step(d) { var pos = withImg.indexOf(idx); show(withImg[(pos + d + withImg.length) % withImg.length]); }
    $$('.g-item button[data-idx]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        show(+b.getAttribute('data-idx'));
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    $('.lb-close', dlg).addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    $('.lb-prev', dlg).addEventListener('click', function () { step(-1); });
    $('.lb-next', dlg).addEventListener('click', function () { step(1); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $$('.filter[data-cat]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-cat');
        $$('.filter[data-cat]', main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $$('.g-item', main).forEach(function (g) { g.hidden = c !== 'all' && g.getAttribute('data-cat') !== c; });
      });
    });
  };

  render.join = function () {
    var j = state.content.join || {}, site = state.content.site || {}, c = site.contact || {};
    var email = c.email || '';
    return bandHTML('Join us', 'Join the WAKers', esc(j.intro), j.status ? '<p><span class="state open" style="background:rgb(4 6 11 / .5)"><i></i>' + esc(j.status) + '</span></p>' : '') +
      '<section class="section" id="positions" aria-labelledby="pos-h"><div class="wrap">' + notice('join') + sectionHead('Positions', 'Who we take on', '', '', 'pos-h') +
      '<ul class="positions">' + arr(j.positions).map(function (p) {
        return '<li class="position"><span class="who">' + esc(p.who) + '</span><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p>' +
          '<span class="state' + (p.open ? ' open' : '') + '"><i></i>' + (p.open ? 'Accepting enquiries' : 'No openings right now') + '</span></li>';
      }).join('') + '</ul></div></section>' +
      '<section class="section alt" id="apply" aria-labelledby="apply-h"><div class="wrap two-col"><div>' + sectionHead('How to apply', 'Three steps', '', '', 'apply-h') +
      '<ol class="steps">' + arr(j.steps).map(function (s) { return '<li><div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></div></li>'; }).join('') + '</ol>' +
      (arr(j.skills).length ? '<h3 class="side-h" style="margin-top:32px">What you will learn</h3><ul class="chips">' + arr(j.skills).map(function (s) { return '<li class="chip">' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="contact-card" id="contact"><h3 style="font-size:1.3rem">Get in touch</h3>' +
      (email ? '<div class="copy-row"><span class="label">Email Dr. Abou-Kheir</span><div class="copy-field"><span>' + esc(email) + '</span><button class="copy-btn" type="button" data-copy="' + esc(email) + '">Copy</button></div></div>' : '') +
      (j.emailSubject ? '<div class="copy-row"><span class="label">Suggested subject line</span><div class="copy-field"><span>' + esc(j.emailSubject) + '</span><button class="copy-btn" type="button" data-copy="' + esc(j.emailSubject) + '">Copy</button></div></div>' : '') +
      (email && !PREVIEW ? '<a class="btn btn-primary" href="mailto:' + esc(email) + (j.emailSubject ? '?subject=' + encodeURIComponent(j.emailSubject) : '') + '">Write an email</a>' : '') +
      '<div class="copy-row"><span class="label">Find us</span><address class="address">' + arr(c.addressLines).map(esc).join('<br>') + '</address>' + (c.mapUrl ? '<a href="' + esc(safeUrl(c.mapUrl)) + '" target="_blank" rel="noopener">Open in Maps</a>' : '') + '</div>' +
      (instagram() ? '<div class="copy-row"><span class="label">Follow the lab</span>' + instagram() + '</div>' : '') + '</div></div></section>' +
      (arr(j.faq).length ? '<section class="section"><div class="wrap">' + sectionHead('Questions', 'Frequently asked', '', '') + '<dl class="qa" style="max-width:760px">' + arr(j.faq).map(function (q) { return '<div><dt>' + esc(q.q) + '</dt><dd>' + md(q.a) + '</dd></div>'; }).join('') + '</dl></div></section>' : '');
  };

  render.notfound = function () {
    return bandHTML('404', 'This page wandered off the slide', 'The link may be old or mistyped.', '<div class="hero-actions"><a class="btn btn-primary" href="' + href('home') + '">Go to the home page</a><a class="btn btn-secondary" href="' + href('publications') + '">Browse publications</a></div>');
  };

  /* ------------------------------------------------------------------ mounting */
  function mountFields(main) {
    $$('.band canvas.field-canvas', main).forEach(function (c) { if (window.WAKField) window.WAKField.mount(c, { variant: 'band' }); });
    $$('canvas.eyepiece', main).forEach(function (c) { if (window.WAKField) window.WAKField.specimen(c, c.getAttribute('data-specimen'), c.getAttribute('data-glow'), +c.getAttribute('data-seed')); });
  }

  function currentRoute() {
    if (!PREVIEW) return { page: HTML.getAttribute('data-page') || 'home', anchor: location.hash.slice(1) };
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return { page: 'home' };
    if (PAGES.indexOf(h) >= 0) return { page: h };
    if (ANCHOR_PAGE[h]) return { page: ANCHOR_PAGE[h], anchor: h };
    if (/^t-/.test(h)) return { page: 'research', anchor: h };
    return null; // an in-page anchor such as #main
  }

  function show(page, anchor) {
    var needs = NEEDS[page] || NEEDS.home;
    return Promise.all(needs.map(load)).then(function () {
      var main = $('#main');
      if (state.page !== page) {
        state.page = page;
        document.title = TITLES[page] || TITLES.home;
        renderHeader(page);
        main.innerHTML = (render[page] || render.home)();
        if (!state.footerDone) { renderFooter(); state.footerDone = true; }
        mountFields(main);
        if (render[page] && render[page].after) render[page].after(main);
        if (PREVIEW) { main.focus({ preventScroll: true }); }
      }
      if (anchor) { var t = document.getElementById(anchor); if (t) t.scrollIntoView(); }
      else if (PREVIEW) window.scrollTo(0, 0);
      updateHeaderTone();
    });
  }

  function start() {
    // copy buttons anywhere on the page
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]');
      if (b) {
        var text = b.getAttribute('data-copy');
        var done = function () { toast('Copied'); };
        var fallback = function () {
          var holder = b.parentElement && b.parentElement.querySelector('span, output');
          if (holder) { var r = document.createRange(); r.selectNodeContents(holder); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
          toast('Selected. Press Ctrl+C or ⌘C to copy');
        };
        try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
        return;
      }
      var tl = e.target.closest('[data-topic]');
      if (tl && PREVIEW) { state.pendingTopic = tl.getAttribute('data-topic'); if (state.page === 'publications') { e.preventDefault(); state.page = null; show('publications', 'all'); } }
    });
    window.addEventListener('scroll', function () { requestAnimationFrame(updateHeaderTone); }, { passive: true });
    window.addEventListener('resize', updateHeaderTone);
    if (PREVIEW) {
      window.addEventListener('hashchange', function () {
        var r = currentRoute();
        if (!r) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); return; }
        if (r.page === 'publications' && state.pendingTopic) state.page = null;
        show(r.page, r.anchor);
      });
    }
    var r = currentRoute() || { page: 'home' };
    show(r.page, r.anchor).then(function () {
      var note = $('#preview-note');
      if (note) note.hidden = false;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

