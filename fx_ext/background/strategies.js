'use strict';

let ComplexStrategyKeyNames = [
{key: 'StrategyMA', name: 'MA突破买卖'},
{key: 'StrategyGE', name: '网格买入,盈利卖出'},
{key: 'StrategyGEMid', name: '网格买入 (波段)'},
{key: 'StrategyGrid', name: '网格买入增仓'},
{key: 'StrategyTD', name: 'TD点买卖'},
{key: 'StrategyBH', name: '低吸 短线买卖'},
{key: 'StrategyBias', name: '乖离率买卖'},
{key: 'StrategyIncDec', name: '大跌买 大涨卖'},
{key: 'StrategyZt0', name: '首板战法'},
{key: 'StrategyZt1', name: '一字巨量阴'},
]
// StrategySD
let BuyStrategyKeyNames = [
{key: 'StrategyBuy', name: '直接买入'}, 
{key: 'StrategyBuySD', name: '止跌买入'},
{key: 'StrategyBuyPopup', name: '反弹买入'}, 
{key: 'StrategyBuyR', name: '反弹(重复)买入'}, 
{key: 'StrategyBuyIPO', name: '开板反弹买入'}, 
{key: 'StrategyBuyZTBoard', name: '打板买入'},
{key: 'StrategyBuyMA', name: 'MA突破买入'}, 
{key: 'StrategyBuyMAD', name: 'MA突破(动态)买入'},
{key: 'StrategyBuyMAE', name: 'MA突破(尾盘)买入'},
{key: 'StrategyBuyBE', name: '尾盘买入'},
{key: 'StrategyBuySupport', name: '支撑位买入'},
];

let SellStrategyKeyNames = [
{key: 'StrategySell', name: '反弹卖出'},
{key: 'StrategySellR', name: '反弹(重复)卖出'},
{key: 'StrategySellIPO', name: '开板卖出'},
{key: 'StrategySellEL', name: '止损止盈'},
{key: 'StrategySellELS', name: '止损止盈(超短)'},
{key: 'StrategySellELTop', name: '目标价止盈'},
{key: 'StrategySellMA', name: 'MA突破卖出'},
{key: 'StrategySellMAD', name: 'MA突破(动态)卖出'},
{key: 'StrategySellBE', name: '尾盘卖出'},
];
