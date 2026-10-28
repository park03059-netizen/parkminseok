'use strict';

/* ---------- 올릴 곳 목록 ---------- */
const PLATFORMS = [
  { id: 'kakao', name: '카톡 프로필', w: 640, h: 640, maxKB: 500, shape: 'circle', mock: 'kakao', desc: '동그라미로 잘려 보여요' },
  { id: 'insta-feed', name: '인스타 피드', w: 1080, h: 1350, maxKB: 1024, mock: 'insta', desc: '세로형 4:5 피드 칸' },
  { id: 'insta-story', name: '인스타 스토리', w: 1080, h: 1920, maxKB: 1024, mock: 'story', desc: '휴대폰 화면 가득 9:16' },
  { id: 'youtube', name: '유튜브 썸네일', w: 1280, h: 720, maxKB: 2048, mock: 'youtube', desc: '16:9 · 2MB 제한' },
  { id: 'x-header', name: 'X 헤더', w: 1500, h: 500, maxKB: 2048, mock: 'xheader', desc: '프로필 위 3:1 배너' },
  { id: 'market', name: '중고거래 상품', w: 1000, h: 1000, maxKB: 800, mock: 'market', desc: '상품 상세 대표 사진' },
];

const state = {
  platformId: 'kakao',
  image: null,
  transforms: {},
  gif: { frames: [], delay: 0.5, fit: 'cover', platformId: 'insta-feed', width: 480, maxMB: 5, busy: false, last: null, overlays: [] },
  results: [],
};

/* ---------- 도구 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const getP = (id) => PLATFORMS.find((p) => p.id === id);
const curP = () => getP(state.platformId);
const getT = (id) => (state.transforms[id] ||= { zoom: 1, x: 0, y: 0 });
const fmtBytes = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))}KB` : `${(b / 1048576).toFixed(1)}MB`);
const fmtLimit = (kb) => (kb < 1024 ? `${kb}KB` : `${+(kb / 1024).toFixed(1)}MB`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let seq = 0;

/* ---------- 내 올릴 곳 (이 기기에 저장) ---------- */
const CUSTOM_KEY = 'matchphoto.customPlatforms';
const SHAPE_NAMES = { rect: '네모', rounded: '둥근 네모', circle: '동그라미' };

