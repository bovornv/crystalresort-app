# CLAUDE.md — crystalresort-app

Crystal Resort and Cafe's staff tools, one Vercel project served at crystalresort.app:
`roomstatus/` (React + Vite), `airconstatus/`, `bedstatus/`, `maintenancereq/`, `purchase/`,
`dashboard/`, `api/`. UI is Thai — match it.

## Deploy
- Vercel builds from git on push to `main` (`package.json` → builds roomstatus, airconstatus,
  bedstatus); `vercel.json` routes `/roomstatus/*` to `roomstatus/dist`, which is NOT tracked.
  A code change is live only after a push; a Supabase value is live at once.
- Check a deploy: `gh api repos/bovornv/crystalresort-app/commits/<sha>/status`, then fetch the
  live bundle (`/roomstatus/assets/index-*.js`) and grep for the change.
- The working tree often carries unrelated uncommitted work (`purchase/`, `api/`, `vercel.json`,
  `package.json`). Commit only the files a task touched.

## Room Status (`roomstatus/`)
- Rooms live in Supabase `roomstatus_rooms` (one row per `room_number`, text — e.g. "505").
  Daily counts live in `reports` row `id = 'counts'`.
- **A monthly-stay room (ห้องรายเดือน) is `status = 'long_stay'`** (gray, `bg-gray-200`, label
  "รายเดือน") — not a room-type code (S / D2 / D5 / D6). Status alone does not last: the
  in-house PDF upload turns an in-house room blue (`stay_clean`), and the Expected Departure PDF
  upload puts back to gray only the rooms in **`LONG_STAY_ROOMS`** (top of
  `src/components/Dashboard.jsx`). The FO-only ลบข้อมูล reads the same list and keeps those rooms
  gray (its confirm text says "ยกเว้นห้องรายเดือน"). To add or remove a monthly room, change that
  one list (and the room's line in the fallback array further down) — nothing else.
- **Monthly rooms as of 6 Oct 2026: 503, 505, 608.** 505 added that day (`86675cb`; its row had
  been set `long_stay` by hand at 11:52); ลบข้อมูล fixed to keep them gray (`8cb592b`) — before,
  it reset every room to vacant despite its own confirm text.
- **Aurasea mirrors this:** Crystal Resort's Suite monthly-room setting in Aurasea
  (`room_type_long_stay`, ตั้งค่า → ประเภทห้อง) is 3 rooms at ฿3,000/month, set by Bo 6 Oct 2026
  08:17. Change a monthly room here and there together.
- The top counts (ห้องออกวันนี้ / ห้องพักต่อ / รวม) come from the NUMBER OF ROOMS IN THE TWO PDFs,
  not from room statuses: ห้องพักต่อ = in-house rows − departure rows. A monthly room on the
  in-house report counts in ห้องพักต่อ (occupied, not a departure) — intended.
- The fallback room array in `Dashboard.jsx` (used only when the table cannot load) must match the
  live rows — type and long-stay status — or a fallback load shows the wrong board.
