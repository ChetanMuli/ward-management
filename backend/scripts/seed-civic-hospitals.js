'use strict';

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../src/config/database');
const { Hospital, Ward, Area } = require('../src/models');

const HOSPITALS_DATA = [
  // W-03: Govindpura / Savedi (Chetan's ward)
  {
    wardNumber: 'W-03',
    areaName: 'Professor Colony',
    name: 'Savedi Urban Primary Health Center (UHC / PHC)',
    type: 'PHC',
    address: 'Near Professor Colony Chowk, Pipe Line Road, Savedi, Ahmednagar - 414003',
    landmark: 'Opposite Savedi Police Chowky',
    phone: '0241-2423108',
    emergencyPhone: '108',
    openingHours: '8:00 AM - 2:00 PM (Daily OPD) · 24x7 Emergency Delivery',
    facilities: 'Free OPD, Mother & Child Care, National Immunization (लसीकरण), Free Medicines, Blood & Sugar Testing, Janani Suraksha Yojana, Dengue & Malaria Clinic',
    notes: 'Municipal Corporation Center. 100% free consultation, free medicines and maternal care for all citizens.',
    latitude: 19.1235000,
    longitude: 74.7342000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-03',
    areaName: 'Savedi Road',
    name: 'Anandrishiji Multispeciality Hospital & Research Center',
    type: 'TRUST',
    address: 'Anandrishiji Marg, Savedi Road, Ahmednagar - 414003',
    landmark: 'Near Premdan Chowk',
    phone: '0241-2451500',
    emergencyPhone: '0241-2451555',
    openingHours: '24 Hours Open (Emergency & Casualty) · OPD: 9:00 AM - 8:00 PM',
    facilities: '24x7 Casualty & Emergency, ICU, ICCU, NICU, Dialysis Center, Cardiac Cath Lab, Blood Bank, CT Scan, 24x7 Ambulance, Ayushman Bharat (PMJAY) Cashless, MJPJAY Scheme',
    notes: 'Renowned charitable trust hospital providing highly subsidized superspeciality medical care. Cashless for Ayushman Bharat & MJPJAY cardholders.',
    latitude: 19.1215000,
    longitude: 74.7312000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-03',
    areaName: 'Pankaj Colony',
    name: 'Sanjeevani Maternity & Surgical Nursing Home',
    type: 'PRIVATE',
    address: 'Plot 24, Pankaj Colony, Near T.V. Center, Savedi, Ahmednagar - 414003',
    landmark: 'Behind Yashwantnagar Garden',
    phone: '0241-2428844',
    emergencyPhone: '9822014455',
    openingHours: '24x7 Maternity Emergency · OPD: 10:00 AM - 1:30 PM & 5:30 PM - 8:30 PM',
    facilities: 'Maternity & Normal Delivery, Cesarean Section, Sonography (USG), Pediatric Care, Newborn Phototherapy Incubator, Laparoscopic Surgery, Cashless Mediclaim',
    notes: 'Specialized mother and infant care center with round-the-clock female gynecologist available.',
    latitude: 19.1278000,
    longitude: 74.7389000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-03',
    areaName: 'Govindpura',
    name: 'Dr. Vikhe Patil Diagnostic & Poly Clinic',
    type: 'CLINIC',
    address: 'Shop 4-6, Govind Chambers, Govindpura, Savedi, Ahmednagar - 414003',
    landmark: 'Near Govindpura Maruti Mandir',
    phone: '0241-2435566',
    emergencyPhone: '102',
    openingHours: '8:30 AM - 9:00 PM (Mon-Sat)',
    facilities: 'Family Physician OPD, Digital ECG, Pathology Collection, Nebulization, First Aid & Dressing, Senior Citizen Preventive Health Desk',
    notes: 'Walk-in civic polyclinic offering affordable diagnosis and preventive health checks.',
    latitude: 19.1192000,
    longitude: 74.7298000,
    status: 'ACTIVE',
  },

  // W-01: Nagapur / Savedi
  {
    wardNumber: 'W-01',
    areaName: 'Nagapur',
    name: 'Nagapur Civic Health Post & Maternity Center',
    type: 'PHC',
    address: 'Near Nagapur Grampanchayat Old Office, Tapovan Road, Ahmednagar - 414003',
    landmark: 'Near Tapovan Garden',
    phone: '0241-2412211',
    emergencyPhone: '108',
    openingHours: '8:00 AM - 2:00 PM (Daily)',
    facilities: 'Free OPD, Immunization (लसीकरण), Maternal Health, Tuberculosis (DOTS) Center, Free Medicines, Janani Suraksha',
    notes: 'Municipal public health facility serving Ward 01 residents with free primary care.',
    latitude: 19.1350000,
    longitude: 74.7410000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-01',
    areaName: 'Tapovan Road',
    name: 'Maxcare Super Speciality Hospital',
    type: 'PRIVATE',
    address: 'Plot 8-10, Tapovan Road, Nagapur, Savedi, Ahmednagar - 414003',
    landmark: 'Opposite State Bank Colony',
    phone: '0241-2418800',
    emergencyPhone: '0241-2418899',
    openingHours: '24 Hours Open (Casualty & ICU) · OPD: 9 AM - 8 PM',
    facilities: '24x7 Trauma & Casualty, Multi-bed ICU, Neuro & Orthopedic Surgery, Digital X-Ray, Pathology, 24x7 Ambulance, Cashless Insurance',
    notes: 'Advanced trauma and critical care hospital equipped with modular operation theatres.',
    latitude: 19.1385000,
    longitude: 74.7452000,
    status: 'ACTIVE',
  },

  // W-02: Delhi Gate / Savedi
  {
    wardNumber: 'W-02',
    areaName: 'Delhi Gate',
    name: 'Municipal Urban Dispensary Delhi Gate',
    type: 'PHC',
    address: 'Near Historic Delhi Gate, Savedi Road, Ahmednagar - 414001',
    landmark: 'Next to Municipal Ward Office',
    phone: '0241-2321100',
    emergencyPhone: '108',
    openingHours: '8:30 AM - 1:30 PM & 4:00 PM - 7:00 PM',
    facilities: 'General OPD, Child Vaccinations, Blood Pressure & Blood Sugar Screening, Free Municipal Medicines',
    notes: 'Civic dispensaries for everyday health complaints and chronic disease medicine refills.',
    latitude: 19.1021000,
    longitude: 74.7330000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-02',
    areaName: 'Professors Colony',
    name: 'Noble Multispeciality Hospital & Trauma Care',
    type: 'PRIVATE',
    address: 'Professors Colony Chowk, Delhi Gate Road, Ahmednagar - 414002',
    landmark: 'Near State Bank of India',
    phone: '0241-2432200',
    emergencyPhone: '0241-2432299',
    openingHours: '24 Hours Open · OPD: 9 AM - 8:30 PM',
    facilities: '24x7 Emergency, Intensive Care Unit (ICU), Joint Replacement, Laparoscopy, In-house Pharmacy, Sonography, Cashless MJPJAY',
    notes: 'Cashless hospital empanelled with Maharashtra state health schemes and private insurers.',
    latitude: 19.1105000,
    longitude: 74.7315000,
    status: 'ACTIVE',
  },

  // W-05: Topkhana / Tarakpur
  {
    wardNumber: 'W-05',
    areaName: 'Tarakpur',
    name: 'Tarakpur Municipal Health Center & OPD',
    type: 'PHC',
    address: 'Opposite Tarakpur ST Bus Stand, Ahmednagar - 414001',
    landmark: 'Near City Bus Stop',
    phone: '0241-2345511',
    emergencyPhone: '108',
    openingHours: '8:00 AM - 2:00 PM (Daily)',
    facilities: 'Commuter Emergency First Aid, OPD, Free Medicines, Vaccination Camp, Dengue Testing',
    notes: 'Centrally located health desk near the regional bus hub.',
    latitude: 19.0985000,
    longitude: 74.7390000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-05',
    areaName: 'Laltaki',
    name: 'Apex Critical Care & Heart Institute',
    type: 'PRIVATE',
    address: 'Laltaki Road, Topkhana, Ahmednagar - 414001',
    landmark: 'Near Old Water Tank',
    phone: '0241-2349900',
    emergencyPhone: '0241-2349999',
    openingHours: '24 Hours Open (Emergency & ICCU)',
    facilities: '24x7 Cardiac Emergency, Cath Lab, Angiography & Angioplasty, ICCU, 24x7 Cardiac Ambulance, Blood Bank',
    notes: 'Dedicated cardiac and critical care facility with on-duty interventional cardiologists.',
    latitude: 19.0965000,
    longitude: 74.7375000,
    status: 'ACTIVE',
  },

  // W-06: Savedi
  {
    wardNumber: 'W-06',
    areaName: 'Savedi Village',
    name: 'Savedi Gaothan Arogya Vardhini Kendra',
    type: 'PHC',
    address: 'Grampanchayat Building, Savedi Gaothan, Ahmednagar - 414003',
    landmark: 'Near Savedi Vithal Mandir',
    phone: '0241-2425511',
    emergencyPhone: '108',
    openingHours: '8:30 AM - 1:30 PM & 4:00 PM - 7:00 PM',
    facilities: 'Free Civic OPD, Ayurvedic Consultation (आयुष), Free Medicines, Women Health Clinic, Diabetes Care',
    notes: 'Community wellness center equipped with AYUSH doctor and diagnostic screening.',
    latitude: 19.1250000,
    longitude: 74.7360000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-06',
    areaName: 'Shramik Nagar',
    name: 'City Care Hospital & Laparoscopy Center',
    type: 'PRIVATE',
    address: 'Shramik Nagar Main Road, Savedi, Ahmednagar - 414003',
    landmark: 'Behind Labour Court',
    phone: '0241-2429988',
    emergencyPhone: '9850123400',
    openingHours: '24x7 Emergency · OPD: 9 AM - 8 PM',
    facilities: 'Emergency Care, General & Laparoscopic Surgery, ICU, Digital X-Ray, Sonography, Cashless Mediclaim',
    notes: 'Affordable modern surgical hospital with clean private and semi-private rooms.',
    latitude: 19.1220000,
    longitude: 74.7380000,
    status: 'ACTIVE',
  },

  // W-07: Ajinkyanagar / Savedi
  {
    wardNumber: 'W-07',
    areaName: 'Ajinkyanagar',
    name: 'Ajinkyanagar Mother & Child Care Hospital',
    type: 'PRIVATE',
    address: 'Plot 15, Balikashram Road, Ajinkyanagar, Ahmednagar - 414003',
    landmark: 'Near Balikashram Gate',
    phone: '0241-2471122',
    emergencyPhone: '0241-2471133',
    openingHours: '24 Hours Emergency · OPD: 10 AM - 8 PM',
    facilities: 'Maternity Care, NICU, Pediatric ICU, Normal & High-Risk Deliveries, Vaccination, Ayushman Bharat Cashless',
    notes: 'Well-reputed pediatric and maternity nursing home with experienced pediatric surgeons.',
    latitude: 19.1170000,
    longitude: 74.7290000,
    status: 'ACTIVE',
  },

  // W-11: Nalegaon / Court Galli
  {
    wardNumber: 'W-11',
    areaName: 'Nalegaon',
    name: 'District Civil Hospital (जिल्हा सामान्य रुग्णालय)',
    type: 'GOVERNMENT',
    address: 'Hospital Road, Near Court Galli, Nalegaon, Ahmednagar - 414001',
    landmark: 'Opposite District Court Complex',
    phone: '0241-2324422',
    emergencyPhone: '108',
    openingHours: '24 Hours Open (Emergency Casualty & Trauma) · OPD: 8:00 AM - 1:00 PM',
    facilities: '24x7 Trauma Center, Central ICU, Blood Bank, CT Scan, MRI, Digital X-Ray, Dialysis, Jan Aushadhi Store, Free Maternity Delivery, MJPJAY & PMJAY Free Cashless',
    notes: 'Premier government apex tertiary hospital in the district. 100% free treatment for all eligible citizens under Government of Maharashtra health schemes.',
    latitude: 19.0920000,
    longitude: 74.7415000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-11',
    areaName: 'Patwardhan Chowk',
    name: 'Nalegaon Municipal Urban Health Post',
    type: 'PHC',
    address: 'Near Patwardhan Chowk, Nalegaon, Ahmednagar - 414001',
    landmark: 'Near Anandi Bazar',
    phone: '0241-2326677',
    emergencyPhone: '102',
    openingHours: '8:00 AM - 2:00 PM (Mon-Sat)',
    facilities: 'Primary OPD, Pediatric Immunization, Free Medicines, Senior Citizen Checkup, Dengue Surveillance',
    notes: 'Civic primary dispensary for Nalegaon locality.',
    latitude: 19.0945000,
    longitude: 74.7430000,
    status: 'ACTIVE',
  },

  // W-12: Maliwada
  {
    wardNumber: 'W-12',
    areaName: 'Maliwada',
    name: 'Maliwada Urban Primary Health Center',
    type: 'PHC',
    address: 'Maliwada Main Road, Near Old Post Office, Ahmednagar - 414001',
    landmark: 'Near Maliwada ST Stand',
    phone: '0241-2351188',
    emergencyPhone: '108',
    openingHours: '8:00 AM - 2:00 PM (Daily)',
    facilities: 'Free OPD, Maternal Care, Vaccinations, Tuberculosis DOTS Center, Free Generic Medicines, Blood Pressure Camp',
    notes: 'Municipal primary health post providing preventive civic healthcare.',
    latitude: 19.0890000,
    longitude: 74.7360000,
    status: 'ACTIVE',
  },

  // W-14: Station Road / Burudgaon Road
  {
    wardNumber: 'W-14',
    areaName: 'Station Road',
    name: 'Railway Station Civic Medical Post & Railway Hospital',
    type: 'GOVERNMENT',
    address: 'Station Road, Near Ahmednagar Railway Junction, Ahmednagar - 414001',
    landmark: 'Adjacent to Railway Station Main Gate',
    phone: '0241-2374400',
    emergencyPhone: '108',
    openingHours: '24 Hours Emergency First Aid · OPD: 9 AM - 5 PM',
    facilities: '24x7 Casualty First Aid, Ambulance Facility, General Medicine, Railway & Civic Emergency Desk',
    notes: 'Rapid response emergency clinic located near railway junction.',
    latitude: 19.0820000,
    longitude: 74.7490000,
    status: 'ACTIVE',
  },

  // W-16: Kedgaon
  {
    wardNumber: 'W-16',
    areaName: 'Kedgaon',
    name: 'Kedgaon Urban Health Center & Maternity Post',
    type: 'PHC',
    address: 'Near Grampanchayat Chowk, Nagar-Pune Road, Kedgaon, Ahmednagar - 414005',
    landmark: 'Near Kedgaon Bus Stand',
    phone: '0241-2551100',
    emergencyPhone: '108',
    openingHours: '8:00 AM - 2:00 PM (Daily OPD) · 24x7 Delivery',
    facilities: 'Free Civic OPD, 24x7 Delivery Room, Immunization, Free Medicines, Janani Suraksha Yojana, Blood Sugar Screening',
    notes: 'Major primary healthcare and maternal hub for Kedgaon residents.',
    latitude: 19.0750000,
    longitude: 74.7210000,
    status: 'ACTIVE',
  },
  {
    wardNumber: 'W-16',
    areaName: 'Bhushannagar',
    name: 'Sahyadri Multispeciality & Accident Hospital',
    type: 'PRIVATE',
    address: 'Bhushannagar, Nagar-Pune Highway, Kedgaon, Ahmednagar - 414005',
    landmark: 'Near Kinetic Chowk Flyover',
    phone: '0241-2558800',
    emergencyPhone: '0241-2558899',
    openingHours: '24 Hours Open (Emergency Trauma & ICU) · OPD: 9:30 AM - 8:30 PM',
    facilities: '24x7 Highway Trauma Center, Emergency Ambulance, ICU, Orthopedic Fracture Surgery, CT Scan, Cashless Ayushman Bharat & Mediclaim',
    notes: 'Equipped for highway emergency accidents and critical care surgery.',
    latitude: 19.0720000,
    longitude: 74.7190000,
    status: 'ACTIVE',
  },
];

