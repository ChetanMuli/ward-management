import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaceAvatar, isUsablePhoto } from './Ui';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import { normalizeHighlightCards, displayHighlightCard } from '../utils/portalDefaults';

export const DEFAULT_DEMO_GALLERY = [
  {
    id: 'gal-campaign-poster',
    type: 'image',
    title: 'नमुना विकास काम — रस्ते दुरुस्ती',
    titleEn: 'Sample public work — road repair',
    category: 'LEADERSHIP',
    categoryLabel: 'लोकप्रतिनिधी',
    categoryLabelEn: 'Leadership',
    date: '2026-09-30',
    dateFormatted: '३० सप्टेंबर २०२६',
    dateFormattedEn: '30 Sep 2026',
    location: 'अहिल्यानगर म.न.पा., प्रभाग क्र. ३',
    url: '/gallery/road-construction.svg',
    badge: 'सेवा हाच धर्म, विकास हाच संकल्प',
    description: 'प्रभाग क्रमांक ३ मधील नागरिकांच्या न्याय्य हक्कांसाठी व शाश्वत विकासासाठी कटिबद्ध. अहिल्यानगर महानगरपालिका अधिकृत नगरसेवक जनसंपर्क अहवाल.'
  },
  {
    id: 'vid-1',
    type: 'video',
    title: 'रस्ते डांबरीकरण व कॉंक्रिटीकरण कामांची प्रत्यक्ष पाहणी',
    titleEn: 'Road Asphalting & Concretization Work Inspection',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-24',
    dateFormatted: '२४ सप्टेंबर २०२६',
    dateFormattedEn: '24 Sep 2026',
    location: 'गुलमोहर रोड व प्रोफेसर कॉलनी',
    url: '/gallery/road-construction.svg',
    videoUrl: '/gallery/ward-road-work.mp4',
    duration: '02:15',
    badge: 'व्हिडीओ · VIDEO',
    description: 'प्रभाग क्रमांक ३ मधील मुख्य रस्ता कॉंक्रिटीकरण व गतिरोधक कामांची प्रत्यक्ष पाहणी करताना नगरसेवक. कामाच्या उच्च दर्जाची खात्री.'
  },
  {
    id: 'vid-2',
    type: 'video',
    title: '२४/७ पाणी पुरवठा योजना - जलवाहिनी लोकार्पण व चाचणी',
    titleEn: '24/7 Clean Water Pipeline Project - Live Testing',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-18',
    dateFormatted: '१८ सप्टेंबर २०२६',
    dateFormattedEn: '18 Sep 2026',
    location: 'सावेडी जलकुंभ परिसर',
    url: '/gallery/water-pipeline.svg',
    videoUrl: '/gallery/ward-water-project.mp4',
    duration: '01:45',
    badge: 'व्हिडीओ · VIDEO',
    description: 'नवीन उच्च दाबाच्या डीआय जलवाहिनीची प्रत्यक्ष पाहणी व प्रभागातील रहिवाशांशी पाण्याचा दाब व स्वच्छतेबाबत चर्चा.'
  },
  {
    id: 'vid-3',
    type: 'video',
    title: 'साप्ताहिक जनता दरबार - नागरिक तक्रारींचे जागीच निवारण',
    titleEn: 'Weekly Janta Darbar - On-Spot Grievance Redressal',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-27',
    dateFormatted: '२७ सप्टेंबर २०२६',
    dateFormattedEn: '27 Sep 2026',
    location: 'जनसंपर्क कार्यालय, सावेडी',
    url: '/gallery/janta-darbar.svg',
    videoUrl: '/gallery/ward-janta-darbar.mp4',
    duration: '03:10',
    badge: 'व्हिडीओ · VIDEO',
    description: 'प्रभागातील नागरिकांशी थेट संवाद साधून रस्ते, वीज, ड्रेनेज व स्वच्छता समस्यांचे मनपा अधिकाऱ्यांमार्फत तात्काळ निवारण.'
  },
  {
    id: 'vid-4',
    type: 'video',
    title: 'स्मार्ट हायमास्ट व एलईडी पथदिवे लोकार्पण - संपूर्ण प्रभाग उजळला',
    titleEn: 'Smart Highmast & LED Streetlights Inauguration',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-20',
    dateFormatted: '२० सप्टेंबर २०२६',
    dateFormattedEn: '20 Sep 2026',
    location: 'टी.व्ही. सेंटर चौक व गुलमोहर रस्ता',
    url: '/gallery/smart-led-lights.svg',
    videoUrl: '/gallery/ward-lights-inspection.mp4',
    duration: '02:40',
    badge: 'व्हिडीओ · VIDEO',
    description: 'महिला व ज्येष्ठ नागरिकांच्या सुरक्षिततेसाठी प्रभागातील प्रमुख चौकांमध्ये हायमास्ट आणि अंतर्गत रस्त्यांवर ऊर्जाबचत करणारे स्मार्ट एलईडी दिवे कार्यान्वित केले.'
  },
  {
    id: 'vid-5',
    type: 'video',
    title: 'भव्य मोफत आरोग्य व नेत्र तपासणी शिबीर - प्रत्यक्ष क्षणचित्रे',
    titleEn: 'Mega Free Health & Eye Checkup Camp Highlights',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-08',
    dateFormatted: '०८ सप्टेंबर २०२६',
    dateFormattedEn: '08 Sep 2026',
    location: 'सावेडी समाज मंदिर हॉल',
    url: '/gallery/health-camp.svg',
    videoUrl: '/gallery/ward-health-camp.mp4',
    duration: '03:25',
    badge: 'व्हिडीओ · VIDEO',
    description: 'प्रभागातील ज्येष्ठ नागरिक व महिलांसाठी मोफत रक्त तपासणी, ईसीजी आणि मोफत चष्मे वाटप करण्यात आले. तज्ज्ञ डॉक्टरांचे मोफत मार्गदर्शन लाभले.'
  },
  {
    id: 'gal-1',
    type: 'image',
    title: 'रस्ते कॉंक्रिटीकरण व डांबरीकरण मोहीम',
    titleEn: 'Road Concretization & Asphalting Drive',
    category: 'DEVELOPMENT',
    categoryLabel: 'विकास कामे',
    categoryLabelEn: 'Development',
    date: '2026-08-12',
    dateFormatted: '१२ ऑगस्ट २०२६',
    dateFormattedEn: '12 Aug 2026',
    location: 'गुलमोहर रोड व प्रोफेसर कॉलनी',
    url: '/gallery/road-construction.svg',
    badge: 'काम पूर्ण · COMPLETED',
    description: 'प्रभाग क्रमांक ३ मधील मुख्य रस्ता व अंतर्गत गल्ल्यांचे उच्च दर्जाचे कॉंक्रिटीकरण, गतिरोधक व पेव्हर ब्लॉक बसविण्याचे काम यशस्वीरीत्या पूर्ण करण्यात आले.'
  },
  {
    id: 'gal-2',
    type: 'image',
    title: 'भूमिगत जलवाहिनी नूतनीकरण व ड्रेनेज काम',
    titleEn: 'Underground Water Pipeline & Drainage Renewal',
    category: 'WATER',
    categoryLabel: 'पाणी व स्वच्छता',
    categoryLabelEn: 'Water & Sanitation',
    date: '2026-08-28',
    dateFormatted: '२८ ऑगस्ट २०२६',
    dateFormattedEn: '28 Aug 2026',
    location: 'पंकज कॉलनी व सावेडी रोड परिसर',
    url: '/gallery/water-pipeline.svg',
    badge: '२४/७ पाणी पुरवठा',
    description: 'नागरिकांच्या पाण्याच्या दाबाच्या तक्रारींचे तातडीने निवारण करून नवीन डीआय पाईपलाईन टाकण्यात आली व ड्रेनेज चेंबर दुरुस्ती पूर्ण झाली.'
  },
  {
    id: 'gal-3',
    type: 'image',
    title: 'भव्य मोफत आरोग्य व नेत्र तपासणी शिबीर',
    titleEn: 'Mega Free Health & Eye Checkup Camp',
    category: 'HEALTH',
    categoryLabel: 'आरोग्य शिबीर',
    categoryLabelEn: 'Health Camp',
    date: '2026-09-05',
    dateFormatted: '०५ सप्टेंबर २०२६',
    dateFormattedEn: '05 Sep 2026',
    location: 'सावेडी समाज मंदिर हॉल',
    url: '/gallery/health-camp.svg',
    badge: '८५०+ लाभार्थी',
    description: 'प्रभागातील ज्येष्ठ नागरिक व महिलांसाठी मोफत रक्त तपासणी, ईसीजी आणि मोफत चष्मे वाटप करण्यात आले. तज्ज्ञ डॉक्टरांचे मोफत मार्गदर्शन लाभले.'
  },
  {
    id: 'gal-4',
    type: 'image',
    title: 'स्वच्छ व हरित प्रभाग - १,००१ वृक्षारोपण मोहीम',
    titleEn: 'Clean & Green Ward - 1,001 Tree Plantation Drive',
    category: 'SOCIAL',
    categoryLabel: 'पर्यावरण व सामाजिक',
    categoryLabelEn: 'Green Ward',
    date: '2026-09-15',
    dateFormatted: '१५ सप्टेंबर २०२६',
    dateFormattedEn: '15 Sep 2026',
    location: 'अहिल्या उद्यान परिसर, यशवंतनगर',
    url: '/gallery/tree-plantation.svg',
    badge: 'पर्यावरण संवर्धन',
    description: 'प्रदूषणमुक्त व निरोगी प्रभागासाठी देशी वृक्षांची लागवड करून संरक्षक जाळ्या बसविण्यात आल्या. स्थानिक नागरिक व तरुणांचा उत्स्फूर्त सहभाग लाभला.'
  },
  {
    id: 'gal-5',
    type: 'image',
    title: 'नवीन हायमास्ट व स्मार्ट एलईडी पथदिवे',
    titleEn: 'Smart LED Streetlights & Highmast Illumination',
    category: 'DEVELOPMENT',
    categoryLabel: 'विकास कामे',
    categoryLabelEn: 'Development',
    date: '2026-09-20',
    dateFormatted: '२० सप्टेंबर २०२६',
    dateFormattedEn: '20 Sep 2026',
    location: 'टी.व्ही. सेंटर चौक, प्रा. कॉलनी व गोविंदपुरा',
    url: '/gallery/smart-led-lights.svg',
    badge: '१००% एलईडी प्रकाश',
    description: 'महिला व ज्येष्ठ नागरिकांच्या सुरक्षिततेसाठी प्रभागातील प्रमुख चौकांमध्ये हायमास्ट आणि अंतर्गत रस्त्यांवर ऊर्जाबचत करणारे स्मार्ट एलईडी दिवे कार्यान्वित केले.'
  },
  {
    id: 'gal-6',
    type: 'image',
    title: 'साप्ताहिक जनता दरबार व थेट नागरिक संवाद',
    titleEn: 'Weekly Janta Darbar & Citizen Grievance Redressal',
    category: 'SOCIAL',
    categoryLabel: 'जनसंवाद',
    categoryLabelEn: 'Citizen Redressal',
    date: '2026-09-26',
    dateFormatted: '२६ सप्टेंबर २०२६',
    dateFormattedEn: '26 Sep 2026',
    location: 'जनसंपर्क कार्यालय, सावेडी',
    url: '/gallery/janta-darbar.svg',
    badge: 'थेट निवारण',
    description: 'प्रभागातील नागरिकांशी थेट संवाद साधून त्यांच्या समस्या प्रत्यक्ष ऐकून घेतल्या आणि महापालिका अधिकाऱ्यांमार्फत तात्काळ निवारणाचे आदेश देण्यात आले.'
  }
];

