class CaptchaUI {
    constructor(parentElement, path='', uri=null) {
        this.parentElement = parentElement;
        this.createUIElements();
        this.path = path == '/' ? '' : path;
        this.socket = io({path: '/socket.io/'});
        this.initEventListeners();
    }

    createUIElements() {
        this.statusDiv = this.createElement('div', { id: 'status' });
        this.captchaImage = this.createElement('img', { id: 'captchaImage', style: 'display: none;' });
        this.manualInput = this.createElement('input', { id: 'manualInput', type: 'text', placeholder: '手动输入验证码' });
        this.submitBtn = this.createElement('button', { id: 'submitManual', textContent: '提交' });
        this.startBtn = this.createElement('button', { id: 'startBtn', textContent: '开始', style: 'display: none;' });

        this.parentElement.appendChild(this.statusDiv);
        this.parentElement.appendChild(this.captchaImage);
        this.parentElement.appendChild(this.manualInput);
        this.parentElement.appendChild(this.submitBtn);
        this.parentElement.appendChild(this.startBtn);
    }

    createElement(tag, attributes = {}) {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        return element;
    }
    initEventListeners() {
        this.socket.on('connect', (data) => this.onConnect(data));
        this.socket.on('captcha_image', (data) => this.onCaptchaImage(data));
        this.submitBtn.addEventListener('click', () => this.onSubmit());
        this.startBtn.onclick = () => this.onStart();
    }

    onConnect(data) {
        this.statusDiv.textContent = '已连接... 状态为:' + JSON.stringify(data);
        if (!data) {
            this.startBtn.style.display = 'block';
        }
    }

    onCaptchaImage(data) {
        this.captchaImage.src = `data:image/png;base64,${data.image}`;
        this.captchaImage.captchaUrl = data.url;
        this.captchaImage.style.display = 'block';
        this.statusDiv.textContent = '请输入验证码';
    }

    onSubmit() {
        const text = this.manualInput.value.trim();
        if (!text) return;
        this.socket.emit('submit_captcha', { text, url: this.captchaImage.captchaUrl });
        this.captchaImage.style.display = 'none';
    }

    onStart() {
        fetch(this.path+'/start').then(r => r.text()).then(t => {
            this.statusDiv.textContent = t;
            this.startBtn.style.display = 'none';
        });
    }

    init() {
        fetch(this.path + '/status').then(r => r.json()).then(t => {
            this.statusDiv.textContent = JSON.stringify(t);
            if (t.status != 'success') {
                this.startBtn.style.display = 'block';
            } else {
                this.startBtn.style.display = 'none';
            }
        });
    }
}
