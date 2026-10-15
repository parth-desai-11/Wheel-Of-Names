import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedChances, pickWeightedIndex, rotationForWinner, indexAtPointer, parseCSV, exportCSV } from '../dist/core.js';

test('weights normalize, with zero weights excluded from selection',()=>{
  const entries=[{weight:0},{weight:1},{weight:3}];
  assert.deepEqual(normalizedChances(entries),[0,.25,.75]);
  assert.equal(pickWeightedIndex(entries,0),1);
  assert.equal(pickWeightedIndex(entries,.24999),1);
  assert.equal(pickWeightedIndex(entries,.25),2);
  assert.equal(pickWeightedIndex(entries,.999999),2);
  assert.throws(()=>pickWeightedIndex([{weight:0}],.5),/greater than zero/);
  assert.throws(()=>pickWeightedIndex(entries,1));
  assert.deepEqual(normalizedChances([{weight:1e308},{weight:1e308}]),[.5,.5]);
});

test('deterministic distribution honors 10/30/60 probabilities',()=>{
  const entries=[{weight:10},{weight:30},{weight:60}],counts=[0,0,0];
  for(let i=0;i<100000;i++)counts[pickWeightedIndex(entries,(i+.5)/100000)]++;
  assert.deepEqual(counts,[10000,30000,60000]);
});

test('every weighted choice lands under the pointer on equal slice geometry',()=>{
  for(const count of [1,2,3,8,37,120,1000]){
    for(let index=0;index<count;index++){
      for(const offset of [0,.2,.5,.999999]){
        for(const rotation of [0,3.1,213.7]){
          const final=rotationForWinner(index,count,rotation,offset);
          assert.equal(indexAtPointer(final,count),index,`count=${count},index=${index},offset=${offset}`);
          assert.ok(final>rotation+Math.PI*10);
        }
      }
    }
  }
});

test('CSV supports headers, reordered columns, quoted commas, escaped quotes, BOM and CRLF',()=>{
  assert.deepEqual(parseCSV('\uFEFFweight,name\r\n3,"Desai, Parth"\r\n1,"The ""winner"""\r\n'),[{name:'Desai, Parth',weight:3},{name:'The "winner"',weight:1}]);
  assert.deepEqual(parseCSV('name,probability\nA,70%\nB,30%'),[{name:'A',weight:70},{name:'B',weight:30}]);
  assert.deepEqual(parseCSV('Alex\nSam\nTaylor'),[{name:'Alex',weight:1},{name:'Sam',weight:1},{name:'Taylor',weight:1}]);
  assert.deepEqual(parseCSV('name\tweight\nA\t0\nB\t2'),[{name:'A',weight:0},{name:'B',weight:2}]);
  assert.deepEqual(parseCSV('name;weight\nA;0.5\nB;1.5'),[{name:'A',weight:.5},{name:'B',weight:1.5}]);
  assert.deepEqual(parseCSV('name,weight\n"Two\nlines",2'),[{name:'Two\nlines',weight:2}]);
});

test('bad imports fail with actionable errors',()=>{
  for(const csv of ['', 'name,weight', 'A,-1', 'A,NaN', 'A,Infinity', 'A,1,2', ',2', '"Unclosed,2', '"A"bad,2'])assert.throws(()=>parseCSV(csv));
});

test('CSV round trip preserves names and weights',()=>{
  const entries=[{name:'A, B',weight:0},{name:'"Alex"',weight:.125},{name:'你好',weight:2},{name:'=A1',weight:4}];
  assert.deepEqual(parseCSV(exportCSV(entries)),entries);
});
