import React, { useEffect, useMemo, useRef, useState } from "react";
import Footer from "../shared/Footer";
import "../shared/theme.css";
import "../shared/shared.css";
import AirconRoomBox from "./AirconRoomBox";
import AirconEditModal from "./AirconEditModal";
import { FLOORS, getRoomUnits } from "../utils/rooms";
import { formatThaiBuddhistDate, formatTimeOfDay } from "../utils/thaiDate";
import {
  fetchAllAirconStatus,
  subscribeAirconStatus,
} from "../services/airconCleaning";

// Snapshot the load time once — the header date/time should not tick.
const PAGE_LOAD_TIME = new Date();

const AirconDashboard = () => {
  const dateString = useMemo(() => formatThaiBuddhistDate(PAGE_LOAD_TIME), []);
  const timeString = useMemo(() => formatTimeOfDay(PAGE_LOAD_TIME), []);

  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { roomNumber, suffix }

  // Reuse roomstatus auth flag — same login covers both apps.
  const [isLoggedIn, setIsLoggedIn] = useState(
    typeof window !== "undefined" &&
      localStorage.getItem("crystal_roomstatus_auth") === "true"
  );
  const reloadDebounce = useRef(null);

  // Initial load + realtime subscription.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = await fetchAllAirconStatus();
      if (!cancelled) {
        setStatusMap(map);
        setLoading(false);
      }
    })();

    const unsubscribe = subscribeAirconStatus(() => {
      // Debounce burst updates from the realtime channel.
      if (reloadDebounce.current) clearTimeout(reloadDebounce.current);
      reloadDebounce.current = setTimeout(async () => {
        const map = await fetchAllAirconStatus();
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
    };
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);

  const refreshStatus = async () => {
    const map = await fetchAllAirconStatus();
    setStatusMap(map);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FA]">
      {/* Page Title Bar */}
      <div className="bg-slate-700 text-white py-4 px-6 mb-6 relative">
        {/* Login pill / current user — links to roomstatus to log in */}
        <div className="absolute top-4 right-6">
          {isLoggedIn ? (
            <a
              href="/roomstatus/"
              className="px-4 py-2 bg-[#15803D] text-white rounded-full shadow-md hover:bg-[#166534] transition-colors text-sm font-medium inline-block"
            >
              👤 ผู้ใช้งาน
            </a>
          ) : (
            <a
              href="/roomstatus/"
              className="px-4 py-2 bg-[#15803D] text-white rounded-full shadow-md hover:bg-[#166534] transition-colors text-sm font-medium inline-block"
            >
              เข้าสู่ระบบ
            </a>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Crystal Resort: Air Conditioner Cleaning Status
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

        {/* Floor plan */}
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
                  {rooms.map((roomNumber) => {
                    const units = getRoomUnits(roomNumber);
                    if (units.length === 1) {
                      const unit = units[0];
                      return (
                        <AirconRoomBox
                          key={unit.code}
                          roomNumber={roomNumber}
                          suffix={null}
                          record={statusMap[unit.code]}
                          onClick={() =>
                            setEditing({ roomNumber, suffix: null })
                          }
                        />
                      );
                    }
                    // Dual-AC room — two adjacent boxes sharing the slot.
                    return (
                      <div key={roomNumber} className="flex gap-0.5">
                        {units.map((unit) => (
                          <AirconRoomBox
                            key={unit.code}
                            roomNumber={roomNumber}
                            suffix={unit.suffix}
                            record={statusMap[unit.code]}
                            onClick={() =>
                              setEditing({ roomNumber, suffix: unit.suffix })
                            }
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-2xl p-4 shadow-md max-w-2xl mx-auto">
          <h3 className="font-semibold text-[#15803D] mb-3 text-base">
            หมายเหตุ: ควรล้างแอร์ทุก 3 เดือน
          </h3>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-green-300 border border-green-600" />
              <span>เขียว = ล้างมาไม่เกิน 40 วัน</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-yellow-200 border border-yellow-500" />
              <span>เหลือง = ล้างมาแล้ว 41–89 วัน</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block w-5 h-5 rounded bg-red-300 border border-red-600" />
              <span>แดง = ล้างมาแล้ว 90 วันขึ้นไป (ควรล้างแล้ว)</span>
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
        <AirconEditModal
          open={!!editing}
          roomNumber={editing.roomNumber}
          suffix={editing.suffix}
          record={
            statusMap[
              editing.suffix
                ? `${editing.roomNumber}-${editing.suffix}`
                : editing.roomNumber
            ]
          }
          canEdit={isLoggedIn}
          onClose={() => setEditing(null)}
          onLoginRequired={() => {
            window.location.href = "/roomstatus/";
          }}
          onSaved={refreshStatus}
        />
      )}
    </div>
  );
};

export default AirconDashboard;
