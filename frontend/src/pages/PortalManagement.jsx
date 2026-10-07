import React, { useState, useEffect, useMemo } from 'react';
import { api, getUser } from '../services/api';
import { isMaster, isSubMaster, isNagarsevak } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { PageHeader, Loading, Empty, Modal, ImageCropField, CirclePhotoField, Field, Toolbar } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { CITIZEN_HERO_ASPECT, EMPTY_HIGHLIGHT_CARDS, HIGHLIGHT_ICONS, normalizeHighlightCards, highlightHasText, displayHighlightCard } from '../utils/portalDefaults';
import NagarsevakShowcase from '../components/NagarsevakShowcase';

function onCitizenHome(item, dashOrder = []) {
  const v = item?.showOnDashboard ?? item?.show_on_dashboard;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v && typeof v === 'object' && (v.data?.[0] === 1 || v[0] === 1)) return true;
  if (Array.isArray(dashOrder) && dashOrder.map(String).includes(String(item?.id))) return true;
  return false;
}

function notifyPortalUpdated() {
  try { localStorage.setItem('ward_portal_updated', String(Date.now())); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('ward:portal-updated', { bubbles: true }));
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
                <input
                  className="highlight-icon-custom"
                  value={HIGHLIGHT_ICONS.includes(card.icon) ? '' : (card.icon || '')}
                  maxLength={4}
                  onChange={(e) => update(idx, { icon: e.target.value.trim() || '🏆' })}
                  aria-label={isMr ? 'कस्टम emoji' : 'Custom emoji'}
                  placeholder="😊"
                />
              </div>
              <button type="button" className="ghost-btn highlight-remove" onClick={() => removeCard(idx)}>
                {isMr ? 'काढा' : 'Remove'}
              </button>
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
  const mr = (localStorage.getItem('ward_language') || 'en') === 'mr';
  const language = mr ? 'mr' : 'en';
  const isMr = language === 'mr';

  const { wards, selectedWardId, canSelect, fixedWardId, master } = useWardFilter();
  const effectiveWardId = canSelect ? (selectedWardId || null) : (fixedWardId || user?.wardId || null);
  const needsWardPick = canSelect && !effectiveWardId;

  const [activeTab, setActiveTab] = useState('HERO'); // 'HERO' | 'WORKS' | 'REPRESENTATIVE'
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
  const [confirmSwitch, setConfirmSwitch] = useState(null);

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
  const [showGalleryBannerModal, setShowGalleryBannerModal] = useState(false);

  const handleSaveGalleryBanner = async () => {
    if (!effectiveWardId) return;
    setSaving(true);
    try {
      await api.updatePortalConfig({
        wardId: effectiveWardId,
        galleryBannerUrl: portalConfig?.galleryBannerUrl || '',
      });
      storeIfFile(`ward_gallery_banner_${effectiveWardId}`, portalConfig?.galleryBannerUrl);
      setShowGalleryBannerModal(false);
      notifyPortalUpdated();
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
  const loadData = async () => {
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
    setLoading(true);
    setError('');
    try {
      const [cfgRes, galRes] = await Promise.all([
        api.portalConfig({ wardId: effectiveWardId }),
        api.galleryItems({ wardId: effectiveWardId }),
      ]);

      if (cfgRes?.data) {
        const loaded = cfgRes.data.config || {};
        const loadedMeta = loaded.meta && typeof loaded.meta === 'object' ? loaded.meta : {};
        const activationInfo = cfgRes.data.activation || {};
        const useDefaultHero = Boolean(activationInfo.demoMode) || activationInfo.wardActive === false;
        setPortalConfig({
          ...loaded,
          heroBannerUrl: useDefaultHero ? '/hero-ward-default.jpg' : (loaded.heroBannerUrl || '/hero-ward-default.jpg'),
          complaintsBannerUrl: loaded.complaintsBannerUrl || loadedMeta.complaintsBannerUrl || '',
          galleryBannerUrl: loaded.galleryBannerUrl || loadedMeta.galleryBannerUrl || '',
        });
        const cfgMeta = loadedMeta;
        setDashboardWorkOrder(Array.isArray(cfgMeta.dashboardWorkOrder) ? cfgMeta.dashboardWorkOrder.map(String) : []);
        const list = Array.isArray(cfgRes.data.nagarsevaks) ? cfgRes.data.nagarsevaks : [];
        const purchasedList = Array.isArray(cfgRes.data.purchasedNagarsevaks) && cfgRes.data.purchasedNagarsevaks.length
          ? cfgRes.data.purchasedNagarsevaks
          : [];
        const purchasedId = cfgRes.data.config?.purchasedNagarsevakUserId
          || cfgRes.data.activation?.purchasedNagarsevakUserId
          || purchasedList[0]?.id
          || null;
        let featured = purchasedList.find((n) => String(n.id) === String(purchasedId))
          || list.find((n) => String(n.id) === String(purchasedId))
          || (purchasedId ? cfgRes.data.nagarsevak : null)
          || null;
        if (isNagarsevak(user)) {
          featured = purchasedList.find((n) => String(n.id) === String(user.id))
            || (String(purchasedId) === String(user.id) ? list.find((n) => String(n.id) === String(user.id)) : null)
            || featured;
        }
        setNagarsevaks(list);
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
    loadData();
  }, [effectiveWardId]);

  // Save Hero & Portal Config
  const handleSavePortalConfig = async (e) => {
    e?.preventDefault();
    if (!effectiveWardId) {
      showToast(isMr ? 'कृपया आधी वॉर्ड निवडा.' : 'Select a ward before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const slimConfig = { ...portalConfig };
      const keepMetaImages = new Set(['repPhoto', 'complaintsBannerUrl', 'galleryBannerUrl']);
      slimConfig.meta = { ...(slimConfig.meta && typeof slimConfig.meta === 'object' ? slimConfig.meta : {}) };
      slimConfig.meta.complaintsBannerUrl = slimConfig.complaintsBannerUrl || slimConfig.meta.complaintsBannerUrl || '';
      slimConfig.meta.galleryBannerUrl = slimConfig.galleryBannerUrl || slimConfig.meta.galleryBannerUrl || '';
      delete slimConfig.meta.dashboardWorkOrder;
      const complaintsBannerUrl = slimConfig.complaintsBannerUrl || slimConfig.meta.complaintsBannerUrl || '';
      const galleryBannerUrl = slimConfig.galleryBannerUrl || slimConfig.meta.galleryBannerUrl || '';
      delete slimConfig.complaintsBannerUrl;
      delete slimConfig.galleryBannerUrl;
      Object.keys(slimConfig.meta).forEach((k) => {
        if (typeof slimConfig.meta[k] === 'string' && slimConfig.meta[k].startsWith('data:') && !keepMetaImages.has(k)) {
          delete slimConfig.meta[k];
        }
      });
      await api.updatePortalConfig({
        wardId: effectiveWardId,
        ...slimConfig,
        complaintsBannerUrl,
        galleryBannerUrl,
        dashboardWorkOrder,
      });
      try {
        const storeIfFile = (key, url) => {
          if (url && !String(url).startsWith('data:')) localStorage.setItem(key, url);
        };
        storeIfFile(`ward_hero_banner_${effectiveWardId}`, portalConfig?.heroBannerUrl);
        localStorage.setItem(`ward_hero_banner_v_${effectiveWardId}`, String(Date.now()));
        storeIfFile(`ward_complaints_banner_${effectiveWardId}`, portalConfig?.complaintsBannerUrl);
        storeIfFile(`ward_gallery_banner_${effectiveWardId}`, portalConfig?.galleryBannerUrl);
      } catch { /* ignore */ }
      showToast(isMr ? 'तीन बॅनर या वॉर्डसाठी सेव्ह झाले.' : 'Home, complaints and gallery banners saved for this ward.');
      notifyPortalUpdated();
      loadData();
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
        featuredNagarsevakUserId: filled.id || null,
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
      showToast(isMr ? 'नगरसेवक माहिती या वॉर्डसाठी सेव्ह झाली.' : 'Nagarsevak profile saved for this ward.');
      notifyPortalUpdated();
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save representative details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canSwitchBuyer = (isMaster(user) || isSubMaster(user)) && !isNagarsevak(user);

  const applyBuyerSeat = async (nagarsevakUserId) => {
    if (!effectiveWardId || !nagarsevakUserId) return;
    setSaving(true);
    try {
      await api.setNagarsevakPurchase(effectiveWardId, { nagarsevakUserId, status: 'ACTIVE' });
      showToast(isMr
        ? 'जुना नगरसेवक बंद झाला. नवा सक्रिय झाला — आता त्यांची माहिती भरा.'
        : 'Previous Nagarsevak deactivated. New buyer is active — fill their profile now.');
      notifyPortalUpdated();
      setConfirmSwitch(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Could not change Nagarsevak.', 'error');
    } finally {
      setSaving(false);
    }
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
      const { pinFirst, ...itemFields } = itemFormData;
      const payload = {
        ...itemFields,
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

  return (
    <div className="portal-management-page">
      {/* Page Header */}
      <PageHeader
        kicker={isMr ? 'नागरिक पोर्टल' : 'CITIZEN PORTAL'}
        title={isMr ? 'नागरिक पोर्टल — सोपी संपादन' : 'Citizen portal — easy editor'}
        subtitle={
          isMr
            ? 'फक्त ४ पायऱ्या: वॉर्ड निवडा → बॅनर → नगरसेवक माहिती → कामे (स्टार = नागरिक मुख्य पान). सेव्ह केल्यावर नागरिकांना लगेच दिसेल.'
            : 'Four steps: pick a ward → banner → nagarsevak profile → works (star = citizen home). Save, and residents see it immediately.'
        }
        action={
          <div className="portal-header-actions">
            <a
              href={`/citizen-portal${effectiveWardId ? `?wardId=${effectiveWardId}` : ''}&preview=citizen`}
              target="_blank"
              rel="noreferrer"
              className="primary-btn portal-preview-btn"
              title={isMr ? 'निवडलेल्या वॉर्डचे नागरिक पोर्टल पहा' : 'View citizen portal for selected ward'}
            >
              {isMr ? 'प्रभाग पोर्टल पहा' : 'View Ward Portal'}
            </a>
          </div>
        }
      />

      <Toolbar className="portal-ward-toolbar">
        <WardFilter compact label="Ward" />
      </Toolbar>
      {needsWardPick && (
        <p className="ward-portal-hint">
          {isMr
            ? 'पोर्टल संपादनासाठी वॉर्ड निवडा. प्रत्येक वॉर्ड स्वतंत्र आहे.'
            : 'Select a ward to edit its citizen portal. Each ward is separate.'}
        </p>
      )}

      <div className="portal-howto">
        <div className="portal-howto-step">
          <strong>{isMr ? '१. बॅनर' : '1. Banner'}</strong>
          {isMr
            ? 'Home, तक्रार आणि गॅलरी — तीन स्वतंत्र बॅनर येथे बदला. प्रत्येक पान वेगळी प्रतिमा दाखवू शकते.'
            : 'Upload three separate banners: Home, Complaints and Gallery. Each page can show a different image.'}
        </div>
        <div className="portal-howto-step">
          <strong>{isMr ? '२. नगरसेवक' : '2. Nagarsevak'}</strong>
          {isMr
            ? 'फोटो, नाव, पक्ष, फोन, संदेश आणि ठळक कार्ड्स (emoji + आकडा) भरा. कार्ड्स नागरिक होमवर दिसतात.'
            : 'Fill photo, name, party, phone, message and highlight cards (emoji + number). Cards show on citizen home.'}
        </div>
        <div className="portal-howto-step">
          <strong>{isMr ? '३. कामे' : '3. Works'}</strong>
          {isMr
            ? 'गॅलरी टॅबमध्ये काम जोडा. ☆ डॅशबोर्डवर जोडा = नागरिक Home. गॅलरीत सर्व कामे राहतात.'
            : 'Add works in the Gallery tab. Star = citizen Home. Gallery still lists every published work.'}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="portal-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'HERO'}
          className={`portal-tab-btn ${activeTab === 'HERO' ? 'active' : ''}`}
          onClick={() => setActiveTab('HERO')}
        >
          <span className="tab-icon">🖼️</span>
          <span>{isMr ? '१. बॅनर' : '1. Banner'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'REPRESENTATIVE'}
          className={`portal-tab-btn ${activeTab === 'REPRESENTATIVE' ? 'active' : ''}`}
          onClick={() => setActiveTab('REPRESENTATIVE')}
        >
          <span className="tab-icon">👤</span>
          <span>{isMr ? '२. नगरसेवक' : '2. Nagarsevak'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'WORKS'}
          className={`portal-tab-btn ${activeTab === 'WORKS' ? 'active' : ''}`}
          onClick={() => setActiveTab('WORKS')}
        >
          <span className="tab-icon">🏗️</span>
          <span>{isMr ? '३. कामे' : '3. Works'}</span>
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
          <p>{error}</p>
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
                  <div className="portal-card-header">
                    <h3>{isMr ? 'हिरो बॅनर व मजकूर सेटिंग्ज' : 'Hero Banner & Headline Settings'}</h3>
                    <p>{isMr ? 'नागरिक मुख्य पानासाठी बॅनर फोटो आणि स्वागत मजकूर इथे बदला.' : 'Customize the hero banner photo and welcome text for citizen home.'}</p>
                  </div>

                  {/* Section 1: Hero Banner Image Selection */}
                  <div className="form-section-box">
                    <div className="form-section-header">
                      <span className="form-section-title">
                        <span>🖼️</span>
                        <span>{isMr ? 'नागरिक मुख्य बॅनर (Hero Section Banner)' : 'Citizen Home Hero Banner'}</span>
                      </span>
                      <span className="form-section-tag">{isMr ? 'मुख्य पान' : 'Home Page'}</span>
                    </div>

                    <ImageCropField
                      label={isMr ? 'नागरिक Home बॅनर' : 'Citizen Home Banner'}
                      value={portalConfig?.heroBannerUrl || '/hero-ward-default.jpg'}
                      onChange={(url) => setPortalConfig((prev) => ({ ...prev, heroBannerUrl: url || '/hero-ward-default.jpg' }))}
                      aspect={CITIZEN_HERO_ASPECT}
                      outputWidth={1440}
                      uploadLabel={isMr ? 'Home बॅनर अपलोड करा' : 'Upload Home Banner'}
                      adjustLabel={isMr ? 'क्रॉप / फ्रेम समायोजित करा' : 'Crop / Adjust Frame'}
                      hint={isMr ? 'इथेच क्रॉप करा — हाच फ्रेम नागरिक Home वर दिसेल.' : 'Crop it here — this is exactly how it appears on Citizen Home.'}
                    />

                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="ghost-btn-xs"
                        onClick={() => setPortalConfig((prev) => ({ ...prev, heroBannerUrl: '/hero-ward-default.jpg' }))}
                        title={isMr ? 'अधिकृत महापालिका बॅनर वापरा' : 'Reset to official municipal civic banner'}
                      >
                        🏛️ {isMr ? 'अधिकृत महापालिका बॅनर वापरा' : 'Reset to Official Civic Banner'}
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Welcome Headlines */}
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
                            placeholder="WardDesk is your digital ward desk for complaints, schemes and notices..."
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
                  </div>

                  {/* Section 6: Citizen Dashboard Works Info */}
                  <div className="form-section-box citizen-works-info-box" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>⭐</span>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                          {isMr ? 'नागरिक मुख्य पानावर दिसणारी विकास कामे' : 'Featured Works on Citizen Homepage'}
                        </strong>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                          {isMr
                            ? 'तुम्ही "विकास कामे व व्हिडीओ" टॅबमधून थेट कोणती कामे डॅशबोर्डवर दिसावीत ते ⭐ एका क्लिकवर ठरवू शकता आणि त्यांचा क्रम ↑ / ↓ बटणांनी बदलू शकता.'
                            : 'You can directly pick which cards appear on the citizen dashboard and reorder them with ↑ / ↓ buttons directly in the "Works & Videos" tab.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="form-actions-footer">
                    <button type="submit" className="primary-btn portal-save-btn" disabled={saving}>
                      {saving ? (isMr ? 'सेव्ह होत आहे...' : 'Saving...') : (isMr ? '✓ या वॉर्डचा बॅनर सेव्ह करा' : '✓ Save this ward’s banner')}
                    </button>
                  </div>
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
                <div className="toolbar-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={isMr ? 'कामे किंवा व्हिडीओ शोधा...' : 'Search works, location, badge...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

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
                    className="ghost-btn"
                    onClick={() => setShowGalleryBannerModal(true)}
                    title={isMr ? 'गॅलरी पानाचा मुख्य कव्हर बॅनर बदला' : 'Edit gallery cover banner'}
                  >
                    <span>🖼️</span>
                    <span>{isMr ? 'गॅलरी कव्हर बॅनर' : 'Gallery Banner'}</span>
                  </button>
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

              {galleryFilter !== 'DASHBOARD' && (
                <div className="gallery-add-work-bar">
                  <p>
                    {isMr
                      ? 'येथे नवीन फोटो/व्हिडीओ जोडा. नागरिक Home वर काय दिसेल ते ☆ डॅशबोर्डवर जोडा ने ठरवा.'
                      : 'Add photos and videos here. Star ☆ Add to Dashboard for any work you want on citizen Home.'}
                  </p>
                  <button type="button" className="primary-btn add-work-btn" onClick={openAddModal}>
                    <span>＋</span>
                    <span>{isMr ? 'नवीन काम जोडा' : 'Add work'}</span>
                  </button>
                </div>
              )}

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
                            backgroundImage: `url(${item.mediaUrl || (isVid ? '/gallery/road-construction.svg' : '/gallery/water-pipeline.svg')})`,
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
                      ? 'आधी वॉर्ड Activate, मग खरेदीदार निवडा. तोच Active नगरसेवक — नागरिकांना तोच दिसेल.'
                      : 'Activate the ward first, then pick the buyer. That person is the Active Nagarsevak residents see.'}
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
                {canSwitchBuyer && nagarsevaks.length > 0 && (
                  <div className="form-section-box nagar-buyer-box">
                    <label className="form-label">{isMr ? 'खरेदी / Active नगरसेवक' : 'Purchased / Active Nagarsevak'}</label>
                    <select
                      className="form-select"
                      value={representative?.id || ''}
                      disabled={saving || !activation?.wardActive}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        if (!nextId || String(nextId) === String(representative?.id)) return;
                        const next = nagarsevaks.find((n) => String(n.id) === String(nextId));
                        if (next) setConfirmSwitch({ from: representative, to: next, isFirst: !representative });
                      }}
                    >
                      {!representative && (
                        <option value="">{isMr ? 'खरेदीदार निवडा…' : 'Select the buyer…'}</option>
                      )}
                      {nagarsevaks.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}{n.wardSeat ? ` · ${n.wardSeat}` : ''}{n.mobile ? ` · ${n.mobile}` : ''}
                          {purchasedNagarsevaks.some((p) => String(p.id) === String(n.id))
                            ? (isMr ? ' · Active' : ' · Active')
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!representative ? (
                  <Empty>
                    {isMr
                      ? (activation?.wardActive
                        ? (nagarsevaks.length ? 'वरील यादीतून खरेदीदार निवडा.' : 'आधी स्टाफ मध्ये नगरसेवक तयार करा.')
                        : 'आधी वॉर्ड Activate करा.')
                      : (activation?.wardActive
                        ? (nagarsevaks.length ? 'Select the buyer from the list above.' : 'Create a Nagarsevak in Staff first.')
                        : 'Activate the ward first.')}
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

                        <HighlightCardsEditor
                          isMr={isMr}
                          cards={representative?.achievements}
                          onChange={(next) => setRepresentative((prev) => ({ ...prev, achievements: next }))}
                        />
                      </div>
                    </div>

                    <div className="form-actions-footer">
                      <button type="submit" className="primary-btn portal-save-btn" disabled={saving}>
                        {saving ? (isMr ? 'सेव्ह होत आहे...' : 'Saving...') : (isMr ? '✓ नगरसेवक स्पॉटलाइट सेव्ह करा' : '✓ Save nagarsevak spotlight')}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          )}

        </div>
      )}

      {confirmSwitch?.to && (
        <Modal
          title={confirmSwitch.isFirst
            ? (isMr ? 'खरेदीदार सक्रिय करा' : 'Activate buyer')
            : (isMr ? 'नगरसेवक बदला' : 'Change Nagarsevak')}
          onClose={() => !saving && setConfirmSwitch(null)}
        >
          <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
            {confirmSwitch.isFirst
              ? (isMr
                ? `${confirmSwitch.to.name} या वॉर्डसाठी सक्रिय होतील. मग त्यांची प्रोफाइल माहिती भरा.`
                : `${confirmSwitch.to.name} will be activated for this ward. Then fill their profile.`)
              : (isMr
                ? `${confirmSwitch.from?.name || 'सध्याचा नगरसेवक'} निष्क्रिय होतील आणि ${confirmSwitch.to.name} सक्रिय होतील. नागरिकांना नवा प्रोफाइल दिसेल.`
                : `${confirmSwitch.from?.name || 'The current Nagarsevak'} will be deactivated and ${confirmSwitch.to.name} will be activated. Residents will see the new profile.`)}
          </p>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" disabled={saving} onClick={() => setConfirmSwitch(null)}>
              {isMr ? 'रद्द' : 'Cancel'}
            </button>
            <button type="button" className="primary-btn" disabled={saving} onClick={() => applyBuyerSeat(confirmSwitch.to.id)}>
              {saving ? (isMr ? 'बदलत आहे…' : 'Updating…') : (isMr ? 'होय, बदला' : 'Yes, switch')}
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* GALLERY COVER BANNER MODAL */}
      {/* ============================================================== */}
      {showGalleryBannerModal && (
        <Modal
          wide
          title={isMr ? 'गॅलरी कव्हर बॅनर संपादित करा' : 'Edit Gallery Cover Banner'}
          onClose={() => setShowGalleryBannerModal(false)}
        >
          <div style={{ padding: '4px 0' }}>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
              {isMr
                ? 'हा बॅनर नागरिक विकास गॅलरी पानाच्या शीर्षस्थानी दिसेल.'
                : 'This banner appears at the top of the citizen development works gallery page.'}
            </p>
            <ImageCropField
              label={isMr ? 'गॅलरी कव्हर बॅनर' : 'Gallery Cover Banner'}
              value={portalConfig?.galleryBannerUrl || ''}
              onChange={(url) => setPortalConfig((prev) => ({ ...prev, galleryBannerUrl: url || '' }))}
              aspect={2.4}
              outputWidth={1200}
              uploadLabel={isMr ? 'गॅलरी बॅनर अपलोड करा' : 'Upload Gallery Banner'}
              adjustLabel={isMr ? 'क्रॉप / फ्रेम समायोजित करा' : 'Crop / Adjust Frame'}
              hint={isMr ? 'फक्त गॅलरीच्या वरच्या हिरोवर हा फोटो दिसेल.' : 'Displayed at the top of the gallery page.'}
            />
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="ghost-btn" onClick={() => setShowGalleryBannerModal(false)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="button" className="primary-btn" disabled={saving} onClick={handleSaveGalleryBanner}>
                {saving ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…') : (isMr ? 'गॅलरी बॅनर सेव्ह करा' : 'Save Gallery Banner')}
              </button>
            </div>
          </div>
        </Modal>
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
          <form className="modal-form-grid work-modal-form" onSubmit={handleSaveItem}>
            <div className="form-section-title span-2" style={{ marginBottom: 4 }}>
              <strong>{isMr ? 'कामाचा तपशील' : 'Work Details'}</strong>
              <span>{isMr ? 'शीर्षक, प्रकार आणि फोटो निवडा. मुख्य पानावर दाखवण्यासाठी ⭐ पर्याय निवडा.' : 'Add titles, category, and an image or video. Toggle ⭐ to display on Citizen Dashboard.'}</span>
            </div>

            <Field label={isMr ? 'प्रकार (Type)' : 'Type'}>
              <select
                value={itemFormData.mediaType}
                onChange={(e) => {
                  const mediaType = e.target.value;
                  setItemFormData((prev) => ({
                    ...prev,
                    mediaType,
                    category: mediaType === 'video' ? 'VIDEOS' : (prev.category === 'VIDEOS' ? 'DEVELOPMENT' : prev.category),
                    badge: mediaType === 'video' ? 'व्हिडीओ · VIDEO' : (prev.badge === 'व्हिडीओ · VIDEO' ? 'काम पूर्ण · COMPLETED' : prev.badge),
                  }));
                }}
              >
                <option value="image">{isMr ? 'फोटो (Photo)' : 'Photo'}</option>
                <option value="video">{isMr ? 'व्हिडीओ (Video)' : 'Video'}</option>
              </select>
            </Field>

            <Field label={isMr ? 'विभाग (Category)' : 'Category'}>
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

            <Field label={isMr ? 'बॅज / टॅग' : 'Badge / Tag'}>
              <input
                value={itemFormData.badge}
                onChange={(e) => setItemFormData((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder={isMr ? 'काम पूर्ण · COMPLETED' : 'COMPLETED'}
              />
            </Field>

            <Field label={isMr ? 'स्थिती (Status)' : 'Status'}>
              <select
                value={itemFormData.status}
                onChange={(e) => setItemFormData((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="PUBLISHED">{isMr ? 'प्रकाशित (Published)' : 'Published'}</option>
                <option value="DRAFT">{isMr ? 'मसुदा (Draft)' : 'Draft'}</option>
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

            {itemFormData.mediaType === 'video' ? (
              <>
                <Field label={isMr ? 'व्हिडीओ URL (MP4)' : 'Video URL (MP4)'}>
                  <input
                    value={itemFormData.videoUrl || ''}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                    placeholder="https://… or /gallery/ward-road-work.mp4"
                  />
                </Field>
                <Field label={isMr ? 'कालावधी' : 'Duration'}>
                  <input
                    value={itemFormData.duration}
                    onChange={(e) => setItemFormData((prev) => ({ ...prev, duration: e.target.value }))}
                    placeholder="02:15"
                  />
                </Field>
                <div className="span-2">
                  <ImageCropField
                    label={isMr ? 'व्हिडीओ कव्हर फोटो' : 'Video Cover Photo'}
                    value={itemFormData.mediaUrl}
                    onChange={(url) => setItemFormData((prev) => ({ ...prev, mediaUrl: url }))}
                    aspect={16 / 9}
                    outputWidth={960}
                    uploadLabel={isMr ? 'कव्हर फोटो अपलोड करा' : 'Upload Cover Photo'}
                    adjustLabel={isMr ? 'क्रॉप / फ्रेम' : 'Crop / Adjust'}
                  />
                </div>
              </>
            ) : (
              <div className="span-2">
                <ImageCropField
                  label={isMr ? 'कामाचा फोटो' : 'Work Photo'}
                  value={itemFormData.mediaUrl}
                  onChange={(url) => setItemFormData((prev) => ({ ...prev, mediaUrl: url }))}
                  aspect={16 / 9}
                  outputWidth={960}
                  uploadLabel={isMr ? 'फोटो अपलोड करा' : 'Upload Photo'}
                  adjustLabel={isMr ? 'क्रॉप / फ्रेम समायोजित करा' : 'Crop / Adjust Frame'}
                  hint={isMr ? 'फोटो निवडल्यावर फ्रेम ड्रॅग आणि झूम करून अचूक सेट करा.' : 'Drag and zoom to perfectly frame your photo.'}
                />
              </div>
            )}

            <Field label={isMr ? 'वर्णन (मराठी)' : 'Description (Marathi)'}>
              <textarea
                rows={3}
                value={itemFormData.descriptionMr}
                onChange={(e) => setItemFormData((prev) => ({ ...prev, descriptionMr: e.target.value }))}
                placeholder={isMr ? 'कामाबद्दल माहिती लिहा' : 'Describe the development work in Marathi'}
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

            <div className="span-2" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="dashboard-feature-label-inline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                  checked={!!itemFormData.showOnDashboard}
                  onChange={(e) => setItemFormData((prev) => ({ ...prev, showOnDashboard: e.target.checked }))}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  {isMr ? '⭐ नागरिक मुख्य पानावर दाखवा (Show on Citizen Dashboard)' : '⭐ Show on Citizen Dashboard'}
                </span>
              </label>
              <label className="dashboard-feature-label-inline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                  checked={!!itemFormData.pinFirst}
                  onChange={(e) => setItemFormData((prev) => ({ ...prev, pinFirst: e.target.checked }))}
                />
                <span style={{ fontSize: 13, color: '#475569' }}>
                  {isMr ? '📌 हे काम सर्वांत पहिले दाखवा (Pin as First Work)' : '📌 Show this work first in order'}
                </span>
              </label>
            </div>

            <div className="modal-actions span-2" style={{ marginTop: 12 }}>
              <button type="button" className="ghost-btn" onClick={() => setItemModalOpen(false)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving
                  ? (isMr ? 'सेव्ह होत आहे…' : 'Saving…')
                  : (editingItem ? (isMr ? 'अपडेट करा' : 'Update Work') : (isMr ? 'काम जोडा' : 'Add Work'))}
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
