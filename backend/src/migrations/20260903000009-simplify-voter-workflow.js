'use strict';
module.exports={
 up: async(queryInterface,Sequelize)=>{
  // Existing verification states are converted into a real operational choice.
  await queryInterface.sequelize.query(`UPDATE voter_profiles SET status = CASE WHEN status = 'VERIFICATION_PENDING' THEN CASE WHEN official_voter_id_ref IS NOT NULL OR voting_ward IS NOT NULL THEN 'VOTER' ELSE 'NON_VOTER' END WHEN status = 'REGISTRATION_DUE_18PLUS' THEN 'NON_VOTER' ELSE status END`);
  await queryInterface.changeColumn('voter_profiles','status',{type:Sequelize.ENUM('VOTER','NON_VOTER','DECEASED','MOVED_OUT'),allowNull:false,defaultValue:'NON_VOTER'});
 },
 down: async(queryInterface,Sequelize)=>{
  await queryInterface.changeColumn('voter_profiles','status',{type:Sequelize.ENUM('VOTER','NON_VOTER','VERIFICATION_PENDING','REGISTRATION_DUE_18PLUS','DECEASED','MOVED_OUT'),allowNull:false,defaultValue:'NON_VOTER'});
 }
};
