'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const roleIds = { SUPER_ADMIN: uuidv4(), EMPLOYEE: uuidv4(), CITIZEN: uuidv4() };
    await queryInterface.bulkInsert('roles', [
      { id: roleIds.SUPER_ADMIN, name: 'SUPER_ADMIN', description: 'Councillor / full access', created_at: now, updated_at: now },
      { id: roleIds.EMPLOYEE, name: 'EMPLOYEE', description: 'Ward staff / field employee', created_at: now, updated_at: now },
      { id: roleIds.CITIZEN, name: 'CITIZEN', description: 'Resident / citizen app user', created_at: now, updated_at: now },
    ]);

    const wardSpecs = [
      ['W-01', 'Nagapur / Savedi', 'Ahilyanagar Municipal Corporation Ward 01'],
      ['W-02', 'Delhi Gate / Savedi', 'Ahilyanagar Municipal Corporation Ward 02'],
      ['W-03', 'Govindpura / Savedi', 'Ahilyanagar Municipal Corporation Ward 03'],
      ['W-04', 'Mukundnagar', 'Ahilyanagar Municipal Corporation Ward 04'],
      ['W-05', 'Topkhana / Tarakpur', 'Ahilyanagar Municipal Corporation Ward 05'],
      ['W-06', 'Savedi', 'Ahilyanagar Municipal Corporation Ward 06'],
      ['W-07', 'Ajinkyanagar / Savedi', 'Ahilyanagar Municipal Corporation Ward 07'],
      ['W-08', 'Bolhegaon / Nagapur', 'Ahilyanagar Municipal Corporation Ward 08'],
      ['W-09', 'Shivajinagar / Nagar-Kalyan Road', 'Ahilyanagar Municipal Corporation Ward 09'],
      ['W-10', 'Delhi Gate / Sarjepura', 'Ahilyanagar Municipal Corporation Ward 10'],
      ['W-11', 'Nalegaon / Court Galli', 'Ahilyanagar Municipal Corporation Ward 11'],
      ['W-12', 'Maliwada', 'Ahilyanagar Municipal Corporation Ward 12'],
      ['W-13', 'Bolhegaon / Burudgaon Road', 'Ahilyanagar Municipal Corporation Ward 13'],
      ['W-14', 'Station Road / Burudgaon Road', 'Ahilyanagar Municipal Corporation Ward 14'],
      ['W-15', 'Shivneri Marg / Kedgaon', 'Ahilyanagar Municipal Corporation Ward 15'],
      ['W-16', 'Kedgaon', 'Ahilyanagar Municipal Corporation Ward 16'],
      ['W-17', 'Kinetic Chowk / Kedgaon', 'Ahilyanagar Municipal Corporation Ward 17'],
    ];

    const wards = wardSpecs.map(([ward_number, name, description]) => ({
      id: uuidv4(), ward_number, name, description, status: 'ACTIVE', created_at: now, updated_at: now,
    }));
    await queryInterface.bulkInsert('wards', wards);

    const areaNames = [
      ['W-01', 'Nagapur', 'Nagapur, Ahilyanagar'], ['W-01', 'Savedi-Manmad Road', 'Savedi-Manmad Road, Ahilyanagar'],
      ['W-02', 'Delhi Gate', 'Delhi Gate, Ahilyanagar'], ['W-02', 'Pipeline Road', 'Pipeline Road, Ahilyanagar'],
      ['W-03', 'Govindpura', 'Govindpura, Ahilyanagar'], ['W-03', 'Yashwantnagar', 'Yashwantnagar, Ahilyanagar'],
      ['W-04', 'Mukundnagar', 'Mukundnagar, Ahilyanagar'], ['W-04', 'Mulla Colony', 'Mulla Colony, Ahilyanagar'],
      ['W-05', 'Topkhana', 'Topkhana, Ahilyanagar'], ['W-05', 'Tarakpur', 'Tarakpur, Ahilyanagar'],
      ['W-06', 'Savedi Village', 'Savedi Village, Ahilyanagar'], ['W-06', 'Shramik Nagar', 'Shramik Nagar, Ahilyanagar'],
      ['W-07', 'Ajinkyanagar', 'Ajinkyanagar, Ahilyanagar'], ['W-07', 'Bhutkarwadi', 'Bhutkarwadi, Ahilyanagar'],
      ['W-08', 'Bolhegaon', 'Bolhegaon, Ahilyanagar'], ['W-08', 'MIDC Nagapur', 'MIDC Nagapur, Ahilyanagar'],
      ['W-09', 'Shivajinagar', 'Shivajinagar, Ahilyanagar'], ['W-09', 'Nagar-Kalyan Road', 'Nagar-Kalyan Road, Ahilyanagar'],
      ['W-10', 'Sarjepura', 'Sarjepura, Ahilyanagar'], ['W-10', 'Lonar Galli', 'Lonar Galli, Ahilyanagar'],
      ['W-11', 'Nalegaon', 'Nalegaon, Ahilyanagar'], ['W-11', 'Court Galli', 'Court Galli, Ahilyanagar'],
      ['W-12', 'Maliwada', 'Maliwada, Ahilyanagar'], ['W-12', 'Brahmin Galli', 'Brahmin Galli, Ahilyanagar'],
      ['W-13', 'Tilak Road', 'Tilak Road, Ahilyanagar'], ['W-13', 'Burudgaon Road', 'Burudgaon Road, Ahilyanagar'],
      ['W-14', 'Station Road', 'Station Road, Ahilyanagar'], ['W-14', 'Anandnagar', 'Anandnagar, Ahilyanagar'],
      ['W-15', 'Shivneri Marg', 'Shivneri Marg, Ahilyanagar'], ['W-15', 'Dutt Chowk', 'Dutt Chowk, Ahilyanagar'],
      ['W-16', 'Kedgaon', 'Kedgaon, Ahilyanagar'], ['W-16', 'Rajendranagar', 'Rajendranagar, Ahilyanagar'],
      ['W-17', 'Kinetic Chowk', 'Kinetic Chowk, Ahilyanagar'], ['W-17', 'Sonewadi Road', 'Sonewadi Road, Ahilyanagar'],
    ];
    const areas = areaNames.map(([wardNo, name, description]) => ({
      id: uuidv4(), ward_id: wards.find(w => w.ward_number === wardNo).id,
      name, description, status: 'ACTIVE', created_at: now, updated_at: now,
    }));
    await queryInterface.bulkInsert('areas', areas);

    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
    await queryInterface.bulkInsert('users', [{
      id: uuidv4(), name: 'Dev Super Admin', email: 'admin@ward.local', mobile: '9999999999',
      password_hash: adminPasswordHash, role_id: roleIds.SUPER_ADMIN, status: 'ACTIVE',
      created_at: now, updated_at: now,
    }]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('voter_profiles', null, {});
    await queryInterface.bulkDelete('persons', null, {});
    await queryInterface.bulkDelete('families', null, {});
    await queryInterface.bulkDelete('houses', null, {});
    await queryInterface.bulkDelete('areas', null, {});
    await queryInterface.bulkDelete('wards', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
