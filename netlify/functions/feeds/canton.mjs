import ICAL from 'ical.js';
import { XMLParser } from 'fast-xml-parser';
import { plain, safeURL, monthRange, easternWall, getJSON, getText } from './common.mjs';

// Public official calendars checked 2026-10-26. Coordinate evidence and feed
// quirks are documented in event-research/canton/README.md at the project root.
const VENUES = {
  palace: {latitude:40.802030494013,longitude:-81.373556897122,location:'Canton Palace Theatre · 605 Market Avenue North, Canton'},
  players: {latitude:40.867788331457,longitude:-81.441768528011,location:'Players Guild Theatre · 6000 Frank Avenue NW, North Canton'},
  ncLibrary: {latitude:40.8770539,longitude:-81.4028595,location:'North Canton Public Library · 185 North Main Street, North Canton'},
  hooverRoom: {latitude:40.875796187417,longitude:-81.397993965577,location:'Hoover District Program Room · 339 East Maple Street, North Canton'},
  walsh: {latitude:40.875028587378,longitude:-81.370456608868},
  malone: {latitude:40.824120092104,longitude:-81.379586458744},
  exploration: {latitude:40.811986180195,longitude:-81.458876840467},
  wildlife: {latitude:40.8046758658,longitude:-81.464818390488},
  tam: {latitude:40.833618123803,longitude:-81.441899428399}
};

export const CANTON_SOURCES = [
  {id:'canton-palace',name:'Canton Palace Theatre',page:'https://cantonpalacetheatre.org/calendar/',endpoint:'https://cantonpalacetheatre.org/wp-admin/admin-ajax.php',type:'wcs',category:'Arts & culture',...VENUES.palace},
  {id:'players-guild',name:'Players Guild Theatre',page:'https://playersguildtheatre.com/events/',endpoint:'https://playersguildtheatre.com/wp-json/tribe/events/v1/events',type:'tribe',category:'Arts & culture',...VENUES.players},
  {id:'north-canton-library',name:'North Canton Public Library',page:'https://events.northcantonlibrary.org/events/upcoming',endpoint:'https://events.northcantonlibrary.org/events/feed/ical',type:'ical',category:'Family & learning',...VENUES.ncLibrary},
  {id:'stark-library',name:'Stark Library · local branches',page:'https://starklibrary.bibliocommons.com/v2/events',endpoint:'https://gateway.bibliocommons.com/v2/libraries/starklibrary/rss/events',type:'bibliocommons',category:'Family & learning'},
  {id:'stark-parks',name:'Stark Parks · nearby programs',page:'https://starkparks.recdesk.com/Community/Calendar',endpoint:'https://starkparks.recdesk.com/Community/Calendar/GetCalendarItems',type:'recdesk',category:'Outdoors'},
  {id:'walsh-athletics',name:'Walsh University Athletics',page:'https://athletics.walsh.edu/calendar',endpoint:'https://athletics.walsh.edu/calendar.ashx/calendar.ics',type:'ical',category:'Sports',...VENUES.walsh},
  {id:'malone-athletics',name:'Malone University Athletics',page:'https://malonepioneers.com/calendar',endpoint:'https://malonepioneers.com/calendar.ashx/calendar.ics',type:'ical',category:'Sports',...VENUES.malone},
  {id:'north-canton',name:'North Canton Chamber',page:'https://northcantonchamber.org/events/',endpoint:'https://northcantonchamber.org/wp-json/tribe/events/v1/events',type:'tribe',category:'Community'}
].map(source => ({...source,region:'canton'}));

// These pages are useful to guests but are not represented as automatic feeds.
export const CANTON_LINKS = [
  {id:'pro-football-hof',name:'Pro Football Hall of Fame',page:'https://www.profootballhof.com/events',latitude:40.822726509802,longitude:-81.397598737987,category:'Sports'},
  {id:'canton-museum-art',name:'Canton Museum of Art',page:'https://www.cantonart.org/',latitude:40.806443753091,longitude:-81.372542342422,category:'Arts & culture'},
  {id:'canton-symphony',name:'Canton Symphony Orchestra',page:'https://cantonsymphony.org/',latitude:40.817368748765,longitude:-81.398245298968,category:'Live music'}
].map(source => ({...source,region:'canton'}));