function makeCustom({ id, name, w, h, maxKB, shape }) {
  if (!SHAPE_NAMES[shape]) shape = 'rect';
  if (shape === 'circle') h = w;
  return {
    id: id || `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(name).trim().slice(0, 14),
    w: Math.round(w), h: Math.round(h), maxKB: Math.round(maxKB),
    shape, mock: 'custom', custom: true,
    desc: `내가 만든 · ${SHAPE_NAMES[shape]}`,
  };
}

function loadCustom() {
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && c.name && c.w > 0 && c.h > 0 && c.maxKB > 0 && /^custom-/.test(c.id))
      .map(makeCustom);
  } catch {
    return [];
  }
}

function saveCustom() {
  const list = PLATFORMS.filter((p) => p.custom).map(({ id, name, w, h, maxKB, shape }) => ({ id, name, w, h, maxKB, shape }));
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    toast('이 기기에 저장하지 못했어요');
  }
}

PLATFORMS.push(...loadCustom());

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  heart: svg('<path d="M12 20.5s-7.5-4.6-9.6-9.3A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.6 5c-2.1 4.7-9.6 9.3-9.6 9.3z"/>'),
  comment: svg('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.6L3.5 21l1.4-4.4A8.5 8.5 0 1 1 20.5 12z"/>'),
  send: svg('<path d="M21.5 3 10 14.5"/><path d="m21.5 3-7 18-4.5-6.5L3.5 10z"/>'),
  bookmark: svg('<path d="M6 3.5h12V21l-6-4.2L6 21z"/>'),
  chat: svg('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.6 4.6 4 5.8L6 20l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7s-4-6.7-9-6.7z"/>'),
  pen: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  back: svg('<path d="M15 5 8 12l7 7"/>'),
  more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  left: svg('<path d="M15 5 8 12l7 7"/>'),
  right: svg('<path d="m9 5 7 7-7 7"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
};

/* ---------- 실제 모양 틀 ---------- */
const MOCKS = {
  kakao: () => `
    <div class="mk-kakao-top"><span>${I.close}</span><span class="mk-icons">${I.gear}</span></div>
    <div class="mk-kakao-center">
      <div data-slot></div>
      <b class="mk-kakao-name">나</b>
      <small>상태메시지를 입력해 주세요</small>
    </div>
    <div class="mk-kakao-actions">
      <span>${I.chat}나와의 채팅</span><span>${I.pen}프로필 편집</span>
    </div>`,
  insta: () => `
    <div class="mk-ig-head"><span class="mk-ava ring"></span><b>my_account</b><span class="mk-sp"></span>${I.more}</div>
    <div data-slot></div>
    <div class="mk-ig-actions">${I.heart}${I.comment}${I.send}<span class="mk-sp"></span>${I.bookmark}</div>
    <div class="mk-ig-text"><b>좋아요 128개</b><span><b>my_account</b> 오늘의 사진</span><small>댓글 12개 모두 보기</small></div>`,
  story: () => `
    <div data-slot></div>
    <div class="mk-story-ui">
      <div class="mk-story-bars"><i class="on"></i><i></i><i></i></div>
      <div class="mk-story-user"><span class="mk-ava"></span><b>my_account</b><small>1시간</small><span class="mk-sp"></span>${I.close}</div>
      <div class="mk-sp"></div>
      <div class="mk-story-bottom"><span class="mk-story-input">메시지 보내기</span>${I.heart}${I.send}</div>
    </div>`,
  youtube: () => `
    <div class="mk-yt-thumb"><div data-slot></div><span class="mk-yt-time">12:34</span></div>
    <div class="mk-yt-info"><span class="mk-ava yt"></span><div><b>내 영상 제목이 이렇게 보여요</b><small>내 채널 · 조회수 1.2만회 · 1일 전</small></div>${I.more}</div>`,
  xheader: () => `
    <div class="mk-x-top">${I.back}<div><b>내 이름</b><small>게시물 128개</small></div></div>
    <div data-slot></div>
    <div class="mk-x-body">
      <div class="mk-x-row"><span class="mk-x-ava"></span><span class="mk-x-btn">프로필 수정</span></div>
      <b>내 이름</b><small>@my_handle</small>
      <p>소개글이 여기에 보여요. 헤더는 프로필 사진에 일부 가려져요.</p>
    </div>`,
  market: () => `
    <div class="mk-mk-wrap"><div data-slot></div><span class="mk-mk-back">${I.back}</span></div>
    <div class="mk-mk-seller"><span class="mk-ava mk-orange"></span><div><b>판매자닉네임</b><small>해운대구 우동</small></div><span class="mk-sp"></span><em>36.5°C</em></div>
    <div class="mk-mk-body"><b>사진 속 물건 팝니다</b><small>생활용품 · 3분 전</small><p>상태 좋아요. 직거래 원해요.</p></div>
    <div class="mk-mk-bar">${I.heart}<strong>25,000원</strong><span class="mk-sp"></span><span class="mk-mk-chat">채팅하기</span></div>`,
  custom: (p) => `
    <div class="mk-cu-head"><span class="mk-ava"></span><b>${esc(p.name)}</b><span class="mk-sp"></span>${I.more}</div>
    <div class="mk-cu-body"><div data-slot></div></div>
    <div class="mk-cu-foot"><span>${p.w}×${p.h}</span><span>${fmtLimit(p.maxKB)} 이하</span></div>`,
};

function buildMock(p, mediaEl, emptyText = '사진을 올려 주세요') {
  const wrap = document.createElement('div');
  wrap.className = `mk mk-${p.mock}`;
  wrap.innerHTML = MOCKS[p.mock](p);
  const media = document.createElement('div');
  media.className = 'mk-media' + (p.shape === 'circle' ? ' circle' : p.shape === 'rounded' ? ' rounded' : '');
  media.style.aspectRatio = `${p.w} / ${p.h}`;
  if (p.mock === 'custom') {
    const mediaW = Math.min(30, 26 * (p.w / p.h));
    media.style.width = `${mediaW}em`;
    wrap.style.width = `${Math.max(mediaW, 16) + 2}em`;
  }
  media.dataset.empty = emptyText;
  media.appendChild(mediaEl);
  wrap.querySelector('[data-slot]').replaceWith(media);
  return wrap;
}

/* ---------- 그리기 ---------- */
function drawPhoto(ctx, W, H, img, t = { zoom: 1, x: 0, y: 0 }, fit = 'cover') {
  ctx.fillStyle = img ? '#ffffff' : '#e6f4fd';
  ctx.fillRect(0, 0, W, H);
  if (!img) return;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const s = base * t.zoom;
  const dw = iw * s, dh = ih * s;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (W - dw) / 2 + t.x * W, (H - dh) / 2 + t.y * H, dw, dh);
}

function moveLimits(p, img, zoom) {
  const s = Math.max(p.w / img.naturalWidth, p.h / img.naturalHeight) * zoom;
  return {
    mx: Math.max(0, (img.naturalWidth * s - p.w) / 2 / p.w),
    my: Math.max(0, (img.naturalHeight * s - p.h) / 2 / p.h),
  };
}

function clampT(p, img, t) {
  const { mx, my } = moveLimits(p, img, t.zoom);
  t.x = clamp(t.x, -mx, mx);
  t.y = clamp(t.y, -my, my);
}

function paintCanvas(canvas, img, t, fit) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  drawPhoto(canvas.getContext('2d'), w, h, img, t, fit);
}

function mountStage(host, p, opt) {
  host._ro?.disconnect();
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  const mock = buildMock(p, canvas, opt.emptyText);
  if (opt.large) mock.classList.add('large');
  host.appendChild(mock);
  const media = mock.querySelector('.mk-media');
  const paint = () => {
    const img = opt.getImg();
    media.classList.toggle('empty', !img);
    paintCanvas(canvas, img, opt.getT ? opt.getT() : undefined, opt.fit ? opt.fit() : 'cover');
  };
  host._ro = new ResizeObserver(paint);
  host._ro.observe(canvas);
  paint();
  return { canvas, media, paint };
}

/* ---------- 내보내기 (크기·용량 자동 맞춤) ---------- */
async function exportPhoto(p, img, t) {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  drawPhoto(c.getContext('2d'), p.w, p.h, img, t);
  const limit = p.maxKB * 1024;
  const toBlob = (q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q));

  let q = 0.92, blob = await toBlob(q);
  if (blob.size > limit) {
    let lo = 0.3, hi = 0.92, best = null, bestQ = 0.3;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      const b = await toBlob(mid);
      if (b.size <= limit) { best = b; bestQ = mid; lo = mid; } else hi = mid;
    }
    blob = best || (await toBlob(0.3));
    q = bestQ;
  }
  return { blob, quality: q };
}

function addResult({ p, blob, w, h, type, note, limit }) {
  const d = new Date();
  const stamp = `${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const ext = type === 'gif' ? 'gif' : 'jpg';
  const r = {
    id: ++seq, p, blob, w, h, type, note, limit,
    url: URL.createObjectURL(blob),
    size: blob.size,
    name: `${p.name.replace(/[\s\\/:*?"<>|]/g, '') || 'photo'}_${w}x${h}_${stamp}.${ext}`,
  };
  state.results.unshift(r);
  updateBadge();
  return r;
}

function downloadResult(r) {
  const a = document.createElement('a');
  a.href = r.url;
  a.download = r.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportCurrent(download, btn, p = curP()) {
  if (!state.image) return toast('먼저 사진을 올려 주세요');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '맞추는 중…';
  try {
    const t = { ...getT(p.id) };
    clampT(p, state.image.img, t);
    const { blob, quality } = await exportPhoto(p, state.image.img, t);
    const r = addResult({ p, blob, w: p.w, h: p.h, type: 'jpg', note: `화질 ${Math.round(quality * 100)}%`, limit: p.maxKB * 1024 });
    if (download) downloadResult(r);
    toast(`${p.name} ${p.w}×${p.h} · ${fmtBytes(r.size)}로 맞췄어요${download ? '' : ' (결과에 담김)'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------- 사진 올리기 ---------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url, name: file.name });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')); };
    img.src = url;
  });
}

async function setImage(file) {
  if (!file || !file.type.startsWith('image/')) return toast('사진 파일만 올릴 수 있어요');
  try {
    const loaded = await loadImage(file);
    if (state.image) URL.revokeObjectURL(state.image.url);
    state.image = loaded;
    state.transforms = {};
    renderCurrent();
    updateTop();
    toast('사진을 올렸어요. 틀에 맞춰 보여 드릴게요');
  } catch (e) {
    toast(e.message);
  }
}

function bindDropzone(el, onFiles) {
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('over');
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  });
}

function selectPlatform(id) {
  state.platformId = id;
  renderCurrent();
  updateTop();
}

function specHTML(items) {
  return items.map(([k, v]) => `<span><em>${k}</em>${v}</span>`).join('');
}

/* ---------- 1. 올릴 곳 ---------- */
function renderHome() {
  const grid = $('#platformGrid');
  grid.innerHTML = '';
  PLATFORMS.forEach((p) => {
    const cell = document.createElement('div');
    cell.className = 'pcard-cell';
    const b = document.createElement('button');
    b.className = 'pcard' + (p.id === state.platformId ? ' on' : '') + (p.custom ? ' custom' : '');
    const k = 38;
    const sw = p.w >= p.h ? k : (k * p.w) / p.h;
    const sh = p.w >= p.h ? (k * p.h) / p.w : k;
    b.innerHTML = `
      <span class="pcard-shape-box"><span class="pcard-shape ${p.shape || ''}" style="width:${sw}px;height:${sh}px"></span></span>
      <span class="pcard-txt"><b>${esc(p.name)}</b><small>${p.w}×${p.h} · ${fmtLimit(p.maxKB)} 이하</small><em>${p.desc}</em></span>
      <span class="pcard-check">✓</span>`;
    b.onclick = () => selectPlatform(p.id);
    cell.appendChild(b);
    if (p.custom) {
      const x = document.createElement('button');
      x.className = 'pcard-del';
      x.title = `${p.name} 지우기`;
      x.setAttribute('aria-label', `${p.name} 지우기`);
      x.innerHTML = I.close;
      x.onclick = () => removeCustom(p.id);
      cell.appendChild(x);
    }
    grid.appendChild(cell);
  });

  const add = document.createElement('button');
  add.className = 'pcard pcard-add';
  add.innerHTML = '<span class="pcard-add-plus">+</span><b>내 올릴 곳 만들기</b>';
  add.onclick = openCustomDialog;
  grid.appendChild(add);

  const p = curP();
  mountStage($('#homePreview'), p, { getImg: () => state.image?.img, getT: () => getT(p.id) });
  $('#homeSpec').innerHTML = specHTML([['크기', `${p.w}×${p.h}`], ['용량', `${fmtLimit(p.maxKB)} 이하`], ['형식', 'JPG']]);
  $('#homeDropText').textContent = state.image ? `${state.image.name} · 눌러서 바꾸기` : '사진을 끌어다 놓거나 눌러서 고르세요';
  $('#homeDrop').classList.toggle('has', !!state.image);
  $('#homeDownload').disabled = !state.image;
  $('#homeToEdit').disabled = !state.image;
}

/* ---------- 2. 편집 ---------- */
let editStage = null;

function renderEdit() {
  const chips = $('#editChips');
  chips.innerHTML = '';
  PLATFORMS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip' + (p.id === state.platformId ? ' on' : '');
    b.textContent = p.name;
    b.onclick = () => selectPlatform(p.id);
    chips.appendChild(b);
  });

  mountEditStage();

  const has = !!state.image;
  $('#editFileText').textContent = has ? `사진 바꾸기 (${state.image.name})` : '사진 올리기';
  ['zoomRange', 'zoomIn', 'zoomOut', 'centerBtn', 'resetBtn', 'editDownload', 'editSave'].forEach((id) => ($('#' + id).disabled = !has));
  syncZoomUI();
  syncResUI();
}

/* 편집 화면에서 정한 해상도 (올릴 곳마다 따로) */
const editRes = {};
const SNAP_PX = 12;

function effP() {
  const p = curP();
  const r = editRes[p.id];
  return r ? { ...p, w: r.w, h: r.h } : p;
}

function mountEditStage() {
  const p = effP();
  editStage = mountStage($('#editStage'), p, {
    large: true,
    getImg: () => state.image?.img,
    getT: () => getT(p.id),
    emptyText: '오른쪽에서 사진을 올려 주세요',
  });
  editStage.media.insertAdjacentHTML('beforeend', '<div class="crosshair"><i class="ch-v"></i><i class="ch-h"></i></div><span class="snap-badge">가운데</span>');
  bindEditGestures(editStage.canvas, editStage.media);
  if (state.image) clampT(p, state.image.img, getT(p.id));
  paintEdit();
  $('#outInfo').textContent = `${p.w}×${p.h}`;
  $('#editSpec').innerHTML = specHTML([['크기', `${p.w}×${p.h}`], ['용량', `${fmtLimit(p.maxKB)} 이하로 자동 압축`], ['형식', 'JPG']]);
}

function paintEdit() {
  editStage.paint();
  paintOriginal();
}

function paintOriginal() {
  const box = $('#origBox'), cv = $('#origCanvas');
  const img = state.image?.img;
  box.classList.toggle('empty', !img);
  $('#origInfo').textContent = img ? `${img.naturalWidth}×${img.naturalHeight}` : '';
  if (!img) {
    box.style.width = box.style.height = '';
    return;
  }
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const availW = box.parentElement.clientWidth;
  const k = Math.min(availW / iw, 440 / ih);
  const bw = Math.max(1, Math.round(iw * k)), bh = Math.max(1, Math.round(ih * k));
  box.style.width = `${bw}px`;
  box.style.height = `${bh}px`;

  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(bw * dpr), h = Math.round(bh * dpr);
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // 틀에 들어가는 부분 표시
  const p = effP(), t = getT(p.id);
  const s = Math.max(p.w / iw, p.h / ih) * t.zoom;
  const dx = (p.w - iw * s) / 2 + t.x * p.w;
  const dy = (p.h - ih * s) / 2 + t.y * p.h;
  const fx = w / iw, fy = h / ih;
  const rx = (-dx / s) * fx, ry = (-dy / s) * fy, rw = (p.w / s) * fx, rh = (p.h / s) * fy;
  const shapePath = () => {
    ctx.beginPath();
    if (p.shape === 'circle') ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    else if (p.shape === 'rounded') ctx.roundRect(rx, ry, rw, rh, Math.min(rw, rh) * 0.06);
    else ctx.rect(rx, ry, rw, rh);
  };
  ctx.save();
  shapePath();
  ctx.rect(w, 0, -w, h);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.fill('evenodd');
  shapePath();
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();
  ctx.restore();
}

function syncZoomUI() {
  const t = getT(state.platformId);
  $('#zoomRange').value = t.zoom;
  $('#zoomVal').textContent = `${Math.round(t.zoom * 100)}%`;
}

function setZoom(z) {
  if (!state.image) return;
  const t = getT(state.platformId);
  t.zoom = clamp(z, 1, 5);
  clampT(effP(), state.image.img, t);
  syncZoomUI();
  paintEdit();
}

function showCenterBadge(media) {
  const b = media.querySelector('.snap-badge');
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

function bindEditGestures(canvas, media) {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.image) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 합성 포인터 등 캡처 불가 */ }
    const t = getT(state.platformId);
    drag = { x: e.clientX, y: e.clientY, rawX: t.x, rawY: t.y, snapX: t.x === 0, snapY: t.y === 0 };
    canvas.classList.add('grabbing');
    media.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = effP(), t = getT(p.id);
    const { mx, my } = moveLimits(p, state.image.img, t.zoom);
    drag.rawX = clamp(drag.rawX + (e.clientX - drag.x) / canvas.clientWidth, -mx, mx);
    drag.rawY = clamp(drag.rawY + (e.clientY - drag.y) / canvas.clientHeight, -my, my);
    drag.x = e.clientX;
    drag.y = e.clientY;

    // 가운데 가까이 오면 자석처럼 붙인다 (움직일 수 있는 방향만)
    const snapX = mx > 0 && Math.abs(drag.rawX) < SNAP_PX / canvas.clientWidth;
    const snapY = my > 0 && Math.abs(drag.rawY) < SNAP_PX / canvas.clientHeight;
    t.x = snapX ? 0 : drag.rawX;
    t.y = snapY ? 0 : drag.rawY;
    if ((snapX && !drag.snapX) || (snapY && !drag.snapY)) showCenterBadge(media);
    drag.snapX = snapX;
    drag.snapY = snapY;
    media.classList.toggle('snap-x', snapX || mx === 0);
    media.classList.toggle('snap-y', snapY || my === 0);
    paintEdit();
  });
  const end = () => {
    drag = null;
    canvas.classList.remove('grabbing');
    media.classList.remove('dragging', 'snap-x', 'snap-y');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    if (!state.image) return;
    e.preventDefault();
    setZoom(getT(state.platformId).zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
}

function syncResUI() {
  const p = effP();
  $('#resW').value = p.w;
  $('#resH').value = p.h;
  $('#resW').classList.remove('invalid');
  $('#resH').classList.remove('invalid');
  $('#resRatio').textContent = ratio(p.w, p.h);
  $('#resReset').disabled = !editRes[p.id];
}

function onResInput(which) {
  const base = curP();
  const cur = effP();
  const wEl = $('#resW'), hEl = $('#resH');
  const v = Number((which === 'w' ? wEl : hEl).value);
  const valid = (n) => Number.isInteger(n) && n >= 16 && n <= 6000;
  let w = which === 'w' ? v : Number(wEl.value);
  let h = which === 'h' ? v : Number(hEl.value);
  if ($('#resLock').checked && valid(v)) {
    if (which === 'w') { h = Math.round((v * cur.h) / cur.w); hEl.value = h; }
    else { w = Math.round((v * cur.w) / cur.h); wEl.value = w; }
  }
  wEl.classList.toggle('invalid', !valid(w));
  hEl.classList.toggle('invalid', !valid(h));
  if (!valid(w) || !valid(h)) return;
  if (w === base.w && h === base.h) delete editRes[base.id];
  else editRes[base.id] = { w, h };
  $('#resRatio').textContent = ratio(w, h);
  $('#resReset').disabled = !editRes[base.id];
  if (w * cur.h !== h * cur.w) mountEditStage();
  else {
    $('#outInfo').textContent = `${w}×${h}`;
    $('#editSpec').innerHTML = specHTML([['크기', `${w}×${h}`], ['용량', `${fmtLimit(base.maxKB)} 이하로 자동 압축`], ['형식', 'JPG']]);
  }
}

/* ---------- 3. GIF 만들기 ---------- */
let gifStage = null;
const gifAnim = { timer: null, i: 0 };

function renderGif() {
  const g = state.gif;
  const sel = $('#gifPlatform');
  sel.innerHTML = '';
  PLATFORMS.forEach((p) => sel.add(new Option(`${p.name} (${ratio(p.w, p.h)})`, p.id)));
  if (!getP(g.platformId)) g.platformId = 'insta-feed';
  sel.value = g.platformId;
  $('#gifDelay').value = g.delay;
  $('#gifDelayVal').textContent = `${g.delay}초`;
  $('#gifWidth').value = g.width;
  $('#gifMax').value = g.maxMB;
  document.querySelectorAll('#gifFit button').forEach((b) => b.classList.toggle('on', b.dataset.fit === g.fit));
  $('#gifCount').textContent = g.frames.length ? `${g.frames.length}장` : '';

  renderFrameStrip();

  const p = getP(g.platformId);
  gifStage = mountStage($('#gifStage'), p, {
    getImg: () => (g.frames.length ? g.frames[gifAnim.i % g.frames.length].img : null),
    fit: () => g.fit,
    emptyText: '사진을 여러 장 올려 주세요',
  });
  const [w, h] = gifSize();
  $('#gifSpec').innerHTML = specHTML([['크기', `약 ${w}×${h}`], ['용량', `${g.maxMB}MB 이하`], ['길이', `${(g.frames.length * g.delay).toFixed(1)}초`]]);
  $('#gifMake').disabled = g.busy || g.frames.length < 2;
  $('#gifTextBtn').disabled = $('#gifEmojiBtn').disabled = !g.frames.length;
  renderOverlays();
  renderGifDone();
  startGifAnim();
}

/* ---------- GIF 위 문구 · 이모티콘 ---------- */
const EMOJIS = ['😀', '😂', '🥰', '😍', '😎', '🤩', '😭', '😡', '🥳', '😴', '👍', '👏', '🙌', '🙏', '💪', '✌️', '👋', '🎉', '🎊', '🎂', '🎁', '🎈', '❤️', '💖', '💕', '✨', '⭐', '🔥', '💯', '🌈', '☀️', '🌸', '🍀', '🐶', '🐱', '🐰', '🐻', '🐥', '🍕', '☕'];
const OV_FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const BOB_STEP = 0.08;
const STICKER_STEP = 0.05;
const measureCtx = document.createElement('canvas').getContext('2d');

const STICKERS = [
  { id: 'chiikawa-dance', name: '치이카와 춤', type: 'image/gif' },
  { id: 'momonga', name: '모몽가', type: 'image/gif' },
  { id: 'hachiware', name: '하치와레 갸웃', type: 'image/png' },
].map((s) => ({ ...s, src: window.STICKER_DATA?.[s.id] || `stickers/${s.id}.${s.type.split('/')[1]}` }));
const STICKER_MAX = 360;
const stickerById = (id) => STICKERS.find((s) => s.id === id);

function stickerCanvas(src, w, h) {
  const k = Math.min(1, STICKER_MAX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// 움직이는 GIF를 장면별 그림과 끝나는 시각(초)으로 풀어 둔다. 내려받는 GIF에 그대로 그리기 위해서다.
function loadSticker(s) {
  s.ready ||= (async () => {
    const frames = [];
    let w, h;
    try {
      const bytes = s.src.startsWith('data:')
        ? Uint8Array.from(atob(s.src.slice(s.src.indexOf(',') + 1)), (ch) => ch.charCodeAt(0))
        : await (await fetch(s.src)).arrayBuffer();
      const dec = new ImageDecoder({ data: bytes, type: s.type });
      await dec.tracks.ready;
      const n = dec.tracks.selectedTrack.frameCount;
      let end = 0;
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        w = image.displayWidth; h = image.displayHeight;
        end += image.duration ? image.duration / 1e6 : 0.1;
        frames.push({ img: stickerCanvas(image, w, h), end });
        image.close();
      }
      dec.close();
    } catch {
      // ImageDecoder가 없는 브라우저: 첫 장면만 쓴다
      const img = new Image();
      img.src = s.src;
      await img.decode();
      w = img.naturalWidth; h = img.naturalHeight;
      frames.length = 0;
      frames.push({ img: stickerCanvas(img, w, h), end: 0.1 });
    }
    s.data = { frames, w, h, total: frames[frames.length - 1].end, animated: frames.length > 1 };
    return s.data;
  })();
  return s.ready;
}

function stickerFrame(d, t) {
  if (!d.animated) return d.frames[0].img;
  const tt = ((t % d.total) + d.total) % d.total;
  return (d.frames.find((f) => f.end > tt) || d.frames[d.frames.length - 1]).img;
}

const textOverlay = () => state.gif.overlays.find((o) => o.type === 'text');
const outlineColor = (c) => (c === '#0f172a' ? '#ffffff' : '#0f172a');

// 통통 튀는 주기: GIF 전체 길이에 딱 맞게 나눠 반복이 끊기지 않게 한다
function bobPeriod() {
  const total = state.gif.frames.length * state.gif.delay;
  return total > 0 ? total / Math.max(1, Math.round(total / 0.6)) : 0.6;
}

// 문구가 틀 너비를 넘지 않게 줄인 크기 (틀 너비 대비 비율)
function textSize(o) {
  measureCtx.font = `800 100px ${OV_FONT}`;
  const perUnit = measureCtx.measureText(o.content).width / 100;
  return perUnit > 0 ? Math.min(o.size, 0.92 / perUnit) : o.size;
}

function drawOverlays(ctx, W, H, t, overlays, period) {
  for (const o of overlays) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.type === 'text') {
      const px = textSize(o) * W;
      ctx.font = `800 ${px}px ${OV_FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = px * 0.2;
      ctx.strokeStyle = outlineColor(o.color);
      ctx.strokeText(o.content, o.x * W, o.y * H);
      ctx.fillStyle = o.color;
      ctx.fillText(o.content, o.x * W, o.y * H);
    } else if (o.type === 'sticker') {
      const d = stickerById(o.content)?.data;
      if (d) {
        const sw = o.size * W, sh = (sw * d.h) / d.w;
        if (d.animated) {
          ctx.drawImage(stickerFrame(d, t), o.x * W - sw / 2, o.y * H - sh / 2, sw, sh);
        } else {
          const u = (t / period + o.phase) % 1;
          const lift = Math.sin(Math.PI * u);
          const squash = Math.max(0, 1 - lift / 0.25);
          ctx.translate(o.x * W, o.y * H + sh / 2 - 0.35 * sh * lift);
          ctx.scale(1 + 0.12 * squash, 1 - 0.12 * squash);
          ctx.drawImage(d.frames[0].img, -sw / 2, -sh, sw, sh);
        }
      }
    } else {
      const px = o.size * W;
      const u = (t / period + o.phase) % 1;
      const lift = Math.sin(Math.PI * u);
      const squash = Math.max(0, 1 - lift / 0.25);
      ctx.translate(o.x * W, o.y * H + px / 2 - 0.35 * px * lift);
      ctx.scale(1 + 0.12 * squash, 1 - 0.12 * squash);
      ctx.font = `${px}px ${EMOJI_FONT}`;
      ctx.fillText(o.content, 0, -px / 2);
    }
    ctx.restore();
  }
}

function renderOverlays() {
  if (!gifStage) return;
  const media = gifStage.media;
  media.classList.add('ov-host');
  let layer = media.querySelector('.ov-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ov-layer';
    media.appendChild(layer);
  }
  layer.innerHTML = '';
  layer.hidden = !state.gif.frames.length;
  const period = bobPeriod();
  for (const o of state.gif.overlays) {
    if (o.type === 'text' && !o.content) continue;
    const el = document.createElement('div');
    el.className = `ov ov-${o.type}`;
    el.style.left = `${o.x * 100}%`;
    el.style.top = `${o.y * 100}%`;
    const body = document.createElement('span');
    body.className = 'ov-body';
    const s = o.type === 'sticker' ? stickerById(o.content) : null;
    if (s) {
      const img = document.createElement('img');
      img.src = s.src;
      img.alt = s.name;
      img.draggable = false;
      body.appendChild(img);
    } else {
      body.textContent = o.content;
    }
    if (o.type === 'text') {
      el.style.setProperty('--s', textSize(o));
      el.style.setProperty('--oc', outlineColor(o.color));
      el.style.color = o.color;
    } else {
      el.style.setProperty('--s', o.size);
      if (!s?.data?.animated) {
        body.classList.add('bob');
        body.style.animationDuration = `${period}s`;
        body.style.animationDelay = `${-o.phase * period}s`;
      }
    }
    const del = document.createElement('button');
    del.className = 'ov-del';
    del.setAttribute('aria-label', o.type === 'text' ? '문구 빼기' : '이모티콘 빼기');
    del.textContent = '×';
    del.onclick = () => removeOverlay(o);
    el.append(body, del);
    bindOverlayDrag(el, o, media);
    layer.appendChild(el);
  }
}

function bindOverlayDrag(el, o, media) {
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ov-del')) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* 합성 포인터 등 캡처 불가 */ }
    const r = media.getBoundingClientRect();
    drag = { dx: e.clientX - (r.left + o.x * r.width), dy: e.clientY - (r.top + o.y * r.height) };
    el.classList.add('moving');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = media.getBoundingClientRect();
    o.x = clamp((e.clientX - drag.dx - r.left) / r.width, 0, 1);
    o.y = clamp((e.clientY - drag.dy - r.top) / r.height, 0, 1);
    el.style.left = `${o.x * 100}%`;
    el.style.top = `${o.y * 100}%`;
  });
  const end = () => { drag = null; el.classList.remove('moving'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [lo, hi] = { text: [0.03, 0.25], emoji: [0.05, 0.5], sticker: [0.08, 0.8] }[o.type];
    o.size = clamp(o.size * Math.exp(-e.deltaY * 0.0012), lo, hi);
    el.style.setProperty('--s', o.type === 'text' ? textSize(o) : o.size);
  }, { passive: false });
}

function removeOverlay(o) {
  state.gif.overlays = state.gif.overlays.filter((x) => x !== o);
  if (o.type === 'text') {
    $('#gifTextInput').value = '';
    $('#gifTextBar').hidden = true;
  }
  renderOverlays();
}

function addEmoji(emoji, x, y) {
  if (!state.gif.frames.length) return toast('먼저 사진을 올려 주세요');
  const count = state.gif.overlays.filter((o) => o.type !== 'text').length;
  state.gif.overlays.push({ id: ++seq, type: 'emoji', content: emoji, x: clamp(x, 0, 1), y: clamp(y, 0, 1), size: 0.2, phase: (count * 0.37) % 1 });
  renderOverlays();
}

async function addSticker(id, x, y) {
  const s = stickerById(id);
  if (!s) return;
  if (!state.gif.frames.length) return toast('먼저 사진을 올려 주세요');
  try {
    await loadSticker(s);
  } catch {
    return toast('GIF 이모티콘을 불러오지 못했어요');
  }
  const count = state.gif.overlays.filter((o) => o.type !== 'text').length;
  state.gif.overlays.push({ id: ++seq, type: 'sticker', content: id, x: clamp(x, 0, 1), y: clamp(y, 0, 1), size: 0.32, phase: (count * 0.37) % 1 });
  renderOverlays();
}

function openTextBar() {
  if (!textOverlay()) state.gif.overlays.push({ id: 'text', type: 'text', content: '', x: 0.5, y: 0.85, size: 0.09, color: '#ffffff' });
  const o = textOverlay();
  $('#gifTextBar').hidden = false;
  $('#gifTextInput').value = o.content;
  document.querySelectorAll('#gifTextColors button').forEach((b) => b.classList.toggle('on', b.dataset.color === o.color));
  $('#gifTextInput').focus();
}

function initOverlayTools() {
  $('#gifTextBtn').onclick = openTextBar;
  $('#gifTextInput').addEventListener('input', (e) => {
    const o = textOverlay();
    if (!o) return;
    o.content = e.target.value;
    renderOverlays();
  });
  document.querySelectorAll('#gifTextColors button').forEach((b) => {
    b.onclick = () => {
      const o = textOverlay();
      if (!o) return;
      o.color = b.dataset.color;
      document.querySelectorAll('#gifTextColors button').forEach((x) => x.classList.toggle('on', x === b));
      renderOverlays();
    };
  });
  $('#gifTextDel').onclick = () => { const o = textOverlay(); if (o) removeOverlay(o); };

  const grid = $('#emojiGrid');
  EMOJIS.forEach((em) => {
    const b = document.createElement('button');
    b.className = 'emoji-btn';
    b.textContent = em;
    b.draggable = true;
    b.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-emoji', em);
      e.dataTransfer.effectAllowed = 'copy';
    });
    b.onclick = () => addEmoji(em, 0.5 + (Math.random() - 0.5) * 0.3, 0.45 + (Math.random() - 0.5) * 0.3);
    grid.appendChild(b);
  });
  const sgrid = $('#stickerGrid');
  STICKERS.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sticker-btn';
    b.title = s.name;
    b.setAttribute('aria-label', s.name);
    b.innerHTML = `<img src="${s.src}" alt=""><em>${s.type === 'image/gif' ? 'GIF' : 'PNG'}</em>`;
    b.draggable = true;
    b.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-sticker', s.id);
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setDragImage(b.querySelector('img'), 30, 30);
    });
    b.onclick = () => addSticker(s.id, 0.5 + (Math.random() - 0.5) * 0.3, 0.5 + (Math.random() - 0.5) * 0.3);
    sgrid.appendChild(b);
    loadSticker(s).catch(() => {});
  });
  const dlg = $('#emojiDialog');
  $('#gifEmojiBtn').onclick = () => (dlg.open ? dlg.close() : dlg.show());
  $('#emojiClose').onclick = () => dlg.close();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg.open) dlg.close(); });

  const host = $('#gifStage');
  const isEmoji = (e) => ['application/x-emoji', 'application/x-sticker'].some((t) => e.dataTransfer.types.includes(t));
  host.addEventListener('dragover', (e) => {
    if (!isEmoji(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    host.classList.add('drop-over');
  });
  host.addEventListener('dragleave', (e) => { if (!host.contains(e.relatedTarget)) host.classList.remove('drop-over'); });
  host.addEventListener('drop', (e) => {
    if (!isEmoji(e)) return;
    e.preventDefault();
    host.classList.remove('drop-over');
    const r = gifStage.media.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const sticker = e.dataTransfer.getData('application/x-sticker');
    if (sticker) addSticker(sticker, x, y);
    else addEmoji(e.dataTransfer.getData('application/x-emoji'), x, y);
  });
}

function ratio(a, b) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const d = gcd(a, b);
  return `${a / d}:${b / d}`;
}

