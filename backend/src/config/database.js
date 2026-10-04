const { Sequelize } = require('sequelize');
const config = require('./config')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: process.env.DEBUG_SQL === '1'
      ? (sql, timing) => { if (Number(timing) >= 200) console.log(`[SQL ${timing}ms] ${sql}`); }
      : false,
    define: {
      ...(config.define || {}),
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    dialectOptions: {
      ...(config.dialectOptions || {}),
      charset: 'utf8mb4',
    },
    pool: process.env.NODE_ENV === 'production'
      ? { max: 30, min: 4, acquire: 20000, idle: 8000 }
      : { max: 15, min: 2, acquire: 30000, idle: 10000 },
    benchmark: process.env.DEBUG_SQL === '1',
  }
);

module.exports = sequelize;
