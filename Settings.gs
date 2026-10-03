// Non-secret preferences. Store OAuth credentials in Script Properties, never here.
const SETTINGS = {
  calendarId: '', // Existing Google Calendar → Settings → Integrate calendar → Calendar ID.
  displayTimeZone: 'Etc/UTC', // e.g. America/Chicago (Nashville), Europe/London, Asia/Shanghai.
  initialImportDays: 30,
  lookbackDays: 30,
  fullSyncDays: 7,
  titles: {sleep: '🌙 Dream Time', nap: '☁️ Power Nap'},
  workoutTitles: {
    weightlifting: '🏋️ Strength Session', running: '🏃 Run Club', walking: '🚶 Fresh Air Walk',
    cycling: '🚴 Ride Time', swimming: '🏊 Swim Flow', yoga: '🧘 Mind & Body',
    pilates: '✨ Pilates Flow', activity: '⚡ Move & Recharge', functional_fitness: '🔥 Training Time',
    hiking: '🥾 Trail Time', basketball: '🏀 Court Time', tennis: '🎾 Court Time'
  }
};
