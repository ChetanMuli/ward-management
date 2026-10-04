import React from 'react';
import { Navigate } from 'react-router-dom';
import { getUser } from '../services/api';
import { isEmployee, isMaster, isNagarsevak, isSubMaster } from '../rbac';
import { PageHeader } from '../components/Ui';
import RegistrationInviteCard from '../components/RegistrationInviteCard';

export default function ResidentRegistration() {
  const user = getUser();
  const adminDesk = isMaster(user) || isSubMaster(user);
  const staffDesk = isNagarsevak(user) || isEmployee(user);
  if (!adminDesk && !staffDesk) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="admin-data-page resident-registration-page">
      <PageHeader
        kicker="People & houses"
        title="Resident registration"
        subtitle={adminDesk
          ? 'Select one ward, then copy or share that ward’s registration link. Residents who open it are assigned to that ward only.'
          : 'Issue this link during household visits. Residents who open it will register for your assigned ward.'}
      />
      <RegistrationInviteCard embedded={false} />
    </div>
  );
}
