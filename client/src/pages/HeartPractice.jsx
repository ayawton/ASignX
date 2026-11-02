import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import { updateHearts } from '../data/hearts'
export default function HeartPractice(){
 const pending=useRef(null),inFlight=useRef(false)
 const [search]=useSearchParams();const lessonId=search.get('lesson');const back=lessonId && /^[0-9a-f-]{36}$/i.test(lessonId)?`/learn/lessons/${lessonId}`:'/learn'
 const [round,setRound]=useState(null),[hearts,setHearts]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;api('/me/hearts').then(value=>{if(active)setHearts(value)}).catch(()=>{});return()=>{active=false}},[])
 async function request(path,body={}){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('')
  try{const result=await api(path,{method:'POST',body:JSON.stringify(body)});setRound(result.round);setHearts(result.hearts);updateHearts(result.hearts);pending.current=null;if('correct' in result)setMessage(result.correct?'Correct. Keep going.':'Not quite. Try another answer.')}catch(e){setMessage(e.message)}finally{inFlight.current=false;setBusy(false)}
 }
 return <section className="container studio-section studio-page"><Link className="text-link" to="/learn">Back to learning</Link><div className="page-heading"><div><h1>Restore a heart</h1><p>Answer three familiar questions correctly to restore one heart. No XP is awarded and wrong answers cost no hearts.</p></div></div>{hearts&&<p>{hearts.hearts} of 3 hearts. One heart regenerates every five minutes, up to three.</p>}{message&&<p role="status">{message}</p>}{round?.completed_at?<article className="studio-progress-panel"><h2>Practice complete</h2><p>Your heart balance is now {hearts?.hearts}/3. Return to your paused lesson to resume.</p><Link className="btn" to={back}>Resume learning</Link></article>:round?.question?<article className="studio-progress-panel"><p>{round.correct_count} of 3 correct</p><h2>{round.question.prompt}</h2><div className="heart-practice-options">{round.question.options.map(option=><button className="btn btn-secondary" key={option.id} disabled={busy} onClick={()=>request('/me/heart-practice/answer',pending.current?.selected_option_id===option.id?pending.current:(pending.current={round_id:round.id,question_index:round.correct_count,attempt_id:crypto.randomUUID(),selected_option_id:option.id}))}>{option.option_text}</button>)}</div></article>:<button className="btn" disabled={busy || hearts?.hearts===3} onClick={()=>request('/me/heart-practice/start')}>{busy?'Loading…':hearts?.hearts===3?'Hearts are full':'Start heart practice'}</button>}</section>
}
