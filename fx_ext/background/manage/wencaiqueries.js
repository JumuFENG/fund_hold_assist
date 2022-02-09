'use strict';

class WencaiQuestClient {
    constructor(question, cb, limit = 0) {
        this.url = 'http://iwencai.com/unifiedwap/unified-wap/v2/result/get-robot-data';
        this.pageLen = 50;
        this.limit = limit;
        this.completCb = cb;
        this.question = question;
    }

    getFormData(page = 1) {
        var fd = new FormData();
        fd.append('question', this.question);
        fd.append('perpage', this.pageLen);
        fd.append('page', page);
        fd.append('secondary_intent', "stock");
        fd.append('log_info', "{\"input_type\":\"typewrite\"}");
        fd.append('source', "Ths_iwencai_Xuangu");
        fd.append('version', "2.0");
        fd.append('query_area', "");
        fd.append('block_list', "");
        fd.append('add_info', "{\"urp\":{\"scene\":1,\"company\":1,\"business\":1},\"contentType\":\"json\",\"searchInfo\":true}");
        return fd;
    }

    getWencaiNext(page = 1) {
        var fd = this.getFormData(page);
        utils.post(this.url, fd, response => {
            this.onPostBack(response);
        });
    }

    onPostBack(response) {
        var ztdata = JSON.parse(response).data.answer[0].txt[0].content.components[0].data;
        if (!this.data || this.data.length == 0) {
            this.data = ztdata.datas;
        } else {
            this.data.push.apply(this.data, ztdata.datas);
        }

        console.log(JSON.parse(response).data.answer[0]);
        if (ztdata.datas.length == this.pageLen && (this.limit <= 0 || this.data.length < this.limit)) {
            var page = ztdata.meta.page;
            this.getWencaiNext(++page);
        } else {
            console.log('wencai question done!', this.data.length);
            if (typeof(this.completCb) === 'function') {
                this.completCb(this.data);
            }
        }
    }
}

class WencaiQuestJClient {
    constructor(question, cb, limit = 0) {
        this.url = 'http://iwencai.com/customized/chart/get-robot-data';
        this.pageLen = 100;
        this.limit = limit;
        this.completCb = cb;
        this.question = question;
    }

    getJsonData(page = 1) {
        var fd = {};
        fd['question'] = this.question;
        fd['perpage'] = this.pageLen;
        fd['page'] = page;
        fd['secondary_intent'] = "";
        fd['log_info'] = {input_type:"typewrite"};
        fd['source'] = "Ths_iwencai_Xuangu";
        fd['version'] = "2.0";
        fd['query_area'] = "";
        fd['block_list'] = "";
        fd['add_info'] = {urp:{scene:1,company:1,business:1},contentType:'json',searchInfo:true};
        return fd;
    }

    getWencaiNext(page = 1) {
        var fd = this.getJsonData(page);
        utils.postJson(this.url, fd, response => {
            this.onPostBack(response);
        });
    }

    onPostBack(response) {
        var ztdata = JSON.parse(response).data.answer[0].txt[0].content.components[0].data;
        if (!this.data || this.data.length == 0) {
            this.data = ztdata.datas;
        } else {
            this.data.push.apply(this.data, ztdata.datas);
        }

        console.log(JSON.parse(response).data.answer[0]);
        if (ztdata.datas.length == this.pageLen && (this.limit <= 0 || this.data.length < this.limit)) {
            var page = ztdata.meta.page;
            this.getWencaiNext(++page);
        } else {
            console.log('wencai question done!', this.data.length);
            if (typeof(this.completCb) === 'function') {
                this.completCb(this.data);
            }
        }
    }
}

class WencaiCommon {
    wencai(question, cb) {
        var ztclt = new WencaiQuestJClient(question, datas => {
            if (typeof(cb) === 'function') {
                cb(datas);
            }
        });
        ztclt.getWencaiNext();
    }

    wencaiLimit(question, limit, cb) {
        var ztclt = new WencaiQuestJClient(question, datas => {
            if (typeof(cb) === 'function') {
                cb(datas);
            }
        }, limit);
        ztclt.getWencaiNext();
    }

    getWencaiZt(date, cb) {
        this.wencai(date + "涨跌幅>9.8", cb);
    }

    getYdbAll(cb) {
        this.wencai('银行或地产或保险', cb);
    }

    getStocksIncreaseTooMuch(cb) {
        this.wencai('一年内最高价>8*三年内最低价', cb);
    }

    getStocksMoreThan10Years(cb) {
        this.wencai('上市时间大于10年', cb);
    }

    getPriceMoreThan(prc, cb) {
        this.wencai('股价>'+prc, cb);
    }

    getWencaiRank100(cb) {
        this.wencaiLimit('人气个股排名', 100, cb);
    }

    getWencaiMarketValuesTop(limit = 200, cb) {
        this.wencaiLimit('流通市值排行', limit, cb);
    }
}

var wencaiCommon = new WencaiCommon();
