var TradeType = {
    Buy:1,
    Sell:2
};

class TradeOption {
    constructor(p) {
        this.tradeDiv = document.createElement('div');
        p.appendChild(this.tradeDiv);
    }

    initialize() {
        this.tradeOptBar = new RadioAnchorBar();
        this.tradeOptBar.addRadio('买入', function(){
            stockHub.chartWrapper.tradeOption.setTradeOption(TradeType.Buy);
        });
        this.tradeOptBar.addRadio('卖出', function(){
            stockHub.chartWrapper.tradeOption.setTradeOption(TradeType.Sell);
        });
        this.tradeDiv.appendChild(this.tradeOptBar.container);

        var tradePanel = document.createElement('div');
        this.tradeDiv.appendChild(tradePanel);
        this.datePicker = document.createElement('input');
        this.datePicker.type = 'date';
        this.datePicker.value = utils.getTodayDate();
        tradePanel.appendChild(this.datePicker);
        this.costInput = document.createElement('input');
        this.costInput.placeholder = '金额';
        tradePanel.appendChild(this.costInput);
        this.submitBtn = document.createElement('button');
        this.submitBtn.textContent = '确定';
        this.submitBtn.onclick = function(e) {
            stockHub.chartWrapper.tradeOption.onSubmitClicked();
        }
        tradePanel.appendChild(this.submitBtn);

        this.tradeOptBar.selectDefault();
    }

    show() {
        this.tradeDiv.style.display = 'block';
    }

    hide() {
        this.tradeDiv.style.display = 'none';
    }

    setTradeOption(tradeTp) {
        this.tradeType = tradeTp;
        this.changeTradePanel(tradeTp == TradeType.Sell);
    }

    changeTradePanel(bSell) {
        if (bSell) {
            this.costInput.style.display = "none";
            this.submitBtn.textContent = "卖出";
        } else {
            this.costInput.style.display = "inline";
            this.submitBtn.textContent = "确定";
        }
    }

    onSubmitClicked() {
    }
}

class ChartWrapper {
    constructor(p) {
        this.container = document.createElement('div');
        p.appendChild(this.container);
    }

    initialize() {
        this.tradeOption = new TradeOption(this.container);
        this.tradeOption.initialize();
    }

    setParent(p) {
        this.container.parentElement.removeChild(this.container);
        p.appendChild(this.container);
    }

    hide() {
        this.container.style.display = 'none';
    }

    show() {
        this.container.style.display = 'block';
    }
}
