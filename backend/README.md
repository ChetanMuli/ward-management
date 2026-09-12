# Ward Management Backend

Node.js + Express + Sequelize + MySQL API for Ward Management System V1.

## Production setup
1. Copy `.env.example` to `.env` and set the real DB/JWT values.
2. Make sure the `.env` is readable by the user running PM2.
3. Install packages: `npm install`
4. Run migrations: `npm run migrate`
5. Load demo/UAT data: `npm run seed`
6. Start: `pm2 start server.js --name ward-management-v1-api`

## API
- `GET /health`
- `POST /api/auth/login`
- `/api/wards`
- `/api/houses`
- `/api/families`
- `/api/persons`
- `/api/complaints`
- `/api/dashboard/summary`
- `/api/recycle-bin`

## Important
Voter fields are operational tracking only and must not be used to alter an official electoral roll. Birthday WhatsApp sharing uses the user's WhatsApp client; a server-side WhatsApp provider integration can be added later with consent and provider credentials.
