'use client'
import{useState,useRef,useEffect}from'react'
import{useSession}from'next-auth/react'
import{useRouter}from'next/navigation'
const BLOCKS=['Techo y arreglos','Cableado y tubería','Junction box','Perforaciones','Equipo eléctrico','Gateway / Inversor','Batería y RSS','Medidas críticas','Números de serie']
export default function ReviewPage(){
const{data:session,status}=useSession()
const router=useRouter()
const[messages,setMessages]=useState<any[]>([])
const[input,setInput]=useState('')
const[pdfFile,setPdfFile]=useState<File|null>(null)
const[pdfFileId,setPdfFileId]=useState<string|null>(null)
const[projectName,setProjectName]=useState('')
const[loading,setLoading]=useState(false)
const[saved,setSaved]=useState(false)
const[hasReport,setHasReport]=useState(false)
const[phase,setPhase]=useState<'upload'|'chat'>('upload')
const bottomRef=useRef<HTMLDivElement>(null)
const fileRef=useRef<HTMLInputElement>(null)
useEffect(()=>{if(status==='unauthenticated')router.push('/login')},[status,router])
useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages])
function handleFile(file:File){
if(!file||file.type!=='application/pdf')return
setPdfFile(file)}
async function startAnalysis(){if(!pdfFile||!projectName.trim())return;setPhase('chat');await send('REVISAR PAQUETE',true)}
async function send(text?:string,withPdf=false){
const msg=text||input.trim();if(!msg||loading)return
setInput('');setLoading(true)
const userMsg={role:'user',content:msg}
const asstMsg={role:'assistant',content:'',streaming:true}
setMessages(prev=>[...prev,userMsg,asstMsg])
const history=messages.map(m=>({role:m.role,content:m.content}))
try{
let res
if(withPdf&&pdfFile){
const fd=new FormData()
fd.append('pdf',pdfFile)
fd.append('message',msg)
fd.append('history',JSON.stringify(history))
res=await fetch('/api/analyze',{method:'POST',body:fd})
}else{
res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({message:msg,history,pdfFileId})})
}
if(!res.ok)throw new Error(await res.text())
const reader=res.body!.getReader();const decoder=new TextDecoder();let full='';let displayed=''
while(true){const{done,value}=await reader.read();if(done)break
const chunk=decoder.decode(value,{stream:true})
full+=chunk
// Extract __FILE_ID__:xxx__ if present
const fileIdMatch=full.match(/__FILE_ID__:([^_]+)__\n?/)
if(fileIdMatch&&!pdfFileId){
setPdfFileId(fileIdMatch[1])
displayed=full.replace(/__FILE_ID__:[^_]+__\n?/,'')
}else{
displayed=full.replace(/__FILE_ID__:[^_]+__\n?/,'')
}
setMessages(prev=>{const u=[...prev];u[u.length-1]={role:'assistant',content:displayed,streaming:true};return u})}
const finalContent=full.replace(/__FILE_ID__:[^_]+__\n?/,'')
setMessages(prev=>{const u=[...prev];u[u.length-1]={role:'assistant',content:finalContent,streaming:false};return u})
if(finalContent.includes('---FIN_REPORTE---'))setHasReport(true)
}catch(err:any){setMessages(prev=>{const u=[...prev];u[u.length-1]={role:'assistant',content:'Error: '+err.message,streaming:false};return u})}
finally{setLoading(false)}}
async function saveReport(){
const full=messages.filter(m=>m.role==='assistant').map(m=>m.content).join('\n')
const res=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rawReport:full,projectName,pdfName:pdfFile?.name})})
if(res.ok)setSaved(true)}
function renderMsg(content:string){
return content.split('\n').map((line,i)=>{
let color='var(--text)'
if(line.startsWith('FLAG #'))color='var(--gold)'
else if(line.includes('DISQUALIFYING'))color='var(--red)'
else if(line.includes('REJECTION'))color='var(--orange)'
else if(line.startsWith('Acción:'))color='#E8B820'
return<span key={i} style={{display:'block',minHeight:'1.4em',color}}>{line}</span>})}
if(status!=='authenticated')return null
if(phase==='upload')return(
<div style={{minHeight:'100vh',background:'var(--dark)'}}>
<nav style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',background:'var(--dark2)',borderBottom:'1px solid var(--border)'}}>
<button onClick={()=>router.push('/dashboard')} style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:14}}>← Dashboard</button>
<span style={{fontWeight:700,fontSize:20,letterSpacing:2,color:'var(--gold)'}}>SQC SCOPE</span>
<div style={{width:80}}/></nav>
<div style={{maxWidth:640,margin:'60px auto',padding:'0 24px'}} className="fade-up">
<h1 style={{fontSize:28,fontWeight:600,marginBottom:6}}>Nueva revisión</h1>
<p style={{color:'var(--text-dim)',marginBottom:32,fontSize:14}}>Sube el PDF del Site Capture para analizar la instalación.</p>
<div style={{marginBottom:20}}>
<label style={{display:'block',fontSize:12,color:'var(--text-dim)',marginBottom:8,fontWeight:500,letterSpacing:1}}>NOMBRE DEL PROYECTO / DIRECCIÓN</label>
<input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Ej: Juan García — Calle Sol 45, Bayamón"
style={{width:'100%',padding:'12px 16px',background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:15,outline:'none'}}/></div>
<div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0])}} onClick={()=>fileRef.current?.click()}
style={{border:`2px dashed ${pdfFile?'var(--gold)':'var(--border)'}`,borderRadius:'var(--radius-lg)',padding:'48px 32px',textAlign:'center',cursor:'pointer',marginBottom:24,background:pdfFile?'var(--gold-bg)':'var(--dark2)',transition:'all 0.2s'}}>
<input ref={fileRef} type="file" accept="application/pdf" onChange={e=>e.target.files&&handleFile(e.target.files[0])} style={{display:'none'}}/>
{pdfFile?(<><div style={{fontSize:36,marginBottom:8}}>📄</div><div style={{fontSize:15,fontWeight:500,color:'var(--gold)',marginBottom:4}}>{pdfFile.name}</div><div style={{fontSize:13,color:'var(--text-dim)'}}>{(pdfFile.size/1024/1024).toFixed(1)} MB · Click para cambiar</div></>)
:(<><div style={{fontSize:36,marginBottom:12}}>☁️</div><div style={{fontSize:16,fontWeight:500,marginBottom:8}}>Arrastra el Site Capture PDF aquí</div><div style={{fontSize:13,color:'var(--text-dim)'}}>o haz click para seleccionar</div><div style={{fontSize:12,color:'var(--text-dimmer)',marginTop:8}}>PDF · hasta 100MB</div></>)}</div>
<div style={{background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:20,marginBottom:28}}>
<div style={{fontSize:12,color:'var(--text-dimmer)',letterSpacing:1,marginBottom:14,fontWeight:500}}>SE ANALIZARÁ EN 9 BLOQUES</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px'}}>
{BLOCKS.map((b,i)=><div key={b} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-dim)'}}><span style={{color:'var(--gold)',fontFamily:'monospace',fontSize:11}}>{i+1}</span>{b}</div>)}</div></div>
<button className="btn btn-gold" onClick={startAnalysis} disabled={!pdfFile||!projectName.trim()} style={{width:'100%',justifyContent:'center',padding:'14px',fontSize:16,opacity:(!pdfFile||!projectName.trim())?0.4:1}}>
🔍 Iniciar análisis</button></div></div>)
return(
<div style={{height:'100vh',display:'flex',flexDirection:'column',background:'var(--dark)'}}>
<nav style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',background:'var(--dark2)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
<div style={{display:'flex',alignItems:'center',gap:12}}>
<button onClick={()=>router.push('/dashboard')} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:13}}>← Dashboard</button>
<span style={{color:'var(--border)'}}>|</span>
<span style={{fontSize:13,fontWeight:500}}>{projectName}</span></div>
<div style={{display:'flex',alignItems:'center',gap:10}}>
{hasReport&&!saved&&<button className="btn btn-gold" style={{padding:'6px 16px',fontSize:13}} onClick={saveReport}>Guardar</button>}
{saved&&<span style={{fontSize:13,color:'var(--green)'}}>✓ Guardado</span>}
<span style={{fontWeight:700,fontSize:18,letterSpacing:2,color:'var(--gold)'}}>SQC SCOPE</span></div></nav>
<div style={{flex:1,overflowY:'auto',padding:'24px 0'}}>
<div style={{maxWidth:800,margin:'0 auto',padding:'0 20px',display:'flex',flexDirection:'column',gap:20}}>
{messages.map((msg,i)=>(
<div key={i} className="fade-up" style={{display:'flex',gap:14,flexDirection:msg.role==='user'?'row-reverse':'row'}}>
<div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:msg.role==='user'?'var(--dark4)':'var(--gold)',fontSize:13,fontWeight:700,color:msg.role==='user'?'var(--text-dim)':'#000'}}>{msg.role==='user'?'T':'S'}</div>
<div style={{maxWidth:'82%',padding:'14px 18px',background:msg.role==='user'?'var(--dark3)':'var(--dark2)',border:`1px solid ${msg.role==='assistant'?'var(--border)':'transparent'}`,borderRadius:msg.role==='user'?'14px 4px 14px 14px':'4px 14px 14px 14px',fontFamily:'var(--font-mono)',fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
{renderMsg(msg.content)}
{msg.streaming&&<span style={{display:'inline-block',width:8,height:14,background:'var(--gold)',marginLeft:2,animation:'blink 0.8s infinite',verticalAlign:'middle'}}/>}</div></div>))}
<div ref={bottomRef}/></div></div>
<div style={{padding:'16px 20px',background:'var(--dark2)',borderTop:'1px solid var(--border)',flexShrink:0}}>
<div style={{maxWidth:800,margin:'0 auto',display:'flex',gap:10}}>
<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
{['CONTINUAR','REPORTE FINAL','LISTAR FLAGS'].map(cmd=>(
<button key={cmd} onClick={()=>send(cmd)} disabled={loading}
style={{padding:'6px 12px',fontSize:11,fontFamily:'monospace',background:'var(--dark3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text-dim)',cursor:loading?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
{cmd}</button>))}</div>
<input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Escribe un mensaje o corrección..." disabled={loading}
style={{flex:1,padding:'10px 16px',background:'var(--dark3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}/>
<button onClick={()=>send()} disabled={loading||!input.trim()} className="btn btn-gold" style={{padding:'10px 20px',opacity:(!input.trim()||loading)?0.4:1}}>
{loading?'⏳':'➤'}</button></div></div></div>)}