const fs=require('node:fs'); const vm=require('node:vm');const assert=require('node:assert/strict');
const store=new Map([['BOUND_CALENDAR_ID','synthetic-source-calendar']]);
const props={getProperty:k=>store.get(k),setProperty:(k,v)=>store.set(k,v),deleteProperty:k=>store.delete(k)};
const source=Array.from({length:22},(_,i)=>({id:'synthetic-event-'+i,description:'WHOOP-SOURCE:sleep:synthetic-source-'+i,iCalUID:'synthetic-'+i+'@example.invalid'}));
source.push({id:'unrelated',description:'Personal event'});
const destination=[];
const context=vm.createContext({console,Utilities:{sleep(){},formatDate(){}},
 PropertiesService:{getUserProperties:()=>props,getScriptProperties:()=>({getProperty:()=> 'synthetic-source-calendar'})},
 ScriptApp:{getProjectTriggers:()=>[]},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 CalendarApp:{getCalendarById:()=>({})},Calendar:{Events:{
 list:id=>({items:id==='synthetic-source-calendar'?[...source]:[...destination]}),
 move:(id,eventId,target)=>{const i=source.findIndex(e=>e.id===eventId);const e=source.splice(i,1)[0];destination.push(e);return e;}
 }}});
vm.runInContext(fs.readFileSync('Settings.gs','utf8')+'\n'+fs.readFileSync('WhoopCalendar.gs','utf8')+'\n'+fs.readFileSync('extras/Migrate.gs','utf8'),context);
vm.runInContext("SETTINGS.calendarId='synthetic-destination-calendar';",context);
context.migrateManagedEvents();assert.equal(destination.length,20);assert.equal(store.get('BOUND_CALENDAR_ID'),'synthetic-source-calendar');
context.migrateManagedEvents();assert.equal(destination.length,22);assert.equal(source.length,1);assert.equal(source[0].id,'unrelated');
assert.equal(store.get('BOUND_CALENDAR_ID'),'synthetic-destination-calendar');
assert.equal(store.get('EVENT:sleep:synthetic-source-0'),'synthetic-0@example.invalid');
// Active syncing must block a one-time migration.
context.ScriptApp.getProjectTriggers=()=>[{getHandlerFunction:()=> 'syncWhoop'}];
assert.throws(()=>context.migrateManagedEvents(),/disableSync/);
console.log('Passed: bounded migration, resumption, ID preservation, unrelated records, active-trigger guard.');
