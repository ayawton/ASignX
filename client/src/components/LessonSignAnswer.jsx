import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Hand, CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react'
import { updateHearts } from '../data/hearts'
import { supabase } from '../auth'
import { createFrameStream } from '../recognition/frameStream'

export default function LessonSignAnswer({ lessonId, runId, exercise, onSolved, disabled, isSolved = false }) {
 const video=useRef(null), stream=useRef(null), camera=useRef(null), generation=useRef(0)
 const [active,setActive]=useState(false),[videoReady,setVideoReady]=useState(false)
 const [phase,setPhase]=useState('off'),[feedback,setFeedback]=useState(''),[error,setError]=useState('')
 const solved=useRef(onSolved)
 useEffect(()=>{solved.current=onSolved},[onSolved])
 const stop=useCallback(()=>{
  generation.current++;stream.current?.stop();stream.current=null
  camera.current?.getTracks().forEach(track=>track.stop());camera.current=null
  setActive(false);setVideoReady(false)
 },[])
 useEffect(()=>()=>{generation.current++;stream.current?.stop();camera.current?.getTracks().forEach(track=>track.stop())},[])
 async function start(){
  if(active || disabled || isSolved)return
  const run=++generation.current
  setError('');setFeedback('Allow camera access in your browser to begin.');setPhase('permission');setActive(true)
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS or localhost and a supported browser.')
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false})
   if(run!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   camera.current=media;video.current.srcObject=media;await video.current.play()
   if(run!==generation.current)return
   setVideoReady(true);setPhase('connecting');setFeedback('Connecting to recognition. Keep your hand in view.')
   media.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
    if(run!==generation.current)return
    stop();setPhase('error');setError('Camera access ended. Start the camera again to retry.')
   }))
   const transport=async(url,options={})=>{
    const {data}=await supabase.auth.getSession()
    const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${data.session?.access_token||''}`)
    let path=url.replace('/api/recognition/sessions','/api/me/lesson-recognition')
    if(url==='/api/recognition/sessions'){path=`/api/me/lessons/${lessonId}/recognition`;headers.set('Content-Type','application/json');options={...options,body:JSON.stringify({exercise_id:exercise.id,run_id:runId})}}
    const response=await fetch(path,{...options,headers})
    if(response.status===423){const result=await response.clone().json();updateHearts(result.hearts)}
    return response
   }
   stream.current=createFrameStream(video.current,{fetcher:transport,onState:(state,message)=>{
    if(run!==generation.current)return
    if(state==='error'){stop();setPhase('error');setError(message)}
    else if(state==='ready'){setPhase('ready');setFeedback('Ready. Show the target sign clearly in the frame.')}
    else if(state==='waiting'){setFeedback('Recognition is busy. Keep your hand in view; retrying automatically.')}
   },onResult:result=>{
    if(run!==generation.current)return
    if(result.correct){stop();setPhase('success');setFeedback('Sign recognized. Your answer is saved.');solved.current(result)}
    else if(result.label){setPhase('retry');setFeedback(`Detected ${result.label}. Try ${exercise.target_sign} again.`)}
   }})
   await stream.current.start()
  }catch(e){if(run===generation.current){stop();setPhase('error');setError(e.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser, then try again.':e.name==='NotFoundError'?'No camera was found. Connect a camera and try again.':e.message)}}
 }
 const done=isSolved || phase==='success'
 const stateLabel=done?'Sign recognized':phase==='permission'?'Waiting for permission':phase==='connecting'?'Connecting':phase==='error'?'Camera unavailable':active?'Ready to sign':'Camera off'
 const StateIcon=done?CheckCircle2:phase==='error'?AlertCircle:['permission','connecting'].includes(phase)?LoaderCircle:active?Camera:CameraOff
 const target=/^[A-Z]$/.test(exercise.target_sign||'')?`Sign the letter ${exercise.target_sign}`:`Sign ${exercise.target_sign}`
 return <div className={`lesson-sign-answer camera-answer${done?' is-recognized':''}`}>
  <div className="camera-answer-heading"><h3>{target}</h3><p>Keep your hand in view. Hold static signs steady; finish the movement for moving signs.</p></div>
  <div className="camera-answer-panel">
   <video ref={video} autoPlay playsInline muted hidden={!videoReady || done} aria-label="Your signing camera"/>
   {(!videoReady || done)&&<div className="camera-answer-placeholder">{done?<CheckCircle2 size={42} aria-hidden="true"/>:<Hand size={42} aria-hidden="true"/>}<strong>{done?'Sign recognized':active?'Getting your camera ready':'Ready when you are'}</strong><p>{done?'Continue below when you are ready.':active?'Check your browser for a camera permission prompt.':'Start your camera and position your hand comfortably in the frame.'}</p></div>}
   <span className="camera-answer-state"><StateIcon size={15} aria-hidden="true"/>{stateLabel}</span>
  </div>
  <div className={`camera-answer-feedback${done?' is-success':phase==='error'?' is-error':''}`} role={error?'alert':'status'}>
   {done?<CheckCircle2 size={19} aria-hidden="true"/>:error?<AlertCircle size={19} aria-hidden="true"/>:null}
   <p>{done?'Sign recognized. Your answer is saved.':error||feedback||'Your camera starts only when you choose Start camera.'}</p>
  </div>
  {!done&&<div className="camera-answer-controls"><button className={`btn${active?' btn-secondary':''}`} type="button" disabled={disabled} onClick={active?()=>{stop();setPhase('off');setFeedback('Camera stopped. Start again when you are ready.')}:start}>{active?<CameraOff size={18} aria-hidden="true"/>:<Camera size={18} aria-hidden="true"/>}{active?'Stop camera':phase==='error'?'Try camera again':'Start camera'}</button></div>}
  <p className="camera-answer-privacy">Frames are sent for recognition and aren’t saved.</p>
  <details className="camera-answer-help"><summary>About camera practice</summary><p>The model gives practice feedback for supported signs. A recognized sign is not a score of your overall signing proficiency. If recognition struggles, check your lighting and hand position, or review the lesson guidance.</p></details>
 </div>
}