const wall = value => String(value || '').replace('T',' ').slice(0,19).padEnd(19,':00');
const excluded = title => /\b(cancelled|canceled|postponed)\b|\bclosed\b/i.test(title);
const validCoordinates = v => v && Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude)) && Math.abs(Number(v.latitude)) <= 90 && Math.abs(Number(v.longitude)) <= 180;
function baseEvent(source,item) {
  if (!item.title || excluded(item.title) || !safeURL(item.url) || !validCoordinates(item)) return null;
  return {category:source.category,...item,latitude:Number(item.latitude),longitude:Number(item.longitude)};
}
function inMonth(event,month) {
  const {start,end} = monthRange(month);
  return event && event.start.slice(0,10) <= end && event.end.slice(0,10) >= start;
}

export function parsePalace(data,source) {
  if (!Array.isArray(data)) throw new Error('Unsupported Palace calendar');
  return data.filter(e=>!excluded(`${e.title} ${e.thumbnail || ''}`)).map(e=>baseEvent(source,{
    id:`${e.id}-${e.timestamp}`,title:plain(e.title),start:wall(e.start),end:wall(e.end || e.start),allDay:false,
    url:safeURL(e.permalink),...VENUES.palace,
    category:/concert|live.music/i.test(JSON.stringify(e.terms || {}))?'Live music':source.category
  })).filter(Boolean);
}

function tribeCoordinates(venue) {
  const latitude=venue?.geo_lat ?? venue?.latitude, longitude=venue?.geo_lng ?? venue?.longitude;
  return latitude != null && longitude != null && validCoordinates({latitude,longitude}) ? {latitude:Number(latitude),longitude:Number(longitude)} : null;
}
async function fetchTribe(source,month,fetcher,signal) {
  const {start,end}=monthRange(month),events=[];
  for(let page=1;page<=10;page++) {
    const url=new URL(source.endpoint);
    Object.entries({start_date:`${start} 00:00:00`,end_date:`${end} 23:59:59`,per_page:100,page}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    const data=await getJSON(url,fetcher,signal);
    if(!Array.isArray(data.events)) throw new Error('Unsupported theater/chamber calendar');
    for(const e of data.events) {
      const eventStatus=typeof e.event_status==='object'?JSON.stringify(e.event_status):String(e.event_status||'');
      if(e.status!=='publish'||e.hide_from_listings||/cancel|postpon/i.test(eventStatus))continue;
      const venue=e.venue||{},coordinates=tribeCoordinates(venue);
      // Only the theater's own production calendar may use its fixed home venue.
      // A different explicit venue needs its own coordinates, including chamber events.
      const isTheater=source.id==='players-guild' && (!venue.venue || /players guild|kent state stark/i.test(venue.venue));
      const point=coordinates || (isTheater?VENUES.players:null);
      if(!point)continue;
      const event=baseEvent(source,{id:String(e.id),title:plain(e.title),start:e.start_date,end:e.end_date||e.start_date,allDay:Boolean(e.all_day),url:safeURL(e.url),...point,location:plain(venue.venue)?[plain(venue.venue),plain(venue.city)].filter(Boolean).join(' · '):VENUES.players.location});
      if(event)events.push(event);
    }
    if(page >= Number(data.total_pages || 1))return events;
  }
  throw new Error('Calendar pagination limit exceeded');
}

const rssParser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,isArray:name=>name==='item'});
export function parseStarkRSS(text,source) {
  const feed=rssParser.parse(text),items=feed?.rss?.channel?.item || [];
  if(!feed?.rss?.channel)throw new Error('Unsupported library calendar');
  const events=items.map(e=>{
    if(e.is_cancelled==='true'||e.is_virtual==='true')return null;
    const v=e.location || {};
    if(v.latitude==null||v.longitude==null)return null;
    return baseEvent(source,{id:plain(e.guid?.['#text']||e.guid||e.link),title:plain(e.title),start:easternWall(e.start_date),end:easternWall(e.end_date||e.start_date),allDay:false,url:safeURL(e.link),location:[plain(v.name),plain(v.city)].filter(Boolean).join(' · '),latitude:Number(v.latitude),longitude:Number(v.longitude)});
  }).filter(Boolean);
  return {events,count:items.length};
}
async function fetchStarkRSS(source,month,fetcher,signal) {
  const {start,end}=monthRange(month),events=[];
  const page=async n=>{
    const url=new URL(source.endpoint);url.searchParams.set('startDate',start);url.searchParams.set('endDate',end);url.searchParams.set('page',String(n));
    return parseStarkRSS(await getText(url,fetcher,signal),source);
  };
  // BiblioCommons RSS uses 25 items/page, independent of its HTML page size.
  // Date bounds avoid fetching its entire multi-year calendar.
  for(let first=1;first<=33;first+=4) {
    const batch=await Promise.all([first,first+1,first+2,first+3].map(page));
    for(const result of batch) { events.push(...result.events);if(result.count<25)return events; }
  }
  throw new Error('Library pagination limit exceeded');
}

