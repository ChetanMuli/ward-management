import React, { useState } from 'react';
import { StatusPill, fmtDateTime } from './Ui';

export function getTimelineStepInfo(h, complaint, index, total, isMr = false) {
  const isInitial = index === 0;
  const isLatest = index === total - 1;
  const comment = String(h?.comment || '').trim();
  const newStatus = h?.newStatus || complaint?.status || 'SUBMITTED';
  const oldStatus = h?.oldStatus || null;
  const isSameStatus = Boolean(oldStatus && newStatus && oldStatus === newStatus);

  let title = '';
  let icon = '📌';
  let badgeColor = '#3b82f6';
  let defaultDesc = '';

  if (isInitial || (!oldStatus && (newStatus === 'SUBMITTED' || newStatus === 'OPEN'))) {
    icon = '📝';
    title = isMr ? 'तक्रार नोंदणी झाली' : 'Complaint Registered';
    badgeColor = '#3b82f6';
    defaultDesc = isMr
      ? 'तक्रार प्राप्त झाली असून वॉर्ड कामकाजासाठी नोंदवली गेली आहे.'
      : 'Complaint submitted and recorded in the ward system.';
  } else if (newStatus === 'ASSIGNED') {
    icon = '👤';
    badgeColor = '#6366f1';
    if (comment && /assigned to\s+([^\.]+)/i.test(comment)) {
      const match = comment.match(/assigned to\s+([^\.]+)/i);
      const name = match ? match[1].trim() : '';
      title = isMr
        ? `${name ? `${name} यांच्याकडे ` : ''}काम सोपवले`
        : `Assigned to ${name || 'Field Staff'}`;
    } else if (comment && /taken directly by\s+([^\.]+)/i.test(comment)) {
      const match = comment.match(/taken directly by\s+([^\.]+)/i);
      const name = match ? match[1].trim() : '';
      title = isMr
        ? `${name || 'नगरसेवक'} यांनी स्वतः काम स्वीकारले`
        : `Taken directly by ${name || 'Nagarsevak'}`;
    } else if (isSameStatus) {
      title = isMr ? 'कर्मचाऱ्याकडे पुनर्नियुक्त' : 'Reassigned to Field Staff';
    } else {
      title = isMr ? 'कर्मचाऱ्याकडे काम सोपवले' : 'Assigned to Field Staff';
    }
    defaultDesc = isMr
      ? 'तक्रार क्षेत्रीय कर्मचारी / पथकाकडे सोपवण्यात आली आहे.'
      : 'Complaint assigned to field staff for execution.';
  } else if (newStatus === 'IN_PROGRESS') {
    icon = '⚡';
    badgeColor = '#f59e0b';
    title = isMr ? 'प्रत्यक्ष काम सुरू (In Progress)' : 'Work Started (In Progress)';
    defaultDesc = isMr
      ? 'कर्मचाऱ्यांकडून प्रत्यक्ष कामाला सुरुवात झाली आहे.'
      : 'Field staff started work on-site.';
  } else if (newStatus === 'PENDING') {
    icon = '⏳';
    badgeColor = '#eab308';
    title = isMr ? 'काम प्रलंबित ठेवले (Pending)' : 'Marked as Pending';
    defaultDesc = isMr
      ? 'तपासणी किंवा साहित्याच्या उपलब्धतेसाठी तक्रार प्रलंबित ठेवली आहे.'
      : 'Awaiting site inspection, parts, or administrative approval.';
  } else if (newStatus === 'RESOLVED') {
    icon = '✅';
    badgeColor = '#10b981';
    title = isMr ? 'काम पूर्ण झाले (Resolved)' : 'Work Resolved & Completed';
    defaultDesc = complaint?.resolutionNote || (isMr
      ? 'समस्येचे काम यशस्वीरीत्या पूर्ण झाले आहे.'
      : 'Work successfully completed and resolved.');
  } else if (newStatus === 'CLOSED') {
    icon = '🔒';
    badgeColor = '#64748b';
    title = isMr ? 'तक्रार बंद केली (Closed)' : 'Complaint Verified & Closed';
    defaultDesc = isMr
      ? 'तक्रार पडताळणीअंती दफ्तरी बंद करण्यात आली.'
      : 'Complaint verified and closed.';
  } else if (newStatus === 'REOPENED') {
    icon = '↻';
    badgeColor = '#ef4444';
    title = isMr ? 'तक्रार पुन्हा उघडली (Reopened)' : 'Complaint Reopened';
    defaultDesc = isMr
      ? 'पुढील तपासणी अथवा कामासाठी तक्रार पुन्हा उघडण्यात आली आहे.'
      : 'Complaint reopened for further review or follow-up.';
  } else {
    icon = '📋';
    title = isMr ? 'स्थिती बदलली' : `Status: ${newStatus.replaceAll('_', ' ')}`;
    defaultDesc = isMr ? 'स्थिती अद्ययावत केली गेली.' : `Status updated to ${newStatus}.`;
  }

  // Determine user remark vs system note
  let userRemark = null;
  let systemNote = defaultDesc;

  if (comment && comment !== defaultDesc) {
    userRemark = comment;
  }
  if (!userRemark && newStatus === 'RESOLVED' && complaint?.resolutionNote) {
    userRemark = complaint.resolutionNote;
  }

  return {
    id: h?.id || `${index}-${newStatus}`,
    stepNumber: index + 1,
    totalSteps: total,
    createdAt: h?.createdAt,
    changedBy: h?.changedBy,
    newStatus,
    oldStatus,
    title,
    icon,
    badgeColor,
    isInitial,
    isLatest,
    userRemark,
    systemNote
  };
}

