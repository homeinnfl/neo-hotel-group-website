import {plain, safeURL, monthRange, easternWall, getJSON} from './common.mjs';

// Public endpoints and coordinate provenance are documented in event-research/akron/README.md.
export const AKRON_SOURCES = [
  {id:'uakron', name:'University of Akron & E.J. Thomas Hall', page:'https://calendar.uakron.edu/', category:'Arts & culture', region:'akron', type:'livewhale', endpoint:'https://calendar.uakron.edu/live/json/v2/events'},
  {id:'rubberducks', name:'Akron RubberDucks', page:'https://www.milb.com/akron/schedule', category:'Sports', region:'akron', type:'mlb', endpoint:'https://statsapi.mlb.com/api/v1/schedule'},
  {id:'akron-library', name:'Akron-Summit County Public Library', page:'https://services.akronlibrary.org/events', category:'Family & learning', region:'akron', type:'communico', endpoint:'https://services.akronlibrary.org/eeventcaldata'},
  {id:'akron-symphony', name:'Akron Symphony Orchestra', page:'https://akronsymphony.org/events/', category:'Live music', region:'akron', type:'tribe', endpoint:'https://akronsymphony.org/wp-json/tribe/events/v1/events'},
  {id:'summit-artspace', name:'Summit Artspace', page:'https://www.summitartspace.org/events/', category:'Arts & culture', region:'akron', type:'tribe', endpoint:'https://www.summitartspace.org/wp-json/tribe/events/v1/events', upcomingOnly:true, note:'Upcoming published dates only.'},
];

// Directory-only sources are deliberately distinct from automatically imported feeds.
export const AKRON_LINKS = [
  {id:'akron-civic', name:'Akron Civic Theatre, Knight Stage & Wild Oscar’s', page:'https://akroncivic.com/view-all-shows', category:'Live music', latitude:41.079889087662, longitude:-81.51987698507},
  {id:'akron-zoo', name:'Akron Zoo', page:'https://www.akronzoo.org/events', category:'Family & learning', latitude:41.076172, longitude:-81.541191},
  {id:'akron-art-museum', name:'Akron Art Museum', page:'https://akronartmuseum.org/calendar/', category:'Arts & culture', latitude:41.084754390527, longitude:-81.515556642488},
  {id:'akron-childrens-museum', name:'Akron Children’s Museum', page:'https://akronkids.org/calendar', category:'Family & learning', latitude:41.079387322381, longitude:-81.520231566893},
  {id:'jillys', name:'Jilly’s Music Room', page:'https://jillysmusicroom.com/events-calendar/', category:'Live music', latitude:41.087804075508, longitude:-81.515572534069},
];

// These keys identify actual event venues, never an organizer's headquarters.
const TRIBE_VENUES = {
  'summit-artspace:11691': {latitude:41.083671620855, longitude:-81.512921374737, address:'140 East Market Street, Akron, OH 44308'},
  'akron-symphony:11150': {latitude:41.087804075508, longitude:-81.515572534069, address:'111 North Main Street, Akron, OH 44308'},
};

function coordinates(latitude, longitude) {
  if (latitude === null || latitude === undefined || latitude === '' || longitude === null || longitude === undefined || longitude === '') return null;
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  return {latitude:lat, longitude:lon};
}
function localWall(value) {
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value || '') ? value.replace('T',' ') : '';
}
function active(value) { return value === true || value === 1 || value === '1'; }
function canceled(row) {
  const status = typeof row.event_status === 'object' ? row.event_status?.status : row.event_status;
  return /cancelled|canceled|postponed/i.test(`${status || ''} ${row.title || ''}`);
}
function event(source, values) {
  const title = plain(values.title), url = safeURL(values.url), geo = coordinates(values.latitude, values.longitude);
  if (!title || !url || !geo || !values.start) return null;
  return {id:String(values.id), title, start:values.start, end:values.end || values.start, allDay:!!values.allDay, url,
    location:plain(values.location), ...geo, category:values.category || source.category};
}
function finish(events, month) {
  const {start, next} = monthRange(month), seen = new Set();
  return events.filter(e => {
    if (!e || e.start.slice(0,10) >= next || e.end.slice(0,10) < start) return false;
    const key = `${e.title.toLowerCase()}|${e.start}|${e.latitude.toFixed(4)}|${e.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

async function university(source, month, fetcher, signal) {
  const {start, end} = monthRange(month);
  const base = `${source.endpoint}/start_date/${start}/end_date/${encodeURIComponent(end + ' 23:59:59')}/response_fields/event_types,location,group_title,status/max/1000/paginate/500/`;
  const first = await getJSON(base, fetcher, signal);
  if (!Array.isArray(first.data)) throw new Error('Invalid University calendar response');
  const rows = [...first.data];
  const pages = Number(first.meta?.total_pages || 1);
  if (pages > 2) throw new Error('University calendar exceeds supported monthly size');
  for (let page=2; page<=pages; page++) rows.push(...(await getJSON(`${base}?page=${page}`,fetcher,signal)).data);
  return rows.filter(row => !active(row.is_canceled) && !active(row.is_online) && (!row.status || Number(row.status) === 1)
    && (row.event_types || []).some(type => plain(type).toLowerCase() === 'open to the public'))
    .map(row => event(source, {id:`ua-${row.id}-${row.date_iso}`, title:row.title,
      start:easternWall(row.date_iso), end:row.date2_iso ? easternWall(row.date2_iso) : '', allDay:active(row.is_all_day),
      url:row.url, location:row.location, latitude:row.location_latitude, longitude:row.location_longitude,
      category:/performing arts|ej thomas/i.test(row.group_title || '') ? 'Live music' : source.category}));
}

async function baseball(source, month, fetcher, signal) {
  const {start,end} = monthRange(month);
  const url = new URL(source.endpoint);
  url.search = new URLSearchParams({sportId:'12',teamId:'402',startDate:start,endDate:end,hydrate:'venue(location)'}).toString();
  const data = await getJSON(url.href,fetcher,signal);
  if (!Array.isArray(data.dates)) throw new Error('Invalid RubberDucks schedule response');
  return data.dates.flatMap(day => day.games || []).filter(game => game.teams?.home?.team?.id === 402 && game.publicFacing !== false
    && !/cancelled|canceled|postponed/i.test(game.status?.detailedState || ''))
    .map(game => {
      const venue = game.venue || {}, location = venue.location || {}, geo = location.defaultCoordinates || {};
      const tbd = game.status?.startTimeTBD === true;
      return event(source, {id:`mlb-${game.gamePk}`, title:`Akron RubberDucks vs. ${plain(game.teams.away.team.name)}${tbd ? ' (time TBA)' : ''}`,
        start:tbd ? `${game.officialDate} 00:00:00` : easternWall(game.gameDate), allDay:tbd,
        url:`https://www.milb.com/akron/schedule/${month}`, location:[venue.name,location.address1,location.city].filter(Boolean).join(', '), ...geo});
    });
}

