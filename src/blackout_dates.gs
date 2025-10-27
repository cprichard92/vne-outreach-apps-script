/*** BLACKOUT DATE CHECK ******************************************************/
const BLACKOUTS = [
  // YYYY-MM-DD
  '2025-01-01','2025-07-04','2025-11-27','2025-12-25'
];

function isBlackoutDay(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return BLACKOUTS.includes(`${y}-${m}-${day}`);
}
