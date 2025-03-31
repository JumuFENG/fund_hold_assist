const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const express = require('express');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');
const { logger, ctxfetch } = require('./background/nbase.js');
// xreq path must related to this file or will throw exception.
global.xreq = function(m) {
    return require(path.resolve(__dirname, m));
}

if (!fs.existsSync(path.join(__dirname, './config/config.json'))) {
    const dconfig = {
        fha: {
            server: 'http://localhost/',
            uemail: '',
            pwd: '',
            save_on_server: true,
        },
        unp: {
            account: '',
            pwd: '',
            credit: false,
        },
        client: {
            purchase_new_stocks: true,
            enable_rtp_check: true,
            enable_kl_check: true,
            port: 5888
        }
    }
    fs.writeFileSync(path.join(__dirname, './config/config.json'), JSON.stringify(dconfig, null, 2));
    logger.error('config not set, template already create, please set the correct values in config.json!');
    exit(1);
}

const config = require('./config/config.json');
const { guang } = require('./background/guang.js');
const { feng } = require('./background/feng.js');
const { klPad } = require('./background/kline.js');
const { accld } = require('./background/accounts.js');
const { trackacc } = require('./background/trackAccount.js');
const { alarmHub } = require('./background/klineTimer.js');
const { istrManager } = require('./background/istrategies.js');
const { costDog } = require('./background/strategyGroup.js');


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'web')));


if (!config.unp.account || !config.unp.pwd) {
    logger.error('Account/Password not set!');
    return;
}

const screenshotfolder = path.join(__dirname, 'logs');
config.fha.headers = {'Authorization': 'Basic ' + btoa(config.fha.uemail + ":" + config.fha.pwd)};
accld.enableCredit = config.unp.credit;
accld.fha = config.fha;
alarmHub.config = config.client;
istrManager.iconfig = config.client.extistrs;
istrManager.fha = config.fha;
costDog.fha = config.fha;

