const path = require('path');
if (!global.xreq) {
  global.xreq = function(m) {
      return require(path.resolve(__dirname, '..', m));
  }
}

const assert = require('assert');
const sinon = require('sinon');
const {strategyFac} = require('../background/strategyController');

if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
  return;
}

describe('check function', () => {
  it('should return resolved promise when enabled is false', async () => {
    const chkInfo = { rtInfo: { latestPrice: 100 } };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: false });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return match result with latestPrice when default direct buy', async () => {
    const chkInfo = { rtInfo: { latestPrice: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true});
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 100 });
  });

  it('should return resolved promise when bway is gt and latestPrice is not greater than lastClose * rate0', async () => {
    const chkInfo = { rtInfo: { latestPrice: 90, lastClose: 95 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'ge', rate0: -0.03 });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise when bway is gt and latestPrice is greater than lastClose * rate0', async () => {
    const chkInfo = { rtInfo: { latestPrice: 90, lastClose: 90 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'ge', rate0: -0.03 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 90 });
  });

  it('should return resolved promise enabled is true and price is greater than or equal to lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 110, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'le', rate0: 0.08  });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise with tradeType and price when enabled is true and price is less than or equal to lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 103, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'le', rate0: 0.08  });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 103 });
  });

  it('should return resolved promise when rate0 < rate1', async () => {
    const chkInfo = { rtInfo: { latestPrice: 103, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'lg', rate0: 0.03, rate1: 0.08 });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise when latestPrice is less then lastClose * (1 + rate1)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 95, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'lg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, undefined);
  });

  it('should return resolved promise when latestPrice is greater then lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 110, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'lg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, undefined);
  });

  it('should return resolved promise with tradeType and price when enabled is true and latestPrice is between lastClose * (1 + rate1) and lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 103, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'lg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 103 });
  });

  it('should return resolved promise when rate0 < rate1', async () => {
    const chkInfo = { rtInfo: { latestPrice: 103, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'nlg', rate0: 0.03, rate1: 0.08 });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise with tradeType and price when latestPrice is less than lastClose * (1 + rate1)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 95, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'nlg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 95 });
  });

  it('should return resolved promise with tradeType and price when latestPrice is greater then lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 110, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'nlg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: 110 });
  });

  it('should return resolved promise with tradeType and price when enabled is true and latestPrice is between lastClose * (1 + rate1) and lastClose * (1 + rate0)', async () => {
    const chkInfo = { rtInfo: { latestPrice: 103, lastClose: 100 }, id: 'test-id' };
    const strategy = strategyFac.create({key: 'StrategyBuy', enabled: true, bway: 'nlg', rate0: 0.08, rate1: -0.01 });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });
});

describe('StrategyBuyPopup check function', () => {
  let strategy;
  let chkInfo;

  beforeEach(() => {
    strategy = strategyFac.create({ key: 'StrategyBuyPopup', enabled: true });
    chkInfo = { rtInfo: { latestPrice: 100 }, id: 'test-id' };
  });

  it('should return resolved promise when enabled is false', async () => {
    strategy = strategyFac.create({ key: 'StrategyBuyPopup', enabled: false });
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise when inCritical is false and price is greater than guardPrice', async () => {
    strategy.data.inCritical = false;
    strategy.data.guardPrice = 90;
    chkInfo.rtInfo.latestPrice = 110;
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });

  it('should return resolved promise with id when inCritical is false and price is less than or equal to guardPrice', async () => {
    strategy.data.inCritical = false;
    strategy.data.guardPrice = 100;
    chkInfo.rtInfo.latestPrice = 100;
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id' });
  });

  it('should return resolved promise with tradeType and price when inCritical is true and price is greater than or equal to prePeekPrice * (1 + backRate)', async () => {
    strategy.data.inCritical = true;
    strategy.data.prePeekPrice = 100;
    strategy.data.backRate = 0.01;
    chkInfo.rtInfo.latestPrice = 101.2;
    chkInfo.rtInfo.buysells = { sale2: '101.3' };
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id', tradeType: 'B', count: 0, price: '101.3' });
  });

  it('should return resolved promise with id when inCritical is true and price is less than prePeekPrice', async () => {
    strategy.data.inCritical = true;
    strategy.data.prePeekPrice = 100;
    chkInfo.rtInfo.latestPrice = 90;
    const result = await strategy.check(chkInfo);
    assert.deepStrictEqual(result, { id: 'test-id' });
  });

  it('should return resolved promise when inCritical is true and price is equal to prePeekPrice', async () => {
    strategy.data.inCritical = true;
    strategy.data.prePeekPrice = 100;
    chkInfo.rtInfo.latestPrice = 100;
    const result = await strategy.check(chkInfo);
    assert.strictEqual(result, undefined);
  });
});
