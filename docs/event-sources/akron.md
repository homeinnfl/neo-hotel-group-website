# Akron calendar research — verified 2026-10-26

Implementation: `NEO-Netlify/netlify/functions/feeds/akron.mjs`. These sources return actual event locations; the central aggregator must apply the 10-mile hotel radius to every event. Geographic coverage is straight-line distance, not driving distance. This folder contains research captures, not production event data.

## Automatic feeds

| Calendar | Official endpoint | Location / filtering |
| --- | --- | --- |
| University of Akron / E.J. Thomas Hall | https://calendar.uakron.edu/live/json/v2/events | Request date range, `event_types,location,group_title,status`, and pagination. Only public, live, non-canceled, physical events with per-event coordinates are included. E.J. Thomas is already included, so no duplicate feed request. |
| Akron RubberDucks | https://statsapi.mlb.com/api/v1/schedule?sportId=12&teamId=402&startDate=2027-04-01&endDate=2027-04-30&hydrate=venue(location) | Only home team 402, non-canceled/postponed games; each game supplies venue address and defaultCoordinates. Current venue: 7 17 Credit Union Park, 300 S. Main St, Akron; 41.07739,-81.52185. No invented game duration. |
| Akron-Summit County Public Library | https://services.akronlibrary.org/eeventcaldata | Public GET request `event_type=0&req=` + URL-encoded JSON with `date,days,locations:[],ages:[],types:[],private:false,search:''`. Join location_id to https://api.communico.co/v1/akronlibrary/locations for authoritative branch lat/lon and address. Exclude external/mobile locations, online-only events, canceled/rescheduled and private events. |
| Akron Symphony Orchestra | https://akronsymphony.org/wp-json/tribe/events/v1/events | Standard Tribe date ranges and pagination. Most venues include geo_lat/geo_lng; Jilly's uses the exact known venue ID and verified address. |
| Summit Artspace | https://www.summitartspace.org/wp-json/tribe/events/v1/events | Fetch the broad upcoming feed with per_page=100 and filter locally to the selected month; the upstream date-filtered endpoint times out. Exact venue ID11691 resolves to verified140E Market Street. The source is labeled as upcoming published dates only. |

Live response observations: University November2026 returned69 public physical entries after filtering/deduplication; library November2026 returned325; Symphony November2026 returned3; RubberDucks April2027 returned13 home games. These are before central hotel-radius filtering and change as venues update their calendars. Artspace broad feed returned74 future records; one date-bounded live request timed out, so normal source failure handling is essential.

Library branch coordinates are returned by its official locations endpoint. Its event `raw_start_time` and `raw_end_time` are America/New_York local times; the numeric `ts` field was inconsistent with that timezone and is deliberately not used. `changed=1` means canceled and `changed=3` represents a changed record; both excluded to prevent stale listings. A calendar subscription endpoint is also verified: `/feeds?data=` + base64 of `{"feedType":"ical","filters":{"location":["all"],"ages":["all"],"types":["all"],"tags":[],"term":"","days":1}}`.

LiveWhale official docs: https://support.livewhale.com/live/blurbs/json-api and https://support.livewhale.com/live/blurbs/api. Date parameters prevent the default six-month horizon; recurring dates are expanded by the service and copied calendar entries are deduplicated by title, start and physical coordinates.

## Venue-coordinate provenance

Exact coordinate responses are saved as `*_geocode.json`, obtained from the U.S. Census public geocoder using benchmark `Public_AR_Current`. Street-interpolated results are sufficient for neighborhood-scale filtering; no office coordinates substitute for unknown event locations.

- Summit Artspace:140EastMarketStreet, AkronOH44308;41.083671620855,-81.512921374737. Address from official Tribe venue11691: https://www.summitartspace.org/venue/summit-artspace/.
- Jilly's Music Room:111NorthMainStreet, AkronOH44308;41.087804075508,-81.515572534069. Address: https://jillysmusicroom.com/info/; Tribe venue11150 from AkronSymphony.
- E.J.Thomas Hall: authoritative feed41.0783,-81.51504; venue address185EastMillStreet in https://www.uakron.edu/ej/. Symphony uses its HillStreet entrance and provides its own coordinates.
- Civic Theatre:182SouthMainStreet, AkronOH44308;41.079889087662,-81.51987698507. Address: https://akroncivic.com/accessibility-information.
- Art Museum:1SouthHighStreet, AkronOH44308;41.084754390527,-81.515556642488. Address: https://akronartmuseum.org/visit/.
- Children's Museum:216SouthMainStreet, AkronOH44308;41.079387322381,-81.520231566893. Address: https://akronkids.org/contact-us. Parking instructions use51W.StateStreet instead.
- Akron Zoo:505EuclidAvenue, AkronOH44307; official footer Google Maps destination41.076172,-81.541191 at https://www.akronzoo.org/events. Census check consistent (41.0759554,-81.5415543).

## Browse-only calendars

Do not describe these as automatic imports: Akron Civic Theatre (including Knight Stage/WildOscar's), Akron Zoo, Akron Art Museum, Akron Children's Museum, and Jilly's Music Room. Their verified official calendar links and coordinates are exported separately as `AKRON_LINKS`. Art Museum403 and Jilly's406 prevented verifying reliable public API feeds. Civic/Zoo/Children's Museum public HTML displayed dates but exposed no verified structured subscription endpoint. Lock3's2026PDF was found but is not a live machine-readable feed.

## Checks

Run `node --test NEO-Netlify/tests/akron.test.mjs` (also included by `npm test` in NEO-Netlify). These checks cover DST conversion, public/physical-only filtering, cancellation/reschedule exclusions, branch geolocation, duplicate University listings, baseball home games, and unknown venue rejection.
