'use strict';


class feng {
    constructor() {
        throw new Error('Cannot instantiate StaticClass');
    }

    static jywg = 'https://jywg.eastmoneysec.com/'; //'https://jywg.18.cn/';

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
                console.log(robj);
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
            const priceData = await this.tradeClient.getRtPrice(code);
            let price = priceData.cp;
            price = priceData.b5 === '-' ? priceData.bp : priceData.b5;

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
