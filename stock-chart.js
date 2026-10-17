const sourceURL='https://gu.qq.com/usMCD.N';
let snapshotPromise;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export function validateStockSnapshot(data){
  if(data?.schemaVersion!==1||data.symbol!=='NYSE:MCD'||data.currency!=='USD'||data.priceType!=='qfq'||
    !Array.isArray(data.points)||data.points.length<2||data.points.length>400)
    throw new Error('Invalid stock snapshot');
  let previous='';
  for(const point of data.points){
    if(!validDate(point.date)||point.date<=previous||!Number.isFinite(point.close)||point.close<=0)
      throw new Error('Invalid stock price');
    previous=point.date;
  }
  return data;
}

export function selectStockRange(points,months){
  const last=new Date(`${points.at(-1).date}T00:00:00Z`);
  const cutoff=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()-months,1));
  const monthEnd=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();
  cutoff.setUTCDate(Math.min(last.getUTCDate(),monthEnd));
  const start=cutoff.toISOString().slice(0,10);
  return points.filter(point=>point.date>=start);
}

export function buildStockChart(points){
  const values=points.map(point=>point.close);
  const low=Math.min(...values),high=Math.max(...values);
  const padding=high===low?Math.max(1,high*.01):(high-low)*.08;
  const min=low-padding,max=high+padding;
  const coordinates=points.map((point,index)=>({...point,
    x:56+index/Math.max(1,points.length-1)*648,
    y:278-(point.close-min)/(max-min)*262
  }));
  const line=coordinates.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const area=`${line} L${coordinates.at(-1).x.toFixed(2)},278 L56,278 Z`;
  return {line,area,coordinates,min,max};
}

function readSnapshot(){
  // Prices travel with the site: visitors never contact a quote API or overseas widget.
  return snapshotPromise??=fetch(new URL('./assets/mcd-stock-data.json?v=20261017-cn1',import.meta.url),{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw new Error('Snapshot unavailable');return response.json();})
    .then(validateStockSnapshot)
    .catch(error=>{snapshotPromise=null;throw error;});
}

const money=value=>value.toFixed(2);
const signed=value=>`${value>=0?'+':'−'}${Math.abs(value).toFixed(2)}`;
const change=(first,last)=>(last-first)/first*100;

