import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MaintenanceTable from "./MaintenanceTable";

const URGENCY_BADGE_BG = {
  not_urgent: "#FCD34D",
  urgent: "#FB923C",
  most_urgent: "#B91C1C",
};

// Render order for the per-room dot stack: most urgent on top.
const DOT_STACK_LIMIT = 4;
const URGENCY_RENDER_ORDER = ["most_urgent", "urgent", "not_urgent"];

// Build a sorted list of up to 4 urgency keys from per-urgency counts.
// Example: { most_urgent: 1, urgent: 2, not_urgent: 3 } → ["most_urgent","urgent","urgent","not_urgent"]
function buildDotStack(byUrgency) {
  if (!byUrgency) return [];
  const dots = [];
  for (const key of URGENCY_RENDER_ORDER) {
    const n = byUrgency[key] || 0;
    for (let i = 0; i < n; i++) dots.push(key);
  }
  return dots.slice(0, DOT_STACK_LIMIT);
}

const RoomCard = ({
  room,
  updateRoomImmediately,
  isLoggedIn,
  onLoginRequired,
  currentNickname,
  currentDate,
  maintenanceInfo,
  onMaintenanceChanged,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const closeBtnRef = useRef(null);

  // ESC closes the modal + body scroll lock + focus the close button on open.
  useEffect(() => {
    if (!showPopup) return;
    const onKey = (e) => { if (e.key === "Escape") setShowPopup(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showPopup]);

  const colorMap = {
    cleaned: "bg-green-200", // ห้องเสร็จแล้ว (ว่าง)
    cleaned_stay: "bg-cyan-200", // ห้องเสร็จแล้ว (พักต่อ)
    closed: "bg-gray-500 text-white", // ปิดห้อง
    checked_out: "bg-red-300", // ออกแล้ว
    vacant: "bg-white", // ว่าง
    stay_clean: "bg-blue-200", // พักต่อ
    will_depart_today: "bg-yellow-200", // จะออกวันนี้
    long_stay: "bg-gray-200", // รายเดือน
    unoccupied_3d: "bg-purple-300", // ห้องไม่มีเข้าพัก 3 วันติด
  };

  const isFO = currentNickname === "FO";
  const roomBg = colorMap[room.status] || "bg-white";
  const borderColor = room.border === "red" ? "border-2 border-red-600" : "border border-black";

  const handleStatusChange = async (status) => {
    if (!isLoggedIn || !currentNickname) {
      onLoginRequired();
      return;
    }

    const wasCleaned = (status === "cleaned" || status === "cleaned_stay") &&
                        room.status !== "cleaned" && room.status !== "cleaned_stay";

    const wasPurpleBeforeCleaned = wasCleaned && room.status === "unoccupied_3d";

    const roomUpdates = {
      status,
      border: "black",
      maid: isFO ? (room.maid || "") : ((status === "cleaned" || status === "cleaned_stay") ? currentNickname.trim() : (room.maid || "")),
      cleanedToday: wasCleaned ? true : (room.cleanedToday || false),
    };

    if (wasPurpleBeforeCleaned) {
      roomUpdates.wasPurpleBeforeCleaned = true;
    }

    if (updateRoomImmediately) {
      await updateRoomImmediately(room.number, roomUpdates);
    }
  };

  const handleSelectRoom = async () => {
    if (!isLoggedIn || !currentNickname || isFO) {
      if (!isLoggedIn) onLoginRequired();
      return;
    }

    const newBorder = room.border === "red" ? "black" : "red";
    const roomUpdates = {
      border: newBorder,
      maid: currentNickname.trim(),
    };

    if (updateRoomImmediately) {
      await updateRoomImmediately(room.number, roomUpdates);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    onMaintenanceChanged?.();
  };

  // Maintenance badge: vertical stack of one dot per pending item, sorted
  // most-urgent first, capped at DOT_STACK_LIMIT. Tooltip shows TOTAL count
  // (including any items beyond the cap).
  const dotStack = buildDotStack(maintenanceInfo?.byUrgency);
  const totalPending = maintenanceInfo?.count || 0;

  return (
    <div
      onClick={() => setShowPopup(true)}
      className={`relative rounded-lg p-2 ${roomBg} ${borderColor} cursor-pointer transition min-w-[80px]`}
    >
      {dotStack.length > 0 && (
        <div
          className="absolute top-1 right-1 flex flex-col gap-0.5"
          title={`มีรายการแจ้งช่าง ${totalPending} รายการ`}
          aria-label={`มีรายการแจ้งช่าง ${totalPending} รายการ`}
        >
          {dotStack.map((urg, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: URGENCY_BADGE_BG[urg] }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-start">
        <p className="font-bold text-lg sm:text-xl">{room.number}</p>
        <p className="text-xs sm:text-sm text-gray-700">{room.type}</p>
        {room.maid && (
          <p className="text-base sm:text-lg font-semibold text-gray-800 mt-1 block">{room.maid}</p>
        )}
      </div>

      {/* Popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/50 md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closePopup();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`room-modal-title-${room.number}`}
          >
            <motion.div
              className="bg-white w-full md:max-w-4xl md:rounded-xl shadow-xl flex flex-col max-h-screen md:max-h-[90vh]"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — invisible spacer mirrors the close button so the title
                  stays centered relative to the full modal width. */}
              <div className="flex items-center gap-3 p-5 border-b border-gray-200">
                <div className="w-9 h-9 flex-shrink-0" aria-hidden="true" />
                <h2
                  id={`room-modal-title-${room.number}`}
                  className="flex-1 min-w-0 text-center text-2xl sm:text-3xl font-bold text-[#15803D]"
                >
                  ห้อง {room.number}
                </h2>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closePopup}
                  aria-label="ปิด"
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#15803D]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Body (scrollable) — status section on top, maintenance section at the bottom */}
              <div className="overflow-y-auto p-5 space-y-6">
                {/* Status / cleaning section */}
                <section>
                  <div className="max-w-md mx-auto">
                    {!isFO && (
                      <>
                        {room.status !== "stay_clean" && room.status !== "long_stay" && (
                          <div className="flex justify-center mb-4">
                            <button
                              className="w-full bg-green-200 hover:bg-green-300 text-black py-5 rounded-lg text-xl font-bold transition-colors"
                              onClick={() => handleStatusChange("cleaned")}
                            >
                              ห้องเสร็จแล้ว (ว่าง)
                            </button>
                          </div>
                        )}
                        {(room.status === "stay_clean" || room.status === "long_stay") && (
                          <div className="flex justify-center mb-4">
                            <button
                              className="w-full bg-cyan-200 hover:bg-cyan-300 text-black py-5 rounded-lg text-xl font-bold transition-colors"
                              onClick={() => handleStatusChange("cleaned_stay")}
                            >
                              ห้องเสร็จแล้ว (พักต่อ)
                            </button>
                          </div>
                        )}
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <button
                            onClick={handleSelectRoom}
                            className={`px-5 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-colors ${
                              room.border === "red"
                                ? "bg-[#15803D] text-white hover:bg-[#166534]"
                                : "bg-green-200 text-black hover:bg-green-300"
                            }`}
                          >
                            เลือกห้องนี้
                          </button>
                          <button
                            onClick={closePopup}
                            className="bg-gray-300 text-black px-5 py-2.5 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-400 transition-colors"
                          >
                            ปิด
                          </button>
                        </div>
                      </>
                    )}

                    {isFO && (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <button
                            onClick={() => handleStatusChange("cleaned")}
                            className="bg-green-200 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-green-300 transition-colors"
                          >
                            ห้องเสร็จแล้ว (ว่าง)
                          </button>
                          <button
                            onClick={() => handleStatusChange("cleaned_stay")}
                            className="bg-cyan-200 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-cyan-300 transition-colors"
                          >
                            ห้องเสร็จแล้ว (พักต่อ)
                          </button>
                          <button
                            onClick={() => handleStatusChange("closed")}
                            className="bg-gray-500 text-white py-4 rounded-lg text-lg sm:text-xl font-bold hover:bg-gray-600 transition-colors"
                          >
                            ปิดห้อง
                          </button>
                          <button
                            onClick={() => handleStatusChange("checked_out")}
                            className="bg-red-300 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-red-400 transition-colors"
                          >
                            ออกแล้ว
                          </button>
                          <button
                            onClick={() => handleStatusChange("vacant")}
                            className="bg-white border-2 border-gray-300 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-gray-50 transition-colors"
                          >
                            ว่าง
                          </button>
                          <button
                            onClick={() => handleStatusChange("stay_clean")}
                            className="bg-blue-200 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-blue-300 transition-colors"
                          >
                            พักต่อ
                          </button>
                          <button
                            onClick={() => handleStatusChange("will_depart_today")}
                            className="bg-yellow-200 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-yellow-300 transition-colors"
                          >
                            จะออกวันนี้
                          </button>
                          <button
                            onClick={() => handleStatusChange("long_stay")}
                            className="bg-gray-200 py-4 rounded-lg text-black text-lg sm:text-xl font-bold hover:bg-gray-300 transition-colors"
                          >
                            รายเดือน
                          </button>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={closePopup}
                            className="bg-gray-300 text-black px-5 py-2.5 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-400 transition-colors"
                          >
                            ปิด
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Maintenance section — at the bottom */}
                <section
                  className="border-t border-gray-200 pt-5"
                  aria-labelledby={`maint-section-${room.number}`}
                >
                  <h3
                    id={`maint-section-${room.number}`}
                    className="text-lg sm:text-xl font-bold text-[#15803D] mb-3"
                  >
                    แจ้งช่าง
                  </h3>
                  <MaintenanceTable
                    roomNumber={String(room.number)}
                    currentNickname={currentNickname}
                    isLoggedIn={isLoggedIn}
                    onLoginRequired={onLoginRequired}
                    onChange={onMaintenanceChanged}
                  />
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomCard;