function gifSize(scale = 1) {
  const p = getP(state.gif.platformId);
  const w = Math.max(80, Math.round(state.gif.width * scale));
  return [w, Math.max(40, Math.round((w * p.h) / p.w))];
}

function renderFrameStrip() {
  const strip = $('#frameStrip');
  const frames = state.gif.frames;
  strip.innerHTML = '';
  if (!frames.length) {
    strip.innerHTML = '<p class="strip-empty">아직 올린 사진이 없어요</p>';
    return;
  }
  let dragFrom = null;
  frames.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'frame';
    item.draggable = true;
    item.innerHTML = `
      <img src="${f.url}" alt="" draggable="false">
      <span class="frame-no">${i + 1}</span>
      <div class="frame-tools">
        <button title="앞으로" ${i === 0 ? 'disabled' : ''} data-act="l">${I.left}</button>
        <button title="빼기" data-act="x">${I.trash}</button>
        <button title="뒤로" ${i === frames.length - 1 ? 'disabled' : ''} data-act="r">${I.right}</button>
      </div>`;
    item.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.act === 'x') {
          URL.revokeObjectURL(f.url);
          frames.splice(i, 1);
        } else moveFrame(i, b.dataset.act === 'l' ? i - 1 : i + 1);
        renderGif();
      };
    });
    item.addEventListener('dragstart', (e) => {
      dragFrom = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      item.classList.add('over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('over'));
    item.addEventListener('drop', (e) => {
      if (dragFrom === null) return;
      e.preventDefault();
      e.stopPropagation();
      moveFrame(dragFrom, i);
      dragFrom = null;
      renderGif();
    });
    strip.appendChild(item);
  });
}

