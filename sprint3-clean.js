const fs = require('fs')
const path = require('path')
const https = require('https')

const LOCAL = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const RAW_URL = 'https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/components/HangoutCard.tsx'

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Fetching clean HangoutCard from GitHub...')
  const source = await fetchRaw(RAW_URL)
  if (!source.includes("'use client'")) { console.log('ERROR: bad fetch'); process.exit(1) }
  const lines = source.split('\n')
  console.log('Fetched', lines.length, 'lines')

  // Verify key anchors match expected line numbers
  const anchors = {
    'deletingBillId useState': lines.findIndex(l => l.includes('deletingBillId') && l.includes('useState')),
    'if (!hangout) return null': lines.findIndex(l => l.includes('if (!hangout) return null')),
    'BRIEF_BUDGET_LABELS brief_budget': lines.findIndex(l => l.includes('BRIEF_BUDGET_LABELS[hangout.brief_budget]')),
    'useEffect setHangout': lines.findIndex(l => l.includes('useEffect') && l.includes('{') && lines[lines.indexOf(l)+1]?.includes('setHangout')),
  }
  console.log('Anchors:', Object.entries(anchors).map(([k,v]) => `${k}=L${v+1}`).join(', '))

  // ── 1. Add brief state variables after deletingBillId ────────────────────
  const stateIdx = anchors['deletingBillId useState']
  lines.splice(stateIdx + 1, 0,
    `  const [memberBriefs, setMemberBriefs] = useState<any[]>([])`,
    `  const [myBriefNote, setMyBriefNote] = useState('')`,
    `  const [briefSubmitting, setBriefSubmitting] = useState(false)`,
    `  const [myBriefId, setMyBriefId] = useState<string | null>(null)`,
  )
  console.log('Added brief state at line', stateIdx + 2)

  // ── 2. Add brief fetch useEffect after the re-sync useEffect ─────────────
  // Re-sync useEffect is the one that calls setHangout, setOptions, etc.
  // Find it after the state additions
  const resyncIdx = lines.findIndex((l, i) => i > stateIdx && l.includes('useEffect(() => {') && lines[i+1]?.includes('setHangout'))
  // Find its closing bracket — look for }, [data])
  let resyncEnd = resyncIdx
  for (let i = resyncIdx + 1; i < resyncIdx + 15; i++) {
    if (lines[i] && lines[i].includes('}, [data])')) { resyncEnd = i; break }
  }
  console.log('Re-sync useEffect ends at line', resyncEnd + 1)

  lines.splice(resyncEnd + 1, 0,
    ``,
    `  useEffect(() => {`,
    `    async function fetchBriefs() {`,
    `      const { data } = await supabase`,
    `        .from('hangout_briefs')`,
    `        .select('id, user_id, note, profiles:user_id(name)')`,
    `        .eq('hangout_id', hangout.id)`,
    `        .order('created_at', { ascending: true })`,
    `      if (!data) return`,
    `      setMemberBriefs(data)`,
    `      const mine = data.find((b: any) => b.user_id === currentUser?.id)`,
    `      if (mine) { setMyBriefId(mine.id); setMyBriefNote(mine.note || '') }`,
    `    }`,
    `    fetchBriefs()`,
    `  }, [hangout.id, currentUser?.id])`,
  )
  console.log('Added brief fetch useEffect')

  // ── 3. Add submitBrief function before if (!hangout) return null ──────────
  const renderIdx = lines.findIndex(l => l.includes('if (!hangout) return null'))
  lines.splice(renderIdx, 0,
    `  async function submitBrief() {`,
    `    if (!myBriefNote.trim() || !currentUser || briefSubmitting) return`,
    `    setBriefSubmitting(true)`,
    `    try {`,
    `      if (myBriefId) {`,
    `        await supabase.from('hangout_briefs').update({ note: myBriefNote.trim() }).eq('id', myBriefId)`,
    `        setMemberBriefs(prev => prev.map(b => b.id === myBriefId ? { ...b, note: myBriefNote.trim() } : b))`,
    `      } else {`,
    `        const { data } = await supabase.from('hangout_briefs')`,
    `          .insert({ hangout_id: hangout.id, user_id: currentUser.id, knot_id: knotId, note: myBriefNote.trim() })`,
    `          .select('id, user_id, note, profiles:user_id(name)')`,
    `          .single()`,
    `        if (data) { setMyBriefId(data.id); setMemberBriefs(prev => [...prev, data]) }`,
    `      }`,
    `    } catch (err) { console.error('Brief submit error:', err) }`,
    `    setBriefSubmitting(false)`,
    `  }`,
    ``,
  )
  console.log('Added submitBrief function')

  // ── 4. Insert group brief UI after creator brief block closes ────────────
  // Find BRIEF_BUDGET_LABELS line, then find the )} that closes that block
  const budgetLabelIdx = lines.findIndex(l => l.includes('BRIEF_BUDGET_LABELS[hangout.brief_budget]'))
  let creatorBriefClose = budgetLabelIdx
  for (let i = budgetLabelIdx + 1; i < budgetLabelIdx + 8; i++) {
    if (lines[i] && lines[i].trim() === ')}') { creatorBriefClose = i; break }
  }
  console.log('Inserting group brief UI after line', creatorBriefClose + 1)

  lines.splice(creatorBriefClose + 1, 0,
    ``,
    `      {!isCancelled && (isVoting || isConfirmed) && (`,
    `        <div style={{ marginBottom: 14 }}>`,
    `          <div style={{ fontSize: 10, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Group input</div>`,
    `          {memberBriefs.filter(b => b.user_id !== currentUser?.id).map(b => (`,
    `            <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>`,
    `              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>`,
    `                {(b.profiles?.name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}`,
    `              </div>`,
    `              <div style={{ flex: 1, background: 'var(--bg3)', border: \`1px solid \${borderSep}\`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: textColor, lineHeight: 1.5 }}>`,
    `                <span style={{ fontWeight: 600, color: subColor, marginRight: 6 }}>{b.profiles?.name?.split(' ')[0] || 'Member'}</span>`,
    `                {b.note}`,
    `              </div>`,
    `            </div>`,
    `          ))}`,
    `          <div style={{ display: 'flex', gap: 6 }}>`,
    `            <input`,
    `              value={myBriefNote}`,
    `              onChange={e => setMyBriefNote(e.target.value)}`,
    `              onKeyDown={e => e.key === 'Enter' && submitBrief()}`,
    `              placeholder={myBriefId ? 'Update your note...' : 'Add a note for the group...'}`,
    `              style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: \`1px solid \${borderSep}\`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}`,
    `            />`,
    `            <button`,
    `              onClick={submitBrief}`,
    `              disabled={!myBriefNote.trim() || briefSubmitting}`,
    `              style={{ padding: '7px 14px', background: myBriefNote.trim() ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 8, color: myBriefNote.trim() ? '#111' : subColor, fontSize: 12, fontWeight: 700, cursor: myBriefNote.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: briefSubmitting ? 0.5 : 1 }}`,
    `            >`,
    `              {myBriefId ? 'Update' : 'Add'}`,
    `            </button>`,
    `          </div>`,
    `        </div>`,
    `      )}`,
  )

  fs.writeFileSync(LOCAL, lines.join('\n'), 'utf8')
  console.log('\nDone. Run: npm run build')
}

main().catch(console.error)