const ext = {
    mxretry: 2,
    host: 'https://jywg.eastmoneysec.com',
    browserUA: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0',
    get targetPage() {
        return this.host + (config.unp.credit ? '/MarginTrade/Buy' : '/Trade/Buy')
    },
    get loginPage() {
        return this.host + '/Login'
    },
    schedule(kicktime='9:12') {
        const now = new Date();
        const ticks = new Date(now.toDateString() + ' ' + kicktime) - now + Math.random() * 180000;
        const endticks = new Date(now.toDateString() + ' 15:00') - now;
        if (endticks > 0) {
            this.schd = setTimeout(() => {this.start(); }, ticks);
        } else {
            logger.info('time passed!');
        }
    },
    async start() {
        if (!this.status) {
            await this.createMainTab();
        }
        this.login();
    },
    async closeAlerts(page) {
        try {
            await this.page.waitForSelector('.popup-component-box.large', { timeout: 200 });
            await this.page.click('.btn-orange.vbtn-confirm');
        } catch (err) {
            console.log('未检测到模态框，继续执行');
        }
    },
    async submit(text) {
        await this.closeAlerts();
        await this.setUnp();
        await this.page.type('#txtValidCode', text);
        try {
            const button = await this.page.$('#btnConfirm');
            const isClickable = await button.evaluate((el) => {
                // 检查按钮是否在视口中且未被其他元素遮挡
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const topElement = document.elementFromPoint(centerX, centerY);
                return topElement === el || el.contains(topElement);
            });

            if (isClickable) {
                await button.click();
            } else {
                logger.error('登录按钮被遮挡！');
                await this.page.screenshot({ path: path.join(screenshotfolder, 'blocked-button.png')}); // 截图调试
            }
        } catch (err) {
            logger.error('点击登录按钮失败:', err.message);
            // 附加诊断逻辑（例如截图）
            await this.page.screenshot({ path: 'click-btnConfirm-error.png' });
        }
        this.retry++;
    },
    async login() {
        this.status = 'logining';
        if (!this.retry) {
            this.retry = 1;
            this.success = false;
        }

        if (!this.yzm) {
            return;
        }

        try {
            const text = await this.recoginzeCaptcha();
            if (!text || text.length != 4 || isNaN(text)) {
                logger.info(`captcha not valid! ${text}`);
                await this.page.click('#imgValidCode');
                return;
            }

            await this.submit(text);
        } catch (error) {
            logger.error(`第 ${this.retry} 次尝试出错: ${error.message}`);
        }
    },
    async setcaptcha(capurl, text) {
        if (!this.page) {
            return false;
        }
        if (capurl !== this.lastCaptchaUrl) {
            return false;
        }

        if (!text || text.length != 4 || isNaN(text)) {
            logger.info(`captcha not valid! ${text}`);
            await this.page.click('#imgValidCode');
            return false;
        }
        await this.submit(text);
        return true;
    },
    async setUnp() {
        // 输入用户名和密码
        if (this.unpset) {
            return;
        }
        await this.page.type('#txtZjzh', config.unp.account);
        await this.page.type('#txtPwd', atob(config.unp.pwd));
        const rds45checked = await (await (await this.page.$('#rdsc45')).getProperty("checked")).jsonValue();
        if (!rds45checked) {
            await this.page.click('#rdsc45');
        }
        this.unpset = true;
    },
    async onResponse(response) {
        const url = response.url();
        if (url.includes('/Login/YZM')) {
            const buffer = await response.buffer();
            this.yzm = buffer.toString('base64');
            logger.debug(this.yzm);
            this.lastCaptchaUrl = url;
            if (!this.retry || this.retry > this.mxretry) {
                return;
            }
            this.login();
        } else if (response.url().includes('/Login/Authentication') && response.request().method() === 'POST') {
            const logRes = await response.json()
            logger.info(logRes);
            if (logRes.Status === 0 && logRes.Errcode === 0) {
                await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
                if (this.page.url() === this.targetPage) {
                    this.success = true;
                    logger.info('登录成功！');
                    // 获取Token或其他登录成功后的操作
                    const emvkey = await this.page.evaluate(() => {
                        return document.querySelector('#em_validatekey').value;
                    });
                    feng.validateKey = emvkey;
                    accld.validateKey = emvkey;
                    ctxfetch.setPage(this.page);
                    logger.info(`validatekey: ${emvkey}`);
                    this.onLoginSucess();
                    return;
                }
            }
            this.onLoginFailed();
        }
    },
    async createMainTab() {
        this.status = 'start';
        this.browser = await puppeteer.launch({
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--single-process',
                `--user-agent=${this.browserUA}`
            ]
        });

        this.page = await this.browser.newPage();
        this.page.on('response', response => { this.onResponse(response) });
        await this.page.goto(this.targetPage);

        // 检查是否跳转到登录页面
        if (this.page.url() !== this.targetPage) {
            logger.info('未登录，跳转到登录页面');
            if (new URL(this.page.url()).pathname != '/Login') {
                await this.page.goto(this.loginPage);
            }
        }
    },
    async recoginzeCaptcha() {
        // 发送验证码图片到OCR服务
        var dfd = new FormData();
        dfd.append('img', this.yzm);
        const captchaurl = config.fha.server + 'api/captcha';
        let text = await fetch(captchaurl, {
            method: 'POST',
            body: dfd,
            headers: {
                'User-Agent': this.browserUA
            }
        }).then(response => response.text()); 
        this.yzm = null;
        logger.info(`captcha text ${text}`);
        text = text.replaceAll('g', '9').replaceAll('Q','0').replaceAll('i', '1')
        .replaceAll('D', '0').replaceAll('C', '0').replaceAll('u', '0').replaceAll('U', '0')
        .replaceAll('z', '7').replaceAll('Z', '7').replaceAll('c', '0').replaceAll('o', '0');
        return text;
    },
    async onLoginSucess() {
        this.status = 'success';
        setInterval(() => {
            this.page.reload();
        }, 175 * 60000);
        accld.initAccounts();
        trackacc.initTrackAccounts();
        costDog.init();
        this.running = true;
        alarmHub.setupAlarms();
        alarmHub.tradeClosed = this.tradeClosed;
        istrManager.initExtStrs();
    },
    async onLoginFailed() {
        this.status = 'failed';
        if (this.retry > this.mxretry) {
            logger.info(`第 ${this.retry} 次登录失败，发送到Web进行人工验证!`, this.lastCaptchaUrl);
            sendMessage('captcha_image', {image: this.yzm, url: this.lastCaptchaUrl});
        }
        logger.info(`第 ${this.retry} 次登录失败，重试中...`);
    },
    async tradeClosed() {
        logger.info(accld.normalAccount.orderfeched);
        logger.info(accld.collateralAccount.orderfeched);
        accld.track_accounts.forEach(acc => {
            logger.info(acc.deals);
        });
        this.running = false;
    },
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    },
    handleStart() {
        if (ext.running) {
            return 'already started!';
        }
        if (ext.schd) {
            clearTimeout(ext.schd);
            ext.schd = null;
        }
        ext.start();
        return 'start success!';
    },
    handleTrade(mbody) {
        const {code, tradeType, count, price, account, strategies} = mbody;
        if (tradeType == 'B') {
            accld.tryBuyStock(code, price, count, account, strategies);
        } else if (tradeType == 'S') {
            accld.trySellStock(code, price, count, account);
        } else if (strategies && code && account) {
            accld.all_accounts[account].addWatchStock(code, strategies);
        } else {
            return false;
        }
        return true;
    },
    handleStatus() {
        return {status: ext.status, running: ext.running};
    },
    handleAccountStocks(mbody) {
        const {account} = mbody;
        if (accld.all_accounts[account]) {
            return accld.all_accounts[account].getAccountStocks();
        }
    },
    handleAccountDeals(mbody) {
        const {account} = mbody;
        if (accld.all_accounts[account]) {
            if (accld.all_accounts[account].realcash) {
                return accld.all_accounts[account].orderfeched;
            }
            return accld.all_accounts[account].deals;
        }
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status', (req, res) => {
    const r = ext.handleStatus();
    res.send(r);
});

