import React, { useEffect, useMemo, useState, useRef } from 'react';
import { api, getUser } from '../services/api';
import { roleOf, isMaster, isSubMaster, isNagarsevak, isEmployee } from '../rbac';
import { Empty, ErrorBox, Loading, Modal, PageHeader, SearchableSelect, FaceAvatar, isDataImage } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  CalendarIcon,
  PhoneIcon,
  SearchIcon,
  MapPinIcon,
  UsersIcon,
  HeartIcon,
  ClockIcon,
  PrinterIcon,
  GiftIcon,
  EyeIcon,
  BuildingIcon
} from '../components/Icons';

function getInitials(name) {
  if (!name) return 'C';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getDirectionsUrl(house) {
  if (house?.latitude && house?.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${house.latitude},${house.longitude}`;
  }
  const parts = [
    house?.houseNumber ? `House ${house.houseNumber}` : '',
    house?.address,
    house?.landmark,
    house?.area?.name
  ].filter(Boolean);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(', ') || 'Ahilyanagar')}`;
}

const previousWindows = [
  { key: 'yesterday', label: 'Yesterday', from: -1, to: -1 },
  { key: 'day2past', label: 'Day before yesterday', from: -2, to: -2 },
  { key: 'previous8', label: 'Previous 8 days', from: -8, to: -1 },
  { key: 'custom', label: 'Custom previous range', from: 0, to: 0 }
];
const upcomingWindows = [
  { key: 'today', label: 'Today', from: 0, to: 0 },
  { key: 'tomorrow', label: 'Tomorrow', from: 1, to: 1 },
  { key: 'day2', label: 'Day after tomorrow', from: 2, to: 2 },
  { key: 'next7', label: 'Next 7 days', from: 0, to: 6 },
  { key: 'next30', label: 'Next 30 days', from: 0, to: 29 },
  { key: 'next90', label: 'Next 90 days', from: 0, to: 89 },
  { key: 'custom', label: 'Custom upcoming range', from: 0, to: 0 }
];

export function getEffectiveNagarsevak(record, currentUser = getUser()) {
  // If Master / Super Admin / Sub Admin:
  // In every municipal ward, there are 4 Nagarsevaks.
  // The Admin panel displays '-' (no arbitrary single Nagarsevak hardcoded).
  if (isMaster(currentUser) || isSubMaster(currentUser)) {
    return { name: '-', partyName: '', photo: null, wardSeat: '', mobile: '' };
  }

  // If logged-in user is Nagarsevak:
  if (isNagarsevak(currentUser)) {
    return {
      name: currentUser.name || '-',
      partyName: currentUser.partyName || currentUser.party || '',
      wardSeat: currentUser.wardSeat || '',
      photo: currentUser.photo || null,
      mobile: currentUser.mobile || ''
    };
  }

  // If logged-in user is Employee:
  if (isEmployee(currentUser)) {
    if (currentUser.nagarsevak?.name) {
      return {
        name: currentUser.nagarsevak.name,
        partyName: currentUser.nagarsevak.partyName || '',
        wardSeat: currentUser.nagarsevak.wardSeat || '',
        photo: currentUser.nagarsevak.photo || null,
        mobile: currentUser.nagarsevak.mobile || ''
      };
    }
    if (currentUser.employeeProfile?.manager?.name) {
      return {
        name: currentUser.employeeProfile.manager.name,
        partyName: currentUser.employeeProfile.manager.partyName || '',
        wardSeat: currentUser.employeeProfile.manager.wardSeat || '',
        photo: currentUser.employeeProfile.manager.photo || null,
        mobile: currentUser.employeeProfile.manager.mobile || ''
      };
    }
  }

  // If record has a specific nagarsevak passed from backend and not '-'
  if (record?.nagarsevak?.name && record.nagarsevak.name !== '—' && record.nagarsevak.name !== '-') {
    return record.nagarsevak;
  }

  // Fallback to clean '-'
  return { name: '-', partyName: '', photo: null, wardSeat: '', mobile: '' };
}

export const getWardNagarsevak = getEffectiveNagarsevak;

function birthdayMessageMarathi(name, nagarsevakName, partyName, wardNumber) {
  const wardText = wardNumber ? ` (${formatWardNumber(wardNumber, 'mr')})` : '';
  const isNamed = nagarsevakName && nagarsevakName !== '-' && nagarsevakName !== '—';
  const partyLine = isNamed && partyName ? `${partyName}\n` : '';
  const signature = isNamed
    ? `— आपले स्नेही,\n*${nagarsevakName}*${wardText}\n${partyLine}`.trim()
    : `— आपले स्नेही,\n-${wardText}`.trim();

  return `॥ सस्नेह अभीष्टचिंतन ॥ 💐🎂\n\nप्रिय *${name}*,\nआपणांस वाढदिवसाच्या हार्दिक हार्दिक शुभेच्छा! 🎉✨\n\nईश्वर आपणांस उदंड आणि निरोगी आयुष्य, सुख-समृद्धी, उत्तम आरोग्य व मनातील सर्व मनोकामना पूर्ण करण्याचे बळ देवो, हीच प्रार्थना!\n\nआपले भावी आयुष्य आनंद, यश आणि उत्तरोत्तर प्रगतीने परिपूर्ण जावो! 🌸🙏\n\n🎂 वाढदिवसाच्या मनःपूर्वक शुभेच्छा! 🎂\n\n${signature}`;
}

function fmtDate(d) {
  return d ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(d)) : '—';
}

const marathiMonths = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
];

