'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  merchant: any
}

const CATEGORIES = ['Starters', 'Mains', 'Sides', 'Desserts', 'Drinks', 'Packages', 'Other']

export default function MerchantMenu({ merchant }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Mains')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('category')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!name.trim()) { setError('Please enter item name.'); return }
    if (!price || isNaN(parseFloat(price))) { setError('Please enter a valid price.'); return }
    setSaving(true); setError('')
    const { error: insertError } = await supabase.from('menu_items').insert({
      merchant_id: merchant.id,
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(parseFloat(price).toFixed(2)),
      category,
      available: true,
    })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    setName(''); setDescription(''); setPrice(''); setCategory('Mains')
    loadItems()
  }

  async function toggleItem(id: string, available: boolean) {
    await supabase.from('menu_items').update({ available: !available }).eq('id', id)
    loadItems()
  }

  async function deleteItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id)
    loadItems()
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Menu</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Group members will select from these items when pre-ordering.</div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Item
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--yellow)', borderRadius: 12, padding: '20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Add menu item</div>
          {error && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Item name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Butter Chicken"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Price (CAD)</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="e.g. 14.99"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ingredients or details..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: category === c ? '1px solid var(--yellow)' : '1px solid var(--border)', background: category === c ? '#FFFBEB' : 'transparent', color: category === c ? '#D97706' : 'var(--text2)', fontSize: 12, fontWeight: category === c ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(false); setError('') }}
              style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={saveItem} disabled={saving}
              style={{ flex: 2, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Add to menu'}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading menu...</div>}

      {!loading && items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No menu items yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Add your menu so groups can pre-order before they arrive.</div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Add first item
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {catItems.map((item: any) => (
              <div key={item.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: item.available ? 1 : 0.5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>${parseFloat(item.price).toFixed(2)}</span>
                  <button onClick={() => toggleItem(item.id, item.available)}
                    style={{ padding: '4px 10px', background: item.available ? '#F0FDF4' : '#F5F5F5', border: item.available ? '1px solid #BBF7D0' : '1px solid var(--border)', borderRadius: 6, color: item.available ? 'var(--sage)' : 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {item.available ? 'On' : 'Off'}
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
