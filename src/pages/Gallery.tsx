import { useEffect, useState } from "react"
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
  const [session, setSession] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const [items, setItems] = useState<MediaItem[]>([])
  const [filtered, setFiltered] = useState<MediaItem[]>([])
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "image" | "video">("all")
  const [loading, setLoading] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) fetchData() }, [session])

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
    if (!email.trim() || !password.trim()) { setAuthError("Email və şifrəni daxil edin."); return }
    setAuthLoading(true); setAuthError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null); setItems([]); setFiltered([])
  }

  const photoCount = items.filter(i => !isVideoFile(i)).length
  const videoCount = items.filter(i => isVideoFile(i)).length

  if (!authChecked) return (
    <>
      <style>{css}</style>
      <div className="splash">
        <div className="splash-logo">Arch<span>ive</span></div>
        <div className="splash-bar"><div className="splash-fill" /></div>
      </div>
    </>
  )

  if (!session) return (
    <>
      <style>{css}</style>
      <div className="gate">
        <div className="gate-card">
          <div className="gate-left">
            <div className="gate-brand">Arch<span>ive</span></div>
            <p className="gate-tagline">A private collection of visual media. Access is by invitation only.</p>
            <div className="gate-deco">
              <div className="deco-ring r1" /><div className="deco-ring r2" /><div className="deco-ring r3" />
            </div>
            <div className="gate-dots"><span /><span /><span /></div>
          </div>
          <div className="gate-right">
            <div className="gate-title">Welcome back</div>
            <div className="gate-sub">Sign in to access the gallery</div>
            <div className="gate-divider" />
            <div className="gate-field">
              <label className="gate-label">Email address</label>
              <input type="email" className="gate-input" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && login()} autoFocus />
            </div>
            <div className="gate-field">
              <label className="gate-label">Password</label>
              <div className="gate-pass">
                <input type={showPass ? "text" : "password"} className="gate-input"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && login()} />
                <button className="gate-toggle" onClick={() => setShowPass(!showPass)}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {authError && <div className="gate-error">⚠ {authError}</div>}
            <button className="gate-btn" onClick={login} disabled={authLoading}>
              {authLoading ? <><span className="spin-sm" /> Signing in…</> : "Sign In →"}
            </button>
            <div className="gate-note">🔒 Private gallery — authorised users only.</div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <style>{css}</style>

      {loading && (
        <div className="splash">
          <div className="splash-logo">Arch<span>ive</span></div>
          <div className="splash-bar"><div className="splash-fill" /></div>
          <div className="splash-label">Loading media…</div>
        </div>
      )}

      {/* NAV */}
      <nav className="nav">
        <a href="/" className="nav-logo">Arch<span>ive</span></a>
        <div className="nav-right nav-desktop">
          <span className="nav-badge">👤 {session.user?.email?.split("@")[0]}</span>
          <span className="nav-count">{items.length} works</span>
          <button className="nav-out" onClick={logout}>Sign Out</button>
          <a href="/admin" className="nav-admin">Admin →</a>
        </div>
        <button className="nav-burger" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          <span className={mobileNavOpen ? "open" : ""} />
          <span className={mobileNavOpen ? "open" : ""} />
          <span className={mobileNavOpen ? "open" : ""} />
        </button>
      </nav>

      {mobileNavOpen && (
        <div className="mobile-menu">
          <span className="nav-badge">👤 {session.user?.email?.split("@")[0]}</span>
          <span className="nav-count">{items.length} works</span>
          <button className="nav-out" onClick={logout}>Sign Out</button>
          <a href="/admin" className="nav-admin" onClick={() => setMobileNavOpen(false)}>Admin →</a>
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <h1 className="hero-h1">
            Photography &amp;<br />
            <span className="hero-accent">Moving Image</span>
          </h1>
          <p className="hero-p">
            A curated collection of photographs and videos. Explore, discover, and experience visual stories.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hs-num">{photoCount}</span>
              <span className="hs-lbl">Photos</span>
            </div>
            <div className="hdv" />
            <div className="hero-stat">
              <span className="hs-num">{videoCount}</span>
              <span className="hs-lbl">Videos</span>
            </div>
            <div className="hdv" />
            <div className="hero-stat">
              <span className="hs-num">{items.length}</span>
              <span className="hs-lbl">Total</span>
            </div>
          </div>
          <a href="#gallery" className="hero-cta">Browse Collection ↓</a>
        </div>

        <div className="hero-visual">
          <div className="hero-frame">
            <video autoPlay loop muted playsInline className="hero-vid">
              <source src="/video/hero.mp4" type="video/mp4" />
            </video>
            <div className="hero-vid-overlay" />
          </div>
        </div>
      </section>

      {/* CONTROLS */}
      <div className="controls" id="gallery">
        <div className="ctrl-search">
          <span className="ctrl-icon">🔍</span>
          <input type="text" className="ctrl-input" placeholder="Search by title…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="ctrl-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <div className="ctrl-filters">
          {(["all", "image", "video"] as const).map(f => (
            <button key={f}
              className={`ctrl-tab ${activeFilter === f ? "active" : ""}`}
              onClick={() => setActiveFilter(f)}>
              {f === "all" ? "All" : f === "image" ? "📷 Photos" : "🎬 Videos"}
            </button>
          ))}
        </div>
        <span className="ctrl-badge">{filtered.length} results</span>
      </div>

      {!loading && (
        <div className="sec-header">
          <span className="sec-label">Browse Collection</span>
          <h2 className="sec-title">All Media</h2>
        </div>
      )}

      {!loading && (
        <section className="gallery-wrap">
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-h">Nothing found</div>
              <div className="empty-sub">Try changing your search or filter</div>
            </div>
          ) : (
            <LightGallery
              elementClassNames="lg-grid"
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
                    className="media-item"
                    style={{ animationDelay: `${(i % 16) * 45}ms` }}
                    href={isVideo ? "javascript:void(0)" : item.file_url}
                    data-video={videoData}
                    data-sub-html={item.title ? `<p class="lg-sub">${item.title}</p>` : undefined}
                  >
                    <div className="media-card">
                      <div className="card-thumb">
                        {isVideo ? (
                          <>
                            <video src={`${item.file_url}#t=0.5`} className="card-img"
                              muted playsInline preload="metadata" />
                            <div className="play-btn"><span className="play-icon">▶</span></div>
                          </>
                        ) : (
                          <img src={item.file_url} className="card-img" alt={item.title} loading="lazy" />
                        )}
                        <div className="card-overlay">
                          <div className="card-overlay-info">
                            {item.title && <div className="card-overlay-title">{item.title}</div>}
                            <span className={`card-pill ${isVideo ? "pill-video" : "pill-photo"}`}>
                              {isVideo ? "Video" : "Photo"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {item.title && (
                        <div className="card-footer">
                          <span className="cf-title">{item.title}</span>
                          <span className="cf-type">{isVideo ? "Video" : "Photography"}</span>
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

      <footer className="footer">
        <div className="footer-logo">Arch<span>ive</span></div>
        <div className="footer-copy">© {new Date().getFullYear()} Visual Archive. All rights reserved.</div>
      </footer>
    </>
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gold: #8a6e1e;
    --gold2: #a8882a;
    --gold-pale: rgba(138,110,30,0.1);
    --bg: #eee8db;
    --bg2: #f5f0e5;
    --ink: #1a1410;
    --ink2: #342a1c;
    --muted: #6e6250;
    --muted2: #a09070;
    --border: rgba(138,110,30,0.13);
    --border2: #d8ceb0;
    --white: #fff;
    --ease: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #e0d8c8; }
  ::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 3px; }

  /* LightGallery */
  .lg-backdrop { background: rgba(6,4,1,0.97) !important; }
  .lg-toolbar, .lg-sub-html { background: transparent !important; }
  .lg-toolbar .lg-icon, .lg-actions .lg-next, .lg-actions .lg-prev {
    color: #c0a040 !important;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(192,160,64,0.2) !important;
    border-radius: 7px !important;
  }
  .lg-toolbar .lg-icon:hover, .lg-actions .lg-next:hover, .lg-actions .lg-prev:hover {
    background: rgba(192,160,64,0.14) !important; border-color: #c0a040 !important;
  }
  .lg-sub-html p { font-family: 'Playfair Display', serif; font-size: 16px; color: #ede8d4; font-style: italic; }
  .lg-thumb-outer { background: rgba(4,2,0,0.96) !important; border-top: 1px solid rgba(192,160,64,0.14) !important; }
  .lg-thumb-item { border: 2px solid transparent !important; border-radius: 4px !important; opacity: 0.5; }
  .lg-thumb-item.active, .lg-thumb-item:hover { border-color: #c0a040 !important; opacity: 1; }
  .lg-progress-bar .lg-progress { background: #c0a040 !important; }

  /* SPLASH */
  .splash {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 999; gap: 22px;
    animation: splashOut 0.4s ease 1.4s forwards;
  }
  @keyframes splashOut { to { opacity: 0; pointer-events: none; } }
  .splash-logo {
    font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: var(--ink);
    opacity: 0; animation: fadeUp 0.5s ease 0.2s forwards;
  }
  .splash-logo span { color: var(--gold); font-style: italic; }
  .splash-bar {
    width: 130px; height: 2px; background: var(--border2); border-radius: 2px; overflow: hidden;
    opacity: 0; animation: fadeUp 0.4s ease 0.4s forwards;
  }
  .splash-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold2)); animation: barFill 0.9s ease 0.5s both; }
  @keyframes barFill { from { width: 0; } to { width: 100%; } }
  .splash-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); opacity: 0; animation: fadeUp 0.4s ease 0.6s forwards; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* GATE */
  .gate {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%);
    padding: 24px;
  }
  .gate-card {
    display: flex; width: 100%; max-width: 800px; background: var(--white);
    border-radius: 18px; box-shadow: 0 20px 56px rgba(0,0,0,0.08);
    border: 1px solid var(--border); overflow: hidden;
    animation: scaleIn 0.4s var(--ease);
  }
  .gate-left {
    width: 290px; flex-shrink: 0;
    background: linear-gradient(160deg, #161008 0%, #261608 55%, #161008 100%);
    padding: 44px 30px; display: flex; flex-direction: column; position: relative; overflow: hidden;
  }
  .gate-brand { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #e8d8b0; margin-bottom: 14px; position: relative; z-index: 1; }
  .gate-brand span { color: #c0a040; font-style: italic; }
  .gate-tagline { font-size: 13px; line-height: 1.75; color: #604e2e; position: relative; z-index: 1; flex: 1; }
  .gate-deco { position: absolute; inset: 0; pointer-events: none; }
  .deco-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(192,160,64,0.08); }
  .r1 { width: 280px; height: 280px; right: -100px; top: -60px; }
  .r2 { width: 155px; height: 155px; right: -28px; bottom: 55px; border-color: rgba(192,160,64,0.05); }
  .r3 { width: 58px; height: 58px; left: 22px; bottom: 38px; border-color: rgba(192,160,64,0.11); }
  .gate-dots { display: flex; gap: 7px; position: relative; z-index: 1; margin-top: 34px; }
  .gate-dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(192,160,64,0.2); }
  .gate-dots span:first-child { background: #c0a040; }

  .gate-right { flex: 1; padding: 46px 38px; display: flex; flex-direction: column; }
  .gate-title { font-family: 'Playfair Display', serif; font-size: 25px; font-weight: 700; color: var(--ink); margin-bottom: 5px; }
  .gate-sub { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
  .gate-divider { height: 1px; background: var(--border2); margin-bottom: 24px; }
  .gate-field { margin-bottom: 15px; }
  .gate-label { display: block; font-size: 11px; font-weight: 600; color: #453820; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .gate-pass { position: relative; }
  .gate-input {
    width: 100%; background: #faf6ed; border: 1.5px solid var(--border2); color: var(--ink);
    font-family: 'Inter', sans-serif; font-size: 14px;
    padding: 11px 14px; border-radius: 8px; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .gate-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(138,110,30,0.09); }
  .gate-input::placeholder { color: var(--muted2); }
  .gate-toggle {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    font-size: 11px; font-weight: 600; color: var(--gold); font-family: 'Inter', sans-serif;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .gate-error {
    background: #fdf0ee; border: 1px solid #f0b8b0; color: #901414;
    border-radius: 8px; padding: 10px 13px; font-size: 13px; margin-bottom: 13px;
    display: flex; align-items: center; gap: 7px;
  }
  .gate-btn {
    width: 100%; background: linear-gradient(135deg, var(--gold), var(--gold2));
    color: #fff; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
    padding: 12px; border: none; border-radius: 8px; cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 4px 14px rgba(138,110,30,0.25); margin-bottom: 16px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .gate-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .gate-btn:disabled { opacity: 0.38; cursor: not-allowed; }
  .gate-note {
    font-size: 12px; color: #908070; line-height: 1.6; margin-top: auto;
    background: rgba(138,110,30,0.04); border: 1px solid rgba(138,110,30,0.09);
    border-radius: 7px; padding: 11px 13px; text-align: center;
  }
  .spin-sm {
    width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%; display: inline-block;
    animation: spin 0.7s linear infinite;
  }
  @media (max-width: 620px) { .gate-left { display: none; } .gate-right { padding: 34px 22px; } }

  /* NAV */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 48px; height: 62px;
    background: rgba(238,232,219,0.88);
    backdrop-filter: blur(18px) saturate(150%);
    -webkit-backdrop-filter: blur(18px) saturate(150%);
    border-bottom: 1px solid rgba(138,110,30,0.1);
    animation: fadeIn 0.5s ease 0.3s both;
  }
  .nav-logo {
    font-family: 'Playfair Display', serif; font-size: 21px; font-weight: 700;
    color: var(--ink); text-decoration: none; transition: opacity 0.2s;
  }
  .nav-logo:hover { opacity: 0.6; }
  .nav-logo span { color: var(--gold); font-style: italic; }
  .nav-right { display: flex; align-items: center; gap: 8px; }
  .nav-badge {
    font-size: 12px; font-weight: 500; color: #3e3018;
    background: var(--gold-pale); border: 1px solid rgba(138,110,30,0.16);
    padding: 5px 11px; border-radius: 20px;
  }
  .nav-count {
    font-size: 12px; font-weight: 500; color: var(--muted);
    background: #e4dcc8; padding: 5px 11px; border-radius: 20px;
    border: 1px solid var(--border2);
  }
  .nav-out {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    color: var(--muted); background: var(--white); border: 1.5px solid var(--border2);
    padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.18s;
  }
  .nav-out:hover { border-color: #b03020; color: #b03020; background: #fdf4f2; }
  .nav-admin {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase; color: #fff;
    text-decoration: none;
    background: linear-gradient(135deg, var(--gold), var(--gold2));
    padding: 7px 15px; border-radius: 6px; transition: all 0.18s;
    box-shadow: 0 2px 8px rgba(138,110,30,0.22);
  }
  .nav-admin:hover { opacity: 0.87; transform: translateY(-1px); }
  .nav-burger {
    display: none; flex-direction: column; gap: 5px;
    background: none; border: none; cursor: pointer; padding: 3px;
  }
  .nav-burger span {
    display: block; width: 20px; height: 2px; background: var(--gold); border-radius: 2px;
    transition: all 0.22s;
  }
  .nav-burger span.open:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .nav-burger span.open:nth-child(2) { opacity: 0; }
  .nav-burger span.open:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
  .mobile-menu {
    position: fixed; top: 62px; left: 0; right: 0; z-index: 99;
    background: rgba(238,232,219,0.96); backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-bottom: 1px solid var(--border);
    padding: 13px 20px; display: flex; flex-direction: column; gap: 9px;
    animation: slideDown 0.2s var(--ease);
    box-shadow: 0 6px 20px rgba(0,0,0,0.06);
  }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-7px); } to { opacity: 1; transform: translateY(0); } }
  .mobile-menu .nav-admin { text-align: center; }

  /* HERO */
  .hero {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 56px;
    padding: 96px 56px 56px;
    background: linear-gradient(145deg, var(--bg) 0%, var(--bg2) 100%);
  }

  .hero-text { position: relative; z-index: 1; }

  .hero-h1 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(40px, 4.2vw, 68px);
    font-weight: 700; line-height: 1.1;
    color: var(--ink); margin-bottom: 18px;
    opacity: 0; animation: fadeUp 0.65s var(--ease) 0.7s forwards;
  }
  .hero-accent { font-style: italic; color: var(--gold); }
  .hero-p {
    font-size: 15px; color: #524636; line-height: 1.75;
    max-width: 390px; margin-bottom: 30px;
    opacity: 0; animation: fadeUp 0.65s var(--ease) 0.88s forwards;
  }
  .hero-stats {
    display: flex; align-items: center;
    margin-bottom: 30px;
    opacity: 0; animation: fadeUp 0.65s var(--ease) 1.04s forwards;
  }
  .hero-stat { display: flex; flex-direction: column; padding-right: 22px; }
  .hdv { width: 1px; height: 34px; background: var(--border2); margin-right: 22px; }
  .hs-num { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 600; color: var(--ink); line-height: 1; }
  .hs-lbl { font-size: 10px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 3px; }
  .hero-cta {
    display: inline-flex; align-items: center; gap: 7px;
    background: linear-gradient(135deg, var(--gold), var(--gold2));
    color: #fff; text-decoration: none;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
    padding: 12px 24px; border-radius: 26px;
    box-shadow: 0 4px 14px rgba(138,110,30,0.28);
    transition: all 0.26s var(--ease);
    opacity: 0; animation: fadeUp 0.65s var(--ease) 1.18s forwards;
  }
  .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(138,110,30,0.36); }

  /* HERO VIDEO — right column fills full height */
  .hero-visual {
    position: relative; z-index: 1;
    width: 100%;
    height: calc(100vh - 130px);
    min-height: 500px;
    max-height: 780px;
    opacity: 0; animation: scaleIn 0.85s var(--ease) 0.75s forwards;
  }
  .hero-frame {
    width: 100%; height: 100%;
    border-radius: 18px; overflow: hidden;
    box-shadow: 0 28px 72px rgba(0,0,0,0.16), 0 0 0 1px rgba(138,110,30,0.1);
    position: relative;
    background: #1a1410;
  }
  .hero-vid {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
  }
  .hero-vid-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(16,10,4,0.06) 0%, transparent 35%, rgba(16,10,4,0.28) 100%);
    pointer-events: none;
  }

  /* CONTROLS */
  .controls {
    position: sticky; top: 62px; z-index: 90;
    background: rgba(238,232,219,0.92);
    backdrop-filter: blur(18px) saturate(145%);
    -webkit-backdrop-filter: blur(18px) saturate(145%);
    border-bottom: 1px solid rgba(138,110,30,0.1);
    padding: 12px 56px;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
  }
  .ctrl-search {
    position: relative; flex: 1; max-width: 275px;
    display: flex; align-items: center;
  }
  .ctrl-icon { position: absolute; left: 11px; font-size: 12px; pointer-events: none; }
  .ctrl-input {
    width: 100%; background: var(--white); border: 1.5px solid var(--border2);
    color: var(--ink); font-family: 'Inter', sans-serif; font-size: 13px;
    padding: 8px 11px 8px 33px; border-radius: 7px; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ctrl-input::placeholder { color: var(--muted2); }
  .ctrl-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(138,110,30,0.09); }
  .ctrl-clear {
    position: absolute; right: 9px; background: none; border: none;
    cursor: pointer; color: var(--muted2); font-size: 11px; padding: 2px 3px;
  }
  .ctrl-filters { display: flex; gap: 5px; }
  .ctrl-tab {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    padding: 7px 13px; border-radius: 18px; border: 1.5px solid var(--border2);
    background: var(--white); color: #524636; cursor: pointer; transition: all 0.16s;
  }
  .ctrl-tab:hover { border-color: var(--gold); color: #5e4208; }
  .ctrl-tab.active {
    background: linear-gradient(135deg, var(--gold), var(--gold2));
    border-color: transparent; color: #fff;
    box-shadow: 0 2px 7px rgba(138,110,30,0.24);
  }
  .ctrl-badge {
    margin-left: auto; background: var(--white); border: 1.5px solid var(--border2);
    color: var(--muted); font-size: 12px; font-weight: 500;
    padding: 6px 12px; border-radius: 18px; white-space: nowrap;
  }

  /* SECTION HEADER */
  .sec-header { padding: 46px 56px 20px; }
  .sec-label { font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 5px; }
  .sec-title { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 600; color: var(--ink); }

  /* GALLERY */
  .gallery-wrap { padding: 0 56px 72px; }
  .lg-grid { columns: 4; column-gap: 13px; }

  .media-item {
    break-inside: avoid; margin-bottom: 13px; display: block;
    text-decoration: none;
    opacity: 0; animation: fadeUp 0.48s var(--ease) forwards;
  }
  .media-card {
    overflow: hidden; cursor: pointer;
    background: var(--white); border-radius: 10px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease);
  }
  .media-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.11); }
  .media-card:hover .card-overlay { opacity: 1; }
  .media-card:hover .card-img { transform: scale(1.05); }
  .media-card:hover .play-btn { transform: translate(-50%, -50%) scale(1.1); }

  .card-thumb { position: relative; overflow: hidden; }
  .card-img { width: 100%; display: block; transition: transform 0.52s var(--ease); }
  .card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(14,8,2,0.8) 0%, rgba(14,8,2,0.1) 55%, transparent 100%);
    opacity: 0; transition: opacity 0.28s ease;
    display: flex; flex-direction: column; justify-content: flex-end; padding: 13px;
  }
  .card-overlay-info { display: flex; align-items: flex-end; justify-content: space-between; gap: 6px; }
  .card-overlay-title { font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 600; color: #fff; line-height: 1.3; flex: 1; }
  .card-pill {
    font-size: 9px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase;
    padding: 3px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0;
  }
  .pill-photo { background: rgba(138,110,30,0.88); color: #fff; }
  .pill-video { background: rgba(26,68,168,0.82); color: #c4d4ff; }

  .play-btn {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 48px; height: 48px; border-radius: 50%;
    background: rgba(138,110,30,0.88);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s var(--ease);
    box-shadow: 0 3px 14px rgba(138,110,30,0.4);
    pointer-events: none;
  }
  .play-icon { color: #fff; font-size: 16px; margin-left: 3px; }

  .card-footer { padding: 9px 12px 10px; background: var(--white); border-top: 1px solid #e8deca; }
  .cf-title { font-size: 12px; font-weight: 500; color: var(--ink2); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
  .cf-type { font-size: 10px; color: var(--muted2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; }

  /* EMPTY */
  .empty { text-align: center; padding: 88px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .empty-icon { width: 64px; height: 64px; background: #ddd6c4; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .empty-h { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: var(--ink2); }
  .empty-sub { font-size: 13px; color: var(--muted); }

  /* FOOTER */
  .footer {
    background: #141008; color: #48402c;
    padding: 26px 56px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .footer-logo { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #d0c080; }
  .footer-logo span { font-style: italic; color: #c0a040; }
  .footer-copy { font-size: 12px; }

  /* RESPONSIVE */
  @media (max-width: 1100px) { .lg-grid { columns: 3; } }

  @media (max-width: 880px) {
    .nav { padding: 0 18px; }
    .nav-desktop { display: none; }
    .nav-burger { display: flex; }

    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding: 86px 22px 48px;
      gap: 32px;
    }
    .hero-h1 { font-size: 38px; }
    .hero-p { max-width: 100%; }
    .hero-visual {
      height: 55vw;
      min-height: 260px;
      max-height: 400px;
    }

    .controls { padding: 11px 18px; }
    .ctrl-search { max-width: 100%; width: 100%; }

    .sec-header { padding: 34px 18px 16px; }
    .gallery-wrap { padding: 0 18px 48px; }
    .lg-grid { columns: 2; }
    .footer { padding: 22px 18px; flex-direction: column; gap: 6px; text-align: center; }
  }

  @media (max-width: 460px) {
    .hero-h1 { font-size: 32px; }
    .lg-grid { columns: 1; }
    .ctrl-filters { flex-wrap: wrap; }
  }
`
