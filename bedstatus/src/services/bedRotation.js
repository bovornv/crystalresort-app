import { supabase } from "./supabase";

const TABLE = "bed_rotation_status";

// Fetch all rows and return as a { [room_code]: row } map.
export async function fetchAllBedRotationStatus() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) {
    console.error("fetchAllBedRotationStatus error:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => {
    if (row.room_code) map[row.room_code] = row;
  });
  return map;
}

// Insert or update a record (keyed by unique room_code).
export async function upsertBedRotationStatus({ roomCode, lastRotationDate, rotatedBy }) {
  const payload = {
    room_code: roomCode,
    last_rotation_date: lastRotationDate || null,
    rotated_by: rotatedBy || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "room_code" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("upsertBedRotationStatus error:", error);
    throw error;
  }
  return data;
}

// Delete the record for a given room_code (no-op if it doesn't exist).
export async function deleteBedRotationStatus(roomCode) {
  const { error } = await supabase.from(TABLE).delete().eq("room_code", roomCode);
  if (error) {
    console.error("deleteBedRotationStatus error:", error);
    throw error;
  }
}

// Subscribe to live changes. Returns an unsubscribe function.
export function subscribeBedRotationStatus(onChange) {
  const channel = supabase
    .channel("bed_rotation_status_changes")
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