function icalWall(time) {
  if(!time)return '';
  if(time.isDate)return `${time.toString()} 00:00:00`;
  if(time.zone?.tzid==='UTC')return easternWall(time.toJSDate());
  // Library feeds are UTC; SIDEARM is UTC or DATE. Respect local/floating times
  // and any supplied Ohio VTIMEZONE instead of converting twice.
  if(time.zone?.tzid==='floating'||/New_York|Eastern/i.test(time.zone?.tzid||''))return wall(time.toString());
  return easternWall(time.toJSDate());
}
function icalPoint(source,component,location,title) {
  if(source.id==='north-canton-library') {
    if(/185 North Main Street/i.test(location))return VENUES.ncLibrary;
    if(/339 E(?:ast)? Maple St/i.test(location))return VENUES.hooverRoom;
    // Never let a copied library GEO incorrectly locate an offsite program.
    // New library venues must first have their address verified and mapped.
    return null;
  }
  const geo=component.getFirstPropertyValue('geo');
  if(Array.isArray(geo)&&validCoordinates({latitude:geo[0],longitude:geo[1]}))return {latitude:geo[0],longitude:geo[1]};
  // City-only athletics records are not enough to prove a local game. Only
  // explicitly named home facilities are mapped; all away/neutral games drop.
  if(source.id==='walsh-athletics' && /Cecchini Center|Alumni Arena|Larry Staudt Field|Biery Stadium|Tim Mead Field|WU Softball Complex|Klekotka Tennis Complex/i.test(location) && !/\bat\b/i.test(title))return VENUES.walsh;
  if(source.id==='malone-athletics' && /Osborne Hall/i.test(location) && !/\bat\b/i.test(title))return VENUES.malone;
  return null;
}
export function parseCantonICS(text,source,month) {
  const calendar=new ICAL.Component(ICAL.parse(text)),events=[];
  // All three verified calendars materialize each occurrence (no RRULE,
  // RECURRENCE-ID, RDATE or EXDATE). Fail visibly if the provider switches to
  // recurrence definitions rather than showing only the first occurrence.
  if(calendar.getAllSubcomponents('vevent').some(component=>['rrule','rdate','exdate','recurrence-id'].some(name=>component.hasProperty(name))))throw new Error('Calendar recurrence format changed');
  for(const component of calendar.getAllSubcomponents('vevent')) {
    const e=new ICAL.Event(component),title=plain(e.summary),location=plain(e.location),status=String(component.getFirstPropertyValue('status')||'');
    if(/CANCELLED/i.test(status)||excluded(title))continue;
    const coordinates=icalPoint(source,component,location,title);if(!coordinates)continue;
    const start=icalWall(e.startDate);let end=icalWall(e.endDate||e.startDate);
    const allDay=e.startDate?.isDate || (source.id==='north-canton-library' && start.endsWith('00:00:00') && end.endsWith('00:00:00'));
    // RFC 5545 DATE ends are exclusive. Store the last displayed second so the
    // calendar does not add an extra day to tournaments and date-only events.
    if(e.startDate?.isDate && end>start)end=new Date(Date.parse(end.replace(' ','T')+'Z')-1000).toISOString().replace('T',' ').slice(0,19);
    const event=baseEvent(source,{id:plain(e.uid),title,start,end,allDay:Boolean(allDay),url:safeURL(plain(component.getFirstPropertyValue('url'))),...coordinates,location});
    if(inMonth(event,month))events.push(event);
  }
  return events;
}

