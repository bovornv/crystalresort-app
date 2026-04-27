// Room layout per floor — must match the roomstatus floor plan exactly.
// Floor order is descending (6 -> 1). Each entry is just the room number.

export const FLOORS = [
  {
    floor: 6,
    rooms: ["601", "602", "603", "604", "605", "606", "607", "608", "609"],
  },
  {
    floor: 5,
    rooms: [
      "501", "502", "503", "505", "507", "508", "509", "510",
      "511", "512", "514", "515", "516", "518",
    ],
  },
  {
    floor: 4,
    rooms: [
      "401", "402", "403", "404", "405", "406", "407", "408", "409",
      "410", "411", "412", "414", "415", "416", "417", "418",
    ],
  },
  {
    floor: 3,
    rooms: [
      "301", "302", "303", "304", "305", "306", "307", "308", "309",
      "310", "311", "312", "314", "315", "316", "317", "318",
    ],
  },
  {
    floor: 2,
    rooms: [
      "201", "202", "203", "204", "205", "206", "207", "208", "209",
      "210", "211", "212", "214", "215", "216", "217", "218",
    ],
  },
  {
    floor: 1,
    rooms: [
      "101", "102", "103", "104", "105", "106", "107", "108", "109",
      "110", "111",
    ],
  },
];

// Rooms with two AC units (Bedroom + Living room).
// Each renders as two adjacent boxes labelled "<room> B" and "<room> L".
export const DUAL_AC_ROOMS = new Set([
  "601", "602", "603", "604", "606", "607", "608", "609",
  "503", "518",
]);

// Build the full list of room codes used as primary keys in Supabase.
// Single-AC rooms => "<room>", dual-AC rooms => "<room>-B" and "<room>-L".
export function buildRoomCodes(roomNumber) {
  if (DUAL_AC_ROOMS.has(roomNumber)) {
    return [`${roomNumber}-B`, `${roomNumber}-L`];
  }
  return [roomNumber];
}

// Returns the list of "units" to render for a given room number.
// Each unit has { code, label, suffix } where suffix is "B" / "L" / null.
export function getRoomUnits(roomNumber) {
  if (DUAL_AC_ROOMS.has(roomNumber)) {
    return [
      { code: `${roomNumber}-B`, suffix: "B" },
      { code: `${roomNumber}-L`, suffix: "L" },
    ];
  }
  return [{ code: roomNumber, suffix: null }];
}
