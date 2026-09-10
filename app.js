/* ============================================================
   PersonCam – DOM-Referenzen
   ============================================================ */

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const settingsBtn = document.getElementById('settingsBtn');
const galleryBtn = document.getElementById('galleryBtn');
const pinGate = document.getElementById('pinGate');
const pinInput = document.getElementById('pinInput');
const pinBtn = document.getElementById('pinBtn');
const pinError = document.getElementById('pinError');
const appEl = document.getElementById('app');
const settingsPanel = document.getElementById('settingsPanel');
const galleryPanel = document.getElementById('galleryPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const closeGalleryBtn = document.getElementById('closeGalleryBtn');
const recordingsEl = document.getElementById('recordings');
const facesEl = document.getElementById('faces');
const clearRecordingsBtn = document.getElementById('clearRecordingsBtn');
const clearFacesBtn = document.getElementById('clearFacesBtn');
const pinChangeInput = document.getElementById('pinChangeInput');
const pinChangeBtn = document.getElementById('pinChangeBtn');
const sensitivityRange = document.getElementById('sensitivityRange');
const sensitivityValue = document.getElementById('sensitivityValue');
const autoRecordToggle = document.getElementById('autoRecordToggle');
const snapshotsToggle = document.getElementById('snapshotsToggle');
const statusDot = document.getElementById('statusDot');
const personLabel = document.getElementById('personLabel');
const cameraSelect = document.getElementById('cameraSelect');
const mirrorToggle = document.getElementById('mirrorToggle');

/* ============================================================
   Konfiguration
   ============================================================ */

const MODEL_BASE = 'mobilenet_v2';
const DETECT_INTERVAL_MS = 300;
const CONFIRM_HITS = 2;
const MAX_CONSECUTIVE_ERRORS = 5;
const DEFAULT_SENSITIVITY = 0.55;
const DB_NAME = 'PersonCamDB';
const DB_VERSION = 1;

let stream = null;
let running = false;
let detecting = false;
let detectionTimer = null;
let cocoModel = null;
let faceModel = null;
let consecutiveErrors = 0;
let hitCount = 0;
let personCount = 0;
let lastPersonSeen = false;
let recorder = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let recordingStopTimer = null;
let lastSnapshotAt = 0;
let settings = {
  sensitivity: DEFAULT_SENSITIVITY,
  autoRecord: true,
  snapshots: true,
  mirror: false
};
let db = null;

/* ============================================================
   Hilfsfunktionen
   ============================================================ */

function setStatus(text, state = '') {
  if (statusEl) statusEl.textContent = text;
  if (statusDot) statusDot.className = `status-dot ${state}`.trim();
}

function resizeOverlay() {
  if (!video.videoWidth || !video.videoHeight) return;
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

function drawHud() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (settings.mirror) {
    ctx.save();
    ctx.translate(overlay.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = 'rgba(0,255,140,.28)';
  ctx.lineWidth = 1;
  const step = Math.max(60, overlay.width / 12);
  for (let x = 0; x < overlay.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, overlay.height); ctx.stroke();
  }
  for (let y = 0; y < overlay.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(overlay.width, y); ctx.stroke();
  }
  if (settings.mirror) ctx.restore();
}

function drawBox(box, label, confidence) {
  const [x, y, w, h] = box;
  ctx.save();
  ctx.strokeStyle = '#00ff8c';
  ctx.fillStyle = 'rgba(0,255,140,.08)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00ff8c';
  ctx.shadowBlur = 12;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 16px system-ui';
  const text = `${label} ${Math.round(confidence * 100)}%`;
  const tw = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(0,20,15,.86)';
  ctx.fillRect(x, Math.max(0, y - 30), tw, 30);
  ctx.fillStyle = '#00ff8c';
  ctx.fillText(text, x + 9, Math.max(20, y - 9));
  const c = 12;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
  ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
  ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h);
  ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c);
  ctx.stroke();
  ctx.restore();
}

function drawFaceCircle(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#00ff8c';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00ff8c';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#00ff8c';
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('FACE SCAN', -r, -r - 10);
  ctx.restore();
}

