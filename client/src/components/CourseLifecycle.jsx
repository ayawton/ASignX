import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../auth'

export default function CourseLifecycle({course,onChanged,disabled=false}){
 const [confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const navigate=useNavigate()
 async function act(){
  if(busy)return
  setBusy(true);setError('')
  try{
   const result=await api(`/admin/courses/${course.id}/${confirm}`,{method:'POST',body:'{}'})
   if(confirm==='copy')navigate(`/dashboard/admin/courses/${result.id}`)
   else {setConfirm('');onChanged()}
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="admin-lifecycle">
  <div className="admin-actions"><button className="btn btn-secondary" type="button" disabled={disabled||busy} onClick={()=>setConfirm('copy')}>Create draft copy</button>{course.is_published&&<button className="text-link" type="button" disabled={disabled||busy} onClick={()=>setConfirm('archive')}>Archive course</button>}</div>
  {confirm&&<div className="admin-notice"><p>{confirm==='archive'?'Hide this course from learners? Existing enrollments, answers, progress, and XP will be preserved. Learners cannot open it while archived.':'Create an editable copy of this course and its lessons, questions, and sign links? Learner records stay with the original course.'}</p><div className="admin-actions"><button className="btn" type="button" disabled={busy} onClick={act}>{busy?'Saving…':confirm==='archive'?'Confirm archive':'Create draft copy'}</button><button className="text-link" type="button" disabled={busy} onClick={()=>{setConfirm('');setError('')}}>Cancel</button></div></div>}
  {error&&<p role="alert">{error}</p>}
 </div>
}
