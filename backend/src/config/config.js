const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  dialect: process.env.DB_DIALECT || 'mysql',
  define: {
    underscored: true,
    timestamps: true,
  },
};

const production = {
  ...base,
};

if (process.env.DB_SSL === 'true') {
  production.dialectOptions = {
    ssl: { require: true, rejectUnauthorized: true },
  };
}

module.exports = {
  development: base,
  test: { ...base, database: `${process.env.DB_NAME}_test` },
  production,
};
