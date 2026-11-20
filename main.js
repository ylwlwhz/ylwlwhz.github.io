/* Hanzheng Wang · personal page — interactions (no dependencies) */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var isZh = function () { return root.classList.contains('zh'); };

  /* ---------------- toast ---------------- */
  var toastEl = $('.toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------------- theme ---------------- */
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  $('.theme-btn').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
    graph.refreshColors();
  });

  /* ---------------- language ---------------- */
  $('.lang-btn').addEventListener('click', function () {
    var zh = !isZh();
    root.classList.toggle('zh', zh);
    root.lang = zh ? 'zh-CN' : 'en';
    store.set('lang', zh ? 'zh' : 'en');
    typer.restart();
    demo.relabel();
    collapseAuthors();
  });

  /* ---------------- nav: scrolled / progress / active ---------------- */
  var nav = $('.nav'), bar = $('.progress');
  function onScroll() {
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('scrolled', y > 24);
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var links = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('section.block').forEach(function (s) { secObs.observe(s); });
  }

  /* ---------------- reveal on scroll ---------------- */
  var reveals = $$('.reveal').filter(function (el) { return !el.closest('.hero'); });
  if (!('IntersectionObserver' in window) || reduceMotion) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        // 同一父元素下的兄弟元素依次错开出现
        var sibs = $$('.reveal', el.parentElement).filter(function (s) { return s.parentElement === el.parentElement; });
        el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 70 + 'ms';
        el.classList.add('in');
        revObs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { revObs.observe(el); });
  }

  /* ---------------- typewriter ---------------- */
  var typer = (function () {
    var el = $('.typed'), timer = null;
    var words = {
      en: ['automated theorem proving.', 'autoformalization in Lean 4.', 'math a computer can verify.', 'long proofs, one lemma at a time.'],
      zh: ['自动定理证明', 'Lean 4 自动形式化', '能被计算机验证的数学', '长程证明，一次一个引理']
    };
    var wi = 0, ci = 0, deleting = false;
    function tick() {
      var list = words[isZh() ? 'zh' : 'en'], w = list[wi % list.length];
      if (!deleting) {
        ci++;
        el.textContent = w.slice(0, ci);
        if (ci === w.length) { deleting = true; timer = setTimeout(tick, 2200); return; }
        timer = setTimeout(tick, isZh() ? 120 : 55 + Math.random() * 40);
      } else {
        ci--;
        el.textContent = w.slice(0, ci);
        if (ci === 0) { deleting = false; wi++; timer = setTimeout(tick, 380); return; }
        timer = setTimeout(tick, 28);
      }
    }
    function restart() {
      clearTimeout(timer); wi = 0; ci = 0; deleting = false;
      if (reduceMotion) { el.textContent = words[isZh() ? 'zh' : 'en'][0]; return; }
      timer = setTimeout(tick, 500);
    }
    restart();
    return { restart: restart };
  })();

  /* ---------------- hero: drifting proof-graph canvas ---------------- */
  var graph = (function () {
    var cv = $('#graph'), ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, pts = [], mouse = { x: -1e4, y: -1e4 }, running = false, raf = 0;
    var col = {};
    function refreshColors() {
      var cs = getComputedStyle(root);
      col.accent = cs.getPropertyValue('--accent').trim() || '#7b4bb0';
      col.warm = cs.getPropertyValue('--warm').trim() || '#d48a5a';
      col.line = cs.getPropertyValue('--muted').trim() || '#7a7280';
      if (!running) draw();
    }
    function resize() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(72, Math.max(22, W * H / 17000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
          r: 1.4 + Math.random() * 2.2, warm: Math.random() < .18
        });
      }
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var LINK = Math.min(150, W / 7), i, j, p, q, dx, dy, d;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          q = pts[j]; dx = p.x - q.x; dy = p.y - q.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.globalAlpha = (1 - d / LINK) * .22;
            ctx.strokeStyle = col.line; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        dx = p.x - mouse.x; dy = p.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < 190) {
          ctx.globalAlpha = (1 - d / 190) * .7;
          ctx.strokeStyle = col.accent; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.globalAlpha = p.warm ? .8 : .55;
        ctx.fillStyle = p.warm ? col.warm : col.accent;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function step() {
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        // 鼠标附近轻微吸引
        var dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 < 190 * 190 && d2 > 1) { p.vx += dx / d2 * .35; p.vy += dy / d2 * .35; }
        p.vx *= .995; p.vy *= .995;
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp < .08) { p.vx += (Math.random() - .5) * .04; p.vy += (Math.random() - .5) * .04; }
        if (sp > .9) { p.vx *= .9; p.vy *= .9; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
      draw();
      raf = requestAnimationFrame(step);
    }
    function start() { if (running || reduceMotion) return; running = true; raf = requestAnimationFrame(step); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    var hero = $('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -1e4; });
    hero.addEventListener('click', function (e) {
      if (e.target.closest('a,button')) return;
      // 点击背景：在点击处"生成"几个新节点
      var r = cv.getBoundingClientRect();
      for (var k = 0; k < 3; k++) {
        var a = Math.random() * Math.PI * 2;
        pts.push({ x: e.clientX - r.left, y: e.clientY - r.top, vx: Math.cos(a) * .8, vy: Math.sin(a) * .8, r: 1.6 + Math.random() * 2, warm: k === 0 });
      }
      if (pts.length > 110) pts.splice(0, pts.length - 110);
      if (!running) draw();
    });

    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }).observe(hero);
    } else start();
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    refreshColors(); resize();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshColors);
    return { refreshColors: refreshColors };
  })();

  /* ---------------- card spotlight ---------------- */
  $$('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------------- count-up stats ---------------- */
  function countUp(el) {
    var target = parseFloat(el.dataset.count), suf = el.dataset.suffix || '', dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduceMotion) return;
    var t0 = Date.now(), dur = 1400, final = el.textContent, done = false;
    function f() {
      if (done) return;
      var k = Math.min(1, (Date.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? (target * e).toFixed(dec) + suf : final;
      if (k < 1) requestAnimationFrame(f); else done = true;
    }
    requestAnimationFrame(f);
    // 兜底：若 rAF 被节流（后台标签页等），到时直接显示终值
    setTimeout(function () { done = true; el.textContent = final; }, dur + 400);
  }
  if ('IntersectionObserver' in window) {
    var cObs = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { countUp(x.target); cObs.unobserve(x.target); } });
    }, { threshold: .6 });
    $$('[data-count]').forEach(function (el) { cObs.observe(el); });
  }

  /* ---------------- editable proof-sketch demo ---------------- */
  var demo = (function () {
    var box = $('.demo'); if (!box) return { relabel: function () {} };
    var log = $('.demo-log', box), timers = [], idx = -1;
    var N = function (id) { return $('[data-n="' + id + '"]', box); };
    var E = function (id) { return $('[data-e="' + id + '"]', box); };
    function set(id, st) { var n = N(id); n.classList.remove('work', 'ok', 'bad'); if (st) n.classList.add(st); }
    var msgs = {
      en: [
        'Sketch: thm ⇐ L1 ∧ L2 ∧ L3',
        'Proving subgoals in parallel…',
        'L1 ✓ verified · L3 ✓ verified',
        'L2 ✗ failed — edit the sketch in place',
        'Split L2 into L2a, L2b · L1, L3 kept',
        'L2a ✓ · L2b ✓ → L2 ✓',
        'thm ✓ Q.E.D. ∎ — nothing re-proved'
      ],
      zh: [
        '草图：thm ⇐ L1 ∧ L2 ∧ L3',
        '并行证明各子目标……',
        'L1 ✓ 已验证 · L3 ✓ 已验证',
        'L2 ✗ 失败——就地编辑草图',
        '把 L2 拆为 L2a、L2b · 保留 L1、L3',
        'L2a ✓ · L2b ✓ → L2 ✓',
        'thm ✓ 证毕 ∎——无需重证任何引理'
      ]
    };
    function say(i) { idx = i; log.textContent = msgs[isZh() ? 'zh' : 'en'][i]; }
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      ['T', 'L1', 'L2', 'L3', 'a', 'b'].forEach(function (id) { set(id, null); });
      ['a', 'b'].forEach(function (id) { N(id).classList.add('hidden'); });
      ['L2-a', 'L2-b'].forEach(function (id) { E(id).classList.add('hidden'); E(id).classList.remove('live'); });
      ['T-L1', 'T-L2', 'T-L3'].forEach(function (id) { E(id).classList.remove('live'); });
    }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function play() {
      reset(); say(0);
      at(1100, function () { say(1); set('L1', 'work'); set('L2', 'work'); set('L3', 'work'); });
      at(2300, function () { set('L1', 'ok'); E('T-L1').classList.add('live'); });
      at(2700, function () { set('L3', 'ok'); E('T-L3').classList.add('live'); say(2); });
      at(3500, function () { set('L2', 'bad'); say(3); });
      at(4900, function () {
        set('L2', null); say(4);
        ['a', 'b'].forEach(function (id) { N(id).classList.remove('hidden'); set(id, 'work'); });
        ['L2-a', 'L2-b'].forEach(function (id) { E(id).classList.remove('hidden'); });
      });
      at(6100, function () { set('a', 'ok'); E('L2-a').classList.add('live'); });
      at(6500, function () { set('b', 'ok'); E('L2-b').classList.add('live'); });
      at(7100, function () { set('L2', 'ok'); E('T-L2').classList.add('live'); say(5); });
      at(7900, function () { set('T', 'ok'); say(6); });
      at(12000, play);
    }
    function showFinal() {
      reset();
      ['T', 'L1', 'L2', 'L3', 'a', 'b'].forEach(function (id) { N(id).classList.remove('hidden'); set(id, 'ok'); });
      $$('.edge', box).forEach(function (e) { e.classList.remove('hidden'); e.classList.add('live'); });
      say(6);
    }
    $('.demo-play', box).addEventListener('click', function () { reduceMotion ? showFinal() : play(); });
    if (reduceMotion || !('IntersectionObserver' in window)) { showFinal(); }
    else {
      say(0);
      var started = false;
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !started) { started = true; play(); }
      }, { threshold: .5 }).observe(box);
    }
    return { relabel: function () { if (idx >= 0) say(idx); } };
  })();

  /* ---------------- publication filter ---------------- */
  var filters = $$('.filter');
  filters.forEach(function (b) {
    b.addEventListener('click', function () {
      filters.forEach(function (x) { x.classList.toggle('on', x === b); });
      var f = b.dataset.f;
      $$('.pub').forEach(function (p) { p.classList.toggle('out', f !== 'all' && p.dataset.topic !== f); });
    });
  });

  /* ---------------- long author lists: collapse with "+N more" ---------------- */
  var authorCache = new WeakMap();
  function collapseAuthors() {
    $$('.authors[data-collapse]').forEach(function (p) {
      if (!authorCache.has(p)) authorCache.set(p, p.innerHTML.split(/,\s*/));
      if (p.dataset.open) return;
      var parts = authorCache.get(p), keep = parseInt(p.dataset.collapse, 10);
      if (parts.length <= keep + 1) return;
      var rest = parts.length - keep;
      p.innerHTML = parts.slice(0, keep).join(', ') + ', <button class="more" type="button">' +
        (isZh() ? '等另外 ' + rest + ' 位' : '+' + rest + ' more') + '</button>';
      $('.more', p).addEventListener('click', function () { p.dataset.open = '1'; p.innerHTML = parts.join(', '); });
    });
  }
  collapseAuthors();

  /* ---------------- email (assembled at runtime to deter scrapers) ---------------- */
  var mail = ['wang-hz23', 'mails.tsinghua.edu.cn'].join('@');
  $$('.mail-text').forEach(function (el) { el.textContent = mail; });
  $$('.copy-mail').forEach(function (b) {
    b.addEventListener('click', function () {
      var done = function () { toast((isZh() ? '已复制邮箱：' : 'Copied: ') + mail); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(mail).then(done, function () { location.href = 'mailto:' + mail; });
      } else { location.href = 'mailto:' + mail; }
    });
  });

  /* ---------------- small easter egg: type "qed" ---------------- */
  var buf = '';
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    buf = (buf + (e.key || '')).slice(-3).toLowerCase();
    if (buf === 'qed') toast('∎  Q.E.D.');
  });

  var y = $('.year'); if (y) y.textContent = new Date().getFullYear();
})();