function moveFrame(from, to) {
  const f = state.gif.frames;
  const [x] = f.splice(from, 1);
  f.splice(to, 0, x);
}

async function addGifFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  for (const file of imgs) {
    try {
      const l = await loadImage(file);
      state.gif.frames.push({ id: ++seq, ...l });
    } catch { /* 읽을 수 없는 파일은 건너뜀 */ }
  }
  state.gif.last = null;
  renderGif();
  toast(`${imgs.length}장을 더했어요`);
}

function startGifAnim() {
  clearTimeout(gifAnim.timer);
  const tick = () => {
    const n = state.gif.frames.length;
    if (n) {
      gifAnim.i = (gifAnim.i + 1) % n;
      gifStage?.paint();
      document.querySelectorAll('#frameStrip .frame').forEach((el, k) => el.classList.toggle('playing', k === gifAnim.i));
    }
    gifAnim.timer = setTimeout(tick, state.gif.delay * 1000);
  };
  gifAnim.timer = setTimeout(tick, state.gif.delay * 1000);
}

function stopGifAnim() { clearTimeout(gifAnim.timer); }

async function makeGif() {
  const g = state.gif;
  if (g.frames.length < 2) return toast('사진을 2장 이상 올려 주세요');
  g.busy = true;
  $('#gifMake').disabled = true;
  $('#gifDone').hidden = true;
  const prog = $('#gifProgress');
  prog.hidden = false;
  const setProg = (ratio, text) => {
    prog.querySelector('i').style.width = `${Math.round(ratio * 100)}%`;
    prog.querySelector('span').textContent = text;
  };

  try {
    const maxBytes = g.maxMB * 1048576;
    const photos = g.frames.slice();
    await Promise.allSettled(g.overlays.filter((o) => o.type === 'sticker').map((o) => loadSticker(stickerById(o.content))));
    const overlays = g.overlays
      .filter((o) => (o.type === 'text' ? o.content : o.type !== 'sticker' || stickerById(o.content)?.data))
      .map((o) => ({ ...o }));
    const stickers = overlays.filter((o) => o.type === 'sticker');
    // 이모티콘이 튀거나 GIF 이모티콘이 움직이는 모습을 담으려면 한 장을 여러 장면으로 나눈다
    const moving = overlays.some((o) => o.type !== 'text');
    const step = stickers.some((o) => stickerById(o.content).data.animated) ? STICKER_STEP : BOB_STEP;
    const steps = moving ? Math.max(1, Math.round(g.delay / step)) : 1;
    const sub = g.delay / steps;
    const count = photos.length * steps;
    const delays = new Array(count).fill(sub);
    const period = bobPeriod();

    let scale = 1, bytes, w, h;
    for (let attempt = 0; attempt < 5; attempt++) {
      [w, h] = gifSize(scale);
      const base = document.createElement('canvas');
      base.width = w; base.height = h;
      const bctx = base.getContext('2d');
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      let basePhoto = -1;
      const getFrame = (i) => {
        const pi = Math.floor(i / steps);
        if (pi !== basePhoto) {
          drawPhoto(bctx, w, h, photos[pi].img, { zoom: 1, x: 0, y: 0 }, g.fit);
          basePhoto = pi;
        }
        ctx.drawImage(base, 0, 0);
        drawOverlays(ctx, w, h, i * sub, overlays, period);
        return ctx.getImageData(0, 0, w, h);
      };
      const label = attempt ? `용량을 줄여 다시 만드는 중 (${w}×${h})` : `GIF 만드는 중 (${w}×${h})`;
      bytes = await GifEncoder.encode({
        width: w, height: h, count, getFrame, delays,
        onProgress: (k, n) => setProg(k / n, `${label} · ${Math.ceil(k / steps)}/${photos.length}장`),
      });
      if (bytes.length <= maxBytes) break;
      scale *= Math.sqrt(maxBytes / bytes.length) * 0.95;
    }
    const p = getP(g.platformId);
    const blob = new Blob([bytes], { type: 'image/gif' });
    const kinds = [overlays.some((o) => o.type === 'text') && '문구', overlays.some((o) => o.type !== 'text') && '이모티콘'].filter(Boolean);
    const extra = kinds.length ? ` · ${kinds.join('·')} 포함` : '';
    g.last = addResult({ p, blob, w, h, type: 'gif', note: `${photos.length}장 · 장당 ${g.delay}초${extra}`, limit: maxBytes });
    toast(`GIF 완성! ${w}×${h} · ${fmtBytes(blob.size)}`);
  } catch (e) {
    console.error(e);
    toast('GIF를 만들지 못했어요');
  } finally {
    g.busy = false;
    prog.hidden = true;
    $('#gifMake').disabled = g.frames.length < 2;
    renderGifDone();
  }
}

