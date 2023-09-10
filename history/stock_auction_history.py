# Python 3
# -*- coding:utf-8 -*-
import re
import json
from utils import *
from history import StockGlobal

class IWencaiRequest:
    def __init__(self) -> None:
        self.wcheaders = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json',
            'hexin-v': 'A9dE9Spuf6z9JPt6Il356hxUYEokHJ6bhcwvWyg_8IsNR_m-Mew7zpXAv6w6',
            'Host': 'iwencai.com',
            'Origin': 'http://iwencai.com',
            'Pragma': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0'
        }

    def askUrl(self):
        return f'http://iwencai.com/customized/chart/get-robot-data'
    
    def setQuestion(self, quest, hexin):
        self.pjson = {
            'add_info': '{"urp":{"scene":1,"company":1,"business":1},"contentType":"json","searchInfo":true}',
            'block_list': '',
            'log_info': '{"input_type":"typewrite"}',
            'page': 1,
            'perpage': '100',
            'query_area': '',
            'question': '',
            'rsh': 'Ths_iwencai_Xuangu_l60bv38dwtwibihmyyqfjcswbcwny9cu',
            'secondary_intent': 'stock',
            'source': 'Ths_iwencai_Xuangu',
            'version': '2.0'
        }
        self.pjson['question'] = quest
        self.wcheaders['hexin-v'] = hexin

    def getRequest(self):
        wcres = requests.post(self.askUrl(), json=self.pjson, headers=self.wcheaders)
        if 'forbidden' in wcres.text:
            print(self.pjson['question'], wcres.text)
            raise Exception(self.pjson['question'])
        jres = json.loads(wcres.text)
        if len(jres['data']['answer'][0]['txt'][0]['content']['components']) < 2:
            return None
        return jres['data']['answer'][0]['txt'][0]['content']['components'][1]['data']['datas'][0]


class StockAuction(MultiThrdTableBase):
    def __init__(self) -> None:
        super().__init__()
        self.wencai = None
        self.hexin = 'A9BDgOmrgIswTVyPzOtWJ08ppx8nmbRl1n0I5cqgnCv-BX6LcqmEcyaN2H0Z'

    def getWencai(self):
        if self.wencai is None:
            self.wencai = IWencaiRequest()
        return self.wencai

    def initConstrants(self):
        super().initConstrants()
        self.dbname = history_db_name
        self.tablename = 'stock_auction'
        self.colheaders = [
            {'col': column_code, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': column_date, 'type': 'varchar(20) DEFAULT NULL'},
            {'col': 'matched_vol', 'type': 'float DEFAULT NULL'},
            {'col': 'unmatch_vol', 'type': 'float DEFAULT NULL'},
        ]
        self.threads_num = 24

    def getDumpKeys(self):
        return ','.join([col['col'] for col in self.colheaders])

    def getAuctionData(self, code, date=None):
        aucs = self.sqldb.select(self.tablename, self.getDumpKeys(), [f'{column_code}="{code}"', f'{column_date}="{date}"'])
        if aucs is None or len(aucs) == 0:
            aucs = self.request_for_auction(code, date)
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], aucs)
        return aucs

    def request_for_auction(self, code, date0, date1=None):
        wencai = self.getWencai()
        question = f'{code[2:]}'
        nardate = []
        values = []
        if date1 is None or date0 == date1:
            question += f' {date0}竞价量,未匹配量'
            nardate.append([date0, date0.replace('-', '')])
        else:
            d = date0
            while d <= date1:
                question += f' {d}竞价量,未匹配量'
                nardate.append([d, d.replace('-', '')])
                d = TradingDate.nextTradingDate(d)
                if d == date1 and d in question:
                    break
                if len(nardate) > 2 and d <= date1:
                    values += self.request_for_auction(code, d, date1)
                    break

        wencai.setQuestion(question, self.hexin)
        wobj = wencai.getRequest()
        if wobj is None:
            return values

        sub_values = [[code, d, wobj[f'竞价量[{nar}]']/100, wobj[f'竞价未匹配量[{nar}]']/100 if f'竞价未匹配量[{nar}]' in wobj else 0 ] for d, nar in nardate if f'竞价量[{nar}]' in wobj]
        values += sub_values
        return values

    def get_stock_bid_volumes(self, code):
        code = code.replace("SH", "").replace("SZ", "")        
        if len(code) != 6 or not code.isdigit():
            Utils.log(f'Invalid stock code format: {code}', Utils.Err)
            return None

        try:
            quote_url = f'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot?id={code}&callback=jSnapshotBack'

            responsetext = Utils.get_em_equest(quote_url, host='emhsmarketwg.eastmoneysec.com')
            snapshot_data = responsetext.replace('jSnapshotBack(', '').rstrip(');')
            snapshot = json.loads(snapshot_data)

            # 解析买一买二和卖一卖二的价格和数量
            buy1_price = snapshot['fivequote']['buy1']
            sell1_price = snapshot['fivequote']['sale1']
            buy1_count = snapshot['fivequote']['buy1_count']
            sell1_count = snapshot['fivequote']['sale1_count']
            current_price = snapshot['realtimequote']['currentPrice']
            quote_time = snapshot['realtimequote']['time']

            quote_mins = quote_time.split(':')
            quote_mins = int(quote_mins[0]) * 60 + int(quote_mins[1])
            if quote_mins < 565 or quote_mins > 570:
                # if quote_time < '9:25' or quote_time > '9:30':
                # print('非集合竞价完成时的数据')
                return None

            matched_vol = snapshot['realtimequote']['volume']
            unmatched_vol = 0
            if current_price == buy1_price:
                unmatched_vol = buy1_count
            elif current_price == sell1_price:
                unmatched_vol = -sell1_count

            return [matched_vol, unmatched_vol]
        except requests.exceptions.RequestException as e:
            Utils.log(f'Request error for code {code}: {e}')
        except json.JSONDecodeError as e:
            Utils.log(f'JSON decoding error for code {code}: {e}', Utils.Err)

        return None

    def task_prepare(self, date=None):
        stks = StockGlobal.all_stocks()
        self.tstks = [s[1] for s in stks if s[4] == 'ABStock']
        self.tauctions = []

    def task_processing(self):
        while len(self.tstks) > 0:
            code = self.tstks.pop(0)
            auction = self.get_stock_bid_volumes(code)
            if auction is None:
                continue
            self.tauctions.append([code, Utils.today_date()] + auction)

    def post_process(self):
        if len(self.tauctions) > 0:
            if self.sqldb is None:
                self._check_or_create_table()
            self.sqldb.insertMany(self.tablename, [col['col'] for col in self.colheaders], self.tauctions)

    def update_daily_auctions(self):
        self.start_multi_task()
