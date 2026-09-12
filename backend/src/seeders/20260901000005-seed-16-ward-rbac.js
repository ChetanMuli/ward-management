'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { QueryTypes, Op } = require('sequelize');
const { ALL_PERMISSIONS } = require('../v2/utils/permissions');

const WARDS = [
 ['W-01','Nagapur / Savedi'],['W-02','Delhi Gate / Savedi'],['W-03','Govindpura / Savedi'],['W-04','Mukundnagar'],['W-05','Topkhana / Tarakpur'],['W-06','Savedi'],['W-07','Ajinkyanagar / Savedi'],['W-08','Bolhegaon / Nagapur'],['W-09','Shivajinagar / Nagar-Kalyan Road'],['W-10','Delhi Gate / Sarjepura'],['W-11','Nalegaon / Court Galli'],['W-12','Maliwada'],['W-13','Bolhegaon / Burudgaon Road'],['W-14','Station Road / Burudgaon Road'],['W-15','Shivneri Marg / Kedgaon'],['W-16','Kedgaon'],['W-17','Kinetic Chowk / Kedgaon']
];
const AREAS={
 'W-01':['Nagapur','Savedi-Manmad Road'],'W-02':['Delhi Gate','Pipeline Road'],'W-03':['Govindpura','Yashwantnagar'],'W-04':['Mukundnagar','Mulla Colony'],
 'W-05':['Topkhana','Tarakpur'],'W-06':['Savedi Village','Shramik Nagar'],'W-07':['Ajinkyanagar','Bhutkarwadi'],'W-08':['Bolhegaon','MIDC Nagapur'],
 'W-09':['Shivajinagar','Nagar-Kalyan Road'],'W-10':['Sarjepura','Lonar Galli'],'W-11':['Nalegaon','Court Galli'],'W-12':['Maliwada','Brahmin Galli'],
 'W-13':['Tilak Road','Burudgaon Road'],'W-14':['Station Road','Anandnagar'],'W-15':['Shivneri Marg','Dutt Chowk'],'W-16':['Kedgaon','Rajendranagar'],
 'W-17':['Kinetic Chowk','Sonewadi Road'],
};
const CORPORATORS = {"01": [["Borude Sagar Arjun", "9822115406"], ["Dhawan Sharda Digambar", "9699224701"], ["Barskar Deepali Nitin", "9822415757"], ["Barskar Sampat Vijay", "9890408050"]], "02": [["Roshni Akash Trimbake", "9552690159"], ["Tawale Mahesh Raghunath", "9260029999"], ["Pawar Sandhya Balasaheb", "9561252700"], ["Nikhil Babasaheb Ware", "9850000852"]], "03": [["Gade Yogiraj (Appa) Shashikant", "9689896982"], ["Gade Jyoti Amol", "8975872525"], ["Borkar Gauri Ajinkya", "9225522255"], ["Adv. Rugved Mahendra (Bhiyya) Gandhe", "9421999494"]], "04": [["Sheikh Shehnaz Khalid", "9730007861"], ["Sayyed Shahbaz Ahmed", "8408088888"], ["Khan Minaj Jafar", "9021112312"], ["Khan Shams Samiullah", "7020792703"]], "05": [["Bhosale Kajal Gorakh", "9011761958"], ["Jadhav Dhananjaya Krishna", "9111763755"], ["Gambhir HarpreetKaur Jagjit Singh", "9162720707"], ["Punjabi Mohit Pradeep", "9766118118"]], "06": [["Dulam Manoj Laxman", "9225700007"], ["Shinde Sonabai Taiga", "9922573303"], ["Kulkarni Sunita Shrikrishna", "8830159083"], ["Karan Uday Karale", "8788536401"]], "07": [["Varsha Rohan Sanap", "8421383333"], ["Borude Pushpa Anil", "9422227473"], ["Tathe Vandana Vilas", "7028639999"], ["Wakale Babasaheb Sonyabapu", "9422226510"]], "08": [["Bhingardive Sunita Kisan", "9822463388"], ["Katore Ashabai Lobhaji", "9764656666"], ["Katore Navnath Machhindra", "8208859009"], ["Wakale Kumar Babanrao", "9730015555"]], "09": [["Shendge Sanjay Chaganrao", "9822788388"], ["Datrange Rupali Sandeep", "9763161001"], ["Vaishali Sham (Appa) Nalkande", "9850184263"], ["Londhe Mahesh Ram", "8657161616"]], "10": [["Chindam Shripad Shankar", "9370422222"], ["Dhone Sheetal Ajay (Vahini)", "9422220548"], ["Jadhav Mayuri Sushant", "7020991165"], ["Sagar Raju Murtudkar", "8055548547"]], "11": [["Kavade Umesh (Ganesh) Khanderao", "8830303434"], ["Genappa Sunita Santosh", "9420689999"], ["Dagwale Asha Kishore", "9028969009"], ["Londhe Subhash Sopanrao", "9921799992"]], "12": [["Lokhande Mangal Sunil", "9423561112"], ["Surekha Sambhaji Kadam", "9422222003"], ["Balasaheb Maruti Borate", "9422222079"], ["Kaware Dattatraya Haribhau", "9881777760"]], "13": [["Suresh Laxman Bansode", "9499992222"], ["Padole Sujata Mahendra", "9850211111"], ["Shetia Anita Vipul", "9822069811"], ["Ghule Avinash (Tatya) Haribhau", "9765161616"]], "14": [["Bhaganagare Prakash Baburao", "9422230181"], ["Fhulsounder Sunita Bhagwan", "9422222236"], ["Chopada Meena Sanjay", "9822025757"], ["Ganesh Pundalik Bhosale", "9922951596"]], "15": [["Gavhale Pornima Vijaya", "9822991496"], ["Datta Somnath Gadalkar", "9225541111"], ["Gitanjali Sunil Kale", "9225700502"], ["Mohite Sujay Anil", "9816061616"]], "16": [["Sunita Mahendra Kamble", "9881984177"], ["Varsha Sujit Kakade", "9823047481"], ["Vijay Mohanrao Pathare", "9623240303"], ["Dnyaneshwar alias Amol Shivaji Yewale", "9881778181"]], "17": [["Mayur Kanhaiyalal Bangre", "8888232352"], ["Ashwini Sumit Londhe", "7020346518"], ["Kamal Jalinder Kotkar", "9850489999"], ["Manoj Shankar Kotkar", "9890449126"]]};
module.exports={up:async(q)=>{
 const now=new Date();
 await q.sequelize.query("UPDATE roles SET description='Ward-level elected representative' WHERE name='NAGARSEVAK'").catch(()=>{});
 const superRole=await q.sequelize.query("SELECT id FROM roles WHERE name='SUPER_ADMIN' LIMIT 1",{type:QueryTypes.SELECT});
 if(superRole.length){const adminHash=await bcrypt.hash('admin',12);await q.sequelize.query("UPDATE users SET email='admin@gmail.com', password_hash=?, name='Master Admin', status='ACTIVE' WHERE email IN ('admin@ward.local','admin@gmail.com')",{replacements:[adminHash]});}
 const roles=await q.sequelize.query("SELECT id,name FROM roles WHERE name IN ('NAGARSEVAK','EMPLOYEE')",{type:QueryTypes.SELECT});
 const nr=roles.find(r=>r.name==='NAGARSEVAK'); const er=roles.find(r=>r.name==='EMPLOYEE'); if(!nr||!er) throw new Error('RBAC roles missing; run migrations first');
 for(const [num,name] of WARDS){
  let ward=await q.sequelize.query('SELECT id FROM wards WHERE ward_number=? LIMIT 1',{replacements:[num],type:QueryTypes.SELECT});
  let wardId=ward[0]?.id;
  if(!wardId){wardId=uuidv4();await q.bulkInsert('wards',[{id:wardId,ward_number:num,name,description:`Ahilyanagar Municipal Corporation ward ${num}`,status:'ACTIVE',created_at:now,updated_at:now}]);}
  for(const areaName of AREAS[num]){const a=await q.sequelize.query('SELECT id FROM areas WHERE ward_id=? AND name=? LIMIT 1',{replacements:[wardId,areaName],type:QueryTypes.SELECT});if(!a.length)await q.bulkInsert('areas',[{id:uuidv4(),ward_id:wardId,name:areaName,description:`${areaName}, Ahilyanagar`,status:'ACTIVE',created_at:now,updated_at:now}]);}
  const corporators = CORPORATORS[num.replace('W-','')] || [];
  for(let i=1;i<=4;i++){
   const email=`nagarsevak${num.replace('W-','')}${i}@ward.local`;
   const existing=await q.sequelize.query('SELECT id FROM users WHERE email=? LIMIT 1',{replacements:[email],type:QueryTypes.SELECT});
   const member=corporators[i-1] || [`${name} Nagarsevak ${i}`,`900000${num.replace('W-','')}${i}`];
   if(!existing.length) await q.bulkInsert('users',[{id:uuidv4(),name:member[0],email,mobile:member[1],password_hash:await bcrypt.hash('ChangeMe123!',12),role_id:nr.id,ward_id:wardId,status:'ACTIVE',created_at:now,updated_at:now}]);
   else await q.sequelize.query("UPDATE users SET name=?,mobile=?,ward_id=?,status='ACTIVE',role_id=?,updated_at=? WHERE id=?",{replacements:[member[0],member[1],wardId,nr.id,now,existing[0].id]});
  }
 }
 // Backfill existing employees to W-01 if they were created by the old demo seeder and have no ward.
 const firstWard=await q.sequelize.query("SELECT id FROM wards WHERE ward_number='W-01' LIMIT 1",{type:QueryTypes.SELECT});
 if(firstWard.length){await q.sequelize.query('UPDATE employees e JOIN users u ON u.id=e.user_id SET e.ward_id=COALESCE(e.ward_id,u.ward_id,?), u.ward_id=COALESCE(u.ward_id,?) WHERE e.ward_id IS NULL',{replacements:[firstWard[0].id,firstWard[0].id]});}
},down:async(q)=>{
 const users=await q.sequelize.query("SELECT id FROM users WHERE email LIKE 'nagarsevak%@ward.local'",{type:QueryTypes.SELECT}); const ids=users.map(x=>x.id); if(ids.length)await q.bulkDelete('users',{id:{[Op.in]:ids}}); 
 // Intentionally leave wards/areas intact: they may contain real operator data after deployment.
}};
