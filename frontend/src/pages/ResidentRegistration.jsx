import React from 'react';
import { Navigate } from 'react-router-dom';
import { getUser } from '../services/api';
import { isEmployee, isMaster, isNagarsevak, isSubMaster } from '../rbac';
import { PageHeader } from '../components/Ui';
import RegistrationInviteCard from '../components/RegistrationInviteCard';
import { getLanguage } from '../language';

export default function ResidentRegistration() {
  const user = getUser();
  const isMr = getLanguage() === 'mr';
  const adminDesk = isMaster(user) || isSubMaster(user);
  const staffDesk = isNagarsevak(user) || isEmployee(user);
  if (!adminDesk && !staffDesk) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="admin-data-page resident-registration-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'नागरिक नोंदणी' : 'People & houses'}
        title={isMr ? 'नागरिक नोंदणी' : 'Resident Registration'}
        subtitle={
          adminDesk
            ? (isMr
              ? 'सक्रिय वॉर्ड निवडा आणि त्या वॉर्डची नोंदणी लिंक कॉपी करा. लिंक उघडणारे नागरिक फक्त त्या वॉर्डला जोडले जातात.'
              : 'Choose an active ward, then copy or share its registration link. Residents who open it are assigned to that ward only.')
            : (isMr
              ? 'घर भेटीदरम्यान ही लिंक द्या. उघडणारे नागरिक तुमच्या नियुक्त वॉर्डवर नोंदणी होतील.'
              : 'Share this link during household visits. Residents who open it will register for your assigned ward.')
        }
      />
      <RegistrationInviteCard embedded={false} />
    </div>
  );
}
