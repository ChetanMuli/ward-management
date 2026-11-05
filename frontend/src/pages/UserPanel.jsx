import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../services/api';
import { Loading, FaceAvatar } from '../components/Ui';
import BrandIcon from '../components/BrandIcon';
import NagarsevakShowcase from '../components/NagarsevakShowcase';
import { CIVIC_DEFAULT_HERO, isGenericDefaultHero, publicMediaUrl, resolveCitizenHeroUrl, sameHeroUrl, withHeroCacheBust } from '../utils/portalDefaults';
import { citizenPortalQuery, getSavedPanelId, savePanelId, assignedToPanel, selectPanelWorks } from '../utils/panelChoice';
import { formatWardLabel, formatWardNumber } from '../wardFormat';

function typeLabel(v, mr) {
  return mr ? (v === 'EVENT' ? 'कार्यक्रम' : 'वॉर्ड अपडेट') : (v === 'EVENT' ? 'Event' : 'Ward update');
}
function hospitalTypeLabel(v, mr) {
  const map = {
    GOVERNMENT: { en: 'Government', mr: 'शासकीय' },
    PRIVATE: { en: 'Private', mr: 'खासगी' },
    TRUST: { en: 'Trust', mr: 'ट्रस्ट' },
    CLINIC: { en: 'Clinic', mr: 'क्लिनिक' },
    PHC: { en: 'PHC / UHC', mr: 'प्राथमिक आरोग्य केंद्र' },
    AYUSH: { en: 'AYUSH', mr: 'आयुष' },
    OTHER: { en: 'Health', mr: 'आरोग्य' },
  };
  const hit = map[String(v || '').toUpperCase()];
  if (!hit) return mr ? 'आरोग्य' : 'Health';
  return mr ? hit.mr : hit.en;
}
function medicalTypeLabel(v, mr) {
  const map = {
    ALLOPATHIC: { en: 'Chemist', mr: 'केमिस्ट' },
    GENERIC: { en: 'Generic', mr: 'जनऔषधी' },
    AYURVEDIC: { en: 'Ayurvedic', mr: 'आयुर्वेदिक' },
    HOMOEOPATHIC: { en: 'Homoeopathic', mr: 'होमियोपॅथिक' },
    WHOLESALE_RETAIL: { en: 'Retail', mr: 'रिटेल' },
    OTHER: { en: 'Medical', mr: 'मेडिकल' },
  };
  const hit = map[String(v || '').toUpperCase()];
  if (!hit) return mr ? 'औषधे' : 'Pharmacy';
  return mr ? hit.mr : hit.en;
}
function translateMedicalName(name, mr) {
  if (!mr || !name) return name;
  const map = {
    'Mauli 24x7 Chemist & Druggist': 'माऊली २४x७ केमिस्ट आणि औषधे',
    'PM Jan Aushadhi Medical Store': 'प्रधानमंत्री जनऔषधी केंद्र व मेडिकल',
    'Apollo Pharmacy & Wellness': 'अपोलो फार्मसी आणि वेलनेस',
    'Sanjeevani Ayurvedic & Herbal Store': 'संजीवनी आयुर्वेदिक व हर्बल'
  };
  return map[name] || name;
}
function fmt(v) {
  return v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

let _userPanelCache = null;
const _stickyHeroByWard = Object.create(null);

function stickyKey(wardId, panelId) {
  return `ward_hero_sticky_${String(wardId || '')}_${String(panelId || 'none')}`;
}

function readStickyHero(wardId, panelId) {
  const id = stickyKey(wardId, panelId);
  if (_stickyHeroByWard[id]) return _stickyHeroByWard[id];
  try {
    const stored = String(sessionStorage.getItem(id) || '').trim();
    if (stored && !stored.startsWith('data:')) {
      _stickyHeroByWard[id] = publicMediaUrl(stored);
      return _stickyHeroByWard[id];
    }
  } catch { /* ignore */ }
  return '';
}

function commitHero(wardId, panelId, url) {
  const next = publicMediaUrl(String(url || '').trim().split('?')[0]);
  if (!next || next.startsWith('data:')) return '';
  const id = stickyKey(wardId, panelId);
  _stickyHeroByWard[id] = next;
  try { sessionStorage.setItem(id, next); } catch { /* ignore */ }
  return next;
}

function preloadHero(url) {
  const src = publicMediaUrl(String(url || '').trim());
  if (!src) return Promise.resolve('');
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    img.onload = () => finish(src);
    img.onerror = () => finish('');
    img.src = src;
    if (img.complete && img.naturalWidth) finish(src);
  });
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

