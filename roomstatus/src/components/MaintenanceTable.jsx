import React, { useState, useEffect, useRef } from 'react';
import {
  uploadPhoto,
  fetchPendingByRoom,
  fetchCompletedByRoom,
  createMaintenance,
  markAsDone,
} from '../services/maintenance';

export const URGENCY_LEVELS = [
  { key: 'not_urgent',  label: 'ไม่ด่วน', bg: '#FCD34D', text: '#000000' },
  { key: 'urgent',      label: 'ด่วน',    bg: '#FB923C', text: '#000000' },
  { key: 'most_urgent', label: 'ด่วนสุด', bg: '#B91C1C', text: '#FFFFFF' },
];

export const formatThai = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
};

const CameraIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const Spinner = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeOpacity="0.25"/>
    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </svg>
);

const blankDraft = () => ({
  draftId: Math.random().toString(36).slice(2),
  photoUrl: null,
  photoFile: null,
  photoPreview: null,
  uploading: false,
  note: '',
  urgency: null,
});

const UrgencyButton = ({ urg, selected, onClick, disabled }) => {
  const base = 'px-2.5 py-1 text-xs font-semibold rounded border-2 transition whitespace-nowrap disabled:opacity-60';
  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed="true"
        disabled={disabled}
        className={`${base} ring-2 ring-black/40`}
        style={{ backgroundColor: urg.bg, color: urg.text, borderColor: 'rgba(0,0,0,0.5)' }}
      >
        {urg.label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed="false"
      disabled={disabled}
      className={`${base} bg-white text-gray-800 hover:bg-gray-50`}
      style={{ borderColor: urg.bg }}
    >
      {urg.label}
    </button>
  );
};

