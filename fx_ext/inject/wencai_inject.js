let emStockUrl = 'http://quote.eastmoney.com/concept/';
let emStockUrlTail = '.html#fschart-k';

class WencaiFront {
	stockMarketCode(code) {
		if (code.startsWith('00')) {
			return 'sz' + code;
		} else if (code.startsWith('60')) {
			return 'sh' + code;
		}
	}

	addSelectedStocks() {
		var slistTable = document.querySelector('.iwc-table-body-outer').querySelector('table');
		if (slistTable) {
			var rows = slistTable.querySelectorAll('tr');
			rows.forEach(r => {
				var code = r.childNodes[3].textContent.trim();
				if (r.querySelector('i.tr-selected')) {
					this.addWatchingStock(code);
				}
			})
			this.sendMessageToBackground({command:'emjy.save'});
		} else {
			console.log('Error: no stock list table found!');
		}	
	}

	patchClickEvents() {
		var slistTable = document.querySelector('.iwc-table-body-outer').querySelector('table');
		if (slistTable) {
			var rows = slistTable.querySelectorAll('tr');
			rows.forEach(r => {
				var code = r.childNodes[3].textContent.trim();
				var ekUrl = emStockUrl + this.stockMarketCode(code) + emStockUrlTail;
				var alink = document.createElement('a');
				alink.textContent = code;
				alink.href = ekUrl;
				alink.target = '_blank';
				r.childNodes[3].onclick = e => {
					alink.click();
				}
			})
		} else {
			console.log('Error: no stock list table found!');
		}
	}

	addPatchButton() {
		var patchBtn = document.querySelector('#wencai_extend_patch_btn');
		if (patchBtn === undefined || !patchBtn) {
			patchBtn = document.createElement('button');
			patchBtn.id = 'wencai_extend_patch_btn';
			patchBtn.textContent = '注入响应函数';
			patchBtn.style.padding = '0 2px';
			patchBtn.style.margin = '2px';
		}

		patchBtn.onclick = e => {
			this.patchClickEvents();
			this.addActionButtons();
		}
		var barLeft = document.querySelector('.left-bar-ul', '.small-left-bar');
		barLeft.insertBefore(patchBtn, barLeft.firstElementChild.nextElementSibling);
	}

	addActionButtons() {
		var extendDiv = document.querySelector('#wencai_extend_div');
		if (extendDiv === undefined || !extendDiv) {
			extendDiv = document.createElement('div');
			extendDiv.id = 'wencai_extend_div';
			var leftCol = document.querySelector('.data-operate-and-table-screen');
			leftCol.insertBefore(extendDiv, leftCol.firstElementChild);
		}
		while (extendDiv.hasChildNodes()) {
			extendDiv.removeChild(extendDiv.lastChild);
		}
		this.addSelector = document.createElement('select');
		var addOptions = [{key:'StrategyBuyMAE', name:'当日尾盘买入'}, {key:'StrategyBuy', name:'次日开盘买入'}];
		for (var i = 0; i < addOptions.length; i++) {
			var opt = document.createElement('option');
			opt.value = addOptions[i].key;
			opt.textContent = addOptions[i].name;
			this.addSelector.appendChild(opt);
		}
		extendDiv.appendChild(this.addSelector);

		this.accountSelector = document.createElement('select');
		var accounts = [{key:'normal', name: '普通账户'}, {key:'credit', name:'融资账户'}];
		for (var i = 0; i < accounts.length; i++) {
			var opt = document.createElement('option');
			opt.value = accounts[i].key;
			opt.textContent = accounts[i].name;
			this.accountSelector.appendChild(opt);
		}
		var natls = document.querySelectorAll('div.natl_words');
		extendDiv.appendChild(this.accountSelector);

		var addBtn = document.createElement('button');
		addBtn.textContent = '添加选中项';
		addBtn.style.padding = '0 2px';
		addBtn.style.margin = '2px';
		addBtn.onclick = e => {
			this.addSelectedStocks();
		}
		extendDiv.appendChild(addBtn);

		for (var i = 0; i < natls.length; i++) {
			if (natls[i].innerText.startsWith('所属概念是两融标的')) {
				this.accountSelector.value = 'credit';
			} else if (natls[i].innerText.startsWith('涨停')) {
				this.addSelector.value = 'StrategyBuy';
			}
		}
	}

	addWatchingStock(code) {
		var account = this.accountSelector.value;
		var ownAccount = account;
		if (ownAccount != 'normal') {
			ownAccount = 'collat';
		}
		var strategy0 = {key: this.addSelector.value, enabled: true, account};
		if (this.addSelector.value == 'StrategyBuyMAE') {
			strategy0.kltype = '60';
		}
		var strgrp = {
			grptype: "GroupStandard",
			amount: 5000,
			transfers: {"0":{transfer: "2"}, "1":{transfer: "2"}, "2":{transfer: "1"}, "3":{transfer: "1"}},
			strategies: {
				"0": strategy0,
				"1": {key:"StrategyBuyMAD", enabled:false, account, kltype:"60"},
				"2": {key:"StrategySellMAD", enabled:false, kltype:"60"},
				"3": {key:"StrategySellEL", enabled:false}
			}
		};
		this.sendMessageToBackground({command:'emjy.addwatch', code, account: ownAccount, strategies: strgrp});
	}

	sendMessageToBackground(message) {
		chrome.runtime.sendMessage(message);
	}
}

var wencaiFront = new WencaiFront();
wencaiFront.addPatchButton();
wencaiFront.addActionButtons();

document.querySelector('.toplogo').onclick = e => {
	wencaiFront.addPatchButton();
	wencaiFront.patchClickEvents();
	wencaiFront.addActionButtons();
}

window.onload = () => {
	wencaiFront.addPatchButton();
	wencaiFront.patchClickEvents();
	wencaiFront.addActionButtons();
};

