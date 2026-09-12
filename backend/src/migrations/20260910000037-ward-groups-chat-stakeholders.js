"use strict";
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi=queryInterface;
    // Extend the role enum and add optional community roles.
    await qi.sequelize.query("ALTER TABLE roles MODIFY COLUMN name ENUM('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN','SOCIAL_WORKER','CANDIDATE') NOT NULL UNIQUE");
    for (const [name, description] of [
      ['SOCIAL_WORKER','Ward social worker / community representative'],
      ['CANDIDATE','Election candidate / campaign representative']
    ]) {
      const rows=await qi.sequelize.query('SELECT id FROM roles WHERE name = :name LIMIT 1',{replacements:{name},type:QueryTypes.SELECT});
      if(!rows.length) await qi.bulkInsert('roles',[{id:require('crypto').randomUUID(),name,description,created_at:new Date(),updated_at:new Date()}]);
    }
    await qi.createTable('ward_chat_groups',{
      id:{type:Sequelize.UUID,defaultValue:Sequelize.UUIDV4,primaryKey:true},
      ward_id:{type:Sequelize.UUID,allowNull:false,references:{model:'wards',key:'id'},onDelete:'CASCADE'},
      name:{type:Sequelize.STRING(160),allowNull:false},
      type:{type:Sequelize.ENUM('WARD','NAGARSEVAK'),allowNull:false},
      nagarsevak_user_id:{type:Sequelize.UUID,allowNull:true,references:{model:'users',key:'id'},onDelete:'SET NULL'},
      created_by_user_id:{type:Sequelize.UUID,allowNull:true,references:{model:'users',key:'id'},onDelete:'SET NULL'},
      is_active:{type:Sequelize.BOOLEAN,allowNull:false,defaultValue:true},
      created_at:{type:Sequelize.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')},
      updated_at:{type:Sequelize.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')}
    });
    await qi.addIndex('ward_chat_groups',['ward_id','type'],{name:'ward_chat_groups_ward_type_idx'});
    await qi.addIndex('ward_chat_groups',['nagarsevak_user_id'],{unique:true,name:'ward_chat_groups_nagarsevak_unique'});
    await qi.createTable('ward_chat_group_members',{
      id:{type:Sequelize.UUID,defaultValue:Sequelize.UUIDV4,primaryKey:true},
      group_id:{type:Sequelize.UUID,allowNull:false,references:{model:'ward_chat_groups',key:'id'},onDelete:'CASCADE'},
      user_id:{type:Sequelize.UUID,allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
      joined_at:{type:Sequelize.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')},
      last_read_at:{type:Sequelize.DATE,allowNull:true}
    });
    await qi.addIndex('ward_chat_group_members',['group_id','user_id'],{unique:true,name:'ward_chat_members_unique'});
    await qi.addIndex('ward_chat_group_members',['user_id'],{name:'ward_chat_members_user_idx'});
    await qi.createTable('ward_chat_messages',{
      id:{type:Sequelize.UUID,defaultValue:Sequelize.UUIDV4,primaryKey:true},
      group_id:{type:Sequelize.UUID,allowNull:false,references:{model:'ward_chat_groups',key:'id'},onDelete:'CASCADE'},
      sender_user_id:{type:Sequelize.UUID,allowNull:false,references:{model:'users',key:'id'},onDelete:'RESTRICT'},
      message_type:{type:Sequelize.ENUM('TEXT','IMAGE'),allowNull:false,defaultValue:'TEXT'},
      content:{type:Sequelize.TEXT,allowNull:true},
      image_mime:{type:Sequelize.STRING(100),allowNull:true},
      image_path:{type:Sequelize.STRING(500),allowNull:true},
      created_at:{type:Sequelize.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')},
      updated_at:{type:Sequelize.DATE,allowNull:false,defaultValue:Sequelize.literal('CURRENT_TIMESTAMP')}
    });
    await qi.addIndex('ward_chat_messages',['group_id','created_at'],{name:'ward_chat_messages_group_time_idx'});
    // Ward community chat is a baseline capability for citizens; existing employees also receive it.
    const chatRoles=await qi.sequelize.query("SELECT r.id,r.name FROM roles r WHERE r.name IN ('CITIZEN','EMPLOYEE')",{type:QueryTypes.SELECT});
    for(const r of chatRoles){
      const users=await qi.sequelize.query('SELECT id,permissions FROM users WHERE role_id=:roleId AND status=\'ACTIVE\' AND deleted_at IS NULL',{replacements:{roleId:r.id},type:QueryTypes.SELECT});
      for(const u of users){let perms=[];try{perms=Array.isArray(u.permissions)?u.permissions:JSON.parse(u.permissions||'[]')}catch(_){perms=[]} perms=[...new Set([...perms,'VIEW_CHAT','SEND_CHAT'])]; await qi.sequelize.query('UPDATE users SET permissions=:permissions WHERE id=:id',{replacements:{id:u.id,permissions:JSON.stringify(perms)}});}
    }

    // Give current Nagarsevak accounts the chat permissions introduced in this release.
    const nRole=await qi.sequelize.query("SELECT id FROM roles WHERE name='NAGARSEVAK' LIMIT 1",{type:QueryTypes.SELECT});
    if(nRole.length){
      const nUsers=await qi.sequelize.query('SELECT id, permissions FROM users WHERE role_id = :roleId AND status=\'ACTIVE\' AND deleted_at IS NULL',{replacements:{roleId:nRole[0].id},type:QueryTypes.SELECT});
      for(const u of nUsers){let perms=[];try{perms=Array.isArray(u.permissions)?u.permissions:JSON.parse(u.permissions||'[]')}catch(_){perms=[]} perms=[...new Set([...perms,'VIEW_CHAT','SEND_CHAT'])]; await qi.sequelize.query('UPDATE users SET permissions=:permissions WHERE id=:id',{replacements:{id:u.id,permissions:JSON.stringify(perms)}});}
    }

    // Create one ward group and one group for every active Nagarsevak.
    const wards=await qi.sequelize.query('SELECT id, ward_number, name FROM wards',{type:QueryTypes.SELECT});
    const users=await qi.sequelize.query("SELECT u.id,u.ward_id,u.name FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='NAGARSEVAK' AND u.status='ACTIVE' AND u.deleted_at IS NULL",{type:QueryTypes.SELECT});
    const now=new Date(); const groups=[];
    for(const w of wards) groups.push({id:require('crypto').randomUUID(),ward_id:w.id,name:`Ward ${w.ward_number}${w.name?' · '+w.name:''} Community`,type:'WARD',created_by_user_id:null,is_active:true,created_at:now,updated_at:now});
    for(const u of users) groups.push({id:require('crypto').randomUUID(),ward_id:u.ward_id,name:`${u.name} · Ward Community`,type:'NAGARSEVAK',nagarsevak_user_id:u.id,created_by_user_id:null,is_active:true,created_at:now,updated_at:now});
    if(groups.length) await qi.bulkInsert('ward_chat_groups',groups);
    const wardGroups=groups.filter(g=>g.type==='WARD');
    const nGroups=groups.filter(g=>g.type==='NAGARSEVAK');
    const active=await qi.sequelize.query("SELECT u.id,u.ward_id FROM users u WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND u.ward_id IS NOT NULL",{type:QueryTypes.SELECT});
    const members=[];
    for(const u of active){ for(const g of wardGroups.filter(x=>x.ward_id===u.ward_id)) members.push({id:require('crypto').randomUUID(),group_id:g.id,user_id:u.id,joined_at:now}); }
    for(const g of nGroups) members.push({id:require('crypto').randomUUID(),group_id:g.id,user_id:g.nagarsevak_user_id,joined_at:now});
    if(members.length) await qi.bulkInsert('ward_chat_group_members',members);
  },
  async down(queryInterface){
    await queryInterface.dropTable('ward_chat_messages');
    await queryInterface.dropTable('ward_chat_group_members');
    await queryInterface.dropTable('ward_chat_groups');
    await queryInterface.sequelize.query("ALTER TABLE roles MODIFY COLUMN name ENUM('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN') NOT NULL UNIQUE");
  }
};
