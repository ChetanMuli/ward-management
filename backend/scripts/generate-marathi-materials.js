'use strict';

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.resolve(__dirname, '../../documentation');
const ROOT_DIR = path.resolve(__dirname, '../../');
const PUBLIC_DIR = path.resolve(__dirname, '../../frontend/public');
const DIST_DIR = path.resolve(__dirname, '../../frontend/dist');
const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c8fa2c47-1d4c-40fa-b0bb-758f1dd580c2';

const FONT_REG = path.resolve(__dirname, '../Mukta-Regular.ttf');
const FONT_BOLD = path.resolve(__dirname, '../Mukta-Bold.ttf');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ============================================================================
// PART 1: GENERATE MARATHI POWERPOINT PRESENTATION (.PPTX)
// ============================================================================
async function generateMarathiPresentation() {
  console.log('[PPTX-MR] Generating Marathi client presentation...');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Smart Ward Management Team';
  pptx.company = 'Digital Civic Administration Solutions';
  pptx.title = 'स्मार्ट वॉर्ड व्यवस्थापन प्रणाली - सादरीकरण';

  const NAVY = '0F172A';
  const EMERALD = '059669';
  const TEAL = '0D9488';
  const BLUE = '2563EB';
  const SLATE = '1E293B';
  const MUTED = '64748B';
  const LIGHT_BG = 'F8FAFC';
  const CARD_BORDER = 'E2E8F0';
  const WHITE = 'FFFFFF';
  const GOLD = 'D97706';

  function addHeader(slide, category, title, subtitle) {
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: EMERALD } });
    slide.addText(category, {
      x: 0.8,
      y: 0.35,
      w: 8.4,
      h: 0.25,
      fontSize: 11,
      bold: true,
      color: TEAL,
    });
    slide.addText(title, {
      x: 0.8,
      y: 0.6,
      w: 8.4,
      h: 0.5,
      fontSize: 21,
      bold: true,
      color: NAVY,
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.8,
        y: 1.1,
        w: 8.4,
        h: 0.3,
        fontSize: 12,
        color: MUTED,
      });
    }
  }

  // SLIDE 1: Title
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: EMERALD } });

    slide.addText('प्रगत नागरी प्रशासन व मतदारसंघ व्यवस्थापन प्रणाली', {
      x: 0.8,
      y: 1.1,
      w: 8.4,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: TEAL,
    });

    slide.addText('स्मार्ट वॉर्ड व्यवस्थापन प्रणाली', {
      x: 0.8,
      y: 1.5,
      w: 8.4,
      h: 0.8,
      fontSize: 34,
      bold: true,
      color: WHITE,
    });

    slide.addText('Smart Ward Management System (Enterprise Edition v1.0)', {
      x: 0.8,
      y: 2.35,
      w: 8.4,
      h: 0.4,
      fontSize: 18,
      color: '93C5FD',
    });

    slide.addText('महानगरपालिका, नगरपालिका, नगरसेवक, प्रभाग अधिकारी, कर्मचारी आणि नागरिकांसाठी संपूर्ण एकात्मिक डिजिटल व्यासपीठ — पारदर्शक तक्रार निवारण, दैनंदिन प्रभाग पाहणी वेळापत्रक, कुटुंब व मतदार नोंदणी, शासकीय योजना आणि १००% अस्खलित मराठी व इंग्रजी इंटरफेस.', {
      x: 0.8,
      y: 2.9,
      w: 8.4,
      h: 1.2,
      fontSize: 13,
      color: 'CBD5E1',
      lineSpacing: 22,
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 4.4,
      w: 8.4,
      h: 0.6,
      rectRadius: 0.08,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 },
    });
    slide.addText('अधिकृत क्लायंट सादरीकरण  |  थेट उत्पादन आवृत्ती १.०  |  पूर्ण डेटा सुरक्षा व ६० दिवस रिसायकल बिन', {
      x: 0.9,
      y: 4.52,
      w: 8.2,
      h: 0.35,
      fontSize: 11,
      bold: true,
      color: '38BDF8',
      align: 'center',
    });
  }

  // SLIDE 2: Executive Overview
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'कार्यकारी सारांश (Executive Summary)', 'स्थानिक प्रभाग कारभाराचे डिजिटल सक्षमीकरण', 'लोकप्रतिनिधी, पालिका प्रशासन आणि प्रभाग नागरिक यांच्यातील अंतर मिटवणारी एकात्मिक प्रणाली.');

    const cards = [
      {
        title: 'थेट नागरिक तक्रार निवारण',
        desc: 'घराचा पत्ता व नकाशाशी जोडलेली तक्रार नोंदणी, प्रत्यक्ष कामापूर्वी व कामानंतरचे फोटो पुरावे, कर्मचाऱ्यांना थेट काम वाटप व २४ तासांत निवारण.',
        color: BLUE,
      },
      {
        title: 'नगरसेवक दैनंदिन प्रभाग पाहणी',
        desc: 'दैनिक भेटी, बैठका, प्रभागातील विकासकामे, पाहणी दौरे आणि कर्मचाऱ्यांना कामांचे वाटप; सकाळच्या कामांसाठी १-क्लिक छापील अजेंडा.',
        color: EMERALD,
      },
      {
        title: 'सखोल जनगणती व मालमत्ता नोंद',
        desc: '६-स्तरीय प्रभाग रचना: वॉर्ड > परिसर/कॉलनी > इमारत/अपार्टमेंट > घर/फ्लॅट/दुकान > कुटुंब > नागरिक (मूळ गाव, व्यवसाय, मतदार माहितीसह).',
        color: TEAL,
      },
      {
        title: 'शासकीय योजना व मतदार केंद्र',
        desc: 'शासकीय मतदार यादी अपलोड व विभागणी, १८+ नवमतदार शोध, लाडकी बहीण/घरकुल योजना वाटप आणि दहावा दिवस व वाढदिवस आठवण प्रणाली.',
        color: GOLD,
      },
    ];

    cards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 4.3;
      const y = 1.6 + row * 1.75;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y,
        w: 4.1,
        h: 1.55,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addShape(pptx.shapes.RECTANGLE, { x, y: y + 0.15, w: 0.1, h: 0.5, fill: { color: c.color } });

      slide.addText(c.title, {
        x: x + 0.25,
        y: y + 0.15,
        w: 3.7,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: NAVY,
      });

      slide.addText(c.desc, {
        x: x + 0.25,
        y: y + 0.55,
        w: 3.7,
        h: 0.85,
        fontSize: 11,
        color: SLATE,
        lineSpacing: 16,
      });
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.15, w: 8.4, h: 0.35, fill: { color: 'F1F5F9' } });
    slide.addText('मुख्य परिणाम: तक्रार निवारणात ७५% वेग, १००% डेटा पारदर्शकता आणि प्रभागातील प्रत्येक कुटुंबाशी थेट लोकसंपर्क.', {
      x: 0.8,
      y: 5.2,
      w: 8.4,
      h: 0.25,
      fontSize: 10,
      bold: true,
      color: SLATE,
      align: 'center',
    });
  }

  // SLIDE 3: Comparison
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'परिवर्तनाचा मार्ग', 'पारंपरिक पद्धत विरुद्ध स्मार्ट वॉर्ड डिजिटल उपाय', 'कागदी वह्या आणि व्हॉट्सअ‍ॅपच्या गोंधळाकडून अधिकृत डिजिटल कार्यप्रणालीकडे.');

    const headers = [
      { text: 'कार्यक्षेत्र', options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11 } },
      { text: 'पारंपरिक अडचणी (कागदी कारभार)', options: { bold: true, color: WHITE, fill: { color: 'DC2626' }, fontSize: 11 } },
      { text: 'स्मार्ट वॉर्ड डिजिटल प्रणाली', options: { bold: true, color: WHITE, fill: { color: EMERALD }, fontSize: 11 } },
    ];

    const rows = [
      ['नागरिक तक्रारी', 'कागदी नोंदवही, हरवलेली पत्रे, कामाचा पुरावा नाही, नागरिक असमाधानी.', 'मोबाईलवर तक्रार, प्रत्यक्ष कामाचा आधीचा व नंतरचा फोटो, थेट कर्मचारी नियुक्ती.'],
      ['नगरसेवक पाहणी दौरा', 'तोंडी सूचना, विसरलेली कामे, रोजच्या कामांचा लेखी रेकॉर्ड नसणे.', 'दैनिक वेळापत्रक (भेटी, पाहणी, बैठका), कामाचे वाटप आणि छापील सकाळचा अजेंडा.'],
      ['प्रभाग जनगणती डेटा', 'अपडेट नसलेली यादी, भाडेकरूंची अपुरी माहिती, मूळ गावाची नोंद नाही.', '६-स्तरीय प्रभाग रचना, कुटुंब वृक्ष, मतदार माहिती, दुकाने व कार्यालयांची स्वतंत्र नोंदणी.'],
      ['शासकीय योजना', 'नागरिकांना योजनांची माहिती नाही, पात्र लाभार्थ्यांपर्यंत अर्ज पोहोचत नाहीत.', 'केंद्रीकृत योजना दालन, वय/लिंग/उत्पन्नानुसार पात्र नागरिक फिल्टर व थेट मेसेज.'],
      ['डेटा सुरक्षितता', 'नोंदवही फाटणे किंवा डेटा चुकून डिलीट होणे, पुन्हा मिळवण्याची सोय नाही.', '६० दिवस सुरक्षित रिसायकल बिन; डिलीट केलेला डेटा १-क्लिकवर पूर्ववत (Restore).'],
      ['मराठी भाषा अडचण', 'इंग्रजी सॉफ्टवेअरमुळे क्षेत्रीय कर्मचारी व सर्वसामान्य नागरिकांना वापरणे कठीण.', 'द्वि-स्तरीय अस्खलित मराठी प्रणाली: 0ms जलद शब्दकोश + दैनंदिन मजकूर थेट मराठीत.'],
    ];

    const tableData = [headers, ...rows.map(r => r.map((cell, idx) => ({
      text: cell,
      options: {
        fontSize: 10,
        color: idx === 0 ? NAVY : SLATE,
        bold: idx === 0,
        fill: { color: idx === 0 ? 'F1F5F9' : (idx === 1 ? 'FEF2F2' : 'F0FDF4') },
      },
    })))];

    slide.addTable(tableData, {
      x: 0.8,
      y: 1.6,
      w: 8.4,
      colW: [1.8, 3.3, 3.3],
      rowH: 0.5,
      border: { pt: 0.5, color: CARD_BORDER },
    });
  }

  // SLIDE 4: RBAC Portals
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'प्रणाली सुरक्षा व प्रशासन', '६-स्तरीय भूमिका-आधारित प्रवेश नियंत्रण (RBAC)', 'प्रत्येक घटकासाठी स्वतंत्र पोर्टल व कडक डेटा सुरक्षा मर्यादा.');

    const roles = [
      { role: 'मास्टर अ‍ॅडमिन (Super Admin)', access: 'संपूर्ण यंत्रणेवर नियंत्रण, नवीन वॉर्ड तयार करणे, सब-अ‍ॅडमिन नेमणे, ऑडिट लॉग तपासणे आणि संपूर्ण प्रणाली देखभाल.' },
      { role: 'सब मास्टर अ‍ॅडमिन (Sub Admin)', access: 'झोन/प्रभाग पातळीवर देखरेख, एकाधिक वॉर्डांचे नियंत्रण, नगरसेवक खात्यांची पडताळणी आणि विभागीय अहवाल.' },
      { role: 'नगरसेवक (Municipal Corporator)', access: 'प्रभागाचा स्वतंत्र डॅशबोर्ड, दैनंदिन दौरा वेळापत्रक, तक्रार देखरेख, प्रभाग घडामोडी, थेट नागरिक संवाद आणि टीम समन्वय.' },
      { role: 'प्रभाग कार्यकर्ता / सहाय्यक (Ward Worker)', access: 'नगरसेवकांच्या मार्गदर्शनाखाली काम करणारे प्रभाग कार्यकर्ते/स्वीय सहाय्यक (पालिका कर्मचारी नव्हे); नेमून दिलेल्या परिसरातील तक्रारी सोडवणे, कामाचे फोटो अपलोड करणे, घरोघरी सर्व्हे व दैनंदिन पाठपुरावा.' },
      { role: 'नागरिक पोर्टल (Citizen Resident)', access: 'नागरिकांसाठी सोपे पोर्टल; फोटोसह तक्रार नोंदवणे, तक्रारीचा प्रवास पाहणे, वॉर्ड घडामोडी व शासकीय योजना पाहणे.' },
      { role: 'सामाजिक कार्यकर्ते व उमेदवार', access: 'स्थानिक सामाजिक कार्यकर्ते व निवडणूक उमेदवारांसाठी अधिकृत जनसंपर्क व नागरी समन्वय दालन.' },
    ];

    roles.forEach((r, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 4.3;
      const y = 1.6 + row * 1.15;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y,
        w: 4.1,
        h: 1.05,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addShape(pptx.shapes.OVAL, { x: x + 0.15, y: y + 0.15, w: 0.28, h: 0.28, fill: { color: col === 0 ? BLUE : EMERALD } });

      slide.addText(r.role, {
        x: x + 0.5,
        y: y + 0.12,
        w: 3.4,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: NAVY,
      });

      slide.addText(r.access, {
        x: x + 0.5,
        y: y + 0.42,
        w: 3.4,
        h: 0.55,
        fontSize: 9.5,
        color: MUTED,
        lineSpacing: 13,
      });
    });
  }

  // SLIDE 5: Grievances
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'प्रमुख कार्यप्रणाली', 'नागरिक तक्रार निवारण यंत्रणा (Grievance Redressal)', 'पारदर्शक तक्रार नोंदणी, प्रत्यक्ष कामाचा फोटो पुरावा आणि ५-टप्प्यांची कार्यप्रणाली.');

    const steps = [
      { step: '१. नागरिक नोंदणी', desc: 'नागरिक स्वतः मोबाईल किंवा संगणकावरून फोटोसह पाणीपुरवठा, सांडपाणी, रस्ते, पथदिवे, कचरा या श्रेणीत तक्रार नोंदवतो.' },
      { step: '२. थेट कर्मचारी नियुक्ती', desc: 'परिसराच्या नकाशानुसार तक्रार आपोआप संबंधित प्रभाग कर्मचारी व नगरसेवकाकडे सोपवली जाते.' },
      { step: '३. प्रत्यक्ष जागेवर काम', desc: 'कर्मचारी घटनास्थळी भेट देतो, पाहणी करतो आणि तक्रारीची स्थिती "प्रगतीपथावर" (IN_PROGRESS) करतो.' },
      { step: '४. कामाचा फोटो पुरावा', desc: 'काम पूर्ण झाल्यावर कर्मचारी जागेवरील निवारणाचा फोटो (Resolution Proof) अपलोड करतो आणि "निराकरण झाले" (RESOLVED) करतो.' },
      { step: '५. ऑटो-क्लोजर व समाधान', desc: 'नागरिकाने समाधान व्यक्त केल्यावर किंवा रात्रीच्या स्वयंचलित पडताळणीनंतर तक्रार "बंद" (CLOSED) केली जाते.' },
    ];

    steps.forEach((s, i) => {
      const y = 1.6 + i * 0.75;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.65,
        rectRadius: 0.08,
        fill: { color: i === 3 ? 'ECFDF5' : LIGHT_BG },
        line: { color: i === 3 ? EMERALD : CARD_BORDER, width: 1 },
      });
      slide.addText(s.step, {
        x: 1.0,
        y: y + 0.12,
        w: 2.2,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: i === 3 ? EMERALD : NAVY,
      });
      slide.addText(s.desc, {
        x: 3.2,
        y: y + 0.1,
        w: 5.8,
        h: 0.45,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 6: Schedules
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'क्षेत्रीय कार्यक्षमता', 'नगरसेवक दैनंदिन वेळापत्रक व सकाळची दैनंदिनी', 'लोकप्रतिनिधी आणि पालिका कर्मचाऱ्यांच्या रोजच्या कामांचे शिस्तबद्ध नियोजन.');

    const features = [
      { title: 'कामांचे सुस्पष्ट वर्गीकरण', desc: 'क्षेत्रीय भेट (Visit), बैठक (Meeting), वॉर्ड पाहणी (Inspection), सार्वजनिक कार्यक्रम (Event) आणि नागरिक गाऱ्हाणे (Citizen Hearing).' },
      { title: 'प्राधान्यक्रम रचना', desc: 'तातडीचे (Urgent), उच्च (High), मध्यम (Medium) आणि कमी (Low) प्राधान्य ठरवून महत्त्वाच्या नागरी समस्या आधी सोडवणे.' },
      { title: 'कर्मचाऱ्यांना १-क्लिक काम वाटप', desc: 'वेळापत्रकातील पाहणी किंवा काम थेट प्रभागातील कर्मचाऱ्याकडे सोपवा; कर्मचाऱ्याने पूर्ण केलेल्या कामाची प्रगती नोंद ठेवा.' },
      { title: 'छापील सकाळचा अजेंडा (PDF)', desc: 'सकाळच्या रोल-कॉलसाठी १-क्लिकवर दैनंदिन पाहणी पत्रिका (Daily Action Sheet) PDF डाऊनलोड व प्रिंट करा.' },
    ];

    features.forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * 4.3;
      const y = 1.7 + row * 1.7;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y,
        w: 4.1,
        h: 1.5,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(f.title, {
        x: x + 0.2,
        y: y + 0.15,
        w: 3.7,
        h: 0.35,
        fontSize: 13,
        bold: true,
        color: TEAL,
      });

      slide.addText(f.desc, {
        x: x + 0.2,
        y: y + 0.55,
        w: 3.7,
        h: 0.85,
        fontSize: 10.5,
        color: SLATE,
        lineSpacing: 15,
      });
    });
  }

  // SLIDE 7: Census
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'डेटा संकलन रचना', 'प्रभाग जनगणती, घरे व दुकानांची संपूर्ण नोंदणी', 'प्रभागातील प्रत्येक गल्ली, इमारत, कुटुंब आणि नागरिकाची अचूक माहिती.');

    const levels = [
      ['स्तर १: वॉर्ड (Ward)', 'महानगरपालिका वॉर्ड क्रमांक, सीमा वर्णन व नियुक्त नगरसेवक खाते.'],
      ['स्तर २: परिसर / कॉलनी (Area)', 'उपनगर, कॉलनी, झोपडपट्टी, सोसायटी व कर्मचाऱ्यांचे जबाबदारी क्षेत्र.'],
      ['स्तर ३: इमारत / अपार्टमेंट (Apartment)', 'अपार्टमेंट, गृहनिर्माण सोसायट्या, मजले आणि सदनिका संख्या.'],
      ['स्तर ४: घर / दुकान (House & Shop)', 'निवासी घरे आणि स्वतंत्र व्यावसायिक दुकाने/कार्यालये (मालकी/भाडेकरू).'],
      ['स्तर ५: कुटुंब घटक (Family)', 'कुटुंबप्रमुख, मूळ गाव, तालुका, जिल्हा व शिधापत्रिका (Ration Card) माहिती.'],
      ['स्तर ६: नागरिक सदस्य (Person)', 'पूर्ण नाव, जन्मतारीख, मतदार ओळखपत्र, आधार, पॅन, शिक्षण व व्यवसाय.'],
    ];

    levels.forEach(([lvl, desc], i) => {
      const y = 1.6 + i * 0.6;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.52,
        rectRadius: 0.06,
        fill: { color: i % 2 === 0 ? 'F8FAFC' : 'F1F5F9' },
        line: { color: CARD_BORDER, width: 1 },
      });
      slide.addText(lvl, {
        x: 1.0,
        y: y + 0.08,
        w: 2.8,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: NAVY,
      });
      slide.addText(desc, {
        x: 3.8,
        y: y + 0.08,
        w: 5.2,
        h: 0.35,
        fontSize: 10,
        color: SLATE,
      });
    });
  }

  // SLIDE 8: Voters
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'निवडणूक व्यवस्थापन', 'शासकीय मतदार यादी व मतदारसंघ सक्षमीकरण', 'शासकीय मतदार यादी डिजिटल करणे आणि नवमतदारांची शोध मोहीम.');

    const cards = [
      { title: 'अधिकृत मतदार PDF यादी अपलोड', desc: 'निवडणूक आयोगाची मतदार PDF यादी थेट अपलोड करा; प्रणाली मतदारांची नावे, अनुक्रमांक आणि ओळखपत्र क्रमांक स्वयंचलित काढते.' },
      { title: 'वॉर्डनिहाय मतदार विभागणी', desc: 'काढलेले मतदार संबंधित वॉर्ड, प्रभाग आणि नगरसेवक पोर्टफोलिओमध्ये अचूक विभागले जातात; डेटाची सरमिसळ होत नाही.' },
      { title: '१८+ नवमतदार शोध यंत्रणा', desc: 'प्रभागातील जनगणतीमधून १८ वर्षे पूर्ण करणाऱ्या तरुण नागरिकांची स्वयंचलित यादी तयार करून मतदार नोंदणी शिबिरे घेणे सोपे होते.' },
      { title: 'मतदान केंद्र व बूथ मॅपिंग', desc: 'प्रत्येक कुटुंबाला आणि मतदाराला त्यांचे मतदान केंद्र, खोली क्रमांक आणि यादीतील अनुक्रमांक थेट दाखवा.' },
    ];

    cards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 4.3;
      const y = 1.7 + row * 1.7;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y,
        w: 4.1,
        h: 1.5,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(c.title, {
        x: x + 0.2,
        y: y + 0.15,
        w: 3.7,
        h: 0.35,
        fontSize: 13,
        bold: true,
        color: BLUE,
      });

      slide.addText(c.desc, {
        x: x + 0.2,
        y: y + 0.55,
        w: 3.7,
        h: 0.85,
        fontSize: 10.5,
        color: SLATE,
        lineSpacing: 15,
      });
    });
  }

  // SLIDE 9: Schemes
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'जनकल्याणकारी योजना', 'शासकीय योजना व थेट नागरिक लाभ वाटप', 'शासन आपल्या दारी — केंद्र व राज्य शासनाच्या योजनांचा १००% प्रभागात लाभ.');

    const steps = [
      { title: 'योजनांची संपूर्ण माहिती दालन', desc: 'लाडकी बहीण योजना, पीएम आवास, संजय गांधी निराधार, शेतकरी सन्मान निधी, शैक्षणिक शिष्यवृत्ती आणि आरोग्य योजनांचा संच.' },
      { title: 'पात्र नागरिक स्वयंचलित शोध', desc: 'वय, लिंग, उत्पन्न, आणि व्यवसाय (शेतकरी, महिला, विद्यार्थी, ज्येष्ठ नागरिक) यानुसार पात्र लाभार्थी १-क्लिकवर फिल्टर करा.' },
      { title: 'थेट नागरिक मेसेज प्रसारण', desc: 'योजनेचा अर्ज भरण्याची तारीख आणि लागणारी कागदपत्रे पात्र नागरिकांना थेट मोबाईल नोटिफिकेशनद्वारे पाठवा.' },
      { title: 'अर्ज व मंजुरी पाठपुरावा', desc: 'कोणत्या नागरिकाने कोणत्या योजनेचा लाभ घेतला याची नोंद थेट त्याच्या नागरिक प्रोफाइलमध्ये जतन ठेवा.' },
    ];

    steps.forEach((s, idx) => {
      const y = 1.6 + idx * 0.85;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.75,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(s.title, {
        x: 1.0,
        y: y + 0.12,
        w: 2.8,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: EMERALD,
      });

      slide.addText(s.desc, {
        x: 3.9,
        y: y + 0.12,
        w: 5.1,
        h: 0.5,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 10: Observances & Birthdays
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'सामाजिक बांधिलकी', 'मृत्यू नोंदणी, दहावा दिवस व नागरिक वाढदिवस आठवण', 'सुख-दुःखात नागरिकांच्या पाठीशी खंबीरपणे उभे राहणारा संवेदनशील कारभार.');

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: LIGHT_BG },
      line: { color: CARD_BORDER, width: 1 },
    });
    slide.addText('मृत्यू नोंद व धार्मिक विधी आठवण', {
      x: 1.0,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: NAVY,
    });
    const dPts = [
      'निधन झालेल्या नागरिकाची कुटुंब घटकाशी जोडलेली अधिकृत नोंद.',
      'दहावा दिवस (10th Day Observance): कुटुंब सांत्वन भेटीसाठी नगरसेवक व टीमला वेळेवर स्वयंचलित सूचना.',
      'प्रथम पुण्यस्मरण (1st Year Remembrance): एका वर्षाने पुण्यस्मरणाची पूर्वसूचना.',
      'सक्रिय मतदार यादीतून नाव आदराने वेगळे केले जाते, जेणेकरून मतदानाच्या आकडेवारीत त्रुटी राहत नाही.',
    ];
    dPts.forEach((p, idx) => {
      slide.addText(`•  ${p}`, { x: 1.0, y: 2.3 + idx * 0.65, w: 3.7, h: 0.55, fontSize: 10.5, color: SLATE });
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 5.1,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: LIGHT_BG },
      line: { color: CARD_BORDER, width: 1 },
    });
    slide.addText('नागरिक वाढदिवस शुभेच्छा', {
      x: 5.3,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: NAVY,
    });
    const bPts = [
      'जनगणतीमधील जन्मतारखेनुसार स्वयंचलित वाढदिवस दिनदर्शिका.',
      'रोज सकाळी नगरसेवकाच्या डॅशबोर्डवर आज वाढदिवस असणाऱ्या प्रभाग नागरिकांची यादी.',
      '१-क्लिकवर वैयक्तिक शुभेच्छा संदेश (SMS / WhatsApp) किंवा शुभेच्छा पत्र.',
      'पुढील ७, १५ किंवा ३० दिवसांतील वाढदिवस पाहून जनसंपर्काचे नियोजन.',
    ];
    bPts.forEach((p, idx) => {
      slide.addText(`•  ${p}`, { x: 5.3, y: 2.3 + idx * 0.65, w: 3.7, h: 0.55, fontSize: 10.5, color: SLATE });
    });
  }

  // SLIDE 11: Community Hub
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'नागरी संवाद', 'प्रभाग संवाद केंद्र (Community Hub) व थेट चर्चा गट', 'नागरिक आणि लोकप्रतिनिधींमध्ये विश्वास वाढवणारी अधिकृत संपर्क प्रणाली.');

    const channels = [
      { name: 'प्रभाग अधिकृत घडामोडी (Updates)', desc: 'पाणीपुरवठा वेळापत्रक, वीज दुरुस्ती, आरोग्य व लसीकरण शिबिरे आणि सणांचे नियोजन फोटोसह प्रभागात प्रसारित करा.' },
      { name: 'सर्व-वॉर्ड नागरिक चर्चा गट (All Chat)', desc: 'प्रभागातील अधिकृत नागरिकांचा संवाद मंच; नागरी समस्यांवर विधायक चर्चा व प्रशासकीय उत्तरे.' },
      { name: 'नगरसेवक कोअर सल्लागार गट', desc: 'नगरसेवक आणि प्रभागातील ज्येष्ठ नेते, कार्यकर्ते व वॉर्ड समिती सदस्यांसाठी खास बंदिस्त समन्वय गट.' },
      { name: 'मल्टीमीडिया मेसेजिंग व सूचना', desc: 'फोटो, व्हिडिओ, शासकीय परिपत्रके व महत्त्वाच्या सूचनांचे नागरिकांना जलद वितरण.' },
    ];

    channels.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 4.3;
      const y = 1.7 + row * 1.7;

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y,
        w: 4.1,
        h: 1.5,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(c.name, {
        x: x + 0.2,
        y: y + 0.15,
        w: 3.7,
        h: 0.35,
        fontSize: 13,
        bold: true,
        color: TEAL,
      });

      slide.addText(c.desc, {
        x: x + 0.2,
        y: y + 0.55,
        w: 3.7,
        h: 0.85,
        fontSize: 10.5,
        color: SLATE,
        lineSpacing: 15,
      });
    });
  }

  // SLIDE 12: Dual Tier Localization
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'समावेशक नागरी तंत्रज्ञान', 'द्वि-स्तरीय मराठी भाषांतर इंजिन (Dual-Tier Engine)', 'महाराष्ट्र शासनाच्या प्रशासकीय गरजांसाठी आणि क्षेत्रीय कर्मचाऱ्यांसाठी खास विकसित.');

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: 'F0FDF4' },
      line: { color: EMERALD, width: 1 },
    });
    slide.addText('स्तर १: 0ms थेट स्थानिक शब्दकोश', {
      x: 1.0,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: EMERALD,
    });
    const t1 = [
      'इंटरनेटचा विलंब नाही: ५०+ डेटाबेस स्थिती, भूमिका व बटणे एका क्षणात अस्खलित मराठीत.',
      'तक्रार स्थिती: नोंदवले (SUBMITTED), प्रगतीपथावर (IN_PROGRESS), निराकरण झाले (RESOLVED), बंद केले (CLOSED).',
      'समस्या प्रकार: पाणीपुरवठा (WATER), रस्ते व वाहतूक (ROADS), कचरा व स्वच्छता (GARBAGE).',
      'प्रणाली भूमिका: मास्टर अ‍ॅडमिन, नगरसेवक, पालिका कर्मचारी, नागरिक.',
    ];
    t1.forEach((p, idx) => {
      slide.addText(`•  ${p}`, { x: 1.0, y: 2.3 + idx * 0.68, w: 3.7, h: 0.58, fontSize: 10, color: SLATE });
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 5.1,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: 'EFF6FF' },
      line: { color: BLUE, width: 1 },
    });
    slide.addText('स्तर २: लाइव्ह म्यूटेशन ऑब्झर्व्हर', {
      x: 5.3,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: BLUE,
    });
    const t2 = [
      'डायनॅमिक मजकूर अनुवाद: नागरिकांनी रोज नव्याने लिहिलेल्या तक्रारी, शेरे व नावांचा रिअल-टाइम अनुवाद.',
      'रिएक्ट क्रॅश प्रोटेक्शन: गुगल ट्रान्सलेटमुळे वेबसाइट हँग किंवा क्रॅश होऊ नये म्हणून खास DOM सुरक्षा कवच.',
      'मराठी/इंग्रजी १-क्लिक टॉगल: भाषा प्राधान्य ब्राऊझरमध्ये कायमस्वरूपी सुरक्षित सेव्ह राहते.',
      'मोबाईल व टॅबलेटवर १००% सुसंगत व जलद अनुभव.',
    ];
    t2.forEach((p, idx) => {
      slide.addText(`•  ${p}`, { x: 5.3, y: 2.3 + idx * 0.68, w: 3.7, h: 0.58, fontSize: 10, color: SLATE });
    });
  }

  // SLIDE 13: Data Safety & Two-Stage Lifecycle (75-Day Archive + 30-Day Recycle Bin)
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'डेटा सुरक्षा व गोपनीयता', '२-टप्प्यांचे डेटा जीवनचक्र व ३०-दिवसीय सुरक्षित रिसायकल बिन', 'अनावधानाने डेटा नष्ट होण्यापासून १००% संरक्षण, ७५-दिवसीय ऑटो-अर्काइव्ह व संपूर्ण ऑडिट ट्रेल.');

    const items = [
      { title: 'स्वतंत्र डेटाबेस तक्ते (Separate Tables)', desc: 'प्रत्येक भूमिकेसाठी स्वतंत्र लॉगिन तक्ते (admin_users, sub_admin_users, nagarsevak_users, employee_users, citizen_users, community_users); यामुळे पासवर्ड व डेटा सुरक्षित राहतो.' },
      { title: '७५ दिवसांनंतर स्वयंचलित रिसायकल बिन', desc: 'दैनंदिन शेड्युल/टास्क, नागरिक तक्रारी व चॅट डेटा ७५ दिवसांनंतर थेट नष्ट न होता आपोआप रिसायकल बिनमध्ये सुरक्षित हलवला जातो.' },
      { title: '३० दिवस सुरक्षित रिसायकल बिन धोरण', desc: 'घरे, कुटुंबे, नागरिक, दुकाने किंवा इतर कोणतीही नोंद डिलीट केल्यास ती थेट नष्ट होत नाही; ती ३० दिवस रिसायकल बिनमध्ये सुरक्षित राहते.' },
      { title: '१-क्लिक पूर्ववत व ३० दिवसांनंतर ऑटो-पर्ज', desc: '३० दिवसांच्या आत कोणतीही नोंद एका क्लिकवर पूर्ववत करता येते. ३० दिवसांनंतर न पुनर्संचयित केलेला डेटा सिस्टीमद्वारे आपोआप कायमचा नष्ट होतो.' },
    ];

    items.forEach((item, idx) => {
      const y = 1.6 + idx * 0.85;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.75,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(item.title, {
        x: 1.0,
        y: y + 0.12,
        w: 2.8,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: NAVY,
      });

      slide.addText(item.desc, {
        x: 3.9,
        y: y + 0.12,
        w: 5.1,
        h: 0.5,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 14: Tech Stack
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'तांत्रिक रचना', 'आधुनिक, स्केलेबल व सुरक्षित उद्योग मानके', 'स्थिरता, उच्च गती आणि सुरक्षिततेची खात्री देणारी तांत्रिक रचना.');

    const stack = [
      { layer: 'वापरकर्ता इंटरफेस (Frontend)', tech: 'React 18 + Vite 6', details: 'अतिजलद सिंगल पेज ॲप्लिकेशन; मोबाईल, टॅबलेट व डेस्कटॉपसाठी १००% रिस्पॉन्सिव्ह डिझाईन; कोणतीही अनावश्यक जड लायब्ररी नाही.' },
      { layer: 'बॅकएंड सर्व्हर (Backend)', tech: 'Node.js + Express REST API', details: 'सुरक्षित JWT ऑथेंटिकेशन, Bcrypt १२ राउंड पासवर्ड एन्क्रिप्शन, हेल्मेट सुरक्षा हेडर, रेट लिमिटिंग व स्वयंचलित डेटाबेस सिंक.' },
      { layer: 'डेटाबेस (Database)', tech: 'MySQL 8.0 + Sequelize ORM', details: 'मराठी देवनागरीसाठी utf8mb4_unicode_ci सपोर्ट, रिलेशनल फॉरेन कीज, पारदर्शक सॉफ्ट-डिलीट आणि इंडेक्सिंग.' },
      { layer: 'परिनियोजन (Deployment)', tech: 'सिंगल सर्व्हर किंवा डॉकर कंटेनर', details: 'साध्या क्लाउड सर्व्हरवर किंवा महानगरपालिकेच्या स्वतःच्या डेटा सेंटरमध्ये एकाच पोर्टवर चालणारे स्टँडअलोन मॉडेल.' },
    ];

    stack.forEach((s, idx) => {
      const y = 1.65 + idx * 0.9;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.8,
        rectRadius: 0.08,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 1 },
      });

      slide.addText(s.layer, {
        x: 1.0,
        y: y + 0.12,
        w: 2.4,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: NAVY,
      });

      slide.addText(s.tech, {
        x: 1.0,
        y: y + 0.42,
        w: 2.4,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: EMERALD,
      });

      slide.addText(s.details, {
        x: 3.5,
        y: y + 0.12,
        w: 5.5,
        h: 0.6,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 15: ROI & Timeline
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'प्रकल्पाचे मूल्य व फायदे', 'नागरी सेवेचा उच्च दर्जा व १४ दिवसांत थेट सुरूवात', 'अल्प कालावधीत संपूर्ण प्रभाग डिजिटल करण्याची सुलभ योजना.');

    const stats = [
      { num: '७५%', label: 'तक्रार निवारणाचा वेग' },
      { num: '१००%', label: 'डिजिटल कुटुंब जनगणती' },
      { num: '० ms', label: 'मराठी भाषा टॉगल' },
      { num: '७५+३० दिवस', label: '२-टप्प्यांचे डेटा जीवनचक्र' },
    ];

    stats.forEach((s, idx) => {
      const x = 0.8 + idx * 2.15;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x,
        y: 1.65,
        w: 1.95,
        h: 1.1,
        rectRadius: 0.08,
        fill: { color: 'EFF6FF' },
        line: { color: 'BFDBFE', width: 1 },
      });
      slide.addText(s.num, {
        x,
        y: 1.75,
        w: 1.95,
        h: 0.45,
        fontSize: 22,
        bold: true,
        color: BLUE,
        align: 'center',
      });
      slide.addText(s.label, {
        x,
        y: 2.25,
        w: 1.95,
        h: 0.4,
        fontSize: 10,
        bold: true,
        color: NAVY,
        align: 'center',
      });
    });

    slide.addText('१४ दिवसांची टप्प्याटप्प्याने अंमलबजावणी योजना:', {
      x: 0.8,
      y: 2.95,
      w: 8.4,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: NAVY,
    });

    const phases = [
      ['टप्पा १: सर्व्हर व वॉर्ड सेटअप (दिवस १–३)', 'सर्व्हर व डेटाबेस इन्स्टॉलेशन, वॉर्ड क्रमांक व सीमा निश्चिती, नगरसेवक व अधिकारी खाती तयार करणे.'],
      ['टप्पा २: मतदार व जनगणती नोंद (दिवस ४–७)', 'शासकीय मतदार यादी अपलोड, कॉलनी व सोसायट्यांचे नकाशे तयार करणे व सुरुवातीचा कुटुंब डेटा संकलन.'],
      ['टप्पा ३: कर्मचारी प्रशिक्षण (दिवस ८–११)', 'प्रभाग कर्मचारी व स्वच्छता निरीक्षकांसाठी मोबाईल ॲपचे प्रशिक्षण; नगरसेवकांसाठी वेळापत्रक नियोजन.'],
      ['टप्पा ४: सार्वजनिक लोकार्पण (दिवस १२–१४)', 'प्रभागात नागरिक QR कोड व लिंक्स वाटप; थेट तक्रार निवारण सुरू व २४/७ तांत्रिक सहाय्य.'],
    ];

    phases.forEach(([pTitle, pDesc], i) => {
      const y = 3.3 + i * 0.55;
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.8,
        y,
        w: 8.4,
        h: 0.48,
        fill: { color: LIGHT_BG },
        line: { color: CARD_BORDER, width: 0.5 },
      });
      slide.addText(pTitle, {
        x: 0.9,
        y: y + 0.08,
        w: 3.4,
        h: 0.32,
        fontSize: 9.5,
        bold: true,
        color: TEAL,
      });
      slide.addText(pDesc, {
        x: 4.4,
        y: y + 0.08,
        w: 4.7,
        h: 0.32,
        fontSize: 9,
        color: SLATE,
      });
    });
  }

  // SLIDE 16: Closing
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: EMERALD } });

    slide.addText('मनःपूर्वक धन्यवाद', {
      x: 0.8,
      y: 1.3,
      w: 8.4,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: TEAL,
    });

    slide.addText('आपल्या प्रभागाला बनवा डिजिटल व आदर्श', {
      x: 0.8,
      y: 1.7,
      w: 8.4,
      h: 0.8,
      fontSize: 30,
      bold: true,
      color: WHITE,
    });

    slide.addText('पारदर्शक नागरी सेवा, वेळेवर कामे आणि प्रत्येक कुटुंबाशी थेट डिजिटल संवाद.', {
      x: 0.8,
      y: 2.6,
      w: 8.4,
      h: 0.6,
      fontSize: 14,
      color: 'CBD5E1',
    });

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 3.4,
      w: 8.4,
      h: 1.5,
      rectRadius: 0.08,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 },
    });

    slide.addText('पुढील कार्यवाही व चर्चा:', {
      x: 1.0,
      y: 3.55,
      w: 8.0,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: '38BDF8',
    });

    const discussion = [
      '१. प्रत्यक्ष प्रणालीचे थेट प्रात्यक्षिक (Live Demo) — नगरसेवक व नागरिक पोर्टल.',
      '२. प्रभागातील प्रभाग क्रमांक, सीमा आणि कॉलनींची प्राथमिक माहिती नोंदवणे.',
      '३. शासकीय मतदार यादी आणि प्रभाग कर्मचाऱ्यांची नावे प्रणालीत सामावून घेणे.',
    ];

    discussion.forEach((d, idx) => {
      slide.addText(d, {
        x: 1.0,
        y: 3.85 + idx * 0.32,
        w: 8.0,
        h: 0.3,
        fontSize: 11,
        color: WHITE,
      });
    });
  }

  const pptxPath = path.join(OUT_DIR, 'Ward_Management_System_Client_Presentation_Marathi.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  console.log(`[PPTX-MR] Saved Marathi presentation at: ${pptxPath}`);

  // Copy to root, public, dist, and artifacts
  fs.copyFileSync(pptxPath, path.join(ROOT_DIR, 'Ward_Management_System_Client_Presentation_Marathi.pptx'));
  fs.copyFileSync(pptxPath, path.join(PUBLIC_DIR, 'Ward_Management_System_Client_Presentation_Marathi.pptx'));
  if (fs.existsSync(DIST_DIR)) fs.copyFileSync(pptxPath, path.join(DIST_DIR, 'Ward_Management_System_Client_Presentation_Marathi.pptx'));
  try {
    fs.copyFileSync(pptxPath, path.join(ARTIFACTS_DIR, 'Ward_Management_System_Client_Presentation_Marathi.pptx'));
  } catch (_) {}

  return pptxPath;
}

