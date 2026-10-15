import {spriteSVG} from './art.js?v=20261015-nine1';

let snapshotPromise;
const chinaDate = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function selectCalendarDay(days,today){
  const sorted=days.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)).sort((a,b)=>a.date.localeCompare(b.date));
  return sorted.find(day=>day.date>=today)||sorted.at(-1);
}

function element(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}

function readSnapshot(){
  return snapshotPromise??=fetch(new URL('./assets/mcd-public-data.json',import.meta.url),{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw new Error('data unavailable');return response.json();})
    .then(data=>{if(data.schemaVersion!==1||!data.nutrition||!Array.isArray(data.calendar?.days))throw new Error('invalid data');return data;})
    .catch(error=>{snapshotPromise=null;throw error;});
}

function nutritionCard(food,profile){
  const card=element('article','mcd-nutrition');
  const heading=element('div','mcd-card-heading');
  const art=element('span','mcd-mini-art');
  art.innerHTML=spriteSVG(profile.id);
  const copy=element('div');
  copy.append(element('span','mcd-kicker','你的快乐，也有营养成分'),element('h3','',food.productName));
  heading.append(art,copy);
  const serving=element('p','mcd-serving',`以下为 ${food.serving} 的参考营养值`);
  const stats=element('dl','mcd-nutrition-grid');
  for(const [key,label,unit] of [['energyKcal','能量','千卡'],['protein','蛋白质','克'],['fat','脂肪','克'],['carbohydrate','碳水化合物','克'],['sodium','钠','毫克'],['calcium','钙','毫克']]){
    const stat=element('div',key==='energyKcal'?'mcd-stat mcd-stat-energy':'mcd-stat');
    const value=Number.isFinite(food[key])?String(food[key]):'—';
    const dd=element('dd');dd.append(element('strong','',value),element('span','',unit));
    stat.append(element('dt','',label),dd);stats.append(stat);
  }
  card.append(heading,serving,stats,element('p','mcd-small-note','实际餐品可能因份量和制作方式有所差异。'));
  return card;
}

function eventCard(event){
  const detail=element('details','mcd-event');
  const summary=element('summary','',event.title||'麦麦活动');
  detail.append(summary);
  if(event.subtitle)detail.append(element('p','mcd-event-subtitle',event.subtitle));
  if(event.content)detail.append(element('p','mcd-event-content',event.content));
  if(!event.subtitle&&!event.content)detail.append(element('p','mcd-event-content','更多活动细节请查看麦当劳官方渠道。'));
  return detail;
}

function calendarCard(calendar,today){
  const card=element('article','mcd-calendar');
  const pastMonth=calendar.month<today.slice(0,7);
  card.append(element('span','mcd-kicker','把快乐排进日历'),element('h3','',pastMonth?'麦麦活动回顾':'麦麦活动日历'));
  const days=[...calendar.days].sort((a,b)=>a.date.localeCompare(b.date));
  const selected=selectCalendarDay(days,today);
  if(!selected){card.append(element('p','mcd-small-note','这次没有同步到活动，晚点再来看看吧。'));return card;}
  const label=element('label','mcd-date-label','挑一天，看看有什么快乐');
  label.htmlFor='mcd-calendar-date';
  const select=element('select','mcd-date-select');select.id='mcd-calendar-date';
  for(const day of days){
    const [,month,date]=day.date.split('-');
    const suffix=day.date===today?' · 今天':day.date<today?' · 回顾':'';
    const option=element('option','',`${Number(month)}月${Number(date)}日${suffix}（${day.events.length}项）`);
    option.value=day.date;option.selected=day.date===selected.date;select.append(option);
  }
  const list=element('div','mcd-event-list');
  function showDay(){
    const day=days.find(item=>item.date===select.value);
    list.replaceChildren();
    for(const event of day.events.slice(0,3))list.append(eventCard(event));
    if(day.events.length>3){
      const more=element('details','mcd-more-events');
      more.append(element('summary','',`还有 ${day.events.length-3} 项快乐，展开看看 ↓`));
      for(const event of day.events.slice(3))more.append(eventCard(event));
      list.append(more);
    }
  }
  select.addEventListener('change',showDay);showDay();
  card.append(label,select,list,element('p','mcd-small-note',pastMonth?'这是已同步的往期记录。':'日期为官方日历展示日期，活动时间与规则以官方为准。'));
  return card;
}

export async function mountMcdInfo(host,profile){
  host.className='mcd-extras';
  host.setAttribute('aria-label','麦当劳餐品营养与活动日历');
  host.append(element('p','mcd-loading','正在取出你的快乐加餐…'));
  try{
    const data=await readSnapshot();
    if(!host.isConnected)return;
    const food=data.nutrition[profile.id];
    if(!food)throw new Error('nutrition unavailable');
    host.replaceChildren();
    const heading=element('div','mcd-extras-heading');
    const title=element('div');title.append(element('span','mcd-kicker','HAPPINESS, WITH A LITTLE EXTRA'),element('h2','','快乐加餐站'));
    const source=element('a','mcd-source','数据来自麦当劳 ↗');
    source.href='https://open.mcd.cn/mcp';source.target='_blank';source.rel='noopener noreferrer';
    heading.append(title,source);
    const grid=element('div','mcd-extras-grid');
    grid.append(nutritionCard(food,profile),calendarCard(data.calendar,chinaDate()));
    const time=new Date(data.syncedAt);
    const synced=Number.isNaN(time.getTime())?'':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(time);
    host.append(heading,grid,element('p','mcd-sync-note',`资料更新于 ${synced||'最近一次同步'} · 活动信息为同步时的记录`));
  }catch{
    if(host.isConnected)host.replaceChildren(element('p','mcd-small-note','加餐资料暂时没取出来，不影响你的快乐人格卡。'));
  }
}