async function main() {
  console.log('[SEED] Connecting to database...');
  await sequelize.authenticate();

  console.log('[SEED] Cleaning up dummy hospital entries...');
  await Hospital.destroy({ where: { address: '5sedtrfgyubhjn' }, force: true });

  console.log('[SEED] Fetching wards and areas...');
  const wards = await Ward.findAll({ include: [{ model: Area, as: 'areas' }] });
  const wardMap = new Map();
  for (const w of wards) {
    wardMap.set(w.wardNumber, w);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of HOSPITALS_DATA) {
    const ward = wardMap.get(item.wardNumber);
    if (!ward) {
      console.warn(`[WARN] Ward ${item.wardNumber} not found, skipping ${item.name}`);
      continue;
    }

    let areaId = null;
    if (item.areaName && ward.areas && ward.areas.length) {
      const match = ward.areas.find((a) => a.name.toLowerCase().includes(item.areaName.toLowerCase()));
      if (match) areaId = match.id;
      else areaId = ward.areas[0].id;
    } else if (ward.areas && ward.areas.length) {
      areaId = ward.areas[0].id;
    }

    const [hosp, created] = await Hospital.findOrCreate({
      where: {
        name: item.name,
        wardId: ward.id,
      },
      defaults: {
        id: uuidv4(),
        wardId: ward.id,
        areaId,
        name: item.name,
        type: item.type,
        address: item.address,
        landmark: item.landmark,
        phone: item.phone,
        emergencyPhone: item.emergencyPhone,
        openingHours: item.openingHours,
        facilities: item.facilities,
        notes: item.notes,
        latitude: item.latitude,
        longitude: item.longitude,
        status: item.status || 'ACTIVE',
      },
    });

    if (created) {
      createdCount++;
      console.log(`[+] Created: [${item.wardNumber}] ${item.name}`);
    } else {
      await hosp.update({
        areaId,
        type: item.type,
        address: item.address,
        landmark: item.landmark,
        phone: item.phone,
        emergencyPhone: item.emergencyPhone,
        openingHours: item.openingHours,
        facilities: item.facilities,
        notes: item.notes,
        latitude: item.latitude,
        longitude: item.longitude,
        status: 'ACTIVE',
      });
      updatedCount++;
      console.log(`[*] Updated: [${item.wardNumber}] ${item.name}`);
    }
  }

  console.log(`\n[SEED COMPLETE] Created: ${createdCount}, Updated: ${updatedCount}`);
  const total = await Hospital.count();
  console.log(`[SEED TOTAL] Current total active hospitals in database: ${total}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
