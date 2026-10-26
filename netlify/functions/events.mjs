import {NORTH_SOURCES, NORTH_LINKS, fetchNorth} from './feeds/north.mjs';
import {AKRON_SOURCES, AKRON_LINKS, fetchAkron} from './feeds/akron.mjs';
import {CANTON_SOURCES, CANTON_LINKS, fetchCanton} from './feeds/canton.mjs';
import {plain,safeURL,monthRange,getJSON} from './feeds/common.mjs';
export {plain,safeURL,monthRange} from './feeds/common.mjs';

// Coordinates from U.S. Census address matches, checked 2026-10-26.
// Distance is an approximate straight-line radius, never a driving distance.
export const HOTELS = {
  'stow': {name:'Home2 Suites · Stow',latitude:41.179439203689,longitude:-81.480840684126},
  'cuyahoga-falls': {name:'Comfort · Cuyahoga Falls',latitude:41.123411378001,longitude:-81.483781563979},
  'akron-south': {name:'Comfort · Akron South',latitude:40.979033856054,longitude:-81.486935554397},
  'canton': {name:'SpringHill Suites · Canton',latitude:40.864790241234,longitude:-81.431224546909}
};
export const RADIUS_MILES = 10;
const wine = {id:'wine-mill',name:'The Wine Mill',region:'wine',page:'https://www.thewinemill.com/events/',category:'Food & entertainment',latitude:41.2039684102,longitude:-81.495607893535};
// Fixed allowlist: visitor requests can select only a month, never a remote URL.
export const SOURCES = [wine,...NORTH_SOURCES,...AKRON_SOURCES,...CANTON_SOURCES];
export const DIRECTORY = [...NORTH_LINKS,...AKRON_LINKS,...CANTON_LINKS];
export function milesBetween(a,b) {
  const rad = n=>n*Math.PI/180;
  const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
  return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function nearby(point) {
  const latitude=Number(point.latitude),longitude=Number(point.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<39||latitude>43||longitude> -79||longitude< -85)return {};
  return Object.fromEntries(Object.entries(HOTELS).map(([id,hotel])=>[id,milesBetween(hotel,{latitude,longitude})]).filter(([,d])=>d<=RADIUS_MILES).map(([id,d])=>[id,Math.round(d*10)/10]));
}
export function finalize(item,source,month) {
  const title=plain(item.title),url=safeURL(item.url),start=String(item.start||''),end=String(item.end||start);
  const format=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if(!title||!url||!format.test(start)||!format.test(end)||end<start)return null;
  if(item.cancelled||item.virtual||item.private||/^closed\b|library clos|season waitlist/i.test(title))return null;
  const range=monthRange(month);
  if(start.slice(0,10)>range.end||end.slice(0,10)<range.start)return null;
  const distances=nearby(item),hotels=Object.keys(distances);
  if(!hotels.length)return null;
  return {id:`${source.id}-${item.id||url}-${start}`,title,start,end,allDay:Boolean(item.allDay),timezone:'America/New_York',location:plain(item.location),category:item.category||source.category||'Community',hotels,distances,source:source.name,sourceId:source.id,url};
}
export function normalize(event,source=wine) {
  const state=typeof event.event_status==='object'?event.event_status?.status:event.event_status;
  if(event.status!=='publish'||event.hide_from_listings||/cancel/i.test(state||''))return null;
  const v=event.venue||{};
  // Wine Mill's calendar is on-site. An explicitly different venue must supply GEO.
  const onSite=!v.venue||/wine mill/i.test(v.venue);
  return {id:event.id,title:plain(event.title),start:event.start_date,end:event.end_date||event.start_date,allDay:Boolean(event.all_day),url:safeURL(event.url),location:[plain(v.venue),plain(v.city)].filter(Boolean).join(' · ')||'The Wine Mill · Peninsula',latitude:v.geo_lat??(onSite?source.latitude:null),longitude:v.geo_lng??(onSite?source.longitude:null),category:/live music|concert/i.test(plain(event.title))?'Live music':source.category};
}
export async function fetchSource(source,month,fetcher=fetch) {
  monthRange(month);
  const signal=AbortSignal.timeout(14000);
  if(source.region==='north')return fetchNorth(source,month,fetcher,signal);
  if(source.region==='akron')return fetchAkron(source,month,fetcher,signal);
  if(source.region==='canton')return fetchCanton(source,month,fetcher,signal);
  const {start,end}=monthRange(month),events=[];
  let pages=1;
  for(let page=1;page<=pages;page++){
    const url=new URL('https://www.thewinemill.com/wp-json/tribe/events/v1/events');
    Object.entries({start_date:`${start} 00:00:00`,end_date:`${end} 23:59:59`,per_page:'100',page:String(page)}).forEach(([k,v])=>url.searchParams.set(k,v));
    const data=await getJSON(url,fetcher,signal);
    if(!Array.isArray(data.events)||!Number.isInteger(data.total_pages)||data.total_pages>10)throw new Error('Unsupported feed response');
    pages=data.total_pages;
    events.push(...data.events.map(e=>normalize(e,source)).filter(Boolean));
  }
  return events;
}
export async function getCalendar(month,fetcher=fetch,sourceList=SOURCES) {
  monthRange(month);
  const results=await Promise.allSettled(sourceList.map(source=>fetchSource(source,month,fetcher)));
  const batches=results.map((result,i)=>result.status==='fulfilled'?result.value.map(item=>finalize(item,sourceList[i],month)).filter(Boolean):[]);
  const sources=sourceList.map((source,i)=>({id:source.id,name:source.name,url:source.page,status:results[i].status==='fulfilled'?'ok':'unavailable',count:batches[i].length,counts:Object.fromEntries(Object.keys(HOTELS).map(h=>[h,batches[i].filter(e=>e.hotels.includes(h)).length])),note:source.note||source.coverage||''}));
  const seen=new Set();
  const events=batches.flat().filter(e=>{
    // Same title, start and venue avoids duplicate listings from cooperating feeds.
    const place=e.location.toLowerCase().replace(/[^a-z0-9]/g,'');
    const key=`${e.title.toLowerCase().replace(/[^a-z0-9]/g,'')}|${e.start}|${place}`;
    const urlKey=`${e.url.replace(/[?#].*$/,'')}|${e.start}`;
    if(seen.has(key)||seen.has(urlKey))return false;seen.add(key);seen.add(urlKey);return true;
  }).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
  const calendars=DIRECTORY.map(s=>({...s,url:s.page,distances:nearby(s),hotels:Object.keys(nearby(s))})).filter(s=>s.hotels.length);
  return {month,radiusMiles:RADIUS_MILES,events,sources,calendars,updatedAt:new Date().toISOString()};
}
export default async function handler(request) {
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  const month=new URL(request.url).searchParams.get('month')||'';
  try{monthRange(month);}catch{return Response.json({error:'Use a valid month: YYYY-MM.'},{status:400});}
  const data=await getCalendar(month),healthy=data.sources.every(s=>s.status==='ok'),failed=data.sources.every(s=>s.status!=='ok');
  return Response.json(data,{status:failed?503:200,headers:{'Cache-Control':'no-cache','Netlify-CDN-Cache-Control':failed?'no-store':`public, s-maxage=${healthy?900:120}`,'X-Content-Type-Options':'nosniff'}});
}
