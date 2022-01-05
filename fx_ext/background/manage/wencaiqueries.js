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

class WencaiCommon {
    wencai(question, cb) {
        var ztclt = new WencaiQuestClient(question, datas => {
            if (typeof(cb) === 'function') {
                cb(datas);
            }
        });
        ztclt.getWencaiNext();
    }

    wencaiLimit(question, limit, cb) {
        var ztclt = new WencaiQuestClient(question, datas => {
            if (typeof(cb) === 'function') {
                cb(datas);
            }
        }, limit);
        ztclt.getWencaiNext();
    }

    getWencaiZt(date, cb) {
        this.wencai(date + "涨跌幅>9.8", cb);
    }

    getWencaiRank100(cb) {
        this.wencaiLimit('人气个股排名', 100, cb);
    }

    getWencaiMarketValuesTop(limit = 200, cb) {
        this.wencaiLimit('流通市值排行', limit, cb);
    }
}

var wencaiCommon = new WencaiCommon();
