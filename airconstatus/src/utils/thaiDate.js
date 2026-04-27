// Thai Buddhist date helpers.

const THAI_DAYS = [
  "วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ",
  "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์",
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const ENG_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// e.g. "วันจันทร์ 27 เมษายน 2569"
export function formatThaiBuddhistDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = THAI_DAYS[d.getDay()];
  const buddhistYear = d.getFullYear() + 543;
  return `${day} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${buddhistYear}`;
}

// e.g. "20:42 น."
export function formatTimeOfDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} น.`;
}

// e.g. "30 Mar 26" — DD Mon YY (last 2 digits of Buddhist year).
export function formatShortBuddhistDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = ENG_MONTHS_SHORT[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  const yy = String(buddhistYear).slice(-2);
  return `${day} ${mon} ${yy}`;
}

// Whole-day difference between today and the given date (today minus date).
export function daysSince(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((a - b) / 86400000);
}

// "YYYY-MM-DD" formatted for <input type="date"> (uses local CE year).
export function toDateInputValue(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
