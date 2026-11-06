import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  PaginationBar,
  RowMenu,
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { can, isNagarsevak, isEmployee, isMaster } from '../rbac';
import { directionsUrl, hasCoords } from '../location';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import LocationPicker from '../components/LocationMap';
import { getLanguage } from '../language';
import {
  HeartIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  SearchIcon,
  CheckIcon,
  BuildingIcon,
  MedicalIcon,
  TrashIcon
} from '../components/Icons';

const HOSPITAL_TYPES = [
  { value: 'GOVERNMENT', en: 'Government', mr: 'शासकीय' },
  { value: 'PRIVATE', en: 'Private', mr: 'खासगी' },
  { value: 'TRUST', en: 'Trust / Charitable', mr: 'ट्रस्ट / सेवाभावी' },
  { value: 'CLINIC', en: 'Clinic', mr: 'क्लिनिक' },
  { value: 'PHC', en: 'PHC / UHC', mr: 'प्राथमिक आरोग्य केंद्र' },
  { value: 'AYUSH', en: 'AYUSH', mr: 'आयुष' },
  { value: 'OTHER', en: 'Other', mr: 'इतर' }
];

const MEDICAL_TYPES = [
  { value: 'ALLOPATHIC', en: 'Allopathic / Chemist', mr: 'अ‍ॅलोपॅथिक / केमिस्ट' },
  { value: 'GENERIC', en: 'Generic / Jan Aushadhi', mr: 'जेनेरिक / जनऔषधी' },
  { value: 'AYURVEDIC', en: 'Ayurvedic', mr: 'आयुर्वेदिक' },
  { value: 'HOMOEOPATHIC', en: 'Homoeopathic', mr: 'होमियोपॅथिक' },
  { value: 'WHOLESALE_RETAIL', en: 'Wholesale & Retail', mr: 'होलसेल व रिटेल' },
  { value: 'OTHER', en: 'Other', mr: 'इतर' }
];

const hospitalBlank = {
  name: '',
  type: 'PRIVATE',
  wardId: '',
  areaId: '',
  address: '',
  landmark: '',
  phone: '',
  emergencyPhone: '',
  openingHours: '',
  facilities: '',
  notes: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: ''
};

const medicalBlank = {
  name: '',
  type: 'ALLOPATHIC',
  wardId: '',
  areaId: '',
  address: '',
  landmark: '',
  phone: '',
  openingHours: '',
  is24x7: false,
  homeDelivery: false,
  facilities: '',
  notes: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: ''
};

function hospitalTypeLabel(value, isMr) {
  const hit = HOSPITAL_TYPES.find(t => t.value === value);
  return hit ? (isMr ? hit.mr : hit.en) : value || '—';
}

function medicalTypeLabel(value, isMr) {
  const hit = MEDICAL_TYPES.find(t => t.value === value);
  return hit ? (isMr ? hit.mr : hit.en) : value || '—';
}

function translateMedicalName(name, isMr) {
  if (!isMr || !name) return name;
  const map = {
    'Mauli 24x7 Chemist & Druggist': 'माऊली २४x७ केमिस्ट आणि औषधांचे दुकान',
    'PM Jan Aushadhi Medical Store': 'प्रधानमंत्री जनऔषधी केंद्र व मेडिकल स्टोअर',
    'Apollo Pharmacy & Wellness': 'अपोलो फार्मसी आणि वेलनेस',
    'Sanjeevani Ayurvedic & Herbal Store': 'संजीवनी आयुर्वेदिक व हर्बल स्टोअर'
  };
  return map[name] || name;
}

function translateHours(hours, isMr) {
  if (!isMr || !hours) return hours;
  if (/24\s*hours/i.test(hours)) return '२४ तास सुरू (24x7)';
  return hours
    .replace(/AM/gi, 'सकाळी')
    .replace(/PM/gi, 'रात्री')
    .replace(/Mon-Sun/gi, 'सोम-रवि')
    .replace(/Mon-Sat/gi, 'सोम-शनि')
    .replace(/Daily/gi, 'दररोज');
}

