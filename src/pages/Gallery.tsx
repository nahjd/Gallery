import { useEffect, useState, useRef } from "react"
import { supabase } from "../api/supabase"
import LightGallery from "lightgallery/react"
import lgThumbnail from "lightgallery/plugins/thumbnail"
import lgZoom from "lightgallery/plugins/zoom"
import lgAutoplay from "lightgallery/plugins/autoplay"
import lgFullscreen from "lightgallery/plugins/fullscreen"
import lgShare from "lightgallery/plugins/share"
import lgRotate from "lightgallery/plugins/rotate"
import lgVideo from "lightgallery/plugins/video"
import "lightgallery/css/lightgallery.css"
import "lightgallery/css/lg-zoom.css"
import "lightgallery/css/lg-thumbnail.css"
import "lightgallery/css/lg-autoplay.css"
import "lightgallery/css/lg-fullscreen.css"
import "lightgallery/css/lg-share.css"
import "lightgallery/css/lg-rotate.css"

type MediaItem = {
  id: string
  title: string
  file_url: string
  created_at: string
  type?: "image" | "video"
}

export default function Gallery() {
  // ── Auth state ──
  const [session, setSession] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // ── Gallery state ──
  const [items, setItems] = useState<MediaItem[]>([])
  const [filtered, setFiltered] = useState<MediaItem[]>([])
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "image" | "video">("all")
  const [loading, setLoading] = useState(true)
  const heroRef = useRef<HTMLDivElement>(null)

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Fetch data once logged in
  useEffect(() => {
    if (session) fetchData()
  }, [session])

  useEffect(() => {
    let result = items
    if (activeFilter !== "all") {
      result = result.filter((item) => {
        const isVideo = isVideoFile(item)
        return activeFilter === "video" ? isVideo : !isVideo
      })
    }
    if (search.trim()) {
      result = result.filter((item) =>
        item.title?.toLowerCase().includes(search.toLowerCase())
      )
    }
    setFiltered(result)
  }, [search, activeFilter, items])

  const isVideoFile = (item: MediaItem) =>
    !!(item.file_url.match(/\.(mp4|webm|mov|avi|mkv)/i) || item.type === "video")

  const fetchData = async () => {
    setLoading(true)
    const { data: images } = await supabase.from("images").select("*").order("created_at", { ascending: false })
    const { data: videos } = await supabase.from("videos").select("*").order("created_at", { ascending: false })
    const merged: MediaItem[] = [
      ...(images || []).map((i: any) => ({ ...i, type: "image" as const })),
      ...(videos || []).map((v: any) => ({ ...v, type: "video" as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setItems(merged)
    setFiltered(merged)
    setLoading(false)
  }

  const login = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError("Please enter your email and password.")
      return
    }
    setAuthLoading(true)
    setAuthError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setItems([])
    setFiltered([])
  }

  // ── Still checking session ──
  if (!authChecked) {
    return (
      <>
        <style>{galleryStyles}</style>
        <div className="loading-screen">
          <div className="loading-logo">Arch<span className="loading-logo-accent">ive</span></div>
          <div className="loading-bar-wrap"><div className="loading-bar" /></div>
        </div>
      </>
    )
  }

  // ── LOGIN GATE ──
  if (!session) {
    return (
      <>
        <style>{galleryStyles}</style>
        <div className="login-gate">
          <div className="login-gate-bg" />

          <div className="login-box">
            {/* Left decorative panel */}
            <div className="login-panel-left">
              <div className="login-panel-logo">Arch<span>ive</span></div>
              <div className="login-panel-tagline">
                A private collection of visual media. Access is by invitation only.
              </div>
              <div className="login-panel-decoration">
                <div className="deco-circle deco-1" />
                <div className="deco-circle deco-2" />
                <div className="deco-circle deco-3" />
              </div>
              <div className="login-panel-dots">
                <span />
                <span />
                <span />
              </div>
            </div>

            {/* Right form panel */}
            <div className="login-panel-right">
              <div className="login-welcome">Welcome back</div>
              <div className="login-subtitle">Sign in to access the gallery</div>

              <div className="login-divider" />

              <div className="login-field">
                <label className="login-label">Email address</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-pass-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    className="login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && login()}
                  />
                  <button
                    className="login-pass-toggle"
                    onClick={() => setShowPass(!showPass)}
                    type="button"
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="login-error">
                  <span>⚠</span> {authError}
                </div>
              )}

              <button
                className="login-btn"
                onClick={login}
                disabled={authLoading}
              >
                {authLoading ? (
                  <span className="login-btn-loading">
                    <span className="btn-spinner" /> Signing in…
                  </span>
                ) : (
                  "Sign In →"
                )}
              </button>

              <div className="login-note">
                🔒 This is a private gallery. Only authorised users can access this content.
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── GALLERY ──
  return (
    <>
      <style>{galleryStyles}</style>

      {loading && (
        <div className="loading-screen">
          <div className="loading-logo">Arch<span className="loading-logo-accent">ive</span></div>
          <div className="loading-bar-wrap"><div className="loading-bar" /></div>
          <div className="loading-label">Loading media…</div>
        </div>
      )}

      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo">
          Arch<span className="nav-logo-accent">ive</span>
          <span className="nav-logo-dot">·</span>
        </a>
        <div className="nav-right">
          <span className="nav-user-badge">
            👤 {session.user?.email?.split("@")[0]}
          </span>
          <span className="nav-count">{items.length} works</span>
          <button className="nav-logout-btn" onClick={logout}>Sign Out</button>
          <a href="/admin" className="nav-admin-btn">Admin Panel</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero" ref={heroRef}>
        <div className="hero-left">
          <div className="hero-tag">✦ Private Visual Archive</div>
          <h1 className="hero-title">
            Photography &<span className="hero-title-accent">Moving Image</span>
          </h1>
          <p className="hero-desc">
            A curated collection of photographs and videos. Explore, discover, and experience visual stories from our archive.
          </p>
          <div className="hero-actions">
            <div className="hero-stats">
              <div>
                <div className="hero-stat-num">{items.filter(i => !(i.file_url.match(/\.(mp4|webm|mov)/i) || i.type === "video")).length}</div>
                <div className="hero-stat-label">Photos</div>
              </div>
              <div>
                <div className="hero-stat-num">{items.filter(i => i.file_url.match(/\.(mp4|webm|mov)/i) || i.type === "video").length}</div>
                <div className="hero-stat-label">Videos</div>
              </div>
              <div>
                <div className="hero-stat-num">{items.length}</div>
                <div className="hero-stat-label">Total</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-mosaic">
            <div className="hero-mosaic-item">
              <div className="mosaic-placeholder">🖼️<span>Gallery</span></div>
            </div>
            <div className="hero-mosaic-item">
              <div className="mosaic-placeholder">📷</div>
            </div>
            <div className="hero-mosaic-item">
              <div className="mosaic-placeholder">🎬</div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="controls-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              className={`filter-tab ${activeFilter === f ? "active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === "all" ? "All Media" : f === "image" ? "📷 Photos" : "🎬 Videos"}
            </button>
          ))}
        </div>
        <span className="results-badge">{filtered.length} results</span>
      </div>

      {!loading && (
        <div className="section-header">
          <div>
            <div className="section-label">Browse Collection</div>
            <div className="section-title">All Media</div>
          </div>
        </div>
      )}

      {!loading && (
        <section className="gallery-section">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">Nothing found</div>
              <div className="empty-sub">Try changing your search or filter</div>
            </div>
          ) : (
            <LightGallery
              elementClassNames="lg-masonry-container"
              speed={400}
              mode="lg-fade"
              plugins={[lgThumbnail, lgZoom, lgAutoplay, lgFullscreen, lgShare, lgRotate, lgVideo]}
              mobileSettings={{ controls: true, showCloseIcon: true, download: false }}
            >
              {filtered.map((item, i) => {
                const isVideo = isVideoFile(item)
                const videoData = isVideo
                  ? JSON.stringify({
                      source: [{ src: item.file_url, type: "video/mp4" }],
                      attributes: { preload: false, controls: true },
                    })
                  : undefined

                return (
                  <a
                    key={item.id}
                    className="media-card-wrap"
                    style={{ animationDelay: `${(i % 12) * 50}ms` }}
                    href={isVideo ? "javascript:void(0)" : item.file_url}
                    data-video={videoData}
                    data-sub-html={item.title ? `<p>${item.title}</p>` : undefined}
                  >
                    <div className="media-card">
                      <div className="card-media-wrap">
                        {isVideo ? (
                          <>
                            <video src={`${item.file_url}#t=0.5`} className="card-media" muted playsInline preload="metadata" />
                            <div className="card-play-btn">▶</div>
                          </>
                        ) : (
                          <img src={item.file_url} className="card-media" alt={item.title} loading="lazy" />
                        )}
                      </div>
                      <div className="card-overlay">
                        <div className="card-info-row">
                          {item.title && <div className="card-title">{item.title}</div>}
                          <div className={`card-type-pill ${isVideo ? "video" : ""}`}>
                            {isVideo ? "Video" : "Photo"}
                          </div>
                        </div>
                      </div>
                      {item.title && (
                        <div className="card-footer">
                          <div className="card-footer-title">{item.title}</div>
                          <div className="card-footer-type">{isVideo ? "Video" : "Photography"}</div>
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </LightGallery>
          )}
        </section>
      )}

      <footer>
        <div className="footer-logo">Arch<span>ive</span></div>
        <div className="footer-copy">© {new Date().getFullYear()} Visual Archive. All rights reserved.</div>
      </footer>
    </>
  )
}

const galleryStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f5f0e8;
    color: #1a1410;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #ede8de; }
  ::-webkit-scrollbar-thumb { background: #b8860b; border-radius: 3px; }

  /* ── LightGallery Overrides ── */
  .lg-backdrop { background: rgba(20,15,8,0.96) !important; }
  .lg-toolbar, .lg-sub-html { background: transparent !important; }
  .lg-toolbar .lg-icon, .lg-actions .lg-next, .lg-actions .lg-prev {
    color: #c8a84c !important;
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(200,168,76,0.3) !important;
  }
  .lg-toolbar .lg-icon:hover, .lg-actions .lg-next:hover, .lg-actions .lg-prev:hover {
    background: rgba(200,168,76,0.2) !important; border-color: #c8a84c !important;
  }
  .lg-sub-html {
    font-family: 'Playfair Display', serif !important;
    font-size: 18px !important; color: #f0ead8 !important;
  }
  .lg-thumb-outer { background: rgba(10,8,4,0.95) !important; border-top: 1px solid rgba(200,168,76,0.2) !important; }
  .lg-thumb-item { border: 2px solid transparent !important; border-radius: 2px !important; opacity: 0.6; }
  .lg-thumb-item.active, .lg-thumb-item:hover { border-color: #c8a84c !important; opacity: 1; }
  .lg-progress-bar .lg-progress { background: #c8a84c !important; }

  /* ── LOGIN GATE ── */
  .login-gate {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f5f0e8 0%, #faf6ec 100%);
    position: relative; overflow: hidden; padding: 24px;
  }

  .login-gate-bg {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 50% 60% at 80% 20%, rgba(184,134,11,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 10% 80%, rgba(184,134,11,0.05) 0%, transparent 55%);
  }

  .login-box {
    position: relative; z-index: 1;
    display: flex; width: 100%; max-width: 860px;
    background: #fff; border-radius: 20px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.12);
    border: 1px solid rgba(184,134,11,0.1);
    overflow: hidden;
  }

  /* Left decorative panel */
  .login-panel-left {
    width: 340px; flex-shrink: 0;
    background: linear-gradient(160deg, #1a1410 0%, #2d2010 50%, #1a1410 100%);
    padding: 48px 40px;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
  }

  .login-panel-logo {
    font-family: 'Playfair Display', serif;
    font-size: 34px; font-weight: 700; color: #f0e4c0;
    margin-bottom: 20px; position: relative; z-index: 1;
  }
  .login-panel-logo span { color: #c8a84c; font-style: italic; }

  .login-panel-tagline {
    font-size: 14px; line-height: 1.7; color: #8a7a60;
    position: relative; z-index: 1; flex: 1;
  }

  .login-panel-decoration { position: absolute; inset: 0; pointer-events: none; }

  .deco-circle {
    position: absolute; border-radius: 50%;
    border: 1px solid rgba(200,168,76,0.12);
  }
  .deco-1 { width: 280px; height: 280px; right: -100px; top: -60px; }
  .deco-2 { width: 180px; height: 180px; right: -40px; bottom: 60px; border-color: rgba(200,168,76,0.08); }
  .deco-3 { width: 80px; height: 80px; left: 30px; bottom: 40px; border-color: rgba(200,168,76,0.15); }

  .login-panel-dots {
    display: flex; gap: 8px; position: relative; z-index: 1; margin-top: 40px;
  }
  .login-panel-dots span {
    width: 8px; height: 8px; border-radius: 50%; background: rgba(200,168,76,0.3);
  }
  .login-panel-dots span:first-child { background: #c8a84c; }

  /* Right form panel */
  .login-panel-right {
    flex: 1; padding: 52px 48px; display: flex; flex-direction: column;
  }

  .login-welcome {
    font-family: 'Playfair Display', serif;
    font-size: 30px; font-weight: 700; color: #1a1410; margin-bottom: 6px;
  }
  .login-subtitle { font-size: 14px; color: #8a7a60; margin-bottom: 28px; }
  .login-divider { height: 1px; background: #f0e8d4; margin-bottom: 28px; }

  .login-field { margin-bottom: 18px; }
  .login-label {
    display: block; font-size: 11px; font-weight: 600;
    color: #5a4e3a; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 7px;
  }

  .login-pass-wrap { position: relative; }

  .login-input {
    width: 100%; background: #faf7f2;
    border: 1.5px solid #e8dfc8; color: #1a1410;
    font-family: 'Inter', sans-serif; font-size: 14px;
    padding: 12px 16px; border-radius: 10px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .login-input:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .login-input::placeholder { color: #b0a080; }

  .login-pass-toggle {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    font-size: 11px; font-weight: 600; color: #b8860b; font-family: 'Inter', sans-serif;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .login-pass-toggle:hover { color: #8a6200; }

  .login-error {
    background: #fff5f5; border: 1.5px solid #fecaca; color: #b91c1c;
    border-radius: 10px; padding: 11px 16px;
    font-size: 13px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }

  .login-btn {
    width: 100%;
    background: linear-gradient(135deg, #b8860b, #d4a017);
    color: #fff; font-family: 'Inter', sans-serif;
    font-size: 15px; font-weight: 600;
    padding: 14px; border: none; border-radius: 10px;
    cursor: pointer; transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 4px 20px rgba(184,134,11,0.35);
    margin-bottom: 20px;
  }
  .login-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .login-btn-loading { display: flex; align-items: center; justify-content: center; gap: 10px; }

  .btn-spinner {
    width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.7s linear infinite; display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .login-note {
    font-size: 12px; color: #a09070; line-height: 1.6;
    background: rgba(184,134,11,0.05); border: 1px solid rgba(184,134,11,0.12);
    border-radius: 8px; padding: 12px 14px; text-align: center; margin-top: auto;
  }

  @media (max-width: 680px) {
    .login-panel-left { display: none; }
    .login-panel-right { padding: 40px 32px; }
    .login-box { max-width: 440px; }
  }

  /* ── NAV ── */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 56px; height: 68px;
    background: rgba(245,240,232,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(184,134,11,0.15);
    box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  }
  .nav-logo {
    font-family: 'Playfair Display', serif;
    font-size: 24px; font-weight: 700; color: #1a1410;
    text-decoration: none; display: flex; align-items: center; gap: 3px;
  }
  .nav-logo-accent { color: #b8860b; font-style: italic; }
  .nav-logo-dot { color: #b8860b; font-size: 28px; }
  .nav-right { display: flex; align-items: center; gap: 10px; }
  .nav-user-badge {
    font-size: 12px; font-weight: 500; color: #5a4e3a;
    background: rgba(184,134,11,0.08); border: 1px solid rgba(184,134,11,0.18);
    padding: 5px 12px; border-radius: 20px;
  }
  .nav-count {
    font-size: 12px; font-weight: 500; color: #8a7a60;
    background: #ede7d9; padding: 5px 12px; border-radius: 20px;
    border: 1px solid rgba(184,134,11,0.2);
  }
  .nav-logout-btn {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    color: #8a7a60; background: #fff; border: 1.5px solid #e0d8c4;
    padding: 7px 14px; border-radius: 6px; cursor: pointer;
    transition: all 0.2s;
  }
  .nav-logout-btn:hover { border-color: #dc2626; color: #dc2626; background: #fff5f5; }
  .nav-admin-btn {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: #fff;
    text-decoration: none;
    background: linear-gradient(135deg, #b8860b, #d4a017);
    padding: 8px 18px; border-radius: 6px; transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(184,134,11,0.3);
  }
  .nav-admin-btn:hover { opacity: 0.88; transform: translateY(-1px); }

  /* ── HERO ── */
  .hero {
    min-height: 92vh; display: grid; grid-template-columns: 1fr 1fr;
    align-items: center; padding: 100px 56px 60px;
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, #f5f0e8 0%, #faf6ec 50%, #f0e8d4 100%);
  }
  .hero::before {
    content: ''; position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 55% 60% at 85% 30%, rgba(184,134,11,0.08) 0%, transparent 65%),
      radial-gradient(ellipse 35% 40% at 10% 80%, rgba(184,134,11,0.05) 0%, transparent 55%);
    pointer-events: none;
  }
  .hero-left { position: relative; z-index: 1; }
  .hero-tag {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(184,134,11,0.1); border: 1px solid rgba(184,134,11,0.25);
    color: #8a6200; font-size: 11px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 6px 14px; border-radius: 20px; margin-bottom: 28px;
    opacity: 0; animation: slideIn 0.8s ease 0.2s forwards;
  }
  .hero-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(48px, 5.5vw, 84px); font-weight: 700; line-height: 1.05;
    color: #1a1410; margin-bottom: 24px;
    opacity: 0; animation: slideIn 0.8s ease 0.4s forwards;
  }
  .hero-title-accent { font-style: italic; color: #b8860b; display: block; }
  .hero-desc {
    font-size: 16px; color: #5a4e3a; line-height: 1.7;
    max-width: 440px; margin-bottom: 36px;
    opacity: 0; animation: slideIn 0.8s ease 0.6s forwards;
  }
  .hero-actions { opacity: 0; animation: slideIn 0.8s ease 0.8s forwards; }
  .hero-stats { display: flex; gap: 32px; }
  .hero-stat-num { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 600; color: #1a1410; }
  .hero-stat-label { font-size: 11px; color: #8a7a60; font-weight: 500; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .hero-right {
    position: relative; z-index: 1; display: flex; justify-content: flex-end;
    opacity: 0; animation: scaleIn 1s ease 0.5s forwards;
  }
  .hero-mosaic { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 200px 200px; gap: 12px; width: 100%; max-width: 480px; }
  .hero-mosaic-item {
    background: linear-gradient(135deg, #e8dfc8, #d4c9a8); border-radius: 12px;
    overflow: hidden; border: 1px solid rgba(184,134,11,0.1);
    display: flex; align-items: center; justify-content: center;
  }
  .hero-mosaic-item:first-child { grid-row: span 2; border-radius: 16px; }
  .mosaic-placeholder { font-size: 28px; opacity: 0.4; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .mosaic-placeholder span { font-size: 10px; font-weight: 500; letter-spacing: 0.1em; color: #8a7a60; text-transform: uppercase; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

  /* ── CONTROLS ── */
  .controls-bar {
    position: sticky; top: 68px; z-index: 90;
    background: rgba(245,240,232,0.96); backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(184,134,11,0.12);
    padding: 14px 56px; display: flex; align-items: center; gap: 14px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  }
  .search-wrap { position: relative; flex: 1; max-width: 340px; }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 14px; }
  .search-input {
    width: 100%; background: #fff; border: 1.5px solid #e0d8c4; color: #1a1410;
    font-family: 'Inter', sans-serif; font-size: 13px;
    padding: 10px 14px 10px 38px; border-radius: 8px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-input::placeholder { color: #b0a080; }
  .search-input:focus { border-color: #b8860b; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
  .filter-tabs { display: flex; gap: 6px; }
  .filter-tab {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    padding: 8px 16px; border-radius: 20px; border: 1.5px solid #e0d8c4;
    background: #fff; color: #6a5a40; cursor: pointer; transition: all 0.2s;
  }
  .filter-tab:hover { border-color: #b8860b; color: #8a6200; }
  .filter-tab.active {
    background: linear-gradient(135deg, #b8860b, #d4a017);
    border-color: transparent; color: #fff;
    box-shadow: 0 2px 8px rgba(184,134,11,0.3);
  }
  .results-badge {
    margin-left: auto; background: #fff; border: 1.5px solid #e0d8c4;
    color: #8a7a60; font-size: 12px; font-weight: 500; padding: 7px 14px; border-radius: 20px;
  }

  .section-header { padding: 48px 56px 24px; display: flex; align-items: flex-end; justify-content: space-between; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #b8860b; margin-bottom: 6px; }
  .section-title { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 600; color: #1a1410; }

  /* ── GALLERY GRID ── */
  .gallery-section { padding: 0 56px 100px; }
  .lg-masonry-container { columns: 4; column-gap: 16px; }
  @media (max-width: 1280px) { .lg-masonry-container { columns: 3; } }
  @media (max-width: 900px)  {
    .lg-masonry-container { columns: 2; }
    nav, .controls-bar, .gallery-section, .hero { padding-left: 24px; padding-right: 24px; }
    .hero { grid-template-columns: 1fr; min-height: auto; }
    .hero-right { display: none; }
    .section-header { padding-left: 24px; padding-right: 24px; }
    .nav-user-badge { display: none; }
  }
  @media (max-width: 520px) { .lg-masonry-container { columns: 1; } }

  .media-card-wrap {
    break-inside: avoid; margin-bottom: 16px; display: block; text-decoration: none;
    opacity: 0; animation: cardIn 0.5s ease forwards;
  }
  @keyframes cardIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  .media-card {
    position: relative; overflow: hidden; cursor: pointer;
    background: #fff; border-radius: 12px;
    border: 1px solid rgba(184,134,11,0.1);
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .media-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.14); }
  .media-card:hover .card-overlay { opacity: 1; }
  .media-card:hover .card-media { transform: scale(1.05); }

  .card-media-wrap { overflow: hidden; }
  .card-media { width: 100%; display: block; transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
  .card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(20,14,4,0.82) 0%, rgba(20,14,4,0.2) 55%, transparent 100%);
    opacity: 0; transition: opacity 0.35s ease;
    display: flex; flex-direction: column; justify-content: flex-end; padding: 18px 16px;
  }
  .card-info-row { display: flex; align-items: flex-end; justify-content: space-between; }
  .card-title { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 600; color: #fff; line-height: 1.3; max-width: 75%; }
  .card-type-pill {
    font-size: 9px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
    background: rgba(184,134,11,0.85); color: #fff; padding: 4px 8px; border-radius: 4px;
  }
  .card-type-pill.video { background: rgba(30,100,200,0.85); }
  .card-footer { padding: 10px 14px 12px; background: #fff; border-top: 1px solid #f0e8d4; }
  .card-footer-title { font-size: 12px; font-weight: 500; color: #3a2e1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-footer-type { font-size: 10px; color: #b8a070; margin-top: 2px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
  .card-play-btn {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 52px; height: 52px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 18px; pointer-events: none;
    background: rgba(184,134,11,0.8); box-shadow: 0 4px 20px rgba(184,134,11,0.5);
    padding-left: 4px; transition: transform 0.2s, background 0.2s;
  }
  .media-card:hover .card-play-btn { transform: translate(-50%, -50%) scale(1.1); background: rgba(184,134,11,1); }

  /* ── LOADING ── */
  .loading-screen {
    position: fixed; inset: 0; background: #f5f0e8;
    display: flex; align-items: center; justify-content: center;
    z-index: 999; flex-direction: column; gap: 28px;
  }
  .loading-logo { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #1a1410; }
  .loading-logo-accent { color: #b8860b; font-style: italic; }
  .loading-bar-wrap { width: 180px; height: 3px; background: #e8dfc8; border-radius: 2px; overflow: hidden; }
  .loading-bar { height: 100%; background: linear-gradient(90deg, #b8860b, #d4a017); animation: loadBar 1.2s ease forwards; border-radius: 2px; }
  @keyframes loadBar { from { width: 0; } to { width: 100%; } }
  .loading-label { font-size: 12px; font-weight: 500; color: #8a7a60; letter-spacing: 0.1em; text-transform: uppercase; }

  /* ── EMPTY ── */
  .empty-state { text-align: center; padding: 100px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .empty-icon { width: 72px; height: 72px; background: #ede7d9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #b8a070; }
  .empty-text { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 600; color: #3a2e1a; }
  .empty-sub { font-size: 14px; color: #8a7a60; }

  /* ── FOOTER ── */
  footer {
    background: #1a1410; color: #6a5a40;
    padding: 32px 56px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .footer-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #e8d8a0; }
  .footer-logo span { font-style: italic; color: #c8a84c; }
  .footer-copy { font-size: 12px; }

  @media (max-width: 600px) {
    footer { padding: 24px; flex-direction: column; gap: 8px; text-align: center; }
  }
`
