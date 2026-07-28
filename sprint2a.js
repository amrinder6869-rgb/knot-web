const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';
const discoverPath = path.join(BASE, 'components\\Discover.tsx');
let content = fs.readFileSync(discoverPath, 'utf8');

// 1. Add groupSize state after budget state
const oldBudget = `  const [budget, setBudget]     = useState<number|null>(2)`;
const newBudget = `  const [budget, setBudget]     = useState<number|null>(2)
  const [groupSize, setGroupSize] = useState<number>(4)
  const [merchants, setMerchants] = useState<Record<string, any>>({})`;

if (content.includes(oldBudget)) {
  content = content.replace(oldBudget, newBudget);
  console.log('Added groupSize and merchants state');
} else { console.log('SKIP: budget state not found'); }

// 2. Add merchant enrichment function after searchVenues function
const oldLockVenue = `  function lockVenue(venue: any) {`;
const newLockVenue = `  async function enrichWithMerchants(placeIds: string[]) {
    if (placeIds.length === 0) return
    try {
      const { data } = await supabase
        .from('merchants')
        .select('id, place_id, name, min_group_size, max_group_size')
        .in('place_id', placeIds)
        .eq('active', true)
      if (data) {
        const map: Record<string, any> = {}
        data.forEach((m: any) => { map[m.place_id] = m })
        setMerchants(map)
      }
    } catch (err) {
      console.error('Merchant enrichment error:', err)
    }
  }

  function lockVenue(venue: any) {`;

if (content.includes(oldLockVenue)) {
  content = content.replace(oldLockVenue, newLockVenue);
  console.log('Added enrichWithMerchants function');
} else { console.log('SKIP: lockVenue not found'); }

// 3. Call enrichWithMerchants after venues are set
const oldSetVenues = `        setVenues(data.results)
      } else {`;
const newSetVenues = `        setVenues(data.results)
        const placeIds = data.results.map((v: any) => v.fsq_id).filter(Boolean)
        enrichWithMerchants(placeIds)
      } else {`;

if (content.includes(oldSetVenues)) {
  content = content.replace(oldSetVenues, newSetVenues);
  console.log('Added enrichWithMerchants call after venues set');
} else { console.log('SKIP: setVenues pattern not found'); }

// 4. Add group size filter UI after budget section
const oldErrorSection = `      {/* Error */}
      {error && (`;
const newErrorSection = `      {/* Group size */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Group size</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setGroupSize(s => Math.max(2, s - 1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>
            -
          </button>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{groupSize}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>people</div>
          </div>
          <button onClick={() => setGroupSize(s => Math.min(20, s + 1))}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>
            +
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[2, 4, 6, 8, 10].map(n => (
              <button key={n} onClick={() => setGroupSize(n)}
                style={{ padding: '5px 12px', borderRadius: 20, border: groupSize === n ? '1px solid var(--yellow)' : '1px solid var(--border2)', background: groupSize === n ? 'var(--yellow-soft)' : 'transparent', color: groupSize === n ? 'var(--yellow)' : 'var(--text3)', fontSize: 12, fontWeight: groupSize === n ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (`;

if (content.includes(oldErrorSection)) {
  content = content.replace(oldErrorSection, newErrorSection);
  console.log('Added group size filter UI');
} else { console.log('SKIP: error section anchor not found'); }

// 5. Add Knot merchant badge to venue cards
const oldVenueInfo = `                  <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, color: 'var(--text)' }}>{v.name}</div>`;
const newVenueInfo = `                  <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{v.name}</div>
                        {merchants[v.fsq_id] && (
                          <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', fontSize: 10, fontWeight: 700, color: '#EAB308', whiteSpace: 'nowrap' }}>
                            Knot
                          </span>
                        )}
                      </div>`;

if (content.includes(oldVenueInfo)) {
  content = content.replace(oldVenueInfo, newVenueInfo);
  console.log('Added Knot merchant badge to venue cards');
} else { console.log('SKIP: venue info block not found'); }

fs.writeFileSync(discoverPath, content, 'utf8');
console.log('\nSprint 2A complete.');
console.log('Group size filter added to Discover.');
console.log('Merchant enrichment queries Supabase for Knot badge on results.');
console.log('Merchants and knot_specials tables created in Supabase.');
