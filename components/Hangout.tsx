'use client'
import { useState } from 'react'

const OPTIONS = [
  { id:1, emoji:'🍺', label:'Drinks & bar',  votes:4 },
  { id:2, emoji:'🎤', label:'Karaoke',        votes:3 },
  { id:3, emoji:'🍕', label:'Dinner out',     votes:2 },
  { id:4, emoji:'🎳', label:'Bowling',        votes:1 },
  { id:5, emoji:'🎬', label:'Movie',          votes:1 },
]

const VENUES = [
  { emoji:'🍺', name:'Bier Markt',    meta:'0.4 km · King West · $$',                 tags:['550 beers','Group-friendly','Open til 2am'], over:false },
  { emoji:'🥂', name:'Bar Hop',       meta:'0.7 km · King West · $$',                 tags:['Craft cocktails','Low key vibe'], over:false },
  { emoji:'🍸', name:'Bar Centrale',  meta:'0.9 km · Entertainment District · $$$',   tags:['Slightly over budget','Good for groups'], over:true },
]

const BUDGETS = [
  { id:'casual', icon:'☕', label:'Casual',    range:'$20–40' },
  { id:'mid',    icon:'🍕', label:'Mid',       range:'$40–80' },
  { id:'nice',   icon:'🍽️', label:'Nice',      range:'$80–150' },
  { id:'splurge',icon:'⭐', label:'Splurge',   range:'$150+' },
]

export default function Hangout({ members }: { members: any[] }) {
  const [myVote, setMyVote]       = useState<number|null>(1)
  const [budget, setBudget]       = useState('mid')
  const [locked, setLocked]       = useState(false)
  const [treatSent, setTreatSent] = useState(false)
  const max = Math.max(...OPTIONS.map(o => o.votes))

  return (
    <div style={{ maxWidth:720 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* LEFT — Vote */}
        <div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>🗳️ What's the vibe?</div>
          {OPTIONS.map(o => {
            const isWinner = o.id === 1
            const isVoted  = myVote === o.id
            return (
              <div key={o.id} onClick={() => !locked && setMyVote(o.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', border:`1px solid ${isWinner ? 'var(--sage)' : isVoted ? 'var(--indigo)' : 'var(--border2)'}`, borderRadius:8, marginBottom:8, cursor: locked ? 'default' : 'pointer', background: isWinner ? 'var(--sage-dim)' : isVoted ? 'var(--indigo-dim)' : 'transparent', transition:'all 0.15s' }}>
                <span style={{ fontSize:20, width:28, textAlign:'center' }}>{o.emoji}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{o.label}</span>
                <div style={{ width:80, height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background: isWinner ? 'var(--sage)' : 'var(--indigo)', width:`${Math.round(o.votes/max*100)}%`, transition:'width 0.4s' }} />
                </div>
                <span style={{ fontSize:12, color:'var(--text3)', width:52, textAlign:'right' }}>{o.votes} votes</span>
                {isWinner && <span style={{ fontSize:10, color:'var(--sage)' }}>🏆</span>}
              </div>
            )
          })}

          <div style={{ marginTop:10, marginBottom:4, fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
            <span>Who's voted:</span>
            {members.map((m,i) => (
              <div key={m.id} style={{ width:22, height:22, borderRadius:'50%', background:m.color, color:m.text, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', opacity: i < 3 ? 1 : 0.35, border: i >= 3 ? '1.5px dashed var(--border2)' : 'none' }}>{m.initials}</div>
            ))}
            <span style={{ fontSize:11, color:'var(--text3)' }}>3 of 5</span>
          </div>

          <div style={{ marginTop:20, marginBottom:10, fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>💰 Your budget</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
            {BUDGETS.map(b => (
              <div key={b.id} onClick={() => setBudget(b.id)}
                style={{ padding:'10px 6px', border:`${budget===b.id ? '1.5px solid var(--indigo)' : '1px solid var(--border2)'}`, borderRadius:8, textAlign:'center', cursor:'pointer', background: budget===b.id ? 'var(--indigo-dim)' : 'transparent', transition:'all 0.15s' }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{b.icon}</div>
                <div style={{ fontSize:12, fontWeight:600, color: budget===b.id ? 'var(--indigo)' : 'var(--text)' }}>{b.label}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{b.range}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:5, marginBottom:16 }}>🔒 Your budget is never shown to others</div>

          {!treatSent ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--indigo-soft)', border:'1px solid rgba(108,99,255,0.3)', borderRadius:8 }}>
              <span style={{ fontSize:18 }}>🎉</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>Offer a treat to the group</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>Drinks, food, entry, or the ride home</div>
              </div>
              <button onClick={() => setTreatSent(true)} style={{ background:'var(--indigo)', border:'none', borderRadius:6, color:'#fff', padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>+ Offer</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'var(--sage-soft)', border:'1px solid rgba(76,175,135,0.3)', borderRadius:8, fontSize:13, color:'var(--sage)' }}>
              ✓ Treat offer sent — the crew sees "You've got the first round!"
            </div>
          )}
        </div>

        {/* RIGHT — Venues */}
        <div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>📍 Suggested spots</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>Filtered to $$ · near Liberty Village · Drinks & bar</div>

          {VENUES.map(v => (
            <div key={v.name} style={{ display:'flex', gap:12, padding:12, background:'var(--bg2)', border:`1px solid ${v.over ? 'rgba(240,168,85,0.3)' : 'var(--border)'}`, borderRadius:10, marginBottom:8, cursor:'pointer', transition:'border-color 0.15s' }}>
              <div style={{ width:48, height:48, borderRadius:8, background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{v.emoji}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{v.name}</div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{v.meta}</div>
                <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                  {v.tags.map(t => <span key={t} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: v.over && t.includes('over') ? 'var(--amber-soft)' : 'var(--indigo-soft)', color: v.over && t.includes('over') ? 'var(--amber)' : 'var(--indigo)' }}>{t}</span>)}
                </div>
              </div>
            </div>
          ))}

          <div style={{ fontSize:12, color:'var(--text2)', display:'flex', alignItems:'center', gap:5, marginBottom:14 }}>👥 Group sweet spot: Mid-range · 4 of 5 comfortable</div>

          {!locked ? (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--sage)', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--sage)', marginBottom:6 }}>🏆 Winner: Drinks & bar</div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>Lock in Bier Markt for tonight?</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setLocked(true)} style={{ background:'var(--sage-soft)', border:'1px solid rgba(76,175,135,0.3)', borderRadius:8, color:'var(--sage)', padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🔒 Lock plan</button>
                <button style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', padding:'8px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>More spots</button>
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--sage-soft)', border:'1px solid rgba(76,175,135,0.4)', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--sage)', marginBottom:4 }}>✓ Bier Markt locked for tonight!</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>The crew has been notified. See you at 9 PM 🍺</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}