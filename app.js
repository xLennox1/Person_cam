/* ============================================================
   PersonCam – DOM-Referenzen
   ============================================================ */
const pinScreen   = document.getElementById('pinScreen');
const pinInput    = document.getElementById('pinInput');
const pinError    = document.getElementById('pinError');
const pinSubmit   = document.getElementById('pinSubmit');

const appRoot   = document.getElementById('app');
const video     = document.getElementById('preview');
const canvas    = document.getElementById('overlay');
const ctx       = canvas.getContext('2d');
const statusEl  = document.getElementById('status');
const recBadge  = document.getElementById('recBadge');
const recTimerEl = document.getElementById('recTimer');
const startBtn  = document.getElementById('start');
const stopBtn   = document.getElementById('stop');

const settingsBtn      = document.getElementById('settingsBtn');
const lockBtn           = document.getElementById('lockBtn');
const settingsOverlay   = document.getElementById('settingsOverlay');
const closeSettingsBtn  = document.getElementById('closeSettings');

const graceInput                 = document.getElementById('grace');
const sensitivityInput           = document.getElementById('sensitivity');
const trackingEnabledInput       = document.getElementById('trackingEnabled');
const faceSnapshotsEnabledInput  = document.getElementById('faceSnapshotsEnabled');
const faceMinConfidenceInput     = document.getElementById('faceMinConfidence');
const faceCooldownInput          = document.getElementById('faceCooldown');

const changePinBtn   = document.getElementById('changePinBtn');
const changePinForm  = document.getElementById('changePinForm');
const currentPinInput= document.getElementById('currentPin');
const newPinInput    = document.getElementById('newPin');
const newPin2Input   = document.getElementById('newPin2');
const pinChangeMsg   = document.getElementById('pinChangeMsg');
const savePinBtn     = document.getElementById('savePinBtn');
const lockNowBtn     = document.getElementById('lockNowBtn');

const tabBtns          = document.querySelectorAll('.tab-btn');
const recordingsPanel  = document.getElementById('recordingsPanel');
const facesPanel       = document.getElementById('facesPanel');
const recordingsList   = document.getElementById('recordings');
const recordingsEmpty  = document.getElementById('recordingsEmpty');
const clearVideosBtn   = document.getElementById('clearVideos');
const faceGallery      = document.getElementById('faceGallery');
const facesEmpty       = document.getElementById('facesEmpty');
const clearFacesBtn    = document.getElementById('clearFaces');

const lightbox          = document.getElementById('lightbox');
const lightboxImg       = document.getElementById('lightboxImg');
const lightboxDownload  = document.getElementById('lightboxDownload');
const lightboxDelete    = document.getElementById('lightboxDelete');
const closeLightboxBtn  = document.getElementById('closeLightbox');

/* ============================================================
   Konfiguration
   ============================================================ */
const MODEL_BASE = 'lite_mobilenet_v2';
const DETECT_INTERVAL_MS = 300;
const CONFIRM_HITS = 2;
const MIN_BOX_HEIGHT_RATIO = 0.04;
const MAX_CONSECUTIVE_ERRORS = 5;
const TRACK_TIMEOUT_MS = 2000;
const TRACK_MATCH_DIST = 0.25;
const DB_NAME = 'personcam-db';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';
const STORE_FACES = 'faces';
const DEFAULT_PIN = '1234';
const PBKDF2_ITERATIONS = 150000;

function setStatus(s){ statusEl.textContent = s; }
function formatDuration(totalSeconds){ const m=Math.floor(totalSeconds/60); const s=totalSeconds%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function formatFilenameStamp(ts){ const d=new Date(ts); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; }
function bytesToBase64(bytes){ let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b)); return btoa(bin); }
function base64ToBytes(b64){ const bin=atob(b64); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i); return bytes; }

