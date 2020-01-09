function showFundStats (detailparent) {
    if (!fundstats) {
        fundstats = new FundStats();
        fundstats.createStatsPage();
        var httpRequest = new XMLHttpRequest();
        httpRequest.open('GET', '../../fundmisc?action=fundstats', true);
        httpRequest.send();

        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                fundstats.fundstatsJson = JSON.parse(httpRequest.responseText);
                fundstats.showFundStats();
            };
        }
    };

    document.getElementById('funds_list_container').style.display = 'none';
    fundstats.container.style.display = 'block';
}

class FundStats {
    constructor() {
        this.container = null;
        this.fundstatsJson = null;
    }

    createStatsPage() {
        this.container = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(this.container);

        var backLink = document.createElement('a');
        backLink.textContent = '返回';
        backLink.href = 'javascript:fundstats.backToList()';

        this.container.appendChild(backLink);
    }

    backToList () {
        this.container.style.display = 'none';
        document.getElementById('funds_list_container').style.display = 'block';
    }

    showFundStats() {
        if (!this.fundstatsJson) {
            return;
        };

        this.statsTable = document.createElement('table');
        this.container.appendChild(this.statsTable);
        this.statsTable.appendChild(utils.createHeaders('基金名称', '持有成本', '持有收益', '售出成本', '售出额', '总收益', '天数'));
        var cost = 0, ewh = 0, cs = 0, acs = 0;
        for (var fs in this.fundstatsJson) {
            this.statsTable.appendChild(utils.createColsRow(
                this.fundstatsJson[fs].name,
                this.fundstatsJson[fs].cost,
                this.fundstatsJson[fs].ewh,
                this.fundstatsJson[fs].cs,
                this.fundstatsJson[fs].acs.toFixed(2),
                (this.fundstatsJson[fs].acs - this.fundstatsJson[fs].cs + this.fundstatsJson[fs].ewh).toFixed(2),
                this.fundstatsJson[fs].hds));
            cost += this.fundstatsJson[fs].cost;
            ewh += this.fundstatsJson[fs].ewh;
            cs += this.fundstatsJson[fs].cs;
            acs += this.fundstatsJson[fs].acs;
        };
        this.statsTable.appendChild(utils.createColsRow('总计', cost, ewh.toFixed(2), cs, acs.toFixed(2), (acs - cs + ewh).toFixed(2)), '-');
    }
}

var fundstats = null; 