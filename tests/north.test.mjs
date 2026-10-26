import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchNorth,NORTH_SOURCES} from '../netlify/functions/feeds/north.mjs';
test('northern calendars preserve DST recurrence and exclusions, all-day bounds and actual locations',async()=>{
const source=NORTH_SOURCES.find(s=>s.id==='stow-library');
const ics=`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:dst
DTSTART;TZID=America/New_York:20261025T100000
DTEND;TZID=America/New_York:20261025T110000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=America/New_York:20261108T100000
SUMMARY:Morning club
LOCATION:Stow Room
END:VEVENT
BEGIN:VEVENT
UID:all-day
DTSTART;VALUE=DATE:20261106
DTEND;VALUE=DATE:20261109
SUMMARY:Book sale
LOCATION:Stow Room
END:VEVENT
BEGIN:VEVENT
UID:unknown
DTSTART:20261101T150000Z
SUMMARY:Offsite program
LOCATION:Off Site Location
END:VEVENT
BEGIN:VEVENT
UID:canceled
DTSTART:20261101T150000Z
SUMMARY:Canceled program
STATUS:CANCELLED
LOCATION:Stow Room
END:VEVENT
END:VCALENDAR`;
const events=await fetchNorth(source,'2026-11',async()=>new Response(ics));
assert.deepEqual(events.filter(e=>e.title==='Morning club').map(e=>e.start),['2026-11-01 10:00:00','2026-11-15 10:00:00']);
assert.equal(events.find(e=>e.title==='Book sale').end,'2026-11-08 23:59:59');
assert.equal(events.length,3);

});
