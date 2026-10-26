import test from 'node:test';
import assert from 'node:assert/strict';
import { CANTON_SOURCES, parseCantonICS, parseStarkRSS, parsePalace } from '../netlify/functions/feeds/canton.mjs';

const source=id=>CANTON_SOURCES.find(s=>s.id===id);
const ics=(props)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\n${props}\r\nURL:https://example.com/event\r\nEND:VEVENT\r\nEND:VCALENDAR`;

test('library UTC times cross the November DST boundary correctly',()=>{
  const input=ics('SUMMARY:Book club\r\nDTSTART:20261102T190000Z\r\nDTEND:20261102T200000Z\r\nLOCATION:185 North Main Street\\, North Canton');
  const [event]=parseCantonICS(input,source('north-canton-library'),'2026-11');
  assert.equal(event.start,'2026-11-02 14:00:00');
  assert.equal(event.latitude,40.8770539);
});

test('library offsite room uses its own geocode; unknown venues are excluded',()=>{
  const input=where=>ics(`SUMMARY:Book club\r\nDTSTART:20261102T190000Z\r\nDTEND:20261102T200000Z\r\nGEO:40.8770539;-81.4028595\r\nLOCATION:${where}`);
  const [event]=parseCantonICS(input('339 E Maple St #255'),source('north-canton-library'),'2026-11');
  assert.equal(event.latitude,40.875796187417);
  assert.equal(parseCantonICS(input('Unverified offsite venue'),source('north-canton-library'),'2026-11').length,0);
});

test('unexpected recurrence definitions fail instead of displaying a partial series',()=>{
  const input=ics('SUMMARY:Weekly club\r\nDTSTART:20261102T190000Z\r\nDTEND:20261102T200000Z\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nLOCATION:185 North Main Street');
  assert.throws(()=>parseCantonICS(input,source('north-canton-library'),'2026-11'),/recurrence format changed/);
});

test('athletics calendar excludes city-only away and neutral locations',()=>{
  const input=where=>ics(`SUMMARY:Walsh Volleyball vs Opponent\r\nDTSTART:20261103T230000Z\r\nDTEND:20261104T010000Z\r\nLOCATION:${where}`);
  assert.equal(parseCantonICS(input('North Canton\\, OH'),source('walsh-athletics'),'2026-11').length,0);
  assert.equal(parseCantonICS(input('North Canton\\, OH\\, Cecchini Center'),source('walsh-athletics'),'2026-11').length,1);
});

test('date-only sports end dates remain exclusive',()=>{
  const input=ics('SUMMARY:Walsh Tournament\r\nDTSTART;VALUE=DATE:20261103\r\nDTEND;VALUE=DATE:20261104\r\nLOCATION:Cecchini Center');
  const [event]=parseCantonICS(input,source('walsh-athletics'),'2026-11');
  assert.equal(event.end,'2026-11-03 23:59:59');
  assert.equal(event.allDay,true);
});

test('Palace preserves organizer wall time and drops postponed poster entries',()=>{
  const item={id:1,title:'Movie',start:'2026-10-30T19:30:00+00:00',end:'2026-10-30T21:00:00+00:00',permalink:'https://cantonpalacetheatre.org/event/movie'};
  const events=parsePalace([item,{...item,id:2,thumbnail:'https://example.com/postponed.jpg'}],source('canton-palace'));
  assert.equal(events.length,1);assert.equal(events[0].start,'2026-10-30 19:30:00');
});

test('BiblioCommons actual dates, cancellation and event geography are respected',()=>{
  const item=cancel=>`<item><title>Storytime</title><link>https://starklibrary.bibliocommons.com/events/1</link><bc:start_date>2026-11-02T15:00:00Z</bc:start_date><bc:end_date>2026-11-02T16:00:00Z</bc:end_date><bc:is_cancelled>${cancel}</bc:is_cancelled><bc:location><bc:name>Jackson Community</bc:name><bc:latitude>40.8613578</bc:latitude><bc:longitude>-81.4898966</bc:longitude></bc:location></item>`;
  const {count,events}=parseStarkRSS(`<rss xmlns:bc="http://bibliocommons.com/rss/1.0/modules/event/"><channel>${item('false')}${item('true')}</channel></rss>`,source('stark-library'));
  assert.equal(count,2);assert.equal(events.length,1);assert.equal(events[0].start,'2026-11-02 10:00:00');assert.equal(events[0].longitude,-81.4898966);
});
