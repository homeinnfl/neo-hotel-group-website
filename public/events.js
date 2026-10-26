const $ = id => document.getElementById(id);
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let month = today.slice(0,7), selected = '', events = [], sources = [], loading = true, failed = false, requestId = 0, controller, activeEvent, calendars = [], visibleLimit = 40;
const hotel = $('hotel-filter'), category = $('category-filter'), search = $('event-search');
const initialHotel = new URLSearchParams(location.search).get('hotel');
if ([...hotel.options].some(o => o.value === initialHotel)) hotel.value = initialHotel;
const text = (tag, value, className) => { const n = document.createElement(tag); n.textContent = value; if(className)n.className=className; return n; };
const dateLabel = (day, options={month:'short',day:'numeric'}) => new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const monthLabel = () => dateLabel(`${month}-01`,{month:'long',year:'numeric'});
function timeLabel(e) {
  if(e.allDay) return 'All-day listing · confirm hours with venue';
  const [h,m] = e.start.slice(11,16).split(':').map(Number);
  return `${h%12 || 12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'} ET`;
}
function matches() {
  const q = search.value.trim().toLowerCase();
  return events.filter(e => (hotel.value === 'all' || e.hotels.includes(hotel.value)) && (category.value === 'all' || e.category === category.value) && `${e.title} ${e.location} ${e.source}`.toLowerCase().includes(q));
}
function occurs(e,day) { return e.start.slice(0,10) <= day && e.end.slice(0,10) >= day; }
function distanceLabel(e) {
  if(hotel.value !== 'all')return `${e.distances[hotel.value].toFixed(1)} mi from your hotel`;
  const [id,distance]=Object.entries(e.distances).sort((a,b)=>a[1]-b[1])[0];
  const name=[...hotel.options].find(o=>o.value===id)?.textContent||'a NEO hotel';
  return `${distance.toFixed(1)} mi from ${name}`;
}
function render() {
  $('month-title').textContent = monthLabel(); $('month-picker').value = month;
  $('previous-month').disabled = month === '2020-01'; $('next-month').disabled = month === '2100-12';
  $('calendar-content').setAttribute('aria-busy',String(loading));
  $('agenda-title').textContent = selected ? dateLabel(selected,{weekday:'short',month:'short',day:'numeric'}) : 'This month';
  $('clear-day').hidden = !selected;
  showSources();
  const filtered = matches(), grid = $('month-grid'); grid.replaceChildren();
  const [y,m] = month.split('-').map(Number), days = new Date(Date.UTC(y,m,0)).getUTCDate();
  for(let i=0;i<new Date(Date.UTC(y,m-1,1)).getUTCDay();i++)grid.append(document.createElement('span'));
  for(let d=1;d<=days;d++) {
    const day = `${month}-${String(d).padStart(2,'0')}`, count = filtered.filter(e=>occurs(e,day)).length;
    const b = document.createElement('button'); b.type='button'; b.dataset.day=day;
    b.setAttribute('aria-pressed',String(day === selected));
    b.setAttribute('aria-label',`${dateLabel(day,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}${loading ? ', loading events' : `, ${count} events`}`);
    if(day===today){b.className='today';b.setAttribute('aria-current','date');}
    b.append(text('span',String(d)));
    const dots = text('span', count ? `${count} listed` : '', 'day-count');
    if(count)dots.prepend(text('span','','day-dot')); b.append(dots);
    b.addEventListener('click',()=>{selected=selected===day?'':day;visibleLimit=40;render();grid.querySelector(`[data-day="${day}"]`)?.focus();});
    grid.append(b);
  }
  const visible = filtered.filter(e=>!selected || occurs(e,selected));
  const unavailable = sources.filter(s=>s.status!=='ok');
  $('calendar-status').textContent = loading ? 'Checking local organizers…' : failed ? 'We couldn’t load event listings. Please try again or visit the organizers below.' : `${visible.length} event${visible.length===1?'':'s'} listed${selected?' on this date':' this month'}.${unavailable.length ? ' Some organizers are temporarily unavailable; these listings may be incomplete.' : ''}`;
  $('retry-events').hidden = loading || (!failed && !unavailable.length);
  const list = $('event-list'); list.replaceChildren();
  $('more-events').hidden = loading || failed || visible.length <= visibleLimit;
  $('coverage-label').textContent = loading ? 'Finding what’s nearby…' : `${sources.filter(s=>s.status==='ok').length} live calendars · 10-mile hotel radius`;
  $('more-events').textContent = `Show more events (${Math.max(0,visible.length-visibleLimit)} remaining)`;
  if(loading || failed)return;
  if(!visible.length) {list.append(text('p','No listings match this selection. Try another month, hotel area or event type. Organizers may add dates closer to your visit.','empty-events'));return;}
  for(const event of visible.slice(0,visibleLimit)) {
    const b = document.createElement('button'); b.type='button';b.className='event-card';
    const range = event.start.slice(0,10) === event.end.slice(0,10) ? dateLabel(event.start.slice(0,10)) : `${dateLabel(event.start.slice(0,10))} – ${dateLabel(event.end.slice(0,10))}`;
    b.append(text('span',`${range} · ${event.category}`,'event-card-date'),text('strong',event.title),text('small',timeLabel(event)),text('small',event.location),text('small',distanceLabel(event),'event-distance'));
    b.addEventListener('click',()=>openEvent(event));list.append(b);
  }
}
function showSources() {
  const ul=$('source-list');ul.replaceChildren();
  for(const s of sources){
    const li=document.createElement('li'),a=text('a',s.name);a.href=s.url;a.target='_blank';a.rel='noopener';
    const count=hotel.value==='all'?s.count:s.counts?.[hotel.value]||0;
    li.append(a,document.createTextNode(s.status==='ok'?` — connected · ${count} nearby listings this month`:' — temporarily unavailable'));
    if(s.note)li.append(text('small',s.note,'source-note'));
    ul.append(li);
  }
  const nearby=calendars.filter(c=>hotel.value==='all'||c.hotels.includes(hotel.value));
  const directory=$('venue-calendars');directory.replaceChildren();
  $('more-calendars').hidden=!nearby.length;
  for(const c of nearby){
    const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener';
    a.append(text('span',c.category,'venue-category'),text('strong',c.name),text('small',distanceLabel(c)),text('span','Browse calendar ↗','venue-cta'));directory.append(a);
  }
}
async function load() {
  const id = ++requestId;controller?.abort();controller=new AbortController();
  const currentController=controller;
  const timer=setTimeout(()=>currentController.abort(),25000);
  loading=true;failed=false;events=[];sources=[];calendars=[];visibleLimit=40;$('updated-at').textContent='';render();
  try {
    const response = await fetch(`/.netlify/functions/events?month=${encodeURIComponent(month)}`,{signal:controller.signal});
    const data=await response.json();
    if(id!==requestId)return;
    if(!Array.isArray(data.events)||!Array.isArray(data.sources))throw new Error('Invalid response');
    events=data.events;sources=data.sources;calendars=data.calendars||[];failed=!response.ok;showSources();
    if(!failed)$('updated-at').textContent=`Feed check: ${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.updatedAt))} ET.`;
  } catch {if(id===requestId)failed=true;}
  finally {clearTimeout(timer);if(id===requestId){loading=false;render();}}
}
function moveMonth(amount){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+amount,1));const next=d.toISOString().slice(0,7);if(next<'2020-01'||next>'2100-12')return;month=next;selected='';load();}
$('previous-month').addEventListener('click',()=>moveMonth(-1));$('next-month').addEventListener('click',()=>moveMonth(1));
$('this-month').addEventListener('click',()=>{month=today.slice(0,7);selected='';load();});
$('month-picker').addEventListener('change',e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&e.target.value>='2020-01'&&e.target.value<='2100-12'){month=e.target.value;selected='';load();}});
$('clear-day').addEventListener('click',()=>{selected='';visibleLimit=40;render();});$('retry-events').addEventListener('click',load);
for(const control of [hotel,category,search])control.addEventListener('input',()=>{selected='';visibleLimit=40;render();});
hotel.addEventListener('change',()=>{const u=new URL(location.href);if(hotel.value==='all')u.searchParams.delete('hotel');else u.searchParams.set('hotel',hotel.value);history.replaceState(null,'',u);});
function openEvent(e){activeEvent=e;$('event-category').textContent=e.category;$('event-title').textContent=e.title;$('event-date').textContent=`${dateLabel(e.start.slice(0,10),{weekday:'long',month:'long',day:'numeric',year:'numeric'})}${e.end.slice(0,10)!==e.start.slice(0,10)?` – ${dateLabel(e.end.slice(0,10))}`:''} · ${timeLabel(e)}`;$('event-location').textContent=e.location;$('event-distance').textContent=distanceLabel(e)+' · approximate straight-line distance';$('event-source').textContent=`Listed by ${e.source}`;$('event-link').href=e.url;$('event-dialog').showModal();}
$('more-events').addEventListener('click',()=>{visibleLimit+=40;render();});
$('close-event').addEventListener('click',()=>$('event-dialog').close());
$('event-dialog').addEventListener('click',e=>{if(e.target===$('event-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
const escapeICS = s => String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldICS(line){let out='',size=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(size+bytes>73){out+='\r\n ';size=1;}out+=c;size+=bytes;}return out;}
$('save-event').addEventListener('click',()=>{
  const e=activeEvent, stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const compact=s=>s.replace(/[-:]/g,'').replace(' ','T');
  let dates;
  if(e.allDay){const end=new Date(`${e.end.slice(0,10)}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+1);dates=[`DTSTART;VALUE=DATE:${compact(e.start.slice(0,10))}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replace(/-/g,'')}`];}
  else dates=[`DTSTART;TZID=America/New_York:${compact(e.start)}`,`DTEND;TZID=America/New_York:${compact(e.end)}`];
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NEO Hotel Group//Local Events//EN','BEGIN:VTIMEZONE','TZID:America/New_York','BEGIN:DAYLIGHT','DTSTART:20070311T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','TZOFFSETFROM:-0500','TZOFFSETTO:-0400','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:20071104T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','TZOFFSETFROM:-0400','TZOFFSETTO:-0500','END:STANDARD','END:VTIMEZONE','BEGIN:VEVENT',`UID:${escapeICS(e.id)}@neohotelgroup.com`,`DTSTAMP:${stamp}`,...dates,`SUMMARY:${escapeICS(e.title)}`,`LOCATION:${escapeICS(e.location)}`,`URL:${e.url}`,`DESCRIPTION:${escapeICS(`Listed by ${e.source}. Confirm details with organizer. ${e.url}`)}`,'END:VEVENT','END:VCALENDAR'];
  const url=URL.createObjectURL(new Blob([lines.map(foldICS).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='neo-local-event.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
setInterval(()=>{if(!document.hidden&&!$('event-dialog').open)load();},15*60*1000);
load();
