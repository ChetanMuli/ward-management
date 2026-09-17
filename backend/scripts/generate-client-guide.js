#!/usr/bin/env node
/**
 * Builds a client-facing English PDF for WardDesk.
 * Run: node scripts/generate-client-guide.js
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.resolve(__dirname, '../../docs');
const OUT_FILE = path.join(OUT_DIR, 'WardDesk-Client-Guide.pdf');
const DOWNLOADS_COPY = path.resolve(__dirname, '../../../WardDesk-Client-Guide.pdf');

const NAVY = '#0b1624';
const TEAL = '#0f766e';
const INK = '#1f2d44';
const MUTED = '#5b6b82';
const LINE = '#d5dee9';
const PAPER = '#f6f8fb';
const WHITE = '#ffffff';

const COMPANY = 'Kairo IT Solutions PVT LTD';
const EMAIL = 'chetan.a2zithub@gmail.com';
const MOBILE = '8523697410';
const PRODUCT = 'WardDesk';
const DATE = '17 September 2026';

fs.mkdirSync(OUT_DIR, { recursive: true });

const doc = new PDFDocument({
  size: 'A4',
  bufferPages: true,
  margins: { top: 58, bottom: 58, left: 54, right: 54 },
  info: {
    Title: 'WardDesk - Product Overview and User Guide',
    Author: COMPANY,
    Subject: 'Municipal ward management system',
  },
});

const stream = fs.createWriteStream(OUT_FILE);
doc.pipe(stream);

const pageW = doc.page.width;
const left = 54;
const right = pageW - 54;
const contentW = right - left;

function ensure(h = 80) {
  if (doc.y + h > doc.page.height - 70) doc.addPage();
}

function h1(text) {
  ensure(48);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text(text, left, doc.y, { width: contentW });
  const y = doc.y + 4;
  doc.save();
  doc.rect(left, y, 56, 3).fill(TEAL);
  doc.restore();
  doc.moveDown(0.8);
}

function h2(text) {
  ensure(36);
  doc.moveDown(0.25);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(text, left, doc.y, { width: contentW });
  doc.moveDown(0.25);
}

function para(text) {
  ensure(40);
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(text, left, doc.y, { width: contentW, align: 'justify', lineGap: 2.2 });
  doc.moveDown(0.45);
}

function muted(text) {
  ensure(24);
  doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(text, left, doc.y, { width: contentW, lineGap: 1.8 });
  doc.moveDown(0.35);
}

function bullets(items) {
  items.forEach((item) => {
    ensure(28);
    const x = left + 12;
    const y = doc.y + 3;
    doc.save();
    doc.circle(left + 3, y + 2, 2).fill(TEAL);
    doc.restore();
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(item, x, doc.y, { width: contentW - 12, lineGap: 1.6 });
    doc.moveDown(0.22);
  });
  doc.moveDown(0.2);
}

function steps(items) {
  items.forEach((item, i) => {
    ensure(32);
    const n = String(i + 1);
    const y = doc.y;
    doc.save();
    doc.roundedRect(left, y, 16, 16, 4).fill(NAVY);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9).text(n, left, y + 3.5, { width: 16, align: 'center' });
    doc.restore();
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(item, left + 24, y + 2, { width: contentW - 24, lineGap: 1.6 });
    doc.moveDown(0.35);
  });
  doc.moveDown(0.15);
}

function callout(title, body) {
  ensure(70);
  const startY = doc.y;
  const titleH = 16;
  doc.save();
  const wrapH = 12 + titleH + doc.heightOfString(body, { width: contentW - 24, lineGap: 1.8 }) + 10;
  doc.roundedRect(left, startY, contentW, wrapH, 8).fill(PAPER).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEAL).text(title, left + 12, startY + 10, { width: contentW - 24 });
  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(body, left + 12, doc.y + 2, { width: contentW - 24, lineGap: 1.8 });
  doc.y = startY + wrapH + 8;
}

function kvTable(rows) {
  ensure(24 * rows.length + 10);
  rows.forEach(([k, v], i) => {
    ensure(26);
    const y = doc.y;
    if (i % 2 === 0) {
      doc.save();
      doc.rect(left, y - 3, contentW, 20).fill(PAPER);
      doc.restore();
    }
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(k, left + 8, y, { width: 150 });
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(v, left + 160, y, { width: contentW - 168 });
    doc.y = y + 18;
  });
  doc.moveDown(0.5);
}

/* ===================== COVER ===================== */
doc.save();
doc.rect(0, 0, pageW, doc.page.height).fill(NAVY);
doc.restore();

