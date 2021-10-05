'use strict';

let BuyStrategyKeyNames = [
{key: 'StrategyBuy', name: '直接买入'}, 
{key: 'StrategyBuyPopup', name: '反弹买入'}, 
{key: 'StrategyBuyR', name: '反弹(重复)买入'}, 
{key: 'StrategyBuyIPO', name: '开板反弹买入'}, 
{key: 'StrategyBuyZTBoard', name: '打板买入'},
{key: 'StrategyBuyMA', name: 'MA突破买入'}, 
{key: 'StrategyBuyMAD', name: 'MA突破(动态)买入'},
{key: 'StrategyBuyBE', name: '尾盘买入'}, 
];

let SellStrategyKeyNames = [
{key: 'StrategySell', name: '反弹卖出'},
{key: 'StrategySellR', name: '反弹(重复)卖出'},
{key: 'StrategySellIPO', name: '开板卖出'},
{key: 'StrategySellEL', name: '止损止盈'},
{key: 'StrategySellELS', name: '止损止盈(超短)'},
{key: 'StrategySellMA', name: 'MA突破卖出'},
{key: 'StrategySellMAD', name: 'MA突破(动态)卖出'},
{key: 'StrategySellMAR', name:'MA突破卖出(日内)'},
];
