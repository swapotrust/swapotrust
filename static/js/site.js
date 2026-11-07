/* SWAPO Trust – site behaviour (no dependencies) */
(function () {
  var html = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- Language: English default, instant switch to Hindi ---- */
  function setLang(lang) {
    html.classList.toggle('hi', lang === 'hi');
    html.lang = lang;
    try { localStorage.setItem('swapo-lang', lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent('swapo:lang', { detail: lang }));
  }
  $$('[data-lang-toggle]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(html.classList.contains('hi') ? 'en' : 'hi'); });
  });
  var q = new URLSearchParams(location.search).get('lang');
  if (q === 'hi' || q === 'en') setLang(q);

  /* ---- Mobile drawer ---- */
  var drawer = $('#drawer'), menuBtn = $('[data-menu]');
  function closeDrawer() { if (!drawer) return; drawer.hidden = true; menuBtn && menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', function () { drawer.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; });
    drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.closest('[data-menu-close]')) closeDrawer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  }

  /* ---- Live TB month counter ---- */
  $$('[data-tb-months]').forEach(function (el) {
    var s = (el.getAttribute('data-start') || '2016-07-16').split('-');
    var now = new Date();
    var n = (now.getFullYear() - +s[0]) * 12 + (now.getMonth() + 1 - +s[1]) + 1;
    if (n > 0) el.textContent = n;
  });

  /* ---- News category filter ---- */
  var chips = $('[data-filter]');
  if (chips) {
    var target = $('[data-filter-target]');
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', chips).forEach(function (c) { c.classList.toggle('is-on', c === b); });
      var cat = b.getAttribute('data-cat');
      $$('.ncard', target).forEach(function (card) { card.hidden = !(cat === 'all' || card.getAttribute('data-cat') === cat); });
    });
  }

  /* ---- Photo carousel ---- */
  $$('[data-carousel]').forEach(function (car) {
    var track = $('.car-track', car), dots = $$('.car-dots button', car);
    function idx() { return Math.round(track.scrollLeft / track.clientWidth); }
    function go(i) { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); }
    track.addEventListener('scroll', function () { var i = idx(); dots.forEach(function (d, j) { d.classList.toggle('is-on', i === j); }); }, { passive: true });
    dots.forEach(function (d, j) { d.addEventListener('click', function () { go(j); }); });
    var prev = $('.car-prev', car), next = $('.car-next', car);
    prev && prev.addEventListener('click', function () { go(Math.max(0, idx() - 1)); });
    next && next.addEventListener('click', function () { go(Math.min(dots.length - 1, idx() + 1)); });
  });

  /* ---- Lightbox ---- */
  var lb = $('[data-lb]');
  if (lb) {
    var lbImg = $('img', lb);
    $$('[data-lightbox]').forEach(function (img) {
      img.addEventListener('click', function () { lbImg.src = img.currentSrc || img.src; lb.hidden = false; });
    });
    lb.addEventListener('click', function () { lb.hidden = true; lbImg.removeAttribute('src'); });
  }

  /* ---- Share: native sheet on phones, copy link fallback ---- */
  $$('[data-share]').forEach(function (box) {
    var url = box.getAttribute('data-url'), title = box.getAttribute('data-title');
    var copy = $('[data-copy]', box);
    if (!copy) return;
    copy.addEventListener('click', function () {
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      var done = function () { $$('.copy-txt span', copy).forEach(function (s) { s.textContent = s.lang === 'hi' ? 'कॉपी हो गया ✓' : 'Copied ✓'; }); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
    });
  });

  /* ---- Join form → WhatsApp ---- */
  $$('[data-wa-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(f);
      var msg = 'Namaste SWAPO Trust!\n' +
        'Name: ' + (d.get('name') || '') + '\n' +
        'Phone: ' + (d.get('phone') || '') + '\n' +
        (d.get('city') ? 'City: ' + d.get('city') + '\n' : '') +
        'I would like to: ' + (d.get('interest') || '') + '\n' +
        (d.get('message') ? 'Message: ' + d.get('message') : '');
      window.open('https://wa.me/' + f.getAttribute('data-phone') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
  });


  /* ---- Home slideshow ---- */
  $$('[data-slider]').forEach(function (sl) {
    var slides = $$('.slide', sl), dots = $$('.slider-dots button', sl), i = 0, timer;
    if (slides.length < 2) return;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, j) { s.classList.toggle('is-on', j === i); });
      dots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
    }
    function auto() { clearInterval(timer); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(function () { show(i + 1); }, 6000); }
    dots.forEach(function (d, j) { d.addEventListener('click', function () { show(j); auto(); }); });
    var pv = $('.sl-prev', sl), nx = $('.sl-next', sl);
    pv && pv.addEventListener('click', function () { show(i - 1); auto(); });
    nx && nx.addEventListener('click', function () { show(i + 1); auto(); });
    var x0 = null;
    sl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    sl.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); auto(); } x0 = null; });
    auto();
  });

  /* ---- Donate: highlight chosen programme (?for=id) ---- */
  var want = new URLSearchParams(location.search).get('for');
  if (want) { var row = document.getElementById('give-' + want); if (row) { row.classList.add('is-picked'); setTimeout(function () { row.scrollIntoView({ block: 'center' }); }, 300); } }

  /* ---- E-paper: Download PDF ---- */
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

  /* ---- Seva map (Leaflet, loaded only on map pages) ---- */
  var maps = $$('[data-map]');
  var colours = { office: '#0E4A55', water: '#1F7A8C', health: '#B5473A', relief: '#D9772B', care: '#7A4E8C', education: '#2F6B3F', spirit: '#B8862F' };
  function drawMaps() {
    if (!window.L) return false;
    maps.forEach(function (box) {
      if (box._map) return;
      var places = []; try { places = JSON.parse(box.getAttribute('data-places') || '[]'); } catch (e) {}
      var map = L.map(box, { scrollWheelZoom: false, attributionControl: true });
      box._map = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);
      var pts = [];
      places.forEach(function (p) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
        var icon = L.divIcon({ className: '', html: '<div class="swapo-pin" style="background:' + (colours[p.kind] || colours.office) + '"></div>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
        var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
        var label = function () { return html.classList.contains('hi') ? (p.name_hi || p.name_en) : p.name_en; };
        m.bindPopup(label());
        document.addEventListener('swapo:lang', function () { m.setPopupContent(label()); });
        pts.push([p.lat, p.lng]);
      });
      if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      else map.setView(pts[0] || [27.596, 78.052], 14);
    });
    return true;
  }
  if (maps.length) {
    var tries = 0;
    (function wait() {
      if (drawMaps()) return;
      if (++tries > 60) { maps.forEach(function (b) { b.innerHTML = '<div class="map-fallback">Hathras, Uttar Pradesh – 204101</div>'; }); return; }
      setTimeout(wait, 150);
    })();
  }
})();