function renderGifDone() {
  const r = state.gif.last;
  const box = $('#gifDone');
  if (!r || !state.results.includes(r)) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <img src="${r.url}" alt="완성된 GIF">
    <div><b>완성됐어요</b><small>${r.w}×${r.h} · ${fmtBytes(r.size)} (${fmtBytes(r.limit)} 이하 ✓)</small></div>
    <span class="mk-sp"></span>
    <button class="btn small" id="gifGoResult">결과 보기</button>
    <button class="btn small primary" id="gifDownload">내려받기</button>`;
  $('#gifDownload').onclick = () => downloadResult(r);
  $('#gifGoResult').onclick = () => (location.hash = '#result');
}

/* ---------- 4. 결과 ---------- */
function renderResults() {
  const grid = $('#resultGrid');
  grid.innerHTML = '';
  $('#resultFoot').hidden = !state.results.length;
  if (!zipBusy) $('#downloadAll').disabled = !state.results.length;
  if (!state.results.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-ill"></div>
        <b>아직 맞춘 사진이 없어요</b>
        <p>올릴 곳을 고르고 사진을 올린 뒤 내려받으면 여기에 모여요.</p>
        <a class="btn primary" href="#home">올릴 곳 고르러 가기</a>
      </div>`;
    return;
  }
  state.results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'rcard';
    const img = document.createElement('img');
    img.src = r.url;
    img.alt = r.name;
    const stage = document.createElement('div');
    stage.className = 'rcard-stage';
    stage.appendChild(buildMock(r.p, img));
    const ok = r.size <= r.limit;
    const info = document.createElement('div');
    info.className = 'rcard-info';
    info.innerHTML = `
      <div class="rcard-title"><b>${esc(r.p.name)}</b><span class="tag ${r.type}">${r.type.toUpperCase()}</span></div>
      <small>${r.w}×${r.h} · ${fmtBytes(r.size)} <span class="${ok ? 'ok' : 'warn'}">${ok ? '✓' : '!'} ${fmtBytes(r.limit)} 이하</span> · ${r.note}</small>
      <div class="rcard-btns">
        <button class="btn small" data-act="del">${I.trash}지우기</button>
        <button class="btn small primary" data-act="down" title="${esc(r.name)}">${I.download}받기</button>
      </div>`;
    info.querySelector('[data-act="down"]').onclick = () => downloadResult(r);
    info.querySelector('[data-act="del"]').onclick = () => {
      URL.revokeObjectURL(r.url);
      state.results = state.results.filter((x) => x !== r);
      updateBadge();
      renderResults();
    };
    card.append(stage, info);
    grid.appendChild(card);
  });
}