function blobFromCanvas() {
  return new Promise(resolve => overlay.toBlob(resolve, 'image/jpeg', 0.88));
}

function pickRecorderMime() {
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

/* ============================================================
   IndexedDB
   ============================================================ */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains('recordings')) database.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
      if (!database.objectStoreNames.contains('faces')) database.createObjectStore('faces', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbAdd(store, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).add(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbClear(store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ============================================================
   PIN
   ============================================================ */

function getPin() {
  return localStorage.getItem('personcam_pin') || '1234';
}

function unlock() {
  if (pinInput.value === getPin()) {
    pinGate.classList.add('hidden');
    appEl.classList.remove('hidden');
    pinError.textContent = '';
    localStorage.setItem('personcam_unlocked', '1');
    initAfterUnlock();
  } else {
    pinError.textContent = 'Falsche PIN';
    pinInput.select();
  }
}

function changePin() {
  const p = pinChangeInput.value.trim();
  if (!/^\d{4,8}$/.test(p)) {
    alert('Bitte eine PIN mit 4–8 Ziffern eingeben.');
    return;
  }
  localStorage.setItem('personcam_pin', p);
  pinChangeInput.value = '';
  alert('PIN gespeichert.');
}

/* ============================================================
   Kamera
   ============================================================ */

async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices || !cameraSelect) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    cameraSelect.innerHTML = '';
    cameras.forEach((cam, i) => {
      const option = document.createElement('option');
      option.value = cam.deviceId;
      option.textContent = cam.label || `Kamera ${i + 1}`;
      cameraSelect.appendChild(option);
    });
  } catch (e) {
    console.warn('Kameras konnten nicht aufgelistet werden', e);
  }
}

async function startCamera() {
  if (running) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Dieser Browser unterstützt keinen Kamerazugriff. Bitte Safari/Chrome über HTTPS verwenden.');
    return;
  }

  try {
    const deviceId = cameraSelect?.value;
    const videoConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: { ideal: 'environment' }
    };
    if (deviceId) {
      delete videoConstraints.facingMode;
      videoConstraints.deviceId = { exact: deviceId };
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: true
    });

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    resizeOverlay();
    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus('Kamera läuft – KI-Modelle werden geladen…', 'ok');
    detectLoop();

    try {
      await loadModels();
      if (running) {
        setStatus('Bereit – Personen werden erkannt', 'ok');
      }
    } catch (e) {
      console.error('KI-Modelle konnten nicht geladen werden:', e);
      setStatus('Kamera läuft – KI-Modelle nicht verfügbar', 'warn');
      alert('Die Erkennungsmodelle konnten nicht geladen werden. Bitte Internetverbindung prüfen und erneut versuchen.');
    }
  } catch (e) {
    console.error('Kamerafehler:', e);
    const name = e?.name || '';
    let message = 'Kamera konnte nicht gestartet werden.';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      message = 'Kamerazugriff wurde verweigert. Bitte in den Browser-Einstellungen die Kamera erlauben.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      message = 'Keine Kamera gefunden.';
    } else if (name === 'NotReadableError') {
      message = 'Die Kamera wird bereits von einer anderen App verwendet.';
    }
    setStatus('Kamera nicht gestartet', 'error');
    alert(message);
  }
}

function stopCamera() {
  running = false;
  detecting = false;
  clearTimeout(detectionTimer);
  if (recordingStopTimer) clearTimeout(recordingStopTimer);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  recorder = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Kamera gestoppt');
  personLabel.textContent = '0 PERSONEN';
  countEl.textContent = '0';
  lastPersonSeen = false;
}

/* ============================================================
   KI-Modelle / Erkennung
   ============================================================ */

async function loadModels() {
  const [coco, face] = await Promise.all([
    cocoModel || cocoSsd.load({ base: MODEL_BASE }),
    faceModel || blazeface.load()
  ]);
  cocoModel = coco;
  faceModel = face;
}

