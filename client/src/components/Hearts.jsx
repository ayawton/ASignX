import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { api } from '../auth'
export default function Hearts(){
 const [value,setValue]=useState(null),[now,setNow]=useState(()=>Date.now())
 useEffect(()=>{
  let active=true
  const refresh=()=>api('/me/hearts').then(data=>{if(active)setValue({...data,receivedAt:Date.now()})}).catch(()=>{})
  const changed=event=>setValue({...event.detail,receivedAt:Date.now()})
  refresh();const poll=setInterval(refresh,15000),clock=setInterval(()=>setNow(Date.now()),1000)
  window.addEventListener('asignx-hearts',changed)
  return()=>{active=false;clearInterval(poll);clearInterval(clock);window.removeEventListener('asignx-hearts',changed)}
 },[])
 const seconds=value?.next_heart_at?Math.max(0,Math.ceil((new Date(value.next_heart_at)-(new Date(value.server_time).getTime()+now-value.receivedAt))/1000)):0
 return <Link className="learner-hearts" to="/dashboard/heart-practice" aria-label={value?`${value.hearts} of 3 hearts. Open heart practice.`:'Open heart practice'}><Heart size={18} aria-hidden="true"/><span>{value?`${value.hearts}/3`:'Hearts'}</span>{value?.hearts<3&&<small>+1 in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</small>}</Link>
}
