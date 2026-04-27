import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toDateInputValue } from "../utils/thaiDate";
import {
  upsertAirconStatus,
  deleteAirconStatus,
} from "../services/airconCleaning";

const AirconEditModal = ({
  open,
  onClose,
  roomNumber,
  suffix,
  record,
  canEdit,
  onLoginRequired,
  onSaved,
}) => {
  const [date, setDate] = useState("");
  const [technician, setTechnician] = useState("");
  const [saving, setSaving] = useState(false);

  const headerLabel = suffix ? `ห้อง ${roomNumber} ${suffix}` : `ห้อง ${roomNumber}`;
  const roomCode = suffix ? `${roomNumber}-${suffix}` : roomNumber;

  // Reset form whenever the modal opens with a (possibly different) record.
  useEffect(() => {
    if (open) {
      setDate(toDateInputValue(record?.last_cleaned_date));
      setTechnician(record?.technician_name || "");
    }
  }, [open, record]);

  const handleSave = async () => {
    if (!canEdit) {
      onLoginRequired?.();
      return;
    }
    if (!date) {
      alert("กรุณาเลือกวันที่ล้างล่าสุด");
      return;
    }
    try {
      setSaving(true);
      await upsertAirconStatus({
        roomCode,
        lastCleanedDate: date,
        technicianName: technician.trim(),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      onLoginRequired?.();
      return;
    }
    if (!record) {
      onClose();
      return;
    }
    if (!confirm(`ลบข้อมูลของ ${headerLabel} ใช่หรือไม่?`)) return;
    try {
      setSaving(true);
      await deleteAirconStatus(roomCode);
      onSaved?.();
      onClose();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบ: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-[#15803D]">
              {headerLabel}
            </h2>

            {!canEdit && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                คุณยังไม่ได้เข้าสู่ระบบ — สามารถดูข้อมูลได้แต่แก้ไขไม่ได้
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                วันที่ล้างล่าสุด
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!canEdit}
                className="w-full border-2 border-gray-300 rounded-lg p-2 text-base text-black focus:outline-none focus:ring-2 focus:ring-[#15803D] disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                ชื่อช่างที่ล้าง
              </label>
              <input
                type="text"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                disabled={!canEdit}
                placeholder="เช่น พี่สมชาย"
                className="w-full border-2 border-gray-300 rounded-lg p-2 text-base text-black focus:outline-none focus:ring-2 focus:ring-[#15803D] disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            <div className="flex justify-between items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={!canEdit || saving || !record}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-base font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                ลบข้อมูล
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="bg-gray-300 text-black px-4 py-2 rounded-lg text-base font-semibold hover:bg-gray-400 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canEdit || saving}
                  className="bg-[#15803D] text-white px-4 py-2 rounded-lg text-base font-semibold hover:bg-[#166534] transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AirconEditModal;
