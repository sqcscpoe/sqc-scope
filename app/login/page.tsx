'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.ok) { router.push('/dashboard') } else { setError('Email o contrasena incorrectos'); setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--dark)',backgroundImage:'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,152,10,0.12) 0%, transparent 60%)'}}>
      <div className="fade-up" style={{width:'100%',maxWidth:400,padding:'0 24px'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:42,letterSpacing:3,color:'var(--gold)',lineHeight:1}}>SQC SCOPE</div>
          <div style={{fontSize:12,color:'var(--text-dimmer)',letterSpacing:4,marginTop:4}}>SOLAR QUALITY CONTROL</div>
        </div>
        <div style={{background:'var(--dark2)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:32}}>
          <h2 style={{fontSize:18,fontWeight:600,marginBottom:6}}>Iniciar sesion</h2>
          <p style={{fontSize:13,color:'var(--text-dim)',marginBottom:28}}>Palmetto LightReach PR — Revision M1</p>
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text-dim)',marginBottom:6,fontWeight:500}}>EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus placeholder="tu@empresa.com"
                style={{width:'100%',padding:'10px 14px',background:'var(--dark3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
                onFocus={e=>e.target.style.borderColor='var(--border-gold)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12,color:'var(--text-dim)',marginBottom:6,fontWeight:500}}>CONTRASENA</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                style={{width:'100%',padding:'10px 14px',background:'var(--dark3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text)',fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
                onFocus={e=>e.target.style.borderColor='var(--border-gold)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
            </div>
            {error && <div style={{padding:'10px 14px',background:'var(--red-bg)',borderRadius:'var(--radius)',fontSize:13,color:'var(--red)'}}>{error}</div>}
            <button type="submit" className="btn btn-gold" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:8,padding:'12px 20px',fontSize:15}}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <p style={{textAlign:'center',marginTop:20,fontSize:12,color:'var(--text-dimmer)'}}>Problemas de acceso? Contacta al administrador.</p>
      </div>
    </div>
  )
}