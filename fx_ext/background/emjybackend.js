'use strict';

class EmjyBack {
    constructor() {
        this.log = null;
        this.sendMsgToContent = null;
        this.MarginTradeBuyPath = '/MarginTrade/MarginBuy'
    }

    Init(logger, sendMsg) {
        this.log = logger;
        this.sendMsgToContent = sendMsg;
        this.log('EmjyBack initialized!');
    }

    onContentLoaded(path, search) {
        if (path == this.MarginTradeBuyPath) {
            this.log('request content to getValidateKey');
            this.sendMsgToContent({command:'emjy.getValidateKey'});
        }
        this.log('onContentLoaded');
    }

    onContentMessageReceived(message) {
        this.log('onContentMessageReceived');
        if (message.command == 'emjy.getValidateKey') {
            this.log('getValidateKey =', message.key);
        }
    }
}