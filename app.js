const video = document.getElementById('preview');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const recBadge = document.getElementById('recBadge');
const recordings = document.getElementById('recordings');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const graceInput = document.getElementById('grace');
const faceCountEl = document.getElementById('faceCount');

let stream, recorder, chunks = [], model, faceModel;
let running = false, recording = false, stopTimer = null, lastVideoTime = -1, detecting = false;
let recordingStartedAt = 0;
function setStatus(text){ statusEl.textContent = text; }

async function startCamera(){
  if(running)return;
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:true});
    video.srcObject=stream; await video.play(); running=true;
    startBtn.disabled=true; stopBtn.disabled=false; setStatus('Kamera läuft – KI wird geladen…');
    [model,faceModel]=await Promise.all([cocoSsd.load(),blazeface.load()]);
    setStatus('Bereit – Personen & Gesichter werden erkannt'); detectLoop();
  }catch(e){console.error(e);setStatus('Kamera konnte nicht gestartet werden');alert('Bitte erlaube Kamera und Mikrofon. Die Seite muss normalerweise über HTTPS oder localhost laufen.');}
}
function stopCamera(){
  running=false; clearTimeout(stopTimer); stopTimer=null; detecting=false;
  if(recording) stopRecording('Manuell gestoppt');
  stream?.getTracks().forEach(t=>t.stop()); stream=null; video.srcObject=null;
  ctx.clearRect(0,0,canvas.width,canvas.height); faceCountEl.textContent='0 FACE';
  startBtn.disabled=false; stopBtn.disabled=true; setStatus('Gestoppt');
}

function toPoint(value){
  if(!value)return null;
  if(Array.isArray(value))return [Number(value[0]),Number(value[1])];
  if(typeof value.dataSync==='function'){const a=Array.from(value.dataSync());return [Number(a[0]),Number(a[1])];}
  if(typeof value[0]!=='undefined')return [Number(value[0]),Number(value[1])];
  return null;
}

function normalizeFace(face){
  const tl=toPoint(face.topLeft), br=toPoint(face.bottomRight);
  if(!tl||!br)return null;
  const x=Math.min(tl[0],br[0]), y=Math.min(tl[1],br[1]);
  const w=Math.abs(br[0]-tl[0]), h=Math.abs(br[1]-tl[1]);
  const probability=Array.isArray(face.probability)?Number(face.probability[0]):Number(face.probability ?? 1);
  if(!Number.isFinite(x)||!Number.isFinite(y)||w<18||h<18||probability<0.55)return null;
  return {x,y,w,h,probability};
}

async function detectLoop(){
  if(!running||!model||!faceModel)return;
  if(!detecting&&video.readyState>=2&&video.currentTime!==lastVideoTime){
    detecting=true;
    lastVideoTime=video.currentTime;
    try{
      const [predictions,rawFaces]=await Promise.all([model.detect(video),faceModel.estimateFaces(video,false,false)]);
      const faces=rawFaces.map(normalizeFace).filter(Boolean);
      drawHUD(predictions,faces);
      const personFound=predictions.some(p=>p.class==='person'&&p.score>=.55);
      if(personFound){clearTimeout(stopTimer);stopTimer=null;if(!recording)startRecording();}
      else if(recording&&!stopTimer){
        const seconds=Math.max(1,Math.min(30,Number(graceInput.value)||4));
        setStatus(`Keine Person – Aufnahme endet in ${seconds}s`);
        stopTimer=setTimeout(()=>{stopTimer=null;if(recording)stopRecording('Person nicht mehr erkannt');},seconds*1000);
      }
    }catch(e){console.warn('Gesichtserkennung:',e);}
    detecting=false;
  }
  requestAnimationFrame(detectLoop);
}