let dbPromise=null;
function getDB(){ if(dbPromise)return dbPromise; dbPromise=new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB nicht verfügbar'));return;}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE_VIDEOS))db.createObjectStore(STORE_VIDEOS,{keyPath:'id'});if(!db.objectStoreNames.contains(STORE_FACES))db.createObjectStore(STORE_FACES,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function idbPut(store,record){const db=await getDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function idbGetAll(store){const db=await getDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function idbDelete(store,id){const db=await getDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function idbClear(store){const db=await getDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}

const DEFAULT_SETTINGS={grace:4,sensitivity:55,trackingEnabled:true,faceSnapshotsEnabled:true,faceMinConfidence:70,faceCooldown:5};
function loadSettings(){let s={...DEFAULT_SETTINGS};try{const raw=localStorage.getItem('personcam_settings');if(raw)s={...s,...JSON.parse(raw)};}catch(e){console.error('Einstellungen konnten nicht geladen werden',e);}graceInput.value=s.grace;sensitivityInput.value=s.sensitivity;trackingEnabledInput.checked=s.trackingEnabled;faceSnapshotsEnabledInput.checked=s.faceSnapshotsEnabled;faceMinConfidenceInput.value=s.faceMinConfidence;faceCooldownInput.value=s.faceCooldown;}
function saveSettings(){const s={grace:Number(graceInput.value)||4,sensitivity:Number(sensitivityInput.value)||55,trackingEnabled:trackingEnabledInput.checked,faceSnapshotsEnabled:faceSnapshotsEnabledInput.checked,faceMinConfidence:Number(faceMinConfidenceInput.value)||70,faceCooldown:Number(faceCooldownInput.value)||5};try{localStorage.setItem('personcam_settings',JSON.stringify(s));}catch(e){console.error('Einstellungen konnten nicht gespeichert werden',e);}}
[graceInput,sensitivityInput,trackingEnabledInput,faceSnapshotsEnabledInput,faceMinConfidenceInput,faceCooldownInput].forEach(el=>el.addEventListener('change',saveSettings));
function getThreshold(){const raw=Number(sensitivityInput.value);return Number.isNaN(raw)?0.55:Math.min(0.9,Math.max(0.3,raw/100));}
function getFaceMinConfidence(){const raw=Number(faceMinConfidenceInput.value);return Number.isNaN(raw)?0.7:Math.min(0.99,Math.max(0.3,raw/100));}
function getFaceCooldownMs(){const raw=Number(faceCooldownInput.value);return Math.max(1,raw||5)*1000;}

async function derivePinHash(pin,saltBytes){const enc=new TextEncoder();const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},keyMaterial,256);return bytesToBase64(new Uint8Array(bits));}
async function setPin(pin){const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await derivePinHash(pin,salt);localStorage.setItem('personcam_pin_salt',bytesToBase64(salt));localStorage.setItem('personcam_pin_hash',hash);}
async function verifyPin(pin){const saltB64=localStorage.getItem('personcam_pin_salt');const storedHash=localStorage.getItem('personcam_pin_hash');if(!saltB64||!storedHash)return false;const hash=await derivePinHash(pin,base64ToBytes(saltB64));return hash===storedHash;}
async function ensurePinProvisioned(){if(!localStorage.getItem('personcam_pin_hash'))await setPin(DEFAULT_PIN);}
async function unlockApp(){pinScreen.hidden=true;appRoot.hidden=false;await Promise.all([renderRecordings(),renderFaces()]);}
function lockApp(){closeSettingsSheet();if(running)stopCamera();appRoot.hidden=true;pinInput.value='';pinError.hidden=true;pinScreen.hidden=false;pinInput.focus();}
async function handlePinSubmit(){const value=pinInput.value.trim();if(!value)return;try{const ok=await verifyPin(value);if(ok){pinInput.value='';pinError.hidden=true;await unlockApp();}else{pinError.textContent='Falsche PIN.';pinError.hidden=false;pinInput.value='';pinInput.focus();}}catch(e){console.error('PIN-Prüfung fehlgeschlagen',e);pinError.textContent='PIN-Prüfung nicht möglich (HTTPS/localhost erforderlich).';pinError.hidden=false;}}
pinSubmit.addEventListener('click',handlePinSubmit);pinInput.addEventListener('keydown',e=>{if(e.key==='Enter')handlePinSubmit();});lockBtn.addEventListener('click',lockApp);lockNowBtn.addEventListener('click',lockApp);
changePinBtn.addEventListener('click',()=>{changePinForm.hidden=!changePinForm.hidden;pinChangeMsg.hidden=true;currentPinInput.value='';newPinInput.value='';newPin2Input.value='';});
function showPinChangeMsg(text,ok){pinChangeMsg.textContent=text;pinChangeMsg.style.color=ok?'var(--green)':'var(--red)';pinChangeMsg.hidden=false;}
savePinBtn.addEventListener('click',async()=>{const cur=currentPinInput.value.trim(),next=newPinInput.value.trim(),next2=newPin2Input.value.trim();if(!cur||!next||!next2){showPinChangeMsg('Bitte alle Felder ausfüllen.');return;}if(next.length<4){showPinChangeMsg('Neue PIN muss mindestens 4 Zeichen haben.');return;}if(next!==next2){showPinChangeMsg('Neue PIN stimmt nicht überein.');return;}try{if(!(await verifyPin(cur))){showPinChangeMsg('Aktuelle PIN ist falsch.');return;}await setPin(next);currentPinInput.value='';newPinInput.value='';newPin2Input.value='';showPinChangeMsg('PIN wurde geändert.',true);}catch(e){console.error('PIN-Änderung fehlgeschlagen',e);showPinChangeMsg('PIN konnte nicht geändert werden.');}});

