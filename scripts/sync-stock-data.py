#!/usr/bin/env python3
"""Refresh only MCD daily reference closes; retain the last good snapshot on failure."""
import json
import math
import os
import tempfile
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ENDPOINT='https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=usMCD.N,day,,,320,qfq'
OUTPUT=Path(__file__).resolve().parents[1]/'assets'/'mcd-stock-data.json'


def parse_prices(payload):
    if payload.get('code') != 0:
        raise ValueError('Quote source returned an error')
    stock=payload.get('data', {}).get('usMCD.N', {})
    rows=stock.get('qfqday')
    if not isinstance(rows, list) or not 200 <= len(rows) <= 400:
        raise ValueError('Incomplete daily price history')
    points=[]
    previous=''
    today=datetime.now(timezone.utc).date()
    for row in rows:
        if not isinstance(row, list) or len(row)<3:
            raise ValueError('Invalid daily price row')
        day=date.fromisoformat(row[0])
        close=float(row[2])
        if day.isoformat()!=row[0] or row[0]<=previous or day>today or not math.isfinite(close) or close<=0:
            raise ValueError('Invalid date or daily closing price')
        points.append({'date':row[0], 'close':close})
        previous=row[0]
    if (today-date.fromisoformat(points[-1]['date'])).days>10:
        raise ValueError('Quote source is stale; preserving the current snapshot')
    return points


def write_snapshot(points, output=OUTPUT):
    snapshot={'schemaVersion':1, 'symbol':'NYSE:MCD', 'currency':'USD',
              'source':'腾讯财经', 'sourceURL':'https://gu.qq.com/usMCD.N',
              'priceType':'qfq', 'points':points}
    if output.exists():
        previous=json.loads(output.read_text(encoding='utf-8'))
        if all(previous.get(key)==value for key,value in snapshot.items()):
            return False
    snapshot['syncedAt']=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    output.parent.mkdir(parents=True,exist_ok=True)
    # Replace atomically only after all rows pass validation; no raw source envelope is published.
    descriptor, temporary=tempfile.mkstemp(dir=output.parent,suffix='.tmp')
    try:
        with os.fdopen(descriptor,'w',encoding='utf-8',newline='\n') as stream:
            json.dump(snapshot,stream,ensure_ascii=False,separators=(',',':'),allow_nan=False)
            stream.write('\n')
        os.replace(temporary,output)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)
    return True


def main():
    request=urllib.request.Request(ENDPOINT,headers={'User-Agent':'Mozilla/5.0','Referer':'https://gu.qq.com/'})
    with urllib.request.urlopen(request,timeout=30) as response:
        raw=response.read(1024*1024+1)
    if len(raw)>1024*1024:
        raise ValueError('Quote source response too large')
    points=parse_prices(json.loads(raw))
    changed=write_snapshot(points)
    print(json.dumps({'updated':changed,'tradingDays':len(points),'latestDate':points[-1]['date']},ensure_ascii=False))


if __name__=='__main__':
    main()
