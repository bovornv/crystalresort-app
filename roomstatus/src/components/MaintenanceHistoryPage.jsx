import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllCompleted } from '../services/maintenance';
import { supabase } from '../services/supabase';
import Footer from '../shared/Footer';
import { URGENCY_LEVELS, formatThai } from './MaintenanceTable';

const PAGE_SIZE = 50;

export default function MaintenanceHistoryPage() {
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({
    roomNumber: '',
    urgency: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [photoLightbox, setPhotoLightbox] = useState(null);

  // Room dropdown options.
  useEffect(() => {
    let alive = true;
    supabase
      .from('roomstatus_rooms')
      .select('room_number')
      .order('room_number', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && Array.isArray(data)) {
          setRooms(data.map(r => r.room_number));
        }
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAllCompleted({ ...filters, page, pageSize: PAGE_SIZE })
      .then(res => { if (alive) setData(res); })
      .catch(err => {
        console.error(err);
        alert('โหลดประวัติไม่สำเร็จ');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filters, page]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const updateFilter = (patch) => {
    setPage(1);
    setFilters(f => ({ ...f, ...patch }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-700 text-white py-4 px-6 mb-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="text-white text-sm hover:underline whitespace-nowrap">
            ← กลับ
          </Link>
          <h1 className="text-lg sm:text-2xl font-bold text-center flex-1">
            📋 ประวัติแจ้งซ่อมทั้งหมด
          </h1>
          <span className="w-12" aria-hidden="true" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-700">ห้อง</label>
            <select
              value={filters.roomNumber}
              onChange={(e) => updateFilter({ roomNumber: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white"
            >
              <option value="">ทุกห้อง</option>
              {rooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-700">ระดับความเร่งด่วน</label>
            <select
              value={filters.urgency}
              onChange={(e) => updateFilter({ urgency: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white"
            >
              <option value="">ทุกระดับ</option>
              {URGENCY_LEVELS.map(u => (
                <option key={u.key} value={u.key}>{u.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-700">จากวันที่</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter({ dateFrom: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-700">ถึงวันที่</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter({ dateTo: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-100 text-left text-gray-700">
                <tr>
                  <th className="px-3 py-2">ห้อง</th>
                  <th className="px-3 py-2">วันที่แจ้ง</th>
                  <th className="px-3 py-2">หมายเหตุ</th>
                  <th className="px-3 py-2">ผู้แจ้ง</th>
                  <th className="px-3 py-2">ระดับ</th>
                  <th className="px-3 py-2">วันที่ซ่อม</th>
                  <th className="px-3 py-2">ผู้ซ่อม</th>
                  <th className="px-3 py-2">บันทึกการซ่อม</th>
                  <th className="px-3 py-2">รูป</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-500">กำลังโหลด…</td></tr>
                )}
                {!loading && data.rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-500">ไม่มีข้อมูล</td></tr>
                )}
                {!loading && data.rows.map(r => {
                  const urg = URGENCY_LEVELS.find(u => u.key === r.urgency) || URGENCY_LEVELS[0];
                  return (
                    <tr key={r.id} className="border-t border-gray-200 align-top">
                      <td className="px-3 py-2 font-semibold text-gray-900">{r.room_number}</td>
                      <td className="px-3 py-2 text-gray-700">{formatThai(r.reported_at)}</td>
                      <td className="px-3 py-2 text-gray-900 whitespace-pre-wrap">{r.note || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.reported_by}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 text-xs font-semibold rounded"
                          style={{ backgroundColor: urg.bg, color: urg.text }}
                        >
                          {urg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.fixed_at ? formatThai(r.fixed_at) : '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.fixed_by || '—'}</td>
                      <td className="px-3 py-2 text-gray-900 whitespace-pre-wrap">{r.fix_note || '—'}</td>
                      <td className="px-3 py-2">
                        {r.photo_url ? (
                          <button type="button" onClick={() => setPhotoLightbox(r.photo_url)} aria-label="ดูรูปขนาดใหญ่">
                            <img src={r.photo_url} alt="" className="w-12 h-12 object-cover rounded border border-gray-300" />
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-3 border-t border-gray-200 text-sm">
            <span className="text-gray-600">
              {data.total > 0
                ? `แสดง ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, data.total)} จาก ${data.total}`
                : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="text-gray-700">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      </div>

      {photoLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoLightbox(null)}
          role="dialog"
          aria-label="ดูรูปขนาดใหญ่"
        >
          <img src={photoLightbox} alt="" className="max-h-full max-w-full object-contain rounded shadow-2xl" />
        </div>
      )}

      <Footer />
    </div>
  );
}
