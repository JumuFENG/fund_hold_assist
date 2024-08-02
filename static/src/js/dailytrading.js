'use strict';

GlobalManager.prototype.saveToLocal = function (data) {
    localforage.ready(() => {
        for (const k in data) {
            if (Object.hasOwnProperty.call(data, k)) {
                localforage.setItem(k, JSON.stringify(data[k]));
            }
        }
    });
}

GlobalManager.prototype.getFromLocal = function(key, cb) {
    localforage.ready(() => {
        localforage.getItem(key).then((val)=>{
            var item = null;
            if (!val) {
                console.error('getItem', key, '=', val);
            } else {
                item = JSON.parse(val);
            }
            if (typeof(cb) === 'function') {
                cb(item);
            }
        }, ()=> {
            console.log('getItem error!', arguments);
        });
    });
}

GlobalManager.prototype.removeLocal = function(key) {
    localforage.removeItem(key);
}

GlobalManager.prototype.clearLocalStorage = function() {
    localforage.keys().then(ks => {
        console.log(ks);
    });
}

class DailyHome {
    constructor() {
        this.pickingPlates = [];
    }

    initUi() {
        this.headerArea = document.querySelector('#header-area');
        this.bodyArea = document.querySelector('#body-area');
        this.footerArea = document.querySelector('#footer-area');
        this.platesManagePanel = new PlatesManagePanel(document.querySelector('#plates-manage-panel'));
        this.platesManagePanel.loadPlates();

        var testBtn = document.createElement('button');
        testBtn.onclick = _ => {
            this.updateTlineChart();
        }
        testBtn.textContent = 'Go';
        this.headerArea.appendChild(testBtn);
        this.setupReresh();
    }

