/* DOT — projects + infinite dotted canvas (draft 2) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const BASE_W = 240;                    // every media thumbnail starts this wide
  const DEFAULT_AR = 4 / 5;              // until the real ratio is known
  const GRID = 24;                       // on-screen dot spacing (static while zooming)
  const MIN_Z = 0.1, MAX_Z = 4, MIN_W = 80;
  const TEXT = {
    heading:    { w: 520, label: 'Heading',    ph: 'Heading' },
    subheading: { w: 440, label: 'Subheading', ph: 'Subheading' },
    paragraph:  { w: 380, label: 'Paragraph',  ph: 'Write something…' },
  };
  // Text styles: plain black or white text, or Instagram-style text on a black or white highlight.
  const TEXT_STYLES = {
    'dark':     { label: 'Black text',       bg: 'none',    fg: '#121214', ring: '#c9cbd0', dash: true },
    'light':    { label: 'White text',       bg: '#8b8e95', fg: '#ffffff' },
    'dark-bg':  { label: 'Black background', bg: '#121214', fg: '#ffffff' },
    'light-bg': { label: 'White background', bg: '#ffffff', fg: '#121214', ring: '#c9cbd0' },
  };
  const swatch = st => `<svg viewBox="0 0 24 24"><rect x="2.5" y="3.5" width="19" height="17" rx="5" fill="${st.bg}" stroke="${st.ring || st.bg}"${st.dash ? ' stroke-dasharray="2.5 2"' : ''}/><text x="12" y="16.2" text-anchor="middle" font-size="10.5" font-weight="700" fill="${st.fg}" font-family="-apple-system, Helvetica, Arial, sans-serif">Aa</text></svg>`;
  const ALIGNS = ['left', 'center', 'right'];
  // Shapes: square and circle keep 1:1 when resized; rectangle and triangle stretch freely.
  const SHAPES = {
    square:   { label: 'Square',    w: 200, h: 200, lock: true },
    rect:     { label: 'Rectangle', w: 280, h: 180 },
    triangle: { label: 'Triangle',  w: 220, h: 190 },
    circle:   { label: 'Circle',    w: 200, h: 200, lock: true },
  };
  const SHAPE_FILLS = {
    grey:    { label: 'Grey',    fill: '#dfe1e6', stroke: 'none' },
    black:   { label: 'Black',   fill: '#121214', stroke: 'none' },
    white:   { label: 'White',   fill: '#ffffff', stroke: '#c9cbd0' },
    outline: { label: 'Outline', fill: 'none',    stroke: '#121214' },
  };
  const shapeSvg = (shape, f, cls = '') => {
    const st = `fill="${f.fill}" stroke="${f.stroke}" stroke-width="2" vector-effect="non-scaling-stroke"`;
    const body = shape === 'circle' ? `<ellipse cx="50" cy="50" rx="49.5" ry="49.5" ${st}/>`
      : shape === 'triangle' ? `<polygon points="50,0.5 99.5,99.5 0.5,99.5" stroke-linejoin="round" ${st}/>`
      : `<rect x="0.5" y="0.5" width="99" height="99" ${st}/>`;
    return `<svg class="${cls}" viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
  };
  const fillSwatch = f => `<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="${f.fill}" stroke="${f.stroke === 'none' ? f.fill : f.stroke}" stroke-width="1.5"/></svg>`;
  // Instagram posts and reels show as the official embed, scaled to the card.
  const IG_W = 400;
  const igCode = url => {
    try {
      const u = new URL(url);
      if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
      return (u.pathname.match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || null;
    } catch { return null; }
  };
  // Pinterest pins: the page link is turned into the pin's image (Pinterest's public widget API allows this).
  const pinId = url => {
    try {
      const u = new URL(url);
      if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
      return (u.pathname.match(/\/pin\/(?:[^/]*--)?(\d{5,})/) || [])[1] || null;
    } catch { return null; }
  };
  const isPinShort = url => /^https?:\/\/(www\.)?pin\.it\//i.test(url);
  async function pinImage(id) {
    const r = await fetch(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${id}`);
    const d = (await r.json())?.data?.[0];
    const im = d?.images || {};
    const u = im['564x']?.url || im['237x']?.url || im['236x']?.url;
    if (!u) throw new Error('no image');
    return [u.replace(/\/(564x|23[67]x)\//, '/736x/'), u];       // the bigger size first, the listed one as a fallback
  }
  // Load the first image in `srcs` that works.
  const loadFirst = srcs => new Promise((res, rej) => {
    const next = i => {
      if (i >= srcs.length) return rej(new Error('no image'));
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => next(i + 1);
      img.src = srcs[i];
    };
    next(0);
  });
  let lastTextStyle = 'dark';
  try { lastTextStyle = localStorage.getItem('dot.textStyle') || 'dark'; } catch {}
  if (!TEXT_STYLES[lastTextStyle]) lastTextStyle = 'dark';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // Sharing: projects are uploaded to a public Supabase Storage bucket ("shares") and opened from #s=<id> links.
  const SHARE = { url: 'https://ytqlmagatpcaqxvfqodz.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cWxtYWdhdHBjYXF4dmZxb2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNzAxNzEsImV4cCI6MjA5Njg0NjE3MX0.e6QKRe06LAiDpGFyEuC6l-3zztxLycEKcD9U2apMR1A', bucket: 'dot-shares' };
  const EMBEDDED = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------------- Icons ---------------- */
  const svg = (p, sw = 1.8) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    home: svg('<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>'),
    target: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2"/>'),
    library: svg('<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 15.5 8.5 11l4 3.5 3-2.5 4.5 3.5"/><circle cx="15.5" cy="8.5" r="1.4"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    grid: svg('<circle cx="6" cy="6" r="1.3" fill="currentColor"/><circle cx="12" cy="6" r="1.3" fill="currentColor"/><circle cx="18" cy="6" r="1.3" fill="currentColor"/><circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/><circle cx="6" cy="18" r="1.3" fill="currentColor"/><circle cx="12" cy="18" r="1.3" fill="currentColor"/><circle cx="18" cy="18" r="1.3" fill="currentColor"/>', 0),
    image: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m20.5 15-4.5-4.5L6 20.5"/>'),
    video: svg('<rect x="2.5" y="5.5" width="14" height="13" rx="3"/><path d="m16.5 10.5 5-3v9l-5-3"/>'),
    link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
    upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    open: svg('<path d="M14 4h6v6M20 4l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
    back: svg('<rect x="4" y="4" width="12" height="12" rx="2.5"/><path d="M8 16v2.5A1.5 1.5 0 0 0 9.5 20h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 8H16"/>'),
    front: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>'),
    todo: svg('<rect x="3.5" y="4.5" width="6" height="6" rx="1.5"/><path d="m4.8 7.6 1.3 1.3 2.3-2.6M13 7.5h7.5M3.5 13.5h6v6h-6zM13 16.5h7.5"/>'),
    edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'),
    fit: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>', 2),
    select: svg('<path d="M5 3.5 18.5 10l-6 1.8L10 18z" fill="currentColor"/>', 1.6),
    hand: svg('<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5v-6a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2.1L8 15"/>'),
    locate: svg('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'),
    text: svg('<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/>'),
    heading: svg('<path d="M6 5v14M16 5v14M6 12h10"/>', 2.2),
    subheading: svg('<path d="M5 7v10M13 7v10M5 12h8M17 11.5l2.5-1.5V17"/>'),
    paragraph: svg('<path d="M4 6.5h16M4 11h16M4 15.5h16M4 20h9"/>'),
    duplicate: svg('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5M14.5 12v5M12 14.5h5"/>'),
    copy: svg('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>'),
    paste: svg('<path d="M9 4.5H6.5A2 2 0 0 0 4.5 6.5v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2H15"/><rect x="9" y="3" width="6" height="3.5" rx="1"/>'),
    cut: svg('<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.5 16 18 4M15.5 16 6 4"/>'),
    line: svg('<path d="M5 19C9 9 14 13 19 5"/><path d="M14.5 5H19v4.5"/>'),
    straight: svg('<path d="M5 19 19 5"/><path d="M13 5h6v6"/>'),
    arrowEnd: svg('<path d="M4 12h15M14 7l5 5-5 5"/>'),
    arrowBoth: svg('<path d="M5 12h14M9 7l-5 5 5 5M15 7l5 5-5 5"/>'),
    noArrow: svg('<path d="M4 12h16"/>'),
    unlink: svg('<path d="M9.5 14.5 7.6 16.4a3 3 0 0 1-4.2-4.2l2.6-2.6M14.5 9.5l1.9-1.9a3 3 0 0 1 4.2 4.2L18 14.4M8 4v2.5M4 8h2.5M16 20v-2.5M20 16h-2.5"/>'),
    resize: svg('<path d="M7 7l10 10M7 7h5M7 7v5M17 17h-5M17 17v-5"/>', 2.2),
    rotate: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>'),
    resetRot: svg('<path d="M4 13a8 8 0 1 0 2.3-5.7"/><path d="M4 4.5V11h6.5"/>'),
    chevron: svg('<path d="m9 6 6 6-6 6"/>', 2),
    folder: svg('<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    newFolder: svg('<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>'),
    out: svg('<path d="M14 5h4.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>'),
    projects: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    addProject: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),
    keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>', 2),
    undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    sidebar: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/>'),
    alignLeft: svg('<path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10"/>'),
    alignCenter: svg('<path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10"/>'),
    alignRight: svg('<path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10"/>'),
    shapes: svg('<rect x="3.5" y="11.5" width="9" height="9" rx="1.5"/><circle cx="16.5" cy="7.5" r="4"/>'),
    square: svg('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'),
    rect: svg('<rect x="3" y="7" width="18" height="10" rx="1.5"/>'),
    triangle: svg('<path d="M12 4.5 20.5 19h-17z"/>'),
    circle: svg('<circle cx="12" cy="12" r="7.5"/>'),
    signOut: svg('<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h9"/>'),
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>',
    share: svg('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6"/>'),
    newProject: svg('<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>'),
    // Arrange: align edges / centres, spread evenly, lock in place
    aL: svg('<path d="M4 3.5v17"/><rect x="7.5" y="6" width="12" height="4.5" rx="1"/><rect x="7.5" y="13.5" width="7" height="4.5" rx="1"/>'),
    aC: svg('<path d="M12 3.5v2.5M12 10.5v3M12 18v2.5"/><rect x="5" y="6" width="14" height="4.5" rx="1"/><rect x="8" y="13.5" width="8" height="4.5" rx="1"/>'),
    aR: svg('<path d="M20 3.5v17"/><rect x="4.5" y="6" width="12" height="4.5" rx="1"/><rect x="9.5" y="13.5" width="7" height="4.5" rx="1"/>'),
    aT: svg('<path d="M3.5 4h17"/><rect x="6" y="7.5" width="4.5" height="12" rx="1"/><rect x="13.5" y="7.5" width="4.5" height="7" rx="1"/>'),
    aM: svg('<path d="M3.5 12h2.5M10.5 12h3M18 12h2.5"/><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="8" width="4.5" height="8" rx="1"/>'),
    aB: svg('<path d="M3.5 20h17"/><rect x="6" y="4.5" width="4.5" height="12" rx="1"/><rect x="13.5" y="9.5" width="4.5" height="7" rx="1"/>'),
    distH: svg('<path d="M4 4v16M20 4v16"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>'),
    distV: svg('<path d="M4 4h16M4 20h16"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    unlock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/>'),
    more: svg('<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>', 0),
  };
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = I[el.dataset.icon] || ''; });

  /* ---------------- IndexedDB ---------------- */
  // One local database per account ('dot-u-<id>'); the pre-login 'dot-app' one is read once for migration.
  const makeDb = name => {
    let dbp;
    const mem = { projects: new Map(), items: new Map(), folders: new Map() };
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(name, 2); } catch (e) { return rej(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        const has = n => d.objectStoreNames.contains(n);
        if (!has('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!has('items')) d.createObjectStore('items', { keyPath: 'id' }).createIndex('projectId', 'projectId');
        if (!has('folders')) d.createObjectStore('folders', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }).catch(() => null));                // storage unavailable: keep working in memory for this visit
    const memOp = (store, op, v) => {
      const m = mem[store];
      if (op === 'all') return [...m.values()];
      if (op === 'get') return m.get(v);
      if (op === 'put') m.set(v.id, v); else m.delete(v);
    };
    const tx = async (store, mode, fn, op, v) => {
      const d = await open();
      if (!d) return memOp(store, op, v);
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => res(r ? r.result : undefined);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      get: (store, id) => tx(store, 'readonly', s => s.get(id), 'get', id).catch(() => mem[store].get(id)),
      all: store => tx(store, 'readonly', s => s.getAll(), 'all').catch(() => memOp(store, 'all')),
      put: (store, v) => tx(store, 'readwrite', s => s.put(v), 'put', v).catch(() => memOp(store, 'put', v)),
      del: (store, id) => tx(store, 'readwrite', s => s.delete(id), 'del', id).catch(() => memOp(store, 'del', id)),
    };
  };
  // `db` is the signed-in account's database. Every put/del is also queued for the cloud copy.
  let local = makeDb('dot-app');
  const db = {
    get: (s, id) => local.get(s, id),
    all: s => local.all(s),
    put: (s, v) => { const p = local.put(s, v); cloud.queue(s, v.id); return p; },
    del: (s, id) => { const p = local.del(s, id); cloud.queue(s, id, true); return p; },
    raw: { put: (s, v) => local.put(s, v), del: (s, id) => local.del(s, id) },   // cloud → local, not queued back
    use: name => { local = makeDb(name); },
  };

  /* ---------------- State ---------------- */
  const state = { projects: [], items: [], folders: [], current: null, sel: new Set(), topZ: 1, tool: 'select', space: false };
  let view = { x: 0, y: 0, z: 1 };
  const bg = { x: 0, y: 0 };             // dot-grid offset: follows panning, ignores zooming
  const urls = new Map();
  const srcOf = it => {
    if (!it.blob) return it.url;
    if (!urls.has(it.id)) urls.set(it.id, URL.createObjectURL(it.blob));
    return urls.get(it.id);
  };
  const project = () => state.projects.find(p => p.id === state.current);
  const itemsHere = () => state.items.filter(i => i.projectId === state.current);
  const itemById = id => state.items.find(i => i.id === id);
  const elOf = id => world.querySelector(`.item[data-id="${id}"]`);

  function normalize(it) {
    if (it.kind === 'line') {
      it.a = it.a || { x: 0, y: 0 };
      it.b = it.b || { x: 200, y: -120 };
      it.bend = it.bend || { t: 0.5, d: 0 };
      it.arrow = it.arrow || 'end';
      return it;
    }
    if (it.kind === 'text') { if (!it.w) it.w = TEXT[it.variant].w; }
    else {
      if (!it.w) it.w = BASE_W;
      if (!it.h) it.h = Math.round(it.w / (it.ar || DEFAULT_AR));
    }
    return it;
  }
  const boxOf = it => ({ w: it.w, h: it.kind === 'text' ? (elOf(it.id)?.offsetHeight || 60) : it.h });
  // World-space bounding box of any item (lines included).
  function bounds(it) {
    if (it.kind === 'line') {
      const g = lineGeom(it);
      const xs = [g.A.x, g.B.x, g.M.x], ys = [g.A.y, g.B.y, g.M.y];
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y) };
    }
    const b = boxOf(it);
    return { x: it.x, y: it.y, w: b.w, h: b.h };
  }
  const cloneData = it => it.kind === 'line'
    ? { ...it, a: { ...it.a }, b: { ...it.b }, bend: { ...it.bend } }
    : { ...it };

  const canvas = $('#canvas'), world = $('#world'), stage = $('#stage');

  /* ---------------- Video link parsing ---------------- */
  function parseVideo(url) {
    let u;
    try { u = new URL(url); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.replace(/^(www\.|m\.)/, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h.endsWith('youtube.com')) id = u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/) || [])[2];
    if (id) return { provider: 'YouTube', thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, ar: /\/shorts\//.test(u.pathname) ? 9 / 16 : 16 / 9, embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` };
    if (h.endsWith('vimeo.com')) {
      const m = u.pathname.match(/(\d{5,})/);
      if (m) return { provider: 'Vimeo', ar: 16 / 9, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
    }
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(u.pathname)) return { provider: 'file' };
    return { provider: h };
  }
  const isHttpUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
  const hostOf = url => { try { return new URL(url).hostname; } catch { return ''; } };

  /* ---------------- View ---------------- */
  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
    world.style.setProperty('--iz', 1 / view.z);
    canvas.style.backgroundPosition = `${bg.x - GRID / 2}px ${bg.y - GRID / 2}px`;
    $('#zoomReset').textContent = Math.round(view.z * 100) + '%';
    if (state.sel.size) queueGroupBox();
    saveViewSoon();
  }
  let viewTimer;
  function saveViewSoon() {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      const p = project();
      if (p) { p.view = { ...view }; db.put('projects', p); }
    }, 300);
  }
  const rect = () => canvas.getBoundingClientRect();
  const toWorld = (cx, cy) => { const r = rect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }; };
  function pan(dx, dy) { view.x += dx; view.y += dy; bg.x += dx; bg.y += dy; applyView(); }
  function zoomAt(sx, sy, factor) {
    const nz = clamp(view.z * factor, MIN_Z, MAX_Z);
    const k = nz / view.z;
    view.x = sx - (sx - view.x) * k;
    view.y = sy - (sy - view.y) * k;
    view.z = nz;
    applyView();
  }
  const zoomCenter = f => { const r = rect(); zoomAt(r.width / 2, r.height / 2, f); };

  let anim = 0;
  function animateTo(target, ms = 450) {
    cancelAnimationFrame(anim);
    const from = { ...view }, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e };
      applyView();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function resetView() { const r = rect(); view = { x: r.width / 2, y: r.height / 2, z: 1 }; applyView(); }
  function fitView(its, maxZ = 1) {
    const r = rect(), pad = 80;
    const bx = its.map(bounds);
    const minX = Math.min(...bx.map(b => b.x)), minY = Math.min(...bx.map(b => b.y));
    const maxX = Math.max(...bx.map(b => b.x + b.w)), maxY = Math.max(...bx.map(b => b.y + b.h));
    const z = clamp(Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY)), MIN_Z, maxZ);
    return { z, x: r.width / 2 - ((minX + maxX) / 2) * z, y: r.height / 2 - ((minY + maxY) / 2) * z };
  }
  function fitAll(animated = true) {
    const its = itemsHere();
    if (!its.length) return resetView();
    const t = fitView(its);
    animated ? animateTo(t) : (view = t, applyView());
  }

  // Snap a world point so its on-screen position lands on a visible dot.
  function snapWorld(x, y) {
    const sx = view.x + x * view.z, sy = view.y + y * view.z;
    const nx = bg.x + Math.round((sx - bg.x) / GRID) * GRID;
    const ny = bg.y + Math.round((sy - bg.y) / GRID) * GRID;
    return { x: (nx - view.x) / view.z, y: (ny - view.y) / view.z };
  }

  /* ---------------- Last edited ---------------- */
  function touch(id) {
    const p = project();
    if (!p || !id) return;
    p.lastEdited = id;
    db.put('projects', p);
    $('#locate').classList.remove('disabled');
  }
  function goToLastEdited() {
    const p = project();
    const here = itemsHere();
    let it = p && itemById(p.lastEdited);
    if (!it || it.projectId !== state.current) it = here.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!it) return toast('Nothing on this canvas yet');
    const r = rect(), b = bounds(it);
    const z = clamp(Math.min(1, (r.width * 0.6) / b.w, (r.height * 0.6) / b.h), MIN_Z, MAX_Z);
    animateTo({ z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z });
    setSelection([it.id]);
    const el = elOf(it.id);
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  /* ---------------- Sidebar: folders + projects ---------------- */
  const DRAG_TYPE = 'application/x-dot-project';
  const itemCount = pid => state.items.reduce((n, i) => n + (i.projectId === pid ? 1 : 0), 0);
  const folderOf = p => (p && p.folderId && state.folders.find(f => f.id === p.folderId)) || null;
  const sectionLabel = text => Object.assign(document.createElement('div'), { className: 'panel-section-label', textContent: text });

  // Projects can be dragged onto a folder (or back to the loose list).
  function dropZone(el, folderId) {
    el.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-target'); });
    el.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('drop-target');
      moveProject(e.dataTransfer.getData(DRAG_TYPE), folderId);
    });
  }

  function projectRow(p) {
    const row = document.createElement('div');
    row.className = 'row project' + (p.id === state.current ? ' active' : '');
    Object.assign(row.dataset, { kind: 'project', id: p.id });
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.draggable = true;
    row.innerHTML = `<span class="p-icon">${I.grid}</span><span class="p-name"></span><span class="count">${itemCount(p.id)}</span>`;
    row.querySelector('.p-name').textContent = p.name;
    row.addEventListener('click', () => { if (p.id !== state.current) openProject(p.id); });
    row.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === row) openProject(p.id); });
    row.addEventListener('dblclick', () => startRename('project', p.id));
    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData(DRAG_TYPE, p.id);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('drag-src');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('drag-src');
      document.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
    });
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      const targets = state.folders.filter(f => f.id !== p.folderId);
      openCtx(e.clientX, e.clientY, [
        { label: 'Share project', icon: I.share, action: () => shareProject(p.id) },
        { label: 'Rename', icon: I.edit, action: () => startRename('project', p.id) },
        'sep',
        ...(targets.length ? [{ heading: 'Move to folder' }, ...targets.map(f => ({ label: f.name, icon: I.folder, action: () => moveProject(p.id, f.id) }))] : []),
        { label: 'New folder with this project', icon: I.newFolder, action: () => addFolder(p.id) },
        ...(p.folderId ? [{ label: 'Take out of folder', icon: I.out, action: () => moveProject(p.id, null) }] : []),
        'sep',
        { label: 'Delete project', icon: I.trash, danger: true, action: () => deleteProject(p.id) },
      ]);
    });
    return row;
  }

  function folderGroup(f) {
    const projs = state.projects.filter(p => p.folderId === f.id);
    const group = document.createElement('div');
    group.className = 'folder-group' + (f.open ? ' open' : '');
    const row = document.createElement('div');
    row.className = 'row folder' + (projs.some(p => p.id === state.current) ? ' has-active' : '');
    Object.assign(row.dataset, { kind: 'folder', id: f.id });
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-expanded', String(!!f.open));
    row.innerHTML = `<span class="chev">${I.chevron}</span><span class="p-icon">${I.folder}</span><span class="p-name"></span><span class="count">${projs.length}</span>`;
    row.querySelector('.p-name').textContent = f.name;
    const toggle = () => {
      f.open = !f.open;
      group.classList.toggle('open', f.open);
      row.setAttribute('aria-expanded', String(f.open));
      db.put('folders', f);
    };
    row.addEventListener('click', e => { if (!e.target.closest('input')) toggle(); });
    row.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === row) toggle(); });
    row.addEventListener('dblclick', e => { e.preventDefault(); startRename('folder', f.id); });
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCtx(e.clientX, e.clientY, [
        { label: 'New project in folder', icon: I.newProject, action: () => addProject('Untitled Project', true, f.id) },
        { label: 'Rename', icon: I.edit, action: () => startRename('folder', f.id) },
        'sep',
        { label: 'Delete folder', icon: I.trash, danger: true, action: () => deleteFolder(f.id) },
      ]);
    });
    const kids = document.createElement('div');
    kids.className = 'folder-children';
    projs.forEach(p => kids.append(projectRow(p)));
    if (!projs.length) kids.append(Object.assign(document.createElement('div'), { className: 'folder-empty', textContent: 'Drag projects here' }));
    group.append(row, kids);
    dropZone(group, f.id);
    return group;
  }

  function renderProjects() {
    const list = $('#projectList');
    list.innerHTML = '';
    if (state.folders.length) {
      list.append(sectionLabel('Folders'));
      state.folders.forEach(f => list.append(folderGroup(f)));
      list.append(sectionLabel('Projects'));
    }
    const loose = document.createElement('div');
    loose.className = 'loose';
    state.projects.filter(p => !folderOf(p)).forEach(p => loose.append(projectRow(p)));
    if (state.folders.length && !loose.children.length)
      loose.append(Object.assign(document.createElement('div'), { className: 'folder-empty', textContent: 'Drag a project here to take it out of its folder' }));
    dropZone(loose, null);
    list.append(loose);

    const p = project(), f = folderOf(p);
    $('#crumbFolder').textContent = f ? f.name : '';
    $('#crumbFolder').hidden = !f;
    $('#crumbName').textContent = p ? p.name : '—';
    const here = itemsHere();
    $('#crumbCount').textContent = here.length ? plural(here.length, 'item') : '';
    $('#empty').hidden = here.length > 0;
    $('#locate').classList.toggle('disabled', !here.length);
  }

  function startRename(kind, id) {
    setCollapsed(false);                                 // renaming happens in the panel, so show it
    const coll = kind === 'folder' ? state.folders : state.projects;
    const store = kind === 'folder' ? 'folders' : 'projects';
    const row = $(`.row[data-kind="${kind}"][data-id="${id}"]`);
    const obj = coll.find(x => x.id === id);
    if (!row || !obj) return;
    row.draggable = false;
    const nameEl = row.querySelector('.p-name');
    const input = document.createElement('input');
    input.value = obj.name;
    input.setAttribute('aria-label', `Rename ${kind}`);
    nameEl.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const commit = save => {
      if (done) return; done = true;
      const v = input.value.trim();
      if (save && v) { obj.name = v; db.put(store, obj); }
      renderProjects();
    };
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('dblclick', e => e.stopPropagation());
  }

  async function addProject(name = 'Untitled Project', rename = true, folderId = null) {
    const p = { id: uid(), name, createdAt: Date.now(), view: null, lastEdited: null, folderId };
    state.projects.push(p);
    await db.put('projects', p);
    const f = folderOf(p);
    if (f && !f.open) { f.open = true; db.put('folders', f); }
    openProject(p.id);
    if (rename) startRename('project', p.id);
    return p;
  }

  async function addFolder(withProjectId) {
    const f = { id: uid(), name: 'New Folder', createdAt: Date.now(), open: true };
    state.folders.push(f);
    await db.put('folders', f);
    if (withProjectId) await moveProject(withProjectId, f.id, false);
    renderProjects();
    startRename('folder', f.id);
  }

  async function moveProject(pid, folderId, render = true) {
    const p = state.projects.find(x => x.id === pid);
    if (!p || (p.folderId || null) === folderId) return;
    p.folderId = folderId;
    await db.put('projects', p);
    const f = folderOf(p);
    if (f && !f.open) { f.open = true; db.put('folders', f); }
    if (render) renderProjects();
  }

  async function deleteFolder(id) {
    const f = state.folders.find(x => x.id === id);
    const projs = state.projects.filter(p => p.folderId === id);
    const ok = await confirmDialog({
      title: `Delete folder “${f.name}”?`,
      body: projs.length ? `Its ${plural(projs.length, 'project')} will stay in your list, outside any folder.` : 'This folder is empty.',
      ok: 'Delete folder',
    });
    if (!ok) return;
    for (const p of projs) { p.folderId = null; await db.put('projects', p); }
    state.folders = state.folders.filter(x => x.id !== id);
    await db.del('folders', id);
    renderProjects();
  }

  async function deleteProject(id) {
    const p = state.projects.find(x => x.id === id);
    const n = itemCount(id);
    const ok = await confirmDialog({
      title: `Delete “${p.name}”?`,
      body: `${n ? `Its ${plural(n, 'item')} will be removed too. ` : ''}This can't be undone.`,
      ok: 'Delete project',
    });
    if (!ok) return;
    for (const it of state.items.filter(i => i.projectId === id)) await removeItem(it.id, false);
    state.projects = state.projects.filter(x => x.id !== id);
    await db.del('projects', id);
    if (!state.projects.length) return addProject('My First Project', false);
    if (state.current === id) openProject(state.projects[0].id);
    else renderProjects();
  }

  function openProject(id) {
    state.current = id;
    state.sel = new Set();
    try { localStorage.setItem('dot.current', id); } catch {}
    renderProjects();
    renderItems();
    syncHistoryButtons();
    const p = project();
    if (p.view) { view = { ...p.view }; applyView(); }
    else if (itemsHere().length) requestAnimationFrame(() => fitAll(false));
    else resetView();
  }

  /* ---------------- Collapsible sidebar ---------------- */
  const shell = $('.shell');
  // The projects panel floats over the canvas; the DOT button in the corner opens and closes it.
  function setCollapsed(v) {
    if (shell.classList.contains('collapsed') === v) return;
    shell.classList.toggle('collapsed', v);
    $('#dotBtn').setAttribute('aria-expanded', String(!v));
    fitToolbar();
  }
  // Move the toolbar aside only when the panel is tall enough to cover it.
  const panelEl = $('#panel'), toolbarEl = $('.toolbar');
  function fitToolbar() {
    const top = (shell.clientHeight - toolbarEl.offsetHeight) / 2;           // toolbar's resting position
    shell.classList.toggle('tb-aside', panelEl.offsetTop + panelEl.offsetHeight + 12 > top);
  }
  new ResizeObserver(fitToolbar).observe(panelEl);
  addEventListener('resize', fitToolbar);
  const togglePanel = () => setCollapsed(!shell.classList.contains('collapsed'));

  /* ---------------- Share a project as a link ---------------- */
  // A share is a frozen copy: project.json plus one file per uploaded image/video, under shares/<id>/.
  // Whoever opens the link gets their own copy of the project; nobody can change the original share.
  const shareOn = () => !!(SHARE.url && SHARE.key);
  const shareBase = () => SHARE.url.replace(/\/+$/, '') + '/storage/v1/object';
  const shareLink = id => location.origin + location.pathname + '#s=' + id;
  const shareId = () => { const a = crypto.getRandomValues(new Uint8Array(12)); return [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
  async function shareUpload(path, body, type) {
    const r = await fetch(`${shareBase()}/${SHARE.bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: SHARE.key, Authorization: `Bearer ${SHARE.key}`, 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'false' },
      body,
    });
    if (!r.ok) throw new Error(`Upload failed (${r.status}) ${await r.text().catch(() => '')}`.trim());
  }
  function shareModal(title, sub) {
    modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2></h2><p class="sub"></p><div class="share-body"></div><div class="actions"><button type="button" class="btn ghost" data-close>Close</button></div></div>`;
    modal.querySelector('h2').textContent = title;
    modal.querySelector('.sub').textContent = sub;
    modal.querySelector('[data-close]').onclick = closeModal;
    modal.hidden = false;
    return modal.querySelector('.share-body');
  }

  async function shareProject(pid) {
    const p = state.projects.find(x => x.id === pid);
    if (!p) return;
    if (!shareOn()) return toast("Sharing isn't set up yet");
    endEdit?.();
    const its = state.items.filter(i => i.projectId === pid);
    const body = shareModal(`Share “${p.name}”`, 'Anyone with the link can open a copy of this project. Changes you make later aren’t included. Share again to send an update.');
    body.innerHTML = '<div class="share-status">Uploading…</div>';
    const status = body.firstChild;
    const id = shareId();
    try {
      const files = its.filter(i => i.blob);
      let done = 0;
      const out = [];
      for (const it of its) {
        const { blob, projectId, ...rest } = it;
        if (blob) {
          status.textContent = `Uploading files… ${++done} of ${files.length}`;
          await shareUpload(`${id}/${it.id}`, blob, blob.type);
          rest.file = { path: it.id, type: blob.type, name: blob.name || it.name || '' };
        }
        out.push(rest);
      }
      status.textContent = 'Creating link…';
      const p0 = project()?.id === pid ? view : p.view;
      const manifest = { v: 1, name: p.name, view: p0 || null, sharedAt: Date.now(), items: out };
      await shareUpload(`${id}/project.json`, JSON.stringify(manifest), 'application/json');
      const link = shareLink(id);
      body.innerHTML = `<div class="share-link"><input class="field" readonly aria-label="Share link"><button type="button" class="btn primary">Copy link</button></div>`;
      const input = body.querySelector('input'), copy = body.querySelector('button');
      input.value = link;
      input.onclick = () => input.select();
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(link); } catch { input.select(); document.execCommand('copy'); }
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy link'; }, 1600);
      };
      copy.focus();
    } catch (err) {
      body.innerHTML = '<div class="err"></div>';
      body.firstChild.textContent = `Couldn't create the link. ${err.message || err}`;
    }
  }

  // Open a #s=<id> link: download the share and add it as a new project (once per share).
  async function openSharedFromHash() {
    const id = (location.hash.match(/^#s=([a-z0-9]{6,40})$/) || [])[1];
    if (!id || !appStarted) return false;
    history.replaceState(null, '', location.pathname + location.search);
    const existing = state.projects.find(p => p.sharedFrom === id);
    if (existing) { openProject(existing.id); toast(`Opened “${existing.name}”`); return true; }
    if (!shareOn()) { toast("Sharing isn't set up on this copy of DOT"); return false; }
    toast('Opening shared project…');
    try {
      const pub = `${shareBase()}/public/${SHARE.bucket}/${id}`;
      const r = await fetch(`${pub}/project.json`);
      if (!r.ok) throw new Error(r.status === 400 || r.status === 404 ? 'This link doesn’t exist or has been removed.' : `Download failed (${r.status}).`);
      const m = await r.json();
      const srcs = [];
      for (const it of m.items || []) {
        const { file, ...rest } = it;
        if (file) {
          const fr = await fetch(`${pub}/${file.path}`);
          if (!fr.ok) continue;
          const b = await fr.blob();
          rest.blob = new File([b], file.name || 'file', { type: file.type || b.type });
        }
        srcs.push(normalize(rest));
      }
      const p = { id: uid(), name: m.name || 'Shared project', createdAt: Date.now(), view: m.view || null, lastEdited: null, folderId: null, sharedFrom: id };
      state.projects.push(p);
      await db.put('projects', p);
      copyItemsTo(srcs, p.id);                         // fresh ids; arrows stay attached to the copied items
      openProject(p.id);
      toast(`Added “${p.name}” to your projects`);
      return true;
    } catch (err) {
      toast(`Couldn't open the shared project. ${err.message || ''}`.trim());
      return false;
    }
  }
  addEventListener('hashchange', openSharedFromHash);

  async function projectFromSelection() {
    const src = [...state.sel].map(itemById).filter(Boolean);
    if (!src.length) return;
    const cur = project();
    const p = { id: uid(), name: `${cur.name} — selection`, createdAt: Date.now(), view: null, lastEdited: null, folderId: folderOf(cur) ? cur.folderId : null };
    state.projects.push(p);
    await db.put('projects', p);
    copyItemsTo(src, p.id);
    renderProjects();
    toast(`Created “${p.name}” with ${plural(src.length, 'item')}`, { label: 'Open', action: () => openProject(p.id) });
  }

  /* ---------------- Undo / redo ---------------- */
  // Each project keeps its own history. A step is a snapshot of that project's items taken just
  // before a change; undo swaps the canvas back to it. Files (blobs) are shared, not copied.
  const HISTORY_LIMIT = 100;
  const histories = new Map();
  const hist = () => {
    let h = histories.get(state.current);
    if (!h) histories.set(state.current, h = { undo: [], redo: [] });
    return h;
  };
  const snapshot = () => itemsHere().map(cloneData);
  function record() {
    if (!state.current) return;
    const h = hist();
    h.undo.push(snapshot());
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    h.redo.length = 0;
    syncHistoryButtons();
  }
  // Record once, on the first real change of a gesture (so a click without a drag adds no step).
  const recorder = () => { let done = false; return () => { if (!done) { done = true; record(); } }; };
  const signature = it => JSON.stringify({ ...it, blob: undefined });

  function restore(snap) {
    const pid = state.current;
    const current = new Map(itemsHere().map(i => [i.id, i]));
    const next = new Map(snap.map(i => [i.id, i]));
    for (const id of current.keys()) {
      if (next.has(id)) continue;
      db.del('items', id);
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    }
    const restored = snap.map(cloneData);
    for (const it of restored) {
      const was = current.get(it.id);
      if (!was || signature(was) !== signature(it)) db.put('items', it);
    }
    state.items = state.items.filter(i => i.projectId !== pid).concat(restored);
    state.sel = new Set([...state.sel].filter(id => next.has(id)));
    renderItems();
    renderProjects();
  }
  function undo() {
    endEdit?.();
    const h = hist();
    if (!h.undo.length) return toast('Nothing to undo');
    h.redo.push(snapshot());
    restore(h.undo.pop());
    syncHistoryButtons();
  }
  function redo() {
    endEdit?.();
    const h = hist();
    if (!h.redo.length) return toast('Nothing to redo');
    h.undo.push(snapshot());
    restore(h.redo.pop());
    syncHistoryButtons();
  }
  function syncHistoryButtons() {
    const h = state.current ? hist() : { undo: [], redo: [] };
    $('#undoBtn').classList.toggle('disabled', !h.undo.length);
    $('#redoBtn').classList.toggle('disabled', !h.redo.length);
  }

  /* ---------------- Items ---------------- */
  function renderItems() {
    world.innerHTML = '';
    const its = itemsHere().sort((a, b) => (a.z || 0) - (b.z || 0));
    state.topZ = Math.max(1, ...its.map(i => i.z || 0));
    its.forEach(it => world.append(itemEl(it)));
    its.filter(i => i.kind === 'line').forEach(ln => drawLine(elOf(ln.id), ln));
    syncSel();
  }

  function place(el, it) {
    if (it.kind === 'line') { el.style.zIndex = it.z || 0; return drawLine(el, it); }
    el.style.left = it.x + 'px';
    el.style.top = it.y + 'px';
    el.style.width = it.w + 'px';
    if (it.kind !== 'text') el.style.height = it.h + 'px';
    el.style.zIndex = it.z || 0;
    el.style.transform = it.rot ? `rotate(${it.rot}deg)` : '';
    const ig = el.querySelector('iframe.ig');
    if (ig) { ig.style.transform = `scale(${it.w / IG_W})`; ig.style.height = Math.round(it.h * IG_W / it.w) + 'px'; }
    refreshLinesFor(it.id);
    if (state.sel.has(it.id)) queueGroupBox();
  }

  /* ---------------- Group box: scale several selected items from one corner ---------------- */
  // Axis-aligned world box around an item, rotation included.
  function aabb(it) {
    const b = bounds(it);
    if (it.kind === 'line' || !it.rot) return b;
    const th = it.rot * Math.PI / 180, c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
    const w = b.w * c + b.h * s, h = b.w * s + b.h * c;
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
  }
  function groupAabb(its) {
    const bx = its.map(aabb);
    const x = Math.min(...bx.map(b => b.x)), y = Math.min(...bx.map(b => b.y));
    return { x, y, w: Math.max(...bx.map(b => b.x + b.w)) - x, h: Math.max(...bx.map(b => b.y + b.h)) - y };
  }
  let groupQueued = false;
  function queueGroupBox() {
    if (groupQueued) return;
    groupQueued = true;
    requestAnimationFrame(() => { groupQueued = false; updateGroupBox(); });
  }
  function updateGroupBox() {
    let gb = world.querySelector('.group-box');
    const its = selectedItems();
    renderSelbar(its);
    if (its.length < 2) { gb?.remove(); return; }
    if (!gb) {
      gb = document.createElement('div');
      gb.className = 'group-box';
      gb.innerHTML = `<div class="handle group-handle" title="Drag to scale the selection · Shift snaps to the dots">${I.resize}</div><div class="lock-btn" title="Lock / unlock position  ⇧⌘L">${I.unlock}${I.lock}</div>`;
      world.append(gb);
    }
    gb.classList.toggle('locked', its.every(i => i.locked));
    const G = groupAabb(its);
    Object.assign(gb.style, { left: G.x + 'px', top: G.y + 'px', width: G.w + 'px', height: G.h + 'px' });
  }

  /* ---------------- Smart guides: edges and centres line up with other items ---------------- */
  const SNAP_PX = 6;                     // on-screen reach of a guide
  const busy = on => stage.classList.toggle('busy', on);   // hides the selection bar during a gesture
  function guideLines(exclude) {
    const xs = [], ys = [];
    for (const it of itemsHere()) {
      if (exclude.has(it.id) || it.kind === 'line') continue;
      const b = aabb(it);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs, ys };
  }
  // Smallest shift that puts one of `vals` on a guide line, or null when none is within reach.
  function nearest(vals, list) {
    const reach = SNAP_PX / view.z;
    let best = null;
    for (const v of vals) for (const l of list) {
      const d = l - v;
      if (Math.abs(d) <= reach && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    return best;
  }
  function clearGuides() { world.querySelectorAll('.guide').forEach(g => g.remove()); }
  // Draw every guide line that one of the (already snapped) values now sits exactly on.
  function showGuides(X, Y, lines) {
    clearGuides();
    const r = rect(), a = toWorld(r.left, r.top), b = toWorld(r.right, r.bottom);
    const hit = (vals, list) => [...new Set(list.filter(l => vals.some(v => Math.abs(l - v) < 0.5)).map(l => Math.round(l * 100) / 100))];
    for (const x of hit(X, lines.xs)) world.insertAdjacentHTML('beforeend', `<div class="guide gv" style="left:${x}px;top:${a.y}px;height:${b.y - a.y}px"></div>`);
    for (const y of hit(Y, lines.ys)) world.insertAdjacentHTML('beforeend', `<div class="guide gh" style="top:${y}px;left:${a.x}px;width:${b.x - a.x}px"></div>`);
  }

  /* ---------------- Lock, align, distribute ---------------- */
  function toggleLock(ids = [...state.sel]) {
    const its = ids.map(itemById).filter(Boolean);
    if (!its.length) return;
    const on = !its.every(i => i.locked);
    record();
    for (const it of its) {
      if (on) it.locked = true; else delete it.locked;
      elOf(it.id)?.classList.toggle('locked', on);
      db.put('items', it);
    }
    syncSel();
    toast(on ? `Locked ${its.length > 1 ? plural(its.length, 'item') : 'in place'}` : `Unlocked ${its.length > 1 ? plural(its.length, 'item') : ''}`.trim());
  }
  // Move an item by (dx, dy): lines move their free ends, attached ends follow their items.
  function shiftItem(it, dx, dy) {
    if (!dx && !dy) return;
    const r = v => Math.round(v * 100) / 100;
    if (it.kind === 'line') { for (const k of ['a', 'b']) if (!it[k].attach) { it[k].x = r(it[k].x + dx); it[k].y = r(it[k].y + dy); } }
    else { it.x = r(it.x + dx); it.y = r(it.y + dy); }
    const el = elOf(it.id);
    if (el) place(el, it);
    db.put('items', it);
  }
  // What one item lines up against: the smallest item under it that holds it whole, else the visible canvas.
  function alignTarget(it) {
    const b = aabb(it);
    const holder = itemsHere()
      .filter(o => o.id !== it.id && o.kind !== 'line' && (o.z || 0) < (it.z || 0))
      .map(aabb)
      .filter(c => c.x <= b.x + .5 && c.y <= b.y + .5 && c.x + c.w >= b.x + b.w - .5 && c.y + c.h >= b.y + b.h - .5)
      .sort((p, q) => p.w * p.h - q.w * q.h)[0];
    if (holder) return holder;
    const r = rect(), pad = 72, a = toWorld(r.left + pad, r.top + pad), c = toWorld(r.right - pad, r.bottom - pad);
    return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y };
  }
  const ALIGN = {
    left:    { label: 'Align left',      icon: 'aL', key: 'A', f: (b, R) => [R.x - b.x, 0] },
    hcenter: { label: 'Align centres',   icon: 'aC', key: 'H', f: (b, R) => [R.x + R.w / 2 - (b.x + b.w / 2), 0] },
    right:   { label: 'Align right',     icon: 'aR', key: 'D', f: (b, R) => [R.x + R.w - (b.x + b.w), 0] },
    top:     { label: 'Align top',       icon: 'aT', key: 'W', f: (b, R) => [0, R.y - b.y] },
    middle:  { label: 'Align middles',   icon: 'aM', key: 'V', f: (b, R) => [0, R.y + R.h / 2 - (b.y + b.h / 2)] },
    bottom:  { label: 'Align bottom',    icon: 'aB', key: 'S', f: (b, R) => [0, R.y + R.h - (b.y + b.h)] },
  };
  function alignSelected(mode) {
    const its = selectedItems();
    const movers = its.filter(i => !i.locked);
    if (!its.length) return;
    if (!movers.length) return toast('Locked — unlock to move');
    // Several items line up with each other (locked ones stay put and set the line); one item lines up with what holds it.
    const locked = its.filter(i => i.locked);
    const R = its.length > 1 ? groupAabb(locked.length ? locked : its) : alignTarget(its[0]);
    record();
    for (const it of movers) { const [dx, dy] = ALIGN[mode].f(aabb(it), R); shiftItem(it, dx, dy); }
    touch(movers[movers.length - 1].id);
    queueGroupBox();
  }
  // Equal gaps between items, from the first to the last along the axis.
  function distribute(axis) {
    const its = selectedItems();
    if (its.length < 3) return;
    const X = axis === 'x', pos = b => X ? b.x : b.y, size = b => X ? b.w : b.h;
    const bs = its.map(it => ({ it, b: aabb(it) })).sort((p, q) => pos(p.b) + size(p.b) / 2 - pos(q.b) - size(q.b) / 2);
    const first = bs[0].b, last = bs[bs.length - 1].b;
    const gap = (pos(last) + size(last) - pos(first) - bs.reduce((t, p) => t + size(p.b), 0)) / (bs.length - 1);
    record();
    let at = pos(first);
    for (const { it, b } of bs) {
      if (!it.locked) shiftItem(it, X ? at - b.x : 0, X ? 0 : at - b.y);
      at += size(b) + gap;
    }
    touch(bs[bs.length - 1].it.id);
    queueGroupBox();
  }

  /* ---------------- Selection bar: quick actions above whatever is selected ---------------- */
  const selbar = $('#selbar');
  let selbarSig = '';
  function renderSelbar(its = selectedItems()) {
    if (!its.length || stage.classList.contains('editing-text')) { selbar.hidden = true; selbarSig = ''; return; }
    const n = its.length, allLocked = its.every(i => i.locked);
    const sig = `${n > 2 ? 3 : n}:${allLocked}`;
    if (sig !== selbarSig) {
      selbarSig = sig;
      const to = n > 1 ? '' : ' (to the shape under it, or the view)';
      const b = (act, icon, title, cls = '') => `<button class="sb${cls}" data-act="${act}" title="${title}" aria-label="${title.split('  ')[0]}">${icon}</button>`;
      selbar.innerHTML = [
        ...Object.entries(ALIGN).map(([k, a]) => b(k, I[a.icon], `${a.label}${to}  ⌥${a.key}`)),
        ...(n > 2 ? ['<span class="sb-sep"></span>', b('distX', I.distH, 'Space evenly across'), b('distY', I.distV, 'Space evenly down')] : []),
        '<span class="sb-sep"></span>',
        b('lock', allLocked ? I.lock : I.unlock, allLocked ? 'Unlock  ⇧⌘L' : 'Lock position  ⇧⌘L', allLocked ? ' on' : ''),
        b('front', I.front, 'Bring to front  ]'),
        b('back', I.back, 'Send to back  ['),
        '<span class="sb-sep"></span>',
        b('dup', I.duplicate, 'Duplicate  ⌘D'),
        b('del', I.trash, 'Delete  ⌫'),
        b('more', I.more, 'More options'),
      ].join('');
    }
    selbar.hidden = false;
    // Sit centred above the selection; drop below it when there's no room, and stay on screen.
    const G = groupAabb(its), r = rect();
    const x1 = view.x + G.x * view.z, y1 = view.y + G.y * view.z, x2 = x1 + G.w * view.z, y2 = y1 + G.h * view.z;
    const bw = selbar.offsetWidth, bh = selbar.offsetHeight, top0 = 70;
    let top = y1 - bh - 22;
    if (top < top0) top = y2 + 26;
    if (top > r.height - bh - 74) top = clamp(y1 - bh - 22, top0, r.height - bh - 74);
    selbar.style.left = clamp((x1 + x2) / 2 - bw / 2, 12, Math.max(12, r.width - bw - 12)) + 'px';
    selbar.style.top = top + 'px';
  }
  selbar.addEventListener('pointerdown', e => e.stopPropagation());
  selbar.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (ALIGN[a]) return alignSelected(a);
    if (a === 'distX' || a === 'distY') return distribute(a === 'distX' ? 'x' : 'y');
    if (a === 'lock') return toggleLock();
    if (a === 'front' || a === 'back') { record(); return (a === 'front' ? bringToFront : sendToBack)([...state.sel]); }
    if (a === 'dup') return duplicate();
    if (a === 'del') return removeSelected();
    if (a === 'more') { const r = b.getBoundingClientRect(); openCtx(r.left, r.bottom + 8, selectionEntries()); }
  });

  /* ---------------- Lines / arrows ---------------- */
  const LINE_GAP = 6;                    // space between an attached end and the item's edge
  const HEAD = 13;                       // arrowhead length (world units)

  // An attached end sits on the item's centre before clipping; a free end is wherever it was put.
  function endPoint(it, k) {
    const end = it[k];
    const t = end.attach && itemById(end.attach);
    if (t && t.projectId === it.projectId && t.kind !== 'line') {
      const el = elOf(t.id);
      const h = t.kind === 'text' ? (el ? el.offsetHeight - 8 : 60) : t.h;
      return { x: t.x + t.w / 2, y: t.y + h / 2, item: t, w: t.w, h };
    }
    return { x: end.x, y: end.y };
  }
  // Pull an attached end from the item's centre out to its edge, aiming at `toward`.
  function clipToItem(P, toward) {
    const th = -(P.item.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const vx = toward.x - P.x, vy = toward.y - P.y;
    const lx = vx * cos - vy * sin, ly = vx * sin + vy * cos;
    if (!lx && !ly) return P;
    const hw = P.w / 2 + LINE_GAP, hh = P.h / 2 + LINE_GAP;
    const k = Math.min(lx ? hw / Math.abs(lx) : Infinity, ly ? hh / Math.abs(ly) : Infinity);
    if (k >= 1) return P;
    return { x: P.x + vx * k, y: P.y + vy * k, item: P.item };
  }
  // Quadratic curve through A, M (the middle handle) and B. bend = {t, d}: M's position along and across the A→B chord.
  function lineGeom(it) {
    let A = endPoint(it, 'a'), B = endPoint(it, 'b');
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / L, y: dx / L };
    const { t, d } = it.bend;
    let M = { x: A.x + dx * t + n.x * d * L, y: A.y + dy * t + n.y * d * L };
    let C = { x: 2 * M.x - (A.x + B.x) / 2, y: 2 * M.y - (A.y + B.y) / 2 };
    if (A.item) A = clipToItem(A, C);
    if (B.item) B = clipToItem(B, C);
    if (!d) M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };       // straight: keep the handle centred
    C = { x: 2 * M.x - (A.x + B.x) / 2, y: 2 * M.y - (A.y + B.y) / 2 };
    return { A, B, M, C };
  }
  function drawLine(el, it) {
    const g = lineGeom(it);
    // Remember where attached ends actually are, so copies and detaching keep the same spot.
    for (const [k, P] of [['a', g.A], ['b', g.B]]) if (it[k].attach) { it[k].x = Math.round(P.x); it[k].y = Math.round(P.y); }
    const unit = (from, to) => { const vx = to.x - from.x, vy = to.y - from.y, l = Math.hypot(vx, vy) || 1; return { x: vx / l, y: vy / l }; };
    const head = (tip, dir) => {
      const bx = tip.x - dir.x * HEAD, by = tip.y - dir.y * HEAD, px = -dir.y * HEAD * 0.45, py = dir.x * HEAD * 0.45;
      return `M${tip.x},${tip.y} L${bx + px},${by + py} L${bx - px},${by - py} Z`;
    };
    const near = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y) < 1;
    const dB = unit(near(g.C, g.B) ? g.A : g.C, g.B), dA = unit(near(g.C, g.A) ? g.B : g.C, g.A);
    const endB = it.arrow !== 'none', endA = it.arrow === 'both';
    const B2 = endB ? { x: g.B.x - dB.x * HEAD * 0.7, y: g.B.y - dB.y * HEAD * 0.7 } : g.B;
    const A2 = endA ? { x: g.A.x - dA.x * HEAD * 0.7, y: g.A.y - dA.y * HEAD * 0.7 } : g.A;
    const d = `M${A2.x},${A2.y} Q${g.C.x},${g.C.y} ${B2.x},${B2.y}`;
    el.querySelector('.hit').setAttribute('d', `M${g.A.x},${g.A.y} Q${g.C.x},${g.C.y} ${g.B.x},${g.B.y}`);
    el.querySelector('.stroke').setAttribute('d', d);
    el.querySelector('.head-b').setAttribute('d', endB ? head(g.B, dB) : '');
    el.querySelector('.head-a').setAttribute('d', endA ? head(g.A, dA) : '');
    for (const [k, P] of [['a', g.A], ['m', g.M], ['b', g.B]]) {
      const h = el.querySelector(`.lh[data-end="${k}"]`);
      h.style.left = P.x + 'px'; h.style.top = P.y + 'px';
      if (k !== 'm') h.classList.toggle('attached', !!it[k].attach);
    }
  }
  function refreshLinesFor(id) {
    for (const ln of state.items) {
      if (ln.kind !== 'line' || (ln.a.attach !== id && ln.b.attach !== id)) continue;
      const el = elOf(ln.id);
      if (el) drawLine(el, ln);
    }
  }
  // Topmost image/video/text under a world point (rotation aware).
  function itemAt(p, excludeId) {
    const its = itemsHere().filter(i => i.kind !== 'line' && i.id !== excludeId).sort((a, b) => (b.z || 0) - (a.z || 0));
    for (const t of its) {
      const b = bounds(t), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const th = -(t.rot || 0) * Math.PI / 180;
      const vx = p.x - cx, vy = p.y - cy;
      const lx = vx * Math.cos(th) - vy * Math.sin(th), ly = vx * Math.sin(th) + vy * Math.cos(th);
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return t;
    }
    return null;
  }
  let linkTargetEl = null;
  function setLinkTarget(t) {
    const el = t ? elOf(t.id) : null;
    if (el === linkTargetEl) return;
    linkTargetEl?.classList.remove('link-target');
    linkTargetEl = el;
    el?.classList.add('link-target');
  }
  const normDeg = d => { d = ((d % 360) + 540) % 360 - 180; return d === -180 ? 180 : Math.round(d * 10) / 10; };

  // Lock the card to the media's real aspect ratio (width stays, height follows).
  function setRatio(it, el, ar) {
    if (!ar || !isFinite(ar)) return;
    if (it.ar && Math.abs(it.ar - ar) < 0.002) return;
    it.ar = ar;
    it.h = Math.round(it.w / ar);
    place(el, it);
    db.put('items', it);
  }

  function itemEl(it) {
    const el = document.createElement('div');
    el.dataset.id = it.id;

    if (it.kind === 'line') {
      el.className = 'item line' + (it.locked ? ' locked' : '');
      el.innerHTML = `<svg class="lsvg" aria-hidden="true"><path class="hit"/><path class="stroke"/><path class="head head-b"/><path class="head head-a"/></svg>
        <div class="lh" data-end="a" title="Drag onto an item to attach"></div><div class="lh lh-mid" data-end="m" title="Drag to curve"></div><div class="lh" data-end="b" title="Drag onto an item to attach"></div>`;
      place(el, it);
      return el;
    }

    if (it.kind === 'text') {
      el.className = `item text t-${it.variant} ts-${it.tstyle || 'dark'}${it.todo ? ' todo' : ''}`;
      const t = document.createElement('div');
      t.className = 'txt';
      t.dataset.ph = TEXT[it.variant].ph;
      el.style.textAlign = it.align || 'left';
      renderText(t, it);
      t.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'Escape' || (ev.key === 'Enter' && it.variant !== 'paragraph' && !it.todo && !ev.shiftKey)) { ev.preventDefault(); endEdit?.(); }
      });
      el.append(t);
    } else if (it.kind === 'shape') {
      el.className = 'item shape';
      el.innerHTML = shapeSvg(it.shape, SHAPE_FILLS[it.fill] || SHAPE_FILLS.grey, 'shape-svg');
    } else {
      el.className = 'item card';
      el.title = it.name || '';
      const media = document.createElement('div');
      media.className = 'media';
      const placeholder = (title, sub) => {
        const ph = document.createElement('div');
        ph.className = 'ph';
        ph.innerHTML = `<div style="width:28px;height:28px">${it.kind === 'video' ? I.video : I.image}</div><b></b><span></span>`;
        ph.querySelector('b').textContent = title;
        ph.querySelector('span').textContent = sub || '';
        return ph;
      };

      const ig = !it.blob && igCode(it.url);
      if (ig) {
        const fr = document.createElement('iframe');
        fr.className = 'ig';
        fr.title = 'Instagram post';
        fr.setAttribute('scrolling', 'no');
        fr.style.width = IG_W + 'px';
        fr.src = `https://www.instagram.com/p/${ig}/embed/`;
        media.append(fr);
      } else if (it.kind === 'image') {
        const img = new Image();
        img.draggable = false;
        img.onload = () => setRatio(it, el, img.naturalWidth / img.naturalHeight);
        img.onerror = () => { img.remove(); media.append(placeholder("Couldn't load image", hostOf(it.url))); };
        img.src = srcOf(it);
        media.append(img);
      } else {
        const v = it.blob ? { provider: 'file' } : parseVideo(it.url) || { provider: 'link' };
        if (v.provider === 'file') {
          const vid = document.createElement('video');
          vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'metadata';
          vid.onloadedmetadata = () => setRatio(it, el, vid.videoWidth / vid.videoHeight);
          vid.onerror = () => { vid.remove(); media.prepend(placeholder("Couldn't load video", hostOf(it.url))); };
          vid.src = srcOf(it) + '#t=0.1';
          el.addEventListener('pointerenter', () => { vid.play().then(() => el.classList.add('is-playing')).catch(() => {}); });
          el.addEventListener('pointerleave', () => { vid.pause(); el.classList.remove('is-playing'); });
          media.append(vid);
        } else {
          if (v.ar) setTimeout(() => setRatio(it, el, v.ar));
          if (v.thumb) {
            const img = new Image();
            img.draggable = false;
            img.onerror = () => { img.remove(); media.prepend(placeholder(v.provider, 'Double-click to open')); };
            img.src = v.thumb;
            media.append(img);
          } else media.append(placeholder(v.provider, 'Double-click to open'));
        }
        const play = document.createElement('div');
        play.className = 'play';
        play.innerHTML = I.play;
        media.append(play);
      }
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = ig ? 'Instagram' : it.kind === 'image' ? (it.blob ? 'Image' : 'Image link') : (it.blob ? 'Video' : 'Video link');
      el.append(media, badge);
    }

    // Bottom-right resizes, top-right rotates.
    const h = document.createElement('div');
    h.className = 'handle h-se';
    h.dataset.corner = 'se';
    h.title = 'Drag to resize · Shift snaps to the dots';
    h.innerHTML = I.resize;
    const rh = document.createElement('div');
    rh.className = 'rot-handle';
    rh.title = 'Drag to rotate · Shift for 15° steps';
    rh.innerHTML = I.rotate;
    // Bottom-left: lock the item in place (shown when selected, or on hover once locked).
    const lk = document.createElement('div');
    lk.className = 'lock-btn';
    lk.title = 'Lock / unlock position  ⇧⌘L';
    lk.innerHTML = I.unlock + I.lock;
    el.append(h, rh, lk);
    el.classList.toggle('locked', !!it.locked);
    place(el, it);
    return el;
  }

  async function addItem(data, at) {
    record();
    const it = normalize({ id: uid(), projectId: state.current, createdAt: Date.now(), z: ++state.topZ, blob: null, url: null, name: '', ...data });
    if (it.kind === 'text') { it.x = Math.round(at.x); it.y = Math.round(at.y); }
    else { it.x = Math.round(at.x - it.w / 2); it.y = Math.round(at.y - it.h / 2); }
    state.items.push(it);
    await db.put('items', it);
    const el = itemEl(it);
    world.append(el);
    setSelection([it.id]);
    touch(it.id);
    renderProjects();
    return { it, el };
  }

  async function removeItem(id, rerender = true) {
    for (const ln of state.items) {
      if (ln.kind !== 'line' || ln.id === id) continue;
      let hit = false;
      for (const k of ['a', 'b']) if (ln[k].attach === id) { delete ln[k].attach; hit = true; }
      if (hit) { db.put('items', ln); const e = elOf(ln.id); if (e) drawLine(e, ln); }
    }
    state.items = state.items.filter(i => i.id !== id);
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    await db.del('items', id);
    state.sel.delete(id);
    if (rerender) { elOf(id)?.remove(); syncSel(); renderProjects(); }
  }
  async function removeSelected() {
    const ids = [...state.sel].filter(id => !itemById(id)?.locked);
    if (ids.length < state.sel.size) toast(ids.length ? 'Locked items were kept — unlock them to delete' : 'Locked — unlock it to delete');
    if (ids.length) record();
    for (const id of ids) await removeItem(id);
  }

  function setSelection(ids) { state.sel = new Set(ids); syncSel(); }
  function syncSel() {
    world.querySelectorAll('.item').forEach(el => el.classList.toggle('selected', state.sel.has(el.dataset.id)));
    world.classList.toggle('multi', state.sel.size > 1);
    world.classList.toggle('has-locked', selectedItems().some(i => i.locked));
    updateGroupBox();
  }

  function bringToFront(ids) {
    ids.map(itemById).filter(Boolean).sort((a, b) => (a.z || 0) - (b.z || 0)).forEach(it => {
      if ((it.z || 0) === state.topZ && ids.length === 1) return;
      it.z = ++state.topZ;
      const el = elOf(it.id);
      if (el) el.style.zIndex = it.z;
      db.put('items', it);
    });
  }

  // Restack the board so the given items sit under everything else (keeping their own order).
  function sendToBack(ids) {
    const pick = new Set(ids);
    const all = itemsHere().sort((a, b) => (a.z || 0) - (b.z || 0));
    [...all.filter(i => pick.has(i.id)), ...all.filter(i => !pick.has(i.id))].forEach((it, n) => {
      if (it.z === n + 1) return;
      it.z = n + 1;
      const el = elOf(it.id);
      if (el) el.style.zIndex = it.z;
      db.put('items', it);
    });
    state.topZ = Math.max(1, all.length);
  }

  /* ---------------- Duplicate / copy / paste ---------------- */
  let clipboard = [];                    // snapshots of copied items (blob files included)
  let clipStamp = '';                    // marker written to the system clipboard on copy
  let pointer = null;                    // last cursor position over the canvas
  let lastPaste = { key: '', n: 0 };
  canvas.addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  const selectedItems = () => [...state.sel].map(itemById).filter(Boolean);
  const viewCenter = () => { const r = rect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };

  // Every copy is a full, independent item: uploaded files are stored again with the copy.
  // Synchronous so Option/Alt-drag can swap to the copies mid-gesture; saving happens in the background.
  // Lines whose ends point at items copied in the same batch are re-pointed at the copies.
  function copyItemsTo(srcs, projectId, dx = 0, dy = 0) {
    const ordered = [...srcs].sort((a, b) => (a.z || 0) - (b.z || 0));
    const idMap = new Map(ordered.map(s => [s.id, uid()]));
    const made = ordered.map(src => {
      const it = { ...cloneData(src), id: idMap.get(src.id), projectId, createdAt: Date.now(), z: ++state.topZ };
      if (it.kind === 'line') {
        for (const k of ['a', 'b']) {
          const end = it[k];
          if (end.attach && idMap.has(end.attach)) { end.attach = idMap.get(end.attach); continue; }
          const t = end.attach && itemById(end.attach);
          if (end.attach && !(t && t.projectId === projectId)) delete end.attach;
          if (!end.attach) { end.x = Math.round(end.x + dx); end.y = Math.round(end.y + dy); }
        }
      } else { it.x = Math.round(src.x + dx); it.y = Math.round(src.y + dy); }
      state.items.push(it);
      db.put('items', it);
      return it;
    });
    if (projectId === state.current) {
      made.forEach(it => world.append(itemEl(it)));
      made.filter(i => i.kind === 'line').forEach(ln => drawLine(elOf(ln.id), ln));
    }
    return made;
  }
  const makeClones = (srcs, dx = 0, dy = 0) => copyItemsTo(srcs, state.current, dx, dy);
  async function cloneItems(srcs, dx, dy) {
    record();
    const made = makeClones(srcs, dx, dy);
    setSelection(made.map(i => i.id));
    if (made.length) touch(made[made.length - 1].id);
    renderProjects();
    return made;
  }

  function duplicate() {
    const s = selectedItems();
    if (s.length) cloneItems(s, GRID / view.z, GRID / view.z);
  }
  function copySelection(quiet) {
    const s = selectedItems();
    if (!s.length) return false;
    clipboard = s.map(cloneData);
    lastPaste = { key: '', n: 0 };
    if (!quiet) toast(`Copied ${plural(s.length, 'item')} — ⌘V to paste`);
    return true;
  }
  // Paste keeps the group's layout and centres it on `at` (cursor, right-click point or view centre).
  function pasteAt(at) {
    if (!clipboard.length) return;
    const bx = clipboard.map(bounds);
    const cx = (Math.min(...bx.map(b => b.x)) + Math.max(...bx.map(b => b.x + b.w))) / 2;
    const cy = (Math.min(...bx.map(b => b.y)) + Math.max(...bx.map(b => b.y + b.h))) / 2;
    const key = `${state.current}:${Math.round(at.x)}:${Math.round(at.y)}`;
    lastPaste = key === lastPaste.key ? { key, n: lastPaste.n + 1 } : { key, n: 0 };
    const step = lastPaste.n * GRID / view.z;            // repeated pastes on the same spot cascade
    cloneItems(clipboard, at.x - cx + step, at.y - cy + step);
  }
  const pastePoint = () => pointer ? toWorld(pointer.x, pointer.y) : viewCenter();

  document.addEventListener('copy', e => {
    if (typing(e.target) || !modal.hidden || getSelection().toString()) return;
    if (!copySelection()) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', clipStamp = 'dot-items:' + uid());
  });
  document.addEventListener('cut', e => {
    if (typing(e.target) || !modal.hidden || getSelection().toString()) return;
    if (!copySelection(true)) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', clipStamp = 'dot-items:' + uid());
    toast(`Cut ${plural(clipboard.length, 'item')} — ⌘V to paste`);
    removeSelected();
  });
  document.addEventListener('paste', e => {
    if (typing(e.target) || !modal.hidden || !lb.hidden) return;
    const dt = e.clipboardData;
    const text = (dt.getData('text/plain') || '').trim();
    const at = pastePoint();
    if (clipboard.length && text === clipStamp) { e.preventDefault(); return pasteAt(at); }
    // Files from outside DOT (e.g. a copied screenshot or image)
    const files = [...dt.files].filter(f => /^(image|video)\//.test(f.type));
    if (files.length) {
      e.preventDefault();
      files.forEach((f, i) => addItem({ kind: f.type.split('/')[0], blob: f, name: f.name || 'Pasted image' }, { x: at.x + i * (BASE_W + 24), y: at.y }));
      return;
    }
    // A pasted link to an image or video
    if (isHttpUrl(text)) {
      if (pinId(text)) {
        e.preventDefault();
        pinImage(pinId(text)).then(loadFirst).then(img => addItem({ kind: 'image', url: img.src, name: text }, at)).catch(() => toast("Couldn't get that pin's image"));
        return;
      }
      if (igCode(text)) { e.preventDefault(); return addItem({ kind: /\/(reels?|tv)\//.test(text) ? 'video' : 'image', url: text, name: text }, at); }
      const v = parseVideo(text);
      if (v && (v.provider === 'YouTube' || v.provider === 'Vimeo' || v.provider === 'file')) { e.preventDefault(); return addItem({ kind: 'video', url: text, name: text }, at); }
      if (/\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(text)) { e.preventDefault(); return addItem({ kind: 'image', url: text, name: text }, at); }
    }
    if (clipboard.length && !text) { e.preventDefault(); pasteAt(at); }
  });

  /* ---------------- Text editing ---------------- */
  let endEdit = null;                    // finishes the text edit in progress, if any
  // A to-do text shows one tickable row per line; otherwise it's plain text.
  const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
  function renderText(t, it) {
    t.closest('.item')?.classList.toggle('todo', !!it.todo);
    if (!it.todo) { t.textContent = it.text || ''; return; }
    t.textContent = '';
    (it.text || '').split('\n').forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'todo-row';
      row.style.justifyContent = JUSTIFY[it.align || 'left'];
      if (line.trim()) {
        row.dataset.i = i;
        row.classList.toggle('done', !!it.done?.[i]);
        row.innerHTML = '<span class="todo-box" role="checkbox"><svg viewBox="0 0 12 12"><path d="m2.6 6.2 2.3 2.3 4.5-4.9"/></svg></span><span class="todo-text"></span>';
        row.lastChild.textContent = line;
      } else row.innerHTML = '&nbsp;';
      t.append(row);
    });
  }
  function toggleTodo(it, i) {
    record();
    const done = [...(it.done || [])];
    done[i] = !done[i];
    it.done = done;
    db.put('items', it);
    elOf(it.id)?.querySelector(`.todo-row[data-i="${i}"]`)?.classList.toggle('done', done[i]);
    touch(it.id);
  }
  // After editing, keep ticks on the lines that are still there.
  function remapDone(it, oldText, newText) {
    if (!it.done) return;
    const ticked = [];
    (oldText || '').split('\n').forEach((l, i) => { if (it.done[i]) ticked.push(l); });
    it.done = newText.split('\n').map(l => { const k = ticked.indexOf(l); if (k < 0) return false; ticked.splice(k, 1); return true; });
  }

  function startEdit(it, el, fresh = false) {
    if (endEdit) endEdit();
    const t = el.querySelector('.txt');
    if (it.todo) t.textContent = it.text || '';
    try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
    el.classList.add('editing');
    stage.classList.add('editing-text'); renderSelbar();
    t.focus();
    const range = document.createRange();
    range.selectNodeContents(t);
    const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    const done = () => {
      if (endEdit !== done) return;
      endEdit = null;
      t.removeEventListener('blur', done);
      if (document.activeElement === t) t.blur();
      getSelection().removeAllRanges();
      t.contentEditable = 'false';
      el.classList.remove('editing');
      stage.classList.remove('editing-text'); queueGroupBox();
      const v = t.innerText.replace(/\s+$/, '').replace(/^\s+/, '');
      if (!v) {
        if (fresh) { hist().undo.pop(); syncHistoryButtons(); }   // an abandoned new text box leaves no step behind
        else record();
        removeItem(it.id);
        return;
      }
      if (v !== it.text) { if (!fresh) record(); remapDone(it, it.text, v); it.text = v; db.put('items', it); }
      renderText(t, it);
      touch(it.id);
    };
    endEdit = done;
    t.addEventListener('blur', done);
  }

  /* ---------------- Pointer: move, resize, marquee, pan ---------------- */
  const panning = () => state.tool === 'hand' || state.space;

  world.addEventListener('pointerdown', e => {
    if (e.target.isContentEditable) { e.stopPropagation(); return; }   // caret placement while editing text
    const lk = e.target.closest('.lock-btn');
    if (lk && e.button === 0 && !panning()) {
      e.stopPropagation(); closeCtx(); endEdit?.();
      const id = lk.closest('.group-box') ? null : lk.closest('.item').dataset.id;
      return toggleLock(id && !state.sel.has(id) ? [id] : [...state.sel]);
    }
    if (e.target.closest('.group-handle') && e.button === 0 && !panning()) {
      e.stopPropagation(); closeCtx(); endEdit?.();
      return startGroupResize(e, e.target.closest('.group-handle'));
    }
    const box = e.target.closest('.todo-box');
    if (box && e.button === 0 && !panning() && state.tool !== 'line') {   // tick a to-do line without selecting or moving
      e.stopPropagation(); closeCtx(); endEdit?.();
      return toggleTodo(itemById(box.closest('.item').dataset.id), +box.parentElement.dataset.i);
    }
    const el = e.target.closest('.item');
    if (!el || e.button !== 0 || panning() || state.tool === 'line') return;   // hand/line tool: the canvas handles it
    e.stopPropagation();
    closeCtx();
    endEdit?.();
    const it = itemById(el.dataset.id);
    if (it.locked) {                                       // locked: stays put; dragging on it selects around it
      if (e.shiftKey) { state.sel.has(it.id) ? state.sel.delete(it.id) : state.sel.add(it.id); return syncSel(); }
      return startMarquee(e, it.id);
    }
    const lh = e.target.closest('.lh');
    if (lh) { setSelection([it.id]); return startLineHandle(e, el, it, lh.dataset.end); }
    if (e.target.closest('.rot-handle')) return startRotate(e, el, it);
    const handle = e.target.closest('.handle');
    if (handle) return startResize(e, el, it, handle.dataset.corner);

    const was = state.sel.has(it.id);
    if (e.shiftKey) { if (!was) { state.sel.add(it.id); syncSel(); } }
    else if (!was) setSelection([it.id]);
    startMove(e, el, it, was);
  });

  function startMove(e, el, prim, wasSelected) {
    const snapOf = it => ({ it, el: elOf(it.id), x: it.x, y: it.y, a: it.a && { ...it.a }, b: it.b && { ...it.b } });
    let group = [...state.sel].map(itemById).filter(i => i && !i.locked).map(snapOf);
    const boxes = group.filter(g => g.it.kind !== 'line').map(g => g.it);
    const G0 = boxes.length ? groupAabb(boxes) : null;    // what lines up with the other items
    const lines = G0 && guideLines(new Set(group.map(g => g.it.id)));
    const ref = it => it.kind === 'line' ? it.a : it;
    if (!group.length) return;
    const s = { x: e.clientX, y: e.clientY, px: ref(prim).x, py: ref(prim).y };
    let moved = false, cloned = false;
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < 3) return;
      if (!moved) {
        moved = true;
        record();
        if (e.altKey) {                                        // Option/Alt-drag: leave originals, drag copies
          const clones = makeClones(group.map(g => g.it));
          const byOrig = new Map(group.map((g, i) => [g.it.id, i]));
          const sorted = [...group].sort((a, b) => (a.it.z || 0) - (b.it.z || 0));
          group = clones.map((c, i) => ({ ...snapOf(c), from: sorted[i].it.id }));
          prim = group.find(g => g.from === prim.id)?.it || prim;
          setSelection(group.map(g => g.it.id));
          renderProjects();
          cloned = byOrig.size > 0;
        }
        group.forEach(g => g.el?.classList.add('dragging'));
        busy(true);
      }
      let dx = (ev.clientX - s.x) / view.z, dy = (ev.clientY - s.y) / view.z;
      if (ev.shiftKey) {                                       // Shift = snap to the dots
        const p = snapWorld(s.px + dx, s.py + dy);
        dx = p.x - s.px; dy = p.y - s.py;
        clearGuides();
      } else if (G0 && !ev.metaKey && !ev.ctrlKey) {           // otherwise edges and centres snap to other items (⌘ to move freely)
        const X = [G0.x, G0.x + G0.w / 2, G0.x + G0.w].map(v => v + dx), Y = [G0.y, G0.y + G0.h / 2, G0.y + G0.h].map(v => v + dy);
        const sx = nearest(X, lines.xs), sy = nearest(Y, lines.ys);
        if (sx) dx += sx;
        if (sy) dy += sy;
        showGuides(X.map(v => v + (sx || 0)), Y.map(v => v + (sy || 0)), lines);
      } else clearGuides();
      for (const g of group) {
        if (g.it.kind === 'line') {                            // free ends move; attached ends follow their item
          for (const k of ['a', 'b']) if (!g.it[k].attach) { g.it[k].x = Math.round((g[k].x + dx) * 100) / 100; g.it[k].y = Math.round((g[k].y + dy) * 100) / 100; }
        } else {
          g.it.x = Math.round((g.x + dx) * 100) / 100;
          g.it.y = Math.round((g.y + dy) * 100) / 100;
        }
        if (g.el) place(g.el, g.it);
      }
    };
    const up = ev => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      group.forEach(g => g.el?.classList.remove('dragging'));
      clearGuides(); busy(false);
      if (moved) { group.forEach(g => db.put('items', g.it)); touch(prim.id); if (cloned) toast(`Duplicated ${plural(group.length, 'item')}`); }
      else if (ev.shiftKey && wasSelected) { state.sel.delete(prim.id); syncSel(); }
      else if (!ev.shiftKey && wasSelected && state.sel.size > 1) setSelection([prim.id]);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Text boxes carry 4px vertical padding each side; their content height is what x/y/w describe.
  const contentH = (it, el) => it.kind === 'text' ? el.offsetHeight - 8 : it.h;

  function startResize(e, el, it, corner) {
    const s = { x: e.clientX, y: e.clientY, w: it.w, h: contentH(it, el) };
    const once = recorder();
    const free = it.kind === 'shape' && !SHAPES[it.shape]?.lock;   // rectangle / triangle stretch freely
    const ar = it.kind === 'text' || free ? null : it.w / it.h;
    const minW = it.kind === 'shape' ? 24 : MIN_W;
    const sx = corner.includes('w') ? -1 : 1, sy = corner.includes('n') ? -1 : 1;
    const th = (it.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const R = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
    const c0 = { x: it.x + s.w / 2, y: it.y + s.h / 2 };
    const a = R(-sx * s.w / 2, -sy * s.h / 2);
    const anchor = { x: c0.x + a.x, y: c0.y + a.y };       // opposite corner, pinned in world space
    el.setPointerCapture(e.pointerId);
    el.classList.add('resizing');
    busy(true);
    const lines = !it.rot && guideLines(new Set([it.id]));   // unrotated items snap their moving edges to other items
    const move = ev => {
      once();
      const dX = (ev.clientX - s.x) / view.z, dY = (ev.clientY - s.y) / view.z;
      const lx = dX * cos + dY * sin, ly = -dX * sin + dY * cos;   // pointer delta in the item's own axes
      let w = s.w + sx * lx;
      if (ar) {                                                // keep the ratio, follow whichever axis moved more
        const wFromH = (s.h + sy * ly) * ar;
        if (Math.abs(wFromH - s.w) > Math.abs(w - s.w)) w = wFromH;
      }
      let hFree = free ? s.h + sy * ly : null;
      const step = GRID / view.z;
      let snapped = false;
      if (ev.shiftKey) { w = Math.round(w / step) * step; if (free) hFree = Math.round(hFree / step) * step; }
      if (lines && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey) {
        const x0 = anchor.x, y0 = anchor.y;
        const rx = nearest([x0 + w], lines.xs, true);
        const by = it.kind === 'text' ? null : nearest([y0 + (free ? hFree : w / ar)], lines.ys, true);
        if (ar) {                                              // ratio-locked: snap whichever edge is closer
          if (rx != null && (by == null || Math.abs(rx) <= Math.abs(by * ar))) w += rx;
          else if (by != null) w = (w / ar + by) * ar;
        } else {
          if (rx != null) w += rx;
          if (by != null) hFree += by;
        }
        snapped = rx != null || by != null;
      }
      w = Math.max(minW, snapped ? Math.round(w * 100) / 100 : Math.round(w));
      it.w = w;
      let h;
      if (ar) h = it.h = snapped ? Math.round(w / ar * 100) / 100 : Math.round(w / ar);
      else if (free) h = it.h = Math.max(24, snapped ? Math.round(hFree * 100) / 100 : Math.round(hFree));
      else { el.style.width = w + 'px'; h = contentH(it, el); }
      const v = R(sx * w / 2, sy * h / 2);
      it.x = Math.round((anchor.x + v.x - w / 2) * 100) / 100;
      it.y = Math.round((anchor.y + v.y - h / 2) * 100) / 100;
      place(el, it);
      if (lines && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey) showGuides([it.x + w], it.kind === 'text' ? [] : [it.y + h], lines);
      else clearGuides();
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('resizing');
      clearGuides(); busy(false);
      db.put('items', it);
      touch(it.id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function startRotate(e, el, it) {
    const b = el.getBoundingClientRect();
    const c = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const ang = ev => Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI;
    const a0 = ang(e), r0 = it.rot || 0, sr = rect();
    const once = recorder();
    const tip = document.createElement('div');
    tip.className = 'angle-tip';
    stage.append(tip);
    el.setPointerCapture(e.pointerId);
    el.classList.add('rotating');
    busy(true);
    const move = ev => {
      once();
      let d = normDeg(r0 + ang(ev) - a0);
      if (ev.shiftKey) d = normDeg(Math.round(d / 15) * 15);
      else for (const k of [-90, 0, 90, 180, -180]) if (Math.abs(d - k) < 3) d = normDeg(k);   // gentle pull to square angles
      it.rot = d;
      place(el, it);
      tip.textContent = `${Math.round(d)}°`;
      tip.style.left = ev.clientX - sr.left + 16 + 'px';
      tip.style.top = ev.clientY - sr.top + 16 + 'px';
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('rotating');
      tip.remove();
      busy(false);
      db.put('items', it);
      touch(it.id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function setTextStyle(style) {
    const texts = selectedItems().filter(i => i.kind === 'text');
    if (!texts.length) return;
    record();
    for (const it of texts) {
      it.tstyle = style;
      const el = elOf(it.id);
      if (el) {
        el.classList.remove(...Object.keys(TEXT_STYLES).map(k => `ts-${k}`));
        el.classList.add(`ts-${style}`);
        place(el, it);                                   // the box height can change, so re-aim attached arrows
      }
      db.put('items', it);
      touch(it.id);
    }
    lastTextStyle = style;
    try { localStorage.setItem('dot.textStyle', style); } catch {}
  }

  // Scale every selected item together from the group's bottom-right corner; the top-left stays put.
  // Text keeps its fixed type size: its box widens or narrows and the words re-flow.
  function startGroupResize(e, handle) {
    const its = selectedItems();
    if (its.length < 2 || its.some(i => i.locked)) return;
    const G = groupAabb(its), A = { x: G.x, y: G.y };
    busy(true);
    const snaps = its.map(it => it.kind === 'line'
      ? { it, a: { ...it.a }, b: { ...it.b } }
      : { it, x: it.x, y: it.y, w: it.w, h: it.kind === 'text' ? null : it.h });
    const kMin = Math.max(0.05, ...snaps.filter(s => s.it.kind !== 'line').map(s => (s.it.kind === 'text' ? 60 : 24) / s.w));
    const s0 = { x: e.clientX, y: e.clientY };
    const once = recorder();
    handle.setPointerCapture(e.pointerId);
    world.classList.add('group-scaling');
    const scale = (v, a, k) => Math.round((a + (v - a) * k) * 100) / 100;
    const move = ev => {
      once();
      const dX = (ev.clientX - s0.x) / view.z, dY = (ev.clientY - s0.y) / view.z;
      const kx = (G.w + dX) / G.w, ky = (G.h + dY) / G.h;
      let k = Math.abs(kx - 1) > Math.abs(ky - 1) ? kx : ky;
      if (ev.shiftKey) { const step = GRID / view.z; k = Math.max(step, Math.round(G.w * k / step) * step) / G.w; }
      k = Math.max(kMin, k);
      for (const sn of snaps) {
        const it = sn.it;
        if (it.kind === 'line') {
          for (const end of ['a', 'b']) if (!it[end].attach) { it[end].x = scale(sn[end].x, A.x, k); it[end].y = scale(sn[end].y, A.y, k); }
        } else if (it.kind === 'text') {
          it.w = Math.round(sn.w * k);
          it.x = scale(sn.x, A.x, k); it.y = scale(sn.y, A.y, k);
        } else {                                           // scale about the centre so rotated items stay in place
          const cx = scale(sn.x + sn.w / 2, A.x, k), cy = scale(sn.y + sn.h / 2, A.y, k);
          it.w = Math.round(sn.w * k); it.h = Math.round(sn.h * k);
          it.x = Math.round((cx - it.w / 2) * 100) / 100; it.y = Math.round((cy - it.h / 2) * 100) / 100;
        }
        const el = elOf(it.id);
        if (el) place(el, it);
      }
      queueGroupBox();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      world.classList.remove('group-scaling');
      busy(false);
      its.forEach(it => db.put('items', it));
      touch(its[its.length - 1].id);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  // Change a property on every selected item of one kind, as one undo step.
  function updateSelected(kind, change) {
    const its = selectedItems().filter(i => i.kind === kind);
    if (!its.length) return;
    record();
    for (const it of its) {
      change(it);
      const old = elOf(it.id);
      if (old) {
        const el = itemEl(it);
        if (state.sel.has(it.id)) el.classList.add('selected');
        old.replaceWith(el);
        place(el, it);                                     // text height can change: re-aim attached arrows
      }
      db.put('items', it);
      touch(it.id);
    }
  }
  const setTextVariant = v => updateSelected('text', it => { it.variant = v; });
  const setTextAlign = a => updateSelected('text', it => { it.align = a; });
  const setTodo = on => updateSelected('text', it => { it.todo = on; });
  const setShapeFill = f => { updateSelected('shape', it => { it.fill = f; }); lastShapeFill = f; try { localStorage.setItem('dot.shapeFill', f); } catch {} };
  let lastShapeFill = 'grey';
  try { lastShapeFill = localStorage.getItem('dot.shapeFill') || 'grey'; } catch {}
  if (!SHAPE_FILLS[lastShapeFill]) lastShapeFill = 'grey';

  function addShape(shape, at = viewCenter()) {
    const S = SHAPES[shape];
    // Repeated adds at the same spot cascade so new shapes don't hide each other.
    const taken = p => itemsHere().some(i => i.kind === 'shape' && Math.abs(i.x + i.w / 2 - p.x) < 2 && Math.abs(i.y + i.h / 2 - p.y) < 2);
    let p = { ...at };
    for (let n = 0; n < 30 && taken(p); n++) p = { x: p.x + GRID / view.z, y: p.y + GRID / view.z };
    addItem({ kind: 'shape', shape, fill: lastShapeFill, w: S.w, h: S.h, ar: S.w / S.h }, p);
  }

  function rotateSelected(deg, absolute = false) {
    record();
    for (const it of selectedItems().filter(i => i.kind !== 'line')) {
      it.rot = absolute ? deg : normDeg((it.rot || 0) + deg);
      const el = elOf(it.id);
      if (el) place(el, it);
      db.put('items', it);
      touch(it.id);
    }
  }

  world.addEventListener('dblclick', e => {
    const el = e.target.closest('.item');
    if (!el || e.target.isContentEditable || e.target.closest('.todo-box') || panning()) return;
    const it = itemById(el.dataset.id);
    if (it.kind === 'text') startEdit(it, el);
    else if (it.kind === 'line') updateLine(it, l => { l.bend = { t: 0.5, d: l.bend.d ? 0 : 0.25 }; });   // double-click toggles a curve
    else openLightbox(it);
  });

  canvas.addEventListener('pointerdown', e => {
    if (e.target.isContentEditable) return;
    closeCtx();
    endEdit?.();
    if (e.button === 1 || (e.button === 0 && panning())) { e.preventDefault(); return startPan(e); }
    if (e.button === 0 && state.tool === 'line') { e.preventDefault(); return startDrawLine(e); }
    if (e.button === 0) startMarquee(e);
  });

  /* ---------------- Line interactions ---------------- */
  function createLine(a, b, extra = {}) {
    record();
    const it = normalize({ id: uid(), projectId: state.current, kind: 'line', createdAt: Date.now(), z: ++state.topZ,
      a, b, bend: { t: 0.5, d: 0 }, arrow: 'end', ...extra });
    state.items.push(it);
    const el = itemEl(it);
    world.append(el);
    drawLine(el, it);
    setSelection([it.id]);
    return { it, el };
  }
  const worldPt = (ev, snap) => { const p = toWorld(ev.clientX, ev.clientY); return snap ? snapWorld(p.x, p.y) : p; };

  // Line tool: press (on empty space or on an item) and drag to the end point.
  function startDrawLine(e) {
    const p0 = toWorld(e.clientX, e.clientY);
    const from = itemAt(p0);
    const { it, el } = createLine(from ? { x: p0.x, y: p0.y, attach: from.id } : { x: p0.x, y: p0.y }, { x: p0.x, y: p0.y });
    canvas.setPointerCapture(e.pointerId);
    let target = null;
    const move = ev => {
      const p = worldPt(ev, ev.shiftKey);
      target = itemAt(p, from?.id);
      setLinkTarget(target);
      it.b = { x: p.x, y: p.y };
      drawLine(el, it);
    };
    const up = ev => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      setLinkTarget(null);
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 8) {
        it.b = { x: p0.x + 200, y: p0.y - 120 };                     // a click makes a standard-length arrow
        target = null;
      }
      if (target) it.b.attach = target.id;
      drawLine(el, it);
      db.put('items', it);
      touch(it.id);
      renderProjects();
      setTool('select');
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  // Drag an end (attaches when dropped on an item) or the middle (curves the line).
  function startLineHandle(e, el, it, end) {
    el.setPointerCapture(e.pointerId);
    el.classList.add('editing-line');
    const other = end === 'a' ? 'b' : 'a';
    let target = null;
    const once = recorder();
    const move = ev => {
      once();
      const p = worldPt(ev, ev.shiftKey && end !== 'm');
      if (end === 'm') {
        const A = endPoint(it, 'a'), B = endPoint(it, 'b');
        const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
        let t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2;
        let d = ((p.x - A.x) * -dy + (p.y - A.y) * dx) / L2;      // signed offset across the chord, relative to length
        if (Math.abs(d) * L < 8) { d = 0; t = 0.5; }                 // snap back to straight when close
        it.bend = { t: clamp(t, -1, 2), d: clamp(d, -3, 3) };
      } else {
        target = itemAt(p, it[other].attach);
        setLinkTarget(target);
        it[end] = { x: p.x, y: p.y };
      }
      drawLine(el, it);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('editing-line');
      setLinkTarget(null);
      if (target) it[end].attach = target.id;
      drawLine(el, it);
      db.put('items', it);
      touch(it.id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function updateLine(it, change) {
    record();
    change(it);
    const el = elOf(it.id);
    if (el) drawLine(el, it);
    db.put('items', it);
    touch(it.id);
  }

  function startPan(e) {
    let lx = e.clientX, ly = e.clientY;
    cancelAnimationFrame(anim);
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('panning');
    const move = ev => { pan(ev.clientX - lx, ev.clientY - ly); lx = ev.clientX; ly = ev.clientY; };
    const up = () => {
      canvas.classList.remove('panning');
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  function startMarquee(e, clickId) {
    const base = e.shiftKey ? new Set(state.sel) : new Set();
    if (!e.shiftKey) setSelection([]);
    const r = rect(), sx = e.clientX, sy = e.clientY;
    const boxes = [...world.querySelectorAll('.item:not(.locked)')].map(el => ({ id: el.dataset.id, r: (el.classList.contains('line') ? el.querySelector('.stroke') : el).getBoundingClientRect() }));
    let box = null;
    canvas.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!box && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      if (!box) { box = document.createElement('div'); box.className = 'marquee'; stage.append(box); }
      const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY);
      const x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
      Object.assign(box.style, { left: x1 - r.left + 'px', top: y1 - r.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
      const sel = new Set(base);
      for (const b of boxes) if (b.r.left < x2 && b.r.right > x1 && b.r.top < y2 && b.r.bottom > y1) sel.add(b.id);
      state.sel = sel;
      syncSel();
    };
    const up = () => {
      if (!box && clickId) setSelection([clickId]);
      box?.remove();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  // Trackpad: two-finger scroll pans, pinch zooms. Mouse: ⌘/Ctrl + wheel zooms.
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    closeCtx();
    cancelAnimationFrame(anim);
    const r = rect();
    if (e.ctrlKey || e.metaKey) {
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-d * 0.01));
    } else pan(-e.deltaX, -e.deltaY);
  }, { passive: false });

  /* ---------------- Tools ---------------- */
  function setTool(t) {
    state.tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    canvas.classList.toggle('tool-hand', panning());
    canvas.classList.toggle('tool-line', t === 'line');
  }
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { closeShapes(); setTool(b.dataset.tool); }));

  // Shapes: a small flyout beside the toolbar; the shape lands in the middle of the view.
  const shapesBtn = $('#shapesBtn'), shapePop = $('#shapePop');
  shapePop.innerHTML = Object.entries(SHAPES).map(([k, S]) => `<button class="sp-item" data-shape="${k}" title="Add ${S.label.toLowerCase()}">${I[k]}<span>${S.label}</span></button>`).join('');
  function closeShapes() { shapePop.hidden = true; shapesBtn.classList.remove('open'); shapesBtn.setAttribute('aria-expanded', 'false'); }
  shapesBtn.addEventListener('click', () => {
    const open = shapePop.hidden;
    shapePop.hidden = !open;
    if (open) {                                          // line the flyout up with the button
      const r = shapesBtn.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      shapePop.style.left = r.right - sr.left + 10 + 'px';
      shapePop.style.top = Math.min(r.top - sr.top - 6, sr.height - shapePop.offsetHeight - 12) + 'px';
    }
    shapesBtn.classList.toggle('open', open);
    shapesBtn.setAttribute('aria-expanded', String(open));
  });
  shapePop.addEventListener('click', e => {
    const b = e.target.closest('[data-shape]');
    if (!b) return;
    closeShapes();
    setTool('select');
    addShape(b.dataset.shape);
  });
  document.addEventListener('pointerdown', e => { if (!shapePop.hidden && !e.target.closest('#shapePop, #shapesBtn')) closeShapes(); }, true);

  // Text: a flyout of the three types; T adds a paragraph straight away.
  const textBtn = $('#textBtn'), textPop = $('#textPop');
  textPop.innerHTML = Object.entries(TEXT).map(([k, t]) => `<button class="sp-item" data-text="${k}">${I[k]}<span>${t.label}</span></button>`).join('');
  const closeTextPop = () => { textPop.hidden = true; textBtn.classList.remove('open'); textBtn.setAttribute('aria-expanded', 'false'); };
  async function addTextAt(variant, at = viewCenter()) {
    setTool('select');
    const { it, el } = await addItem({ kind: 'text', variant, text: '', tstyle: lastTextStyle }, { x: at.x - TEXT[variant].w / 2, y: at.y - 20 });
    startEdit(it, el, true);
  }
  textBtn.addEventListener('click', () => {
    closeShapes();
    const open = textPop.hidden;
    textPop.hidden = !open;
    if (open) {
      const r = textBtn.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      textPop.style.left = r.right - sr.left + 10 + 'px';
      textPop.style.top = Math.min(r.top - sr.top - 6, sr.height - textPop.offsetHeight - 12) + 'px';
    }
    textBtn.classList.toggle('open', open);
    textBtn.setAttribute('aria-expanded', String(open));
  });
  textPop.addEventListener('click', e => { const b = e.target.closest('[data-text]'); if (b) { closeTextPop(); addTextAt(b.dataset.text); } });
  document.addEventListener('pointerdown', e => { if (!textPop.hidden && !e.target.closest('#textPop, #textBtn')) closeTextPop(); }, true);
  shapesBtn.addEventListener('click', closeTextPop);

  // Upload: images and videos from the computer land in the middle of the view.
  const uploadInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*,video/*', multiple: true, hidden: true });
  document.body.append(uploadInput);
  uploadInput.addEventListener('change', () => {
    const at = viewCenter();
    const files = [...uploadInput.files].filter(f => /^(image|video)\//.test(f.type));
    files.forEach((f, i) => addItem({ kind: f.type.split('/')[0], blob: f, name: f.name }, { x: at.x + (i - (files.length - 1) / 2) * (BASE_W + 24), y: at.y }));
    uploadInput.value = '';
  });
  $('#uploadBtn').addEventListener('click', () => { closeShapes(); closeTextPop(); setTool('select'); uploadInput.click(); });
  $('#linkBtn').addEventListener('click', () => { closeShapes(); closeTextPop(); setTool('select'); openAddModal(null, 'link', viewCenter()); });

  // Instagram embeds report their height; size the card to match the post.
  addEventListener('message', e => {
    if (!/^https:\/\/(www\.)?instagram\.com$/.test(e.origin)) return;
    let d = e.data;
    try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
    const h = d && d.type === 'MEASURE' && d.details && +d.details.height;
    if (!h) return;
    for (const fr of document.querySelectorAll('iframe.ig')) {
      if (fr.contentWindow !== e.source) continue;
      const el = fr.closest('.item'), it = el && itemById(el.dataset.id);
      if (it) setRatio(it, el, IG_W / h);
    }
  });

  /* ---------------- Context menu ---------------- */
  const ctx = $('#ctx');
  function openCtx(x, y, entries) {
    ctx.innerHTML = '';
    for (const en of entries) {
      if (en === 'sep') { ctx.insertAdjacentHTML('beforeend', '<div class="ctx-sep"></div>'); continue; }
      if (en.heading) { const h = document.createElement('div'); h.className = 'ctx-label'; h.textContent = en.heading; ctx.append(h); continue; }
      if (en.row) {                                      // a compact row of icon choices, e.g. text alignment
        const r = document.createElement('div');
        r.className = 'ctx-row';
        r.innerHTML = '<span class="ctx-row-label"></span>';
        r.firstChild.textContent = en.label;
        for (const c of en.row) {
          const b = document.createElement('button');
          b.className = 'ctx-chip' + (c.active ? ' active' : '');
          b.title = c.title;
          b.setAttribute('aria-label', c.title);
          b.setAttribute('aria-pressed', String(!!c.active));
          b.innerHTML = c.icon;
          b.addEventListener('click', () => { closeCtx(); c.action(); });
          r.append(b);
        }
        ctx.append(r);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'ctx-item' + (en.danger ? ' danger' : '');
      b.innerHTML = `${en.icon || ''}<span></span>${en.hint ? `<kbd class="ctx-hint">${en.hint}</kbd>` : ''}`;
      b.querySelector('span').textContent = en.label;
      b.addEventListener('click', () => { closeCtx(); en.action(); });
      ctx.append(b);
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
    ctx.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
  }
  function closeCtx() { ctx.hidden = true; }
  document.addEventListener('pointerdown', e => { if (!ctx.hidden && !ctx.contains(e.target)) closeCtx(); }, true);

  const textStyleEntries = () => {
    const texts = selectedItems().filter(i => i.kind === 'text');
    if (!texts.length) return [];
    const current = new Set(texts.map(i => i.tstyle || 'dark'));
    const only = (key, v) => { const s = new Set(texts.map(i => i[key] || (key === 'align' ? 'left' : ''))); return s.size === 1 && s.has(v); };
    return [
      { label: 'Type', row: Object.entries(TEXT).map(([v, t]) => ({ title: t.label, icon: I[v], active: only('variant', v), action: () => setTextVariant(v) })) },
      { label: 'Align', row: ALIGNS.map(a => ({ title: `Align ${a}`, icon: I['align' + a[0].toUpperCase() + a.slice(1)], active: only('align', a), action: () => setTextAlign(a) })) },
      texts.every(i => i.todo)
        ? { label: 'Remove checkboxes', icon: I.todo, action: () => setTodo(false) }
        : { label: 'Make to-do list', icon: I.todo, action: () => setTodo(true) },
      'sep',
      { heading: 'Text style' },
      ...Object.entries(TEXT_STYLES).map(([key, st]) => ({
        label: st.label, icon: swatch(st), hint: current.size === 1 && current.has(key) ? '✓' : '',
        action: () => setTextStyle(key),
      })),
      'sep',
    ];
  };
  const selectionEntries = () => {
    const n = state.sel.size;
    const shapes = selectedItems().filter(i => i.kind === 'shape');
    const fills = new Set(shapes.map(i => i.fill || 'grey'));
    return [
      ...textStyleEntries(),
      ...(shapes.length ? [{ label: 'Colour', row: Object.entries(SHAPE_FILLS).map(([k, f]) => ({ title: f.label, icon: fillSwatch(f), active: fills.size === 1 && fills.has(k), action: () => setShapeFill(k) })) }, 'sep'] : []),
      { label: 'Duplicate', icon: I.duplicate, hint: '⌘D', action: duplicate },
      { label: 'Copy', icon: I.copy, hint: '⌘C', action: () => copySelection() },
      { label: 'Cut', icon: I.cut, hint: '⌘X', action: () => { if (copySelection(true)) { toast(`Cut ${plural(clipboard.length, 'item')} — ⌘V to paste`); removeSelected(); } } },
      'sep',
      ...(selectedItems().some(i => i.kind !== 'line') ? [{ label: 'Rotate 90°', icon: I.rotate, action: () => rotateSelected(90) }] : []),
      ...(selectedItems().some(i => i.rot) ? [{ label: 'Reset rotation', icon: I.resetRot, action: () => rotateSelected(0, true) }] : []),
      { label: 'Arrange', row: Object.entries(ALIGN).map(([k, a]) => ({ title: `${a.label}  ⌥${a.key}`, icon: I[a.icon], action: () => alignSelected(k) })) },
      ...(n > 2 ? [{ label: 'Space evenly', row: [
        { title: 'Space evenly across', icon: I.distH, action: () => distribute('x') },
        { title: 'Space evenly down', icon: I.distV, action: () => distribute('y') }] }] : []),
      selectedItems().every(i => i.locked)
        ? { label: 'Unlock', icon: I.unlock, hint: '⇧⌘L', action: () => toggleLock() }
        : { label: 'Lock position', icon: I.lock, hint: '⇧⌘L', action: () => toggleLock() },
      'sep',
      { label: `New project from ${n > 1 ? plural(n, 'item') : 'selection'}`, icon: I.newProject, action: projectFromSelection },
      { label: 'Bring to front', icon: I.front, hint: ']', action: () => { record(); bringToFront([...state.sel]); } },
      { label: 'Send to back', icon: I.back, hint: '[', action: () => { record(); sendToBack([...state.sel]); } },
      'sep',
      { label: n > 1 ? `Delete ${plural(n, 'item')}` : 'Delete', icon: I.trash, hint: '⌫', danger: true, action: removeSelected },
    ];
  };

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const el = e.target.closest('.item');
    if (el) {
      const it = itemById(el.dataset.id);
      if (!state.sel.has(it.id)) setSelection([it.id]);
      const first = state.sel.size > 1 ? [{ heading: `${plural(state.sel.size, 'item')} selected` }]
        : it.kind === 'line' ? [
            { heading: 'Arrowheads' },
            { label: 'Arrow at end', icon: I.arrowEnd, hint: it.arrow === 'end' ? '✓' : '', action: () => updateLine(it, l => { l.arrow = 'end'; }) },
            { label: 'Arrows at both ends', icon: I.arrowBoth, hint: it.arrow === 'both' ? '✓' : '', action: () => updateLine(it, l => { l.arrow = 'both'; }) },
            { label: 'No arrows', icon: I.noArrow, hint: it.arrow === 'none' ? '✓' : '', action: () => updateLine(it, l => { l.arrow = 'none'; }) },
            'sep',
            ...(it.bend.d ? [{ label: 'Straighten', icon: I.straight, action: () => updateLine(it, l => { l.bend = { t: 0.5, d: 0 }; }) }] : []),
            ...(it.a.attach || it.b.attach ? [{ label: 'Detach ends', icon: I.unlink, action: () => updateLine(it, l => { delete l.a.attach; delete l.b.attach; }) }] : []),
          ]
        : it.kind === 'text' ? [{ label: 'Edit text', icon: I.edit, hint: '↵', action: () => startEdit(it, el) }, 'sep']
        : it.kind === 'shape' ? []
        : [{ label: 'Open', icon: I.open, action: () => openLightbox(it) }];
      openCtx(e.clientX, e.clientY, [...first, ...selectionEntries()]);
      return;
    }
    const at = toWorld(e.clientX, e.clientY);
    const sel = state.sel.size ? [{ heading: `${plural(state.sel.size, 'item')} selected` }, ...selectionEntries(), 'sep'] : [];
    const paste = clipboard.length ? [{ label: `Paste ${plural(clipboard.length, 'item')} here`, icon: I.paste, hint: '⌘V', action: () => pasteAt(at) }, 'sep'] : [];
    openCtx(e.clientX, e.clientY, [
      ...paste,
      ...sel,
      { heading: 'Add media' },
      { label: 'Add Image', icon: I.image, action: () => openAddModal('image', 'file', at) },
      { label: 'Add Video', icon: I.video, action: () => openAddModal('video', 'file', at) },
      { label: 'Add Link', icon: I.link, action: () => openAddModal(null, 'link', at) },
      'sep',
      { heading: 'Add connector' },
      { label: 'Add Line', icon: I.line, hint: 'A', action: () => {
        const { it } = createLine({ x: at.x, y: at.y }, { x: at.x + 200, y: at.y - 120 });
        db.put('items', it); touch(it.id); renderProjects();
      } },
      { label: 'Shape', row: Object.entries(SHAPES).map(([k, S]) => ({ title: `Add ${S.label.toLowerCase()}`, icon: I[k], action: () => addShape(k, at) })) },
      'sep',
      { heading: 'Add text' },
      ...Object.entries(TEXT).map(([variant, t]) => ({
        label: t.label, icon: I[variant],
        action: async () => { const { it, el } = await addItem({ kind: 'text', variant, text: '', tstyle: lastTextStyle }, at); startEdit(it, el, true); },
      })),
    ]);
  });

  /* ---------------- Confirm dialog (window.confirm is blocked when hosted) ---------------- */
  function confirmDialog({ title, body, ok = 'Delete' }) {
    return new Promise(res => {
      modal.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><h2></h2><p class="sub"></p>
        <div class="actions"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn primary danger" data-yes></button></div></div>`;
      modal.querySelector('h2').textContent = title;
      modal.querySelector('.sub').textContent = body;
      const yes = modal.querySelector('[data-yes]');
      yes.textContent = ok;
      modal.hidden = false;
      const done = v => { closeModal(); res(v); };
      modal.querySelector('[data-no]').onclick = () => done(false);
      yes.onclick = () => done(true);
      yes.focus();
    });
  }

  /* ---------------- Keyboard shortcuts sheet ---------------- */
  const SHORTCUTS = [
    ['Tools', [['V', 'Select'], ['H  or hold Space', 'Pan'], ['A', 'Draw an arrow'], ['Esc', 'Clear selection']]],
    ['Canvas', [['⌘ + scroll / pinch', 'Zoom'], ['+  −', 'Zoom in / out'], ['⇧0', 'Zoom to 100%'], ['⇧1', 'Fit everything'], ['L', 'Back to last edited'], ['⌘\\', 'Show / hide projects']]],
    ['Add', [['T', 'Text'], ['U', 'Upload image or video'], ['K', 'Link'], ['A', 'Arrow']]],
    ['Arrange', [['⌥A  ⌥H  ⌥D', 'Align left / centre / right'], ['⌥W  ⌥V  ⌥S', 'Align top / middle / bottom'], ['⇧⌘L', 'Lock / unlock'], ['← → ↑ ↓', 'Nudge (⇧ for 10)'], ['⌘ + drag', 'Move without snapping']]],
    ['Items', [['↵', 'Edit selected text'], ['⌘C  ⌘X  ⌘V', 'Copy, cut, paste'], ['⌘Z  ⇧⌘Z', 'Undo, redo'], ['⌘D', 'Duplicate'], [']  [', 'Bring to front / send to back'], ['⌥ + drag', 'Duplicate while dragging'], ['⇧ + drag', 'Snap to the dots'], ['⌘A', 'Select all'], ['⌫', 'Delete']]],
  ];
  function openShortcuts() {
    const cols = SHORTCUTS.map(([title, rows]) => `<section><h3>${title}</h3>${rows.map(([k, d]) => `<div class="sc-row"><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</section>`).join('');
    modal.innerHTML = `<div class="modal modal-wide" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2><p class="sub">Right-click anywhere on the canvas for everything else.</p><div class="sc-grid">${cols}</div><div class="actions"><button type="button" class="btn primary" data-close>Done</button></div></div>`;
    modal.hidden = false;
    const done = modal.querySelector('[data-close]');
    done.onclick = closeModal;
    done.focus();
  }

  /* ---------------- Add modal ---------------- */
  const modal = $('#modal');
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); });

  function openAddModal(kind, source, at) {
    const title = source === 'file' ? `Add ${kind === 'image' ? 'Image' : 'Video'}` : 'Add Link';
    const sub = source === 'file'
      ? (kind === 'image' ? 'Upload an image (PNG, JPG, GIF, WebP…) from your computer.' : 'Upload a video (MP4, WebM, MOV…) from your computer.')
      : 'Paste a link to an image or video — YouTube, Vimeo, Instagram, Pinterest or a direct file. DOT works out which it is.';

    modal.innerHTML = `
      <form class="modal" autocomplete="off">
        <h2></h2><p class="sub"></p>
        ${source === 'file'
          ? `<label class="drop">${I.upload}<span><strong>Click to choose</strong> or drag a file here</span><input type="file" accept="${kind}/*"></label>`
          : `<input class="field" type="url" placeholder="https://…" required>`}
        <div class="preview" hidden><div class="thumb"></div><div class="meta"><b></b><span></span></div></div>
        <div class="err"></div>
        <div class="actions">
          <button type="button" class="btn ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn primary" disabled>Add to canvas</button>
        </div>
      </form>`;
    modal.querySelector('h2').textContent = title;
    modal.querySelector('.sub').textContent = sub;
    modal.hidden = false;

    const form = modal.querySelector('form');
    const submit = form.querySelector('[type=submit]');
    const preview = form.querySelector('.preview');
    const thumb = preview.querySelector('.thumb');
    const err = form.querySelector('.err');
    form.querySelector('[data-cancel]').onclick = closeModal;
    let payload = null;

    const showPreview = (node, name, meta) => {
      thumb.innerHTML = ''; if (node) thumb.append(node);
      preview.querySelector('b').textContent = name;
      preview.querySelector('span').textContent = meta;
      preview.hidden = false;
    };

    if (source === 'file') {
      const drop = form.querySelector('.drop');
      const input = drop.querySelector('input');
      const take = file => {
        err.textContent = '';
        if (!file || !file.type.startsWith(kind + '/')) { err.textContent = `That doesn't look like a${kind === 'image' ? 'n image' : ' video'} file.`; submit.disabled = true; return; }
        payload = { kind, blob: file, name: file.name };
        const u = URL.createObjectURL(file);
        const node = kind === 'image' ? Object.assign(new Image(), { src: u }) : Object.assign(document.createElement('video'), { src: u + '#t=0.1', muted: true, preload: 'metadata' });
        showPreview(node, file.name, `${(file.size / 1024 / 1024).toFixed(2)} MB`);
        submit.disabled = false;
      };
      input.addEventListener('change', () => take(input.files[0]));
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); });
    } else {
      const input = form.querySelector('.field');
      setTimeout(() => input.focus(), 30);
      let seq = 0;
      input.addEventListener('input', () => {
        const url = input.value.trim();
        const my = ++seq;
        err.textContent = ''; preview.hidden = true; payload = null; submit.disabled = true;
        if (!isHttpUrl(url)) { if (url) err.textContent = 'Enter a full link starting with https://'; return; }
        const ready = (k, node, name, meta, src = url) => {
          if (my !== seq) return;
          payload = { kind: k, url: src, name: url };
          showPreview(node, name, meta);
          submit.disabled = false;
        };
        const v = parseVideo(url);
        if (isPinShort(url)) { err.textContent = 'Short pin.it links can’t be read. Open the pin and copy its pinterest.com/pin/… link.'; return; }
        const pin = pinId(url);
        if (pin) {
          preview.hidden = false; thumb.innerHTML = ''; preview.querySelector('b').textContent = 'Getting the pin…'; preview.querySelector('span').textContent = 'Pinterest';
          pinImage(pin).then(loadFirst).then(img => ready('image', img, 'Pinterest pin', `${img.naturalWidth} × ${img.naturalHeight}`, img.src))
            .catch(() => { if (my === seq) { preview.hidden = true; err.textContent = "Couldn't get that pin's image. It may be private or removed."; } });
          return;
        }
        if (igCode(url)) {
          const reel = /\/(reels?|tv)\//.test(url);
          return ready(reel ? 'video' : 'image', Object.assign(document.createElement('div'), { className: 'ig-mark', innerHTML: reel ? I.video : I.image }), reel ? 'Instagram reel' : 'Instagram post', 'Shows as the post’s preview on the canvas');
        }
        if (v && (v.provider === 'YouTube' || v.provider === 'Vimeo'))
          return ready('video', v.thumb ? Object.assign(new Image(), { src: v.thumb }) : null, `${v.provider} video`, hostOf(url));
        // Anything else: see whether it loads as an image, then as a video.
        preview.hidden = false; thumb.innerHTML = ''; preview.querySelector('b').textContent = 'Checking link…'; preview.querySelector('span').textContent = hostOf(url);
        const asVideo = () => {
          const vid = Object.assign(document.createElement('video'), { muted: true, preload: 'metadata' });
          vid.onloadedmetadata = () => ready('video', vid, 'Video', `${hostOf(url)} · ${vid.videoWidth} × ${vid.videoHeight}`);
          vid.onerror = () => { if (my === seq) { preview.hidden = true; err.textContent = "Couldn't find an image or video at that link. Try a direct link to the file."; } };
          vid.src = url + (url.includes('#') ? '' : '#t=0.1');
        };
        if (v?.provider === 'file') return asVideo();
        const img = new Image();
        img.onload = () => ready('image', img, 'Image', `${hostOf(url)} · ${img.naturalWidth} × ${img.naturalHeight}`);
        img.onerror = () => { if (my === seq) asVideo(); };
        img.src = url;
      });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!payload) return;
      addItem(payload, at);
      closeModal();
    });
  }

  /* ---------------- Drop files directly on canvas ---------------- */
  canvas.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); canvas.classList.add('drop-hover');
  });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('drop-hover'));
  canvas.addEventListener('drop', e => {
    e.preventDefault(); canvas.classList.remove('drop-hover');
    const at = toWorld(e.clientX, e.clientY);
    [...e.dataTransfer.files]
      .filter(f => /^(image|video)\//.test(f.type))
      .forEach((f, i) => addItem({ kind: f.type.split('/')[0], blob: f, name: f.name }, { x: at.x + i * (BASE_W + 24), y: at.y }));
  });

  /* ---------------- Lightbox ---------------- */
  const lb = $('#lightbox');
  function closeLightbox() { lb.hidden = true; lb.innerHTML = ''; }
  lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.lb-close')) closeLightbox(); });
  function openLightbox(it) {
    if (!it || it.kind === 'text' || it.kind === 'line' || it.kind === 'shape') return;
    lb.innerHTML = '<button class="lb-close" title="Close">×</button>';
    let node;
    const ig = !it.blob && igCode(it.url);
    if (ig && !EMBEDDED) {
      node = Object.assign(document.createElement('iframe'), { src: `https://www.instagram.com/p/${ig}/embed/captioned/`, className: 'lb-media lb-ig', title: 'Instagram post' });
      const wrap = document.createElement('div');
      wrap.className = 'lb-ig-wrap';
      wrap.append(node, Object.assign(document.createElement('a'), { href: it.url, target: '_blank', rel: 'noopener noreferrer', className: 'lb-ig-link', textContent: 'Open on Instagram ↗' }));
      node = wrap;
    } else if (ig) {
      node = document.createElement('div');
      node.className = 'lb-link';
      node.append(Object.assign(document.createElement('a'), { href: it.url, target: '_blank', rel: 'noopener noreferrer', textContent: 'Open on Instagram ↗' }));
    } else if (it.kind === 'image') {
      node = Object.assign(new Image(), { src: srcOf(it), className: 'lb-media' });
    } else {
      const v = it.blob ? { provider: 'file' } : parseVideo(it.url) || {};
      if (v.provider === 'file') {
        node = Object.assign(document.createElement('video'), { src: srcOf(it), controls: true, autoplay: true, className: 'lb-media' });
      } else if (v.embed && !EMBEDDED) {
        node = Object.assign(document.createElement('iframe'), { src: v.embed, className: 'lb-media', allow: 'autoplay; fullscreen; picture-in-picture', allowFullscreen: true });
      } else {
        node = document.createElement('div');
        node.className = 'lb-link';
        node.append(Object.assign(document.createElement('a'), { href: it.url, target: '_blank', rel: 'noopener noreferrer',
          textContent: v.provider && v.provider.length < 12 ? `Watch on ${v.provider} ↗` : 'Open video in a new tab ↗' }));
      }
    }
    lb.append(node);
    lb.hidden = false;
  }

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg, act) {
    const t = $('#toast');
    t.innerHTML = '<span></span>';
    t.firstChild.textContent = msg;
    if (act) {
      const b = Object.assign(document.createElement('button'), { textContent: act.label });
      b.onclick = () => { t.hidden = true; act.action(); };
      t.append(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
  }

  /* ---------------- Controls & keyboard ---------------- */
  $('#zoomIn').onclick = () => zoomCenter(1.25);
  $('#zoomOut').onclick = () => zoomCenter(0.8);
  $('#zoomReset').onclick = () => zoomCenter(1 / view.z);
  $('#zoomFit').onclick = () => fitAll();
  $('#locate').onclick = goToLastEdited;
  $('#undoBtn').onclick = undo;
  $('#redoBtn').onclick = redo;
  $('#addProject').onclick = () => addProject();
  $('#addFolder').onclick = () => addFolder();
  $('#dotBtn').onclick = togglePanel;
  // Clicking anywhere outside the panel (except menus and dialogs) closes it.
  document.addEventListener('pointerdown', e => {
    if (shell.classList.contains('collapsed')) return;
    if (e.target.closest('#panel, #dotBtn, .toolbar, #shapePop, #textPop, #selbar, .ctx, .modal-backdrop, .toast')) return;
    setCollapsed(true);
  }, true);
  // New project / folder from the bar: open the panel first so the name can be typed in place.
  $('#panelShortcuts').onclick = () => { setCollapsed(true); openShortcuts(); };

  const typing = t => t.closest?.('input, textarea') || t.isContentEditable;
  let lastNudge = 0;
  document.addEventListener('keydown', e => {
    if (typing(e.target)) return;
    if (e.key === 'Escape') { if (!shell.classList.contains('collapsed') && ctx.hidden && modal.hidden) return setCollapsed(true); closeCtx(); closeShapes(); closeModal(); closeLightbox(); setSelection([]); if (state.tool === 'line') setTool('select'); return; }
    if (!modal.hidden || !lb.hidden) return;
    if (e.key === 'Alt') canvas.classList.add('alt');
    if (e.code === 'Space') { e.preventDefault(); if (!state.space) { state.space = true; canvas.classList.add('tool-hand'); } return; }
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'a') { e.preventDefault(); setSelection(itemsHere().map(i => i.id)); }
      if (e.key === 'd') { e.preventDefault(); duplicate(); }
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key.toLowerCase() === 'y' && e.ctrlKey) { e.preventDefault(); redo(); }
      if (e.key === '\\') { e.preventDefault(); togglePanel(); }
      if (e.shiftKey && e.code === 'KeyL' && state.sel.size) { e.preventDefault(); toggleLock(); }
      return;
    }
    if (e.altKey && state.sel.size) {                             // ⌥ + A D H / W S V: align
      const k = Object.keys(ALIGN).find(k => e.code === 'Key' + ALIGN[k].key);
      if (k) { e.preventDefault(); return alignSelected(k); }
    }
    if (e.key.startsWith('Arrow') && state.sel.size) {             // nudge: 1 unit, Shift for 10
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1, its = selectedItems().filter(i => !i.locked);
      if (!its.length) return;
      if (Date.now() - lastNudge > 800) record();
      lastNudge = Date.now();
      const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
      its.forEach(it => shiftItem(it, dx, dy));
      touch(its[its.length - 1].id);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel.size) { e.preventDefault(); removeSelected(); }
    else if (e.key === 'Enter' && state.sel.size === 1) {         // Enter edits the selected text box
      const it = selectedItems()[0], el = it && elOf(it.id);
      if (it?.kind === 'text' && el) { e.preventDefault(); startEdit(it, el); }
    }
    else if ((e.key === ']' || e.key === '[') && state.sel.size) { e.preventDefault(); record(); (e.key === ']' ? bringToFront : sendToBack)([...state.sel]); }
    else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomCenter(1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(0.8); }
    else if (e.shiftKey && e.code === 'Digit0') zoomCenter(1 / view.z);
    else if (e.shiftKey && e.code === 'Digit1') fitAll();
    else if (e.key === 'v' || e.key === 'V') setTool('select');
    else if (e.key === 'h' || e.key === 'H') setTool('hand');
    else if (e.key === 'a' || e.key === 'A') setTool('line');
    else if (e.key === 't' || e.key === 'T') addTextAt('paragraph');
    else if (e.key === 'u' || e.key === 'U') uploadInput.click();
    else if (e.key === 'k' || e.key === 'K') openAddModal(null, 'link', viewCenter());
    else if (e.key === '?') openShortcuts();
    else if (e.key === 'l' || e.key === 'L') goToLastEdited();
  });
  addEventListener('blur', () => canvas.classList.remove('alt'));
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') { state.space = false; canvas.classList.toggle('tool-hand', panning()); }
    if (e.key === 'Alt') canvas.classList.remove('alt');
  });

  /* ---------------- Welcome project (first visit only) ---------------- */
  const exampleArt = (c1, c2, shape) => new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="800" height="1000" fill="url(#g)"/>${shape}
    <text x="48" y="950" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff" fill-opacity=".85" letter-spacing="2">EXAMPLE</text></svg>`],
    { type: 'image/svg+xml' });

  async function seedWelcome() {
    const p = await addProject('Welcome to DOT', false);
    const base = { projectId: p.id, blob: null, url: null };
    const items = [
      { kind: 'text', variant: 'heading', text: 'Welcome to DOT', x: -460, y: -300 },
      { kind: 'text', variant: 'subheading', text: 'An infinite canvas for every project', x: -460, y: -232 },
      { kind: 'text', variant: 'paragraph', x: -460, y: -176,
        text: 'Right-click anywhere to add images, videos or text.\nDrag on empty space to select. Hold Space and drag to pan, ⌘ + scroll or pinch to zoom.\nShift-drag snaps to the dots. Option-drag duplicates. Drag a corner to resize, or the round handle to rotate.\nPress A to draw arrows: drop an end on an item to attach it, drag the middle to curve it.' },
      { kind: 'image', name: 'Example image', w: 240, ar: 4 / 5, x: 20, y: -300,
        blob: exampleArt('#f3a46b', '#d9534f', '<circle cx="400" cy="420" r="190" fill="#fff" fill-opacity=".9"/>') },
      { kind: 'image', name: 'Example image', w: 240, ar: 4 / 5, x: 284, y: -228,
        blob: exampleArt('#8fb8de', '#2f4a7a', '<rect x="210" y="230" width="380" height="380" rx="40" fill="#fff" fill-opacity=".9" transform="rotate(12 400 420)"/>') },
    ];
    for (const [i, d] of items.entries()) {
      const it = normalize({ ...base, id: uid(), createdAt: Date.now() + i, z: i + 1, name: '', ...d });
      state.items.push(it);
      await db.put('items', it);
    }
    p.lastEdited = state.items.find(i => i.projectId === p.id && i.variant === 'heading')?.id || null;
    await db.put('projects', p);
    openProject(p.id);
  }

  /* ---------------- Accounts: Supabase auth ---------------- */
  const USER_DOMAIN = 'users.dot.invalid';            // username accounts get a private, undeliverable email
  const sb = window.supabase?.createClient(SHARE.url, SHARE.key, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: 'dot-auth' },
  });
  let me = null;                                       // the signed-in user
  let appStarted = false;

  /* ---------------- Cloud copy of the account's boards ---------------- */
  // Local IndexedDB stays the fast working copy. Changes are queued (and the queue survives reloads),
  // pushed in batches to the dot_docs table, and images/videos go to a private per-account folder.
  const cloud = (() => {
    let pending = new Map();                           // "store|id" -> true when deleted
    let uploaded = new Set();                          // item ids whose file is already in storage
    let timer = null, flushing = null, status = 'synced';
    const k = name => `dot.${name}.${me.id}`;
    const save = () => { try { localStorage.setItem(k('pending'), JSON.stringify([...pending])); } catch {} };
    const saveUp = () => { try { localStorage.setItem(k('uploaded'), JSON.stringify([...uploaded])); } catch {} };
    const setStatus = st => { status = st; renderMe(); };
    const path = id => `${me.id}/${id}`;
    const media = () => sb.storage.from('dot-media');

    function start() {
      try { pending = new Map(JSON.parse(localStorage.getItem(k('pending')) || '[]')); } catch { pending = new Map(); }
      try { uploaded = new Set(JSON.parse(localStorage.getItem(k('uploaded')) || '[]')); } catch { uploaded = new Set(); }
      addEventListener('online', () => schedule(0));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
        else refresh();
      });
    }
    function queue(store, id, deleted = false) {
      if (!me) return;
      pending.set(`${store}|${id}`, deleted);
      save(); setStatus('syncing'); schedule();
    }
    function schedule(ms = 1500) { clearTimeout(timer); timer = setTimeout(flush, ms); }

    async function rowFor(key, deleted) {
      const [store, id] = key.split('|');
      const rec = deleted ? null : await db.get(store, id);
      if (!rec) {
        if (store === 'items' && uploaded.has(id)) { await media().remove([path(id)]).catch(() => {}); uploaded.delete(id); saveUp(); }
        return { kind: store, id, data: null, deleted: true };
      }
      const { blob, ...data } = rec;
      if (blob) {
        if (!uploaded.has(id)) {
          const { error } = await media().upload(path(id), blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
          if (error) throw error;
          uploaded.add(id); saveUp();
        }
        data.file = { type: blob.type || '', name: blob.name || rec.name || '' };
      }
      return { kind: store, id, data, deleted: false };
    }
    function flush() {
      if (flushing) return flushing;
      if (!me || !pending.size) { if (me && !pending.size) setStatus('synced'); return Promise.resolve(); }
      flushing = (async () => {
        const batch = [...pending];
        try {
          const rows = [];
          for (const [key, del] of batch) rows.push(await rowFor(key, del));
          for (let i = 0; i < rows.length; i += 200) {
            const { error } = await sb.from('dot_docs').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,kind,id' });
            if (error) throw error;
          }
          for (const [key, del] of batch) if (pending.get(key) === del) pending.delete(key);   // keep anything changed meanwhile
          save();
          setStatus(pending.size ? 'syncing' : 'synced');
        } catch (e) {
          console.warn('DOT sync', e);
          setStatus('offline');
          schedule(15000);
        } finally { flushing = null; }
        if (pending.size && status !== 'offline') schedule(300);
      })();
      return flushing;
    }

    // Bring down everything changed on other devices since the last pull.
    async function pull() {
      let since = null;
      try { since = localStorage.getItem(k('pulled')); } catch {}
      let changed = 0, newest = since;
      for (let from = 0; ; from += 1000) {
        let q = sb.from('dot_docs').select('kind,id,data,deleted,updated_at').order('updated_at').range(from, from + 999);
        if (since) q = q.gt('updated_at', since);
        const { data, error } = await q;
        if (error) throw error;
        for (const row of data) {
          newest = row.updated_at;
          if (pending.has(`${row.kind}|${row.id}`)) continue;          // a local change wins; it's on its way up
          changed++;
          if (row.deleted || !row.data) { await db.raw.del(row.kind, row.id); continue; }
          const rec = row.data;
          if (row.kind === 'items' && rec.file) {
            uploaded.add(rec.id);
            const old = await db.get('items', rec.id);
            rec.blob = old?.blob || null;
            if (!rec.blob) rec.needsFile = true;
          }
          await db.raw.put(row.kind, rec);
        }
        if (data.length < 1000) break;
      }
      saveUp();
      try { if (newest) localStorage.setItem(k('pulled'), newest); } catch {}
      return changed;
    }
    // Download a synced image/video that isn't on this device yet.
    async function fetchFile(it) {
      const { data, error } = await media().download(path(it.id));
      if (error) throw error;
      it.blob = new File([data], it.file?.name || it.name || 'file', { type: it.file?.type || data.type });
      delete it.needsFile;
      await db.raw.put('items', it);
      return it;
    }
    // Coming back to the tab: pick up changes made elsewhere.
    let lastRefresh = Date.now();
    async function refresh() {
      if (!me || !appStarted || Date.now() - lastRefresh < 20000 || endEdit) return;
      lastRefresh = Date.now();
      try {
        await flush();
        if (await pull()) await reloadState();
      } catch {}
    }
    return { start, queue, flush, pull, fetchFile, refresh, get status() { return status; }, uploaded: () => uploaded };
  })();

  async function loadState() {
    [state.projects, state.items, state.folders] = await Promise.all([db.all('projects'), db.all('items'), db.all('folders')]);
    state.folders.sort((a, b) => a.createdAt - b.createdAt);
    state.items.forEach(normalize);
    state.projects.sort((a, b) => a.createdAt - b.createdAt);
  }
  async function reloadState() {
    const cur = state.current;
    await loadState();
    if (!state.projects.length) return;
    if (state.projects.some(p => p.id === cur)) { renderProjects(); renderItems(); syncHistoryButtons(); }
    else openProject(state.projects[0].id);
    fetchMissingFiles();
  }
  // Images and videos synced from another device arrive in the background, current project first.
  let fetchingFiles = false;
  async function fetchMissingFiles() {
    if (fetchingFiles) return;
    fetchingFiles = true;
    try {
      for (;;) {
        const missing = state.items.filter(i => i.needsFile);
        if (!missing.length) break;
        const it = missing.find(i => i.projectId === state.current) || missing[0];
        try { await cloud.fetchFile(it); } catch { delete it.needsFile; continue; }
        urls.delete(it.id);
        const old = elOf(it.id);
        if (old) { const el = itemEl(it); if (state.sel.has(it.id)) el.classList.add('selected'); old.replaceWith(el); place(el, it); }
      }
    } finally { fetchingFiles = false; }
  }

  // The boards that were in this browser before accounts existed move into the first account that signs in here.
  async function adoptLegacy() {
    let owner = null;
    try { owner = localStorage.getItem('dot.legacyOwner'); } catch {}
    if (owner) return;
    try { localStorage.setItem('dot.legacyOwner', me.id); } catch {}
    const legacy = makeDb('dot-app');
    const [ps, its, fs] = await Promise.all([legacy.all('projects'), legacy.all('items'), legacy.all('folders')]);
    for (const f of fs) await db.put('folders', f);
    for (const p of ps) await db.put('projects', p);
    for (const it of its) await db.put('items', it);
  }

  /* ---------------- Login screen ---------------- */
  const auth = $('#auth');
  let signup = false;
  const displayName = u => {
    const m = u?.user_metadata || {};
    return m.full_name || m.name || m.username || (u?.email || '').split('@')[0] || 'You';
  };
  const subtitleOf = u => {
    const m = u?.user_metadata || {};
    if ((u?.email || '').endsWith('@' + USER_DOMAIN)) return '@' + (m.username || u.email.split('@')[0]);
    return u?.email || '';
  };
  function setAuthMode(up) {
    signup = up;
    $('#authGo').textContent = up ? 'Create account' : 'Log in';
    $('#authQ').textContent = up ? 'Have an account?' : 'New to DOT?';
    $('#authMode').textContent = up ? 'Log in' : 'Create an account';
    $('#authPass').autocomplete = up ? 'new-password' : 'current-password';
    $('#authErr').textContent = '';
  }
  function showLogin(msg = '') {
    document.body.classList.add('locked');
    auth.hidden = false;
    $('#authErr').textContent = msg;
    setTimeout(() => $('#authId').focus(), 50);
  }
  const friendly = e => {
    const m = (e?.message || String(e || '')).toLowerCase();
    if (m.includes('invalid login')) return 'That email/username and password don’t match.';
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('already exists')) return 'That account already exists — try logging in.';
    if (m.includes('password') && (m.includes('6') || m.includes('short') || m.includes('weak'))) return 'Use a password of at least 6 characters.';
    if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google sign-in isn’t switched on yet.';
    if (m.includes('fetch') || m.includes('network')) return 'Can’t reach DOT right now. Check your connection.';
    if (m.includes('rate') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
    return e?.message || 'Something went wrong. Try again.';
  };
  $('#authGoogle').insertAdjacentHTML('afterbegin', I.google);
  $('#authMode').onclick = () => setAuthMode(!signup);
  $('#authGoogle').onclick = async () => {
    try {
      sessionStorage.setItem('dot.intro', '1');
      if (location.hash) sessionStorage.setItem('dot.hash', location.hash);
    } catch {}
    try {                                              // don't send people to a raw error page if Google isn't switched on
      const st = await (await fetch(`${SHARE.url}/auth/v1/settings`, { headers: { apikey: SHARE.key } })).json();
      if (!st.external?.google) return $('#authErr').textContent = 'Google sign-in is coming soon — use email or a username for now.';
    } catch {}
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) $('#authErr').textContent = friendly(error);
  };
  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#authErr'), go = $('#authGo');
    const id = $('#authId').value.trim(), pass = $('#authPass').value;
    err.textContent = '';
    if (!id) return err.textContent = 'Enter your email or a username.';
    const isEmail = id.includes('@');
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return err.textContent = 'That email doesn’t look right.';
    if (!isEmail && !/^[a-z0-9._-]{3,24}$/i.test(id)) return err.textContent = 'Usernames are 3–24 letters, numbers, dots, dashes or underscores.';
    if (pass.length < 6) return err.textContent = 'Use a password of at least 6 characters.';
    const email = isEmail ? id : `${id.toLowerCase()}@${USER_DOMAIN}`;
    go.disabled = true; go.classList.add('busy');
    try {
      const res = signup
        ? await sb.auth.signUp({ email, password: pass, options: { data: isEmail ? {} : { username: id.toLowerCase() } } })
        : await sb.auth.signInWithPassword({ email, password: pass });
      if (res.error) throw res.error;
      if (!res.data.session) { err.textContent = 'Check your inbox to confirm your email, then log in.'; setAuthMode(false); return; }
      await startApp(res.data.session.user, true);
    } catch (ex) { err.textContent = friendly(ex); }
    finally { go.disabled = false; go.classList.remove('busy'); }
  });

  /* ---------------- Profile (bottom of the projects panel) ---------------- */
  function renderMe() {
    if (!me) return;
    const av = $('#meAv'), url = me.user_metadata?.avatar_url;
    av.innerHTML = '';
    if (url) av.append(Object.assign(new Image(), { src: url, alt: '', referrerPolicy: 'no-referrer' }));
    else av.textContent = displayName(me).slice(0, 1).toUpperCase();
    $('#meName').textContent = displayName(me);
    const st = cloud.status;
    $('#meSub').textContent = st === 'offline' ? 'Offline — saved here, will sync' : st === 'syncing' ? 'Syncing…' : subtitleOf(me);
    $('#me').dataset.sync = st;
  }
  async function signOut() {
    toast('Signing out…');
    await cloud.flush().catch(() => {});
    await sb.auth.signOut().catch(() => {});
    try { sessionStorage.clear(); } catch {}
    location.replace(location.pathname);
  }
  $('#meBtn').onclick = e => {
    const r = e.currentTarget.getBoundingClientRect();
    openCtx(r.left, r.top - 8, [
      { heading: subtitleOf(me) || displayName(me) },
      { label: 'Sign out', icon: I.signOut, action: signOut },
    ]);
    const c = $('#ctx'); c.style.top = Math.max(8, r.top - c.offsetHeight - 8) + 'px';
  };

  /* ---------------- "It all started with a dot" intro ---------------- */
  function playIntro() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return Promise.resolve();
    const ov = document.createElement('div');
    ov.className = 'intro';
    ov.innerHTML = '<div class="intro-grid"></div><div class="intro-dot"><span class="logo-mark"></span></div><p class="intro-type"><span></span><i></i></p>';
    document.body.append(ov);
    document.body.classList.add('intro-on');
    const dot = ov.querySelector('.intro-dot'), type = ov.querySelector('.intro-type span'), grid = ov.querySelector('.intro-grid');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let skip = false;
    const skipper = () => { skip = true; };
    ov.addEventListener('pointerdown', skipper);
    addEventListener('keydown', skipper, { once: true });
    return (async () => {
      await wait(250);
      dot.classList.add('in');
      await wait(700);
      const line = 'it all started with a dot.';
      for (const ch of line) { if (skip) break; type.textContent += ch; await wait(ch === ' ' ? 110 : 70); }
      type.textContent = line;
      if (!skip) await wait(900);
      ov.querySelector('.intro-type').classList.add('out');
      await wait(skip ? 0 : 350);
      // Copy the canvas's own dot grid so the two line up when the overlay fades.
      const cs = getComputedStyle(canvas);
      grid.style.backgroundPosition = cs.backgroundPosition;
      grid.style.backgroundSize = cs.backgroundSize;
      const maxR = Math.hypot(innerWidth, innerHeight) / 2 + 120;
      const t0 = performance.now(), dur = skip ? 300 : 1300;
      await new Promise(res => {
        const tick = now => {
          const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3), r = e * maxR;
          grid.style.setProperty('--r', r + 'px');
          t < 1 ? requestAnimationFrame(tick) : res();
        };
        requestAnimationFrame(tick);
      });
      // The centre dot flies to its home in the top-left corner.
      const to = $('#dotBtn').getBoundingClientRect(), from = dot.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
      dot.classList.add('fly');
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(1)`;
      await wait(skip ? 250 : 900);
      document.body.classList.remove('intro-on');
      ov.classList.add('done');
      await wait(450);
      ov.remove();
      removeEventListener('keydown', skipper);
    })();
  }

  /* ---------------- Start the app for a signed-in account ---------------- */
  async function startApp(user, intro = false) {
    if (appStarted) return;
    appStarted = true;
    me = user;
    try { sessionStorage.removeItem('dot.intro'); } catch {}
    auth.hidden = true;
    document.body.classList.remove('locked');
    const introDone = intro ? playIntro() : Promise.resolve();
    db.use('dot-u-' + me.id);
    cloud.start();
    renderMe();
    try { await cloud.flush(); await cloud.pull(); } catch (e) { console.warn('DOT sync', e); }
    await adoptLegacy().catch(e => console.warn('DOT migrate', e));
    await loadState();
    setTool('select');
    // Put back a share link that a Google sign-in redirect carried along.
    try { const h = sessionStorage.getItem('dot.hash'); if (h) { sessionStorage.removeItem('dot.hash'); history.replaceState(null, '', location.pathname + h); } } catch {}
    if (!state.projects.length) { if (!(await openSharedFromHash())) await seedWelcome(); }
    else {
      let last = null;
      try { last = localStorage.getItem('dot.current'); } catch {}
      openProject(state.projects.some(p => p.id === last) ? last : state.projects[0].id);
      openSharedFromHash();
    }
    fetchMissingFiles();
    cloud.flush();
    await introDone;
  }

  /* ---------------- Boot ---------------- */
  (async () => {
    if (!sb) return showLogin('Can’t load DOT’s sign-in right now. Check your connection and reload.');
    const { data } = await sb.auth.getSession();
    // Drop the one-time ?code= that Google sign-in leaves in the address bar.
    if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
    if (!data.session) {
      const qs = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
      return showLogin(qs.get('error_description') ? friendly({ message: qs.get('error_description') }) : '');
    }
    let intro = false;
    try { intro = sessionStorage.getItem('dot.intro') === '1'; } catch {}
    startApp(data.session.user, intro);
  })();
  sb?.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT' && appStarted) location.replace(location.pathname);
    if (ev === 'USER_UPDATED' && session) { me = session.user; renderMe(); }
  });
})();
