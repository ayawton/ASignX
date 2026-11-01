import { useRef, useState } from 'react'
import { api, supabase } from '../auth'
import SignVideo from './SignVideo'

export default function SignVideoUpload({sign,disabled,onBusy,onSaved}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState(null)
 const input=useRef(null)
 async function upload(){
  if(!file || busy)return
  setBusy(true);onBusy(true);setError('')
  let path,attached=false
  try{
   if(file.type!=='video/mp4' || !file.name.toLowerCase().endsWith('.mp4') || file.size===0 || file.size>20*1024*1024)throw new Error('Choose an MP4 file up to 20 MB.')
   const header=new Uint8Array(await file.slice(0,12).arrayBuffer())
   if(String.fromCharCode(...header.slice(4,8))!=='ftyp')throw new Error('This file does not have a recognized MP4 header.')
   if(!supabase)throw new Error('Media service is not configured.')
   path=`signs/${sign.id}/${crypto.randomUUID()}.mp4`
   const {error:uploadError}=await supabase.storage.from('learning-media').upload(path,file,{contentType:'video/mp4',cacheControl:'3600',upsert:false})
   if(uploadError)throw uploadError
   await api(`/admin/signs/${sign.id}/video`,{method:'POST',body:JSON.stringify({demo_path:path})})
   attached=true;onSaved(path);setFile(null);if(input.current)input.current.value=''
   if(sign.demo_path)await supabase.storage.from('learning-media').remove([sign.demo_path])
  }catch(e){setError(e.message || 'Upload failed. Try again.');if(path&&!attached&&supabase)await supabase.storage.from('learning-media').remove([path])}
  finally{setBusy(false);onBusy(false)}
 }
 return <section className="sign-video-upload"><h3>Demonstration video</h3><p>Optional MP4, up to 20 MB. Use a short clip with clear hand movements. Replacing it updates every lesson using this sign.</p><SignVideo key={sign.demo_path || sign.id} path={sign.demo_path} label={sign.gloss} />
  <label>Choose MP4<input ref={input} type="file" accept="video/mp4,.mp4" disabled={busy||disabled} onChange={e=>{setFile(e.target.files?.[0] || null);setError('')}} /></label>
  <button className="btn btn-secondary" type="button" disabled={!file||busy||disabled} onClick={upload}>{busy?'Uploading…':sign.demo_path?'Replace video':'Upload video'}</button>
  {error&&<p role="alert">{error}</p>}
 </section>
}
