import test from 'node:test';
import assert from 'node:assert/strict';
import {AKRON_SOURCES,fetchAkron} from '../netlify/functions/feeds/akron.mjs';

const source = id => AKRON_SOURCES.find(s=>s.id===id);
const respond = value => ({ok:true,text:async()=>JSON.stringify(value)});

test('University shows public physical events, preserves DST, and deduplicates shared copies',async()=>{
  const good={id:1,title:'Public concert',date_iso:'2026-11-02T00:30:00Z',date2_iso:'2026-11-02T02:30:00Z',url:'https://calendar.uakron.edu/event/1',location:'E.J. Thomas Hall',location_latitude:41.0783,location_longitude:-81.51504,event_types:[' Open to the Public'],status:1};
  const rows=[good,{...good,id:2},{...good,title:'Canceled',is_canceled:1},{...good,title:'Online',is_online:1},{...good,title:'Internal',event_types:[]},{...good,title:'Unknown venue',location_latitude:null},{...good,title:'Hidden',status:2}];
  const result=await fetchAkron(source('uakron'),'2026-11',async()=>respond({data:rows,meta:{total_pages:1}}));
  assert.equal(result.length,1);assert.equal(result[0].start,'2026-11-01 19:30:00');assert.equal(result[0].end,'2026-11-01 21:30:00');
});

test('Library locates events by physical branch rather than organizer; excludes canceled, moved, private, external and online events',async()=>{
  const good={id:1,title:'Family storytime',raw_start_time:'2026-11-03 10:30:00',raw_end_time:'2026-11-03 11:30:00',url:'https://akronlibrary.libnet.info/event/1',location_id:1482,venue_type:'internal',event_type:'INPERSON',private_event:'0',changed:null};
  const rows=[good,{...good,id:2,title:'Canceled',changed:'1'},{...good,id:3,title:'Moved',changed:'3'},{...good,id:4,title:'External',venue_type:'external'},{...good,id:5,title:'Online',event_type:'ONLINE'},{...good,id:6,title:'Private',private_event:'1'},{...good,id:7,title:'Mobile',location_id:3204}];
  const locations=[{id:1482,name:'Green Branch Library',line1:'4046 Massillon Road',locality:'Green',lat:40.9512275,lon:-81.464},{id:3204,name:'Mobile Services',lat:41.083,lon:-81.51}];
  const result=await fetchAkron(source('akron-library'),'2026-11',async u=>respond(u.includes('/locations')?locations:rows));
  assert.equal(result.length,1);assert.equal(result[0].start,'2026-11-03 10:30:00');assert.equal(result[0].latitude,40.9512275);
});

test('Baseball excludes away games and postponed games, converts UTC time, and does not invent duration',async()=>{
  const good={gamePk:1,officialDate:'2027-04-02',gameDate:'2027-04-02T23:17:00Z',status:{detailedState:'Scheduled'},teams:{home:{team:{id:402}},away:{team:{name:'Erie SeaWolves'}}},venue:{name:'7 17 Credit Union Park',location:{address1:'300 S. Main Street',city:'Akron',defaultCoordinates:{latitude:41.07739,longitude:-81.52185}}}};
  const games=[good,{...good,gamePk:2,teams:{...good.teams,home:{team:{id:100}}}},{...good,gamePk:3,status:{detailedState:'Postponed'}},{...good,gamePk:4,venue:{}}];
  const result=await fetchAkron(source('rubberducks'),'2027-04',async()=>respond({dates:[{games}]}));
  assert.equal(result.length,1);assert.equal(result[0].start,'2027-04-02 19:17:00');assert.equal(result[0].end,result[0].start);
});

test('Tribe only assigns known actual venues and drops hidden/unknown events',async()=>{
  const good={id:1,title:'Exhibition',status:'publish',utc_start_date:'2026-11-03 17:00:00',utc_end_date:'2026-11-03 22:00:00',url:'https://www.summitartspace.org/event/exhibition',venue:{id:11691,venue:'Summit Artspace'}};
  const rows=[good,{...good,id:2,title:'Unknown venue',venue:{id:999}},{...good,id:3,title:'Hidden',hide_from_listings:true},{...good,id:4,title:'Poetry night',event_status:{status:'canceled'}}];
  const result=await fetchAkron(source('summit-artspace'),'2026-11',async url=>{
    assert.equal(new URL(url).searchParams.has('start_date'),false);
    return respond({events:rows,total_pages:1});
  });
  assert.equal(result.length,1);assert.equal(result[0].latitude,41.083671620855);assert.equal(result[0].start,'2026-11-03 12:00:00');
});
