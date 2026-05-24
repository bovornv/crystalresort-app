import React, { useEffect, useMemo, useRef, useState } from "react";
import Footer from "../shared/Footer";
import "../shared/theme.css";
import "../shared/shared.css";
import BedRoomBox from "./BedRoomBox";
import BedEditModal from "./BedEditModal";
import LoginModal from "./LoginModal";
import { FLOORS } from "../utils/rooms";
import { formatThaiBuddhistDate, formatTimeOfDay } from "../utils/thaiDate";
import {
  fetchAllBedRotationStatus,
  subscribeBedRotationStatus,
} from "../services/bedRotation";

// Snapshot the load time once — the header date/time should not tick.
const PAGE_LOAD_TIME = new Date();

const BedDashboard = () => {
  const dateString = useMemo(() => formatThaiBuddhistDate(PAGE_LOAD_TIME), []);
  const timeString = useMemo(() => formatTimeOfDay(PAGE_LOAD_TIME), []);

  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { roomNumber }

  // Reuse roomstatus auth flag — same login covers both apps.
  const [isLoggedIn, setIsLoggedIn] = useState(
    typeof window !== "undefined" &&
      localStorage.getItem("crystal_roomstatus_auth") === "true"
  );
  const [nickname, setNickname] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("crystal_roomstatus_name") || ""
      : ""
  );
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const reloadDebounce = useRef(null);

  // Initial load + realtime subscription.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = await fetchAllBedRotationStatus();
      if (!cancelled) {
        setStatusMap(map);
        setLoading(false);
      }
    })();

    const unsubscribe = subscribeBedRotationStatus(() => {
      // Debounce burst updates from the realtime channel.
      if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
      reloadDebounce.current = setTimeout(async () => {
        const map = await fetchAllBedRotationStatus();
        if (!cancelled) setStatusMap(map);
      }, 200);
    });

    return () => {
      cancelled = true;
      if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
      unsubscribe();
    };
  }, []);

  // Refresh login state when tab regains focus (user might log in elsewhere).
  useEffect(() => {
    const handler = () => {
      setIsLoggedIn(localStorage.getItem("crystal_roomstatus_auth") === "true");
      setNickname(localStorage.getItem("crystal_roomstatus_name") || "");
    };
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);

  // Close the user dropdown when clicking outside it.
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (!e.target.closest(".bed-user-menu-container")) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  const handleLogin = (name) => {
    const trimmed = name.trim();
    localStorage.setItem("crystal_roomstatus_auth", "true");
    localStorage.setItem("crystal_roomstatus_name", trimmed);
    localStorage.setItem("crystal_nickname", trimmed);
    // Reload so the Supabase client (which gates on the auth flag at module load)
    // initializes with real credentials instead of the no-op mock.
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("crystal_roomstatus_auth");
    localStorage.removeItem("crystal_roomstatus_name");
    localStorage.removeItem("crystal_nickname");
    window.location.reload();
  };

  const refreshStatus = async () => {
    const map = await fetchAllBedRotationStatus();
    setStatusMap(map);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FA]">
      {/* Page Title Bar */}
      <div className="bg-slate-700 text-white py-4 px-6 mb-6 relative">
        {/* Login pill / current user — opens login modal or user dropdown */}
        <div className="absolute top-4 right-6 bed-user-menu-container">
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="px-4 py-2 bg-[#15803D] text-white rounded-full shadow-md hover:bg-[#166534] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <span>👤</span>
                <span>{nickname || "ผู้ใช้งาน"}</span>
                <span className="text-xs">▼</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium">{nickname || "ผู้ใช้งาน"}</div>
                      <div className="text-xs text-gray-500">ผู้ใช้ที่เข้าสู่ระบบ</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <span>🚪</span>
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4 py-2 bg-[#15803D] text-white rounded-full shadow-md hover:bg-[#166534] transition-colors text-sm font-medium"
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Crystal Resort: สถานะการหมุนเตียง
          </h1>
          <div className="flex justify-center items-center gap-2 flex-wrap">
            <p className="text-white text-lg">{dateString}</p>
            <span className="text-white text-lg">:</span>
            <p className="text-white text-lg">{timeString}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 sm:px-6 pb-8 max-w-screen-2xl mx-auto w-full">
        {loading && (
          <div className="text-center text-gray-500 py-8">กำลังโหลดข้อมูล...</div>
        )}

        {/* Floor plan — one box per room (no dual-AC suffix split). */}
        <div className="space-y-3">
          {FLOORS.map(({ floor, rooms }) => (
            <div key={floor} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-16 text-center">
                <h2 className="font-semibold text-[#15803D] text-lg">
                  ชั้น {floor}
                </h2>
              </div>
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-1.5 min-w-max">
                  {rooms.map((roomNumber) => (
                    <BedRoomBox
                      key={roomNumber}
                      roomNumber={roomNumber}
                      record={statusMap[roomNumber]}
                      onClick={() => setEditing({ roomNumber })}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-2xl p-4 shadow-md max-w-2xl mx-auto">
          <h3 className="font-semibold text-[#15803D] mb-3 text-base">
            หมายเหตุ: ควรหมุนเตียงทุก 3 เดือน
          </h3>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-green-300 border border-green-600" />
              <span>เขียว = หมุนเตียงมาไม่เกิน 40 วัน</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-yellow-200 border border-yellow-500" />
              <span>เหลือง = หมุนเตียงมาแล้ว 41–89 วัน</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-red-300 border border-red-600" />
              <span>แดง = หมุนเตียงมาแล้ว 90 วันขึ้นไป (ควรหมุนเตียงแล้ว)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-gray-200 border border-gray-400" />
              <span>เทา = ยังไม่มีข้อมูล</span>
            </li>
          </ul>
        </div>
      </main>

      <Footer />

      {/* Edit modal */}
      {editing && (
        <BedEditModal
          open={!!editing}
          roomNumber={editing.roomNumber}
          record={statusMap[editing.roomNumber]}
          canEdit={isLoggedIn}
          onClose={() => setEditing(null)}
          onLoginRequired={() => setShowLoginModal(true)}
          onSaved={refreshStatus}
        />
      )}

      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />
    </div>
  );
};

export default BedDashboard;
