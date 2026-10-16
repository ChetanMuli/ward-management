import React from 'react';
import { NavLink } from 'react-router-dom';
import { getUser } from '../services/api';
import { isMaster, isSubMaster } from '../rbac';
import { UsersIcon, ZapIcon, ClockIcon, UserCheckIcon, ShieldIcon } from './Icons';

export default function TeamNav({ current = 'staff' }) {
  const user = getUser();
  const master = isMaster(user);
  const sub = isSubMaster(user);

  // If user only has access to one page (like a standard employee or councillor), don't show the bar
  if (!master && !sub) return null;

  const links = [
    { to: '/staff', label: 'Team', Icon: UsersIcon, key: 'staff' },
    master && { to: '/ward-activation', label: 'Activation', Icon: ZapIcon, key: 'activation' },
    { to: '/nagarsevak-subscriptions', label: 'Subscriptions', Icon: ClockIcon, key: 'subscriptions' },
    master && { to: '/stakeholders', label: 'Community', Icon: UserCheckIcon, key: 'stakeholders' },
    master && { to: '/sub-admins', label: 'Sub-admins', Icon: ShieldIcon, key: 'subadmins' },
  ].filter(Boolean);

  if (links.length <= 1) return null;

  return (
    <div className="team-subnav-container">
      <nav className="team-subnav-bar" aria-label="Navigation">
        {links.map(l => {
          const IconComponent = l.Icon;
          return (
            <NavLink
              key={l.key}
              to={l.to}
              className={({ isActive }) => `team-subnav-item ${isActive || current === l.key ? 'active' : ''}`}
            >
              <span className="team-subnav-icon">
                <IconComponent size={15} />
              </span>
              <span className="team-subnav-label">{l.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
