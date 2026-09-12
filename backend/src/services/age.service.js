/**
 * Age is always derived from DOB. Missing DOB means age-based workflows are unavailable.
 */
function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return Math.max(age, 0);
}

function daysToNextBirthday(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (nextBirthday < today) nextBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  return Math.round((nextBirthday - today) / 86400000);
}

function daysTo18thBirthday(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eighteenth = new Date(birthDate.getFullYear() + 18, birthDate.getMonth(), birthDate.getDate());
  return Math.round((eighteenth - today) / 86400000);
}

function daysFromBirthday(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let birthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  return Math.round((birthday - today) / 86400000);
}

module.exports = { calculateAge, daysToNextBirthday, daysTo18thBirthday, daysFromBirthday };
