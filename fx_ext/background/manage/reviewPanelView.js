'use strict';

class ReviewPanelPage extends RadioAnchorPage {
    constructor() {
        super('复盘');
        this.stocksTable = new SortableTable();
        this.container.appendChild(this.stocksTable.container);
        if (emjyManager.delstocks && emjyManager.delstocks.length > 0) {
            this.showStockTable();
        }
        this.scatterDiv = document.createElement('div');
        this.scatterDiv.style.width = '300';
        this.scatterDiv.style.height = '400';
        this.container.appendChild(this.scatterDiv);
    }

    show() {
        super.show();
        this.showScatterChart();
        // if (!this.stocksTable.table) {
        //     this.showStockTable();
        // }
    }

    showStockTable() {
        if (!emjyManager.delstocks || emjyManager.delstocks.length == 0) {
            return;
        }

        this.stocksTable.reset();
        this.stocksTable.setClickableHeader('', '代码', '名称', '日期', '上板强度', '放量程度', '删除日', '走势');
        for (let i = 0; i < emjyManager.delstocks.length; i++) {
            var stocki = emjyManager.delstocks[i];
            var anchor = emjyManager.stockAnchor(stocki.code);
            var chartDiv = document.createElement('div');
            chartDiv.code = stocki.code;
            chartDiv.ztdate = stocki.ztdate;
            chartDiv.style.width = '400';
            chartDiv.style.height = '230';
            chartDiv.onclick = (e) => {
                this.showKlChart(e.target);
            }

            this.stocksTable.addRow(
                i,
                stocki.code,
                anchor,
                stocki.ztdate,
                stocki.zstrength,
                stockVolScales[stocki.vscale],
                stocki.rmvdate,
                chartDiv
                );
        }
    }

    showKlChart(chart) {
        if (chart.childElementCount > 0) {
            console.log(chart);
            return;
        }

        if (emjyManager.klines[chart.code] && emjyManager.klines[chart.code].klines) {
            var idx = emjyManager.klines[chart.code].klines['101'].findIndex(kl => kl.time == chart.ztdate);
            if (idx == -1) {
                emjyManager.klines[chart.code].klines['101'] = [];
                emjyManager.getDailyKlineSinceMonthAgo(chart.code, chart.ztdate);
                return;
            }

            if (idx > 0) {
                idx --;
            }
            var klCht = new KlChartSvg(chart.code);//new KlChartCanvas(chart.code); //
            chart.appendChild(klCht.container);

            klCht.drawKlines(emjyManager.klines[chart.code].klines['101'].slice(idx));
        } else {
            emjyManager.getDailyKlineSinceMonthAgo(chart.code, chart.ztdate);
        }
    }

    getCutEarnRate(code, time) {
        var kline = emjyManager.klines[code].klines['101'];
        var tidx = kline.findIndex(kl => kl.time == time);
        if (tidx < 0) {
            console.log('error: no kline data to check cut price', this.code, time);
            return;
        }
        var price = kline[tidx + 1].o;
        if (price == kline[tidx + 1].l && price == kline[tidx + 1].h) {
            return;
        }
        var c = kline[tidx].c * 0.9;
        var cut = c - kline[tidx].l > 0 ? kline[tidx].l : c.toFixed(2);
        var x = 100 * (kline[tidx + 1].o - cut) / kline[tidx + 1].o;
        var y = price;
        for (let i = tidx + 2; i < kline.length; i++) {
            const kl = kline[i];
            if (kl.o - cut < 0) {
                y = kl.o;
                break;
            }
            if (kl.l - cut < 0) {
                y = kl.l;
                break;
            }
            if (i < tidx + 3) {
                continue;
            }
            if (kl.h - kline[i - 1].h < 0) {
                y = kl.c;
                break;
            }
        }
        y = 100 * (y - price) / price;
        return [x, y];
    }

    showScatterChart() {
        if (!emjyManager.delstocks || emjyManager.delstocks.length == 0) {
            return;
        }

        var chart = new ScatterChart();
        this.scatterDiv.appendChild(chart.container);
        var data = [];
        for (let i = 0; i < emjyManager.delstocks.length; i++) {
            var stocki = emjyManager.delstocks[i];
            var d = this.getCutEarnRate(stocki.code, stocki.ztdate);
            if (d && d.length == 2) {
                data.push(d);
            }
        }
        console.log(data.length);
        console.log(data);
        chart.drawPoints(data);
    }
}

