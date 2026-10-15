import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profiles} from '../data.js';
import {resultURL,cardURL,sharedProfile,makeShareFile,canShareImage} from '../sharing.js';
const base='https://doki0921z.github.io/mcd-personality/';
test('all result and image links preserve the GitHub Pages project path',()=>{
  for(const p of profiles){assert.equal(resultURL(base,p.id),`${base}share/${p.id}.html`);assert.equal(cardURL(base,p.id),`${base}assets/cards/${p.id}.png`);assert.equal(sharedProfile(resultURL(base,p.id)).id,p.id);assert.equal(sharedProfile(`${base}?r=${p.id}`).id,p.id);}
  assert.equal(sharedProfile(`${base}share/invalid.html`),undefined);
  assert.throws(()=>resultURL(base,'../../bad'));
});
test('WeChat always uses image save guidance, even if Web Share claims support',()=>{
  let called=false;
  const navigator={userAgent:'Mozilla/5.0 iPhone MicroMessenger/8.0',share(){},canShare(){called=true;return true;}};
  assert.equal(canShareImage(navigator,{}),false);assert.equal(called,false);
});
test('partial, throwing or missing native APIs never break the image path',()=>{
  assert.equal(canShareImage({userAgent:'Chrome',canShare:()=>true},{}),false);
  assert.equal(canShareImage({userAgent:'Chrome',share(){},canShare(){throw new Error('unsupported');}},{}),false);
  assert.equal(canShareImage({userAgent:'Chrome',share(){},canShare:()=>true},{}),true);
  assert.equal(makeShareFile(new Blob(),'fries',null),null);
  assert.equal(makeShareFile(new Blob(),'fries',class{constructor(){throw new Error('unsupported');}}),null);
});
test('every shared result has fetchable HTML metadata and a full-size PNG',()=>{
  for(const p of profiles){
    const page=readFileSync(new URL(`../share/${p.id}.html`,import.meta.url),'utf8');
    assert.match(page,/<base href="\.\.\/">/);
    for(const name of ['og:title','og:description','og:url','og:image'])assert.equal((page.match(new RegExp(`property="${name}"`,'g'))||[]).length,1);
    assert.ok(page.includes(resultURL(base,p.id)));assert.ok(page.includes(cardURL(base,p.id)));
    assert.ok(page.includes('id="open-poster"'));assert.ok(page.includes('id="share-feedback"'));
    const png=readFileSync(new URL(`../assets/cards/${p.id}.png`,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);
  }
});
