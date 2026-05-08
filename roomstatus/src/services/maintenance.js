import { supabase } from './supabase';

const BUCKET = 'maintenance-photos';
const TABLE = 'roomstatus_maintenance';

// Resize so the longest dimension is at most maxWidth, then re-encode as JPEG.
// Vanilla canvas — no extra dependency.
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      i.src = url;
    });
    const longest = Math.max(img.width, img.height);
    const scale = longest > maxWidth ? maxWidth / longest : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('บีบอัดรูปไม่สำเร็จ'))),
        'image/jpeg',
        quality
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadPhoto(file, roomNumber) {
  const blob = await compressImage(file);
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${roomNumber}/${Date.now()}_${rand}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('ไม่ได้รับ URL รูป');
  return data.publicUrl;
}

export async function fetchPendingByRoom(roomNumber) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('room_number', String(roomNumber))
    .eq('status', 'pending')
    .order('reported_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Returns Map<room_number, { count, highestUrgency }> for the grid badges.
export async function fetchPendingCounts() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('room_number, urgency')
    .eq('status', 'pending');
  if (error) throw error;
  const rank = { not_urgent: 1, urgent: 2, most_urgent: 3 };
  const map = new Map();
  for (const row of data || []) {
    const cur = map.get(row.room_number) || { count: 0, highestUrgency: 'not_urgent' };
    cur.count += 1;
    if ((rank[row.urgency] || 0) > (rank[cur.highestUrgency] || 0)) {
      cur.highestUrgency = row.urgency;
    }
    map.set(row.room_number, cur);
  }
  return map;
}

export async function fetchCompletedByRoom(roomNumber) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('room_number', String(roomNumber))
    .eq('status', 'done')
    .order('fixed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAllCompleted({ roomNumber, urgency, dateFrom, dateTo, page = 1, pageSize = 50 } = {}) {
  let q = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('status', 'done')
    .order('fixed_at', { ascending: false });
  if (roomNumber) q = q.eq('room_number', roomNumber);
  if (urgency) q = q.eq('urgency', urgency);
  if (dateFrom) q = q.gte('reported_at', dateFrom);
  if (dateTo) {
    // Inclusive end-of-day: append 23:59:59 if user passed yyyy-mm-dd
    const end = dateTo.length === 10 ? `${dateTo}T23:59:59` : dateTo;
    q = q.lte('reported_at', end);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

export async function createMaintenance({ roomNumber, photoUrl, note, urgency, reportedBy }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      room_number: String(roomNumber),
      photo_url: photoUrl || null,
      note: note?.trim() || null,
      urgency,
      reported_by: reportedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAsDone(id, fixedBy, fixNote) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'done',
      fixed_by: fixedBy,
      fixed_at: new Date().toISOString(),
      fix_note: fixNote?.trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
}