    toggleTimer(act) {
        if (!this.refreshInterval && act == 'start') {
            this.refreshInterval = setInterval(() => {
                this.updateBanner();
                this.updateEmotions();
                this.updatePlateList();
            }, 60000);
        } else if (this.refreshInterval && act == 'stop') {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    setupReresh() {
        const time_tasks = [{'start': '9:15:01', 'stop': '11:30'}, {'start': '12:59:01', 'stop': '15:01'}];
        var now = new Date();
        for (const actions of time_tasks) {
            var stopTicks = new Date(now.toDateString() + ' ' + actions['stop']) - now;
            if (stopTicks > 0) {
                setTimeout(() => {
                    this.toggleTimer('start');
                    this.updateStockBasic();
                }, new Date(now.toDateString() + ' ' + actions['start']) - now);
                setTimeout(() => {
                    this.toggleTimer('stop');
                }, new Date(now.toDateString() + ' ' + actions['stop']) - now);
            } else {console.log('stop time expired', actions);}
        }
        this.emotion_zdgraph = document.createElement('div');
        this.emotion_zdgraph.style.width = '30%';
        this.emotion_zdgraph.style.height = '100%';
        this.emotion_balance = document.createElement('div');
        this.emotion_balance.style.width = '82px';
        this.emotion_balance.style.textAlign = 'center';
        this.headerArea.appendChild(this.emotion_balance);
        this.headerArea.appendChild(this.emotion_zdgraph);
        this.updateBanner();
        this.updateEmotions();
        this.updatePlateList();
        this.updateStockBasic();

        if (!this.stockTLineChart) {
            this.stockTLineChart = new StockTimeLine(document.querySelector('#charts-panel'));
            document.querySelector('#replay-tline-charts').onclick = e => this.stockTLineChart.replay();
        }
        this.setupTlineUpdater();
        this.updateTlineChart();
    }

    setupTlineUpdater() {
        setInterval(() => {
            if (this.refreshInterval && emjyBack.market_in_trading) {
                this.updateTlineChart();
            }
        }, 5000);
    }

    updateBanner() {
        var indices = 'sh000001,sz399001,sh000905,sz399006,sh000300,899050.BJ'
        var indiceUrl = `https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=secu_name,secu_code,trade_status,change,change_px,last_px&os=web&secu_codes=${indices}&sv=7.7.5`
        var fUrl = emjyBack.fha.server + 'api/get?url=' + btoa(indiceUrl)+ '&host=x-quote.cls.cn';
        utils.get(fUrl, null, emo => {
            this.showBanner(JSON.parse(emo));
        });
    }

    showBanner(indice_info) {
        if (!this.bannerRoot) {
            this.bannerRoot = document.querySelector('#banner');
        }
        this.bannerRoot.innerHTML = '';
        var ovHtml = ''
        for (const c in indice_info.data) {
            let secuinfo = indice_info.data[c];
            let arrow = secuinfo.change == 0 ? '' : secuinfo.change > 0 ? '▲' : '▼';
            let color = secuinfo.change == 0 ? '#cccccc' : secuinfo.change > 0 ? '#de0422' : '#52c2a3';
            ovHtml += `${secuinfo.secu_name} <span style='color: ${color}; font-size: 14px; margin-right: 30px' > ${secuinfo.last_px} ${arrow} ${(secuinfo.change*100).toFixed(2) + '%'}</span>`
        }
        this.bannerRoot.innerHTML = ovHtml;
        emjyBack.market_in_trading = ['TRADE'].includes(indice_info.data['sh000001'].trade_status);
    }

    updateEmotions() {
        var emtionUrl = 'https://x-quote.cls.cn/v2/quote/a/stock/emotion?app=CailianpressWeb&os=web&sv=7.7.5';
        var fUrl = emjyBack.fha.server + 'api/get?url=' + btoa(emtionUrl)+ '&host=x-quote.cls.cn';
        utils.get(fUrl, null, emo => {
            this.showEmotion(JSON.parse(emo));
        });
    }

    updatePlateList() {
        const pways = ['change', 'limit_up_num', 'main_fund_diff'];
        this.fetchingPlates = {};
        for (let w of pways) {
            var pUrl = 'https://x-quote.cls.cn/web_quote/plate/plate_list?app=CailianpressWeb&os=web&page=1&rever=1&sv=7.7.5&type=concept&way=' + w;
            var fUrl = emjyBack.fha.server + 'api/get?url=' + btoa(pUrl)+ '&host=x-quote.cls.cn';
            utils.get(fUrl, null, pl => {
                this.fetchingPlates[w] = JSON.parse(pl);
                if (Object.keys(this.fetchingPlates).length == 3) {
                    let plates = [];
                    let secu_codes = new Set();
                    for (const p in this.fetchingPlates) {
                        for (const secu of this.fetchingPlates[p].data.plate_data) {
                            if (!secu_codes.has(secu.secu_code)) {
                                plates.push(secu);
                                secu_codes.add(secu.secu_code);
                            }
                        }
                    }
                    this.showPlateList(plates);
                }
            });
        }
    }

    updateStockBasic() {
        var scodes = ['sh600611','sz001379','sz000712','sh600501','sh603988','sz000880','sz002685','sh600386'].join(',');
        var bUrl = `https://x-quote.cls.cn/quote/stocks/basic?app=CailianpressWeb&fields=open_px,av_px,high_px,low_px,change,change_px,down_price,cmc,business_amount,business_balance,secu_name,secu_code,trade_status,secu_type,preclose_px,up_price,last_px&os=web&secu_codes=${scodes}&sv=7.7.5`;
        var fUrl = emjyBack.fha.server + 'api/get?url=' + btoa(bUrl)+ '&host=x-quote.cls.cn';
        utils.get(fUrl, null, b => {
            if (!emjyBack.stock_basics) {
                emjyBack.stock_basics = {};
            }
            var bdata = JSON.parse(b);
            bdata = bdata.data;
            for (const s in bdata) {
                emjyBack.stock_basics[s] = bdata[s];
                emjyBack.stock_basics[s].up_limit = Math.round(bdata[s].change_px*100/bdata[s].preclose_px)/100;
            }
        });
    }

    updateTlineChart() {
        for (let c of ['sh600611','sz001379','sz000712','sh600501','sh603988','sz000880','sz002685','sh600386']) {
            var tlineUrl = `https://x-quote.cls.cn/quote/stock/tline?app=CailianpressWeb&fields=date,minute,last_px,business_balance,business_amount,open_px,preclose_px,av_px&os=web&secu_code=${c}&sv=7.7.5`;
            var fUrl = emjyBack.fha.server + 'api/get?url=' + btoa(tlineUrl)+ '&host=x-quote.cls.cn';
            utils.get(fUrl, null, tl => {
                var tldata = JSON.parse(tl);
                this.stockTLineChart.addData({line: {code: c, line: tldata.data.line}});
            });
        }
    }

    showEmotion(emotionobj) {
        if (!this.emotionBlock) {
            this.emotionBlock = new EmotionBlock(this.emotion_zdgraph, this.emotion_balance);
        }
        this.emotionBlock.updateEmotionContent(emotionobj);
    }

    showPlateList(plates) {
        if (!this.plateListTable) {
            this.plateListTable = new PlateListTable(document.querySelector('#plate-list-table'));
            this.plateListTable.rowClickCallback = (code, plate) => {
                this.pickingPlates.push(code);
                this.platesManagePanel.addCard(plate);
            }
        }
        this.plateListTable.updateTableContent(plates);
        if (this.platesManagePanel) {
            this.platesManagePanel.updatePlatesInfo(plates);
        }
    }
}


class PlateListTable {
    constructor(container, rowcb) {
        this.container = container;
        this.rowClickCallback = rowcb;
        this.currentSortColumn = null;
        this.currentSortOrder = 'desc';
        this.initializeTable();
    }

    initializeTable() {
        const tableHtml = `
            <table id="data-table">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th class="sortable" data-column="change">涨跌%</th>
                        <th class="sortable" data-column="main_fund_diff">净流入</th>
                        <th class="sortable" data-column="limit_up_num">涨停</th>
                        <th class="sortable" data-column="limit_up">上涨</th>
                        <th class="sortable" data-column="limit_down">下跌</th>
                        <th class="sortable" data-column="limit_down_num">跌停</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        `;
        this.container.innerHTML = tableHtml;

        // 表头排序功能
        this.container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-column');
                let order = 'desc';
                if (this.currentSortColumn === column) {
                    order = this.currentSortOrder === 'desc' ? 'asc' : 'desc';
                }
                this.sortTable(column, order);
            });
        });
    }

    addTableContent(data) {
        const tableBody = this.container.querySelector('#data-table tbody');
        tableBody.innerHTML = ''; // 清空表格内容

        data.forEach(item => {
            const formattedFund = this.formatMainFundDiff(item.main_fund_diff);
            const formattedChange = this.formatChange(item.change);
            let changeColor = item.change == 0 ? '' : (item.change > 0 ? 'red' : 'green');
            let fundColor = item.main_fund_diff > 0 ? 'red' : 'green';
            const row = `<tr>
                <td class="name" data-code="${item.secu_code}">${item.secu_name}</td>
                <td class="${changeColor} center">${formattedChange}</td>
                <td class="${fundColor} center">${formattedFund}</td>
                <td class="red center">${item.limit_up_num}</td>
                <td class="red center">${item.limit_up}</td>
                <td class="green center">${item.limit_down}</td>
                <td class="green center">${item.limit_down_num}</td>
            </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        // 点击名称时在新标签页打开详情页
        this.container.querySelectorAll('.name').forEach(nameCell => {
            nameCell.addEventListener('click', () => {
                const code = nameCell.getAttribute('data-code');
                window.open(`https://www.cls.cn/plate?code=${code}`, '_blank');
            });
        });

        // 行点击事件
        this.container.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                if (this.rowClickCallback) {
                    var secu_code = row.firstElementChild.getAttribute('data-code');
                    this.rowClickCallback(secu_code, this.data.find(x=>x.secu_code==secu_code));
                }
            });
        });
    }

    formatMainFundDiff(value) {
        if (Math.abs(value) >= 1e7) {
            return (value / 1e8).toFixed(2) + ' 亿';
        } else if (Math.abs(value) >= 1e4) {
            return (value / 1e4).toFixed(2) + ' 万';
        } else {
            return value;
        }
    }

    formatChange(value) {
        return (value * 100).toFixed(2);
    }

    sortTable(column, order) {
        if (typeof(column) == 'string') {
            column = [column];
        }

        this.currentSortColumn = column[0];
        this.currentSortOrder = order;

        this.data.sort((a, b) => {
            let valA = a[column[0]];
            let valB = b[column[0]];
            let equal = valA - valB == 0;
            let desc = valB - valA > 0;
            for (let i = 1; equal && i < column.length; i++) {
                if (a[column[i]] - b[column[i]] != 0) {
                    equal = false;
                    desc = b[column[i]] - a[column[i]];
                    break;
                }
            }
            return (order == 'desc') == desc;
        });

        this.addTableContent(this.data);
    }

    updateTableContent(newData) {
        this.data = newData;
        if (this.currentSortColumn) {
            this.sortTable(this.currentSortColumn, this.currentSortOrder);
        } else {
            this.sortTable(['limit_up_num', 'change', 'main_fund_diff'], 'desc');
        }
    }
}


