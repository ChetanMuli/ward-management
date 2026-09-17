const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmployeeAreaAssignment = sequelize.define('EmployeeAreaAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  employeeId: { type: DataTypes.UUID, allowNull: false, field: 'employee_id' },
  areaId: { type: DataTypes.UUID, allowNull: false, field: 'area_id' },
}, {
  tableName: 'employee_area_assignments',
  underscored: true,
  indexes: [
    { unique: true, fields: ['employee_id', 'area_id'] },
    { fields: ['area_id'] },
  ],
});

module.exports = EmployeeAreaAssignment;