function formatMarathiDob(dobStr) {
  if (!dobStr) return '';
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return dobStr;
    const day = d.getDate();
    const month = marathiMonths[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dobStr;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getPartyData(partyName = '', partyPhoto = '') {
  const p = String(partyName || '').toLowerCase().trim();

  if (partyPhoto && (isDataImage(partyPhoto) || partyPhoto.startsWith('http'))) {
    return {
      name: partyName || 'राजकीय पक्ष',
      tag: 'अधिकृत चिन्ह',
      photo: partyPhoto,
      isImage: true,
      color: '#7c2d12'
    };
  }

  // BJP
  if (p.includes('bharatiya janata') || p.includes('bjp') || p.includes('भाजपा') || p.includes('भाजप')) {
    return {
      name: partyName || 'भारतीय जनता पक्ष (BJP)',
      tag: 'कमळ चिन्ह',
      short: 'BJP',
      color: '#ea580c',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#ea580c" stroke-width="3"/>
        <path d="M50 78 C35 78 28 68 22 72 C32 86 68 86 78 72 C72 68 65 78 50 78 Z" fill="#16a34a"/>
        <path d="M50 82 L50 90" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>
        <path d="M50 20 C42 35 44 60 50 72 C56 60 58 35 50 20 Z" fill="#f97316"/>
        <path d="M50 72 C40 65 30 45 35 30 C42 42 45 58 50 72 Z" fill="#fb923c"/>
        <path d="M50 72 C60 65 70 45 65 30 C58 42 55 58 50 72 Z" fill="#fb923c"/>
        <path d="M50 74 C36 70 20 54 22 42 C32 50 42 66 50 74 Z" fill="#ea580c"/>
        <path d="M50 74 C64 70 80 54 78 42 C68 50 58 66 50 74 Z" fill="#ea580c"/>
        <circle cx="50" cy="40" r="2.5" fill="#fef08a"/>
      </svg>`
    };
  }

  // Shiv Sena
  if (p.includes('shiv sena') || p.includes('शिवसेना') || p.includes('ubt')) {
    return {
      name: partyName || 'शिवसेना',
      tag: 'धनुष्यबाण चिन्ह',
      short: 'SS',
      color: '#c2410c',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#ea580c" stroke-width="3"/>
        <path d="M28 22 C68 22 78 78 28 78" stroke="#c2410c" stroke-width="6" stroke-linecap="round" fill="none"/>
        <line x1="28" y1="22" x2="28" y2="78" stroke="#d97706" stroke-width="2.5" stroke-dasharray="2,2"/>
        <line x1="20" y1="50" x2="80" y2="50" stroke="#ea580c" stroke-width="5" stroke-linecap="round"/>
        <polygon points="84,50 68,40 72,50 68,60" fill="#ea580c"/>
        <path d="M22 44 L28 50 L22 56" stroke="#9a3412" stroke-width="3" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="50" r="3" fill="#ea580c"/>
      </svg>`
    };
  }

  // Nationalist Congress Party (NCP)
  if (p.includes('nationalist congress') || p.includes('ncp') || p.includes('राष्ट्रवादी')) {
    return {
      name: partyName || 'राष्ट्रवादी काँग्रेस पक्ष (NCP)',
      tag: 'घड्याळ चिन्ह',
      short: 'NCP',
      color: '#1d4ed8',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="54" r="44" fill="#ffffff" stroke="#1d4ed8" stroke-width="3"/>
        <path d="M26 22 C22 18 16 22 20 28 C24 26 26 24 26 22 Z" fill="#1e40af"/>
        <path d="M74 22 C78 18 84 22 80 28 C76 26 74 24 74 22 Z" fill="#1e40af"/>
        <path d="M40 14 C46 10 54 10 60 14" stroke="#1e40af" stroke-width="3" fill="none"/>
        <line x1="28" y1="88" x2="20" y2="95" stroke="#1e40af" stroke-width="4" stroke-linecap="round"/>
        <line x1="72" y1="88" x2="80" y2="95" stroke="#1e40af" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="54" r="34" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
        <circle cx="50" cy="26" r="2.5" fill="#0f172a"/>
        <circle cx="78" cy="54" r="2.5" fill="#0f172a"/>
        <circle cx="50" cy="82" r="2.5" fill="#0f172a"/>
        <circle cx="22" cy="54" r="2.5" fill="#0f172a"/>
        <line x1="50" y1="54" x2="34" y2="40" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="54" x2="68" y2="44" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
        <circle cx="50" cy="54" r="3.5" fill="#1d4ed8"/>
      </svg>`
    };
  }

  // Indian National Congress (INC)
  if (p.includes('congress') || p.includes('inc') || p.includes('काँग्रेस')) {
    return {
      name: partyName || 'भारतीय राष्ट्रीय काँग्रेस (INC)',
      tag: 'हात चिन्ह',
      short: 'INC',
      color: '#059669',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#059669" stroke-width="3"/>
        <g fill="#0284c7" stroke="#0369a1" stroke-width="1.5" stroke-linejoin="round">
          <path d="M30 54 C26 48 27 42 32 40 C36 38 40 44 42 50 Z" fill="#0284c7"/>
          <path d="M40 48 L40 22 C40 18 46 18 46 22 L46 48 Z" fill="#0284c7"/>
          <path d="M48 48 L48 16 C48 12 54 12 54 16 L54 48 Z" fill="#0284c7"/>
          <path d="M56 48 L56 22 C56 18 62 18 62 22 L62 48 Z" fill="#0284c7"/>
          <path d="M64 50 L64 30 C64 26 70 26 70 30 L70 52 Z" fill="#0284c7"/>
          <path d="M34 52 C38 68 44 82 52 82 C60 82 68 68 70 52 Z" fill="#0284c7"/>
        </g>
        <circle cx="50" cy="50" r="46" stroke="#ea580c" stroke-width="2.5" fill="none"/>
      </svg>`
    };
  }

  // Bahujan Samaj Party (BSP)
  if (p.includes('bahujan') || p.includes('bsp') || p.includes('बसपा')) {
    return {
      name: partyName || 'बहुजन समाज पार्टी (BSP)',
      tag: 'हत्ती चिन्ह',
      short: 'BSP',
      color: '#1d4ed8',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#1d4ed8" stroke-width="3"/>
        <path d="M68 64 C70 52 66 40 54 36 C44 32 34 34 26 30 C22 28 20 22 24 20 C28 18 32 26 36 28 C42 22 56 22 64 28 C74 34 82 46 80 62 L80 78 L72 78 L72 68 L60 68 L60 78 L52 78 L52 68 L42 68 L42 78 L34 78 L34 58 C30 56 26 50 26 44 C30 42 34 50 38 52 C42 46 44 40 46 40 C44 54 50 62 58 64 Z" fill="#1e40af"/>
        <circle cx="34" cy="36" r="2" fill="#ffffff"/>
        <path d="M26 38 C28 42 34 44 36 42" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      </svg>`
    };
  }

  // Maharashtra Navnirman Sena (MNS)
  if (p.includes('navnirman') || p.includes('mns') || p.includes('मनसे')) {
    return {
      name: partyName || 'महाराष्ट्र नवनिर्माण सेना (MNS)',
      tag: 'रेल्वे इंजिन चिन्ह',
      short: 'MNS',
      color: '#ea580c',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#ea580c" stroke-width="3"/>
        <rect x="22" y="44" width="40" height="24" rx="3" fill="#0f172a"/>
        <rect x="58" y="32" width="22" height="36" rx="2" fill="#1e293b"/>
        <rect x="62" y="36" width="14" height="12" rx="1" fill="#93c5fd"/>
        <rect x="30" y="32" width="8" height="12" fill="#ea580c"/>
        <path d="M28 26 C26 22 34 18 38 20 C42 22 38 26 34 26 Z" fill="#cbd5e1"/>
        <polygon points="22,50 14,46 14,56" fill="#f59e0b"/>
        <circle cx="32" cy="72" r="8" fill="#475569" stroke="#ea580c" stroke-width="2"/>
        <circle cx="50" cy="72" r="8" fill="#475569" stroke="#ea580c" stroke-width="2"/>
        <circle cx="68" cy="72" r="8" fill="#475569" stroke="#ea580c" stroke-width="2"/>
        <line x1="26" y1="72" x2="74" y2="72" stroke="#94a3b8" stroke-width="2"/>
      </svg>`
    };
  }

  // AIMIM
  if (p.includes('aimim') || p.includes('majlis')) {
    return {
      name: partyName || 'AIMIM',
      tag: 'तराजू चिन्ह',
      short: 'AIMIM',
      color: '#047857',
      svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#047857" stroke-width="3"/>
        <line x1="50" y1="20" x2="50" y2="78" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
        <line x1="22" y1="36" x2="78" y2="36" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
        <path d="M38 78 L62 78 L56 70 L44 70 Z" fill="#047857"/>
        <line x1="22" y1="36" x2="16" y2="52" stroke="#d97706" stroke-width="1.5"/>
        <line x1="22" y1="36" x2="28" y2="52" stroke="#d97706" stroke-width="1.5"/>
        <path d="M12 52 C12 60 32 60 32 52 Z" fill="#047857"/>
        <line x1="78" y1="36" x2="72" y2="52" stroke="#d97706" stroke-width="1.5"/>
        <line x1="78" y1="36" x2="84" y2="52" stroke="#d97706" stroke-width="1.5"/>
        <path d="M68 52 C68 60 88 60 88 52 Z" fill="#047857"/>
      </svg>`
    };
  }

  // Independent / Civic Default
  return {
    name: partyName || 'अपक्ष / जनसेवक',
    tag: 'लोकप्रतिनिधी',
    short: 'IND',
    color: '#b45309',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#d97706" stroke-width="3"/>
      <circle cx="50" cy="52" r="22" fill="#f59e0b"/>
      <path d="M50 14 L50 24 M24 26 L31 33 M76 26 L69 33 M14 52 L24 52 M86 52 L76 52" stroke="#d97706" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M22 68 C34 60 66 60 78 68 L74 80 C60 74 40 74 26 80 Z" fill="#b45309"/>
      <circle cx="50" cy="52" r="12" fill="#ffffff" stroke="#b45309" stroke-width="2"/>
      <polygon points="50,44 53,50 59,50 54,54 56,60 50,56 44,60 46,54 41,50 47,50" fill="#d97706"/>
    </svg>`
  };
}

export function generateBirthdayCardHtml(record, autoPrint = false, currentUser = getUser()) {
  const person = record?.person || {};
  const n = record?.nagarsevak?.name !== undefined && record.nagarsevak !== null
    ? record.nagarsevak
    : getEffectiveNagarsevak(record, currentUser);
  const ward = person.family?.house?.area?.ward || {};

  const personName = person.fullName || 'सन्माननीय नागरिक';
  const hasNagarsevak = n?.name && n.name !== '-' && n.name !== '—';
  const nagarName = hasNagarsevak ? n.name : '-';
  const wardLine = formatWardLabel(ward, 'वॉर्ड परिसर');
  const wardSeatText = n?.wardSeat ? `वॉर्ड ${n.wardSeat}` : (ward.wardNumber ? formatWardNumber(ward.wardNumber, 'mr') : '');

  const dobMarathi = formatMarathiDob(person.dob);

  // Nagarsevak Avatar
  const nagarPhoto = hasNagarsevak && (isDataImage(n?.photo) || (n?.photo && n.photo.startsWith('http'))) ? n.photo : '';
  const initials = hasNagarsevak ? (String(nagarName).split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('') || 'न') : '-';
  const photoHtml = nagarPhoto
    ? `<img class="dignitary-avatar" src="${nagarPhoto}" alt="${escapeHtml(nagarName)}"/>`
    : `<div class="dignitary-avatar dignitary-avatar-fallback">${escapeHtml(initials)}</div>`;

  // Party Data & Emblem
  const party = hasNagarsevak && n?.partyName ? getPartyData(n.partyName, n?.partyPhoto || record?.partyPhoto) : null;
  const partyBadgeHtml = party
    ? (party.isImage
      ? `<img class="party-emblem" src="${party.photo}" alt="${escapeHtml(party.name)}"/>`
      : party.svg)
    : '';

  return `<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<title>वाढदिवस अभीष्टचिंतन गौरव पत्र · ${escapeHtml(personName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&family=Rozha+One&family=Tiro+Devanagari+Marathi:ital@0;1&display=swap" rel="stylesheet">
<style>
@page {
  size: A4 portrait;
  margin: 0;
}
*, *:before, *:after {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background: #fdfaf3;
  color: #1a1a1a;
  font-family: "Noto Sans Devanagari", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
body {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* A4 Sheet Container: 210mm x 297mm */
.card-sheet {
  width: 210mm;
  height: 297mm;
  max-width: 210mm;
  max-height: 297mm;
  position: relative;
  background: radial-gradient(circle at 50% 12%, #fffdf5 0%, #fdf9eb 42%, #f6edd9 100%);
  border: 1px solid #d4af37;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Background Royal Watermark / Subtle Texture */
.card-sheet::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 65%),
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c5a059' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='M30 30L15 0h30L30 30zm0 0L45 60H15L30 30zm0 0L0 45V15l30 15zm0 0l60-15v30L30 30z'/%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}

/* Ornate Double Gold Borders */
.outer-border {
  position: absolute;
  inset: 7mm;
  border: 2.4mm solid #7c2d12; /* Royal Deep Maroon */
  border-radius: 4.5mm;
  pointer-events: none;
}
.inner-border {
  position: absolute;
  inset: 10.8mm;
  border: 0.8mm solid #d4af37; /* Pure Gold */
  border-radius: 2.8mm;
  pointer-events: none;
}
.filigree-line {
  position: absolute;
  inset: 12.2mm;
  border: 0.3mm dashed rgba(180, 83, 9, 0.4);
  pointer-events: none;
}

/* 4 Corner Ornate SVG Filigrees */
.corner-ornament {
  position: absolute;
  width: 27mm;
  height: 27mm;
  pointer-events: none;
  z-index: 10;
}
.corner-tl { top: 8.5mm; left: 8.5mm; }
.corner-tr { top: 8.5mm; right: 8.5mm; transform: scaleX(-1); }
.corner-bl { bottom: 8.5mm; left: 8.5mm; transform: scaleY(-1); }
.corner-br { bottom: 8.5mm; right: 8.5mm; transform: scale(-1, -1); }

/* Main Content Area */
.card-content {
  position: relative;
  z-index: 5;
  height: 100%;
  padding: 13mm 15mm 9mm 15mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* 1. Header: Auspicious & Private Office */
.auspicious-title {
  font-family: "Tiro Devanagari Marathi", serif;
  color: #991b1b;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-top: 1px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.auspicious-title::before, .auspicious-title::after {
  content: "";
  display: inline-block;
  width: 28mm;
  height: 1px;
  background: linear-gradient(90deg, transparent, #c5a059, transparent);
}

.office-header {
  margin-bottom: 3px;
}
.office-title {
  font-size: 15px;
  font-weight: 800;
  color: #78350f;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.office-sub {
  font-size: 12.5px;
  font-weight: 600;
  color: #475569;
  margin-top: 1px;
}

/* 2. Co-Branded Leadership Banner: Nagarsevak & Party */
.leadership-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 168mm;
  margin-top: 10px;
  padding: 11px 16px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #e8d7b3;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(120, 53, 15, 0.06);
}

/* Left Dignitary: Nagarsevak Profile */
.dignitary-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
}
.dignitary-avatar-wrap {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, #fef08a, #d4af37 40%, #92400e);
  box-shadow: 0 4px 12px rgba(124, 45, 18, 0.2);
  flex-shrink: 0;
}
.dignitary-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fff;
  background: #1e293b;
}
.dignitary-avatar-fallback {
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(135deg, #1e3a8a, #0f172a);
}
.dignitary-info .role-badge {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  background: #7c2d12;
  color: #fef3c7;
  padding: 2px 9px;
  border-radius: 4px;
  margin-bottom: 2px;
}
.dignitary-name {
  font-family: "Tiro Devanagari Marathi", serif;
  font-size: 20px;
  font-weight: 700;
  color: #1e1e1e;
  line-height: 1.2;
}
.dignitary-ward {
  font-size: 11.5px;
  font-weight: 600;
  color: #64748b;
}

/* Right Dignitary: Political Party Insignia */
.party-profile {
  display: flex;
  align-items: center;
  gap: 13px;
  text-align: right;
}
.party-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.party-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #854d0e;
  text-transform: uppercase;
}
.party-title {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}
.party-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 2px 8px;
  border-radius: 999px;
  margin-top: 2px;
}
.party-emblem-wrap {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, #fef08a, #d4af37 40%, #92400e);
  box-shadow: 0 4px 12px rgba(124, 45, 18, 0.2);
  flex-shrink: 0;
}
.party-emblem-wrap svg, .party-emblem-wrap img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #fff;
  object-fit: cover;
}

/* 3. Grand 3D Ribbon Banner */
.ribbon-wrapper {
  margin: 16px 0 12px 0;
  position: relative;
  width: 100%;
  max-width: 158mm;
}
.ribbon-banner {
  background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 45%, #991b1b 100%);
  border: 1.5px solid #fde047;
  border-radius: 8px;
  padding: 10px 18px;
  box-shadow: 0 6px 20px rgba(153, 27, 27, 0.35);
  position: relative;
}
.ribbon-headline {
  font-family: "Tiro Devanagari Marathi", serif;
  font-size: 23px;
  font-weight: 800;
  color: #fffdf5;
  text-shadow: 0 2px 4px rgba(0,0,0,0.4);
  letter-spacing: 0.04em;
  margin: 0;
}
.ribbon-sub {
  font-size: 12px;
  font-weight: 600;
  color: #fef08a;
  margin-top: 3px;
  letter-spacing: 0.04em;
}

/* 4. Birthday Citizen Hero Spotlight */
.citizen-spotlight {
  margin: 10px 0 16px 0;
  width: 100%;
  max-width: 168mm;
  padding: 18px 20px;
  background: linear-gradient(180deg, #ffffff 0%, #fefcf7 100%);
  border: 1.2px solid #e0caa0;
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(180, 83, 9, 0.08);
  position: relative;
}
.citizen-salutation {
  font-size: 13.5px;
  font-weight: 700;
  color: #854d0e;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.citizen-name {
  font-family: "Rozha One", "Tiro Devanagari Marathi", serif;
  font-size: 42px;
  font-weight: 400;
  color: #7c2d12;
  line-height: 1.25;
  margin: 5px 0 6px 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.citizen-dob-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 999px;
  padding: 4px 16px;
  font-size: 13.5px;
  color: #92400e;
  margin-bottom: 8px;
}
.citizen-wish-caption {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  line-height: 1.5;
}

/* 5. Authentic Marathi Poetry & Blessing */
.blessing-section {
  width: 100%;
  max-width: 162mm;
  margin: 8px 0;
}
.blessing-poetry {
  font-family: "Tiro Devanagari Marathi", serif;
  font-size: 16px;
  font-style: italic;
  line-height: 1.8;
  color: #831843;
  background: rgba(253, 242, 248, 0.7);
  border-left: 3px solid #db2777;
  border-right: 3px solid #db2777;
  padding: 10px 18px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.blessing-text {
  font-size: 13.5px;
  line-height: 1.9;
  color: #334155;
  margin: 0;
  font-weight: 500;
}

/* 6. Footer: Verification Seal & Dignitary Sign-off */
.footer-row {
  margin-top: auto;
  width: 100%;
  max-width: 168mm;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #e8d7b3;
}
.footer-left {
  text-align: left;
  font-size: 11.5px;
  line-height: 1.55;
  color: #475569;
}
.footer-left strong {
  color: #1e293b;
  display: block;
  font-size: 12.5px;
}
.footer-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.footer-blessing-seal {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.footer-blessing-seal svg {
  width: 44px;
  height: 44px;
  opacity: 0.9;
}
.footer-seal-text {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #854d0e;
  text-transform: uppercase;
  margin-top: 3px;
}
.footer-right {
  text-align: right;
  font-size: 11.5px;
  line-height: 1.45;
}
.footer-right .sign-honorific {
  color: #64748b;
  font-weight: 600;
  display: block;
}
.footer-right .sign-name {
  font-family: "Tiro Devanagari Marathi", serif;
  font-size: 19px;
  font-weight: 800;
  color: #7c2d12;
  margin-top: 2px;
  display: block;
}
.footer-right .sign-designation {
  font-size: 11.5px;
  font-weight: 700;
  color: #1e293b;
  display: block;
}
.footer-right .sign-party {
  font-size: 11px;
  font-weight: 700;
  color: #854d0e;
  display: block;
}

/* 7. Discreet Application Credit at the very end */
.card-app-credit {
  margin-top: 8px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #94a3b8;
  text-align: center;
}

/* Print Specific Rules */
@media print {
  html, body {
    background: #fff;
    padding: 0;
    margin: 0;
    width: 210mm;
    height: 297mm;
  }
  .card-sheet {
    box-shadow: none;
    border: none;
    width: 210mm;
    height: 297mm;
    max-width: 210mm;
    max-height: 297mm;
    page-break-inside: avoid;
    break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
</head>
<body>

<article class="card-sheet">
  <!-- Outer Maroon Border -->
  <div class="outer-border"></div>
  <!-- Inner Gold Border -->
  <div class="inner-border"></div>
  <div class="filigree-line"></div>

  <!-- 4 Corner SVG Ornaments -->
  <svg class="corner-ornament corner-tl" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12 C35 12 55 18 68 32 C82 45 88 65 88 88" stroke="#d4af37" stroke-width="2.5" fill="none"/>
    <path d="M12 24 C28 24 45 30 54 40 C64 50 70 68 70 88" stroke="#7c2d12" stroke-width="1.8" fill="none"/>
    <circle cx="28" cy="28" r="6" fill="#d4af37"/>
    <circle cx="28" cy="28" r="3.5" fill="#7c2d12"/>
    <path d="M12 12 L40 12 L12 40 Z" fill="#d4af37" fill-opacity="0.25"/>
    <circle cx="48" cy="18" r="2" fill="#d4af37"/>
    <circle cx="18" cy="48" r="2" fill="#d4af37"/>
  </svg>
  <svg class="corner-ornament corner-tr" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12 C35 12 55 18 68 32 C82 45 88 65 88 88" stroke="#d4af37" stroke-width="2.5" fill="none"/>
    <path d="M12 24 C28 24 45 30 54 40 C64 50 70 68 70 88" stroke="#7c2d12" stroke-width="1.8" fill="none"/>
    <circle cx="28" cy="28" r="6" fill="#d4af37"/>
    <circle cx="28" cy="28" r="3.5" fill="#7c2d12"/>
    <path d="M12 12 L40 12 L12 40 Z" fill="#d4af37" fill-opacity="0.25"/>
    <circle cx="48" cy="18" r="2" fill="#d4af37"/>
    <circle cx="18" cy="48" r="2" fill="#d4af37"/>
  </svg>
  <svg class="corner-ornament corner-bl" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12 C35 12 55 18 68 32 C82 45 88 65 88 88" stroke="#d4af37" stroke-width="2.5" fill="none"/>
    <path d="M12 24 C28 24 45 30 54 40 C64 50 70 68 70 88" stroke="#7c2d12" stroke-width="1.8" fill="none"/>
    <circle cx="28" cy="28" r="6" fill="#d4af37"/>
    <circle cx="28" cy="28" r="3.5" fill="#7c2d12"/>
    <path d="M12 12 L40 12 L12 40 Z" fill="#d4af37" fill-opacity="0.25"/>
    <circle cx="48" cy="18" r="2" fill="#d4af37"/>
    <circle cx="18" cy="48" r="2" fill="#d4af37"/>
  </svg>
  <svg class="corner-ornament corner-br" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12 C35 12 55 18 68 32 C82 45 88 65 88 88" stroke="#d4af37" stroke-width="2.5" fill="none"/>
    <path d="M12 24 C28 24 45 30 54 40 C64 50 70 68 70 88" stroke="#7c2d12" stroke-width="1.8" fill="none"/>
    <circle cx="28" cy="28" r="6" fill="#d4af37"/>
    <circle cx="28" cy="28" r="3.5" fill="#7c2d12"/>
    <path d="M12 12 L40 12 L12 40 Z" fill="#d4af37" fill-opacity="0.25"/>
    <circle cx="48" cy="18" r="2" fill="#d4af37"/>
    <circle cx="18" cy="48" r="2" fill="#d4af37"/>
  </svg>

  <div class="card-content">
    <!-- 1. Auspicious Header -->
    <div class="auspicious-title">॥ सस्नेह अभीष्टचिंतन ॥</div>
    <div class="office-header">
      <div class="office-sub">${escapeHtml(wardSeatText || wardLine)}</div>
    </div>

    <!-- 2. Leadership Co-Branded Spotlight (Nagarsevak + Party) -->
    <div class="leadership-row">
      <!-- Nagarsevak -->
      <div class="dignitary-profile">
        <div class="dignitary-avatar-wrap">
          ${photoHtml}
        </div>
        <div class="dignitary-info">
          <span class="role-badge">मा. नगरसेवक</span>
          <div class="dignitary-name">${escapeHtml(nagarName)}</div>
          <div class="dignitary-ward">${escapeHtml(wardSeatText || wardLine)}</div>
        </div>
      </div>

      <!-- Political Party Emblem & Name -->
      ${party ? `
      <div class="party-profile">
        <div class="party-info">
          <span class="party-label">राजकीय पक्ष</span>
          <div class="party-title">${escapeHtml(party.name)}</div>
          <span class="party-tag">${escapeHtml(party.tag)}</span>
        </div>
        <div class="party-emblem-wrap">
          ${partyBadgeHtml}
        </div>
      </div>` : `
      <div class="party-profile">
        <div class="party-info">
          <span class="party-label">लोकप्रतिनिधी कार्यालय</span>
          <div class="party-title">${escapeHtml(wardSeatText || wardLine)}</div>
          <span class="party-tag">जनसंपर्क कक्ष</span>
        </div>
      </div>`}
    </div>

    <!-- 3. Grand 3D Ribbon Banner -->
    <div class="ribbon-wrapper">
      <div class="ribbon-banner">
        <h2 class="ribbon-headline">✨ वाढदिवसाच्या हार्दिक व मंगलमय शुभेच्छा ✨</h2>
        <div class="ribbon-sub">उदंड आयुष्याच्या अनंत सदिच्छा व कोटी कोटी शुभेच्छा!</div>
      </div>
    </div>

    <!-- 4. Citizen Spotlight (Default Prominent Name, No Address/Years) -->
    <div class="citizen-spotlight">
      <div class="citizen-salutation">सन्माननीय नागरिक</div>
      <div class="citizen-name">मा. ${escapeHtml(personName)}</div>
      ${dobMarathi ? `<div class="citizen-dob-badge"><span>🎂</span> शुभ जन्मदिनांक: <strong>${escapeHtml(dobMarathi)}</strong></div>` : ''}
      <div class="citizen-wish-caption">आपणांस वाढदिवसानिमित्त उदंड आयुष्य, उत्तम आरोग्य, सुख-शांती आणि समृद्धी लाभो हीच मनोभावे सदिच्छा!</div>
    </div>

    <!-- 5. Auspicious Marathi Blessing & Poetry -->
    <div class="blessing-section">
      <div class="blessing-poetry">
        “नवे क्षितीज, नवी पहाट, फुलावी आयुष्यातील प्रत्येक वाट!<br>
        उदंड आणि निरोगी दीर्घायुष्यासाठी, ईश्वरचरणी हीच प्रार्थना आज!”
      </div>
      <p class="blessing-text">
        आपण आमच्या परिसराचे एक सुजाण, कर्तव्यदक्ष व आदरणीय नागरिक आहात. आपल्या सहकार्याने व आपुलकीने परिसराच्या विकासाची वाटचाल निरंतर पुढे जात आहे. आपल्या वाढदिवसानिमित्त आपले पुढील जीवन सुख, समृद्धी, उत्तम आरोग्य आणि भरभराटीने परिपूर्ण जावो, हीच ईश्वरचरणी मनःपूर्वक प्रार्थना!
      </p>
    </div>

    <!-- 6. Footer: Office Helpline & Dignitary Sign-off -->
    <div class="footer-row">
      <div class="footer-left">
        <strong>जनसंपर्क कार्यालय</strong>
        ${n?.mobile ? `संपर्क / हेल्पलाईन: ${escapeHtml(n.mobile)}<br/>` : ''}नागरिकांच्या सेवेसाठी सदैव तत्पर
      </div>
      <div class="footer-center">
        <div class="footer-blessing-seal">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="44" stroke="#d4af37" stroke-width="2.5" stroke-dasharray="3,2"/>
            <circle cx="50" cy="50" r="38" stroke="#7c2d12" stroke-width="1.5"/>
            <path d="M50 20 L55 35 L70 35 L58 45 L62 60 L50 50 L38 60 L42 45 L30 35 L45 35 Z" fill="#d4af37" fill-opacity="0.35"/>
            <circle cx="50" cy="50" r="14" fill="#7c2d12"/>
            <circle cx="50" cy="50" r="10" fill="#fef3c7"/>
          </svg>
          <div class="footer-seal-text">शुभेच्छा पत्र</div>
        </div>
      </div>
      <div class="footer-right">
        <span class="sign-honorific">आपला स्नेही / नम्र,</span>
        <span class="sign-name">${escapeHtml(nagarName)}</span>
        <span class="sign-designation">नगरसेवक · ${escapeHtml(wardSeatText || wardLine)}</span>
        ${hasNagarsevak && n?.partyName ? `<span class="sign-party">${escapeHtml(n.partyName)}</span>` : ''}
      </div>
    </div>

    <!-- 7. Application name at the very end of card -->
    <div class="card-app-credit">WardDesk</div>
  </div>
</article>

${autoPrint ? `<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 400);
  });
  window.addEventListener('afterprint', function() {
    setTimeout(function() { window.close(); }, 350);
  });
</script>` : ''}
</body>
</html>`;
}

