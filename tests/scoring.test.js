import test from 'node:test';
import assert from 'node:assert/strict';
import {profiles,questions,calculateResult} from '../data.js';
test('five questions provide four complete options for all nine profiles',()=>{assert.equal(profiles.length,9);assert.equal(questions.length,5);for(const q of questions){assert.equal(q.options.length,4);for(const o of q.options){assert.equal(o.weights.length,profiles.length);assert.equal(o.traits.length,4);assert.ok(o.weights.every(v=>Number.isFinite(v)&&v>=0&&v<=4));assert.ok(o.traits.every(v=>v>=0&&v<=4));}}});
test('all 1024 answer paths produce a deterministic and reachable result',()=>{const reached=new Map(profiles.map(p=>[p.id,0]));for(let n=0;n<1024;n++){const answers=Array.from({length:5},(_,i)=>(n>>(i*2))&3);const result=calculateResult(answers);assert.ok(reached.has(result.profile.id));assert.deepEqual(result,calculateResult(answers));assert.ok(result.traits.every(v=>v>=0&&v<=100));reached.set(result.profile.id,reached.get(result.profile.id)+1);}for(const [id,count] of reached){assert.ok(count>0,`${id} must be reachable`);}console.log('Result distribution:',Object.fromEntries(reached));});
test('incomplete or invalid answers cannot produce a result',()=>{for(const answers of [[],[0,0],[0,0,0,0,4],[0,0,0,0,-1],[0,0,0,0,'1'],null])assert.throws(()=>calculateResult(answers));});
test('all buddies point to an existing, different profile',()=>{for(const p of profiles){assert.notEqual(p.id,p.buddy);assert.ok(profiles.some(b=>b.id===p.buddy));}});

test('direct action choices reach spicy wings and the old pie identity remains pineapple',()=>{
  assert.equal(calculateResult([0,1,2,1,2]).profile.id,'wings');
  assert.equal(calculateResult([1,0,0,0,1]).profile.name,'菠萝派');
  assert.equal(profiles.find(p=>p.id==='pie').english,'THE WARM PINEAPPLE PIE');
});