class EmotionBlock {
    constructor(chart_container, info_block) {
        this.chart_container = chart_container;
        this.info_block = info_block;
    }

    updateEmotionContent(emotionobj) {
        if (!this.emotionChart) {
            this.emotionChart = echarts.init(this.chart_container);
        }

        var data = emotionobj.data.up_down_dis;
        var categories = ['涨停', '+10%', '+8%', '+6%', '+4%', '+2%', '平盘', '-2%', '-4%', '-6%', '-8%', '-10%', '跌停'];
        var values = [data.up_num, data.up_10, data.up_8, data.up_6, data.up_4, data.up_2, data.flat_num, data.down_2, data.down_4, data.down_6, data.down_8, data.down_10, data.down_num];

        // 定义颜色映射函数
        function getColor(value, min, max, baseColor) {
            var intensity = (max - value) / (max - min);
            if (baseColor === 'red') {
                return `rgb(${160 + intensity * 95}, 0, 0)`;
            } else if (baseColor === 'green') {
                return `rgb(0, ${160 + intensity * 95}, 0)`;
            } else {
                return '#cccccc';
            }
        }
    
        var maxUp = Math.max(data.up_num, data.up_10, data.up_8, data.up_6, data.up_4, data.up_2);
        var maxDown = Math.max(data.down_num, data.down_10, data.down_8, data.down_6, data.down_4, data.down_2);
        var maxValue = Math.max(maxUp, maxDown);
        var minValue = 0;
    
        var colors = [
            getColor(data.up_num, minValue, maxUp, 'red'),
            getColor(data.up_10, minValue, maxUp, 'red'),
            getColor(data.up_8, minValue, maxUp, 'red'),
            getColor(data.up_6, minValue, maxUp, 'red'),
            getColor(data.up_4, minValue, maxUp, 'red'),
            getColor(data.up_2, minValue, maxUp, 'red'),
            '#cccccc', // 平盘
            getColor(data.down_2, minValue, maxDown, 'green'),
            getColor(data.down_4, minValue, maxDown, 'green'),
            getColor(data.down_6, minValue, maxDown, 'green'),
            getColor(data.down_8, minValue, maxDown, 'green'),
            getColor(data.down_10, minValue, maxDown, 'green'),
            getColor(data.down_num, minValue, maxDown, 'green')
        ];
        var btmFontSize = 15;

        var option = {
            tooltip: {
                show: false
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
            },
            series: [{
                type: 'bar',
                data: values,
                itemStyle: {
                    color: function(params) {
                        return colors[params.dataIndex];
                    }
                },
                label: {
                    show: true,
                    position: 'top'
                }
            }],
            graphic: [
                {
                    type: 'text',
                    left: '10%',
                    bottom: 20,
                    style: {
                        text: `上涨: ${data.rise_num} 家`,
                        fill: '#de0422',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '30%',
                    bottom: 20,
                    style: {
                        text: `平盘: ${data.flat_num} 家`,
                        fill: '#666',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '50%',
                    bottom: 20,
                    style: {
                        text: `停牌: ${data.suspend_num} 家`,
                        fill: '#666',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '70%',
                    bottom: 20,
                    style: {
                        text: `下跌: ${data.fall_num} 家`,
                        fill: '#52c2a3',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                }
            ]
        };

        this.emotionChart.setOption(option);

        var bcolor = emotionobj.data.shsz_balance_change_px.includes('+') ? '#de0422' : '#52c253';
        this.info_block.innerHTML = `<br>
        <div>总成交额</div><div style='color: ${bcolor}; font-size: 18px'>${emotionobj.data.shsz_balance}</div>
        <div>较上日</div><div style='color: ${bcolor}; font-size: 18px'>${emotionobj.data.shsz_balance_change_px}</div>
        <br>
        <div>涨停数</div><div style='color: #de0422; font-size: 18px'>${emotionobj.data.up_ratio_num}</div>
        <div>开板数</div><div style='color: #de0422; font-size: 18px'>${emotionobj.data.up_open_num}</div>
        <div>封板率</div><div style='color: #de0422; font-size: 18px'>${emotionobj.data.up_ratio}</div>
        `;
    }
}


class StockTimeLine {
    constructor(parent) {
        this.container = document.createElement('div');
        // this.container.style.height = '450px';
        // this.container.style.width = '550px';
        this.container.style.height = '560px';
        this.container.style.width = '750px';
        parent.appendChild(this.container);
        this.tchart = echarts.init(this.container);
        this.initOptions();
        this.stock_lines = {};
    }

    initOptions() {
        var option = {
            tooltip: {
                trigger: 'axis'
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: 240,
                interval: 30,
                axisLabel: {
                    formatter: function (value) {
                        if (value % 30 != 0) {
                            return '';
                        }
                        if (value == 120) return '11:30/13:00';
                        var minute = value > 120 ? value + 660 : value + 570;
                        return Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    }
                }
            },
            yAxis: [
                {
                    type: 'value',
                    min: -0.109,
                    max: 0.109,
                    splitLine: { show: true },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                },
                {
                    type: 'value',
                    min: -0.21,
                    max: 0.21,
                    splitLine: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                },
                {
                    type: 'value',
                    min: -0.31,
                    max: 0.31,
                    splitLine: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                }
            ],
            series: []
        }
        this.tchart.setOption(option);
    }

    addData(newData) {
        var lineData = newData.line;
        var secu_code = lineData.code;
        var addnew = false;
        if (!this.stock_lines[secu_code]) {
            this.stock_lines[secu_code] = [];
            addnew = true;
        }
        let last_minute = this.stock_lines[secu_code].length == 0 ? 0 : this.stock_lines[secu_code].pop().minute;
        var preclose_px = emjyBack.stock_basics[secu_code].preclose_px;
        lineData.line.forEach(item => {
            if (item.minute < last_minute) {
                return;
            }
            var m1 = Math.floor(item.minute / 100);
            var m2 = item.minute % 100;
            item.x = m1 * 60 + m2 - (m1 < 12 ? 570 : 660);
            item.change = (item.last_px - preclose_px)/preclose_px;
            this.stock_lines[secu_code].push(item);
        });
        var eventData = newData.events;

        if (addnew) {
            this.addNewLine(secu_code, this.stock_lines[secu_code], emjyBack.stock_basics[secu_code].up_limit);
        } else {
            this.updateLine(secu_code, this.stock_lines[secu_code]);
        }
    }

    addNewLine(secu_code, linedata, limit=0.1) {
        let yAxisIndex = 0;
        if (limit > 0.28) {
            yAxisIndex = 2;
        } else if (limit > 0.15) {
            yAxisIndex = 1;
        } else {
            yAxisIndex = 0;
        }

        var series = {
            name: secu_code,
            type: 'line',
            data: linedata.map(item => [item.x, item.change]),
            yAxisIndex: yAxisIndex,
            showSymbol: false,
            lineStyle: {width: 1},
            endLabel: {
                show: true,
                color: 'inherit',
                formatter: function(params) {
                    return emjyBack.stock_basics[params['seriesName']].secu_name;
                }
            },
            labelLayout: {
                moveOverlap: 'shiftY'
            }
            // markPoint: {
            //     data: linedata.map(item => ({
            //         coord: [item.x, item.change],
            //         label: {
            //             show: true,
            //             formatter: `{c}`
            //         }
            //     }))
            // }
        };
        var seriesList = this.tchart.getOption().series;
        seriesList.push(series)
        this.tchart.setOption({
            series: seriesList
        });
    }

    updateLine(secu_code, linedata) {
        var series = this.tchart.getOption().series;
        var targetSeries = series.find(s => s.name === secu_code);
        if (targetSeries) {
            targetSeries.data = linedata.map(item => [item.x, item.change]);
            this.tchart.setOption({ series: series });
        }
    }

    replay() {
        var duration_ms = 30000;
        var option = this.tchart.getOption();
        var data = {}
        var dataLen = 0;
        if (option.series) {
            option.series.forEach(series => {
                data[series.name] = series.data;
                if (data[series.name].length > dataLen) {
                    dataLen = data[series.name].length;
                }
            });
        }
        var x = 0;
        const ntick = 50;
        var animationInterval = setInterval(_=>{
            option.series.forEach(series => {
                series.data = data[series.name].filter(item => item[0] < x || (item.value && item.value[0] < x));
            });
            x += option.xAxis[0].max / (duration_ms/ntick);
            this.tchart.setOption(option);
            if (!option.series.find(series => series.data.length < data[series.name].length)) {
                clearInterval(animationInterval);
            }
        }, ntick);
    }
}


class SecuCard {
    constructor(secu) {
        this.plate = secu;
        this.element = this.createCardElement();
    }

    createCardElement() {
        const card = document.createElement('div');
        card.classList.add('subcard');
        card.innerHTML = `
        <div class="subcard-title">${this.plate.secu_name}</div>
        <div class="subcard-info">${this.plate.secu_code}</div>
        `;

        return card;
    }

    render() {
        return this.element;
    }
}

class PlateCard {
    constructor(plate, isMain = true) {
        this.isMain = isMain;
        this.plate = plate;
        this.createCardElement();
    }

    createCardElement() {
        this.element = document.createElement('div');
        this.element.classList.add('card');
        if (this.isMain) {
            this.element.classList.add('main');
        }
        this.element.draggable = true;

        this.element.addEventListener('dragstart', this.onDragStart.bind(this));
        this.element.addEventListener('dragend', this.onDragEnd.bind(this));

        return this.updateCardContent(this.plate);
    }

    updateCardContent(plate) {
        function formatMainFundDiff(value) {
            if (Math.abs(value) >= 1e7) {
                return (value / 1e8).toFixed(2) + '亿';
            } else if (Math.abs(value) >= 1e4) {
                return (value / 1e4).toFixed(2) + '万';
            } else {
                return value;
            }
        }
        if (!plate) {
            return this.element;
        }

        this.plate = plate;
        let changeColor = this.plate.change == 0 ? '' : (this.plate.change > 0 ? 'red' : 'green');
        let fundColor = this.plate.main_fund_diff > 0 ? 'red' : 'green';
        this.element.innerHTML = `
        <div class="card-title">${this.plate.secu_name}</div>
        <div class="card-info">
            <div class="center">
                <span class="${changeColor}">${(this.plate.change*100).toFixed(2) + '%'}</span>
                <span class="${fundColor}">${formatMainFundDiff(this.plate.main_fund_diff)}</span>
                 ${this.plate.limit_up_num}</div>
        </div>
        `;

        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.innerHTML = `<div class="center">
            <div class="card-info">
                <div class="left-info">涨跌幅：<span class="${changeColor}">${(this.plate.change*100).toFixed(2) + '%'}</span></div>
                <div class="left-info">涨跌停：<span class="red">${this.plate.limit_up_num}</span>/${this.plate.limit_down_num}</div>
            </div>
            <div class="card-info">
                <div class="right-info">净流入：<span class="${fundColor}">${formatMainFundDiff(this.plate.main_fund_diff)}</span></div>
                <div class="right-info">涨跌比：<span class="red">${this.plate.limit_up}</span>/${this.plate.limit_down}</div>
            </div>
        </div>
        `
        this.element.appendChild(tooltip);
        return this.element;;
    }

    onDragStart(event) {
        event.dataTransfer.setData('text/plain', JSON.stringify(this.plate));
        event.dataTransfer.setData('isMain', this.isMain);
        event.dataTransfer.setData('originalContainerId', this.element.closest('.container').id);
        event.dataTransfer.effectAllowed = 'move';
        this.element.classList.add('dragging');

        // 显示隐藏区域
        if (!this.panel) {
            this.panel = this.element.closest('.panel');
        }
        if (this.panel) {
            const hiddenArea = this.panel.parentElement.querySelector('.hidden-area');
            hiddenArea.parentElement.removeChild(hiddenArea);
            const currentContainer = this.element.closest('.container');
            currentContainer.parentElement.insertBefore(hiddenArea, currentContainer.nextElementSibling);
            hiddenArea.style.display = 'block';
        }
    }

    onDragEnd(event) {
        this.element.classList.remove('dragging');

        // 隐藏隐藏区域
        if (this.panel) {
            const hiddenArea = this.panel.parentElement.querySelector('.hidden-area');
            hiddenArea.style.display = 'none';
        }
    }

    render() {
        return this.element;
    }
}

class PlatesContainer {
    constructor(panel) {
        this.panel = panel;
        this.cards = [];
        this.subcards = [];
        this.element = this.createContainerElement();
        this.element.containerInstance = this; // 绑定容器实例
    }

    createContainerElement() {
        const container = document.createElement('div');
        container.classList.add('container');
        container.id = 'container_' + Math.random().toString(36).substring(7);

        const actionArea = document.createElement('div');
        actionArea.classList.add('action-area');
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        actionArea.appendChild(addButton);

        const infoArea = document.createElement('div');
        infoArea.classList.add('info-area');
        infoArea.id = 'info-area_cards';

        const subArea = document.createElement('div');
        subArea.classList.add('info-area');
        subArea.id = 'info-area_subcards';

        container.appendChild(actionArea);
        container.appendChild(infoArea);
        container.appendChild(subArea);

        container.addEventListener('dragover', this.onDragOver.bind(this));
        container.addEventListener('drop', this.onDrop.bind(this));

        return container;
    }

    addCard(plate) {
        if (this.cards.find(c=> c.plate.secu_code == plate.secu_code)) {
            return;
        }
        const card = new PlateCard(plate, this.cards.length === 0);
        this.cards.push(card);
        if (card.isMain) {
            this.mainsecu = card.plate.secu_code
        }
        this.updateInfoArea();
    }

    updateInfoArea(plates) {
        const infoArea = this.element.querySelector('#info-area_cards');
        infoArea.innerHTML = '';
        if (!plates || plates.length == 0) {
            this.cards.forEach(card => infoArea.appendChild(card.render()));
            return;
        }
        this.cards.forEach(card => infoArea.appendChild(card.updateCardContent(plates.find(p => p.secu_code == card.plate.secu_code))));
    }

    addSubCard(secu) {
        if (this.subcards.find(c => c.plate.secu_code == secu.secu_code)) {
            return;
        }
        const card = new SecuCard(secu);
        this.subcards.push(card);
        this.updateSubArea();
    }

    updateSubArea() {
        const subArea = this.element.querySelector('#info-area_subcards');
        subArea.innerHTML = '';
        this.subcards.forEach(card => subArea.appendChild(card.render()));
    }

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    onDrop(event) {
        event.preventDefault();
        const plateData = JSON.parse(event.dataTransfer.getData('text/plain'));

        const originalContainerId = event.dataTransfer.getData('originalContainerId');
        if (originalContainerId === this.element.id) {
            return;
        }

        this.addCard(plateData);

        const originalContainer = document.getElementById(originalContainerId).containerInstance;
        if (originalContainer.cards.length === 1) {
            this.panel.removeContainer(originalContainer);
        }
    }

    removeCard(secu_code) {
        this.cards = this.cards.filter(card => card.plate.secu_code !== secu_code);
        if (!this.cards.find(card => card.isMain)) {
            this.cards[0].isMain = true;
            this.mainsecu = this.cards[0].secu_code;
        }
        this.updateInfoArea();
    }

    render() {
        return this.element;
    }
}

class PlatesManagePanel {
    constructor(parent) {
        this.parent = parent;
        this.containers = [];
        this.element = this.createPanelElement();
        this.hiddenArea = this.createHiddenArea();
        parent.appendChild(this.element);
        this.element.appendChild(this.hiddenArea);
    }

    savePlates() {
        if (!this.initialized) {
            return;
        }
        var date = new Date().toLocaleDateString('zh', {year:'numeric', day:'2-digit', month:'2-digit'}).replace(/\//g, '-');
        var selectedPlates = {date, plates: []};
        this.containers.forEach(con=>{
            let splate = {plates: [], stocks: []};
            con.cards.forEach(c=>{
                if (c.isMain) {
                    splate.mainsecu = c.plate.secu_code;
                }
                splate.plates.push(c.plate);
            });
            con.subcards.forEach(s=>{
                splate.stocks.push(s.plate);
            });
            selectedPlates.plates.push(splate);
        });
        emjyBack.saveToLocal({'selected_plates': selectedPlates});
    }

    loadPlates() {
        emjyBack.getFromLocal('selected_plates', sp => {
            if (sp) {
                var date = sp.date;
                sp.plates.forEach(p=>{
                    if (p.plates.length == 0) {
                        return;
                    }
                    const container = new PlatesContainer(this);
                    p.plates.forEach(c=>{
                        container.addCard(c);
                    });
                    p.stocks.forEach(s=> {
                        container.addSubCard(s);
                    });
                    this.containers.push(container);
                    this.element.appendChild(container.render());
                });
            }
            this.initialized = true;
        });
    }

    createPanelElement() {
        const panel = document.createElement('div');
        panel.classList.add('panel');
        return panel;
    }

    createHiddenArea() {
        const hiddenArea = document.createElement('div');
        hiddenArea.classList.add('hidden-area');
        hiddenArea.textContent = 'Drop here to delete';
        hiddenArea.style.display = 'none';

        hiddenArea.addEventListener('dragover', this.onDragOver.bind(this));
        hiddenArea.addEventListener('drop', this.onDrop.bind(this));

        return hiddenArea;
    }

    addCard(plate) {
        if (this.containers.find(con=>con.mainsecu == plate.secu_code)) {
            return;
        }

        const container = new PlatesContainer(this);
        container.addCard(plate);
        this.containers.push(container);
        this.element.appendChild(container.render());
        this.savePlates();
    }

    addSubCard(mainsecu, subplate) {
        const container = this.containers.find(c => c.mainsecu == mainsecu);
        if (container) {
            container.addSubCard(subplate);
        }
        this.savePlates();
    }

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    onDrop(event) {
        event.preventDefault();
        const plateData = JSON.parse(event.dataTransfer.getData('text/plain'));
        const isMain = event.dataTransfer.getData('isMain') === 'true';
        this.deleteCard(plateData, isMain);
        this.hiddenArea.style.display = 'none';
    }

    deleteCard(plateData, isMain) {
        for (const container of this.containers) {
            const index = container.cards.findIndex(card => card.plate.secu_code === plateData.secu_code && card.isMain === isMain);
            if (index !== -1) {
                container.cards.splice(index, 1);
                container.updateInfoArea();
                if (container.cards.length === 0) {
                    this.removeContainer(container);
                }
                break;
            }
        }
        this.savePlates();
    }

    removeContainer(container) {
        const index = this.containers.indexOf(container);
        if (index > -1) {
            this.containers.splice(index, 1);
            this.element.removeChild(container.render());
        }
        this.savePlates();
    }

    updatePlatesInfo(plates) {
        this.containers.forEach(container => container.updateInfoArea(plates));
    }
}


class DailyDataAnalyzer {
    constructor() {
        this.chartsDiv = null;
    }

    initUi() {
        var iptDiv = document.createElement('div');
        var iptFile = document.createElement('input');
        iptFile.type = 'file';
        iptFile.addEventListener('change', e => {
            e.target.files[0].text().then(text => {
                this.onDailyTradingData(e.target.files[0].name, JSON.parse(text));
            });
        });
        iptDiv.appendChild(document.createTextNode('Please select the daily trading data.'));
        iptDiv.appendChild(iptFile);
        document.body.appendChild(iptDiv);
        this.chartsDiv = document.createElement('div');
        document.body.appendChild(this.chartsDiv);
    }

    onDailyTradingData(name, dailyData) {
        // this.drawOffsetSingleLine(name.substr(0, 15), dailyData);
        // this.drawOffsetPriceLine(name.substr(0, 15), dailyData);
        this.drawPriceWithTrend(name.substr(0, 15), dailyData);
    }

    drawOffsetSingleLine(name, dailyData) {
        var paoffset = [];
        for (var i = 0; i < dailyData.length; i++) {
            paoffset.push(100 * (dailyData[i][0] - dailyData[i][1]) / dailyData[i][1]);
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new SingleLineChart(chartDiv);
            gchart.drawLines(name, paoffset);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }

    drawOffsetPriceLine(name, dailyData) {
        var paoffset = [];
        for (var i = 0; i < dailyData.length; i++) {
            paoffset.push([100 * (dailyData[i][0] - dailyData[i][1]) / dailyData[i][1], parseFloat(dailyData[i][0])]);
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new TwoLineChart(chartDiv);
            gchart.drawLines(name, paoffset);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }

    drawPriceWithTrend(name, dailyData) {
        var points = [];
        for (var i = 0; i < dailyData.length; i++) {
            points.push(parseFloat(dailyData[i][0]));
        };
        
        if (googleChartLoaded) {
            var chartDiv = document.createElement('div');
            this.chartsDiv.appendChild(chartDiv);
            var gchart = new PriceTrendChart(chartDiv);
            gchart.drawLines(name, points);
        } else {
            console.log('google Chart Not Loaded!');
        };
    }
};

class LineChart {
    constructor(chart_div) {
        this.chart = new google.visualization.LineChart(chart_div);
    }

    createOption(name) {
        this.options = null;
    }

    createDataTable(points) {
        this.data = null;
    }

    drawLines(name, points) {
        this.createOption(name);
        this.createDataTable(points);
        if (this.data && this.options) {
            this.chart.draw(this.data, this.options);
        };
    }
}

class SingleLineChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0
                }
            }
        };
    }

    createDataTable(points) {
        this.data = new google.visualization.DataTable();
        this.data.addColumn('string', 'order');
        this.data.addColumn('number', 'offset');
        var rows = [];
        for (var i = 0; i < points.length; i++) {
            rows.push(['' + i, points[i]]);
        };
        this.data.addRows(rows);
    }
};

class TwoLineChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                },
                1: {}
            },
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    targetAxisIndex: 1
                }
            }
        };
    }

    createDataTable(ptpair) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'order');
        data.addColumn('number', 'offset');
        data.addColumn('number', 'price');

        var rows = [];
        for (var i = 0; i < ptpair.length; i++) {
            rows.push(['' + i, ptpair[i][0], ptpair[i][1]]);
        };
        data.addRows(rows);
        this.createOption(name);
        this.chart.draw(data, this.options);
    }
}

