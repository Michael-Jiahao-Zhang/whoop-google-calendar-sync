# WHOOP → Google Calendar

A personal Google Apps Script that syncs WHOOP sleep, naps, and workouts into an **existing Google Calendar**. No IFTTT subscription or separate server is needed. Requires your own WHOOP account and developer application.

[中文说明](README.zh-CN.md)

- 🌙 Dream Time, ☁️ Power Nap, 🏋️ Strength Session, and customizable activity titles.
- Recorded start/end times, with time-zone-aware descriptions.
- Sleep stages, time asleep, efficiency, performance, consistency, respiratory rate, and available sleep-need metrics.
- Workout Strain, heart rate, energy, distance, elevation, and heart-rate zones when available.
- Hourly polling, source-ID deduplication, and updates to existing events.
- A recent lookback on every run, plus a periodic reconciliation of all imported history.

## Setup

1. Create a standalone project at [Google Apps Script](https://script.google.com/). Copy `WhoopCalendar.gs` and `Settings.gs` into separate script files.
2. In Project Settings, enable **Show appsscript.json manifest file in editor**. Replace its contents with this repository's `appsscript.json`. It pins Google's [OAuth2 library](https://github.com/googleworkspace/apps-script-oauth2) to version 43. Alternatively, add the library manually with identifier `OAuth2` and library ID `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`.
3. In Google Calendar → Settings → your destination calendar → **Integrate calendar**, copy its Calendar ID into `SETTINGS.calendarId`. Use a calendar you can edit. The script never creates a calendar.
4. Set `SETTINGS.displayTimeZone` to an IANA zone, for example `America/Chicago` for Nashville. Also set **Google Calendar → General → Time zone** to your local zone. The setting in the script controls description timestamps; the calendar's display setting controls the grid. These do not alter the source's absolute start/end instants. IANA zones handle daylight saving time; don't hardcode a UTC offset.
5. Create your own application in the [WHOOP Developer Dashboard](https://developer-dashboard.whoop.com/). Request only `read:sleep` and `read:workout`. Use your own contact details and privacy notice; `PRIVACY.md` is a template you can adapt, not a notice hosted by this repository for your users.
6. Register this redirect URI, replacing `YOUR_SCRIPT_ID` with the Script ID from Apps Script Project Settings:
   `https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback`
7. In Apps Script **Script Properties**, add `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`. Keep these out of code, screenshots, and Git. The script needs `offline` access to refresh WHOOP tokens.
8. Run `showSetup` to confirm the redirect URI, then `authorizeWhoop`. Review Google's permissions, open the one-time authorization link in the execution log, and consent to WHOOP access. Never share that link. A personal, unverified Apps Script project can show a Google warning; review the requested permissions and decide yourself whether to proceed.
9. Run `enableSync`. The first import uses `initialImportDays` (30 by default), then installs one hourly trigger. Check the **Executions** and **Triggers** panels. Run `syncWhoop` again: unchanged records should show `created: 0`.

No web-app deployment or advanced Calendar service is needed for normal synchronization. Each user installs their own script and supplies their own OAuth credentials. This is not a hosted multi-user integration.

## Settings and behavior

Edit `Settings.gs` for titles, description time zone, initial import days, recent lookback days, and full reconciliation interval. Changing initial import days after setup does not reset the stored import boundary.

`disableSync` stops this project's sync triggers but keeps events and OAuth authorization. To disconnect, also revoke the application in WHOOP and Google account settings. Do not delete the `WHOOP-SOURCE:...` marker in event descriptions: it helps recover events after interrupted runs. Titles and descriptions are owned by the sync and may overwrite your manual edits.

After first use, the destination is bound in User Properties. Changing the destination ID directly is rejected to prevent duplicate imports. If you need to move calendars, use the separate [optional migration tool](extras/README.md).

## Limits

- Polling is hourly, not a webhook or real-time feed. A score that appears later is added on a subsequent successful sync.
- The sleep event represents the recorded sleep session **including awake time**. Time asleep and stage totals appear in the description. WHOOP exposes stage totals here, not a stage-by-stage timeline.
- Missing metrics are omitted. This does not add recovery/HRV data, which would require another WHOOP scope.
- WHOOP deletions are not mirrored. Manually deleting a destination event may cause it to be recreated.
- Google and WHOOP quotas still apply. A rate-limit failure leaves completed writes intact; rerun later. Source markers and event IDs make retries idempotent. Large imports may be deferred after roughly four minutes and resume by checking existing events on later runs. API fetching/indexing can still hit Google's [execution and storage limits](https://developers.google.com/apps-script/guides/services/quotas); start with a modest history window.
- Sharing the destination calendar also shares its health details. Use a private calendar or review its viewers before enabling sync. Credentials and tokens are accessible to project editors; keep your Apps Script project private.

## Development

Node.js 22 or newer; no npm dependencies:

```sh
node tests/sync.cjs
node tests/integration.cjs
node tests/migration.cjs
```

Tests use synthetic fixtures and stub Google/WHOOP services. They cover deduplication, interrupted-write recovery, timestamp updates, subsecond normalization, DST boundaries, missing metrics, pagination, configuration guards, and fetch failures before writes. The original personal installation was exercised against live services; the configurable public version is tested with stubs and needs authorization in each installer's account.

API references: [WHOOP](https://developer.whoop.com/api/), [Google Apps Script Calendar](https://developers.google.com/apps-script/reference/calendar), [Google OAuth2 library](https://github.com/googleworkspace/apps-script-oauth2).

MIT licensed. Unofficial community project; not affiliated with WHOOP or Google.
