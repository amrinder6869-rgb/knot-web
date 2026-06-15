'use client'
import { useState } from 'react'

const MEMORIES = {
  '2025': [
    { emoji:'🎤', name:'Karaoke Night',    date:'Jun 14', photos:24, type:'night' },
    { emoji:'🍺', name:'Bier Markt Friday', date:'May 30', photos:18, type:'night' },
    { emoji:'🎂', name:"Priya's Birthday",  date:'May 10', photos:41, type:'birthday' },
  ],
  '2024': [
    { emoji:'✈️', name:'NYC Trip',          date:'Oct 2024', photos:89, type:'trip' },
    { emoji:'🏀', name:'Sunday Basketball', date:'Aug 3',    photos:12, type:'night' },
    { emoji:'🗝️', name:'Escape Room',       date:'Jul 2024', photos:9,  type:'night' },
  ],
}

const GRADIENTS: Record<string,string> = {
  night:    'linear-gradient(135deg,#2A2850,#1A3028)',
  birthday: 'linear-gradient(135deg,#1e1528,#2A2850)',
  trip:     'linear-gradient(135deg,#2B2010,#1A2535)',
}

export default function Memories({ members }: { members: any[] }) {
  const [filter, setFilter] = useState('All')
  const filters = ['All','Nights out','Trips','Birthdays']

  return (
    <div style={{ maxWidth:720 }}>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['47','Hangs','var(--indigo)'],['312','Photos','var(--sage)'],['2','Trips','var(--amber)'],['3 yrs','Together','var(--coral)']].map(([v,l,c]) => (
          <div key={l} style={{ background:'var(--bg2)', border:`1px solid ${c}`, borderRadius:12, padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:c as string }}>{v}</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* On this day */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--indigo)', borderRadius:12, padding:14, marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--indigo-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📅</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>On this day, one year ago</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>You were all at Karaoke — Sugar Factory, June 14 2024 🎤</div>
        </div>
        <button style={{ padding:'7px 14px', background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>View</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${filter===f ? 'var(--indigo)' : 'var(--border2)'}`, background: filter===f ? 'var(--indigo-soft)' : 'transparent', color: filter===f ? 'var(--indigo)' : 'var(--text3)', fontSize:12, fontWeight: filter===f ? 600 : 400, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Albums */}
      {Object.entries(MEMORIES).map(([year, items]) => (
        <div key={year} style={{ marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text3)', marginBottom:12 }}>{year}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {items.map(m => (
              <div key={m.name} onClick={() => alert(`Opening ${m.name} · ${m.photos} photos`)}
                style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'border-color 0.15s' }}>
                <div style={{ aspectRatio:'1', background:GRADIENTS[m.type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>{m.emoji}</div>
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{m.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{m.date} · {m.photos} photos</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Privacy note */}
      <div style={{ padding:'12px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:8 }}>
        🔒 Photos are permanently private to this Knot. No sharing outside, no public access, ever.
      </div>
    </div>
  )
}