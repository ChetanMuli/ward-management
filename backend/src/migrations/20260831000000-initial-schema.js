'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const uuidPk = { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true };
    const timestamps = {
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    };

    // 1. roles
    await queryInterface.createTable('roles', {
      id: uuidPk,
      name: { type: DataTypes.ENUM('SUPER_ADMIN', 'EMPLOYEE', 'CITIZEN'), allowNull: false, unique: true },
      description: DataTypes.STRING,
      ...timestamps,
    });

    // 2. wards
    await queryInterface.createTable('wards', {
      id: uuidPk,
      ward_number: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
      ...timestamps,
    });

    // 3. areas
    await queryInterface.createTable('areas', {
      id: uuidPk,
      ward_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'wards', key: 'id' }, onDelete: 'RESTRICT' },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
      ...timestamps,
    });

    // 4. houses
    await queryInterface.createTable('houses', {
      id: uuidPk,
      house_number: { type: DataTypes.STRING, allowNull: false },
      area_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'areas', key: 'id' }, onDelete: 'RESTRICT' },
      address: { type: DataTypes.TEXT, allowNull: false },
      landmark: DataTypes.STRING,
      house_type: { type: DataTypes.ENUM('INDEPENDENT_HOUSE', 'FLAT', 'CHAWL', 'OTHER'), defaultValue: 'INDEPENDENT_HOUSE' },
      ownership: { type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'), defaultValue: 'OWN' },
      owner_name: DataTypes.STRING,
      owner_mobile: DataTypes.STRING,
      latitude: DataTypes.DECIMAL(10, 7),
      longitude: DataTypes.DECIMAL(10, 7),
      verification_status: { type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'), defaultValue: 'PENDING' },
      assigned_employee_id: { type: DataTypes.UUID, allowNull: true }, // FK added after employees table exists
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MOVED_REMOVED'), defaultValue: 'ACTIVE' },
      last_verified_at: DataTypes.DATE,
      notes: DataTypes.TEXT,
      ...timestamps,
    });
    await queryInterface.addIndex('houses', ['house_number']);
    await queryInterface.addIndex('houses', ['area_id']);
    await queryInterface.addIndex('houses', ['status']);

    // 5. families
    await queryInterface.createTable('families', {
      id: uuidPk,
      house_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'houses', key: 'id' }, onDelete: 'RESTRICT' },
      family_head_person_id: { type: DataTypes.UUID, allowNull: true }, // FK added after persons table exists
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MOVED_OUT'), defaultValue: 'ACTIVE' },
      notes: DataTypes.TEXT,
      ...timestamps,
    });
    await queryInterface.addIndex('families', ['house_id']);

    // 6. persons  (age is NEVER a column - always derived from dob)
    await queryInterface.createTable('persons', {
      id: uuidPk,
      family_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'families', key: 'id' }, onDelete: 'RESTRICT' },
      full_name: { type: DataTypes.STRING, allowNull: false },
      gender: { type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER'), allowNull: false },
      dob: { type: DataTypes.DATEONLY, allowNull: false },
      mobile: DataTypes.STRING,
      alternate_mobile: DataTypes.STRING,
      email: DataTypes.STRING,
      occupation: DataTypes.STRING,
      residence_status: { type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'), allowNull: true },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'DECEASED', 'MOVED_OUT', 'DUPLICATE', 'VERIFICATION_PENDING'),
        defaultValue: 'VERIFICATION_PENDING',
      },
      verification_status: { type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'), defaultValue: 'PENDING' },
      notes: DataTypes.TEXT,
      created_by: DataTypes.UUID,
      updated_by: DataTypes.UUID,
      ...timestamps,
    });
    await queryInterface.addIndex('persons', ['family_id']);
    await queryInterface.addIndex('persons', ['mobile']);
    await queryInterface.addIndex('persons', ['dob']);
    await queryInterface.addIndex('persons', ['status']);
    await queryInterface.addIndex('persons', ['full_name']);

    // Now that persons exists, wire the deferred FKs.
    await queryInterface.addConstraint('families', {
      fields: ['family_head_person_id'],
      type: 'foreign key',
      name: 'fk_families_family_head_person',
      references: { table: 'persons', field: 'id' },
      onDelete: 'SET NULL',
    });

    // 7. users
    await queryInterface.createTable('users', {
      id: uuidPk,
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, unique: true },
      mobile: { type: DataTypes.STRING, unique: true },
      password_hash: DataTypes.STRING,
      role_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'roles', key: 'id' }, onDelete: 'RESTRICT' },
      person_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'persons', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'), defaultValue: 'ACTIVE' },
      two_factor_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      last_login_at: DataTypes.DATE,
      ...timestamps,
    });

    // 8. employees
    await queryInterface.createTable('employees', {
      id: uuidPk,
      user_id: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      designation: DataTypes.STRING,
      assigned_area_ids: { type: DataTypes.JSON, defaultValue: [] },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
      ...timestamps,
    });

    await queryInterface.addConstraint('houses', {
      fields: ['assigned_employee_id'],
      type: 'foreign key',
      name: 'fk_houses_assigned_employee',
      references: { table: 'employees', field: 'id' },
      onDelete: 'SET NULL',
    });

    // 9. voter_profiles
    await queryInterface.createTable('voter_profiles', {
      id: uuidPk,
      person_id: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'persons', key: 'id' }, onDelete: 'CASCADE' },
      status: {
        type: DataTypes.ENUM('VOTER', 'NON_VOTER', 'VERIFICATION_PENDING', 'REGISTRATION_DUE_18PLUS', 'DECEASED', 'MOVED_OUT'),
        defaultValue: 'VERIFICATION_PENDING',
      },
      constituency: DataTypes.STRING,
      official_voter_id_ref: DataTypes.STRING,
      verified_by: DataTypes.UUID,
      verified_at: DataTypes.DATE,
      notes: DataTypes.TEXT,
      ...timestamps,
    });

    // 10. death_records
    await queryInterface.createTable('death_records', {
      id: uuidPk,
      person_id: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'persons', key: 'id' }, onDelete: 'CASCADE' },
      date_of_death: { type: DataTypes.DATEONLY, allowNull: false },
      reported_by: { type: DataTypes.UUID, allowNull: false },
      verification_status: { type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'), defaultValue: 'PENDING' },
      document_ref: DataTypes.STRING,
      notes: DataTypes.TEXT,
      verified_by: DataTypes.UUID,
      verified_at: DataTypes.DATE,
      ...timestamps,
    });

    // 11. complaints
    await queryInterface.createTable('complaints', {
      id: uuidPk,
      complaint_number: { type: DataTypes.STRING, allowNull: false, unique: true },
      citizen_person_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'persons', key: 'id' }, onDelete: 'RESTRICT' },
      house_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'houses', key: 'id' }, onDelete: 'RESTRICT' },
      category: { type: DataTypes.ENUM('WATER', 'ROADS', 'STREET_LIGHTS', 'GARBAGE', 'DRAINAGE', 'SANITATION', 'HEALTH', 'OTHER'), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      attachment_key: DataTypes.STRING,
      priority: { type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), defaultValue: 'MEDIUM' },
      status: { type: DataTypes.ENUM('SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED'), defaultValue: 'SUBMITTED' },
      assigned_employee_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'employees', key: 'id' }, onDelete: 'SET NULL' },
      sla_due_at: DataTypes.DATE,
      resolution_note: DataTypes.TEXT,
      resolved_at: DataTypes.DATE,
      ...timestamps,
    });
    await queryInterface.addIndex('complaints', ['status']);
    await queryInterface.addIndex('complaints', ['priority']);
    await queryInterface.addIndex('complaints', ['citizen_person_id']);
    await queryInterface.addIndex('complaints', ['house_id']);

    // 12. complaint_histories (append-only, no updated_at)
    await queryInterface.createTable('complaint_histories', {
      id: uuidPk,
      complaint_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'complaints', key: 'id' }, onDelete: 'CASCADE' },
      old_status: DataTypes.STRING,
      new_status: { type: DataTypes.STRING, allowNull: false },
      comment: DataTypes.TEXT,
      changed_by_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT' },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    // 13. update_requests
    await queryInterface.createTable('update_requests', {
      id: uuidPk,
      person_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'persons', key: 'id' }, onDelete: 'CASCADE' },
      requested_by_user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT' },
      field_name: { type: DataTypes.STRING, allowNull: false },
      current_value: DataTypes.TEXT,
      requested_value: { type: DataTypes.TEXT, allowNull: false },
      reason: DataTypes.TEXT,
      status: { type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'), defaultValue: 'PENDING' },
      reviewed_by: DataTypes.UUID,
      reviewed_at: DataTypes.DATE,
      review_note: DataTypes.TEXT,
      ...timestamps,
    });

    // 14. notifications
    await queryInterface.createTable('notifications', {
      id: uuidPk,
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: DataTypes.STRING, allowNull: false },
      channel: { type: DataTypes.ENUM('IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL'), defaultValue: 'IN_APP' },
      title: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
      sent_at: DataTypes.DATE,
      ...timestamps,
    });

    // 15. audit_logs (append-only, immutable)
    await queryInterface.createTable('audit_logs', {
      id: uuidPk,
      user_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      role: DataTypes.STRING,
      action: { type: DataTypes.STRING, allowNull: false },
      entity: { type: DataTypes.STRING, allowNull: false },
      record_id: DataTypes.UUID,
      old_value: DataTypes.JSON,
      new_value: DataTypes.JSON,
      ip_address: DataTypes.STRING,
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('audit_logs', ['entity', 'record_id']);
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  down: async (queryInterface) => {
    // Drop in reverse dependency order.
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('update_requests');
    await queryInterface.dropTable('complaint_histories');
    await queryInterface.dropTable('complaints');
    await queryInterface.dropTable('death_records');
    await queryInterface.dropTable('voter_profiles');
    await queryInterface.dropTable('employees');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('persons');
    await queryInterface.dropTable('families');
    await queryInterface.dropTable('houses');
    await queryInterface.dropTable('areas');
    await queryInterface.dropTable('wards');
    await queryInterface.dropTable('roles');
  },
};
