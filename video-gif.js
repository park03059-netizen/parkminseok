'use strict';

/* ---------- 3-2. 동영상으로 GIF 만들기 (app.js 다음에 읽는다) ---------- */
const VIDEO_TYPES = [
  { label: 'MP4', exts: ['mp4', 'm4v'], mime: 'video/mp4' },
  { label: 'WEBM', exts: ['webm'], mime: 'video/webm' },
  { label: 'OGG', exts: ['ogg', 'ogv'], mime: 'video/ogg' },
  { label: 'MOV', exts: ['mov'], mime: 'video/quicktime' },
];
const VG_MAX_FPS = 30;
const VG_MAX_SCENES = 300;
const VG_MAX_SIDE = 480;
const VG_CUT_SHARE = 0.6;
const VE_THUMBS = 10;

const FILM = svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>');
const VI = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6.5 4h4v16h-4zM13.5 4h4v16h-4z" fill="currentColor"/></svg>',
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>'),
  left: svg('<path d="M15 5 8 12l7 7"/>'),
  right: svg('<path d="m9 5 7 7-7 7"/>'),
  down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
};
const VE_TOOLS = [
  { id: 'trim', name: '동영상', icon: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>') },
  { id: 'adjust', name: '조정', icon: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M12 12l3.5-3.5"/>') },
  { id: 'filter', name: '필터', icon: svg('<circle cx="9" cy="9.5" r="5"/><circle cx="15" cy="9.5" r="5"/><circle cx="12" cy="15" r="5"/>') },
  { id: 'crop', name: '자르기', icon: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>') },
];

/* ---------- 색 바꾸기: 3×4 색 행렬 [r행, g행, b행] (마지막 칸은 더하는 값 0~255) ---------- */
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

// a·b: b를 먼저 하고 a를 한다
function mulM(a, b) {
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j];
    r[i * 4 + 3] = a[i * 4] * b[3] + a[i * 4 + 1] * b[7] + a[i * 4 + 2] * b[11] + a[i * 4 + 3];
  }
  return r;
}
const mBright = (v) => { const k = 1 + v; return [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0]; };
const mContrast = (v) => { const k = 1 + v, o = 128 * (1 - k); return [k, 0, 0, o, 0, k, 0, o, 0, 0, k, o]; };
const mWarm = (v) => [1, 0, 0, 40 * v, 0, 1, 0, 6 * v, 0, 0, 1, -40 * v];
function mSat(v) {
  const s = 1 + v, lr = 0.2126 * (1 - s), lg = 0.7152 * (1 - s), lb = 0.0722 * (1 - s);
  return [lr + s, lg, lb, 0, lr, lg + s, lb, 0, lr, lg, lb + s, 0];
}
const SEPIA = [0.393, 0.769, 0.189, 0, 0.349, 0.686, 0.168, 0, 0.272, 0.534, 0.131, 0];

function adjustM({ brightness = 0, contrast = 0, saturation = 0, warmth = 0 }) {
  return mulM(mWarm(warmth), mulM(mSat(saturation), mulM(mContrast(contrast), mBright(brightness))));
}

const ADJUSTS = [
  { id: 'brightness', name: '밝기', k: 0.5 },
  { id: 'contrast', name: '대비', k: 0.5 },
  { id: 'saturation', name: '채도', k: 1 },
  { id: 'warmth', name: '따뜻함', k: 1 },
];
const FILTERS = [
  { id: 'none', name: '원본', m: IDENT },
  { id: 'vivid', name: '선명하게', m: adjustM({ contrast: 0.15, saturation: 0.4 }) },
  { id: 'warm', name: '따뜻하게', m: adjustM({ warmth: 0.45, saturation: 0.1 }) },
  { id: 'cool', name: '차갑게', m: adjustM({ warmth: -0.45 }) },
  { id: 'mono', name: '흑백', m: adjustM({ saturation: -1, contrast: 0.1 }) },
  { id: 'sepia', name: '세피아', m: SEPIA },
  { id: 'fade', name: '빛바랜', m: adjustM({ contrast: -0.3, saturation: -0.35, brightness: 0.06 }) },
  { id: 'drama', name: '드라마', m: adjustM({ contrast: 0.4, saturation: -0.4, brightness: -0.06 }) },
];
const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];
const editMatrix = (e) => mulM(adjustM(e.adjust), filterById(e.filter).m);
const isIdent = (m) => m.every((v, i) => Math.abs(v - IDENT[i]) < 1e-6);

function applyMatrix(ctx, w, h, m) {
  if (isIdent(m)) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
    d[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
    d[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- 상태 ---------- */
const vg = {
  file: null, type: null, url: null, video: null, meta: null, loadSeq: 0,
  // 편집: edit(지금 고치는 중) · saved(마지막으로 완료한 것). 취소하면 saved로 돌아간다
  edit: null, saved: null, tool: 'trim',
  // 변환: gp(GIF를 맞춘 올릴 곳) · phase: idle | cut(장면 자르는 중) | encode(GIF 만드는 중) | done
  gp: null, W: 0, H: 0, fps: 0,
  scenes: [], phase: 'idle', job: 0, dirty: false, scale: 1, gif: null, reTimer: null,
  canvas: null, img: null, media: null, stageFor: null,
};

const extOf = (name) => (name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
const baseName = (name) => name.replace(/\.[^.]+$/, '') || 'video';
const fmtDur = (s) => (s < 60 ? `${s.toFixed(1)}초` : `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`);
const toBlobP = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), type, q));
const cloneEdit = (e) => JSON.parse(JSON.stringify(e));
const sameEdit = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 짧은 동영상은 0.1초까지, 긴 동영상은 초까지 (예: 0:02 ~ 0:05)
function fmtClock(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return vg.meta.duration < 10 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function videoType(file) {
  const ext = extOf(file.name);
  return ext ? VIDEO_TYPES.find((t) => t.exts.includes(ext)) : VIDEO_TYPES.find((t) => t.mime === file.type);
}

function vgSize(p) {
  const k = Math.min(1, VG_MAX_SIDE / Math.max(p.w, p.h));
  return [Math.max(16, Math.round(p.w * k)), Math.max(16, Math.round(p.h * k))];
}

const planFps = (e) => Math.min(VG_MAX_FPS, VG_MAX_SCENES / Math.max(0.001, e.end - e.start));

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ---------- 동영상 열기 ---------- */
function openVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => { v.onloadeddata = v.onerror = null; resolve(v); };
    v.onerror = () => reject(new Error('video'));
    v.src = url;
  });
}

