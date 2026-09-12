'use strict';
const { v4: uuidv4 } = require('uuid');
const { QueryTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// Source-checked municipal corporator data: Ahilyanagar Municipal Corporation,
// General Election 2025-2026, official corporates directory.
const WARDS = [
  ['W-01','Nagapur / Savedi'],['W-02','Delhi Gate / Savedi'],['W-03','Govindpura / Savedi'],
  ['W-04','Mukundnagar'],['W-05','Topkhana / Tarakpur'],['W-06','Savedi'],
  ['W-07','Ajinkyanagar / Savedi'],['W-08','Bolhegaon / Nagapur'],['W-09','Shivajinagar / Nagar-Kalyan Road'],
  ['W-10','Delhi Gate / Sarjepura'],['W-11','Nalegaon / Court Galli'],['W-12','Maliwada'],
  ['W-13','Bolhegaon / Burudgaon Road'],['W-14','Station Road / Burudgaon Road'],['W-15','Shivneri Marg / Kedgaon'],
  ['W-16','Kedgaon'],['W-17','Kinetic Chowk / Kedgaon'],
];

const AREAS = {
 'W-01':['Nagapur','Savedi-Manmad Road'], 'W-02':['Delhi Gate','Savedi','Pipeline Road'],
 'W-03':['Govindpura','Yashwantnagar','T.V. Center'], 'W-04':['Mukundnagar','Mulla Colony','Darga Dayera Road'],
 'W-05':['Topkhana','Tarakpur','Yashwant Colony'], 'W-06':['Savedi Village','Shramik Nagar','Labour Court'],
 'W-07':['Ajinkyanagar','Bhutkarwadi','Pumping Station Road'], 'W-08':['Bolhegaon','MIDC Nagapur','Sangharsh Chowk'],
 'W-09':['Shivajinagar','Nagar-Kalyan Road','Renavikar Colony'], 'W-10':['Sarjepura','Lonar Galli','Vanjar Galli'],
 'W-11':['Nalegaon','Court Galli','Patwardhan Chowk'], 'W-12':['Maliwada','Brahmin Galli','Varwande Galli'],
 'W-13':['Bolhegaon','Tilak Road','Burudgaon Road'], 'W-14':['Station Road','Anandnagar','Burudgaon Road'],
 'W-15':['Shivneri Marg','Dutt Chowk','Bhushannagar'], 'W-16':['Kedgaon','Nagar-Pune Road','Rajendranagar'],
 'W-17':['Kinetic Chowk','Adarsh Rohidasnagar','Sonewadi Road'],
};

const CORPORATORS = {
'W-01':[
 ['Borude Sagar Arjun','9822115406'],['Dhawan Sharda Digambar','9699224701'],['Barskar Deepali Nitin','9822415757'],['Barskar Sampat Vijay','9890408050']],
'W-02':[
 ['Roshni Akash Trimbake','9552690159'],['Tawale Mahesh Raghunath','9260029999'],['Pawar Sandhya Balasaheb','9561252700'],['Nikhil Babasaheb Ware','9850000852']],
'W-03':[
 ['Gade Yogiraj (Appa) Shashikant','9689896982'],['Gade Jyoti Amol','8975872525'],['Borkar Gauri Ajinkya','9225522255'],['Adv. Rugved Mahendra (Bhiyya) Gandhe','9421999494']],
'W-04':[
 ['Sheikh Shehnaz Khalid','9730007861'],['Sayyed Shahbaz Ahmed','8408088888'],['Khan Minaj Jafar','9021112312'],['Khan Shams Samiullah','7020792703']],
'W-05':[
 ['Bhosale Kajal Gorakh','9011761958'],['Jadhav Dhananjaya Krishna','9111763755'],['Gambhir HarpreetKaur Jagjit Singh','9162720707'],['Punjabi Mohit Pradeep','9766118118']],
'W-06':[
 ['Dulam Manoj Laxman','9225700007'],['Shinde Sonabai Taiga','9922573303'],['Kulkarni Sunita Shrikrishna','8830159083'],['Karan Uday Karale','8788536401']],
'W-07':[
 ['Varsha Rohan Sanap','8421383333'],['Borude Pushpa Anil','9422227473'],['Tathe Vandana Vilas','7028639999'],['Wakale Babasaheb Sonyabapu','9422226510']],
'W-08':[
 ['Bhingardive Sunita Kisan','9822463388'],['Katore Ashabai Lobhaji','9764656666'],['Katore Navnath Machhindra','8208859009'],['Wakale Kumar Babanrao','9730015555']],
'W-09':[
 ['Shendge Sanjay Chaganrao','9822788388'],['Datrange Rupali Sandeep','9763161001'],['Vaishali Sham (Appa) Nalkande','9850184263'],['Londhe Mahesh Ram','8657161616']],
'W-10':[
 ['Chindam Shripad Shankar','9370422222'],['Dhone Sheetal Ajay (Vahini)','9422220548'],['Jadhav Mayuri Sushant','7020991165'],['Sagar Raju Murtudkar','8055548547']],
'W-11':[
 ['Kavade Umesh (Ganesh) Khanderao','8830303434'],['Genappa Sunita Santosh','9420689999'],['Dagwale Asha Kishore','9028969009'],['Londhe Subhash Sopanrao','9921799992']],
'W-12':[
 ['Lokhande Mangal Sunil','9423561112'],['Surekha Sambhaji Kadam','9422222003'],['Balasaheb Maruti Borate','9422222079'],['Kaware Dattatraya Haribhau','9881777760']],
'W-13':[
 ['Suresh Laxman Bansode','9499992222'],['Padole Sujata Mahendra','9850211111'],['Shetia Anita Vipul','9822069811'],['Ghule Avinash (Tatya) Haribhau','9765161616']],
'W-14':[
 ['Bhaganagare Prakash Baburao','9422230181'],['Fhulsounder Sunita Bhagwan','9422222236'],['Chopada Meena Sanjay','9822025757'],['Ganesh Pundalik Bhosale','9922951596']],
'W-15':[
 ['Gavhale Pornima Vijaya','9822991496'],['Datta Somnath Gadalkar','9225541111'],['Gitanjali Sunil Kale','9225700502'],['Mohite Sujay Anil','9816061616']],
'W-16':[
 ['Sunita Mahendra Kamble','9881984177'],['Varsha Sujit Kakade','9823047481'],['Vijay Mohanrao Pathare','9623240303'],['Dnyaneshwar alias Amol Shivaji Yewale','9881778181']],
'W-17':[
 ['Mayur Kanhaiyalal Bangre','8888232352'],['Ashwini Sumit Londhe','7020346518'],['Kamal Jalinder Kotkar','9850489999'],['Manoj Shankar Kotkar','9890449126']],
};

function wardDescription(num,name){return `Ahilyanagar Municipal Corporation ${num} service area — ${name}.`}
function slugWard(num){return num.replace('W-','')}

module.exports = {
 async up(queryInterface) {
  const now = new Date();
  const nagRole = (await queryInterface.sequelize.query("SELECT id FROM roles WHERE name='NAGARSEVAK' LIMIT 1", {type:QueryTypes.SELECT}))[0];
  const empRole = (await queryInterface.sequelize.query("SELECT id FROM roles WHERE name='EMPLOYEE' LIMIT 1", {type:QueryTypes.SELECT}))[0];
  if(!nagRole) return;

  const wardIds = {};
  for(const [num,name] of WARDS){
   let row=(await queryInterface.sequelize.query('SELECT id FROM wards WHERE ward_number=? LIMIT 1',{replacements:[num],type:QueryTypes.SELECT}))[0];
   if(!row){const id=uuidv4();await queryInterface.bulkInsert('wards',[{id,ward_number:num,name,description:wardDescription(num,name),status:'ACTIVE',created_at:now,updated_at:now}]);row={id};}
   else await queryInterface.sequelize.query('UPDATE wards SET name=?, description=?, status=\'ACTIVE\', updated_at=? WHERE id=?',{replacements:[name,wardDescription(num,name),now,row.id]});
   wardIds[num]=row.id;

   const areaNames=AREAS[num]||[];
   const existingAreas=await queryInterface.sequelize.query('SELECT id,name FROM areas WHERE ward_id=? ORDER BY name',{replacements:[row.id],type:QueryTypes.SELECT});
   for(let i=0;i<areaNames.length;i++){
    if(existingAreas[i]) await queryInterface.sequelize.query('UPDATE areas SET name=?, description=?, status=\'ACTIVE\', updated_at=? WHERE id=?',{replacements:[areaNames[i],`${areaNames[i]}, Ahilyanagar`,now,existingAreas[i].id]});
    else await queryInterface.bulkInsert('areas',[{id:uuidv4(),ward_id:row.id,name:areaNames[i],description:`${areaNames[i]}, Ahilyanagar`,status:'ACTIVE',created_at:now,updated_at:now}]);
   }
   if(existingAreas.length>areaNames.length) await queryInterface.sequelize.query('UPDATE areas SET status=\'INACTIVE\', updated_at=? WHERE ward_id=? AND name NOT IN (?)',{replacements:[now,row.id,areaNames],type:QueryTypes.UPDATE});

   for(let i=0;i<4;i++){
    const [name,mobile]=CORPORATORS[num][i];
    const email=`nagarsevak${slugWard(num)}${i+1}@ward.local`;
    const existing=(await queryInterface.sequelize.query('SELECT id FROM users WHERE email=? LIMIT 1',{replacements:[email],type:QueryTypes.SELECT}))[0];
    if(existing) await queryInterface.sequelize.query('UPDATE users SET name=?, mobile=?, ward_id=?, status=\'ACTIVE\', role_id=?, updated_at=? WHERE id=?',{replacements:[name,mobile,row.id,nagRole.id,now,existing.id]});
    else await queryInterface.bulkInsert('users',[{
  id: uuidv4(),
  name,
  email,
  mobile,
  password_hash: await bcrypt.hash('ChangeMe123!', 12),
  role_id: nagRole.id,
  ward_id: row.id,
  permissions: JSON.stringify([]),
  ward_ids: JSON.stringify([row.id]),
  status: 'ACTIVE',
  created_at: now,
  updated_at: now
}]);
   }
  }

  // Demo staff: keep the existing demo employee accounts but make their ward/city identity Ahilyanagar.
  if(empRole){
   for(let i=1;i<=4;i++){
    const email=`field${i}@ward.local`;
    const user=(await queryInterface.sequelize.query('SELECT id FROM users WHERE email=? LIMIT 1',{replacements:[email],type:QueryTypes.SELECT}))[0];
    if(!user) continue;
    const wardNum=`W-0${i}`;
    const wid=wardIds[wardNum];
    await queryInterface.sequelize.query('UPDATE users SET name=?, mobile=?, ward_id=?, updated_at=? WHERE id=?',{replacements:[`Ahilyanagar Field Employee ${i}`,`9${String(8800000000+i)}`,wid,now,user.id]});
    await queryInterface.sequelize.query('UPDATE employees SET ward_id=?, status=\'ACTIVE\', updated_at=? WHERE user_id=?',{replacements:[wid,now,user.id]});
   }
  }

  // Convert clearly-marked Pune demo records only. Registered/operational records are not deleted.
  const houses=await queryInterface.sequelize.query("SELECT id,house_number,area_id,address,notes FROM houses WHERE house_number LIKE 'PUNE-V1-%'",{type:QueryTypes.SELECT});
  const areas=await queryInterface.sequelize.query('SELECT id,ward_id FROM areas WHERE status=\'ACTIVE\' ORDER BY ward_id,name',{type:QueryTypes.SELECT});
  for(let i=0;i<houses.length;i++){
   const h=houses[i];
   const wardNum=WARDS[i%WARDS.length][0]; const wid=wardIds[wardNum]; const wardAreas=areas.filter(a=>a.ward_id===wid); const area=wardAreas[i%Math.max(1,wardAreas.length)];
   const num=`AHM-V1-${String(i+1).padStart(3,'0')}`;
   const pin=['414001','414003','414005','414111'][i%4];
   const oldAddr=String(h.address||'').replace(/Pune/g,'Ahilyanagar');
   const address=oldAddr.includes('Ahilyanagar')?oldAddr.replace(/Maharashtra\s*-?\s*\d{6}/,'Maharashtra - '+pin):`${100+i+1}, ${area?.name||'Ahilyanagar'}, Ahilyanagar, Maharashtra - ${pin}`;
   await queryInterface.sequelize.query('UPDATE houses SET house_number=?, area_id=?, address=?, notes=? WHERE id=?',{replacements:[num,area?.id||h.area_id,address,'Fictional Ahilyanagar UAT household; not an official civic/electoral record.',h.id]});
  }
  await queryInterface.sequelize.query("UPDATE persons SET notes=REPLACE(notes,'Pune','Ahilyanagar'), updated_at=? WHERE notes LIKE '%Pune%'",{replacements:[now]});
  await queryInterface.sequelize.query("UPDATE complaints SET complaint_number=REPLACE(complaint_number,'CMP-PUNE-','CMP-AHM-'), updated_at=? WHERE complaint_number LIKE 'CMP-PUNE-%'",{replacements:[now]});
  await queryInterface.sequelize.query("UPDATE complaints SET location=REPLACE(location,'Pune','Ahilyanagar'), updated_at=? WHERE location LIKE '%Pune%'",{replacements:[now]});
  await queryInterface.sequelize.query("UPDATE voter_profiles SET constituency='225-Ahmednagar City / Ahilyanagar City', notes=REPLACE(COALESCE(notes,''),'Pune','Ahilyanagar'), updated_at=? WHERE notes LIKE '%Pune%' OR constituency LIKE 'Pune%'",{replacements:[now]});

  // The official AMC election site lists 17 current municipal wards. Do not silently delete any extra operator data;
  // keep non-official demo wards inactive so they stop appearing in active ward selectors.
  await queryInterface.sequelize.query("UPDATE wards SET status='INACTIVE', updated_at=? WHERE ward_number NOT IN (?) AND name IN ('Kothrud','Karve Nagar','Erandwane','Shivajinagar','Aundh','Hadapsar','Baner','Balewadi','Pashan','Katraj','Bibwewadi','Dhankawadi','Viman Nagar','Kalyani Nagar','Kondhwa','Warje','Sample Ward')",{replacements:[now,WARDS.map(x=>x[0])]});

  const admin=(await queryInterface.sequelize.query("SELECT id FROM users WHERE email='admin@gmail.com' LIMIT 1",{type:QueryTypes.SELECT}))[0];
  if(admin) await queryInterface.bulkInsert('audit_logs',[{id:uuidv4(),user_id:admin.id,role:'SUPER_ADMIN',action:'CONVERT_TO_AHILYANAGAR_DEMO_DATA',entity:'System',record_id:null,old_value:null,new_value:JSON.stringify({activeWards:17,corporators:68,source:'Ahilyanagar Municipal Corporation official corporates directory'}),ip_address:'127.0.0.1',created_at:now}]);
 },
 async down(queryInterface){
  // Intentionally non-destructive: this migration converts demo identity to Ahilyanagar and should not restore Pune data automatically.
 }
};