function createTracker(){let nextId=1,slots=[];return{update(boxes,frameW,frameH){const now=performance.now(),used=new Set(),results=[];for(const box of boxes){const cx=box[0]+box[2]/2,cy=box[1]+box[3]/2;let best=null,bestDist=Infinity;for(const existing of slots){if(used.has(existing))continue;const dx=(cx-existing.cx)/frameW,dy=(cy-existing.cy)/frameH,dist=Math.sqrt(dx*dx+dy*dy);if(dist<bestDist){bestDist=dist;best=existing;}}const slot=(best&&bestDist<=TRACK_MATCH_DIST)?best:{id:nextId++,cx,cy,lastSeen:now};slot.cx=cx;slot.cy=cy;slot.lastSeen=now;if(!slots.includes(slot))slots.push(slot);used.add(slot);results.push({box,id:slot.id});}slots=slots.filter(s=>(now-s.lastSeen)<=TRACK_TIMEOUT_MS);return results;},reset(){slots=[];nextId=1;}};}
const personTracker=createTracker(),faceTracker=createTracker();

let stream,cocoModel,faceModel;let running=false;let lastVideoTime=-1,lastDetectAt=0,detecting=false;let personStreak=0,consecutiveErrors=0;const faceSnapshotTimes=new Map();
function getModelErrorMessage(error){const text=error?.message||String(error||'Unbekannter Fehler');if(/failed to fetch|network|load|404|cors|internet/i.test(text))return'KI-Modelle konnten nicht aus dem Internet geladen werden. Bitte Internetverbindung prüfen und erneut versuchen.';if(/webgl|shader|texture|backend/i.test(text))return'Die Grafikbeschleunigung dieses Geräts konnte nicht verwendet werden. Bitte erneut versuchen.';return`KI-Modelle konnten nicht geladen werden: ${text}`;}
async function prepareTensorFlow(){if(typeof tf==='undefined')throw new Error('TensorFlow.js wurde nicht geladen.');try{if(tf.getBackend()!=='webgl')await tf.setBackend('webgl');await tf.ready();}catch(webglError){console.warn('WebGL-Backend nicht verfügbar, verwende CPU:',webglError);try{await tf.setBackend('cpu');await tf.ready();}catch(cpuError){throw new Error(`TensorFlow-Backend konnte nicht gestartet werden: ${cpuError?.message||cpuError}`);}}}
async function loadModels(){await prepareTensorFlow();if(!cocoModel)cocoModel=await cocoSsd.load({base:MODEL_BASE});if(!faceModel)faceModel=await blazeface.load();}
async function startCamera(){if(running)return;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera-API ist in diesem Browser nicht verfügbar.');stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:true});}catch(e){console.error(e);let msg='Bitte erlaube den Kamera-/Mikrofonzugriff. Die Seite muss in der Regel über HTTPS oder localhost laufen.';if(e.name==='NotFoundError')msg='Keine Kamera gefunden.';else if(e.name==='NotReadableError')msg='Die Kamera wird bereits von einer anderen App verwendet.';else if(e.name==='NotAllowedError')msg='Kamera-/Mikrofonzugriff wurde verweigert.';else if(e.name==='SecurityError')msg='Kamera darf auf dieser Seite nicht verwendet werden. Bitte HTTPS verwenden.';else if(e.message)msg=e.message;setStatus('Kamera konnte nicht gestartet werden');alert(msg);return;}video.srcObject=stream;await video.play();running=true;startBtn.disabled=true;stopBtn.disabled=false;try{setStatus('Kamera läuft – KI-Modelle werden geladen…');await loadModels();personStreak=0;detecting=false;consecutiveErrors=0;personTracker.reset();faceTracker.reset();faceSnapshotTimes.clear();setStatus('Bereit – Personen werden erkannt');detectLoop();}catch(e){console.error('KI-Modelle konnten nicht geladen werden:',e);running=false;startBtn.disabled=false;stopBtn.disabled=true;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;setStatus('KI-Modelle konnten nicht geladen werden');alert(getModelErrorMessage(e));}}
function stopCamera(){running=false;clearTimeout(stopTimer);stopTimer=null;if(recording)stopRecording();stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;ctx.clearRect(0,0,canvas.width,canvas.height);startBtn.disabled=false;stopBtn.disabled=true;personStreak=0;detecting=false;lastDetectAt=0;consecutiveErrors=0;personTracker.reset();faceTracker.reset();setStatus('Gestoppt');}
function boxIsBigEnough(bbox,frameHeight){return(bbox[3]/frameHeight)>=MIN_BOX_HEIGHT_RATIO;}
async function detectLoop(){if(!running||!cocoModel||!faceModel)return;const now=performance.now(),newFrame=video.readyState>=2&&video.currentTime!==lastVideoTime;if(newFrame&&!detecting&&(now-lastDetectAt)>=DETECT_INTERVAL_MS){lastVideoTime=video.currentTime;lastDetectAt=now;detecting=true;try{const frameW=video.videoWidth||1280,frameH=video.videoHeight||720,threshold=getThreshold();const[predictions,faces]=await Promise.all([cocoModel.detect(video),faceModel.estimateFaces(video,false)]);const people=predictions.filter(p=>p.class==='person'&&p.score>=threshold&&boxIsBigEnough(p.bbox,frameH));const faceBoxes=faces.map(f=>{const[x1,y1]=f.topLeft,[x2,y2]=f.bottomRight;const score=Array.isArray(f.probability)?f.probability[0]:f.probability;return{bbox:[x1,y1,x2-x1,y2-y1],score};}).filter(f=>f.score>=getFaceMinConfidence());const trackedPeople=trackingEnabledInput.checked?personTracker.update(people.map(p=>p.bbox),frameW,frameH):people.map(p=>({box:p.bbox,id:null}));const trackedFaces=faceTracker.update(faceBoxes.map(f=>f.bbox),frameW,frameH);drawHud(people,trackedPeople,faceBoxes,trackedFaces);maybeCaptureFaceSnapshots(faceBoxes,trackedFaces);if(people.length){if(stopTimer){clearTimeout(stopTimer);stopTimer=null;}personStreak++;if(!recording){if(personStreak>=CONFIRM_HITS)startRecording();else setStatus(`Person erkannt – bestätige… (${personStreak}/${CONFIRM_HITS})`);}}else{if(personStreak>0&&!recording)setStatus('Bereit – Personen werden erkannt');personStreak=0;if(recording&&!stopTimer){const seconds=Math.max(1,Number(graceInput.value)||4);stopTimer=setTimeout(()=>{stopTimer=null;stopRecording();},seconds*1000);}}consecutiveErrors=0;}catch(err){console.error('Erkennung fehlgeschlagen:',err);consecutiveErrors++;if(consecutiveErrors>=MAX_CONSECUTIVE_ERRORS)setStatus('Erkennung läuft instabil – Seite bei Bedarf neu laden');}finally{detecting=false;}}requestAnimationFrame(detectLoop);}
function drawBox(x,y,w,h,label,color){const labelWidth=ctx.measureText(label).width+12;ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,canvas.width/450);ctx.strokeRect(x,y,w,h);ctx.fillStyle=color;ctx.fillRect(x,Math.max(0,y-22),labelWidth,20);ctx.fillStyle='#000';ctx.fillText(label,x+6,Math.max(15,y-7));}
function drawHud(people,trackedPeople,faceBoxes,trackedFaces){canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font='bold 14px ui-monospace, Consolas, monospace';trackedPeople.forEach((t,i)=>{const p=people[i],[x,y,w,h]=t.box;const label=(trackingEnabledInput.checked&&t.id)?`PERSON ${t.id} ${Math.round(p.score*100)}%`:`PERSON ${Math.round(p.score*100)}%`;drawBox(x,y,w,h,label,'#00ff6a');});trackedFaces.forEach((t,i)=>{const f=faceBoxes[i],[x,y,w,h]=t.box;drawBox(x,y,w,h,`GESICHT ${Math.round(f.score*100)}%`,'#7dffb0');});}