function parkPoint(event) {
  const id=Number(event.FacilityId),name=event.FacilityName || '';
  if([2,171,175,176,178,179,180].includes(id)&&/^Exploration Gateway\b/.test(name))return VENUES.exploration;
  if([41,43,44].includes(id)&&/^WCC\b/.test(name))return VENUES.wildlife;
  if(id===142&&/Tam O.Shanter Clubhouse/.test(name))return VENUES.tam;
  return null;
}
async function fetchParks(source,month,fetcher,signal) {
  const {start,next}=monthRange(month),us=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}/${d.slice(0,4)}`;
  const response=await fetcher(source.endpoint,{method:'POST',signal,headers:{'Content-Type':'application/json','User-Agent':'NEOHotelGroup-Events/2.0'},body:JSON.stringify({facilityId:-1,startDate:us(start),endDate:us(next),getChildren:'false',SelectedView:'month',SelectedMonth:String(Number(month.slice(5))),SelectedYear:month.slice(0,4)})});
  if(!response.ok)throw new Error(`Park calendar returned ${response.status}`);
  const data=await response.json();if(!Array.isArray(data.Events))throw new Error('Unsupported park calendar');
  return data.Events.filter(e=>!e.IsPrivate&&e.EventType==='P').map(e=>{
    const point=parkPoint(e);if(!point)return null;
    // RecDesk's public calendar uses these ISO fields as LOCAL wall time despite
    // a trailing Z. Verified against its official Dec. 9 Canvas at 6 p.m. listing.
    return baseEvent(source,{id:`${e.EventId}-${e.EventScheduleId}-${e.StartTimeISO8601}`,title:plain(e.EventName).replace(/^\d{2}\/\d{2}\/\d{4}\s*-\s*/,''),start:wall(e.StartTimeISO8601),end:wall(e.EndTimeISO8601||e.StartTimeISO8601),allDay:Boolean(e.AllDay),url:`https://starkparks.recdesk.com/Community/Program/Detail?programId=${encodeURIComponent(e.EventId)}`,location:plain(e.FacilityName),...point});
  }).filter(Boolean);
}

export async function fetchCanton(source,month,fetcher=fetch,signal) {
  let events;
  if(source.type==='wcs') {
    const {start,next}=monthRange(month),url=new URL(source.endpoint);
    Object.entries({action:'wcs_get_events_json',start,end:next}).forEach(([k,v])=>url.searchParams.set(k,v));
    events=parsePalace(await getJSON(url,fetcher,signal),source);
  } else if(source.type==='tribe')events=await fetchTribe(source,month,fetcher,signal);
  else if(source.type==='bibliocommons')events=await fetchStarkRSS(source,month,fetcher,signal);
  else if(source.type==='ical')events=parseCantonICS(await getText(source.endpoint,fetcher,signal),source,month);
  else if(source.type==='recdesk')events=await fetchParks(source,month,fetcher,signal);
  else throw new Error('Unknown Canton calendar');
  return events.filter(e=>inMonth(e,month));
}
