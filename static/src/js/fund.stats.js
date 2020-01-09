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
        this.statsTable.appendChild(utils.createHeaders('基金名称', '持有成本', '持有收益', '售出成本', '售出额', '天数'));
        for (var fs in this.fundstatsJson) {
            this.statsTable.appendChild(utils.createColsRow(this.fundstatsJson[fs].name, this.fundstatsJson[fs].cost, this.fundstatsJson[fs].ewh, this.fundstatsJson[fs].cs, this.fundstatsJson[fs].acs, this.fundstatsJson[fs].hds));
        };
    }
}

var fundstats = null; 