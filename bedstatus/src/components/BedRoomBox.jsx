import React from "react";
import { formatShortBuddhistDate, daysSince } from "../utils/thaiDate";

// Returns Tailwind classes for the box background based on days since
// the bed was rotated. Rotate every 4 months (26 Oct 2026, Bo): green ≤ 60,
// yellow 61–119, red ≥ 120 — the legend in BedDashboard.jsx states the same.
const GREEN_MAX_DAYS = 60;
const YELLOW_MAX_DAYS = 119;
function colorFor(days) {
  if (days == null) return "bg-gray-200 border-gray-400";
  if (days <= GREEN_MAX_DAYS) return "bg-green-300 border-green-600";
  if (days <= YELLOW_MAX_DAYS) return "bg-yellow-200 border-yellow-500";
  return "bg-red-300 border-red-600";
}

const BedRoomBox = ({ roomNumber, record, onClick }) => {
  const lastDate = record?.last_rotation_date || null;
  const rotatedBy = record?.rotated_by || "";
  const days = daysSince(lastDate);
  const colorClass = colorFor(days);
  const hasData = !!lastDate;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg p-2 border ${colorClass} cursor-pointer transition min-w-[80px] hover:shadow-md`}
    >
      <div className="flex flex-col items-start">
        <p className="font-bold text-lg sm:text-xl leading-tight">{roomNumber}</p>
        {hasData ? (
          <>
            <p className="text-xs sm:text-sm text-gray-800 mt-0.5">
              {formatShortBuddhistDate(lastDate)}
            </p>
            <p
              className="text-xs sm:text-sm text-gray-700 mt-0.5 truncate w-full"
              title={rotatedBy}
            >
              {rotatedBy || "—"}
            </p>
          </>
        ) : (
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">ยังไม่มีข้อมูล</p>
        )}
      </div>
    </div>
  );
};

export default BedRoomBox;