export function mountStockChart(host){
  let stopped=false,removeListeners=()=>{};
  host.className='stock-card';
  host.setAttribute('aria-labelledby','stock-title');
  host.innerHTML=`<div class="stock-heading"><div><span class="stock-kicker">A LITTLE HAPPY MARKET</span><h2 id="stock-title">麦当劳股价小站</h2><p>NYSE · MCD <span>美元 / USD</span></p></div><span class="stock-badge" aria-hidden="true">↗</span></div><div class="stock-content"><p class="stock-status" role="status">正在打开股价小站…</p></div>`;
  const content=host.querySelector('.stock-content');

  async function load(){
    try{
      const data=await readSnapshot();
      if(stopped||!host.isConnected)return;
      removeListeners();
      const last=data.points.at(-1),previous=data.points.at(-2);
      const dayChange=last.close-previous.close;
      content.innerHTML=`<div class="stock-summary"><div><span class="stock-caption">最近收盘 · <span class="stock-asof"></span>（美东）</span><strong class="stock-price">${money(last.close)}<small>USD</small></strong></div><span class="stock-day-change ${dayChange>=0?'is-up':'is-down'}">${signed(dayChange)} (${signed(change(previous.close,last.close))}%)<small>较前一交易日</small></span></div><div class="stock-ranges" role="group" aria-label="选择股价时间范围">${[[1,'1个月'],[3,'3个月'],[6,'6个月'],[12,'1年']].map(([months,label])=>`<button type="button" data-months="${months}" aria-pressed="${months===3}">${label}</button>`).join('')}</div><div class="stock-plot"><div class="stock-y-labels" aria-hidden="true"></div><svg class="stock-svg" viewBox="0 0 720 320" preserveAspectRatio="none" role="img"><defs><linearGradient id="stock-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e95141" stop-opacity=".22"/><stop offset="100%" stop-color="#e95141" stop-opacity=".02"/></linearGradient></defs><g class="stock-grid"></g><path class="stock-area" fill="url(#stock-fill)"/><path class="stock-line" fill="none"/><line class="stock-cursor" y1="16" y2="278"/><circle class="stock-dot" r="4"/></svg><div class="stock-x-labels" aria-hidden="true"></div></div><div class="stock-inspect"><output class="stock-point"></output><label class="stock-slider-label">拖动查看每日收盘价<input class="stock-slider" type="range" min="0" step="1" aria-label="查看每日收盘价"></label></div><p class="stock-period"></p><div class="stock-tools"><a href="${sourceURL}" target="_blank" rel="noopener noreferrer">数据来源：腾讯财经 ↗</a><span>前复权日线 · 非实时</span></div><p class="stock-note"></p>`;
      content.querySelector('.stock-asof').textContent=last.date;
      const buttons=[...content.querySelectorAll('[data-months]')];
      const svg=content.querySelector('svg'),slider=content.querySelector('input');
      let points,model;

      function inspect(index){
        const point=model.coordinates[index];
        slider.value=String(index);
        slider.setAttribute('aria-valuetext',`${point.date}，${money(point.close)}美元`);
        content.querySelector('.stock-point').textContent=`${point.date} · $${money(point.close)}`;
        const cursor=svg.querySelector('.stock-cursor'),dot=svg.querySelector('.stock-dot');
        cursor.setAttribute('x1',point.x);cursor.setAttribute('x2',point.x);
        dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);
      }
      function draw(months){
        points=selectStockRange(data.points,months);
        model=buildStockChart(points);
        svg.setAttribute('aria-label',`麦当劳近${months}个月股价走势，${points[0].date}至${last.date}，最新收盘${money(last.close)}美元`);
        svg.querySelector('.stock-line').setAttribute('d',model.line);
        svg.querySelector('.stock-area').setAttribute('d',model.area);
        const ticks=[model.max,(model.max+model.min)/2,model.min];
        content.querySelector('.stock-y-labels').innerHTML=ticks.map((value,index)=>`<span style="top:${(16+index*131)/320*100}%">${money(value)}</span>`).join('');
        svg.querySelector('.stock-grid').innerHTML=[16,147,278].map(y=>`<line x1="56" x2="704" y1="${y}" y2="${y}"/>`).join('');
        content.querySelector('.stock-x-labels').innerHTML=[points[0],points[Math.floor((points.length-1)/2)],last].map(point=>`<span>${point.date.slice(5).replace('-','/')}</span>`).join('');
        slider.max=String(points.length-1);
        inspect(points.length-1);
        const delta=change(points[0].close,last.close);
        content.querySelector('.stock-period').textContent=`${points[0].date} — ${last.date} · 区间涨跌 ${signed(delta)}%`;
        for(const button of buttons)button.setAttribute('aria-pressed',String(Number(button.dataset.months)===months));
      }
      const onRange=event=>{const button=event.target.closest('[data-months]');if(button)draw(Number(button.dataset.months));};
      const onSlide=()=>inspect(Number(slider.value));
      const onPoint=event=>{
        const rect=svg.getBoundingClientRect();
        const x=(event.clientX-rect.left)/rect.width*720;
        inspect(Math.max(0,Math.min(points.length-1,Math.round((x-56)/648*(points.length-1)))));
      };
      const ranges=content.querySelector('.stock-ranges');
      ranges.addEventListener('click',onRange);slider.addEventListener('input',onSlide);
      svg.addEventListener('pointermove',onPoint);svg.addEventListener('pointerdown',onPoint);
      removeListeners=()=>{ranges.removeEventListener('click',onRange);slider.removeEventListener('input',onSlide);svg.removeEventListener('pointermove',onPoint);svg.removeEventListener('pointerdown',onPoint);};
      const synced=typeof data.syncedAt==='string'?data.syncedAt.slice(0,10):last.date;
      content.querySelector('.stock-note').textContent=`本站同步于 ${synced}。展示最近交易日的历史收盘数据，休市期间日期不变。`;
      // An explicit date keeps a retained snapshot honest when an upstream refresh fails.
      const age=(Date.now()-Date.parse(`${last.date}T00:00:00Z`))/86400000;
      if(age>7)content.querySelector('.stock-note').textContent+=' 数据更新较慢，请以来源页面为准。';
      draw(3);
    }catch{
      if(stopped||!host.isConnected)return;
      content.innerHTML=`<p class="stock-status" role="status">股价数据暂时没有加载出来。</p><div class="stock-tools"><button class="text-button" type="button">重新加载 ↻</button><a href="${sourceURL}" target="_blank" rel="noopener noreferrer">查看腾讯财经行情 ↗</a></div>`;
      content.querySelector('button').addEventListener('click',load,{once:true});
    }
  }
  load();
  return ()=>{stopped=true;removeListeners();};
}
