# Northern Ohio event feeds checked October 26, 2026

Implementation: `NEO-Netlify/netlify/functions/feeds/north.mjs`. Exports five `NORTH_SOURCES`, three `NORTH_LINKS`, and `fetchNorth(source, month, fetcher, signal)`.

All five automatic adapters were tested with live requests after implementation. November 2026 returns 85 Stow library events, 71 Cuyahoga Falls library events, 17 Stow Parks events, and 72 Kent State public events before the parent service's hotel-radius filtering. Blossom has no remaining announced 2026 shows and three announced 2027 shows; May 2027 returns one real show. Counts describe the checked source snapshot, not guaranteed future results.

## Automatic sources

| Source | Verified endpoint | Format and limits |
|---|---|---|
| Stow-Munroe Falls Public Library | https://events.smfpl.org/ical_subscribe.php?src=p&cid=15865 | 370 VEVENT records at inspection. Subscription window, not arbitrary month query. Known library rooms map to the library's actual address. Only explicit verified offsite street addresses are included. Generic Off Site Location, Pavilion, and unverified addresses are excluded. |
| Cuyahoga Falls Library | URL in `fallsics-url.txt` | Official calendar exposes iCalendar subscription via public `am-events-listings.js` `_getFeed` function. Base64 query is a public filter object, not credentials. 149 VEVENT records. Per-event GEO is used; zero coordinates are rejected. Public event URLs follow the site's documented `/event/{id}` route. |
| Stow Parks & Recreation | https://www.stowohio.gov/common/modules/iCalendar/iCalendar.aspx?catID=23&feed=calendar | 38 VEVENT records. Uses America/New_York wall times. Verified street addresses only. Descriptions contain the event detail URL; the ICS URL property itself links the subscription. |
| Blossom Music Center | https://www.blossommusic.com/shows | Official MusicEvent JSON-LD: 3 actual shows and one season-ticket waitlist placeholder. Placeholder is excluded. Announced shows only. Explicit source event location must be Blossom. |
| Kent State University | https://www.kent.edu/ksu_events_loader/KSUEventsFeed | JSON string containing a JSON object; parse twice. 344 raw events. Filter KSUCampus = Kent Campus, IsInPerson = true, Audience includes Open to Public, exact known building name. Unknown buildings and regional campus events are excluded. |

All source metadata has `coverage` to explain the upstream's published rolling window. Empty past/distant months do not establish that no events exist at the venue. The adapters do not fabricate events or recycle dates.

## Verified venue coordinate provenance

Census public address geocoder `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress`, benchmark `Public_AR_Current`:

- Stow library, 3512 Darrow Rd, Stow OH 44224: 41.161681255919, -81.440462456791. Address confirmed by official library documents, e.g. https://www.smfpl.org/sites/default/files/2024-01/InformationServices-PartTime.pdf.
- Stow Community and Senior Center, 5344 Fishcreek Rd: 41.194246414319, -81.432034905099.
- Silver Springs Park/Heritage Barn, 5238 Young Rd: 41.194666853292, -81.402259912572.
- Adell Durbin Park, 3300 Darrow Rd: 41.154931612648, -81.44045065083.
- Stow City Center, 3760 Darrow Rd: 41.166919706938, -81.440457207327.
- Blossom Music Center, 1145 W Steels Corners Rd: 41.178301766956, -81.558981136119. Street address independently supplied by official event JSON-LD. This is a geocoded street-access point, not a surveyed amphitheater center.
- Kent Stage, 175 E Main St: 41.153837543527, -81.35683746905. Address supplied by official event JSON-LD.
- The Workz, 2220 Front St: 41.13733527039, -81.482757781332. Venue's official site https://www.playattheworkz.com/Events.
- Stan Hywet Hall & Gardens, 714 N Portage Path: 41.116686737796, -81.548606841954. Official site https://stanhywet.org/calendar.

Full unrounded Census responses: `geocodes.json`, `more-geocodes.json`.