function releaseVideo(v) {
  if (!v) return;
  v.pause();
  v.removeAttribute('src');
  v.load();
}

function seekVideo(v, t) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); v.removeEventListener('seeked', done); resolve(); };
    const timer = setTimeout(done, 5000);
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

// MediaRecorder로 만든 WEBM처럼 처음에 길이가 안 나오는 동영상은 끝까지 넘겨 봐야 알 수 있다
async function videoDuration(v) {
  if (!Number.isFinite(v.duration)) {
    await seekVideo(v, 1e7);
    await seekVideo(v, 0);
  }
  return Number.isFinite(v.duration) ? v.duration : 0;
}

function showVideoError(msg) {
  const box = $('#vgFormats');
  $('#vgError').textContent = msg;
  $('#vgError').hidden = false;
  box.classList.remove('alert');
  void box.offsetWidth;
  box.classList.add('alert');
}

function clearVideoError() {
  $('#vgError').hidden = true;
  $('#vgFormats').classList.remove('alert');
}

async function setVideo(file) {
  if (!file) return;
  const type = videoType(file);
  if (!type) return showVideoError(`'${file.name}'은(는) 변환할 수 없는 형식이에요. 아래 형식의 동영상을 올려 주세요.`);
  const seqNo = ++vg.loadSeq;
  const url = URL.createObjectURL(file);
  $('#vgDropText').textContent = '동영상을 여는 중…';
  let video, duration;
  try {
    video = await openVideo(url);
    duration = await videoDuration(video);
    if (!duration || !video.videoWidth) throw new Error('empty');
  } catch {
    URL.revokeObjectURL(url);
    if (seqNo === vg.loadSeq) {
      renderVideoDrop();
      showVideoError(`'${file.name}'을(를) 열 수 없어요. 파일이 손상됐거나 이 브라우저가 읽지 못하는 방식으로 저장된 동영상이에요. 아래 형식으로 다시 올려 주세요.`);
    }
    return;
  }
  if (seqNo !== vg.loadSeq) { URL.revokeObjectURL(url); return; }
  clearVideo();
  video.muted = false;
  Object.assign(vg, { file, type, url, video, meta: { duration, w: video.videoWidth, h: video.videoHeight } });
  const [W, H] = vgSize(curP());
  Object.assign(vg, { W, H, tool: 'trim' });
  vg.saved = defaultEdit();
  vg.edit = cloneEdit(vg.saved);
  bindEditorVideo(video);
  clearVideoError();
  renderScenes();
  setVgProg(0, '위에서 편집을 마치고 완료를 누르면 GIF 변환을 시작해요');
  renderVideo();
  buildThumbs(seqNo);
}

function resetScenes() {
  vg.job++;
  clearTimeout(vg.reTimer);
  vg.scenes.forEach((s) => URL.revokeObjectURL(s.thumb));
  vg.scenes = [];
  setGif(null);
  vg.phase = 'idle';
  vg.dirty = false;
  renderScenes();
  showVgGif();
}

function clearVideo() {
  resetScenes();
  releaseVideo(vg.video);
  if (vg.url) URL.revokeObjectURL(vg.url);
  Object.assign(vg, { file: null, type: null, url: null, video: null, meta: null, edit: null, saved: null, gp: null });
}

function setGif(g) {
  if (vg.gif) URL.revokeObjectURL(vg.gif.url);
  vg.gif = g ? { ...g, url: URL.createObjectURL(g.blob), size: g.blob.size } : null;
}

/* ---------- 편집 칸 ---------- */
const RATIOS = [
  { id: 'platform', name: () => `${curP().name} (${ratio(curP().w, curP().h)})` },
  { id: 'original', name: () => '원본' },
  { id: 'square', name: () => '1:1' },
  { id: 'free', name: () => '자유' },
];

function ratioValue(id) {
  if (id === 'platform') return curP().w / curP().h;
  if (id === 'original') return vg.meta.w / vg.meta.h;
  if (id === 'square') return 1;
  return null;
}

// 가운데에 놓은 가장 큰 틀 (값은 동영상 가로·세로 대비 0~1)
function centeredCrop(r) {
  const vw = vg.meta.w, vh = vg.meta.h;
  if (!r) return { x: 0, y: 0, w: 1, h: 1 };
  let w = vw, h = vw / r;
  if (h > vh) { h = vh; w = vh * r; }
  return { x: (vw - w) / 2 / vw, y: (vh - h) / 2 / vh, w: w / vw, h: h / vh };
}

