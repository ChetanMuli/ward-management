'use strict';

require('dotenv').config();
const {
  sequelize, Ward, Area, House, Family, Person, PersonBirthday,
  VoterProfile, Shop, Complaint, User, Role, Employee
} = require('../models');
const { syncPersonBirthday } = require('../services/wardDay.service');

async function seedWard3DemoData() {
  console.log('[SEED] Starting Ward 3 demo data seeding...');

  const ward = await Ward.findOne({ where: { wardNumber: 'W-03' } });
  if (!ward) {
    throw new Error('Ward W-03 not found in database!');
  }
  console.log(`[SEED] Found Ward 3 (id: ${ward.id}, name: ${ward.name})`);

  // Get areas of Ward 3
  const areas = await Area.findAll({ where: { wardId: ward.id } });
  const areaMap = {};
  areas.forEach(a => {
    areaMap[a.name] = a.id;
  });
  console.log(`[SEED] Areas found: ${Object.keys(areaMap).join(', ')}`);

  // Get Ward 3 Nagarsevaks and Employees for assignment
  const nagarsevaks = await User.findAll({
    where: { wardId: ward.id },
    include: [{ model: Role, where: { name: 'NAGARSEVAK' } }]
  });
  const nagarsevakYogiraj = nagarsevaks.find(u => u.name.includes('Yogiraj')) || nagarsevaks[0];
  const nagarsevakGauri = nagarsevaks.find(u => u.name.includes('Gauri')) || nagarsevaks[1] || nagarsevaks[0];
  const nagarsevakRugved = nagarsevaks.find(u => u.name.includes('Rugved')) || nagarsevaks[2] || nagarsevaks[0];
  const nagarsevakJyoti = nagarsevaks.find(u => u.name.includes('Jyoti')) || nagarsevaks[3] || nagarsevaks[0];

  const fieldEmpUser = await User.findOne({
    where: { wardId: ward.id },
    include: [{ model: Role, where: { name: 'EMPLOYEE' } }]
  });

  const fieldEmployeeRecord = await Employee.findOne({
    where: { wardId: ward.id }
  });

  const reporterUser = await User.findOne({
    include: [{ model: Role, where: { name: 'SUPER_ADMIN' } }]
  });

  // 1. CREATE HOUSES & FAMILIES IN WARD 3
  const houseDefs = [
    {
      areaName: 'Professor Colony',
      houseNumber: 'B-12',
      address: 'Plot No. 12, Prasad Bungalow, Gulmohar Road, Professor Colony, Savedi, Ahilyanagar - 414003',
      landmark: 'Near Professor Colony Water Tank',
      ownership: 'OWN',
      familyName: 'Deshmukh',
      notes: 'Ward 3 Demo House - Professor Colony'
    },
    {
      areaName: 'Pankaj Colony',
      houseNumber: 'Flat 302',
      address: 'Flat 302, Building A, Sai Shraddha Residency, Pankaj Colony, Savedi, Ahilyanagar - 414003',
      landmark: 'Opposite Pankaj Garden',
      ownership: 'OWN',
      familyName: 'Kulkarni',
      notes: 'Ward 3 Demo House - Pankaj Colony'
    },
    {
      areaName: 'Savedi Road',
      houseNumber: 'Row House 7',
      address: 'Row House 7, Trimurti Park, Savedi Road, Near T.V. Center, Ahilyanagar - 414003',
      landmark: 'Behind Reliance Mall',
      ownership: 'RENT',
      familyName: 'Shinde',
      notes: 'Ward 3 Demo House - Savedi Road'
    },
    {
      areaName: 'Govindpura',
      houseNumber: 'House No. 45',
      address: 'House No. 45, Guruprasad, Govindpura Gaothan, Savedi, Ahilyanagar - 414003',
      landmark: 'Near Vitthal Mandir',
      ownership: 'OWN',
      familyName: 'Gaikwad',
      notes: 'Ward 3 Demo House - Govindpura'
    },
    {
      areaName: 'Yashwantnagar',
      houseNumber: 'Plot 88',
      address: 'Plot 88, Shivneri Niwas, Yashwantnagar Ring Road, Near Ahilya Garden, Ahilyanagar - 414003',
      landmark: 'Near Ahilya Garden Main Gate',
      ownership: 'OWN',
      familyName: 'More',
      notes: 'Ward 3 Demo House - Yashwantnagar'
    },
    {
      areaName: 'T.V. Center',
      houseNumber: 'Flat 104',
      address: 'Flat 104, Vrindavan Complex, T.V. Center Chowk, Savedi, Ahilyanagar - 414003',
      landmark: 'Near Doordarshan Kendra',
      ownership: 'RENT',
      familyName: 'Joshi',
      notes: 'Ward 3 Demo House - T.V. Center'
    }
  ];

  const familyRecords = {};

  for (const hDef of houseDefs) {
    const areaId = areaMap[hDef.areaName] || areas[0].id;
    let house = await House.findOne({
      where: { houseNumber: hDef.houseNumber, areaId }
    });
    if (!house) {
      house = await House.create({
        areaId,
        houseNumber: hDef.houseNumber,
        address: hDef.address,
        landmark: hDef.landmark,
        city: 'Ahilyanagar',
        pincode: '414003',
        houseType: hDef.houseNumber.includes('Flat') ? 'FLAT' : 'INDEPENDENT_HOUSE',
        ownership: hDef.ownership,
        verificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        notes: hDef.notes
      });
      console.log(`[SEED] Created House: ${hDef.houseNumber} in ${hDef.areaName}`);
    }

    let family = await Family.findOne({
      where: { houseId: house.id, familyName: hDef.familyName }
    });
    if (!family) {
      family = await Family.create({
        houseId: house.id,
        familyName: hDef.familyName,
        nativeDistrict: 'Ahilyanagar',
        nativeState: 'Maharashtra',
        status: 'ACTIVE',
        notes: `Demo family for ${hDef.familyName}`
      });
      console.log(`[SEED] Created Family: ${hDef.familyName}`);
    }
    familyRecords[hDef.familyName] = { family, house };
  }

  // 2. CREATE CITIZENS WITH BIRTHDAYS & 18+ FOLLOW-UPS
  // Today is 2026-09-27.
  const personDefs = [
    // --- BIRTHDAYS TODAY (Sep 27) ---
    {
      familyName: 'Deshmukh',
      fullName: 'Anil Babanrao Deshmukh',
      gender: 'MALE',
      dob: '1974-09-27', // Birthday TODAY! Age 52
      mobile: '9822145678',
      occupation: 'College Professor',
      occupationType: 'SERVICE',
      employmentType: 'GOVERNMENT',
      relationshipToHead: 'Self',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },
    {
      familyName: 'Shinde',
      fullName: 'Vaishali Rajendra Shinde',
      gender: 'FEMALE',
      dob: '1985-09-27', // Birthday TODAY! Age 41
      mobile: '9423189012',
      occupation: 'School Teacher',
      occupationType: 'SERVICE',
      employmentType: 'PRIVATE',
      relationshipToHead: 'Wife',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },
    {
      familyName: 'Gaikwad',
      fullName: 'Tejas Sambhaji Gaikwad',
      gender: 'MALE',
      dob: '2008-09-27', // Turns 18 TODAY! (Birthday TODAY + 18+ Follow-up 0 days)
      mobile: '9766453210',
      occupation: 'Student (Diploma Engg)',
      occupationType: 'OTHER',
      relationshipToHead: 'Son',
      followupStatus: 'GUIDANCE_GIVEN',
      followupDate: '2026-09-27',
      followupNotes: 'Doorstep guidance completed. Form 6 online procedure explained. Aadhaar card and passport photo collected for voter list inclusion.',
      voterStatus: 'NOT_SPECIFIED'
    },

    // --- BIRTHDAY TOMORROW (Sep 28) ---
    {
      familyName: 'Kulkarni',
      fullName: 'Shobha Pradeep Kulkarni',
      gender: 'FEMALE',
      dob: '1980-09-28', // Birthday TOMORROW! Age 46
      mobile: '9850123456',
      occupation: 'Bank Officer (SBI)',
      occupationType: 'SERVICE',
      employmentType: 'GOVERNMENT',
      relationshipToHead: 'Wife',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },

    // --- BIRTHDAY DAY AFTER TOMORROW (Sep 29) ---
    {
      familyName: 'More',
      fullName: 'Dattatraya Shripad More',
      gender: 'MALE',
      dob: '1968-09-29', // Birthday in 2 days! Age 58
      mobile: '9922876543',
      occupation: 'Transport Business',
      occupationType: 'BUSINESS',
      relationshipToHead: 'Self',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },

    // --- BIRTHDAYS IN NEXT 3-5 DAYS (Sep 30 & Oct 01) ---
    {
      familyName: 'Joshi',
      fullName: 'Chinmay Makarand Joshi',
      gender: 'MALE',
      dob: '2001-09-30', // Birthday in 3 days! Age 25
      mobile: '9158334455',
      occupation: 'Software Engineer',
      occupationType: 'SERVICE',
      employmentType: 'PRIVATE',
      relationshipToHead: 'Son',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },
    {
      familyName: 'Deshmukh',
      fullName: 'Priya Anil Deshmukh',
      gender: 'FEMALE',
      dob: '2008-10-01', // Turns 18 in 4 days! (Birthday Oct 1 + 18+ Follow-up)
      mobile: '9822987123',
      occupation: 'Student (12th Science)',
      occupationType: 'OTHER',
      relationshipToHead: 'Daughter',
      followupStatus: 'CONTACTED',
      followupDate: '2026-09-25',
      followupNotes: 'Telephonic follow-up done with parent. Student will visit Ward Citizen Center on Saturday for Form 6 registration.',
      voterStatus: 'NOT_SPECIFIED'
    },

    // --- BIRTHDAY YESTERDAY (Sep 26) ---
    {
      familyName: 'Joshi',
      fullName: 'Makarand Vasant Joshi',
      gender: 'MALE',
      dob: '1972-09-26', // Birthday YESTERDAY (Sep 26)
      mobile: '9422055667',
      occupation: 'Consulting Architect',
      occupationType: 'BUSINESS',
      relationshipToHead: 'Self',
      followupStatus: 'COMPLETED',
      voterStatus: 'VOTER'
    },

    // --- 18+ FOLLOW-UPS (TURNING 18 IN 15 DAYS) ---
    {
      familyName: 'Kulkarni',
      fullName: 'Aditya Pradeep Kulkarni',
      gender: 'MALE',
      dob: '2008-10-12', // Turns 18 in 15 days!
      mobile: '9850987654',
      occupation: 'Student (Polytechnic)',
      occupationType: 'OTHER',
      relationshipToHead: 'Son',
      followupStatus: 'DOCUMENTS_PENDING',
      followupDate: '2026-09-22',
      followupNotes: 'Residence proof (electricity bill) copy pending from applicant. Follow-up scheduled for upcoming Sunday.',
      voterStatus: 'NOT_SPECIFIED'
    },

    // --- 18+ FOLLOW-UPS (TURNING 18 IN 28 DAYS) ---
    {
      familyName: 'Shinde',
      fullName: 'Sahil Rajendra Shinde',
      gender: 'MALE',
      dob: '2008-10-25', // Turns 18 in 28 days!
      mobile: '9423654321',
      occupation: 'Student (B.Com 1st Year)',
      occupationType: 'OTHER',
      relationshipToHead: 'Son',
      followupStatus: 'NOT_CONTACTED',
      followupDate: null,
      followupNotes: 'Identified from household survey 2026. Scheduled for field volunteer visit next week.',
      voterStatus: 'NOT_SPECIFIED'
    },

    // --- 18+ FOLLOW-UPS (TURNING 18 IN 49 DAYS) ---
    {
      familyName: 'More',
      fullName: 'Akshay Dattatraya More',
      gender: 'MALE',
      dob: '2008-11-15', // Turns 18 in 49 days
      mobile: '9922334411',
      occupation: 'Student (HSC Arts)',
      occupationType: 'OTHER',
      relationshipToHead: 'Son',
      followupStatus: 'NOT_CONTACTED',
      followupDate: null,
      followupNotes: 'Eligible for special upcoming youth voter drive at Yashwantnagar community hall.',
      voterStatus: 'NOT_SPECIFIED'
    },

    // --- 18+ FOLLOW-UPS (ALREADY COMPLETED - TURNED 18 6 DAYS AGO) ---
    {
      familyName: 'Deshmukh',
      fullName: 'Rohan Anil Deshmukh',
      gender: 'MALE',
      dob: '2008-09-21', // Turned 18 on Sep 21 (-6 days)
      mobile: '9822456789',
      occupation: 'College Student (BCA)',
      occupationType: 'OTHER',
      relationshipToHead: 'Son',
      followupStatus: 'COMPLETED',
      followupDate: '2026-09-23',
      followupNotes: 'Form 6 successfully submitted on Voter Portal. Application Ref: MH-2026-09-88123. Enrollment confirmed with BLO.',
      voterStatus: 'VOTER'
    },

    // --- 18+ FOLLOW-UPS (ALREADY COMPLETED - TURNED 18 17 DAYS AGO) ---
    {
      familyName: 'Gaikwad',
      fullName: 'Rutuja Sambhaji Gaikwad',
      gender: 'FEMALE',
      dob: '2008-09-10', // Turned 18 on Sep 10 (-17 days)
      mobile: '9766981234',
      occupation: 'Nursing Student',
      occupationType: 'OTHER',
      relationshipToHead: 'Daughter',
      followupStatus: 'COMPLETED',
      followupDate: '2026-09-15',
      followupNotes: 'Voter ID card generated and handed over at Ward Sahayata Kendra.',
      voterStatus: 'VOTER'
    }
  ];

  const createdPersons = {};

  for (const pDef of personDefs) {
    const fRecord = familyRecords[pDef.familyName];
    if (!fRecord) continue;

    let person = await Person.findOne({
      where: { familyId: fRecord.family.id, fullName: pDef.fullName }
    });

    if (!person) {
      person = await Person.create({
        familyId: fRecord.family.id,
        fullName: pDef.fullName,
        gender: pDef.gender,
        dob: pDef.dob,
        mobile: pDef.mobile,
        occupation: pDef.occupation,
        occupationType: pDef.occupationType,
        employmentType: pDef.employmentType,
        relationshipToHead: pDef.relationshipToHead,
        followupStatus: pDef.followupStatus,
        followupDate: pDef.followupDate,
        followupNotes: pDef.followupNotes,
        followupEmployeeId: fieldEmpUser?.id || null,
        residenceStatus: 'OWN',
        presenceStatus: 'AT_HOME',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        notes: 'Ward 3 Demo Citizen'
      });
      console.log(`[SEED] Created Person: ${pDef.fullName} (DOB: ${pDef.dob}, 18+ Status: ${pDef.followupStatus})`);
    } else {
      await person.update({
        dob: pDef.dob,
        followupStatus: pDef.followupStatus,
        followupDate: pDef.followupDate,
        followupNotes: pDef.followupNotes,
        mobile: pDef.mobile
      });
      console.log(`[SEED] Updated Person: ${pDef.fullName} (DOB: ${pDef.dob})`);
    }

    createdPersons[pDef.fullName] = { person, house: fRecord.house };

    // Sync birthday index
    await syncPersonBirthday(person);

    // Create VoterProfile
    let vp = await VoterProfile.findOne({ where: { personId: person.id } });
    if (!vp) {
      await VoterProfile.create({
        personId: person.id,
        status: pDef.voterStatus || 'VOTER',
        constituency: 'Ahilyanagar City',
        votingWard: 'W-03',
        voterCenter: 'Savedi Primary School, Room No. 2'
      });
    } else {
      await vp.update({ status: pDef.voterStatus || vp.status });
    }
  }

  // 3. CREATE COMPLAINTS IN WARD 3
  const complaintDefs = [
    {
      complaintNumber: 'CMP-W03-20260927-0101',
      category: 'WATER',
      priority: 'HIGH',
      status: 'PENDING',
      description: 'Main drinking water distribution pipe leaking heavily near Gulmohar Road corner, Professor Colony. Drinking water is getting wasted on the road and nearby houses are receiving low pressure.',
      location: 'Plot 12, Gulmohar Road, Professor Colony, Savedi',
      personName: 'Anil Babanrao Deshmukh',
      nagarsevakUser: nagarsevakYogiraj,
      slaHours: 48,
      createdAt: new Date('2026-09-27T10:15:00Z')
    },
    {
      complaintNumber: 'CMP-W03-20260926-0202',
      category: 'STREET_LIGHTS',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      description: 'Four streetlights not working from T.V. Center Chowk to Trimurti Park on Savedi Road. Complete darkness at night creating safety hazard for women commuters and walkers.',
      location: 'Savedi Road opposite T.V. Center',
      personName: 'Vaishali Rajendra Shinde',
      nagarsevakUser: nagarsevakGauri,
      assignedEmp: fieldEmpUser,
      slaHours: 48,
      createdAt: new Date('2026-09-26T14:30:00Z')
    },
    {
      complaintNumber: 'CMP-W03-20260926-0303',
      category: 'GARBAGE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      description: 'Municipal garbage collection vehicle has missed Pankaj Colony for consecutive 3 days. Community dustbins overflowing with stray dog menace.',
      location: 'Near Pankaj Colony Garden, Savedi',
      personName: 'Shobha Pradeep Kulkarni',
      nagarsevakUser: nagarsevakRugved,
      assignedEmp: fieldEmpUser,
      slaHours: 24,
      createdAt: new Date('2026-09-26T09:00:00Z')
    },
    {
      complaintNumber: 'CMP-W03-20260925-0404',
      category: 'DRAINAGE',
      priority: 'CRITICAL',
      status: 'RESOLVED',
      description: 'Chamber overflowing and foul drainage water backing up in front of houses in Govindpura Gaothan Lane 2. Urgent suction machine required.',
      location: 'Govindpura Gaothan near Vitthal Mandir',
      personName: 'Tejas Sambhaji Gaikwad',
      nagarsevakUser: nagarsevakJyoti,
      assignedEmp: fieldEmpUser,
      resolutionNote: 'Jetting suction vehicle deployed on 26-Sep. Solid blockage cleared from main line chamber 14. Water flowing smoothly without overflow.',
      resolvedAt: new Date('2026-09-26T16:45:00Z'),
      createdAt: new Date('2026-09-25T11:20:00Z')
    },
    {
      complaintNumber: 'CMP-W03-20260924-0505',
      category: 'ROADS',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      description: 'Dangerous potholes formed in front of Yashwantnagar society entrance after heavy monsoon showers. School vans facing difficulty.',
      location: 'Yashwantnagar Ring Road, Near Ahilya Garden',
      personName: 'Dattatraya Shripad More',
      nagarsevakUser: nagarsevakYogiraj,
      assignedEmp: fieldEmpUser,
      resolutionNote: 'Pothole patching completed with cold mix asphalt and stone dust compaction by ward maintenance contractor team.',
      resolvedAt: new Date('2026-09-26T11:30:00Z'),
      createdAt: new Date('2026-09-24T16:00:00Z')
    },
    {
      complaintNumber: 'CMP-W03-20260927-0606',
      category: 'SANITATION',
      priority: 'LOW',
      status: 'SUBMITTED',
      description: 'Open public drain requires bleaching powder sprinkling and anti-larval spray in T.V. Center residential lane to prevent mosquito breeding.',
      location: 'Vrindavan Complex Lane, T.V. Center Chowk',
      personName: 'Chinmay Makarand Joshi',
      nagarsevakUser: nagarsevakGauri,
      slaHours: 72,
      createdAt: new Date('2026-09-27T15:40:00Z')
    }
  ];

  for (const cDef of complaintDefs) {
    let complaint = await Complaint.findOne({
      where: { complaintNumber: cDef.complaintNumber }
    });

    const citizenInfo = createdPersons[cDef.personName];
    const citizenPersonId = citizenInfo?.person?.id || null;
    const houseId = citizenInfo?.house?.id || null;
    const slaDueAt = cDef.slaHours ? new Date(cDef.createdAt.getTime() + cDef.slaHours * 3600000) : null;

    if (!complaint) {
      await Complaint.create({
        complaintNumber: cDef.complaintNumber,
        wardId: ward.id,
        citizenPersonId,
        houseId,
        submittedByUserId: reporterUser?.id || null,
        assignedNagarsevakUserId: cDef.nagarsevakUser?.id || null,
        assignedEmployeeId: cDef.assignedEmp ? (fieldEmployeeRecord?.id || null) : null,
        location: cDef.location,
        category: cDef.category,
        description: cDef.description,
        priority: cDef.priority,
        status: cDef.status,
        slaDueAt,
        resolutionNote: cDef.resolutionNote || null,
        resolvedAt: cDef.resolvedAt || null,
        createdAt: cDef.createdAt,
        updatedAt: cDef.resolvedAt || cDef.createdAt
      });
      console.log(`[SEED] Created Complaint: ${cDef.complaintNumber} (${cDef.category} - ${cDef.status})`);
    } else {
      await complaint.update({
        description: cDef.description,
        status: cDef.status,
        priority: cDef.priority,
        location: cDef.location,
        resolutionNote: cDef.resolutionNote || null,
        resolvedAt: cDef.resolvedAt || null
      });
      console.log(`[SEED] Updated Complaint: ${cDef.complaintNumber}`);
    }
  }

  // 4. CREATE SHOPS & OFFICES IN WARD 3
  const shopDefs = [
    {
      name: 'Shri Swami Samarth Super Market',
      areaName: 'Professor Colony',
      kind: 'SHOP',
      category: 'Grocery & Supermarket',
      address: 'Shop No. 1-2, Ground Floor, Professor Colony Commercial Complex, Gulmohar Road, Savedi',
      landmark: 'Near Gulmohar Circle',
      ownerName: 'Gajanan Babanrao Deshmukh',
      ownerMobile: '9822345671',
      ownership: 'OWN',
      gstNumber: '27ABCDE1234F1Z5',
      openingHours: '07:30 AM - 10:00 PM',
      latitude: 19.1245000,
      longitude: 74.7382000,
      notes: 'Leading daily grocery and provisions supermarket in Professor Colony.'
    },
    {
      name: 'Sanjivani Medical & General Stores',
      areaName: 'Professor Colony',
      kind: 'SHOP',
      category: 'Pharmacy & Healthcare',
      address: 'Shop 5, Sai Corner, Opp. Shanti Hospital, Professor Colony, Savedi',
      landmark: 'Opposite Shanti Hospital',
      ownerName: 'Dr. Vinayak R. Kulkarni',
      ownerMobile: '9423789012',
      ownership: 'RENT',
      licenseNumber: 'MH-AH-2024-00912',
      openingHours: '08:00 AM - 11:30 PM (24x7 Emergency)',
      latitude: 19.1251000,
      longitude: 74.7390000,
      notes: 'All allopathic, ayurvedic medicines, and generic drugs available.'
    },
    {
      name: 'Atharva Enterprises & Hardware',
      areaName: 'Pankaj Colony',
      kind: 'SHOP',
      category: 'Hardware & Electricals',
      address: 'Shop No. 8, Pankaj Heights, Savedi-Pipeline Road, Ahilyanagar',
      landmark: 'Near Pankaj Colony Water Tank',
      ownerName: 'Nilesh Ramdas Shinde',
      ownerMobile: '9850234567',
      ownership: 'OWN',
      gstNumber: '27XYZAB9876C1Z2',
      openingHours: '08:30 AM - 08:30 PM',
      latitude: 19.1278000,
      longitude: 74.7412000,
      notes: 'Sanitary fittings, electrical wires, paints and household plumbing equipment.'
    },
    {
      name: 'Kalyani Sweets & Bakers',
      areaName: 'Pankaj Colony',
      kind: 'SHOP',
      category: 'Bakery & Confectionery',
      address: 'Shop 3, Trimurti Complex, Pankaj Colony Chowk, Savedi',
      landmark: 'Near Pankaj Garden',
      ownerName: 'Sunil Jagannath Pawar',
      ownerMobile: '9890456789',
      ownership: 'RENT',
      openingHours: '07:00 AM - 10:00 PM',
      latitude: 19.1285000,
      longitude: 74.7420000,
      notes: 'Fresh bakery items, birthday cakes, traditional snacks and sweets.'
    },
    {
      name: 'Adv. S. K. Gaikwad & Associates',
      areaName: 'Govindpura',
      kind: 'OFFICE',
      category: 'Advocate / Legal Consultancy',
      address: 'Office No. 102, 1st Floor, Gaikwad Chamber, Govindpura Main Road, Ahilyanagar',
      landmark: 'Near Old Savedi Naka',
      ownerName: 'Adv. Santosh Khanderao Gaikwad',
      ownerMobile: '9422012345',
      ownership: 'OWN',
      openingHours: '10:00 AM - 08:00 PM',
      latitude: 19.1192000,
      longitude: 74.7354000,
      notes: 'Civil litigation, revenue matters, property registration and legal deed documentation.'
    },
    {
      name: 'V. M. Joshi & Co. (Chartered Accountants)',
      areaName: 'T.V. Center',
      kind: 'OFFICE',
      category: 'Chartered Accountant / Tax Consultant',
      address: 'Suite 201, Vrindavan Business Hub, T.V. Center Chowk, Savedi, Ahilyanagar',
      landmark: 'Near Doordarshan Kendra',
      ownerName: 'CA Vivek M. Joshi',
      ownerMobile: '9822901234',
      ownership: 'OWN',
      openingHours: '09:30 AM - 07:00 PM',
      latitude: 19.1215000,
      longitude: 74.7371000,
      notes: 'Income Tax filing, GST compliance, auditing and financial project consultancy.'
    },
    {
      name: 'TechNova Solutions & Citizen Portal Hub',
      areaName: 'Savedi Road',
      kind: 'OFFICE',
      category: 'IT Consultancy & Citizen Services',
      address: 'Shop 12, First Floor, City Pride Mall, Savedi Road, Ahilyanagar',
      landmark: 'Near Reliance Smart Point',
      ownerName: 'Abhishek Suresh More',
      ownerMobile: '9766789012',
      ownership: 'RENT',
      openingHours: '09:00 AM - 09:00 PM',
      latitude: 19.1230000,
      longitude: 74.7365000,
      notes: 'Software development, MahaOnline citizen services, Aadhaar / PAN card assistance.'
    },
    {
      name: 'Aarogyam Polyclinic & Diagnostic Center',
      areaName: 'Yashwantnagar',
      kind: 'OFFICE',
      category: 'Doctor Clinic & Pathology',
      address: 'Plot 15, Ground Floor, Yashwantnagar Ring Road, Near Ahilya Garden, Savedi',
      landmark: 'Near Ahilya Garden Main Gate',
      ownerName: 'Dr. Snehal P. Chavan (MD, Medicine)',
      ownerMobile: '9850678901',
      ownership: 'RENT',
      openingHours: '09:00 AM - 01:00 PM, 05:00 PM - 09:30 PM',
      latitude: 19.1260000,
      longitude: 74.7435000,
      notes: 'Consulting physician clinic, blood tests, ECG, and general health checkup.'
    }
  ];

  for (const sDef of shopDefs) {
    const areaId = areaMap[sDef.areaName] || areas[0].id;
    let shop = await Shop.findOne({
      where: { name: sDef.name, areaId }
    });

    if (!shop) {
      await Shop.create({
        areaId,
        name: sDef.name,
        kind: sDef.kind,
        category: sDef.category,
        address: sDef.address,
        landmark: sDef.landmark,
        ownerName: sDef.ownerName,
        ownerMobile: sDef.ownerMobile,
        ownership: sDef.ownership,
        gstNumber: sDef.gstNumber || null,
        licenseNumber: sDef.licenseNumber || null,
        openingHours: sDef.openingHours,
        latitude: sDef.latitude,
        longitude: sDef.longitude,
        notes: sDef.notes,
        status: 'ACTIVE'
      });
      console.log(`[SEED] Created ${sDef.kind}: ${sDef.name} (${sDef.areaName})`);
    } else {
      await shop.update({
        address: sDef.address,
        category: sDef.category,
        ownerName: sDef.ownerName,
        ownerMobile: sDef.ownerMobile,
        openingHours: sDef.openingHours
      });
      console.log(`[SEED] Updated ${sDef.kind}: ${sDef.name}`);
    }
  }

  console.log('[SEED] Ward 3 demo data seeding completed successfully!');
}

seedWard3DemoData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[SEED FAILURE]:', err);
    process.exit(1);
  });