doc.save();
doc.roundedRect(left, 72, 64, 64, 16).fill(WHITE);
doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(34).text('W', left, 86, { width: 64, align: 'center' });
doc.restore();

doc.fillColor(WHITE).font('Helvetica').fontSize(11).text('MUNICIPAL WORKSPACE', left + 80, 86);
doc.font('Helvetica-Bold').fontSize(32).text(PRODUCT, left + 80, 104);
doc.font('Helvetica').fontSize(12).fillColor('#c5d0de').text('Product overview and user guide', left + 80, 144);

doc.font('Helvetica').fontSize(10).fillColor('#9fb0c5').text('For municipal administration, Nagarsevaks, field employees and registered residents.', left, 210, { width: contentW });

doc.save();
doc.rect(left, 248, contentW, 1).fill('#243044');
doc.restore();

doc.font('Helvetica').fontSize(10).fillColor('#d7e0ea');
doc.text('Prepared for', left, 268);
doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE).text('Client / Municipal partner', left, 284);
doc.font('Helvetica').fontSize(10).fillColor('#9fb0c5').text(`Prepared by  ${COMPANY}`, left, 308);
doc.text(`Date  ${DATE}`, left, 324);
doc.text('Language  English', left, 340);

doc.save();
doc.roundedRect(left, 400, contentW, 86, 10).fill('#132033');
doc.restore();
doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE).text('What this document contains', left + 16, 414);
doc.font('Helvetica').fontSize(10).fillColor('#c5d0de').text('A complete picture of WardDesk: who uses it, how to sign in, how each section works, and how daily ward work is done from a browser on computer or phone.', left + 16, 434, { width: contentW - 32, lineGap: 2 });

doc.font('Helvetica').fontSize(9).fillColor('#8a9bb0').text(`Support  ${EMAIL}  ·  ${MOBILE}`, left, 760);
doc.font('Helvetica').fontSize(8).fillColor('#6b7c90').text(`© ${new Date().getFullYear()} ${COMPANY}. Confidential - for the authorised client.`, left, 778, { width: contentW });

/* ===================== TOC ===================== */
doc.addPage();
h1('Contents');
const toc = [
  ['1', 'What WardDesk is'],
  ['2', 'Who uses the system'],
  ['3', 'How to sign in'],
  ['4', 'Resident (citizen) portal'],
  ['5', 'Staff workspace - at a glance'],
  ['6', 'Ward setup'],
  ['7', 'People and houses'],
  ['8', 'Daily ward work'],
  ['9', 'Election and government voter lists'],
  ['10', 'Team, activation and subscriptions'],
  ['11', 'Chat, reports and recycle bin'],
  ['12', 'Mobile use, language and security'],
  ['13', 'Support'],
];
toc.forEach(([n, t]) => {
  ensure(22);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEAL).text(n, left, y, { width: 22 });
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(t, left + 28, y, { width: contentW - 28 });
  doc.y = y + 18;
});

/* ===================== 1 ===================== */
h1('1. What WardDesk is');
para('WardDesk is a municipal workspace for one city or council area, organised ward by ward. It keeps house, family and citizen records in one place, and gives the elected Nagarsevak, field employees and office administrators a shared desk for complaints, schemes, notices, birthdays, death records and election-season work.');
para('Residents do not manage the register. They receive a simple ward account to raise complaints, read updates, see schemes and join the ward community. Staff work in a separate administration login.');
bullets([
  'One register for houses, families and citizens, scoped to the correct ward.',
  'Daily tools for complaints, notices, schemes, birthdays, 18+ follow-up and death records.',
  'Official government voter-list PDFs stored by ward, without changing the citizen register.',
  'Clear control of which Nagarsevak panel is active, and for how long.',
  'Works in a web browser on computer and phone, in English and Marathi.',
]);
callout('Important', 'Government voter lists kept in WardDesk are an independent source. Names extracted from an Election Commission PDF are not merged into house, family or citizen records. Voter / Non-Voter on a citizen profile is operational tracking only and does not alter any official electoral roll.');

