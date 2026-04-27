import { supabase } from "./supabase";

const TABLE = "aircon_cleaning_status";

// Fetch all rows and return as a { [room_code]: row } map.
export async function fetchAllAirconStatus() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) {
    console.error("fetchAllAirconStatus error:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => {
    if (row.room_code) map[row.room_code] = row;
  });
  return map;
}

// Insert or update a record (keyed by unique room_code).
export async function upsertAirconStatus({ roomCode, lastCleanedDate, technicianName }) {
  const payload = {
    room_code: roomCode,
    last_cleaned_date: lastCleanedDate || null,
    technician_name: technicianName || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "room_code" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("upsertAirconStatus error:", error);
    throw error;
  }
  return data;
}

// Delete the record for a given room_code (no-op if it doesn't exist).
export async function deleteAirconStatus(roomCode) {
  const { error } = await supabase.from(TABLE).delete().eq("room_code", roomCode);
  if (error) {
    console.error("deleteAirconStatus error:", error);
    throw error;
  }
}

// Subscribe to live changes. Returns an unsubscribe function.
export function subscribeAirconStatus(onChange) {
  const channel = supabase
    .channel("aircon_cleaning_status_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE },
      (payload) => {
        try { onChange(payload); } catch (e) { console.error(e); }
      }
    )
    .subscribe();
  return () => {
    try { channel.unsubscribe(); } catch (e) { /* noop */ }
  };
}