const ZIP_JPEG_QUALITY = 0.8;
let zipBusy = false;

// 사진(JPG)은 같은 크기 그대로 한 번 더 가볍게 저장해 보고, 10% 넘게 줄어들 때만 바꾼다
async function shrinkForZip(r) {
  if (r.type === 'gif') return r.blob;
  try {
    const bmp = await createImageBitmap(r.blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const smaller = await new Promise((res) => c.toBlob(res, 'image/jpeg', ZIP_JPEG_QUALITY));
    return smaller && smaller.size < r.blob.size * 0.9 ? smaller : r.blob;
  } catch {
    return r.blob;
  }
}

function zipName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  for (let n = 2; ; n++) {
    const next = `${name.slice(0, dot)}(${n})${name.slice(dot)}`;
    if (!used.has(next)) { used.add(next); return next; }
  }
}

async function downloadAll() {
  if (zipBusy || !state.results.length) return;
  zipBusy = true;
  const btn = $('#downloadAll');
  const label = $('#zipLabel');
  const setP = (p, text) => {
    btn.style.setProperty('--p', p.toFixed(3));
    label.textContent = `${text} ${Math.round(p * 100)}%`;
  };
  btn.disabled = true;
  btn.classList.remove('done');
  btn.classList.add('busy');
  setP(0, '용량 줄이는 중');
  const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));

  try {
    const list = state.results.slice().reverse();
    const used = new Set();
    const files = [];
    let before = 0;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const blob = await shrinkForZip(r);
      before += r.blob.size;
      files.push({ name: zipName(r.name, used), data: new Uint8Array(await blob.arrayBuffer()) });
      setP(((i + 1) / list.length) * 0.5, '용량 줄이는 중');
      await nextFrame();
    }
    const zip = await Zip.zip(files, { onProgress: (k) => setP(0.5 + k * 0.5, '압축하는 중') });
    btn.style.setProperty('--p', 1);
    label.textContent = `다 됐어요! ${fmtBytes(before)} → ${fmtBytes(zip.size)}`;

    const d = new Date();
    const stamp = `${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = `맞춤사진_전체${files.length}개_${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(`압축 파일로 받았어요 · ${files.length}개 · ${fmtBytes(zip.size)}`);
    btn.classList.add('done');
    await new Promise((res) => setTimeout(res, 1600));
  } catch (e) {
    console.error(e);
    toast('압축 파일을 만들지 못했어요');
  } finally {
    zipBusy = false;
    btn.classList.remove('busy', 'done');
    btn.style.setProperty('--p', 0);
    btn.disabled = !state.results.length;
    label.textContent = '전체 한번에 받기';
  }
}

