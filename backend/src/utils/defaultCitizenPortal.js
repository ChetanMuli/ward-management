'use strict';

const CIVIC_DEFAULT_HERO = '/hero-ward-default.jpg';
const CAMPAIGN_STOCK_RE = /hero-campaign-banner|hero-gauri-ajinkya|hero-poster-card|hero-civic-default/i;

function wardNumberDigits(ward) {
  const raw = String(ward?.wardNumber ?? ward ?? '').replace(/\D/g, '');
  return raw.replace(/^0+/, '') || '0';
}

/** Ward 3 is already sold and customized. Never overwrite that portal. */
function isProtectedCustomWard(ward) {
  return wardNumberDigits(ward) === '3';
}

function isCampaignStockUrl(url) {
  return CAMPAIGN_STOCK_RE.test(String(url || ''));
}

function resolveCitizenHeroUrl(url, { demoMode = false } = {}) {
  if (demoMode) return CIVIC_DEFAULT_HERO;
  const live = String(Array.isArray(url) ? url[0] : url || '').trim();
  const usable = live && !live.startsWith('data:');
  return usable ? live : CIVIC_DEFAULT_HERO;
}

/** Shared demo citizen page until a ward is customized and one Nagarsevak is activated. */
const DEFAULT_DEMO_NAGARSEVAK = {
  id: 'demo-ward-nagarsevak',
  name: 'Your Nagarsevak',
  email: null,
  mobile: null,
  wardSeat: null,
  partyName: null,
  officialAddress: null,
  photo: '',
  bio: 'After this ward is activated, residents will see their Nagarsevak, office hours, and public works here.',
  officeTimings: 'Mon–Sat · 10:00 AM – 6:00 PM',
  whatsapp: null,
  achievements: [
    { id: 'demo-a1', icon: '◈', metric: '24/7', label: 'Ward desk', desc: 'Complaints, schemes and notices in one login.' },
    { id: 'demo-a2', icon: '◈', metric: 'Live', label: 'Public works', desc: 'Photos and videos of development will appear after go-live.' },
  ],
  socialLinks: {},
  isDemo: true,
};

const DEFAULT_DEMO_WORKS = [
  {
    id: 'demo-work-roads',
    wardId: null,
    title: 'Road repair & concretization',
    titleMr: 'रस्ते दुरुस्ती व कॉंक्रिटीकरण',
    category: 'DEVELOPMENT',
    categoryLabel: 'Development',
    categoryLabelMr: 'विकास कामे',
    mediaType: 'image',
    mediaUrl: '/gallery/road-construction.svg',
    videoUrl: '/gallery/ward-road-work.mp4',
    duration: '0:30',
    date: '2026-09-24',
    dateFormatted: '24 Sep 2026',
    dateFormattedMr: '२४ सप्टेंबर २०२६',
    location: 'Your ward',
    badge: 'SAMPLE · डेमो',
    description: 'Sample public-work card. Replace this with real photos after the Nagarsevak portal is activated.',
    descriptionMr: 'हे नमुना कार्ड आहे. नगरसेवक पोर्टल सक्रिय केल्यानंतर खरे फोटो जोडा.',
    status: 'PUBLISHED',
    orderIndex: 0,
    showOnDashboard: true,
    isDemo: true,
  },
  {
    id: 'demo-work-water',
    wardId: null,
    title: 'Water supply inspection',
    titleMr: 'पाणी पुरवठा पाहणी',
    category: 'WATER',
    categoryLabel: 'Water & Sanitation',
    categoryLabelMr: 'पाणी व स्वच्छता',
    mediaType: 'image',
    mediaUrl: '/gallery/water-pipeline.svg',
    videoUrl: '/gallery/ward-water-project.mp4',
    duration: '0:45',
    date: '2026-09-18',
    dateFormatted: '18 Sep 2026',
    dateFormattedMr: '१८ सप्टेंबर २०२६',
    location: 'Your ward',
    badge: 'SAMPLE · डेमो',
    description: 'Demo water-work preview shown on every ward until custom gallery items are published.',
    descriptionMr: 'कस्टम गॅलरी प्रकाशित होईपर्यंत सर्व वॉर्डांवर हा डेमो दिसेल.',
    status: 'PUBLISHED',
    orderIndex: 1,
    showOnDashboard: true,
    isDemo: true,
  },
  {
    id: 'demo-work-lights',
    wardId: null,
    title: 'Street lighting',
    titleMr: 'पथदिवे',
    category: 'DEVELOPMENT',
    categoryLabel: 'Development',
    categoryLabelMr: 'विकास कामे',
    mediaType: 'image',
    mediaUrl: '/gallery/smart-led-lights.svg',
    videoUrl: '/gallery/ward-lights-inspection.mp4',
    duration: '0:25',
    date: '2026-09-20',
    dateFormatted: '20 Sep 2026',
    dateFormattedMr: '२० सप्टेंबर २०२६',
    location: 'Your ward',
    badge: 'SAMPLE · डेमो',
    description: 'Sample lighting project. Add the buyer’s real works from Portal Management.',
    descriptionMr: 'नमुना पथदिवे काम. खरे कामे पोर्टल व्यवस्थापनातून जोडा.',
    status: 'PUBLISHED',
    orderIndex: 2,
    showOnDashboard: true,
    isDemo: true,
  },
  {
    id: 'demo-work-health',
    wardId: null,
    title: 'Health camp',
    titleMr: 'आरोग्य शिबीर',
    category: 'HEALTH',
    categoryLabel: 'Health Camp',
    categoryLabelMr: 'आरोग्य शिबीर',
    mediaType: 'image',
    mediaUrl: '/gallery/health-camp.svg',
    videoUrl: '/gallery/ward-health-camp.mp4',
    duration: '0:35',
    date: '2026-09-22',
    dateFormatted: '22 Sep 2026',
    dateFormattedMr: '२२ सप्टेंबर २०२६',
    location: 'Your ward',
    badge: 'SAMPLE · डेमो',
    description: 'Sample health-camp card for the shared default citizen page.',
    descriptionMr: 'सर्व वॉर्डांसाठी समान डिफॉल्ट नागरिक पानावरील नमुना आरोग्य शिबीर.',
    status: 'PUBLISHED',
    orderIndex: 3,
    showOnDashboard: true,
    isDemo: true,
  },
];

module.exports = {
  CIVIC_DEFAULT_HERO,
  DEFAULT_DEMO_NAGARSEVAK,
  DEFAULT_DEMO_WORKS,
  isProtectedCustomWard,
  isCampaignStockUrl,
  resolveCitizenHeroUrl,
};
