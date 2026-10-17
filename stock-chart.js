const chartURL='https://www.tradingview.com/symbols/NYSE-MCD/';
const widgetScript='https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';

export function mountStockChart(host){
  host.className='stock-card';
  host.setAttribute('aria-labelledby','stock-title');
  host.innerHTML=`<div class="stock-heading"><div><span class="stock-kicker">A LITTLE HAPPY MARKET</span><h2 id="stock-title">麦当劳股价小站</h2><p>NYSE · MCD <span>美元 / USD</span></p></div><span class="stock-badge" aria-hidden="true">↗</span></div><div class="stock-widget-slot"></div><div class="stock-tools"><a href="${chartURL}" target="_blank" rel="noopener noreferrer">查看完整行情 ↗</a><button class="text-button" type="button">重新加载 ↻</button></div><p class="stock-status" role="status" aria-live="polite"></p><p class="stock-note">行情由 TradingView 提供，可能延迟，以图表标示为准。</p>`;
  const slot=host.querySelector('.stock-widget-slot');
  const status=host.querySelector('.stock-status');
  const retry=host.querySelector('button');
  let stopWidget=()=>{};

  function load(){
    stopWidget();
    status.textContent='正在加载麦当劳股价…';
    const container=document.createElement('div');
    container.className='tradingview-widget-container';
    container.innerHTML=`<div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="${chartURL}" target="_blank" rel="noopener nofollow">MCD 股价</a><span> by TradingView</span></div>`;
    slot.replaceChildren(container);
    let frame;
    // A frame load is not proof that quotes arrived; keep the fallback link visible.
    const observer=new MutationObserver(()=>{
      const next=container.querySelector('iframe');
      if(!next||next===frame)return;
      frame=next;
      frame.title='TradingView 麦当劳（NYSE：MCD）股价走势图';
      frame.addEventListener('load',onFrameLoad);
    });
    function onFrameLoad(){
      clearTimeout(timer);
      status.textContent='图表由 TradingView 加载；若无法显示，请重试或查看完整行情。';
    }
    observer.observe(container,{childList:true,subtree:true});
    const timer=setTimeout(()=>{
      status.textContent='图表若未显示，可能是行情服务连接较慢。请重试或查看完整行情。';
    },15000);
    const script=document.createElement('script');
    script.src=widgetScript;
    script.async=true;
    script.textContent=JSON.stringify({
      symbols:[['麦当劳','NYSE:MCD|1D']],
      chartOnly:false,chartType:'area',lineWidth:2,
      colorTheme:'light',backgroundColor:'#fffdf5',isTransparent:false,
      locale:'zh_CN',autosize:true,width:'100%',height:'100%',
      dateRanges:['1d|1','1m|30','3m|60','12m|1D','60m|1W','all|1M'],
      hideDateRanges:false,hideMarketStatus:false,hideSymbolLogo:false,
      scalePosition:'right',scaleMode:'Normal',valuesTracking:'1',
      changeMode:'price-and-percent',fontSize:'12',headerFontSize:'medium'
    });
    script.onerror=()=>{
      clearTimeout(timer);
      status.textContent='暂时无法连接行情服务。请重试，或点击「查看完整行情」。';
    };
    stopWidget=()=>{
      clearTimeout(timer);
      observer.disconnect();
      frame?.removeEventListener('load',onFrameLoad);
      script.onerror=null;
      container.remove();
    };
    container.append(script);
  }
  retry.addEventListener('click',load);
  load();
  return ()=>{stopWidget();retry.removeEventListener('click',load);};
}