export default function ComplaintTimeline({ history = [], complaint = null, isMr = false }) {
  const [order, setOrder] = useState('asc'); // 'asc' = Step 1 -> Latest (Story order)

  const rawHistory = (history || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (!rawHistory.length) {
    return (
      <div className="stepper-empty-box">
        {isMr ? 'अजून कोणताही इतिहास उपलब्ध नाही.' : 'No activity recorded yet.'}
      </div>
    );
  }

  const allSteps = rawHistory.map((h, i) =>
    getTimelineStepInfo(h, complaint, i, rawHistory.length, isMr)
  );

  const displaySteps = order === 'asc' ? allSteps : allSteps.slice().reverse();

  return (
    <div className="complaint-stepper-wrap">
      {/* Header bar with step counter and order toggle */}
      <div className="stepper-header-bar">
        <div className="stepper-title-group">
          <h4>{isMr ? 'तक्रारीचा प्रवास' : 'Activity Journey'}</h4>
          <span className="stepper-count-badge">
            {allSteps.length} {isMr ? 'टप्पे' : `step${allSteps.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="stepper-order-toggle" role="group" aria-label="Timeline Order">
          <button
            type="button"
            className={`stepper-toggle-btn ${order === 'asc' ? 'active' : ''}`}
            onClick={() => setOrder('asc')}
            title="Read in order: Step 1 to latest status"
          >
            {isMr ? '१ ते शेवट (प्रवास)' : 'Step 1 → Latest'}
          </button>
          <button
            type="button"
            className={`stepper-toggle-btn ${order === 'desc' ? 'active' : ''}`}
            onClick={() => setOrder('desc')}
            title="View latest update on top"
          >
            {isMr ? 'नवीनतम आधी' : 'Latest First'}
          </button>
        </div>
      </div>

      {/* Stepper vertical track */}
      <div className="stepper-track-list">
        {displaySteps.map((step, idx) => {
          const isLastNode = idx === displaySteps.length - 1;
          return (
            <div
              key={step.id}
              className={`stepper-node ${step.isLatest ? 'is-current' : ''}`}
            >
              {/* Left rail with icon disc and connector line */}
              <div className="stepper-rail">
                <div
                  className="stepper-icon-disc"
                  style={{
                    borderColor: step.badgeColor,
                    color: step.badgeColor,
                    background: step.isLatest ? '#f0fdf4' : '#ffffff'
                  }}
                >
                  <span className="stepper-disc-emoji">{step.icon}</span>
                </div>
                {!isLastNode && <div className="stepper-line" />}
              </div>

              {/* Right content card */}
              <div
                className="stepper-content-card"
                style={{
                  borderLeftColor: step.badgeColor
                }}
              >
                {/* Step badge & timestamp */}
                <div className="stepper-top-meta">
                  <div className="stepper-step-tag">
                    <span className="step-num">
                      {isMr ? `टप्पा ${step.stepNumber} / ${step.totalSteps}` : `Step ${step.stepNumber} of ${step.totalSteps}`}
                    </span>
                    {step.isLatest && (
                      <span className="current-pulse-badge">
                        <span className="pulse-dot" />
                        {isMr ? 'सद्यस्थिती (Current)' : 'Current Status'}
                      </span>
                    )}
                    {step.isInitial && !step.isLatest && (
                      <span className="initial-step-badge">
                        {isMr ? 'सुरुवात' : 'Start'}
                      </span>
                    )}
                  </div>
                  <span className="stepper-time">
                    {fmtDateTime(step.createdAt)}
                  </span>
                </div>

                {/* Headline and Status Pill */}
                <div className="stepper-headline-row">
                  <strong className="stepper-headline">{step.title}</strong>
                  <StatusPill>{step.newStatus}</StatusPill>
                </div>

                {/* Actor */}
                <div className="stepper-actor">
                  👤 <b>{isMr ? 'कृती कर्ता:' : 'Action by:'}</b>{' '}
                  <span>
                    {step.changedBy?.name || (isMr ? 'सिस्टम' : 'System')}
                    {step.changedBy?.mobile ? ` (${step.changedBy.mobile})` : ''}
                  </span>
                </div>

                {/* User remark or system note */}
                {step.userRemark ? (
                  <div className="stepper-user-remark">
                    <span className="remark-quote-icon">💬</span>
                    <div className="remark-body">
                      <span className="remark-label">{isMr ? 'नोंद / शेरा:' : 'Remark / Update:'}</span>
                      <p className="remark-text">{step.userRemark}</p>
                    </div>
                  </div>
                ) : (
                  <div className="stepper-system-note">
                    {step.systemNote}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