function defaultEdit() {
  return {
    start: 0, end: vg.meta.duration,
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    filter: 'none', ratio: 'platform', crop: centeredCrop(ratioValue('platform')), cropFor: curP().id,
  };
}

// 올릴 곳 화면에서 다른 곳을 고르면 '올릴 곳 비율' 틀도 따라 바꾼다
function fitCropToPlatform(e) {
  if (e && e.ratio === 'platform' && e.cropFor !== curP().id) {
    e.crop = centeredCrop(ratioValue('platform'));
    e.cropFor = curP().id;
  }
}

function minTrim() {
  const w = $('#veStrip').clientWidth || 400;
  return Math.min(vg.meta.duration, Math.max(0.1, (vg.meta.duration * 36) / w));
}

function drawRegionCover(ctx, W, H, src, sx, sy, sw, sh) {
  const s = Math.max(W / sw, H / sh);
  const dw = sw * s, dh = sh * s;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function veRender() {
  const v = vg.video, canvas = $('#veCanvas'), view = $('#veView');
  if (!v || !vg.edit || v.readyState < 2 || !view.clientWidth) return;
  const cropMode = vg.tool === 'crop';
  const e = vg.edit, vw = v.videoWidth, vh = v.videoHeight;
  const src = cropMode ? { x: 0, y: 0, w: 1, h: 1 } : e.crop;
  const sw = src.w * vw, sh = src.h * vh;
  const k = Math.min((view.clientWidth - 32) / sw, (view.clientHeight - 32) / sh);
  const cw = Math.max(1, Math.round(sw * k)), ch = Math.max(1, Math.round(sh * k));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(v, src.x * vw, src.y * vh, sw, sh, 0, 0, W, H);
  applyMatrix(ctx, W, H, editMatrix(e));
  if (cropMode) drawCropOverlay(ctx, W, H, e.crop, dpr);
}

function drawCropOverlay(ctx, W, H, c, dpr) {
  const x = c.x * W, y = c.y * H, w = c.w * W, h = c.h * H;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x, y, w, h);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    ctx.moveTo(x + (w * i) / 3, y); ctx.lineTo(x + (w * i) / 3, y + h);
    ctx.moveTo(x, y + (h * i) / 3); ctx.lineTo(x + w, y + (h * i) / 3);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeRect(x, y, w, h);
  const L = Math.min(22 * dpr, w / 3, h / 3);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4 * dpr;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy);
  }
  ctx.stroke();
  ctx.restore();
}

/* 재생 · 장면 이동 */
const scrub = { busy: false, want: null };

function scrubTo(t) {
  scrub.want = t;
  if (!scrub.busy) nextScrub();
}

function nextScrub() {
  if (scrub.want == null || !vg.video) return;
  scrub.busy = true;
  vg.video.currentTime = scrub.want;
  scrub.want = null;
}

function bindEditorVideo(v) {
  scrub.busy = false;
  scrub.want = null;
  v.addEventListener('seeked', () => {
    scrub.busy = false;
    if (v !== vg.video) return;
    veRender();
    syncHead();
    if (vg.tool === 'filter') renderFilterTiles();
    nextScrub();
  });
  v.addEventListener('play', () => { syncPlayIcon(); requestAnimationFrame(playLoop); });
  v.addEventListener('pause', syncPlayIcon);
}

function playLoop() {
  const v = vg.video;
  if (!v || v.paused) return;
  if (v.currentTime >= vg.edit.end) {
    v.pause();
    v.currentTime = vg.edit.end;
  }
  veRender();
  syncHead();
  requestAnimationFrame(playLoop);
}

function togglePlay() {
  const v = vg.video, e = vg.edit;
  if (!v) return;
  if (!v.paused) return v.pause();
  if (v.currentTime < e.start || v.currentTime >= e.end - 0.03) v.currentTime = e.start;
  v.play().catch(() => {
    v.muted = true;
    syncSound();
    v.play().catch(() => {});
  });
}

function syncPlayIcon() {
  const playing = vg.video && !vg.video.paused;
  $('#vePlay').innerHTML = playing ? VI.pause : VI.play;
  $('#vePlay').setAttribute('aria-label', playing ? '멈춤' : '재생');
}

function syncSound() {
  const muted = !vg.video || vg.video.muted;
  $('#veSound').innerHTML = muted ? VI.mute : VI.sound;
  $('#veSound').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
}

function syncHead() {
  if (!vg.video || !vg.meta) return;
  $('#veHead').style.left = `${(clamp(vg.video.currentTime, 0, vg.meta.duration) / vg.meta.duration) * 100}%`;
}

function syncTrim() {
  const e = vg.edit, d = vg.meta.duration;
  const a = (e.start / d) * 100, b = (e.end / d) * 100;
  $('#veShadeL').style.width = `${a}%`;
  $('#veShadeR').style.width = `${100 - b}%`;
  $('#veSel').style.left = `${a}%`;
  $('#veSel').style.width = `${b - a}%`;
  $('#veRange').textContent = `${fmtClock(e.start)} ~ ${fmtClock(e.end)}`;
  $('#veLen').textContent = `${(e.end - e.start).toFixed(1)}초 고름`;
  syncHead();
}

function syncNote() {
  const edited = !sameEdit(vg.edit, vg.saved);
  const note = $('#veNote');
  note.classList.toggle('edited', edited);
  note.textContent = edited
    ? '바꾼 내용이 위 화면에 보이고 있어요. 완료를 누르면 이대로 GIF를 만들어요.'
    : vg.gif || vg.phase !== 'idle' ? '' : '완료를 누르면 고른 구간으로 GIF 변환을 시작해요.';
  $('#veCancel').disabled = !edited;
}