async function library(source, month, fetcher, signal) {
  const {start,end} = monthRange(month);
  const req = {date:start,days:Number(end.slice(-2)),locations:[],ages:[],types:[],private:false,search:''};
  const [rows, locations] = await Promise.all([
    getJSON(`${source.endpoint}?event_type=0&req=${encodeURIComponent(JSON.stringify(req))}`,fetcher,signal),
    getJSON('https://api.communico.co/v1/akronlibrary/locations',fetcher,signal),
  ]);
  if (!Array.isArray(rows) || !Array.isArray(locations)) throw new Error('Invalid library calendar response');
  const branches = new Map(locations.filter(l => !/mobile|virtual|zoom/i.test(l.name)).map(l => [String(l.id),l]));
  return rows.filter(row => !active(row.private_event) && !Number(row.changed || 0) && row.venue_type === 'internal'
    && ['INPERSON','HYBRID'].includes(row.event_type) && branches.has(String(row.location_id)))
    .map(row => {
      const branch = branches.get(String(row.location_id));
      return event(source, {id:`library-${row.id}`,title:row.title,start:localWall(row.raw_start_time),end:localWall(row.raw_end_time),
        url:row.url,location:[branch.name,branch.line1,branch.locality].filter(Boolean).join(', '),latitude:branch.lat,longitude:branch.lon});
    });
}

async function tribe(source, month, fetcher, signal) {
  const {start,end} = monthRange(month), rows = [];
  for (let page=1;page<=10;page++) {
    const url = new URL(source.endpoint);
    const params = source.upcomingOnly ? {per_page:'100'} : {start_date:`${start} 00:00:00`,end_date:`${end} 23:59:59`,per_page:'100'};
    if (page > 1) params.page = String(page);
    url.search = new URLSearchParams(params).toString();
    const data = await getJSON(url.href,fetcher,signal);
    if (!Array.isArray(data.events)) throw new Error('Invalid venue calendar response');
    rows.push(...data.events);
    if (page >= Number(data.total_pages || 1)) break;
    if (page === 10) throw new Error('Venue calendar exceeds supported monthly size');
  }
  return rows.filter(row => row.status === 'publish' && !active(row.hide_from_listings) && !canceled(row))
    .map(row => {
      const venue = row.venue || {};
      const known = TRIBE_VENUES[`${source.id}:${venue.id}`];
      const geo = coordinates(venue.geo_lat,venue.geo_lng) || known || {};
      return event(source,{id:`${source.id}-${row.id}`,title:row.title,
        start:row.utc_start_date ? easternWall(row.utc_start_date.replace(' ','T')+'Z') : localWall(row.start_date),
        end:row.utc_end_date ? easternWall(row.utc_end_date.replace(' ','T')+'Z') : localWall(row.end_date), allDay:active(row.all_day),url:row.url,
        location:[venue.venue,venue.address ? [venue.address,venue.city].filter(Boolean).join(', ') : known?.address].filter(Boolean).join(', '),...geo});
    });
}

export async function fetchAkron(source, month, fetcher=fetch, signal) {
  const adapters = {livewhale:university, mlb:baseball, communico:library, tribe};
  if (!adapters[source.type]) throw new Error('Unknown Akron feed');
  return finish(await adapters[source.type](source,month,fetcher,signal),month);
}