function drawHUD(predictions,faces){
  const vw=video.videoWidth||1280,vh=video.videoHeight||720;
  if(canvas.width!==vw||canvas.height!==vh){canvas.width=vw;canvas.height=vh;}
  ctx.clearRect(0,0,vw,vh);
  const people=predictions.filter(p=>p.class==='person'&&p.score>=.55);
  faceCountEl.textContent=`${faces.length} FACE${faces.length===1?'':'S'}`;
  for(const p of people){
    const [x,y,w,h]=p.bbox,line=Math.max(4,vw/320),corner=Math.min(w,h)*.18;
    ctx.save();ctx.strokeStyle='#00ff66';ctx.lineWidth=line;ctx.shadowColor='#00ff66';ctx.shadowBlur=10;ctx.beginPath();
    ctx.moveTo(x,y+corner);ctx.lineTo(x,y);ctx.lineTo(x+corner,y);ctx.moveTo(x+w-corner,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+corner);
    ctx.moveTo(x,y+h-corner);ctx.lineTo(x,y+h);ctx.lineTo(x+corner,y+h);ctx.moveTo(x+w-corner,y+h);ctx.lineTo(x+w,y+h);ctx.lineTo(x+w,y+h-corner);ctx.stroke();ctx.restore();
  }
  for(const f of faces){
    const {x,y,w,h,probability}=f;
    const cx=x+w/2,cy=y+h/2,r=Math.max(32,Math.min(w,h)*.72),pulse=1+Math.sin(Date.now()/180)*.035;
    ctx.save();ctx.translate(cx,cy);ctx.scale(pulse,pulse);ctx.strokeStyle='#00ff66';ctx.fillStyle='rgba(0,255,102,.07)';ctx.lineWidth=Math.max(2,vw/500);ctx.shadowColor='#00ff66';ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.fill();
    ctx.shadowBlur=0;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,r+10,Math.PI*1.08,Math.PI*1.55);ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r+10,Math.PI*.08,Math.PI*.55);ctx.stroke();
    ctx.fillStyle='#00ff66';ctx.font=`700 ${Math.max(11,vw/105)}px monospace`;ctx.fillText('FACE // TRACKED',-r,-r-12);
    ctx.font=`600 ${Math.max(10,vw/125)}px monospace`;
    ctx.fillText(`X ${Math.round(cx)}  Y ${Math.round(cy)}`,-r,r+24);
    ctx.fillText(`SIZE ${Math.round(w)}×${Math.round(h)}`,-r,r+40);
    ctx.fillText(`CONF ${Math.round(probability*100)}%`,-r,r+56);
    ctx.fillRect(-4,-r-2,8,4);ctx.fillRect(-4,r-2,8,4);ctx.fillRect(-r-2,-4,4,8);ctx.fillRect(r-2,-4,4,8);
    ctx.restore();
  }
}
function startRecording(){
  if(!stream||recording)return;chunks=[];
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(MediaRecorder.isTypeSupported);
  if(!mime){setStatus('Dieser Browser unterstützt keine passende Videoaufnahme.');return;}
  recorder=new MediaRecorder(stream,{mimeType:mime});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=saveRecording;recorder.start(250);
  recording=true;recordingStartedAt=Date.now();recBadge.style.display='block';setStatus('● REC – Person erkannt');
}
function stopRecording(reason='Aufnahme beendet'){clearTimeout(stopTimer);stopTimer=null;if(!recorder||recorder.state==='inactive')return;recorder.stop();recording=false;recBadge.style.display='none';setStatus(reason);}
function saveRecording(){const blob=new Blob(chunks,{type:recorder?.mimeType||'video/webm'});if(blob.size<1000)return;const url=URL.createObjectURL(blob),time=new Date().toLocaleString('de-DE'),duration=Math.max(0,Math.round((Date.now()-recordingStartedAt)/1000));const item=document.createElement('div');item.className='item';const a=document.createElement('a');a.href=url;a.download=`personcam-${Date.now()}.webm`;a.textContent=`Aufnahme vom ${time} · ${duration}s – speichern`;item.appendChild(a);recordings.prepend(item);setStatus('Aufnahme fertig – bereit zum Speichern');chunks=[];}
startBtn.addEventListener('click',startCamera);stopBtn.addEventListener('click',stopCamera);window.addEventListener('beforeunload',()=>stream?.getTracks().forEach(t=>t.stop()));
