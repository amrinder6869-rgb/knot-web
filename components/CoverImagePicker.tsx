'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import { useToast } from '@/components/ToastProvider'
import { ICON_SIZE } from '@/lib/constants'
import {
  COVER_IMAGE_SET,
  COVER_IMAGE_UPLOADING,
  COVER_IMAGE_PICKER_TITLE,
  COVER_IMAGE_LIBRARY_TAB,
  COVER_IMAGE_UPLOAD_TAB,
  COVER_IMAGE_SET_BUTTON,
  COVER_IMAGE_PREMIUM_LABEL,
  TOAST_ERROR,
} from '@/lib/copy'

// Premium packs are seeded in image_packs (tier='premium') but not for sale
// yet — the section below renders as a locked preview until this flips on.
const PREMIUM_PACKS_ENABLED = false

type ImagePack = {
  id: string
  name: string
  category: string
  tier: string
  images: string[]
  sort_order: number
}

interface CoverImagePickerProps {
  hangoutId: string
  knotId: string
  currentUser: any
  currentImageUrl?: string | null
  onClose: () => void
  onImageSet: (newUrl: string) => void
}

export default function CoverImagePicker({
  hangoutId,
  knotId,
  currentUser,
  currentImageUrl,
  onClose,
  onImageSet,
}: CoverImagePickerProps) {
  const toast = useToast()
  const [tab, setTab] = useState<'library' | 'upload'>('library')
  const [packs, setPacks] = useState<ImagePack[]>([])
  const [loadingPacks, setLoadingPacks] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentImageUrl ?? null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('image_packs')
      .select('id, name, category, tier, images, sort_order')
      .eq('tier', 'free')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setPacks(data ?? [])
        setLoadingPacks(false)
      })
    return () => { cancelled = true }
  }, [])

  const categories = Array.from(new Set(packs.map(p => p.category)))
  const visiblePacks = category ? packs.filter(p => p.category === category) : packs

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))
    setSelectedUrl(null)
  }

  function selectLibraryImage(url: string) {
    setSelectedUrl(url)
    setUploadFile(null)
    setUploadPreview(null)
  }

  async function handleSetCover() {
    if (saving) return
    if (tab === 'library' && !selectedUrl) return
    if (tab === 'upload' && !uploadFile) return
    setSaving(true)

    let finalUrl = selectedUrl

    if (tab === 'upload' && uploadFile) {
      // Requires the hangout-covers Storage bucket to already exist (created
      // manually in the Supabase dashboard) and to be public, since the
      // resulting URL is stored as a plain string and read without signing.
      const compressed = await compressImage(uploadFile)
      const ext = compressed.name.split('.').pop()
      const storagePath = `${knotId}/${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('hangout-covers').upload(storagePath, compressed)
      if (uploadError) {
        toast.error(TOAST_ERROR)
        setSaving(false)
        return
      }
      const { data: publicUrlData } = supabase.storage.from('hangout-covers').getPublicUrl(storagePath)
      finalUrl = publicUrlData.publicUrl
    }

    if (!finalUrl) { setSaving(false); return }

    const { error } = await supabase.from('hangouts').update({ cover_image_url: finalUrl }).eq('id', hangoutId)
    setSaving(false)
    if (error) { toast.error(TOAST_ERROR); return }
    onImageSet(finalUrl)
    toast.success(COVER_IMAGE_SET)
    onClose()
  }

  const canSubmit = tab === 'library' ? !!selectedUrl : !!uploadFile

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px', flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12, flexShrink: 0 }}>{COVER_IMAGE_PICKER_TITLE}</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexShrink: 0 }}>
          <button type="button" onClick={() => setTab('library')}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border2)', background: tab === 'library' ? 'var(--yellow)' : 'var(--bg3)', color: tab === 'library' ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {COVER_IMAGE_LIBRARY_TAB}
          </button>
          <button type="button" onClick={() => setTab('upload')}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border2)', background: tab === 'upload' ? 'var(--yellow)' : 'var(--bg3)', color: tab === 'upload' ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {COVER_IMAGE_UPLOAD_TAB}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tab === 'library' ? (
            <>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
                <button type="button" onClick={() => setCategory(null)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border2)', background: category === null ? 'var(--yellow)' : '#fff', color: category === null ? '#111' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  All
                </button>
                {categories.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border2)', background: category === cat ? 'var(--yellow)' : '#fff', color: category === cat ? '#111' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {loadingPacks ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Loading...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
                  {visiblePacks.flatMap(pack => pack.images.map((url, i) => (
                    <button key={`${pack.id}-${i}`} type="button" onClick={() => selectLibraryImage(url)}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', padding: 0, border: selectedUrl === url ? '3px solid var(--yellow)' : '1px solid var(--border2)', cursor: 'pointer', background: 'var(--bg3)' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {selectedUrl === url && (
                        <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-check" style={{ fontSize: 12, color: '#111', fontWeight: 700 }} />
                        </div>
                      )}
                    </button>
                  )))}
                </div>
              )}

              {!PREMIUM_PACKS_ENABLED && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    {COVER_IMAGE_PREMIUM_LABEL}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)', filter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="ti ti-lock" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)', filter: 'none' }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
              {uploadPreview ? (
                <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', background: '#000' }}>
                  <img src={uploadPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button type="button" onClick={() => { setUploadFile(null); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-x" style={{ fontSize: ICON_SIZE.inline, color: '#fff' }} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', aspectRatio: '4/3', borderRadius: 10, border: '1px dashed var(--border2)', background: 'var(--bg3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className="ti ti-photo-plus" style={{ fontSize: 28, color: 'var(--text3)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Tap to choose a photo</span>
                </button>
              )}
              {uploadPreview && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', padding: '9px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  Change photo
                </button>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={handleSetCover} disabled={!canSubmit || saving}
          style={{ marginTop: 12, width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: (!canSubmit || saving) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: (!canSubmit || saving) ? 0.5 : 1, flexShrink: 0 }}>
          {saving ? COVER_IMAGE_UPLOADING : COVER_IMAGE_SET_BUTTON}
        </button>
      </div>
    </>
  )
}
