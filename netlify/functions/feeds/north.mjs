import ICAL from 'ical.js';
import {plain, safeURL, monthRange, easternWall, getJSON, getText} from './common.mjs';

// Pins come from Census address matches or Kent State's official campus map.
// Full provenance and the checked upstream responses are in event-research/north.
const PINS = {
  library: [41.161681255919, -81.440462456791],
  community: [41.194246414319, -81.432034905099],
  silver: [41.194666853292, -81.402259912572],
  adell: [41.154931612648, -81.44045065083],
  city: [41.166919706938, -81.440457207327],
  blossom: [41.178301766956, -81.558981136119]
};
const campusPins = {
  'kent center for the performing arts': [41.152794,-81.340645],
  'the kent state university museum': [41.152702,-81.349915],
  'ksu museum': [41.152702,-81.349915],
  'rockwell hall': [41.152702,-81.349915],
  'cartwright hall': [41.151226,-81.348778],
  'library': [41.146767,-81.342178],
  'center for the visual arts': [41.1506,-81.347473],
  'center for visual arts': [41.1506,-81.347473],
  'taylor hall': [41.150204,-81.343979],
  'student rec and wellness ctr': [41.141647,-81.339653],
  'ice arena': [41.145775,-81.335991],
  'satterfield hall': [41.14817,-81.347557],
  'kent student center': [41.147694,-81.343033],
  'center for architecture and environmental design': [41.152458,-81.352142],
  'kiva': [41.147144,-81.343903],
  'design innovation hub': [41.150227,-81.346458]
};
const fallsFilter = 'eyJmZWVkVHlwZSI6ImljYWwiLCJmaWx0ZXJzIjp7ImxvY2F0aW9uIjpbImFsbCJdLCJhZ2VzIjpbImFsbCJdLCJ0eXBlcyI6WyJhbGwiXSwidGFncyI6W10sInRlcm0iOiIiLCJkYXlzIjoxfX0%3D';
export const NORTH_SOURCES = [
  {id:'stow-library', name:'Stow-Munroe Falls Public Library', page:'https://events.smfpl.org/calendar', endpoint:'https://events.smfpl.org/ical_subscribe.php?src=p&cid=15865', type:'ics', category:'Family & learning', region:'north', coverage:'Published subscription window; dates outside that window may not be listed.'},
  {id:'falls-library', name:'Cuyahoga Falls Library', page:'https://events.fallslibrary.org/events', endpoint:`https://fallslibrary.libnet.info/feeds?data=${fallsFilter}`, type:'ics', category:'Family & learning', region:'north', coverage:'Published upcoming subscription window; historical or distant dates may not be listed.'},
  {id:'stow-parks', name:'Stow Parks & Recreation', page:'https://www.stowohio.gov/Calendar.aspx?CID=23', endpoint:'https://www.stowohio.gov/common/modules/iCalendar/iCalendar.aspx?catID=23&feed=calendar', type:'ics', category:'Outdoors', region:'north', coverage:'Published city subscription window; only events with a verified street location are included.'},
  {id:'blossom', name:'Blossom Music Center', page:'https://www.blossommusic.com/shows', endpoint:'https://www.blossommusic.com/shows', type:'jsonld', category:'Live music', region:'north', coverage:'Currently announced shows; past shows are removed by the venue.'},
  {id:'kent-state', name:'Kent State University', page:'https://www.kent.edu/calendars', endpoint:'https://www.kent.edu/ksu_events_loader/KSUEventsFeed', type:'kent', category:'Arts & culture', region:'north', coverage:'Published university window; public in-person events at verified Kent Campus buildings only.'}
];
export const NORTH_LINKS = [
  {id:'kent-stage',name:'The Kent Stage',page:'https://kentstage.org/events/',latitude:41.153837543527,longitude:-81.35683746905,category:'Live music'},
  {id:'the-workz',name:'The Workz',page:'https://www.playattheworkz.com/Events',latitude:41.13733527039,longitude:-81.482757781332,category:'Food & entertainment'},
  {id:'stan-hywet',name:'Stan Hywet Hall & Gardens',page:'https://stanhywet.org/calendar',latitude:41.116686737796,longitude:-81.548606841954,category:'Arts & culture'}
];
const excludeTitle = /\b(cancelled|canceled|private event|private party|board of trustees|board meeting|library foundation meeting|closed|closing|virtual|online|zoom)\b/i;
const stowRooms = new Set(['Stow-Munroe Falls Room','Stow Room','Munroe Falls Room','Conference Room','Community Room','Library Lobby','Quiet Study Room']);
function stowPin(location, allowRooms) {
  if (/\b5344\s+Fishcreek\s+(Road|Rd)\b/i.test(location)) return PINS.community;
  if (/\b5238\s+Young\s+(Road|Rd)\b/i.test(location)) return PINS.silver;
  if (/\b3300\s+Darrow\s+(Road|Rd)\b/i.test(location)) return PINS.adell;
  if (/\b3760\s+Darrow\s+(Road|Rd)\b/i.test(location)) return PINS.city;
  if (allowRooms && location && location.split(',').every(x=>stowRooms.has(x.trim()))) return PINS.library;
  return null;
}
function overlaps(start,end,month) {
  const r = monthRange(month);
  return start && start.slice(0,10)<r.next && (end || start).slice(0,10)>=r.start;
}
function wall(time) {
  if (!time) return '';
  const iso = time.toString();
  if (time.isDate) return `${iso.slice(0,10)} 00:00:00`;
  if (time.zone?.tzid === 'floating' || time.zone?.tzid === 'America/New_York') return iso.replace('T',' ').slice(0,19);
  return easternWall(time.toJSDate());
}
function endWall(time,allDay) {
  if (!allDay) return wall(time);
  const date=time.clone(); date.adjust(-1,0,0,0); return `${date.toString().slice(0,10)} 23:59:59`;
}
function eventURL(event,source) {
  if (source.id==='falls-library' && /^\d+$/.test(event.uid||'')) return `https://fallslibrary.libnet.info/event/${event.uid}`;
  const direct=safeURL(event.component.getFirstPropertyValue('url'));
  // CivicEngage's URL property points to the subscription itself. Its description carries the event link.
  if (direct && !direct.includes('/iCalendar/')) return direct;
  const match=String(event.description||'').match(/https?:\/\/[^\s<>"]+(?:EID|eid)=\d+/);
  return safeURL(match?.[0]) || source.page;
}
function icsEvents(text,source,month) {
  const calendar=new ICAL.Component(ICAL.parse(text));
  const byUID=new Map();
  for (const comp of calendar.getAllSubcomponents('vevent')) {
    const uid=String(comp.getFirstPropertyValue('uid')||'');
    if (!byUID.has(uid)) byUID.set(uid,[]);
    byUID.get(uid).push(comp);
  }
  const output=[]; const next=monthRange(month).next;
  for (const [uid,components] of byUID) {
    const masters=components.filter(c=>!c.hasProperty('recurrence-id'));
    for (const master of masters) {
      try {
        const event=new ICAL.Event(master,{exceptions:components.filter(c=>c.hasProperty('recurrence-id'))});
        if (!event.startDate) continue;
        const add=(start,end,item)=>{
          const title=plain(item.summary); const location=plain(item.location);
          if (!title || excludeTitle.test(title) || String(item.component.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED') return;
          let pin;
          if (source.id==='falls-library') {
            const geo=item.component.getFirstPropertyValue('geo');
            if (Array.isArray(geo) && Number.isFinite(Number(geo[0])) && Number.isFinite(Number(geo[1])) && Number(geo[0])!==0 && Number(geo[1])!==0) pin=geo.map(Number);
          } else pin=stowPin(location,source.id==='stow-library');
          if (!pin) return;
          const allDay=start.isDate; const startText=wall(start); const endText=endWall(end||start,allDay);
          if (!overlaps(startText,endText,month)) return;
          output.push({id:`${source.id}-${uid}-${start.toString()}`,title,start:startText,end:endText,allDay,url:eventURL(item,source),location:source.id==='stow-library' && pin===PINS.library ? `Stow-Munroe Falls Public Library — ${location}`:location,latitude:pin[0],longitude:pin[1],category:source.category});
        };
        if (!event.isRecurring()) add(event.startDate,event.endDate,event);
        else {
          const iter=event.iterator(); let occurrence; let count=0;
          while ((occurrence=iter.next()) && count++<20000) {
            if (wall(occurrence).slice(0,10)>=next) break;
            const detail=event.getOccurrenceDetails(occurrence);
            add(detail.startDate,detail.endDate,detail.item);
          }
          if (count>=20000) throw new Error('Recurrence exceeds safe expansion limit');
        }
      } catch (error) {
        // A bad record must not erase the rest of this public calendar.
        if (error.message==='Recurrence exceeds safe expansion limit') continue;
      }
    }
  }
  return output;
}
function jsonLD(text) {
  const found=[];
  const walk=value=>{
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value!=='object') return;
    const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
    if (types.some(x=>/Event$/.test(x||''))) found.push(value);
    for (const [key,child] of Object.entries(value)) if (key!=='@context') walk(child);
  };
  for (const match of text.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {walk(JSON.parse(match[1]));} catch {}
  }
  return found;
}
function isoWall(value) {
  if (!value) return '';
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? easternWall(value) : String(value).replace('T',' ').slice(0,19);
}
function blossomEvents(text,source,month) {
  return jsonLD(text).flatMap(event=>{
    const title=plain(event.name);
    if (!title || /waitlist|season tickets|parking|club access/i.test(title) || /EventCancelled/.test(event.eventStatus||'') || excludeTitle.test(title)) return [];
    const start=isoWall(event.startDate); const end=isoWall(event.endDate)||start;
    if (!overlaps(start,end,month) || !/Blossom Music Center/i.test(event.location?.name||'')) return [];
    return [{id:`blossom-${event.url||title}-${start}`,title,start,end,allDay:false,url:safeURL(event.url)||source.page,location:'Blossom Music Center',latitude:PINS.blossom[0],longitude:PINS.blossom[1],category:source.category}];
  });
}
function kentEvents(data,source,month) {
  if (typeof data==='string') data=JSON.parse(data);
  return (data.events||[]).flatMap(event=>{
    if (event.KSUCampus!=='Kent Campus' || !event.IsInPerson || !/Open to Public/.test(event.Audience||'')) return [];
    const pin=campusPins[plain(event.Building).toLowerCase()];
    const title=plain(event['Event Name']);
    if (!pin || !title || excludeTitle.test(title)) return [];
    const start=easternWall(event['Event Start Date']); const end=easternWall(event['Event End Date'])||start;
    if (!overlaps(start,end,month)) return [];
    const text=`${event.Category||''} ${title}`;
    const category=/concert|music|recital|chorus/i.test(text)?'Live music':/sport|skating|swim|fitness/i.test(text)?'Sports':/arts|theatre|theater|dance|exhibit|gallery|museum/i.test(text)?'Arts & culture':'Family & learning';
    return [{id:`kent-${event.Id}`,title,start,end,allDay:false,url:safeURL(event.MoreInformationURL)||safeURL(event.WebURL)||source.page,location:plain(event.Building)+(event.Room?` — ${plain(event.Room)}`:''),latitude:pin[0],longitude:pin[1],category}];
  });
}
export async function fetchNorth(source,month,fetcher=fetch,signal) {
  monthRange(month);
  if (source.type==='kent') return kentEvents(await getJSON(source.endpoint,fetcher,signal),source,month);
  const body=await getText(source.endpoint,fetcher,signal);
  if (source.type==='jsonld') return blossomEvents(body,source,month);
  return icsEvents(body,source,month);
}