app.get('/start', (req, res) => {
    const s = ext.handleStart();
    res.send(s);
});

app.post('/capcha', (req, res) => {
    const { url, text } = req.body;
    const result = ext.setcaptcha(url, text);
    if (result) {
        res.send('Captcha set successfully!');
    } else {
        res.status(400).send('Failed to set captcha.');
    }
});

app.post('/trade', (req, res) => {
    if (ext.handleTrade(req.body)) {
        res.send('Success');
    }
    res.status(404).send('trade type not found!');
});

app.get('/stocks', (req, res) => {
    res.send(ext.handleAccountStocks(req.query));
});

app.get('/deals', (req, res) => {
    res.send(ext.handleAccountDeals(req.query));
});

const port = config.client.port;
const server = app.listen(port, () => {
    console.log('Server is running on port', port);
});

const io = new Server(server, { 
    cors: { origin: '*' }
});

const connectedClients = new Set();

io.on('connection', (socket) => {
    logger.info('客户端已连接:', socket.id);
    connectedClients.add(socket);
    socket.emit('status', {status: ext.status, running: ext.running});

    socket.on('disconnect', () => {
        connectedClients.delete(socket);
    });
});

async function sendMessage(evt, msg) {
    try {
        connectedClients.forEach(client => {
            client.emit(evt, msg);
        });
    } catch (error) {
        logger.error('sendMessage error:', error);
    }
}

// 接收客户端提交的验证码
io.on('connection', (socket) => {
    socket.on('submit_captcha', (data) => {
        logger.info(`收到验证码:`, data.text);
        ext.setcaptcha(data.url, data.text);
    });
    socket.on('start', () => {
        const r = ext.handleStart();
        socket.emit('start', {result: r});
    });
    socket.on('trade', (data) => {
        ext.handleTrade(data);
    });
    socket.on('status', () => {
        socket.emit('status', ext.handleStatus());
    });
    socket.on('stocks', (data) => {
        socket.emit('stocks', ext.handleAccountStocks(data));
    });
    socket.on('deals', (data) => {
        socket.emit('deals', ext.handleAccountDeals(data));
    });
});

(async function () {
    const tradingday = await guang.isTodayTradingDay();
    if (tradingday) {
        ext.schedule();
    } else {
        logger.info('not trading day!');
    }
})()
