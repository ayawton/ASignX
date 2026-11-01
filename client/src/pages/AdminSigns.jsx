import { useEffect, useState } from 'react'
import { api, useAuth } from '../auth'
import './Admin.css'
import SignVideoUpload from '../components/SignVideoUpload'

const blank = () => ({gloss:'',meaning:'',category:'',instructions:'',is_published:false})
export default function AdminSigns() {
 const {user}=useAuth()
 return <SignLibrary key={user?.id} />
}
function SignLibrary() {
 const [signs,setSigns]=useState(null),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[revision,setRevision]=useState(0),[search,setSearch]=useState('')
 useEffect(()=>{let active=true;api('/admin/signs').then(value=>{if(active){setSigns(value);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[revision])
 function field(name,value){setDraft(previous=>({...previous,[name]:value}))}
 async function save(event){
  event.preventDefault();if(busy)return
  setBusy(true);setMessage('')
  try{const saved=await api(draft.id ? `/admin/signs/${draft.id}` : '/admin/signs',{method:draft.id?'PATCH':'POST',body:JSON.stringify(draft)});setSigns(rows=>[saved,...rows.filter(row=>row.id!==saved.id)].sort((a,b)=>a.gloss.localeCompare(b.gloss)));setDraft(blank());setMessage(saved.is_published?'Sign published. You can now add it to draft lessons.':'Sign draft saved.')}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 const filtered=signs?.filter(sign=>`${sign.gloss} ${sign.meaning} ${sign.category || ''}`.toLowerCase().includes(search.toLowerCase()))
 return <section className="admin-authoring studio-section studio-page"><header className="page-heading"><div><h1>Sign library</h1><p>Create reusable vocabulary and reviewed signing instructions for your lessons.</p></div></header>
  {error?<div role="alert"><p>{error}</p><button className="btn" onClick={()=>setRevision(v=>v+1)}>Try again</button></div>:!signs?<p role="status">Loading sign library…</p>:<>
   <div className="admin-authoring-grid"><article className="studio-progress-panel"><h2>Find a sign</h2><label>Search library<input className="search-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} /></label><p>{signs.length} signs in your library</p>
    <button className="btn btn-secondary" disabled={busy} onClick={()=>{setDraft(blank());setMessage('')}}>New sign</button>
    <ul className="admin-sign-list">{filtered.map(sign=><li key={sign.id}><button type="button" disabled={busy} aria-current={draft.id===sign.id?'true':undefined} onClick={()=>{setDraft({...sign,locked:sign.is_published,category:sign.category || '',instructions:sign.instructions || ''});setMessage('')}}><strong>{sign.gloss}</strong><span>{sign.category || 'Uncategorized'} · {sign.is_published?'Published':'Draft'}</span></button></li>)}</ul>
    {!filtered.length&&<p>{signs.length?'No matching signs. Try another search.':'No signs yet. Add a label and meaning to create your first draft.'}</p>}
   </article><form className="studio-progress-panel admin-form" onSubmit={save}><h2>{draft.id?'Sign details':'New sign'}</h2>
    <p>Use instructor-reviewed guidance and an optional demonstration video.</p>
    {message&&<p className="admin-notice" role="status">{message}</p>}
    {draft.locked&&<p className="admin-notice">Published sign text is read only. You can attach or replace its demonstration below.</p>}
    <fieldset disabled={busy || Boolean(draft.locked)}>
     <label>Sign label<input required maxLength={100} placeholder="e.g. A or HELLO" value={draft.gloss} onChange={e=>field('gloss',e.target.value)} /></label><small>A unique vocabulary label, saved in uppercase.</small>
     <label>Meaning<textarea required maxLength={2000} rows={2} value={draft.meaning} onChange={e=>field('meaning',e.target.value)} /></label>
     <label>Category<input maxLength={60} placeholder="e.g. Alphabet or Greetings" value={draft.category} onChange={e=>field('category',e.target.value)} /></label>
     <label>Signing instructions<textarea maxLength={6000} rows={7} value={draft.instructions} onChange={e=>field('instructions',e.target.value)} /></label>
    </fieldset>
    {draft.id?<SignVideoUpload key={draft.id} sign={draft} disabled={busy} onBusy={setBusy} onSaved={path=>{setDraft(previous=>({...previous,demo_path:path}));setSigns(rows=>rows.map(row=>row.id===draft.id?{...row,demo_path:path}:row));setMessage('Demonstration saved.')}} />:<p>Save this sign first to attach a demonstration video.</p>}
    {!(draft.locked)&&<><label className="admin-publish-check"><input type="checkbox" checked={draft.is_published} disabled={busy} onChange={e=>field('is_published',e.target.checked)} /> Publish this sign when saved</label><small>Publishing makes the sign available to learners and locks further edits.</small><div className="admin-actions"><button className="btn" disabled={busy || !draft.gloss.trim() || !draft.meaning.trim()}>{busy?'Saving…':draft.is_published?'Save and publish':'Save draft'}</button></div></>}
   </form></div>
  </>}
 </section>
}
