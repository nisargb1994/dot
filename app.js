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
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
    front: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>'),
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
    rotate: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>'),
    resetRot: svg('<path d="M4 13a8 8 0 1 0 2.3-5.7"/><path d="M4 4.5V11h6.5"/>'),
    chevron: svg('<path d="m9 6 6 6-6 6"/>', 2),
    folder: svg('<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    newFolder: svg('<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>'),
    out: svg('<path d="M14 5h4.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>'),
    projects: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    addProject: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),
    keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>', 2),
    sidebar: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/>'),
    newProject: svg('<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>'),
  };
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = I[el.dataset.icon] || ''; });

  /* ---------------- IndexedDB ---------------- */
  const db = (() => {
    let dbp;
    const mem = { projects: new Map(), items: new Map(), folders: new Map() };
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open('dot-app', 2); } catch (e) { return rej(e); }
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
      all: store => tx(store, 'readonly', s => s.getAll(), 'all').catch(() => memOp(store, 'all')),
      put: (store, v) => tx(store, 'readwrite', s => s.put(v), 'put', v).catch(() => memOp(store, 'put', v)),
      del: (store, id) => tx(store, 'readwrite', s => s.delete(id), 'del', id).catch(() => memOp(store, 'del', id)),
    };
  })();

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
    const p = project();
    if (p.view) { view = { ...p.view }; applyView(); }
    else if (itemsHere().length) requestAnimationFrame(() => fitAll(false));
    else resetView();
  }

  /* ---------------- Collapsible sidebar ---------------- */
  const shell = $('.shell');
  function setCollapsed(v, animate = true) {
    if (shell.classList.contains('collapsed') === v) return;
    try { localStorage.setItem('dot.collapsed', v ? '1' : '0'); } catch {}
    let last = rect().left;
    if (!animate) shell.classList.add('no-anim');
    shell.classList.toggle('collapsed', v);
    $('#railProjects').classList.toggle('active', !v);
    $('#railProjects').setAttribute('aria-pressed', String(!v));
    if (!animate) { void shell.offsetWidth; shell.classList.remove('no-anim'); return; }
    // Keep the canvas content still on screen while the sidebar slides.
    const t0 = performance.now();
    const tick = () => {
      const l = rect().left;
      if (l !== last) { pan(last - l, 0); last = l; }
      if (performance.now() - t0 < 450) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const togglePanel = () => setCollapsed(!shell.classList.contains('collapsed'));

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
    refreshLinesFor(it.id);
  }

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
      el.className = 'item line';
      el.innerHTML = `<svg class="lsvg" aria-hidden="true"><path class="hit"/><path class="stroke"/><path class="head head-b"/><path class="head head-a"/></svg>
        <div class="lh" data-end="a" title="Drag onto an item to attach"></div><div class="lh lh-mid" data-end="m" title="Drag to curve"></div><div class="lh" data-end="b" title="Drag onto an item to attach"></div>`;
      place(el, it);
      return el;
    }

    if (it.kind === 'text') {
      el.className = `item text t-${it.variant}`;
      const t = document.createElement('div');
      t.className = 'txt';
      t.dataset.ph = TEXT[it.variant].ph;
      t.textContent = it.text || '';
      t.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'Escape' || (ev.key === 'Enter' && it.variant !== 'paragraph' && !ev.shiftKey)) { ev.preventDefault(); endEdit?.(); }
      });
      el.append(t);
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

      if (it.kind === 'image') {
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
      badge.textContent = it.kind === 'image' ? (it.blob ? 'Image' : 'Image link') : (it.blob ? 'Video' : 'Video link');
      el.append(media, badge);
    }

    for (const c of ['nw', 'ne', 'sw', 'se']) {
      const h = document.createElement('div');
      h.className = `handle h-${c}`;
      h.dataset.corner = c;
      el.append(h);
    }
    const rh = document.createElement('div');
    rh.className = 'rot-handle';
    rh.title = 'Drag to rotate · Shift for 15° steps';
    el.append(rh);
    place(el, it);
    return el;
  }

  async function addItem(data, at) {
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
    const ids = [...state.sel];
    for (const id of ids) await removeItem(id);
  }

  function setSelection(ids) { state.sel = new Set(ids); syncSel(); }
  function syncSel() {
    world.querySelectorAll('.item').forEach(el => el.classList.toggle('selected', state.sel.has(el.dataset.id)));
    world.classList.toggle('multi', state.sel.size > 1);
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
      const v = parseVideo(text);
      if (v && (v.provider === 'YouTube' || v.provider === 'Vimeo' || v.provider === 'file')) { e.preventDefault(); return addItem({ kind: 'video', url: text, name: text }, at); }
      if (/\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(text)) { e.preventDefault(); return addItem({ kind: 'image', url: text, name: text }, at); }
    }
    if (clipboard.length && !text) { e.preventDefault(); pasteAt(at); }
  });

  /* ---------------- Text editing ---------------- */
  let endEdit = null;                    // finishes the text edit in progress, if any
  function startEdit(it, el) {
    if (endEdit) endEdit();
    const t = el.querySelector('.txt');
    try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
    el.classList.add('editing');
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
      const v = t.innerText.replace(/\s+$/, '').replace(/^\s+/, '');
      if (!v) { removeItem(it.id); return; }
      t.textContent = v;
      if (v !== it.text) { it.text = v; db.put('items', it); }
      touch(it.id);
    };
    endEdit = done;
    t.addEventListener('blur', done);
  }

  /* ---------------- Pointer: move, resize, marquee, pan ---------------- */
  const panning = () => state.tool === 'hand' || state.space;

  world.addEventListener('pointerdown', e => {
    if (e.target.isContentEditable) { e.stopPropagation(); return; }   // caret placement while editing text
    const el = e.target.closest('.item');
    if (!el || e.button !== 0 || panning() || state.tool === 'line') return;   // hand/line tool: the canvas handles it
    e.stopPropagation();
    closeCtx();
    endEdit?.();
    const it = itemById(el.dataset.id);
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
    let group = [...state.sel].map(itemById).filter(Boolean).map(snapOf);
    bringToFront(group.map(g => g.it.id));
    const ref = it => it.kind === 'line' ? it.a : it;
    const s = { x: e.clientX, y: e.clientY, px: ref(prim).x, py: ref(prim).y };
    let moved = false, cloned = false;
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < 3) return;
      if (!moved) {
        moved = true;
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
      }
      let dx = (ev.clientX - s.x) / view.z, dy = (ev.clientY - s.y) / view.z;
      if (ev.shiftKey) {                                       // Shift = snap to the dots
        const p = snapWorld(s.px + dx, s.py + dy);
        dx = p.x - s.px; dy = p.y - s.py;
      }
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
    const ar = it.kind === 'text' ? null : it.w / it.h;
    const sx = corner.includes('w') ? -1 : 1, sy = corner.includes('n') ? -1 : 1;
    const th = (it.rot || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const R = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
    const c0 = { x: it.x + s.w / 2, y: it.y + s.h / 2 };
    const a = R(-sx * s.w / 2, -sy * s.h / 2);
    const anchor = { x: c0.x + a.x, y: c0.y + a.y };       // opposite corner, pinned in world space
    el.setPointerCapture(e.pointerId);
    el.classList.add('resizing');
    const move = ev => {
      const dX = (ev.clientX - s.x) / view.z, dY = (ev.clientY - s.y) / view.z;
      const lx = dX * cos + dY * sin, ly = -dX * sin + dY * cos;   // pointer delta in the item's own axes
      let w = s.w + sx * lx;
      if (ar) {                                                // keep the ratio, follow whichever axis moved more
        const wFromH = (s.h + sy * ly) * ar;
        if (Math.abs(wFromH - s.w) > Math.abs(w - s.w)) w = wFromH;
      }
      if (ev.shiftKey) { const step = GRID / view.z; w = Math.round(w / step) * step; }
      w = Math.max(MIN_W, Math.round(w));
      it.w = w;
      let h;
      if (ar) h = it.h = Math.round(w / ar);
      else { el.style.width = w + 'px'; h = contentH(it, el); }
      const v = R(sx * w / 2, sy * h / 2);
      it.x = Math.round((anchor.x + v.x - w / 2) * 100) / 100;
      it.y = Math.round((anchor.y + v.y - h / 2) * 100) / 100;
      place(el, it);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('resizing');
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
    const tip = document.createElement('div');
    tip.className = 'angle-tip';
    stage.append(tip);
    el.setPointerCapture(e.pointerId);
    el.classList.add('rotating');
    const move = ev => {
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
      db.put('items', it);
      touch(it.id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function rotateSelected(deg, absolute = false) {
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
    if (!el || e.target.isContentEditable || panning()) return;
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
    const move = ev => {
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

  function startMarquee(e) {
    const base = e.shiftKey ? new Set(state.sel) : new Set();
    if (!e.shiftKey) setSelection([]);
    const r = rect(), sx = e.clientX, sy = e.clientY;
    const boxes = [...world.querySelectorAll('.item')].map(el => ({ id: el.dataset.id, r: (el.classList.contains('line') ? el.querySelector('.stroke') : el).getBoundingClientRect() }));
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
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

  /* ---------------- Context menu ---------------- */
  const ctx = $('#ctx');
  function openCtx(x, y, entries) {
    ctx.innerHTML = '';
    for (const en of entries) {
      if (en === 'sep') { ctx.insertAdjacentHTML('beforeend', '<div class="ctx-sep"></div>'); continue; }
      if (en.heading) { const h = document.createElement('div'); h.className = 'ctx-label'; h.textContent = en.heading; ctx.append(h); continue; }
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

  const selectionEntries = () => {
    const n = state.sel.size;
    return [
      { label: 'Duplicate', icon: I.duplicate, hint: '⌘D', action: duplicate },
      { label: 'Copy', icon: I.copy, hint: '⌘C', action: () => copySelection() },
      { label: 'Cut', icon: I.cut, hint: '⌘X', action: () => { if (copySelection(true)) { toast(`Cut ${plural(clipboard.length, 'item')} — ⌘V to paste`); removeSelected(); } } },
      'sep',
      ...(selectedItems().some(i => i.kind !== 'line') ? [{ label: 'Rotate 90°', icon: I.rotate, action: () => rotateSelected(90) }] : []),
      ...(selectedItems().some(i => i.rot) ? [{ label: 'Reset rotation', icon: I.resetRot, action: () => rotateSelected(0, true) }] : []),
      { label: `New project from ${n > 1 ? plural(n, 'item') : 'selection'}`, icon: I.newProject, action: projectFromSelection },
      { label: 'Bring to front', icon: I.front, action: () => bringToFront([...state.sel]) },
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
        : it.kind === 'text' ? [{ label: 'Edit text', icon: I.edit, action: () => startEdit(it, el) }]
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
      { label: 'Add Image Link', icon: I.link, action: () => openAddModal('image', 'link', at) },
      { label: 'Add Video Link', icon: I.link, action: () => openAddModal('video', 'link', at) },
      'sep',
      { heading: 'Add connector' },
      { label: 'Add Line', icon: I.line, hint: 'A', action: () => {
        const { it } = createLine({ x: at.x, y: at.y }, { x: at.x + 200, y: at.y - 120 });
        db.put('items', it); touch(it.id); renderProjects();
      } },
      'sep',
      { heading: 'Add text' },
      ...Object.entries(TEXT).map(([variant, t]) => ({
        label: t.label, icon: I[variant],
        action: async () => { const { it, el } = await addItem({ kind: 'text', variant, text: '' }, at); startEdit(it, el); },
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
    ['Items', [['⌘C  ⌘X  ⌘V', 'Copy, cut, paste'], ['⌘D', 'Duplicate'], ['⌥ + drag', 'Duplicate while dragging'], ['⇧ + drag', 'Snap to the dots'], ['⌘A', 'Select all'], ['⌫', 'Delete']]],
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
    const Noun = kind === 'image' ? 'Image' : 'Video';
    const title = source === 'file' ? `Add ${Noun}` : `Add ${Noun} Link`;
    const sub = source === 'file'
      ? (kind === 'image' ? 'Upload an image (PNG, JPG, GIF, WebP…) from your computer.' : 'Upload a video (MP4, WebM, MOV…) from your computer.')
      : (kind === 'image' ? 'Paste a direct link to an image.' : 'Paste a YouTube, Vimeo, or direct video file link.');

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
        payload = { kind, url, name: url };
        submit.disabled = false;
        if (kind === 'image') {
          const img = new Image();
          img.onload = () => { if (my === seq) showPreview(img, hostOf(url), `${img.naturalWidth} × ${img.naturalHeight}`); };
          img.onerror = () => { if (my === seq) err.textContent = "Couldn't load a preview — you can still add it."; };
          img.src = url;
        } else {
          const v = parseVideo(url);
          const node = v.thumb ? Object.assign(new Image(), { src: v.thumb }) : null;
          showPreview(node, v.provider === 'file' ? 'Video file' : v.provider, hostOf(url));
        }
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
    if (!it || it.kind === 'text' || it.kind === 'line') return;
    lb.innerHTML = '<button class="lb-close" title="Close">×</button>';
    let node;
    if (it.kind === 'image') {
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
  $('#addProject').onclick = () => addProject();
  $('#addFolder').onclick = () => addFolder();
  $('#railProjects').onclick = togglePanel;
  // New project / folder from the bar: open the panel first so the name can be typed in place.
  $('#railAddProject').onclick = () => { setCollapsed(false); addProject(); };
  $('#railAddFolder').onclick = () => { setCollapsed(false); addFolder(); };
  $('#railShortcuts').onclick = openShortcuts;

  const typing = t => t.closest?.('input, textarea') || t.isContentEditable;
  document.addEventListener('keydown', e => {
    if (typing(e.target)) return;
    if (e.key === 'Escape') { closeCtx(); closeModal(); closeLightbox(); setSelection([]); if (state.tool === 'line') setTool('select'); return; }
    if (!modal.hidden || !lb.hidden) return;
    if (e.key === 'Alt') canvas.classList.add('alt');
    if (e.code === 'Space') { e.preventDefault(); if (!state.space) { state.space = true; canvas.classList.add('tool-hand'); } return; }
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'a') { e.preventDefault(); setSelection(itemsHere().map(i => i.id)); }
      if (e.key === 'd') { e.preventDefault(); duplicate(); }
      if (e.key === '\\') { e.preventDefault(); togglePanel(); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel.size) { e.preventDefault(); removeSelected(); }
    else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomCenter(1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(0.8); }
    else if (e.shiftKey && e.code === 'Digit0') zoomCenter(1 / view.z);
    else if (e.shiftKey && e.code === 'Digit1') fitAll();
    else if (e.key === 'v' || e.key === 'V') setTool('select');
    else if (e.key === 'h' || e.key === 'H') setTool('hand');
    else if (e.key === 'a' || e.key === 'A') setTool('line');
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

  /* ---------------- Boot ---------------- */
  (async () => {
    [state.projects, state.items, state.folders] = await Promise.all([db.all('projects'), db.all('items'), db.all('folders')]);
    state.folders.sort((a, b) => a.createdAt - b.createdAt);
    let collapsed = false;
    try { collapsed = localStorage.getItem('dot.collapsed') === '1'; } catch {}
    setCollapsed(collapsed, false);
    state.items.forEach(normalize);
    state.projects.sort((a, b) => a.createdAt - b.createdAt);
    setTool('select');
    if (!state.projects.length) return seedWelcome();
    let last = null;
    try { last = localStorage.getItem('dot.current'); } catch {}
    openProject(state.projects.some(p => p.id === last) ? last : state.projects[0].id);
  })();
})();
