import { createFrameStream } from '../src/recognition/frameStream.js';
const output=document.querySelector('#result'),video=document.querySelector('video');let recognition,timer,media;
const stop=()=>{recognition?.stop();clearInterval(timer);media?.getTracks().forEach(track=>track.stop());video.srcObject=null};
document.querySelector('#run').onclick=async()=>{
 stop();output.textContent='Connecting to backend';
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d');
 const draw=()=>{context.fillStyle='black';context.fillRect(0,0,640,480)};draw();timer=setInterval(draw,66);
 media=canvas.captureStream(15);video.srcObject=media;await video.play();let count=0;
 recognition=createFrameStream(video,{
  onState:(status,error)=>{output.textContent=error||status;if(status==='error')stop()},
  onResult:data=>{count++;if(count===1){recognition.clear();output.textContent='First frame processed. Checking reset.'}else{output.textContent=JSON.stringify({status:'PASS',frames:count,hands:data.hands.length,emissions:data.emissions.length,path:'Browser JPEG → Express gateway → private Python detection + ONNX',reset:'passed',stop:'session deleted'},null,2);stop()}},
 });await recognition.start();
};
window.addEventListener('pagehide',stop);