/* ---------- 내 올릴 곳 만들기 창 ---------- */
let cfShape = 'rect';

function openCustomDialog() {
  $('#customForm').reset();
  $('#cfError').textContent = '';
  setCfShape('rect');
  $('#customDialog').showModal();
  $('#cfName').focus();
}

function setCfShape(shape) {
  cfShape = shape;
  document.querySelectorAll('#cfShape button').forEach((b) => b.classList.toggle('on', b.dataset.shape === shape));
  const h = $('#cfH');
  h.disabled = shape === 'circle';
  if (shape === 'circle') h.value = $('#cfW').value;
  updateCfPreview();
}

function readCustomForm() {
  const name = $('#cfName').value.trim();
  const w = Number($('#cfW').value);
  const h = cfShape === 'circle' ? w : Number($('#cfH').value);
  const size = Number($('#cfSize').value);
  const maxKB = $('#cfUnit').value === 'MB' ? size * 1024 : size;
  let error = '';
  if (!name) error = '이름을 넣어 주세요';
  else if (![w, h].every((v) => Number.isInteger(v) && v >= 16 && v <= 6000)) error = '크기는 16~6000px 사이의 정수로 넣어 주세요';
  else if (!(maxKB >= 10 && maxKB <= 50 * 1024)) error = '용량은 10KB~50MB 사이로 넣어 주세요';
  return { name, w, h, maxKB, shape: cfShape, error };
}

