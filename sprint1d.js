const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

// ─── Patch Composer.tsx ───────────────────────────────────────────────────────

const composerPath = path.join(BASE, 'components\\Composer.tsx');
let composerContent = fs.readFileSync(composerPath, 'utf8');

// 1. Add brief state variables
const oldState = `  const [creating, setCreating]           = useState(false)\n  const [hangoutError, setHangoutError]   = useState('')`;
const newState = `  const [creating, setCreating]           = useState(false)\n  const [hangoutError, setHangoutError]   = useState('')\n  const [briefNote, setBriefNote]         = useState('')\n  const [briefVibe, setBriefVibe]         = useState('')\n  const [briefBudget, setBriefBudget]     = useState('')`;

if (composerContent.includes(oldState)) {
  composerContent = composerContent.replace(oldState, newState);
  console.log('Added brief state variables');
} else { console.log('SKIP: state variables'); }

// 2. Reset brief
const oldReset = `    setHangoutError('')\n  }`;
const newReset = `    setHangoutError('')\n    setBriefNote('')\n    setBriefVibe('')\n    setBriefBudget('')\n  }`;
if (composerContent.includes(oldReset)) {
  composerContent = composerContent.replace(oldReset, newReset);
  console.log('Added brief reset');
} else { console.log('SKIP: reset'); }

// 3. Add brief to insert
const oldInsert = `      status:            whenType === 'now' ? 'live' : 'confirmed',`;
const newInsert = `      brief:             briefNote.trim() || null,\n      brief_vibe:        briefVibe || null,\n      brief_budget:      briefBudget || null,\n      status:            whenType === 'now' ? 'live' : 'confirmed',`;
if (composerContent.includes(oldInsert)) {
  composerContent = composerContent.replace(oldInsert, newInsert);
  console.log('Added brief fields to insert');
} else { console.log('SKIP: insert'); }

// 4. Add brief UI — insert before the When section
const BRIEF_UI = `          {/* GROUP BRIEF */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Brief</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Give the group context before they RSVP</div>
            <input
              value={briefNote}
              onChange={e => setBriefNote(e.target.value)}
              placeholder="What is the plan exactly? Any details to know..."
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['Chill', 'Active', 'Party', 'Foodie', 'Culture', 'Outdoors'].map(v => (
                <button key={v} onClick={() => setBriefVibe(briefVibe === v ? '' : v)}
                  style={{ padding: '5px 10px', borderRadius: 20, border: briefVibe === v ? '1px solid var(--yellow)' : '1px solid var(--border2)', background: briefVibe === v ? 'var(--yellow-soft)' : 'transparent', color: briefVibe === v ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: briefVibe === v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'free', label: 'Free' }, { id: 'cheap', label: 'Cheap' }, { id: 'mid', label: 'Mid' }, { id: 'splurge', label: 'Splurge' }].map(b => (
                <button key={b.id} onClick={() => setBriefBudget(briefBudget === b.id ? '' : b.id)}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: briefBudget === b.id ? '1px solid var(--yellow)' : '1px solid var(--border2)', background: briefBudget === b.id ? 'var(--yellow-soft)' : 'transparent', color: briefBudget === b.id ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: briefBudget === b.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

`;

const oldWhenAnchor = `          <div style={{ marginBottom: 14 }}>\n            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>When</div>`;
if (composerContent.includes(oldWhenAnchor)) {
  composerContent = composerContent.replace(oldWhenAnchor, BRIEF_UI + oldWhenAnchor);
  fs.writeFileSync(composerPath, composerContent, 'utf8');
  console.log('Added brief UI to Composer.tsx');
} else { console.log('ERROR: When anchor not found'); }

// ─── Patch HangoutCard.tsx ────────────────────────────────────────────────────

const cardPath = path.join(BASE, 'components\\HangoutCard.tsx');
let cardContent = fs.readFileSync(cardPath, 'utf8');

const BRIEF_CARD = `      {!isCancelled && (isVoting || isConfirmed) && (hangout.brief || hangout.brief_vibe || hangout.brief_budget) && (
        <div style={{ padding: '10px 12px', background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: \`1px solid \${borderSep}\`, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Brief</div>
          {hangout.brief && <div style={{ fontSize: 13, color: textColor, marginBottom: 6, lineHeight: 1.5 }}>{hangout.brief}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hangout.brief_vibe && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', fontSize: 11, fontWeight: 600, color: '#EAB308' }}>{hangout.brief_vibe}</span>}
            {hangout.brief_budget && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{hangout.brief_budget}</span>}
          </div>
        </div>
      )}

      `;

const oldVoting = `      {!isCancelled && isVoting && options.length > 0 && (`;
if (cardContent.includes(oldVoting)) {
  cardContent = cardContent.replace(oldVoting, BRIEF_CARD + `{!isCancelled && isVoting && options.length > 0 && (`);
  fs.writeFileSync(cardPath, cardContent, 'utf8');
  console.log('Added brief display to HangoutCard.tsx');
} else { console.log('ERROR: voting anchor not found in HangoutCard'); }

console.log('\nSprint 1D complete.');