export const DEFAULT_DEMO_ACHIEVEMENTS = [
  { id: '1', icon: '🏆', metric: '९८%', metricEn: '98%', label: 'तक्रार निवारण दर', labelEn: 'Grievance Resolution', desc: 'वेळेत समाधानकारक निकाल', descEn: 'Timely resolution of civic issues' },
  { id: '2', icon: '🏗️', metric: '२४+', metricEn: '24+', label: 'विकास कामे पूर्ण', labelEn: 'Completed Works', desc: 'रस्ते, ड्रेनेज व पथदिवे', descEn: 'Roads, pipelines & streetlights' },
  { id: '3', icon: '💧', metric: '२४/७', metricEn: '24/7', label: 'पाणी पुरवठा मोहीम', labelEn: 'Clean Water Desk', desc: 'अखंड स्वच्छ पिण्याचे पाणी', descEn: 'Safe drinking water assurance' },
  { id: '4', icon: '👥', metric: '५,०००+', metricEn: '5,000+', label: 'समाधानी नागरिक', labelEn: 'Connected Citizens', desc: 'थेट जनसंपर्क व संवाद', descEn: 'Active public assistance' }
];

function onHomeWork(item, dashOrder = []) {
  const v = item?.showOnDashboard ?? item?.show_on_dashboard;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v && typeof v === 'object' && (v.data?.[0] === 1 || v[0] === 1)) return true;
  if (Array.isArray(dashOrder) && dashOrder.map(String).includes(String(item?.id))) return true;
  return Boolean(item?.isDemo);
}

