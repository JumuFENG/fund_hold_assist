class XlmQuestClient {
    constructor() {
        // 'https://www.xilimao.com/fupan/zhangting/2022-02-09.html'
        this.ztUrl = 'https://www.xilimao.com/fupan/zhangting/';
    }

    getZt(date, cb) {
        utils.get(this.ztUrl + date + '.html', response => {
            this.onZtBack(response, cb);
        });
    }

    onZtBack(zthtml, cb) {
        var ele = document.createElement('html');
        ele.innerHTML = zthtml;

        var getCode = function(hrf) {
            return hrf.match(/\/(\d{6})\//)[1];
        }

        var ztrows = ele.querySelector('table.table-striped').querySelector('tbody').querySelectorAll('tr')
        var zt = [];
        var bkful = [];
        var addbk = function(bk) {
            var bks = bk.split(/[+\/]/);
            bks.forEach(_bk => {
                var bki = bkful.findIndex(b => b.bk == _bk);
                if (bki == -1) {
                    bkful.push({bk: _bk, num: 1});
                } else {
                    bkful[bki].num++;
                }
            });
        }

        for (var i = 0; i < ztrows.length; i++) {
            var cels = ztrows[i].querySelectorAll('td');
            var bk = cels[3].innerText.trim();
            bk = bk.replaceAll('/', '+');
            zt.push({c: getCode(cels[0].firstElementChild.href), n:cels[0].innerText.trim(), lbc:cels[1].innerText.trim(), bk});
            if (bk.length > 0) {
                addbk(bk);
            }
        }

        if (typeof(cb) === 'function') {
            cb(zt, bkful);
        }
    }
}

var xlmCommon = new XlmQuestClient();
