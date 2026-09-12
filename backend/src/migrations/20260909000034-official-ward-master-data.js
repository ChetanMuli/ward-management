'use strict';
const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SOURCE = 'https://amc.gov.in/en/election/';
const CORPORATES = 'https://amc.gov.in/en/corporates/';

const WARD_META = {
  'W-01': { population:22234, sc:3563, st:343 }, 'W-02': { population:22015, sc:2462, st:246 },
  'W-03': { population:19384, sc:1312, st:237 }, 'W-04': { population:22405, sc:466, st:105 },
  'W-05': { population:19890, sc:7873, st:122 }, 'W-06': { population:19221, sc:1317, st:126 },
  'W-07': { population:19779, sc:1767, st:416 }, 'W-08': { population:19812, sc:3564, st:229 },
  'W-09': { population:20756, sc:3539, st:316 }, 'W-10': { population:22344, sc:1333, st:153 },
  'W-11': { population:20906, sc:1137, st:117 }, 'W-12': { population:18804, sc:896, st:120 },
  'W-13': { population:18882, sc:3539, st:94 }, 'W-14': { population:19894, sc:1766, st:268 },
  'W-15': { population:18537, sc:3349, st:335 }, 'W-16': { population:22163, sc:2733, st:350 },
  'W-17': { population:19729, sc:4295, st:236 },
};

const MAPS = Object.fromEntries(Array.from({length:17}, (_,i)=>{
  const n=String(i+1).padStart(2,'0');
  return [`W-${n}`, `https://amc.gov.in/wp-content/uploads/Ward_No_${n}.pdf`];
}));

const KEY_AREAS = {
 'W-01':['Nagapur','Savedi-Manmad Road','Dhavanvasti','Tapovan Road','Jakat Naka'],
 'W-02':['Delhi Gate','Dhorgali','Tawalenagar','Pipeline Road','Baijabai Society','Shila Vihar'],
 'W-03':['Govindpura','Yashwantnagar','Pankaj Colony','T.V. Center','Professor Colony','Savedi Road'],
 'W-04':['Mukundnagar','Mulla Colony','Darga Dayera Road','Sheetal Colony'],
 'W-05':['Topkhana','Tarakpur','Sindhi Colony','Yashwant Colony','Laltaki'],
 'W-06':['Savedi Village','Shramik Nagar','Vaiduwadi','Labour Court'],
 'W-07':['Ajinkyanagar','Bhutkarwadi','Borude Mala','Balikashram Road','Pumping Station Road','Tathe Mala'],
 'W-08':['Bolhegaon','Gandhinagar','Bolhegaon Phata','Katore Wasti','MIDC Nagapur','Sangharsh Chowk'],
 'W-09':['Shivajinagar','Renavikar Colony','Datrange Mala','Nagar-Kalyan Road','Londhemala','Ketan Park'],
 'W-10':['Delhi Gate','Sarjepura','Lonar Galli','Thakur Wada','Vanjar Galli','Topkhana'],
 'W-11':['Nalegaon','Kavade Galli','Court Galli','Patwardhan Chowk','Anandi Bazar','Zarekar Galli'],
 'W-12':['Maliwada','Varwande Galli','Brahmin Galli','Bhist Galli','Aman Patil Road'],
 'W-13':['Bolhegaon','Tilak Road','Burudgaon Road','MSEB Colony','Maliwada'],
 'W-14':['Station Road','Anandnagar','Burudgaon Road','Fhulsaunder Mala','Maniknagar','Sainagar'],
 'W-15':['Shivneri Marg','Bohri Chawl','Agarkar Mala','Station Road','Gadalkar Mala','Bhushannagar','Dutt Chowk'],
 'W-16':['Kedgaon','Nagar-Pune Road','Kamble Wasti','Rajendranagar','Kakade Mala','Bhushannagar','Sutargalli'],
 'W-17':['Kinetic Chowk','Station Road','Adarsh Rohidasnagar','Sonewadi Road','Londhe Mala','Kotkar Mala','Devi Road'],
};

