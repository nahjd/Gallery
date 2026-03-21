import { useEffect, useState } from "react"
import { supabase } from "../api/supabase"

type MediaItem = {
  id: string
  title: string
  file_url: string
  created_at: string
  type: "image" | "video"
  table: "images" | "videos"
}

export default function Admin() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)

  const [items, setItems] = useState<MediaItem[]>([])
  const [filtered, setFiltered] = useState<MediaItem[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all")
  const [loading, setLoading] = useState(false)

  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selected, setSelected] = useState<string[]>([])

  const [editItem, setEditItem] = useState<MediaItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    supabase.auth.onAuthStateChange((_e, s) => setSession(s))
  }, [])

  useEffect(() => { if (session) loadData() }, [session])

  useEffect(() => {
    let result = items
    if (filterType !== "all") result = result.filter((i) => i.type === filterType)
    if (search.trim()) result = result.filter((i) => i.title?.toLowerCase().includes(search.toLowerCase()))
    setFiltered(result)
  }, [search, filterType, items])

  const notify = (type: "success" | "error", msg: string) => {
    setNotification({ type, msg })
    setTimeout(() => setNotification(null), 3500)
  }

  const login = async () => {
    setAuthLoading(true); setAuthError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const logout = async () => { await supabase.auth.signOut(); setSession(null) }

  const loadData = async () => {
    setLoading(true)
    const { data: images } = await supabase.from("images").select("*").order("created_at", { ascending: false })
    const { data: videos } = await supabase.from("videos").select("*").order("created_at", { ascending: false })
    const merged: MediaItem[] = [
      ...(images || []).map((i: any) => ({ ...i, type: "image" as const, table: "images" as const })),
      ...(videos || []).map((v: any) => ({ ...v, type: "video" as const, table: "videos" as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setItems(merged)
    setLoading(false)
  }

  // ✅ FIX: toggleSelect properly implemented
  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  // ✅ Select All / Deselect All
  const toggleSelectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([])
    } else {
      setSelected(filtered.map(i => i.id))
    }
  }

  const uploadMedia = async () => {
    if (!uploadFiles.length) return alert("Fayl seçin")
    setUploading(true)
    setUploadProgress(0)

    for (let idx = 0; idx < uploadFiles.length; idx++) {
      const file = uploadFiles[idx]
      const path = `public/${Date.now()}-${file.name}`

      const { data, error } = await supabase.storage
        .from("gallery")
        .upload(path, file)

      if (error) {
        console.log("upload error", error)
        continue
      }

      const { data: url } = supabase.storage
        .from("gallery")
        .getPublicUrl(data.path)

      const table = file.type.includes("video") ? "videos" : "images"

      await supabase.from(table).insert({
        title: uploadTitle || file.name,
        file_url: url.publicUrl,
      })

      setUploadProgress(Math.round(((idx + 1) / uploadFiles.length) * 100))
    }

    setUploadFiles([])
    setUploadTitle("")
    setUploading(false)
    setUploadProgress(0)
    loadData()
    notify("success", "Media uğurla yükləndi!")
  }

  const deleteItem = async (item: MediaItem) => {
    try {
      const marker = "/object/public/gallery/"
      const markerIndex = item.file_url.indexOf(marker)

      if (markerIndex !== -1) {
        const storagePath = decodeURIComponent(item.file_url.slice(markerIndex + marker.length))
        const { error: storageError } = await supabase.storage.from("gallery").remove([storagePath])
        if (storageError) {
          console.warn("Storage delete warning:", storageError.message)
        }
      }

      const { error: dbError } = await supabase.from(item.table).delete().eq("id", item.id)
      if (dbError) { notify("error", dbError.message); return }

      setItems(prev => prev.filter(i => i.id !== item.id))
      setDeleteConfirm(null)
      notify("success", "Item silindi!")
    } catch (err: any) {
      notify("error", "Silmə xətası: " + err.message)
    }
  }

  const deleteSelected = async () => {
    if (!selected.length) return

    for (const id of selected) {
      const item = items.find(i => i.id === id)
      if (!item) continue

      const marker = "/object/public/gallery/"
      const index = item.file_url.indexOf(marker)

      if (index !== -1) {
        const path = decodeURIComponent(item.file_url.slice(index + marker.length))
        await supabase.storage.from("gallery").remove([path])
      }

      await supabase.from(item.table).delete().eq("id", item.id)
    }

    setSelected([])
    setBulkDeleteConfirm(false)
    loadData()
    notify("success", `${selected.length} item silindi!`)
  }

  const bulkEdit = async () => {
    const newTitle = prompt("Yeni title yaz")
    if (!newTitle) return

    for (const id of selected) {
      const item = items.find(i => i.id === id)
      if (!item) continue

      await supabase
        .from(item.table)
        .update({ title: newTitle })
        .eq("id", item.id)
    }

    setSelected([])
    loadData()
    notify("success", `${selected.length} item yeniləndi!`)
  }

  const saveEdit = async () => {
    if (!editItem) return

    try {
      let newUrl = editItem.file_url

      if (editFile) {
        const newPath = `public/${Date.now()}-${editFile.name}`

        const { data, error } = await supabase.storage
          .from("gallery")
          .upload(newPath, editFile)

        if (error) {
          notify("error", error.message)
          return
        }

        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(data.path)

        newUrl = urlData.publicUrl

        const marker = "/object/public/gallery/"
        const index = editItem.file_url.indexOf(marker)

        if (index !== -1) {
          const oldPath = decodeURIComponent(editItem.file_url.slice(index + marker.length))
          await supabase.storage.from("gallery").remove([oldPath])
        }
      }

      await supabase
        .from(editItem.table)
        .update({ title: editTitle, file_url: newUrl })
        .eq("id", editItem.id)

      setItems(prev =>
        prev.map(i =>
          i.id === editItem.id ? { ...i, title: editTitle, file_url: newUrl } : i
        )
      )

      setEditItem(null)
      setEditFile(null)
      notify("success", "Uğurla yeniləndi!")

    } catch (err: any) {
      notify("error", err.message)
    }
  }

  const allSelected = filtered.length > 0 && selected.length === filtered.length
  const someSelected = selected.length > 0 && selected.length < filtered.length

  // ── LOGIN ──
  if (!session) return (
    <>
      <style>{styles}</style>
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">Arch<span>ive</span></div>
          <div className="auth-subtitle">Admin Panel</div>
          <div className="auth-divider" />
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input type="email" className="auth-input" value={email} placeholder="admin@example.com"
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input type="password" className="auth-input" value={password} placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          </div>
          {authError && <div className="auth-error">⚠ {authError}</div>}
          <button className="auth-btn" onClick={login} disabled={authLoading}>
            {authLoading ? "Daxil olunur…" : "Daxil ol →"}
          </button>
          <a href="/" className="auth-back">← Qalereyaya qayıt</a>
        </div>
      </div>
    </>
  )

  // ── PANEL ──
  return (
    <>
      <style>{styles}</style>

      {notification && (
        <div className={`toast toast-${notification.type}`}>
          {notification.type === "success" ? "✓" : "✗"} {notification.msg}
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirm && (
        <div className="modal-bg" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <div className="modal-title">{selected.length} item silinsin?</div>
            <div className="modal-desc">
              Seçilmiş <strong>{selected.length}</strong> fayl həmişəlik silinəcək. Bu əməliyyat geri alına bilməz.
            </div>
            <div className="modal-btns">
              <button className="modal-btn-cancel" onClick={() => setBulkDeleteConfirm(false)}>Ləğv et</button>
              <button className="modal-btn-delete" onClick={deleteSelected}>Bəli, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-bg" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <div className="modal-title">Bu item silinsin?</div>
            <div className="modal-desc">
              "<strong>{deleteConfirm.title}</strong>" həmişəlik silinəcək. Bu əməliyyat geri alına bilməz.
            </div>
            <div className="modal-btns">
              <button className="modal-btn-cancel" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button className="modal-btn-delete" onClick={() => deleteItem(deleteConfirm)}>Bəli, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-bg" onClick={() => { setEditItem(null); setEditFile(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✏️</div>
            <div className="modal-title">Redaktə et</div>
            <input type="text" className="auth-input" value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveEdit()} autoFocus />
            <div className="edit-file-label">
              <label className="file-pick-btn" style={{ marginTop: 10, justifyContent: "center" }}>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                {editFile ? `✓ ${editFile.name}` : "📎 Yeni fayl seç (optional)"}
              </label>
            </div>
            <div className="modal-btns" style={{ marginTop: 16 }}>
              <button className="modal-btn-cancel" onClick={() => { setEditItem(null); setEditFile(null) }}>Ləğv et</button>
              <button className="modal-btn-save" onClick={saveEdit}>Saxla</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="admin-layout">
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span /><span /><span />
          </button>
          <div className="mobile-logo">Arch<span>ive</span></div>
        </div>

        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sb-close" onClick={() => setSidebarOpen(false)}>✕</div>
          <div className="sb-logo">Arch<span>ive</span></div>
          <div className="sb-role">Admin Panel</div>
          <div className="sb-divider" />

          <nav className="sb-nav">
            <div className="sb-nav-item active">📂 Media Library</div>
            <a href="/" className="sb-nav-item" onClick={() => setSidebarOpen(false)}>🖼 View Gallery</a>
          </nav>

          <div className="sb-stats">
            <div className="sb-stat">
              <div className="sb-stat-num">{items.length}</div>
              <div className="sb-stat-label">Total</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-num">{items.filter(i => i.type === "image").length}</div>
              <div className="sb-stat-label">Photos</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-num">{items.filter(i => i.type === "video").length}</div>
              <div className="sb-stat-label">Videos</div>
            </div>
          </div>

          <button className="sb-logout" onClick={logout}>Sign Out →</button>
        </aside>

        {/* MAIN */}
        <main className="admin-main">

          {/* Upload card */}
          <div className="upload-card">
            <div className="upload-card-header">
              <div className="upload-card-title">📤 Yeni Media Əlavə et</div>
              <div className="upload-card-sub">Foto və ya video yükləyin</div>
            </div>
            <div className="upload-row">
              <input
                type="text"
                className="upload-title-input"
                placeholder="Bu media üçün başlıq daxil edin…"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
              />

              <label className="file-pick-btn">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  style={{ display: "none" }}
                />
                {uploadFiles.length > 0
                  ? `✓ ${uploadFiles.length} fayl seçildi`
                  : "📎 Fayl Seç"}
              </label>

              <button
                className="upload-go-btn"
                onClick={uploadMedia}
                disabled={uploading || uploadFiles.length === 0}
              >
                {uploading ? `Yüklənir… ${uploadProgress}%` : "Yüklə →"}
              </button>
            </div>
            {uploading && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="lib-controls">
            <div className="lib-search-wrap">
              <span className="lib-search-icon">🔍</span>
              <input type="text" className="lib-search" placeholder="Media axtar…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="lib-filters">
              {(["all", "image", "video"] as const).map(f => (
                <button key={f} className={`lib-filter ${filterType === f ? "active" : ""}`}
                  onClick={() => setFilterType(f)}>
                  {f === "all" ? "Hamısı" : f === "image" ? "Fotolar" : "Videolar"}
                </button>
              ))}
            </div>
            <span className="lib-count">{filtered.length} item</span>
          </div>

          {/* Bulk action bar */}
          {filtered.length > 0 && (
            <div className="bulk-bar">
              <label className="select-all-wrap">
                <div
                  className={`custom-checkbox ${allSelected ? "checked" : someSelected ? "indeterminate" : ""}`}
                  onClick={toggleSelectAll}
                >
                  {allSelected && <span>✓</span>}
                  {someSelected && <span>−</span>}
                </div>
                <span className="select-all-label">
                  {allSelected ? "Hamısının seçimi ləğv et" : "Hamısını seç"}
                </span>
              </label>

              {selected.length > 0 && (
                <div className="bulk-actions">
                  <span className="bulk-count">{selected.length} seçildi</span>
                  <button className="bulk-btn bulk-edit-btn" onClick={bulkEdit}>
                    ✏ Redaktə et ({selected.length})
                  </button>
                  <button className="bulk-btn bulk-delete-btn" onClick={() => setBulkDeleteConfirm(true)}>
                    🗑 Sil ({selected.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="admin-loading">
              <div className="spinner" /><div className="loading-txt">Media yüklənir…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="lib-empty">
              <div style={{ fontSize: 40 }}>📭</div>
              <div className="lib-empty-title">Media tapılmadı</div>
              <div className="lib-empty-sub">Axtarışı dəyişdirin</div>
            </div>
          ) : (
            <div className="admin-grid">
              {filtered.map((item, i) => {
                const isVideo = item.type === "video" || !!item.file_url.match(/\.(mp4|webm|mov)/i)
                const isSelected = selected.includes(item.id)

                return (
                  <div
                    key={item.id}
                    className={`admin-card ${isSelected ? "admin-card-selected" : ""}`}
                    style={{ animationDelay: `${(i % 12) * 40}ms` }}
                  >
                    <div className="admin-card-thumb" onClick={() => toggleSelect(item.id)}>
                      {/* ✅ FIX: Custom checkbox that works */}
                      <div
                        className={`card-checkbox ${isSelected ? "card-checkbox-checked" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                      >
                        {isSelected && <span>✓</span>}
                      </div>

                      {isVideo ? (
                        <video src={item.file_url} className="admin-thumb-media" muted playsInline preload="metadata" />
                      ) : (
                        <img src={item.file_url} className="admin-thumb-media" alt={item.title} loading="lazy" />
                      )}

                      {isSelected && <div className="card-selected-overlay" />}

                      <span className={`admin-type-tag ${isVideo ? "video" : "photo"}`}>
                        {isVideo ? "🎬 Video" : "📷 Foto"}
                      </span>
                    </div>
                    <div className="admin-card-body">
                      <div className="admin-card-title">{item.title || "Başlıqsız"}</div>
                      <div className="admin-card-date">
                        {new Date(item.created_at).toLocaleDateString("az-AZ", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="admin-card-actions">
                      <button className="admin-action-edit" onClick={() => { setEditItem(item); setEditTitle(item.title) }}>
                        ✏ Redaktə
                      </button>
                      <button className="admin-action-delete" onClick={() => setDeleteConfirm(item)}>
                        🗑 Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f5f0e8;
    color: #1a1410;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #ede8de; }
  ::-webkit-scrollbar-thumb { background: #b8860b; border-radius: 3px; }

  /* AUTH */
  .auth-page {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f5f0e8 0%, #faf6ec 100%);
    padding: 20px;
  }
  .auth-card {
    width: 100%; max-width: 400px; background: #fff;
    border-radius: 16px; padding: 48px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.1);
    border: 1px solid rgba(184,134,11,0.12);
  }
  .auth-logo {
    font-family: 'Playfair Display', serif;
    font-size: 30px; font-weight: 700; color: #1a1410; margin-bottom: 4px;
  }
  .auth-logo span { color: #b8860b; font-style: italic; }
  .auth-subtitle { font-size: 13px; color: #8a7a60; margin-bottom: 24px; font-weight: 500; }
  .auth-divider { height: 1px; background: #f0e8d4; margin-bottom: 24px; }
  .auth-field { margin-bottom: 16px; }
  .auth-label {
    display: block; font-size: 12px; font-weight: 600; color: #5a4e3a;
    margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .auth-input {
    width: 100%; background: #faf7f2;
    border: 1.5px solid #e8dfc8; color: #1a1410;
    font-family: 'Inter', sans-serif; font-size: 14px;
    padding: 11px 14px; border-radius: 8px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .auth-input:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .auth-input::placeholder { color: #b0a080; }
  .auth-error {
    background: #fff5f5; border: 1px solid #fecaca; color: #b91c1c;
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; margin-bottom: 12px;
  }
  .auth-btn {
    width: 100%; background: linear-gradient(135deg, #b8860b, #d4a017);
    color: #fff; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
    padding: 13px; border: none; border-radius: 8px; cursor: pointer;
    margin-top: 8px; transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 4px 16px rgba(184,134,11,0.3);
  }
  .auth-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .auth-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .auth-back {
    display: block; text-align: center; margin-top: 16px;
    font-size: 13px; color: #8a7a60; text-decoration: none;
  }
  .auth-back:hover { color: #b8860b; }

  /* MOBILE HEADER */
  .mobile-header {
    display: none;
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    background: #1a1410;
    padding: 14px 20px;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
  .mobile-logo {
    font-family: 'Playfair Display', serif;
    font-size: 20px; font-weight: 700; color: #f0e4c0;
  }
  .mobile-logo span { color: #c8a84c; font-style: italic; }
  .hamburger {
    display: flex; flex-direction: column; gap: 5px;
    background: none; border: none; cursor: pointer; padding: 4px;
  }
  .hamburger span {
    display: block; width: 22px; height: 2px;
    background: #c8a84c; border-radius: 2px;
    transition: all 0.2s;
  }

  /* SIDEBAR OVERLAY (mobile) */
  .sidebar-overlay {
    display: none;
    position: fixed; inset: 0; z-index: 299;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(2px);
  }

  /* LAYOUT */
  .admin-layout { display: flex; min-height: 100vh; }

  .sidebar {
    width: 240px; flex-shrink: 0;
    background: #1a1410;
    padding: 32px 20px;
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh; overflow-y: auto;
    transition: transform 0.3s ease;
    z-index: 300;
  }
  .sb-close {
    display: none;
    position: absolute; top: 16px; right: 16px;
    color: #6a5a40; font-size: 18px; cursor: pointer;
    padding: 4px 8px;
  }
  .sb-close:hover { color: #c8a84c; }
  .sb-logo {
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 700; color: #f0e4c0; margin-bottom: 4px;
  }
  .sb-logo span { color: #c8a84c; font-style: italic; }
  .sb-role { font-size: 11px; color: #6a5a40; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }
  .sb-divider { height: 1px; background: rgba(255,255,255,0.08); margin-bottom: 20px; }

  .sb-nav { display: flex; flex-direction: column; gap: 2px; }
  .sb-nav-item {
    font-size: 13px; font-weight: 500; color: #8a7a60;
    padding: 10px 14px; border-radius: 8px;
    text-decoration: none; cursor: pointer;
    transition: background 0.2s, color 0.2s;
    display: block;
  }
  .sb-nav-item:hover { background: rgba(255,255,255,0.06); color: #d4b870; }
  .sb-nav-item.active { background: rgba(184,134,11,0.15); color: #c8a84c; }

  .sb-stats {
    margin-top: auto; margin-bottom: 20px;
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 8px; padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .sb-stat { text-align: center; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px 4px; }
  .sb-stat-num {
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 600; color: #c8a84c; line-height: 1;
  }
  .sb-stat-label { font-size: 9px; color: #5a4e3a; font-weight: 500; text-transform: uppercase; margin-top: 4px; }

  .sb-logout {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
    color: #6a5a40; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    padding: 10px; border-radius: 8px; cursor: pointer; width: 100%;
    transition: all 0.2s;
  }
  .sb-logout:hover { background: rgba(220,60,60,0.15); border-color: rgba(220,60,60,0.3); color: #f87171; }

  /* MAIN */
  .admin-main { flex: 1; padding: 32px 40px; overflow-y: auto; background: #f5f0e8; }

  /* UPLOAD CARD */
  .upload-card {
    background: #fff; border-radius: 16px; padding: 28px 32px;
    border: 1px solid rgba(184,134,11,0.12);
    box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-bottom: 28px;
  }
  .upload-card-header { margin-bottom: 20px; }
  .upload-card-title { font-size: 18px; font-weight: 600; color: #1a1410; margin-bottom: 4px; }
  .upload-card-sub { font-size: 13px; color: #8a7a60; }
  .upload-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .upload-title-input {
    flex: 1; min-width: 160px;
    background: #faf7f2; border: 1.5px solid #e8dfc8;
    color: #1a1410; font-family: 'Inter', sans-serif;
    font-size: 13px; padding: 10px 14px; border-radius: 8px; outline: none;
    transition: border-color 0.2s;
  }
  .upload-title-input:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .upload-title-input::placeholder { color: #b0a080; }
  .file-pick-btn {
    display: flex; align-items: center;
    background: #faf7f2; border: 1.5px dashed #c8b890;
    color: #5a4e3a; font-size: 12px; font-weight: 500;
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
    transition: all 0.2s; white-space: nowrap;
  }
  .file-pick-btn:hover { border-color: #b8860b; color: #8a6200; background: rgba(184,134,11,0.05); }
  .upload-go-btn {
    background: linear-gradient(135deg, #b8860b, #d4a017);
    color: #fff; font-family: 'Inter', sans-serif;
    font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
    padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 3px 10px rgba(184,134,11,0.3); white-space: nowrap;
  }
  .upload-go-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .upload-go-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .progress-track {
    height: 4px; background: #f0e8d4; border-radius: 2px;
    overflow: hidden; margin-top: 12px;
  }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #b8860b, #d4a017); transition: width 0.4s; border-radius: 2px; }

  /* CONTROLS */
  .lib-controls {
    display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
  }
  .lib-search-wrap { position: relative; flex: 1; min-width: 160px; max-width: 300px; }
  .lib-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; }
  .lib-search {
    width: 100%; background: #fff; border: 1.5px solid #e8dfc8;
    color: #1a1410; font-family: 'Inter', sans-serif; font-size: 13px;
    padding: 9px 12px 9px 36px; border-radius: 8px; outline: none;
    transition: border-color 0.2s;
  }
  .lib-search:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .lib-search::placeholder { color: #b0a080; }
  .lib-filters { display: flex; gap: 6px; flex-wrap: wrap; }
  .lib-filter {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    padding: 8px 16px; border-radius: 20px;
    border: 1.5px solid #e0d8c4; background: #fff; color: #6a5a40;
    cursor: pointer; transition: all 0.2s;
  }
  .lib-filter:hover { border-color: #b8860b; color: #8a6200; }
  .lib-filter.active {
    background: linear-gradient(135deg, #b8860b, #d4a017);
    border-color: transparent; color: #fff;
    box-shadow: 0 2px 8px rgba(184,134,11,0.3);
  }
  .lib-count { margin-left: auto; font-size: 13px; color: #8a7a60; font-weight: 500; white-space: nowrap; }

  /* BULK ACTION BAR */
  .bulk-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    background: #fff; border: 1.5px solid #e8dfc8;
    border-radius: 10px; padding: 10px 16px;
    margin-bottom: 16px;
  }
  .select-all-wrap {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
  }
  .select-all-label { font-size: 13px; color: #5a4e3a; font-weight: 500; user-select: none; }

  /* Custom checkbox */
  .custom-checkbox {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid #c8b890; background: #faf7f2;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; flex-shrink: 0;
    font-size: 12px; font-weight: 700; color: #fff;
  }
  .custom-checkbox.checked {
    background: linear-gradient(135deg, #b8860b, #d4a017);
    border-color: #b8860b; color: #fff;
  }
  .custom-checkbox.indeterminate {
    background: rgba(184,134,11,0.2);
    border-color: #b8860b; color: #b8860b;
  }

  .bulk-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; }
  .bulk-count {
    font-size: 13px; color: #8a7a60; font-weight: 500;
    padding: 6px 10px; background: #f5f0e8; border-radius: 6px;
  }
  .bulk-btn {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    padding: 8px 14px; border: none; border-radius: 8px;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .bulk-edit-btn {
    background: #2563eb; color: #fff;
    box-shadow: 0 2px 8px rgba(37,99,235,0.25);
  }
  .bulk-edit-btn:hover { background: #1d4ed8; transform: translateY(-1px); }
  .bulk-delete-btn {
    background: #dc2626; color: #fff;
    box-shadow: 0 2px 8px rgba(220,38,38,0.25);
  }
  .bulk-delete-btn:hover { background: #b91c1c; transform: translateY(-1px); }

  /* GRID */
  .admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }
  .admin-card {
    background: #fff; border-radius: 12px; overflow: hidden;
    border: 1.5px solid rgba(184,134,11,0.1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    opacity: 0; animation: cardIn 0.4s ease forwards;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
    cursor: pointer;
  }
  .admin-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.12); transform: translateY(-2px); }
  .admin-card-selected {
    border-color: #b8860b !important;
    box-shadow: 0 0 0 3px rgba(184,134,11,0.2), 0 4px 16px rgba(0,0,0,0.1) !important;
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .admin-card-thumb {
    position: relative; aspect-ratio: 16/10; overflow: hidden;
    background: #f0e8d4; cursor: pointer;
  }
  .admin-thumb-media { width: 100%; height: 100%; object-fit: cover; display: block; }
  .admin-type-tag {
    position: absolute; top: 8px; left: 8px;
    font-size: 10px; font-weight: 600;
    padding: 4px 8px; border-radius: 5px;
    pointer-events: none;
  }
  .admin-type-tag.photo { background: rgba(245,240,232,0.92); color: #5a4020; border: 1px solid rgba(184,134,11,0.2); }
  .admin-type-tag.video { background: rgba(30,58,138,0.85); color: #bfdbfe; border: 1px solid rgba(59,130,246,0.3); }

  /* ✅ Card checkbox - top right */
  .card-checkbox {
    position: absolute; top: 8px; right: 8px; z-index: 10;
    width: 22px; height: 22px; border-radius: 6px;
    border: 2px solid rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s;
    font-size: 12px; font-weight: 700; color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .card-checkbox:hover { background: rgba(255,255,255,0.4); }
  .card-checkbox-checked {
    background: linear-gradient(135deg, #b8860b, #d4a017) !important;
    border-color: #b8860b !important;
  }

  /* Selected overlay */
  .card-selected-overlay {
    position: absolute; inset: 0;
    background: rgba(184,134,11,0.12);
    pointer-events: none;
  }

  .admin-card-body { padding: 12px 14px 8px; }
  .admin-card-title { font-size: 13px; font-weight: 500; color: #1a1410; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .admin-card-date { font-size: 11px; color: #a09070; }

  .admin-card-actions { display: flex; gap: 1px; border-top: 1px solid #f0e8d4; }
  .admin-action-edit, .admin-action-delete {
    flex: 1; padding: 9px 6px; border: none;
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .admin-action-edit { background: #faf7f2; color: #5a4e3a; }
  .admin-action-edit:hover { background: rgba(184,134,11,0.1); color: #8a6200; }
  .admin-action-delete { background: #faf7f2; color: #dc2626; }
  .admin-action-delete:hover { background: #fff5f5; }

  /* MODAL */
  .modal-bg {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    z-index: 500; display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px); animation: fadeIn 0.2s ease;
    padding: 20px;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: #fff; border-radius: 16px; padding: 36px;
    width: 100%; max-width: 420px; text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    border: 1px solid rgba(184,134,11,0.1);
  }
  .modal-icon { font-size: 36px; margin-bottom: 12px; }
  .modal-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1a1410; margin-bottom: 10px; }
  .modal-desc { font-size: 14px; color: #6a5a40; line-height: 1.6; margin-bottom: 4px; }
  .edit-file-label { width: 100%; }
  .modal-btns { display: flex; gap: 10px; margin-top: 24px; }
  .modal-btn-cancel {
    flex: 1; padding: 11px; background: #f5f0e8; border: 1.5px solid #e0d8c4;
    color: #5a4e3a; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
    border-radius: 8px; cursor: pointer; transition: background 0.2s;
  }
  .modal-btn-cancel:hover { background: #ede8de; }
  .modal-btn-delete {
    flex: 1; padding: 11px; background: #dc2626; border: none;
    color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
    border-radius: 8px; cursor: pointer; transition: background 0.2s;
    box-shadow: 0 2px 8px rgba(220,38,38,0.3);
  }
  .modal-btn-delete:hover { background: #b91c1c; }
  .modal-btn-save {
    flex: 1; padding: 11px; background: linear-gradient(135deg, #b8860b, #d4a017);
    border: none; color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
    border-radius: 8px; cursor: pointer;
    box-shadow: 0 2px 8px rgba(184,134,11,0.3);
  }
  .modal-btn-save:hover { opacity: 0.9; }

  /* TOAST */
  .toast {
    position: fixed; top: 24px; right: 24px; z-index: 600;
    padding: 14px 22px; border-radius: 10px;
    font-size: 13px; font-weight: 500;
    animation: toastIn 0.3s ease;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    display: flex; align-items: center; gap: 8px;
    max-width: calc(100vw - 48px);
  }
  @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  .toast-success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
  .toast-error   { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }

  /* LOADING */
  .admin-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
  .spinner {
    width: 36px; height: 36px; border: 3px solid #f0e8d4;
    border-top-color: #b8860b; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-txt { font-size: 14px; color: #8a7a60; }

  /* EMPTY */
  .lib-empty { text-align: center; padding: 80px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .lib-empty-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #3a2e1a; }
  .lib-empty-sub { font-size: 14px; color: #8a7a60; }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .mobile-header { display: flex; }
    .sidebar-overlay { display: block; }

    .sidebar {
      position: fixed;
      left: 0; top: 0; bottom: 0;
      transform: translateX(-100%);
      width: 260px;
    }
    .sidebar.sidebar-open {
      transform: translateX(0);
      box-shadow: 4px 0 32px rgba(0,0,0,0.4);
    }
    .sb-close { display: block; }

    .admin-main {
      padding: 80px 16px 24px;
    }

    .upload-card { padding: 20px 16px; }
    .upload-row { flex-direction: column; }
    .upload-title-input { min-width: unset; width: 100%; }
    .file-pick-btn { justify-content: center; }
    .upload-go-btn { width: 100%; }

    .lib-controls { gap: 8px; }
    .lib-search-wrap { max-width: 100%; width: 100%; }
    .lib-filters { gap: 4px; }
    .lib-filter { padding: 7px 12px; font-size: 11px; }

    .bulk-bar { gap: 8px; }
    .bulk-actions { margin-left: 0; width: 100%; justify-content: flex-end; }

    .admin-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }

    .toast { top: 72px; right: 12px; left: 12px; max-width: unset; }

    .modal { padding: 24px 20px; }
    .modal-title { font-size: 18px; }
  }

  @media (max-width: 480px) {
    .admin-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .lib-filters { width: 100%; }
    .lib-filter { flex: 1; text-align: center; }
    .lib-count { display: none; }
  }
`