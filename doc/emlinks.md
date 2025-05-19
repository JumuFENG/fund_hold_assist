**ETF列表请求及字段解释**

获取ETF列表 [ETF](http://quote.eastmoney.com/center/gridlist.html#fund_etf) [LOF](http://quote.eastmoney.com/center/gridlist.html#fund_lof)

请求链接：http://99.push2.eastmoney.com/api/qt/clist/get?cb=jQuery11240026874803565680616_1692424275498&pn=1&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f22,f23,f24,f25,f62,f115,f128,f140,f141,f136,f152

https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=0.000639,1.688621&fields=f1,f2,f3,f4...

参数解释

    +cb: JSONP回调函数的名称。(optional)
    +pn: 请求页码，表示当前请求的页数。
    +pz: 每页返回的记录数。
    +po: 排序方式，1表示按照降序。
    +np: 请求的页数。
    +ut: 用户token。
    +fltt: 未知参数。
    +invt: 未知参数。
    +wbp2u: 未知参数。
    +fid: 排序的field
    +fs: 股票池的筛选条件。B(m:0+t:7,m:1+t:3) HSJ(m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048) SZ(m:0+t:6+f:!2,m:0+t:13+f:!2)
    +fields: 要获取的字段列表，这里包括了f1到f152。

字段解释

    +f1: 未知参数。
    +f2: 最新价。
    +f3: 涨跌幅。
    +f4: 涨跌额。
    +f5: 成交量（手）。
    +f6: 成交额。
    +f7: 振幅。
    +f8: 换手率。
    +f9: 动态市盈率（不适用于ETF）。
    +f10: 量比。
    +f11: 五分钟涨跌幅。
    +f12: 代码。
    +f13: 市场代码 0 深 1 沪。
    +f14: 名称。
    +f15: 最高价。
    +f16: 最低价。
    +f17: 今开价。
    +f18: 昨收价。
    +f19: 6：股票 / 1：指数
    +f20: 总市值。
    +f21: 流通市值。
    +f22: 涨速。
    +f23: 市净率（不适用于ETF）。
    +f24: 60日涨跌幅。
    +f25: 当年涨跌幅。
    +f26: 上市时间,
    +f62: 主力净流入。
    +f100: 所属行业
    +f101: 领涨股
    +f102: 地域板块
    +f103: 所属概念
    +f115: 市盈率TTM（不适用于ETF）。
    +f128: 未知参数。
    +f140: 未知参数。
    +f141: 未知参数。
    +f136: 未知参数。
    +f152: 未知参数。



**资金流向**
https://data.eastmoney.com/zjlx/detail.html
https://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=1&pz=50&pn=1&np=1&fltt=2&invt=2&ut=b2884a393a59ad64002292a3e90d46a5&fs=m:0+t:6+f:!2,m:0+t:13+f:!2,m:0+t:80+f:!2,m:1+t:2+f:!2,m:1+t:23+f:!2,m:0+t:7+f:!2,m:1+t:3+f:!2&fields=f12,f14,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f124

参数参考前一项

字段解释

    +f62: 主力净流入,
    +f64~f69: 超大单流入,流出,净流入,流入占比,流出占比,净占比,
    +f70~f75: 大单流入,流出,净流入,流入占比,流出占比,净占比,
    +f76~f81: 中单流入,流出,净流入,流入占比,流出占比,净占比,
    +f82~f87: 小单流入,流出,净流入,流入占比,流出占比,净占比,
    +f184: 主力净占比,
    +f124: 时间戳,


示例：

```python
import requests

url = "http://99.push2.eastmoney.com/api/qt/clist/get"
params = {
    "pn": 1,
    "pz": 20,
    "po": 1,
    "np": 1,
    "ut": "bd1d9ddb04089700cf9c27f6f7426281",
    "fltt": 2,
    "invt": 2,
    "wbp2u": "|0|0|0|web",
    "fid": "f3",
    "fs": "b:MK0021,b:MK0022,b:MK0023,b:MK0024",
    "fields": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f22,f23,f24,f25,f62,f115,f128,f140,f141,f136,f152"
}

response = requests.get(url, params=params)
data = response.json()

print(data) 
```


**实时行情数据请求及字段解释**

 请求链接 https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id=601136&callback=jSnapshotBack

返回数据各字段的意义：

    +code: 股票代码，这里是"601136"。
    +name: 股票名称，这里是"首创证券"。
    +sname: 股票简称，也是"首创证券"。
    +topprice: 最高价，这里是"31.00"。
    +bottomprice: 最低价，这里是"25.36"。
    +status: 股票状态，这里是0。停牌为1
    +fivequote: 五档行情信息，包括买卖的价格和数量等。
        +buy1 - buy5: 五个买入价格档位，从高到低。
        +sale1 - sale5: 五个卖出价格档位，从低到高。
        +buy1_count - buy5_count: 对应买入价格档位的数量。
        +sale1_count - sale5_count: 对应卖出价格档位的数量
    +realtimequote: 实时行情信息，包括开盘价、最高价、最低价、当前价格等。
        +open: 当日开盘价。
        +high: 当日最高价。
        +low: 当日最低价。
        +currentPrice: 当前价格。
        +volume: 成交量。
        +amount: 成交额。
        +time: 时间，表示数据更新时间。
        +zd: 涨跌额。
        +zdf: 涨跌幅。
        +turnover: 换手率。
        +np: 内盘量，表示买入成交量。
        +wp: 外盘量，表示卖出成交量。
        +avg: 均价，表示当日的成交均价
    +pricelimit: 价格限制，这里是null，可能表示没有价格限制。
    +tradeperiod: 交易时段，这里是0。

这个接口也可以获取实时买卖5档行情, 价格都是整数
https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=1&cb=&secid=0.000639&fields=f58,f734,f107,f57,f43,f59,f169,f301,f60,f170,f152,f177,f111,f46,f44,f45,f47,f260,f48,f261,f279,f277,f278,f288,f19,f17,f531,f15,f13,f11,f20,f18,f16,f14,f12,f39,f37,f35,f33,f31,f40,f38,f36,f34,f32,f211,f212,f213,f214,f215,f210,f209,f208,f207,f206,f161,f49,f171,f50,f86,f84,f85,f168,f108,f116,f167,f164,f162,f163,f92,f71,f117,f292,f51,f52,f191,f192,f262,f294,f295,f269,f270,f256,f257,f285,f286,f748,f747

字段解释

    +f43: 最新价。
    +f44: 最高价, 
    +f45: 最低价。
    +f46: 今开价。
    +f47: 成交量（手）。
    +f48: 成交额。
    +f49: 外盘量。
    +f50: 量比。
    +f51: 涨停
    +f52: 跌停
    +f57: 代码。
    +f58: 名称。
    +f59:
    +f60: 昨收价。
    +f71: 均价
    +f84: 总股本。
    +f85: 流通股。
    +f116: 总市值。
    +f117: 流通市值。
    +f11-f20: 五个买入价格档位和挂单数量(手)，从低到高。buy5-buy1
    +f21-f30: 五个卖出价格档位和挂单数量(手)，从低到高。sale1-sale5
    动态市盈率（不适用于ETF）。


**盘口异动**

https://quote.eastmoney.com/changes
https://quote.eastmoney.com/changes/boardlist.html

https://push2ex.eastmoney.com/getAllStockChanges?type=8201,8202,8193,4,32,64,8207,8209,8211,8213,8215,8204,8203,8194,8,16,128,8208,8210,8212,8214,8216&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex=0&pagesize=64&dpt=wzchanges

{"rc":0,"rt":105,"svr":181734952,"lt":1,"full":0,"data":{"tc":368,"allstock":[{"tm":92504,"c":"688047","m":1,"n":"龙芯中科","t":8209,"i":"0.025624,92.46000,0.025624"},{"tm":92504,"c":"605081","m":1,"n":"太和水","t":8210,"i":"-0.026015,15.35000,-0.026015"}]}}

http://push2ex.eastmoney.com/getAllBKChanges?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wzchanges&pageindex=0&pagesize=573

type:

    + 4: 封涨停板
    + 8: 封跌停板
    + 16: 打开涨停板
    + 32: 打开跌停板
    + 64: 有大买盘
    + 128: 有大卖盘
    + 8193: 大笔买入
    + 8194: 大笔卖出
    + 8201: 火箭发射
    + 8202: 快速反弹
    + 8203: 高台跳水
    + 8204: 加速下跌
    + 8207: 竞价上涨
    + 8208: 竞价下跌
    + 8209: 高开5日线
    + 8210: 低开5日线
    + 8211: 向上缺口
    + 8212: 向下缺口
    + 8213: 60日新高
    + 8214: 60日新低
    + 8215: 60日大幅上涨
    + 8216: 60日大幅下跌
    8217, 开盘涨?
    8218: 开盘跌?
    8219, 大幅上涨？
    8220, ？
    8221, 大涨？
    8222, 大跌？


**分时数据请求及字段解释**
http://quote.eastmoney.com/concept/bj833427.html#fullScreenChart

请求链接 http://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbfba10b&secid=1.603536&ndays=1&iscr=1&iscca=0

"2023-09-12 09:32,2.71,2.78,2.80,2.70,208535,57257731.00,2.769"
时间 开 收 高 低 成交量 成交额 均价


**期货/股票K线数据**
https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=113.cum&klt=101&fqt=1&lmt=100&end=20500000&iscca=1&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64&ut=f057cbcbce2a86e2866ab8877db1d059&forcect=1
https://wap.eastmoney.com/quote/stock/113.cum.html
http://quote.eastmoney.com/sz002952.html


**东方财富选股器**
https://data.eastmoney.com/xuangu/


**个股热度/人气排行**
同花顺
https://basic.10jqka.com.cn/basicph/popularityRanking.html
https://basic.10jqka.com.cn/api/stockph/popularity/top/


东方财富
http://guba.eastmoney.com/rank/
https://data.eastmoney.com/xuangu/
https://data.eastmoney.com/dataapi/xuangu/list?st=POPULARITY_RANK&sr=1&ps=500&p=1&sty=SECURITY_CODE,SECURITY_NAME_ABBR,NEW_PRICE,CHANGE_RATE,VOLUME_RATIO,HIGH_PRICE,LOW_PRICE,PRE_CLOSE_PRICE,VOLUME,DEAL_AMOUNT,TURNOVERRATE,POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<=500)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&source=SELECT_SECURITIES&client=WEB

淘股吧
https://www.taoguba.com.cn/new/nrnt/toPopularityBoard
https://www.taoguba.com.cn/new/nrnt/getNoticeStock?type=H

雪球
https://xueqiu.com/hq#hot
https://stock.xueqiu.com/v5/stock/hot_stock/list.json?page=1&size=9&_type=10&type=10


财联社API:
涨跌家数:
https://x-quote.cls.cn/quote/index/home?app=CailianpressWeb&os=web&sv=7.7.5&sign=bf0f367462d8cd70917ba5eab3853bce
https://x-quote.cls.cn/v2/quote/a/stock/emotion?app=CailianpressWeb&os=web&sv=7.7.5&sign=bf0f367462d8cd70917ba5eab3853bce
热门板块:
https://x-quote.cls.cn/web_quote/plate/hot_plate?app=CailianpressWeb&os=web&rever=1&sv=7.7.5&type=industry,concept,area&way=change&sign=db0c36ccbeedc38b0abf5b73e9b4ce21
https://x-quote.cls.cn/web_quote/plate/plate_list?app=CailianpressWeb&os=web&page=1&rever=1&sv=7.7.5&type=concept&way=limit_up_num
基本信息:
https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=secu_name,secu_code,trade_status,change,change_px,last_px&os=web&secu_codes=sh000001,sz399001,sh000905,sz399006,sh000300,899050.BJ&sv=7.7.5
盘中异动:
https://www.cls.cn/v3/transaction/anchor?app=CailianpressWeb&cdate=2024-07-26&os=web&sv=7.7.5&sign=dbcbb9dbbf07ed2f69f9ad4b7a99c3f6
指数分时数据
https://x-quote.cls.cn/quote/index/tline?app=CailianpressWeb&date=20240726&os=web&sv=7.7.5&sign=a0e605a8cd75b077ee9bdfc5cd587cdc
https://x-quote.cls.cn/quote/stock/tline?app=CailianpressWeb&fields=date,minute,last_px,business_balance,business_amount,open_px,preclose_px,av_px&os=web&secu_code=cls82401&sv=7.7.5
https://x-quote.cls.cn/quote/stock/kline?app=CailianpressWeb&limit=50&offset=0&os=web&secu_code=sh688169&sv=7.7.5&type=fd1&sign=53d1663ea928a6bbcf026fc434f7ace0
情绪指标
https://x-quote.cls.cn/quote/stock/emotion_options?app=CailianpressWeb&fields=up_performance&os=web&sv=7.7.5&sign=5f473c4d9440e4722f5dc29950aa3597
资金流向
https://x-quote.cls.cn/quote/stock/fundflow?secu_code=sh603324&app=CailianpressWeb&os=web&sv=7.7.5&sign=bf0f367462d8cd70917ba5eab3853bce
最近交易日
https://x-quote.cls.cn/quote/stock/closest_trading_day?app=CailianpressWeb&os=web&sv=7.7.5


**baidu gushitong**
https://gushitong.baidu.com/stock/ab-002926
