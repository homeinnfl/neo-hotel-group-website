# NEO local calendars

Verified October 26, 2026. The calendar connects to 19 official automatic sources and offers 11 additional official venue calendar links. Actual event locations are filtered to a 10-mile straight-line radius of each hotel before display; distances are rounded only after filtering.

Source inventories, location evidence and feed limitations: [Stow and Cuyahoga Falls](docs/event-sources/north.md), [Akron](docs/event-sources/akron.md), [Canton](docs/event-sources/canton.md).

The Wine Mill uses its official Tribe API at https://www.thewinemill.com/wp-json/tribe/events/v1/events . Its on-site address is 4964 Akron-Cleveland Road, Peninsula, from https://www.thewinemill.com/contact-us/ . Census Public_AR_Current geocoding returned latitude41.2039684102,longitude-81.495607893535. An explicitly different venue needs its own coordinates.

Hotel coordinates use verified U.S.Census address matches for4097BridgewaterParkwayStow,1420MainStreetCuyahogaFalls,1025InterstateParkwayAkron,and5770DresslerRoadNWNorthCanton. These are interpolated street geocodes, so distances remain approximate.

Calendar links are labeled separately from automatic imports. Some subscriptions publish only upcoming dates; unknown venues, off-site locations without verified coordinates, cancellations and online-only events are excluded. A connected feed with zero entries is distinct from an unavailable feed.
