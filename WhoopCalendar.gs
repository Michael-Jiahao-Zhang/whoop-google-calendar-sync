/** WHOOP -> Google Calendar. No paid subscription or web app deployment required.
 * Add Google's OAuth2 library: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF.
 * Set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET in Project Settings > Script properties.
 * Register https://script.google.com/macros/d/{SCRIPT_ID}/usercallback in WHOOP.
 * Edit Settings.gs, run showSetup, authorizeWhoop, then enableSync.
 */
const WHOOP_API = 'https://api.prod.whoop.com/developer/v2/activity/';
const DAY_MS = 86400000;

function whoopService_() {
  const config = PropertiesService.getScriptProperties();
  const id = config.getProperty('WHOOP_CLIENT_ID');
  const secret = config.getProperty('WHOOP_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET in script properties first.');
  return OAuth2.createService('WHOOP')
    .setAuthorizationBaseUrl('https://api.prod.whoop.com/oauth/oauth2/auth')
    .setTokenUrl('https://api.prod.whoop.com/oauth/oauth2/token')
    .setClientId(id).setClientSecret(secret)
    .setCallbackFunction('whoopCallback')
    .setScope('read:sleep read:workout offline')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setCache(CacheService.getUserCache())
    .setLock(LockService.getUserLock())
    .setTokenPayloadHandler(function(payload) {
      if (payload.grant_type === 'refresh_token') payload.scope = 'offline';
      return payload;
    });
}

function authorizeWhoop() {
  const service = whoopService_();
  if (service.hasAccess()) console.log('WHOOP is connected. Run enableSync.');
  else console.log(service.getAuthorizationUrl());
}

function whoopCallback(request) {
  const success = whoopService_().handleCallback(request);
  return HtmlService.createHtmlOutput(success
    ? 'WHOOP connected. Return to Apps Script and run enableSync to start calendar syncing.'
    : 'WHOOP authorization was declined. No sync was enabled.');
}

function enableSync() {
  if (!whoopService_().hasAccess()) throw new Error('Run authorizeWhoop and finish WHOOP authorization first.');
  const config = config_();
  const props = PropertiesService.getUserProperties();
  if (!props.getProperty('IMPORT_START')) {
    props.setProperty('IMPORT_START', new Date(Date.now() - config.initialImportDays * DAY_MS).toISOString());
  }
  syncWhoop(); // Verify an initial successful run before scheduling.
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'syncWhoop')) {
    ScriptApp.newTrigger('syncWhoop').timeBased().everyHours(1).create();
  }
  console.log('Enabled: hourly sleep/workout sync. Using the configured existing calendar.');
}

function disableSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncWhoop')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Automatic sync stopped. Existing calendar events remain.');
}

function syncWhoop() {
  // Script lock serializes calendar writes; OAuth2 uses a separate user lock for refresh.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const config = config_();
    const runStarted = Date.now();
    const service = whoopService_();
    if (!service.hasAccess()) throw new Error('WHOOP authorization is missing or expired. Run authorizeWhoop.');
    const props = PropertiesService.getUserProperties();
    const bound = props.getProperty('BOUND_CALENDAR_ID');
    if (bound && bound !== config.calendarId) throw new Error('Calendar changed. Migrate managed events before changing the bound calendar.');
    const importStart = props.getProperty('IMPORT_START');
    if (!importStart) throw new Error('Run enableSync first.');
    const now = Date.now();
    const full = !props.getProperty('LAST_FULL_SYNC') ||
      now - Number(props.getProperty('LAST_FULL_SYNC')) >= config.fullSyncDays * DAY_MS;
    const start = full ? new Date(importStart) : new Date(Math.max(Date.parse(importStart), now - config.lookbackDays * DAY_MS));
    const end = new Date(now);
    // Fetch both complete paginated collections before any calendar mutation.
    const sleeps = fetchCollection_('sleep', start, end, service);
    const workouts = fetchCollection_('workout', start, end, service);
    const calendar = CalendarApp.getCalendarById(config.calendarId);
    if (!calendar) throw new Error('Configured calendar is unavailable. Restore its access before syncing.');
    props.setProperty('BOUND_CALENDAR_ID', config.calendarId);
    // Source IDs in descriptions recover orphaned events if a run failed after creation.
    const index = {};
    calendar.getEvents(new Date(Date.parse(importStart) - 2 * DAY_MS), new Date(now + DAY_MS))
      .forEach(event => {
        const marker = (event.getDescription() || '').match(/^WHOOP-SOURCE:(sleep|workout):([a-zA-Z0-9-]+)$/m);
        if (!marker) return;
        const key = marker[1] + ':' + marker[2];
        if (index[key]) throw new Error('Duplicate WHOOP source ID found. Resolve duplicates before resuming.');
        index[key] = event;
      });
    const stats = {created: 0, updated: 0, unchanged: 0, skipped: 0};
    const records = sleeps.map(record => ['sleep', record]).concat(workouts.map(record => ['workout', record]));
    let complete = true;
    for (let i = 0; i < records.length; i++) {
      if (Date.now() - runStarted > 240000) {complete = false; stats.deferred = records.length - i; break;}
      upsert_(records[i][0], records[i][1], calendar, index, props, stats);
    }
    if (complete) {
      props.setProperty('LAST_SUCCESS', new Date().toISOString());
      if (full) props.setProperty('LAST_FULL_SYNC', String(now));
    }
    console.log(JSON.stringify(stats)); // No tokens or health measurements in logs.
  } finally {
    lock.releaseLock();
  }
}

