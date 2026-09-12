'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    // Add a distinct sub-master role. Existing SUPER_ADMIN remains the single master role.
    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN') NOT NULL"
    );
    const users = await queryInterface.describeTable('users');
    if (!users.permissions) {
      await queryInterface.addColumn('users','permissions',{
        type: DataTypes.JSON, allowNull:false, defaultValue: JSON.stringify([])
      });
    }
    const tables = await queryInterface.showAllTables();
    if (!tables.map(String).map(x=>x.toLowerCase()).includes('schemes')) {
      await queryInterface.createTable('schemes',{
        id:{type:DataTypes.UUID,allowNull:false,primaryKey:true},
        title:{type:DataTypes.STRING(180),allowNull:false},
        description:{type:DataTypes.TEXT,allowNull:false},
        benefits:{type:DataTypes.TEXT,allowNull:true},
        eligibility:{type:DataTypes.TEXT,allowNull:true},
        min_age:{type:DataTypes.INTEGER,allowNull:true},
        max_age:{type:DataTypes.INTEGER,allowNull:true},
        gender:{type:DataTypes.ENUM('ALL','FEMALE','MALE','OTHER'),allowNull:false,defaultValue:'ALL'},
        audience:{type:DataTypes.STRING(120),allowNull:true},
        ward_id:{type:DataTypes.UUID,allowNull:true,references:{model:'wards',key:'id'},onDelete:'SET NULL',onUpdate:'CASCADE'},
        application_url:{type:DataTypes.STRING(500),allowNull:true},
        contact_info:{type:DataTypes.STRING(500),allowNull:true},
        start_date:{type:DataTypes.DATEONLY,allowNull:true},
        end_date:{type:DataTypes.DATEONLY,allowNull:true},
        status:{type:DataTypes.ENUM('DRAFT','PUBLISHED','CLOSED'),allowNull:false,defaultValue:'PUBLISHED'},
        created_by_user_id:{type:DataTypes.UUID,allowNull:false,references:{model:'users',key:'id'},onDelete:'RESTRICT',onUpdate:'CASCADE'},
        created_at:{type:DataTypes.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')},
        updated_at:{type:DataTypes.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')}
      });
      await queryInterface.addIndex('schemes',['ward_id']);
      await queryInterface.addIndex('schemes',['status']);
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables=await queryInterface.showAllTables();
    if(tables.map(String).map(x=>x.toLowerCase()).includes('schemes')) await queryInterface.dropTable('schemes');
    const users=await queryInterface.describeTable('users');
    if(users.permissions) await queryInterface.removeColumn('users','permissions');
    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN') NOT NULL"
    );
  }
};
