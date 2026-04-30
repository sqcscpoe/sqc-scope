'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Project } from '@/lib/storage'
const LABELS: Record<string,string> = {APROBADO:'Aprobado',APROBADO_CON_WARNINGS:'Aprobado c/Warnings',RECHAZADO:'Rechazado',DESCALIFICADO:'Descalificado',EN_PROGRESO:'En progreso'}
const CLASSES: Record<string,string> = {APROBADO:'badge-ok',APROBADO_CON_WARNINGS:'badge-warn',RECHAZADO:'badge-rej',DESCALIFICADO:'badge-dq',EN_PROGRESO:'badge-prog'}
export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'RECHAZADO'|'APROBADO'|'DESCALIFICADO'>('all')
  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/projects').then(r => r.json()).then(data => { setProjects(Array.isArray(data) ? data : []); setLoading(false) })
  }, [status])
  const filtered = filter === 'all' ? projects : projects.filter(p => p.result === filter)
  const company = (session?.user as any)?.company || ''
  const stats = { total: projects.length, aprobados: projects.filter(p=>p.result==='APROBADO'||p.result==='APROBADO_CON_WARNINGS').length, rechazados: projects.filter(p=>p.result==='RECHAZADO').length, dq: projects.filter(p=>p.result==='DESCALIFICADO').length }
  if (status === 'loading' || status === 'unauthenticated') return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner" style={{width:32,height:32,border:'2px solid var(--gold)',borderTopColor:'transparent',borderRadius:'50%'}} /></div>
  return (
    <div style={{minHeight:'100vh',background:'var(--dark)'}}>
      <nav style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',background:'var(--dark2)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:22,letterSpacing:2,color:'var(--gold)'}}>SQC SCOPE</span>
          <span style={{fontSize:11,color:'var(--text-dimmer)',letterSpacing:2}}>SOLAR QUALITY CONTROL</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:13,color:'var(--text-dim)'}}>{company}</span>
          <span style={{fontSize:13,color:'var(--text-dim)'}}>{session?.user?.name}</span>
          <button className="btn btn-outline" style={{padding:'6px 14px',fontSize:13}} onClick={() => signOut({callbackUrl:'/login'})}>Salir</button>
        </div>
      </nav>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'32px 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32}}>
          <div><h1 style={{fontSize:28,fontWeight:600,marginBottom:4}}>Proyectos</h1><p style={{fontSize:14,color:'var(--text-dim)'}}>Historial de revisiones M1 — {company}</p></div>
          <button className="btn btn-gold" onClick={() => router.push('/review')}>+ Nueva revision</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:32}}>
          {[{l:'Total',v:stats.total,c:'var(--text)'},{l:'Aprobados',v:stats.aprobados,c:'var(--green)'},{l:'Rechazados',v:stats.rechazados,c:'var(--orange)'},{l:'Descalificados',v:stats.dq,c:'var(--red)'}].map(s=>(
            <div key={s.l} style={{background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px 20px'}}>
              <div style={{fontSize:11,color:'var(--text-dimmer)',letterSpacing:1,marginBottom:8}}>{s.l.toUpperCase()}</div>
              <div style={{fontSize:32,fontFamily:'var(--font-display)',color:s.c,lineHeight:1}}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {(['all','APROBADO','RECHAZADO','DESCALIFICADO'] as const).map(f=>(
            <button key={f} onClick={() => setFilter(f)} style={{padding:'6px 16px',borderRadius:20,fontSize:13,cursor:'pointer',border:`1px solid ${filter===f?'var(--gold)':'var(--border)'}`,background:filter===f?'var(--gold-bg)':'transparent',color:filter===f?'var(--gold)':'var(--text-dim)'}}>
              {f==='all'?'Todos':LABELS[f]}
            </button>
          ))}
        </div>
        {loading ? <div style={{textAlign:'center',padding:60,color:'var(--text-dimmer)'}}>Cargando...</div> : filtered.length===0 ? (
          <div style={{textAlign:'center',padding:60,color:'var(--text-dimmer)',background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:16,marginBottom:8}}>No hay proyectos aun</div>
            <div style={{fontSize:13}}>Sube un Site Capture PDF para comenzar</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map((p,i)=>(
              <div key={p.id} className="fade-up" style={{animationDelay:`${i*0.04}s`}} onClick={() => router.push('/review')}>
                <div style={{display:'flex',alignItems:'center',gap:16,padding:'16px 20px',background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',cursor:'pointer'}}>
                  <div style={{width:4,height:40,borderRadius:2,flexShrink:0,background:p.result==='APROBADO'?'var(--green)':p.result==='RECHAZADO'?'var(--orange)':p.result==='DESCALIFICADO'?'var(--red)':'var(--gold)'}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,marginBottom:2,fontSize:15}}>{p.projectName}</div>
                    <div style={{fontSize:12,color:'var(--text-dimmer)'}}>{p.system} · {p.roofType}</div>
                  </div>
                  <span className={`badge ${CLASSES[p.result]||'badge-prog'}`}>{LABELS[p.result]||p.result}</span>
                  <div style={{display:'flex',gap:12,fontSize:13}}>
                    {p.totalDQ>0&&<span style={{color:'var(--red)',fontWeight:600}}>DQ: {p.totalDQ}</span>}
                    {p.totalRejection>0&&<span style={{color:'var(--orange)',fontWeight:600}}>REJ: {p.totalRejection}</span>}
                    {p.totalWarning>0&&<span style={{color:'#64B5F6'}}>W: {p.totalWarning}</span>}
                  </div>
                  <div style={{fontSize:12,color:'var(--text-dimmer)',flexShrink:0}}>{new Date(p.createdAt).toLocaleDateString('es-PR',{day:'2-digit',month:'short',year:'numeric'})}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}