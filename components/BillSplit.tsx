'use client'
import { useState } from 'react'

export default function BillSplit({ members }: { members: any[] }) {
  const [splits, setSplits] = useState([
    { id:'1', name:'Amrinder', initials:'AM', color:'#2A2850', text:'#6C63FF', you:true,  amount:27.08, settled:false, treat:false },
    { id:'2', name:'Priya',    initials:'PR', color:'#1A3028', text:'#4CAF87', you:false, amount:27.08, settled:false, treat:false },
    { id:'3', name:'Karan',    initials:'KA', color:'#2E1C18', text:'#E8624A', you:false, amount:0,     settled:true,  treat:true  },
    { id:'4', name:'Sofia',    initials:'SO', color:'#2B2010', text:'#F0A855', you:false, amount:27.08, settled:true,  treat:false },
    { id:'5', name:'Dev',      initials:'DE', color:'#1e1528', text:'#C97BB2', you:false, amount:27.08, settled:true,  treat:false },
  ])

  const [balances] = useState([
    { name:'Priya', initials:'PR', color:'#1A3028', text:'#4CAF87', net:-27.08, dir:'owe' },
    { name:'Sofia', initials:'SO', color:'#2B2010', text:'#F0A855', net:14.50,  dir:'owed' },
    { name:'Karan', initials:'KA', color:'#2E1C18', text:'#E8624A', net:0,      dir:'even' },
    { name:'Dev',   initials:'DE', color:'#1e1528', text:'#C97BB2', net:9.20,   dir:'owed' },
  ])

  function settle(id: string) {
    setSplits(s => s.map(x => x.id===id ? {...x, settled:true} : x))
  }

  const settledCount = splits.filter(s => s.settled || s.treat).length
  const progress = Math.round(settledCount / splits.length * 100)

  return (
    <div style={{ maxWidth:720 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* LEFT */}
        <div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>🧾 Friday at Bier Markt</div>

          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:22, fontWeight:800 }}>$187.40</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>Jun 13 · Bier Markt</div>
              </div>
              <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background:'var(--amber-soft)', color:'var(--amber)' }}>2 pending</span>
            </div>

            {/* Treat */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--indigo-soft)', border:'1px solid rgba(108,99,255,0.25)', borderRadius:8, marginBottom:12 }}>
              <span>🍺</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>Karan's treat — first round</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>–$52.00 applied · remaining: $135.40</div>
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--indigo-soft)', color:'var(--indigo)', border:'1px solid rgba(108,99,255,0.3)' }}>Applied</span>
            </div>

            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:10 }}>SPLIT 5 WAYS → $27.08 each</div>

            {splits.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:s.color, color:s.text, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.initials}</div>
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{s.name}{s.you ? ' (you)' : ''}</span>
                <span style={{ fontSize:14, fontWeight:700, color: s.treat ? 'var(--text3)' : s.settled ? 'var(--text3)' : 'var(--coral)', textDecoration: s.settled && !s.treat ? 'line-through' : 'none' }}>
                  {s.treat ? 'Treat applied' : `$${s.amount.toFixed(2)}`}
                </span>
                {s.treat ? (
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--indigo-soft)', color:'var(--indigo)' }}>❤️ Covered</span>
                ) : s.settled ? (
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--sage-soft)', color:'var(--sage)' }}>✓ Paid</span>
                ) : s.you ? (
                  <button onClick={() => settle(s.id)} style={{ fontSize:12, padding:'4px 12px', borderRadius:8, background:'var(--sage-soft)', border:'1px solid rgba(76,175,135,0.3)', color:'var(--sage)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>↗ Pay</button>
                ) : (
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--amber-soft)', color:'var(--amber)' }}>Pending</span>
                )}
              </div>
            ))}

            <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden', marginTop:14 }}>
              <div style={{ height:'100%', borderRadius:3, background:'var(--sage)', width:`${progress}%`, transition:'width 0.4s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>{settledCount} of {splits.length} settled</div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>📊 Running balances</div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:10 }}>NET ACROSS ALL HANGS</div>
            {balances.map(b => (
              <div key={b.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:b.color, color:b.text, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{b.initials}</div>
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{b.name}</span>
                <span style={{ fontSize:13, fontWeight:700, color: b.dir==='owe' ? 'var(--coral)' : b.dir==='owed' ? 'var(--sage)' : 'var(--text3)' }}>
                  {b.dir==='owe' ? `You owe $${Math.abs(b.net).toFixed(2)}` : b.dir==='owed' ? `Owes you $${b.net.toFixed(2)}` : 'Even'}
                </span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:13, color:'var(--text2)' }}>Net balance</span>
              <span style={{ fontSize:16, fontWeight:800, color:'var(--coral)' }}>–$3.38 you owe</span>
            </div>
          </div>

          <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>🎁 Treat history</div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
            {[
              { who:'Karan', what:'Drinks · tonight', active:true, initials:'KA', color:'#2E1C18', text:'#E8624A' },
              { who:'You',   what:'Food · May 30',    active:false, initials:'AM', color:'#2A2850', text:'#6C63FF' },
              { who:'Sofia', what:'Entry · May 10',   active:false, initials:'SO', color:'#2B2010', text:'#F0A855' },
            ].map(t => (
              <div key={t.who} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:t.color, color:t.text, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{t.initials}</div>
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{t.who}</span>
                <span style={{ fontSize:12, color:'var(--text2)' }}>{t.what}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: t.active ? 'var(--indigo-soft)' : 'var(--bg4)', color: t.active ? 'var(--indigo)' : 'var(--text3)', border: t.active ? '1px solid rgba(108,99,255,0.3)' : 'none' }}>{t.active ? 'Active' : 'Done'}</span>
              </div>
            ))}
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:10, display:'flex', alignItems:'center', gap:5 }}>💡 Priya & Dev haven't treated recently</div>
          </div>
        </div>
      </div>
    </div>
  )
}