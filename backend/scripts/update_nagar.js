const { sequelize } = require('../src/models');

const SHORT_VIDEOS_AND_GALLERY = [
  {
    id: 'vid-1',
    type: 'video',
    title: 'रस्ते डांबरीकरण व कॉंक्रिटीकरण पाहणी',
    titleEn: 'Road Concretization Work Inspection',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-24',
    dateFormatted: '२४ सप्टेंबर २०२६',
    dateFormattedEn: '24 Sep 2026',
    location: 'गुलमोहर रोड, प्रभाग ३',
    url: '/gallery/road-construction.svg',
    videoUrl: '/gallery/ward-road-work.mp4',
    duration: '0:30',
    badge: 'शॉर्ट व्हिडीओ · REEL',
    description: 'प्रभाग क्रमांक ३ मधील मुख्य रस्ता कॉंक्रिटीकरण व गतिरोधक कामांची प्रत्यक्ष पाहणी करताना नगरसेवक. कामाच्या उच्च दर्जाची खात्री.'
  },
  {
    id: 'vid-2',
    type: 'video',
    title: '२४/७ पाणी पुरवठा योजना चाचणी',
    titleEn: '24/7 Clean Water Testing',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-18',
    dateFormatted: '१८ सप्टेंबर २०२६',
    dateFormattedEn: '18 Sep 2026',
    location: 'सावेडी जलकुंभ परिसर, प्रभाग ३',
    url: '/gallery/water-pipeline.svg',
    videoUrl: '/gallery/ward-water-project.mp4',
    duration: '0:45',
    badge: 'शॉर्ट व्हिडीओ · REEL',
    description: 'नवीन उच्च दाबाच्या डीआय जलवाहिनीची प्रत्यक्ष पाहणी व प्रभागातील रहिवाशांशी पाण्याचा दाब व स्वच्छतेबाबत चर्चा.'
  },
  {
    id: 'vid-3',
    type: 'video',
    title: 'जनता दरबार - थेट नागरिक तक्रार निवारण',
    titleEn: 'Janta Darbar On-Spot Redressal',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-27',
    dateFormatted: '२७ सप्टेंबर २०२६',
    dateFormattedEn: '27 Sep 2026',
    location: 'जनसंपर्क कार्यालय, सावेडी, प्रभाग ३',
    url: '/gallery/janta-darbar.svg',
    videoUrl: '/gallery/ward-janta-darbar.mp4',
    duration: '0:35',
    badge: 'शॉर्ट व्हिडीओ · REEL',
    description: 'प्रभागातील नागरिकांशी थेट संवाद साधून रस्ते, वीज, ड्रेनेज व स्वच्छता समस्यांचे मनपा अधिकाऱ्यांमार्फत तात्काळ निवारण.'
  },
  {
    id: 'vid-4',
    type: 'video',
    title: 'स्मार्ट हायमास्ट व एलईडी पथदिवे लोकार्पण',
    titleEn: 'Smart Highmast LED Illumination',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-20',
    dateFormatted: '२० सप्टेंबर २०२६',
    dateFormattedEn: '20 Sep 2026',
    location: 'टी.व्ही. सेंटर चौक, प्रभाग ३',
    url: '/gallery/smart-led-lights.svg',
    videoUrl: '/gallery/ward-lights-inspection.mp4',
    duration: '0:25',
    badge: 'शॉर्ट व्हिडीओ · REEL',
    description: 'महिला व ज्येष्ठ नागरिकांच्या सुरक्षिततेसाठी प्रभागातील प्रमुख चौकांमध्ये हायमास्ट आणि अंतर्गत रस्त्यांवर ऊर्जाबचत करणारे स्मार्ट एलईडी दिवे कार्यान्वित केले.'
  },
  {
    id: 'vid-5',
    type: 'video',
    title: 'भव्य मोफत आरोग्य व नेत्र तपासणी शिबीर',
    titleEn: 'Free Health & Eye Screening Camp',
    category: 'VIDEOS',
    categoryLabel: 'व्हिडीओ अहवाल',
    categoryLabelEn: 'Video Report',
    date: '2026-09-08',
    dateFormatted: '०८ सप्टेंबर २०२६',
    dateFormattedEn: '08 Sep 2026',
    location: 'सावेडी समाज मंदिर हॉल, प्रभाग ३',
    url: '/gallery/health-camp.svg',
    videoUrl: '/gallery/ward-health-camp.mp4',
    duration: '0:40',
    badge: 'शॉर्ट व्हिडीओ · REEL',
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
    location: 'गुलमोहर रोड व प्रोफेसर कॉलनी, प्रभाग ३',
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
    location: 'पंकज कॉलनी व सावेडी रोड परिसर, प्रभाग ३',
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
    location: 'सावेडी समाज मंदिर हॉल, प्रभाग ३',
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
    location: 'अहिल्या उद्यान परिसर, यशवंतनगर, प्रभाग ३',
    url: '/gallery/tree-plantation.svg',
    badge: 'पर्यावरण संवर्धन',
    description: 'प्रदूषणमुक्त व निरोगी प्रभागासाठी देशी वृक्षांची लागवड करून संरक्षक जाळ्या बसविण्यात आल्या. स्थानिक नागरिक व तरुणांचा उत्स्फूर्त सहभाग लाभला.'
  }
];

(async () => {
  try {
    const galleryJson = JSON.stringify(SHORT_VIDEOS_AND_GALLERY);
    await sequelize.query(
      "UPDATE nagarsevak_users SET photo = '/hero-poster-card.png', gallery = ? WHERE mobile = '9225522255'",
      { replacements: [galleryJson] }
    );
    console.log('Successfully updated nagarsevak_users table!');
  } catch (e) {
    console.error('Update failed:', e);
  } finally {
    process.exit(0);
  }
})();
