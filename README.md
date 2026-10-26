# NEO Hotel Group — Netlify website

This project contains the website plus NEO's interactive events calendar. It is prepared for Netlify; it has not been deployed to a Netlify account.

## Deploy the automatic calendar

Use a Git-connected Netlify project or the Netlify CLI so the server function is deployed along with the HTML. Uploading only the `public` folder will display the website but cannot refresh events.

### Git integration

1. Put this folder's contents in a Git repository and import the repository in Netlify.
2. Use no build command; Netlify installs the dependencies from `package-lock.json`. The included `netlify.toml` sets the publish directory to `public` and the functions directory to `netlify/functions`.
3. Deploy and open `/events.html`. Check the sources section to confirm connectivity from Netlify.

### CLI

From this folder, with Node.js 22 or newer:

```sh
npm ci
npx netlify-cli login
npx netlify-cli deploy --dir=public --functions=netlify/functions
```

Choose the intended Netlify project when prompted. The first deploy is a preview. Once reviewed, publish:

```sh
npx netlify-cli deploy --prod --dir=public --functions=netlify/functions
```

Official reference: https://docs.netlify.com/build/functions/get-started/

## Events

The calendar reads public organizer APIs through a server function, avoiding browser cross-origin restrictions. No API keys or paid event service are required. Netlify's own hosting and function usage limits apply.

The calendar imports official local venue, library, university, sports and community feeds and calculates a separate 10-mile radius for each property. See `EVENT-SOURCES.md` for the source inventory, coordinate evidence and coverage limits. Additional official calendars that cannot be reliably imported appear as clearly labeled external calendar links.

Distances are approximate straight-line distances, not driving distances. Hotel coordinates use U.S. Census address matches; venue locations come from authoritative feed coordinates, official venue maps or verified address matches. Events with missing locations, unknown off-site locations, online-only attendance or locations outside all four hotel radii are excluded. Library feeds include programs at qualifying individual branches. University feeds include public events; sports feeds include verified local home venues.

Listings load for the selected month. Successful responses cache for up to 15 minutes; partial results cache for 2 minutes and identify unavailable sources. An open calendar refreshes every 15 minutes while visible. Some organizers supply only a rolling upcoming schedule and may have no entries for past or far-future months. No manual event entry or nightly rebuild is required. An empty calendar does not imply that no local events exist.

The adapters handle JSON, RSS and iCalendar feeds, validate event URLs, exclude closures/cancellations, deduplicate repeated events, and preserve Ohio local times. iCalendar downloads include Eastern Time daylight-saving rules. Titles, dates, venue names and organizer links are displayed; full descriptions and artwork are not republished. Some source feeds have limited location data, so only verified venues are imported.

Adapter files live in `netlify/functions/feeds/`; the aggregator and geographic filter are in `netlify/functions/events.mjs`. Dependencies are pinned through `package-lock.json`. No credentials are embedded.

## Local check

```sh
npm ci
npm test
npm run preview
```

Open http://127.0.0.1:4174/events.html. The preview invokes the same handler used on Netlify. Automated tests cover the radius boundary, daylight-saving changes, feed adapters, dates, pagination, private/unsafe entries, deduplication and outages.

The group inquiry page uses NEO's custom planning form. Visitors can prepare a detailed request for `rickesh@neohotelgroup.com` or call the group inquiry agent directly at `(407) 378-1692`. The homepage includes a four-property slideshow, unobstructed property photos, and redesigned local guides. Careers applications are implemented as described below. Google Fonts require internet access.

## Careers applications

`careers.html` includes Front Desk Representative, Housekeeping, Maintenance and Breakfast Attendant roles, hotel and schedule preferences, contact details, availability, experience and an optional PDF/DOC/DOCX résumé (5MB maximum). All pages include Careers navigation.

### Netlify

Enable Netlify form detection before deploying. The HTML declares the `neo-careers` multipart form with a honeypot. Submissions and résumé attachments appear in the site’s **Forms** dashboard. Configure an email notification to `rickesh@neohotelgroup.com` there if desired; notifications are not configured by this source export. Netlify Forms usage limits apply. Native Netlify Forms handles the upload; the optional Sites application backend is not used on Netlify. Official setup: https://docs.netlify.com/manage/forms/setup/ .

No applicant data is stored in browser localStorage. Netlify handles application storage and résumé uploads through its Forms service.
