import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStockSnapshot,selectStockRange,buildStockChart} from '../stock-chart.js';

const points=dates=>dates.map((date,index)=>({date,close:300+index}));
const snapshot=overrides=>({
  schemaVersion:1,
  symbol:'NYSE:MCD',
  currency:'USD',
  source:'腾讯财经',
  sourceURL:'https://gu.qq.com/usMCD.N',
  syncedAt:'2026-10-17T03:00:00Z',
  priceType:'qfq',
  points:[{date:'2026-10-15',close:302.54},{date:'2026-10-16',close:306.12}],
  ...overrides,
});
const near=(actual,expected)=>assert.ok(
  Number.isFinite(actual)&&Math.abs(actual-expected)<0.02,
  `expected ${actual} to be within 0.02 of ${expected}`,
);

test('stock validation accepts a correctly identified USD adjusted-price snapshot',()=>{
  const data=snapshot();
  assert.deepEqual(validateStockSnapshot(data),data);
});

test('stock validation refuses another security, currency or price basis',()=>{
  for(const overrides of [
    {symbol:'NASDAQ:MCD'},{symbol:'NYSE:OTHER'},{symbol:'MCD'},
    {currency:'CNY'},{currency:'usd'},{priceType:'unadjusted'},{schemaVersion:2},
  ]){
    assert.throws(()=>validateStockSnapshot(snapshot(overrides)),JSON.stringify(overrides));
  }
});

test('stock validation rejects missing data and requires at least two observations',()=>{
  for(const data of [null,[],{},snapshot({points:null}),snapshot({points:[]}),
    snapshot({points:[{date:'2026-10-16',close:306.12}]})]){
    assert.throws(()=>validateStockSnapshot(data));
  }
});

test('stock validation rejects unordered and duplicate trading dates',()=>{
  for(const observations of [
    [{date:'2026-10-16',close:306},{date:'2026-10-15',close:302}],
    [{date:'2026-10-15',close:302},{date:'2026-10-15',close:302}],
    [{date:'2026-10-15',close:302},{date:'2026-10-15',close:303}],
  ]){
    assert.throws(()=>validateStockSnapshot(snapshot({points:observations})));
  }
});

test('stock validation checks real ISO calendar dates rather than Date rollover',()=>{
  for(const date of [
    'not-a-date','2026-1-02','2026-10-14 ','2026-10-14T00:00:00Z',
    '2026-02-30','2025-02-29','2026-13-01','2026-01-00',
  ]){
    assert.throws(()=>validateStockSnapshot(snapshot({
      points:[{date,close:300},{date:'2026-10-16',close:306}],
    })),date);
  }
  assert.doesNotThrow(()=>validateStockSnapshot(snapshot({
    points:[{date:'2024-02-29',close:300},{date:'2024-03-01',close:306}],
  })));
});

test('stock validation accepts only positive finite numeric closing prices',()=>{
  for(const close of [0,-1,NaN,Infinity,-Infinity,'300',null,undefined]){
    assert.throws(()=>validateStockSnapshot(snapshot({
      points:[{date:'2026-10-15',close},{date:'2026-10-16',close:306}],
    })),`invalid close: ${String(close)}`);
  }
});

const rangeCases=[
  {label:'non-leap February month-end clamp',months:1,
    dates:['2025-02-27','2025-02-28','2025-03-03','2025-03-31']},
  {label:'leap February includes February 29',months:1,
    dates:['2024-02-28','2024-02-29','2024-03-01','2024-03-29']},
  {label:'leap-day anchor clamps into the previous non-leap year',months:12,
    dates:['2023-02-27','2023-02-28','2024-02-28','2024-02-29']},
  {label:'January crosses into the previous December',months:1,
    dates:['2024-12-30','2024-12-31','2025-01-02','2025-01-31']},
];

test('stock ranges use the last observation and include the UTC month boundary',()=>{
  for(const {label,months,dates} of rangeCases){
    const observations=points(dates),before=structuredClone(observations);
    const selected=selectStockRange(observations,months);
    assert.deepEqual(selected.map(point=>point.date),dates.slice(1),label);
    assert.notStrictEqual(selected,observations,'range selection must return a new array');
    assert.deepEqual(observations,before,'range selection must preserve source observations');
  }
});

test('stock month boundaries stay identical across timezones and DST offsets',()=>{
  const previous=process.env.TZ;
  try{
    for(const timezone of ['UTC','America/Los_Angeles','Asia/Shanghai','Pacific/Kiritimati']){
      process.env.TZ=timezone;
      for(const {label,months,dates} of rangeCases){
        assert.deepEqual(
          selectStockRange(points(dates),months).map(point=>point.date),
          dates.slice(1),
          `${timezone}: ${label}`,
        );
      }
    }
  }finally{
    if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;
  }
});

test('stock SVG coordinates preserve dates and prices with the specified plot bounds',()=>{
  const observations=[
    {date:'2026-10-12',close:100},
    {date:'2026-10-13',close:150},
    {date:'2026-10-14',close:200},
  ];
  const before=structuredClone(observations);
  const chart=buildStockChart(observations);
  assert.equal(chart.coordinates.length,observations.length);
  assert.ok(Number.isFinite(chart.min)&&Number.isFinite(chart.max));
  near(chart.min,92);
  near(chart.max,208);
  chart.coordinates.forEach((coordinate,index)=>{
    assert.equal(coordinate.date,observations[index].date);
    assert.equal(coordinate.close,observations[index].close);
    assert.ok(Number.isFinite(coordinate.x)&&coordinate.x>=56&&coordinate.x<=704);
    assert.ok(Number.isFinite(coordinate.y)&&coordinate.y>=16&&coordinate.y<=278);
    if(index){
      assert.ok(coordinate.x>chart.coordinates[index-1].x);
      assert.ok(coordinate.y<chart.coordinates[index-1].y,'a rising price must move upward');
    }
  });
  near(chart.coordinates[0].x,56);
  near(chart.coordinates[1].x,380);
  near(chart.coordinates[2].x,704);
  // The 100-dollar price span receives 8 dollars of padding on each side.
  near(chart.coordinates[0].y,278-(8/116)*262);
  near(chart.coordinates[1].y,147);
  near(chart.coordinates[2].y,16+(8/116)*262);
  for(const path of [chart.line,chart.area]){
    assert.equal(typeof path,'string');
    assert.match(path,/^M/);
    assert.doesNotMatch(path,/NaN|Infinity|undefined/);
  }
  assert.notEqual(chart.line,chart.area);
  assert.deepEqual(observations,before,'chart geometry must preserve source observations');
});

test('flat price series stays finite and centered without dividing by zero',()=>{
  const chart=buildStockChart([
    {date:'2026-10-15',close:300},
    {date:'2026-10-16',close:300},
  ]);
  assert.equal(chart.coordinates.length,2);
  assert.ok(Number.isFinite(chart.min)&&Number.isFinite(chart.max));
  assert.ok(chart.min<=299&&chart.max>=301,'flat prices need at least one dollar of padding on each side');
  for(const point of chart.coordinates){
    assert.ok(Number.isFinite(point.x)&&point.x>=56&&point.x<=704);
    near(point.y,147);
  }
  near(chart.coordinates[0].x,56);
  near(chart.coordinates[1].x,704);
  assert.doesNotMatch(chart.line+chart.area,/NaN|Infinity|undefined/);
});