class PriceTrendChart extends LineChart {
    createOption(name) {
        this.options = {
            title: name,
            width: '100%',
            height: '100%',
            crosshair: { trigger: 'both', opacity: 0.5},
            legend: { position: 'top'},
            hAxis: {
                slantedText:true,
                slantedTextAngle:-30
            },
            vAxes: {
                0: {
                }
            },
            series: {
                0: {
                    targetAxisIndex: 0
                },
                1: {
                    targetAxisIndex: 0
                },
                2: {
                    targetAxisIndex: 0
                }
            }
        };
    }

    nextPeeks(peeks) {
        if (peeks.length <= 2) {
            return peeks;
        };

        var pks = [peeks[0]];
        var increasing = peeks[0][0] < peeks[1][0];
        var lastIdx = 0;
        for (var i = 1; i < peeks.length - 1; i += 2) {
            if (i + 2 > peeks.length - 1) {
                lastIdx = i;
                break;
            };
            if (increasing) {
                if (peeks[i][0] <= peeks[i + 2][0]) {
                    continue;
                } else {
                    pks.push(peeks[i]);
                    increasing = false;
                    i--;
                };
            } else {
                if (peeks[i][0] >= peeks[i + 2][0]) {
                    continue;
                } else {
                    pks.push(peeks[i]);
                    increasing = true;
                    i--;
                };
            };
        };
        
        if (lastIdx > 0) {
            for (var i = lastIdx; i < peeks.length; i++) {
                pks.push(peeks[i]);
            };
        };
        
        console.log(pks);
        return pks;
    }

