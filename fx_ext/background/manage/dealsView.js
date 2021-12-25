'use strict';

class DealsPanelPage extends RadioAnchorPage {
    constructor() {
        super('成交记录');
        var allBtn = document.createElement('button');
        allBtn.textContent = '全部';
        allBtn.onclick = e => {
            this.showDealsTable();
        }
        this.container.appendChild(allBtn);
        this.inputCode = document.createElement('input');
        this.container.appendChild(this.inputCode);
        var btn1Stock = document.createElement('button');
        btn1Stock.textContent = '确定';
        btn1Stock.onclick = e => {
            this.showSingleStock(this.inputCode.value);
        }
        this.container.appendChild(btn1Stock);
        this.dealsTable = new SortableTable();
        this.container.appendChild(this.dealsTable.container);
        if (emjyManager.savedDeals && emjyManager.savedDeals.length > 0) {
            this.showDealsTable();
        }
        this.ignored = new Set(['511880', '511010', '161129', '162411', '159994','160416',
        '159949', '518880', '159939', '512880', '512660', '512290', '512400', '512800', '513050',
        '161226', '110075', '161130', '588000', '113042', '123096', '110079', '512480', '513100',
        '113043', '113048', '512480', '513100', '113043', '127032', '113048', '588300', '118002',
        '510510', '510300', '510800', '127043', '161725', '127047', '127043', '123111', '113047'
    ]);
        this.stockHis = new Set();
    }

    show() {
        super.show();
        if (!this.dealsTable.table) {
            this.showDealsTable();
        }
    }

    showDeals(ignored, filtered) {
        if (!emjyManager.savedDeals || emjyManager.savedDeals.length == 0) {
            return;
        }

        this.dealsTable.reset();
        this.dealsTable.setClickableHeader('日期', '代码', '名称', '买卖', '价格', '数量', '手续费', '金额');
        var resCount = 0;
        var totalFee = 0;
        var totalEarned = 0;
        for (let i = 0; i < emjyManager.savedDeals.length; i++) {
            const deali = emjyManager.savedDeals[i];
            if (ignored && ignored.has(deali.code)) {
                continue;
            }
            if (filtered && !filtered.has(deali.code)) {
                continue;
            }

            this.stockHis.add(deali.code);
            var anchor = document.createElement('a');
            anchor.textContent = deali.code;
            if (emjyManager.stockMarket && emjyManager.stockMarket[deali.code]) {
                anchor.textContent = emjyManager.stockMarket[deali.code].name;
            }
            anchor.href = emjyManager.stockEmLink(deali.code);
            anchor.target = '_blank';

            var fee = -(-deali.fee - deali.feeGh - deali.feeYh);
            totalFee += fee;
            fee  = fee.toFixed(2);
            var amount = deali.price * deali.count;
            if (deali.tradeType == 'B') {
                amount = -(-amount - fee);
                totalEarned -= amount;
            } else {
                amount -= fee;
                totalEarned += amount;
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
            if (deali.tradeType == 'S') {
                resCount -= deali.count;
            } else if (deali.tradeType == 'B') {
                resCount -= -deali.count;
            }
        }
        if (filtered && filtered.size == 1 && resCount != 0) {
            totalEarned += emjyManager.getCurrentHoldValue(filtered.values().next().value);
        }
        this.dealsTable.addRow('total', '', '', '', '', resCount, totalFee.toFixed(2), totalEarned.toFixed(2));
    }

    showDealsTable() {
        this.showDeals(this.ignored);
    }

    showSingleStock(code) {
        this.showDeals(null, new Set([code]));
    }
}