function syncEditor() {
  if (!vg.edit) return;
  document.querySelectorAll('#veTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tool === vg.tool));
  document.querySelectorAll('#vgEditor .ve-panel').forEach((p) => (p.hidden = p.dataset.tool !== vg.tool));
  $('#veTitle').textContent = VE_TOOLS.find((t) => t.id === vg.tool).name;
  $('#veView').classList.toggle('crop', vg.tool === 'crop');
  syncTrim();
  ADJUSTS.forEach((a) => {
    const v = Math.round((vg.edit.adjust[a.id] / a.k) * 100);
    $(`#veAdj-${a.id}`).value = v;
    $(`#veAdjVal-${a.id}`).textContent = v > 0 ? `+${v}` : v;
  });
  document.querySelectorAll('#veFilters button').forEach((b) => b.classList.toggle('on', b.dataset.filter === vg.edit.filter));
  $('#veRatios').innerHTML = RATIOS.map((r) => `<button type="button" class="chip${vg.edit.ratio === r.id ? ' on' : ''}" data-ratio="${r.id}">${esc(r.name())}</button>`).join('');
  syncPlayIcon();
  syncSound();
  syncNote();
  if (vg.tool === 'filter') renderFilterTiles();
}

function setTool(id) {
  vg.tool = id;
  if (id === 'crop') vg.video?.pause();
  syncEditor();
  veRender();
}

function changed() {
  veRender();
  syncNote();
}

// 장면 줄: 동영상 전체를 작은 장면 10장으로 한 줄에 보여 준다
async function buildThumbs(seqNo) {
  const box = $('#veThumbs');
  box.innerHTML = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const tw = Math.max(24, (box.clientWidth || 600) / VE_THUMBS), th = box.clientHeight || 52;
  const tiles = Array.from({ length: VE_THUMBS }, () => {
    const c = document.createElement('canvas');
    c.width = Math.round(tw * dpr);
    c.height = Math.round(th * dpr);
    box.appendChild(c);
    return c;
  });
  let v;
  try {
    v = await openVideo(vg.url);
    for (let i = 0; i < VE_THUMBS; i++) {
      await seekVideo(v, Math.min(((i + 0.5) / VE_THUMBS) * vg.meta.duration, vg.meta.duration - 0.001));
      if (seqNo !== vg.loadSeq) break;
      const c = tiles[i];
      drawRegionCover(c.getContext('2d'), c.width, c.height, v, 0, 0, v.videoWidth, v.videoHeight);
    }
  } catch { /* 장면 줄 그림은 없어도 편집은 된다 */ }
  releaseVideo(v);
}

function renderFilterTiles() {
  const v = vg.video;
  if (!v || v.readyState < 2) return;
  const e = vg.edit, vw = v.videoWidth, vh = v.videoHeight, adj = adjustM(e.adjust);
  document.querySelectorAll('#veFilters canvas').forEach((c) => {
    const ctx = c.getContext('2d', { willReadFrequently: true });
    drawRegionCover(ctx, c.width, c.height, v, e.crop.x * vw, e.crop.y * vh, e.crop.w * vw, e.crop.h * vh);
    applyMatrix(ctx, c.width, c.height, mulM(adj, filterById(c.dataset.filter).m));
  });
}

function bindTrim() {
  const strip = $('#veStrip');
  let drag = null;
  const timeAt = (x) => {
    const r = strip.getBoundingClientRect();
    return (clamp((x - r.left) / r.width, 0, 1)) * vg.meta.duration;
  };
  strip.addEventListener('pointerdown', (ev) => {
    if (!vg.edit) return;
    ev.preventDefault();
    vg.video.pause();
    const h = ev.target.closest('.ve-handle')?.dataset.h || 'head';
    const r = strip.getBoundingClientRect();
    const at = h === 'head' ? null : vg.edit[h];
    drag = { id: ev.pointerId, h, off: at == null ? 0 : ev.clientX - (r.left + (at / vg.meta.duration) * r.width) };
    try { strip.setPointerCapture(ev.pointerId); } catch { /* 합성 포인터 등 캡처 불가 */ }
    $('#veTimes').classList.toggle('active', h !== 'head');
    move(ev);
  });
  const move = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const e = vg.edit, t = timeAt(ev.clientX - drag.off), gap = minTrim();
    if (drag.h === 'start') {
      e.start = clamp(t, 0, e.end - gap);
      scrubTo(e.start);
    } else if (drag.h === 'end') {
      e.end = clamp(t, e.start + gap, vg.meta.duration);
      scrubTo(Math.max(e.start, e.end - 0.001));
    } else {
      scrubTo(clamp(t, e.start, e.end));
      $('#veHead').style.left = `${(clamp(t, e.start, e.end) / vg.meta.duration) * 100}%`;
      return;
    }
    syncTrim();
    $('#veHead').style.left = `${((drag.h === 'start' ? e.start : e.end) / vg.meta.duration) * 100}%`;
    syncNote();
  };
  strip.addEventListener('pointermove', move);
  const end = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    drag = null;
    $('#veTimes').classList.remove('active');
  };
  strip.addEventListener('pointerup', end);
  strip.addEventListener('pointercancel', end);
}

