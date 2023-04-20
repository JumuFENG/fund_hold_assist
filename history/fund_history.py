# Python 3
# -*- coding:utf-8 -*-

from sys import platform
from utils import *
from history import *
import requests
import html
import os
import re
import time
from datetime import datetime, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup 
if platform == 'win32':
    from selenium import webdriver

class AllFunds(InfoList):
    """get all funds' general info and save to db table allfund"""
    def __init__(self):
        self.checkInfoTable(fund_db_name, gl_all_funds_info_table)

        self.check_table_column(column_url, 'varchar(255) DEFAULT NULL')
        self.check_table_column(column_type, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_risk_level, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_amount, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_setup_date, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_star_level, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_summary_url, 'varchar(255) DEFAULT NULL')

        self.check_table_column(column_fee, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_rating_shzq, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_rating_zszq, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_rating_jazq, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_5star_num, 'varchar(10) DEFAULT NULL')
        self.check_table_column(column_rating_cx3, 'varchar(10) DEFAULT NULL')
        self.check_table_column(column_rating_cx5, 'varchar(10) DEFAULT NULL')

        self.check_table_column(column_shortterm_rate, 'varchar(10) DEFAULT NULL')
        self.check_table_column(column_table_history, 'varchar(20) DEFAULT NULL')
        self.check_table_column(column_qdii, 'tinyint(1) DEFAULT 0')
        self.check_table_column(column_tracking_index, 'varchar(10) DEFAULT NULL')

    def set_pre_buy_fee(self, code, fee):
        self.sqldb.update(gl_all_funds_info_table, {column_fee:str(fee)}, {column_code: code})

    def loadInfo(self):
        c = ""
        with open("allfund.html",'rb') as f:
            c = f.read()
        soup = BeautifulSoup(c, 'html.parser')
        tags = soup.select('.num_right > li')
        allfund = []
        for tag in tags:
            if tag.a:
                codename = tag.a.text[1:].split('）')
                allfund.append([codename[0],codename[1],tag.a.get('href')]) 
        self.sqldb.insertMany(gl_all_funds_info_table, [column_code, column_name, column_url], allfund)

    def loadRatingInfo(self, code = None):
        c = Utils.get_em_equest(apiUrl_fundRating)
        soup = BeautifulSoup(c, 'html.parser')
        fundJs = soup.select('#fundinfo > script')[0]
        vs = fundJs.get_text()
        results = re.search('var fundinfos = "(.*?)";', vs)
        rows = results.group(1).split('_')
        for row in rows:
            ds = row.split('|')
            dscode = ds[0]
            if code and not dscode == code:
                continue
            fund_type = ds[2]
            zszq = ds[10]
            shzq = ds[12]
            jazq = ds[16]
            five_star_num = ds[7]
            #ds[8] #htpj
            #ds[14] #shzq5
            fee = ds[18]
            ratingDic = {column_type:fund_type, column_fee:fee, column_rating_shzq:shzq, column_rating_zszq:zszq, column_rating_jazq:jazq,column_5star_num:five_star_num}
            if code:
                return ratingDic
            else:
                self.updateRatingOfFund(dscode, ratingDic)
            
    def updateRatingOfFund(self, code, ratingDic):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return
        if not len(ratingDic) == 6:
            print("len of ratingDic should be 6")
            return

        self.sqldb.update(gl_all_funds_info_table, ratingDic, {column_code: code})

    def updateMsRating(self, code, lv3, lv5):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return

        self.sqldb.update(gl_all_funds_info_table, {column_rating_cx3:str(lv3), column_rating_cx5:str(lv5)}, {column_code: code})

    def getInfoOfFund(self, code):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return

        url = self.get_fund_url(code)
        if not url:
            url = "http://fund.eastmoney.com/" + code + ".html"
            self.updateInfoOfFund(code, {column_url: url})
        return Utils.get_em_equest(url)

    def updateInfoOfFund(self, code, infoDic):
        if not self.sqldb.isExistTable(gl_all_funds_info_table):
            print(gl_all_funds_info_table, "not exist.")
            return

        self.sqldb.update(gl_all_funds_info_table, infoDic, {column_code: code})

    def loadInfo(self, code):
        c = self.getInfoOfFund(code)
        if not c:
            return

        soup = BeautifulSoup(c, 'html.parser')
        fhdr = soup.select('.fundDetail-header')[0].div.get_text()
        name = fhdr.split('(')[0]
        tds = soup.select('.infoOfFund > table td')
        #print(tds[0].get_text().replace(u'\xa0', u' '))
        td_fund_type = tds[0].a.get_text()
        td_type = tds[0].get_text().replace(u'\xa0', u'').split('|')
        td_risk_level = td_type[1] if len(td_type) > 1 else "N/A"
        td_money_amount = tds[1].get_text().replace(u'\xa0', u'').split('：')[1].split('（')[0]
        td_setup_date = tds[3].get_text().replace(u'\xa0', u'').split('：')[1]
        td_star_level = tds[5].get_text().replace(u'\xa0', u'').split('：')[1]
        if not td_star_level:
            td_star_level = tds[5].div.get('class')[0][-1]

        fund_info_url = soup.select('.fundDetail-footer > ul > li')[1].a.get('href')

        buyfee = soup.select('.buyWayWrap .staticItem .staticCell .nowPrice')[0].get_text()

        infoDic = {column_name: name, column_type: td_fund_type, column_risk_level: td_risk_level, column_amount: td_money_amount, column_setup_date: td_setup_date, column_star_level: td_star_level, column_summary_url: fund_info_url, column_fee: buyfee}
        ratingDic = self.loadRatingInfo(code)
        if ratingDic:
            infoDic = dict(infoDic, **ratingDic)
        #print(infoDic)
        self.updateInfoOfFund(code, infoDic)

    def readSingleData(self, col, code, defVal = None):
        val = defVal
        if self.sqldb.isExistTable(gl_all_funds_info_table):
            v = self.sqldb.select(gl_all_funds_info_table, col, "%s = '%s'" % (column_code, code))
            if v:
                (v,), = v
                val = v if v else val
        return val

    def get_fund_name(self, code):
        return self.readSingleData(column_name, code, "name_" + code)

    def get_fund_url(self, code):
        return self.readSingleData(column_url, code)

    def get_fund_history_table(self, code):
        return self.readSingleData(column_table_history, code, "f_his_" + code)

    def getMsRatingLevel(self, starUrl):
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36'}
        
        proxies=None

        fname = 'star.gif'
        rsp = requests.get(starUrl, params=headers, proxies=proxies)
        rsp.raise_for_status()
        with open(fname,'wb') as f:
            f.write(rsp.content)
        gtf = GifToFrames(fname, 'star')
        bmps = gtf.convert_to_bmps()
        bmp = bmps[0]
        starnum = gtf.morningstar_star_num(bmp)
        os.remove(fname)
        os.remove(bmp)

        return starnum

    def loadMorningStarRatingInfo(self, code = None):
        driver = webdriver.PhantomJS(executable_path=gl_phantomjs_exe_path)
        try:
            driver.get(apiUrl_MorningstarQuickrank)
            page = 0
            trs = []
            soup = None
            while True:
                while True:
                    time.sleep(1)
                    page_source = driver.page_source
                    soup = BeautifulSoup(page_source, 'html.parser')
                    trs = soup.select('#qr_grid tbody > tr')
                    if len(trs) > 0:
                        break

                for tr in trs:
                    tr_class_name = tr.get('class')[0]
                    if not tr_class_name == 'gridAlternateItem' and not tr_class_name == 'gridItem':
                        continue
                    tds = tr.select('td')
                    code = tds[2].get_text()
                    lv3 = self.getMsRatingLevel(tds[5].select('img')[0].get('src'))
                    lv5 = self.getMsRatingLevel(tds[6].select('img')[0].get('src'))
                    self.updateMsRating(code, lv3, lv5)
                page += 1
                print(page, "loaded.")

                arrows = soup.select('#ctl00_cphMain_AspNetPager1 > a')
                if len(arrows) < 2:
                    print("the '>' button not find.")
                    break
                nextArrow = arrows[-2]

                nextDisabled = nextArrow.get('disabled')
                if nextDisabled and nextDisabled == 'true':
                    print("all done!")
                    break
                nextArrow = driver.find_element_by_link_text('>')
                nextArrow.click()
                trs = []
                soup = None
        except:
            driver.get(apiUrl_MorningstarQuickrank)
            page = 0
            lastpage = driver.find_element_by_link_text('>>')
            lastpage.click()

            trs = []
            soup = None
            while True:
                while True:
                    time.sleep(1)
                    page_source = driver.page_source
                    soup = BeautifulSoup(page_source, 'html.parser')
                    trs = soup.select('#qr_grid tbody > tr')
                    if len(trs) > 0:
                        break

                for tr in trs:
                    tr_class_name = tr.get('class')[0]
                    if not tr_class_name == 'gridAlternateItem' and not tr_class_name == 'gridItem':
                        continue
                    tds = tr.select('td')
                    code = tds[2].get_text()
                    lv3 = self.getMsRatingLevel(tds[5].select('img')[0].get('src'))
                    lv5 = self.getMsRatingLevel(tds[6].select('img')[0].get('src'))
                    self.updateMsRating(code, lv3, lv5)
                page += 1
                print(page, "loaded, end to front.")
                arrows = soup.select('#ctl00_cphMain_AspNetPager1 > a')
                print(len(arrows))
                if len(arrows) < 2:
                    print("the '<' button not find.")
                    break
                nextArrow = arrows[1]
                nextDisabled = nextArrow.get('disabled')
                if nextDisabled and nextDisabled == 'true':
                    print("all done!")
                    break

                prevArrow = driver.find_element_by_link_text('<')
                prevArrow.click()
                trs = []
                soup = None
        driver.quit()

    def updateIsQDII(self):
        v = self.sqldb.select(gl_all_funds_info_table, [column_code, column_name, column_type])
        for (c, n, t) in v:
            if (n and 'QDII' in n.upper()) or (t and 'QDII' in t.upper()):
                self.sqldb.update(gl_all_funds_info_table, {column_qdii:'1'}, {column_code: c})

    def updateTrackIndex(self, code, index):
        self.sqldb.update(gl_all_funds_info_table, {column_tracking_index: index}, {column_code: code})

