const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const express = require('express');
const puppeteer = require('puppeteer');
require('./background/emjybackend.js');
require('./background/guang.js')
const config = require('./config.json');
const { logger, ctxfetch } = require('./background/nbase.js');
const { alarmHub } = require('./background/klineTimer.js');
const { emjyBack } = require('./background/emjybackend.js');


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!config || Object.keys(config).length === 0) {
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
            credit: '',
        },
        client: {
            purchase_new_stocks: true,
            port: 5888
        }
    }
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(dconfig, null, 2));
    logger.error('config not set, template already create, please set the correct values in config.json!');
    exit(1);
}


if (!config.unp.account || !config.unp.pwd) {
    logger.error('Account/Password not set!');
    return;
}


emjyBack.fha = config.fha;
alarmHub.config = config.client;

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
        this.status = 'start';
        await this.createMainTab();
        this.login();
    },
    async login() {
        this.status = 'logining';
        if (!this.retry) {
            this.retry = 1;
            this.success = false;
            await this.setUnp();
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

            // 输入验证码
            await this.page.type('#txtValidCode', text);

            // 点击登录按钮
            await this.page.click('#btnConfirm');
            this.retry++;
        } catch (error) {
            logger.error(`第 ${this.retry} 次尝试出错: ${error.message}`);
        }
    },
    async setcaptcha(capurl, text) {
        if (!emjyBack.page) {
            return false;
        }
        if (capurl !== this.waitingCaptcha) {
            return false;
        }

        this.captcha = text;
        await this.page.type('#txtValidCode', text);
        await this.page.click('#btnConfirm');
        return true;
    },
    async setUnp() {
        // 输入用户名和密码
        await this.page.type('#txtZjzh', config.unp.account);
        await this.page.type('#txtPwd', atob(config.unp.pwd));
        const rds45checked = await (await (await this.page.$('#rdsc45')).getProperty("checked")).jsonValue();
        if (!rds45checked) {
            await this.page.click('#rdsc45');
        }
    },
    async onResponse(response) {
        const url = response.url();
        if (url.includes('/Login/YZM')) {
            const buffer = await response.buffer();
            this.yzm = buffer.toString('base64');
            logger.debug(this.yzm);
            this.waitingCaptcha = url;
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
                    emjyBack.validateKey = await this.page.evaluate(() => {
                        return document.querySelector('#em_validatekey').value;
                    });
                    ctxfetch.setPage(this.page);
                    logger.info(`validatekey: ${emjyBack.validateKey}`);
                    this.onLoginSucess();
                    return;
                }
            }
            this.onLoginFailed();
        }
    },
    async createMainTab() {
        this.browser = await puppeteer.launch({
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
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
        emjyBack.Init();
        alarmHub.setupAlarms();
        alarmHub.orderTimer.onTimer();
    },
    async onLoginFailed() {
        this.status = 'failed';
        logger.info(`第 ${this.retry} 次登录失败，重试中...`);
    },
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
};


app.get('/status', (req, res) => {
    const r = {status: ext.status};
    res.send(r);
});


app.get('/start', (req, res) => {
    if (emjyBack.running) {
        res.send('already started!');
        return;
    }
    if (ext.schd) {
        clearTimeout(ext.schd);
        ext.schd = null;
    }
    ext.start();
    res.send('start success!');
});


app.post('/capcha', (req, res) => {
    const { captchaurl, text } = req.body;
    const result = ext.setcaptcha(captchaurl, text);
    if (result) {
        res.send('Captcha set successfully!');
    } else {
        res.status(400).send('Failed to set captcha.');
    }
});

if (guang.isTodayTradingDay()) {
    ext.schedule();
}
// const port = config.client.port;
const port = 5000;
app.listen(port, () => {
    console.log('Server is running on port', port);
});

