const video = document.getElementById('preview');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const recBadge = document.getElementById('recBadge');
const recordings = document.getElementById('recordings');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const graceInput = document.getElementById('grace');
const sensitivityInput = document.getElementById('sensitivity');

// --- KI-Einstellungen (bei Bedarf hier anpassen) ---
const MODEL_BASE = 'mobilenet_v2';    // genaueres Modell statt des Standards 'lite_mobilenet_v2' (etwas langsamer/größer)
const DETECT_INTERVAL_MS = 300;       // ca. 3 Erkennungen/Sek. – reicht locker und schont Akku/CPU
const CONFIRM_HITS = 2;               // so oft muss eine Person hintereinander erkannt werden, bevor eine NEUE Aufnahme startet
const MIN_BOX_HEIGHT_RATIO = 0.04;    // Erkennungen unter 4% der Bildhöhe zählen nicht (meist Fehlalarme, keine echten Personen)
const MAX_CONSECUTIVE_ERRORS = 5;     // nach so vielen Fehlern in Folge wird eine Warnung angezeigt

let stream, recorder, chunks = [], model;
let running = false, recording = false, stopTimer = null;
let lastVideoTime = -1;

// KI-Laufzeitzustand
let lastDetectAt = 0, detecting = false;
let personStreak = 0, consecutiveErrors = 0;

function setStatus(s){ statusEl.textContent = s; }

function getThreshold(){
  const raw = Number(sensitivityInput.value);
  if(Number.isNaN(raw)) return 0.55;
  return Math.min(0.9, Math.max(0.3, raw / 100));
}

async function startCamera(){
  if(running) return;

  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},
      audio:true
    });
  }catch(e){
    console.error(e);
    setStatus('Kamera konnte nicht gestartet werden');
    alert('Bitte erlaube den Kamera-/Mikrofonzugriff. Die Seite muss in der Regel über HTTPS oder localhost laufen.');
    return;
  }

  video.srcObject = stream;
  await video.play();
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  try{
    if(!model){
      setStatus('Kamera läuft – KI-Modell wird geladen…');
      model = await cocoSsd.load({ base: MODEL_BASE });
    }
    personStreak = 0;
    detecting = false;
    consecutiveErrors = 0;
    setStatus('Bereit – Personen werden erkannt');
    detectLoop();
  }catch(e){
    console.error(e);
    running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    stream?.getTracks().forEach(t=>t.stop());
    stream = null;
    video.srcObject = null;
    setStatus('KI-Modell konnte nicht geladen werden');
    alert('Das Erkennungsmodell konnte nicht geladen werden. Bitte Internetverbindung prüfen und erneut versuchen.');
  }
}

function stopCamera(){
  running = false;
  clearTimeout(stopTimer);
  stopTimer = null;
  if(recording) stopRecording();
  stream?.getTracks().forEach(t=>t.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  personStreak = 0;
  detecting = false;
  lastDetectAt = 0;
  consecutiveErrors = 0;
  setStatus('Gestoppt');
}

function boxIsBigEnough(bbox){
  const frameHeight = video.videoHeight || 720;
  return (bbox[3] / frameHeight) >= MIN_BOX_HEIGHT_RATIO;
}

async function detectLoop(){
  if(!running || !model) return;

  const now = performance.now();
  const newFrame = video.readyState >= 2 && video.currentTime !== lastVideoTime;

  if(newFrame && !detecting && (now - lastDetectAt) >= DETECT_INTERVAL_MS){
    lastVideoTime = video.currentTime;
    lastDetectAt = now;
    detecting = true;

    try{
      const threshold = getThreshold();
      const predictions = await model.detect(video);
      const people = predictions.filter(p =>
        p.class === 'person' && p.score >= threshold && boxIsBigEnough(p.bbox)
      );
      drawBoxes(people);

      if(people.length){
        if(stopTimer){ clearTimeout(stopTimer); stopTimer = null; }
        personStreak++;
        if(!recording){
          if(personStreak >= CONFIRM_HITS){
            startRecording();
          }else{
            setStatus(`Person erkannt – bestätige… (${personStreak}/${CONFIRM_HITS})`);
          }
        }
      }else{
        if(personStreak > 0 && !recording){
          setStatus('Bereit – Personen werden erkannt');
        }
        personStreak = 0;
        if(recording && !stopTimer){
          const seconds = Math.max(1, Number(graceInput.value) || 4);
          stopTimer = setTimeout(()=>{ stopTimer = null; stopRecording(); }, seconds*1000);
        }
      }
      consecutiveErrors = 0;
    }catch(err){
      console.error('Erkennung fehlgeschlagen:', err);
      consecutiveErrors++;
      if(consecutiveErrors >= MAX_CONSECUTIVE_ERRORS){
        setStatus('Erkennung läuft instabil – Seite bei Bedarf neu laden');
      }
    }finally{
      detecting = false;
    }
  }

  requestAnimationFrame(detectLoop);
}

function drawBoxes(people){
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font = 'bold 15px system-ui';

  for(const p of people){
    const [x,y,w,h] = p.bbox;
    const label = `PERSON ${Math.round(p.score*100)}%`;
    const labelWidth = ctx.measureText(label).width + 14;

    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = Math.max(3,canvas.width/400);
    ctx.strokeRect(x,y,w,h);

    ctx.fillStyle = '#00ff66';
    ctx.fillRect(x,Math.max(0,y-28),labelWidth,28);
    ctx.fillStyle = '#000';
    ctx.fillText(label,x+7,Math.max(19,y-8));
  }
}

function startRecording(){
  if(!stream || recording) return;
  chunks = [];
  const mime = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find(MediaRecorder.isTypeSupported);
  if(!mime){
    setStatus('Dieser Browser unterstützt keine passende Videoaufnahme.');
    return;
  }
  recorder = new MediaRecorder(stream,{mimeType:mime});
  recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  recorder.onstop = saveRecording;
  recorder.start(500);
  recording = true;
  recBadge.style.display='block';
  setStatus('Person erkannt – Aufnahme läuft');
}

function stopRecording(){
  if(!recorder || recorder.state === 'inactive') return;
  recorder.stop();
  recording = false;
  recBadge.style.display='none';
  setStatus('Aufnahme wird vorbereitet…');
}

function saveRecording(){
  const blob = new Blob(chunks,{type:recorder.mimeType || 'video/webm'});
  const url = URL.createObjectURL(blob);
  const time = new Date().toLocaleString('de-DE');
  const item = document.createElement('div');
  item.className='item';
  const a = document.createElement('a');
  a.href=url;
  a.download=`personcam-${Date.now()}.webm`;
  a.textContent=`Aufnahme vom ${time} – speichern`;
  item.appendChild(a);
  recordings.prepend(item);
  setStatus('Aufnahme fertig');
  chunks=[];
}

startBtn.addEventListener('click',startCamera);
stopBtn.addEventListener('click',stopCamera);
window.addEventListener('beforeunload',()=>stream?.getTracks().forEach(t=>t.stop()));
