import React from 'react';

/**
 * Official WardDesk Logo Mark (Concept 3: Ward Location Hub & Desk)
 * Integrates an official municipal location pin, golden apex, and geometric 'W'.
 * Optimized bounding box (viewBox="16 6 68 89") ensures the mark renders large,
 * bold and prominent without wasteful margin inside containers.
 */
export function BrandIcon({
  size = 32,
  variant = 'light', // 'light' (on white tile) or 'dark' (on dark tile)
  className = '',
  pinColor,
  accentColor,
  strokeColor,
  subStrokeColor,
  style = {}
}) {
  const isDarkTile = variant === 'dark';
  const effectivePinColor = pinColor || (isDarkTile ? '#2563eb' : '#1e3a5f');
  const effectiveAccentColor = accentColor || (isDarkTile ? '#fbbf24' : '#f59e0b');
  const effectiveStrokeColor = strokeColor || '#ffffff';
  const effectiveSubStrokeColor = subStrokeColor || (isDarkTile ? '#67e8f9' : '#38bdf8');

  return (
    <svg
      width={size}
      height={size}
      viewBox="16 6 68 89"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-icon-svg ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Civic Location Pin Body */}
      <path
        d="M50 8C33.4 8 20 21.4 20 38C20 60 50 92 50 92C50 92 80 60 80 38C80 21.4 66.6 8 50 8Z"
        fill={effectivePinColor}
      />
      {/* Golden Civic Apex */}
      <polygon points="50,18 61,27 39,27" fill={effectiveAccentColor} />
      {/* Geometric 'W' Desk Lines */}
      <path
        d="M33 34L43 62L50 44L57 62L67 34"
        stroke={effectiveStrokeColor}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43 62L50 44L57 62"
        stroke={effectiveSubStrokeColor}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base Node */}
      <circle cx="50" cy="91" r="2.5" fill={effectiveAccentColor} />
    </svg>
  );
}

export default BrandIcon;