/* ===================== 2 ===================== */
h1('2. Who uses the system');
para('Each person signs in with a role. The menu they see depends on that role and, for Sub Master Admins, on the permissions you grant.');
kvTable([
  ['Master Admin', 'Full control. Creates wards, staff, Sub Master Admins, activations and subscriptions. Sees every ward.'],
  ['Sub Master Admin', 'Office support. Sees only assigned wards and only the sections permitted by Master Admin.'],
  ['Nagarsevak', 'Elected representative for one ward. Works the citizen register, complaints, schemes, notices and team for that ward.'],
  ['Employee', 'Field worker under a Nagarsevak. Handles assigned houses, complaints and daily records for that ward.'],
  ['Resident', 'Registered citizen of a ward. Uses the resident portal only - complaints, updates, schemes and community.'],
]);
para('Community members (former Nagarsevaks, social workers and similar contacts) can be stored for reference. They are not a day-to-day login for the staff desk.');

/* ===================== 3 ===================== */
h1('3. How to sign in');
h2('Two separate doors');
para('Staff and residents never share a login page. This keeps the municipal desk private and the resident experience simple.');
steps([
  'Staff (Master Admin, Sub Master Admin, Nagarsevak, Employee) open the Admin login page - typically the /admin address of your WardDesk site.',
  'Residents open the Resident login page - typically /login. New residents use Create account / Register and choose their ward.',
  'Enter the registered email or 10-digit mobile number, then the password. There is no OTP step.',
  'Use Support if the panel will not open, or Forgot password if the account type allows a reset. Staff passwords are reset by Master Admin, not by the staff member.',
]);
callout('If a Nagarsevak cannot sign in', 'Master Admin must first open the ward, then activate that Nagarsevak panel under Nagarsevak subscriptions. Until then, the login page shows that the panel is not active, with Kairo IT Solutions contact details so the user can reach you.');
para('After a period of inactivity (30 minutes) the session ends and the user signs in again. This protects the desk if a computer is left open.');

/* ===================== 4 ===================== */
h1('4. Resident (citizen) portal');
para('A resident sees only their own registered ward. There is no ward switcher. The home page shows the ward team (active Nagarsevaks), published updates, schemes and a short complaint snapshot.');
h2('What a resident can do');
bullets([
  'Home - ward name, active Nagarsevak photos and names, latest notices and schemes.',
  'Updates & Events - read notices and events published for the ward.',
  'Schemes - browse benefits that apply to residents.',
  'My Complaints - raise a civic complaint (water, roads, lights, garbage, drainage, and others), attach a photo, choose a Nagarsevak or all Nagarsevaks, and track status from Submitted to Closed.',
  'Groups & Chat - join the ward community conversation.',
  'Notifications - tap a notification to open the related section.',
  'My profile - update contact details and password.',
  'Language - switch the portal between English and Marathi at any time.',
]);
para('Residents never see purchase, subscription or administration language. They only see the public-facing ward services.');

/* ===================== 5 ===================== */
h1('5. Staff workspace - at a glance');
para('After Admin login, the left menu is grouped as follows. Sub Master Admins see only the groups they are allowed to use.');
kvTable([
  ['Overview', 'Dashboard - counts, ward work for today, birthdays and death observances for Nagarsevak / Employee.'],
  ['Ward setup', 'Wards & Areas, Ward Information.'],
  ['People & houses', 'Houses, Families, All Citizens, Voter / Non-Voter, Registered Users.'],
  ['Daily work', 'Complaints, Ward Updates & Events, Schemes, Birthdays, 18+ Follow-up, Death Records.'],
  ['Election', 'Government Voter Lists, Election Data.'],
  ['Team & access', 'Nagarsevak & Employees, Ward activation, Nagarsevak subscriptions, Community Members, Sub Master Admins.'],
  ['Tools', 'All chat & Groups, Reports & Export, Recycle Bin.'],
]);
para('Use View details for the full record. Use More for Edit, Delete and other actions. Deleted records go to Recycle Bin for 30 days.');

/* ===================== 6 ===================== */
h1('6. Ward setup');
h2('Wards & Areas');
para('Master Admin creates each ward (number and name) and the colonies / areas inside it. Houses belong to an area, so they inherit the correct ward. Do not use this screen as a map product - house location is captured when a team member visits the door.');
h2('Ward Information');
para('Official facts published for the ward: representation, contacts and related information that staff and residents may need.');

