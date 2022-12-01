'use strict';

class TrackStockListPanelPage extends StockListPanelPage {
    constructor() {
        super('模拟账户');
        this.defaultFilter = 7;
        this.stocksFetched = false;
    }

    show() {
        super.show();
        if (!this.stocksFetched) {
            emjyBack.sendExtensionMessage({command: 'mngr.inittrack'});
            this.stocksFetched = true;
        }
    }

    createWatchCodeAccountSelector() {

    }

    getWatchCodeAccount() {
        return 'track';
    }

    createWatchListAccountSelector() {

    }

    getWatchListAccount() {
        return 'track';
    }
}