const PendingRow = ({ n, row, busy, onMarkFix, onPhotoClick }) => {
  const urg = URGENCY_LEVELS.find(u => u.key === row.urgency) || URGENCY_LEVELS[0];
  return (
    <tr className="bg-amber-50/40 align-top">
      <td className="px-2 py-2 text-gray-700">{n}</td>
      <td className="px-2 py-2">
        {row.photo_url ? (
          <button type="button" onClick={onPhotoClick} aria-label="ดูรูปขนาดใหญ่">
            <img src={row.photo_url} alt="" className="w-14 h-14 object-cover rounded border border-gray-300" />
          </button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="text-sm whitespace-pre-wrap text-gray-900">{row.note || '—'}</div>
        <div className="text-xs text-gray-500 mt-1">
          รายงานโดย: {row.reported_by} · {formatThai(row.reported_at)}
        </div>
      </td>
      <td className="px-2 py-2">
        <span
          className="inline-block px-2 py-1 text-xs font-semibold rounded"
          style={{ backgroundColor: urg.bg, color: urg.text }}
        >
          {urg.label}
        </span>
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={onMarkFix}
          disabled={busy}
          className="px-3 py-1.5 bg-[#15803D] text-white rounded text-xs font-semibold hover:bg-[#166534] disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก…' : 'ซ่อมแล้ว'}
        </button>
      </td>
    </tr>
  );
};

const DraftRow = ({
  n, draft, busy, currentNickname,
  onPick, onConfirmPhoto, onCancelPhoto,
  onChangeNote, onChangeUrgency, onSave, onPhotoClick,
}) => {
  const fileInputRef = useRef(null);
  const hasPendingPhoto = draft.photoFile && !draft.photoUrl;
  const hasUploadedPhoto = !!draft.photoUrl;

  return (
    <tr className="align-top">
      <td className="px-2 py-2 text-gray-700">{n}</td>
      <td className="px-2 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
          aria-label="เลือกรูปถ่าย"
        />
        {!draft.photoFile && !draft.photoUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-500 hover:bg-gray-50"
            aria-label="ถ่ายรูปหรือเลือกรูป"
          >
            <CameraIcon />
          </button>
        )}
        {hasPendingPhoto && (
          <div className="space-y-1">
            <button type="button" onClick={onPhotoClick} aria-label="ดูรูปขนาดใหญ่">
              <img src={draft.photoPreview} alt="" className="w-14 h-14 object-cover rounded border border-gray-300" />
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onConfirmPhoto}
                disabled={draft.uploading}
                className="px-2 py-0.5 text-xs bg-[#15803D] text-white rounded hover:bg-[#166534] disabled:opacity-60 flex items-center gap-1"
              >
                {draft.uploading && <Spinner className="w-3 h-3" />}
                บันทึก
              </button>
              <button
                type="button"
                onClick={onCancelPhoto}
                disabled={draft.uploading}
                className="px-2 py-0.5 text-xs bg-gray-300 text-black rounded hover:bg-gray-400 disabled:opacity-60"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
        {hasUploadedPhoto && (
          <button
            type="button"
            onClick={onPhotoClick}
            aria-label="ดูรูปขนาดใหญ่"
            className="block"
          >
            <img src={draft.photoUrl} alt="" className="w-14 h-14 object-cover rounded border border-gray-300" />
          </button>
        )}
      </td>
      <td className="px-2 py-2">
        <textarea
          rows={2}
          value={draft.note}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="พิมพ์รายละเอียด…"
          className="w-full border border-gray-300 rounded p-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#15803D] resize-y"
          aria-label="หมายเหตุ"
        />
        <div className="text-xs text-gray-500 mt-1">
          รายงานโดย: {currentNickname || '—'}
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {URGENCY_LEVELS.map(u => (
            <UrgencyButton
              key={u.key}
              urg={u}
              selected={draft.urgency === u.key}
              onClick={() => onChangeUrgency(u.key)}
              disabled={busy}
            />
          ))}
        </div>
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || draft.uploading}
          className="px-3 py-1.5 bg-[#15803D] text-white rounded text-xs font-semibold hover:bg-[#166534] disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </td>
    </tr>
  );
};

const FixConfirmDialog = ({ fixNote, busy, onChangeNote, onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="fix-confirm-title"
  >
    <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl">
      <h3 id="fix-confirm-title" className="text-lg font-bold mb-3 text-gray-900">
        ยืนยันว่าซ่อมเรียบร้อยแล้ว?
      </h3>
      <label className="block text-sm font-semibold mb-1 text-gray-700">
        บันทึกการซ่อม (ถ้ามี)
      </label>
      <textarea
        rows={3}
        value={fixNote}
        onChange={(e) => onChangeNote(e.target.value)}
        className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#15803D] resize-y"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 bg-gray-300 text-black rounded text-sm font-semibold hover:bg-gray-400 disabled:opacity-60"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="px-4 py-2 bg-[#15803D] text-white rounded text-sm font-semibold hover:bg-[#166534] disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก…' : 'ยืนยัน'}
        </button>
      </div>
    </div>
  </div>
);

const RoomHistoryView = ({ completed, loading, onPhotoClick }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm min-w-[820px]">
      <thead className="bg-gray-100 text-left">
        <tr>
          <th className="px-2 py-2">วันที่แจ้ง</th>
          <th className="px-2 py-2">หมายเหตุ</th>
          <th className="px-2 py-2">ผู้แจ้ง</th>
          <th className="px-2 py-2">ระดับ</th>
          <th className="px-2 py-2">วันที่ซ่อม</th>
          <th className="px-2 py-2">ผู้ซ่อม</th>
          <th className="px-2 py-2">บันทึกการซ่อม</th>
          <th className="px-2 py-2">รูป</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={8} className="text-center py-6 text-gray-500">กำลังโหลด…</td></tr>
        )}
        {!loading && completed.length === 0 && (
          <tr><td colSpan={8} className="text-center py-6 text-gray-500">ไม่มีประวัติ</td></tr>
        )}
        {!loading && completed.map(r => {
          const urg = URGENCY_LEVELS.find(u => u.key === r.urgency) || URGENCY_LEVELS[0];
          return (
            <tr key={r.id} className="border-t border-gray-200 align-top">
              <td className="px-2 py-2">{formatThai(r.reported_at)}</td>
              <td className="px-2 py-2 whitespace-pre-wrap">{r.note || '—'}</td>
              <td className="px-2 py-2">{r.reported_by}</td>
              <td className="px-2 py-2">
                <span
                  className="inline-block px-2 py-0.5 text-xs font-semibold rounded"
                  style={{ backgroundColor: urg.bg, color: urg.text }}
                >
                  {urg.label}
                </span>
              </td>
              <td className="px-2 py-2">{r.fixed_at ? formatThai(r.fixed_at) : '—'}</td>
              <td className="px-2 py-2">{r.fixed_by || '—'}</td>
              <td className="px-2 py-2 whitespace-pre-wrap">{r.fix_note || '—'}</td>
              <td className="px-2 py-2">
                {r.photo_url ? (
                  <button type="button" onClick={() => onPhotoClick(r.photo_url)} aria-label="ดูรูปขนาดใหญ่">
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
);

const PhotoLightbox = ({ src, onClose }) => (
  <div
    className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
    onClick={onClose}
    role="dialog"
    aria-label="ดูรูปขนาดใหญ่"
  >
    <img src={src} alt="" className="max-h-full max-w-full object-contain rounded shadow-2xl" />
  </div>
);

export default function MaintenanceTable({
  roomNumber,
  currentNickname,
  isLoggedIn,
  onLoginRequired,
  onChange,
}) {
  const [view, setView] = useState('list');
  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [drafts, setDrafts] = useState([blankDraft()]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [fixDialog, setFixDialog] = useState(null);
  const [photoLightbox, setPhotoLightbox] = useState(null);

  // Track preview URLs to revoke on unmount.
  const previewsRef = useRef(new Set());
  const trackPreview = (url) => {
    if (url) previewsRef.current.add(url);
    return url;
  };
  const releasePreview = (url) => {
    if (url && previewsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      previewsRef.current.delete(url);
    }
  };
  useEffect(() => () => {
    previewsRef.current.forEach(u => URL.revokeObjectURL(u));
    previewsRef.current.clear();
  }, []);

  // Load pending items.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPendingByRoom(roomNumber)
      .then(rows => { if (alive) setPending(rows); })
      .catch(err => { console.error(err); alert('โหลดรายการแจ้งช่างไม่สำเร็จ'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roomNumber]);

  // Load history when entering history view.
  useEffect(() => {
    if (view !== 'history') return;
    let alive = true;
    setHistoryLoading(true);
    fetchCompletedByRoom(roomNumber)
      .then(rows => { if (alive) setCompleted(rows); })
      .catch(err => { console.error(err); alert('โหลดประวัติไม่สำเร็จ'); })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [view, roomNumber]);

  const updateDraft = (draftId, patch) => {
    setDrafts(d => d.map(r => (r.draftId === draftId ? { ...r, ...patch } : r)));
  };

  const requireLogin = () => {
    if (!isLoggedIn || !currentNickname) {
      onLoginRequired?.();
      return false;
    }
    return true;
  };

  const handleFilePick = (draftId, file) => {
    if (!file) return;
    if (!requireLogin()) return;
    const draft = drafts.find(d => d.draftId === draftId);
    if (draft?.photoPreview) releasePreview(draft.photoPreview);
    const preview = trackPreview(URL.createObjectURL(file));
    updateDraft(draftId, { photoFile: file, photoPreview: preview, photoUrl: null });
  };

  const handleConfirmPhoto = async (draftId) => {
    if (!requireLogin()) return;
    const draft = drafts.find(d => d.draftId === draftId);
    if (!draft?.photoFile) return;
    updateDraft(draftId, { uploading: true });
    try {
      const url = await uploadPhoto(draft.photoFile, roomNumber);
      releasePreview(draft.photoPreview);
      updateDraft(draftId, { photoUrl: url, photoFile: null, photoPreview: null, uploading: false });
    } catch (err) {
      console.error(err);
      alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
      updateDraft(draftId, { uploading: false });
    }
  };

  const handleCancelPhoto = (draftId) => {
    const d = drafts.find(x => x.draftId === draftId);
    if (d?.photoPreview) releasePreview(d.photoPreview);
    updateDraft(draftId, { photoFile: null, photoPreview: null, photoUrl: null });
  };

  const handleSaveDraft = async (draftId) => {
    if (!requireLogin()) return;
    const draft = drafts.find(d => d.draftId === draftId);
    if (!draft) return;
    if (!draft.urgency) {
      alert('กรุณาเลือกระดับความเร่งด่วน');
      return;
    }
    if (draft.photoFile && !draft.photoUrl) {
      alert('กรุณากด "บันทึก" ที่รูปก่อน หรือ "ยกเลิก" รูป');
      return;
    }
    setBusyId(draftId);
    try {
      const row = await createMaintenance({
        roomNumber,
        photoUrl: draft.photoUrl,
        note: draft.note,
        urgency: draft.urgency,
        reportedBy: currentNickname,
      });
      setPending(p => [...p, row]);
      setDrafts(d => {
        const without = d.filter(r => r.draftId !== draftId);
        return without.length ? without : [blankDraft()];
      });
      onChange?.();
    } catch (err) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddRow = () => setDrafts(d => [...d, blankDraft()]);

  const handleConfirmFix = async () => {
    if (!fixDialog) return;
    if (!requireLogin()) return;
    setBusyId(fixDialog.id);
    try {
      await markAsDone(fixDialog.id, currentNickname, fixDialog.note);
      setPending(p => p.filter(r => r.id !== fixDialog.id));
      setFixDialog(null);
      onChange?.();
    } catch (err) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusyId(null);
    }
  };

  const rows = view === 'list'
    ? [
        ...pending.map(p => ({ kind: 'pending', row: p })),
        ...drafts.map(d => ({ kind: 'draft', row: d })),
      ]
    : [];

  return (
    <div>
      {/* View switch */}
      <div className="mb-3 flex items-center gap-3 text-sm">
        {view === 'list' ? (
          <button
            type="button"
            onClick={() => setView('history')}
            className="text-[#15803D] underline hover:text-[#166534] font-medium"
          >
            ดูประวัติห้องนี้
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView('list')}
            className="text-[#15803D] underline hover:text-[#166534] font-medium"
          >
            ← กลับไปแจ้งช่าง
          </button>
        )}
      </div>

      {view === 'list' && (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            {loading ? (
              <div className="py-8 text-center text-gray-500 text-sm">กำลังโหลด…</div>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-100 text-left text-gray-700">
                  <tr>
                    <th className="px-2 py-2 w-10">#</th>
                    <th className="px-2 py-2 w-24">ถ่ายรูป</th>
                    <th className="px-2 py-2">หมายเหตุ</th>
                    <th className="px-2 py-2 w-56">เร่งด่วน</th>
                    <th className="px-2 py-2 w-28">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((entry, idx) => {
                    if (entry.kind === 'pending') {
                      return (
                        <PendingRow
                          key={`p-${entry.row.id}`}
                          n={idx + 1}
                          row={entry.row}
                          busy={busyId === entry.row.id}
                          onMarkFix={() => {
                            if (!requireLogin()) return;
                            setFixDialog({ id: entry.row.id, note: '' });
                          }}
                          onPhotoClick={() => setPhotoLightbox(entry.row.photo_url)}
                        />
                      );
                    }
                    return (
                      <DraftRow
                        key={`d-${entry.row.draftId}`}
                        n={idx + 1}
                        draft={entry.row}
                        busy={busyId === entry.row.draftId}
                        currentNickname={currentNickname}
                        onPick={(file) => handleFilePick(entry.row.draftId, file)}
                        onConfirmPhoto={() => handleConfirmPhoto(entry.row.draftId)}
                        onCancelPhoto={() => handleCancelPhoto(entry.row.draftId)}
                        onChangeNote={(v) => updateDraft(entry.row.draftId, { note: v })}
                        onChangeUrgency={(u) => updateDraft(entry.row.draftId, { urgency: u })}
                        onSave={() => handleSaveDraft(entry.row.draftId)}
                        onPhotoClick={() => setPhotoLightbox(entry.row.photoPreview || entry.row.photoUrl)}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-800"
          >
            + เพิ่มรายการ
          </button>
        </>
      )}

      {view === 'history' && (
        <RoomHistoryView
          completed={completed}
          loading={historyLoading}
          onPhotoClick={setPhotoLightbox}
        />
      )}

      {photoLightbox && (
        <PhotoLightbox src={photoLightbox} onClose={() => setPhotoLightbox(null)} />
      )}

      {fixDialog && (
        <FixConfirmDialog
          fixNote={fixDialog.note}
          busy={busyId === fixDialog.id}
          onChangeNote={(v) => setFixDialog(s => ({ ...s, note: v }))}
          onCancel={() => setFixDialog(null)}
          onConfirm={handleConfirmFix}
        />
      )}
    </div>
  );
}
