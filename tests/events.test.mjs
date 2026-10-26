import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{SOURCES,HOTELS,monthRange,normalize,fetchSource,getCalendar,plain,nearby,finalize,milesBetween} from '../netlify/functions/events.mjs';
import {easternWall} from '../netlify/functions/feeds/common.mjs';
const wine=SOURCES.find(s=>s.id==='wine-mill');
const raw={id:1,status:'publish',title:'Music &amp; More',start_date:'2026-10-31 20:00:00',end_date:'2026-11-01 01:00:00',url:'https://www.thewinemill.com/event/test/',all_day:false};
test('month boundaries include leap years and reject invalid inputs',()=>{
 assert.equal(monthRange('2028-02').end,'2028-02-29');assert.equal(monthRange('2026-12').next,'2027-01-01');
 for(const value of ['2026-13','2026-00','2026-1','../../','2101-01'])assert.throws(()=>monthRange(value));
});
test('ten-mile radius is computed before display rounding and per hotel',()=>{
 const h=HOTELS.stow;
 const point=miles=>({...h,latitude:h.latitude+(miles/3958.7613)*180/Math.PI});
 assert.ok('stow' in nearby(point(9.99)));assert.ok(!('stow' in nearby(point(10.01))));
 assert.ok(Math.abs(milesBetween(h,point(10))-10)<1e-8);
 assert.deepEqual(nearby({latitude:0,longitude:0}),{});assert.deepEqual(nearby({}),{});
 assert.ok(!('canton' in nearby(h)));
});
test('normalization excludes private and canceled entries, finalization validates location and safe URLs',()=>{
 const n=normalize(raw,wine),e=finalize(n,wine,'2026-11');
 assert.equal(e.title,'Music & More');assert.equal(e.end,'2026-11-01 01:00:00');assert.ok(e.distances.stow>0);
 assert.equal(finalize({...n,url:'javascript:alert(1)'},wine,'2026-10'),null);
 assert.equal(finalize({...n,latitude:null,longitude:null},wine,'2026-10'),null);
 assert.equal(finalize({...n,latitude:40.7,longitude:-81.4},wine,'2026-10'),null);
 assert.equal(finalize({...n,virtual:true},wine,'2026-10'),null);
 assert.equal(normalize({...raw,event_status:{status:'canceled'}},wine),null);
 assert.equal(normalize({...raw,status:'draft'},wine),null);
 assert.equal(plain('A &#8217; B &#999999999;'),'A ’ B');
});
test('UTC timestamps convert across the Eastern daylight-saving boundary',()=>{
 assert.equal(easternWall('2026-11-01T05:30:00Z'),'2026-11-01 01:30:00');
 assert.equal(easternWall('2026-11-01T07:30:00Z'),'2026-11-01 02:30:00');
 assert.equal(easternWall('2026-07-01T00:30:00Z'),'2026-06-30 20:30:00');
});
test('pagination keeps recurring occurrences and overlapping events',async()=>{
 const pages=[];
 const result=await fetchSource(wine,'2026-11',async url=>{
  const page=Number(url.searchParams.get('page'));pages.push(page);
  return Response.json({total_pages:2,events:[page===1?raw:{...raw,id:2,start_date:'2026-11-03 20:00:00',end_date:'2026-11-03 21:00:00'}]});
 });
 assert.deepEqual(pages,[1,2]);assert.equal(result.length,2);
});
test('partial outages retain successful listings and deduplicate repeats',async()=>{
 let calls=0;
 const result=await getCalendar('2026-10',async()=>{
  if(++calls===2)throw new Error('timeout');
  return Response.json({total_pages:1,events:[raw,raw]});
 },[wine,{...wine,id:'offline'}]);
 assert.equal(result.sources.filter(s=>s.status==='unavailable').length,1);assert.equal(result.events.length,1);
 assert.ok(result.calendars.every(c=>c.hotels.length));
});
test('valid empty feeds differ from failed feeds',async()=>{
 const empty=await getCalendar('2026-10',async()=>Response.json({total_pages:0,events:[]}),[wine]);
 assert.equal(empty.events.length,0);assert.ok(empty.sources.every(s=>s.status==='ok'));
 const failed=await getCalendar('2026-10',async()=>new Response('unavailable',{status:503}),[wine]);
 assert.ok(failed.sources.every(s=>s.status==='unavailable'));
});
test('endpoint rejects invalid dates and methods before network calls',async()=>{
 assert.equal((await handler(new Request('http://localhost/.netlify/functions/events?month=no'))).status,400);
 assert.equal((await handler(new Request('http://localhost/.netlify/functions/events',{method:'POST'}))).status,405);
});
