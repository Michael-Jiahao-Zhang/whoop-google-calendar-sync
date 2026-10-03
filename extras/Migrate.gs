/** Optional: add this file only when changing destination calendars.
 * Disable syncing first. Set MIGRATION_SOURCE_CALENDAR_ID in Script Properties;
 * set SETTINGS.calendarId to the destination. Enable Google's Calendar advanced service.
 */
function migrateManagedEvents() {
  const config = config_();
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'syncWhoop')) {
    throw new Error('Run disableSync before migration.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another operation is running. Retry later.');
  try {
    const props = PropertiesService.getUserProperties();
    const source = PropertiesService.getScriptProperties().getProperty('MIGRATION_SOURCE_CALENDAR_ID');
    const bound = props.getProperty('BOUND_CALENDAR_ID');
    if (!source || source === config.calendarId || (bound && bound !== source)) {
      throw new Error('Check the migration source and destination IDs.');
    }
    if (!CalendarApp.getCalendarById(config.calendarId)) throw new Error('Destination unavailable.');
    const events = migrationList_(source).filter(e => migrationMarker_(e));
    const destination = new Set(migrationList_(config.calendarId).map(migrationMarker_).filter(Boolean));
    if (events.some(e => destination.has(migrationMarker_(e)))) throw new Error('Matching source IDs already exist in the destination; resolve before moving.');
    if (events.some(e => e.recurrence || (e.attendees || []).length || (e.eventType && e.eventType !== 'default'))) {
      throw new Error('Managed event has guests, recurrence, or a non-default type. Review before migration.');
    }
    let moved = 0;
    // Bounded batches can be repeated after interruption; completed moves leave the source.
    for (const event of events.slice(0, 20)) {
      const result = Calendar.Events.move(source, event.id, config.calendarId, {sendUpdates: 'none'});
      props.setProperty('EVENT:' + migrationMarker_(result), result.iCalUID);
      moved++;
      Utilities.sleep(1500);
    }
    const remaining = events.length - moved;
    if (!remaining) {
      props.setProperty('BOUND_CALENDAR_ID', config.calendarId);
      props.deleteProperty('LAST_FULL_SYNC');
    }
    console.log(JSON.stringify({moved: moved, remaining: remaining}));
  } finally {lock.releaseLock();}
}

function migrationMarker_(event) {
  const match = (event.description || '').match(/^WHOOP-SOURCE:(sleep|workout):([a-zA-Z0-9-]+)$/m);
  return match ? match[1] + ':' + match[2] : null;
}

function migrationList_(calendarId) {
  const items = [];
  let token;
  do {
    const page = Calendar.Events.list(calendarId, {maxResults: 2500, showDeleted: false, pageToken: token});
    items.push.apply(items, page.items || []);
    token = page.nextPageToken;
  } while (token);
  return items;
}
