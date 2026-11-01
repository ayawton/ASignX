import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../auth'
import { createFrameStream } from '../recognition/frameStream'

export default function LessonSignAnswer({ lessonId, exercise, onSolved, disabled }) {
 const video=useRef(null), stream=useRef(null), camera=useRef(null), generation=useRef(0)
 const [active,setActive]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 const solved=useRef(onSolved);useEffect(()=>{solved.current=onSolved},[onSolved])
 const stop=useCallback(()=>{generation.current++;stream.current?.stop();stream.current=null;camera.current?.getTracks().forEach(track=>track.stop());camera.current=null;setActive(false)},[])
 useEffect(()=>()=>{generation.current++;stream.current?.stop();camera.current?.getTracks().forEach(track=>track.stop())},[])
 async function start(){
  const run=++generation.current;setError('');setStatus('Allow camera access, then show the target sign.');setActive(true)
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS or localhost and a supported browser.')
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false})
   if(run!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   camera.current=media;video.current.srcObject=media;await video.current.play()
   if(run!==generation.current)return
   const transport=async(url,options={})=>{
    const {data}=await supabase.auth.getSession()
    const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${data.session?.access_token||''}`)
    let path=url.replace('/api/recognition/sessions','/api/me/lesson-recognition')
    if(url==='/api/recognition/sessions'){path=`/api/me/lessons/${lessonId}/recognition`;headers.set('Content-Type','application/json');options={...options,body:JSON.stringify({exercise_id:exercise.id})}}
    return fetch(path,{...options,headers})
   }
   stream.current=createFrameStream(video.current,{fetcher:transport,onState:(state,message)=>{if(run!==generation.current)return;if(state==='error'){setError(message);stop()}else if(state==='ready')setStatus('Show the sign clearly. Hold static signs steady; complete the movement for dynamic signs.')},onResult:result=>{
    if(run!==generation.current)return
    if(result.correct){setStatus('Target sign recognized. Your answer is saved.');stop();solved.current()}
    else if(result.label)setStatus(`Detected ${result.label}. Try ${exercise.target_sign} again.`)
   }})
   await stream.current.start()
  }catch(e){if(run===generation.current){setError(e.name==='NotAllowedError'?'Camera permission was denied. Allow it and try again.':e.message);stop()}}
 }
 return <div className="lesson-sign-answer"><p>Sign <strong>{exercise.target_sign}</strong> with your camera.</p><p className="lesson-recognition-note">Practice feedback from the current model, not an assessment of overall signing proficiency. Camera frames are sent for recognition and are not saved.</p><video ref={video} autoPlay playsInline muted hidden={!active} aria-label="Your signing camera"/>{error&&<p role="alert">{error}</p>}{status&&<p role="status">{status}</p>}<button className="btn btn-secondary" type="button" disabled={disabled} onClick={active?stop:start}>{active?'Stop camera':'Start camera practice'}</button></div>
}
