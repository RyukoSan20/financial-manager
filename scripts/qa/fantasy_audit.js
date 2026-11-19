/* The audit: run in the page. Returns unreadable text, half-styled surfaces and overflow.
 *
 * "white" = a visible box whose own background is near white.
 *   - under corporate / jade-light that is the intended card colour, so it is only reported
 *     when the theme does not want white cards (medieval wants parchment, jade-dark wants ink).
 *   - a white box inside the dark chrome (sidebar / top bar / bottom dock) is always a bug:
 *     that is how the "Frankenstein" page looked. */
(() => {
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parseHex = (s) => { const h = s.slice(1); const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; return { c: [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)), a: n.length >= 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1 }; };
  const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  // A gradient is read before the base colour: the base of a gradient panel is transparent, and a
  // translucent colour is not an answer. The first stop of the gradient is what the text sits on first.
  const bgOf = (el) => { let e = el; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); if (/gradient\(/.test(cs.backgroundImage)) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)/g); const q = (m || []).map(parse).filter((x) => x && x.a >= 0.5); if (q.length) return q[0].c; } const p = parse(cs.backgroundColor); if (p && p.a >= 0.9) return p.c; e = e.parentElement; } return [255, 255, 255]; };

  const root = document.querySelector('#root') || document.body;
  const theme = document.documentElement.dataset.appTheme || 'corporate';
  const dark = document.documentElement.classList.contains('dark');
  const inChrome = (el) => !!el.closest('.theme-sidebar, .theme-header, .theme-bottomnav');
  // the chrome is light only in the corporate theme; the other two paint it dark
  const chromeIsDark = theme !== 'corporate';
  // a white card is the intended colour of corporate and of jade in light mode
  const whiteCardIsFine = theme === 'corporate' || (theme === 'jade' && !dark);

  const bad = []; const seen = new Set(); let total = 0;
  for (const el of root.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
    total++;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    let ratio = cr(fg.c, bg);
    // A chiseled RPG title is light fill + dark outline (text-shadow). The glyph reads through
    // the outline, so the outline's own contrast against the plate is what makes it legible.
    const shadow = (cs.textShadow || '').match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g);
    if (shadow) {
      for (const sh of shadow) {
        const p = /^#/.test(sh) ? parseHex(sh) : parse(sh);
        if (!p || p.a < 0.9) continue;
        ratio = Math.max(ratio, cr(p.c, bg));
      }
    }
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) { const k = own.slice(0, 22); if (!seen.has(k)) { seen.add(k); bad.push(`${own.slice(0, 26)} r=${ratio.toFixed(1)} [${(el.className || '').toString().slice(0, 40)}]`); } }
  }

  // white surfaces that the theme does not want
  const whites = []; const wseen = new Set();

  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width < 90 || r.height < 28) continue;
    const cs = getComputedStyle(el); const p = parse(cs.backgroundColor);
    if (!p || p.a < 0.9) continue;
    if (Math.min(...p.c) < 248) continue;
    if (el.closest('.parchment-scroll,[role=dialog],.fantasy-pill,[class*=parchment],.fintech-method,[data-miniature]')) continue;
    const inChromeBox = inChrome(el);
    // a white box in a dark chrome is a bug; elsewhere only when the theme wants no white card
    if (inChromeBox ? !chromeIsDark : whiteCardIsFine) continue;
    const k = (el.className || '').toString().slice(0, 60);
    if (!wseen.has(k)) { wseen.add(k); whites.push(`${el.tagName}.${k} ${Math.round(r.width)}x${Math.round(r.height)}${inChromeBox ? ' [IN-CHROME]' : ''}`); }
  }
  return JSON.stringify({
    url: location.pathname, theme, total, text: bad.length, textBad: bad.slice(0, 5),
    whites: whites.length, whiteList: whites.slice(0, 6),
    overflow: document.documentElement.scrollWidth - innerWidth,
  });
})()
