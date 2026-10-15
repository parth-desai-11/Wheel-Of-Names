import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_ENTRIES, SCHEDULE } from '../dist/defaults.js';
import { parseCSV, rotationForWinner, indexAtPointer } from '../dist/core.js';
import { chancesForSpin, pickIndexForSpin, entriesWithImages } from '../dist/sequence.js';

test('the bundled CSV and default roster contain the same 91 names', async () => {
  const csv = await readFile(new URL('../dist/default-entries.csv', import.meta.url), 'utf8');
  assert.deepEqual(parseCSV(csv), DEFAULT_ENTRIES);
  assert.equal(DEFAULT_ENTRIES.length, 91);
  assert.equal(new Set(DEFAULT_ENTRIES.map(entry => entry.name)).size, 91);
  for (const name of ['Mohit Bhagat', 'Mohit Agarwal', 'Yash Mota', 'Sandip pednekar']) {
    assert.equal(DEFAULT_ENTRIES.filter(entry => entry.name === name).length, 1);
  }
});

test('scheduled picks ignore weights and randomness on exactly spins 10 and 18', () => {
  assert.deepEqual(SCHEDULE, [{spin:10,name:'Mohit Agarwal'},{spin:18,name:'Yash Mota'}]);
  const entries = DEFAULT_ENTRIES.map(entry => ({...entry,weight:0}));
  for (const slot of SCHEDULE) {
    for (const random of [0, .1, .5, .999999999]) {
      assert.equal(entries[pickIndexForSpin(entries,slot.spin,random)].name,slot.name);
    }
  }
});

test('future scheduled names are reserved, with conditional weights on other spins', () => {
  const entries = [
    {name:'A',weight:1}, {name:'B',weight:3},
    {name:'Mohit Agarwal',weight:1000}, {name:'Yash Mota',weight:1000}
  ];
  for (let spin=1;spin<10;spin++) {
    assert.deepEqual(chancesForSpin(entries,spin),[.25,.75,0,0]);
    assert.equal(pickIndexForSpin(entries,spin,.24999),0);
    assert.equal(pickIndexForSpin(entries,spin,.25),1);
  }
  assert.ok(chancesForSpin(entries,11)[2]>0);
  assert.equal(chancesForSpin(entries,17)[3],0);
  assert.ok(chancesForSpin(entries,19)[3]>0);
});

test('scheduled picks land correctly after sorting and removing earlier winners', () => {
  for (let trial=0;trial<24;trial++) {
    let entries=DEFAULT_ENTRIES.map(entry=>({...entry}));
    for (let spin=1;spin<=18;spin++) {
      entries.sort((a,b)=>trial%2?a.name.localeCompare(b.name):b.name.localeCompare(a.name));
      const index=pickIndexForSpin(entries,spin,((trial*173+spin*419)%1000)/1000);
      const name=entries[index].name;
      assert.equal(indexAtPointer(rotationForWinner(index,entries.length,spin*.7,.3),entries.length),index);
      const slot=SCHEDULE.find(slot=>slot.spin===spin);
      if(slot) assert.equal(name,slot.name);
      else for(const future of SCHEDULE.filter(slot=>slot.spin>spin)) assert.notEqual(name,future.name);
      entries.splice(index,1);
    }
  }
});

test('invalid counters, missing scheduled names, and unavailable weights fail explicitly', () => {
  const withoutMohit=DEFAULT_ENTRIES.filter(entry=>entry.name!=='Mohit Agarwal');
  assert.throws(()=>pickIndexForSpin(withoutMohit,10,.5),/Include Mohit Agarwal for spin 10/);
  assert.doesNotThrow(()=>pickIndexForSpin(withoutMohit,11,.5));
  const withoutYash=DEFAULT_ENTRIES.filter(entry=>entry.name!=='Yash Mota');
  assert.throws(()=>pickIndexForSpin(withoutYash,1,.5),/Include Yash Mota for spin 18/);
  assert.throws(()=>pickIndexForSpin(DEFAULT_ENTRIES.map(entry=>({...entry,weight:0})),1,.5),/positive weight/);
  for(const spin of [0,-1,1.2,NaN,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>chancesForSpin(DEFAULT_ENTRIES,spin),/Reset the spin counter/);
  }
});

test('restoring defaults retains matching images and restores canonical names and weights', () => {
  const defaults=[{name:'Mohit Agarwal',weight:1},{name:'A',weight:1},{name:'A',weight:1}];
  const saved=[{name:'a',weight:30,imageId:'first'},{name:' MOHIT AGARWAL ',weight:5,imageId:'mohit'},{name:'A',weight:0,imageId:'second'},{name:'Extra',weight:1,imageId:'extra'}];
  assert.deepEqual(entriesWithImages(defaults,saved),[
    {name:'Mohit Agarwal',weight:1,imageId:'mohit'},
    {name:'A',weight:1,imageId:'first'},
    {name:'A',weight:1,imageId:'second'}
  ]);
  assert.deepEqual(entriesWithImages(defaults),defaults);
  assert.equal(saved[0].weight,30);
});