function bindCrop() {
  const canvas = $('#veCanvas');
  let drag = null;
  const pointAt = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, r };
  };
  canvas.addEventListener('pointerdown', (ev) => {
    if (!vg.edit) return;
    if (vg.tool !== 'crop') return togglePlay();
    const pt = pointAt(ev), c = vg.edit.crop;
    const tx = 20 / pt.r.width, ty = 20 / pt.r.height;
    const corners = [
      { id: 'nw', x: c.x, y: c.y, fx: c.x + c.w, fy: c.y + c.h },
      { id: 'ne', x: c.x + c.w, y: c.y, fx: c.x, fy: c.y + c.h },
      { id: 'sw', x: c.x, y: c.y + c.h, fx: c.x + c.w, fy: c.y },
      { id: 'se', x: c.x + c.w, y: c.y + c.h, fx: c.x, fy: c.y },
    ];
    const hit = corners.find((k) => Math.abs(pt.x - k.x) < tx && Math.abs(pt.y - k.y) < ty);
    if (hit) drag = { pid: ev.pointerId, mode: 'resize', ...hit };
    else if (pt.x > c.x && pt.x < c.x + c.w && pt.y > c.y && pt.y < c.y + c.h) drag = { pid: ev.pointerId, mode: 'move', ox: pt.x - c.x, oy: pt.y - c.y };
    else return;
    ev.preventDefault();
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* 합성 포인터 등 캡처 불가 */ }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.pid) return;
    const e = vg.edit, c = e.crop, pt = pointAt(ev);
    if (drag.mode === 'move') {
      e.crop = { ...c, x: clamp(pt.x - drag.ox, 0, 1 - c.w), y: clamp(pt.y - drag.oy, 0, 1 - c.h) };
    } else {
      const vw = vg.meta.w, vh = vg.meta.h, minPx = 0.1 * Math.min(vw, vh);
      const fx = drag.fx * vw, fy = drag.fy * vh;
      const px = clamp(pt.x, 0, 1) * vw, py = clamp(pt.y, 0, 1) * vh;
      const dx = drag.id.includes('e') ? 1 : -1, dy = drag.id.includes('s') ? 1 : -1;
      const maxW = dx > 0 ? vw - fx : fx, maxH = dy > 0 ? vh - fy : fy;
      let w = Math.max(minPx, (px - fx) * dx), h = Math.max(minPx, (py - fy) * dy);
      const r = ratioValue(e.ratio);
      if (r) {
        if (w / h > r) w = h * r; else h = w / r;
        const s = Math.min(1, maxW / w, maxH / h);
        w *= s; h *= s;
      } else {
        w = Math.min(w, maxW);
        h = Math.min(h, maxH);
      }
      const x = dx > 0 ? fx : fx - w, y = dy > 0 ? fy : fy - h;
      e.crop = { x: x / vw, y: y / vh, w: w / vw, h: h / vh };
    }
    changed();
  });
  const end = (ev) => { if (drag && ev.pointerId === drag.pid) drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function initEditor() {
  $('#veTabs').innerHTML = VE_TOOLS.map((t) => `<button type="button" data-tool="${t.id}">${t.icon}<span>${t.name}</span></button>`).join('');
  $('#veTabs').onclick = (ev) => { const b = ev.target.closest('button'); if (b) setTool(b.dataset.tool); };

  $('#veAdjust').innerHTML = ADJUSTS.map((a) => `
    <label class="ve-adj">
      <span>${a.name}</span>
      <input type="range" id="veAdj-${a.id}" min="-100" max="100" step="1" value="0">
      <em id="veAdjVal-${a.id}">0</em>
    </label>`).join('');
  ADJUSTS.forEach((a) => {
    const input = $(`#veAdj-${a.id}`);
    input.addEventListener('input', () => {
      vg.edit.adjust[a.id] = (+input.value / 100) * a.k;
      $(`#veAdjVal-${a.id}`).textContent = +input.value > 0 ? `+${input.value}` : input.value;
      changed();
    });
    input.addEventListener('dblclick', () => { input.value = 0; input.dispatchEvent(new Event('input')); });
  });

  $('#veFilters').innerHTML = FILTERS.map((f) => `
    <button type="button" data-filter="${f.id}">
      <canvas width="128" height="128" data-filter="${f.id}"></canvas>
      <span>${f.name}</span>
    </button>`).join('');
  $('#veFilters').onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    vg.edit.filter = b.dataset.filter;
    document.querySelectorAll('#veFilters button').forEach((x) => x.classList.toggle('on', x === b));
    changed();
  };

  $('#veRatios').onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const e = vg.edit;
    e.ratio = b.dataset.ratio;
    if (e.ratio !== 'free') e.crop = centeredCrop(ratioValue(e.ratio));
    e.cropFor = curP().id;
    syncEditor();
    changed();
  };

  $('#veSel [data-h="start"]').innerHTML = VI.left;
  $('#veSel [data-h="end"]').innerHTML = VI.right;
  $('#vePlay').onclick = togglePlay;
  window.addEventListener('hashchange', () => vg.video?.pause());
  $('#veSound').onclick = () => {
    if (!vg.video) return;
    vg.video.muted = !vg.video.muted;
    syncSound();
  };
  $('#veReset').innerHTML = VI.reset;
  $('#veReset').onclick = () => {
    if (!vg.video) return;
    vg.video.pause();
    vg.edit = defaultEdit();
    scrubTo(0);
    syncEditor();
    changed();
    toast('편집을 처음 상태로 돌렸어요. 완료를 눌러야 GIF에 적용돼요');
  };
  $('#veCancel').onclick = () => {
    if (!vg.video) return;
    vg.video.pause();
    vg.edit = cloneEdit(vg.saved);
    scrubTo(vg.edit.start);
    syncEditor();
    changed();
    toast('편집 전으로 되돌렸어요');
  };
  $('#veDone').onclick = () => {
    if (!vg.video) return;
    vg.video.pause();
    vg.saved = cloneEdit(vg.edit);
    syncNote();
    convertVideo();
    $('#vgWork').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  bindTrim();
  bindCrop();
  new ResizeObserver(() => veRender()).observe($('#veView'));
}

