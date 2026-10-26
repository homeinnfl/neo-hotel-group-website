# Canton calendar research — verified 2026-10-26

Implemented in `NEO-Netlify/netlify/functions/feeds/canton.mjs`. These are public official feeds, not generated event listings. Events without a verified event location are excluded; the shared calendar applies the actual hotel-radius calculation.

| Source | Verified public endpoint | Format / evidence |
| --- | --- | --- |
| Canton Palace Theatre | `https://cantonpalacetheatre.org/wp-admin/admin-ajax.php?action=wcs_get_events_json&start=2026-10-26&end=2027-05-01` | WCS JSON, 25 events returned. Endpoint discovered in the official calendar's `weekly-class` JavaScript. `title,start,end,permalink,thumbnail,terms`; excluded postponed Mitch Albom poster. |
| Players Guild Theatre | `https://playersguildtheatre.com/wp-json/tribe/events/v1/events?per_page=100&start_date=2026-10-26&end_date=2027-05-01` | Tribe JSON, four productions. Official site footer/map identifies home theater as 6000 Frank Avenue NW, North Canton (Kent State Stark Fine Arts). |
| North Canton Public Library | `https://events.northcantonlibrary.org/events/feed/ical` | 216 VEVENTs; genuine DTSTART/DTEND, URL, LOCATION and often GEO. Includes offsite Hoover District Program Room, handled separately. Includes closures through 2075, excluded with month/title filtering. |
| Stark Library | `https://gateway.bibliocommons.com/v2/libraries/starklibrary/rss/events?startDate=2026-11-01&endDate=2026-11-30&page=1` | 25 items per RSS page. `bc:start_date/end_date` are real UTC event times; `bc:location` gives full address and latitude/longitude; `bc:is_cancelled`, `bc:is_virtual`. Namespace is `http://bibliocommons.com/rss/1.0/modules/event/`. Date filters verified (November starts Nov. 2). 231 November events reported in corresponding official HTML. |
| Stark Parks | POST `https://starkparks.recdesk.com/Community/Calendar/GetCalendarItems` | Public calendar JSON, 59 events for Oct. 26–Dec. 31. Body fields: `facilityId:-1,startDate:'10/26/2026',endDate:'12/31/2026',getChildren:'false',SelectedView:'month',SelectedMonth:'10',SelectedYear:'2026'`. Only public program (`EventType:P`) records at verified facilities are imported. |
| Walsh University Athletics | `https://athletics.walsh.edu/calendar.ashx/calendar.ics` | SIDEARM ICS, 297 events; November yielded seven games with an explicitly named local home facility. City-only and away/neutral locations are not assigned campus coordinates. |
| Malone University Athletics | `https://malonepioneers.com/calendar.ashx/calendar.ics` | SIDEARM ICS, 272 events; November yielded four games explicitly at Osborne Hall. City-only and unverified venues are excluded. |
| North Canton Chamber | `https://northcantonchamber.org/wp-json/tribe/events/v1/events` | Existing official Tribe API verified HTTP200, currently no events Oct. 26–Jan.31. Coordinates must come from each event's actual venue; no chamber-office fallback. |

## Location evidence

Street coordinates were obtained with the US Census public geocoder (`benchmark=Public_AR_Current`) on the verified official street addresses below. Complete query, matched address and coordinate response are saved in `geocode-*.json`. These are street-address geocodes, not entrance-level surveying. Official feed coordinates take priority where provided.

| Venue | Verified address | Latitude, longitude | Address evidence |
| --- | --- | --- | --- |
| Canton Palace Theatre | 605 Market Avenue North, Canton OH44702 | 40.802030494013, -81.373556897122 | https://cantonpalacetheatre.org/calendar/ |
| Players Guild Theatre | 6000 Frank Avenue NW, North Canton OH44720 | 40.867788331457, -81.441768528011 | https://playersguildtheatre.com/ footer and embedded map |
| North Canton Public Library | 185 North Main Street, North Canton OH44720 | 40.8770539, -81.4028595 | Library ICS GEO, official event JSON-LD |
| Hoover District Program Room | 339 East Maple Street, North Canton OH44720 | 40.875796187417, -81.397993965577 | Library ICS LOCATION |
| Walsh home athletic facilities | 2020 East Maple Street, North Canton OH44720 | 40.875028587378, -81.370456608868 | https://athletics.walsh.edu/sports/2022/7/8/facilities-index.aspx and official university athletic emergency plan |
| Malone Osborne Hall | 711 25th Street NW, Canton OH44709 | 40.824120092104, -81.379586458744 | Official Visit Canton Sports Facilities Guide; https://malonepioneers.com/sports/2010/8/11/GEN_0811104901.aspx confirms the named home facility |
| Exploration Gateway | 5712 12th Street NW, Canton OH44708 | 40.811986180195, -81.458876840467 | https://starkparks.com/about_us/contact_us.php; https://stark-parks.squarespace.com/contact-1 |
| Wildlife Conservation Center | 800 Genoa Avenue NW, Massillon OH44646 | 40.8046758658, -81.464818390488 | https://starkparks.com/wildlife_conservation_center.php |
| Tam O'Shanter clubhouse | 5055 Hills and Dales Road NW, Canton OH44708 | 40.833618123803, -81.441899428399 | https://www.starkparks.com/holidays/ and official RecDesk facility146 |