// ============================================================================
// PART 2: GENERATE MARATHI PDF DOCUMENTATION (.PDF)
// ============================================================================
function generateMarathiPdf() {
  return new Promise((resolve, reject) => {
    console.log('[PDF-MR] Generating Marathi documentation PDF with Noto Sans Devanagari...');
    const pdfPath = path.join(OUT_DIR, 'Ward_Management_System_Complete_Documentation_Marathi.pdf');
    const doc = new PDFDocument({
      size: 'A4',
      margin: 45,
      info: {
        Title: 'स्मार्ट वॉर्ड व्यवस्थापन प्रणाली - संपूर्ण प्रकल्प अहवाल व कार्यप्रणाली दस्तऐवज',
        Author: 'Digital Civic Administration Solutions',
        Subject: 'Civic Administration, Electoral Intelligence & Grievance Redressal (Marathi Edition)',
      },
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    doc.registerFont('Devanagari', FONT_REG);
    doc.registerFont('Devanagari-Bold', FONT_BOLD);

    const PRIMARY = '#0F172A';
    const EMERALD = '#059669';
    const SLATE = '#334155';
    const MUTED = '#64748B';
    const LIGHT_BG = '#F8FAFC';

    function addSectionHeader(title, subtitle) {
      doc.moveDown(0.9);
      doc.rect(45, doc.y, 4, 22).fill(EMERALD);
      doc.fillColor(PRIMARY).fontSize(14).font('Devanagari-Bold').text(`  ${title}`, 52, doc.y);
      if (subtitle) {
        doc.fillColor(MUTED).fontSize(9.5).font('Devanagari').text(`  ${subtitle}`, 52, doc.y + 2);
      }
      doc.moveDown(0.7);
    }

    function addSubsection(title) {
      doc.moveDown(0.4);
      doc.fillColor(PRIMARY).fontSize(11.5).font('Devanagari-Bold').text(title);
      doc.moveDown(0.25);
    }

    function addParagraph(text) {
      doc.fillColor(SLATE).fontSize(9.5).font('Devanagari').lineGap(3).text(text);
      doc.moveDown(0.35);
    }

    function addBullet(title, desc) {
      doc.fillColor(EMERALD).fontSize(9.5).font('Devanagari-Bold').text(`*  ${title}: `, { continued: true });
      doc.fillColor(SLATE).font('Devanagari').text(desc);
      doc.moveDown(0.25);
    }

    // COVER PAGE
    doc.rect(0, 0, doc.page.width, 180).fill(PRIMARY);
    doc.fillColor(EMERALD).fontSize(10).font('Devanagari-Bold').text('प्रगत नागरी प्रशासन व मतदारसंघ व्यवस्थापन प्रणाली', 45, 45);
    doc.fillColor('#FFFFFF').fontSize(24).font('Devanagari-Bold').text('स्मार्ट वॉर्ड व्यवस्थापन प्रणाली', 45, 65);
    doc.fillColor('#93C5FD').fontSize(13).font('Helvetica').text('Smart Ward Management System (Enterprise Edition v1.0)', 45, 100);
    doc.fillColor('#CBD5E1').fontSize(10).font('Devanagari').text('संपूर्ण प्रणाली रचना, तांत्रिक तपशील, कार्यप्रणाली व अंमलबजावणी दस्तऐवज', 45, 122);
    doc.fillColor('#38BDF8').fontSize(9).font('Devanagari-Bold').text('अधिकृत मराठी आवृत्ती  |  महानगरपालिका, नगरपालिका व नगरसेवक कार्यालयांसाठी', 45, 145);

    doc.y = 205;

    // METADATA BLOCK
    doc.roundedRect(45, doc.y, 505, 80, 4).fillAndStroke(LIGHT_BG, '#E2E8F0');
    const startMetaY = doc.y + 10;
    doc.fillColor(PRIMARY).fontSize(9.5).font('Devanagari-Bold').text('प्रकल्प माहिती व कार्यकारी सारांश', 60, startMetaY);
    doc.fillColor(MUTED).fontSize(8.5).font('Devanagari')
      .text('प्रकल्प नाव: स्मार्ट वॉर्ड व्यवस्थापन प्रणाली (Smart Ward Management System)', 60, startMetaY + 16)
      .text('लक्षित संस्था: महानगरपालिका, नगरपालिका, प्रभाग समिती, नगरसेवक कार्यालय, वॉर्ड अधिकारी', 60, startMetaY + 29)
      .text('तंत्रज्ञान: React 18, Vite 6, Node.js, Express, MySQL 8.0 (UTF8MB4), Sequelize ORM, JWT, Helmet', 60, startMetaY + 42)
      .text('भाषा उपलब्धता: १००% अस्खलित मराठी व इंग्रजी (0ms थेट शब्दकोश + रिअल-टाइम लाइव्ह अनुवाद)', 60, startMetaY + 55);

    doc.y = 310;

    // SECTION 1
    addSectionHeader('१. कार्यकारी सारांश व उद्दिष्टे (Executive Summary & Vision)', 'स्थानिक नागरी कारभाराला डिजिटल, वेगवान आणि पारदर्शक बनवणारी यंत्रणा.');
    addParagraph('महानगरपालिका आणि नगरपालिका प्रभागांमध्ये दररोज नागरिकांच्या तक्रारी, रस्त्यांची कामे, पाणीपुरवठा समस्या, स्वच्छता आणि विविध सामाजिक कार्यक्रमांचे आयोजन होत असते. पारंपरिक कागदी वह्या, तोंडी निवेदने किंवा व्हॉट्सअ‍ॅपवरील संदेशांमुळे बऱ्याच तक्रारी हरवतात किंवा त्यांच्यावर वेळेत कारवाई होत नाही.');
    addParagraph('स्मार्ट वॉर्ड व्यवस्थापन प्रणाली हे लोकप्रतिनिधी (नगरसेवक), पालिका प्रशासन, क्षेत्रीय कर्मचारी आणि सर्वसामान्य नागरिक यांना एकाच डिजिटल धाग्यात गुंफणारे प्रगत व्यासपीठ आहे. या प्रणालीमुळे प्रत्येक नागरी कामाची प्रत्यक्ष जागेवर नोंद, फोटो पुरावा आणि वेळेवर निवारण शक्य होते.');
    addBullet('पारदर्शक तक्रार निवारण', 'नागरिकाने नोंदवलेली तक्रार थेट संबंधित प्रभाग कर्मचाऱ्याकडे जाते. काम पूर्ण झाल्यावर कामाचा फोटो अपलोड करणे बंधनकारक आहे.');
    addBullet('नगरसेवक दैनंदिन वेळापत्रक', 'दैनिक पाहणी दौरे, बैठका व क्षेत्रीय कामांचे नियोजन; सकाळी कामांच्या वाटपासाठी १-क्लिकवर छापील अजेंडा.');
    addBullet('सखोल कुटुंब व प्रभाग जनगणती', 'प्रभागातील प्रत्येक गल्ली, इमारत, घर आणि कुटुंबातील सदस्यांची जन्मतारीख, व्यवसाय, मूळ गाव व मतदार ओळखपत्रासह नोंद.');
    addBullet('६० दिवस सुरक्षित रिसायकल बिन', 'अनावधानाने कोणताही डेटा डिलीट झाल्यास तो ६० दिवस सुरक्षित राहतो व १-क्लिकवर पूर्ववत (Restore) करता येतो.');
    addBullet('अस्खलित मराठी भाषा', 'महाराष्ट्रातील प्रशासकीय गरजांसाठी ५० हून अधिक स्थिती व बटणे एका क्षणात अस्खलित मराठीत उपलब्ध.');

    // SECTION 2
    addSectionHeader('२. ६-स्तरीय भूमिका व अधिकार रचना (Multi-Tier RBAC)', 'प्रत्येक घटकासाठी स्वतंत्र पोर्टल व कडक डेटा गोपनीयता.');
    addParagraph('या प्रणालीमध्ये प्रत्येक घटकासाठी स्वतंत्र पोर्टल व अधिकार निश्चित केले आहेत:');
    addBullet('मास्टर अ‍ॅडमिन (Super Admin)', 'संपूर्ण प्रणालीवर सर्वोच्च नियंत्रण; नवीन वॉर्ड जोडणे, सब-अ‍ॅडमिन नेमणे, संपूर्ण डेटाबेसचे ऑडिट लॉग तपासणे.');
    addBullet('सब मास्टर अ‍ॅडमिन (Sub Master Admin)', 'प्रभाग किंवा झोन पातळीवरील अधिकारी; एकाधिक वॉर्डांमधील तक्रारी, कर्मचारी आणि नगरसेवकांच्या कामकाजावर देखरेख.');
    addBullet('नगरसेवक (Municipal Corporator)', 'प्रभागाचा मुख्य डॅशबोर्ड; रोजचे वेळापत्रक, प्रभागातील तक्रारी, विकासकामांच्या घडामोडी, नागरिक संदेश व वाढदिवस शुभेच्छा.');
    addBullet('पालिका कर्मचारी (Ward Employee)', 'क्षेत्रीय कामांचे पोर्टल; नेमून दिलेल्या भागातील तक्रारी सोडवणे, प्रत्यक्ष कामाचे फोटो अपलोड करणे व प्रभाग सर्वेक्षण.');
    addBullet('नागरिक पोर्टल (Citizen Resident)', 'नागरिकांसाठी सोपे मोबाईल व वेब पोर्टल; फोटोसह तक्रार नोंदवणे, स्थिती पाहणे व शासकीय योजनांची माहिती घेणे.');
    addBullet('सामाजिक कार्यकर्ते व उमेदवार', 'स्थानिक सामाजिक कार्यकर्ते व अधिकृत प्रतिनिधींसाठी नागरी समन्वय दालन.');

    // SECTION 3
    doc.addPage();
    addSectionHeader('३. प्रमुख कार्यप्रणालींचे सविस्तर विश्लेषण (Core Modules)', 'प्रणालीतील प्रत्येक वैशिष्ट्याची तपशीलवार कार्यप्रणाली.');

    addSubsection('३.१ नागरिक तक्रार निवारण यंत्रणा (Grievance Redressal Engine)');
    addParagraph('तक्रार निवारण ही या प्रणालीची सर्वात महत्त्वाची ताकद आहे:');
    addBullet('विविध नागरी श्रेणी', 'पाणीपुरवठा, सांडपाणी व ड्रेनेज, कचरा व स्वच्छता, रस्ते व खड्डे, पथदिवे, अतिक्रमण, आरोग्य व उद्याने.');
    addBullet('फोटो पुरावा जोडणे', 'नागरिक जागेवरील समस्येचा फोटो जोडून तक्रार दाखल करू शकतो.');
    addBullet('स्वयंचलित कर्मचारी नियुक्ती', 'परिसराच्या नकाशानुसार तक्रार आपोआप संबंधित क्षेत्रीय कर्मचाऱ्याकडे सोपवली जाते.');
    addBullet('कामाच्या ५ स्थिती', 'नोंदवले (SUBMITTED) -> नियुक्त (ASSIGNED) -> प्रगतीपथावर (IN_PROGRESS) -> निराकरण झाले (RESOLVED) -> बंद केले (CLOSED).');
    addBullet('निवारणाचा फोटो पुरावा', 'कर्मचाऱ्याला काम पूर्ण झाल्याचा जागेवरील फोटो अपलोड करावा लागतो.');
    addBullet('रात्रीचे ऑटो-क्लोजर', 'नागरिकाची तक्रार सुटल्यावर ठराविक वेळेत आक्षेप न आल्यास प्रणाली तक्रार आपोआप बंद करते.');

    addSubsection('३.२ नगरसेवक दैनंदिन वेळापत्रक व सकाळची पाहणी दैनंदिनी');
    addParagraph('लोकप्रतिनिधींच्या रोजच्या प्रभाग दौऱ्यांचे शिस्तबद्ध नियोजन:');
    addBullet('कामांचे प्रकार', 'क्षेत्रीय भेट (Visit), अधिकृत बैठक (Meeting), वॉर्ड पाहणी (Inspection), सार्वजनिक कार्यक्रम (Event) व नागरिक गाऱ्हाणे (Hearing).');
    addBullet('प्राधान्यक्रम', 'तातडीचे (Urgent), उच्च (High), मध्यम (Medium) व कमी (Low) प्राधान्य.');
    addBullet('कर्मचाऱ्यांना काम वाटप', 'वेळापत्रकातील पाहणी किंवा समस्या थेट प्रभाग कर्मचाऱ्याकडे १-क्लिकवर वर्ग करा.');
    addBullet('छापील सकाळचा अजेंडा (PDF)', 'सकाळच्या कामाच्या वाटपासाठी १-क्लिकवर छापील अजेंडा PDF स्वरूपात उपलब्ध.');

    addSubsection('३.३ प्रभाग जनगणती, घरे व दुकानांची संपूर्ण नोंदणी');
    addParagraph('प्रभागातील नागरिकांची ६ स्तरांमध्ये केलेली सुव्यवस्थित मांडणी:');
    addBullet('वॉर्ड स्तर', 'वॉर्ड क्रमांक, नाव आणि सीमा वर्णन.');
    addBullet('परिसर / कॉलनी स्तर', 'कॉलनी, सोसायट्या आणि कर्मचाऱ्यांचे जबाबदारी क्षेत्र.');
    addBullet('इमारत स्तर', 'अपार्टमेंट, विंग, मजले आणि सदनिका संख्या.');
    addBullet('घर व दुकाने', 'निवासी घरे आणि स्वतंत्र व्यावसायिक दुकाने व कार्यालये (मालकी/भाडेकरू).');
    addBullet('कुटुंब स्तर', 'कुटुंबप्रमुख, मूळ गाव, तालुका, जिल्हा व शिधापत्रिका माहिती.');
    addBullet('नागरिक सदस्य', 'नाव, जन्मतारीख, मतदार ओळखपत्र, आधार, पॅन, शिक्षण व व्यवसाय.');

    addSubsection('३.४ शासकीय मतदार यादी व मतदारसंघ सक्षमीकरण');
    addBullet('मतदार PDF यादी अपलोड', 'निवडणूक आयोगाची मतदार PDF यादी अपलोड करून मतदारांची नावे स्वयंचलित काढणे.');
    addBullet('वॉर्डनिहाय विभागणी', 'काढलेले मतदार संबंधित वॉर्ड आणि नगरसेवकाच्या खात्यात सुरक्षित विभागणे.');
    addBullet('१८+ नवमतदार शोध', 'प्रभागातील १८ वर्षे पूर्ण करणाऱ्या तरुण मतदारांची स्वयंचलित यादी काढून मतदार नोंदणी शिबिरे घेणे.');

    addSubsection('३.५ शासकीय जनकल्याणकारी योजना दालन');
    addBullet('योजनांची माहिती दालन', 'लाडकी बहीण योजना, पीएम आवास, संजय गांधी निराधार, शेतकरी सन्मान निधी व शिष्यवृत्ती.');
    addBullet('पात्र लाभार्थी शोध', 'वय, लिंग, उत्पन्न व व्यवसायानुसार पात्र नागरिक १-क्लिकवर शोधणे.');
    addBullet('थेट नोटिफिकेशन प्रसारण', 'पात्र नागरिकांना योजनेचा अर्ज भरण्यासाठी थेट मोबाईलवर संदेश पाठवणे.');

    // SECTION 4
    doc.addPage();
    addSubsection('३.६ मृत्यू नोंदणी, दहावा दिवस व नागरिक वाढदिवस आठवण');
    addParagraph('नागरिकांच्या सुख-दुःखात सोबत राहणारी संवेदनशील कार्यप्रणाली:');
    addBullet('मृत्यू नोंदणी', 'निधन झालेल्या नागरिकाची अधिकृत नोंद करून मतदार आकडेवारीतून आदराने वेगळे ठेवणे.');
    addBullet('दहावा दिवस (10th Day)', 'कुटुंबाच्या सांत्वनासाठी नगरसेवक व टीमला वेळेवर स्वयंचलित स्मरणपत्र.');
    addBullet('प्रथम पुण्यस्मरण (1st Year)', 'एका वर्षाने पुण्यस्मरणाची पूर्वसूचना.');
    addBullet('नागरिक वाढदिवस शुभेच्छा', 'दररोज सकाळी आज वाढदिवस असणाऱ्या प्रभाग नागरिकांची यादी व थेट शुभेच्छा संदेश.');

    addSubsection('३.७ प्रभाग संवाद केंद्र (Community Hub) व थेट चर्चा गट');
    addBullet('प्रभाग घडामोडी (Updates)', 'पाणी कपात, वीज दुरुस्ती, आरोग्य शिबिरे व सणांची माहिती फोटोसह प्रसारित करा.');
    addBullet('सर्व-वॉर्ड नागरिक चर्चा गट', 'प्रभागातील अधिकृत नागरिकांचा नागरी समस्यांवर विधायक संवाद मंच.');
    addBullet('नगरसेवक कोअर सल्लागार गट', 'नगरसेवक आणि प्रभाग समिती सदस्यांसाठी खास बंदिस्त चर्चा गट.');

    // SECTION 4: LOCALIZATION
    addSectionHeader('४. द्वि-स्तरीय मराठी भाषांतर इंजिन (Dual-Tier Engine)', 'महाराष्ट्रातील नागरी प्रशासनासाठी खास विकसित केलेली भाषा प्रणाली.');
    addParagraph('स्थानिक पातळीवर तंत्रज्ञानाचा प्रभावी वापर होण्यासाठी मराठी भाषा अत्यंत आवश्यक आहे:');
    addBullet('स्तर १: 0ms थेट स्थानिक शब्दकोश', '५०+ डेटाबेस स्थिती, भूमिका व बटणे एका क्षणात अस्खलित मराठीत उपलब्ध होतात. उदाहरणार्थ: नोंदवले (SUBMITTED), निराकरण झाले (RESOLVED), बंद केले (CLOSED), पाणीपुरवठा (WATER), नगरसेवक (NAGARSEVAK).');
    addBullet('स्तर २: लाइव्ह म्यूटेशन ऑब्झर्व्हर', 'नागरिक दररोज ज्या नवीन तक्रारी किंवा शेरे नोंदवतात, त्या मजकुराचा रिअल-टाइम पार्श्वभूमीवर अनुवाद केला जातो.');
    addBullet('रिएक्ट क्रॅश प्रोटेक्शन', 'गुगल ट्रान्सलेटमुळे वेबसाइट हँग किंवा क्रॅश होऊ नये म्हणून विशेष Node सुरक्षा पॅच लावण्यात आला आहे.');

    // SECTION 5: DATA SAFETY
    addSectionHeader('५. डेटा सुरक्षा, २-टप्प्यांचे जीवनचक्र व ३०-दिवसीय रिसायकल बिन', 'अनावधानाने डेटा नष्ट होण्यापासून १००% संरक्षण, ७५-दिवसीय ऑटो-अर्काइव्ह व सुरक्षितता.');
    addParagraph('नागरी डेटा अत्यंत संवेदनशील आणि महत्त्वाचा असतो. या प्रणालीत खालील सुरक्षा उपाय केले आहेत:');
    addBullet('स्वतंत्र भूमिका तक्ते (Separate Tables)', 'admin_users, sub_admin_users, nagarsevak_users, employee_users, citizen_users, community_users हे स्वतंत्र डेटाबेस तक्ते आहेत; यामुळे एका भूमिकेचे अधिकार दुसऱ्याकडे जात नाहीत.');
    addBullet('प्रभाग कार्यकर्ता संकल्पना स्पष्टता', 'या प्रणालीतील कर्मचारी म्हणजे महानगरपालिका नोकरदार नव्हे, तर संबंधित नगरसेवकांच्या मार्गदर्शनाखाली प्रभागात काम करणारे प्रभाग कार्यकर्ते, स्वीय सहाय्यक व कार्यालयीन टीम.');
    addBullet('७५ दिवसांनंतर स्वयंचलित रिसायकल बिन', 'दैनंदिन शेड्युल/टास्क, नागरिक तक्रारी व चॅट डेटा ७५ दिवसांनंतर आपोआप सुरक्षितपणे रिसायकल बिनमध्ये हलवला जातो, ज्यामुळे मुख्य सिस्टीम जलद चालते.');
    addBullet('३० दिवस सुरक्षित रिसायकल बिन धोरण', 'घरे, कुटुंबे, नागरिक, दुकाने किंवा इतर कोणतीही नोंद डिलीट केल्यास ती थेट नष्ट होत नाही; ती ३० दिवस रिसायकल बिनमध्ये सुरक्षित राहते व पुन्हा मिळवता येते.');
    addBullet('१-क्लिक पूर्ववत (Instant Restore)', 'डिलीट झालेली माहिती एका क्लिकवर पूर्ववत होते व नागरिकाचे लॉगिन पुन्हा चालू होते.');
    addBullet('स्वयंचलित स्वच्छता', '३० दिवसांपेक्षा जास्त काळ रिसायकल बिनमध्ये राहिलेला डेटा सिस्टीमद्वारे आपोआप कायमचा नष्ट केला जातो.');
    addBullet('ऑडिट लॉग (Forensic Audit)', 'प्रणालीमध्ये कोणी, कधी आणि काय बदल केला याची तारीख व IP सह संपूर्ण नोंद राहते.');

    // SECTION 6: TECHNICAL SPECS
    doc.addPage();
    addSectionHeader('६. तांत्रिक तपशील व परिनियोजन (Technical Specifications)', 'उच्च गती, स्केलेबिलिटी आणि शून्य देखभालीची हमी.');

    const specs = [
      ['वापरकर्ता इंटरफेस (Frontend)', 'React 18.3.1 व Vite 6.0.5 बिल्ड टूल'],
      ['डिझाईन व मांडणी (CSS)', 'मोबाईल, टॅबलेट व डेस्कटॉपसाठी १००% रिस्पॉन्सिव्ह कस्टम CSS (theme.css, mobile.css)'],
      ['बॅकएंड सर्व्हर (Backend)', 'Node.js (v18+) सह Express 4.19, हेल्मेट सुरक्षा, रेट लिमिटिंग व CORS'],
      ['डेटाबेस इंजिन (Database)', 'MySQL 8.0 सह utf8mb4_unicode_ci (मराठी देवनागरी लिपीसाठी १००% सुसंगत)'],
      ['ओआरएम व स्कीमा सिंक', 'Sequelize 6.37 सह स्वयंचलित शून्य-डाऊनटाइम स्कीमा सिंक (schemaSync.service.js)'],
      ['प्रवेश सुरक्षा (Auth)', 'स्टेटलेस JSON Web Tokens (JWT) सह Bcrypt १२-राउंड पासवर्ड हॅशिंग'],
      ['दस्तऐवज निर्मिती (Docs)', 'PDFKit व jsPDF द्वारे १-क्लिकवर छापील अजेंडा व अहवाल निर्मिती'],
      ['डेटा एक्सपोर्ट (Export)', 'ExcelJS व SheetJS द्वारे मतदार व जनगणतीचे १-क्लिकवर एक्सेल एक्सपोर्ट'],
      ['परिनियोजन पर्याय (Deploy)', 'पर्याय अ: एकाच पोर्टवर चालणारे सिंगल सर्व्हर मॉडेल.\nपर्याय ब: Nginx रिव्हर्स प्रॉक्सीसह क्लाउड किंवा स्थानिक डेटा सेंटर.'],
    ];

    specs.forEach(([key, val], idx) => {
      const y = doc.y;
      doc.rect(45, y, 505, 24).fill(idx % 2 === 0 ? LIGHT_BG : '#FFFFFF');
      doc.fillColor(PRIMARY).fontSize(8.5).font('Devanagari-Bold').text(key, 52, y + 6, { width: 140 });
      doc.fillColor(SLATE).fontSize(8.5).font('Devanagari').text(val, 200, y + 6, { width: 340 });
      doc.y = y + 26;
    });

    // SECTION 7: ROLLOUT
    doc.moveDown(0.9);
    addSectionHeader('७. १४ दिवसांची थेट अंमलबजावणी योजना (14-Day Roadmap)', 'अल्प कालावधीत प्रभाग डिजिटल करण्याची सुलभ व खात्रीशीर कार्ययोजना.');

    const timeline = [
      ['दिवस १–३: सर्व्हर व वॉर्ड सेटअप', 'सर्व्हर व MySQL डेटाबेस इन्स्टॉलेशन, वॉर्ड क्रमांक व सीमा निश्चिती, नगरसेवक व अधिकारी खाती तयार करणे.'],
      ['दिवस ४–७: मतदार व जनगणती नोंद', 'शासकीय मतदार यादी अपलोड, कॉलनी व सोसायट्यांचे नकाशे तयार करणे व सुरुवातीचा कुटुंब डेटा संकलन.'],
      ['दिवस ८–११: कर्मचारी व प्रतिनिधी प्रशिक्षण', 'प्रभाग कर्मचारी व स्वच्छता निरीक्षकांसाठी मोबाईल ॲपचे प्रशिक्षण; नगरसेवकांसाठी वेळापत्रक नियोजन.'],
      ['दिवस १२–१४: सार्वजनिक लोकार्पण', 'प्रभागात नागरिक QR कोड व लिंक्स वाटप; थेट तक्रार निवारण सुरू व २४/७ तांत्रिक सहाय्य.'],
    ];

    timeline.forEach(([phase, desc]) => {
      addBullet(phase, desc);
    });

    // SIGN OFF
    doc.moveDown(1.2);
    doc.roundedRect(45, doc.y, 505, 55, 4).fillAndStroke('#0F172A', '#059669');
    const signY = doc.y + 12;
    doc.fillColor('#FFFFFF').fontSize(11).font('Devanagari-Bold').text('थेट प्रात्यक्षिक (Live Demo) व अंमलबजावणीसाठी तयार', 60, signY);
    doc.fillColor('#94A3B8').fontSize(9).font('Devanagari').text('ही प्रणाली पूर्णपणे तपासलेली व थेट उत्पादनासाठी सज्ज आहे. प्रात्यक्षिकासाठी तांत्रिक टीमशी संपर्क साधा.', 60, signY + 18);

    doc.end();

    writeStream.on('finish', () => {
      console.log(`[PDF-MR] Saved Marathi documentation PDF at: ${pdfPath}`);
      fs.copyFileSync(pdfPath, path.join(ROOT_DIR, 'Ward_Management_System_Complete_Documentation_Marathi.pdf'));
      fs.copyFileSync(pdfPath, path.join(PUBLIC_DIR, 'Ward_Management_System_Complete_Documentation_Marathi.pdf'));
      if (fs.existsSync(DIST_DIR)) fs.copyFileSync(pdfPath, path.join(DIST_DIR, 'Ward_Management_System_Complete_Documentation_Marathi.pdf'));
      try {
        fs.copyFileSync(pdfPath, path.join(ARTIFACTS_DIR, 'Ward_Management_System_Complete_Documentation_Marathi.pdf'));
      } catch (_) {}
      resolve(pdfPath);
    });

    writeStream.on('error', (err) => reject(err));
  });
}

async function main() {
  try {
    const pptxPath = await generateMarathiPresentation();
    const pdfPath = await generateMarathiPdf();
    console.log('\n======================================================');
    console.log('SUCCESS: Marathi Presentation & Documentation Generated!');
    console.log(`1. Marathi PPTX: ${pptxPath}`);
    console.log(`2. Marathi PDF:  ${pdfPath}`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('FAILED to generate Marathi materials:', err);
    process.exit(1);
  }
}

main();