function getInitials(name, fallback = 'H') {
  if (!name) return fallback;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function parseFacilitiesList(facilities) {
  if (!facilities) return [];
  return String(facilities)
    .split(/[,;\n•]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function isHospital24x7(h) {
  const text = `${h?.openingHours || ''} ${h?.facilities || ''} ${h?.notes || ''}`.toLowerCase();
  return text.includes('24x7') || text.includes('24 hours') || text.includes('24 तास') || text.includes('casualty') || Boolean(h?.emergencyPhone);
}

function hasCashlessScheme(h) {
  const text = `${h?.facilities || ''} ${h?.notes || ''}`.toLowerCase();
  return text.includes('ayushman') || text.includes('mjpjay') || text.includes('pmjay') || text.includes('cashless') || text.includes('कॅशलेस');
}

function HospitalCard({ h, isMr, onOpen }) {
  const pinned = hasCoords(h.latitude, h.longitude);
  const is24x7 = isHospital24x7(h);
  const hasCashless = hasCashlessScheme(h);
  const facilitiesList = parseFacilitiesList(h.facilities);
  const displayHours = translateHours(h.openingHours, isMr);
  const wardLabel = formatWardNumber(h.ward?.wardNumber) || formatWardLabel(h.ward);

  return (
    <article className="civic-health-card hospital-card">
      <div className="health-card-header">
        <div className="health-card-type-row">
          <span className={`health-type-chip type-${String(h.type || '').toLowerCase()}`}>
            {hospitalTypeLabel(h.type, isMr)}
          </span>
          <div className="health-badges-group">
            {is24x7 && (
              <span className="health-status-badge is-emergency">
                🚨 {isMr ? '२४x७ आणीबाणी' : '24x7 Emergency'}
              </span>
            )}
            {hasCashless && (
              <span className="health-status-badge is-cashless">
                🛡️ {isMr ? 'आयुष्मान / MJPJAY' : 'Cashless PMJAY'}
              </span>
            )}
            {h.status === 'INACTIVE' && (
              <span className="health-status-badge is-inactive">{isMr ? 'निष्क्रिय' : 'Inactive'}</span>
            )}
          </div>
        </div>

        <h3 className="health-card-title">{h.name}</h3>

        <div className="health-card-location">
          <MapPinIcon size={14} className="location-icon" />
          <span className="location-text">
            {h.address}{h.landmark ? ` (जवळ: ${h.landmark})` : ''}
          </span>
        </div>

        <div className="health-card-ward-tag">
          {wardLabel && <span className="health-ward-chip">🏛️ {wardLabel}</span>}
          {h.area?.name && <span className="health-area-chip">📍 {h.area.name}</span>}
        </div>
      </div>

      <div className="health-card-body">
        {h.openingHours && (
          <div className="health-info-row">
            <ClockIcon size={14} />
            <span className="info-label">{isMr ? 'वेळ:' : 'Timings:'}</span>
            <span className="info-value">{displayHours}</span>
          </div>
        )}

        {h.phone && (
          <div className="health-info-row">
            <PhoneIcon size={14} />
            <span className="info-label">{isMr ? 'संपर्क:' : 'Phone:'}</span>
            <a href={`tel:${h.phone}`} className="info-phone-link">{h.phone}</a>
          </div>
        )}

        {h.emergencyPhone && (
          <a href={`tel:${h.emergencyPhone}`} className="health-emergency-callout">
            <div className="callout-icon">🚨</div>
            <div className="callout-content">
              <span className="callout-kicker">{isMr ? 'आणीबाणी कक्ष / ICU थेट संपर्क' : 'Emergency & Casualty Hotline'}</span>
              <strong className="callout-number">{h.emergencyPhone}</strong>
            </div>
            <span className="callout-action">{isMr ? 'कॉल' : 'Call'} →</span>
          </a>
        )}

        {facilitiesList.length > 0 && (
          <div className="health-facilities-block">
            <div className="facilities-title">{isMr ? 'प्रमुख वैद्यकीय सुविधा:' : 'Key Facilities & Services:'}</div>
            <div className="facilities-chips-wrap">
              {facilitiesList.slice(0, 5).map((f, i) => (
                <span key={i} className="facility-pill">{f}</span>
              ))}
              {facilitiesList.length > 5 && (
                <span className="facility-pill more">+{facilitiesList.length - 5} {isMr ? 'अधिक' : 'more'}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="health-card-actions">
        {h.phone && (
          <a className="health-btn is-call" href={`tel:${h.phone}`}>
            <PhoneIcon size={14} />
            <span>{isMr ? 'कॉल करा' : 'Call'}</span>
          </a>
        )}
        {pinned && (
          <a
            className="health-btn is-directions"
            href={directionsUrl(h.latitude, h.longitude)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPinIcon size={14} />
            <span>{isMr ? 'गुगल मॅप दिशा' : 'Directions'}</span>
          </a>
        )}
        <button type="button" className="health-btn is-details" onClick={() => onOpen(h)}>
          <EyeIcon size={14} />
          <span>{isMr ? 'सविस्तर माहिती' : 'Details'}</span>
        </button>
      </div>
    </article>
  );
}

function MedicalCard({ m, isMr, onOpen }) {
  const pinned = hasCoords(m.latitude, m.longitude);
  const displayName = translateMedicalName(m.name, isMr);
  const displayHours = translateHours(m.openingHours, isMr);
  const facilitiesList = parseFacilitiesList(m.facilities);
  const wardLabel = formatWardNumber(m.ward?.wardNumber) || formatWardLabel(m.ward);

  return (
    <article className="civic-health-card medical-card">
      <div className="health-card-header">
        <div className="health-card-type-row">
          <span className={`health-type-chip type-${String(m.type || '').toLowerCase()}`}>
            {medicalTypeLabel(m.type, isMr)}
          </span>
          <div className="health-badges-group">
            {m.is24x7 && (
              <span className="health-status-badge is-open24">
                <ClockIcon size={12} />
                {isMr ? '२४ तास सुरू' : '24x7 Open'}
              </span>
            )}
            {m.homeDelivery && (
              <span className="health-status-badge is-delivery">
                🛵 {isMr ? 'होम डिलिव्हरी' : 'Delivery'}
              </span>
            )}
            {m.type === 'GENERIC' && (
              <span className="health-status-badge is-cashless">
                💊 {isMr ? 'जनऔषधी सवलत' : 'Jan Aushadhi'}
              </span>
            )}
            {m.status === 'INACTIVE' && (
              <span className="health-status-badge is-inactive">{isMr ? 'निष्क्रिय' : 'Inactive'}</span>
            )}
          </div>
        </div>

        <h3 className="health-card-title">{displayName}</h3>

        <div className="health-card-location">
          <MapPinIcon size={14} className="location-icon" />
          <span className="location-text">
            {m.address}{m.landmark ? ` (जवळ: ${m.landmark})` : ''}
          </span>
        </div>

        <div className="health-card-ward-tag">
          {wardLabel && <span className="health-ward-chip">🏛️ {wardLabel}</span>}
          {m.area?.name && <span className="health-area-chip">📍 {m.area.name}</span>}
        </div>
      </div>

      <div className="health-card-body">
        {m.openingHours && (
          <div className="health-info-row">
            <ClockIcon size={14} />
            <span className="info-label">{isMr ? 'वेळ:' : 'Timings:'}</span>
            <span className="info-value">{displayHours}</span>
          </div>
        )}

        {m.phone && (
          <div className="health-info-row">
            <PhoneIcon size={14} />
            <span className="info-label">{isMr ? 'संपर्क फोन:' : 'Phone:'}</span>
            <a href={`tel:${m.phone}`} className="info-phone-link">{m.phone}</a>
          </div>
        )}

        {facilitiesList.length > 0 && (
          <div className="health-facilities-block">
            <div className="facilities-title">{isMr ? 'उपलब्ध औषधे व सेवा:' : 'Available Medicines & Care:'}</div>
            <div className="facilities-chips-wrap">
              {facilitiesList.slice(0, 5).map((f, i) => (
                <span key={i} className="facility-pill">{f}</span>
              ))}
              {facilitiesList.length > 5 && (
                <span className="facility-pill more">+{facilitiesList.length - 5} {isMr ? 'अधिक' : 'more'}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="health-card-actions">
        {m.phone && (
          <a className="health-btn is-call" href={`tel:${m.phone}`}>
            <PhoneIcon size={14} />
            <span>{isMr ? 'कॉल करा' : 'Call'}</span>
          </a>
        )}
        {pinned && (
          <a
            className="health-btn is-directions"
            href={directionsUrl(m.latitude, m.longitude)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPinIcon size={14} />
            <span>{isMr ? 'गुगल मॅप दिशा' : 'Directions'}</span>
          </a>
        )}
        <button type="button" className="health-btn is-details" onClick={() => onOpen(m)}>
          <EyeIcon size={14} />
          <span>{isMr ? 'सविस्तर माहिती' : 'Details'}</span>
        </button>
      </div>
    </article>
  );
}

function AdminHospitalCard({ h, isMr, canEdit, canDelete, onView, onEdit, onDelete, onUpdateLocation }) {
  const pinned = hasCoords(h.latitude, h.longitude);
  const is24x7 = isHospital24x7(h);
  const hasCashless = hasCashlessScheme(h);
  const facilitiesList = parseFacilitiesList(h.facilities);
  const wardNo = formatWardNumber(h.ward?.wardNumber);
  const initials = getInitials(h.name, 'HP');

  return (
    <div className={`admin-health-card ${h.status === 'INACTIVE' ? 'is-inactive' : ''}`}>
      <div className="admin-card-head">
        <div className="admin-card-head-left">
          <div className="admin-card-avatar" onClick={() => onView(h)} style={{ cursor: 'pointer' }} title={isMr ? 'तपशील पहा' : 'View details'}>
            {initials}
          </div>
          <div className="admin-card-titles">
            <h4 className="admin-card-name" onClick={() => onView(h)}>
              {h.name}
            </h4>
            <div className="admin-card-type-row">
              <span className={`health-type-chip type-${String(h.type || '').toLowerCase()}`}>
                {hospitalTypeLabel(h.type, isMr)}
              </span>
              <span className={`team-badge ${h.status === 'INACTIVE' ? 'gray' : 'green'}`}>
                {h.status === 'INACTIVE' ? (isMr ? 'निष्क्रिय' : 'Inactive') : (isMr ? 'सक्रिय' : 'Active')}
              </span>
              {is24x7 && (
                <span className="health-status-badge is-emergency">
                  🚨 {isMr ? '२४x७ आणीबाणी' : '24x7'}
                </span>
              )}
              {hasCashless && (
                <span className="health-status-badge is-cashless">
                  🛡️ {isMr ? 'आयुष्मान' : 'PMJAY'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card-body">
        {/* Ward & Area */}
        <div className="admin-card-meta-row">
          {wardNo && <span className="ward-pill-badge">{wardNo}</span>}
          {h.ward?.name && <span className="admin-card-ward-name">🏛️ {h.ward.name}</span>}
          {h.area?.name && <span className="admin-card-area-name">📍 {h.area.name}</span>}
        </div>

        {/* Address & Landmark */}
        <div className="admin-card-address">
          <MapPinIcon size={13} className="admin-addr-ico" />
          <span>{h.address || '—'}{h.landmark ? ` (${isMr ? 'जवळ' : 'near'}: ${h.landmark})` : ''}</span>
        </div>

        {/* Phone & Emergency */}
        <div className="admin-card-contacts">
          {h.phone && (
            <div className="admin-contact-item">
              <PhoneIcon size={12} />
              <a href={`tel:${h.phone}`} className="admin-contact-link">{h.phone}</a>
            </div>
          )}
          {h.emergencyPhone && (
            <div className="admin-contact-item emergency">
              <HeartIcon size={12} />
              <a href={`tel:${h.emergencyPhone}`} className="admin-emergency-link">
                {isMr ? 'आणीबाणी:' : 'Emergency:'} {h.emergencyPhone}
              </a>
            </div>
          )}
        </div>

        {/* Timings */}
        {h.openingHours && (
          <div className="admin-card-timings">
            <ClockIcon size={12} />
            <span>{translateHours(h.openingHours, isMr)}</span>
          </div>
        )}

        {/* Facilities tags */}
        {facilitiesList.length > 0 && (
          <div className="admin-facilities-preview">
            {facilitiesList.slice(0, 3).map((f, i) => (
              <span key={i} className="facility-pill">{f}</span>
            ))}
            {facilitiesList.length > 3 && (
              <span className="facility-pill more">+{facilitiesList.length - 3}</span>
            )}
          </div>
        )}

        {/* GPS Coordinates Pill */}
        <div className="admin-card-location-status">
          {pinned ? (
            <div className="admin-loc-pill pinned" title={`Lat: ${h.latitude}, Lng: ${h.longitude}`}>
              <CheckIcon size={12} />
              <span>{isMr ? 'स्थान पिन केले आहे' : 'Location Pinned'}</span>
              <small>({Number(h.latitude).toFixed(4)}, {Number(h.longitude).toFixed(4)})</small>
            </div>
          ) : (
            <div className="admin-loc-pill unpinned">
              <MapPinIcon size={12} />
              <span>{isMr ? 'स्थान पिन केलेले नाही' : 'No GPS Location Pinned'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="admin-card-actions">
        {pinned && (
          <a
            href={directionsUrl(h.latitude, h.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-act-btn is-dir"
            title={isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View directions in Google Maps'}
          >
            <MapPinIcon size={13} />
            <span>{isMr ? 'दिशा पहा' : 'Directions'}</span>
          </a>
        )}

        {canEdit && (
          <button
            type="button"
            className={`admin-act-btn is-update-loc ${pinned ? 'has-pin' : 'no-pin'}`}
            onClick={() => onUpdateLocation(h)}
            title={isMr ? 'स्थान पिन अपडेट करा' : 'Update GPS Location'}
          >
            <MapPinIcon size={13} />
            <span>{pinned ? (isMr ? 'स्थान अपडेट करा' : 'Update Location') : (isMr ? 'स्थान सेट करा' : 'Set Location')}</span>
          </button>
        )}

        <button
          type="button"
          className="admin-act-btn is-view"
          onClick={() => onView(h)}
          title={isMr ? 'तपशील पहा' : 'View Details'}
        >
          <EyeIcon size={13} />
          <span>{isMr ? 'पहा' : 'View'}</span>
        </button>

        {canEdit && (
          <button
            type="button"
            className="admin-act-btn is-edit"
            onClick={() => onEdit(h)}
            title={isMr ? 'संपादित करा' : 'Edit'}
          >
            <EditIcon size={13} />
            <span>{isMr ? 'संपादित' : 'Edit'}</span>
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            className="admin-act-btn is-delete"
            onClick={() => onDelete(h)}
            title={isMr ? 'हटवा' : 'Delete'}
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function AdminMedicalCard({ m, isMr, canEdit, canDelete, onView, onEdit, onDelete, onUpdateLocation }) {
  const pinned = hasCoords(m.latitude, m.longitude);
  const displayName = translateMedicalName(m.name, isMr);
  const displayHours = translateHours(m.openingHours, isMr);
  const facilitiesList = parseFacilitiesList(m.facilities);
  const wardNo = formatWardNumber(m.ward?.wardNumber);
  const initials = getInitials(m.name, 'MD');

  return (
    <div className={`admin-health-card ${m.status === 'INACTIVE' ? 'is-inactive' : ''}`}>
      <div className="admin-card-head">
        <div className="admin-card-head-left">
          <div className="admin-card-avatar medical" onClick={() => onView(m)} style={{ cursor: 'pointer' }} title={isMr ? 'तपशील पहा' : 'View details'}>
            {initials}
          </div>
          <div className="admin-card-titles">
            <h4 className="admin-card-name" onClick={() => onView(m)}>
              {displayName}
            </h4>
            <div className="admin-card-type-row">
              <span className={`health-type-chip type-${String(m.type || '').toLowerCase()}`}>
                {medicalTypeLabel(m.type, isMr)}
              </span>
              <span className={`team-badge ${m.status === 'INACTIVE' ? 'gray' : 'green'}`}>
                {m.status === 'INACTIVE' ? (isMr ? 'निष्क्रिय' : 'Inactive') : (isMr ? 'सक्रिय' : 'Active')}
              </span>
              {m.is24x7 && (
                <span className="health-status-badge is-open24">
                  🕒 24x7
                </span>
              )}
              {m.homeDelivery && (
                <span className="health-status-badge is-delivery">
                  🛵 {isMr ? 'डिलिव्हरी' : 'Delivery'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card-body">
        {/* Ward & Area */}
        <div className="admin-card-meta-row">
          {wardNo && <span className="ward-pill-badge">{wardNo}</span>}
          {m.ward?.name && <span className="admin-card-ward-name">🏛️ {m.ward.name}</span>}
          {m.area?.name && <span className="admin-card-area-name">📍 {m.area.name}</span>}
        </div>

        {/* Address & Landmark */}
        <div className="admin-card-address">
          <MapPinIcon size={13} className="admin-addr-ico" />
          <span>{m.address || '—'}{m.landmark ? ` (${isMr ? 'जवळ' : 'near'}: ${m.landmark})` : ''}</span>
        </div>

        {/* Phone */}
        {m.phone && (
          <div className="admin-card-contacts">
            <div className="admin-contact-item">
              <PhoneIcon size={12} />
              <a href={`tel:${m.phone}`} className="admin-contact-link">{m.phone}</a>
            </div>
          </div>
        )}

        {/* Timings */}
        {m.openingHours && (
          <div className="admin-card-timings">
            <ClockIcon size={12} />
            <span>{displayHours}</span>
          </div>
        )}

        {/* Facilities tags */}
        {facilitiesList.length > 0 && (
          <div className="admin-facilities-preview">
            {facilitiesList.slice(0, 3).map((f, i) => (
              <span key={i} className="facility-pill">{f}</span>
            ))}
            {facilitiesList.length > 3 && (
              <span className="facility-pill more">+{facilitiesList.length - 3}</span>
            )}
          </div>
        )}

        {/* GPS Coordinates Pill */}
        <div className="admin-card-location-status">
          {pinned ? (
            <div className="admin-loc-pill pinned" title={`Lat: ${m.latitude}, Lng: ${m.longitude}`}>
              <CheckIcon size={12} />
              <span>{isMr ? 'स्थान पिन केले आहे' : 'Location Pinned'}</span>
              <small>({Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)})</small>
            </div>
          ) : (
            <div className="admin-loc-pill unpinned">
              <MapPinIcon size={12} />
              <span>{isMr ? 'स्थान पिन केलेले नाही' : 'No GPS Location Pinned'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="admin-card-actions">
        {pinned && (
          <a
            href={directionsUrl(m.latitude, m.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-act-btn is-dir"
            title={isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View directions in Google Maps'}
          >
            <MapPinIcon size={13} />
            <span>{isMr ? 'दिशा पहा' : 'Directions'}</span>
          </a>
        )}

        {canEdit && (
          <button
            type="button"
            className={`admin-act-btn is-update-loc ${pinned ? 'has-pin' : 'no-pin'}`}
            onClick={() => onUpdateLocation(m)}
            title={isMr ? 'स्थान पिन अपडेट करा' : 'Update GPS Location'}
          >
            <MapPinIcon size={13} />
            <span>{pinned ? (isMr ? 'स्थान अपडेट करा' : 'Update Location') : (isMr ? 'स्थान सेट करा' : 'Set Location')}</span>
          </button>
        )}

        <button
          type="button"
          className="admin-act-btn is-view"
          onClick={() => onView(m)}
          title={isMr ? 'तपशील पहा' : 'View Details'}
        >
          <EyeIcon size={13} />
          <span>{isMr ? 'पहा' : 'View'}</span>
        </button>

        {canEdit && (
          <button
            type="button"
            className="admin-act-btn is-edit"
            onClick={() => onEdit(m)}
            title={isMr ? 'संपादित करा' : 'Edit'}
          >
            <EditIcon size={13} />
            <span>{isMr ? 'संपादित' : 'Edit'}</span>
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            className="admin-act-btn is-delete"
            onClick={() => onDelete(m)}
            title={isMr ? 'हटवा' : 'Delete'}
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Hospitals({ defaultTab = '' }) {
  const user = getUser();
  const isMr = getLanguage() === 'mr';
  const isCitizen = user?.role === 'CITIZEN' || user?.Role?.name === 'CITIZEN';
  const canEditAny = isMaster() || isNagarsevak() || isEmployee() || can('EDIT_HOSPITALS') || can('CREATE_HOSPITALS') || can('EDIT_MEDICALS') || can('CREATE_MEDICALS');
  const canDeleteAny = isMaster() || isNagarsevak() || isEmployee() || can('DELETE_HOSPITALS') || can('DELETE_MEDICALS');

  // Active tab: 'hospitals' | 'medicals'
  const initialTab = useMemo(() => {
    if (defaultTab === 'medicals') return 'medicals';
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'medicals') return 'medicals';
    }
    return 'hospitals';
  }, [defaultTab]);

  const [activeTab, setActiveTab] = useState(initialTab);

  function switchTab(tab) {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  }

  // Common Ward Filter
  const { wards, selectedWardId, wardLocked } = useWardFilter();

  // Admin View Mode: default to 'cards' as requested
  const [adminViewMode, setAdminViewMode] = useState('cards'); // 'cards' | 'table'

  // Citizen Ward Scope: 'my-ward' vs 'all-city'
  const [citizenWardScope, setCitizenWardScope] = useState('my-ward');

  // Dedicated Location Update Modal
  const [locationEditModal, setLocationEditModal] = useState(null); // { item, type, latitude, longitude, name, address, landmark, ward, area }
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState('');

  function openLocationModal(item, type) {
    setLocationSuccess('');
    setLocationEditModal({
      item,
      type,
      latitude: item.latitude || '',
      longitude: item.longitude || '',
      name: item.name,
      address: item.address,
      landmark: item.landmark,
      ward: item.ward,
      area: item.area
    });
  }

  async function saveQuickLocation() {
    if (!locationEditModal) return;
    setLocationSaving(true);
    setLocationSuccess('');
    try {
      const { item, type, latitude, longitude } = locationEditModal;
      const cleanLat = latitude ? Number(latitude) : null;
      const cleanLng = longitude ? Number(longitude) : null;
      if (type === 'hospital') {
        await api.updateHospital(item.id, { latitude: cleanLat, longitude: cleanLng });
        await loadHospitals();
      } else {
        await api.updateMedical(item.id, { latitude: cleanLat, longitude: cleanLng });
        await loadMedicals();
      }
      setLocationSuccess(isMr ? 'स्थान यशस्वीरित्या सेव्ह केले!' : 'Location updated successfully!');
      setTimeout(() => {
        setLocationEditModal(null);
        setLocationSuccess('');
      }, 700);
    } catch (err) {
      alert(err.message || 'Failed to update location');
    } finally {
      setLocationSaving(false);
    }
  }

  function clearQuickLocation() {
    if (!locationEditModal) return;
    setLocationEditModal(prev => ({ ...prev, latitude: '', longitude: '' }));
  }

  // ----------------------------------------------------
  // HOSPITALS STATE
  // ----------------------------------------------------
  const [hospRows, setHospRows] = useState(null);
  const [hospTotal, setHospTotal] = useState(0);
  const [hospLoading, setHospLoading] = useState(false);
  const [hospError, setHospError] = useState('');
  const [hospPage, setHospPage] = useState(1);
  const hospPageSize = 12;
  const [hospSearch, setHospSearch] = useState('');
  const [hospFilters, setHospFilters] = useState({
    search: '',
    type: '',
    status: '',
    areaId: ''
  });
  const [hospKpis, setHospKpis] = useState({ total: 0, government: 0, private: 0, clinic: 0, mapped: 0 });
  const [hospEdit, setHospEdit] = useState(null);
  const [hospDetail, setHospDetail] = useState(null);
  const [hospForm, setHospForm] = useState(hospitalBlank);
  const [hospBusy, setHospBusy] = useState(false);

  // ----------------------------------------------------
  // MEDICALS STATE
  // ----------------------------------------------------
  const [medRows, setMedRows] = useState(null);
  const [medTotal, setMedTotal] = useState(0);
  const [medLoading, setMedLoading] = useState(false);
  const [medError, setMedError] = useState('');
  const [medPage, setMedPage] = useState(1);
  const medPageSize = 12;
  const [medSearch, setMedSearch] = useState('');
  const [medFilters, setMedFilters] = useState({
    search: '',
    type: '',
    status: '',
    areaId: '',
    is24x7: false,
    homeDelivery: false
  });
  const [medKpis, setMedKpis] = useState({ total: 0, is24x7: 0, homeDelivery: 0, mapped: 0 });
  const [medEdit, setMedEdit] = useState(null);
  const [medDetail, setMedDetail] = useState(null);
  const [medForm, setMedForm] = useState(medicalBlank);
  const [medBusy, setMedBusy] = useState(false);

  // Load Hospitals
  async function loadHospitals() {
    setHospLoading(true);
    setHospError('');
    try {
      const effectiveWardId = isCitizen
        ? (citizenWardScope === 'all-city' ? '' : (selectedWardId || user?.wardId || ''))
        : selectedWardId;

      const params = {
        page: hospPage,
        limit: hospPageSize,
        ...(effectiveWardId ? { wardId: effectiveWardId } : {}),
        ...(hospFilters.areaId ? { areaId: hospFilters.areaId } : {}),
        ...(hospFilters.type ? { type: hospFilters.type } : {}),
        ...(hospFilters.status ? { status: hospFilters.status } : {}),
        ...(hospFilters.search ? { search: hospFilters.search } : {})
      };
      const res = await api.hospitals(params);
      const data = res?.data || res?.items || [];
      setHospRows(data);
      const meta = res?.meta || {};
      setHospTotal(meta.total ?? data.length);
      if (meta.kpis) setHospKpis(meta.kpis);
    } catch (err) {
      setHospError(err.message || (isMr ? 'हॉस्पिटल लोड करण्यात अडचण आली' : 'Failed to load hospitals'));
      setHospRows([]);
    } finally {
      setHospLoading(false);
    }
  }

  // Load Medicals
  async function loadMedicals() {
    setMedLoading(true);
    setMedError('');
    try {
      const effectiveWardId = isCitizen
        ? (citizenWardScope === 'all-city' ? '' : (selectedWardId || user?.wardId || ''))
        : selectedWardId;

      const params = {
        page: medPage,
        limit: medPageSize,
        ...(effectiveWardId ? { wardId: effectiveWardId } : {}),
        ...(medFilters.areaId ? { areaId: medFilters.areaId } : {}),
        ...(medFilters.type ? { type: medFilters.type } : {}),
        ...(medFilters.status ? { status: medFilters.status } : {}),
        ...(medFilters.is24x7 ? { is24x7: '1' } : {}),
        ...(medFilters.homeDelivery ? { homeDelivery: '1' } : {}),
        ...(medFilters.search ? { search: medFilters.search } : {})
      };
      const res = await api.medicals(params);
      const data = res?.data || res?.items || [];
      setMedRows(data);
      const meta = res?.meta || {};
      setMedTotal(meta.total ?? data.length);
      if (meta.kpis) setMedKpis(meta.kpis);
    } catch (err) {
      setMedError(err.message || (isMr ? 'औषधांची दुकाने लोड करण्यात अडचण आली' : 'Failed to load medical stores'));
      setMedRows([]);
    } finally {
      setMedLoading(false);
    }
  }

  // Debounce hospital search
  useEffect(() => {
    const t = setTimeout(() => {
      setHospFilters(f => ({ ...f, search: hospSearch.trim() }));
      setHospPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [hospSearch]);

  // Debounce medical search
  useEffect(() => {
    const t = setTimeout(() => {
      setMedFilters(f => ({ ...f, search: medSearch.trim() }));
      setMedPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [medSearch]);

  // Load when filters change
  useEffect(() => {
    loadHospitals();
  }, [selectedWardId, citizenWardScope, hospPage, hospFilters.areaId, hospFilters.type, hospFilters.status, hospFilters.search]);

  useEffect(() => {
    loadMedicals();
  }, [selectedWardId, citizenWardScope, medPage, medFilters.areaId, medFilters.type, medFilters.status, medFilters.is24x7, medFilters.homeDelivery, medFilters.search]);

  // Hospital CRUD
  function openAddHospital() {
    setHospForm({
      ...hospitalBlank,
      wardId: selectedWardId || user?.wardId || (wards[0]?.id || '')
    });
    setHospEdit('create');
  }

  function openEditHospital(h) {
    setHospForm({
      ...hospitalBlank,
      ...h,
      wardId: h.wardId || h.ward?.id || '',
      areaId: h.areaId || h.area?.id || '',
      latitude: h.latitude || '',
      longitude: h.longitude || ''
    });
    setHospEdit(h);
  }

  async function saveHospital(e) {
    e.preventDefault();
    setHospBusy(true);
    setHospError('');
    try {
      const payload = { ...hospForm, wardId: hospForm.wardId || selectedWardId };
      if (hospEdit === 'create') await api.createHospital(payload);
      else await api.updateHospital(hospEdit.id, payload);
      setHospEdit(null);
      await loadHospitals();
    } catch (err) {
      setHospError(err.message);
    } finally {
      setHospBusy(false);
    }
  }

  async function removeHospital(h) {
    if (!window.confirm(isMr ? 'हे हॉस्पिटल काढायचे आहे का?' : 'Move this hospital to recycle bin?')) return;
    try {
      await api.deleteHospital(h.id);
      await loadHospitals();
    } catch (err) {
      setHospError(err.message);
    }
  }

  // Medical CRUD (Note: emergencyPhone completely omitted!)
  function openAddMedical() {
    setMedForm({
      ...medicalBlank,
      wardId: selectedWardId || user?.wardId || (wards[0]?.id || '')
    });
    setMedEdit('create');
  }

  function openEditMedical(m) {
    setMedForm({
      ...medicalBlank,
      ...m,
      wardId: m.wardId || m.ward?.id || '',
      areaId: m.areaId || m.area?.id || '',
      is24x7: Boolean(m.is24x7),
      homeDelivery: Boolean(m.homeDelivery),
      latitude: m.latitude || '',
      longitude: m.longitude || ''
    });
    setMedEdit(m);
  }

  async function saveMedical(e) {
    e.preventDefault();
    setMedBusy(true);
    setMedError('');
    try {
      const payload = {
        name: medForm.name,
        type: medForm.type,
        wardId: medForm.wardId || selectedWardId,
        areaId: medForm.areaId || null,
        address: medForm.address,
        landmark: medForm.landmark,
        phone: medForm.phone,
        openingHours: medForm.openingHours,
        is24x7: medForm.is24x7,
        homeDelivery: medForm.homeDelivery,
        facilities: medForm.facilities,
        notes: medForm.notes,
        status: medForm.status,
        latitude: medForm.latitude || null,
        longitude: medForm.longitude || null
      };
      if (medEdit === 'create') await api.createMedical(payload);
      else await api.updateMedical(medEdit.id, payload);
      setMedEdit(null);
      await loadMedicals();
    } catch (err) {
      setMedError(err.message);
    } finally {
      setMedBusy(false);
    }
  }

  async function removeMedical(m) {
    if (!window.confirm(isMr ? 'हे मेडिकल स्टोअर काढायचे आहे का?' : 'Move this medical store to recycle bin?')) return;
    try {
      await api.deleteMedical(m.id);
      await loadMedicals();
    } catch (err) {
      setMedError(err.message);
    }
  }

  // Areas for selected ward in forms
  const hospFormWard = (wards || []).find(w => String(w.id) === String(hospForm.wardId || selectedWardId));
  const hospFormAreas = (hospFormWard?.areas || []).map(a => ({ value: a.id, label: a.name }));
  const hospSelectedArea = (hospFormWard?.areas || []).find(a => String(a.id) === String(hospForm.areaId));

  const medFormWard = (wards || []).find(w => String(w.id) === String(medForm.wardId || selectedWardId));
  const medFormAreas = (medFormWard?.areas || []).map(a => ({ value: a.id, label: a.name }));
  const medSelectedArea = (medFormWard?.areas || []).find(a => String(a.id) === String(medForm.areaId));

  // Area options for filter bar
  const filterAreas = useMemo(() => {
    const currentWard = selectedWardId ? (wards || []).find(w => String(w.id) === String(selectedWardId)) : null;
    if (currentWard) {
      return (currentWard.areas || []).map(a => ({ value: a.id, label: a.name }));
    }
    return (wards || []).flatMap(w => (w.areas || []).map(a => ({ value: a.id, label: `${a.name} (${formatWardNumber(w.wardNumber)})` })));
  }, [wards, selectedWardId]);

  // ====================================================================
  // CITIZEN VIEW
  // ====================================================================
  if (isCitizen) {
    return (
      <div className="civic-dir-shell user-hospitals-page">
        <PageHeader
          kicker={isMr ? 'प्रभाग आरोग्य डिरेक्टरी' : 'Ward Health Directory'}
          title={isMr ? 'रुग्णालये व औषधांची दुकाने' : 'Hospitals & Medical Stores'}
          subtitle={
            isMr
              ? 'तुमच्या वॉर्डमधील शासकीय व खाजगी रुग्णालये, क्लिनिक आणि २४ तास औषधांची दुकाने.'
              : 'Direct access to municipal hospitals, emergency care, clinics, and 24x7 pharmacies in your ward.'
          }
        />

        {/* Emergency Medical Hotlines Quick-Bar */}
        <div className="civic-health-emergency-bar">
          <div className="emergency-bar-left">
            <div className="emergency-alert-pulse">🚨</div>
            <div className="emergency-alert-copy">
              <strong>{isMr ? 'तातडीची वैद्यकीय मदत व रुग्णवाहिका' : 'Emergency Medical Helplines & Ambulance'}</strong>
              <span>{isMr ? 'आपत्कालीन वेळी २४ तास एका क्लिकवर थेट संपर्क करा' : '24x7 immediate access to emergency medical care in your ward'}</span>
            </div>
          </div>
          <div className="emergency-bar-actions">
            <a href="tel:108" className="emergency-hotline-btn ambulance" title={isMr ? 'आपत्कालीन रुग्णवाहिका' : 'National Emergency Ambulance'}>
              <span className="hotline-icon">🚑</span>
              <span className="hotline-details">
                <small>{isMr ? 'रुग्णवाहिका' : 'Ambulance'}</small>
                <strong>108</strong>
              </span>
            </a>
            <a href="tel:102" className="emergency-hotline-btn maternal" title={isMr ? 'प्रसूती व बाल आरोग्य' : 'Free Maternal & Infant Ambulance'}>
              <span className="hotline-icon">🏥</span>
              <span className="hotline-details">
                <small>{isMr ? 'प्रसूती मदत' : 'Maternal'}</small>
                <strong>102</strong>
              </span>
            </a>
            <a href="tel:104" className="emergency-hotline-btn advisory" title={isMr ? 'आरोग्य सल्ला व मार्गदर्शन' : 'Maharashtra State Health Advice'}>
              <span className="hotline-icon">📞</span>
              <span className="hotline-details">
                <small>{isMr ? 'आरोग्य सल्ला' : 'Health Advice'}</small>
                <strong>104</strong>
              </span>
            </a>
          </div>
        </div>

        {/* Citizen Ward Scope Filter: My Ward vs All City Wards */}
        <div className="citizen-health-scope-bar">
          <div className="scope-bar-left">
            <span className="scope-kicker">{isMr ? 'आरोग्य केंद्रे पहा:' : 'Show Facilities In:'}</span>
            <div className="scope-toggle-group">
              <button
                type="button"
                className={`scope-toggle-btn ${citizenWardScope === 'my-ward' ? 'active' : ''}`}
                onClick={() => { setCitizenWardScope('my-ward'); setHospPage(1); setMedPage(1); }}
              >
                <span>📍</span>
                <span>{isMr ? `माझा प्रभाग (${formatWardNumber(user?.ward?.wardNumber) || 'वॉर्ड'})` : `My Ward (${formatWardNumber(user?.ward?.wardNumber) || 'Ward'})`}</span>
              </button>
              <button
                type="button"
                className={`scope-toggle-btn ${citizenWardScope === 'all-city' ? 'active' : ''}`}
                onClick={() => { setCitizenWardScope('all-city'); setHospPage(1); setMedPage(1); }}
              >
                <span>🏙️</span>
                <span>{isMr ? 'संपूर्ण शहर (सर्व वॉर्ड)' : 'Entire City (All Wards)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Modern Health Directory Segmented Control */}
        <div className="civic-health-tabs">
          <button
            type="button"
            className={`health-tab-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
            onClick={() => switchTab('hospitals')}
          >
            <div className="health-tab-icon hospitals">
              <HeartIcon size={18} />
            </div>
            <div className="health-tab-labels">
              <span className="tab-primary-title">{isMr ? 'रुग्णालये व दवाखाने' : 'Hospitals & Clinics'}</span>
              <span className="tab-sub-title">{isMr ? 'शासकीय, खासगी व ट्रस्ट रुग्णालये' : 'Govt, Private & Trust Centers'}</span>
            </div>
            <span className="health-tab-count-badge">
              {hospTotal}
            </span>
          </button>

          <button
            type="button"
            className={`health-tab-btn ${activeTab === 'medicals' ? 'active' : ''}`}
            onClick={() => switchTab('medicals')}
          >
            <div className="health-tab-icon medicals">
              <MedicalIcon size={18} />
            </div>
            <div className="health-tab-labels">
              <span className="tab-primary-title">{isMr ? 'औषधांची दुकाने व केमिस्ट' : 'Medical Stores & Pharmacies'}</span>
              <span className="tab-sub-title">{isMr ? '२४x७ व जनऔषधी केमिस्ट' : '24x7 Chemists & Jan Aushadhi'}</span>
            </div>
            <span className="health-tab-count-badge">
              {medTotal}
            </span>
          </button>
        </div>

        {/* ---------------- HOSPITALS TAB ---------------- */}
        {activeTab === 'hospitals' && (
          <>
            <ErrorBox error={hospError} />
            <div className="civic-metric-grid civic-metric-3">
              <article
                className={`civic-metric ${!hospFilters.type ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setHospFilters(f => ({ ...f, type: '' })); setHospPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{hospRows === null ? '…' : hospKpis.total}</strong>
                  <span>{isMr ? 'एकूण आरोग्य केंद्रे' : 'Total Facilities'}</span>
                </div>
                <div className="civic-metric-ico is-blue"><HeartIcon size={18} /></div>
              </article>
              <article
                className={`civic-metric ${hospFilters.type === 'GOVERNMENT' ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'GOVERNMENT' ? '' : 'GOVERNMENT' })); setHospPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{hospRows === null ? '…' : hospKpis.government}</strong>
                  <span>{isMr ? 'शासकीय / PHC' : 'Government / PHC'}</span>
                </div>
                <div className="civic-metric-ico is-green"><BuildingIcon size={18} /></div>
              </article>
              <article
                className={`civic-metric ${hospFilters.type === 'PRIVATE' ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'PRIVATE' ? '' : 'PRIVATE' })); setHospPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{hospRows === null ? '…' : hospKpis.private}</strong>
                  <span>{isMr ? 'खासगी रुग्णालये' : 'Private Hospitals'}</span>
                </div>
                <div className="civic-metric-ico is-amber"><HeartIcon size={18} /></div>
              </article>
            </div>

            {/* Quick Category Filter Chips */}
            <div className="health-quick-filters">
              <button
                type="button"
                className={`health-filter-chip ${!hospFilters.type ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: '' })); setHospPage(1); }}
              >
                {isMr ? 'सर्व आरोग्य केंद्रे' : 'All Facilities'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${hospFilters.type === 'GOVERNMENT' ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'GOVERNMENT' ? '' : 'GOVERNMENT' })); setHospPage(1); }}
              >
                🏛️ {isMr ? 'शासकीय रुग्णालये' : 'Government Hospitals'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${hospFilters.type === 'PHC' ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'PHC' ? '' : 'PHC' })); setHospPage(1); }}
              >
                🏥 {isMr ? 'प्राथमिक आरोग्य केंद्र (PHC)' : 'Urban PHC / Clinics'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${hospFilters.type === 'PRIVATE' ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'PRIVATE' ? '' : 'PRIVATE' })); setHospPage(1); }}
              >
                🩺 {isMr ? 'खासगी मल्टिस्पेशालिटी' : 'Private Multispeciality'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${hospFilters.type === 'TRUST' ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'TRUST' ? '' : 'TRUST' })); setHospPage(1); }}
              >
                🤝 {isMr ? 'ट्रस्ट / सेवाभावी' : 'Trust / Charitable'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${hospFilters.type === 'CLINIC' ? 'active' : ''}`}
                onClick={() => { setHospFilters(f => ({ ...f, type: f.type === 'CLINIC' ? '' : 'CLINIC' })); setHospPage(1); }}
              >
                ⚕️ {isMr ? 'क्लिनिक व दवाखाने' : 'Clinics & Dispensaries'}
              </button>
            </div>

            <div className="civic-dir-toolbar">
              <div className="civic-dir-search">
                <SearchIcon size={16} />
                <input
                  value={hospSearch}
                  onChange={e => setHospSearch(e.target.value)}
                  placeholder={isMr ? 'हॉस्पिटलचे नाव, पत्ता, किंवा फोन शोधा…' : 'Search hospitals, address, phone…'}
                />
              </div>
              <select
                className="civic-dir-select"
                value={hospFilters.type}
                onChange={e => { setHospFilters(f => ({ ...f, type: e.target.value })); setHospPage(1); }}
              >
                <option value="">{isMr ? 'सर्व प्रकार' : 'All types'}</option>
                {HOSPITAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                ))}
              </select>
              {(hospSearch || hospFilters.type) && (
                <button
                  type="button"
                  className="civic-dir-reset"
                  onClick={() => { setHospSearch(''); setHospFilters(f => ({ ...f, search: '', type: '' })); setHospPage(1); }}
                >
                  {isMr ? 'रीसेट' : 'Reset'}
                </button>
              )}
            </div>

            {hospRows === null || hospLoading ? (
              <Loading />
            ) : !hospRows.length ? (
              <Empty>{isMr ? 'कोणतेही रुग्णालय सापडले नाही.' : 'No hospitals found in this ward.'}</Empty>
            ) : (
              <>
                <div className="civic-hospital-grid hospital-card-grid">
                  {hospRows.map(h => (
                    <HospitalCard key={h.id} h={h} isMr={isMr} onOpen={setHospDetail} />
                  ))}
                </div>
                {hospTotal > hospPageSize && (
                  <PaginationBar
                    page={hospPage}
                    pages={Math.max(1, Math.ceil(hospTotal / hospPageSize))}
                    total={hospTotal}
                    onChange={p => setHospPage(p)}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ---------------- MEDICALS TAB ---------------- */}
        {activeTab === 'medicals' && (
          <>
            <ErrorBox error={medError} />
            <div className="civic-metric-grid civic-metric-3">
              <article
                className={`civic-metric ${!medFilters.type && !medFilters.is24x7 && !medFilters.homeDelivery ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setMedFilters({ search: '', type: '', status: '', areaId: '', is24x7: false, homeDelivery: false }); setMedPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{medRows === null ? '…' : medKpis.total}</strong>
                  <span>{isMr ? 'एकूण औषधांची दुकाने' : 'Total Medical Stores'}</span>
                </div>
                <div className="civic-metric-ico is-green"><MedicalIcon size={18} /></div>
              </article>
              <article
                className={`civic-metric ${medFilters.is24x7 ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setMedFilters(f => ({ ...f, is24x7: !f.is24x7 })); setMedPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{medRows === null ? '…' : medKpis.is24x7}</strong>
                  <span>{isMr ? '२४x७ सुरू' : '24x7 Open Pharmacies'}</span>
                </div>
                <div className="civic-metric-ico is-blue"><ClockIcon size={18} /></div>
              </article>
              <article
                className={`civic-metric ${medFilters.homeDelivery ? 'active-metric' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => { setMedFilters(f => ({ ...f, homeDelivery: !f.homeDelivery })); setMedPage(1); }}
              >
                <div className="civic-metric-copy">
                  <strong>{medRows === null ? '…' : medKpis.homeDelivery}</strong>
                  <span>{isMr ? 'होम डिलिव्हरी उपलब्ध' : 'Home Delivery Available'}</span>
                </div>
                <div className="civic-metric-ico is-amber"><CheckIcon size={18} /></div>
              </article>
            </div>

            {/* Quick Category Filter Chips */}
            <div className="health-quick-filters">
              <button
                type="button"
                className={`health-filter-chip ${!medFilters.type && !medFilters.is24x7 && !medFilters.homeDelivery ? 'active' : ''}`}
                onClick={() => { setMedFilters({ search: '', type: '', status: '', areaId: '', is24x7: false, homeDelivery: false }); setMedPage(1); }}
              >
                {isMr ? 'सर्व दुकाने' : 'All Medical Stores'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${medFilters.is24x7 ? 'active' : ''}`}
                onClick={() => { setMedFilters(f => ({ ...f, is24x7: !f.is24x7 })); setMedPage(1); }}
              >
                🕒 {isMr ? '२४ तास सुरू (24x7)' : '24x7 Open'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${medFilters.homeDelivery ? 'active' : ''}`}
                onClick={() => { setMedFilters(f => ({ ...f, homeDelivery: !f.homeDelivery })); setMedPage(1); }}
              >
                🛵 {isMr ? 'होम डिलिव्हरी' : 'Home Delivery'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${medFilters.type === 'GENERIC' ? 'active' : ''}`}
                onClick={() => { setMedFilters(f => ({ ...f, type: f.type === 'GENERIC' ? '' : 'GENERIC' })); setMedPage(1); }}
              >
                💊 {isMr ? 'जनऔषधी / जेनेरिक' : 'Jan Aushadhi (Generic)'}
              </button>
              <button
                type="button"
                className={`health-filter-chip ${medFilters.type === 'AYURVEDIC' ? 'active' : ''}`}
                onClick={() => { setMedFilters(f => ({ ...f, type: f.type === 'AYURVEDIC' ? '' : 'AYURVEDIC' })); setMedPage(1); }}
              >
                🌿 {isMr ? 'आयुर्वेदिक' : 'Ayurvedic'}
              </button>
            </div>

            <div className="civic-dir-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div className="civic-dir-search" style={{ minWidth: '220px', flex: '1 1 220px' }}>
                <SearchIcon size={16} />
                <input
                  value={medSearch}
                  onChange={e => setMedSearch(e.target.value)}
                  placeholder={isMr ? 'मेडिकलचे नाव, पत्ता किंवा फोन शोधा…' : 'Search medical store, address, phone…'}
                />
              </div>
              <select
                className="civic-dir-select"
                value={medFilters.type}
                onChange={e => { setMedFilters(f => ({ ...f, type: e.target.value })); setMedPage(1); }}
              >
                <option value="">{isMr ? 'सर्व औषध प्रकार' : 'All store types'}</option>
                {MEDICAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                ))}
              </select>

              {(medSearch || medFilters.type || medFilters.is24x7 || medFilters.homeDelivery) && (
                <button
                  type="button"
                  className="civic-dir-reset"
                  onClick={() => { setMedSearch(''); setMedFilters({ search: '', type: '', status: '', areaId: '', is24x7: false, homeDelivery: false }); setMedPage(1); }}
                >
                  {isMr ? 'रीसेट' : 'Reset'}
                </button>
              )}
            </div>

            {medRows === null || medLoading ? (
              <Loading />
            ) : !medRows.length ? (
              <Empty>{isMr ? 'कोणतेही मेडिकल स्टोअर सापडले नाही.' : 'No medical stores found in this ward.'}</Empty>
            ) : (
              <>
                <div className="civic-hospital-grid hospital-card-grid">
                  {medRows.map(m => (
                    <MedicalCard key={m.id} m={m} isMr={isMr} onOpen={setMedDetail} />
                  ))}
                </div>
                {medTotal > medPageSize && (
                  <PaginationBar
                    page={medPage}
                    pages={Math.max(1, Math.ceil(medTotal / medPageSize))}
                    total={medTotal}
                    onChange={p => setMedPage(p)}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Modal: Hospital Details View */}
        {hospDetail && (
          <Modal title={hospDetail.name} onClose={() => setHospDetail(null)}>
            <div className="exec-detail-body health-detail-modal">
              <div className="detail-modal-header-badge">
                <span className={`health-type-chip type-${String(hospDetail.type || '').toLowerCase()}`}>
                  {hospitalTypeLabel(hospDetail.type, isMr)}
                </span>
                {isHospital24x7(hospDetail) && (
                  <span className="health-status-badge is-emergency">🚨 {isMr ? '२४x७ आणीबाणी सेवा' : '24x7 Emergency Care'}</span>
                )}
                {hasCashlessScheme(hospDetail) && (
                  <span className="health-status-badge is-cashless">🛡️ {isMr ? 'आयुष्मान / MJPJAY कॅशलेस' : 'Ayushman / MJPJAY Cashless'}</span>
                )}
              </div>

              <div className="detail-modal-section">
                <h4>📍 {isMr ? 'पत्ता आणि स्थान' : 'Address & Location'}</h4>
                <p className="detail-text">{hospDetail.address}</p>
                {hospDetail.landmark && (
                  <p className="detail-subtext"><strong>{isMr ? 'जवळची खूण:' : 'Landmark:'}</strong> {hospDetail.landmark}</p>
                )}
                <p className="detail-subtext">
                  <strong>{isMr ? 'वॉर्ड:' : 'Ward:'}</strong> {formatWardNumber(hospDetail.ward?.wardNumber) || formatWardLabel(hospDetail.ward)}
                  {hospDetail.area?.name ? ` · ${hospDetail.area.name}` : ''}
                </p>
              </div>

              <div className="detail-modal-section">
                <h4>📞 {isMr ? 'संपर्क क्रमांक' : 'Contact Information'}</h4>
                <div className="detail-contacts-grid">
                  {hospDetail.phone && (
                    <div className="contact-box general">
                      <span className="contact-kicker">{isMr ? 'सर्वसाधारण चौकशी / OPD' : 'General Reception & OPD'}</span>
                      <a href={`tel:${hospDetail.phone}`} className="contact-link">{hospDetail.phone}</a>
                    </div>
                  )}
                  {hospDetail.emergencyPhone && (
                    <div className="contact-box emergency">
                      <span className="contact-kicker">{isMr ? 'आणीबाणी कक्ष / ICU' : 'Emergency & Casualty Hotline'}</span>
                      <a href={`tel:${hospDetail.emergencyPhone}`} className="contact-link is-emergency">🚨 {hospDetail.emergencyPhone}</a>
                    </div>
                  )}
                </div>
              </div>

              {hospDetail.openingHours && (
                <div className="detail-modal-section">
                  <h4>🕒 {isMr ? 'कामाची वेळ व सेवा' : 'Timings & Working Hours'}</h4>
                  <p className="detail-text">{translateHours(hospDetail.openingHours, isMr)}</p>
                </div>
              )}

              {hospDetail.facilities && (
                <div className="detail-modal-section">
                  <h4>🏥 {isMr ? 'वैद्यकीय सुविधा व विभाग' : 'Medical Facilities & Specialties'}</h4>
                  <div className="facilities-chips-wrap">
                    {parseFacilitiesList(hospDetail.facilities).map((f, i) => (
                      <span key={i} className="facility-pill">✓ {f}</span>
                    ))}
                  </div>
                </div>
              )}

              {hospDetail.notes && (
                <div className="detail-modal-section">
                  <h4>ℹ️ {isMr ? 'महत्त्वाची नोंद व योजना' : 'Important Civic Information & Schemes'}</h4>
                  <p className="detail-notes-box">{hospDetail.notes}</p>
                </div>
              )}

              {hasCoords(hospDetail.latitude, hospDetail.longitude) && (
                <div className="detail-modal-footer" style={{ marginTop: 16 }}>
                  <a
                    className="health-btn is-call"
                    style={{ background: '#0F766E', borderColor: '#0F766E', display: 'inline-flex', padding: '10px 18px' }}
                    href={directionsUrl(hospDetail.latitude, hospDetail.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPinIcon size={16} />
                    <span>{isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View Directions on Google Maps'}</span>
                  </a>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* Modal: Medical Details View */}
        {medDetail && (
          <Modal title={translateMedicalName(medDetail.name, isMr)} onClose={() => setMedDetail(null)}>
            <div className="exec-detail-body health-detail-modal">
              <div className="detail-modal-header-badge">
                <span className={`health-type-chip type-${String(medDetail.type || '').toLowerCase()}`}>
                  {medicalTypeLabel(medDetail.type, isMr)}
                </span>
                {medDetail.is24x7 && (
                  <span className="health-status-badge is-open24">🕒 {isMr ? '२४ तास सुरू' : '24x7 Open'}</span>
                )}
                {medDetail.homeDelivery && (
                  <span className="health-status-badge is-delivery">🛵 {isMr ? 'होम डिलिव्हरी उपलब्ध' : 'Home Delivery'}</span>
                )}
              </div>

              <div className="detail-modal-section">
                <h4>📍 {isMr ? 'पत्ता आणि स्थान' : 'Address & Location'}</h4>
                <p className="detail-text">{medDetail.address}</p>
                {medDetail.landmark && (
                  <p className="detail-subtext"><strong>{isMr ? 'जवळची खूण:' : 'Landmark:'}</strong> {medDetail.landmark}</p>
                )}
                <p className="detail-subtext">
                  <strong>{isMr ? 'वॉर्ड:' : 'Ward:'}</strong> {formatWardNumber(medDetail.ward?.wardNumber) || formatWardLabel(medDetail.ward)}
                  {medDetail.area?.name ? ` · ${medDetail.area.name}` : ''}
                </p>
              </div>

              <div className="detail-modal-section">
                <h4>📞 {isMr ? 'संपर्क फोन' : 'Contact Phone'}</h4>
                {medDetail.phone ? (
                  <div className="contact-box general">
                    <span className="contact-kicker">{isMr ? 'ऑर्डर व चौकशी' : 'Orders & Inquiries'}</span>
                    <a href={`tel:${medDetail.phone}`} className="contact-link">{medDetail.phone}</a>
                  </div>
                ) : (
                  <p className="detail-text muted">—</p>
                )}
              </div>

              <div className="detail-modal-section">
                <h4>🕒 {isMr ? 'कामाची वेळ' : 'Timings'}</h4>
                <p className="detail-text">{translateHours(medDetail.openingHours, isMr) || (medDetail.is24x7 ? (isMr ? '२४ तास सुरू (24x7)' : '24x7 Open') : (isMr ? 'नियमित वेळ' : 'Standard hours'))}</p>
              </div>

              {medDetail.facilities && (
                <div className="detail-modal-section">
                  <h4>💊 {isMr ? 'सुविधा व औषध प्रकार' : 'Facilities & Services'}</h4>
                  <div className="facilities-chips-wrap">
                    {parseFacilitiesList(medDetail.facilities).map((f, i) => (
                      <span key={i} className="facility-pill">✓ {f}</span>
                    ))}
                  </div>
                </div>
              )}

              {medDetail.notes && (
                <div className="detail-modal-section">
                  <h4>ℹ️ {isMr ? 'विशेष नोंद' : 'Notes'}</h4>
                  <p className="detail-notes-box">{medDetail.notes}</p>
                </div>
              )}

              {hasCoords(medDetail.latitude, medDetail.longitude) && (
                <div className="detail-modal-footer" style={{ marginTop: 16 }}>
                  <a
                    className="health-btn is-call"
                    style={{ background: '#0F766E', borderColor: '#0F766E', display: 'inline-flex', padding: '10px 18px' }}
                    href={directionsUrl(medDetail.latitude, medDetail.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPinIcon size={16} />
                    <span>{isMr ? 'गुगल मॅपवर दिशा पहा' : 'View Directions on Google Maps'}</span>
                  </a>
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ====================================================================
  // ADMIN VIEW
  // ====================================================================
  return (
    <div className="admin-data-page hospitals-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'प्रभाग आरोग्य व्यवस्थापन' : 'Ward Health Management'}
        title={isMr ? 'हॉस्पिटल्स आणि मेडिकल स्टोअर्स' : 'Hospitals & Medical Stores'}
        subtitle={
          isMr
            ? 'वॉर्ड परिसरातील सर्व शासकीय व खाजगी रुग्णालये, क्लिनिक आणि औषधांची दुकाने एकाच ठिकाणी व्यवस्थापित करा.'
            : 'Manage hospitals, clinics, and chemist shops for citizen health services in municipal wards.'
        }
        action={
          canEditAny ? (
            <button
              type="button"
              className="primary-btn"
              onClick={activeTab === 'hospitals' ? openAddHospital : openAddMedical}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>+</span>
              <span>
                {activeTab === 'hospitals'
                  ? (isMr ? 'नवीन रुग्णालय जोडा' : 'Add Hospital')
                  : (isMr ? 'नवीन मेडिकल जोडा' : 'Add Medical Store')}
              </span>
            </button>
          ) : null
        }
      />

      {/* Admin Tab Switcher */}
      <div className="hospitals-tabs-nav" style={{ display: 'flex', gap: '10px', margin: '0 0 16px 0', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => switchTab('hospitals')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '999px',
            fontWeight: 650,
            fontSize: '13.5px',
            cursor: 'pointer',
            border: activeTab === 'hospitals' ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
            backgroundColor: activeTab === 'hospitals' ? '#F0FDFA' : '#FFFFFF',
            color: activeTab === 'hospitals' ? '#0F766E' : '#475569',
            boxShadow: activeTab === 'hospitals' ? '0 1px 2px rgba(15,118,110,0.12)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <HeartIcon size={16} />
          <span>{isMr ? 'रुग्णालये व दवाखाने' : 'Hospitals & Clinics'}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, background: activeTab === 'hospitals' ? '#CCFBF1' : '#F1F5F9', color: activeTab === 'hospitals' ? '#0F766E' : '#64748B', padding: '2px 8px', borderRadius: '999px' }}>
            {hospTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('medicals')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '999px',
            fontWeight: 650,
            fontSize: '13.5px',
            cursor: 'pointer',
            border: activeTab === 'medicals' ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
            backgroundColor: activeTab === 'medicals' ? '#F0FDFA' : '#FFFFFF',
            color: activeTab === 'medicals' ? '#0F766E' : '#475569',
            boxShadow: activeTab === 'medicals' ? '0 1px 2px rgba(15,118,110,0.12)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <MedicalIcon size={16} />
          <span>{isMr ? 'औषधांची दुकाने' : 'Medical Stores & Pharmacies'}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, background: activeTab === 'medicals' ? '#CCFBF1' : '#F1F5F9', color: activeTab === 'medicals' ? '#0F766E' : '#64748B', padding: '2px 8px', borderRadius: '999px' }}>
            {medTotal}
          </span>
        </button>
      </div>

      {/* ---------------- ADMIN HOSPITALS TAB ---------------- */}
      {activeTab === 'hospitals' && (
        <>
          <ErrorBox error={hospError} />
          
          {/* Executive Metric Grid */}
          <div className="team-kpi-grid">
            <div
              className={`team-kpi-card ${!hospFilters.type ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setHospFilters(f => ({ ...f, type: '' }))}
              title={isMr ? 'सर्व रुग्णालये' : 'All hospitals'}
            >
              <div className="team-kpi-icon blue">
                <HeartIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{hospRows === null ? '…' : hospKpis.total}</div>
                <div className="team-kpi-label">{isMr ? 'एकूण हॉस्पिटल्स' : 'Total Hospitals'}</div>
              </div>
            </div>

            <div
              className={`team-kpi-card ${hospFilters.type === 'GOVERNMENT' ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setHospFilters(f => ({ ...f, type: f.type === 'GOVERNMENT' ? '' : 'GOVERNMENT' }))}
              title={isMr ? 'शासकीय रुग्णालये' : 'Government hospitals'}
            >
              <div className="team-kpi-icon green">
                <BuildingIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{hospRows === null ? '…' : hospKpis.government}</div>
                <div className="team-kpi-label">{isMr ? 'शासकीय / PHC' : 'Government / PHC'}</div>
              </div>
            </div>

            <div
              className={`team-kpi-card ${hospFilters.type === 'PRIVATE' ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setHospFilters(f => ({ ...f, type: f.type === 'PRIVATE' ? '' : 'PRIVATE' }))}
              title={isMr ? 'खासगी रुग्णालये' : 'Private hospitals'}
            >
              <div className="team-kpi-icon amber">
                <HeartIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{hospRows === null ? '…' : hospKpis.private}</div>
                <div className="team-kpi-label">{isMr ? 'खासगी रुग्णालये' : 'Private Hospitals'}</div>
              </div>
            </div>

            <div
              className="team-kpi-card"
              title={isMr ? 'जीपीएस स्थान असलेले' : 'GPS mapped locations'}
            >
              <div className="team-kpi-icon green">
                <MapPinIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{hospRows === null ? '…' : hospKpis.mapped}</div>
                <div className="team-kpi-label">{isMr ? 'मॅपवर पिन केलेले' : 'Mapped on GPS'}</div>
              </div>
            </div>
          </div>

          {/* Executive Toolbar */}
          <div className="exec-toolbar-panel">
            <div className="exec-toolbar-row">
              <div className="exec-toolbar-left">
                <div className="exec-search-box">
                  <SearchIcon size={15} />
                  <input
                    type="text"
                    value={hospSearch}
                    onChange={e => setHospSearch(e.target.value)}
                    placeholder={isMr ? 'हॉस्पिटल, फोन किंवा पत्ता शोधा…' : 'Search hospitals, phone, address…'}
                  />
                  {hospSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setHospSearch('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="exec-quick-ward">
                  <WardFilter compact label="" />
                </div>

                <div className="exec-quick-status">
                  <select
                    value={hospFilters.type}
                    onChange={e => setHospFilters(f => ({ ...f, type: e.target.value }))}
                    className="exec-filter-select"
                  >
                    <option value="">{isMr ? 'सर्व प्रकार' : 'All types'}</option>
                    {HOSPITAL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                    ))}
                  </select>
                </div>

                <div className="exec-quick-status">
                  <select
                    value={hospFilters.areaId}
                    onChange={e => setHospFilters(f => ({ ...f, areaId: e.target.value }))}
                    className="exec-filter-select"
                  >
                    <option value="">{isMr ? 'सर्व परिसर' : 'All areas'}</option>
                    {filterAreas.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div className="exec-quick-presence">
                  <select
                    value={hospFilters.status}
                    onChange={e => setHospFilters(f => ({ ...f, status: e.target.value }))}
                    className="exec-filter-select"
                  >
                    <option value="">{isMr ? 'सर्व स्थिती' : 'All status'}</option>
                    <option value="ACTIVE">{isMr ? 'सक्रिय' : 'Active'}</option>
                    <option value="INACTIVE">{isMr ? 'निष्क्रिय' : 'Inactive'}</option>
                  </select>
                </div>

                {(hospSearch || hospFilters.type || hospFilters.areaId || hospFilters.status) && (
                  <button
                    type="button"
                    className="exec-filter-chip"
                    onClick={() => {
                      setHospSearch('');
                      setHospFilters({ search: '', type: '', status: '', areaId: '' });
                      setHospPage(1);
                    }}
                    title={isMr ? 'सर्व फिल्टर्स रीसेट करा' : 'Reset all filters'}
                  >
                    ✕ {isMr ? 'रीसेट' : 'Reset'}
                  </button>
                )}
              </div>

              <div className="exec-toolbar-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <div className="admin-view-toggle-wrap">
                  <button
                    type="button"
                    className={`admin-view-toggle-btn ${adminViewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setAdminViewMode('cards')}
                    title={isMr ? 'कार्ड व्ह्यू' : 'Cards View'}
                  >
                    <span>🗂️</span>
                    <span>{isMr ? 'कार्ड्स' : 'Cards'}</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-view-toggle-btn ${adminViewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setAdminViewMode('table')}
                    title={isMr ? 'टेबल व्ह्यू' : 'Table View'}
                  >
                    <span>📄</span>
                    <span>{isMr ? 'टेबल' : 'Table'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hospRows === null || hospLoading ? (
            <Loading />
          ) : !hospRows.length ? (
            <Empty>{isMr ? 'कोणतेही रुग्णालय सापडले नाही.' : 'No hospitals found.'}</Empty>
          ) : (
            <>
              {adminViewMode === 'cards' ? (
                <div className="admin-health-grid">
                  {hospRows.map(h => (
                    <AdminHospitalCard
                      key={h.id}
                      h={h}
                      isMr={isMr}
                      canEdit={canEditAny}
                      canDelete={canDeleteAny}
                      onView={setHospDetail}
                      onEdit={openEditHospital}
                      onDelete={removeHospital}
                      onUpdateLocation={item => openLocationModal(item, 'hospital')}
                    />
                  ))}
                </div>
              ) : (
                <div className="panel table-wrap hospitals-table-wrap">
                  <table className="table hospitals-table">
                    <thead>
                      <tr>
                        <th>{isMr ? 'रुग्णालय / दवाखाना' : 'Hospital / Clinic'}</th>
                        <th>{isMr ? 'वॉर्ड आणि परिसर' : 'Ward & Area'}</th>
                        <th>{isMr ? 'संपर्क व आणीबाणी' : 'Contact & Emergency'}</th>
                        <th>{isMr ? 'पत्ता आणि स्थान' : 'Address & Location'}</th>
                        <th style={{ textAlign: 'center' }}>{isMr ? 'स्थिती' : 'Status'}</th>
                        <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospRows.map(h => {
                        const initials = getInitials(h.name, 'HP');
                        const wardNo = formatWardNumber(h.ward?.wardNumber);
                        return (
                          <tr key={h.id}>
                            <td data-label="Hospital / Clinic">
                              <div className="exec-cell-user">
                                <div
                                  className="exec-avatar teal"
                                  onClick={() => setHospDetail(h)}
                                  style={{ cursor: 'pointer' }}
                                  title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                                >
                                  {initials}
                                </div>
                                <div className="exec-cell-meta">
                                  <button
                                    type="button"
                                    onClick={() => setHospDetail(h)}
                                    className="exec-cell-name"
                                  >
                                    {h.name}
                                  </button>
                                  <div className="hospital-cell-tags">
                                    <span className={`hospital-type-chip type-${String(h.type || '').toLowerCase()}`}>
                                      {hospitalTypeLabel(h.type, isMr)}
                                    </span>
                                    {h.landmark && (
                                      <span className="muted" style={{ fontSize: '11px' }}>• {h.landmark}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td data-label="Ward & Area">
                              {wardNo ? (
                                <span className="ward-pill-badge">{wardNo}</span>
                              ) : null}
                              {h.area?.name && (
                                <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b', marginTop: wardNo ? 3 : 0 }}>
                                  {h.area.name}
                                </div>
                              )}
                            </td>

                            <td data-label="Contact">
                              {h.phone ? (
                                <div>
                                  <a href={`tel:${h.phone}`} className="hospital-phone-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <PhoneIcon size={12} /> {h.phone}
                                  </a>
                                </div>
                              ) : (
                                <span className="muted">—</span>
                              )}
                              {h.emergencyPhone && (
                                <div className="hospital-emergency-mini">
                                  <a href={`tel:${h.emergencyPhone}`} style={{ color: '#dc2626', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <HeartIcon size={11} /> {isMr ? 'आणीबाणी:' : 'Emergency:'} {h.emergencyPhone}
                                  </a>
                                </div>
                              )}
                            </td>

                            <td data-label="Location">
                              <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.35, marginBottom: 6 }}>
                                {h.address || '—'}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {hasCoords(h.latitude, h.longitude) && (
                                  <a
                                    href={directionsUrl(h.latitude, h.longitude)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="exec-btn-dir"
                                    onClick={e => e.stopPropagation()}
                                    title={isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View directions in Google Maps'}
                                  >
                                    <MapPinIcon size={12} />
                                    <span>{isMr ? 'दिशा' : 'Directions'}</span>
                                  </a>
                                )}
                                {canEditAny && (
                                  <button
                                    type="button"
                                    className={`exec-btn-update-loc ${hasCoords(h.latitude, h.longitude) ? 'is-update' : 'is-set'}`}
                                    onClick={() => openLocationModal(h, 'hospital')}
                                    title={isMr ? 'स्थान पिन अपडेट करा' : 'Update GPS Location'}
                                  >
                                    <MapPinIcon size={12} />
                                    <span>{hasCoords(h.latitude, h.longitude) ? (isMr ? 'स्थान अपडेट करा' : 'Update Location') : (isMr ? 'स्थान सेट करा' : 'Set Location')}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            <td data-label="Status" style={{ textAlign: 'center' }}>
                              <span className={`team-badge ${h.status === 'INACTIVE' ? 'gray' : 'green'}`}>
                                {h.status === 'INACTIVE' ? (isMr ? 'निष्क्रिय' : 'Inactive') : (isMr ? 'सक्रिय' : 'Active')}
                              </span>
                            </td>

                            <td data-label="Actions" style={{ textAlign: 'center' }}>
                              <div className="exec-action-group">
                                <button
                                  type="button"
                                  className="exec-btn-view"
                                  onClick={() => setHospDetail(h)}
                                  title={isMr ? 'तपशील पहा' : 'View details'}
                                >
                                  <EyeIcon size={13} />
                                  <span>{isMr ? 'पहा' : 'View'}</span>
                                </button>

                                {canEditAny && (
                                  <button
                                    type="button"
                                    className="exec-btn-edit"
                                    onClick={() => openEditHospital(h)}
                                    title={isMr ? 'संपादित करा' : 'Edit details'}
                                  >
                                    <EditIcon size={13} />
                                    <span>{isMr ? 'संपादित' : 'Edit'}</span>
                                  </button>
                                )}

                                {canDeleteAny && (
                                  <button
                                    type="button"
                                    className="exec-btn-delete"
                                    onClick={() => removeHospital(h)}
                                    title={isMr ? 'हटवा' : 'Delete'}
                                  >
                                    <TrashIcon size={13} />
                                    <span>{isMr ? 'हटवा' : 'Delete'}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar
                page={hospPage}
                pages={Math.max(1, Math.ceil(hospTotal / hospPageSize))}
                total={hospTotal}
                onChange={p => setHospPage(p)}
              />
            </>
          )}
        </>
      )}

      {/* ---------------- ADMIN MEDICALS TAB ---------------- */}
      {activeTab === 'medicals' && (
        <>
          <ErrorBox error={medError} />

          {/* Executive Metric Grid */}
          <div className="team-kpi-grid">
            <div
              className={`team-kpi-card ${!medFilters.type && !medFilters.is24x7 && !medFilters.homeDelivery ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setMedFilters(f => ({ ...f, type: '', is24x7: false, homeDelivery: false }))}
              title={isMr ? 'सर्व औषधांची दुकाने' : 'All medical stores'}
            >
              <div className="team-kpi-icon blue">
                <MedicalIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{medRows === null ? '…' : medKpis.total}</div>
                <div className="team-kpi-label">{isMr ? 'एकूण औषधांची दुकाने' : 'Total Medical Stores'}</div>
              </div>
            </div>

            <div
              className={`team-kpi-card ${medFilters.is24x7 ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setMedFilters(f => ({ ...f, is24x7: !f.is24x7 }))}
              title={isMr ? '२४x७ सुरू असलेली दुकाने' : '24x7 pharmacies'}
            >
              <div className="team-kpi-icon green">
                <ClockIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{medRows === null ? '…' : medKpis.is24x7}</div>
                <div className="team-kpi-label">{isMr ? '२४x७ सुरू' : '24x7 Open Pharmacies'}</div>
              </div>
            </div>

            <div
              className={`team-kpi-card ${medFilters.homeDelivery ? 'active' : ''}`}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setMedFilters(f => ({ ...f, homeDelivery: !f.homeDelivery }))}
              title={isMr ? 'होम डिलिव्हरी देणारी दुकाने' : 'Home delivery stores'}
            >
              <div className="team-kpi-icon amber">
                <CheckIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{medRows === null ? '…' : medKpis.homeDelivery}</div>
                <div className="team-kpi-label">{isMr ? 'होम डिलिव्हरी' : 'Home Delivery'}</div>
              </div>
            </div>

            <div
              className="team-kpi-card"
              title={isMr ? 'जीपीएस स्थान असलेले' : 'GPS mapped locations'}
            >
              <div className="team-kpi-icon green">
                <MapPinIcon size={20} />
              </div>
              <div className="team-kpi-info">
                <div className="team-kpi-val">{medRows === null ? '…' : medKpis.mapped}</div>
                <div className="team-kpi-label">{isMr ? 'मॅपवर पिन केलेले' : 'Mapped on GPS'}</div>
              </div>
            </div>
          </div>

          {/* Executive Filter Bar */}
          <div className="exec-toolbar-panel">
            <div className="exec-toolbar-row">
              <div className="exec-toolbar-left">
                <div className="exec-search-box">
                  <SearchIcon size={15} />
                  <input
                    type="text"
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    placeholder={isMr ? 'मेडिकलचे नाव, फोन किंवा पत्ता शोधा…' : 'Search medical store, phone, address…'}
                  />
                  {medSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setMedSearch('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="exec-quick-ward">
                  <WardFilter compact label="" />
                </div>

                <div className="exec-quick-status">
                  <select
                    value={medFilters.type}
                    onChange={e => setMedFilters(f => ({ ...f, type: e.target.value }))}
                    className="exec-filter-select"
                  >
                    <option value="">{isMr ? 'सर्व प्रकार' : 'All store types'}</option>
                    {MEDICAL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                    ))}
                  </select>
                </div>

                <div className="exec-quick-status">
                  <select
                    value={medFilters.areaId}
                    onChange={e => setMedFilters(f => ({ ...f, areaId: e.target.value }))}
                    className="exec-filter-select"
                  >
                    <option value="">{isMr ? 'सर्व परिसर' : 'All areas'}</option>
                    {filterAreas.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className={`exec-filter-chip ${medFilters.is24x7 ? 'active' : ''}`}
                  onClick={() => setMedFilters(f => ({ ...f, is24x7: !f.is24x7 }))}
                >
                  <ClockIcon size={14} />
                  <span>{medFilters.is24x7 ? '✓ ' : ''}{isMr ? '२४ तास सुरू' : '24x7 Open'}</span>
                </button>

                <button
                  type="button"
                  className={`exec-filter-chip ${medFilters.homeDelivery ? 'active' : ''}`}
                  onClick={() => setMedFilters(f => ({ ...f, homeDelivery: !f.homeDelivery }))}
                >
                  <CheckIcon size={14} />
                  <span>{medFilters.homeDelivery ? '✓ ' : ''}{isMr ? 'होम डिलिव्हरी' : 'Home Delivery'}</span>
                </button>

                {(medSearch || medFilters.type || medFilters.areaId || medFilters.is24x7 || medFilters.homeDelivery) && (
                  <button
                    type="button"
                    className="exec-filter-chip"
                    onClick={() => {
                      setMedSearch('');
                      setMedFilters({ search: '', type: '', status: '', areaId: '', is24x7: false, homeDelivery: false });
                      setMedPage(1);
                    }}
                    title={isMr ? 'सर्व फिल्टर्स रीसेट करा' : 'Reset all filters'}
                  >
                    ✕ {isMr ? 'रीसेट' : 'Reset'}
                  </button>
                )}
              </div>

              <div className="exec-toolbar-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <div className="admin-view-toggle-wrap">
                  <button
                    type="button"
                    className={`admin-view-toggle-btn ${adminViewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setAdminViewMode('cards')}
                    title={isMr ? 'कार्ड व्ह्यू' : 'Cards View'}
                  >
                    <span>🗂️</span>
                    <span>{isMr ? 'कार्ड्स' : 'Cards'}</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-view-toggle-btn ${adminViewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setAdminViewMode('table')}
                    title={isMr ? 'टेबल व्ह्यू' : 'Table View'}
                  >
                    <span>📄</span>
                    <span>{isMr ? 'टेबल' : 'Table'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {medRows === null || medLoading ? (
            <Loading />
          ) : !medRows.length ? (
            <Empty>{isMr ? 'कोणतेही औषधांचे दुकान सापडले नाही.' : 'No medical stores found.'}</Empty>
          ) : (
            <>
              {adminViewMode === 'cards' ? (
                <div className="admin-health-grid">
                  {medRows.map(m => (
                    <AdminMedicalCard
                      key={m.id}
                      m={m}
                      isMr={isMr}
                      canEdit={canEditAny}
                      canDelete={canDeleteAny}
                      onView={setMedDetail}
                      onEdit={openEditMedical}
                      onDelete={removeMedical}
                      onUpdateLocation={item => openLocationModal(item, 'medical')}
                    />
                  ))}
                </div>
              ) : (
                <div className="panel table-wrap hospitals-table-wrap">
                  <table className="table hospitals-table">
                    <thead>
                      <tr>
                        <th>{isMr ? 'औषधांचे दुकान' : 'Medical Store'}</th>
                        <th>{isMr ? 'वॉर्ड आणि परिसर' : 'Ward & Area'}</th>
                        <th>{isMr ? 'संपर्क व वेळ' : 'Contact & Hours'}</th>
                        <th>{isMr ? 'पत्ता आणि स्थान' : 'Address & Location'}</th>
                        <th style={{ textAlign: 'center' }}>{isMr ? 'स्थिती' : 'Status'}</th>
                        <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medRows.map(m => {
                        const initials = getInitials(m.name, 'MD');
                        const wardNo = formatWardNumber(m.ward?.wardNumber);
                        return (
                          <tr key={m.id}>
                            <td data-label="Medical Store">
                              <div className="exec-cell-user">
                                <div
                                  className="exec-avatar teal"
                                  onClick={() => setMedDetail(m)}
                                  style={{ cursor: 'pointer' }}
                                  title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                                >
                                  {initials}
                                </div>
                                <div className="exec-cell-meta">
                                  <button
                                    type="button"
                                    onClick={() => setMedDetail(m)}
                                    className="exec-cell-name"
                                  >
                                    {m.name}
                                  </button>
                                  <div className="hospital-cell-tags">
                                    <span className={`hospital-type-chip type-${String(m.type || '').toLowerCase()}`}>
                                      {medicalTypeLabel(m.type, isMr)}
                                    </span>
                                    {m.is24x7 && (
                                      <span style={{ fontSize: '10.5px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                        24x7
                                      </span>
                                    )}
                                    {m.homeDelivery && (
                                      <span style={{ fontSize: '10.5px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                        {isMr ? 'डिलिव्हरी' : 'Delivery'}
                                      </span>
                                    )}
                                    {m.landmark && (
                                      <span className="muted" style={{ fontSize: '11px' }}>• {m.landmark}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td data-label="Ward & Area">
                              {wardNo ? (
                                <span className="ward-pill-badge">{wardNo}</span>
                              ) : null}
                              {m.area?.name && (
                                <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b', marginTop: wardNo ? 3 : 0 }}>
                                  {m.area.name}
                                </div>
                              )}
                            </td>

                            <td data-label="Contact & Hours">
                              {m.phone ? (
                                <div>
                                  <a href={`tel:${m.phone}`} className="hospital-phone-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <PhoneIcon size={12} /> {m.phone}
                                  </a>
                                </div>
                              ) : (
                                <span className="muted">—</span>
                              )}
                              {m.openingHours && (
                                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <ClockIcon size={11} /> {m.openingHours}
                                </div>
                              )}
                            </td>

                            <td data-label="Location">
                              <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.35, marginBottom: 6 }}>
                                {m.address || '—'}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {hasCoords(m.latitude, m.longitude) && (
                                  <a
                                    href={directionsUrl(m.latitude, m.longitude)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="exec-btn-dir"
                                    onClick={e => e.stopPropagation()}
                                    title={isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View directions in Google Maps'}
                                  >
                                    <MapPinIcon size={12} />
                                    <span>{isMr ? 'दिशा' : 'Directions'}</span>
                                  </a>
                                )}
                                {canEditAny && (
                                  <button
                                    type="button"
                                    className={`exec-btn-update-loc ${hasCoords(m.latitude, m.longitude) ? 'is-update' : 'is-set'}`}
                                    onClick={() => openLocationModal(m, 'medical')}
                                    title={isMr ? 'स्थान पिन अपडेट करा' : 'Update GPS Location'}
                                  >
                                    <MapPinIcon size={12} />
                                    <span>{hasCoords(m.latitude, m.longitude) ? (isMr ? 'स्थान अपडेट करा' : 'Update Location') : (isMr ? 'स्थान सेट करा' : 'Set Location')}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            <td data-label="Status" style={{ textAlign: 'center' }}>
                              <span className={`team-badge ${m.status === 'INACTIVE' ? 'gray' : 'green'}`}>
                                {m.status === 'INACTIVE' ? (isMr ? 'निष्क्रिय' : 'Inactive') : (isMr ? 'सक्रिय' : 'Active')}
                              </span>
                            </td>

                            <td data-label="Actions" style={{ textAlign: 'center' }}>
                              <div className="exec-action-group">
                                <button
                                  type="button"
                                  className="exec-btn-view"
                                  onClick={() => setMedDetail(m)}
                                  title={isMr ? 'तपशील पहा' : 'View details'}
                                >
                                  <EyeIcon size={13} />
                                  <span>{isMr ? 'पहा' : 'View'}</span>
                                </button>

                                {canEditAny && (
                                  <button
                                    type="button"
                                    className="exec-btn-edit"
                                    onClick={() => openEditMedical(m)}
                                    title={isMr ? 'संपादित करा' : 'Edit details'}
                                  >
                                    <EditIcon size={13} />
                                    <span>{isMr ? 'संपादित' : 'Edit'}</span>
                                  </button>
                                )}

                                {canDeleteAny && (
                                  <button
                                    type="button"
                                    className="exec-btn-delete"
                                    onClick={() => removeMedical(m)}
                                    title={isMr ? 'हटवा' : 'Delete'}
                                  >
                                    <TrashIcon size={13} />
                                    <span>{isMr ? 'हटवा' : 'Delete'}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar
                page={medPage}
                pages={Math.max(1, Math.ceil(medTotal / medPageSize))}
                total={medTotal}
                onChange={p => setMedPage(p)}
              />
            </>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* HOSPITAL CREATE/EDIT MODAL (3 Structured Executive Sections)           */}
      {/* ==================================================================== */}
      {hospEdit && (
        <Modal
          title={hospEdit === 'create' ? (isMr ? 'नवीन हॉस्पिटल जोडा' : 'Add Hospital') : (isMr ? 'हॉस्पिटल संपादित करा' : 'Edit Hospital')}
          onClose={() => setHospEdit(null)}
        >
          <form onSubmit={saveHospital} className="hospital-form">
            {/* Section 1: Basic Information */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <BuildingIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '१. मूलभूत माहिती' : '1. Basic Information'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'हॉस्पिटलचे नाव, प्रकार आणि स्थिती' : 'Hospital name, category and status'}
                </span>
              </div>
              <Field label={isMr ? 'हॉस्पिटलचे नाव *' : 'Hospital name *'}>
                <input required value={hospForm.name} onChange={e => setHospForm({ ...hospForm, name: e.target.value })} placeholder="e.g. City Civil Hospital" />
              </Field>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'प्रकार *' : 'Facility type *'}>
                  <select value={hospForm.type} onChange={e => setHospForm({ ...hospForm, type: e.target.value })}>
                    {HOSPITAL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={isMr ? 'स्थिती' : 'Status'}>
                  <select value={hospForm.status} onChange={e => setHospForm({ ...hospForm, status: e.target.value })}>
                    <option value="ACTIVE">{isMr ? 'सक्रिय' : 'Active'}</option>
                    <option value="INACTIVE">{isMr ? 'निष्क्रिय' : 'Inactive'}</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Section 2: Location & Address */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '२. वॉर्ड आणि स्थान' : '2. Location & Address'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'वॉर्ड, कॉलनी आणि रस्ता' : 'Ward, colony and street address'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'वॉर्ड *' : 'Ward *'}>
                  {wardLocked ? (
                    <input readOnly value={formatWardLabel(user?.ward) || formatWardNumber(user?.ward?.wardNumber) || (isMr ? 'नियुक्त वॉर्ड' : 'Assigned ward')} />
                  ) : (
                    <SearchableSelect
                      value={hospForm.wardId || selectedWardId}
                      onChange={v => setHospForm({ ...hospForm, wardId: v, areaId: '' })}
                      options={(wards || []).map(w => ({ value: w.id, label: formatWardLabel(w) }))}
                      placeholder={isMr ? 'वॉर्ड निवडा…' : 'Select ward…'}
                    />
                  )}
                </Field>
                <Field label={isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}>
                  <SearchableSelect
                    value={hospForm.areaId || ''}
                    onChange={v => setHospForm({ ...hospForm, areaId: v })}
                    options={hospFormAreas}
                    placeholder={isMr ? 'परिसर निवडा (पर्यायी)' : 'Select area (optional)'}
                  />
                </Field>
              </div>
              <Field label={isMr ? 'पूर्ण पत्ता' : 'Full address'}>
                <textarea rows={2} value={hospForm.address} onChange={e => setHospForm({ ...hospForm, address: e.target.value })} placeholder="Plot / building, street name, pincode" />
              </Field>
              <Field label={isMr ? 'खूण' : 'Landmark'}>
                <input value={hospForm.landmark} onChange={e => setHospForm({ ...hospForm, landmark: e.target.value })} placeholder="e.g. Near Bus Stand" />
              </Field>
            </div>

            {/* Section 3: Contact, Services & Map Pin */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <PhoneIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '३. संपर्क, सेवा आणि नकाशा' : '3. Contact, Services & Map'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'फोन, आणीबाणी संपर्क आणि GPS पिन' : 'Contact numbers and GPS entrance pin'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'फोन' : 'Phone'}>
                  <input inputMode="tel" value={hospForm.phone} onChange={e => setHospForm({ ...hospForm, phone: e.target.value })} placeholder="0241-XXXXXXX" />
                </Field>
                <Field label={isMr ? 'आणीबाणी फोन' : 'Emergency phone'}>
                  <input inputMode="tel" value={hospForm.emergencyPhone} onChange={e => setHospForm({ ...hospForm, emergencyPhone: e.target.value })} placeholder="108 / local casualty" />
                </Field>
              </div>
              <Field label={isMr ? 'वेळ' : 'Opening Hours'}>
                <input value={hospForm.openingHours} onChange={e => setHospForm({ ...hospForm, openingHours: e.target.value })} placeholder="e.g. 24 Hours Open / 9 AM - 8 PM" />
              </Field>
              <Field label={isMr ? 'उपलब्ध सुविधा' : 'Facilities (ICU, blood bank, etc.)'}>
                <textarea rows={2} value={hospForm.facilities} onChange={e => setHospForm({ ...hospForm, facilities: e.target.value })} placeholder="e.g. ICU, OPD, Emergency 24x7, Blood Bank" />
              </Field>
              <Field label={isMr ? 'अंतर्गत नोंद' : 'Internal notes'}>
                <textarea rows={2} value={hospForm.notes} onChange={e => setHospForm({ ...hospForm, notes: e.target.value })} placeholder="Additional administration notes" />
              </Field>
              {hasCoords(hospForm.latitude, hospForm.longitude) ? (
                <div className="hospital-pin-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 600, fontSize: '13px', margin: '4px 0' }}>
                  <CheckIcon size={15} />
                  <span>Lat {Number(hospForm.latitude).toFixed(6)}, Lng {Number(hospForm.longitude).toFixed(6)}</span>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '12px', margin: '4px 0', color: '#64748B' }}>
                  {isMr ? 'गेटवर उभे राहून Use GPS दाबा किंवा नकाशावर टॅप करा.' : 'Stand at the gate and tap Use GPS, or pin the entrance on the map.'}
                </p>
              )}
              <LocationPicker
                key={hospEdit === 'create' ? 'new-hosp' : hospEdit.id}
                value={hospForm}
                onChange={next => setHospForm({ ...hospForm, latitude: next.latitude, longitude: next.longitude })}
                centerFrom={[hospSelectedArea, hospFormWard]}
                hint={isMr ? 'हॉस्पिटल गेटवर उभे राहून Use GPS दाबा.' : 'Stand at the hospital gate and tap Use GPS.'}
              />
            </div>

            <div className="exec-modal-footer">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setHospEdit(null)}>{isMr ? 'रद्द करा' : 'Cancel'}</button>
              <button type="submit" className="exec-modal-btn primary" disabled={hospBusy}>
                {hospBusy ? (isMr ? 'जतन करत आहे…' : 'Saving…') : (isMr ? 'हॉस्पिटल जतन करा' : 'Save Hospital')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================================== */}
      {/* MEDICAL CREATE/EDIT MODAL (3 Structured Executive Sections)          */}
      {/* ==================================================================== */}
      {medEdit && (
        <Modal
          title={medEdit === 'create' ? (isMr ? 'नवीन मेडिकल जोडा' : 'Add Medical Store') : (isMr ? 'मेडिकल स्टोअर संपादित करा' : 'Edit Medical Store')}
          onClose={() => setMedEdit(null)}
        >
          <form onSubmit={saveMedical} className="hospital-form">
            {/* Section 1: Basic Information */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <BuildingIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '१. मूलभूत माहिती' : '1. Basic Information'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'मेडिकलचे नाव, औषध प्रकार आणि स्थिती' : 'Store name, medicine category and status'}
                </span>
              </div>
              <Field label={isMr ? 'मेडिकलचे नाव *' : 'Medical store name *'}>
                <input required value={medForm.name} onChange={e => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Apollo Pharmacy & Wellness" />
              </Field>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'औषध प्रकार *' : 'Medicine store type *'}>
                  <select value={medForm.type} onChange={e => setMedForm({ ...medForm, type: e.target.value })}>
                    {MEDICAL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={isMr ? 'स्थिती' : 'Status'}>
                  <select value={medForm.status} onChange={e => setMedForm({ ...medForm, status: e.target.value })}>
                    <option value="ACTIVE">{isMr ? 'सक्रिय' : 'Active'}</option>
                    <option value="INACTIVE">{isMr ? 'निष्क्रिय' : 'Inactive'}</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Section 2: Location & Address */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '२. वॉर्ड आणि स्थान' : '2. Location & Address'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'वॉर्ड, कॉलनी आणि रस्ता' : 'Ward, colony and street address'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'वॉर्ड *' : 'Ward *'}>
                  {wardLocked ? (
                    <input readOnly value={formatWardLabel(user?.ward) || formatWardNumber(user?.ward?.wardNumber) || (isMr ? 'नियुक्त वॉर्ड' : 'Assigned ward')} />
                  ) : (
                    <SearchableSelect
                      value={medForm.wardId || selectedWardId}
                      onChange={v => setMedForm({ ...medForm, wardId: v, areaId: '' })}
                      options={(wards || []).map(w => ({ value: w.id, label: formatWardLabel(w) }))}
                      placeholder={isMr ? 'वॉर्ड निवडा…' : 'Select ward…'}
                    />
                  )}
                </Field>
                <Field label={isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}>
                  <SearchableSelect
                    value={medForm.areaId || ''}
                    onChange={v => setMedForm({ ...medForm, areaId: v })}
                    options={medFormAreas}
                    placeholder={isMr ? 'परिसर निवडा (पर्यायी)' : 'Select area (optional)'}
                  />
                </Field>
              </div>
              <Field label={isMr ? 'पूर्ण पत्ता' : 'Full address'}>
                <textarea rows={2} value={medForm.address} onChange={e => setMedForm({ ...medForm, address: e.target.value })} placeholder="Shop number, building, street, area" />
              </Field>
              <Field label={isMr ? 'खूण' : 'Landmark'}>
                <input value={medForm.landmark} onChange={e => setMedForm({ ...medForm, landmark: e.target.value })} placeholder="e.g. Near Savedi Naka" />
              </Field>
            </div>

            {/* Section 3: Contact, Services, Timings & Map Pin */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MedicalIcon size={16} style={{ color: '#0F766E' }} />
                  <span>{isMr ? '३. संपर्क, सेवा आणि नकाशा' : '3. Services, Hours & Map Pin'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'संपर्क फोन, कामाची वेळ आणि GPS पिन' : 'Store phone, service hours and entrance pin'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'संपर्क फोन' : 'Store contact phone'}>
                  <input inputMode="tel" value={medForm.phone} onChange={e => setMedForm({ ...medForm, phone: e.target.value })} placeholder="0241-XXXXXXX" />
                </Field>
                <Field label={isMr ? 'वेळ' : 'Opening Hours'}>
                  <input value={medForm.openingHours} onChange={e => setMedForm({ ...medForm, openingHours: e.target.value })} placeholder="e.g. 24 Hours Open / 8 AM - 10 PM" />
                </Field>
              </div>

              {/* Styled Executive Toggle Pills for 24x7 & Home Delivery */}
              <div style={{ display: 'flex', gap: '14px', margin: '4px 0 10px 0', flexWrap: 'wrap' }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: medForm.is24x7 ? '#ECFDF5' : '#F8FAFC',
                  border: medForm.is24x7 ? '1.5px solid #A7F3D0' : '1px solid #CBD5E1',
                  color: medForm.is24x7 ? '#047857' : '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={medForm.is24x7}
                    onChange={e => setMedForm({ ...medForm, is24x7: e.target.checked })}
                    style={{ accentColor: '#0F766E' }}
                  />
                  <span>{isMr ? '२४x७ सुरू (24 Hours Open)' : '24x7 Open (Day & Night)'}</span>
                </label>

                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: medForm.homeDelivery ? '#EFF6FF' : '#F8FAFC',
                  border: medForm.homeDelivery ? '1.5px solid #BFDBFE' : '1px solid #CBD5E1',
                  color: medForm.homeDelivery ? '#1D4ED8' : '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={medForm.homeDelivery}
                    onChange={e => setMedForm({ ...medForm, homeDelivery: e.target.checked })}
                    style={{ accentColor: '#0F766E' }}
                  />
                  <span>{isMr ? 'होम डिलिव्हरी उपलब्ध' : 'Home Delivery Available'}</span>
                </label>
              </div>

              <Field label={isMr ? 'सुविधा व उपलब्ध औषधे' : 'Facilities & Services'}>
                <textarea rows={2} value={medForm.facilities} onChange={e => setMedForm({ ...medForm, facilities: e.target.value })} placeholder="e.g. Oxygen Cylinder, BP & Blood Sugar Check, Generic Medicines" />
              </Field>
              <Field label={isMr ? 'अंतर्गत नोंद' : 'Internal notes'}>
                <textarea rows={2} value={medForm.notes} onChange={e => setMedForm({ ...medForm, notes: e.target.value })} placeholder="Additional administrative notes" />
              </Field>

              {hasCoords(medForm.latitude, medForm.longitude) ? (
                <div className="hospital-pin-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 600, fontSize: '13px', margin: '4px 0' }}>
                  <CheckIcon size={15} />
                  <span>Lat {Number(medForm.latitude).toFixed(6)}, Lng {Number(medForm.longitude).toFixed(6)}</span>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '12px', margin: '4px 0', color: '#64748B' }}>
                  {isMr ? 'दुकानाच्या गेटवर उभे राहून Use GPS दाबा किंवा नकाशावर टॅप करा.' : 'Stand at the shop entrance and tap Use GPS, or pin on the map.'}
                </p>
              )}
              <LocationPicker
                key={medEdit === 'create' ? 'new-med' : medEdit.id}
                value={medForm}
                onChange={next => setMedForm({ ...medForm, latitude: next.latitude, longitude: next.longitude })}
                centerFrom={[medSelectedArea, medFormWard]}
                hint={isMr ? 'मेडिकल स्टोअरच्या गेटवर उभे राहून Use GPS दाबा.' : 'Stand at the medical store entrance and tap Use GPS.'}
              />
            </div>

            <div className="exec-modal-footer">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setMedEdit(null)}>{isMr ? 'रद्द करा' : 'Cancel'}</button>
              <button type="submit" className="exec-modal-btn primary" disabled={medBusy} style={{ background: '#0F766E' }}>
                {medBusy ? (isMr ? 'जतन करत आहे…' : 'Saving…') : (isMr ? 'मेडिकल जतन करा' : 'Save Medical Store')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Hospital Details View (Admin) */}
      {hospDetail && (
        <Modal title={hospDetail.name} onClose={() => setHospDetail(null)}>
          <div className="exec-detail-body">
            <p><strong>{isMr ? 'प्रकार:' : 'Type:'}</strong> {hospitalTypeLabel(hospDetail.type, isMr)}</p>
            {hospDetail.ward && (
              <p>
                <strong>{isMr ? 'वॉर्ड:' : 'Ward:'}</strong> {formatWardNumber(hospDetail.ward.wardNumber) || formatWardLabel(hospDetail.ward)}
              </p>
            )}
            {hospDetail.area?.name && <p><strong>{isMr ? 'परिसर / कॉलनी:' : 'Colony / Area:'}</strong> {hospDetail.area.name}</p>}
            {hospDetail.address && <p><strong>{isMr ? 'पत्ता:' : 'Address:'}</strong> {hospDetail.address} {hospDetail.landmark ? `(${hospDetail.landmark})` : ''}</p>}
            {hospDetail.phone && <p><strong>{isMr ? 'फोन:' : 'Phone:'}</strong> <a href={`tel:${hospDetail.phone}`} style={{ color: '#0F766E', fontWeight: 600 }}>{hospDetail.phone}</a></p>}
            {hospDetail.emergencyPhone && (
              <p style={{ color: '#DC2626', fontWeight: 700 }}>
                <strong>{isMr ? 'आणीबाणी संपर्क:' : 'Emergency Contact:'}</strong> <a href={`tel:${hospDetail.emergencyPhone}`} style={{ color: '#DC2626' }}>{hospDetail.emergencyPhone}</a>
              </p>
            )}
            {hospDetail.openingHours && <p><strong>{isMr ? 'वेळ:' : 'Timings:'}</strong> {hospDetail.openingHours}</p>}
            {hospDetail.facilities && <p><strong>{isMr ? 'सुविधा:' : 'Facilities:'}</strong> {hospDetail.facilities}</p>}
            {hospDetail.notes && <p style={{ color: '#64748B', fontSize: '13px' }}><strong>{isMr ? 'अंतर्गत नोंद:' : 'Internal Notes:'}</strong> {hospDetail.notes}</p>}
            {hasCoords(hospDetail.latitude, hospDetail.longitude) && (
              <div style={{ marginTop: '16px' }}>
                <a
                  className="exec-btn-dir"
                  style={{ display: 'inline-flex', padding: '8px 16px', height: 'auto', fontSize: '13px' }}
                  href={directionsUrl(hospDetail.latitude, hospDetail.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPinIcon size={14} />
                  <span>{isMr ? 'गुगल मॅपवर दिशा पहा' : 'View Directions on Google Maps'}</span>
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Medical Details View (Admin) */}
      {medDetail && (
        <Modal title={translateMedicalName(medDetail.name, isMr)} onClose={() => setMedDetail(null)}>
          <div className="exec-detail-body">
            <p><strong>{isMr ? 'प्रकार:' : 'Type:'}</strong> {medicalTypeLabel(medDetail.type, isMr)}</p>
            {medDetail.ward && (
              <p>
                <strong>{isMr ? 'वॉर्ड:' : 'Ward:'}</strong> {formatWardNumber(medDetail.ward.wardNumber) || formatWardLabel(medDetail.ward)}
              </p>
            )}
            {medDetail.area?.name && <p><strong>{isMr ? 'परिसर / कॉलनी:' : 'Colony / Area:'}</strong> {medDetail.area.name}</p>}
            {medDetail.address && <p><strong>{isMr ? 'पत्ता:' : 'Address:'}</strong> {medDetail.address} {medDetail.landmark ? `(${medDetail.landmark})` : ''}</p>}
            {medDetail.phone && (
              <p>
                <strong>{isMr ? 'संपर्क फोन:' : 'Phone:'}</strong>{' '}
                <a href={`tel:${medDetail.phone}`} style={{ color: '#0F766E', fontWeight: 700 }}>{medDetail.phone}</a>
              </p>
            )}
            <p><strong>{isMr ? 'कामाची वेळ:' : 'Timings:'}</strong> {translateHours(medDetail.openingHours, isMr) || (medDetail.is24x7 ? (isMr ? '२४ तास सुरू' : '24x7 Open') : (isMr ? 'नियमित वेळ' : 'Standard hours'))}</p>
            <div style={{ display: 'flex', gap: '8px', margin: '10px 0' }}>
              {medDetail.is24x7 && (
                <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                  {isMr ? '✓ २४ तास सुरू' : '✓ 24x7 Open'}
                </span>
              )}
              {medDetail.homeDelivery && (
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, border: '1px solid #BFDBFE' }}>
                  {isMr ? '✓ मोफत होम डिलिव्हरी' : '✓ Home Delivery'}
                </span>
              )}
            </div>
            {medDetail.facilities && <p><strong>{isMr ? 'सुविधा व औषधे:' : 'Facilities & Services:'}</strong> {medDetail.facilities}</p>}
            {medDetail.notes && <p style={{ color: '#64748B', fontSize: '13px' }}><strong>{isMr ? 'विशेष नोंद:' : 'Notes:'}</strong> {medDetail.notes}</p>}
            {hasCoords(medDetail.latitude, medDetail.longitude) && (
              <div style={{ marginTop: '16px' }}>
                <a
                  className="exec-btn-dir"
                  style={{ display: 'inline-flex', padding: '8px 16px', height: 'auto', fontSize: '13px' }}
                  href={directionsUrl(medDetail.latitude, medDetail.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPinIcon size={14} />
                  <span>{isMr ? 'गुगल मॅपवर दिशा पहा' : 'View Directions on Google Maps'}</span>
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ==================================================================== */}
      {/* QUICK LOCATION PIN UPDATE MODAL (Dedicated Update Location Modal)   */}
      {/* ==================================================================== */}
      {locationEditModal && (
        <Modal
          title={isMr ? `स्थान अपडेट करा: ${locationEditModal.name}` : `Update Location: ${locationEditModal.name}`}
          onClose={() => setLocationEditModal(null)}
        >
          <div className="location-update-modal-body">
            {locationSuccess && (
              <div className="success-banner" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '10px 14px', borderRadius: '8px', fontWeight: 600, marginBottom: 8 }}>
                ✓ {locationSuccess}
              </div>
            )}

            <div className="location-item-summary">
              <div className="summary-title-row">
                <strong>{locationEditModal.name}</strong>
                <span className={`health-type-chip type-${String(locationEditModal.item?.type || '').toLowerCase()}`}>
                  {locationEditModal.type === 'hospital'
                    ? hospitalTypeLabel(locationEditModal.item?.type, isMr)
                    : medicalTypeLabel(locationEditModal.item?.type, isMr)}
                </span>
              </div>
              <p className="summary-address">
                📍 {locationEditModal.address || (isMr ? 'पत्ता दिलेला नाही' : 'No address specified')}
                {locationEditModal.landmark ? ` (${isMr ? 'जवळ' : 'near'}: ${locationEditModal.landmark})` : ''}
              </p>
              <div className="summary-ward-tag">
                {locationEditModal.ward?.wardNumber && (
                  <span className="ward-pill-badge">{formatWardNumber(locationEditModal.ward.wardNumber)}</span>
                )}
                {locationEditModal.ward?.name && <span>🏛️ {locationEditModal.ward.name}</span>}
                {locationEditModal.area?.name && <span>· 📍 {locationEditModal.area.name}</span>}
              </div>
            </div>

            <div className="location-current-coords-box">
              {hasCoords(locationEditModal.latitude, locationEditModal.longitude) ? (
                <div className="coords-status pinned">
                  <CheckIcon size={15} />
                  <span>
                    {isMr ? 'सध्याचे जीपीएस स्थान:' : 'Current Coordinates:'}{' '}
                    <strong>Lat {Number(locationEditModal.latitude).toFixed(6)}, Lng {Number(locationEditModal.longitude).toFixed(6)}</strong>
                  </span>
                </div>
              ) : (
                <div className="coords-status unpinned">
                  <MapPinIcon size={15} />
                  <span>{isMr ? 'अद्याप स्थान पिन केलेले नाही. नकाशावर टॅप करा किंवा "Use GPS" दाबा.' : 'No GPS location pinned yet. Tap map or use GPS.'}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 6 }}>
              <LocationPicker
                key={`quick-loc-${locationEditModal.item?.id || 'new'}`}
                value={{ latitude: locationEditModal.latitude, longitude: locationEditModal.longitude }}
                onChange={next => setLocationEditModal(prev => ({ ...prev, latitude: next.latitude, longitude: next.longitude }))}
                centerFrom={[locationEditModal.area, locationEditModal.ward]}
                hint={isMr ? 'प्रवेशद्वारावर उभे राहून Use GPS दाबा किंवा नकाशावर अचूक स्थान निवडा.' : 'Stand at the entrance and tap Use GPS, or pin exact location on map.'}
              />
            </div>

            <div className="exec-modal-footer" style={{ marginTop: 14 }}>
              <div style={{ marginRight: 'auto' }}>
                {hasCoords(locationEditModal.latitude, locationEditModal.longitude) && (
                  <button
                    type="button"
                    className="exec-modal-btn ghost"
                    style={{ color: '#DC2626' }}
                    onClick={clearQuickLocation}
                  >
                    {isMr ? 'पिन काढा' : 'Clear Pin'}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="exec-modal-btn ghost"
                onClick={() => setLocationEditModal(null)}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button
                type="button"
                className="exec-modal-btn primary"
                style={{ background: '#0F766E' }}
                disabled={locationSaving}
                onClick={saveQuickLocation}
              >
                {locationSaving ? (isMr ? 'जतन करत आहे…' : 'Saving…') : (isMr ? 'स्थान पिन सेव्ह करा' : 'Save Location Pin')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