let recorder,chunks=[],recording=false,stopTimer=null;let recordingStartedAt=0,recTimerInterval=null;
function startRecording(){if(!stream||recording)return;chunks=[];const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m));if(!window.MediaRecorder||!mime){setStatus('Dieser Browser unterstützt keine Videoaufnahme.');return;}recorder=new MediaRecorder(stream,{mimeType:mime});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=saveRecording;recorder.start(500);recording=true;recordingStartedAt=Date.now();recBadge.style.display='block';updateRecTimer();recTimerInterval=setInterval(updateRecTimer,1000);setStatus('Person erkannt – Aufnahme läuft');}
function updateRecTimer(){recTimerEl.textContent=formatDuration(Math.floor((Date.now()-recordingStartedAt)/1000));}
function stopRecording(){if(!recorder||recorder.state==='inactive')return;recorder.stop();recording=false;clearInterval(recTimerInterval);recTimerInterval=null;recBadge.style.display='none';setStatus('Aufnahme wird vorbereitet…');}
async function saveRecording(){const durationSeconds=Math.max(1,Math.round((Date.now()-recordingStartedAt)/1000));const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});chunks=[];const record={id:`video-${Date.now()}`,blob,mimeType:recorder.mimeType||'video/webm',createdAt:Date.now(),durationSeconds};try{await idbPut(STORE_VIDEOS,record);await renderRecordings();setStatus('Aufnahme gespeichert');}catch(e){console.error('Aufnahme konnte nicht gespeichert werden:',e);setStatus('Aufnahme konnte nicht gespeichert werden');}}

