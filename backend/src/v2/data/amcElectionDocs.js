'use strict';

const BASE = 'https://amc.gov.in/wp-content/uploads';
const DEO = 'https://ahmednagar.nic.in/district-election-office-ahmednagar/';
const DEO_EN = 'https://ahilyanagar.maharashtra.gov.in/en/district-election-office-ahmednagar/';
const AMC_ELECTION = 'https://amc.gov.in/en/election/';
const DRAFT_ROLL_SIR = 'https://mahaelection.maharashtra.gov.in/ElectorMapping/DraftRollSIR';
const ECI_EROLL = 'https://voters.eci.gov.in/download-eroll?stateCode=S13';

const SIR_ASDD = [
  { ac: 216, name: 'Akole', nameMr: 'अकोले', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882425036400.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536869370.pdf' },
  { ac: 217, name: 'Sangamner', nameMr: 'संगमनेर', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882426016285.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536885597.pdf' },
  { ac: 218, name: 'Shirdi', nameMr: 'शिर्डी', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882426634641.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536895473.pdf' },
  { ac: 219, name: 'Kopargaon', nameMr: 'कोपरगाव', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882426916401.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536919802.pdf' },
  { ac: 220, name: 'Shrirampur', nameMr: 'श्रीरामपूर', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882430027298.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536922079.pdf' },
  { ac: 221, name: 'Newasa', nameMr: 'नेवासा', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882427145024.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536944072.pdf' },
  { ac: 222, name: 'Shevgaon', nameMr: 'शेवगाव', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882427441469.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536953048.pdf' },
  { ac: 223, name: 'Rahuri', nameMr: 'राहुरी', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882427659221.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536973597.pdf' },
  { ac: 224, name: 'Parner', nameMr: 'पारनेर', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882427855995.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800536981976.pdf' },
  { ac: 225, name: 'Ahilyanagar City', nameMr: 'अहिल्यानगर शहर', city: true, asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882428071705.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800537004463.pdf' },
  { ac: 226, name: 'Shrigonda', nameMr: 'श्रीगोंदा', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882428728765.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800537016274.pdf' },
  { ac: 227, name: 'Karjat Jamkhed', nameMr: 'कर्जत जामखेड', asddUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882428932055.pdf', earlierUrl: 'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/05/17800537038689.pdf' },
];

const POLLING = {
  1: 'https://drive.google.com/drive/folders/13MjibggwBiPvzLG7X0qoIZDnnLHt-DJ5?usp=sharing',
  2: 'https://drive.google.com/drive/folders/1mCC7dVlRJwjiTDJ3vC-uFTuE4wfGO5zZ?usp=sharing',
  3: 'https://drive.google.com/drive/folders/1N7xhqchDOzXKZOWr0mFr2CICxtg23MAR?usp=sharing',
  4: 'https://drive.google.com/drive/folders/1_yjV3XZGmjy3e2r4soX6Tj--AGyF8C6G?usp=sharing',
  5: 'https://drive.google.com/drive/folders/1K-La949m0xJobATthoexD9oihrC6gy93?usp=sharing',
  6: 'https://drive.google.com/drive/folders/1e_1sfwJ13-VG8Xv_VeR-dDUrm31lIumc?usp=sharing',
  7: 'https://drive.google.com/drive/folders/1akNDoGZ_rZJqfO48MURjXbpJfudGt50L?usp=sharing',
  8: 'https://drive.google.com/drive/folders/1JkNHVVOB_E8PS5WnDBsN2l79YJegdu6N?usp=sharing',
  9: 'https://drive.google.com/drive/folders/1YfddhmmTwkQndJgq-vfPClK_-eKFTq4k?usp=sharing',
  10: 'https://drive.google.com/drive/folders/1kM71uNE3zw4rO6h9WFqbBjk_xo3Ug4Cc?usp=sharing',
  11: 'https://drive.google.com/drive/folders/1Jcg7Ut07m6CXSkHQ4N1oJEzMH_93xy9y?usp=sharing',
  12: 'https://drive.google.com/drive/folders/1AwyYsL0PgzUCuow7ibvyWywbTeF4lfQK?usp=sharing',
  13: 'https://drive.google.com/drive/folders/1OPmkgvSpIOQOHKncjhxj8KMEaO4k36c2?usp=sharing',
  14: 'https://drive.google.com/drive/folders/1p1cG23AcT9EL2PC9QFl1YdCQFgu_X-QQ?usp=sharing',
  15: 'https://drive.google.com/drive/folders/1bBWZrLOlCDM1xdJbxsucfwt8QHKjKwvU?usp=sharing',
  16: 'https://drive.google.com/drive/folders/1RJ9_bNK3CpHJlDyDqiMnGOXXSmVOAPdk?usp=sharing',
  17: 'https://drive.google.com/drive/folders/1QiiBETEcpot0nTg_ROH5aI_Jz9mmOUF0?usp=sharing',
};

const SIGNED_MAP = {
  1: `${BASE}/Ward_No_01.pdf`,
  2: `${BASE}/Ward_No_02.pdf`,
  3: `${BASE}/Ward_No_03.pdf`,
  4: `${BASE}/Ward_No_04.pdf`,
  5: `${BASE}/Ward_No_05.pdf`,
  6: `${BASE}/Ward_No_06.pdf`,
  7: `${BASE}/Ward_No_07.pdf`,
  8: `${BASE}/Ward_No_08.pdf`,
  9: `${BASE}/9-Sign.pdf`,
  10: `${BASE}/Ward_No_10.pdf`,
  11: `${BASE}/Ward_No_11.pdf`,
  12: `${BASE}/Ward_No_12.pdf`,
  13: `${BASE}/Ward_No_13.pdf`,
  14: `${BASE}/Ward_No_14.pdf`,
  15: `${BASE}/15-Sign.pdf`,
  16: `${BASE}/16-Sign.pdf`,
  17: `${BASE}/Ward_No_17.pdf`,
};

const SUPPLEMENT = {
  5: `${BASE}/2025/12/FinalList_Ward_5_Suppliment.pdf`,
  7: `${BASE}/2025/12/FinalList_Ward_7_Suppliment.pdf`,
  11: `${BASE}/2025/12/FinalList_Ward_11_Suppliment.pdf`,
};

const KEY_AREAS = {
  1: ['Nagapur', 'Savedi-Manmad Road', 'Dhavanvasti', 'Tapovan Road', 'Jakat Naka'],
  2: ['Delhi Gate', 'Dhorgali', 'Tawalenagar', 'Pipeline Road', 'Baijabai Society', 'Shila Vihar'],
  3: ['Govindpura', 'Yashwantnagar', 'Pankaj Colony', 'T.V. Center', 'Professor Colony', 'Savedi Road'],
  4: ['Mukundnagar', 'Mulla Colony', 'Darga Dayera Road', 'Sheetal Colony'],
  5: ['Topkhana', 'Tarakpur', 'Sindhi Colony', 'Yashwant Colony', 'Laltaki'],
  6: ['Savedi Village', 'Shramik Nagar', 'Vaiduwadi', 'Labour Court'],
  7: ['Ajinkyanagar', 'Bhutkarwadi', 'Borude Mala', 'Balikashram Road', 'Pumping Station Road', 'Tathe Mala'],
  8: ['Bolhegaon', 'Gandhinagar', 'Bolhegaon Phata', 'Katore Wasti', 'MIDC Nagapur', 'Sangharsh Chowk'],
  9: ['Shivajinagar', 'Renavikar Colony', 'Datrange Mala', 'Nagar-Kalyan Road', 'Londhemala', 'Ketan Park'],
  10: ['Delhi Gate', 'Sarjepura', 'Lonar Galli', 'Thakur Wada', 'Vanjar Galli', 'Topkhana'],
  11: ['Nalegaon', 'Kavade Galli', 'Court Galli', 'Patwardhan Chowk', 'Anandi Bazar', 'Zarekar Galli'],
  12: ['Maliwada', 'Varwande Galli', 'Brahmin Galli', 'Bhist Galli', 'Aman Patil Road'],
  13: ['Bolhegaon', 'Tilak Road', 'Burudgaon Road', 'MSEB Colony', 'Maliwada'],
  14: ['Station Road', 'Anandnagar', 'Burudgaon Road', 'Fhulsaunder Mala', 'Maniknagar', 'Sainagar'],
  15: ['Shivneri Marg', 'Bohri Chawl', 'Agarkar Mala', 'Station Road', 'Gadalkar Mala', 'Bhushannagar', 'Dutt Chowk'],
  16: ['Kedgaon', 'Nagar-Pune Road', 'Kamble Wasti', 'Rajendranagar', 'Kakade Mala', 'Bhushannagar', 'Sutargalli'],
  17: ['Kinetic Chowk', 'Station Road', 'Adarsh Rohidasnagar', 'Sonewadi Road', 'Londhe Mala', 'Kotkar Mala', 'Devi Road'],
};

const RESULT_ANNEX = [
  { label: 'Wards 1–3', labelMr: 'प्रभाग १–३', wardNos: [1, 2, 3], url: `${BASE}/मतमोजणी-अंतिम-निकाल-प्रभाग-क्र.-123_20.1.26.pdf` },
  { label: 'Wards 4–6', labelMr: 'प्रभाग ४–६', wardNos: [4, 5, 6], url: `${BASE}/2026/01/Namuna_4_Prabhag_No.4,5,6.pdf` },
  { label: 'Wards 7–8', labelMr: 'प्रभाग ७–८', wardNos: [7, 8], url: `${BASE}/मतमोजणी-अंतिम-निकाल-प्रभाग-क्र.-7-8_20.1.26.pdf` },
  { label: 'Wards 9–11', labelMr: 'प्रभाग ९–११', wardNos: [9, 10, 11], url: `${BASE}/मतमोजणी-अंतिम-निकाल-प्रभाग-क्र.-91011_20.1.26.pdf` },
  { label: 'Wards 12–14', labelMr: 'प्रभाग १२–१४', wardNos: [12, 13, 14], url: `${BASE}/मतमोजणी-अंतिम-निकाल-प्रभाग-क्र.121314_20.1.26.pdf` },
  { label: 'Wards 15–17', labelMr: 'प्रभाग १५–१७', wardNos: [15, 16, 17], url: `${BASE}/मतमोजणी-अंतिम-निकाल-प्रभाग-क्र.151617_20.1.26.pdf` },
];

const ACCEPTED_NAGARSEVAK = [
  { name: 'Jagtap Vikas Dadasaheb', nameMr: 'जगताप विकास दादासाहेब', url: `${BASE}/Jagtap_Vikas.pdf` },
  { name: 'Pawar Revannath Dagdu', nameMr: 'पवार रेवणनाथ दगडू', url: `${BASE}/Pawar_Revannath.pdf` },
  { name: 'Nagargoje Babasaheb Santosh', nameMr: 'नागरगोजे बाबासाहेब संतोष', url: `${BASE}/Nagargoje_Babasaheb.pdf` },
  { name: 'Barskar Ravindra Raosaheb', nameMr: 'बारस्कर रविंद्र रावसाहेब', url: `${BASE}/Barskar_Ravindra.pdf` },
  { name: 'Nakade Vishal Rohidas', nameMr: 'नाकाडे विशाल रोहिदास', url: `${BASE}/Nakade_Vishal.pdf` },
];

const WARD_ELECTORS = {
  1: 22088, 2: 21513, 3: 14527, 4: 19256, 5: 14950, 6: 17150, 7: 15833, 8: 18020, 9: 17159,
  10: 22900, 11: 20670, 12: 19382, 13: 15723, 14: 17020, 15: 16656, 16: 18874, 17: 15288,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function wardRows() {
  return Array.from({ length: 17 }, (_, i) => {
    const n = i + 1;
    return {
      ward: `W-${pad(n)}`,
      wardNo: n,
      count: WARD_ELECTORS[n],
      finalListUrl: `${BASE}/2025/12/FinalList_Ward_${n}.pdf`,
      supplementUrl: SUPPLEMENT[n] || null,
      draftListUrl: `${BASE}/2025/11/AMC_DraftList_Ward_${n}_2025.pdf`,
      pollingFolderUrl: POLLING[n],
      mapUrl: SIGNED_MAP[n],
      mapUnsignedUrl: `${BASE}/2025/12/Ward_No_${pad(n)}.pdf`,
      colonies: KEY_AREAS[n] || [],
      sirAc: 225,
    };
  });
}

const electionPayload = {
  title: 'Ahilyanagar Municipal Corporation General Election 2025–26',
  published: '15 December 2025',
  gazetteDate: '19 January 2026',
  sirPublished: 'September 2026',
  cityAc: 225,
  cityAcName: 'Ahilyanagar City',
  sirDistrictUrl: DEO,
  sirDistrictAltUrl: DEO_EN,
  amcElectionUrl: AMC_ELECTION,
  draftRollSirUrl: DRAFT_ROLL_SIR,
  eciErollUrl: ECI_EROLL,
  boothListUrl: `${BASE}/2025/12/FINAL_BOOTH_ADDRESS_WISE_LIST_UPDATE_DT_30_12_2025_OK.pdf`,
  gazetteUrl: `${BASE}/2026/01/Nashik-Part-1-A-19-1-2026-Ahilyanagar.pdf`,
  gazetteAltUrl: `${BASE}/GazetteAhilyanagar.pdf`,
  finalWardNoticeUrl: `${BASE}/FINAL_WARD_22.1.26.pdf`,
  sirLists: SIR_ASDD.filter((x) => x.ac === 225),
  sirUrl: SIR_ASDD.find((x) => x.ac === 225).asddUrl,
  sirEarlierUrl: SIR_ASDD.find((x) => x.ac === 225).earlierUrl,
  rows: wardRows(),
  results: RESULT_ANNEX,
  acceptedNagarsevak: ACCEPTED_NAGARSEVAK,
  contact: {
    department: 'AMC Election Department',
    head: 'Meher Gangadhar Lahare',
    designation: 'Election Department Head',
    email: 'meher.lahare84@mah.gov.in',
    mobile: '8379897111',
    helpline: '1800 233 1455',
    controlRoom: '0241 2323143',
    conductEmail: 'election.cofconduct@gmail.com',
  },
};

module.exports = { electionPayload, SIGNED_MAP, KEY_AREAS };