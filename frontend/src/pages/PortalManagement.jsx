import React, { useState, useEffect, useMemo } from 'react';
import { api, getUser } from '../services/api';
import { isMaster, isSubMaster, isNagarsevak } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { PageHeader, Loading, Empty, Modal, ImageCropField, CirclePhotoField, Field, ErrorBox, SearchableSelect } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { CITIZEN_HERO_ASPECT, COMPLAINTS_BANNER_ASPECT, GALLERY_BANNER_ASPECT, EMPTY_HIGHLIGHT_CARDS, HIGHLIGHT_ICONS, normalizeHighlightCards, highlightHasText, displayHighlightCard, publicMediaUrl, isGenericDefaultHero } from '../utils/portalDefaults';
import NagarsevakShowcase from '../components/NagarsevakShowcase';
import { formatWardLabel } from '../wardFormat';
import { getLanguage } from '../language';
import {
  BuildingIcon,
  UsersIcon,
  HomeIcon,
  FileTextIcon,
  SearchIcon,
  EyeIcon,
  ExternalLinkIcon
} from '../components/Icons';

function onCitizenHome(item, dashOrder = []) {
  const v = item?.showOnDashboard ?? item?.show_on_dashboard;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v && typeof v === 'object' && (v.data?.[0] === 1 || v[0] === 1)) return true;
  if (Array.isArray(dashOrder) && dashOrder.map(String).includes(String(item?.id))) return true;
  return false;
}

function notifyPortalUpdated(wardId) {
  const stamp = String(Date.now());
  try { localStorage.setItem('ward_portal_updated', stamp); } catch { /* ignore */ }
  try {
    const id = String(wardId || '');
    if (id) {
      sessionStorage.removeItem(`ward_hero_sticky_${id}`);
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(`ward_hero_sticky_${id}`)) sessionStorage.removeItem(key);
      });
      localStorage.setItem(`ward_hero_banner_v_${id}`, stamp);
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('ward:portal-updated', { bubbles: true, detail: { wardId } }));
}

function rememberBannerUrl(key, url) {
  try {
    if (url) {
      if (String(url).startsWith('data:') && String(url).length > 500000) return;
      localStorage.setItem(key, url);
    }
  } catch { /* ignore */ }
}

async function persistLaptopImage(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith('data:image/')) return raw;
  try {
    const blob = await (await fetch(raw)).blob();
    if (!blob || !blob.size) return raw;
    const ext = /png/i.test(blob.type) ? 'png' : /webp/i.test(blob.type) ? 'webp' : 'jpg';
    const file = new File([blob], `banner.${ext}`, { type: blob.type || 'image/jpeg' });
    const res = await api.uploadPortalMedia(file);
    const stored = res?.data?.url || res?.url || '';
    if (stored) return stored;
    return raw;
  } catch (err) {
    console.warn('[BANNER UPLOAD] Falling back to direct data URL save:', err?.message);
    return raw;
  }
}

function panelEditKey(wardId) {
  return `portal_edit_panel_${wardId || ''}`;
}

function LiveBannerPreview({ url, emptyLabel, aspect = 2.4 }) {
  const shown = publicMediaUrl(url);
  if (!shown) {
    return <div className="portal-live-banner-empty">{emptyLabel}</div>;
  }
  return (
    <div
      className="portal-live-banner-photo"
      style={{
        backgroundImage: `url("${String(shown).replace(/"/g, '')}")`,
        aspectRatio: `${aspect} / 1`,
      }}
      role="img"
      aria-label="Current banner"
    />
  );
}

const CATEGORIES = [
  { id: 'DEVELOPMENT', labelEn: 'Development', labelMr: 'विकास कामे', icon: '🏗️' },
  { id: 'VIDEOS', labelEn: 'Video Report', labelMr: 'व्हिडीओ अहवाल', icon: '🎥' },
  { id: 'WATER', labelEn: 'Water & Sanitation', labelMr: 'पाणी व स्वच्छता', icon: '💧' },
  { id: 'LEADERSHIP', labelEn: 'Leadership', labelMr: 'लोकप्रतिनिधी', icon: '🏛️' },
  { id: 'HEALTH', labelEn: 'Health Camp', labelMr: 'आरोग्य शिबीर', icon: '🩺' },
  { id: 'SOCIAL', labelEn: 'Green & Environment', labelMr: 'पर्यावरण व सामाजिक', icon: '🌱' },
  { id: 'OTHER', labelEn: 'Other Public Work', labelMr: 'इतर सार्वजनिक कामे', icon: '📋' },
];