async function maybeCaptureFaceSnapshots(faceBoxes,trackedFaces){if(!faceSnapshotsEnabledInput.checked||!faceBoxes.length)return;const now=Date.now(),cooldown=getFaceCooldownMs();for(let i=0;i<faceBoxes.length;i++){const tracked=trackedFaces[i],id=tracked?.id??`face-${i}`,last=faceSnapshotTimes.get(id)||0;if(now-last<cooldown)continue;const f=faceBoxes[i],[x,y,w,h]=f.bbox,padX=w*0.35,padY=h*0.45,sx=Math.max(0,Math.floor(x-padX)),sy=Math.max(0,Math.floor(y-padY)),ex=Math.min(video.videoWidth,Math.ceil(x+w+padX)),ey=Math.min(video.videoHeight,Math.ceil(y+h+padY)),sw=Math.max(1,ex-sx),sh=Math.max(1,ey-sy);const crop=document.createElement('canvas');crop.width=sw;crop.height=sh;const cropCtx=crop.getContext('2d');cropCtx.drawImage(video,sx,sy,sw,sh,0,0,sw,sh);try{const blob=await new Promise(resolve=>crop.toBlob(resolve,'image/jpeg',0.9));if(!blob)continue;const record={id:`face-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,blob,createdAt:Date.now(),confidence:f.score};await idbPut(STORE_FACES,record);faceSnapshotTimes.set(id,now);await renderFaces();}catch(e){console.error('Gesichtsbild konnte nicht gespeichert werden:',e);}}}

async function renderRecordings(){const items=await idbGetAll(STORE_VIDEOS);items.sort((a,b)=>b.createdAt-a.createdAt);recordingsList.innerHTML='';recordingsEmpty.hidden=items.length>0;for(const item of items){const card=document.createElement('article');card.className='media-card';const url=URL.createObjectURL(item.blob);card.innerHTML=`<video controls playsinline preload="metadata" src="${url}"></video><div class="media-meta"><span>${new Date(item.createdAt).toLocaleString('de-DE')}</span><span>${formatDuration(item.durationSeconds||0)}</span></div><div class="media-actions"><a class="btn btn-ghost" href="${url}" download="PersonCam-${formatFilenameStamp(item.createdAt)}.webm">Herunterladen</a><button class="btn btn-ghost delete-video">Löschen</button></div>`;card.querySelector('.delete-video').addEventListener('click',async()=>{await idbDelete(STORE_VIDEOS,item.id);await renderRecordings();});recordingsList.appendChild(card);}}
async function renderFaces(){const items=await idbGetAll(STORE_FACES);items.sort((a,b)=>b.createdAt-a.createdAt);faceGallery.innerHTML='';facesEmpty.hidden=items.length>0;for(const item of items){const url=URL.createObjectURL(item.blob);const el=document.createElement('button');el.className='face-card';el.innerHTML=`<img src="${url}" alt="Gesichtsbild"><span>${new Date(item.createdAt).toLocaleString('de-DE')}</span>`;el.addEventListener('click',()=>openLightbox(item));faceGallery.appendChild(el);}}
let lightboxItem=null;function openLightbox(item){lightboxItem=item;const url=URL.createObjectURL(item.blob);lightboxImg.src=url;lightboxDownload.href=url;lightboxDownload.download=`PersonCam-Gesicht-${formatFilenameStamp(item.createdAt)}.jpg`;lightbox.hidden=false;}function closeLightbox(){lightbox.hidden=true;lightboxImg.src='';}closeLightboxBtn.addEventListener('click',closeLightbox);lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});lightboxDelete.addEventListener('click',async()=>{if(!lightboxItem)return;await idbDelete(STORE_FACES,lightboxItem.id);closeLightbox();await renderFaces();});clearVideosBtn.addEventListener('click',async()=>{if(confirm('Alle Aufnahmen löschen?')){await idbClear(STORE_VIDEOS);await renderRecordings();}});clearFacesBtn.addEventListener('click',async()=>{if(confirm('Alle Gesichtsbilder löschen?')){await idbClear(STORE_FACES);await renderFaces();}});
tabBtns.forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.tab;tabBtns.forEach(b=>{const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});recordingsPanel.hidden=tab!=='recordings';facesPanel.hidden=tab!=='faces';}));
function openSettingsSheet(){settingsOverlay.hidden=false;}function closeSettingsSheet(){settingsOverlay.hidden=true;}settingsBtn.addEventListener('click',openSettingsSheet);closeSettingsBtn.addEventListener('click',closeSettingsSheet);settingsOverlay.addEventListener('click',e=>{if(e.target===settingsOverlay)closeSettingsSheet();});
(async function init(){loadSettings();await ensurePinProvisioned();pinInput.focus();})();
