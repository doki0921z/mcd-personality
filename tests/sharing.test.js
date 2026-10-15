import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profiles} from '../data.js';
import {resultURL,cardURL,thumbnailURL,sharedProfile,makeShareFile,canShareImage} from '../sharing.js';
const base='https://doki0921z.github.io/mcd-personality/';
test('all result and image links preserve the GitHub Pages project path',()=>{
  for(const p of profiles){assert.equal(resultURL(base,p.id),`${base}share/${p.id}.html`);assert.equal(cardURL(base,p.id),`${base}assets/cards/${p.id}.png?v=20261015-nine1`);assert.equal(sharedProfile(resultURL(base,p.id)).id,p.id);assert.equal(sharedProfile(`${base}?r=${p.id}`).id,p.id);}
  assert.equal(sharedProfile(`${base}share/invalid.html`),undefined);
  assert.throws(()=>resultURL(base,'../../bad'));
  assert.equal(thumbnailURL(base),`${base}assets/share-icons/home-v1.png`);
  assert.throws(()=>thumbnailURL(base,'../../bad'));
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
test('every shared result has a square preview, a visible image, and a separate full-size PNG',()=>{
  for(const p of profiles){
    const page=readFileSync(new URL(`../share/${p.id}.html`,import.meta.url),'utf8');
    assert.match(page,/<base href="\.\.\/">/);
    for(const name of ['og:title','og:description','og:url','og:image'])assert.equal((page.match(new RegExp(`property="${name}"`,'g'))||[]).length,1);
    assert.ok(page.includes(resultURL(base,p.id)));assert.ok(page.includes(thumbnailURL(base,p.id)));
    assert.match(page,/<meta property="og:image:width" content="320">/);
    assert.match(page,/<meta property="og:image:height" content="320">/);
    assert.match(page,/<meta property="og:image:type" content="image\/png">/);
    assert.match(page,/<meta name="twitter:image" content="https:[^"]+share-icons\/[a-z]+-v\d+\.png">/);
    const firstImage=page.match(/<img\b[^>]*>/)?.[0];
    assert.ok(firstImage?.includes('id="brand-image"'));
    const thumbnailFile=new URL(thumbnailURL(base,p.id)).pathname.split('/').pop();
    assert.ok(firstImage.includes(`assets/share-icons/${thumbnailFile}`));
    assert.doesNotMatch(firstImage,/\bhidden\b|loading="lazy"/);
    assert.ok(page.includes('id="open-poster"'));assert.ok(page.includes('id="share-feedback"'));
    const png=readFileSync(new URL(`../assets/cards/${p.id}.png`,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);
    const thumbnail=readFileSync(new URL(`../assets/share-icons/${thumbnailFile}`,import.meta.url));
    assert.equal(thumbnail.subarray(1,4).toString(),'PNG');assert.equal(thumbnail.readUInt32BE(16),320);assert.equal(thumbnail.readUInt32BE(20),320);
  }
});

test('the homepage exposes the default square image before JavaScript runs',()=>{
  const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const firstImage=page.match(/<img\b[^>]*>/)?.[0];
  assert.ok(firstImage?.includes('assets/share-icons/home-v1.png'));
  for(const name of ['og:image','og:image:type','og:image:width','og:image:height','og:image:alt'])assert.equal((page.match(new RegExp(`property="${name}"`,'g'))||[]).length,1);
  assert.match(page,/<meta name="twitter:image" content="https:[^"]+share-icons\/home-v1\.png">/);
  const thumbnail=readFileSync(new URL('../assets/share-icons/home-v1.png',import.meta.url));
  assert.equal(thumbnail.readUInt32BE(16),320);assert.equal(thumbnail.readUInt32BE(20),320);
});