/* ---------- 변환 ---------- */
async function convertVideo() {
  if (!vg.video) return;
  resetScenes();
  const job = vg.job;
  const p = curP();
  fitCropToPlatform(vg.saved);
  fitCropToPlatform(vg.edit);
  const e = cloneEdit(vg.saved);
  const [W, H] = vgSize(p);
  const L = Math.max(0.001, e.end - e.start);
  const fps = planFps(e);
  // 내림으로 세어야 1초에 fps장을 넘지 않는다. 남는 꼬리는 마지막 장면이 이어서 보여 준다
  const count = Math.max(1, Math.floor(L * fps + 1e-6));
  Object.assign(vg, { gp: p, W, H, fps, phase: 'cut', scale: 1 });
  renderVideo();
  setVgProg(0, '장면 자르는 중');

  let v;
  try {
    v = await openVideo(vg.url);
  } catch {
    if (job === vg.job) { vg.phase = 'idle'; setVgProg(0, '동영상을 다시 열지 못했어요'); syncVgButtons(); }
    return;
  }
  const vw = v.videoWidth, vh = v.videoHeight;
  const sx = e.crop.x * vw, sy = e.crop.y * vh, sw = e.crop.w * vw, sh = e.crop.h * vh;
  const m = editMatrix(e);
  const cap = document.createElement('canvas');
  cap.width = W; cap.height = H;
  const cctx = cap.getContext('2d', { willReadFrequently: true });
  const tk = Math.min(1, 140 / Math.max(W, H));
  const th = document.createElement('canvas');
  th.width = Math.max(1, Math.round(W * tk));
  th.height = Math.max(1, Math.round(H * tk));
  const tctx = th.getContext('2d');
  try {
    for (let i = 0; i < count; i++) {
      const start = e.start + i / fps;
      const end = i === count - 1 ? e.end : e.start + (i + 1) / fps;
      await seekVideo(v, Math.min((start + end) / 2, Math.max(0, vg.meta.duration - 0.001)));
      if (job !== vg.job) return;
      drawRegionCover(cctx, W, H, v, sx, sy, sw, sh);
      applyMatrix(cctx, W, H, m);
      tctx.drawImage(cap, 0, 0, th.width, th.height);
      showVgFrame(cap);
      const [blob, tblob] = await Promise.all([toBlobP(cap, 'image/jpeg', 0.95), toBlobP(th, 'image/jpeg', 0.8)]);
      if (job !== vg.job) return;
      const s = { id: ++seq, no: i + 1, start, end, blob, thumb: URL.createObjectURL(tblob) };
      vg.scenes.push(s);
      appendScene(s);
      setVgProg((VG_CUT_SHARE * (i + 1)) / count, `장면 자르는 중 · ${i + 1}/${count}장`);
    }
  } catch (err) {
    if (job !== vg.job) return;
    console.error(err);
    vg.phase = 'idle';
    setVgProg(0, '장면을 자르지 못했어요');
    syncVgButtons();
    return;
  } finally {
    releaseVideo(v);
  }
  await encodeVideoGif(job, VG_CUT_SHARE);
}

// 장면마다 원래 시각을 1/100초로 반올림해 길이를 정한다 (3·4·3… 으로 섞여 1초에 30장을 지킨다)
const sceneDelays = (list) => list.map((s) => Math.max(0.02, (Math.round(s.end * 100) - Math.round(s.start * 100)) / 100));

async function encodeVideoGif(job, base = 0) {
  if (job !== vg.job) return;
  clearTimeout(vg.reTimer);
  vg.phase = 'encode';
  vg.dirty = false;
  syncVgButtons();
  const list = vg.scenes.slice();
  const p = vg.gp, limit = p.maxKB * 1024;
  if (!list.length) {
    setGif(null);
    vg.phase = 'done';
    setVgProg(0, '남은 장면이 없어요. 다시 변환해 주세요');
    showVgGif();
    renderVgSpec();
    syncVgButtons();
    return;
  }
  const delays = sceneDelays(list);
  let scale = vg.scale, bytes, w, h;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      w = Math.max(16, Math.round(vg.W * scale));
      h = Math.max(16, Math.round(vg.H * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      const label = attempt ? `용량에 맞춰 줄이는 중 (${w}×${h})` : `GIF 만드는 중 (${w}×${h})`;
      bytes = await GifEncoder.encode({
        width: w, height: h, count: list.length, delays,
        getFrame: async (i) => {
          if (job !== vg.job) throw new Error('cancel');
          const bmp = await createImageBitmap(list[i].blob);
          ctx.drawImage(bmp, 0, 0, w, h);
          bmp.close();
          return ctx.getImageData(0, 0, w, h);
        },
        onProgress: (k, n) => { if (job === vg.job) setVgProg(base + ((1 - base) * k) / n, `${label} · ${k}/${n}장`); },
      });
      if (job !== vg.job) return;
      if (bytes.length <= limit || Math.min(w, h) <= 48) break;
      scale *= Math.sqrt(limit / bytes.length) * 0.95;
    }
  } catch (err) {
    if (job !== vg.job) return;
    console.error(err);
    vg.phase = 'done';
    setVgProg(0, 'GIF를 만들지 못했어요');
    syncVgButtons();
    return;
  }
  vg.scale = scale;
  setGif({ blob: new Blob([bytes], { type: 'image/gif' }), w, h, scenes: list, delays });
  showVgGif();
  if (vg.dirty) return encodeVideoGif(job);
  vg.phase = 'done';
  const ok = vg.gif.size <= limit;
  setVgProg(1, `완성! ${w}×${h} · ${fmtBytes(vg.gif.size)} · 장면 ${list.length}장 ${ok ? `(${fmtLimit(p.maxKB)} 이하 ✓)` : `(${fmtLimit(p.maxKB)}를 넘어요)`}`);
  renderVgSpec();
  syncVgButtons();
  syncNote();
  toast(`GIF 완성! ${p.name}에 맞춰 ${w}×${h} · ${fmtBytes(vg.gif.size)}`);
}

