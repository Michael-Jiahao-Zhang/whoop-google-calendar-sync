const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function harness() {
  const values = new Map([['IMPORT_START','2026-01-01T00:00:00Z']]);
  const writes=[];
  const props={getProperty:k=>values.get(k),setProperty:(k,v)=>values.set(k,v)};
  const context=vm.createContext({console,Utilities:{sleep(){},formatDate(){return 'synthetic-time';}},
    PropertiesService:{getUserProperties:()=>props},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    CalendarApp:{getCalendarById:()=>({getEvents:()=>[],createEvent(){writes.push('create');throw new Error('Unexpected calendar write');}})}});
  vm.runInContext(fs.readFileSync('Settings.gs','utf8')+'\n'+fs.readFileSync('WhoopCalendar.gs','utf8'),context);
  context.whoopService_=()=>({hasAccess:()=>true});
  return {context,values,writes};
}
let h=harness();
assert.throws(()=>h.context.syncWhoop(),/Set SETTINGS.calendarId/);
assert.equal(h.writes.length,0);
vm.runInContext("SETTINGS.calendarId='synthetic-calendar';",h.context);
h.values.set('BOUND_CALENDAR_ID','different-calendar');
assert.throws(()=>h.context.syncWhoop(),/Calendar changed/);
h.values.delete('BOUND_CALENDAR_ID');
let fetches=0;
h.context.fetchCollection_=()=>{if(++fetches===2)throw new Error('synthetic API failure');return [{id:'synthetic-record'}];};
assert.throws(()=>h.context.syncWhoop(),/synthetic API failure/);
assert.equal(h.writes.length,0);
assert.equal(h.values.has('LAST_SUCCESS'),false);
h.context.fetchCollection_=()=>[];
h.context.CalendarApp.getCalendarById=()=>null;
assert.throws(()=>h.context.syncWhoop(),/calendar is unavailable/);
assert.equal(h.values.has('BOUND_CALENDAR_ID'),false);
h.context.CalendarApp.getCalendarById=()=>({getEvents:()=>[]});
h.context.syncWhoop();
assert.equal(h.values.get('BOUND_CALENDAR_ID'),'synthetic-calendar');
assert.ok(h.values.has('LAST_SUCCESS'));
// Duplicate source IDs halt before any write.
h.context.CalendarApp.getCalendarById=()=>({getEvents:()=>[1,2].map(()=>({getDescription:()=> 'WHOOP-SOURCE:sleep:synthetic-source'}))});
assert.throws(()=>h.context.syncWhoop(),/Duplicate WHOOP source ID/);
assert.equal(h.writes.length,0);
// Absolute intervals remain correct across both DST transitions.
const fall=h.context.eventData_('sleep',{id:'synthetic-fall',start:'2026-11-01T01:30:00-05:00',end:'2026-11-01T01:30:00-06:00'});
const spring=h.context.eventData_('sleep',{id:'synthetic-spring',start:'2026-03-08T01:30:00-06:00',end:'2026-03-08T03:30:00-05:00'});
assert.equal(fall.end-fall.start,3600000);assert.equal(spring.end-spring.start,3600000);
assert.ok(fall.description.includes('1h 0m'));
console.log('Passed: config guards, unavailable target recovery, fetch-before-write, duplicate halt, DST instants.');
h=harness(); vm.runInContext("SETTINGS.calendarId='synthetic-calendar';",h.context);
h.context.fetchCollection_=()=>[{id:'synthetic-record',start:'2026-01-02T00:00:00Z',end:'2026-01-02T01:00:00Z'}];
let tick=0;h.context.Date=class extends Date {static now(){return Date.now()+(++tick)*250001;}};
h.context.syncWhoop();assert.equal(h.values.has('LAST_SUCCESS'),false);assert.equal(h.values.has('LAST_FULL_SYNC'),false);assert.equal(h.writes.length,0);
console.log('Passed: time-budget deferral never marks an incomplete run successful.');