function updateCfPreview() {
  const { w, h, maxKB } = readCustomForm();
  const ok = w > 0 && h > 0;
  const k = 54;
  const box = $('#cfPreviewShape');
  box.className = `pcard-shape ${cfShape}`;
  box.style.width = `${ok ? (w >= h ? k : (k * w) / h) : k}px`;
  box.style.height = `${ok ? (w >= h ? (k * h) / w : k) : k}px`;
  $('#cfPreviewText').textContent = ok
    ? `${w}×${h} · ${ratio(w, h)}${maxKB > 0 ? ` · ${fmtLimit(Math.round(maxKB))} 이하` : ''}`
    : '크기를 넣어 주세요';
}

function submitCustom(e) {
  e.preventDefault();
  const f = readCustomForm();
  if (f.error) {
    $('#cfError').textContent = f.error;
    return;
  }
  const p = makeCustom(f);
  PLATFORMS.push(p);
  saveCustom();
  $('#customDialog').close();
  state.platformId = p.id;
  renderCurrent();
  updateTop();
  toast(`'${p.name}' 카드를 만들었어요`);
}

function removeCustom(id) {
  const i = PLATFORMS.findIndex((p) => p.id === id && p.custom);
  if (i < 0) return;
  const [p] = PLATFORMS.splice(i, 1);
  saveCustom();
  delete state.transforms[id];
  if (state.platformId === id) state.platformId = 'kakao';
  if (state.gif.platformId === id) state.gif.platformId = 'insta-feed';
  renderCurrent();
  updateTop();
  toast(`'${p.name}' 카드를 지웠어요`);
}

/* ---------- 화면 이동 ---------- */
const SCREENS = { home: renderHome, edit: renderEdit, gif: renderGif, result: renderResults };
let current = 'home';

function show(name) {
  if (!SCREENS[name]) name = 'home';
  current = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  document.querySelectorAll('.bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  if (name !== 'gif') stopGifAnim();
  window.scrollTo(0, 0);
  SCREENS[name]();
}

function renderCurrent() { SCREENS[current](); }

function updateBadge() {
  const b = $('#resultBadge');
  b.hidden = !state.results.length;
  b.textContent = state.results.length;
}

function updateTop() {
  const p = curP();
  $('#topStatus').innerHTML = `<span>올릴 곳 <b>${esc(p.name)}</b></span><span>사진 <b>${state.image ? '올림' : '없음'}</b></span>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- 연결 ---------- */
function init() {
  $('#homeFile').addEventListener('change', (e) => { setImage(e.target.files[0]); e.target.value = ''; });
  $('#editFile').addEventListener('change', (e) => { setImage(e.target.files[0]); e.target.value = ''; });
  bindDropzone($('#homeDrop'), (f) => setImage(f[0]));
  bindDropzone($('#editFileBtn'), (f) => setImage(f[0]));
  bindDropzone($('#editStage'), (f) => setImage(f[0]));
  bindDropzone($('#homePreview'), (f) => setImage(f[0]));

  $('#homeDownload').onclick = (e) => exportCurrent(true, e.currentTarget);
  $('#homeToEdit').onclick = () => (location.hash = '#edit');

  $('#zoomRange').addEventListener('input', (e) => setZoom(+e.target.value));
  $('#zoomIn').onclick = () => setZoom(getT(state.platformId).zoom + 0.1);
  $('#zoomOut').onclick = () => setZoom(getT(state.platformId).zoom - 0.1);
  $('#centerBtn').onclick = () => { const t = getT(state.platformId); t.x = 0; t.y = 0; paintEdit(); showCenterBadge(editStage.media); };
  $('#resetBtn').onclick = () => { state.transforms[state.platformId] = { zoom: 1, x: 0, y: 0 }; syncZoomUI(); paintEdit(); };
  $('#editDownload').onclick = (e) => exportCurrent(true, e.currentTarget, effP());
  $('#editSave').onclick = (e) => exportCurrent(false, e.currentTarget, effP());
  $('#resW').addEventListener('input', () => onResInput('w'));
  $('#resH').addEventListener('input', () => onResInput('h'));
  ['resW', 'resH'].forEach((id) => {
    const el = $('#' + id);
    el.addEventListener('blur', () => { if (el.classList.contains('invalid')) syncResUI(); });
    el.addEventListener('wheel', () => el.blur(), { passive: true });
  });
  $('#resReset').onclick = () => { delete editRes[state.platformId]; syncResUI(); mountEditStage(); };
  new ResizeObserver(() => { if (current === 'edit') paintOriginal(); }).observe($('#origCol'));

  $('#gifFile').addEventListener('change', (e) => { addGifFiles([...e.target.files]); e.target.value = ''; });
  bindDropzone($('#gifDrop'), addGifFiles);
  $('#gifPlatform').onchange = (e) => { state.gif.platformId = e.target.value; renderGif(); };
  $('#gifDelay').oninput = (e) => {
    state.gif.delay = +e.target.value;
    $('#gifDelayVal').textContent = `${state.gif.delay}초`;
    const [w, h] = gifSize();
    $('#gifSpec').innerHTML = specHTML([['크기', `약 ${w}×${h}`], ['용량', `${state.gif.maxMB}MB 이하`], ['길이', `${(state.gif.frames.length * state.gif.delay).toFixed(1)}초`]]);
  };
  $('#gifWidth').onchange = (e) => { state.gif.width = +e.target.value; renderGif(); };
  $('#gifMax').onchange = (e) => { state.gif.maxMB = +e.target.value; renderGif(); };
  document.querySelectorAll('#gifFit button').forEach((b) => (b.onclick = () => { state.gif.fit = b.dataset.fit; renderGif(); }));
  $('#gifMake').onclick = makeGif;
  initOverlayTools();

  $('#downloadAll').onclick = downloadAll;

  $('#customForm').addEventListener('submit', submitCustom);
  $('#customCancel').onclick = () => $('#customDialog').close();
  $('#customCancelX').onclick = () => $('#customDialog').close();
  $('#customDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  document.querySelectorAll('#cfShape button').forEach((b) => (b.onclick = () => setCfShape(b.dataset.shape)));
  $('#cfW').addEventListener('input', () => { if (cfShape === 'circle') $('#cfH').value = $('#cfW').value; updateCfPreview(); });
  ['cfH', 'cfSize', 'cfUnit'].forEach((id) => $('#' + id).addEventListener('input', updateCfPreview));
  $('#customForm').addEventListener('input', () => ($('#cfError').textContent = ''));

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  updateTop();
  updateBadge();
  show(location.hash.slice(1) || 'home');
}

init();