async function detectLoop() {
  if (!running || detecting) return;
  detecting = true;
  try {
    resizeOverlay();
    drawHud();

    if (!cocoModel || !faceModel || video.readyState < 2) {
      detecting = false;
      if (running) detectionTimer = setTimeout(detectLoop, DETECT_INTERVAL_MS);
      return;
    }

    const [objects, faces] = await Promise.all([
      cocoModel.detect(video),
      faceModel.estimateFaces(video, false)
    ]);

    const people = objects.filter(o => o.class === 'person' && o.score >= Number(settings.sensitivity));
    if (people.length) {
      hitCount++;
      if (hitCount >= CONFIRM_HITS) {
        personCount = people.length;
        countEl.textContent = String(personCount);
        personLabel.textContent = `${personCount} PERSON${personCount === 1 ? '' : 'EN'}`;
        if (!lastPersonSeen) {
          lastPersonSeen = true;
          if (settings.autoRecord) startRecording();
        }
      }
      people.forEach(p => drawBox(p.bbox, 'PERSON', p.score));
    } else {
      hitCount = 0;
      personCount = 0;
      countEl.textContent = '0';
      personLabel.textContent = '0 PERSONEN';
      if (lastPersonSeen) {
        lastPersonSeen = false;
        scheduleStopRecording();
      }
    }

    if (faces?.length) {
      faces.forEach(face => {
        const tl = face.topLeft;
        const br = face.bottomRight;
        const x = Array.isArray(tl) ? tl[0] : tl.x;
        const y = Array.isArray(tl) ? tl[1] : tl.y;
        const bx = Array.isArray(br) ? br[0] : br.x;
        const by = Array.isArray(br) ? br[1] : br.y;
        const w = bx - x;
        const h = by - y;
        drawFaceCircle(x + w / 2, y + h / 2, Math.max(w, h) / 2);
      });
      if (settings.snapshots && Date.now() - lastSnapshotAt > 2500) {
        lastSnapshotAt = Date.now();
        await saveFaceSnapshot();
      }
    }

    consecutiveErrors = 0;
  } catch (e) {
    consecutiveErrors++;
    console.warn('Erkennung fehlgeschlagen:', e);
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      setStatus('Erkennung vorübergehend gestoppt', 'warn');
    }
  } finally {
    detecting = false;
    if (running) detectionTimer = setTimeout(detectLoop, DETECT_INTERVAL_MS);
  }
}

/* ============================================================
   Aufnahme
   ============================================================ */

function startRecording() {
  if (!stream || !window.MediaRecorder || (recorder && recorder.state !== 'inactive')) return;
  const mimeType = pickRecorderMime();
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (e) {
    console.warn('MediaRecorder nicht verfügbar:', e);
    return;
  }
  recordingChunks = [];
  recordingStartedAt = Date.now();
  recorder.ondataavailable = e => {
    if (e.data && e.data.size) recordingChunks.push(e.data);
  };
  recorder.onstop = saveRecording;
  recorder.start(500);
  setStatus('Aufnahme läuft', 'recording');
}

function scheduleStopRecording() {
  if (!recorder || recorder.state === 'inactive') return;
  if (recordingStopTimer) clearTimeout(recordingStopTimer);
  recordingStopTimer = setTimeout(() => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, 1500);
}

async function saveRecording() {
  if (!recordingChunks.length) return;
  const mime = recorder?.mimeType || 'video/webm';
  const blob = new Blob(recordingChunks, { type: mime });
  try {
    await dbAdd('recordings', {
      createdAt: Date.now(),
      duration: Date.now() - recordingStartedAt,
      type: mime,
      blob
    });
  } catch (e) {
    console.error('Aufnahme konnte nicht gespeichert werden:', e);
  }
  if (running) setStatus('Bereit – Personen werden erkannt', 'ok');
}

async function saveFaceSnapshot() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || overlay.width;
    canvas.height = video.videoHeight || overlay.height;
    const c = canvas.getContext('2d');
    if (settings.mirror) {
      c.translate(canvas.width, 0);
      c.scale(-1, 1);
    }
    c.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (blob) await dbAdd('faces', { createdAt: Date.now(), blob });
  } catch (e) {
    console.warn('Face-Snapshot fehlgeschlagen:', e);
  }
}