    getPeeks(points) {
        if (points.length <= 2) {
            return points;
        };
        var peeks = [points[0]];
        var increasing = points[0][0] < points[1][0];
        if (points[0][0] == points[1][0]) {
            for (var i = 1; i < points.length; i++) {
                if (points[i][0] == points[i - 1][0]) {
                    continue;
                };
                increasing = points[i - 1][0] < points[i][0];
                break;
            };
        };

        for (var i = 1; i < points.length - 1; i++) {
            if (points[i][0] == peeks[peeks.length - 1][0]) {
                continue;
            };

            if (increasing) {
                if (points[i][0] <= points[i + 1][0]) {
                    continue;
                } else {
                    increasing = false;
                    peeks.push(points[i]);
                }
            } else {
                if (points[i][0] >= points[i + 1][0]) {
                    continue;
                } else {
                    peeks.push(points[i]);
                    increasing = true;
                }
            };
        };
        peeks.push(points[points.length - 1]);
        console.log(peeks);
        return peeks;
    }

    createDataTable(ptpair) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'order');
        data.addColumn('number', 'price');
        data.addColumn('number', 'p1');
        data.addColumn('number', 'p2');

        var rows = [];
        var points = [];
        for (var i = 0; i < ptpair.length; i++) {
            rows.push(['' + i, ptpair[i]]);
            points.push([ptpair[i], i]);
        };
        var peeks = this.getPeeks(points);
        var pks = this.nextPeeks(peeks);

        while (pks.length > 30) {
            peeks = pks;
            pks = this.nextPeeks(peeks);
        };

        var rlen = rows[0].length;
        for (var i = 0; i < peeks.length; i++) {
            rows[peeks[i][1]].push(peeks[i][0]);
        };
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].length == rlen) {
                rows[i].push(null);
            };
        };

        rlen++;
        for (var i = 0; i < pks.length; i++) {
            rows[pks[i][1]].push(pks[i][0]);
        };
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].length == rlen) {
                rows[i].push(null);
            };
        };
        data.addRows(rows);
        this.createOption(name);
        this.chart.draw(data, this.options);
    }
}

window.onload = e => {
    emjyBack.home = new DailyHome();
    emjyBack.home.initUi();
    // emjyBack.dailyDa = new DailyDataAnalyzer();
    // emjyBack.dailyDa.initUi();
};