Cuyahoga Falls Library's ICS itself supplies its location GEO 41.1347945,-81.4855078. Official calendar address: 2015 Third Street, Cuyahoga Falls OH 44221. Offsite events with GEO 0;0 are excluded, even where their description may contain an address.

Kent State links its official campus map at https://map.concept3d.com/?id=568 from https://www.kent.edu/calendars. Its public campus map search API provides exact building pins; responses are in `kentmap-searches.json`:

| Building | Latitude | Longitude |
|---|---|---|
| Cartwright Hall | 41.151226 | -81.348778 |
| Rockwell Hall / university museum | 41.152702 | -81.349915 |
| Kent Center for the Performing Arts | 41.152794 | -81.340645 |
| Center for the Visual Arts | 41.1506 | -81.347473 |
| Library | 41.146767 | -81.342178 |
| Taylor Hall | 41.150204 | -81.343979 |
| Beverly J. Warren Student Recreation and Wellness Center | 41.141647 | -81.339653 |
| Kent Student Center | 41.147694 | -81.343033 |
| Ice Arena | 41.145775 | -81.335991 |
| Satterfield Hall | 41.14817 | -81.347557 |
| John Elliot Center for Architecture & Environmental Design | 41.152458 | -81.352142 |
| Kiva | 41.147144 | -81.343903 |
| Design Innovation Hub | 41.150227 | -81.346458 |

An upstream data-quality issue makes this curated mapping necessary: some Kent Center shows have feed coordinates 41.27888,-80.83719 (Warren) while their exact named venue is on the Kent Campus. The map's official building pins override feed coordinates for these exact known campus buildings. Never use a single generic campus pin for all university events.

## Nearby calendar links only

Kent Stage, Workz, and Stan Hywet are exported as `NORTH_LINKS`. Their calendars are useful, but are not claimed as automatic imports:

- Kent Stage listing has about 23 event links; individual detail pages have valid Event JSON-LD, but no straightforward bulk event API. Crawling every detail on every request would add substantial latency and venue requests.
- Workz uses a Wix third-party Events Calendar widget; no stable bulk endpoint was validated.
- Stan Hywet uses a custom calendar without a verified machine feed.

## Additional evaluated sources

- Standing Rock Cultural Arts officially embeds `srcakentoh@gmail.com` Google Calendar at https://www.standingrock.net/standing-rock-cultural-arts-calendar. Public ICS https://calendar.google.com/calendar/ical/srcakentoh%40gmail.com/public/basic.ics returned 226 records. Many entries are explicitly private events; a leisure import must exclude those. Not implemented because location verification remained incomplete: Census incorrectly matched requested 300 **N** Water St to 300 **S** Water St. The wrong match is preserved in the research response as evidence, and was **not used**.
- Stow Amphitheater Concert Series category 33 and Amphitheater Events category 34 provide valid public CivicEngage ICS but were empty at inspection. Their future events might be added after accurate individual locations are available. Endpoints differ from Parks endpoint only in `catID`.
- Downtown Cuyahoga Falls has an official HTML calendar at https://www.downtowncf.com/events, but no stable bulk feed validated.
- Hudson library has migrated from LibCal to its own CMS/EngagedPatrons routes; no stable event bulk feed validated.
- Kent Free Library uses WhoFi; its HTML includes events, but no machine feed validated.
- Peninsula Library calendar/export returns HTTP406 to the research client; not integrated.
- Summit Metro Parks attempted public Events Calendar endpoint returned HTTP403; not integrated.

## Verification

Run from workspace root:

`node event-research/north/test-north.mjs`

The tests verify a recurrence spanning the November DST change, EXDATE exclusion, inclusive UI end dates derived from exclusive all-day ICS end dates, exclusion of unknown locations and cancellations, valid coordinates/unique IDs, and parsing each of the five actual downloaded upstream formats. Live checks also passed for every adapter after these tests. Public feed source text is treated as data and plain text is normalized before output.
