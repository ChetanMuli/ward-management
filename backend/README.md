# Ward Management Backend

Node.js + Express + Sequelize + MySQL API for Ward Management System V1.

## Production setup
1. Copy `.env.example` to `.env` and set the real DB/JWT/CORS values. Generate a new `JWT_SECRET`.
2. Create the MySQL database (`utf8mb4`) and a dedicated DB user. Do not use an empty root password on live.
3. Install packages: `npm install --omit=dev`
4. Apply schema on this database (safe on existing data, no demo seed):
   `npm run db:live`
5. Empty server only: `npm run migrate` then seed roles if needed. **Do not run `npm run seed` on a live database** — it inserts demo wards/admin.
6. Confirm `uploads/portal` and `uploads/chat` are writable.
7. Start: `pm2 start server.js --name ward-management-v1-api`

Lists are paginated (25–50 rows). Keep InnoDB buffer pool large enough for civic data (`innodb_buffer_pool_size` 1–4GB on the live MySQL server) and always filter by ward. Do not load the full city in one request.

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
