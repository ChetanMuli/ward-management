'use strict';
module.exports={
 up:async(queryInterface,Sequelize)=>{
  // Verification is no longer a user-facing workflow. Existing person records become normal active residents.
  await queryInterface.sequelize.query("UPDATE persons SET status='ACTIVE' WHERE status='VERIFICATION_PENDING'");
  await queryInterface.changeColumn('persons','status',{type:Sequelize.ENUM('ACTIVE','DECEASED','MOVED_OUT','DUPLICATE'),allowNull:false,defaultValue:'ACTIVE'});
  // Camera/document images can exceed MySQL TEXT's 64KB limit after base64 encoding.
  for(const col of ['voter_id_image','aadhaar_image','pan_card_image']){
    await queryInterface.changeColumn('persons',col,{type:Sequelize.TEXT('medium'),allowNull:true});
  }
 },
 down:async(queryInterface,Sequelize)=>{
  for(const col of ['voter_id_image','aadhaar_image','pan_card_image']){
    await queryInterface.changeColumn('persons',col,{type:Sequelize.TEXT,allowNull:true});
  }
  await queryInterface.changeColumn('persons','status',{type:Sequelize.ENUM('ACTIVE','DECEASED','MOVED_OUT','DUPLICATE','VERIFICATION_PENDING'),allowNull:false,defaultValue:'ACTIVE'});
 }
};
