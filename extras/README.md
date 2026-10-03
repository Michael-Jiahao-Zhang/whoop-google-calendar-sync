# Optional calendar migration

This is a one-time utility; do not include it during normal installation. It moves source-marked events in place rather than recreating or deleting calendars.

1. In the same Apps Script project, run `disableSync`. Let any running execution finish.
2. Add `Migrate.gs`. In the editor's Services panel, add the official **Google Calendar API**, version v3, identifier `Calendar`. Review its terms/permissions yourself. This enables the API for a default Apps Script cloud project; a custom Cloud project may need API enablement separately.
3. In Script Properties set `MIGRATION_SOURCE_CALENDAR_ID` to the old calendar ID. Change `SETTINGS.calendarId` to the writable destination's ID. Keep the existing User Properties, source markers, and import boundary.
4. Run `migrateManagedEvents` repeatedly until the log says `remaining: 0`. Each run moves up to 20 managed events. It leaves unrelated events alone and refuses events with guests/recurrence or matching source IDs in the destination. Completed moves remain after an interrupted run.
5. Run `enableSync`. Check the destination times and details. If desired, hide the old empty calendar manually; this utility never deletes a calendar.

Do not remove the old calendar or clear state while migration is incomplete. If you stop halfway, keep syncing disabled and resume migration. The optional tool is covered by synthetic tests; review its results in your calendars when using it.