export function printBirthdayCard(record, currentUser = getUser()) {
  const html = generateBirthdayCardHtml(record, true, currentUser);
  const w = window.open('', '_blank', 'width=950,height=800');
  if (!w) {
    alert('Please allow pop-ups for WardDesk to print the birthday card directly, or use the "Preview Card" button to view and print.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

function BirthdayCardPreviewModal({ record, onClose, onPrint, currentUser }) {
  const [zoom, setZoom] = useState('fit');
  const iframeRef = useRef(null);

  const cardHtml = useMemo(() => {
    return generateBirthdayCardHtml(record, false, currentUser);
  }, [record, currentUser]);

  const handlePrintInside = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      onPrint();
    }
  };

  return (
    <div className="card-preview-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="card-preview-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="card-preview-header">
          <div className="card-preview-header-title">
            <span style={{ fontSize: '20px' }}>👑</span>
            <span>Birthday Greeting Card · <strong>{record.person?.fullName}</strong></span>
          </div>
          <div className="card-preview-actions">
            <div className="card-preview-zoom-btns" style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`small-btn ${zoom === 'fit' ? 'active-pill' : ''}`}
                onClick={() => setZoom('fit')}
                title="Fit to Screen"
              >
                Fit Screen
              </button>
              <button
                type="button"
                className={`small-btn ${zoom === '75' ? 'active-pill' : ''}`}
                onClick={() => setZoom('75')}
              >
                75%
              </button>
              <button
                type="button"
                className={`small-btn ${zoom === '100' ? 'active-pill' : ''}`}
                onClick={() => setZoom('100')}
              >
                100% (A4)
              </button>
            </div>
            <button
              type="button"
              className="primary-btn small-btn"
              onClick={handlePrintInside}
              title="Print A4 Card"
            >
              🖨️ Print Card (A4)
            </button>
            <button
              type="button"
              className="small-btn"
              onClick={onClose}
              style={{ fontWeight: 800 }}
              title="Close"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="card-preview-body">
          <div
            className={`card-preview-iframe-wrapper zoom-${zoom}`}
            style={{
              transform: zoom === '75' ? 'scale(0.75)' : zoom === 'fit' ? 'scale(0.82)' : 'none',
              transformOrigin: 'top center'
            }}
          >
            <iframe
              ref={iframeRef}
              title="Birthday Card Preview"
              srcDoc={cardHtml}
              className="card-preview-iframe"
            />
          </div>
        </div>

        <div className="card-preview-footer">
          <span>💡 <strong>Tip:</strong> Printing in color on good quality A4 paper enhances the royal gold and maroon embellishments.</span>
          <span>Ward: {record.person?.family?.house?.area?.ward?.wardNumber || '—'} · Nagarsevak: {record.nagarsevak?.name || '-'}</span>
        </div>
      </div>
    </div>
  );
}