class FundHistoryDataDownloader(HistoryDowloaderBase):
    """
    get all the history data a fund, or update the data.
    """
    def setFundCode(self, code):
        self.code = code
        
        allfund = AllFunds()
        self.name = allfund.get_fund_name(self.code)
        self.fund_db_table = allfund.get_fund_history_table(self.code)

    def getRequest(self, url, params=None, proxies=None):
        try:
            rsp = requests.get(url, params=params, proxies=proxies)
            rsp.raise_for_status()
            return rsp.text
        except Exception as e:
            print(e)

    def paraseFundRecords(self, records):
        soup = BeautifulSoup(records, 'html.parser')
        tab = soup.findAll('tbody')[0]
        for tr in tab.findAll('tr'):
            if tr.findAll('td') and len((tr.findAll('td'))) == 7:
                rdate = str(tr.select('td:nth-of-type(1)')[0].getText().strip())
                rVal = Decimal(tr.select('td:nth-of-type(2)')[0].getText().strip())
                strRate = tr.select('td:nth-of-type(4)')[0].getText().strip()
                rGrRate = Decimal('0')
                if len(strRate) > 0:
                    rGrRate = (Decimal(strRate.strip('%'))/Decimal(100)).quantize(Decimal('0.0000'))
                record = [rdate, rVal, rGrRate]
                self.allRecords.append(record)

    def getFundHistory(self, start = "", end = ""):
        curpage = 1
        self.allRecords = []

        while True:
            params = {'type': 'lsjz', 'code': self.code, 'page': curpage, 'per': 49, 'sdate': start, 'edate': end}
            response = self.getRequest(f10DataApiUrl, params)
            if response is None:
                print(params, response, 'getRequest error')
                break
            content = str(response[13:-2])
            content_split = content.split(',')
            # obtain the info of data, curpage, pages, records
            records = content_split[0].split(':')[-1]
            self.paraseFundRecords(records)
            curpage = int(content_split[-1].split(':')[-1])
            pages = int(content_split[-2].split(':')[-1])
            print(curpage,'pages in', pages, 'GOT!')
            if curpage >= pages:
                break
            curpage += 1

    def fundHistoryTillToday(self, code):
        self.setFundCode(code)
        sDate = ""
        eDate = ""
        if self.sqldb.isExistTable(self.fund_db_table):
            maxDate = self.sqldb.selectOneValue(self.fund_db_table, "max(%s)" % column_date)  #order="ORDER BY date DESC" ASC
            if maxDate:
                sDate = (datetime.strptime(maxDate, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                eDate = datetime.now().strftime("%Y-%m-%d")
                if sDate > eDate:
                    print("Already updated to %s" % maxDate)
                    return
                if datetime.strptime(eDate, "%Y-%m-%d") - datetime.strptime(sDate, "%Y-%m-%d") <= timedelta(days = 1) and datetime.strptime(sDate, "%Y-%m-%d").weekday() >= 5:
                    print("it is weekend, no data to update.")
                    return

        self.getFundHistory(sDate, eDate)
        if len(self.allRecords) > 0:
            self.addFundData()

        if sDate == "" and eDate == "":
            af = AllFunds()
            af.loadInfo(code)


    def addFundData(self):
        if not self.sqldb.isExistTable(self.fund_db_table):
            attrs = {column_date:'varchar(20) DEFAULT NULL',column_net_value:'double(16,4) DEFAULT NULL',column_growth_rate:'double(8,4) DEFAULT NULL'}
            constraint = 'PRIMARY KEY(`id`)'
            self.sqldb.createTable(self.fund_db_table, attrs, constraint)
        keys = [column_date, column_net_value, column_growth_rate]
        #print("======= start to insert", len(self.allRecords), "rows")
        self.allRecords.reverse()
        self.sqldb.insertMany(self.fund_db_table, keys, self.allRecords)
        for x in self.allRecords[-5:] : print(x)
        self.allRecords = []

    def reload_all_history(self):
        if self.sqldb.isExistTable(self.fund_db_table):
            self.sqldb.dropTable(self.fund_db_table)
        self.fundHistoryTillToday()
