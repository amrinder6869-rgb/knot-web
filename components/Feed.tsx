'use client'
type Reaction = { e: string; n: number; mine: boolean }
type Post = {
  id: number; author: string; initials: string; color: string; text: string
  action: string; time: string; sub: string; type: string
  emojis?: string[]; reactions: Reaction[]
}
import { useState } from 'react'

const POSTS = [
  { id:1, author:'Priya', initials:'PR', color:'#1A3028', text:'#4CAF87', action:'added photos from last Friday', time:'2 hours ago', sub:'Karaoke Night @ Sugar Factory', type:'photos', emojis:['🎤','🍸','🎵'], reactions:[{e:'🔥',n:3,mine:true},{e:'😂',n:2,mine:false},{e:'❤️',n:4,mine:false}] },
  { id:2, author:'Karan', initials:'KA', color:'#2E1C18', text:'#E8624A', action:'offered a treat 🎉', time:'Yesterday', sub:'First round drinks tonight', type:'treat', reactions:[] },
  { id:3, author:'Sofia', initials:'SO', color:'#2B2010', text:'#F0A855', action:'settled up', time:'3 days ago', sub:'Paid $27.08 · via Interac', type:'settled', reactions:[] },
  { id:4, author:'Dev',   initials:'DE', color:'#1e1528', text:'#C97BB2', action:'added a memory 🏀', time:'Last week', sub:'Sunday basketball', type:'photos', emojis:['🏀','🌅'], reactions:[{e:'🏆',n:2,mine:false}] },
  { id:5, author:'Knot',  initials:'K',  color:'#2A2850', text:'#6C63FF', action:'update', time:'5 days ago', sub:'Marcus joined the Brampton Crew 👋', type:'system', reactions:[] },
]

export default function Feed({ members, knotName }: { members: any[], knotName: string }) {
  const [posts, setPosts] = useState<Post[]>(POSTS as Post[])
  const [newPost, setNewPost] = useState('')

  function toggleReaction(postId: number, emoji: string) {
    setPosts(ps => ps.map(p => {
      if (p.id !== postId) return p
      const exists = p.reactions.find(r => r.e === emoji)
      if (exists) return { ...p, reactions: p.reactions.map(r => r.e === emoji ? { ...r, n: r.mine ? r.n-1 : r.n+1, mine: !r.mine } : r) }
      return { ...p, reactions: [...p.reactions, { e: emoji, n: 1, mine: true }] }
    }))
  }

  function addPost() {
    if (!newPost.trim()) return
    setPosts(ps => [{ id: Date.now(), author:'Amrinder', initials:'AM', color:'#2A2850', text:'#6C63FF', action: newPost, time:'Just now', sub:'', type:'moment', emojis:[], reactions:[] }, ...ps])
    setNewPost('')
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--indigo)', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:11, color:'var(--indigo)', fontWeight:600, marginBottom:6 }}>TONIGHT'S PLAN</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Drinks & bar 🍺</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>Bier Markt · 9:00 PM</div>
          <div style={{ display:'flex', gap:4, marginTop:8 }}>
            {members.map(m => <div key={m.id} style={{ width:22, height:22, borderRadius:'50%', background:m.color, color:m.text, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{m.initials}</div>)}
          </div>
        </div>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:6 }}>OPEN BALANCE</div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--coral)', marginBottom:4 }}>–$54.16</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>across 2 hangs</div>
        </div>
      </div>

      {/* Post box */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:14, marginBottom:20 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#2A2850', color:'#6C63FF', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>AM</div>
          <input value={newPost} onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addPost()}
            placeholder="Share a moment with the crew..."
            style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 12px', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit' }} />
          <button onClick={addPost} style={{ background:'var(--indigo)', border:'none', borderRadius:8, color:'#fff', padding:'9px 16px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Post</button>
        </div>
      </div>

      {/* Feed */}
      {posts.map(p => (
        <div key={p.id} style={{ display:'flex', gap:12, padding:'16px 0', borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:p.color, color:p.text, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{p.initials}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13 }}><strong style={{ color:'var(--text)' }}>{p.author}</strong> <span style={{ color:'var(--text2)' }}>{p.action}</span></div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{p.time}{p.sub && ` · ${p.sub}`}</div>

            {p.type === 'photos' && p.emojis && (
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${p.emojis.length},1fr)`, gap:6, marginTop:10, maxWidth:240 }}>
                {p.emojis.map((e,i) => <div key={i} style={{ aspectRatio:'1', background:'var(--bg3)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, border:'1px solid var(--border)' }}>{e}</div>)}
              </div>
            )}
            {p.type === 'treat' && (
              <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'var(--indigo-soft)', border:'1px solid rgba(108,99,255,0.3)', borderRadius:8, fontSize:13 }}>
                🍺 <span style={{ fontWeight:500 }}>Karan's got the first round tonight</span>
                <span style={{ marginLeft:'auto', fontSize:11, background:'var(--indigo-soft)', color:'var(--indigo)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(108,99,255,0.4)' }}>Active</span>
              </div>
            )}
            {p.type === 'settled' && <div style={{ marginTop:6, fontSize:13, color:'var(--sage)' }}>✓ {p.sub}</div>}
            {p.type === 'system' && <div style={{ marginTop:6, fontSize:13, color:'var(--text2)' }}>{p.sub}</div>}

            {p.reactions.length > 0 && (
              <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                {p.reactions.map(r => (
                  <button key={r.e} onClick={() => toggleReaction(p.id, r.e)}
                    style={{ padding:'4px 10px', borderRadius:20, background: r.mine ? 'var(--indigo-dim)' : 'var(--bg3)', border:`1px solid ${r.mine ? 'var(--indigo)' : 'var(--border2)'}`, color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    {r.e} {r.n}
                  </button>
                ))}
                <button onClick={() => toggleReaction(p.id, '👍')}
                  style={{ padding:'4px 10px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  + React
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}