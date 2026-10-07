import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../services/api';
import { Loading, FaceAvatar } from '../components/Ui';
import BrandIcon from '../components/BrandIcon';
import NagarsevakShowcase from '../components/NagarsevakShowcase';
import { CIVIC_DEFAULT_HERO, isGenericDefaultHero, resolveCitizenHeroUrl, withHeroCacheBust } from '../utils/portalDefaults';
import { formatWardLabel, formatWardNumber } from '../wardFormat';

function typeLabel(v, mr) {
  return mr ? (v === 'EVENT' ? 'कार्यक्रम' : 'वॉर्ड अपडेट') : (v === 'EVENT' ? 'Event' : 'Ward update');
}
function fmt(v) {
  return v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

let _userPanelCache = null;

function readCachedHero(wardId) {
  if (!wardId) return '';
  try {
    const raw = String(localStorage.getItem(`ward_hero_banner_${wardId}`) || '').trim();
    if (!raw || raw.startsWith('data:') || isGenericDefaultHero(raw)) return '';
    return raw;
  } catch {
    return '';
  }
}

function writeCachedHero(wardId, url) {
  if (!wardId || !url || String(url).startsWith('data:') || isGenericDefaultHero(url)) return;
  try { localStorage.setItem(`ward_hero_banner_${wardId}`, url); } catch { /* ignore */ }
}

function uniqueIds(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((id) => {
    const s = String(id || '');
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

function splitHeroSubtitle(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const oneSecure = s.search(/\sOne secure\b/i);
  if (oneSecure > 0) return [s.slice(0, oneSecure).trim(), s.slice(oneSecure).trim()];
  const ek = s.search(/\sएका सुरक्षित\b/);
  if (ek > 0) return [s.slice(0, ek).trim(), s.slice(ek).trim()];
  const dotted = s.match(/^(.*?[.।])\s+(.+)$/);
  if (dotted && dotted[2].length > 12) return [dotted[1].trim(), dotted[2].trim()];
  return [s];
}

function heroHeadline(title, fullName, welcomeWord) {
  const n = String(fullName || '').trim().split(/\s+/)[0] || (welcomeWord === 'स्वागत आहे' ? 'नागरिक' : 'Citizen');
  const raw = String(title || '').trim();
  if (!raw) return `${welcomeWord}, ${n}`;
  if (raw.includes('{name}')) return raw.replaceAll('{name}', n).replace(/\s+,/g, ',').replace(/,\s*$/, '');
  if (/^welcome\.?$/i.test(raw) || raw === 'स्वागत आहे' || raw === 'Welcome') return `${welcomeWord}, ${n}`;
  if (raw.toLowerCase().includes(String(n).toLowerCase())) return raw;
  return `${raw.replace(/[.,]+$/, '')}, ${n}`;
}

export default function UserPanel({ plainMode = false } = {}) {
  const navigate = useNavigate();
  const user = getUser();
  const mr = (localStorage.getItem('ward_language') || 'en') === 'mr';
  const [language] = useState(mr ? 'mr' : 'en');
  const [updates, setUpdates] = useState(() => _userPanelCache?.updates ?? null);
  const [updateTotal, setUpdateTotal] = useState(() => _userPanelCache?.updateTotal ?? null);
  const [schemes, setSchemes] = useState(() => _userPanelCache?.schemes ?? null);
  const [messages, setMessages] = useState(() => _userPanelCache?.messages ?? null);
  const [complaints, setComplaints] = useState(() => _userPanelCache?.complaints ?? null);
  const [complaintTotal, setComplaintTotal] = useState(() => _userPanelCache?.complaintTotal ?? null);
  const [team, setTeam] = useState(() => _userPanelCache?.team ?? null);
  const [snapshot, setSnapshot] = useState(() => _userPanelCache?.snapshot ?? null);
  const [portalConfig, setPortalConfig] = useState(() => _userPanelCache?.portalConfig ?? null);
  const [shownHero, setShownHero] = useState(() => {
    const cachedCfg = _userPanelCache?.portalConfig;
    if (cachedCfg) {
      return resolveCitizenHeroUrl(cachedCfg.heroBannerUrl, { demoMode: Boolean(cachedCfg.demoMode) });
    }
    const qWard = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('wardId')
      : null;
    return readCachedHero(qWard || getUser()?.wardId);
  });
  const [portalGallery, setPortalGallery] = useState(() => _userPanelCache?.portalGallery ?? null);
  const [targetWard, setTargetWard] = useState(null);
  const [targetNagarsevak, setTargetNagarsevak] = useState(null);
  const [portalNagarsevaks, setPortalNagarsevaks] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isPlainFromUrl = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/citizen-default') ||
    window.location.pathname === '/plain' ||
    searchParams.get('plain') === '1' ||
    searchParams.get('plain') === 'true' ||
    searchParams.get('mode') === 'plain'
  );
  const isPlain = Boolean(plainMode || isPlainFromUrl);
  const queryWardId = searchParams.get('wardId') || null;
  const citizenWardId = queryWardId || user?.wardId || null;
  if (citizenWardId && _userPanelCache?.wardId && _userPanelCache.wardId !== citizenWardId) _userPanelCache = null;
  const ward = targetWard || user?.ward;
  const unread = useMemo(() => (Array.isArray(messages) ? messages.filter(n => n.direction !== 'SENT' && !n.isRead).length : 0), [messages]);

  const text = language === 'mr' ? {
    home: 'मुख्यपृष्ठ', updates: 'वॉर्ड अपडेट्स', schemes: 'योजना', messages: 'संदेश', complaints: 'माझ्या तक्रारी', welcome: 'स्वागत आहे',
    desc: 'तुमच्या वॉर्डमधील अपडेट्स, कार्यक्रम, योजना आणि तक्रारींची माहिती एका ठिकाणी.', ward: 'तुमचा वॉर्ड', team: 'तुमचा वॉर्ड टीम',
    nagarsevak: 'नगरसेवक', employees: 'कर्मचारी', latest: 'ताजे अपडेट्स', benefits: 'तुमच्यासाठी योजना', noUpdates: 'अजून अपडेट नाहीत',
    account: 'माझे खाते', statUpdates: 'वॉर्ड अपडेट्स', statComplaints: 'तक्रारी', statSchemes: 'योजना', statMessages: 'संदेश',
    publishedUpdates: 'प्रकाशित अपडेट्स', myComplaints: 'माझ्या तक्रारी', publishedSchemes: 'प्रकाशित योजना', unreadMessages: 'न वाचलेले संदेश',
    profile: 'प्रोफाइल', logout: 'बाहेर पडा'
  } : {
    home: 'Home', updates: 'Updates & Events', schemes: 'Schemes', messages: 'Messages', complaints: 'My Complaints', welcome: 'Welcome',
    desc: 'WardDesk is your digital ward desk for complaints, schemes and notices. One secure account keeps you connected to your local ward office.',
    ward: 'Your Ward', team: 'Your Ward Team', nagarsevak: 'Nagarsevak', employees: 'Employees', latest: 'Latest from your ward',
    benefits: 'Schemes for you', noUpdates: 'No updates yet', account: 'My Account', statUpdates: 'WARD UPDATES', statComplaints: 'COMPLAINTS',
    statSchemes: 'SCHEMES', statMessages: 'MESSAGES', publishedUpdates: 'Published updates', myComplaints: 'My complaints',
    publishedSchemes: 'Published schemes', unreadMessages: 'Unread messages', profile: 'My profile', logout: 'Sign out'
  };

  const load = async () => {
    setError('');
    const results = await Promise.allSettled([
      api.wardUpdates({ page: 1, limit: 5, status: 'PUBLISHED', ...(citizenWardId ? { wardId: citizenWardId } : {}) }),
      api.schemes({ status: 'PUBLISHED', ...(citizenWardId ? { wardId: citizenWardId } : {}) }),
      api.complaints({ page: 1, limit: 8 }),
      api.wardTeam(citizenWardId),
      queryWardId ? Promise.resolve({ data: null }) : api.myWard(),
      api.portalConfig(citizenWardId ? { wardId: citizenWardId } : {}),
      api.galleryItems({ status: 'PUBLISHED', ...(citizenWardId ? { wardId: citizenWardId } : {}) })
    ]);
    const [u, s, c, t, w, pc, pg] = results;
    let nextUpdates = null, nextUpdateTotal = 0, nextSchemes = null, nextMessages = Array.isArray(messages) ? messages : [], nextComplaints = null, nextComplaintTotal = 0, nextTeam = null, nextSnapshot = null;
    let nextPortalConfig = null, nextPortalGallery = null;

    if (u.status === 'fulfilled') {
      nextUpdates = u.value?.data || [];
      nextUpdateTotal = Number.isFinite(Number(u.value?.meta?.total)) ? Number(u.value.meta.total) : (u.value?.data || []).length;
      setUpdates(nextUpdates);
      setUpdateTotal(nextUpdateTotal);
    } else {
      nextUpdates = [];
      nextUpdateTotal = 0;
      setUpdates([]);
      setUpdateTotal(0);
    }
    if (s.status === 'fulfilled') {
      nextSchemes = (s.value?.data || []).slice(0, 4);
      setSchemes(nextSchemes);
    } else {
      nextSchemes = [];
      setSchemes([]);
    }

    if (c.status === 'fulfilled') {
      nextComplaints = c.value?.data || [];
      nextComplaintTotal = Number.isFinite(Number(c.value?.meta?.total)) ? Number(c.value.meta.total) : (c.value?.data || []).length;
      setComplaints(nextComplaints);
      setComplaintTotal(nextComplaintTotal);
    } else {
      nextComplaints = [];
      nextComplaintTotal = 0;
      setComplaints([]);
      setComplaintTotal(0);
    }
    if (t.status === 'fulfilled') {
      nextTeam = t.value?.data || null;
      setTeam(nextTeam);
    } else {
      setTeam(null);
    }
    if (w.status === 'fulfilled') {
      nextSnapshot = w.value?.data || null;
      setSnapshot(nextSnapshot);
    }
    if (pc.status === 'fulfilled' && pc.value?.data) {
      const pcData = pc.value.data;
      nextPortalConfig = pcData.config || pcData;
      setPortalConfig(nextPortalConfig);
      if (pcData.ward) {
        setTargetWard(pcData.ward);
      }
      const purchased = (Array.isArray(pcData.purchasedNagarsevaks) ? pcData.purchasedNagarsevaks : [])
        .filter((n) => n && n.id && !n.isDemo);
      const liveNagar = (pcData.nagarsevak && !pcData.nagarsevak.isDemo) ? pcData.nagarsevak : (purchased[0] || null);
      setPortalNagarsevaks(purchased.length ? purchased : (liveNagar ? [liveNagar] : []));
      setTargetNagarsevak(liveNagar);
      writeCachedHero(citizenWardId, resolveCitizenHeroUrl(nextPortalConfig?.heroBannerUrl, { demoMode: Boolean(nextPortalConfig?.demoMode) }));
    }
    if (pg.status === 'fulfilled' && Array.isArray(pg.value?.data)) {
      nextPortalGallery = pg.value.data;
      setPortalGallery(nextPortalGallery);
    }

    _userPanelCache = {
      wardId: citizenWardId,
      updates: nextUpdates,
      updateTotal: nextUpdateTotal,
      schemes: nextSchemes,
      messages: nextMessages,
      complaints: nextComplaints,
      complaintTotal: nextComplaintTotal,
      team: nextTeam,
      snapshot: nextSnapshot,
      portalConfig: nextPortalConfig || _userPanelCache?.portalConfig,
      portalGallery: Array.isArray(nextPortalGallery) ? nextPortalGallery : (_userPanelCache?.portalGallery || null)
    };

    const failed = results.find(x => x.status === 'rejected');
    if (failed) setError(failed.reason?.message || 'Some ward information could not be loaded.');
  };

  const loadLive = async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const c = await api.complaints({ page: 1, limit: 8 });
      const nextComplaints = c.data || [];
      setComplaints(nextComplaints);
      setComplaintTotal(Number.isFinite(Number(c.meta?.total)) ? Number(c.meta.total) : nextComplaints.length);
    } catch {
      /* keep last loaded complaints */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(loadLive, 90000);
    const onVis = () => { if (document.visibilityState === 'visible') loadLive(); };
    const onPortalUpdate = () => { _userPanelCache = null; load(); };
    const onStorage = (e) => {
      if (e.key === 'ward_portal_updated') onPortalUpdate();
    };
    window.addEventListener('ward:portal-updated', onPortalUpdate);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      window.removeEventListener('ward:portal-updated', onPortalUpdate);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const go = p => navigate(p);

  const cachedHero = readCachedHero(citizenWardId);
  const liveHero = portalConfig
    ? resolveCitizenHeroUrl(portalConfig.heroBannerUrl, { demoMode: Boolean(portalConfig.demoMode) })
    : '';
  const heroBanner = liveHero || cachedHero || shownHero || '';
  const heroSrc = heroBanner
    ? withHeroCacheBust(
      heroBanner,
      portalConfig?.updatedAt || (typeof localStorage !== 'undefined' ? localStorage.getItem('ward_portal_updated') : '')
    )
    : '';

  useEffect(() => {
    if (!heroSrc) return;
    if (heroSrc === shownHero) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setShownHero(heroSrc); };
    img.onerror = () => { if (!cancelled && cachedHero) setShownHero(cachedHero); };
    img.src = heroSrc;
    return () => { cancelled = true; };
  }, [heroSrc, shownHero, cachedHero]);

  const nagarsevaksList = useMemo(() => {
    if (portalNagarsevaks.length) return portalNagarsevaks.filter((n) => n && n.id && !n.employeeProfile);
    if (targetNagarsevak?.id) return [targetNagarsevak];
    return [];
  }, [targetNagarsevak, portalNagarsevaks]);
  const activeNagar = nagarsevaksList[0] || snapshot?.nagarsevak || null;

  const featuredGallery = useMemo(() => {
    if (!Array.isArray(portalGallery)) return [];
    const dashOrder = uniqueIds(
      (Array.isArray(portalConfig?.dashboardWorkOrder) && portalConfig.dashboardWorkOrder.length
        ? portalConfig.dashboardWorkOrder
        : portalConfig?.meta?.dashboardWorkOrder)
    );
    return portalGallery
      .filter((item) => {
        const v = item?.showOnDashboard ?? item?.show_on_dashboard;
        if (v === true || v === 1 || v === '1' || v === 'true') return true;
        if (v && typeof v === 'object' && (v.data?.[0] === 1 || v[0] === 1)) return true;
        if (dashOrder.includes(String(item.id))) return true;
        return false;
      })
      .sort((a, b) => {
        const ia = dashOrder.indexOf(String(a.id));
        const ib = dashOrder.indexOf(String(b.id));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        const ha = Number(a.homeOrderIndex);
        const hb = Number(b.homeOrderIndex);
        if (Number.isFinite(ha) && Number.isFinite(hb) && ha !== hb) return ha - hb;
        return Number(a.orderIndex ?? a.order_index ?? 0) - Number(b.orderIndex ?? b.order_index ?? 0);
      });
  }, [portalGallery, portalConfig]);

  return (
    <>
      {error && (
        <div className="user-error">
          <span>{error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}
      {toast && (
        <div className={`global-toast ${toast.type === 'error' ? 'global-toast-error' : 'global-toast-success'}`} role="status">
          <div>
            <strong>{toast.title || 'Update'}</strong>
            <div>{toast.message}</div>
          </div>
          <button type="button" onClick={() => setToast(null)} aria-label="Close">×</button>
        </div>
      )}

      {isPlain ? (
        <>
          {/* Classic Municipal Clean Hero */}
          <section className="user-hero is-civic-plain">
            <div className="user-hero-copy">
              <span className="user-kicker">{language === 'mr' ? 'स्वागत आहे · डिजिटल प्रभाग' : 'WELCOME · DIGITAL WARD DESK'}</span>
              <h1>{heroHeadline('', user?.name, text.welcome)}</h1>
              <p>{text.desc}</p>
              <div className="user-ward-chip">
                <span className="user-ward-icon">⌖</span>
                <div>
                  <small>{text.ward.toUpperCase()}</small>
                  <strong>{formatWardLabel(ward || snapshot?.ward, 'Ward')}</strong>
                </div>
              </div>
              <div className="user-hero-actions">
                <button type="button" className="primary-btn" onClick={() => go('/my-complaints')}>
                  {language === 'mr' ? 'तक्रार नोंदवा' : 'Raise a complaint'}
                </button>
                <button type="button" className="ghost-btn" onClick={() => go('/ward-updates')}>
                  {language === 'mr' ? 'अपडेट्स पहा' : 'View updates'}
                </button>
              </div>
            </div>
            <div className="user-hero-card">
              <div className="user-hero-icon">
                <BrandIcon size={34} variant="light" />
              </div>
              <div>
                <strong>{language === 'mr' ? 'तुमच्या वॉर्डची सर्व माहिती' : 'Everything for your ward'}</strong>
                <span>{language === 'mr' ? 'नोंदणीकृत वॉर्ड खात्यातून अपडेट्स, योजना आणि तक्रारी ट्रॅक करा.' : 'Updates, schemes and complaint tracking in one secure account.'}</span>
              </div>
            </div>
          </section>

          {/* 4 Stat Cards */}
          <section className="user-stat-grid">
            <button onClick={() => go('/ward-updates')} className="user-stat-card">
              <span className="user-stat-icon">◈</span>
              <div>
                <small>{text.statUpdates}</small>
                <strong>{updateTotal === null ? '—' : updateTotal}</strong>
                <span>{text.publishedUpdates}</span>
              </div>
            </button>
            <button onClick={() => go('/my-complaints')} className="user-stat-card">
              <span className="user-stat-icon">⚑</span>
              <div>
                <small>{text.statComplaints}</small>
                <strong>{complaintTotal === null ? '—' : complaintTotal}</strong>
                <span>{text.myComplaints}</span>
              </div>
            </button>
            <button onClick={() => go('/schemes')} className="user-stat-card">
              <span className="user-stat-icon">◇</span>
              <div>
                <small>{text.statSchemes}</small>
                <strong>{schemes === null ? '—' : schemes.length}</strong>
                <span>{text.publishedSchemes}</span>
              </div>
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('ward:open-notifications'))} className="user-stat-card">
              <span className="user-stat-icon">🔔</span>
              <div>
                <small>{language === 'mr' ? 'सूचना' : 'NOTIFICATIONS'}</small>
                <strong>{unread}</strong>
                <span>{language === 'mr' ? 'न वाचलेल्या सूचना' : 'Unread notifications'}</span>
              </div>
            </button>
          </section>
        </>
      ) : (
        <>
          {/* Custom Ward Hero Section */}
          <section
            className={`user-hero ${shownHero || heroSrc ? 'has-portal-banner' : 'is-hero-loading'} ${portalConfig?.demoMode ? 'is-civic-hero' : 'has-custom-hero'}`}
            style={(shownHero || heroSrc) ? { '--portal-hero-bg': `url("${String(shownHero || heroSrc).replace(/"/g, '')}")` } : undefined}
          >
            <div className="user-hero-media" aria-hidden="true">
              {(shownHero || heroSrc) ? (
                <img
                  className="user-hero-bg-photo"
                  src={shownHero || heroSrc}
                  alt=""
                  onError={(e) => {
                    if (cachedHero && e.currentTarget.src !== cachedHero) {
                      e.currentTarget.src = cachedHero;
                      return;
                    }
                    if (portalConfig?.demoMode) e.currentTarget.src = CIVIC_DEFAULT_HERO;
                  }}
                />
              ) : null}
            </div>
            <div className="user-hero-ambient-live" aria-hidden="true">
              <div className="live-orb-1" />
              <div className="live-orb-2" />
              <div className="live-shimmer-sweep" />
            </div>
            <div className="user-hero-copy">
              <h1>
                {heroHeadline(
                  language === 'mr' ? portalConfig?.heroTitleMr : portalConfig?.heroTitleEn,
                  user?.name,
                  text.welcome
                )}
              </h1>
              <p className="user-hero-subtitle">
                {splitHeroSubtitle(
                  language === 'mr'
                    ? (portalConfig?.heroSubtitleMr || text.desc)
                    : (portalConfig?.heroSubtitleEn || text.desc)
                ).map((line) => (
                  <span key={line} className="user-hero-subline">{line}</span>
                ))}
              </p>
              <div className="user-ward-chip compact">
                <span className="user-ward-icon">⌖</span>
                <div>
                  <small>{text.ward.toUpperCase()}</small>
                  <strong>{formatWardLabel(ward, 'Ward')}</strong>
                </div>
              </div>
              <div className="user-hero-actions">
                <button type="button" className="primary-btn" onClick={() => go(portalConfig?.ctaPrimaryLink || '/my-complaints')}>
                  {language === 'mr' ? (portalConfig?.ctaPrimaryTextMr || 'तक्रार नोंदवा') : (portalConfig?.ctaPrimaryTextEn || 'Raise a complaint')}
                </button>
                <button type="button" className="ghost-btn" onClick={() => go(portalConfig?.ctaSecondaryLink || '/gallery')}>
                  {language === 'mr' ? (portalConfig?.ctaSecondaryTextMr || 'विकास कामे पहा') : (portalConfig?.ctaSecondaryTextEn || 'View Work')}
                </button>
              </div>
            </div>
          </section>

          {/* Nagarsevak Showcase Card with Development Works Gallery Preview */}
          <NagarsevakShowcase
            nagarsevaks={nagarsevaksList}
            ward={ward || snapshot?.ward || team?.ward}
            language={language}
            showGallery={portalConfig?.showGalleryPreview !== false}
            minimalWork={true}
            minimalCount={Math.max(featuredGallery.length, 1)}
            portalGallery={featuredGallery}
            portalConfig={portalConfig}
            onOpenGallery={() => go('/gallery')}
          />
        </>
      )}

      {/* Ward Updates & Schemes Grid */}
      <section className="user-content-grid">
        <div className="user-panel-card user-updates-panel">
          <div className="user-section-head">
            <div>
              <span className="user-kicker">{text.latest.toUpperCase()}</span>
              <h2>{text.latest}</h2>
              <p>{language === 'mr' ? `${formatWardNumber(ward?.wardNumber, 'mr') || 'तुमच्या वॉर्ड'} साठी प्रकाशित माहिती` : `Published for residents of ${formatWardNumber(ward?.wardNumber) || 'your ward'}`}</p>
            </div>
            <button onClick={() => go('/ward-updates')} className="user-text-btn">
              {language === 'mr' ? 'सर्व पहा →' : 'View all →'}
            </button>
          </div>
          {updates === null ? (
            <Loading />
          ) : !updates.length ? (
            <div className="user-empty">
              <div>◌</div>
              <strong>{text.noUpdates}</strong>
              <span>{language === 'mr' ? 'तुमच्या वॉर्ड टीमने अजून नवीन अपडेट किंवा कार्यक्रम प्रकाशित केलेला नाही.' : 'Your ward team has not published a new update or event.'}</span>
            </div>
          ) : (
            <div className="user-update-list">
              {updates.map(x => (
                <button key={x.id} className="user-update-item" onClick={() => go('/ward-updates')}>
                  <div className={`user-type-icon ${x.type === 'EVENT' ? 'event' : ''}`}>
                    {x.type === 'EVENT' ? '★' : '◈'}
                  </div>
                  <div className="user-update-body">
                    <div className="user-item-top">
                      <span>{typeLabel(x.type, language === 'mr')}</span>
                      {x.eventDate && <time>{fmt(x.eventDate)}</time>}
                    </div>
                    <h3>{x.title}</h3>
                    <p>{x.message}</p>
                    <small>{x.location ? `${x.location} · ` : ''}{fmt(x.publishedAt || x.createdAt)}</small>
                  </div>
                  <span className="user-item-arrow">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="user-side-stack">
          <div className="user-panel-card user-schemes-panel">
            <div className="user-section-head">
              <div>
                <span className="user-kicker">{text.benefits.toUpperCase()}</span>
                <h2>{text.benefits}</h2>
                <p>{language === 'mr' ? 'शासकीय व स्थानिक योजनांचा लाभ' : 'Government & civic benefits for residents'}</p>
              </div>
              <button onClick={() => go('/schemes')} className="user-text-btn">
                {language === 'mr' ? 'सर्व पहा →' : 'View all →'}
              </button>
            </div>
            {schemes === null ? (
              <Loading />
            ) : !schemes.length ? (
              <div className="user-mini-empty">
                {language === 'mr' ? 'सध्या कोणतीही योजना उपलब्ध नाही.' : 'No published schemes are available right now.'}
              </div>
            ) : (
              <div className="user-scheme-list">
                {schemes.map(s => (
                  <button key={s.id} onClick={() => go('/schemes')} className="user-scheme-item">
                    <span className="scheme-mini-icon">◇</span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>{s.audience || 'Eligible residents'} · {formatWardNumber(s.ward?.wardNumber || ward?.wardNumber) || 'Your ward'}</small>
                    </div>
                    <span>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}
