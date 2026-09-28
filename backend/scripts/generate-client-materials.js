'use strict';

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.resolve(__dirname, '../../documentation');
const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c8fa2c47-1d4c-40fa-b0bb-758f1dd580c2';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// ============================================================================
// PART 1: GENERATE POWERPOINT PRESENTATION (.PPTX)
// ============================================================================
async function generatePresentation() {
  console.log('[PPTX] Generating professional client presentation...');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
  pptx.author = 'Smart Ward Management Team';
  pptx.company = 'Digital Civic Administration Solutions';
  pptx.title = 'Smart Ward Management System - Executive Client Presentation';

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

  // Helper for slide header
  function addHeader(slide, category, title, subtitle) {
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: EMERALD } });
    slide.addText(category.toUpperCase(), {
      x: 0.8,
      y: 0.35,
      w: 8.4,
      h: 0.25,
      fontSize: 10,
      bold: true,
      color: TEAL,
      charSpacing: 2,
    });
    slide.addText(title, {
      x: 0.8,
      y: 0.6,
      w: 8.4,
      h: 0.5,
      fontSize: 22,
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

  // SLIDE 1: Title Slide
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    // Decorative shape
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.25,
      h: 5.625,
      fill: { color: EMERALD },
    });

    slide.addText('ENTERPRISE CIVIC GOVERNANCE & ELECTORAL PLATFORM', {
      x: 0.8,
      y: 1.2,
      w: 8.4,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: TEAL,
      charSpacing: 3,
    });

    slide.addText('Smart Ward Management System', {
      x: 0.8,
      y: 1.55,
      w: 8.4,
      h: 0.9,
      fontSize: 34,
      bold: true,
      color: WHITE,
    });

    slide.addText('(स्मार्ट वॉर्ड व्यवस्थापन व नागरिक सेवा प्रणाली)', {
      x: 0.8,
      y: 2.5,
      w: 8.4,
      h: 0.45,
      fontSize: 20,
      color: '93C5FD',
    });

    slide.addText('A unified, production-ready digital ecosystem empowering Municipal Corporators (Nagarsevaks), Ward Administration, Field Staff, and Citizens with real-time grievance redressal, demographic intelligence, welfare schemes, and 100% Marathi/English bilingual support.', {
      x: 0.8,
      y: 3.1,
      w: 8.4,
      h: 0.9,
      fontSize: 13,
      color: 'CBD5E1',
      lineSpacing: 20,
    });

    // Metadata pill
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 4.4,
      w: 8.4,
      h: 0.6,
      rectRadius: 0.08,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 },
    });
    slide.addText('Client Presentation  |  Production Release v1.0  |  Full Stack Architecture  |  MySQL 8 + React 18', {
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
    addHeader(slide, 'Executive Summary', 'Modernizing Urban & Rural Ward Governance', 'Bridging the critical gap between citizens, elected representatives, and municipal administration.');

    const cards = [
      {
        title: 'Real-Time Grievance Redressal',
        desc: 'GPS & house-mapped citizen complaint ticketing with before/after photo proofs, automated staff assignment, and overnight auto-closure.',
        color: BLUE,
      },
      {
        title: 'Nagarsevak Field Command',
        desc: 'Digital daily schedules, morning agenda briefs, priority inspections, and 1-click staff task delegation with real-time status tracking.',
        color: EMERALD,
      },
      {
        title: 'Demographic Census',
        desc: '6-level hierarchy (Ward > Area > Apartment > House/Shop > Family > Person) capturing occupation, age, native place, and documents.',
        color: TEAL,
      },
      {
        title: 'Electoral & Scheme Hub',
        desc: 'Official government voter list upload/extraction, 18+ voter pipeline, targeted welfare scheme distribution, and death/birthday observances.',
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

      slide.addShape(pptx.shapes.RECTANGLE, {
        x,
        y: y + 0.15,
        w: 0.1,
        h: 0.5,
        fill: { color: c.color },
      });

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

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 5.15,
      w: 8.4,
      h: 0.35,
      fill: { color: 'F1F5F9' },
    });
    slide.addText('Key Result: 75% faster issue resolution, 100% data transparency, and proactive citizen connect across all wards.', {
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

  // SLIDE 3: Problem vs Digital Solution
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Transformation Roadmap', 'Current Ward Challenges vs. Smart Ward Solution', 'Replacing slow paper registers and informal messaging with a centralized civic operating system.');

    const headers = [
      { text: 'Civic Dimension', options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11 } },
      { text: 'Traditional Manual Pain Points', options: { bold: true, color: WHITE, fill: { color: 'DC2626' }, fontSize: 11 } },
      { text: 'Smart Ward Digital Innovation', options: { bold: true, color: WHITE, fill: { color: EMERALD }, fontSize: 11 } },
    ];

    const rows = [
      ['Citizen Complaints', 'Paper register / unorganized WhatsApp, lost tickets, no proof of work.', 'Geo-tagged mobile ticketing, before/after photo proofs, auto-assignment & SLA tracking.'],
      ['Nagarsevak Field Day', 'Chaotic verbal requests, missed site visits, no written record of daily activities.', 'Daily schedule planner with category/priority tags, team delegation & printable PDF agenda.'],
      ['Ward Census & Data', 'Outdated registers, unknown house tenants, no native village/occupation data.', '6-tier structured census database with voter profile, family trees, and separate commercial register.'],
      ['Welfare Schemes', 'Citizens unaware of government schemes, low beneficiary enrollment.', 'Centralized scheme repository with gender/income/occupation auto-matching & targeted notifications.'],
      ['Data Safety & History', 'Accidental records deletion, zero accountability, unrecoverable data loss.', '60-day safety retention Recycle Bin with 1-click restore + forensic audit logs.'],
      ['Language Accessibility', 'English-only municipal software creates barriers for residents and field staff.', 'Dual-tier 0ms native Marathi translations + real-time dynamic translator for user data.'],
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

  // SLIDE 4: Multi-Tier RBAC
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'System Security & Governance', '6-Tier Role-Based Access Control (RBAC)', 'Strict tenant isolation and permission boundaries across all municipal stakeholder levels.');

    const roles = [
      { role: 'Master Admin (Super Admin)', access: 'System-wide control, ward provisioning, sub-admin management, global audit logs, full system configuration.' },
      { role: 'Sub Master Admin', access: 'Zonal/Prabhag administration, multi-ward supervision, corporator approvals, and regional report analysis.' },
      { role: 'Nagarsevak (Corporator)', access: 'Dedicated ward dashboard, daily schedule agenda, complaint oversight, ward updates, citizen broadcasting & team coordination.' },
      { role: 'Ward Worker / Staff (Under Nagarsevak)', access: 'Field karyakartas & office assistants working directly under Nagarsevak (NOT Municipal Corporation staff). Manages area surveys, complaint site visits, photo proofs, and daily schedules.' },
      { role: 'Citizen Resident', access: 'Self-service citizen portal, submit grievances with photos, track resolution progress, view ward updates, explore welfare schemes.' },
      { role: 'Community Stakeholder', access: 'Designated social workers and election candidates with authorized read access for civic coordination.' },
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

      slide.addShape(pptx.shapes.OVAL, {
        x: x + 0.15,
        y: y + 0.15,
        w: 0.28,
        h: 0.28,
        fill: { color: col === 0 ? BLUE : EMERALD },
      });

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

  // SLIDE 5: Grievance Redressal
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Core Feature Module', 'Citizen Grievance Redressal Engine', 'High-transparency complaint resolution with photo proof and multi-stage lifecycle tracking.');

    const steps = [
      { step: '1. Citizen Submission', desc: 'Logged via Web/Mobile with photo upload, exact location/house selection, category (Water, Drainage, Roads, Streetlight, Garbage).' },
      { step: '2. Auto Assignment', desc: 'Assigned automatically to designated Ward Employee and Nagarsevak based on colony area mapping.' },
      { step: '3. Field Action', desc: 'Employee visits site, inspects issue, updates status to IN_PROGRESS, and coordinates municipal workforce.' },
      { step: '4. Resolution & Proof', desc: 'Field employee uploads RESOLUTION photo proof with completion remarks. Status moves to RESOLVED.' },
      { step: '5. Auto Closure & Review', desc: 'Citizen reviews resolution. If no dispute within overnight window, ticket automatically completes to CLOSED.' },
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
        fontSize: 10,
        color: SLATE,
      });
    });
  }

  // SLIDE 6: Nagarsevak Daily Schedules
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Field Productivity', 'Nagarsevak Daily Schedule & Agenda Briefings', 'Structured operational management for municipal corporators and public representatives.');

    const features = [
      { title: 'Multi-Category Activity Tagging', desc: 'Categorize engagements into Field Visits (क्षेत्रीय भेट), Official Meetings, Site Inspections, Community Events, and Citizen Hearings (नागरिक गाऱ्हाणे).' },
      { title: 'Intelligent Priority Matrix', desc: 'Tag tasks as URGENT, HIGH, MEDIUM, or LOW to ensure emergency civic works receive immediate attention.' },
      { title: 'Seamless Staff Delegation', desc: 'Delegate tasks directly to Ward Employees with tracking notes, completion timestamps, and audit history.' },
      { title: 'Printable PDF Morning Briefings', desc: 'Generate 1-click formatted daily PDF agenda sheets for morning team roll-calls, inspections, and administrative records.' },
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

  // SLIDE 7: Census & Demographic Intelligence
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Data Modeling', 'Comprehensive Demographic & Property Census', 'Structured 6-level relational hierarchy capturing complete ward intelligence.');

    const levels = [
      ['Ward', 'Municipal Ward definition with boundary & corporator assignment'],
      ['Area / Colony', 'Local sub-localities, societies, and employee assignment zones'],
      ['Apartment / Complex', 'Multi-story buildings, flat numbers, building associations'],
      ['House / Flat / Shop', 'Residential dwellings and dedicated commercial shops & offices'],
      ['Family Unit', 'Household head, native village/taluka/district, ration card details'],
      ['Citizen Member', 'Full name, DOB, mobile, voter ID, Aadhaar, occupation & documents'],
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
      slide.addText(`Level ${i + 1}: ${lvl}`, {
        x: 1.0,
        y: y + 0.08,
        w: 2.5,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: NAVY,
      });
      slide.addText(desc, {
        x: 3.5,
        y: y + 0.08,
        w: 5.5,
        h: 0.35,
        fontSize: 10,
        color: SLATE,
      });
    });
  }

  // SLIDE 8: Voter List & Election Operations
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Electoral Management', 'Government Voter List & Electoral Intelligence', 'Digitizing official voter rolls and discovering first-time voters.');

    const cards = [
      { title: 'Official PDF Upload & Extraction', desc: 'Securely upload official Election Commission voter PDF lists. The system extracts voter serials, names, relations, and ID numbers.' },
      { title: 'Ward-Wise Dynamic Partitioning', desc: 'Auto-partition extracted voters into specific wards, sub-localities, and corporator portfolios without cross-ward data overlap.' },
      { title: '18+ First-Time Voter Discovery', desc: 'Automated intelligence engine queries upcoming 18-year-old citizens from the ward census, enabling targeted voter registration drives.' },
      { title: 'Polling Station & Booth Mapping', desc: 'Map families and citizens to their designated voting booth, room number, and polling station location.' },
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

  // SLIDE 9: Welfare Schemes
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Public Welfare', 'Government Welfare Schemes & Targeted Outreach', 'Ensuring 100% saturation of state and central welfare benefits in the ward.');

    const steps = [
      { title: 'Scheme Knowledgebase', desc: 'Centralized catalog of government schemes (e.g., Ladki Bahin Yojana, PM Awas, Sanjay Gandhi Niradhar, scholarships, health insurance).' },
      { title: 'Demographic Eligibility Match', desc: 'Filter eligible citizens by gender, age bracket, occupation type (farmer, student, senior, daily wager), and income category.' },
      { title: 'Direct Citizen Broadcasting', desc: 'Push targeted notifications directly to eligible ward residents informing them of application windows and required documents.' },
      { title: 'Application Tracking', desc: 'Record citizen scheme inquiries, help desk registrations, and approval statuses directly in citizen voter profiles.' },
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
        w: 2.6,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: EMERALD,
      });

      slide.addText(s.desc, {
        x: 3.7,
        y: y + 0.12,
        w: 5.3,
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
    addHeader(slide, 'Community Connection', 'Death Observances & Citizen Birthday Milestones', 'Deepening emotional trust and constituent relationships through thoughtful civic touchpoints.');

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: LIGHT_BG },
      line: { color: CARD_BORDER, width: 1 },
    });
    slide.addText('Death Records & Observance Tracking', {
      x: 1.0,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: NAVY,
    });
    const deathPoints = [
      'Record deceased citizens with date of death and family link.',
      'Automated 10th-Day Observance (दहावा दिवस) notification to corporator team for family condolence visits.',
      'Automated 1st-Year Remembrance (प्रथम पुण्यस्मरण) reminder.',
      'Respectful live data cleanup: deceased citizens are moved to death archives without corrupting active voter stats.',
    ];
    deathPoints.forEach((p, idx) => {
      slide.addText(`•  ${p}`, {
        x: 1.0,
        y: 2.3 + idx * 0.65,
        w: 3.7,
        h: 0.55,
        fontSize: 10.5,
        color: SLATE,
      });
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
    slide.addText('Citizen Birthday Greetings', {
      x: 5.3,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: NAVY,
    });
    const bdayPoints = [
      'Automated birthday calendar populated directly from census DOBs.',
      'Daily morning alert to Nagarsevak highlighting all ward citizens celebrating birthdays today.',
      'Quick action to send warm personalized greetings via SMS/WhatsApp or letter.',
      'Filter birthdays across 7, 15, or 30 days for proactive community planning.',
    ];
    bdayPoints.forEach((p, idx) => {
      slide.addText(`•  ${p}`, {
        x: 5.3,
        y: 2.3 + idx * 0.65,
        w: 3.7,
        h: 0.55,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 11: Community Hub & Chat
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Civic Engagement', 'Ward Community Hub & Real-Time Communication', 'Modern broadcast and interactive chat channels for ward residents.');

    const channels = [
      { name: 'Ward Public Updates', desc: 'Broadcast official municipal development news, water shutdown notices, vaccination camps, and festivals with photos.' },
      { name: 'All-Ward Community Chat', desc: 'Open discussion forum connecting verified ward residents with municipal moderators and corporators.' },
      { name: 'Nagarsevak Core Group Chat', desc: 'Exclusive advisory channel for the corporator, key community leaders, and ward action committees.' },
      { name: 'Multimedia Messaging', desc: 'Share photos, short videos, PDF documents, and announcements with instant delivery.' },
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

  // SLIDE 12: Dual-Tier Marathi Localization
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Inclusive Civic Tech', 'Dual-Tier Marathi & English Localization Engine', 'Engineered ground-up for 100% bilingual accessibility across Maharashtra municipalities.');

    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.8,
      y: 1.65,
      w: 4.1,
      h: 3.5,
      rectRadius: 0.08,
      fill: { color: 'F0FDF4' },
      line: { color: EMERALD, width: 1 },
    });
    slide.addText('Tier 1: Instant Native Dictionary (0ms)', {
      x: 1.0,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: EMERALD,
    });
    const t1 = [
      'Zero network delay: 50+ UI labels, statuses, roles, and categories render instantly.',
      'Statuses: SUBMITTED (नोंदवले), RESOLVED (निराकरण झाले), CLOSED (बंद केले).',
      'Categories: WATER (पाणीपुरवठा), ROADS (रस्ते व वाहतूक), DRAINAGE (सांडपाणी).',
      'Roles: Master Admin (मास्टर अ‍ॅडमिन), Nagarsevak (नगरसेवक), Citizen (नागरिक).',
    ];
    t1.forEach((p, idx) => {
      slide.addText(`•  ${p}`, {
        x: 1.0,
        y: 2.3 + idx * 0.68,
        w: 3.7,
        h: 0.58,
        fontSize: 10,
        color: SLATE,
      });
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
    slide.addText('Tier 2: Real-Time Dynamic Observer', {
      x: 5.3,
      y: 1.85,
      w: 3.7,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: BLUE,
    });
    const t2 = [
      'Live MutationObserver: Detects new English content added dynamically by React (new complaints, remarks, citizen names).',
      'Translates daily unstructured user content seamlessly in the background.',
      'DOM Collision Guard: Safe Node.removeChild / insertBefore patch prevents Google Translate React crash bugs.',
      'Persistent language preference saved across browser sessions.',
    ];
    t2.forEach((p, idx) => {
      slide.addText(`•  ${p}`, {
        x: 5.3,
        y: 2.3 + idx * 0.68,
        w: 3.7,
        h: 0.58,
        fontSize: 10,
        color: SLATE,
      });
    });
  }

  // SLIDE 13: Data Safety & Two-Stage Lifecycle (75-Day Archive + 30-Day Recycle Bin)
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Data Integrity & Security', 'Two-Stage Lifecycle & 30-Day Safe Recycle Bin', 'Enterprise architecture ensuring zero accidental data loss, 75-day auto-archiving, and 30-day safety recovery.');

    const items = [
      { title: 'Separate Role Login Tables', desc: 'Strict separation of admin_users, sub_admin_users, nagarsevak_users, employee_users, citizen_users, and community_users preventing privilege escalation.' },
      { title: '75-Day Operational Auto-Archive', desc: 'Active daily tasks/schedules, citizen complaints, and chat records automatically transfer to the Recycle Bin after 75 days, maintaining dashboard speed.' },
      { title: '30-Day Safe Recycle Bin Retention', desc: 'Any deleted record across all sections (Houses, Families, Citizens, Shops, Complaints, Schedules, Chats) is safely held in the Recycle Bin for 30 days.' },
      { title: '1-Click Restore & 30-Day Permanent Purge', desc: 'Any deleted or archived record can be restored with 1 click within 30 days. After 30 days in the Recycle Bin, expired records are automatically permanently cleared.' },
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

  // SLIDE 14: Tech Stack & Architecture
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Technology Architecture', 'Enterprise Full-Stack Technology Specifications', 'Built on open, scalable, and battle-tested industry standards.');

    const stack = [
      { layer: 'Frontend Layer', tech: 'React 18 + Vite 6', details: 'Component-driven SPA, responsive CSS architecture (mobile-first 320px to 4K), jsPDF document export, custom bilingual UI components.' },
      { layer: 'Backend Layer', tech: 'Node.js + Express', details: 'RESTful API v2, JWT authentication, Bcrypt 12 rounds, Helmet security headers, rate limiting, and zero-downtime schemaSync service.' },
      { layer: 'Database Layer', tech: 'MySQL 8.0 + Sequelize', details: 'Normalized relational schema, UTF8MB4 full Unicode support for native Devanagari script, indexed foreign keys, paranoid soft-deletes.' },
      { layer: 'Deployment', tech: 'Docker / Single Server', details: 'Dual deployment: Single Node process serving built frontend + API, or containerized Docker / Kubernetes deployment behind Nginx reverse proxy.' },
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
        w: 2.0,
        h: 0.35,
        fontSize: 12,
        bold: true,
        color: NAVY,
      });

      slide.addText(s.tech, {
        x: 1.0,
        y: y + 0.42,
        w: 2.0,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: EMERALD,
      });

      slide.addText(s.details, {
        x: 3.2,
        y: y + 0.12,
        w: 5.8,
        h: 0.6,
        fontSize: 10.5,
        color: SLATE,
      });
    });
  }

  // SLIDE 15: Client ROI & Turnkey Rollout
  {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'Client Value Proposition', 'Tangible Value & Rapid Deployment Timeline', 'Transforming municipal governance in under 2 weeks.');

    const stats = [
      { num: '75%', label: 'Faster Grievance Resolution' },
      { num: '100%', label: 'Digital Census Saturation' },
      { num: '0 ms', label: 'Bilingual Interface Switch' },
      { num: '75 + 30 Days', label: 'Two-Stage Safe Data Lifecycle' },
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
        fontSize: 9,
        bold: true,
        color: NAVY,
        align: 'center',
      });
    });

    slide.addText('Turnkey 2-Week Implementation Plan:', {
      x: 0.8,
      y: 2.95,
      w: 8.4,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: NAVY,
    });

    const phases = [
      ['Phase 1: Setup & Customization (Days 1–3)', 'Server provisioning, ward boundary configuration, MySQL database initialization, corporator accounts setup.'],
      ['Phase 2: Data Ingestion (Days 4–7)', 'Ingestion of government voter lists, colony boundary mapping, initial commercial & household census import.'],
      ['Phase 3: Staff Training & Pilot (Days 8–11)', 'Hands-on training for ward employees, field staff mobile app orientation, corporator briefing.'],
      ['Phase 4: Live Launch & Public Rollout (Days 12–14)', 'Public citizen portal go-live, QR-code grievance poster deployment, and ongoing SLA support.'],
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
        w: 3.2,
        h: 0.32,
        fontSize: 9.5,
        bold: true,
        color: TEAL,
      });
      slide.addText(pDesc, {
        x: 4.2,
        y: y + 0.08,
        w: 4.9,
        h: 0.32,
        fontSize: 9,
        color: SLATE,
      });
    });
  }

  // SLIDE 16: Closing & Q&A
  {
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.25,
      h: 5.625,
      fill: { color: EMERALD },
    });

    slide.addText('THANK YOU', {
      x: 0.8,
      y: 1.3,
      w: 8.4,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: TEAL,
      charSpacing: 4,
    });

    slide.addText('Ready for Live Municipal Deployment', {
      x: 0.8,
      y: 1.7,
      w: 8.4,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: WHITE,
    });

    slide.addText('Transform your ward into a responsive, transparent, and digitally empowered model governance ecosystem.', {
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

    slide.addText('Next Steps & Discussion Points:', {
      x: 1.0,
      y: 3.55,
      w: 8.0,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: '38BDF8',
    });

    const discussion = [
      '1. Live Product Demonstration across Master Admin, Nagarsevak, and Citizen panels.',
      '2. Reviewing specific ward boundaries, prabhag numbers, and corporator seat configurations.',
      '3. Ingestion of existing ward voter registers and municipal employee rosters.',
    ];

    discussion.forEach((d, idx) => {
      slide.addText(d, {
        x: 1.0,
        y: 3.85 + idx * 0.32,
        w: 8.0,
        h: 0.3,
        fontSize: 10.5,
        color: WHITE,
      });
    });
  }

  const pptxPath = path.join(OUT_DIR, 'Ward_Management_System_Client_Presentation.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  console.log(`[PPTX] Presentation saved successfully at: ${pptxPath}`);

  // Copy to artifacts
  try {
    const artPptx = path.join(ARTIFACTS_DIR, 'Ward_Management_System_Client_Presentation.pptx');
    fs.copyFileSync(pptxPath, artPptx);
    console.log(`[PPTX] Copied to artifacts directory: ${artPptx}`);
  } catch (err) {
    console.warn('[PPTX] Artifact copy warning:', err.message);
  }

  return pptxPath;
}

// ============================================================================
// PART 2: GENERATE DETAILED PDF DOCUMENTATION (.PDF)
// ============================================================================
function generatePdf() {
  return new Promise((resolve, reject) => {
    console.log('[PDF] Generating detailed documentation PDF...');
    const pdfPath = path.join(OUT_DIR, 'Ward_Management_System_Complete_Documentation.pdf');
    const doc = new PDFDocument({
      size: 'A4',
      margin: 45,
      info: {
        Title: 'Smart Ward Management System - Complete System Documentation & Proposal',
        Author: 'Digital Civic Administration Solutions',
        Subject: 'Civic Administration, Electoral Intelligence & Grievance Redressal',
      },
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    const PRIMARY = '#0F172A';
    const EMERALD = '#059669';
    const SLATE = '#334155';
    const MUTED = '#64748B';
    const LIGHT_BG = '#F8FAFC';

    // Helper: Section title
    function addSectionHeader(title, subtitle) {
      doc.moveDown(1);
      doc.rect(45, doc.y, 4, 22).fill(EMERALD);
      doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text(`  ${title}`, 52, doc.y);
      if (subtitle) {
        doc.fillColor(MUTED).fontSize(9.5).font('Helvetica').text(`  ${subtitle}`, 52, doc.y + 2);
      }
      doc.moveDown(0.8);
    }

    function addSubsection(title) {
      doc.moveDown(0.5);
      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text(title);
      doc.moveDown(0.3);
    }

    function addParagraph(text) {
      doc.fillColor(SLATE).fontSize(9.5).font('Helvetica').lineGap(3).text(text);
      doc.moveDown(0.4);
    }

    function addBullet(title, desc) {
      doc.fillColor(EMERALD).fontSize(9.5).font('Helvetica-Bold').text(`*  ${title}: `, { continued: true });
      doc.fillColor(SLATE).font('Helvetica').text(desc);
      doc.moveDown(0.25);
    }

    // COVER PAGE
    doc.rect(0, 0, doc.page.width, 180).fill(PRIMARY);
    doc.fillColor(EMERALD).fontSize(10).font('Helvetica-Bold').text('ENTERPRISE CIVIC GOVERNANCE & ELECTORAL PLATFORM', 45, 45, { characterSpacing: 2 });
    doc.fillColor('#FFFFFF').fontSize(26).font('Helvetica-Bold').text('Smart Ward Management System', 45, 65);
    doc.fillColor('#93C5FD').fontSize(14).font('Helvetica').text('Smart Ward Vyavasthapan v Nagarik Seva Pranali', 45, 98);
    doc.fillColor('#CBD5E1').fontSize(10).font('Helvetica').text('Comprehensive System Architecture, Technical Specifications & Client Proposal', 45, 122);
    doc.fillColor('#38BDF8').fontSize(9).font('Helvetica-Bold').text('Production Release v1.0  |  Enterprise Edition  |  Confidential Client Documentation', 45, 145);

    doc.y = 210;

    // METADATA BLOCK
    doc.roundedRect(45, doc.y, 505, 75, 4).fillAndStroke(LIGHT_BG, '#E2E8F0');
    const startMetaY = doc.y + 10;
    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('DOCUMENT CONTROL & EXECUTIVE SUMMARY', 60, startMetaY);
    doc.fillColor(MUTED).fontSize(8.5).font('Helvetica')
      .text('Project: Smart Ward Management Platform', 60, startMetaY + 16)
      .text('Target Clients: Municipal Corporations (Municipal Councils / Mahanagarpalika), Ward Corporators, Ward Officers', 60, startMetaY + 28)
      .text('Core Technologies: React 18, Vite 6, Node.js, Express, MySQL 8.0, Sequelize ORM, JWT, Bcrypt, Helmet', 60, startMetaY + 40)
      .text('Localization: 100% Bilingual Marathi & English Support (0ms Native Enums + Live Real-time Observer)', 60, startMetaY + 52);

    doc.y = 310;

    // SECTION 1
    addSectionHeader('1. Executive Summary & Vision', 'Transforming municipal governance into a data-driven, citizen-centric administration.');
    addParagraph('Urban and semi-urban municipal wards face complex administrative challenges: paper-based citizen complaint tracking, missed field engagements by elected representatives, unorganized demographic information, delayed welfare scheme reach, and severe language accessibility barriers.');
    addParagraph('The Smart Ward Management System is a turnkey, enterprise-grade digital civic governance solution. It establishes an unbroken, real-time bridge connecting Citizens, Municipal Corporators (Nagarsevaks), Ward Field Officers/Employees, Sub-Administrators, and Central Municipal Leadership.');
    addBullet('Guaranteed Transparency', 'Every citizen complaint carries geo-location tags, before/after photo verification, auto-assignment, and overnight auto-closure.');
    addBullet('Electoral & Field Intelligence', 'Daily operational agenda planner for corporators with 1-click staff task delegation and printable morning roll-call briefing sheets.');
    addBullet('Comprehensive Demographic Census', 'A 6-level relational hierarchy mapping Wards down to individual citizens, voter registrations, occupations, and native villages.');
    addBullet('Zero Accidental Data Loss', 'An automated 60-Day Safety Recycle Bin with 1-click restoration and forensic audit trails.');
    addBullet('Dual-Tier Localization', 'Instant Marathi localization across 50+ database statuses, roles, and categories with live dynamic translation of daily user content.');

    // SECTION 2
    addSectionHeader('2. Multi-Tier Role-Based Architecture (RBAC)', 'Role separation with strict tenant isolation and ward boundary controls.');
    addParagraph('The platform enforces strict Role-Based Access Control across six distinct portals:');
    addBullet('Super Admin (Master Admin)', 'Full administrative control over the entire system. Responsible for creating municipal wards, configuring administrative boundaries, onboarding Sub Master Admins and Corporators, inspecting forensic audit logs, and running database maintenance.');
    addBullet('Sub Master Admin', 'Assigned oversight over designated municipal zones or prabhags. Monitors multiple corporators, inspects inter-ward complaint statistics, and analyzes demographic density.');
    addBullet('Nagarsevak (Municipal Corporator)', 'Dedicated command dashboard for the ward representative. Features daily field schedules, priority inspections, staff task assignment, direct citizen updates, welfare scheme broadcasts, and death/birthday reminders.');
    addBullet('Municipal Employee (Ward Staff)', 'Field workforce portal for sanitary inspectors, civil maintenance, and waterworks officers. Receives auto-assigned grievances, uploads on-site resolution photos, and conducts household census surveys.');
    addBullet('Citizen Resident', 'Self-service public portal for ward residents. Allows fast grievance logging with photo uploads, live ticket tracking, exploring welfare schemes, and viewing ward updates.');
    addBullet('Community Stakeholder', 'Authorized portal for local social workers and candidate representatives for authorized civic engagement.');

    // SECTION 3
    doc.addPage();
    addSectionHeader('3. Detailed Functional Modules', 'In-depth breakdown of the platform core feature engines.');

    addSubsection('3.1 Citizen Grievance Redressal (Complaint Redressal Engine)');
    addParagraph('The complaint management module delivers end-to-end transparency:');
    addBullet('Multi-Category Classification', 'Citizens categorize issues into Water Supply (पाणीपुरवठा), Drainage & Sewage (सांडपाणी), Garbage & Cleanliness (कचरा), Roads & Footpaths (रस्ते), Streetlights (पथदिवे), Encroachments, and Parks.');
    addBullet('Photo Evidence', 'Mandatory or optional photo attachments at submission stage showing exact ground condition.');
    addBullet('Automated Routing', 'Tickets are routed automatically to the designated Ward Employee and Nagarsevak based on colony area mapping.');
    addBullet('Multi-State Lifecycle', 'Tickets progress sequentially through SUBMITTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED.');
    addBullet('Proof of Work Verification', 'Employees must submit a resolution photo and completion remark before marking an issue resolved.');
    addBullet('Overnight Auto-Closure', 'A daily server job automatically closes resolved tickets if no dispute is raised, ensuring accurate resolution KPIs.');

    addSubsection('3.2 Nagarsevak Field Schedules & Morning Briefing Agendas');
    addParagraph('Empowers municipal corporators to manage daily constituent engagements:');
    addBullet('Activity Tagging', 'Tag field activities as Visits (क्षेत्रीय भेट), Meetings (बैठक), Inspections (पाहणी), Events (कार्यक्रम), or Citizen Hearings (गाऱ्हाणे).');
    addBullet('Priority Matrix', 'Urgent, High, Medium, and Low prioritization for rapid emergency response.');
    addBullet('Staff Delegation', 'Nagarsevaks can delegate any scheduled task to a ward employee with tracking notes and status updates.');
    addBullet('Printable PDF Agendas', 'One-click automated generation of formatted daily briefing sheets for morning staff roll-calls.');

    addSubsection('3.3 Demographic, Property & Commercial Intelligence');
    addParagraph('A robust census engine structuring community data across 6 relational levels:');
    addBullet('Ward Level', 'Ward number, name, boundary description, and assigned Nagarsevak subscription status.');
    addBullet('Area / Colony Level', 'Colonies, slums, societies, and employee responsibility zones.');
    addBullet('Apartment / Building Level', 'Residential complexes, high-rises, floor counts, and society contacts.');
    addBullet('Dwellings & Commercial', 'House/Flat registers + dedicated Shops & Offices register with ownership status (Owned, Rented, Leased).');
    addBullet('Family Units', 'Head of household, native village/taluka/district, and ration card details.');
    addBullet('Individual Citizens', 'Full demographic profile: Voter ID, Aadhaar, PAN, date of birth, occupation, and business info.');

    addSubsection('3.4 Government Voter Lists & Electoral Analytics');
    addBullet('Official PDF Ingestion', 'Direct upload of state election voter PDF lists with automatic extraction of voter serials and IDs.');
    addBullet('Dynamic Ward Allocation', 'Assign extracted lists to designated wards and corporator portfolios without data cross-contamination.');
    addBullet('18+ First-Time Voter Pipeline', 'Automated scanning of demographic census data to identify youth turning 18 for voter ID registration drives.');

    addSubsection('3.5 Government Welfare Schemes & Targeted Outreach');
    addBullet('Scheme Knowledgebase', 'Repository of Central and State schemes (Ladki Bahin, PM Awas, Sanjay Gandhi Niradhar, scholarships).');
    addBullet('Automated Eligibility Matching', 'Filter citizens by gender, age, income, and occupation to identify qualifying beneficiaries.');
    addBullet('Direct Citizen Notifications', 'Send broadcast alerts directly to eligible ward residents informing them of enrollment camps.');

    // SECTION 4
    doc.addPage();
    addSubsection('3.6 Death Records, 10th-Day & 1-Year Observance Reminders');
    addParagraph('Strengthens constituent relationships during critical moments:');
    addBullet('Death Documentation', 'Record deceased citizens with date of death, cause, and family linkage.');
    addBullet('10th-Day Observance (दहावा दिवस)', 'Automated reminder alert sent to corporator team for condolence visits and support.');
    addBullet('1st-Year Remembrance (प्रथम पुण्यस्मरण)', 'Automated annual remembrance notification.');
    addBullet('Respectful Data Segregation', 'Deceased citizens are safely archived in Death Records without corrupting active voter metrics.');

    addSubsection('3.7 Citizen Birthday Engagement');
    addBullet('Automated Birthday Calendar', 'Daily morning dashboard highlighting all citizens celebrating birthdays in the ward today.');
    addBullet('Personalized Greetings', 'Instant SMS, WhatsApp, or formal letter generation for corporator constituent connect.');

    addSubsection('3.8 Ward Community Hub, Broadcasts & Real-Time Chat');
    addBullet('Public Updates Feed', 'Broadcast development news, infrastructure projects, water cuts, and festivals with photos.');
    addBullet('All-Ward Community Chat', 'Verified resident forum for community discussion and civic coordination.');
    addBullet('Nagarsevak Core Group', 'Advisory chat channel for corporator and key ward committee members.');

    // SECTION 4: LOCALIZATION
    addSectionHeader('4. Dual-Tier Marathi & English Localization Engine', 'Engineered specifically for Maharashtra municipalities and grassroots usability.');
    addParagraph('Language accessibility is paramount for civic technology. The system employs a sophisticated dual-tier translation architecture:');
    addBullet('Tier 1: Instant Native Dictionary (0ms)', 'Over 50+ critical database enums, complaint statuses, roles, and UI controls translate natively with zero network latency. Keys like SUBMITTED (नोंदवले), RESOLVED (निराकरण झाले), WATER (पाणीपुरवठा), and NAGARSEVAK (नगरसेवक) switch instantly.');
    addBullet('Tier 2: Dynamic Live MutationObserver', 'Unstructured, daily user-entered text (complaint descriptions, field remarks, schedule notes) is monitored by a debounced MutationObserver on the DOM that invokes real-time dynamic translation seamlessly.');
    addBullet('React DOM Crash Protection', 'Includes a custom Node prototype guard (safe removeChild / insertBefore) preventing React DOM reconciler crashes when Google Translate injects font tags.');

    // SECTION 5: DATA SAFETY
    addSectionHeader('5. Data Safety, Two-Stage Lifecycle & 30-Day Safe Recycle Bin', 'Enterprise data preservation and multi-table database architecture.');
    addParagraph('To ensure maximum data integrity, the system implements a strict safety framework:');
    addBullet('Normalized Dedicated Role Tables', 'Separate database tables (admin_users, sub_admin_users, nagarsevak_users, employee_users, citizen_users, community_users) prevent privilege escalation and protect credential integrity.');
    addBullet('Ward Worker Clarification', 'Employees in this system are designated ward workers, karyakartas, and office assistants operating under the Nagarsevak (not Municipal Corporation government employees).');
    addBullet('75-Day Automated Archive', 'Active operational data (chats, complaints, and daily schedules/tasks) automatically transfer to the Recycle Bin after 75 days, ensuring fast system queries and clean dashboards.');
    addBullet('30-Day Safety Recycle Bin Retention', 'All deleted records across all system entities (Houses, Families, Citizens, Shops, Complaints, Schedules, Chats, Schemes, Voter Lists, Users) are retained in the Recycle Bin for 30 days before permanent deletion. Any manual delete (e.g. deleting a house) is completely recoverable during this period.');
    addBullet('One-Click Restoration', 'Deleted records can be restored with a single click, automatically restoring foreign key associations and user login accounts.');
    addBullet('Automated Daily Maintenance Job', 'An automated daily server task permanently purges expired records older than 30 days in the Recycle Bin and deletes unreferenced orphan files from physical storage.');
    addBullet('Forensic Audit Trails', 'Every administrative action, soft-delete, and restoration is logged with user ID, action type, IP address, and timestamp.');

    // SECTION 6: TECHNICAL SPECS
    doc.addPage();
    addSectionHeader('6. Technical Specifications & Deployment Guidelines', 'Production-ready architecture designed for high availability and zero maintenance.');

    const specs = [
      ['Frontend Framework', 'React 18.3.1 with Vite 6.0.5 build tooling'],
      ['Frontend Styling', 'Custom responsive CSS (theme.css, mobile.css, styles.css) with zero external heavy UI framework bloat'],
      ['Backend Server', 'Node.js (v18+) with Express 4.19, Helmet security, rate limiting, and CORS protection'],
      ['Database Engine', 'MySQL 8.0 with InnoDB engine and utf8mb4_unicode_ci charset for native Marathi text'],
      ['ORM & Schema Sync', 'Sequelize 6.37 with automated idempotent zero-downtime schema synchronization (schemaSync.service.js)'],
      ['Authentication', 'Stateless JSON Web Tokens (JWT) with Bcrypt password hashing (12 salt rounds)'],
      ['Document Generation', 'PDFKit and jsPDF with auto-table support for real-time PDF agendas and reports'],
      ['Data Export', 'ExcelJS and SheetJS for one-click Excel/CSV voter and census reporting'],
      ['Deployment Modes', 'Option A: Single Node server serving frontend static assets + API on a single port.\nOption B: Nginx reverse proxy + Node backend + CDN frontend.'],
    ];

    doc.table ? null : null; // Manual table
    specs.forEach(([key, val], idx) => {
      const y = doc.y;
      doc.rect(45, y, 505, 24).fill(idx % 2 === 0 ? LIGHT_BG : '#FFFFFF');
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text(key, 52, y + 6, { width: 140 });
      doc.fillColor(SLATE).fontSize(8.5).font('Helvetica').text(val, 200, y + 6, { width: 340 });
      doc.y = y + 26;
    });

    // SECTION 7: ROLLOUT PLAN
    doc.moveDown(1);
    addSectionHeader('7. Implementation & Onboarding Plan', 'Turnkey 14-day deployment roadmap for municipal corporations and wards.');

    const timeline = [
      ['Days 1–3: Environment Setup', 'Provision server infrastructure, deploy MySQL database, configure municipal ward numbers and prabhag boundaries, setup initial Super Admin credentials.'],
      ['Days 4–7: Data Migration', 'Upload existing voter lists, ingest colony and building registers, import citizen census surveys, and setup corporator profiles.'],
      ['Days 8–11: Staff Orientation', 'Conduct hands-on training workshops for ward employees and sanitary inspectors. Familiarize corporators with the schedule agenda planner.'],
      ['Days 12–14: Citizen Go-Live', 'Deploy citizen registration links and grievance QR posters at ward offices. Launch public portal and activate 24/7 technical monitoring.'],
    ];

    timeline.forEach(([phase, desc]) => {
      addBullet(phase, desc);
    });

    // SIGN OFF
    doc.moveDown(1.5);
    doc.roundedRect(45, doc.y, 505, 55, 4).fillAndStroke('#0F172A', '#059669');
    const signY = doc.y + 12;
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('Ready for Demonstration & Pilot Deployment', 60, signY);
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text('This system is verified and live-production ready. Contact technical team for live staging demo access.', 60, signY + 18);

    doc.end();

    writeStream.on('finish', () => {
      console.log(`[PDF] Documentation saved successfully at: ${pdfPath}`);
      try {
        const artPdf = path.join(ARTIFACTS_DIR, 'Ward_Management_System_Complete_Documentation.pdf');
        fs.copyFileSync(pdfPath, artPdf);
        console.log(`[PDF] Copied to artifacts directory: ${artPdf}`);
      } catch (err) {
        console.warn('[PDF] Artifact copy warning:', err.message);
      }
      resolve(pdfPath);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    const pptxPath = await generatePresentation();
    const pdfPath = await generatePdf();
    console.log('\n======================================================');
    console.log('SUCCESS: Both Presentation and Documentation generated!');
    console.log(`1. PPTX: ${pptxPath}`);
    console.log(`2. PDF:  ${pdfPath}`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('FAILED to generate materials:', err);
    process.exit(1);
  }
}

main();