function setVgProg(r, text) {
  const el = $('#vgProgress');
  el.querySelector('i').style.width = `${Math.round(r * 100)}%`;
  el.querySelector('span').textContent = text;
}

function syncVgButtons() {
  const ready = vg.phase === 'done' && !!vg.gif && !vg.dirty;
  $('#vgDownload').disabled = !ready;
  $('#vgSend').disabled = !ready;
  $('#vgProgress').classList.toggle('busy', vg.phase === 'cut' || vg.phase === 'encode');
}

/* ---------- 만든 GIF 보기 ---------- */
function mountVgStage() {
  const host = $('#vgStage');
  const p = vg.gp || curP();
  const [W, H] = vg.gp ? [vg.W, vg.H] : vgSize(p);
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const mock = buildMock(p, canvas, '완료를 누르면 여기서 GIF가 움직여요');
  const media = mock.querySelector('.mk-media');
  const img = document.createElement('img');
  img.alt = '만든 GIF';
  img.hidden = true;
  media.appendChild(img);
  host.appendChild(mock);
  Object.assign(vg, { canvas, img, media, stageFor: `${p.id}:${W}x${H}` });
  showVgGif();
}

function showVgFrame(src) {
  if (!vg.canvas || vg.gif) return;
  vg.canvas.getContext('2d').drawImage(src, 0, 0, vg.canvas.width, vg.canvas.height);
  vg.canvas.hidden = false;
  vg.img.hidden = true;
  vg.media.classList.remove('empty');
}

function showVgGif() {
  if (!vg.media) return;
  const g = vg.gif;
  vg.img.hidden = !g;
  vg.canvas.hidden = !!g;
  if (g && vg.img.src !== g.url) vg.img.src = g.url;
  vg.media.classList.toggle('empty', !g && !vg.scenes.length);
  const last = vg.scenes[vg.scenes.length - 1];
  if (!g && last) createImageBitmap(last.blob).then((bmp) => { showVgFrame(bmp); bmp.close(); }).catch(() => {});
}

/* ---------- 장면 미리보기 ---------- */
const sceneName = (s) => `${baseName(vg.file.name)}_${String(s.no).padStart(3, '0')}.png`;

function sceneEl(s) {
  const el = document.createElement('div');
  el.className = 'vg-scene';
  el.style.aspectRatio = `${vg.W} / ${vg.H}`;
  el.innerHTML = `
    <img src="${s.thumb}" alt="" draggable="false">
    <span class="vg-scene-t">${String(s.no).padStart(3, '0')}</span>
    <div class="vg-scene-btns">
      <button data-act="down" title="이 장면 받기 (${esc(sceneName(s))})" aria-label="이 장면 받기">${VI.down}</button>
      <button data-act="x" title="이 장면 빼기" aria-label="이 장면 빼기">×</button>
    </div>`;
  el.querySelector('[data-act="down"]').onclick = () => downloadScene(s);
  el.querySelector('[data-act="x"]').onclick = () => removeScene(s, el);
  return el;
}