/* ===================== 7 ===================== */
h1('7. People and houses');
h2('Recommended order of work');
steps([
  'Create or open the House. At the door, tap Use GPS (or tap the map) so the pin is exact. Later, anyone can open directions from that pin.',
  'Create the Family and link it to that house.',
  'Add family members. Each saved member becomes a citizen automatically. Date of birth drives age, birthdays and 18+ follow-up.',
  'Optionally mark Voter or Non-Voter, voting ward and voter ID reference. This is for field tracking only.',
]);
h2('Houses');
para('Search by house number, colony or address. Keep one GPS pin per house. Update location if the first pin was taken from the road instead of the door.');
h2('Families');
para('Open a family to see every active member. Add, edit or remove members from that card. Mark deceased from More when you have the date of death.');
h2('All Citizens');
para('Search the full register by name, mobile, job, company or business. Filter by ward. View details shows the complete profile, occupation, voter tracking, household and optional document images. More includes Edit, Mark deceased and Delete.');
h2('Voter / Non-Voter');
para('A simple list of who is marked voter or non-voter in the family register. It is not the government roll.');
h2('Registered Users');
para('Login accounts created for the ward (residents and related users). This is the account list, not the citizen register.');

/* ===================== 8 ===================== */
h1('8. Daily ward work');
h2('Complaints');
para('Residents raise complaints from their portal. Staff see them on the Complaints desk. Typical flow: Submitted -> Assigned -> In progress -> Resolved -> Closed. A complaint can be reopened if the work was not complete. Assign to a Nagarsevak and, where needed, an employee. Status updates and photos keep the resident informed. Ward and Nagarsevak assignment do not overlap incorrectly - a complaint stays with the chosen ward team.');
h2('Ward Updates & Events');
para('Publish a notice or an event for residents of selected wards. Residents see only what is published for their ward. Use Create Update / Event for a new item.');
h2('Schemes & Benefits');
para('Publish government or local schemes with audience and ward scope. Residents browse what applies to them. Staff filter and maintain the catalogue.');
h2('Birthdays');
para('Upcoming birthdays from dates of birth in the citizen register. Nagarsevak and Employee dashboards also show a short "today" list. Sharing to WhatsApp uses the users own WhatsApp - WardDesk does not send WhatsApp from the server.');
h2('18+ Follow-up');
para('People who will turn 18 soon, and those who recently turned 18. Use this for voter-awareness follow-up in the field. It does not enrol anyone on an official roll.');
h2('Death Records');
para('From All Citizens or a family, choose More -> Mark deceased. Enter the date of death. WardDesk calculates the 10th day (Dahava) and the 1st yearly Shraddha automatically. The citizen leaves active family/voter lists and is kept under Death Records. Nagarsevak and Employee are notified and see observances for today on their dashboard. Admin is not sent these remembrance notifications.');

/* ===================== 9 ===================== */
h1('9. Election and government voter lists');
h2('Government Voter Lists');
para('This section is for the official Election Commission / government voter-list PDF of one ward. It is a source file, not a replacement for the citizen register.');
steps([
  'Open Government Voter Lists.',
  'Master Admin or Sub Master Admin: select exactly one ward - the ward this PDF belongs to. A Nagarsevak does not pick a ward; the file is saved to their own ward.',
  'Choose the PDF (XLSX or CSV is also accepted, up to 100 MB).',
  'Click Upload & extract. Names, EPIC numbers and related fields are extracted and shown on the same page.',
  'Use Show ward to browse lists. Open View extracted data to search and export CSV or Excel.',
  'Delete moves the list to Recycle Bin for 30 days. Extracted names stay independent of houses and families.',
]);
para('The Nagarsevak of that ward can open the same official list. If you have the Ward 3 government PDF, select Ward 3, upload that file, and only Ward 3 work uses it. Repeat for each ward PDF.');
h2('Election Data');
para('Official election information published for staff reference. It is read from configured official sources in the system.');