Stark Parks facility IDs imported: Exploration Gateway 2/171/175/176/178/179/180; Wildlife Conservation Center 41/43/44; Tam O'Shanter clubhouse142. Other parks are deliberately not mapped to the central office. Stark Library uses each event's feed-provided location, including branches and external venues.

## Time and pagination details

- Palace WCS mislabels local Ohio wall times with `+00:00`. Example official Alien detail says **7:30 p.m. Oct.30**, while JSON is `2026-10-30T19:30:00+00:00`. Preserve the wall-clock portion.
- RecDesk similarly returns local clock fields suffixed `Z`. Official December holiday page says Canvas at the Clubhouse is **Dec.9, 6 p.m.**, corresponding to `2026-12-09T18:00:00Z`; Breakfast with Birds **Dec.18, 9 a.m.** corresponds to `09:00:00Z`. Preserve the wall-clock portion. The site uses those fields directly in FullCalendar.
- Stark Library, North Canton Library, and SIDEARM supply actual UTC times. Convert to America/New_York, including DST. BiblioCommons RSS pages are25items, whereas its HTML pages are20; `limit=100` is ignored. Fetch by requested month with page until under25.
- Library date-only closures are excluded. RFC5545 DATE-valued end dates are exclusive; the adapter subtracts one second for the calendar's inclusive end representation.
- The three verified ICS snapshots contain zero RRULE, RDATE, EXDATE, or RECURRENCE-ID properties: they publish materialized occurrences. If that changes, the adapter reports the source unavailable instead of silently omitting recurring dates.
- North Canton Library's explicit location address determines its coordinates before any GEO property. This prevents an offsite program from inheriting a library-origin GEO. Unknown new offsite locations are excluded pending verification.

## Validation

Seven focused offline tests pass in `NEO-Netlify/tests/canton.test.mjs`: DST conversion, offsite-versus-copied GEO, unknown locations, away/neutral athletics exclusion, exclusive all-day ending, unsupported recurrence, Palace wall-time/postponement behavior, and BiblioCommons cancellation/geography (some assertions share a test).

Live November2026 integration run: Palace7; Players Guild1; North Canton Library40; Stark Library231; verified Stark Parks venues22; Walsh7; Malone4; North Canton Chamber0. All eight sources succeeded. Slowest was Players Guild at3.9seconds; Stark Library retrieved its231events via12parallel-batched RSS requests in2.0seconds. These are pre-radius counts; shared distance filtering can reduce them per property.

## Directory-only calendars

- Pro Football Hall of Fame: https://www.profootballhof.com/events; 2121 George Halas Drive NW, Canton; Census 40.822726509802,-81.397598737987. New Next.js site has an unstable RSC event payload, so not presented as an automatic feed.
- Canton Museum of Art: https://www.cantonart.org/; 1001 Market Avenue North; Census 40.806443753091,-81.372542342422. No stable structured feed verified.
- Canton Symphony: https://cantonsymphony.org/; 2331 17th Street NW, Canton; Census 40.817368748765,-81.398245298968. Official homepage event schedule verified in web search; direct Python TLS failed, so not advertised as an automatic feed.

Additional investigated sources: Gervasi returned HTTP403 for its home and Tribe API; Hall of Fame Village's Saffire calendar exposed an older schedule with no2026entries; Downtown Canton had no Tribe API; these were not counted as connected feeds.

Research fixtures are snapshots used for verification only. Production loads the current official feeds.
