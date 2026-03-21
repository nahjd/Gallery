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

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [editItem, setEditItem] = useState<MediaItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null)

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

  const uploadMedia = async () => {
    if (!uploadFile || !uploadTitle.trim()) return notify("error", "Title and file are required")
    setUploading(true); setUploadProgress(20)
    const path = `public/${Date.now()}-${uploadFile.name}`
    const { data, error } = await supabase.storage.from("gallery").upload(path, uploadFile)
    if (error) { notify("error", "Upload failed: " + error.message); setUploading(false); return }
    setUploadProgress(70)
    const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(data.path)
    const table = uploadFile.type.includes("video") ? "videos" : "images"
    await supabase.from(table).insert({ title: uploadTitle, file_url: urlData.publicUrl })
    setUploadProgress(100)
    setTimeout(() => setUploadProgress(0), 800)
    setUploadFile(null); setUploadTitle(""); setUploading(false)
    notify("success", "Media uploaded successfully!")
    loadData()
  }

  const deleteItem = async (item: MediaItem) => {
    try {
      // Extract storage path: everything after "/gallery/"
      // URL format: https://xxx.supabase.co/storage/v1/object/public/gallery/public/timestamp-filename.jpg
      console.log("[DELETE] file_url:", item.file_url)
      const marker = "/object/public/gallery/"
      const markerIndex = item.file_url.indexOf(marker)

      if (markerIndex !== -1) {
        // e.g. "public/1234567890-photo.jpg"
        const storagePath = decodeURIComponent(item.file_url.slice(markerIndex + marker.length))
        const { error: storageError } = await supabase.storage.from("gallery").remove([storagePath])
        if (storageError) {
          console.warn("Storage delete warning:", storageError.message)
          // Don't block DB delete even if storage fails
        }
      }

      // Delete from DB
      const { error: dbError } = await supabase.from(item.table).delete().eq("id", item.id)
      if (dbError) { notify("error", dbError.message); return }

      // Remove from local state
      setItems(prev => prev.filter(i => i.id !== item.id))
      setDeleteConfirm(null)
      notify("success", "Item deleted from archive & storage")
    } catch (err: any) {
      notify("error", "Delete failed: " + err.message)
    }
  }

  const saveEdit = async () => {
    if (!editItem) return

    try {
      let newUrl = editItem.file_url

      // 🔥 Əgər yeni file seçilibsə
      if (editFile) {
        const newPath = `public/${Date.now()}-${editFile.name}`

        // 1. upload new file
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

        // 2. köhnə file sil
        const marker = "/object/public/gallery/"
        const index = editItem.file_url.indexOf(marker)

        if (index !== -1) {
          const oldPath = decodeURIComponent(
            editItem.file_url.slice(index + marker.length)
          )

          await supabase.storage.from("gallery").remove([oldPath])
        }
      }

      // 3. DB update
      await supabase
        .from(editItem.table)
        .update({
          title: editTitle,
          file_url: newUrl,
        })
        .eq("id", editItem.id)

      // 4. LOCAL update
      setItems(prev =>
        prev.map(i =>
          i.id === editItem.id
            ? { ...i, title: editTitle, file_url: newUrl }
            : i
        )
      )

      setEditItem(null)
      setEditFile(null)

      notify("success", "Updated successfully!")

    } catch (err: any) {
      notify("error", err.message)
    }
  }

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
            {authLoading ? "Signing in…" : "Sign In →"}
          </button>
          <a href="/" className="auth-back">← Back to Gallery</a>
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

      {deleteConfirm && (
        <div className="modal-bg" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <div className="modal-title">Delete this item?</div>
            <div className="modal-desc">
              "<strong>{deleteConfirm.title}</strong>" will be permanently deleted. This cannot be undone.
            </div>
            <div className="modal-btns">
              <button className="modal-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="modal-btn-delete" onClick={() => deleteItem(deleteConfirm)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="modal-bg" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✏️</div>
            <div className="modal-title">Edit Title</div>
            <input type="text" className="auth-input" value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveEdit()} autoFocus />
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setEditFile(e.target.files?.[0] || null)}
              style={{ marginTop: 10 }}
            />
            <div className="modal-btns" style={{ marginTop: 16 }}>
              <button className="modal-btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="modal-btn-save" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb-logo">Arch<span>ive</span></div>
          <div className="sb-role">Admin Panel</div>
          <div className="sb-divider" />

          <nav className="sb-nav">
            <div className="sb-nav-item active">📂 Media Library</div>
            <a href="/" className="sb-nav-item">🖼 View Gallery</a>
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
              <div className="upload-card-title">📤 Add New Media</div>
              <div className="upload-card-sub">Upload photos or videos to your archive</div>
            </div>
            <div className="upload-row">
              <input type="text" className="upload-title-input" placeholder="Enter a title for this media…"
                value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
              <label className="file-pick-btn">
                <input type="file" accept="image/*,video/*"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
                {uploadFile ? `✓ ${uploadFile.name.slice(0, 22)}…` : "📎 Choose File"}
              </label>
              <button className="upload-go-btn" onClick={uploadMedia}
                disabled={uploading || !uploadFile || !uploadTitle.trim()}>
                {uploading ? "Uploading…" : "Upload →"}
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
              <input type="text" className="lib-search" placeholder="Search media…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="lib-filters">
              {(["all", "image", "video"] as const).map(f => (
                <button key={f} className={`lib-filter ${filterType === f ? "active" : ""}`}
                  onClick={() => setFilterType(f)}>
                  {f === "all" ? "All" : f === "image" ? "Photos" : "Videos"}
                </button>
              ))}
            </div>
            <span className="lib-count">{filtered.length} items</span>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="admin-loading">
              <div className="spinner" /><div className="loading-txt">Loading media…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="lib-empty">
              <div style={{ fontSize: 40 }}>📭</div>
              <div className="lib-empty-title">No media found</div>
              <div className="lib-empty-sub">Try adjusting your search</div>
            </div>
          ) : (
            <div className="admin-grid">
              {filtered.map((item, i) => {
                const isVideo = item.type === "video" || !!item.file_url.match(/\.(mp4|webm|mov)/i)
                return (
                  <div key={item.id} className="admin-card" style={{ animationDelay: `${(i % 12) * 40}ms` }}>
                    <div className="admin-card-thumb">
                      {isVideo ? (
                        <video src={item.file_url} className="admin-thumb-media" muted playsInline preload="metadata" />
                      ) : (
                        <img src={item.file_url} className="admin-thumb-media" alt={item.title} loading="lazy" />
                      )}
                      <span className={`admin-type-tag ${isVideo ? "video" : "photo"}`}>
                        {isVideo ? "🎬 Video" : "📷 Photo"}
                      </span>
                    </div>
                    <div className="admin-card-body">
                      <div className="admin-card-title">{item.title || "Untitled"}</div>
                      <div className="admin-card-date">
                        {new Date(item.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="admin-card-actions">
                      <button className="admin-action-edit" onClick={() => { setEditItem(item); setEditTitle(item.title) }}>
                        ✏ Edit
                      </button>
                      <button className="admin-action-delete" onClick={() => setDeleteConfirm(item)}>
                        🗑 Delete
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
  }
  .auth-card {
    width: 400px; background: #fff;
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

  /* LAYOUT */
  .admin-layout { display: flex; min-height: 100vh; }

  .sidebar {
    width: 240px; flex-shrink: 0;
    background: #1a1410;
    padding: 32px 20px;
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh; overflow-y: auto;
  }
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
    flex: 1; min-width: 200px;
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
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .lib-search-wrap { position: relative; flex: 1; max-width: 300px; }
  .lib-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; }
  .lib-search {
    width: 100%; background: #fff; border: 1.5px solid #e8dfc8;
    color: #1a1410; font-family: 'Inter', sans-serif; font-size: 13px;
    padding: 9px 12px 9px 36px; border-radius: 8px; outline: none;
    transition: border-color 0.2s;
  }
  .lib-search:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .lib-search::placeholder { color: #b0a080; }
  .lib-filters { display: flex; gap: 6px; }
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
  .lib-count { margin-left: auto; font-size: 13px; color: #8a7a60; font-weight: 500; }

  /* GRID */
  .admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 16px;
  }
  .admin-card {
    background: #fff; border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(184,134,11,0.1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    opacity: 0; animation: cardIn 0.4s ease forwards;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .admin-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.12); transform: translateY(-2px); }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .admin-card-thumb { position: relative; aspect-ratio: 16/10; overflow: hidden; background: #f0e8d4; }
  .admin-thumb-media { width: 100%; height: 100%; object-fit: cover; display: block; }
  .admin-type-tag {
    position: absolute; top: 8px; left: 8px;
    font-size: 10px; font-weight: 600;
    padding: 4px 8px; border-radius: 5px;
  }
  .admin-type-tag.photo { background: rgba(245,240,232,0.92); color: #5a4020; border: 1px solid rgba(184,134,11,0.2); }
  .admin-type-tag.video { background: rgba(30,58,138,0.85); color: #bfdbfe; border: 1px solid rgba(59,130,246,0.3); }

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
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: #fff; border-radius: 16px; padding: 36px;
    width: 420px; max-width: 90vw; text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    border: 1px solid rgba(184,134,11,0.1);
  }
  .modal-icon { font-size: 36px; margin-bottom: 12px; }
  .modal-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1a1410; margin-bottom: 10px; }
  .modal-desc { font-size: 14px; color: #6a5a40; line-height: 1.6; margin-bottom: 4px; }
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
`