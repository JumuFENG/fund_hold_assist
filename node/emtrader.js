const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const logger = require('./background/logger.js');
const puppeteer = require('puppeteer');
const config = require('./config.json');
const emjyBack = require('./background/emjybackend.js');
const alarmHub = require('./background/klineTimer.js');


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
        }
    }
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(dconfig, null, 2));
    logger.error('config not set, template already create, please set the correct values in config.json!');
    exit(1);
}


const captchaurl = config.fha.server + 'api/captcha';
const host = 'https://jywg.eastmoneysec.com';
const targetPage = host + '/MarginTrade/Buy';
const loginPage = host + '/Login';
// '/Login?el=1&clear=&returl=%2fMarginTrade%2fBuy'


if (!config.unp.account || !config.unp.pwd) {
    logger.error('Account/Password not set!');
    return;
}


class ext {
    static mxretry = 2;
    static async createMainTab() {
        this.browser = await puppeteer.launch({
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0'
            ]
        });

        this.page = await this.browser.newPage();
        this.page.on('response', response => { this.onResponse(response) });
        await this.page.goto(targetPage);

        // 检查是否跳转到登录页面
        if (this.page.url() !== targetPage) {
            logger.info('未登录，跳转到登录页面');
            if (new URL(this.page.url()).pathname != '/Login') {
                await this.page.goto(loginPage);
            }
        }
    }

    static async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    static async onResponse(response) {
        const url = response.url();
        if (url.includes('/Login/YZM')) {
            const buffer = await response.buffer();
            this.yzm = buffer.toString('base64');
            logger.debug(this.yzm);
            if (!this.retry || this.retry > this.mxretry) {
                return;
            }
            this.login();
        } else if (response.url().includes('/Login/Authentication') && response.request().method() === 'POST') {
            const logRes = await response.json()
            logger.info(logRes);
            if (logRes.Status === 0 && logRes.Errcode === 0) {
                await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
                if (this.page.url() === targetPage) {
                    this.success = true;
                    logger.info('登录成功！');
                    // 获取Token或其他登录成功后的操作
                    this.validatekey = await this.page.evaluate(() => {
                        return document.querySelector('#em_validatekey').value;
                    });
                    logger.info(`validatekey: ${this.validatekey}`);
                    return;
                }
            }
            logger.info(`第 ${this.retry} 次登录失败，重试中...`);
        }
    }

    static async setUnp() {
        // 输入用户名和密码
        await this.page.type('#txtZjzh', config.unp.account);
        await this.page.type('#txtPwd', atob(config.unp.pwd));
        const rds45checked = await (await (await this.page.$('#rdsc45')).getProperty("checked")).jsonValue();
        if (!rds45checked) {
            await this.page.click('#rdsc45');
        }
    }

    static async recoginzeCaptcha() {
        const cookies = await this.page.cookies();
        // 发送验证码图片到OCR服务
        var dfd = new FormData();
        dfd.append('img', this.yzm);
        let text = await fetch(captchaurl, {
            method: 'POST',
            body: dfd,
            headers: {Cookie: cookies}
        }).then(response => response.text()); 
        // let text = await this.page.evaluate(async (cdata) => {
        //     var dfd = new FormData();
        //     dfd.append('img', cdata.yzm);
        //     return await fetch(cdata.url, {
        //         method: 'POST',
        //         body: dfd
        //     }).then(response => response.text());
        // }, {url: captchaurl, yzm: this.yzm});
        this.yzm = null;
        logger.info(`captcha text ${text}`);
        text = text.replaceAll('g', '9').replaceAll('Q','0').replaceAll('i', '1')
        .replaceAll('D', '0').replaceAll('C', '0').replaceAll('u', '0').replaceAll('U', '0')
        .replaceAll('z', '7').replaceAll('Z', '7').replaceAll('c', '0').replaceAll('o', '0');
        return text;
    }

    static async login() {
        if (!this.retry) {
            this.retry = 1;
            this.success = false;
            await this.setUnp();
        }

        if (!this.yzm) {
            return;
        }

        try {
            this.retry++;
            const text = await this.recoginzeCaptcha();
            if (!text || text.length != 4) {
                logger.info(`captcha not valid! ${text}`);
            }

            // 输入验证码
            await this.page.type('#txtValidCode', text);

            // 点击登录按钮
            await this.page.click('#btnConfirm');
        } catch (error) {
            logger.error(`第 ${this.retry} 次尝试出错: ${error.message}`);
        }
    }
}


(async function () {
    await ext.createMainTab();
    ext.login();
    const lInterval = setInterval(async () => {
        if (ext.success || ext.retry > ext.mxretry) {
            clearInterval(lInterval);
            if (ext.success) {
                // 执行后续任务
                setInterval(() => {
                    ext.page.reload();
                }, 175 * 60000);
                emjyBack.Init();
                alarmHub.setupAlarms();
                const eminterval = setInterval(async () => {
                    if (!emjyBack.running) {
                        clearInterval(eminterval);
                        await ext.close();
                    }
                }, 10000);
            } else {
                console.log('登录失败, 关闭浏览器!');
                await ext.close();
            }
        }
    }, 1000);
})()