var bankStocks = ['601398','600036','601288','601988','601166','000001','600000','002142',
'601328','601998','600016','601818','601628','601318','000002','601601','600048','601319'];
var maxMS = [['600519','贵州茅台'], 
['601398','工商银行'], 
['300750','宁德时代'], 
['600036','招商银行'], 
['601288','农业银行'], 
['000858','五 粮 液'], 
['601857','中国石油'], 
['601988','中国银行'], 
['601628','中国人寿'], 
['601318','中国平安'], 
['600900','长江电力'], 
['000333','美的集团'], 
['300760','迈瑞医疗'], 
['603288','海天味业'], 
['601012','隆基股份'], 
['601888','中国中免'], 
['002415','海康威视'], 
['600028','中国石化'], 
['600809','山西汾酒'], 
['601166','兴业银行'], 
['000568','泸州老窖'], 
['601088','中国神华'], 
['002475','立讯精密'], 
['000001','平安银行'], 
['600276','恒瑞医药'], 
['300059','东方财富'], 
['002352','顺丰控股'], 
['002594','比亚迪'], 
['603259','药明康德'], 
['601633','长城汽车'], 
['600030','中信证券'], 
['600436','片仔癀'],
['600000','浦发银行'], 
['002142','宁波银行'], 
['600887','伊利股份'], 
['603501','韦尔股份'], 
['600104','上汽集团'], 
['601138','工业富联'], 
['600406','国电南瑞'], 
['300014','亿纬锂能'], 
['000651','格力电器'], 
['601919','中远海控'], 
['002304','洋河股份'], 
['601668','中国建筑'], 
['601899','紫金矿业'], 
['600031','三一重工'], 
['300015','爱尔眼科'], 
['600438','通威股份'], 
['002812','恩捷股份'], 
['600690','海尔智家'], 
['000002','万 科Ａ'], 
['601601','中国太保'], 
['002714','牧原股份'], 
['000792','盐湖股份'], 
['600048','保利发展'], 
['601328','交通银行'], 
['002493','荣盛石化'], 
['000725','京东方Ａ'], 
['600111','北方稀土'], 
['002241','歌尔股份'], 
['600346','恒力石化'], 
['600585','海螺水泥'], 
['600019','宝钢股份'], 
['601998','中信银行'], 
['002371','北方华创'], 
['300124','汇川技术'], 
['300274','阳光电源'], 
['601319','中国人保'], 
['002466','天齐锂业'], 
['600703','三安光电'], 
['601766','中国中车'], 
['600893','航发动力'], 
['601985','中国核电'], 
['600309','万华化学'], 
['000776','广发证券'], 
['002049','紫光国微'], 
['600016','民生银行'], 
['601818','光大银行'], 
['600760','中航沈飞'], 
['601211','国泰君安'], 
['601816','京沪高铁'], 
['603799','华友钴业'], 
['600999','招商证券'], 
['601688','华泰证券'], 
['000063','中兴通讯'], 
['600018','上港集团'], 
['600745','闻泰科技'], 
['002129','中环股份'], 
['603260','合盛硅业'], 
['600050','中国联通'], 
['002027','分众传媒'], 
['002311','海大集团'], 
['002460','赣锋锂业'], 
['601225','陕西煤业'], 
['603806','福斯特'], 
['600588','用友网络'], 
['601390','中国中铁'], 
['300122','智飞生物'], 
['000166','申万宏源'], 
['600025','华能水电'], 
['300433','蓝思科技'], 
['601066','中信建投'], 
['603659','璞泰来'], 
['601238','广汽集团'], 
['603986','兆易创新'], 
['002709','天赐材料'], 
['002230','科大讯飞'], 
['300450','先导智能'], 
['601877','正泰电器'], 
['002179','中航光电'], 
['002821','凯莱英'], 
['601100','恒立液压'], 
['600837','海通证券'], 
['001979','招商蛇口'], 
['600011','华能国际'], 
['002736','国信证券'], 
['000768','中航西飞'], 
['000661','长春高新'], 
['002271','东方雨虹'], 
['688981','中芯国际']];