/* ============================================================
   Galerie
   ============================================================ */

function formatDate(ts) {
  return new Date(ts).toLocaleString('de-DE');
}

async function renderGallery() {
  const recordings = await dbGetAll('recordings');
  const faces = await dbGetAll('faces');
  recordingsEl.innerHTML = '';
  facesEl.innerHTML = '';

  if (!recordings.length) recordingsEl.innerHTML = '<p class="empty">Keine Aufnahmen vorhanden.</p>';
  recordings.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';
    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.playsInline = true;
    videoEl.src = URL.createObjectURL(item.blob);
    const info = document.createElement('div');
    info.textContent = formatDate(item.createdAt);
    wrap.append(videoEl, info);
    recordingsEl.appendChild(wrap);
  });

  if (!faces.length) facesEl.innerHTML = '<p class="empty">Keine Gesicht-Snapshots vorhanden.</p>';
  faces.sort((a, b) => b.createdAt - a.createdAt).forEach(item => {
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(item.blob);
    img.alt = 'Gesicht-Snapshot';
    const info = document.createElement('div');
    info.textContent = formatDate(item.createdAt);
    wrap.append(img, info);
    facesEl.appendChild(wrap);
  });
}

/* ============================================================
   Einstellungen
   ============================================================ */

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem('personcam_settings') || '{}');
    settings = { ...settings, ...stored };
  } catch {}
  sensitivityRange.value = settings.sensitivity;
  sensitivityValue.textContent = Number(settings.sensitivity).toFixed(2);
  autoRecordToggle.checked = !!settings.autoRecord;
  snapshotsToggle.checked = !!settings.snapshots;
  mirrorToggle.checked = !!settings.mirror;
  video.style.transform = settings.mirror ? 'scaleX(-1)' : '';
}

function saveSettings() {
  settings.sensitivity = Number(sensitivityRange.value);
  settings.autoRecord = autoRecordToggle.checked;
  settings.snapshots = snapshotsToggle.checked;
  settings.mirror = mirrorToggle.checked;
  sensitivityValue.textContent = settings.sensitivity.toFixed(2);
  video.style.transform = settings.mirror ? 'scaleX(-1)' : '';
  localStorage.setItem('personcam_settings', JSON.stringify(settings));
}

function initAfterUnlock() {
  loadSettings();
  openDB().then(database => { db = database; }).catch(console.error);
  listCameras();
}

/* ============================================================
   Events
   ============================================================ */

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
pinBtn.addEventListener('click', unlock);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));
galleryBtn.addEventListener('click', async () => {
  galleryPanel.classList.remove('hidden');
  await renderGallery();
});
closeGalleryBtn.addEventListener('click', () => galleryPanel.classList.add('hidden'));
clearRecordingsBtn.addEventListener('click', async () => {
  if (confirm('Alle Aufnahmen löschen?')) {
    await dbClear('recordings');
    renderGallery();
  }
});
clearFacesBtn.addEventListener('click', async () => {
  if (confirm('Alle Gesicht-Snapshots löschen?')) {
    await dbClear('faces');
    renderGallery();
  }
});
pinChangeBtn.addEventListener('click', changePin);
sensitivityRange.addEventListener('input', saveSettings);
autoRecordToggle.addEventListener('change', saveSettings);
snapshotsToggle.addEventListener('change', saveSettings);
mirrorToggle.addEventListener('change', saveSettings);
cameraSelect?.addEventListener('change', async () => {
  if (running) {
    stopCamera();
    await startCamera();
  }
});
video.addEventListener('loadedmetadata', resizeOverlay);
window.addEventListener('resize', resizeOverlay);

/* ============================================================
   Startzustand
   ============================================================ */

(function boot() {
  appEl.classList.add('hidden');
  pinGate.classList.remove('hidden');
  pinInput.focus();
  if (localStorage.getItem('personcam_unlocked') === '1') {
    // PIN bleibt beim erneuten Laden erforderlich.
    localStorage.removeItem('personcam_unlocked');
  }
})();