const CORPORATORS = [
['W-01','1-A','Borude Sagar Arjun','9822115406','Nationalist Congress Party','Bhairavnath Hospital, Nagapur, Ahilyanagar'],
['W-01','1-B','Dhawan Sharda Digambar','9699224701','Bharatiya Janata Party','Dhavanvasti, Tapovan Road, Ahilyanagar - 414 003'],
['W-01','1-C','Barskar Deepali Nitin','9822415757','Nationalist Congress Party','G.No.1, Jakat Naka, Savedi-Manmad Road, Ahilyanagar'],
['W-01','1-D','Barskar Sampat Vijay','9890408050','Nationalist Congress Party','Savedi, Taluka. Dist. Ahilyanagar'],
['W-02','2-A','Roshni Akash Trimbake','9552690159','Bharatiya Janata Party','Dhorgali, Behind Balikashram, Delhi Gate, Ahilyanagar - 414 001'],
['W-02','2-B','Tawale Mahesh Raghunath','9260029999','Nationalist Congress Party','Plot No. 68, Ahilyanagar-Sambhajinagar Road, Tawalenagar, Savedi, Ahilyanagar'],
['W-02','2-C','Pawar Sandhya Balasaheb','9561252700','Nationalist Congress Party','Baijabai Society, Pipeline Road, Savedi, Ahilyanagar - 414 003'],
['W-02','2-D','Nikhil Babasaheb Ware','9850000852','Bharatiya Janata Party','Bahar Urban Bank Colony, Shila Vihar, Savedi, Ahilyanagar'],
['W-03','3-A','Gade Yogiraj (Appa) Shashikant','9689896982','Shiv Sena (Uddhav Balasaheb Thackeray)','Yashanjali, Yashwantnagar, Near Maruti Mandir, Govindpura, Ahilyanagar - 414 003'],
['W-03','3-B','Gade Jyoti Amol','8975872525','Nationalist Congress Party','Yashwantnagar, Near Hanuman Temple, Govindpura, Ahilyanagar - 414 003'],
['W-03','3-C','Borkar Gauri Ajinkya','9225522255','Nationalist Congress Party','Plot No. 25, Pasaidan, Pankaj Colony, Near T.V. Center, Savedi, Ahilyanagar - 414 003'],
['W-03','3-D','Adv. Rugved Mahendra (Bhiyya) Gandhe','9421999494','Bharatiya Janata Party','270/32, Manisha, Suyog Housing Society, Professor Colony, Savedi Road, Ahilyanagar'],
['W-04','4-A','Sheikh Shehnaz Khalid','9730007861','All India Majlis Ittehdul Muslimeen (AIMIM)','Gh.No.8, Mulla Colony, Near Inam Masjid, Mukundnagar, Ahilyanagar - 414 001'],
['W-04','4-B','Sayyed Shahbaz Ahmed','8408088888','All India Majlis Ittehdul Muslimeen (AIMIM)','Plot No. 96/A, CIV Housing Soc., Darga Dayera Road, Mukundnagar, Ahilyanagar - 414 001'],
['W-04','4-C','Khan Minaj Jafar','9021112312','Indian National Congress','R.G. No. 24/25, Mulla Colony, Mukundnagar, Ahilyanagar - 414 001'],
['W-04','4-D','Khan Shams Samiullah','7020792703','Indian National Congress','Bungalow No. 7, Sheetal Colony, Near Ayesha Masjid, Mukundnagar, Ahilyanagar - 414 001'],
['W-05','5-A','Bhosale Kajal Gorakh','9011761958','Nationalist Congress Party','Bharaskar Colony, Laltaki, Ahilyanagar, Halli Mukkam Bolhegaon, Ahilyanagar'],
['W-05','5-B','Jadhav Dhananjaya Krishna','9111763755','Bharatiya Janata Party','6840, Near Maruti Temple, Topkhana, Ahilyanagar'],
['W-05','5-C','Gambhir HarpreetKaur Jagjit Singh','9162720707','Nationalist Congress Party','Gh.No. 9, Sindhi Colony, Tarakpur, Ahilyanagar - 414 001'],
['W-05','5-D','Punjabi Mohit Pradeep','9766118118','Nationalist Congress Party','Ramkunj, Yashwant Colony, Sambhajinagar Road, Ahilyanagar - 414 001'],
['W-06','6-A','Dulam Manoj Laxman','9225700007','Bharatiya Janata Party','73/D, Near Balaji Temple, Shramik Nagar, Savedi, Ahilyanagar - 414 003'],
['W-06','6-B','Shinde Sonabai Taiga','9922573303','Bharatiya Janata Party','Shindenagar, Vaiduwadi, Savedi, Ahilyanagar'],
['W-06','6-C','Kulkarni Sunita Shrikrishna','8830159083','Bharatiya Janata Party','2070, Ajay Apartment, Near Labour Court, Savedi, Ahilyanagar'],
['W-06','6-D','Karan Uday Karale','8788536401','Bharatiya Janata Party','Near Talathi Office, Savedi Village, Ahilyanagar'],
['W-07','7-A','Varsha Rohan Sanap','8421383333','Bharatiya Janata Party','24, Shivkripa, Ajinkyanagar, Bhutkarwadi, Ahilyanagar'],
['W-07','7-B','Borude Pushpa Anil','9422227473','Bharatiya Janata Party','Rakhmai Niwas, Borude Mala, Balikashram Road, Ahilyanagar'],
['W-07','7-C','Tathe Vandana Vilas','7028639999','Bharatiya Janata Party','Plot No. 1/11, Mahalaxmi Niwas, Pumping Station Road, Tathe Mala, Savedi, Ahilyanagar - 414 003'],
['W-07','7-D','Wakale Babasaheb Sonyabapu','9422226510','Bharatiya Janata Party','Near Tukaram Maharaj Temple, Savedi Village, Savedi, Ahilyanagar'],
['W-08','8-A','Bhingardive Sunita Kisan','9822463388','Nationalist Congress Party','Bhingardive Mall, Gandhinagar, Bolhegaon, Taluka. Dist. Ahilyanagar - 414 111'],
['W-08','8-B','Katore Ashabai Lobhaji','9764656666','Bharatiya Janata Party','Katore Wasti, Bolhegaon Phata, Nagapur, Bolhegaon, Ahilyanagar'],
['W-08','8-C','Katore Navnath Machhindra','8208859009','Shiv Sena','Katore Wasti, MIDC Nagapur, Ahilyanagar'],
['W-08','8-D','Wakale Kumar Babanrao','9730015555','Nationalist Congress Party','Sangharsh Chowk, Savedi, Ahilyanagar - 414 003'],
['W-09','9-A','Shendge Sanjay Chaganrao','9822788388','Shiv Sena','13, Near Satalkar Hospital, Renavikar Colony, Ahilyanagar'],
['W-09','9-B','Datrange Rupali Sandeep','9763161001','Shiv Sena','Datrange Mala, Ahilyanagar'],
['W-09','9-C','Vaishali Sham (Appa) Nalkande','9850184263','Shiv Sena','S.No. 235, 2B/2, Ketan Park, Shivajinagar, Nagar-Kalyan Road, Ahilyanagar'],
['W-09','9-D','Londhe Mahesh Ram','8657161616','Bharatiya Janata Party','Plot No. 11, Londhemala, Nagar-Kalyan Road, Sambhajinagar, Ahilyanagar'],
['W-10','10-A','Chindam Shripad Shankar','9370422222','Bahujan Samaj Party','Mohan Bagh Delhi Gate, Ahilyanagar'],
['W-10','10-B','Dhone Sheetal Ajay (Vahini)','9422220548','Bharatiya Janata Party','D.No.6915, Lonar Galli, Sarjepura, Ahilyanagar'],
['W-10','10-C','Jadhav Mayuri Sushant','7020991165','Bharatiya Janata Party','G.No. 779/80, Thakur Wada, Near Surana Apartment, Topkhana, Ahilyanagar'],
['W-10','10-D','Sagar Raju Murtudkar','8055548547','Bharatiya Janata Party','Gh.No. 2231, Near Mahadev Temple, Vanjar Galli, Ahilyanagar'],
['W-11','11-A','Kavade Umesh (Ganesh) Khanderao','8830303434','Shiv Sena','Kavade Galli, Nalegaon, Ahilyanagar'],
['W-11','11-B','Genappa Sunita Santosh','9420689999','Shiv Sena','Amey Apartment, Court Galli, Ahilyanagar'],
['W-11','11-C','Dagwale Asha Kishore','9028969009','Nationalist Congress Party','4259, Dagwale Building, Patwardhan Chowk, Anandi Bazar, Ahilyanagar'],
['W-11','11-D','Londhe Subhash Sopanrao','9921799992','Bharatiya Janata Party','7556, Lakshmi Nivas, Near Hanuman Temple, Zarekar Galli, Nalegaon, Ahilyanagar'],
['W-12','12-A','Lokhande Mangal Sunil','9423561112','Shiv Sena','Aman Patil Road, Near Kauthi Chi Talim, Maliwada, Ahilyanagar'],
['W-12','12-B','Surekha Sambhaji Kadam','9422222003','Shiv Sena','Shaan Building, Varwande Galli, Maliwada, Ahilyanagar'],
['W-12','12-C','Balasaheb Maruti Borate','9422222079','Shiv Sena','5117/18, Maruti Rabhaji Memorial, Brahmin Galli, Maliwada, Ahilyanagar'],
['W-12','12-D','Kaware Dattatraya Haribhau','9881777760','Shiv Sena','G.No. 5067, Bhist Galli, Maliwada, Ahilyanagar'],
['W-13','13-A','Suresh Laxman Bansode','9499992222','Nationalist Congress Party','Behind Raghavendra Swami Temple, Nikhil Rd. Housing, Bolhegaon, Tal. Dist. Ahilyanagar - 414 111'],
['W-13','13-B','Padole Sujata Mahendra','9850211111','Nationalist Congress Party','Padole Chawl, Tilak Road, Ahilyanagar'],
['W-13','13-C','Shetia Anita Vipul','9822069811','Nationalist Congress Party','MSEB Colony, Burudgaon Road, Ahilyanagar - 414 001'],
['W-13','13-D','Ghule Avinash (Tatya) Haribhau','9765161616','Nationalist Congress Party','4799, Maliwada, Par Gali, Ganapati Mandir Road, Ahilyanagar - 414 001'],
['W-14','14-A','Bhaganagare Prakash Baburao','9422230181','Nationalist Congress Party','Anandnagar, Station Road, Near Lokhandi Bridge, Ahilyanagar'],
['W-14','14-B','Fhulsounder Sunita Bhagwan','9422222236','Nationalist Congress Party','Janaki Niwas, Burudgaon Road, Fhulsaunder Mala, Burudgaon Road, Ahilyanagar'],
['W-14','14-C','Chopada Meena Sanjay','9822025757','Nationalist Congress Party','Maniknagar, Burudgaon Road, Bhosale Akhada, Ahilyanagar - 414 001'],
['W-14','14-D','Ganesh Pundalik Bhosale','9922951596','Nationalist Congress Party','Gurukunj Niwas, Sainagar, Burudgaon Road, Ahilyanagar - 414 001'],
['W-15','15-A','Gavhale Pornima Vijaya','9822991496','Nationalist Congress Party','Bohri Chawl, Shivneri Marg, Shamsher Baba Dargah, Taluka. Dist. Ahilyanagar'],
['W-15','15-B','Datta Somnath Gadalkar','9225541111','Bharatiya Janata Party','Nagar-Kalyan Road, Suyog Park, Gadalkar Mala, T. Dist. Ahilyanagar'],
['W-15','15-C','Gitanjali Sunil Kale','9225700502','Nationalist Congress Party','Vatsalya, Agarkar Mala, Station Road, Taluka. Dist. Ahilyanagar'],
['W-15','15-D','Mohite Sujay Anil','9816061616','Bharatiya Janata Party','Dutt Chowk, Bhushannagar Kedgaon, Tel. Dist. Ahilyanagar'],
['W-16','16-A','Sunita Mahendra Kamble','9881984177','Nationalist Congress Party','368/1, Nagar-Pune Road, Kamble Wasti, Kedgaon, Ahilyanagar'],
['W-16','16-B','Varsha Sujit Kakade','9823047481','Nationalist Congress Party','Plot No. 103, Vaishnavi, Nagar-Pune Road, Behind Toyota Showroom, Rajendranagar, Kakade Mala, Kedgaon, Ahilyanagar'],
['W-16','16-C','Vijay Mohanrao Pathare','9623240303','Bharatiya Janata Party','Dutt Chowk, Bhushannagar, Kedgaon, Ahilyanagar - 414 005'],
['W-16','16-D','Dnyaneshwar alias Amol Shivaji Yewale','9881778181','Bharatiya Janata Party','Kranti Chowk, Sutargalli, Kedgaon, Ahilyanagar - 414 005'],
['W-17','17-A','Mayur Kanhaiyalal Bangre','8888232352','Nationalist Congress Party','Station Road, Kinetic Chowk, Adarsh Rohidasnagar, Ahilyanagar'],
['W-17','17-B','Ashwini Sumit Londhe','7020346518','Nationalist Congress Party','Londhe Mala, Sonewadi Road, Kedgaon, Ahilyanagar'],
['W-17','17-C','Kamal Jalinder Kotkar','9850489999','Bharatiya Janata Party','Kotkar Mala, Behind Aarti Hotel, Kedgaon, Ahilyanagar - 414 005'],
['W-17','17-D','Manoj Shankar Kotkar','9890449126','Bharatiya Janata Party','Kotkar Mala, Devi Road, Kedgaon, Ahilyanagar - 414 005'],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const table = await queryInterface.describeTable('wards');
    const userTable = await queryInterface.describeTable('users');
    const add = async (name, spec) => { if (!table[name]) await queryInterface.addColumn('wards', name, spec); };
    const addUser = async (name, spec) => { if (!userTable[name]) await queryInterface.addColumn('users', name, spec); };
    const { DataTypes } = require('sequelize');
    await add('official_map_url', {type:DataTypes.STRING});
    await add('official_source_url', {type:DataTypes.STRING});
    await add('population_2011', {type:DataTypes.INTEGER});
    await add('sc_population_2011', {type:DataTypes.INTEGER});
    await add('st_population_2011', {type:DataTypes.INTEGER});
    await add('seat_count', {type:DataTypes.INTEGER});
    await add('data_source_note', {type:DataTypes.TEXT});
    await addUser('ward_seat', {type:DataTypes.STRING});
    await addUser('party_name', {type:DataTypes.STRING});
    await addUser('official_address', {type:DataTypes.TEXT});

    const wardRows = await queryInterface.sequelize.query('SELECT id, ward_number, name FROM wards WHERE ward_number LIKE \'W-%\'', {type:QueryTypes.SELECT});
    const ids = {};
    for (const w of wardRows) ids[w.ward_number] = w.id;

    // Re-activate and restore soft-deleted official wards/areas. The previous demo conversion used raw SQL,
    // which changed status but could not clear Sequelize paranoid deleted_at. This is why Ward 01 could disappear.
    for (let i=1;i<=17;i++) {
      const wardNumber=`W-${String(i).padStart(2,'0')}`;
      if (!ids[wardNumber]) {
        const id=uuidv4();
        await queryInterface.bulkInsert('wards',[{id,ward_number:wardNumber,name:`Ward ${i}`,description:`Ahilyanagar Municipal Corporation Ward ${String(i).padStart(2,'0')}`,status:'ACTIVE',deleted_at:null,created_at:now,updated_at:now}]);
        ids[wardNumber]=id;
      }
      const meta=WARD_META[wardNumber];
      const map=MAPS[wardNumber];
      await queryInterface.sequelize.query(`UPDATE wards SET status='ACTIVE', deleted_at=NULL, official_map_url=?, official_source_url=?, population_2011=?, sc_population_2011=?, st_population_2011=?, seat_count=4, data_source_note=?, updated_at=? WHERE id=?`,{replacements:[map,SOURCE,meta.population,meta.sc,meta.st,'Ward master data sourced from Ahilyanagar Municipal Corporation election/ward documents. Key locality labels are application labels; official ward boundaries are represented by the linked AMC map.',now,ids[wardNumber]]});
      await queryInterface.sequelize.query('UPDATE areas SET status=\'ACTIVE\', deleted_at=NULL, updated_at=? WHERE ward_id=?',{replacements:[now,ids[wardNumber]]});
      for (const areaName of (KEY_AREAS[wardNumber]||[])) { const existing=(await queryInterface.sequelize.query('SELECT id FROM areas WHERE ward_id=? AND name=? LIMIT 1',{replacements:[ids[wardNumber],areaName],type:QueryTypes.SELECT}))[0]; if(existing) await queryInterface.sequelize.query('UPDATE areas SET status=\'ACTIVE\', deleted_at=NULL, description=?, updated_at=? WHERE id=?',{replacements:[`${areaName}, Ahilyanagar`,now,existing.id]}); else await queryInterface.bulkInsert('areas',[{id:uuidv4(),ward_id:ids[wardNumber],name:areaName,description:`${areaName}, Ahilyanagar`,status:'ACTIVE',deleted_at:null,created_at:now,updated_at:now}]); }
    }

    const nagRole=(await queryInterface.sequelize.query("SELECT id FROM roles WHERE name='NAGARSEVAK' LIMIT 1",{type:QueryTypes.SELECT}))[0];
    if (nagRole) {
      for (const [wardSeat, seat, name, mobile, party, address] of CORPORATORS) {
        const email=`nagarsevak${wardSeat.replace('W-','').replace(/^0/,'')}${seat.slice(-1)}@ward.local`;
        const existing=(await queryInterface.sequelize.query('SELECT id FROM users WHERE email=? LIMIT 1',{replacements:[email],type:QueryTypes.SELECT}))[0];
        if (existing) {
          await queryInterface.sequelize.query('UPDATE users SET name=?, mobile=?, ward_id=?, ward_seat=?, party_name=?, official_address=?, status=\'ACTIVE\', role_id=?, updated_at=? WHERE id=?',{replacements:[name,mobile,ids[wardSeat],seat,party,address,nagRole.id,now,existing.id]});
        } else {
          // Normally 00033 already created these accounts; this fallback is intentionally omitted to avoid
          // inventing passwords/accounts if the base demo seed is different.
        }
      }
      // Match official records to the already-created nagarsevak accounts by ward/name/mobile.
      for (const [wardSeat, seat, name, mobile, party, address] of CORPORATORS) {
        await queryInterface.sequelize.query('UPDATE users SET ward_seat=?, party_name=?, official_address=?, ward_id=?, status=\'ACTIVE\', updated_at=? WHERE role_id=? AND mobile=?',{replacements:[seat,party,address,ids[wardSeat],now,nagRole.id,mobile]});
      }
    }

    const admin=(await queryInterface.sequelize.query("SELECT id FROM users WHERE email='admin@gmail.com' LIMIT 1",{type:QueryTypes.SELECT}))[0];
    if(admin) await queryInterface.bulkInsert('audit_logs',[{id:uuidv4(),user_id:admin.id,role:'SUPER_ADMIN',action:'REFRESH_OFFICIAL_WARD_MASTER_DATA',entity:'Ward',record_id:null,old_value:null,new_value:JSON.stringify({activeWards:17,officialCorporators:68,source:SOURCE}),ip_address:'127.0.0.1',created_at:now}]);
  },
  async down() {}
};
