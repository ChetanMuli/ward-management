import { getUser } from './services/api';

export const ROLE = {
  MASTER: 'SUPER_ADMIN',
  SUB_MASTER: 'SUB_MASTER_ADMIN',
  NAGARSEVAK: 'NAGARSEVAK',
  EMPLOYEE: 'EMPLOYEE',
  CITIZEN: 'CITIZEN',
};

export function roleOf(user = getUser()) {
  return String(user?.role || user?.roleName || user?.role?.name || '').toUpperCase();
}

export function isMaster(user = getUser()) { return roleOf(user) === ROLE.MASTER; }
export function isSubMaster(user = getUser()) { return roleOf(user) === ROLE.SUB_MASTER; }
export function isNagarsevak(user = getUser()) { return roleOf(user) === ROLE.NAGARSEVAK; }
export function isEmployee(user = getUser()) { return roleOf(user) === ROLE.EMPLOYEE; }

export function userWardId(user = getUser()) {
  return user?.wardId || user?.ward?.id || user?.ward_id || null;
}

export function permissionsOf(user = getUser()) {
  const raw = user?.permissions || user?.employeeProfile?.permissions || user?.employee?.permissions || user?.permissionCodes || [];
  if (Array.isArray(raw)) return raw.map(p => typeof p === 'string' ? p : (p.code || p.name || '')).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(p => typeof p === 'string' ? p : (p.code || p.name || '')).filter(Boolean);
    } catch (_) {}
  }
  if (raw && typeof raw === 'object') return Object.entries(raw).filter(([,v]) => v).map(([k]) => k);
  return [];
}

export function can(permission, user = getUser()) {
  if (isMaster(user)) return true;
  const p = String(permission).toUpperCase();
  return permissionsOf(user).some(x => {
    const q = String(x).toUpperCase();
    return q === p || q === '*' || q === 'ALL' || q === `${p}:ALL`;
  });
}

export function canModule(module, action = 'VIEW', user = getUser()) {
  if (isMaster(user)) return true;
  const m = String(module).toUpperCase();
  const a = String(action).toUpperCase();
  const candidates = [
    `${m}_${a}`, `${m}:${a}`, `${m}.${a}`, `${m}.${a}`.replace('.', '_'),
    `${a}_${m}`, `CAN_${a}_${m}`, `${m}_VIEW`, `VIEW_${m}`,
  ];
  const ps = permissionsOf(user).map(x => String(x).toUpperCase());
  return ps.some(p => p === '*' || p === 'ALL' || candidates.includes(p));
}
