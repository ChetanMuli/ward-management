'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');

const FIRST_NAMES_M = ['Amit','Rohan','Sagar','Prasad','Nikhil','Akash','Swapnil','Tejas','Omkar','Sachin','Mahesh','Vishal','Kunal','Aditya','Shreyas','Abhijit','Amol','Mangesh','Rahul','Ritesh'];
const FIRST_NAMES_F = ['Sneha','Meena','Priya','Neha','Pooja','Kavita','Vaishnavi','Riya','Mrunal','Swati','Aarti','Sayali','Pallavi','Anjali','Shruti','Madhura','Gauri','Tejal','Isha','Komal'];
const SURNAMES = ['Deshmukh','Patil','Jadhav','Shinde','Pawar','Kulkarni','Joshi','Bhosale','Chavan','Gaikwad','Kadam','More','Salunkhe','Thorat','Dhole','Kale','Sawant','Mane','Wagh','Darekar'];
const OCCUPATIONS = ['Teacher','Engineer','Business','Shop Owner','Government Employee','Nurse','Driver','Accountant','Electrician','Farmer','Tailor','Homemaker','Student','Software Professional','Retired'];
const RELS = ['HEAD','SPOUSE','SON','DAUGHTER','FATHER','MOTHER'];
const CATEGORIES = ['WATER','ROADS','STREET_LIGHTS','GARBAGE','DRAINAGE','SANITATION','HEALTH','OTHER'];
const AREAS_BY_WARD = {
  'W-01': ['Nagapur','Savedi-Manmad Road'], 'W-02': ['Delhi Gate','Pipeline Road'],
  'W-03': ['Govindpura','Yashwantnagar'], 'W-04': ['Mukundnagar','Mulla Colony'],
  'W-05': ['Topkhana','Tarakpur'], 'W-06': ['Savedi Village','Shramik Nagar'],
  'W-07': ['Ajinkyanagar','Bhutkarwadi'], 'W-08': ['Bolhegaon','MIDC Nagapur'],
  'W-09': ['Shivajinagar','Nagar-Kalyan Road'], 'W-10': ['Sarjepura','Lonar Galli'],
  'W-11': ['Nalegaon','Court Galli'], 'W-12': ['Maliwada','Brahmin Galli'],
  'W-13': ['Tilak Road','Burudgaon Road'], 'W-14': ['Station Road','Anandnagar'],
  'W-15': ['Shivneri Marg','Dutt Chowk'], 'W-16': ['Kedgaon','Rajendranagar'],
  'W-17': ['Kinetic Chowk','Sonewadi Road'],
};
const STREETS = ['Savedi-Manmad Road','Pipeline Road','Yashwantnagar Road','Mukundnagar Road','Topkhana Road','Savedi Road','Ajinkyanagar Road','Bolhegaon Road','Nagar-Kalyan Road','Sarjepura Road','Nalegaon Road','Maliwada Road','Tilak Road','Station Road','Shivneri Marg','Nagar-Pune Road','Kinetic Chowk Road'];

