'use strict';

class DealsPanelPage extends RadioAnchorPage {
    constructor() {
        super('成交记录');
        this.dealsTable = new SortableTable();
        this.container.appendChild(this.dealsTable.container);
        if (emjyManager.savedDeals && emjyManager.savedDeals.length > 0) {
            this.showDealsTable();
        }
        this.ignored = new Set(['511880', '511010']);
    }

    show() {
        super.show();
        if (!this.dealsTable.table) {
            this.showDealsTable();
        }
    }

    showDealsTable() {
        if (!emjyManager.savedDeals || emjyManager.savedDeals.length == 0) {
            return;
        }

        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        for (let i = 0; i < emjyManager.savedDeals.length; i++) {
            const deali = emjyManager.savedDeals[i];
            if (this.ignored.has(deali.code)) {
                continue;
            }
            var anchor = document.createElement('a');
            anchor.textContent = deali.code;
            if (emjyManager.stockMarket && emjyManager.stockMarket[deali.code]) {
                anchor.textContent = emjyManager.stockMarket[deali.code].name;
            }
            anchor.href = emjyManager.stockEmLink(deali.code);
            anchor.target = '_blank';

            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            fee  = fee.toFixed(2);
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
            } else {
                amount -= fee;
            }
            amount = amount.toFixed(2);
            this.dealsTable.addRow(
                deali.time,
                deali.code,
                anchor,
                deali.tradeType,
                deali.price,
                deali.count,
                fee,
                amount
            );
        }
    }
}