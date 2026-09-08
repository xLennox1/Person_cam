const video = document.getElementById('preview');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const recBadge = document.getElementById('recBadge');
const recordings = document.getElementById('recordings');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const graceInput = document.getElementById('grace');

let stream, recorder, chunks = [], model;
let running = false, recording = false, stopTimer = null;
let lastVideoTime = -1;
function setStatus(s){statusEl.textContent=s}

async function startCamera(){
  if(running)return;
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:true});
    video.srcObject=stream; await video.play(); running=true;
    startBtn.disabled=true; stopBtn.disabled=false; setStatus('Kamera läuft – Modell wird geladen…');
    model=await cocoSsd.load(); setStatus('Bereit – Personen werden erkannt'); detectLoop();
  }catch(e){console.error(e);setStatus('Kamera konnte nicht gestartet werden');alert('Bitte erlaube den Kamera-/Mikrofonzugriff. Die Seite muss in der Regel über HTTPS oder localhost laufen.')}
}
function stopCamera(){
  running=false; clearTimeout(stopTimer); if(recording)stopRecording();
  stream?.getTracks().forEach(t=>t.stop()); stream=null; video.srcObject=null;
  ctx.clearRect(0,0,canvas.width,canvas.height); startBtn.disabled=false; stopBtn.disabled=true; setStatus('Gestoppt');
}
async function detectLoop(){
  if(!running||!model)return;
  if(video.readyState>=2&&video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime; const predictions=await model.detect(video); drawBoxes(predictions);
    const personFound=predictions.some(p=>p.class==='person'&&p.score>=.55);
    if(personFound){clearTimeout(stopTimer);if(!recording)startRecording()}
    else if(recording&&!stopTimer){const seconds=Math.max(1,Number(graceInput.value)||4);stopTimer=setTimeout(()=>{stopTimer=null;stopRecording()},seconds*1000)}
  }
  requestAnimationFrame(detectLoop);
}
function drawBoxes(predictions){
  canvas.width=video.videoWidth||1280; canvas.height=video.videoHeight||720; ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const p of predictions){if(p.class!=='person'||p.score<.55)continue;const[x,y,w,h]=p.bbox;ctx.strokeStyle='#00ff66';ctx.lineWidth=Math.max(3,canvas.width/400);ctx.strokeRect(x,y,w,h);ctx.fillStyle='#00ff66';ctx.fillRect(x,Math.max(0,y-28),100,28);ctx.fillStyle='#000';ctx.font='bold 15px system-ui';ctx.fillText('PERSON',x+7,Math.max(19,y-8))}
}
function startRecording(){
  if(!stream||recording)return; chunks=[];
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(MediaRecorder.isTypeSupported);
  if(!mime){setStatus('Dieser Browser unterstützt keine passende Videoaufnahme.');return}
  recorder=new MediaRecorder(stream,{mimeType:mime}); recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; recorder.onstop=saveRecording; recorder.start(500);
  recording=true; recBadge.style.display='block'; setStatus('Person erkannt – Aufnahme läuft');
}
function stopRecording(){if(!recorder||recorder.state==='inactive')return;recorder.stop();recording=false;recBadge.style.display='none';setStatus('Aufnahme wird vorbereitet…')}
function saveRecording(){
  const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});const url=URL.createObjectURL(blob);const time=new Date().toLocaleString('de-DE');const item=document.createElement('div');item.className='item';const a=document.createElement('a');a.href=url;a.download=`personcam-${Date.now()}.webm`;a.textContent=`Aufnahme vom ${time} – speichern`;item.appendChild(a);recordings.prepend(item);setStatus('Aufnahme fertig');chunks=[];
}
startBtn.addEventListener('click',startCamera);stopBtn.addEventListener('click',stopCamera);window.addEventListener('beforeunload',()=>stream?.getTracks().forEach(t=>t.stop()));