export const DEFAULT_BIO_MR = 'जनसेवा हीच ईश्वरसेवा! प्रभागातील प्रत्येक नागरिकाला २४/७ शुद्ध पाणी, गुळगुळीत काँक्रीट रस्ते, रात्री उजळणारे एलईडी दिवे आणि स्वच्छ, सुरक्षित परिसर देणे हाच आमचा ध्यास आहे. विकासाच्या प्रवाहात प्रत्येक घटकाला सोबत घेऊन आदर्श प्रभाग बनवण्यासाठी आम्ही कटिबद्ध आहोत.';
export const DEFAULT_BIO_EN = 'Committed to transparent and people-centric governance. Ensuring 24/7 clean water, asphalted roads, energy-efficient streetlighting, and a safe, clean ward for every resident.';
export const DEFAULT_TIMINGS_MR = 'सकाळी ९:०० ते दु. १:०० | सायं. ५:०० ते ९:०० (सोमवार ते शनिवार)';
export const DEFAULT_TIMINGS_EN = 'Morning 9:00 AM - 1:00 PM | Evening 5:00 PM - 9:00 PM (Mon to Sat)';

export default function NagarsevakShowcase({
  nagarsevaks = [],
  ward = null,
  language = 'en',
  onOpenCommunity = null,
  onOpenGallery = null,
  showGallery = true,
  minimalWork = false,
  minimalCount = 2,
  portalGallery = null,
  portalConfig = null,
}) {
  const isMr = language === 'mr';
  const list = useMemo(() => Array.isArray(nagarsevaks) ? nagarsevaks.filter(Boolean) : [], [nagarsevaks]);

  // Selected Nagarsevak if multiple are present in the ward
  const [selectedId, setSelectedId] = useState(list[0]?.id || null);

  useEffect(() => {
    if (list.length && (!selectedId || !list.some(n => String(n.id) === String(selectedId)))) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const current = useMemo(() => {
    return list.find(n => String(n.id) === String(selectedId)) || list[0] || null;
  }, [list, selectedId]);

  // Gallery category filter
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Lightbox modal state (index of image in filtered list, or null)
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Gallery items for this Nagarsevak (uses portalGallery if passed, else custom or demo gallery)
  const galleryItems = useMemo(() => {
    let raw;
    if (Array.isArray(portalGallery)) raw = portalGallery;
    else if (Array.isArray(current?.gallery) && current.gallery.length > 0) raw = current.gallery;
    else raw = [];

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

    if (!Array.isArray(portalGallery)) {
      base.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return base;
  }, [current, isMr, ward, portalGallery]);

  // Filtered gallery items
  const filteredGallery = useMemo(() => {
    if (activeFilter === 'ALL') return galleryItems;
    if (activeFilter === 'VIDEOS') return galleryItems.filter(item => item.type === 'video' || !!item.videoUrl || (item.category || '').toUpperCase() === 'VIDEOS');
    return galleryItems.filter(item => (item.category || '').toUpperCase() === activeFilter);
  }, [galleryItems, activeFilter]);

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

  if (!current) {
    return (
      <section className="user-panel-card nagar-spotlight-card nagar-spotlight-empty">
        <div className="nagar-empty-box">
          <div className="nagar-empty-icon">🏛️</div>
          <h3>{isMr ? 'तुमच्या वॉर्डची माहिती लवकरच दिसेल' : 'Ward Representative Showcase'}</h3>
          <p>{isMr ? 'या वॉर्डसाठी नगरसेवक प्रोफाइल लवकरच सक्रिय केले जाईल. वॉर्ड सेवा आणि तक्रार नोंदणी सुरू आहे.' : 'Nagarsevak profile for your ward will be activated shortly. Community and complaint services remain active.'}</p>
        </div>
      </section>
    );
  }

  // Prepared data fields
  const repMeta = portalConfig?.meta || {};
  const rawName = current.name || '';
  const name = current.isDemo
    ? (isMr ? 'आपले नगरसेवक' : 'Your Nagarsevak')
    : (rawName || (isMr ? 'माननीय नगरसेवक' : 'Ward Nagarsevak'));
  const rawPhoto = (typeof current.photo === 'string' && current.photo.trim())
    ? current.photo
    : (typeof repMeta.repPhoto === 'string' && repMeta.repPhoto.trim() ? repMeta.repPhoto : '');
  const photo = isUsablePhoto(rawPhoto) && !String(rawPhoto).startsWith('data:') ? rawPhoto : '';
  const partyName = current.partyName || repMeta.repParty || '';
  const wardSeat = current.wardSeat
    ? `${isMr ? 'प्रभाग' : 'Ward'} ${current.wardSeat}`
    : (ward?.wardNumber ? formatWardNumber(ward.wardNumber, isMr ? 'mr' : 'en') : '');
  const wardName = ward?.name ? ward.name : '';
  const officialAddress = current.officialAddress || repMeta.repAddress || '';
  const bio = current.bio || (isMr ? (repMeta.repBioMr || repMeta.repBio) : repMeta.repBio) || '';
  const mobile = current.mobile || repMeta.repPhone || '';
  const whatsappNum = repMeta.repWhatsapp || current.whatsapp || mobile;
  const email = repMeta.repEmail || current.email || '';

  // WhatsApp click link
  const waText = encodeURIComponent(
    isMr
      ? `नमस्कार नगरसेवक ${name} जी, मी ${formatWardNumber(ward?.wardNumber, 'mr') || 'वॉर्ड'} चा रहिवासी असून एका वॉर्ड कामासंदर्भात संपर्क करत आहे.`
      : `Hello Corporator ${name} ji, I am a resident of ${formatWardNumber(ward?.wardNumber) || 'this ward'} contacting regarding ward development.`
  );
  const waUrl = whatsappNum ? `https://wa.me/91${whatsappNum.replace(/\D/g, '')}?text=${waText}` : '#';

  // Google Maps directions link
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${officialAddress} ${wardName}`)}`;

  // Active Lightbox Item
  const activeLightboxItem = lightboxIndex !== null ? filteredGallery[lightboxIndex] : null;
  const impactItems = normalizeHighlightCards(
    (Array.isArray(current.achievements) && current.achievements.length)
      ? current.achievements
      : portalConfig?.meta?.achievements
  );

  return (
    <>
      <section className="user-panel-card nagar-spotlight-card">
        {/* Candidate / Multi-Nagarsevak Selector Tabs if more than 1 */}
        {list.length > 1 && (
          <div className="nagar-multi-selector">
            <span className="nagar-multi-kicker">{isMr ? 'प्रभागातील नगरसेवक निवडा:' : 'Select Representative:'}</span>
            <div className="nagar-multi-tabs">
              {list.map((n) => {
                const active = String(n.id) === String(selectedId);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`nagar-multi-tab ${active ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedId(n.id);
                      setActiveFilter('ALL');
                    }}
                  >
                    <span className="nagar-tab-dot" />
                    <strong>{n.name}</strong>
                    {n.wardSeat && <small>({n.wardSeat})</small>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Header Badge Ribbon */}
        <div className="nagar-spotlight-header">
          <div className="nagar-kicker-group">
            <span className="nagar-kicker-badge">
              <span className="nagar-kicker-icon">🏛️</span>
              {isMr ? 'माननीय नगरसेवक' : 'WARD REPRESENTATIVE'}
            </span>
            {wardSeat && <span className="nagar-seat-badge">{wardSeat}</span>}
            {wardName && <span className="nagar-ward-name-badge">{wardName}</span>}
          </div>

          {partyName ? (
            <div className="nagar-party-badge" title={partyName}>
              <span className="nagar-party-dot" />
              <span className="nagar-party-name">{partyName}</span>
            </div>
          ) : null}
        </div>

        {/* Profile Hero Section */}
        <div className="nagar-spotlight-body">
          {/* Left Column: Portrait Photo with Badge */}
          <div className="nagar-photo-column">
            <div className="nagar-photo-frame">
              <FaceAvatar name={name} photo={photo} className="nagar-portrait-avatar" />
              <span className="nagar-verified-badge" title={isMr ? 'प्रमाणित लोकप्रतिनिधी' : 'Verified Public Representative'}>
                ✓
              </span>
            </div>
          </div>

          {/* Right Column: Name, Bio, Actions */}
          <div className="nagar-info-column">
            <div className="nagar-titles">
              <h2 className="nagar-name">{name}</h2>
              <div className="nagar-designation-row">
                <span className="nagar-role-tag">{isMr ? 'नगरसेवक / नगरसेविका' : 'Municipal Corporator'}</span>
                <span className="nagar-divider">·</span>
                <span className="nagar-ward-ref">{formatWardLabel(ward, 'Ward')}</span>
              </div>
            </div>

            {/* Vision / Bio Quote Card */}
            <div className="nagar-bio-quote">
              <span className="nagar-quote-symbol">“</span>
              <p>{bio}</p>
            </div>

            {/* Quick Citizen Outreach Action Bar */}
            <div className="nagar-action-bar">
              {mobile && (
                <a href={`tel:${mobile}`} className="nagar-action-btn nagar-btn-call" title={isMr ? 'थेट कॉल करा' : 'Call Directly'}>
                  <span className="nagar-btn-icon">📞</span>
                  <div className="nagar-btn-text">
                    <small>{isMr ? 'थेट संपर्क' : 'Call Now'}</small>
                    <strong>{mobile}</strong>
                  </div>
                </a>
              )}

              {whatsappNum && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="nagar-action-btn nagar-btn-whatsapp" title={isMr ? 'व्हॉट्सॲपवर मेसेज करा' : 'Chat on WhatsApp'}>
                  <span className="nagar-btn-icon">💬</span>
                  <div className="nagar-btn-text">
                    <small>{isMr ? 'थेट संवाद' : 'WhatsApp'}</small>
                    <strong>{whatsappNum}</strong>
                  </div>
                </a>
              )}

              <button
                type="button"
                onClick={() => (onOpenGallery ? onOpenGallery() : (window.location.href = '/gallery'))}
                className="nagar-action-btn nagar-btn-gallery"
                title={isMr ? 'प्रभाग विकास कामे पहा' : 'View Public Works'}
              >
                <div className="nagar-btn-text">
                  <small>{isMr ? 'विकास अहवाल' : 'Public Works'}</small>
                  <strong>{isMr ? 'विकास कामे' : 'View Work'}</strong>
                </div>
              </button>
            </div>
          </div>
        </div>

        {impactItems.length ? (
        <div className="nagar-impact-ribbon">
          <div className="nagar-impact-grid">
            {impactItems.map((item, idx) => {
              const view = displayHighlightCard(item, isMr);
              return (
              <div key={item.id || idx} className="nagar-impact-card nagar-impact-card-static">
                <span className="nagar-impact-icon">{view.icon || '◈'}</span>
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
      </section>

      {/* Dedicated Nagarsevak Work & Development Photo Gallery ("1 Gallery") */}
      {showGallery && (
        <>
          {minimalWork ? (
            <section className="user-panel-card nagar-minimal-work-card">
              <div className="user-section-head">
                <div>
                  <span className="user-kicker">{isMr ? 'प्रमुख विकास कामे' : 'KEY DEVELOPMENT WORKS'}</span>
                  <h2>{isMr ? 'प्रभाग विकास व कामे अहवाल' : 'Ward Development & Civic Works'}</h2>
                  <p>
                    {isMr
                      ? `${ward?.wardNumber ? formatWardNumber(ward.wardNumber, 'mr') : 'वॉर्ड'} मधील चालू व पूर्ण झालेल्या प्रमुख विकास कामांची संक्षिप्त पाहणी`
                      : `Brief visual overview of completed and ongoing civic projects in ${ward?.wardNumber ? formatWardNumber(ward.wardNumber) : 'your ward'}`}
                  </p>
                </div>
                <Link
                  to="/gallery"
                  className="nagar-view-all-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenGallery) onOpenGallery();
                  }}
                >
                  {isMr ? 'सर्व कामे व व्हिडीओ पहा →' : 'View All Works & Videos →'}
                </Link>
              </div>

              <div className="nagar-minimal-work-grid">
                {(Array.isArray(portalGallery) ? galleryItems : galleryItems.filter((i) => onHomeWork(i)))
                  .map((item, index) => {
                  const fullIndex = filteredGallery.findIndex(g => g.id === item.id);
                  const targetIdx = fullIndex !== -1 ? fullIndex : index;
                  return (
                    <div
                      key={item.id || index}
                      className="nagar-minimal-work-item"
                      onClick={() => setLightboxIndex(targetIdx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxIndex(targetIdx); }}
                      title={isMr ? 'मोठा फोटो किंवा व्हिडीओ पहा' : 'View full project'}
                    >
                    <div className="nagar-minimal-work-thumb">
                      <img src={item.url} alt={item.title} loading="lazy" />
                      {(item.type === 'video' || item.videoUrl) ? (
                        <span className="nagar-minimal-play-badge">▶ {item.duration || 'VIDEO'}</span>
                      ) : (
                        <span className="nagar-minimal-photo-badge">📷 {isMr ? 'छायाचित्र' : 'Photo'}</span>
                      )}
                      <div className="nagar-minimal-hover-lens">
                        <span>{(item.type === 'video' || item.videoUrl) ? '▶' : '⤢'}</span>
                      </div>
                    </div>
                    <div className="nagar-minimal-work-body">
                      <div className="nagar-minimal-meta">
                        <span className="nagar-minimal-date">🗓 {isMr ? (item.dateFormatted || item.date) : (item.dateFormattedEn || item.date)}</span>
                        {item.location && <span className="nagar-minimal-loc">📍 {item.location}</span>}
                      </div>
                      <h4 className="nagar-minimal-title">{isMr ? item.title : (item.titleEn || item.title)}</h4>
                    </div>
                  </div>
                );
              })}
              </div>
            </section>
          ) : (
            <section className="user-panel-card nagar-gallery-card">
              <div className="user-section-head">
          <div>
            <div className="nagar-gallery-badge-row">
              <span className="user-kicker">{isMr ? 'विकास अहवाल व कार्य गॅलरी' : 'WORK & DEVELOPMENT GALLERY'}</span>
              <span className="nagar-gallery-count-pill">{galleryItems.length} {isMr ? 'छायाचित्रे' : 'Photos'}</span>
            </div>
            <h2>{isMr ? 'प्रभाग विकास व उपक्रम गॅलरी' : 'Ward Development & Public Work Gallery'}</h2>
            <p>{isMr ? 'रस्ते, ड्रेनेज, पाणी पुरवठा, स्वच्छता, आरोग्य व सामाजिक विकास कामांचा सचित्र अहवाल' : 'Visual report of completed roads, drainage, water supply, health camps and civic initiatives'}</p>
          </div>
        </div>

        {/* Gallery Category Filter Tabs */}
        <div className="nagar-gallery-filters">
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

        {/* Gallery Image Grid with Visual Effects */}
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
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxIndex(index); }}
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

                    {/* Corner Tag / Badge */}
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
      )}

      {/* High-Resolution Interactive Lightbox Modal */}
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
                    `${activeLightboxItem.title} - प्रभाग क्रमांक ३\n${activeLightboxItem.description}\nतपशील पहा: ${window.location.origin}`
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
    </>
  )}
  </>
);
}
