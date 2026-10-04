import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, getUser } from '../services/api';
import { Loading } from '../components/Ui';
import { isCampaignStockUrl, resolveCitizenHeroUrl } from '../utils/portalDefaults';
import { formatWardNumber } from '../wardFormat';

let _galleryCache = null;

export default function Gallery() {
  const user = getUser();
  const mr = (localStorage.getItem('ward_language') || 'en') === 'mr';
  const language = mr ? 'mr' : 'en';
  const isMr = language === 'mr';

  const [snapshot, setSnapshot] = useState(() => _galleryCache?.snapshot ?? null);
  const [team, setTeam] = useState(() => _galleryCache?.team ?? null);
  const [portalConfig, setPortalConfig] = useState(() => _galleryCache?.portalConfig ?? null);
  const [portalGallery, setPortalGallery] = useState(() => _galleryCache?.portalGallery ?? null);
  const [loading, setLoading] = useState(() => !_galleryCache);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let live = true;
    const loadAll = () => {
      const wardId = user?.wardId || null;
      const q = wardId ? { wardId } : {};
      Promise.allSettled([
        api.myWard(),
        api.wardTeam(),
        api.portalConfig(q),
        api.galleryItems({ status: 'PUBLISHED', ...q })
      ])
        .then(([w, t, pc, pg]) => {
          if (!live) return;
          const nextSnapshot = w.status === 'fulfilled' ? (w.value?.data || null) : null;
          const nextTeam = t.status === 'fulfilled' ? (t.value?.data || null) : null;
          const pcData = pc.status === 'fulfilled' ? (pc.value?.data || null) : null;
          const nextConfig = pcData?.config || (pcData && !pcData.nagarsevaks ? pcData : null);
          const nextGallery = pg.status === 'fulfilled' && Array.isArray(pg.value?.data) ? pg.value.data : [];
          if (nextSnapshot) setSnapshot(nextSnapshot);
          if (nextTeam) setTeam(nextTeam);
          if (nextConfig) {
            setPortalConfig(nextConfig);
            const gb = nextConfig.galleryBannerUrl || nextConfig.meta?.galleryBannerUrl;
            if (gb && !String(gb).startsWith('data:')) {
              try { localStorage.setItem(`ward_gallery_banner_${wardId || ''}`, gb); } catch { /* ignore */ }
            }
          }
          setPortalGallery(nextGallery);
          _galleryCache = {
            snapshot: nextSnapshot || snapshot,
            team: nextTeam || team,
            portalConfig: nextConfig || portalConfig,
            portalGallery: nextGallery
          };
        })
        .catch(() => {
          if (live) setPortalGallery((prev) => prev || []);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    };

    loadAll();
    const watchdog = setTimeout(() => { if (live) setLoading(false); }, 8000);
    const onPortalUpdate = () => { _galleryCache = null; setLoading(true); loadAll(); };
    const onStorage = (e) => { if (e.key === 'ward_portal_updated') onPortalUpdate(); };
    window.addEventListener('ward:portal-updated', onPortalUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      live = false;
      clearTimeout(watchdog);
      window.removeEventListener('ward:portal-updated', onPortalUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const ward = snapshot?.ward || team?.ward || user?.ward || null;

  const galleryItems = useMemo(() => {
    const raw = Array.isArray(portalGallery) ? portalGallery : [];

    let base = raw.map(item => ({
      ...item,
      id: item.id || `work-${Math.random()}`,
      orderIndex: Number.isFinite(Number(item.orderIndex ?? item.order_index)) ? Number(item.orderIndex ?? item.order_index) : 999,
      type: item.type || item.mediaType || (item.videoUrl ? 'video' : 'image'),
      url: item.url || item.mediaUrl || (item.videoUrl ? '/gallery/road-construction.svg' : '/gallery/water-pipeline.svg'),
      videoUrl: item.videoUrl || null,
      duration: item.duration || '02:00',
      title: isMr && item.titleMr ? item.titleMr : (item.title || item.titleMr || 'विकास काम'),
      titleEn: item.title || item.titleEn || 'Civic Development Work',
      category: item.category || 'DEVELOPMENT',
      categoryLabel: isMr && item.categoryLabelMr ? item.categoryLabelMr : (item.categoryLabel || item.categoryLabelEn || item.category || 'विकास कामे'),
      categoryLabelEn: item.categoryLabel || item.categoryLabelEn || item.category || 'Development',
      dateFormatted: isMr && item.dateFormattedMr ? item.dateFormattedMr : (item.dateFormatted || item.date || ''),
      dateFormattedEn: item.dateFormatted || item.dateFormattedEn || item.date || '',
      badge: item.badge || (item.type === 'video' || item.videoUrl ? 'व्हिडीओ · VIDEO' : 'काम पूर्ण · COMPLETED'),
      description: isMr && item.descriptionMr ? item.descriptionMr : (item.description || item.descriptionMr || ''),
      descriptionEn: item.description || item.descriptionEn || item.descriptionMr || '',
      location: item.location || (ward?.wardNumber ? formatWardNumber(ward.wardNumber, isMr ? 'mr' : 'en') : ''),
    }));

    base.sort((a, b) => a.orderIndex - b.orderIndex);
    return base;
  }, [isMr, ward, portalGallery]);

  const filteredGallery = useMemo(() => {
    if (activeFilter === 'ALL') return galleryItems;
    if (activeFilter === 'VIDEOS') return galleryItems.filter(item => item.type === 'video' || !!item.videoUrl || (item.category || '').toUpperCase() === 'VIDEOS');
    return galleryItems.filter(item => (item.category || '').toUpperCase() === activeFilter);
  }, [galleryItems, activeFilter]);

  const activeLightboxItem = lightboxIndex !== null ? filteredGallery[lightboxIndex] : null;

  const handleKeyDown = useCallback((e) => {
    if (lightboxIndex === null) return;
    if (e.key === 'Escape') setLightboxIndex(null);
    if (e.key === 'ArrowRight') setLightboxIndex((prev) => (prev + 1) % filteredGallery.length);
    if (e.key === 'ArrowLeft') setLightboxIndex((prev) => (prev - 1 + filteredGallery.length) % filteredGallery.length);
  }, [lightboxIndex, filteredGallery.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading && portalGallery === null) {
    return (
      <div className="gallery-page-container" style={{ paddingTop: 48, textAlign: 'center' }}>
        <Loading />
        <p className="muted" style={{ marginTop: 12 }}>{isMr ? 'गॅलरी लोड होत आहे…' : 'Loading ward gallery…'}</p>
      </div>
    );
  }

  const liveGalleryBanner = portalConfig?.galleryBannerUrl || portalConfig?.meta?.galleryBannerUrl || '';
  const galleryBanner = (() => {
    let raw = '';
    if (liveGalleryBanner && !String(liveGalleryBanner).startsWith('data:')) raw = liveGalleryBanner;
    else {
      try {
        const v = localStorage.getItem(`ward_gallery_banner_${user?.wardId || ''}`);
        if (v && !String(v).startsWith('data:') && !isCampaignStockUrl(v)) raw = v;
      } catch { /* ignore */ }
    }
    return resolveCitizenHeroUrl(raw, { demoMode: Boolean(portalConfig?.demoMode), ward });
  })();

  return (
    <div className="gallery-page-container">
      <section className={`gallery-banner-hero ${galleryBanner ? 'has-banner' : ''}`}>
        {galleryBanner ? (
          <img
            className="gallery-banner-photo"
            src={galleryBanner}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
        <div className="gallery-banner-copy">
          <span className="user-kicker">{isMr ? 'विकास अहवाल व कार्य गॅलरी' : 'WORK & DEVELOPMENT GALLERY'}</span>
          <h1>{isMr ? 'प्रभाग विकास व उपक्रम गॅलरी' : 'Ward Development & Public Work Gallery'}</h1>
          <p>
            {isMr
              ? 'रस्ते, ड्रेनेज, पाणी पुरवठा, स्वच्छता, आरोग्य व सामाजिक विकास कामांचा सचित्र अहवाल'
              : 'Visual report of completed roads, drainage, water supply, health camps and civic initiatives'}
          </p>
        </div>
      </section>

      <div className="nagar-gallery-filters gallery-filters-below">
          {[
            { id: 'ALL', label: isMr ? 'सर्व उपक्रम' : 'All Works' },
            { id: 'VIDEOS', label: isMr ? 'व्हिडीओ' : 'Videos' },
            { id: 'LEADERSHIP', label: isMr ? 'लोकप्रतिनिधी' : 'Leadership' },
            { id: 'DEVELOPMENT', label: isMr ? 'विकास व रस्ते' : 'Infra & Roads' },
            { id: 'WATER', label: isMr ? 'पाणी व स्वच्छता' : 'Water & Sanitation' },
            { id: 'HEALTH', label: isMr ? 'आरोग्य शिबीर' : 'Health Camps' },
            { id: 'SOCIAL', label: isMr ? 'पर्यावरण व सामाजिक' : 'Social & Green' },
          ].map((cat) => {
            const active = activeFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`nagar-filter-pill ${active ? 'active' : ''}`}
                onClick={() => setActiveFilter(cat.id)}
              >
                {cat.label}
              </button>
            );
          })}
      </div>

      {/* Gallery Cards Grid */}
      <section className="user-panel-card nagar-gallery-card" style={{ marginTop: '20px' }}>
        {filteredGallery.length === 0 ? (
          <div className="nagar-gallery-empty">
            <span className="nagar-empty-icon">🖼️</span>
            <p>{isMr ? 'या प्रकारामध्ये सध्या कोणतीही छायाचित्रे उपलब्ध नाहीत.' : 'No photos found in this category.'}</p>
          </div>
        ) : (
          <div className="nagar-gallery-grid">
            {filteredGallery.map((item, index) => {
              const catClass = (item.category || '').toLowerCase();
              return (
                <div
                  key={item.id || index}
                  className="nagar-gallery-item"
                  onClick={() => setLightboxIndex(index)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setLightboxIndex(index);
                  }}
                  title={isMr ? 'मोठा फोटो पहा' : 'Click to view full photo'}
                >
                  <div className="nagar-gallery-img-wrapper">
                    <img src={item.url} alt={item.title} className="nagar-gallery-img" loading="lazy" />
                    {(item.type === 'video' || item.videoUrl) && (
                      <div className="nagar-gallery-video-play-btn" aria-label="Play video">
                        <span className="nagar-play-icon">▶</span>
                      </div>
                    )}
                    <div className="nagar-gallery-hover-overlay">
                      <span className="nagar-zoom-btn">{(item.type === 'video' || item.videoUrl) ? '▶' : '⤢'}</span>
                      <span className="nagar-hover-text">{(item.type === 'video' || item.videoUrl) ? (isMr ? 'व्हिडीओ पहा' : 'Play Video') : (isMr ? 'फोटो पहा' : 'View Photo')}</span>
                    </div>

                    <div className="nagar-gallery-top-tags">
                      <span className={`nagar-cat-chip cat-${catClass}`}>
                        {(item.type === 'video' || item.videoUrl) ? '🎬 ' : ''}
                        {isMr ? (item.categoryLabel || item.category) : (item.categoryLabelEn || item.category)}
                      </span>
                      {item.duration && <span className="nagar-duration-chip">⏱️ {item.duration}</span>}
                      {item.badge && <span className="nagar-badge-chip">{item.badge}</span>}
                    </div>
                  </div>

                  <div className="nagar-gallery-caption">
                    <div className="nagar-caption-meta">
                      <span className="nagar-date-tag">🗓 {isMr ? (item.dateFormatted || item.date) : (item.dateFormattedEn || item.date)}</span>
                      {item.location && <span className="nagar-location-tag">📍 {item.location}</span>}
                    </div>
                    <h3 className="nagar-caption-title">{isMr ? item.title : (item.titleEn || item.title)}</h3>
                    {item.description && <p className="nagar-caption-desc">{item.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lightbox Modal */}
      {activeLightboxItem && (
        <div
          className="nagar-lightbox-backdrop"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="nagar-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Toolbar */}
            <div className="nagar-lightbox-topbar">
              <div className="nagar-lightbox-tag-group">
                <span className="nagar-cat-chip">
                  {isMr ? (activeLightboxItem.categoryLabel || activeLightboxItem.category) : (activeLightboxItem.categoryLabelEn || activeLightboxItem.category)}
                </span>
                {activeLightboxItem.badge && (
                  <span className="nagar-badge-chip">{activeLightboxItem.badge}</span>
                )}
              </div>

              <div className="nagar-lightbox-actions">
                <span className="nagar-lightbox-counter">
                  {lightboxIndex + 1} / {filteredGallery.length}
                </span>
                <button
                  type="button"
                  className="nagar-lightbox-close"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Main Image Stage */}
            <div className="nagar-lightbox-stage">
              <button
                type="button"
                className="nagar-lightbox-nav prev"
                onClick={() => setLightboxIndex((prev) => (prev - 1 + filteredGallery.length) % filteredGallery.length)}
                aria-label="Previous"
              >
                ‹
              </button>

              <div className="nagar-lightbox-img-frame">
                {(activeLightboxItem.type === 'video' || activeLightboxItem.videoUrl) ? (
                  <video
                    src={activeLightboxItem.videoUrl}
                    poster={activeLightboxItem.url}
                    controls
                    autoPlay
                    playsInline
                    className="nagar-lightbox-full-img nagar-lightbox-video-player"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                ) : (
                  <img
                    src={activeLightboxItem.url}
                    alt={activeLightboxItem.title}
                    className="nagar-lightbox-full-img"
                  />
                )}
              </div>

              <button
                type="button"
                className="nagar-lightbox-nav next"
                onClick={() => setLightboxIndex((prev) => (prev + 1) % filteredGallery.length)}
                aria-label="Next"
              >
                ›
              </button>
            </div>

            {/* Bottom Caption & Share Bar */}
            <div className="nagar-lightbox-bottombar">
              <div className="nagar-lightbox-caption-text">
                <div className="nagar-lightbox-meta-row">
                  <span className="nagar-date-tag">🗓 {isMr ? (activeLightboxItem.dateFormatted || activeLightboxItem.date) : (activeLightboxItem.dateFormattedEn || activeLightboxItem.date)}</span>
                  {activeLightboxItem.location && <span className="nagar-location-tag">📍 {activeLightboxItem.location}</span>}
                </div>
                <h3>{isMr ? activeLightboxItem.title : (activeLightboxItem.titleEn || activeLightboxItem.title)}</h3>
                {activeLightboxItem.description && <p>{activeLightboxItem.description}</p>}
              </div>

              <div className="nagar-lightbox-share">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `${activeLightboxItem.title} - प्रभाग विकास अहवाल\n${activeLightboxItem.description}\nतपशील पहा: ${window.location.origin}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nagar-share-wa-btn"
                >
                  <span>💬</span> {isMr ? 'व्हॉट्सॲपवर शेअर करा' : 'Share on WhatsApp'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
