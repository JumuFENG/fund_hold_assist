'use strict';

class TrackStockListPanelPage extends StockListPanelPage {
    constructor() {
        super('模拟账户');
        this.stocksFetched = false;
    }

    show() {
        super.show();
        if (!this.stocksFetched) {
            emjyBack.sendExtensionMessage({command: 'mngr.inittrack'});
            this.stocksFetched = true;
        }
    }

    onStockListLoaded() {
        this.onFiltered(7);
        this.listContainer.lastElementChild.click();
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
