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
		var tableWrap = document.querySelector('#tableWrap');
		var slistTable = tableWrap.querySelectorAll('table')[1];
		if (slistTable) {
			var rows = slistTable.querySelectorAll('tr');
			rows.forEach(r => {
				var code = r.childNodes[5].textContent.trim();
				if (r.querySelector('.checkbox').checked) {
					this.addWatchingStock(code);
				}
			})
			this.sendMessageToBackground({command:'emjy.save'});
		} else {
			console.log('Error: no stock list table found!');
		}	
	}

	patchClickEvents() {
		var tableWrap = document.querySelector('#tableWrap');
		var slistTable = tableWrap.querySelectorAll('table')[1];
		if (slistTable) {
			var rows = slistTable.querySelectorAll('tr');
			rows.forEach(r => {
				var code = r.childNodes[5].textContent.trim();
				var ekUrl = emStockUrl + this.stockMarketCode(code) + emStockUrlTail;
				var alink = document.createElement('a');
				alink.textContent = code;
				alink.href = ekUrl;
				alink.target = '_blank';
				r.childNodes[5].onclick = e => {
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
		var bxTitle = document.querySelector('#boxTitle');
		bxTitle.appendChild(patchBtn);
	}

	addActionButtons() {
		var extendDiv = document.querySelector('#wencai_extend_div');
		if (extendDiv === undefined || !extendDiv) {
			extendDiv = document.createElement('div');
			extendDiv.id = 'wencai_extend_div';
		}
		while (extendDiv.hasChildNodes()) {
			extendDiv.removeChild(extendDiv.lastChild);
		}
		var leftCol = document.querySelector('.left_col');
		leftCol.appendChild(extendDiv);
		this.addSelector = document.createElement('select');
		var addOptions = [{key:'StrategyBuyBE', name:'当日尾盘买入'}, {key:'StrategyBuy', name:'次日开盘买入'}];
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
		var strgrp = {grptype:'GroupStandard', transfers:{'0':{'transfer':'1'}},strategies:{'0':{key: this.addSelector.value, amount: 5000, enabled: true, account},'1': {key: 'StrategySellEL', enabled: false}}};
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

