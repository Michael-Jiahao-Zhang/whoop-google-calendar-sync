const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({console, Utilities:{sleep(){}, formatDate(){return 'synthetic-time';}}});
vm.runInContext(fs.readFileSync('Settings.gs', 'utf8'), context);
vm.runInContext(fs.readFileSync('WhoopCalendar.gs', 'utf8'), context);
let count = 0;
const events = new Map();
const calendar = {
  createEvent(title, start, end, options) {
    const event = {title, start, end, description: options.description, id: 'event' + (++count),
      getId() {return this.id;}, getTitle() {return this.title;},
      getStartTime() {return this.start;}, getEndTime() {return this.end;},
      getDescription() {return this.description;},
      setTime(start, end) {this.start=start; this.end=end; return this;},
      setTitle(title) {this.title=title; return this;},
      setDescription(description) {this.description=description; return this;}
    };
    events.set(event.id, event); return event;
  }, getEventById(id) {return events.get(id) || null;}
};
const store = new Map();
const props = {getProperty:k=>store.get(k), setProperty:(k,v)=>store.set(k,v)};
const stats = {created:0,updated:0,unchanged:0,skipped:0};
const source = {id:'source-1',start:'2026-10-02T23:30:00-05:00',end:'2026-10-03T08:00:00-05:00'};
let index={};
context.upsert_('sleep',source,calendar,index,props,stats);
context.upsert_('sleep',source,calendar,index,props,stats);
assert.equal(count,1); assert.equal(stats.unchanged,1);
const previousUnchanged = stats.unchanged;
context.upsert_('sleep',{...source,start:'2026-10-02T23:30:00.789-05:00',end:'2026-10-03T08:00:00.456-05:00'},calendar,index,props,stats);
assert.equal(stats.unchanged,previousUnchanged+1);
// A retry with a fresh in-memory index still resolves the persistent event ID.
index={};
context.upsert_('sleep',{...source,end:'2026-10-03T08:15:00-05:00'},calendar,index,props,stats);
assert.equal(count,1); assert.equal(stats.updated,1);
assert.equal(events.get('event1').end.toISOString(),'2026-10-03T13:15:00.000Z');
// The atomic description marker lets an index recover events if saving the ID failed.
store.clear(); index={'sleep:source-1':events.get('event1')};
context.upsert_('sleep',source,calendar,index,props,stats);
assert.equal(count,1);
context.upsert_('workout',{...source,sport_name:'running'},calendar,index,props,stats);
assert.equal(count,2); assert.equal(events.get('event2').title,'🏃 Run Club');
context.upsert_('sleep',{...source,end:'2026-10-02T21:00:00-05:00'},calendar,index,props,stats);
assert.equal(stats.skipped,1);
let pageCalls=0;
context.UrlFetchApp={fetch(url) {
  pageCalls++;
  if(pageCalls===2) assert.ok(url.includes('nextToken=page2'));
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(pageCalls===1
    ? {records:[source],next_token:'page2'} : {records:[{...source,id:'source-2'}]})};
}};
const result=context.fetchCollection_('sleep',new Date(source.start),new Date(source.end),{getAccessToken:()=> 'mock'});
assert.equal(result.length,2); assert.equal(pageCalls,2);
console.log('Passed: repeated run deduplication, source time update, time-zone conversion, orphan recovery, sleep/workout ID separation, invalid interval handling, API pagination.');

const detail=context.eventData_('sleep',{...source,score:{stage_summary:{total_light_sleep_time_milli:3600000,total_slow_wave_sleep_time_milli:1800000,total_rem_sleep_time_milli:1800000,total_awake_time_milli:0},sleep_efficiency_percentage:93.4}});
assert.equal(detail.title,'🌙 Dream Time');
assert.ok(detail.description.includes('Time asleep: 2h 0m'));
assert.ok(detail.description.includes('93.4%'));
assert.ok(!context.eventData_('sleep',source).description.includes('Light sleep:'));
console.log('Passed: emoji titles, stage totals, available metrics, missing metrics omitted.');