function HighlightCardsEditor({ cards, onChange, isMr }) {
  const rows = Array.isArray(cards) && cards.length ? cards : EMPTY_HIGHLIGHT_CARDS;
  const update = (idx, patch) => {
    const next = rows.map((card, i) => (i === idx ? { ...card, ...patch } : card));
    onChange(next);
  };
  const addCard = () => {
    if (rows.length >= 8) return;
    onChange([...rows, {
      id: `h-${Date.now()}`,
      icon: HIGHLIGHT_ICONS[rows.length % HIGHLIGHT_ICONS.length],
      metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '',
    }]);
  };
  const removeCard = (idx) => onChange(rows.filter((_, i) => i !== idx));
  return (
    <div className="highlight-card-editor">
      <div className="highlight-card-editor-head">
        <label className="form-label">{isMr ? 'ठळक कार्ड्स (नागरिक होमवर)' : 'Highlight cards (citizen home)'}</label>
        <button type="button" className="small-btn" disabled={rows.length >= 8} onClick={addCard}>
          {isMr ? '+ कार्ड जोडा' : '+ Add card'}
        </button>
      </div>
      <p className="field-hint">
        {isMr
          ? 'शीर्षक कार्डचे नाव आहे. आकडा फक्त २४+ / ९८% सारखा नंबर असल्यास भरा. नाव दोनदा लिहू नका.'
          : 'Title is the card name. Number is optional (24+, 98%). Do not type the same name in both boxes.'}
      </p>
      <div className="highlight-card-list">
        {rows.map((card, idx) => (
          <article className="highlight-edit-card" key={card.id || idx}>
            <div className="highlight-edit-top">
              <span className="highlight-edit-index">{idx + 1}</span>
              <span className="highlight-edit-kicker">{isMr ? 'आयकन' : 'Icon'}</span>
              <button type="button" className="small-btn highlight-remove" onClick={() => removeCard(idx)}>
                {isMr ? 'काढा' : 'Remove'}
              </button>
            </div>
            <div className="highlight-icon-grid" role="group" aria-label="Card icon">
              {HIGHLIGHT_ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  className={`highlight-icon-btn ${card.icon === icon ? 'is-on' : ''}`}
                  onClick={() => update(idx, { icon })}
                  title={icon}
                >
                  {icon}
                </button>
              ))}
              <span className="highlight-icon-custom-wrap">
                <input
                  className="highlight-icon-custom"
                  value={HIGHLIGHT_ICONS.includes(card.icon) ? '' : (card.icon || '')}
                  maxLength={2}
                  onChange={(e) => update(idx, { icon: e.target.value.trim() || '🏆' })}
                  aria-label={isMr ? 'कस्टम emoji' : 'Custom emoji'}
                  placeholder="😊"
                />
              </span>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">{isMr ? 'शीर्षक' : 'Title'}</label>
                <input
                  className="form-control"
                  value={card.label || card.labelEn || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(idx, { label: v, labelEn: v });
                  }}
                  placeholder={isMr ? 'उदा. पाणी पुरवठा मोहीम' : 'e.g. Water supply drive'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{isMr ? 'आकडा (ऐच्छिक)' : 'Number (optional)'}</label>
                <input
                  className="form-control"
                  value={card.metric || card.metricEn || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(idx, { metric: v, metricEn: v });
                  }}
                  placeholder={isMr ? 'उदा. २४+ किंवा ९८%' : 'e.g. 24+ or 98%'}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{isMr ? 'छोटी ओळ (ऐच्छिक)' : 'Short line (optional)'}</label>
              <input
                className="form-control"
                value={card.desc || card.descEn || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  update(idx, { desc: v, descEn: v });
                }}
                placeholder={isMr ? 'उदा. रस्ते, पाणी, पथदिवे' : 'e.g. Roads, water, lighting'}
              />
            </div>
          </article>
        ))}
      </div>
      {rows.filter(highlightHasText).length ? (
        <div className="nagar-impact-ribbon highlight-live-preview">
          <p className="field-hint">{isMr ? 'नागरिकांना असे दिसेल' : 'How residents will see it'}</p>
          <div className="nagar-impact-grid">
            {rows.filter(highlightHasText).map((item, idx) => {
              const view = displayHighlightCard(item, isMr);
              return (
              <div key={item.id || idx} className="nagar-impact-card nagar-impact-card-static">
                <span className="nagar-impact-icon">{view.icon || '🏆'}</span>
                <div className="nagar-impact-content">
                  {view.stat ? <strong className="nagar-impact-metric">{view.stat}</strong> : null}
                  {view.title ? <span className={view.stat ? 'nagar-impact-label' : 'nagar-impact-metric'}>{view.title}</span> : null}
                  {view.line ? <small className="nagar-impact-desc">{view.line}</small> : null}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PortalManagement() {
  const user = getUser();
  const isMr = getLanguage() === 'mr';

  const { wards, selectedWardId, canSelect, fixedWardId, master } = useWardFilter();
  const effectiveWardId = canSelect ? (selectedWardId || null) : (fixedWardId || user?.wardId || null);
  const needsWardPick = canSelect && !effectiveWardId;

  const [activeTab, setActiveTab] = useState('HERO'); // 'HERO' | 'WORKS' | 'REPRESENTATIVE'
  const [bannerSubTab, setBannerSubTab] = useState('HOME'); // 'HOME' | 'COMPLAINTS' | 'GALLERY' | 'HEADLINES' | 'ALL'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Portal configuration state
  const [portalConfig, setPortalConfig] = useState(null);
  const [representative, setRepresentative] = useState(null);
  const [nagarsevaks, setNagarsevaks] = useState([]);
  const [purchasedNagarsevaks, setPurchasedNagarsevaks] = useState([]);
  const [wardInfo, setWardInfo] = useState(null);
  const [activation, setActivation] = useState(null);
  const [editorPanelId, setEditorPanelId] = useState('');

  const activeWard = useMemo(() => {
    if (selectedWardId) {
      return wards.find((w) => String(w.id) === String(selectedWardId)) || null;
    }
    if (fixedWardId) {
      return wards.find((w) => String(w.id) === String(fixedWardId)) || user?.ward || null;
    }
    if (master && !selectedWardId) {
      return null;
    }
    return wardInfo || user?.ward || null;
  }, [selectedWardId, fixedWardId, wards, user?.ward, wardInfo, master]);

  // Gallery items state
  const [galleryItems, setGalleryItems] = useState([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState('ALL');
  const [dashboardWorkOrder, setDashboardWorkOrder] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragItemId, setDragItemId] = useState(null);

  // Item Modal state (Add / Edit)
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    mediaType: 'image',
    title: '',
    titleMr: '',
    category: 'DEVELOPMENT',
    mediaUrl: '',
    videoUrl: '',
    duration: '',
    date: new Date().toISOString().split('T')[0],
    dateFormatted: '',
    dateFormattedMr: '',
    location: '',
    badge: 'काम पूर्ण · COMPLETED',
    description: '',
    descriptionMr: '',
    status: 'PUBLISHED',
    showOnDashboard: false,
    pinFirst: false,
  });

  // Delete confirm modal
  const [deletingItem, setDeletingItem] = useState(null);

  const handleSaveHeroBanner = async () => {
    if (!effectiveWardId) return;
    setSaving(true);
    try {
      const heroBannerUrl = await persistLaptopImage(portalConfig?.heroBannerUrl || '');
      const res = await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        heroBannerUrl,
        useCivicHero: isGenericDefaultHero(heroBannerUrl),
      });
      const returnedConfig = res?.data?.config;
      const finalHero = returnedConfig?.heroBannerUrl || heroBannerUrl;
      setPortalConfig((prev) => ({ ...prev, heroBannerUrl: finalHero }));
      rememberBannerUrl(`ward_hero_banner_${effectiveWardId}_${editorPanelId || ''}`, finalHero);
      localStorage.setItem(`ward_hero_banner_v_${effectiveWardId}`, String(Date.now()));
      notifyPortalUpdated(effectiveWardId);
      showToast(isMr ? 'होम बॅनर सेव्ह झाला.' : 'Home banner saved.');
    } catch (err) {
      showToast(err.message || 'Failed to save home banner.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComplaintsBanner = async () => {
    if (!effectiveWardId) return;
    setSaving(true);
    try {
      const complaintsBannerUrl = await persistLaptopImage(portalConfig?.complaintsBannerUrl || '');
      const res = await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        complaintsBannerUrl,
      });
      const returnedConfig = res?.data?.config;
      const finalComplaints = returnedConfig?.complaintsBannerUrl || complaintsBannerUrl;
      setPortalConfig((prev) => ({ ...prev, complaintsBannerUrl: finalComplaints }));
      rememberBannerUrl(`ward_complaints_banner_${effectiveWardId}_${editorPanelId || ''}`, finalComplaints);
      notifyPortalUpdated(effectiveWardId);
      showToast(isMr ? 'तक्रार पानाचा बॅनर सेव्ह झाला.' : 'Complaints banner saved.');
    } catch (err) {
      showToast(err.message || 'Failed to save complaints banner.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGalleryBanner = async () => {
    if (!effectiveWardId) return;
    setSaving(true);
    try {
      const galleryBannerUrl = await persistLaptopImage(portalConfig?.galleryBannerUrl || '');
      const res = await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        galleryBannerUrl,
      });
      const returnedConfig = res?.data?.config;
      const finalGallery = returnedConfig?.galleryBannerUrl || galleryBannerUrl;
      setPortalConfig((prev) => ({ ...prev, galleryBannerUrl: finalGallery }));
      rememberBannerUrl(`ward_gallery_banner_${effectiveWardId}_${editorPanelId || ''}`, finalGallery);
      notifyPortalUpdated(effectiveWardId);
      showToast(isMr ? 'गॅलरी बॅनर सेव्ह झाला.' : 'Gallery banner saved.');
    } catch (err) {
      showToast(err.message || 'Failed to save gallery banner.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Notification helper
  const showToast = (message, type = 'success') => {
    window.dispatchEvent(new CustomEvent('ward:toast', {
      detail: { type, title: type === 'error' ? (isMr ? 'त्रुटी' : 'Error') : (isMr ? 'सेव्ह झाले' : 'Saved'), message },
    }));
  };

  const formatWorkDate = (iso, locale) => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Load portal config and gallery items
  const loadData = async ({ silent = false } = {}) => {
    if (!effectiveWardId) {
      setPortalConfig(null);
      setRepresentative(null);
      setNagarsevaks([]);
      setGalleryItems([]);
      setWardInfo(null);
      setLoading(false);
      setError('');
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const storedPanel = (() => {
        if (isNagarsevak(user)) return String(user.id);
        if (editorPanelId) return editorPanelId;
        try { return localStorage.getItem(panelEditKey(effectiveWardId)) || ''; } catch { return ''; }
      })();
      const [cfgRes, galRes] = await Promise.all([
        api.portalConfig({ wardId: effectiveWardId, nagarsevakId: storedPanel || undefined }),
        api.galleryItems({ wardId: effectiveWardId, nagarsevakId: storedPanel || undefined }),
      ]);

      if (cfgRes?.data) {
        const loaded = cfgRes.data.config || {};
        const loadedMeta = loaded.meta && typeof loaded.meta === 'object' ? loaded.meta : {};
        setPortalConfig((prev) => {
          const keepHero = prev?.heroBannerUrl && String(prev.heroBannerUrl).startsWith('data:image/');
          const keepComplaints = prev?.complaintsBannerUrl && String(prev.complaintsBannerUrl).startsWith('data:image/');
          const keepGallery = prev?.galleryBannerUrl && String(prev.galleryBannerUrl).startsWith('data:image/');
          return {
            ...loaded,
            heroBannerUrl: keepHero ? prev.heroBannerUrl : (loaded.heroBannerUrl || '/hero-ward-default.jpg'),
            complaintsBannerUrl: keepComplaints ? prev.complaintsBannerUrl : (loaded.complaintsBannerUrl || loadedMeta.complaintsBannerUrl || ''),
            galleryBannerUrl: keepGallery ? prev.galleryBannerUrl : (loaded.galleryBannerUrl || loadedMeta.galleryBannerUrl || ''),
          };
        });
        const cfgMeta = loadedMeta;
        setDashboardWorkOrder(Array.isArray(cfgMeta.dashboardWorkOrder) ? cfgMeta.dashboardWorkOrder.map(String) : []);
        const allList = Array.isArray(cfgRes.data.nagarsevaks) ? cfgRes.data.nagarsevaks : [];
        const purchasedList = Array.isArray(cfgRes.data.purchasedNagarsevaks) && cfgRes.data.purchasedNagarsevaks.length
          ? cfgRes.data.purchasedNagarsevaks
          : allList;
        const panelList = allList.length ? allList : purchasedList;
        const wantedId = isNagarsevak(user)
          ? String(user.id)
          : (storedPanel || cfgRes.data.config?.selectedNagarsevakUserId || panelList[0]?.id || '');
        let featured = panelList.find((n) => String(n.id) === String(wantedId))
          || panelList.find((n) => String(n.id) === String(cfgRes.data.nagarsevak?.id))
          || panelList[0]
          || null;
        if (isNagarsevak(user)) {
          featured = panelList.find((n) => String(n.id) === String(user.id)) || featured;
        }
        if (featured?.id && String(featured.id) !== String(editorPanelId)) {
          setEditorPanelId(String(featured.id));
          try { localStorage.setItem(panelEditKey(effectiveWardId), String(featured.id)); } catch { /* ignore */ }
        }
        setNagarsevaks(panelList);
        setPurchasedNagarsevaks(purchasedList);
        setRepresentative(featured ? {
          ...featured,
          whatsapp: featured.whatsapp || featured.mobile || '',
          bio: featured.bio || '',
          bioMr: featured.bioMr || '',
          achievements: (() => {
            const loaded = normalizeHighlightCards(featured.achievements, { keepEmpty: true });
            const filled = loaded.filter(highlightHasText);
            return filled.length ? loaded : EMPTY_HIGHLIGHT_CARDS.map((c) => ({ ...c }));
          })(),
        } : null);
        setWardInfo(cfgRes.data.ward || null);
        setActivation(cfgRes.data.activation || null);
      }
      if (galRes?.data) {
        const rows = Array.isArray(galRes.data) ? galRes.data : [];
        const normalized = rows.map((item, idx) => {
          const n = Number(item.orderIndex ?? item.order_index);
          return { ...item, orderIndex: Number.isFinite(n) ? n : idx };
        });
        normalized.sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
        setGalleryItems(normalized);
        setOrderDirty(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load citizen portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveWardId) {
      setEditorPanelId('');
      return;
    }
    if (isNagarsevak(user)) {
      setEditorPanelId(String(user.id));
      return;
    }
    try {
      setEditorPanelId(localStorage.getItem(panelEditKey(effectiveWardId)) || '');
    } catch {
      setEditorPanelId('');
    }
  }, [effectiveWardId]);

  useEffect(() => {
    loadData();

    const handlePortalUpdated = (e) => {
      if (!e.detail?.wardId || String(e.detail.wardId) === String(effectiveWardId)) {
        loadData({ silent: true });
      }
    };
    window.addEventListener('ward:portal-updated', handlePortalUpdated);

    return () => {
      window.removeEventListener('ward:portal-updated', handlePortalUpdated);
    };
  }, [effectiveWardId, editorPanelId]);

  // Save Hero & Portal Config
  const handleSavePortalConfig = async (e) => {
    e?.preventDefault();
    if (!effectiveWardId) {
      showToast(isMr ? 'कृपया आधी वॉर्ड निवडा.' : 'Select a ward before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const heroBannerUrl = await persistLaptopImage(portalConfig?.heroBannerUrl || '');
      const complaintsBannerUrl = await persistLaptopImage(portalConfig?.complaintsBannerUrl || '');
      const galleryBannerUrl = await persistLaptopImage(portalConfig?.galleryBannerUrl || '');
      const slimConfig = { ...portalConfig, heroBannerUrl };
      const keepMetaImages = new Set(['repPhoto', 'complaintsBannerUrl', 'galleryBannerUrl']);
      slimConfig.meta = { ...(slimConfig.meta && typeof slimConfig.meta === 'object' ? slimConfig.meta : {}) };
      slimConfig.meta.complaintsBannerUrl = complaintsBannerUrl || slimConfig.meta.complaintsBannerUrl || '';
      slimConfig.meta.galleryBannerUrl = galleryBannerUrl || slimConfig.meta.galleryBannerUrl || '';
      delete slimConfig.meta.dashboardWorkOrder;
      delete slimConfig.meta.panels;
      delete slimConfig.complaintsBannerUrl;
      delete slimConfig.galleryBannerUrl;
      Object.keys(slimConfig.meta).forEach((k) => {
        if (typeof slimConfig.meta[k] === 'string' && slimConfig.meta[k].startsWith('data:') && !keepMetaImages.has(k)) {
          delete slimConfig.meta[k];
        }
      });
      const res = await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        ...slimConfig,
        heroBannerUrl,
        complaintsBannerUrl,
        galleryBannerUrl,
        dashboardWorkOrder,
        useCivicHero: isGenericDefaultHero(heroBannerUrl),
      });
      const returnedConfig = res?.data?.config;
      const finalHero = returnedConfig?.heroBannerUrl || heroBannerUrl;
      const finalComplaints = returnedConfig?.complaintsBannerUrl || complaintsBannerUrl;
      const finalGallery = returnedConfig?.galleryBannerUrl || galleryBannerUrl;
      setPortalConfig((prev) => ({
        ...prev,
        heroBannerUrl: finalHero || prev?.heroBannerUrl,
        complaintsBannerUrl: finalComplaints || prev?.complaintsBannerUrl,
        galleryBannerUrl: finalGallery || prev?.galleryBannerUrl,
      }));
      try {
        const panelKey = editorPanelId || representative?.id || '';
        rememberBannerUrl(`ward_hero_banner_${effectiveWardId}_${panelKey}`, finalHero);
        localStorage.setItem(`ward_hero_banner_v_${effectiveWardId}`, String(Date.now()));
        rememberBannerUrl(`ward_complaints_banner_${effectiveWardId}_${panelKey}`, finalComplaints);
        rememberBannerUrl(`ward_gallery_banner_${effectiveWardId}_${panelKey}`, finalGallery);
      } catch { /* ignore */ }
      showToast(isMr ? 'बॅनर या नगरसेवक पॅनेलसाठी सेव्ह झाले.' : 'Banners saved for this Nagarsevak panel.');
      notifyPortalUpdated(effectiveWardId);
    } catch (err) {
      showToast(err.message || 'Failed to save portal settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save Representative Spotlight
  const handleSaveRepresentative = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      if (!effectiveWardId) {
        showToast(isMr ? 'कृपया आधी वॉर्ड निवडा.' : 'Select a ward before saving.', 'error');
        setSaving(false);
        return;
      }
      const filled = {
        ...representative,
        whatsapp: representative?.whatsapp || representative?.mobile || '',
        bio: representative?.bio || '',
        bioMr: representative?.bioMr || representative?.bio || '',
        achievements: normalizeHighlightCards(representative?.achievements),
      };
      await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: filled.id || editorPanelId || null,
        featuredNagarsevakUserId: filled.id || editorPanelId || null,
        nagarsevak: filled,
        meta: {
          ...(portalConfig?.meta || {}),
          repName: filled.name || '',
          repPhoto: filled.photo || '',
          repParty: filled.partyName || '',
          repWardSeat: filled.wardSeat || '',
          repPhone: filled.mobile || '',
          repWhatsapp: filled.whatsapp || '',
          repAddress: filled.officialAddress || '',
          repBio: filled.bio || '',
          repBioMr: filled.bioMr || filled.bio || '',
          achievements: filled.achievements || [],
        },
      });
      showToast(isMr ? 'नगरसेवक प्रोफाइल या पॅनेलसाठी सेव्ह झाली.' : 'Nagarsevak profile saved for this panel.');
      notifyPortalUpdated();
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save representative details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditorPanel = (id) => {
    const next = String(id || '');
    setEditorPanelId(next);
    try {
      if (effectiveWardId && next) localStorage.setItem(panelEditKey(effectiveWardId), next);
    } catch { /* ignore */ }
  };

  // Open Add Work Modal
  const openAddModal = () => {
    setEditingItem(null);
    setItemFormData({
      mediaType: 'image',
      title: '',
      titleMr: '',
      category: 'DEVELOPMENT',
      mediaUrl: '',
      videoUrl: '',
      duration: '',
      date: new Date().toISOString().split('T')[0],
      dateFormatted: '',
      dateFormattedMr: '',
      location: '',
      badge: 'काम पूर्ण · COMPLETED',
      description: '',
      descriptionMr: '',
      status: 'PUBLISHED',
      showOnDashboard: false,
      pinFirst: false,
    });
    setItemModalOpen(true);
  };

  // Open Edit Work Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setItemFormData({
      mediaType: item.mediaType || 'image',
      title: item.title || '',
      titleMr: item.titleMr || '',
      category: item.category || 'DEVELOPMENT',
      mediaUrl: item.mediaUrl || '',
      videoUrl: item.videoUrl || '',
      duration: item.duration || '',
      date: item.date || new Date().toISOString().split('T')[0],
      dateFormatted: item.dateFormatted || '',
      dateFormattedMr: item.dateFormattedMr || '',
      location: item.location || '',
      badge: item.badge || '',
      description: item.description || '',
      descriptionMr: item.descriptionMr || '',
      status: item.status || 'PUBLISHED',
      showOnDashboard: onCitizenHome(item, dashboardWorkOrder),
      pinFirst: Number(item.orderIndex) === 0,
    });
    setItemModalOpen(true);
  };

  // Save Work / Video Item
  const handleSaveItem = async (e) => {
    e?.preventDefault();
    if (!effectiveWardId) {
      showToast(isMr ? 'कृपया आधी वॉर्ड निवडा.' : 'Select a ward before adding works.', 'error');
      return;
    }
      if (!itemFormData.title?.trim() && !itemFormData.titleMr?.trim()) {
      showToast(isMr ? 'कृपया कामाचे शीर्षक लिहा' : 'Please enter a work title', 'error');
      return;
    }
    if (itemFormData.mediaType === 'video' && !itemFormData.videoUrl) {
      showToast(isMr ? 'कृपया व्हिडीओ URL द्या' : 'Please add a video URL.', 'error');
      return;
    }
    if (itemFormData.mediaType !== 'video' && !itemFormData.mediaUrl) {
      showToast(isMr ? 'कृपया कामाचा फोटो अपलोड करा' : 'Please upload a work photo.', 'error');
      return;
    }

    setSaving(true);
    try {
      const resolvedCategory = itemFormData.mediaType === 'video'
        ? 'VIDEOS'
        : (itemFormData.category === 'VIDEOS' ? 'DEVELOPMENT' : itemFormData.category);
      const catObj = CATEGORIES.find((c) => c.id === resolvedCategory) || CATEGORIES[0];
      const workDate = itemFormData.date || new Date().toISOString().split('T')[0];
      const { pinFirst, videoUploading, ...itemFields } = itemFormData;
      const payload = {
        ...itemFields,
        nagarsevakUserId: editorPanelId || representative?.id || portalConfig?.featuredNagarsevakUserId || null,
        showOnDashboard: !!itemFormData.showOnDashboard,
        title: (itemFormData.title || itemFormData.titleMr || '').trim(),
        titleMr: (itemFormData.titleMr || itemFormData.title || '').trim(),
        category: resolvedCategory,
        wardId: effectiveWardId,
        date: workDate,
        dateFormatted: itemFormData.dateFormatted || formatWorkDate(workDate, 'en-IN'),
        dateFormattedMr: itemFormData.dateFormattedMr || formatWorkDate(workDate, 'mr-IN'),
        categoryLabel: catObj.labelEn,
        categoryLabelMr: catObj.labelMr,
      };
      if (pinFirst) payload.orderIndex = 0;
      else if (editingItem && Number.isFinite(Number(editingItem.orderIndex))) payload.orderIndex = Number(editingItem.orderIndex);

      let savedId = editingItem?.id;
      if (editingItem) {
        await api.updateGalleryItem(editingItem.id, payload);
        showToast(isMr ? 'विकास काम अपडेट झाले!' : 'Work item updated successfully!');
      } else {
        const created = await api.createGalleryItem(payload);
        savedId = created?.data?.id || created?.id;
        showToast(isMr ? 'नवीन काम/व्हिडीओ गॅलरीत जोडले गेले!' : 'New work/video added to gallery!');
      }

      if (pinFirst && savedId) {
        const others = galleryItems.filter((it) => String(it.id) !== String(savedId));
        await api.reorderGalleryItems([
          { id: savedId, orderIndex: 0 },
          ...others.map((it, idx) => ({ id: it.id, orderIndex: idx + 1 })),
        ], effectiveWardId);
      }

      if (savedId) {
        const sid = String(savedId);
        const nextOrder = payload.showOnDashboard
          ? [...dashboardWorkOrder.filter((id) => id !== sid), sid]
          : dashboardWorkOrder.filter((id) => id !== sid);
        setDashboardWorkOrder(nextOrder);
        await api.updatePortalConfig({
          wardId: effectiveWardId,
          nagarsevakUserId: editorPanelId || representative?.id || null,
          dashboardWorkOrder: nextOrder,
        });
      }

      setItemModalOpen(false);
      notifyPortalUpdated();
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save gallery item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Work Item
  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setSaving(true);
    try {
      await api.deleteGalleryItem(deletingItem.id);
      showToast(isMr ? 'काम गॅलरीतून हटविले.' : 'Item removed from gallery.');
      setDeletingItem(null);
      notifyPortalUpdated();
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Published / Draft status
  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.updateGalleryItem(item.id, { status: nextStatus });
      setGalleryItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it))
      );
      notifyPortalUpdated();
      showToast(
        nextStatus === 'PUBLISHED'
          ? (isMr ? 'काम नागरिकांसाठी प्रकाशित झाले!' : 'Published for citizens!')
          : (isMr ? 'काम मसुद्यात (Draft) हलविले.' : 'Moved to drafts.')
      );
    } catch (err) {
      showToast(err.message || 'Status update failed.', 'error');
    }
  };

  // Toggle Show on Citizen Dashboard directly
  const handleToggleDashboard = async (item) => {
    const nextVal = !onCitizenHome(item, dashboardWorkOrder);
    const itemId = String(item.id);
    const nextOrder = nextVal
      ? [...dashboardWorkOrder.filter((id) => id !== itemId), itemId]
      : dashboardWorkOrder.filter((id) => id !== itemId);
    try {
      setGalleryItems((prev) =>
        prev.map((it) => (String(it.id) === itemId ? { ...it, showOnDashboard: nextVal } : it))
      );
      setDashboardWorkOrder(nextOrder);
      await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        dashboardWorkOrder: nextOrder,
      });
      try {
        await api.updateGalleryItem(item.id, { showOnDashboard: nextVal ? 1 : 0 });
      } catch {
        /* Home list still uses dashboardWorkOrder if the flag write fails */
      }
      notifyPortalUpdated();
      showToast(
        nextVal
          ? (isMr ? 'हे काम नागरिक डॅशबोर्डवर जोडले!' : 'Featured on Citizen Dashboard!')
          : (isMr ? 'काम डॅशबोर्डवरून हटविले (गॅलरीत कायम).' : 'Removed from Dashboard (remains in Gallery).')
      );
    } catch (err) {
      showToast(err.message || 'Failed to update dashboard visibility.', 'error');
    }
  };

  const persistDashboardOrder = async (ids) => {
    const unique = [...new Set((ids || []).map(String))];
    setDashboardWorkOrder(unique);
    setSaving(true);
    try {
      await api.updatePortalConfig({
        wardId: effectiveWardId,
        nagarsevakUserId: editorPanelId || representative?.id || null,
        dashboardWorkOrder: unique,
      });
      setOrderDirty(false);
      notifyPortalUpdated();
      showToast(isMr ? 'डॅशबोर्ड कार्ड क्रम सेव्ह झाला.' : 'Dashboard card sequence saved.');
    } catch (err) {
      setOrderDirty(true);
      showToast(err.message || 'Could not save dashboard order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const persistGalleryOrder = async (orderedItems) => {
    const payload = orderedItems.map((item, idx) => ({ id: item.id, orderIndex: idx }));
    setGalleryItems(orderedItems.map((item, idx) => ({ ...item, orderIndex: idx })));
    setSaving(true);
    try {
      await api.reorderGalleryItems(payload, effectiveWardId);
      setOrderDirty(false);
      notifyPortalUpdated();
      showToast(isMr ? 'गॅलरी कार्ड क्रम सेव्ह झाला.' : 'Gallery card sequence saved.');
    } catch (err) {
      setOrderDirty(true);
      showToast(err.message || 'Could not save gallery order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const persistCardOrder = async (orderedItems) => {
    if (galleryFilter === 'DASHBOARD') {
      await persistDashboardOrder(orderedItems.map((item) => String(item.id)));
      return;
    }
    await persistGalleryOrder(orderedItems);
  };

  const handleDropOnCard = (targetId) => {
    if (!dragItemId || dragItemId === targetId) {
      setDragItemId(null);
      return;
    }
    const visible = [...filteredWorks];
    const from = visible.findIndex((it) => String(it.id) === String(dragItemId));
    const to = visible.findIndex((it) => String(it.id) === String(targetId));
    if (from < 0 || to < 0) {
      setDragItemId(null);
      return;
    }
    const [moved] = visible.splice(from, 1);
    visible.splice(to, 0, moved);
    setDragItemId(null);
    if (galleryFilter === 'DASHBOARD') {
      persistCardOrder(visible);
      return;
    }
    const visIds = new Set(visible.map((it) => String(it.id)));
    const rest = galleryItems
      .filter((it) => !visIds.has(String(it.id)))
      .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
    persistCardOrder([...visible, ...rest]);
  };

  const handleMoveOrder = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= filteredWorks.length) return;
    if (galleryFilter === 'DASHBOARD') {
      const ids = filteredWorks.map((it) => String(it.id));
      const [moved] = ids.splice(index, 1);
      ids.splice(targetIndex, 0, moved);
      setDashboardWorkOrder(ids);
      persistDashboardOrder(ids);
      return;
    }
    const itemA = filteredWorks[index];
    const itemB = filteredWorks[targetIndex];
    const sorted = [...galleryItems].sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
    const idxA = sorted.findIndex((it) => it.id === itemA.id);
    const idxB = sorted.findIndex((it) => it.id === itemB.id);
    if (idxA === -1 || idxB === -1) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(idxA, 1);
    reordered.splice(idxB, 0, moved);
    setGalleryItems(reordered.map((item, idx) => ({ ...item, orderIndex: idx })));
    setOrderDirty(true);
  };

  const handleSaveOrder = async () => {
    if (galleryFilter === 'DASHBOARD') {
      await persistDashboardOrder(filteredWorks.map((it) => String(it.id)));
      return;
    }
    const payload = [...galleryItems]
      .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
    await persistGalleryOrder(payload);
  };

  // Filtered gallery items
  const filteredWorks = useMemo(() => {
    return galleryItems
      .filter((item) => {
      const matchCat =
        galleryFilter === 'ALL'
          ? true
          : galleryFilter === 'DASHBOARD'
          ? onCitizenHome(item, dashboardWorkOrder)
          : galleryFilter === 'VIDEOS'
          ? item.mediaType === 'video' || !!item.videoUrl || (item.category || '').toUpperCase() === 'VIDEOS'
          : (item.category || '').toUpperCase() === galleryFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.titleMr && item.titleMr.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q));

      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (galleryFilter === 'DASHBOARD') {
        const ia = dashboardWorkOrder.indexOf(String(a.id));
        const ib = dashboardWorkOrder.indexOf(String(b.id));
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }
      return Number(a.orderIndex || 0) - Number(b.orderIndex || 0);
    });
  }, [galleryItems, galleryFilter, searchQuery, dashboardWorkOrder]);

  const portalKpis = useMemo(() => {
    const hasUrl = (u) => !!(u && String(u).trim() && String(u) !== '/hero-ward-default.jpg');
    return {
      banners: [portalConfig?.heroBannerUrl, portalConfig?.complaintsBannerUrl, portalConfig?.galleryBannerUrl].filter(hasUrl).length,
      nagarsevak: representative ? 1 : 0,
      works: galleryItems.length,
      home: galleryItems.filter((it) => onCitizenHome(it, dashboardWorkOrder)).length
    };
  }, [portalConfig, representative, galleryItems, dashboardWorkOrder]);

  return (
    <div className="admin-data-page portal-management-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'नागरिक पोर्टल' : 'Citizen portal'}
        title={isMr ? 'पोर्टल व्यवस्थापन' : 'Portal Management'}
        subtitle={
          isMr
            ? 'नगरसेवक पॅनेल निवडा, मग त्या पॅनेलचे बॅनर, प्रोफाइल आणि कामे स्वतंत्र प्रकाशित करा.'
            : 'Pick a Nagarsevak panel, then publish banners, profile and works for that panel only.'
        }
        action={
          <div className="portal-header-actions">
            <a
              href={`/citizen-portal${effectiveWardId ? `?wardId=${effectiveWardId}` : ''}${editorPanelId ? `&nagarsevakId=${editorPanelId}` : ''}&preview=citizen`}
              target="_blank"
              rel="noreferrer"
              className="primary-btn portal-preview-btn"
              title={isMr ? 'निवडलेल्या वॉर्डचे नागरिक पोर्टल पहा' : 'View citizen portal for selected ward'}
            >
              <EyeIcon size={14} />
              <span>{isMr ? 'पोर्टल पहा' : 'View portal'}</span>
              <ExternalLinkIcon size={12} />
            </a>
          </div>
        }
      />
      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${activeTab === 'HERO' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('HERO')}
        >
          <div className="team-kpi-icon blue">
            <FileTextIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{needsWardPick || loading ? '…' : `${portalKpis.banners}/3`}</div>
            <div className="team-kpi-label">{isMr ? 'कस्टम बॅनर' : 'Custom Banners'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${activeTab === 'REPRESENTATIVE' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('REPRESENTATIVE')}
        >
          <div className="team-kpi-icon green">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{needsWardPick || loading ? '…' : portalKpis.nagarsevak}</div>
            <div className="team-kpi-label">{isMr ? 'नगरसेवक प्रोफाइल' : 'Nagarsevak Profile'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${activeTab === 'WORKS' && galleryFilter !== 'DASHBOARD' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setActiveTab('WORKS');
            setGalleryFilter('ALL');
          }}
        >
          <div className="team-kpi-icon purple">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{needsWardPick || loading ? '…' : portalKpis.works}</div>
            <div className="team-kpi-label">{isMr ? 'विकास कामे' : 'Public Works'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${activeTab === 'WORKS' && galleryFilter === 'DASHBOARD' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setActiveTab('WORKS');
            setGalleryFilter('DASHBOARD');
          }}
        >
          <div className="team-kpi-icon amber">
            <HomeIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{needsWardPick || loading ? '…' : portalKpis.home}</div>
            <div className="team-kpi-label">{isMr ? 'नागरिक होम' : 'On Citizen Home'}</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            {activeTab === 'WORKS' && (
              <div className="exec-search-box">
                <SearchIcon size={15} />
                <input
                  placeholder={isMr ? 'कामे, ठिकाण किंवा बॅज शोधा…' : 'Search works, location or badge…'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="exec-quick-ward">
              <WardFilter compact label="" />
            </div>
            <div className="exec-quick-ward portal-panel-picker">
              <SearchableSelect
                compact
                label=""
                disabled={needsWardPick || isNagarsevak(user) || !nagarsevaks.length}
                value={editorPanelId}
                onChange={handleEditorPanel}
                options={nagarsevaks.map((n) => ({
                  value: n.id,
                  label: `${n.name}${n.wardSeat ? ` · ${n.wardSeat}` : ''}${n.mobile ? ` · ${n.mobile}` : ''}`,
                  title: n.name,
                  hint: [n.wardSeat, n.mobile].filter(Boolean).join(' · '),
                }))}
                placeholder={isMr ? 'कोणत्या नगरसेवकाचे पॅनेल संपादित करायचे?' : 'Which Nagarsevak panel to edit'}
                searchPlaceholder={isMr ? 'नगरसेवक शोधा…' : 'Search Nagarsevak…'}
                clearable={false}
              />
            </div>
          </div>
        </div>
      </div>

      {needsWardPick && (
        <p className="ward-portal-hint">
          {isMr
            ? 'पोर्टल संपादनासाठी वॉर्ड निवडा. प्रत्येक वॉर्डची बॅनर, प्रोफाइल आणि कामे स्वतंत्र आहेत.'
            : 'Select a ward, then choose which Nagarsevak panel to edit. Banners, profile and works are stored per panel.'}
        </p>
      )}

      <div className="portal-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'HERO'}
          className={`portal-tab-btn ${activeTab === 'HERO' ? 'active' : ''}`}
          onClick={() => setActiveTab('HERO')}
        >
          <FileTextIcon size={15} />
          <span>{isMr ? 'बॅनर' : 'Banners'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'REPRESENTATIVE'}
          className={`portal-tab-btn ${activeTab === 'REPRESENTATIVE' ? 'active' : ''}`}
          onClick={() => setActiveTab('REPRESENTATIVE')}
        >
          <UsersIcon size={15} />
          <span>{isMr ? 'नगरसेवक' : 'Nagarsevak'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'WORKS'}
          className={`portal-tab-btn ${activeTab === 'WORKS' ? 'active' : ''}`}
          onClick={() => setActiveTab('WORKS')}
        >
          <BuildingIcon size={15} />
          <span>{isMr ? 'कामे' : 'Works'}</span>
          <span className="tab-count-pill">{galleryItems.length}</span>
        </button>
      </div>

      {needsWardPick ? (
        <div className="portal-tab-content">
          <div className="portal-card" style={{ padding: 28 }}>
            <Empty>
              {isMr
                ? 'नागरिक पोर्टल संपादित करण्यासाठी आधी वॉर्ड निवडा. प्रत्येक वॉर्डची हिरो, गॅलरी आणि नगरसेवक माहिती स्वतंत्र आहे.'
                : 'Select a ward first. Each ward has its own citizen hero, gallery, and nagarsevak profile.'}
            </Empty>
          </div>
        </div>
      ) : loading ? (
        <div className="portal-loading-container">
          <Loading />
          <p>{isMr ? 'पोर्टल माहिती लोड होत आहे...' : 'Loading portal configuration...'}</p>
        </div>
      ) : error ? (
        <div className="portal-error-box">
          <button className="primary-btn" onClick={loadData}>{isMr ? 'पुन्हा प्रयत्न करा' : 'Retry'}</button>
        </div>
      ) : (
        <div className="portal-tab-content">
          {/* ============================================================== */}
          {/* TAB 1: HERO STUDIO */}
          {/* ============================================================== */}
          {activeTab === 'HERO' && (
            <div className="portal-hero-studio">
              <div className="portal-studio-layout">
                {/* Editor Form */}
                <form className="portal-card portal-form-card" onSubmit={handleSavePortalConfig}>
                  <div className="portal-card-header" style={{ marginBottom: 16 }}>
                    <h3>{isMr ? 'बॅनर व स्वागत मजकूर' : 'Banners & welcome copy'}</h3>
                    <p>{isMr ? 'नागरिक होम, तक्रार आणि गॅलरी पानांसाठी बॅनर व शीर्षक येथे सेट करा.' : 'Set banners and headlines for citizen Home, Complaints and Gallery.'}</p>
                  </div>

                  {/* Subnav for Banner Studio: Modern Segmented Grid Nav */}
                  <div className="banner-studio-grid-nav">
                    <button
                      type="button"
                      className={`studio-tab-card ${bannerSubTab === 'HOME' ? 'active' : ''}`}
                      onClick={() => setBannerSubTab('HOME')}
                    >
                      <div className="tab-card-top">
                        <span className="tab-card-icon home">🏠</span>
                        <span className={`tab-card-badge ${isGenericDefaultHero(portalConfig?.heroBannerUrl) ? 'default' : 'custom'}`}>
                          {isGenericDefaultHero(portalConfig?.heroBannerUrl) ? (isMr ? 'डिफॉल्ट' : 'Default') : (isMr ? 'सक्रिय' : 'Active')}
                        </span>
                      </div>
                      <div className="tab-card-content">
                        <strong className="tab-card-title">{isMr ? 'होम बॅनर' : 'Home Banner'}</strong>
                        <span className="tab-card-sub">{isMr ? 'नागरिक डॅशबोर्ड · 1440×600' : 'Dashboard Hero · 1440×600'}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`studio-tab-card ${bannerSubTab === 'COMPLAINTS' ? 'active' : ''}`}
                      onClick={() => setBannerSubTab('COMPLAINTS')}
                    >
                      <div className="tab-card-top">
                        <span className="tab-card-icon complaints">📣</span>
                        <span className={`tab-card-badge ${portalConfig?.complaintsBannerUrl ? 'custom' : 'default'}`}>
                          {portalConfig?.complaintsBannerUrl ? (isMr ? 'सक्रिय' : 'Active') : (isMr ? 'होम बॅनर' : 'From Home')}
                        </span>
                      </div>
                      <div className="tab-card-content">
                        <strong className="tab-card-title">{isMr ? 'तक्रार बॅनर' : 'Complaints Banner'}</strong>
                        <span className="tab-card-sub">{isMr ? 'तक्रार निवारण · 1440×500' : 'Grievance Desk · 1440×500'}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`studio-tab-card ${bannerSubTab === 'GALLERY' ? 'active' : ''}`}
                      onClick={() => setBannerSubTab('GALLERY')}
                    >
                      <div className="tab-card-top">
                        <span className="tab-card-icon gallery">🖼️</span>
                        <span className={`tab-card-badge ${portalConfig?.galleryBannerUrl ? 'custom' : 'default'}`}>
                          {portalConfig?.galleryBannerUrl ? (isMr ? 'सक्रिय' : 'Active') : (isMr ? 'होम बॅनर' : 'From Home')}
                        </span>
                      </div>
                      <div className="tab-card-content">
                        <strong className="tab-card-title">{isMr ? 'गॅलरी बॅनर' : 'Gallery Banner'}</strong>
                        <span className="tab-card-sub">{isMr ? 'विकास कामे गॅलरी · 1440×500' : 'Ward Works · 1440×500'}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`studio-tab-card ${bannerSubTab === 'HEADLINES' ? 'active' : ''}`}
                      onClick={() => setBannerSubTab('HEADLINES')}
                    >
                      <div className="tab-card-top">
                        <span className="tab-card-icon copy">✍️</span>
                        <span className="tab-card-badge neutral">{isMr ? 'मजकूर' : 'Copy'}</span>
                      </div>
                      <div className="tab-card-content">
                        <strong className="tab-card-title">{isMr ? 'स्वागत मथळा व बटणे' : 'Headlines & CTA'}</strong>
                        <span className="tab-card-sub">{isMr ? 'स्वागत संदेश व कृती बटणे' : 'Welcome text & action buttons'}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`studio-tab-card view-all ${bannerSubTab === 'ALL' ? 'active' : ''}`}
                      onClick={() => setBannerSubTab('ALL')}
                    >
                      <div className="tab-card-top">
                        <span className="tab-card-icon all">📑</span>
                        <span className="tab-card-badge neutral">{isMr ? 'एकत्र' : 'All'}</span>
                      </div>
                      <div className="tab-card-content">
                        <strong className="tab-card-title">{isMr ? 'सर्व पर्याय' : 'View All'}</strong>
                        <span className="tab-card-sub">{isMr ? 'सर्व बॅनर एकाच पानात' : 'All sections on one screen'}</span>
                      </div>
                    </button>
                  </div>

                  {/* Section 1: Hero Banner Image Selection */}
                  {(bannerSubTab === 'HOME' || bannerSubTab === 'ALL') && (
                    <div className="form-section-box">
                      <div className="studio-section-banner-head">
                        <div className="studio-head-left">
                          <div className="studio-head-icon home">
                            <span>🏠</span>
                          </div>
                          <div className="studio-head-info">
                            <h3 className="studio-head-title">
                              {isMr ? 'होम बॅनर (नागरिक डॅशबोर्ड)' : 'Home Dashboard Hero Banner'}
                            </h3>
                            <p className="studio-head-meta">
                              <span className="meta-spec">📐 <strong>1440 × 600 px</strong> (2.4 : 1)</span>
                              <span className="meta-sep">•</span>
                              <span className="meta-desc">{isMr ? 'नागरिक पोर्टलवर मुख्य पानावर सर्वात वर दिसेल' : 'Top hero on citizen home'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="studio-head-right">
                          <span className={`studio-status-pill ${isGenericDefaultHero(portalConfig?.heroBannerUrl) ? 'is-default' : 'is-active'}`}>
                            {isGenericDefaultHero(portalConfig?.heroBannerUrl) ? (isMr ? '🏛️ अधिकृत महापालिका बॅनर' : '🏛️ Civic Default') : (isMr ? '✅ सक्रिय कस्टम बॅनर' : '✅ Active Custom Banner')}
                          </span>
                        </div>
                      </div>

                      <ImageCropField
                        key={`hero-${editorPanelId || 'none'}`}
                        label=""
                        value={portalConfig?.heroBannerUrl || '/hero-ward-default.jpg'}
                        onChange={(next) => {
                          setPortalConfig((prev) => ({ ...prev, heroBannerUrl: next || '/hero-ward-default.jpg' }));
                        }}
                        aspect={CITIZEN_HERO_ASPECT}
                        variant="hero"
                        outputWidth={1440}
                        uploadLabel={isMr ? 'Home बॅनर अपलोड करा' : 'Upload Home Banner'}
                        adjustLabel={isMr ? 'क्रॉप' : 'Crop'}
                        hint={isMr ? 'हाच आकार नागरिक Home वर दिसेल.' : 'This is the same size residents see on Home.'}
                      />

                      <div className="portal-section-save" style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="primary-btn" disabled={saving} onClick={handleSaveHeroBanner}>
                          {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'होम बॅनर सेव्ह करा' : 'Save home banner')}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn-xs"
                          onClick={async () => {
                            setPortalConfig((prev) => ({ ...prev, heroBannerUrl: '/hero-ward-default.jpg' }));
                            if (!effectiveWardId) return;
                            try {
                              setSaving(true);
                              await api.updatePortalConfig({
                                wardId: effectiveWardId,
                                nagarsevakUserId: editorPanelId || representative?.id || null,
                                heroBannerUrl: '/hero-ward-default.jpg',
                                useCivicHero: true,
                              });
                              notifyPortalUpdated(effectiveWardId);
                              setPortalConfig((prev) => ({ ...prev, heroBannerUrl: '/hero-ward-default.jpg' }));
                              showToast(isMr ? 'या पॅनेलवर अधिकृत महापालिका बॅनर सेट झाला.' : 'Official civic banner set for this panel.');
                            } catch (err) {
                              showToast(err.message || 'Could not reset banner.', 'error');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          title={isMr ? 'अधिकृत महापालिका बॅनर वापरा' : 'Reset to official municipal civic banner'}
                        >
                          🏛️ {isMr ? 'अधिकृत महापालिका बॅनर वापरा' : 'Reset to Official Civic Banner'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section: Complaints Banner */}
                  {(bannerSubTab === 'COMPLAINTS' || bannerSubTab === 'ALL') && (
                    <div className="form-section-box">
                      <div className="studio-section-banner-head">
                        <div className="studio-head-left">
                          <div className="studio-head-icon complaints">
                            <span>📣</span>
                          </div>
                          <div className="studio-head-info">
                            <h3 className="studio-head-title">
                              {isMr ? 'तक्रार निवारण बॅनर' : 'Complaints & Grievance Banner'}
                            </h3>
                            <p className="studio-head-meta">
                              <span className="meta-spec">📐 <strong>1440 × 500 px</strong> (2.88 : 1)</span>
                              <span className="meta-sep">•</span>
                              <span className="meta-desc">{isMr ? 'नागरिक तक्रार नोंदणी पानावर वर दिसेल' : 'Displayed on citizen complaints desk'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="studio-head-right">
                          <span className={`studio-status-pill ${portalConfig?.complaintsBannerUrl ? 'is-active' : 'is-default'}`}>
                            {portalConfig?.complaintsBannerUrl ? (isMr ? '✅ स्वतंत्र बॅनर सक्रिय' : '✅ Custom Banner') : (isMr ? 'ℹ️ होम बॅनर वापरला जाईल' : 'ℹ️ Defaulting to Home')}
                          </span>
                        </div>
                      </div>

                      <ImageCropField
                        key={`complaints-${editorPanelId || 'none'}`}
                        label=""
                        value={portalConfig?.complaintsBannerUrl || ''}
                        onChange={(next) => {
                          setPortalConfig((prev) => ({ ...prev, complaintsBannerUrl: next || '' }));
                        }}
                        aspect={COMPLAINTS_BANNER_ASPECT}
                        variant="hero"
                        outputWidth={1440}
                        uploadLabel={isMr ? 'तक्रार बॅनर अपलोड करा' : 'Upload complaints banner'}
                        adjustLabel={isMr ? 'क्रॉप' : 'Crop'}
                        hint={isMr ? 'हाच आकार नागरिक तक्रार पानावर दिसेल.' : 'This is the same size residents see on Complaints.'}
                      />
                      <div className="portal-section-save" style={{ marginTop: 14 }}>
                        <button type="button" className="primary-btn" disabled={saving} onClick={handleSaveComplaintsBanner}>
                          {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'तक्रार बॅनर सेव्ह करा' : 'Save complaints banner')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section: Gallery Banner */}
                  {(bannerSubTab === 'GALLERY' || bannerSubTab === 'ALL') && (
                    <div className="form-section-box">
                      <div className="studio-section-banner-head">
                        <div className="studio-head-left">
                          <div className="studio-head-icon gallery">
                            <span>🖼️</span>
                          </div>
                          <div className="studio-head-info">
                            <h3 className="studio-head-title">
                              {isMr ? 'विकास कामे गॅलरी बॅनर' : 'Ward Development Gallery Banner'}
                            </h3>
                            <p className="studio-head-meta">
                              <span className="meta-spec">📐 <strong>1440 × 500 px</strong> (2.88 : 1)</span>
                              <span className="meta-sep">•</span>
                              <span className="meta-desc">{isMr ? 'नागरिक विकास कामे गॅलरी पानावर सर्वात वर दिसेल' : 'Top hero on citizen public works gallery'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="studio-head-right">
                          <span className={`studio-status-pill ${portalConfig?.galleryBannerUrl ? 'is-active' : 'is-default'}`}>
                            {portalConfig?.galleryBannerUrl ? (isMr ? '✅ स्वतंत्र बॅनर सक्रिय' : '✅ Custom Banner') : (isMr ? 'ℹ️ होम बॅनर वापरला जाईल' : 'ℹ️ Defaulting to Home')}
                          </span>
                        </div>
                      </div>

                      <ImageCropField
                        key={`gallery-${editorPanelId || 'none'}`}
                        label=""
                        value={portalConfig?.galleryBannerUrl || ''}
                        onChange={(next) => {
                          setPortalConfig((prev) => ({ ...prev, galleryBannerUrl: next || '' }));
                        }}
                        aspect={GALLERY_BANNER_ASPECT}
                        variant="hero"
                        outputWidth={1440}
                        uploadLabel={isMr ? 'गॅलरी बॅनर अपलोड करा' : 'Upload gallery banner'}
                        adjustLabel={isMr ? 'क्रॉप' : 'Crop'}
                        hint={isMr ? 'हाच आकार नागरिक गॅलरी पानावर दिसेल.' : 'This is the same size residents see on Gallery.'}
                      />
                      <div className="portal-section-save" style={{ marginTop: 14 }}>
                        <button type="button" className="primary-btn" disabled={saving} onClick={handleSaveGalleryBanner}>
                          {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'गॅलरी बॅनर सेव्ह करा' : 'Save gallery banner')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Welcome Headlines */}
                  {(bannerSubTab === 'HEADLINES' || bannerSubTab === 'ALL') && (
                    <>
                      <div className="form-section-box">
                        <div className="form-section-header">
                          <span className="form-section-title">
                            <span>✨</span>
                            <span>{isMr ? 'स्वागत मथळा (Welcome Headline)' : 'Welcome Headlines'}</span>
                          </span>
                          <span className="form-section-tag">{isMr ? 'द्विभाषिक' : 'Dual Language'}</span>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'मुख्य मथळा (इंग्रजी)' : 'Welcome Title (English)'}</label>
                            <div className="input-with-lang-badge">
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.heroTitleEn || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, heroTitleEn: e.target.value }))}
                                placeholder="Welcome"
                              />
                              <span className="lang-corner-badge">EN</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'मुख्य मथळा (मराठी)' : 'Welcome Title (Marathi)'}</label>
                            <div className="input-with-lang-badge">
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.heroTitleMr || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, heroTitleMr: e.target.value }))}
                                placeholder="स्वागत आहे"
                              />
                              <span className="lang-corner-badge">MR</span>
                            </div>
                          </div>
                        </div>
                        <small className="field-hint">
                          {isMr ? 'टिप: {name} वापरून नागरिकाचे नाव थेट दाखवता येते (उदा. "स्वागत आहे, {name}")' : 'Tip: Use {name} for citizen personalization (e.g. "Welcome, {name}.")'}
                        </small>
                      </div>

                      {/* Section 3: Subtitles / Descriptions */}
                      <div className="form-section-box">
                        <div className="form-section-header">
                          <span className="form-section-title">
                            <span>📝</span>
                            <span>{isMr ? 'पोर्टल वर्णन / सबटायटल' : 'Portal Subtitles / Descriptions'}</span>
                          </span>
                          <span className="form-section-tag">{isMr ? 'द्विभाषिक' : 'Dual Language'}</span>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'वर्णन (इंग्रजी)' : 'Hero Subtitle (English)'}</label>
                            <div className="input-with-lang-badge">
                              <textarea
                                rows={3}
                                className="form-control"
                                value={portalConfig?.heroSubtitleEn || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, heroSubtitleEn: e.target.value }))}
                                placeholder="WardSetu is your digital ward desk for complaints, schemes and notices..."
                              />
                              <span className="lang-corner-badge">EN</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'वर्णन (मराठी)' : 'Hero Subtitle (Marathi)'}</label>
                            <div className="input-with-lang-badge">
                              <textarea
                                rows={3}
                                className="form-control"
                                value={portalConfig?.heroSubtitleMr || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, heroSubtitleMr: e.target.value }))}
                                placeholder="तुमच्या वॉर्डमधील अपडेट्स, कार्यक्रम, योजना आणि तक्रारींची माहिती एका ठिकाणी..."
                              />
                              <span className="lang-corner-badge">MR</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: CTA Action Buttons */}
                      <div className="form-section-box">
                        <div className="form-section-header">
                          <span className="form-section-title">
                            <span>🔘</span>
                            <span>{isMr ? 'कृती बटणे (Call To Action)' : 'Hero Action Buttons (CTA)'}</span>
                          </span>
                          <span className="form-section-tag">{isMr ? 'नेव्हिगेशन' : 'Actions'}</span>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'बटण १ (इंग्रजी व मराठी)' : 'Primary Button 1 (EN / MR)'}</label>
                            <div className="input-group-dual">
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.ctaPrimaryTextEn || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, ctaPrimaryTextEn: e.target.value }))}
                                placeholder="Raise a complaint"
                              />
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.ctaPrimaryTextMr || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, ctaPrimaryTextMr: e.target.value }))}
                                placeholder="तक्रार नोंदवा"
                              />
                            </div>
                            <small className="field-hint">{isMr ? 'लक्ष्य URL: /my-complaints' : 'Target URL: /my-complaints'}</small>
                          </div>

                          <div className="form-group">
                            <label className="form-label">{isMr ? 'बटण २ (इंग्रजी व मराठी)' : 'Secondary Button 2 (EN / MR)'}</label>
                            <div className="input-group-dual">
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.ctaSecondaryTextEn || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, ctaSecondaryTextEn: e.target.value }))}
                                placeholder="View Work"
                              />
                              <input
                                type="text"
                                className="form-control"
                                value={portalConfig?.ctaSecondaryTextMr || ''}
                                onChange={(e) => setPortalConfig((prev) => ({ ...prev, ctaSecondaryTextMr: e.target.value }))}
                                placeholder="विकास कामे पहा"
                              />
                            </div>
                            <small className="field-hint">{isMr ? 'लक्ष्य URL: /gallery' : 'Target URL: /gallery'}</small>
                          </div>
                        </div>

                        <div className="portal-section-save" style={{ marginTop: 14 }}>
                          <button type="button" className="primary-btn" disabled={saving} onClick={handleSavePortalConfig}>
                            {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'मथळा व कृती बटणे सेव्ह करा' : 'Save headlines & buttons')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: DEVELOPMENT WORKS & GALLERY */}
          {/* ============================================================== */}
          {activeTab === 'WORKS' && (
              <div className="portal-works-studio">
              <div className="works-mode-switch" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`works-mode-btn ${galleryFilter === 'DASHBOARD' ? 'active' : ''}`}
                  onClick={() => setGalleryFilter('DASHBOARD')}
                >
                  <strong>{isMr ? '१. नागरिक मुख्य पान' : '1. Citizen home'}</strong>
                  <span>{isMr ? `${galleryItems.filter((it) => onCitizenHome(it, dashboardWorkOrder)).length} कार्ड · फक्त स्टार असलेली` : `${galleryItems.filter((it) => onCitizenHome(it, dashboardWorkOrder)).length} cards · starred only`}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`works-mode-btn ${galleryFilter !== 'DASHBOARD' ? 'active' : ''}`}
                  onClick={() => setGalleryFilter('ALL')}
                >
                  <strong>{isMr ? '२. गॅलरी' : '2. Gallery page'}</strong>
                  <span>{isMr ? `${galleryItems.length} कार्ड · सर्व फोटो/व्हिडीओ` : `${galleryItems.length} cards · all photos/videos`}</span>
                </button>
              </div>
              <div className="portal-works-hint">
                {galleryFilter === 'DASHBOARD'
                  ? (isMr
                    ? 'हे कार्ड नागरिक Home वर दिसतात. क्रम बदलण्यासाठी ओढा. नवीन काम जोडण्यासाठी “गॅलरी” टॅब उघडा आणि ☆ डॅशबोर्डवर जोडा दाबा.'
                    : 'These cards appear on citizen Home. Drag to reorder. Add new work from the Gallery tab, then star ☆ Add to Dashboard.')
                  : (isMr
                    ? 'गॅलरीत सर्व कामे. “नवीन काम जोडा” ने फोटो/व्हिडीओ भरा. ☆ डॅशबोर्डवर जोडा = नागरिक Home वर दिसेल.'
                    : 'These cards appear on the Gallery page. Use Add work for photos/videos. Star a card to also show it on Home.')}
              </div>
              {/* Toolbar */}
              <div className="portal-works-toolbar">
                {galleryFilter !== 'DASHBOARD' && (
                <div className="toolbar-category-filter">
                  <button
                    type="button"
                    className={`filter-pill ${galleryFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setGalleryFilter('ALL')}
                  >
                    {isMr ? 'सर्व' : 'All'} ({galleryItems.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${galleryFilter === 'VIDEOS' ? 'active' : ''}`}
                    onClick={() => setGalleryFilter('VIDEOS')}
                  >
                    🎥 {isMr ? 'व्हिडीओ' : 'Videos'} ({galleryItems.filter((i) => i.mediaType === 'video' || i.videoUrl).length})
                  </button>
                  {CATEGORIES.filter((c) => c.id !== 'VIDEOS').map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`filter-pill ${galleryFilter === cat.id ? 'active' : ''}`}
                      onClick={() => setGalleryFilter(cat.id)}
                    >
                      {cat.icon} {isMr ? cat.labelMr : cat.labelEn}
                    </button>
                  ))}
                </div>
                )}

                <div className="works-toolbar-actions">
                  <button
                    type="button"
                    className={`primary-btn save-order-btn ${orderDirty ? 'is-dirty' : ''}`}
                    disabled={!orderDirty || saving}
                    onClick={handleSaveOrder}
                  >
                    {saving
                      ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…')
                      : galleryFilter === 'DASHBOARD'
                        ? (isMr ? 'Home क्रम सेव्ह करा' : 'Save home order')
                        : (isMr ? 'गॅलरी क्रम सेव्ह करा' : 'Save gallery order')}
                  </button>
                  {galleryFilter !== 'DASHBOARD' && (
                  <button type="button" className="primary-btn add-work-btn" onClick={openAddModal}>
                    <span>＋</span>
                    <span>{isMr ? 'नवीन काम जोडा' : 'Add work'}</span>
                  </button>
                  )}
                </div>
                {orderDirty && (
                  <div className="order-unsaved-bar">
                    {galleryFilter === 'DASHBOARD'
                      ? (isMr ? 'Home क्रम बदलला. “Home क्रम सेव्ह करा” दाबा.' : 'Home order changed. Click “Save home order”.')
                      : (isMr ? 'गॅलरी क्रम बदलला. “गॅलरी क्रम सेव्ह करा” दाबा.' : 'Gallery order changed. Click “Save gallery order”.')}
                  </div>
                )}
              </div>

              {/* Works List / Grid */}
              {filteredWorks.length === 0 ? (
                <Empty>
                  {galleryFilter === 'DASHBOARD'
                    ? (isMr ? 'Home वर अजून काही नाही. गॅलरी टॅबमधून काम जोडा आणि ☆ डॅशबोर्डवर जोडा दाबा.' : 'Nothing on Home yet. Open Gallery, add work, then star ☆ Add to Dashboard.')
                    : (isMr ? 'या वॉर्डसाठी अजून विकास कामे नाहीत. नवीन काम जोडा.' : 'No works in this ward yet. Add the first photo or video.')}
                </Empty>
              ) : (
                <div className="portal-works-grid">
                  {filteredWorks.map((item, index) => {
                    const isVid = item.mediaType === 'video' || !!item.videoUrl;
                    const catObj = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
                    const isOnDashboard = onCitizenHome(item, dashboardWorkOrder);
                    return (
                      <div key={item.id} className={`work-manage-card ${item.status === 'DRAFT' ? 'is-draft' : ''} ${isOnDashboard ? 'is-on-dashboard' : ''} ${String(dragItemId) === String(item.id) ? 'is-dragging' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDropOnCard(item.id); }}>
                        <div
                          className="work-media-thumbnail"
                          style={{
                            backgroundImage: `url(${item.mediaUrl || (isVid ? '/gallery-media/road-construction.svg' : '/gallery-media/water-pipeline.svg')})`,
                          }}
                        >
                          <div className="thumbnail-badges">
                            <span className="order-number-badge" title={isMr ? `क्रम #${index + 1}` : `Display Order #${index + 1}`}>
                              #{index + 1}
                            </span>
                            <span className="category-tag">
                              {catObj.icon} {isMr ? (item.categoryLabelMr || catObj.labelMr) : (item.categoryLabel || catObj.labelEn)}
                            </span>
                            <span className={`home-pill-badge ${isOnDashboard ? 'on-home' : 'gallery-only'}`}>
                              {isOnDashboard ? (isMr ? '⭐ डॅशबोर्डवर' : '⭐ On Dashboard') : (isMr ? '📁 फक्त गॅलरी' : '📁 Gallery Only')}
                            </span>
                            <span className={`status-pill ${item.status === 'PUBLISHED' ? 'published' : 'draft'}`}>
                              {item.status === 'PUBLISHED' ? (isMr ? 'प्रकाशित' : 'Published') : (isMr ? 'मसुदा' : 'Draft')}
                            </span>
                          </div>

                          {isVid && (
                            <div className="video-indicator">
                              <span className="play-triangle">▶</span>
                              <span className="vid-duration">{item.duration || 'Video'}</span>
                            </div>
                          )}
                        </div>

                        <div className="work-card-body">
                          <div className="work-meta-row">
                            <span className="work-date">📅 {item.dateFormatted || item.date || '—'}</span>
                            {item.location && <span className="work-location">📍 {item.location}</span>}
                          </div>

                          <h4 className="work-card-title">{isMr ? (item.titleMr || item.title) : item.title}</h4>
                          {isMr && item.titleMr && item.title !== item.titleMr && (
                            <div className="work-card-title-alt">{item.title}</div>
                          )}

                          {item.badge && <span className="work-badge-tag">{item.badge}</span>}

                          <p className="work-card-desc">
                            {isMr ? (item.descriptionMr || item.description || '—') : (item.description || item.descriptionMr || '—')}
                          </p>

                          <div className="work-card-footer">
                            <div className="order-stepper-wrap">
                              <button
                                type="button"
                                className="drag-grip"
                                draggable
                                title={isMr ? 'ओढून क्रम बदला' : 'Drag to change sequence'}
                                onDragStart={() => setDragItemId(item.id)}
                                onDragEnd={() => setDragItemId(null)}
                              >
                                ⋮⋮
                              </button>
                              <div className="order-stepper">
                                <button
                                  type="button"
                                  className="order-btn"
                                  title={isMr ? 'वर सरकवा' : 'Move Up'}
                                  disabled={index === 0}
                                  onClick={() => handleMoveOrder(index, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="order-btn"
                                  title={isMr ? 'खाली सरकवा' : 'Move Down'}
                                  disabled={index === filteredWorks.length - 1}
                                  onClick={() => handleMoveOrder(index, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`home-toggle-btn ${isOnDashboard ? 'active' : ''}`}
                              title={isMr ? 'नागरिक डॅशबोर्डवर दाखवणे / लपवणे' : 'Toggle display on citizen dashboard'}
                              onClick={() => handleToggleDashboard(item)}
                            >
                              {isOnDashboard ? (isMr ? '⭐ मुख्य पानावर' : '⭐ On Dashboard') : (isMr ? '☆ डॅशबोर्डवर जोडा' : '☆ Add to Dashboard')}
                            </button>

                            <div className="card-action-btns">
                              <button
                                type="button"
                                className="ghost-btn-xs"
                                onClick={() => handleToggleStatus(item)}
                              >
                                {item.status === 'PUBLISHED' ? (isMr ? 'लपवा (Draft)' : 'Unpublish') : (isMr ? 'प्रकाशित करा' : 'Publish')}
                              </button>
                              <button
                                type="button"
                                className="ghost-btn-xs"
                                onClick={() => openEditModal(item)}
                              >
                                ✏️ {isMr ? 'संपादित करा' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="danger-btn-xs"
                                onClick={() => setDeletingItem(item)}
                              >
                                🗑️ {isMr ? 'हटवा' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: REPRESENTATIVE SPOTLIGHT */}
          {/* ============================================================== */}
          {activeTab === 'REPRESENTATIVE' && (
            <div className="portal-rep-studio">
              <form className="portal-card portal-form-card" onSubmit={handleSaveRepresentative}>
                <div className="portal-card-header">
                  <h3>{isMr ? 'नगरसेवक प्रोफाइल' : 'Nagarsevak profile'}</h3>
                  <p>
                    {isMr
                      ? 'वरच्या ड्रॉपडाउनमधून ज्या नगरसेवकाचे पॅनेल संपादित करायचे आहे ते निवडा. प्रत्येक पॅनेल स्वतंत्र आहे.'
                      : 'Use the dropdown above to choose which Nagarsevak panel you are editing. Each panel is independent.'}
                  </p>
                </div>
                {!activation?.wardActive && (
                  <div className="portal-purchase-note">
                    {isMr
                      ? 'हा वॉर्ड अजून Activate नाही. Ward activation वर वॉर्ड उघडा, मग इथे नगरसेवक निवडा.'
                      : 'This ward is not activated yet. Open it in Ward activation, then choose the Nagarsevak here.'}
                    <a className="portal-inline-link" href="/ward-activation">Ward activation →</a>
                  </div>
                )}
                {representative && (
                  <div className="portal-purchase-note">
                    {isMr
                      ? `संपादन: ${representative.name}${representative.wardSeat ? ` · ${representative.wardSeat}` : ''}`
                      : `Editing: ${representative.name}${representative.wardSeat ? ` · ${representative.wardSeat}` : ''}`}
                  </div>
                )}

                {!representative ? (
                  <Empty>
                    {isMr
                      ? 'या वॉर्डवर नगरसेवक नाहीत. Staff किंवा Ward activation मध्ये नगरसेवक जोडा, मग येथे त्यांचे पॅनेल संपादित करा.'
                      : 'No Nagarsevak on this ward yet. Add them in Staff or Ward activation, then edit their panel here.'}
                    <a className="portal-inline-link" href="/ward-activation">Ward activation →</a>
                  </Empty>
                ) : (
                  <>

                    <div className="rep-spotlight-layout">
                      <aside className="rep-spotlight-photo-card">
                        <CirclePhotoField
                          label={isMr ? 'चेहरा / प्रोफाइल फोटो' : 'Profile photo'}
                          name={representative?.name || 'Nagarsevak'}
                          value={representative?.photo || ''}
                          onChange={(photo) => setRepresentative((prev) => ({ ...prev, photo }))}
                          allowCamera={false}
                        />
                      </aside>

                      <div className="rep-spotlight-fields">
                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'पूर्ण नाव' : 'Full name'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.name || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="Full name of this seat only"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'राजकीय पक्ष' : 'Political party'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.partyName || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, partyName: e.target.value }))}
                              placeholder="Nationalist Congress Party"
                            />
                          </div>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'प्रभाग जागा / सीट' : 'Ward seat'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.wardSeat || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, wardSeat: e.target.value }))}
                              placeholder="3-C"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'मोबाईल' : 'Mobile'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.mobile || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, mobile: e.target.value }))}
                              placeholder="9225522255"
                            />
                          </div>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'व्हॉट्सअॅप' : 'WhatsApp'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.whatsapp || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, whatsapp: e.target.value }))}
                              placeholder="9225522255"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{isMr ? 'कार्यालय पत्ता' : 'Office address'}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={representative?.officialAddress || ''}
                              onChange={(e) => setRepresentative((prev) => ({ ...prev, officialAddress: e.target.value }))}
                              placeholder="Savedi, Ahilyanagar"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">{isMr ? 'नागरिकांसाठी संदेश' : 'Message to citizens'}</label>
                          <textarea
                            rows={3}
                            className="form-control"
                            value={representative?.bio || ''}
                            onChange={(e) => setRepresentative((prev) => ({ ...prev, bio: e.target.value }))}
                            placeholder={isMr ? 'नागरिकांसाठी संदेश लिहा' : 'Write the message residents should see'}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="portal-highlight-block">
                      <HighlightCardsEditor
                        isMr={isMr}
                        cards={representative?.achievements}
                        onChange={(next) => setRepresentative((prev) => ({ ...prev, achievements: next }))}
                      />
                    </div>

                    <div className="form-actions-footer">
                      <button type="submit" className="primary-btn portal-save-btn" disabled={saving}>
                        {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'नगरसेवक प्रोफाइल सेव्ह करा' : 'Save Nagarsevak profile')}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          )}

        </div>
      )}

      {/* ============================================================== */}
      {/* ADD / EDIT WORK ITEM MODAL */}
      {/* ============================================================== */}
      {itemModalOpen && (
        <Modal
          wide
          title={
            editingItem
              ? (isMr ? 'विकास काम संपादित करा' : 'Edit Development Work')
              : (isMr ? 'नवीन विकास काम जोडा' : 'Add Development Work')
          }
          onClose={() => setItemModalOpen(false)}
        >
          <form className="work-item-form" onSubmit={handleSaveItem}>
            <p className="work-form-lead">
              {isMr
                ? 'फोटो किंवा व्हिडीओ निवडा, शीर्षक भरा आणि नागरिकांना कुठे दिसेल ते ठरवा.'
                : 'Choose photo or video, add titles, then decide where residents will see this work.'}
            </p>

            <div className="work-form-type" role="tablist" aria-label={isMr ? 'माध्यम प्रकार' : 'Media type'}>
              <button
                type="button"
                className={`work-form-type-btn ${itemFormData.mediaType !== 'video' ? 'is-on' : ''}`}
                onClick={() => setItemFormData((prev) => ({
                  ...prev,
                  mediaType: 'image',
                  category: prev.category === 'VIDEOS' ? 'DEVELOPMENT' : prev.category,
                  badge: prev.badge === 'व्हिडीओ · VIDEO' ? 'काम पूर्ण · COMPLETED' : prev.badge,
                }))}
              >
                <strong>{isMr ? 'फोटो' : 'Photo'}</strong>
                <span>{isMr ? 'कामाचा स्थिर फोटो' : 'Still image of the work'}</span>
              </button>
              <button
                type="button"
                className={`work-form-type-btn ${itemFormData.mediaType === 'video' ? 'is-on' : ''}`}
                onClick={() => setItemFormData((prev) => ({
                  ...prev,
                  mediaType: 'video',
                  category: 'VIDEOS',
                  badge: 'व्हिडीओ · VIDEO',
                }))}
              >
                <strong>{isMr ? 'व्हिडीओ' : 'Video'}</strong>
                <span>{isMr ? 'MP4 लिंक + कव्हर' : 'MP4 link and cover'}</span>
              </button>
            </div>

            <section className="work-form-card">
              <header className="work-form-card-head">
                <strong>{isMr ? 'माध्यम' : 'Media'}</strong>
                <span>{isMr ? 'नागरिक गॅलरीत हा फोटो / कव्हर दिसेल.' : 'This is what residents see on the gallery card.'}</span>
              </header>
              {itemFormData.mediaType === 'video' ? (
                <>
                  <div className="work-video-upload">
                    {itemFormData.videoUrl && !String(itemFormData.videoUrl).startsWith('data:') ? (
                      <video
                        className="work-video-preview"
                        src={publicMediaUrl(itemFormData.videoUrl)}
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="work-video-empty">
                        {isMr ? 'व्हिडीओ अपलोड करा किंवा लिंक पेस्ट करा.' : 'Upload a video file or paste a link.'}
                      </div>
                    )}
                    <div className="work-video-actions">
                      <label className="work-video-file-btn">
                        {itemFormData.videoUploading
                          ? (isMr ? 'अपलोड होत आहे…' : 'Uploading…')
                          : (itemFormData.videoUrl ? (isMr ? 'व्हिडीओ बदला' : 'Replace video') : (isMr ? 'व्हिडीओ अपलोड करा' : 'Upload video'))}
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          disabled={!!itemFormData.videoUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            if (!String(file.type || '').startsWith('video/')) {
                              showToast(isMr ? 'कृपया व्हिडीओ फाइल निवडा.' : 'Please choose a video file.', 'error');
                              return;
                            }
                            if (file.size > 60 * 1024 * 1024) {
                              showToast(isMr ? 'व्हिडीओ ६० MB पेक्षा मोठा असू नये.' : 'Video must be 60MB or smaller.', 'error');
                              return;
                            }
                            setItemFormData((prev) => ({ ...prev, videoUploading: true }));
                            try {
                              const res = await api.uploadPortalMedia(file);
                              const url = res?.data?.url || '';
                              if (!url) throw new Error('Upload failed');
                              let duration = itemFormData.duration;
                              try {
                                const probe = document.createElement('video');
                                probe.preload = 'metadata';
                                probe.src = URL.createObjectURL(file);
                                await new Promise((resolve) => {
                                  probe.onloadedmetadata = resolve;
                                  probe.onerror = resolve;
                                });
                                if (Number.isFinite(probe.duration) && probe.duration > 0) {
                                  const m = Math.floor(probe.duration / 60);
                                  const s = Math.floor(probe.duration % 60).toString().padStart(2, '0');
                                  duration = `${m}:${s}`;
                                }
                                URL.revokeObjectURL(probe.src);
                              } catch { /* ignore duration probe */ }
                              setItemFormData((prev) => ({ ...prev, videoUrl: url, duration, videoUploading: false }));
                            } catch (err) {
                              setItemFormData((prev) => ({ ...prev, videoUploading: false }));
                              showToast(err.message || 'Video upload failed.', 'error');
                            }
                          }}
                        />
                      </label>
                      {itemFormData.videoUrl ? (
                        <button
                          type="button"
                          className="small-btn danger"
                          onClick={() => setItemFormData((prev) => ({ ...prev, videoUrl: '' }))}
                        >
                          {isMr ? 'काढा' : 'Remove'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="work-form-grid">
                    <Field label={isMr ? 'किंवा व्हिडीओ लिंक (ऐच्छिक)' : 'Or video link (optional)'}>
                      <input
                        value={itemFormData.videoUrl || ''}
                        onChange={(e) => setItemFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                        placeholder="https://… or /api/uploads/portal/video.mp4"
                      />
                    </Field>
                    <Field label={isMr ? 'कालावधी' : 'Duration'}>
                      <input
                        value={itemFormData.duration}
                        onChange={(e) => setItemFormData((prev) => ({ ...prev, duration: e.target.value }))}
                        placeholder="02:15"
                      />
                    </Field>
                  </div>
                  <ImageCropField
                    label={isMr ? 'व्हिडीओ कव्हर फोटो' : 'Video cover photo'}
                    value={itemFormData.mediaUrl}
                    onChange={(url) => setItemFormData((prev) => ({ ...prev, mediaUrl: url }))}
                    aspect={16 / 9}
                    outputWidth={960}
                    uploadLabel={isMr ? 'कव्हर फोटो अपलोड करा' : 'Upload cover photo'}
                    adjustLabel={isMr ? 'क्रॉप / फ्रेम' : 'Crop / Adjust'}
                  />
                </>
              ) : (
                <ImageCropField
                  label={isMr ? 'कामाचा फोटो' : 'Work photo'}
                  value={itemFormData.mediaUrl}
                  onChange={(url) => setItemFormData((prev) => ({ ...prev, mediaUrl: url }))}
                  aspect={16 / 9}
                  outputWidth={960}
                  uploadLabel={isMr ? 'फोटो अपलोड करा' : 'Upload photo'}
                  adjustLabel={isMr ? 'क्रॉप / फ्रेम समायोजित करा' : 'Crop / Adjust frame'}
                  hint={isMr ? 'फोटो निवडल्यावर फ्रेम ड्रॅग आणि झूम करून अचूक सेट करा.' : 'After upload, drag and zoom so the work fills the frame.'}
                />
              )}
            </section>

            <section className="work-form-card">
              <header className="work-form-card-head">
                <strong>{isMr ? 'कामाचा तपशील' : 'Work details'}</strong>
                <span>{isMr ? 'मराठी आणि इंग्रजी शीर्षक आवश्यक आहेत.' : 'Marathi and English titles are required.'}</span>
              </header>
              <div className="work-form-grid">
                <Field label={isMr ? 'शीर्षक (मराठी) *' : 'Title (Marathi) *'}>
                  <input
                    required
                    value={itemFormData.titleMr}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, titleMr: e.target.value }))}
                    placeholder={isMr ? 'उदा. रस्ते डांबरीकरण काम' : 'e.g. रस्ते डांबरीकरण'}
                  />
                </Field>
                <Field label={isMr ? 'शीर्षक (इंग्रजी) *' : 'Title (English) *'}>
                  <input
                    required
                    value={itemFormData.title}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Road Asphalting Work"
                  />
                </Field>
                <Field label={isMr ? 'विभाग' : 'Category'}>
                  <select
                    value={itemFormData.mediaType === 'video' ? 'VIDEOS' : itemFormData.category}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, category: e.target.value }))}
                    disabled={itemFormData.mediaType === 'video'}
                  >
                    {(itemFormData.mediaType === 'video' ? CATEGORIES.filter((c) => c.id === 'VIDEOS') : CATEGORIES.filter((c) => c.id !== 'VIDEOS')).map((c) => (
                      <option key={c.id} value={c.id}>{isMr ? c.labelMr : c.labelEn}</option>
                    ))}
                  </select>
                </Field>
                <Field label={isMr ? 'स्थिती' : 'Status'}>
                  <select
                    value={itemFormData.status}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="PUBLISHED">{isMr ? 'प्रकाशित' : 'Published'}</option>
                    <option value="DRAFT">{isMr ? 'मसुदा' : 'Draft'}</option>
                  </select>
                </Field>
                <Field label={isMr ? 'तारीख' : 'Date'}>
                  <input
                    type="date"
                    value={itemFormData.date}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </Field>
                <Field label={isMr ? 'ठिकाण' : 'Location'}>
                  <input
                    value={itemFormData.location}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder={isMr ? 'उदा. मुख्य रस्ता परिसर' : 'e.g. Main Ward Area'}
                  />
                </Field>
                <Field className="work-form-span" label={isMr ? 'बॅज / टॅग' : 'Badge / Tag'}>
                  <input
                    value={itemFormData.badge}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, badge: e.target.value }))}
                    placeholder={isMr ? 'काम पूर्ण · COMPLETED' : 'COMPLETED'}
                  />
                </Field>
              </div>
            </section>

            <section className="work-form-card">
              <header className="work-form-card-head">
                <strong>{isMr ? 'वर्णन' : 'Description'}</strong>
                <span>{isMr ? 'ऐच्छिक. कामाबद्दल थोडक्यात माहिती.' : 'Optional. A short note about the work.'}</span>
              </header>
              <div className="work-form-grid">
                <Field label={isMr ? 'वर्णन (मराठी)' : 'Description (Marathi)'}>
                  <textarea
                    rows={3}
                    value={itemFormData.descriptionMr}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, descriptionMr: e.target.value }))}
                    placeholder={isMr ? 'कामाबद्दल माहिती लिहा' : 'Describe the work in Marathi'}
                  />
                </Field>
                <Field label={isMr ? 'वर्णन (इंग्रजी)' : 'Description (English)'}>
                  <textarea
                    rows={3}
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the development work in English"
                  />
                </Field>
              </div>
            </section>

            <section className="work-form-card work-form-publish">
              <label className="work-form-check">
                <input
                  type="checkbox"
                  checked={!!itemFormData.showOnDashboard}
                  onChange={(e) => setItemFormData((prev) => ({ ...prev, showOnDashboard: e.target.checked }))}
                />
                <span>
                  <strong>{isMr ? 'नागरिक मुख्य पानावर दाखवा' : 'Show on citizen Home'}</strong>
                  <em>{isMr ? 'गॅलरीत राहीलच; होमवरही दिसेल.' : 'Stays in Gallery, and also appears on Home.'}</em>
                </span>
              </label>
              <label className="work-form-check">
                <input
                  type="checkbox"
                  checked={!!itemFormData.pinFirst}
                  onChange={(e) => setItemFormData((prev) => ({ ...prev, pinFirst: e.target.checked }))}
                />
                <span>
                  <strong>{isMr ? 'हे काम सर्वांत पहिले दाखवा' : 'Pin this work first'}</strong>
                  <em>{isMr ? 'गॅलरी यादीच्या वर दिसेल.' : 'Appears at the top of the gallery list.'}</em>
                </span>
              </label>
            </section>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setItemModalOpen(false)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving
                  ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…')
                  : (editingItem ? (isMr ? 'अपडेट करा' : 'Update work') : (isMr ? 'काम जोडा' : 'Add work'))}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {deletingItem && (
        <Modal
          title={isMr ? 'काम हटविण्याची खात्री करा' : 'Confirm Delete Work'}
          onClose={() => setDeletingItem(null)}
        >
          <div className="delete-modal-content">
            <p>
              {isMr
                ? `तुम्ही खात्रीने "${deletingItem.titleMr || deletingItem.title}" हे काम गॅलरीतून हटवू इच्छिता का?`
                : `Are you sure you want to permanently delete "${deletingItem.title}"?`}
            </p>
            <div className="modal-actions-bar">
              <button type="button" className="ghost-btn" onClick={() => setDeletingItem(null)}>
                {isMr ? 'नाही, रद्द करा' : 'Cancel'}
              </button>
              <button type="button" className="danger-btn" onClick={handleDeleteItem} disabled={saving}>
                {saving ? (isMr ? 'हटवत आहे...' : 'Deleting...') : (isMr ? 'होय, हटवा' : 'Yes, Delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
