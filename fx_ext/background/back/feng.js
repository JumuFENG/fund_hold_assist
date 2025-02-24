'use strict';


class feng {
    constructor() {
        throw new Error('Cannot instantiate StaticClass');
    }

    static jywg = 'https://jywg.eastmoneysec.com/'; //'https://jywg.18.cn/';
    static quotewg = 'https://hsmarketwg.eastmoney.com/api/SHSZQuoteSnapshot';
    static emklapi = 'http://push2his.eastmoney.com/api/qt/stock/kline/get?ut=7eea3edcaed734bea9cbfc24409ed989&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56';
    static emshszac = 'https://emhsmarketwg.eastmoneysec.com/api/SHSZQuery/GetCodeAutoComplete2?count=10&callback=sData&id='

    /**
    * 获取股票实时盘口数据, 包括最新价，开盘价，昨收价，涨停价，跌停价以及五档买卖情况，要获取涨停价跌停价不需要用本接口，可以直接计算。
    * @param {string} code 股票代码, 如: 002261
    * @returns {Promise<Object>} 返回 {name, latestPrice, openPrice, lastClose, topprice, bottomprice, buysells}
    */
    static async getStockSnapshot(code) {
        let url = feng.quotewg + '?id=' + code + '&callback=jSnapshotBack?';
        return guang.fetchData(url, {}, 1000, ssnap => {
            // let snapshot = JSON.parse(ssnap.match(/jSnapshotBack\((.+?)\);/)[1]);
            let snapshot = ssnap;
            let name = snapshot.name;
            let latestPrice = snapshot.realtimequote.currentPrice;
            let buysells = Object.fromEntries(
                Object.entries(snapshot.fivequote).filter(([key]) => key.startsWith('buy') || key.startsWith('sale'))
            );
            let openPrice = snapshot.fivequote.openPrice;
            let lastClose = snapshot.fivequote.yesClosePrice
            let topprice = snapshot.topprice;
            let bottomprice = snapshot.bottomprice;
            let data = {name, latestPrice, openPrice, lastClose, topprice, bottomprice, buysells};
            let expireTime = 0;
            let now = new Date()
            let [day, tm] = now.toLocaleString('zh', {year:'numeric', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}).replaceAll('/','').split(' ');
            if (snapshot.realtimequote.date	!= day || tm < '09:15' || tm > '15:00') {
                expireTime = now.setDate(now.getDate() + 1);
            }

            return expireTime > 0 ? {data, expireTime} : data;
        });
    }

    static async getEmStcokInfo(code) {
        let url = feng.emshszac + code;
        return guang.fetchData(url, {}, 24*60*60000, emsinf => {
            const match = emsinf.match(/var sData = "(.+?);";/);
            if (!match) throw new Error('Invalid response format');

            const sData = match[1].split(',');
            const mm = { '1': 'SH', '2': 'SZ', '4': 'BJ' };
            const [code, , , , name, market, , , sec] = sData;
            return {name, code, market, mktcode: mm[market], secid: `${sec}.${code}`};
        });
    }

    /**
    * 获取东方财富股票secid 如 002261 -> 2.002261
    * @param {string} code 股票代码, 如: 002261
    * @returns {string} secid
    */
    static async getStockSecId(code) {
        const s = await feng.getEmStcokInfo(code);
        return s.secid;
    }

