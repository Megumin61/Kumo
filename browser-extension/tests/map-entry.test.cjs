const test=require('node:test'),assert=require('node:assert/strict');
const {openMap}=require('../map-entry.js');
test('knowledge map navigates within the existing sidebar without opening a window',()=>{let url;const api={runtime:{getURL:p=>'chrome-extension://kumo/'+p},windows:{create(){assert.fail('must keep the native sidebar');}}};openMap({chromeApi:api,navigate:u=>url=u});assert.equal(url,'chrome-extension://kumo/garden/index.html?panel=1');});