async function downloadScene(s) {
  try {
    const bmp = await createImageBitmap(s.blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const name = sceneName(s);
    downloadBlob(await toBlobP(c, 'image/png'), name);
    toast(`${name}(으)로 받았어요`);
  } catch {
    toast('장면을 받지 못했어요');
  }
}

function renderScenes() {
  const box = $('#vgScenes');
  box.innerHTML = '';
  if (!vg.scenes.length) box.innerHTML = '<p class="strip-empty">완료를 누르면 장면이 여기에 하나씩 나와요</p>';
  else vg.scenes.forEach((s) => box.appendChild(sceneEl(s)));
  updateSceneCount();
}

function appendScene(s) {
  const box = $('#vgScenes');
  box.querySelector('.strip-empty')?.remove();
  box.appendChild(sceneEl(s));
  updateSceneCount();
}

function updateSceneCount() {
  $('#vgSceneCount').textContent = `장면 ${vg.scenes.length}장`;
  renderVgSpec();
}

function removeScene(s, el) {
  if (!vg.scenes.includes(s)) return;
  vg.scenes = vg.scenes.filter((x) => x !== s);
  URL.revokeObjectURL(s.thumb);
  el.remove();
  if (!vg.scenes.length) renderScenes();
  else updateSceneCount();
  if (vg.phase === 'cut') return;
  vg.dirty = true;
  syncVgButtons();
  if (vg.phase === 'encode') return;
  setVgProg(0, '장면을 뺐어요. 빠진 대로 GIF를 다시 만들어요…');
  clearTimeout(vg.reTimer);
  const job = vg.job;
  vg.reTimer = setTimeout(() => encodeVideoGif(job), 600);
}

/* ---------- 화면 ---------- */
function renderVideoDrop() {
  $('#vgDropText').textContent = vg.file ? `${vg.file.name} · 다른 동영상은 끌어다 놓거나 파일 고르기` : '동영상을 여기에 끌어다 놓으세요';
  $('#vgDrop').classList.toggle('has', !!vg.file);
}

function renderVgInfo() {
  const { file, type, meta } = vg;
  $('#vgInfo').innerHTML = [
    ['파일 이름', esc(file.name)],
    ['형식', type.label],
    ['용량', fmtBytes(file.size)],
    ['길이', fmtDur(meta.duration)],
    ['가로×세로', `${meta.w}×${meta.h}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const p = vg.gp || curP(), cur = curP();
  const changedP = !!vg.gp && cur.id !== p.id;
  const [W, H] = vg.gp ? [vg.W, vg.H] : vgSize(p);
  $('#vgTarget').innerHTML = `
    <div class="vg-target-txt">
      <em>올릴 곳</em><b>${esc(p.name)}</b>
      <small>${W}×${H} 이내 · ${fmtLimit(p.maxKB)} 이하 · 1초에 최대 ${+planFps(vg.saved).toFixed(1)}장</small>
    </div>
    ${changedP ? `<p class="vg-changed">올릴 곳 화면에서 '${esc(cur.name)}'(으)로 바꿨어요.</p>` : ''}
    ${vg.gp ? `<button class="btn small${changedP ? ' primary' : ''}" id="vgReconvert">${changedP ? `'${esc(cur.name)}'에 맞춰 다시 변환` : '다시 변환'}</button>` : ''}`;
  if (vg.gp) $('#vgReconvert').onclick = convertVideo;
}

function renderVgSpec() {
  const p = vg.gp;
  if (!p) { $('#vgSpec').innerHTML = ''; return; }
  const g = vg.gif;
  $('#vgSpec').innerHTML = specHTML([
    ['크기', g ? `${g.w}×${g.h}` : `${vg.W}×${vg.H} 이내`],
    ['용량', g ? `${fmtBytes(g.size)} / ${fmtLimit(p.maxKB)}` : `${fmtLimit(p.maxKB)} 이하`],
    ['장면', `${vg.scenes.length}장`],
  ]);
}

function renderVideo() {
  renderVideoDrop();
  const has = !!vg.video;
  $('#vgEditor').hidden = !has;
  $('#vgWork').hidden = !has;
  if (!has) return;
  fitCropToPlatform(vg.edit);
  fitCropToPlatform(vg.saved);
  syncEditor();
  renderVgInfo();
  const p = vg.gp || curP();
  const [W, H] = vg.gp ? [vg.W, vg.H] : vgSize(p);
  if (vg.stageFor !== `${p.id}:${W}x${H}`) mountVgStage();
  renderVgSpec();
  syncVgButtons();
  requestAnimationFrame(veRender);
}

function downloadVideoGif() {
  if (!vg.gif || vg.dirty) return;
  const a = document.createElement('a');
  a.href = vg.gif.url;
  a.download = `${baseName(vg.file.name)}.gif`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast(`${a.download}(으)로 받았어요`);
}

// 장면을 한 장씩 넣지 않고, 다 만든 GIF 한 개를 사진으로 탭 미리보기에 원래 속도 그대로 넣는다
function sendVideoToPhotos() {
  const gif = vg.gif;
  if (!gif || vg.dirty) return;
  const g = state.gif;
  if (g.frames.length && !confirm(`사진 순서 줄에 있는 사진 ${g.frames.length}장 대신 동영상 GIF를 넣을까요?`)) return;
  g.frames.forEach((f) => URL.revokeObjectURL(f.url));
  g.frames = [];
  clearClip();
  g.clip = {
    url: URL.createObjectURL(gif.blob), w: gif.w, h: gif.h,
    scenes: gif.scenes.map((s) => s.blob), delays: gif.delays.slice(),
    duration: gif.delays.reduce((a, b) => a + b, 0), name: vg.file.name,
  };
  if (getP(vg.gp.id)) g.platformId = vg.gp.id;
  g.last = null;
  g.tab = 'photo';
  renderGif();
  window.scrollTo(0, 0);
  toast(`GIF를 사진으로 탭에 넣었어요 (${g.clip.duration.toFixed(1)}초). 문구와 이모티콘을 얹어 보세요`);
}

function initVideoGif() {
  document.querySelectorAll('#gifTabs button').forEach((b) => (b.onclick = () => {
    state.gif.tab = b.dataset.tab;
    if (b.dataset.tab !== 'video') vg.video?.pause();
    renderGif();
  }));
  $('#vgFmtList').innerHTML = VIDEO_TYPES.map((t) => `<span class="vg-fmt" title="${t.exts.map((e) => '.' + e).join(' ')}">${FILM}<b>${t.label}</b></span>`).join('');
  renderScenes();
  setVgProg(0, '동영상을 올리면 편집 칸이 열려요');
  initEditor();

  const drop = $('#vgDrop'), input = $('#vgFile');
  drop.onclick = (e) => { if (e.target !== input) input.click(); };
  input.addEventListener('change', (e) => { setVideo(e.target.files[0]); e.target.value = ''; });
  drop.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('over'); });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    if (files.length > 1) toast('동영상은 한 번에 하나만 올릴 수 있어요. 첫 번째 파일만 올릴게요');
    setVideo(files[0]);
  });
  $('#vgDownload').onclick = downloadVideoGif;
  $('#vgSend').onclick = sendVideoToPhotos;
}