    /**
    * 获取股票K线数据, 常用日K，1分， 15分
    * @param {string} code 股票代码, 如: 002261
    * @param {number} klt K线类型，101: 日k 102: 周k 103: 月k 104: 季k 105: 半年k 106:年k 60: 小时 120: 2小时, 其他分钟数 1, 5, 15,30
    * @param {string} date 用于大于日K的请求，设置开始日期如： 20201111
    * @returns {Promise<any>} 返回数据的 Promise
    */
    static async getStockKline(code, klt, date) {
        let secid = await feng.getStockSecId(code);
        let beg = 0;
        if (klt == '101') {
            beg = date;
            if (!beg) {
                beg = new Date(beg.setDate(beg.getDate() - 30));
                beg = beg.toLocaleString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, '')
            } else if (date.includes('-')) {
                beg = date.replaceAll('-', '');
            }
        }
        let url = feng.emklapi + '&klt=' + klt + '&secid=' + secid + '&beg=' + beg + '&end=20500000';
        let cacheTime = klt - 15 < 0 || klt % 30 == 0 ? klt * 60000 : 24*60*60000;
        return guang.fetchData(url, {}, cacheTime, klrsp => {
            let code = klrsp.data.code;
            if (!emjyBack.klines[code]) {
                emjyBack.klines[code] = new KLine(code);
            }
            emjyBack.klines[code].updateRtKline({kltype: klt, kline: klrsp});
            let kl0 = emjyBack.klines[code].getLatestKline(klt);
            const getExpireTime = function(kltime, kltype) {
                const currentDate = new Date();
                const [year, month, day] = [currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()]
                const createTime = (h, m, s = 0, dd = 0) => new Date(year, month, day + dd, h, m, s);

                const amStart = createTime(9, 30);   // 上午开盘时间
                const amEnd = createTime(11, 30);    // 上午收盘时间
                const pmStart = createTime(13, 0);   // 下午开盘时间
                const pmEnd = createTime(15, 0);     // 下午收盘时间

                let klDate = new Date(kltime);
                if (kltype - 15 > 0 && kltype % 30 !== 0) {
                    klDate = new Date(kltime + ' 15:00');
                }

                if (klDate < currentDate) {
                    return amStart > currentDate ? amStart : createTime(9, 30, 0, 1); // 下一天的上午开盘时间
                }

                if (kltype - 15 > 0 && kltype % 30 !== 0) {
                    if (currentDate < createTime(14, 50)) {
                        return createTime(14, 50); // 尾盘更新
                    }
                    return currentDate < pmEnd ? pmEnd : createTime(9, 30, 0, 1); // 下午收盘时间或第二天开盘时间
                }

                if (currentDate < amStart) {
                    return amStart; // 上午开盘时间
                }

                const kLineInterval = kltype;
                const nextDate = new Date(Math.ceil(klDate.getTime() / (kLineInterval * 60000)) * kLineInterval * 60000);

                if (currentDate >= amStart && currentDate < amEnd) {
                    return nextDate < amEnd ? nextDate : amEnd;
                }
                if (currentDate >= pmStart && currentDate < pmEnd) {
                    return nextDate < pmEnd ? nextDate : pmEnd;
                }
                if (currentDate >= amEnd && currentDate < pmStart) {
                    return pmStart;
                }
                if (currentDate >= pmEnd) {
                    return createTime(9, 30, 0, 1); // 下一天的上午开盘时间
                }
            };

            return {data: emjyBack.klines[code], expireTime: getExpireTime(kl0.time, klt)};
        });
    }

    static async buyNewStocks() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no valid validateKey', emjyBack.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetCanBuyNewStockListV3?validatekey=${emjyBack.validateKey}`;
        try {
            const response = await fetch(url, { method: 'POST' });
            const robj = await response.json();

            if (robj.NewStockList && robj.NewStockList.length > 0) {
                const data = robj.NewStockList
                    .filter(stk => stk.Fxj - 100 > 0 && stk.Ksgsx > 0)
                    .map(stk => ({
                        StockCode: stk.Sgdm,
                        StockName: stk.Zqmc,
                        Price: stk.Fxj,
                        Amount: parseInt(stk.Ksgsx),
                        TradeType: "B",
                        Market: stk.Market
                    }));

                if (data.length > 0) {
                    const jdata = JSON.stringify(data);
                    emjyBack.log('buyNewStocks', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${emjyBack.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        emjyBack.log('buyNewStocks success', robjPost.Message);
                    } else {
                        emjyBack.log('buyNewStocks error', robjPost);
                    }
                } else {
                    emjyBack.log('buyNewStocks no new stocks to buy!');
                }
            } else {
                emjyBack.log(JSON.stringify(robj));
            }
        } catch (error) {
            console.error('Error in buyNewStocks:', error);
        }
    }

    static async buyNewBonds() {
        if (!emjyBack.validateKey) {
            emjyBack.log('no valid validateKey', emjyBack.validateKey);
            return;
        }

        const url = `${feng.jywg}Trade/GetConvertibleBondListV2?validatekey=${emjyBack.validateKey}`;
        try {
            const response = await fetch(url, { method: 'POST' });
            const robj = await response.json();

            if (robj.Status !== 0) {
                emjyBack.log('unknown error', robj);
                return;
            }

            if (robj.Data && robj.Data.length > 0) {
                const data = robj.Data
                    .filter(bondi => bondi.ExIsToday)
                    .map(bondi => ({
                        StockCode: bondi.SUBCODE,
                        StockName: bondi.SUBNAME,
                        Price: bondi.PARVALUE,
                        Amount: bondi.LIMITBUYVOL,
                        TradeType: "B",
                        Market: bondi.Market
                    }));

                if (data.length > 0) {
                    const jdata = JSON.stringify(data);
                    emjyBack.log('buyNewBonds', jdata);

                    const postUrl = `${feng.jywg}Trade/SubmitBatTradeV2?validatekey=${emjyBack.validateKey}`;
                    const header = { "Content-Type": "application/json" };
                    const postResponse = await fetch(postUrl, { method: 'POST', headers: header, body: jdata });
                    const robjPost = await postResponse.json();

                    if (robjPost.Status === 0) {
                        emjyBack.log('buyNewBonds success', robjPost.Message);
                    } else {
                        emjyBack.log('buyNewBonds error', robjPost);
                    }
                } else {
                    emjyBack.log('buyNewBonds no new bonds to buy!');
                }
            } else {
                emjyBack.log('no new bonds', robj);
            }
        } catch (error) {
            console.error('Error in buyNewBonds:', error);
        }
    }


    static async buyBondRepurchase(code) {
        if (!emjyBack.validateKey) {
            emjyBack.log('No valid validateKey');
            return;
        }

        try {
            // 获取最新价格
            const priceData = await feng.getStockSnapshot(code);
            let price = priceData.latestPrice;
            price = priceData.buysells.buy5 === '-' ? priceData.bottomprice : priceData.buysells.buy5;

            // 获取可操作数量
            const amountUrl = `${feng.jywg}Com/GetCanOperateAmount?validatekey=${emjyBack.validateKey}`;
            const amountFd = new FormData();
            amountFd.append('stockCode', code);
            amountFd.append('price', price);
            amountFd.append('tradeType', '0S');

            const amountResponse = await fetch(amountUrl, { method: 'POST', body: amountFd });
            const amountData = await amountResponse.json();

            if (amountData.Status !== 0 || !amountData.Data || amountData.Data.length === 0 || amountData.Data[0].Kczsl <= 0) {
                emjyBack.log('No enough funds to repurchase', JSON.stringify(amountData));
                return;
            }

            const count = amountData.Data[0].Kczsl;

            // 进行国债逆回购交易
            const repurchaseUrl = `${feng.jywg}BondRepurchase/SecuritiesLendingRepurchaseTrade?validatekey=${emjyBack.validateKey}`;
            const repurchaseFd = new FormData();
            repurchaseFd.append('zqdm', code);
            repurchaseFd.append('rqjg', price);
            repurchaseFd.append('rqsl', count);

            emjyBack.log('Executing bond repurchase:', code, price, count);
            const repurchaseResponse = await fetch(repurchaseUrl, { method: 'POST', body: repurchaseFd });
            const repurchaseData = await repurchaseResponse.json();

            if (repurchaseData.Status === 0 && repurchaseData.Data && repurchaseData.Data.length > 0) {
                emjyBack.log('Repurchase successful!', JSON.stringify(repurchaseData));
            } else {
                emjyBack.log('Repurchase failed:', JSON.stringify(repurchaseData));
            }
        } catch (error) {
            emjyBack.log('Error in bond repurchase process:', error);
        }
    }

    static async repayMarginLoan() {
        const validateKey = emjyBack.validateKey;
        if (!validateKey) {
            return;
        }

        const assetsUrl = `${feng.jywg}MarginSearch/GetRzrqAssets?validatekey=${validateKey}`;
        const fd = new FormData();
        fd.append('hblx', 'RMB');

        try {
            // 获取融资融券资产信息
            const assetsResponse = await fetch(assetsUrl, { method: 'POST', body: fd });
            const assetsData = await assetsResponse.json();

            if (assetsData.Status !== 0 || !assetsData.Data) {
                emjyBack.log('Failed to fetch assets:', assetsData);
                return;
            }

            // 计算待还款金额
            const total = -(-assetsData.Data.Rzfzhj - assetsData.Data.Rqxf);
            if (total <= 0 || assetsData.Data.Zjkys - 1 < 0) {
                emjyBack.log('待还款金额:', total, '可用金额:', assetsData.Data.Zjkys);
                return;
            }

            let payAmount = total;
            if (total > assetsData.Data.Zjkys - 0.1) {
                const dateval = new Date().getDate();
                if (dateval > 25 || dateval < 5) {
                    payAmount = assetsData.Data.Zjkys - assetsData.Data.Rzxf - assetsData.Data.Rqxf - assetsData.Data.Rzxf;
                } else {
                    payAmount = (assetsData.Data.Zjkys - 0.11).toFixed(2);
                }
            }

            payAmount = parseFloat(payAmount);
            if (payAmount <= 0) {
                emjyBack.log('Invalid repayment amount:', payAmount);
                return;
            }

            // 提交还款请求
            const repaymentUrl = `${feng.jywg}MarginTrade/submitZjhk?validatekey=${validateKey}`;
            const repaymentFd = new FormData();
            repaymentFd.append('hbdm', 'RMB');
            repaymentFd.append('hkje', payAmount);
            repaymentFd.append('bzxx', ''); // 备注信息

            const repaymentResponse = await fetch(repaymentUrl, { method: 'POST', body: repaymentFd });
            const repaymentData = await repaymentResponse.json();

            if (repaymentData.Status === 0) {
                emjyBack.log('Repayment success!', repaymentData.Data?.[0]?.Sjhkje ?? 'Unknown amount');
            } else {
                emjyBack.log('Repayment failed:', repaymentData);
            }
        } catch (error) {
            emjyBack.log('Repayment process failed:', error);
        }
    }
}
