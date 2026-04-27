import React from "react";
import { formatShortBuddhistDate, daysSince } from "../utils/thaiDate";

// Returns Tailwind classes for the box background based on days since cleaning.
function colorFor(days) {
  if (days == null) return "bg-gray-200 border-gray-400";
  if (days <= 40) return "bg-green-300 border-green-600";
  if (days <= 89) return "bg-yellow-200 border-yellow-500";
  return "bg-red-300 border-red-600";
}

const AirconRoomBox = ({ roomNumber, suffix, record, onClick }) => {
  const lastDate = record?.last_cleaned_date || null;
  const technician = record?.technician_name || "";
  const days = daysSince(lastDate);
  const colorClass = colorFor(days);
  const hasData = !!lastDate;

  // Display label for the box header. e.g. "601 B" or "401".
  const label = suffix ? `${roomNumber} ${suffix}` : roomNumber;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg p-2 border ${colorClass} cursor-pointer transition min-w-[80px] hover:shadow-md`}
    >
      <div className="flex flex-col items-start">
        <p className="font-bold text-lg sm:text-xl leading-tight">{label}</p>
        {hasData ? (
          <>
            <p className="text-xs sm:text-sm text-gray-800 mt-0.5">
              {formatShortBuddhistDate(lastDate)}
            </p>
            <p
              className="text-xs sm:text-sm text-gray-700 mt-0.5 truncate w-full"
              title={technician}
            >
              {technician || "—"}
            </p>
          </>
        ) : (
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">ยังไม่มีข้อมูล</p>
        )}
      </div>
    </div>
  );
};

export default AirconRoomBox;
