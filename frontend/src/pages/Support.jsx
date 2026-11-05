import React from 'react';
import { getLanguage } from '../language';
import BrandIcon from '../components/BrandIcon';
import { COMPANY_EMAIL, COMPANY_MOBILE, COMPANY_NAME } from './Login';

export default function Support() {
  const isMr = getLanguage() === 'mr';
  return (
    <div className="support-page">
      <header className="support-hero">
        <span className="support-kicker">{isMr ? 'सहाय्य केंद्र' : 'HELP DESK'}</span>
        <h1>{isMr ? 'सपोर्ट' : 'Support'}</h1>
        <p>
          {isMr
            ? 'WardSetu खाते, लॉगिन किंवा तांत्रिक मदतीसाठी खालील कंपनी संपर्क वापरा. वॉर्ड तक्रारी नगरसेवक / कर्मचाऱ्यांकडे नोंदवा.'
            : 'For WardSetu account, login or technical help, use the company contacts below. Ward complaints should still be raised with your Nagarsevak or ward staff.'}
        </p>
      </header>

      <section className="support-company-card">
        <div className="support-brand">
          <div className="support-brand-mark">
            <BrandIcon size={36} variant="light" />
          </div>
          <div>
            <strong className="notranslate" translate="no">{COMPANY_NAME}</strong>
            <span>{isMr ? 'WardSetu सॉफ्टवेअर व तांत्रिक सहाय्य' : 'WardSetu software & technical support'}</span>
          </div>
        </div>
      </section>

      <div className="support-contact-grid">
        <a className="support-contact-card" href={`mailto:${COMPANY_EMAIL}`}>
          <span className="support-contact-ico" aria-hidden="true">✉</span>
          <small>{isMr ? 'ईमेल' : 'Email'}</small>
          <strong className="notranslate" translate="no">{COMPANY_EMAIL}</strong>
          <em>{isMr ? 'ईमेल पाठवा' : 'Send email'}</em>
        </a>
        <a className="support-contact-card" href={`tel:${COMPANY_MOBILE}`}>
          <span className="support-contact-ico" aria-hidden="true">☎</span>
          <small>{isMr ? 'मोबाईल' : 'Mobile'}</small>
          <strong className="notranslate" translate="no">{COMPANY_MOBILE}</strong>
          <em>{isMr ? 'आता कॉल करा' : 'Call now'}</em>
        </a>
      </div>

      <p className="support-note">
        {isMr
          ? 'कामकाजाच्या वेळेत संपर्क साधा. वॉर्ड सेवा संबंधित तक्रार “तक्रारी” विभागातून नोंदवा.'
          : 'Reach us during working hours. For civic issues in your ward, use the Complaints section.'}
      </p>
    </div>
  );
}