function heroLedeLines(raw) {
  const s = String(raw || '').trim();
  if (!s) return ['', ''];
  const oneSecure = s.search(/\sOne secure\b/i);
  if (oneSecure > 0) return [s.slice(0, oneSecure).trim(), s.slice(oneSecure).trim()];
  const mrSecond = s.search(/\s(एक सुरक्षित|एका खात्यातून)\b/);
  if (mrSecond > 0) return [s.slice(0, mrSecond).trim(), s.slice(mrSecond).trim()];
  return [s, ''];
}

function HeroLede({ text }) {
  const [first, second] = heroLedeLines(text);
  return (
    <p className="user-hero-lede">
      <span className="user-hero-lede-line">{first}</span>
      {second ? <span className="user-hero-lede-line">{second}</span> : null}
    </p>
  );
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
    const qWard = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('wardId')
      : null;
    return readStickyHero(qWard || getUser()?.wardId, getSavedPanelId(qWard || getUser()?.wardId));
  });
  const [portalGallery, setPortalGallery] = useState(() => _userPanelCache?.portalGallery ?? null);
  const [hospitals, setHospitals] = useState(() => _userPanelCache?.hospitals ?? null);
  const [medicals, setMedicals] = useState(() => _userPanelCache?.medicals ?? null);
  const [healthFilter, setHealthFilter] = useState('ALL');
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
  const panelId = getSavedPanelId(citizenWardId);
  if (
    citizenWardId
    && _userPanelCache
    && (_userPanelCache.wardId !== citizenWardId || String(_userPanelCache.panelId || '') !== String(panelId || ''))
  ) {
    _userPanelCache = null;
  }
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
    desc: 'WardSetu is your digital ward desk for complaints, schemes and notices. One secure account keeps you connected to your local ward office.',
    ward: 'Your Ward', team: 'Your Ward Team', nagarsevak: 'Nagarsevak', employees: 'Employees', latest: 'Latest from your ward',
    benefits: 'Schemes for you', noUpdates: 'No updates yet', account: 'My Account', statUpdates: 'WARD UPDATES', statComplaints: 'COMPLAINTS',
    statSchemes: 'SCHEMES', statMessages: 'MESSAGES', publishedUpdates: 'Published updates', myComplaints: 'My complaints',
    publishedSchemes: 'Published schemes', unreadMessages: 'Unread messages', profile: 'My profile', logout: 'Sign out'
  };

  const shownHeroRef = useRef(shownHero);
  shownHeroRef.current = shownHero;

  const applyLiveHero = async (bannerUrl, { demoMode = false } = {}) => {
    const livePanel = getSavedPanelId(citizenWardId);
    if (!bannerUrl || isGenericDefaultHero(bannerUrl)) {
      setShownHero(commitHero(citizenWardId, livePanel, CIVIC_DEFAULT_HERO));
      return;
    }
    const next = resolveCitizenHeroUrl(bannerUrl, { demoMode: false, fallback: CIVIC_DEFAULT_HERO });
    if (isGenericDefaultHero(next)) {
      setShownHero(commitHero(citizenWardId, livePanel, CIVIC_DEFAULT_HERO));
      return;
    }
    if (sameHeroUrl(next, shownHeroRef.current)) {
      commitHero(citizenWardId, livePanel, next);
      return;
    }
    const ready = await preloadHero(next);
    setShownHero(commitHero(citizenWardId, livePanel, ready || next));
  };

  const load = async () => {
    setError('');
    const results = await Promise.allSettled([
      api.wardUpdates({ page: 1, limit: 5, status: 'PUBLISHED', ...(citizenWardId ? { wardId: citizenWardId } : {}), nagarsevakId: getSavedPanelId(citizenWardId) || undefined }),
      api.schemes({ status: 'PUBLISHED', ...(citizenWardId ? { wardId: citizenWardId } : {}), nagarsevakId: getSavedPanelId(citizenWardId) || undefined }),
      api.complaints({ page: 1, limit: 8, ...citizenPortalQuery(citizenWardId), assignedNagarsevakUserId: getSavedPanelId(citizenWardId) || undefined }),
      api.wardTeam(citizenWardId),
      queryWardId ? Promise.resolve({ data: null }) : api.myWard(),
      api.portalConfig(citizenPortalQuery(citizenWardId)),
      api.galleryItems({ status: 'PUBLISHED', ...citizenPortalQuery(citizenWardId) }),
      api.hospitals({ page: 1, limit: 4, ...(citizenWardId ? { wardId: citizenWardId } : {}) }),
      api.medicals({ page: 1, limit: 4, ...(citizenWardId ? { wardId: citizenWardId } : {}) })
    ]);
    const [u, s, c, t, w, pc, pg, hs, ms] = results;
    let nextUpdates = null, nextUpdateTotal = 0, nextSchemes = null, nextMessages = Array.isArray(messages) ? messages : [], nextComplaints = null, nextComplaintTotal = 0, nextTeam = null, nextSnapshot = null;
    let nextPortalConfig = null, nextPortalGallery = null, nextHospitals = null, nextMedicals = null;

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
      const panel = getSavedPanelId(citizenWardId);
      nextComplaints = (c.value?.data || []).filter((row) => assignedToPanel(row, panel));
      nextComplaintTotal = Number.isFinite(Number(c.value?.meta?.total)) ? Number(c.value.meta.total) : nextComplaints.length;
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
      if (purchased.length === 1 && citizenWardId) savePanelId(citizenWardId, purchased[0].id);
      const savedId = getSavedPanelId(citizenWardId);
      const liveNagar = purchased.find((n) => String(n.id) === String(savedId))
        || ((pcData.nagarsevak && !pcData.nagarsevak.isDemo) ? pcData.nagarsevak : null)
        || purchased[0]
        || null;
      setPortalNagarsevaks(purchased.length ? purchased : (liveNagar ? [liveNagar] : []));
      setTargetNagarsevak(liveNagar);
      await applyLiveHero(nextPortalConfig?.heroBannerUrl, {
        demoMode: Boolean(nextPortalConfig?.demoMode),
      });
    }
    if (pg.status === 'fulfilled' && Array.isArray(pg.value?.data)) {
      nextPortalGallery = pg.value.data;
      setPortalGallery(nextPortalGallery);
    }
    if (hs.status === 'fulfilled') {
      nextHospitals = (hs.value?.data || []).slice(0, 4);
      setHospitals(nextHospitals);
    } else {
      nextHospitals = [];
      setHospitals([]);
    }
    if (ms && ms.status === 'fulfilled') {
      nextMedicals = (ms.value?.data || []).slice(0, 4);
      setMedicals(nextMedicals);
    } else {
      nextMedicals = [];
      setMedicals([]);
    }

    _userPanelCache = {
      wardId: citizenWardId,
      panelId: getSavedPanelId(citizenWardId),
      updates: nextUpdates,
      updateTotal: nextUpdateTotal,
      schemes: nextSchemes,
      messages: nextMessages,
      complaints: nextComplaints,
      complaintTotal: nextComplaintTotal,
      team: nextTeam,
      snapshot: nextSnapshot,
      portalConfig: nextPortalConfig || _userPanelCache?.portalConfig,
      portalGallery: Array.isArray(nextPortalGallery) ? nextPortalGallery : (_userPanelCache?.portalGallery || null),
      hospitals: nextHospitals,
      medicals: nextMedicals
    };

    const failed = results.find(x => x.status === 'rejected');
    if (failed) setError(failed.reason?.message || 'Some ward information could not be loaded.');
  };

  const loadLive = async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const c = await api.complaints({ page: 1, limit: 8, ...citizenPortalQuery(citizenWardId), assignedNagarsevakUserId: getSavedPanelId(citizenWardId) || undefined });
      const panel = getSavedPanelId(citizenWardId);
      const nextComplaints = (c.data || []).filter((row) => assignedToPanel(row, panel));
      setComplaints(nextComplaints);
      setComplaintTotal(Number.isFinite(Number(c.meta?.total)) ? Number(c.meta.total) : nextComplaints.length);
    } catch {
      /* keep last loaded complaints */
    }
  };

  useEffect(() => {
    const cached = readStickyHero(citizenWardId, panelId);
    if (cached) {
      const img = new Image();
      img.src = cached;
    }
    load();
    const t = setInterval(loadLive, 90000);
    const onVis = () => { if (document.visibilityState === 'visible') loadLive(); };
    const onPortalUpdate = () => {
      try { sessionStorage.removeItem(stickyKey(citizenWardId, getSavedPanelId(citizenWardId))); } catch { /* ignore */ }
      delete _stickyHeroByWard[stickyKey(citizenWardId, getSavedPanelId(citizenWardId))];
      _userPanelCache = null;
      load();
    };
    const onStorage = (e) => {
      if (e.key === 'ward_portal_updated' || (e.key && e.key.startsWith('ward_hero_banner'))) onPortalUpdate();
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
  }, [citizenWardId, panelId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const go = p => navigate(p);

  const heroSrc = shownHero || readStickyHero(citizenWardId, panelId);

  const nagarsevaksList = useMemo(() => {
    const all = portalNagarsevaks.length
      ? portalNagarsevaks.filter((n) => n && n.id && !n.employeeProfile)
      : (targetNagarsevak?.id ? [targetNagarsevak] : []);
    const savedId = getSavedPanelId(citizenWardId);
    if (savedId) {
      const picked = all.filter((n) => String(n.id) === String(savedId));
      if (picked.length) return picked;
    }
    return all.slice(0, 1);
  }, [targetNagarsevak, portalNagarsevaks, citizenWardId]);
  const activeNagar = nagarsevaksList[0] || snapshot?.nagarsevak || null;

  const featuredGallery = useMemo(() => {
    if (!Array.isArray(portalGallery)) return [];
    const dashOrder = uniqueIds(
      (Array.isArray(portalConfig?.dashboardWorkOrder) && portalConfig.dashboardWorkOrder.length
        ? portalConfig.dashboardWorkOrder
        : portalConfig?.meta?.dashboardWorkOrder)
    );
    const savedId = getSavedPanelId(citizenWardId);
    return selectPanelWorks(portalGallery, savedId)
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
  }, [portalGallery, portalConfig, citizenWardId]);

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
              <div className="user-kicker-row">
                <span className="user-kicker-badge">
                  <span className="kicker-pulse-dot" />
                  <span className="kicker-text">
                    {language === 'mr' ? 'अधिकृत डिजिटल प्रभाग सेवा · थेट सक्रिय' : 'OFFICIAL DIGITAL WARD DESK · ACTIVE'}
                  </span>
                </span>
              </div>
              <h1 className="user-hero-title">{heroHeadline('', user?.name, text.welcome)}</h1>
              <HeroLede text={text.desc} />
              <div className="user-hero-meta-strip">
                <div className="user-ward-chip compact">
                  <span className="user-ward-pin">📍</span>
                  <div className="user-ward-meta">
                    <small>{text.ward.toUpperCase()}</small>
                    <strong>{formatWardLabel(ward || snapshot?.ward, language === 'mr' ? 'प्रभाग' : 'Ward')}</strong>
                  </div>
                </div>
              </div>
              <div className="user-hero-tools">
                <div className="user-hero-actions">
                  <button type="button" className="primary-btn user-hero-cta-btn" onClick={() => go('/my-complaints')}>
                    <span className="cta-icon">📣</span>
                    <span>{language === 'mr' ? 'तक्रार नोंदवा' : 'Raise a complaint'}</span>
                  </button>
                  <button type="button" className="ghost-btn user-hero-cta-btn" onClick={() => go('/ward-updates')}>
                    <span className="cta-icon">📰</span>
                    <span>{language === 'mr' ? 'अपडेट्स पहा' : 'View updates'}</span>
                  </button>
                </div>
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
          <section className={`user-hero user-hero-pro has-portal-banner has-custom-hero ${heroSrc ? 'has-photo' : 'no-photo'}`}>
            <div className="user-hero-media" aria-hidden="true">
              {heroSrc ? (
                <img
                  className="user-hero-bg-photo"
                  src={withHeroCacheBust(heroSrc, portalConfig?.updatedAt)}
                  alt=""
                  decoding="async"
                  fetchPriority="high"
                  draggable="false"
                  onError={(e) => {
                    if (e.currentTarget.src && !e.currentTarget.src.includes('hero-ward-default.jpg')) {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/hero-ward-default.jpg';
                    }
                  }}
                />
              ) : (
                <div className="user-hero-fallback-pattern" />
              )}
            </div>
            <div className="user-hero-shade" aria-hidden="true" />

            <div className="user-hero-copy">
              <h1 className="user-hero-title">
                {heroHeadline(
                  language === 'mr' ? portalConfig?.heroTitleMr : portalConfig?.heroTitleEn,
                  user?.name,
                  text.welcome
                )}
              </h1>

              <HeroLede
                text={
                  language === 'mr'
                    ? (portalConfig?.heroSubtitleMr || text.desc)
                    : (portalConfig?.heroSubtitleEn || text.desc)
                }
              />

              <div className="user-ward-chip compact">
                <span className="user-ward-icon">📍</span>
                <div>
                  <small>{language === 'mr' ? 'तुमचा प्रभाग' : 'YOUR WARD'}</small>
                  <strong>{formatWardLabel(ward || snapshot?.ward, language === 'mr' ? 'प्रभाग' : 'Ward')}</strong>
                </div>
              </div>

              <div className="user-hero-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => go(portalConfig?.ctaPrimaryLink || '/my-complaints')}
                >
                  {language === 'mr' ? (portalConfig?.ctaPrimaryTextMr || 'तक्रार नोंदवा') : (portalConfig?.ctaPrimaryTextEn || 'Raise a complaint')}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => go(portalConfig?.ctaSecondaryLink || '/gallery')}
                >
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
            <div className="user-mini-empty">
              <strong>{text.noUpdates}</strong>
              <span>{language === 'mr' ? 'नवीन अपडेट किंवा कार्यक्रम प्रकाशित झाल्यावर येथे दिसतील.' : 'New updates and events will appear here.'}</span>
            </div>
          ) : (
            <div className="user-update-list home-feed-list">
              {updates.map(x => (
                <button key={x.id} className={`home-feed-card ${x.type === 'EVENT' ? 'is-event' : 'is-update'}`} onClick={() => go('/ward-updates')}>
                  <div className="home-feed-top">
                    <span className="home-feed-badge">{typeLabel(x.type, language === 'mr')}</span>
                    {x.eventDate ? <time>{fmt(x.eventDate)}</time> : null}
                  </div>
                  <h3>{x.title}</h3>
                  {x.message ? <p>{x.message}</p> : null}
                  <div className="home-feed-meta">
                    <span>{x.location || (language === 'mr' ? 'वॉर्ड कार्यालय' : 'Ward office')}</span>
                    <span>{fmt(x.publishedAt || x.createdAt)}</span>
                  </div>
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
                <strong>{language === 'mr' ? 'योजना उपलब्ध नाहीत' : 'No schemes published'}</strong>
                <span>{language === 'mr' ? 'सध्या कोणतीही योजना उपलब्ध नाही.' : 'Check back soon for government and civic benefits.'}</span>
              </div>
            ) : (
              <div className="user-scheme-list home-feed-list">
                {schemes.slice(0, 5).map(s => (
                  <button key={s.id} onClick={() => go('/schemes')} className="home-feed-card is-scheme">
                    <div className="home-feed-top">
                      <span className="home-feed-badge">{language === 'mr' ? 'योजना' : 'Scheme'}</span>
                    </div>
                    <h3>{s.title}</h3>
                    {s.description || s.summary ? <p>{s.description || s.summary}</p> : null}
                    <div className="home-feed-meta">
                      <span>{s.audience || (language === 'mr' ? 'पात्र नागरिक' : 'Eligible residents')}</span>
                      <span>{formatWardNumber(s.ward?.wardNumber || ward?.wardNumber) || (language === 'mr' ? 'तुमचा वॉर्ड' : 'Your ward')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="user-panel-card user-hospitals-panel">
            <div className="user-section-head">
              <div>
                <span className="user-kicker">{language === 'mr' ? 'आरोग्य' : 'HEALTH'}</span>
                <h2>{language === 'mr' ? 'हॉस्पिटल्स व मेडिकल' : 'Hospitals & Medical Stores'}</h2>
                <p>{language === 'mr' ? 'वॉर्डमधील रुग्णालये, क्लिनिक व २४ तास औषधांची दुकाने' : 'Ward hospitals, clinics & 24x7 pharmacies'}</p>
              </div>
              <button type="button" onClick={() => go('/hospitals')} className="user-text-btn">
                {language === 'mr' ? 'सर्व पहा →' : 'View all →'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', margin: '8px 0 14px 0' }}>
              <button
                type="button"
                onClick={() => setHealthFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: healthFilter === 'ALL' ? '1px solid #0F766E' : '1px solid #E2E8F0',
                  background: healthFilter === 'ALL' ? '#F0FDFA' : '#FFFFFF',
                  color: healthFilter === 'ALL' ? '#0F766E' : '#64748B'
                }}
              >
                {language === 'mr' ? 'सर्व' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setHealthFilter('HOSPITALS')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: healthFilter === 'HOSPITALS' ? '1px solid #0F766E' : '1px solid #E2E8F0',
                  background: healthFilter === 'HOSPITALS' ? '#F0FDFA' : '#FFFFFF',
                  color: healthFilter === 'HOSPITALS' ? '#0F766E' : '#64748B'
                }}
              >
                {language === 'mr' ? 'हॉस्पिटल्स' : 'Hospitals'}
              </button>
              <button
                type="button"
                onClick={() => setHealthFilter('MEDICALS')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: healthFilter === 'MEDICALS' ? '1px solid #0F766E' : '1px solid #E2E8F0',
                  background: healthFilter === 'MEDICALS' ? '#F0FDFA' : '#FFFFFF',
                  color: healthFilter === 'MEDICALS' ? '#0F766E' : '#64748B'
                }}
              >
                {language === 'mr' ? 'औषधांची दुकाने' : 'Medical Stores'}
              </button>
            </div>

            {hospitals === null && medicals === null ? (
              <Loading />
            ) : (!hospitals?.length && !medicals?.length) ? (
              <div className="user-mini-empty">
                <strong>{language === 'mr' ? 'आरोग्य सुविधा यादी नाही' : 'No health facilities published'}</strong>
                <span>{language === 'mr' ? 'प्रकाशित झाल्यावर येथे दिसतील.' : 'Hospitals and pharmacies will appear here.'}</span>
              </div>
            ) : (
              <div className="user-scheme-list home-feed-list">
                {/* Hospitals List */}
                {healthFilter !== 'MEDICALS' && (hospitals || []).slice(0, healthFilter === 'HOSPITALS' ? 4 : 2).map(h => (
                  <button key={`h-${h.id}`} onClick={() => go('/hospitals?tab=hospitals')} className="home-feed-card is-hospital">
                    <div className="home-feed-top">
                      <span className="home-feed-badge">{hospitalTypeLabel(h.type, language === 'mr')}</span>
                      {h.phone ? <time>{h.phone}</time> : null}
                    </div>
                    <h3>{h.name}</h3>
                    {h.address ? <p>{h.address}</p> : null}
                    <div className="home-feed-meta">
                      <span>{h.area?.name || (language === 'mr' ? 'वॉर्ड आरोग्य' : 'Ward health')}</span>
                      <span>{formatWardNumber(h.ward?.wardNumber || ward?.wardNumber) || (language === 'mr' ? 'तुमचा वॉर्ड' : 'Your ward')}</span>
                    </div>
                  </button>
                ))}

                {/* Medicals List */}
                {healthFilter !== 'HOSPITALS' && (medicals || []).slice(0, healthFilter === 'MEDICALS' ? 4 : 2).map(m => (
                  <button key={`m-${m.id}`} onClick={() => go('/hospitals?tab=medicals')} className="home-feed-card is-hospital" style={{ borderLeft: '3px solid #0F766E' }}>
                    <div className="home-feed-top">
                      <span className="home-feed-badge" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
                        {m.is24x7 ? (language === 'mr' ? '२४x७ केमिस्ट' : '24x7 Chemist') : medicalTypeLabel(m.type, language === 'mr')}
                      </span>
                      {m.phone ? <time>{m.phone}</time> : null}
                    </div>
                    <h3>{translateMedicalName(m.name, language === 'mr')}</h3>
                    {m.address ? <p>{m.address}</p> : null}
                    <div className="home-feed-meta">
                      <span>{m.area?.name || (language === 'mr' ? 'औषधांची दुकाने' : 'Medical store')}</span>
                      <span>{formatWardNumber(m.ward?.wardNumber || ward?.wardNumber) || (language === 'mr' ? 'तुमचा वॉर्ड' : 'Your ward')}</span>
                    </div>
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