/* ===================== 10 ===================== */
h1('10. Team, activation and subscriptions');
h2('Nagarsevak & Employees');
para('Create Nagarsevak accounts (ward, seat, party, photo, mobile, login) and Employees who work under a Nagarsevak. Set profile photos so they appear on the ward dashboard and birthday card. Master Admin can reset passwords, edit permissions for Nagarsevaks, and move a person to Community Members when they are no longer in office.');
h2('Ward activation');
para('Master Admin only. A ward must be opened before its Nagarsevak panel can be switched on. If the ward is closed, the subscriptions screen tells you to activate the ward first.');
h2('Nagarsevak subscriptions');
para('Master Admin and Sub Master Admin only. This is the 1-year panel clock.');
bullets([
  'Activate - the Nagarsevak and their employees can sign in. Residents of that ward see them. The 1-year clock starts today.',
  'Deactivate - they cannot sign in. The login page shows a panel-deactivated message with your company email and mobile. The year ending by itself does not turn the panel off; you deactivate it when you choose.',
  'Start new year - after payment, restart the 1-year clock. The panel stays on.',
]);
para('Nothing here is automatic purchase. You switch each Nagarsevak on or off yourself.');
h2('Community Members');
para('People connected to the ward who are not current Nagarsevaks or employees - for example a former Nagarsevak. Keep contact details for outreach.');
h2('Sub Master Admins');
para('Master Admin only. Create extra office logins. For each person: name, email, mobile, password, active or suspended, which wards they may see, and which sections they may use (houses, citizens, complaints, and so on). Use Select all or tick sections one by one. Nagarsevak subscriptions are always available to Sub Master Admin; Ward activation and Sub Master Admins remain Master-only.');

/* ===================== 11 ===================== */
h1('11. Chat, reports and recycle bin');
h2('All chat & Groups');
para('Internal groups for the ward team and, where enabled, residents. Group identity can use the Nagarsevak profile photo. Open a group to read and send messages. Notifications about chat take the user to this section.');
h2('Reports & Export');
para('Export Excel or PDF reports by ward and, when needed, by colony / area. Use this for reviews, meetings and field lists.');
h2('Recycle Bin');
para('Records deleted from houses, families, citizens, complaints, government voter lists and similar modules stay here for 30 days. Restore if something was removed by mistake. After 30 days they are cleared.');

/* ===================== 12 ===================== */
h1('12. Mobile use, language and security');
bullets([
  'Phone and computer: the same web address. Tables become labelled cards on a small screen. Menus and More actions stay usable with a thumb.',
  'English / Marathi: the language button in the header switches labels across the workspace.',
  'Notifications: tapping a notification opens the related section (complaint, scheme, death, birthday, subscription, chat).',
  'Passwords: at least 8 characters. Staff cannot reset their own password from login; Master Admin resets it from the staff record.',
  'Idle timeout: 30 minutes. Sign in again to continue.',
  'Permissions: Sub Master Admins cannot see wards or modules you did not assign.',
  'Photos: crop Nagarsevak and profile photos so the face sits in the circle used on dashboards and cards.',
]);

/* ===================== 13 ===================== */
h1('13. Support');
para('If a user cannot sign in, a file will not upload, or a panel should be switched on or off, they can use Support on the login page or contact the implementation team.');
kvTable([
  ['Organisation', COMPANY],
  ['Email', EMAIL],
  ['Mobile', MOBILE],
  ['Product', `${PRODUCT} - municipal workspace`],
]);
muted('This guide describes the live WardDesk product as configured for municipal ward work. Login addresses are the Admin and Resident pages of your organisation\'s WardDesk website. Do not share staff passwords. Master Admin remains the owner of permissions, ward activation and Nagarsevak subscriptions.');

const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i += 1) {
  doc.switchToPage(i);
  if (i === 0) continue;
  const y = doc.page.height - 36;
  doc.save();
  doc.rect(0, y - 10, pageW, 46).fill(NAVY);
  doc.fillColor(WHITE).font('Helvetica').fontSize(8);
  doc.text(`${PRODUCT}  ·  Municipal workspace  ·  ${COMPANY}`, left, y - 2, { width: contentW - 80, align: 'left' });
  doc.text(String(i + 1), left, y - 2, { width: contentW, align: 'right' });
  doc.restore();
}

doc.end();

stream.on('finish', () => {
  fs.copyFileSync(OUT_FILE, DOWNLOADS_COPY);
  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log(`Wrote ${OUT_FILE} (${kb} KB)`);
  console.log(`Copy  ${DOWNLOADS_COPY}`);
});
stream.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
