import React from 'react';
import { FaceAvatar } from './Ui';

export default function NagarsevakPanelPicker({
  open,
  list = [],
  selectedId = '',
  required = false,
  language = 'en',
  onSelect,
  onClose,
}) {
  if (!open) return null;
  const isMr = language === 'mr';
  const rows = Array.isArray(list) ? list.filter((n) => n && n.id) : [];

  return (
    <div
      className="panel-pick-backdrop"
      onPointerDown={() => { if (!required) onClose?.(); }}
    >
      <div className="panel-pick-modal" role="dialog" aria-modal="true" onPointerDown={(e) => e.stopPropagation()}>
        <div className="panel-pick-head">
          <span className="panel-pick-kicker">{isMr ? 'नागरिक पोर्टल' : 'RESIDENT PORTAL'}</span>
          <h2>{isMr ? 'कोणत्या नगरसेवकाचे पॅनेल उघडायचे?' : 'Which Nagarsevak panel should open?'}</h2>
          <p>
            {isMr
              ? 'फक्त सक्रिय पॅनेल येथे दिसतात. निवडलेले पॅनेल Home, Gallery आणि Complaints वर दिसेल.'
              : 'Only active panels are listed. Your choice is used on Home, Gallery and Complaints.'}
          </p>
        </div>
        {!rows.length ? (
          <p className="panel-pick-empty">{isMr ? 'या वॉर्डात सध्या सक्रिय नगरसेवक पॅनेल नाही.' : 'No active Nagarsevak panel in this ward yet.'}</p>
        ) : (
          <div className="panel-pick-list">
            {rows.map((n) => {
              const active = String(n.id) === String(selectedId);
              return (
                <button
                  type="button"
                  key={n.id}
                  className={`panel-pick-card ${active ? 'is-active' : ''}`}
                  onClick={() => onSelect?.(n)}
                >
                  <FaceAvatar name={n.name} photo={n.photo} className="panel-pick-avatar" />
                  <div className="panel-pick-copy">
                    <strong>{n.name}</strong>
                    <span>
                      {[n.partyName, n.wardSeat ? (isMr ? `प्रभाग ${n.wardSeat}` : `Seat ${n.wardSeat}`) : '']
                        .filter(Boolean)
                        .join(' · ') || (isMr ? 'सक्रिय नगरसेवक' : 'Active Nagarsevak')}
                    </span>
                  </div>
                  <em>{active ? (isMr ? 'सध्याचे' : 'Current') : (isMr ? 'उघडा' : 'Open')}</em>
                </button>
              );
            })}
          </div>
        )}
        {!required ? (
          <div className="panel-pick-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              {isMr ? 'रद्द करा' : 'Cancel'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