function fetchCollection_(type, start, end, service) {
  let next = '';
  const records = [];
  const visited = {};
  do {
    const params = {limit: 25, start: start.toISOString(), end: end.toISOString()};
    if (next) params.nextToken = next;
    const query = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    let response = UrlFetchApp.fetch(WHOOP_API + type + '?' + query, {
      headers: {Authorization: 'Bearer ' + service.getAccessToken()}, muteHttpExceptions: true
    });
    if (response.getResponseCode() === 401) {
      service.refresh();
      response = UrlFetchApp.fetch(WHOOP_API + type + '?' + query, {
        headers: {Authorization: 'Bearer ' + service.getAccessToken()}, muteHttpExceptions: true
      });
    }
    if (response.getResponseCode() !== 200) {
      throw new Error('WHOOP ' + type + ' fetch failed (HTTP ' + response.getResponseCode() + '). Retry later.');
    }
    const page = JSON.parse(response.getContentText());
    if (!Array.isArray(page.records)) throw new Error('WHOOP returned an invalid collection.');
    records.push.apply(records, page.records);
    next = page.next_token || '';
    if (next && visited[next]) throw new Error('WHOOP pagination repeated a token.');
    if (next) visited[next] = true;
  } while (next);
  return records;
}

function eventData_(type, record) {
  // CalendarApp persists whole seconds; normalize WHOOP's milliseconds to avoid false updates.
  const start = new Date(Math.floor(Date.parse(record.start) / 1000) * 1000);
  const end = new Date(Math.floor(Date.parse(record.end) / 1000) * 1000);
  if (!record.id || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  // WHOOP sleep start/end describe the sleep-session interval, including awake periods.
  const title = type === 'sleep' ? (record.nap ? SETTINGS.titles.nap : SETTINGS.titles.sleep)
    : workoutTitle_(record.sport_name);
  const marker = 'WHOOP-SOURCE:' + type + ':' + record.id;
  const description = details_(type, record, start, end) + '\n\n' + marker;
  return {start: start, end: end, title: title, description: description};
}

function upsert_(type, record, calendar, index, props, stats) {
  const data = eventData_(type, record);
  if (!data) { stats.skipped++; return; }
  const key = type + ':' + record.id;
  const propertyKey = 'EVENT:' + key;
  let event = index[key];
  if (!event && props.getProperty(propertyKey)) {
    event = calendar.getEventById(props.getProperty(propertyKey));
  }
  if (!event) {
    event = calendar.createEvent(data.title, data.start, data.end, {description: data.description});
    props.setProperty(propertyKey, event.getId());
    index[key] = event;
    stats.created++;
    Utilities.sleep(1500);
  } else {
    const timeChanged = event.getStartTime().getTime() !== data.start.getTime() ||
      event.getEndTime().getTime() !== data.end.getTime();
    const titleChanged = event.getTitle() !== data.title;
    const descriptionChanged = event.getDescription() !== data.description;
    if (timeChanged) {event.setTime(data.start, data.end); Utilities.sleep(1000);}
    if (titleChanged) {event.setTitle(data.title); Utilities.sleep(1000);}
    if (descriptionChanged) {event.setDescription(data.description); Utilities.sleep(1000);}
    if (timeChanged || titleChanged || descriptionChanged) stats.updated++;
    else stats.unchanged++;
    props.setProperty(propertyKey, event.getId());
  }
  // Source deletions are deliberately not inferred from incomplete or missing API records.
}

function workoutTitle_(sport) {
  const names = SETTINGS.workoutTitles;
  const key = String(sport || '').toLowerCase().replace(/[ -]/g, '_');
  return names[key] || (key ? '✨ ' + String(sport).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '⚡ Move & Recharge');
}

function duration_(ms) {
  const minutes = Math.round(ms / 60000);
  return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
}

function details_(type, record, start, end) {
  const lines = [type === 'sleep' ? (record.nap ? '☁️ Nap summary' : '🌙 Sleep summary') : '🔥 Workout summary'];
  lines.push('🕒 ' + Utilities.formatDate(start, SETTINGS.displayTimeZone, 'yyyy-MM-dd HH:mm') + ' → ' + Utilities.formatDate(end, SETTINGS.displayTimeZone, 'yyyy-MM-dd HH:mm') + ' (' + SETTINGS.displayTimeZone + ')');
  const add = (label, value, format) => {
    if (typeof value === 'number' && Number.isFinite(value)) lines.push(label + ': ' + format(value));
  };
  const pct = v => v.toFixed(1) + '%';
  const score = record.score || {};
  if (type === 'sleep') {
    lines.push('🛏️ Sleep session: ' + duration_(end - start) + ' (includes awake time)');
    const stages = score.stage_summary || {};
    const stagesValues = ['total_light_sleep_time_milli', 'total_slow_wave_sleep_time_milli', 'total_rem_sleep_time_milli'].map(k => stages[k]);
    if (stagesValues.every(v => typeof v === 'number' && Number.isFinite(v))) {
      add('💤 Time asleep', stagesValues.reduce((a, b) => a + b, 0), duration_);
    }
    add('🌫️ Light sleep', stages.total_light_sleep_time_milli, duration_);
    add('🌊 Deep sleep', stages.total_slow_wave_sleep_time_milli, duration_);
    add('✨ REM', stages.total_rem_sleep_time_milli, duration_);
    add('👀 Awake', stages.total_awake_time_milli, duration_);
    add('📡 No data', stages.total_no_data_time_milli, duration_);
    add('🎯 Sleep performance', score.sleep_performance_percentage, pct);
    add('⚡ Sleep efficiency', score.sleep_efficiency_percentage, pct);
    add('🗓️ Sleep consistency', score.sleep_consistency_percentage, pct);
    add('🫁 Respiratory rate', score.respiratory_rate, v => v.toFixed(1) + ' breaths/min');
    add('🔄 Sleep cycles', stages.sleep_cycle_count, v => String(v));
    add('🌙 Disturbances', stages.disturbance_count, v => String(v));
    const need = score.sleep_needed || {};
    const needValues = ['baseline_milli', 'need_from_sleep_debt_milli', 'need_from_recent_strain_milli', 'need_from_recent_nap_milli'].map(k => need[k]);
    if (needValues.every(v => typeof v === 'number' && Number.isFinite(v))) {
      add('🛌 Sleep need', Math.max(0, needValues.reduce((a, b) => a + b, 0)), duration_);
    }
  } else {
    lines.push('⏱️ Duration: ' + duration_(end - start));
    if (record.sport_name) lines.push('Activity: ' + String(record.sport_name).replace(/_/g, ' '));
    add('🔥 Strain', score.strain, v => v.toFixed(1) + ' / 21');
    add('❤️ Average heart rate', score.average_heart_rate, v => Math.round(v) + ' bpm');
    add('🚀 Max heart rate', score.max_heart_rate, v => Math.round(v) + ' bpm');
    add('🔋 Energy', score.kilojoule, v => Math.round(v / 4.184) + ' kcal');
    add('📏 Distance', score.distance_meter, v => (v / 1000).toFixed(2) + ' km');
    add('⛰️ Altitude gain', score.altitude_gain_meter, v => Math.round(v) + ' m');
    const zones = score.zone_durations || {};
    ['zero', 'one', 'two', 'three', 'four', 'five'].forEach((name, i) => add('❤️ Heart rate zone Z' + i, zones['zone_' + name + '_milli'], duration_));
  }
  if (!record.score) lines.push('⏳ WHOOP score is not available yet. Available metrics will be added on later syncs.');
  lines.push('Source: WHOOP · Recorded session start/end.');
  return lines.join('\n');
}

function config_() {
  if (!SETTINGS.calendarId || typeof SETTINGS.calendarId !== 'string') throw new Error('Set SETTINGS.calendarId to an existing writable calendar ID.');
  if (!SETTINGS.displayTimeZone || !SETTINGS.titles || !SETTINGS.workoutTitles) throw new Error('Check Settings.gs.');
  Utilities.formatDate(new Date(), SETTINGS.displayTimeZone, 'yyyy-MM-dd');
  ['initialImportDays', 'lookbackDays', 'fullSyncDays'].forEach(key => {
    if (!Number.isInteger(SETTINGS[key]) || SETTINGS[key] < 1 || SETTINGS[key] > 365) throw new Error('Invalid setting: ' + key);
  });
  return SETTINGS;
}

function showSetup() {
  config_();
  console.log('WHOOP redirect URI: ' + whoopService_().getRedirectUri());
  console.log('Description time zone: ' + SETTINGS.displayTimeZone + '. Set Google Calendar display time zone separately.');
}
