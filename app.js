import {profiles,questions,calculateResult,getProfile,traitLabels} from './data.js';
import {spriteSVG} from './art.js';
import {mountMcdInfo} from './mcd-info.js?v=20261015-mcp1';
import {isWeChat,resultURL,cardURL,thumbnailURL,sharedProfile,makeShareFile,canShareImage} from './sharing.js?v=20261015-shareicon1';

const app=document.querySelector('#app'),dialog=document.querySelector('#share-dialog');
const canonical=new URL('./',document.baseURI).href;
const baseElement=document.querySelector('base');
if(baseElement)baseElement.href=canonical;
const defaultTitle='麦麦人格研究所 · 你是哪一款快乐？';
const defaultDescription='叮！你的快乐订单已送达。回答5个小问题，找到你的麦当劳人格，领取专属像素快乐卡。';
const wechat=isWeChat(navigator.userAgent);
document.querySelector('.brand').href=canonical;
let answers=[],step=0,current=null,friendResult=false,audioContext=null,posterFile=null,posterURL=null,toastTimer,shareAttempt=0;
let sound=true;
try{sound=localStorage.getItem('mcd-sound')!=='off';}catch{}
const $=s=>document.querySelector(s);
function syncSound(){ $('#sound-toggle').setAttribute('aria-pressed',String(sound));$('#sound-toggle').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('#sound-icon').textContent=sound?'♫':'♪';$('#sound-label').textContent=sound?'音效开':'音效关';}
function beep(kind='tap'){
  if(!sound)return;
  try{
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const notes=kind==='win'?[523,659,784,1047]:kind==='next'?[523,784]:kind==='back'?[440,330]:[660];
    notes.forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.095;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.028,t+.006);g.gain.exponentialRampToValueAtTime(.001,t+.09);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.1);});
  }catch{/* Audio is an enhancement; the quiz remains usable in silent browsers. */}
}
$('#sound-toggle').addEventListener('click',()=>{sound=!sound;try{localStorage.setItem('mcd-sound',sound?'on':'off');}catch{}syncSound();beep();});syncSound();
function toast(text){clearTimeout(toastTimer);if(dialog.open){$('#share-feedback').textContent=text;$('#share-feedback').hidden=false;return;}$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function focusScreen(){app.querySelector('h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function syncShareMetadata(profile){
  const title=profile?`我是${profile.name}｜麦麦人格研究所`:defaultTitle;
  const description=profile?`${profile.role}：${profile.quote} 5 道题，测测你是哪一款麦麦快乐。`:defaultDescription;
  const image=thumbnailURL(canonical,profile?.id),alt=profile?`${profile.name}像素人格图标`:'麦麦人格研究所像素薯条图标';
  const url=profile?resultURL(canonical,profile.id):canonical;
  document.title=title;
  for(const [key,value] of Object.entries({'description':description,'og:title':title,'og:description':description,'og:url':url,'og:image':image,'og:image:type':'image/png','og:image:width':'320','og:image:height':'320','og:image:alt':alt,'twitter:title':title,'twitter:description':description,'twitter:image':image,'twitter:image:alt':alt})){
    const attribute=key.startsWith('og:')?'property':'name';
    const meta=document.querySelector(`meta[${attribute}="${key}"]`);
    if(meta)meta.content=value;
  }
  // Ordinary PNGs also remain available to crawlers that do not render SVG/CSS.
  $('#brand-image').src=image;$('#brand-image').alt=alt;$('#site-icon').href=image;
}
function clearSharedURL(){history.replaceState(null,'',new URL(canonical).pathname);syncShareMetadata();}
function start(){answers=[];step=0;friendResult=false;current=null;clearSharedURL();beep('next');renderQuestion();}

function renderHome(){
  syncShareMetadata();
  app.innerHTML=`<section class="hero screen-enter"><div class="hero-copy"><div class="small-label"><span class="label-dot"></span>今日营业中 · 快乐不限量</div><h1 tabindex="-1">你是哪一款<br><em>麦麦快乐？</em></h1><p class="hero-description">有人像薯条，走到哪里都热热闹闹。<br>有人像香芋派，把温柔藏在心里。<br><strong>你的灵魂，是什么口味？</strong></p><button type="button" class="button primary start-button" id="start">领取我的快乐人格 <span class="button-arrow" aria-hidden="true">→</span></button><div class="hero-meta"><span>✦ 5 道小问题</span><b>·</b><span>约 1 分钟</span><b>·</b><span>8 款快乐人格</span></div></div><div class="hero-stage"><div class="order-sticker">你的快乐<br><b>已出炉</b></div><div class="arcade"><div class="window-bar"><i></i><i></i><i></i><span>HAPPINESS.EXE</span><b aria-hidden="true">×</b></div><div class="arcade-screen"><div class="screen-message">SELECT YOUR HAPPY SELF</div><div class="spark s1" aria-hidden="true">✦</div><div class="spark s2" aria-hidden="true">+</div><div class="spark s3" aria-hidden="true">✧</div><div class="sprite-float left">${spriteSVG('bigmac')}</div><div class="sprite-float main">${spriteSVG('fries')}</div><div class="sprite-float right">${spriteSVG('mcflurry')}</div><div class="speech">今天也要开心鸭！</div></div><div class="arcade-bottom"><span><span class="mini-heart">♥ ♥ ♥</span> FULL OF JOY</span><span>PRESS START ▶</span></div></div><p class="stage-caption">每一种你，都有专属的可爱。</p></div></section><section class="collection" aria-labelledby="collection-title"><div class="section-header"><h2 id="collection-title"><span aria-hidden="true">✦</span> 快乐图鉴，等待认领</h2><p>8 种口味 · 你会是哪一款？</p></div><div class="product-lineup">${profiles.map((p,i)=>`<div class="product-mini">${spriteSVG(p.id)}<span>${p.name}</span><small>NO. 00${i+1}</small></div>`).join('')}</div><p class="bottom-note">不用成为别人，你本来就很有滋味。</p></section>`;
  $('#start').addEventListener('click',start);
}
function renderQuestion(){
  const q=questions[step],selected=answers[step];
  app.innerHTML=`<section class="quiz-wrap screen-enter"><div class="quiz-top"><button class="text-button" id="back" type="button">← ${step===0?'返回首页':'上一题'}</button><span class="progress-count">0${step+1} <span>/ 05</span></span></div><div class="progress-track" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${step}"><div class="progress-fill" style="width:${step/5*100}%"></div></div><div class="progress-markers" aria-hidden="true"><span>START</span><span>YOUR HAPPY SELF →</span></div><div class="question-card"><div class="question-card-top"><span>HAPPINESS CHECK · 快乐采样中</span><div class="question-stars" aria-hidden="true">${'♥ '.repeat(step+1)}${'♡ '.repeat(4-step)}</div></div><div class="question-content"><div class="question-scene"><span class="question-number">QUESTION 0${step+1}</span>${spriteSVG(q.scene)}</div><h1 tabindex="-1">${q.title}</h1><p class="question-hint">${q.hint}</p><div class="options" role="group" aria-label="选择最像你的答案">${q.options.map((o,i)=>`<button class="option ${selected===i?'selected':''}" type="button" aria-pressed="${selected===i}" data-answer="${i}"><span class="option-letter" aria-hidden="true">${'ABCD'[i]}</span><span><span class="option-text">${o.text}</span><span class="option-sub">${o.sub}</span></span><span class="option-check" aria-hidden="true">${selected===i?'✓':''}</span></button>`).join('')}</div><div class="quiz-bottom"><span class="quiz-tip" id="selection-hint" aria-live="polite">${selected===undefined?'跟着第一直觉选就好':'选好啦，继续下一站！'}</span><button type="button" class="button primary" id="next" ${selected===undefined?'disabled':''}>${step===4?'揭晓我的人格':'下一题'} <span aria-hidden="true">→</span></button></div></div></div><p class="step-help">没有正确答案，只有刚刚好的你。</p></section>`;
  app.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{
    answers[step]=Number(b.dataset.answer);beep();
    app.querySelectorAll('[data-answer]').forEach(other=>{const active=other===b;other.classList.toggle('selected',active);other.setAttribute('aria-pressed',String(active));other.querySelector('.option-check').textContent=active?'✓':'';});
    $('#next').disabled=false;$('#selection-hint').textContent='选好啦，继续下一站！';
  }));
  $('#back').addEventListener('click',()=>{beep('back');if(step===0){renderHome();focusScreen();}else{step--;renderQuestion();}});
  $('#next').addEventListener('click',()=>{if(answers[step]===undefined)return;beep('next');if(step<4){step++;renderQuestion();}else{current=calculateResult(answers);renderMix();}});
  focusScreen();
}
function renderMix(){
  app.innerHTML=`<section class="mix-screen"><span class="eyebrow">COOKING YOUR HAPPINESS</span>${spriteSVG('fries')}<h1 tabindex="-1">你的快乐，正在出炉</h1><p>认真搅拌你的可爱、温柔和一点点奇奇怪怪…</p><div class="mix-dots" aria-hidden="true">▪ ▪ ▪</div></section>`;
  focusScreen();setTimeout(()=>{renderResult();beep('win');confetti();},1000);
}
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(let i=0;i<22;i++){const p=document.createElement('i');p.className='confetti';p.style.left=`${i*4.8}%`;p.style.background=['#e95141','#ffd45c','#a4bfa4','#bb9bc1'][i%4];p.style.animationDelay=`${(i%5)*.07}s`;p.style.setProperty('--drift',`${(i%2?1:-1)*(25+i*3)}px`);document.body.append(p);setTimeout(()=>p.remove(),3000);}
}
function renderResult(){
  const p=current.profile,buddy=getProfile(p.buddy),no=profiles.indexOf(p)+1;
  // The URL is a real, crawlable result document, including on refresh or menu sharing.
  history.replaceState(null,'',shareLink());
  syncShareMetadata(p);
  const traitHTML=current.traits?`<h3>你的快乐配比</h3><div class="traits">${current.traits.map((value,i)=>`<div class="trait"><span>${traitLabels[i]}</span><div class="trait-track" role="img" aria-label="${traitLabels[i]} ${value}%">${Array.from({length:10},(_,j)=>`<i class="${j<Math.round(value/10)?'on':''}"></i>`).join('')}</div><small>${value}</small></div>`).join('')}</div><p class="traits-note">根据本次选择生成的趣味配比，无高低优劣之分。</p>`:'';
  app.innerHTML=`<section class="result-wrap screen-enter">${friendResult?'<div class="friend-banner">你收到了一份朋友的快乐人格卡，来看看 TA 是什么口味！</div>':''}<div class="result-intro"><span class="eyebrow red">DING! YOUR HAPPY ORDER IS READY</span><h1 tabindex="-1">${friendResult?'TA 的快乐人格是…':'叮！你的快乐订单已送达'}</h1><p>${friendResult?'相同的快乐也会有不同的故事。':'世界有很多口味，而你，是独一份的可爱。'}</p></div><div class="result-grid"><article class="result-ticket"><div class="ticket-top"><span>快乐人格认领单</span><span>NO. 00${no}</span></div><div class="result-art-wrap"><span class="spark" aria-hidden="true">✦</span>${spriteSVG(p.id)}<span class="spark" aria-hidden="true">✦</span></div><div class="result-body"><span class="eyebrow">${p.english}</span><h2>${p.name}</h2><p class="role">${p.role}</p><div class="tag-list">${p.tags.map(t=>`<span class="tag"># ${t}</span>`).join('')}</div></div><div class="ticket-perforation"></div><div class="ticket-quote"><span class="quote-mark" aria-hidden="true">“</span>${p.quote}</div><div class="ticket-order"><span>MADE WITH A LITTLE HAPPINESS</span><span>♥ 100% YOU</span></div></article><div class="result-details"><h3>你的可爱，藏在这里</h3><p class="result-description">${p.description}</p><div class="recipe-card"><strong>✧ 快乐配方</strong><p>${p.recipe}</p></div>${traitHTML}<div class="buddy">${spriteSVG(buddy.id)}<div><small>你的快乐绝配</small><p><strong>${buddy.name}</strong> · ${buddy.role}</p></div></div><div class="result-actions">${friendResult?'<button class="button primary" id="my-test" type="button">测测我的麦麦人格 →</button>':'<button class="button primary" id="share-result" type="button">打包我的快乐卡 ↗</button>'}<button class="text-button" id="restart" type="button">${friendResult?'← 返回快乐研究所':'↻ 再测一次，探索另一面的自己'}</button></div></div></div><p class="result-footnote">仅供娱乐的小测试 · 你的答案不会上传 · 快乐没有标准答案</p></section>`;
  // This bubble belongs only to the live result UI; share cards are separate PNGs.
  const authorBubble=document.createElement('a');
  authorBubble.className='author-bubble';
  authorBubble.href='https://www.xiaohongshu.com/user/profile/6012ee0e000000000100b28e';
  authorBubble.target='_blank';
  authorBubble.rel='noopener noreferrer';
  authorBubble.setAttribute('aria-label','关注作者，打开小红书主页');
  authorBubble.innerHTML='<span class="author-heart" aria-hidden="true">♥</span><span><small>发现更多快乐灵感</small><strong>关注作者 <span class="author-platform">小红书</span></strong></span><span class="author-arrow" aria-hidden="true">↗</span>';
  app.querySelector('.result-intro').append(authorBubble);
  const orderEntry=document.createElement('div');
  orderEntry.className='order-entry';
  orderEntry.innerHTML='<a class="button secondary" id="order-now" href="https://mcd.cn/" target="_blank" rel="noopener noreferrer">立刻下单 <span aria-hidden="true">↗</span></a><small>前往麦当劳官方点餐，登录后选择门店和餐品</small>';
  app.querySelector('.result-actions').insertBefore(orderEntry,$('#restart'));
  // Public MCP data is synced separately; visitor answers and account tokens stay out of it.
  const extras=document.createElement('section');
  app.querySelector('.result-grid').after(extras);
  mountMcdInfo(extras,p);
  if(friendResult)$('#my-test').addEventListener('click',start);else $('#share-result').addEventListener('click',openShare);
  $('#restart').addEventListener('click',()=>{beep();clearSharedURL();renderHome();focusScreen();});
  focusScreen();
}
function shareLink(){return resultURL(canonical,current.profile.id);}
function showPoster(url){
  const image=$('#share-image');
  return new Promise((resolve,reject)=>{image.onload=()=>{image.onload=image.onerror=null;resolve();};image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('快乐卡暂时没加载出来，请检查网络后重试。'));};image.src=url;});
}
async function openShare(){
  const attempt=++shareAttempt;
  beep();posterFile=null;posterURL=cardURL(canonical,current.profile.id);$('#share-image').hidden=true;$('#poster-status').hidden=false;$('#poster-status').textContent='正在打包你的快乐…';$('#download-poster').disabled=true;$('#native-share').hidden=true;$('#share-feedback').hidden=true;$('#share-url').hidden=true;$('#share-url').value=shareLink();$('#open-poster').href=posterURL;
  $('#download-poster').textContent=wechat?'长按上方图片保存':'↓ 保存快乐卡';
  if(!dialog.open)dialog.showModal();
  try{
    await showPoster(posterURL);if(attempt!==shareAttempt)return;
    $('#share-image').hidden=false;$('#poster-status').hidden=true;$('#download-poster').disabled=false;
  }catch(error){if(attempt===shareAttempt)$('#poster-status').textContent=error.message;return;}
  // Optional native sharing must never make a successfully loaded image look broken.
  if(wechat||typeof navigator.share!=='function')return;
  try{const response=await fetch(posterURL);if(!response.ok)return;const file=makeShareFile(await response.blob(),current.profile.id);if(attempt!==shareAttempt)return;posterFile=file;$('#native-share').hidden=!canShareImage(navigator,file);}catch{}
}
$('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
$('#download-poster').addEventListener('click',()=>{if(!posterURL)return;beep();if(wechat){toast('请长按上方图片保存，再从微信相册发送给朋友或发朋友圈。');$('#share-image').scrollIntoView({block:'center',behavior:'smooth'});return;}const a=document.createElement('a');a.href=posterURL;a.download=`我的麦麦人格-${current.profile.name}.png`;document.body.append(a);a.click();a.remove();toast('如果没有开始保存，请点「打开原图」后长按保存。');});
$('#native-share').addEventListener('click',async()=>{if(!canShareImage(navigator,posterFile))return;try{await navigator.share({files:[posterFile]});}catch(error){if(error.name!=='AbortError')toast('系统分享未完成，请保存图片后从微信相册发送。');}});
$('#copy-link').addEventListener('click',async()=>{
  beep();const url=shareLink();try{await navigator.clipboard.writeText(url);toast('结果链接已复制，去找你的快乐搭子吧！');}
  catch{const field=$('#share-url');field.hidden=false;field.focus();field.select();field.setSelectionRange(0,url.length);let ok=false;try{ok=document.execCommand('copy');}catch{}toast(ok?'结果链接已复制':'请长按下方结果链接，选择复制。');}
});

const shared=sharedProfile(location.href);
if(shared){friendResult=true;current={profile:shared};renderResult();}else renderHome();