export default function Birthdays() {
  const { selectedWardId } = useWardFilter();
  const [currentUser, setCurrentUser] = useState(() => getUser());

  useEffect(() => {
    api.me().then(res => {
      if (res?.data?.user) {
        setCurrentUser(res.data.user);
        try {
          localStorage.setItem('ward_user', JSON.stringify(res.data.user));
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const saved = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('ward_birthdays_filters') || '{}');
    } catch {
      return {};
    }
  })();
  const [mode, setMode] = useState(saved.mode || 'upcoming');
  const [windowKey, setWindowKey] = useState(saved.windowKey || 'next30');
  const [customFrom, setCustomFrom] = useState(saved.customFrom || '');
  const [customTo, setCustomTo] = useState(saved.customTo || '');
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      sessionStorage.setItem('ward_birthdays_filters', JSON.stringify({ mode, windowKey, customFrom, customTo }));
    } catch {}
  }, [mode, windowKey, customFrom, customTo]);

  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [previewRecord, setPreviewRecord] = useState(null);
  const [error, setError] = useState('');

  const windows = mode === 'previous' ? previousWindows : upcomingWindows;
  const win = windows.find(x => x.key === windowKey) || windows[0];

  const customDays = useMemo(() => {
    if (!customFrom || !customTo) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const a = new Date(`${customFrom}T00:00:00`);
    const b = new Date(`${customTo}T00:00:00`);
    if (b < a) return null;
    return { from: Math.floor((a - today) / 86400000), to: Math.floor((b - today) / 86400000) };
  }, [customFrom, customTo]);

  useEffect(() => {
    const range = windowKey === 'custom' && customDays ? customDays : win;
    if (windowKey === 'custom' && !customDays) {
      setRows([]);
      return;
    }
    setRows(null);
    setError('');
    const days = Math.max(range.to - range.from + 1, 1);
    api.birthdays(days, selectedWardId || undefined, range.from)
      .then(r => setRows(r.data || []))
      .catch(e => setError(e.message));
  }, [windowKey, customDays?.from, customDays?.to, selectedWardId]);

  // Strictly filter rows by selected ward (double-locking client and backend)
  const wardScopedRows = useMemo(() => {
    const list = rows || [];
    if (!selectedWardId) return list;
    return list.filter(r => {
      const p = r.person || {};
      const f = p.family || {};
      const h = f.house || {};
      const a = h.area || {};
      const w = a.ward || {};
      const wId = r.wardId || w.id || a.wardId;
      return String(wId) === String(selectedWardId);
    });
  }, [rows, selectedWardId]);

  // KPI Statistics
  const stats = useMemo(() => {
    const list = wardScopedRows;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    for (const r of list) {
      if (r.daysToBirthday === 0) todayCount += 1;
      if (r.daysToBirthday >= 0 && r.daysToBirthday <= 7) weekCount += 1;
      if (r.daysToBirthday >= 0 && r.daysToBirthday <= 30) monthCount += 1;
    }
    return {
      todayCount,
      weekCount,
      monthCount,
      totalCount: list.length
    };
  }, [wardScopedRows]);

  // Search filtering
  const visible = useMemo(() => {
    let list = wardScopedRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => {
        const p = r.person || {};
        const f = p.family || {};
        const h = f?.house || {};
        const a = h?.area || {};
        return [p.fullName, p.mobile, f?.familyName, h?.houseNumber, h?.address, a?.name]
          .some(v => String(v || '').toLowerCase().includes(q));
      });
    }
    return list;
  }, [wardScopedRows, search]);

  return (
    <div className="admin-data-page birthdays-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        title="Birthdays"
        subtitle="Coordinate greetings, generate personalized birthday greeting cards, and plan field outreach for ward citizens."
      />
      <ErrorBox error={error} />

      {/* KPI Overview Cards (4 cohesive cards) */}
      <div className="team-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: '16px' }}>
        <div className="team-kpi-card">
          <div className="team-kpi-icon red">
            <GiftIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.todayCount}</div>
            <div className="team-kpi-label">Today's Birthdays</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <CalendarIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.weekCount}</div>
            <div className="team-kpi-label">Next 7 Days</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <HeartIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.monthCount}</div>
            <div className="team-kpi-label">Upcoming (30 Days)</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.totalCount}</div>
            <div className="team-kpi-label">Total in Scope</div>
          </div>
        </div>
      </div>

      {/* Professional Cohesive Filter Panel */}
      <section className="death-filter-panel" style={{ marginBottom: '16px' }}>
        <div className="prof-filter-grid">
          {/* Ward Scope */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Ward Scope</label>
            <WardFilter compact label="Ward" />
          </div>

          {/* Quick Search */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Search Citizen</label>
            <div className="prof-search-input-wrap">
              <SearchIcon size={16} />
              <input
                placeholder="Name, mobile, family, house…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Birthday Scope */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Birthday Scope</label>
            <select
              className="prof-filter-select"
              value={mode}
              onChange={e => {
                const v = e.target.value;
                setMode(v);
                setWindowKey(v === 'previous' ? 'previous8' : 'next30');
                setCustomFrom('');
                setCustomTo('');
              }}
            >
              <option value="upcoming">Upcoming Birthdays</option>
              <option value="previous">Previous Birthdays</option>
            </select>
          </div>

          {/* Period Window */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Period Window</label>
            <select
              className="prof-filter-select"
              value={windowKey}
              onChange={e => setWindowKey(e.target.value)}
            >
              {windows.map(w => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {windowKey === 'custom' && (
            <>
              <div className="prof-filter-field">
                <label className="prof-filter-label">From Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="prof-filter-field">
                <label className="prof-filter-label">To Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Clean Filter Status & Reset Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
          <div className="muted" style={{ fontSize: '12.5px' }}>
            Showing <strong>{visible.length}</strong> {visible.length === 1 ? 'birthday' : 'birthdays'}
          </div>
          <button
            type="button"
            className="small-btn"
            disabled={!search && mode === 'upcoming' && windowKey === 'next30' && !customFrom && !customTo}
            onClick={() => {
              setSearch('');
              setMode('upcoming');
              setWindowKey('next30');
              setCustomFrom('');
              setCustomTo('');
            }}
            style={{ height: '32px', minHeight: '32px', padding: '0 14px', fontSize: '12.5px' }}
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* Main Content */}
      {!rows ? (
        <Loading />
      ) : !visible.length ? (
        <Empty>No birthdays found for the selected ward and filter criteria.</Empty>
      ) : (
        <div className="birthday-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {visible.map(r => {
            const p = r.person || {};
            const f = p.family || {};
            const h = f?.house || {};
            const a = h?.area || {};
            const w = a?.ward || {};
            const phone = (p.mobile || '').replace(/\D/g, '');
            const nagarsevak = getEffectiveNagarsevak(r, currentUser);
            const hasNagarsevak = nagarsevak?.name && nagarsevak.name !== '-' && nagarsevak.name !== '—';
            const text = encodeURIComponent(birthdayMessageMarathi(
              p.fullName,
              hasNagarsevak ? nagarsevak.name : '-',
              hasNagarsevak ? nagarsevak.partyName : '',
              w?.wardNumber
            ));
            const party = hasNagarsevak && nagarsevak.partyName ? getPartyData(nagarsevak.partyName, nagarsevak.photo) : null;
            const enrichedRecord = { ...r, nagarsevak };

            const isToday = r.daysToBirthday === 0;
            const isTomorrow = r.daysToBirthday === 1;

            return (
              <article
                className="birthday-card prof-card"
                key={p.id}
                style={{
                  background: '#ffffff',
                  border: isToday ? '1.5px solid #fb7185' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isToday ? '0 4px 12px rgba(244, 63, 94, 0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}
              >
                {/* Header: Citizen details & Milestone Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div className="prof-avatar" style={{ flexShrink: 0 }}>
                      {getInitials(p.fullName)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong className="prof-text-truncate" style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                        {p.fullName}
                      </strong>
                      <div className="muted" style={{ fontSize: '12px', marginTop: '1px' }}>
                        <span>DOB: {fmtDate(p.dob)}</span>
                        {p.age != null ? <span> · Age {p.age}</span> : null}
                        {p.gender ? <span> · {p.gender}</span> : null}
                      </div>
                    </div>
                  </div>

                  {/* Milestone Badge */}
                  <span
                    className={`team-badge ${isToday ? 'red' : isTomorrow ? 'amber' : r.daysToBirthday < 0 ? 'gray' : 'blue'}`}
                    style={{ fontWeight: 700, fontSize: '11px', flexShrink: 0 }}
                  >
                    {isToday
                      ? 'Today'
                      : isTomorrow
                      ? 'Tomorrow'
                      : r.daysToBirthday === -1
                      ? 'Yesterday'
                      : r.daysToBirthday === -2
                      ? '2 days ago'
                      : r.daysToBirthday < 0
                      ? `${Math.abs(r.daysToBirthday)}d ago`
                      : `In ${r.daysToBirthday}d`}
                  </span>
                </div>

                {/* Specs Box: Contact & Residence */}
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PhoneIcon size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                    {p.mobile ? (
                      <a href={`tel:${p.mobile}`} className="prof-contact-link notranslate" translate="no" style={{ fontSize: '12px' }}>
                        {p.mobile}
                      </a>
                    ) : (
                      <span className="muted">No mobile</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BuildingIcon size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                    <span className="prof-text-truncate">
                      {h?.houseNumber ? `House #${h.houseNumber} · ` : ''}
                      {a?.name || 'Colony —'}
                      {w?.wardNumber ? ` · ${formatWardNumber(w.wardNumber)}` : ''}
                    </span>
                  </div>
                </div>

                {/* Co-Branded Nagarsevak Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f1f5f9', borderRadius: '6px', fontSize: '11.5px' }}>
                  <FaceAvatar name={hasNagarsevak ? nagarsevak.name : '-'} photo={hasNagarsevak ? nagarsevak.photo : null} size="sm" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Nagarsevak</div>
                    <strong className="prof-text-truncate" style={{ fontSize: '12px', color: '#1e293b', display: 'block' }}>
                      {hasNagarsevak ? nagarsevak.name : '-'}
                    </strong>
                  </div>
                  {hasNagarsevak && nagarsevak?.partyName ? (
                    <span className="party-badge" style={{ fontSize: '10px' }} title={party?.name || nagarsevak.partyName}>
                      {nagarsevak.partyName}
                    </span>
                  ) : null}
                </div>

                {/* Card Actions Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-action outline-blue"
                    onClick={() => setPreviewRecord(enrichedRecord)}
                    style={{ flex: 1, minWidth: '90px', justifyContent: 'center' }}
                    title="Preview personalized A4 printable greeting card"
                  >
                    <EyeIcon size={13} />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => printBirthdayCard(enrichedRecord, currentUser)}
                    style={{ flex: 1, minWidth: '70px', justifyContent: 'center' }}
                    title="Direct print A4 greeting card"
                  >
                    <PrinterIcon size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => setSelected(enrichedRecord)}
                    style={{ padding: '0 10px' }}
                    title="View full citizen, household and family details"
                  >
                    <span>Details</span>
                  </button>
                  {phone.length === 10 && (
                    <a
                      className="btn-action whatsapp-action-btn"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/91${phone}?text=${text}`}
                      style={{
                        background: '#25d366',
                        color: '#ffffff',
                        borderColor: '#25d366',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0 10px',
                        textDecoration: 'none'
                      }}
                      title="Send birthday wishes via WhatsApp"
                    >
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Details Modal with Home Direction */}
      {selected && (() => {
        const p = selected.person || {};
        const f = p.family || {};
        const h = f.house || {};
        const a = h.area || {};
        const w = a.ward || {};
        const selectedNagar = selected?.nagarsevak;
        const hasSelectedNagar = selectedNagar?.name && selectedNagar.name !== '-' && selectedNagar.name !== '—';

        return (
          <Modal wide title={`Birthday Details · ${p.fullName}`} onClose={() => setSelected(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Top Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="prof-avatar" style={{ width: '44px', height: '44px', fontSize: '16px' }}>
                    {getInitials(p.fullName)}
                  </div>
                  <div>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{p.fullName}</strong>
                    <div className="muted" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                      <span>DOB: {fmtDate(p.dob)}</span>
                      {p.age != null ? <span> · Age: {p.age}</span> : null}
                      {p.gender ? <span> · {p.gender}</span> : null}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setPreviewRecord(selected);
                      setSelected(null);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    <EyeIcon size={14} />
                    <span>Preview Card</span>
                  </button>
                  <button
                    type="button"
                    className="small-btn"
                    onClick={() => printBirthdayCard(selected, currentUser)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    <PrinterIcon size={14} />
                    <span>Print Card</span>
                  </button>
                </div>
              </div>

              {/* Specification Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Card 1: Citizen Contact */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <UsersIcon size={16} />
                    <span>Citizen Information</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Full Name:</span>
                      <strong className="prof-spec-value">{p.fullName}</strong>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Date of Birth:</span>
                      <span className="prof-spec-value">{fmtDate(p.dob)}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Current Age:</span>
                      <span className="prof-spec-value">{p.age ?? '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Mobile Number:</span>
                      <span className="prof-spec-value">{p.mobile || '—'}</span>
                    </div>
                    {p.alternateMobile ? (
                      <div className="prof-spec-row">
                        <span className="prof-spec-label">Alternate Mobile:</span>
                        <span className="prof-spec-value">{p.alternateMobile}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Card 2: Household & Residence with Directions */}
                <div className="prof-detail-card">
                  <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BuildingIcon size={16} />
                      <span>Household Residence</span>
                    </div>
                    {/* Home Directions Button */}
                    <a
                      href={getDirectionsUrl(h)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        padding: '4px 12px',
                        textDecoration: 'none'
                      }}
                      title="Open Google Maps directions to this citizen's residence"
                    >
                      <MapPinIcon size={14} />
                      <span>Home Direction</span>
                    </a>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Family Name:</span>
                      <strong className="prof-spec-value">{f.familyName || '—'}</strong>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">House Number:</span>
                      <span className="prof-spec-value">{h.houseNumber || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Street / Address:</span>
                      <span className="prof-spec-value">{h.address || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Colony / Area:</span>
                      <span className="prof-spec-value">{a.name || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Ward Scope:</span>
                      <span className="prof-spec-value">{w.wardNumber ? formatWardNumber(w.wardNumber) : '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Co-Branded Nagarsevak */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <HeartIcon size={16} />
                    <span>Greeting Authority</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <FaceAvatar
                      name={hasSelectedNagar ? selectedNagar.name : '-'}
                      photo={hasSelectedNagar ? selectedNagar.photo : null}
                      className="staff-face-lg"
                    />
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                        {hasSelectedNagar ? selectedNagar.name : '-'}
                      </strong>
                      {hasSelectedNagar && selectedNagar?.partyName ? (
                        <span className="party-badge" style={{ marginTop: '3px', display: 'inline-block' }}>
                          {selectedNagar.partyName}
                        </span>
                      ) : null}
                      {hasSelectedNagar && selectedNagar?.mobile ? (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          {selectedNagar.mobile}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Card 4: Family Members */}
                {(f.members || []).length > 0 && (
                  <div className="prof-detail-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="prof-card-title">
                      <UsersIcon size={16} />
                      <span>Family Members ({f.members.length})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {f.members.map(m => (
                        <div key={m.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9', fontSize: '12px' }}>
                          <strong style={{ display: 'block', color: '#1e293b' }}>{m.fullName}</strong>
                          <span className="muted">
                            {m.gender ? `${m.gender} · ` : ''}
                            {m.age != null ? `Age ${m.age}` : 'Age —'}
                            {m.mobile ? ` · ${m.mobile}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {previewRecord && (
        <BirthdayCardPreviewModal
          record={previewRecord}
          currentUser={currentUser}
          onClose={() => setPreviewRecord(null)}
          onPrint={() => printBirthdayCard(previewRecord, currentUser)}
        />
      )}
    </div>
  );
}