function pick(arr, i) { return arr[i % arr.length]; }
function pad(n) { return String(n).padStart(3, '0'); }
function dobFor(i, memberIndex) {
  // Deterministic DOBs; includes children nearing 18 and multiple birthdays.
  if (i % 17 === 0 && memberIndex === 2) return '2008-10-15';
  if (i % 19 === 0 && memberIndex === 2) return '2008-11-22';
  if (i % 23 === 0 && memberIndex === 2) return '2008-12-05';
  const year = 1958 + ((i * 7 + memberIndex * 11) % 56); // 1958-2013
  const month = ((i + memberIndex * 3) % 12) + 1;
  const day = ((i * 3 + memberIndex * 5) % 27) + 1;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function genderFor(memberIndex) { return memberIndex % 2 === 0 ? 'MALE' : 'FEMALE'; }

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    // ---------------------------------------------------------
// Pune Demo Wards + Areas
// ---------------------------------------------------------

const wardSpecs = [
  ['W-01', 'Nagapur / Savedi', 'Ahilyanagar Municipal Corporation Ward 01'], ['W-02', 'Delhi Gate / Savedi', 'Ahilyanagar Municipal Corporation Ward 02'],
  ['W-03', 'Govindpura / Savedi', 'Ahilyanagar Municipal Corporation Ward 03'], ['W-04', 'Mukundnagar', 'Ahilyanagar Municipal Corporation Ward 04'],
  ['W-05', 'Topkhana / Tarakpur', 'Ahilyanagar Municipal Corporation Ward 05'], ['W-06', 'Savedi', 'Ahilyanagar Municipal Corporation Ward 06'],
  ['W-07', 'Ajinkyanagar / Savedi', 'Ahilyanagar Municipal Corporation Ward 07'], ['W-08', 'Bolhegaon / Nagapur', 'Ahilyanagar Municipal Corporation Ward 08'],
  ['W-09', 'Shivajinagar / Nagar-Kalyan Road', 'Ahilyanagar Municipal Corporation Ward 09'], ['W-10', 'Delhi Gate / Sarjepura', 'Ahilyanagar Municipal Corporation Ward 10'],
  ['W-11', 'Nalegaon / Court Galli', 'Ahilyanagar Municipal Corporation Ward 11'], ['W-12', 'Maliwada', 'Ahilyanagar Municipal Corporation Ward 12'],
  ['W-13', 'Bolhegaon / Burudgaon Road', 'Ahilyanagar Municipal Corporation Ward 13'], ['W-14', 'Station Road / Burudgaon Road', 'Ahilyanagar Municipal Corporation Ward 14'],
  ['W-15', 'Shivneri Marg / Kedgaon', 'Ahilyanagar Municipal Corporation Ward 15'], ['W-16', 'Kedgaon', 'Ahilyanagar Municipal Corporation Ward 16'],
  ['W-17', 'Kinetic Chowk / Kedgaon', 'Ahilyanagar Municipal Corporation Ward 17'],
];

const areaSpecs = {
  'W-01': ['Kothrud Gaothan', 'Paud Road'],
  'W-02': ['Karve Nagar', 'Hingne Khurd'],
  'W-03': ['Erandwane', 'Prabhat Road'],
  'W-04': ['Shivajinagar', 'Model Colony'],
  'W-05': ['Aundh Gaon', 'ITI Road'],
  'W-06': ['Hadapsar Gaon', 'Sasane Nagar'],
};

// Get existing wards
let wards = await queryInterface.sequelize.query(
  'SELECT id, ward_number, name FROM wards ORDER BY ward_number',
  { type: QueryTypes.SELECT }
);

// Convert existing Sample Ward into W-01 if it exists
const sampleWard = wards.find(w => w.ward_number === 'W-01') ||
  wards.find(w => w.name === 'Sample Ward');

if (sampleWard) {
  await queryInterface.bulkUpdate(
    'wards',
    {
      ward_number: 'W-01',
      name: 'Kothrud',
      description: 'Ahilyanagar demo ward covering Kothrud and nearby areas',
      status: 'ACTIVE',
      updated_at: now,
    },
    { id: sampleWard.id }
  );
}

// Create missing wards
for (const [wardNumber, name, description] of wardSpecs) {
  const existing = await queryInterface.sequelize.query(
    'SELECT id FROM wards WHERE ward_number = ? LIMIT 1',
    {
      replacements: [wardNumber],
      type: QueryTypes.SELECT,
    }
  );

  if (!existing.length) {
    await queryInterface.bulkInsert('wards', [{
      id: uuidv4(),
      ward_number: wardNumber,
      name,
      description,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    }]);
  }
}

// Reload wards after creation
wards = await queryInterface.sequelize.query(
  'SELECT id, ward_number, name FROM wards ORDER BY ward_number',
  { type: QueryTypes.SELECT }
);

// Get existing areas
let areas = await queryInterface.sequelize.query(
  'SELECT id, ward_id, name FROM areas ORDER BY name',
  { type: QueryTypes.SELECT }
);

// Create missing areas
for (const [wardNumber, areaNames] of Object.entries(areaSpecs)) {
  const ward = wards.find(w => w.ward_number === wardNumber);

  if (!ward) continue;

  for (const areaName of areaNames) {
    const existing = await queryInterface.sequelize.query(
      'SELECT id FROM areas WHERE ward_id = ? AND name = ? LIMIT 1',
      {
        replacements: [ward.id, areaName],
        type: QueryTypes.SELECT,
      }
    );

    if (!existing.length) {
      await queryInterface.bulkInsert('areas', [{
        id: uuidv4(),
        ward_id: ward.id,
        name: areaName,
        description: `Ahilyanagar demo residential area - ${areaName}`,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      }]);
    }
  }
}

// Reload areas
areas = await queryInterface.sequelize.query(
  'SELECT id, ward_id, name FROM areas ORDER BY name',
  { type: QueryTypes.SELECT }
);

if (!wards.length || !areas.length) return;

    const already = await queryInterface.sequelize.query("SELECT COUNT(*) AS c FROM houses WHERE house_number LIKE 'AHM-V1-%'", { type: QueryTypes.SELECT });
    if (Number(already[0].c) > 0) return;

    const admin = await queryInterface.sequelize.query("SELECT id FROM users WHERE email='admin@ward.local' LIMIT 1", { type: QueryTypes.SELECT });
    const employeeRole = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name='EMPLOYEE' LIMIT 1", { type: QueryTypes.SELECT });
    const adminId = admin[0]?.id || null;

    // Four field employees for assignment/filter/UAT workflows.
    const employeeUsers = [];
    const employeeRows = [];
    if (employeeRole.length) {
      for (let i = 1; i <= 4; i++) {
        const userId = uuidv4();
        const empId = uuidv4();
        employeeUsers.push(userId);
        employeeRows.push({
          id: empId, user_id: userId, designation: 'Field Officer',
          assigned_area_ids: JSON.stringify(areas.slice((i-1)*3, i*3).map(a => a.id)),
          status: 'ACTIVE', created_at: now, updated_at: now,
        });
        await queryInterface.bulkInsert('users', [{
          id: userId, name: `Field Officer ${i}`, email: `field${i}@ward.local`, mobile: `99999999${String(10+i).padStart(2,'0')}`,
          password_hash: await bcrypt.hash('ChangeMe123!', 12), role_id: employeeRole[0].id, status: 'ACTIVE', created_at: now, updated_at: now,
        }]);
      }
      await queryInterface.bulkInsert('employees', employeeRows);
    }

    const houses = [];
    const families = [];
    const people = [];
    const voters = [];
    const houseByIndex = [];
    const familyByIndex = [];

    // 60 Ahilyanagar demo houses / 60 families / ~240 citizens.
    for (let i = 1; i <= 60; i++) {
      const ward = pick(wards, i - 1);
      const wardAreas = areas.filter(a => a.ward_id === ward.id);
      const areaName = pick(AREAS_BY_WARD[ward.ward_number] || wardAreas.map(a=>a.name), i - 1);
      const area = wardAreas.find(a => a.name === areaName) || pick(wardAreas, i - 1);
      const surname = pick(SURNAMES, i - 1);
      const headFirst = pick(FIRST_NAMES_M, i - 1);
      const houseNumber = `AHM-V1-${pad(i)}`;
      const pin = ['411038','411052','411004','411016','411007','411028'][ (i-1) % 6 ];
      const street = pick(STREETS, i - 1);
      const address = `${100 + i}, ${street}, ${area.name}, Ahilyanagar, Maharashtra - ${pin}`;
      const headName = `${headFirst} ${surname}`;
      const houseId = uuidv4();
      const familyId = uuidv4();
      const house = {
        id: houseId, house_number: houseNumber, area_id: area.id, address,
        landmark: pick(['Near Ganpati Temple','Opp. Municipal School','Near Society Gate','Behind Community Hall','Near Bus Stop','Next to Garden'], i-1),
        house_type: i % 9 === 0 ? 'FLAT' : (i % 13 === 0 ? 'CHAWL' : 'INDEPENDENT_HOUSE'),
        ownership: i % 5 === 0 ? 'RENT' : 'OWN', owner_name: headName, owner_mobile: `900000${String(1000+i).slice(-4)}`,
        latitude: (18.47 + (i % 20) * 0.001).toFixed(7), longitude: (73.80 + (i % 20) * 0.001).toFixed(7),
        verification_status: i % 11 === 0 ? 'PENDING' : 'VERIFIED',
        assigned_employee_id: employeeRows.length ? employeeRows[(i-1) % employeeRows.length].id : null,
        status: 'ACTIVE', last_verified_at: i % 11 === 0 ? null : now,
        notes: 'Fictional Ahilyanagar UAT household; not an official civic/electoral record.', created_at: now, updated_at: now,
      };
      houses.push(house); houseByIndex.push(house);
      const family = { id: familyId, house_id: houseId, family_name: surname, status: 'ACTIVE', notes: `Demo ${surname} family for UAT`, created_at: now, updated_at: now };
      families.push(family); familyByIndex.push(family);

      const memberCount = 3 + (i % 2); // 3 or 4 members
      for (let m = 0; m < memberCount; m++) {
        const gender = genderFor(m);
        const first = m === 0 ? headFirst : (gender === 'MALE' ? pick(FIRST_NAMES_M, i + m + 5) : pick(FIRST_NAMES_F, i + m + 7));
        const fullName = `${first} ${surname}`;
        const dob = dobFor(i, m);
        const ageApprox = 2026 - Number(dob.slice(0,4));
        let voterStatus;
        if (ageApprox < 18) voterStatus = 'NON_VOTER';
        else if (ageApprox >= 18 && (i % 3 === 0)) voterStatus = 'VOTER';
        else voterStatus = 'NON_VOTER';
        const personId = uuidv4();
        const mobile = `9000${String(100000 + i*10 + m).slice(-6)}`;
        const followupStatus = voterStatus === 'VOTER' ? ['NOT_CONTACTED','CONTACTED','DOCUMENTS_PENDING'][i % 3] : 'COMPLETED';
        const relationship = pick(RELS, m);
        people.push({
          id: personId, family_id: familyId, full_name: fullName, gender, dob, mobile,
          alternate_mobile: `9010${String(100000 + i*10 + m).slice(-6)}`,
          email: `${first.toLowerCase()}.${surname.toLowerCase()}${i}${m}@example.test`,
          occupation: ageApprox < 18 ? 'Student' : pick(OCCUPATIONS, i + m), relationship_to_head: relationship,
          residence_status: house.ownership, followup_status: followupStatus,
          followup_date: followupStatus === 'COMPLETED' ? now.toISOString().slice(0,10) : null,
          followup_notes: voterStatus === 'VOTER' ? 'Demo 18+ voter registration follow-up.' : null,
          status: 'ACTIVE', verification_status: i % 17 === 0 ? 'PENDING' : 'VERIFIED',
          notes: 'Fictional Ahilyanagar UAT citizen record.', created_at: now, updated_at: now,
        });
        voters.push({
          id: uuidv4(), person_id: personId, status: voterStatus,
          constituency: '225-Ahmednagar City / Ahilyanagar City', voting_ward: ward.ward_number,
          official_voter_id_ref: voterStatus === 'VOTER' ? `DEMO-VOTER-${i}-${m}` : null,
          verified_at: voterStatus === 'VOTER' ? now : null,
          notes: 'Operational demo field only; not an official electoral-roll record.', created_at: now, updated_at: now,
        });
      }
    }

    await queryInterface.bulkInsert('houses', houses);
    await queryInterface.bulkInsert('families', families);
    await queryInterface.bulkInsert('persons', people);
    await queryInterface.bulkInsert('voter_profiles', voters);


    // 30 complaints distributed across categories/statuses.
    const complaintStatuses = ['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REOPENED'];
    const complaints = [];
    for (let i = 1; i <= 30; i++) {
      const house = houseByIndex[(i-1) % houseByIndex.length];
      const family = familyByIndex[(i-1) % familyByIndex.length];
      const citizen = people.find(p => p.family_id === family.id && p.relationship_to_head === 'HEAD');
      const status = pick(complaintStatuses, i-1);
      complaints.push({
        id: uuidv4(), complaint_number: `CMP-AHM-${String(i).padStart(4,'0')}`,
        citizen_person_id: citizen.id, house_id: house.id, category: pick(CATEGORIES, i-1),
        description: pick([
          'Water supply timing issue reported by resident.', 'Road surface requires repair near the house.',
          'Street light is not working.', 'Garbage collection missed on scheduled day.',
          'Drainage blockage reported after rainfall.', 'Sanitation issue near residential lane.',
        ], i-1), priority: ['LOW','MEDIUM','HIGH','CRITICAL'][i % 4], status,
        assigned_employee_id: employeeRows.length ? employeeRows[(i-1) % employeeRows.length].id : null,
        sla_due_at: new Date(Date.now() + (24 + (i % 5) * 24) * 3600 * 1000),
        resolution_note: ['RESOLVED','CLOSED'].includes(status) ? 'Demo resolution recorded for UAT.' : null,
        resolved_at: ['RESOLVED','CLOSED'].includes(status) ? now : null,
        created_at: now, updated_at: now,
      });
    }
    await queryInterface.bulkInsert('complaints', complaints);

    if (adminId) {
  await queryInterface.bulkInsert('audit_logs', [{
    id: uuidv4(),
    user_id: adminId,
    role: 'SUPER_ADMIN',
    action: 'SEED_PUNE_DEMO_DATA',
    entity: 'System',
    record_id: null,
    old_value: null,
    new_value: JSON.stringify({
      wards: wards.length,
      areas: areas.length,
      houses: houses.length,
      families: families.length,
      persons: people.length,
      complaints: complaints.length,
    }),
    ip_address: '127.0.0.1',
    created_at: now,
  }]);
}
  },

  down: async (queryInterface) => {
    const complaints = await queryInterface.sequelize.query("SELECT id FROM complaints WHERE complaint_number LIKE 'CMP-AHM-%'", { type: QueryTypes.SELECT });
    if (complaints.length) await queryInterface.bulkDelete('complaints', { complaint_number: { [require('sequelize').Op.like]: 'CMP-AHM-%' } });
    const houses = await queryInterface.sequelize.query("SELECT id FROM houses WHERE house_number LIKE 'AHM-V1-%'", { type: QueryTypes.SELECT });
    const houseIds = houses.map(x => x.id);
    if (houseIds.length) {
      const families = await queryInterface.sequelize.query('SELECT id FROM families WHERE house_id IN (?)', { replacements: [houseIds], type: QueryTypes.SELECT });
      const familyIds = families.map(x => x.id);
      if (familyIds.length) {
        const persons = await queryInterface.sequelize.query('SELECT id FROM persons WHERE family_id IN (?)', { replacements: [familyIds], type: QueryTypes.SELECT });
        const personIds = persons.map(x => x.id);
        if (personIds.length) await queryInterface.bulkDelete('voter_profiles', { person_id: personIds });
        await queryInterface.bulkDelete('persons', { family_id: familyIds });
      }
      await queryInterface.bulkDelete('families', { house_id: houseIds });
      await queryInterface.bulkDelete('houses', { id: houseIds });
    }
    await queryInterface.bulkDelete('employees', { designation: 'Field Officer' });
    await queryInterface.bulkDelete('users', { email: { [require('sequelize').Op.like]: 'field%@ward.local' } });
  },
};
