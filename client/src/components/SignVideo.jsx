import { useEffect, useState } from 'react'
import { supabase } from '../auth'

export default function SignVideo({ path, label, loop = false, autoPlay = false }) {
 const [source,setSource]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let active=true
  if(!path)return
  async function load(){
   try{
    if(!supabase)throw new Error('Media service is not configured.')
    const {data,error}=await supabase.storage.from('learning-media').createSignedUrl(path,3600)
    if(error)throw error
    if(active){setSource({path,url:data.signedUrl});setError('')}
   }catch{if(active)setError('The demonstration could not load. Try again.')}
  }
  load()
  return()=>{active=false}
 },[path,revision])
 if(!path)return null
 return <div className="sign-video">{error?<p role="alert">{error} <button className="text-link" type="button" onClick={()=>{setError('');setRevision(v=>v+1)}}>Retry video</button></p>:source?.path===path?<video key={source.url} controls playsInline muted autoPlay={autoPlay} loop={loop} preload={autoPlay ? 'metadata' : 'none'} aria-label={`${label} sign demonstration`} onError={()=>setError('Video unavailable or link expired. Try again.')}><source src={source.url} type="video/mp4" />Your browser does not support this video.</video>:<p role="status">Loading demonstration…</p>}</div>
}
