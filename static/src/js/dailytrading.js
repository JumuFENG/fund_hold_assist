'use strict';

// the decrpy function for
//!function(){var n,r,i=i||function(t,e){var n={},r=n.lib={},i=r.Base=function(){function t(){}return{extend:function(e){t.prototype=this;var n=new t;return e&&n.mixIn(e),n.$super=this,n},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var e in t)t.hasOwnProperty(e)&&(this[e]=t[e]);t.hasOwnProperty('toString')&&(this.toString=t.toString)},clone:function(){return this.$super.extend(this)}}}(),o=r.WordArray=i.extend({init:function(t,e){t=this.words=t||[],this.sigBytes=void 0!=e?e:4*t.length},toString:function(t){return(t||u).stringify(this)},concat:function(t){var e=this.words,n=t.words,r=this.sigBytes;t=t.sigBytes;if(this.clamp(),r%4)for(var i=0;i<t;i++)e[r+i>>>2]|=(n[i>>>2]>>>24-i%4*8&255)<<24-(r+i)%4*8;else if(65535<n.length)for(i=0;i<t;i+=4)e[r+i>>>2]=n[i>>>2];else e.push.apply(e,n);return this.sigBytes+=t,this},clamp:function(){var e=this.words,n=this.sigBytes;e[n>>>2]&=4294967295<<32-n%4*8,e.length=t.ceil(n/4)},clone:function(){var t=i.clone.call(this);return t.words=this.words.slice(0),t},random:function(e){for(var n=[],r=0;r<e;r+=4)n.push(4294967296*t.random()|0);return o.create(n,e)}}),a=n.enc={},u=a.Hex={stringify:function(t){for(var e=t.words,n=(t=t.sigBytes,[]),r=0;r<t;r++){var i=e[r>>>2]>>>24-r%4*8&255;n.push((i>>>4).toString(16)),n.push((15&i).toString(16))}return n.join('')},parse:function(t){for(var e=t.length,n=[],r=0;r<e;r+=2)n[r>>>3]|=parseInt(t.substr(r,2),16)<<24-r%8*4;return o.create(n,e/2)}},s=a.Latin1={stringify:function(t){for(var e=t.words,n=(t=t.sigBytes,[]),r=0;r<t;r++)n.push(String.fromCharCode(e[r>>>2]>>>24-r%4*8&255));return n.join('')},parse:function(t){for(var e=t.length,n=[],r=0;r<e;r++)n[r>>>2]|=(255&t.charCodeAt(r))<<24-r%4*8;return o.create(n,e)}},c=a.Utf8={stringify:function(t){try{return decodeURIComponent(escape(s.stringify(t)))}catch(t){throw Error('Malformed UTF-8 data')}},parse:function(t){return s.parse(unescape(encodeURIComponent(t)))}},f=r.BufferedBlockAlgorithm=i.extend({reset:function(){this._data=o.create(),this._nDataBytes=0},_append:function(t){'string'==typeof t&&(t=c.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(e){var n=this._data,r=n.words,i=n.sigBytes,a=this.blockSize,u=i/(4*a);e=(u=e?t.ceil(u):t.max((0|u)-this._minBufferSize,0))*a,i=t.min(4*e,i);if(e){for(var s=0;s<e;s+=a)this._doProcessBlock(r,s);s=r.splice(0,e),n.sigBytes-=i}return o.create(s,i)},clone:function(){var t=i.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0});r.Hasher=f.extend({init:function(){this.reset()},reset:function(){f.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){return t&&this._append(t),this._doFinalize(),this._hash},clone:function(){var t=f.clone.call(this);return t._hash=this._hash.clone(),t},blockSize:16,_createHelper:function(t){return function(e,n){return t.create(n).finalize(e)}},_createHmacHelper:function(t){return function(e,n){return l.HMAC.create(t,n).finalize(e)}}});var l=n.algo={};return n}(Math);r=(n=i).lib.WordArray,n.enc.Base64={stringify:function(t){var e=t.words,n=t.sigBytes,r=this._map;t.clamp(),t=[];for(var i=0;i<n;i+=3)for(var o=(e[i>>>2]>>>24-i%4*8&255)<<16|(e[i+1>>>2]>>>24-(i+1)%4*8&255)<<8|e[i+2>>>2]>>>24-(i+2)%4*8&255,a=0;4>a&&i+0.75*a<n;a++)t.push(r.charAt(o>>>6*(3-a)&63));if(e=r.charAt(64))for(;t.length%4;)t.push(e);return t.join('')},parse:function(t){var e=(t=t.replace(/\s/g,'')).length,n=this._map;(i=n.charAt(64))&&-1!=(i=t.indexOf(i))&&(e=i);for(var i=[],o=0,a=0;a<e;a++)if(a%4){var u=n.indexOf(t.charAt(a-1))<<a%4*2,s=n.indexOf(t.charAt(a))>>>6-a%4*2;i[o>>>2]|=(u|s)<<24-o%4*8,o++}return r.create(i,o)},_map:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='},function(t){function e(t,e,n,r,i,o,a){return((t=t+(e&n|~e&r)+i+a)<<o|t>>>32-o)+e}function n(t,e,n,r,i,o,a){return((t=t+(e&r|n&~r)+i+a)<<o|t>>>32-o)+e}function r(t,e,n,r,i,o,a){return((t=t+(e^n^r)+i+a)<<o|t>>>32-o)+e}function o(t,e,n,r,i,o,a){return((t=t+(n^(e|~r))+i+a)<<o|t>>>32-o)+e}var a=i,u=(s=a.lib).WordArray,s=s.Hasher,c=a.algo,f=[];!function(){for(var e=0;64>e;e++)f[e]=4294967296*t.abs(t.sin(e+1))|0}(),c=c.M=s.extend({_doReset:function(){this._hash=u.create([1732584193,4023233417,2562383102,271733878])},_doProcessBlock:function(t,i){for(var a=0;16>a;a++){var u=t[s=i+a];t[s]=16711935&(u<<8|u>>>24)|4278255360&(u<<24|u>>>8)}u=(s=this._hash.words)[0];var s,c=s[1],l=s[2],d=s[3];for(a=0;64>a;a+=4)16>a?c=e(c,l=e(l,d=e(d,u=e(u,c,l,d,t[i+a],7,f[a]),c,l,t[i+a+1],12,f[a+1]),u,c,t[i+a+2],17,f[a+2]),d,u,t[i+a+3],22,f[a+3]):32>a?c=n(c,l=n(l,d=n(d,u=n(u,c,l,d,t[i+(a+1)%16],5,f[a]),c,l,t[i+(a+6)%16],9,f[a+1]),u,c,t[i+(a+11)%16],14,f[a+2]),d,u,t[i+a%16],20,f[a+3]):48>a?c=r(c,l=r(l,d=r(d,u=r(u,c,l,d,t[i+(3*a+5)%16],4,f[a]),c,l,t[i+(3*a+8)%16],11,f[a+1]),u,c,t[i+(3*a+11)%16],16,f[a+2]),d,u,t[i+(3*a+14)%16],23,f[a+3]):c=o(c,l=o(l,d=o(d,u=o(u,c,l,d,t[i+3*a%16],6,f[a]),c,l,t[i+(3*a+7)%16],10,f[a+1]),u,c,t[i+(3*a+14)%16],15,f[a+2]),d,u,t[i+(3*a+5)%16],21,f[a+3]);s[0]=s[0]+u|0,s[1]=s[1]+c|0,s[2]=s[2]+l|0,s[3]=s[3]+d|0},_doFinalize:function(){var t=this._data,e=t.words,n=8*this._nDataBytes,r=8*t.sigBytes;for(e[r>>>5]|=128<<24-r%32,e[14+(r+64>>>9<<4)]=16711935&(n<<8|n>>>24)|4278255360&(n<<24|n>>>8),t.sigBytes=4*(e.length+1),this._process(),t=this._hash.words,e=0;4>e;e++)n=t[e],t[e]=16711935&(n<<8|n>>>24)|4278255360&(n<<24|n>>>8)}}),a.M=s._createHelper(c),a.HmacMD5=s._createHmacHelper(c)}(Math),window.CJS=i,function(){var t,e=i,n=(t=e.lib).Base,r=t.WordArray,o=(t=e.algo).EvpKDF=n.extend({cfg:n.extend({keySize:4,hasher:t.MD5,iterations:1}),init:function(t){this.cfg=this.cfg.extend(t)},compute:function(t,e){for(var n=(u=this.cfg).hasher.create(),i=r.create(),o=i.words,a=u.keySize,u=u.iterations;o.length<a;){s&&n.update(s);var s=n.update(t).finalize(e);n.reset();for(var c=1;c<u;c++)s=n.finalize(s),n.reset();i.concat(s)}return i.sigBytes=4*a,i}});e.EvpKDF=function(t,e,n){return o.create(n).compute(t,e)}}();var o=i.M('getUtilsFromFile'),a=CJS.enc.Utf8.parse(o);i.lib.Cipher||function(t){var e=(h=i).lib,n=e.Base,r=e.WordArray,o=e.BufferedBlockAlgorithm,a=h.enc.Base64,u=h.algo.EvpKDF,s=e.Cipher=o.extend({cfg:n.extend(),createEncryptor:function(t,e){return this.create(this._ENC_XFORM_MODE,t,e)},createDecryptor:function(t,e){return this.create(this._DEC_XFORM_MODE,t,e)},init:function(t,e,n){this.cfg=this.cfg.extend(n),this._xformMode=t,this._key=e,this.reset()},reset:function(){o.reset.call(this),this._doReset()},process:function(t){return this._append(t),this._process()},finalize:function(t){return t&&this._append(t),this._doFinalize()},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(t){return{e:function(e,n,r){return('string'==typeof n?v:p).encrypt(t,e,n,r)},d:function(e,n,r){return('string'==typeof n?v:p).d(t,e,n,r)}}}});e.StreamCipher=s.extend({_doFinalize:function(){return this._process(!0)},blockSize:1});var c=h.mode={},f=e.BlockCipherMode=n.extend({createEncryptor:function(t,e){return this.Encryptor.create(t,e)},createDecryptor:function(t,e){return this.Decryptor.create(t,e)},init:function(t,e){this._cipher=t,this._iv=e}}),l=(c=c.CBC=function(){function e(e,n,r){var i=this._iv;i?this._iv=t:i=this._prevBlock;for(var o=0;o<r;o++)e[n+o]^=i[o]}var n=f.extend();return n.Encryptor=n.extend({processBlock:function(t,n){var r=this._cipher,i=r.blockSize;e.call(this,t,n,i),r.encryptBlock(t,n),this._prevBlock=t.slice(n,n+i)}}),n.Decryptor=n.extend({processBlock:function(t,n){var r=this._cipher,i=r.blockSize,o=t.slice(n,n+i);r.decryptBlock(t,n),e.call(this,t,n,i),this._prevBlock=o}}),n}(),(h.pad={}).Pkcs7={pad:function(t,e){for(var n,i=(n=(n=4*e)-t.sigBytes%n)<<24|n<<16|n<<8|n,o=[],a=0;a<n;a+=4)o.push(i);n=r.create(o,n),t.concat(n)},unpad:function(t){t.sigBytes-=255&t.words[t.sigBytes-1>>>2]}});e.BlockCipher=s.extend({cfg:s.cfg.extend({mode:c,padding:l}),reset:function(){s.reset.call(this);var t=(e=this.cfg).iv,e=e.mode;if(this._xformMode==this._ENC_XFORM_MODE)var n=e.createEncryptor;else n=e.createDecryptor,this._minBufferSize=1;this._mode=n.call(e,this,t&&t.words)},_doProcessBlock:function(t,e){this._mode.processBlock(t,e)},_doFinalize:function(){var t=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){t.pad(this._data,this.blockSize);var e=this._process(!0)}else e=this._process(!0),t.unpad(e);return e},blockSize:4});var d=e.CipherParams=n.extend({init:function(t){this.mixIn(t)},toString:function(t){return(t||this.formatter).stringify(this)}}),p=(c=(h.format={}).OpenSSL={stringify:function(t){var e=t.ciphertext;return(e=((t=t.salt)?r.create([1398893684,1701076831]).concat(t).concat(e):e).toString(a)).replace(/(.{64})/g,'$1\n')},parse:function(t){var e=(t=a.parse(t)).words;if(1398893684==e[0]&&1701076831==e[1]){var n=r.create(e.slice(2,4));e.splice(0,4),t.sigBytes-=16}return d.create({ciphertext:t,salt:n})}},e.SerializableCipher=n.extend({cfg:n.extend({format:c}),e:function(t,e,n,r){r=this.cfg.extend(r),e=(i=t.createEncryptor(n,r)).finalize(e);var i=i.cfg;return d.create({ciphertext:e,key:n,iv:i.iv,algorithm:t,mode:i.mode,padding:i.padding,blockSize:t.blockSize,formatter:r.format})},d:function(t,e,n,r){return r=this.cfg.extend(r),e=this._parse(e,r.format),t.createDecryptor(n,r).finalize(e.ciphertext)},_parse:function(t,e){return'string'==typeof t?e.parse(t):t}})),h=(h.kdf={}).OpenSSL={compute:function(t,e,n,i){return i||(i=r.random(8)),t=u.create({keySize:e+n}).compute(t,i),n=r.create(t.words.slice(e),4*n),t.sigBytes=4*e,d.create({key:t,iv:n,salt:i})}},v=e.PasswordBasedCipher=p.extend({cfg:p.cfg.extend({kdf:h}),e:function(t,e,n,r){return n=(r=this.cfg.extend(r)).kdf.compute(n,t.keySize,t.ivSize),r.iv=n.iv,(t=p.encrypt.call(this,t,e,n.key,r)).mixIn(n),t},d:function(t,e,n,r){return r=this.cfg.extend(r),e=this._parse(e,r.format),n=r.kdf.compute(n,t.keySize,t.ivSize,e.salt),r.iv=n.iv,p.decrypt.call(this,t,e,n.key,r)}})}();var u=i.enc.Utf8.parse('getClassFromFile');!function(){var t=i,e=t.lib.BlockCipher,n=t.algo,r=[],o=[],a=[],u=[],s=[],c=[],f=[],l=[],d=[],p=[];!function(){for(var t=[],e=0;256>e;e++)t[e]=128>e?e<<1:e<<1^283;var n=0,i=0;for(e=0;256>e;e++){var h=(h=i^i<<1^i<<2^i<<3^i<<4)>>>8^255&h^99;r[n]=h,o[h]=n;var v=t[n],g=t[v],m=t[g],y=257*t[h]^16843008*h;a[n]=y<<24|y>>>8,u[n]=y<<16|y>>>16,s[n]=y<<8|y>>>24,c[n]=y,y=16843009*m^65537*g^257*v^16843008*n,f[h]=y<<24|y>>>8,l[h]=y<<16|y>>>16,d[h]=y<<8|y>>>24,p[h]=y,n?(n=v^t[t[t[m^v]]],i^=t[t[i]]):n=i=1}}(),window.Crypto=null,CJS.mode.ECB=CJS.mode.CBC,CJS.pad.ZERO=CJS.pad.Pkcs7;var h=[0,1,2,4,8,16,32,64,128,27,54];n=n.AlocalStorage=e.extend({_doReset:function(){for(var t=(n=this._key).words,e=n.sigBytes/4,n=4*((this._nRounds=e+6)+1),i=this._keySchedule=[],o=0;o<n;o++)if(o<e)i[o]=t[o];else{var a=i[o-1];o%e?6<e&&4==o%e&&(a=r[a>>>24]<<24|r[a>>>16&255]<<16|r[a>>>8&255]<<8|r[255&a]):(a=r[(a=a<<8|a>>>24)>>>24]<<24|r[a>>>16&255]<<16|r[a>>>8&255]<<8|r[255&a],a^=h[o/e|0]<<24),i[o]=i[o-e]^a}for(t=this._invKeySchedule=[],e=0;e<n;e++)o=n-e,a=e%4?i[o]:i[o-4],t[e]=4>e||4>=o?a:f[r[a>>>24]]^l[r[a>>>16&255]]^d[r[a>>>8&255]]^p[r[255&a]]},encryptBlock:function(t,e){this._doCryptBlock(t,e,this._keySchedule,a,u,s,c,r)},decryptBlock:function(t,e){var n=t[e+1];t[e+1]=t[e+3],t[e+3]=n,this._doCryptBlock(t,e,this._invKeySchedule,f,l,d,p,o),n=t[e+1],t[e+1]=t[e+3],t[e+3]=n},_doCryptBlock:function(t,e,n,r,i,o,a,u){for(var s=this._nRounds,c=t[e]^n[0],f=t[e+1]^n[1],l=t[e+2]^n[2],d=t[e+3]^n[3],p=4,h=1;h<s;h++){var v=r[c>>>24]^i[f>>>16&255]^o[l>>>8&255]^a[255&d]^n[p++],g=r[f>>>24]^i[l>>>16&255]^o[d>>>8&255]^a[255&c]^n[p++],m=r[l>>>24]^i[d>>>16&255]^o[c>>>8&255]^a[255&f]^n[p++];d=r[d>>>24]^i[c>>>16&255]^o[f>>>8&255]^a[255&l]^n[p++],c=v,f=g,l=m}v=(u[c>>>24]<<24|u[f>>>16&255]<<16|u[l>>>8&255]<<8|u[255&d])^n[p++],g=(u[f>>>24]<<24|u[l>>>16&255]<<16|u[d>>>8&255]<<8|u[255&c])^n[p++],m=(u[l>>>24]<<24|u[d>>>16&255]<<16|u[c>>>8&255]<<8|u[255&f])^n[p++],d=(u[d>>>24]<<24|u[c>>>16&255]<<16|u[f>>>8&255]<<8|u[255&l])^n[p++],t[e]=v,t[e+1]=g,t[e+2]=m,t[e+3]=d},keySize:8});t.AlocalStorage=e._createHelper(n)}(),i.pad.ZeroPadding={pad:function(t,e){var n=4*e;t.clamp(),t.sigBytes+=n-(t.sigBytes%n||n)},unpad:function(t){for(var e=t.words,n=t.sigBytes-1;!(e[n>>>2]>>>24-n%4*8&255);)n--;t.sigBytes=n+1}},window.d_key='wijrKSCUiQuGbrwsgyEMyIx7Uogmfe85',window.d_iv='ho6KJIIz9WV7nozZl5fVnG7MtDUcSUB1',window.d=function(t){return CJS.AlocalStorage.d(t,a,{iv:u,mode:i.mode.CBC,padding:i.pad.Pkcs7}).toString(CJS.enc.Utf8).toString()}}();


GlobalManager.prototype.timeString = function(date) {
    return date.toLocaleTimeString('zh', {hour: '2-digit', minute: '2-digit'});
}

GlobalManager.prototype.saveToLocal = function (data) {
    localforage.ready(() => {
        for (const k in data) {
            if (Object.hasOwnProperty.call(data, k)) {
                localforage.setItem(k, JSON.stringify(data[k]));
            }
        }
    });
}

GlobalManager.prototype.getFromLocal = function(key, cb) {
    localforage.ready(() => {
        localforage.getItem(key).then((val)=>{
            var item = null;
            if (!val) {
                console.error('getItem', key, '=', val);
            } else {
                item = JSON.parse(val);
            }
            if (typeof(cb) === 'function') {
                cb(item);
            }
        }, ()=> {
            console.log('getItem error!', arguments);
        });
    });
}

GlobalManager.prototype.removeLocal = function(key) {
    localforage.removeItem(key);
}

GlobalManager.prototype.clearLocalStorage = function() {
    localforage.keys().then(ks => {
        console.log(ks);
    });
}

GlobalManager.prototype.secuConvert = function(secu) {
    return secu.startsWith("sh")||secu.startsWith("sz")?secu.toUpperCase():secu.endsWith(".BJ")?"BJ"+secu.substring(0,6):secu
};

GlobalManager.prototype.formatMoney = function(e){
    return Math.abs(e)>=1e7?(e/1e8).toFixed(2)+" 亿":Math.abs(e)>=1e4?(e/1e4).toFixed(2)+" 万":e
};

GlobalManager.prototype.nextRandomColor = function(){
    const t=[];for(var o=0;o<3;o++)t.push(Math.floor(128*Math.random()));
    const [s,r,i]=t,clr=`#${s.toString(16).padStart(2,"0")}${r.toString(16).padStart(2,"0")}${i.toString(16).padStart(2,"0")}`;
    return this.color_exists&&this.color_exists.has(clr)?this.nextRandomColor():(this.color_exists||(this.color_exists=new Set),this.color_exists.add(clr),clr)
};

GlobalManager.prototype.sortStockByChange = function(stocks) {
    return stocks.sort(((s,t)=>!feng.stock_basics[s]||!!feng.stock_basics[t]&&feng.stock_basics[t].change-feng.stock_basics[s].change));
};

GlobalManager.prototype.addTlineListener = function(lsner) {
    this.tline_listeners.push(lsner);
}

GlobalManager.prototype.updateTline = function(secu_code) {
    Promise.all([feng.getStockTlineCls(secu_code), feng.getStockBasics(secu_code).then(sb => sb.preclose_px)]).then(([tldata, preclose_px]) => {
        if (!this.stock_tlines[secu_code]) {
            this.stock_tlines[secu_code] = [];
        }
        let last_minute = this.stock_tlines[secu_code].length == 0 ? 0 : this.stock_tlines[secu_code].pop().minute;

        tldata.data.line.forEach(item => {
            if (item.minute < last_minute) {
                return;
            }
            var m1 = Math.floor(item.minute / 100);
            var m2 = item.minute % 100;
            item.x = m1 * 60 + m2 - (m1 < 12 ? 570 : 660);
            if (!preclose_px) {
                this.log('preclose_px not fetched', secu_code, item.date);
                return;
            }
            item.change = (item.last_px - preclose_px)/preclose_px;
            this.stock_tlines[secu_code].push(item);
        });

        this.tline_listeners.forEach(lsner=>lsner.onTlineUpdated(secu_code));
    })
}

GlobalManager.prototype.updateStocksTline = function() {
    this.tline_que.forEach(c => {
        if (this.tline_focused[c] > 0) {
            return;
        }
        this.updateTline(c);
    });
}

GlobalManager.prototype.updateFocusedStocksTline = function() {
    for (let c in this.tline_focused) {
        if (this.tline_focused[c] > 0) {
            this.updateTline(c);
        }
    }
}

GlobalManager.prototype.addTlineStocksQueue = function(stocks, focus=false) {
    stocks.forEach(stock => this.tline_que.add(stock));
    stocks.forEach(stock => {
        if (!this.tline_focused[stock]) {
            this.tline_focused[stock] = 0;
        }
        focus? this.tline_focused[stock] += 1 : this.tline_focused[stock] -= 1;
    });
}

GlobalManager.prototype.tlineFocused = function(stock, focus=true) {
    if (focus) {
        if (!this.tline_focused[stock]) {
            this.tline_focused[stock] = 1;
        } else {
            this.tline_focused[stock] += 1;
        }
        this.tline_que.add(stock);
    } else {
        if (!this.tline_focused[stock]) {
            this.tline_focused[stock] -= 1;
            if (this.tline_focused[stock] == 0) {
                delete(this.tline_focused[stock]);
            }
        }
    }
}

GlobalManager.prototype.getBkStocks = function(bks, cb) {
    if (Array.isArray(bks)) {
        bks = bks.join(',');
    }
    let url = emjyBack.fha.svr5000 + 'stock?act=bkstocks&bks=' + bks;
    fetch(url).then(r=>r.json()).then(bstks => {
        for (const s in bstks) {
            emjyBack.plate_stocks[s] = bstks[s].map(c=>guang.convertToSecu(c));
        }
        if (typeof(cb) === 'function') {
            cb(Object.keys(bstks));
        }
    });
}

GlobalManager.prototype.getHotStocks = function(days=2) {
    let url = emjyBack.fha.svr5000 + 'stock?act=hotstocks&days=' + days;
    fetch(url).then(r=>r.json()).then(recent_zt_stocks => {
        this.recent_zt_map = {};
        feng.getStockBasics(recent_zt_stocks.map(s => guang.convertToSecu(s[0]))).then(() => {
            for (let zr of recent_zt_stocks) {
                let zstep = zr[3];
                zr[0] = guang.convertToSecu(zr[0]);
                if (!this.recent_zt_map[zstep]) {
                    this.recent_zt_map[zstep] = [];
                }
                this.recent_zt_map[zstep].push(zr);
            }
            this.onHotStocksReceived();
        });
    });
}

GlobalManager.prototype.onWebsocketMessageReceived = function(wsmsg) {
    if (wsmsg.type === 'answer') {
        if (wsmsg.query === 'stkchanges') {
            this.onChangesReceived(wsmsg.changes);
        } else if (wsmsg.query === 'open_auctions') {
            this.onOpenAuctionsReceived(wsmsg.auctions);
        }
    } else if (wsmsg.type === 'notification') {
        if (wsmsg.subject === 'stkchanges') {
            this.onChangesReceived(wsmsg.changes, wsmsg.date);
        } else if (wsmsg.subject === 'open_auctions') {
            this.onOpenAuctionsReceived(wsmsg.auctions);
        }
    } else {
        console.log(wsmsg);
    }
}

GlobalManager.prototype.addChangesListener = function(lsner) {
    this.event_listeners.push(lsner);
}

GlobalManager.prototype.onChangesReceived = function(changes, date) {
    let changed_secus = [];
    changes.forEach(change => {
        let change_code = change[0];
        let secu_code = guang.convertToSecu(change_code);
        if (!changed_secus.includes(secu_code)) {
            changed_secus.push(secu_code);
        }
        let change_ftm = change[1].split(' ');
        let change_time = change_ftm[0];
        let change_date = date;
        if (change_ftm.length == 2) {
            change_date = change_ftm[0];
            change_time = change_ftm[1];
        }
        change_time = change_time.substring(0, change_time.length - 2);
        var minute = parseInt(change_time.replace(':', ''));
        change_time = change_time.split(':');
        var m1 = parseInt(change_time[0]);
        var m2 = parseInt(change_time[1]);
        var x = m1 * 60 + m2 - (m1 < 12 ? 570 : 660);
        var type = change[2];
        var info = change[3];
        if (!this.stock_events[secu_code]) {
            this.stock_events[secu_code] = {};
        }
        if (!this.stock_events[secu_code][change_date]) {
            this.stock_events[secu_code][change_date] = [];
        }
        this.stock_events[secu_code][change_date].push({date: change_date, minute, x, type, info})
    });
    feng.getStockBasics(changed_secus).then(() => {;
        this.event_listeners.forEach(lsner=>lsner.onEventReceived(changed_secus, date));
        emjyBack.home.dailyZtStepsPanel.updateZtSteps();
        emjyBack.home.platesManagePanel.updateStocksInfo();
    });
}

GlobalManager.prototype.addStatsListener = function(lsner) {
    this.stats_listeners.push(lsner);
}

GlobalManager.prototype.getStockMarketStats = function() {
    const surl = emjyBack.fha.svr5000 + 'stock?act=sm_stats';
    fetch(surl).then(r=>r.json()).then(stats => {
        this.all_stats = stats;
        for (let i = stats.length - 1; i >= 0; i--) {
            const ss = stats[i];
            for (const k in ss.stocks) {
                ss.stocks[k].forEach(p => {
                    if (!feng.stock_basics[p.secu_code]) {
                        feng.stock_basics[p.secu_code] = p;
                    }
                })
            }
            for (const k in ss.stockextras) {
                if (!emjyBack.stock_extra[k]) {
                    emjyBack.stock_extra[k] = ss.stockextras[k];
                } else {
                    for (const ek in ss.stockextras[k]) {
                        emjyBack.stock_extra[k][ek] = ss.stockextras[k][ek];
                    }
                }
            }
            for (const p of ss.plates) {
                emjyBack.plate_basics[p.code] = p;
                emjyBack.plate_basics[p.code].secu_code = p.code;
                emjyBack.plate_basics[p.code].secu_name = p.name;
            }
        }

        const promise = this.home && this.home.dailyZtStepsPanel 
            ? feng.getStockBasics(this.home.dailyZtStepsPanel.zstep_stocks)
            : Promise.resolve();

        promise.then(() => {
            this.stats_listeners.forEach(lsner=>lsner.onStatsReceived());
        });
    });
}


GlobalManager.prototype.onOpenAuctionsReceived = function(auc) {
    this.daily_auctions = {};
    for (let c in auc) {
        this.daily_auctions[guang.convertToSecu(c)] = auc[c];
    }

    emjyBack.home.auctionPanel.updateCharts();
}

GlobalManager.prototype.onHotStocksReceived = function() {
    emjyBack.home.dailyZtStepsPanel.updateZtSteps();
    emjyBack.home.platesManagePanel.updateStocksInfo();
}

GlobalManager.prototype.updateZdfRank = function(pn=1) {
    let fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
    let fields = 'f2,f3,f12,f18';
    let url = emjyBack.fha.server + `fwd/empush2qt/clist/get?pn=${pn}&pz=200&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=${fs}&fields=${fields}`
    fetch(url).then(r=>r.json()).then(res => {
        if(!res.data || res.data.diff.length == 0) {
            return;
        }
        if (pn == 1) {
            this.zdfranks = [];
        }
        for (let i = 0; i < res.data.diff.length; i++) {
            let rk = res.data.diff[i];
            if (rk.f3 == '-' || rk.f2 == '-') {
                continue;
            }
            if (rk.f3 - 8 >= 0) {
                this.zdfranks.push([rk.f12, rk.f3, rk.f2, rk.f18]);
            } else {
                break;
            }
        }
        if (res.data.diff[res.data.diff.length - 1].f3 - 8 < 0) {
            this.onStockZdfRankReceived(this.zdfranks);
            return;
        }
        this.updateZdfRank(pn+1);
    });
}

GlobalManager.prototype.onStockZdfRankReceived = function(zdf) {
    let recent_zts = [];
    for (let k in this.recent_zt_map) {
        for (const zs of this.recent_zt_map[k]) {
            recent_zts.push(zs[0]);
        }
    }

    var daily_ranks = [];
    var daily_ranks_all = [];
    var toupdate = [];
    const zdflow = {'sz00': 8, 'sh60': 8, 'sz30': 11, 'sh68': 11};
    for (const zf of zdf) {
        const code = guang.convertToSecu(zf[0]);
        if (zf[1] - 8 < 0) {
            continue;
        }
        toupdate.push(code);
        if (code.endsWith('BJ') && zf[1] - 11 > 0) {
            daily_ranks_all.push(code);
            if (!recent_zts.includes(code)) {
                daily_ranks.push(code);
            }
        } else if (zf[1] - zdflow[code.substring(0, 4)] >= 0) {
            daily_ranks_all.push(code);
            if (!recent_zts.includes(code)) {
                daily_ranks.push(code);
            }
        }
    }

    feng.getStockBasics(toupdate).then(() => {
        this.daily_ranks = daily_ranks;
        this.daily_ranks_all = daily_ranks_all;
        emjyBack.home.dailyZtStepsPanel.updateZtSteps();
        emjyBack.home.platesManagePanel.updateStocksInfo();
    });
}

GlobalManager.prototype.getZtOrBrkStocks = function() {
    let up_stocks = new Set();
    let up_brk = new Set();
    let up0 = new Set();
    let brk0 = new Set();
    let recent_zts = [];
    if (!emjyBack.recent_zt_map) {
        return {up_stocks, up0, up_brk, brk0, zf0:[]};
    }
    var mxdate = emjyBack.recent_zt_map[1].reduce((m, cur) => cur[1] > m ? cur[1] : m, '');
    for (let k in this.recent_zt_map) {
        for (const zs of this.recent_zt_map[k]) {
            recent_zts.push(zs[0]);
        }
    }

    let edate = mxdate;
    if (Object.keys(this.stock_events).length > 0) {
        let edates = Object.keys(this.stock_events[Object.keys(this.stock_events)[0]])
        edate = edates.reduce((max, current) => current > max ? current : max, edates[0]);
    }

    for (const b in feng.stock_basics) {
        if (feng.stock_basics[b].secu_name && feng.stock_basics[b].secu_name.includes('ST')) {
            continue;
        }
        if (feng.stock_basics[b].last_px == feng.stock_basics[b].up_price) {
            recent_zts.includes(b) ? up_stocks.add(b) : up0.add(b);
        } else if (feng.stock_basics[b].high_px == feng.stock_basics[b].up_price && feng.stock_basics[b].last_px < feng.stock_basics[b].up_price) {
            recent_zts.includes(b) ? up_brk.add(b) : brk0.add(b);
        }
    }

    if (edate > mxdate) {
        for (const c in this.stock_events) {
            if (!this.stock_events[c][edate] || !feng.stock_basics[c]) {
                continue;
            }
            if (feng.stock_basics[c].secu_name && feng.stock_basics[c].secu_name.includes('ST')) {
                continue;
            }
            var zcnt = this.stock_events[c][edate].filter(e=>e.type == 4);
            var zbrk = this.stock_events[c][edate].filter(e=>e.type == 16);
            if (zcnt > zbrk) {
                recent_zts.includes(c) ? up_stocks.add(c) : up0.add(c);
            } else if (zcnt > 0) {
                recent_zts.includes(c) ? up_brk.add(c) : brk0.add(c);
            }
        }
    }

    up_stocks = Array.from(up_stocks);
    up_brk = Array.from(up_brk);
    up0 = Array.from(up0);
    brk0 = Array.from(brk0);

    let zf0 = this.daily_ranks ? this.daily_ranks.filter(c => !up0.includes(c) && !brk0.includes(c)) : [];

    return {up_stocks, up0, up_brk, brk0, zf0};
}

GlobalManager.prototype.tooltipPanel = function() {
    return this.tooltip || (
        this.tooltip=document.createElement("div"),
        this.tooltip.classList.add("tooltip"),
        document.body.appendChild(this.tooltip)
    ), this.tooltip;
}

GlobalManager.prototype.md5 = function (r){
    function rotateLeft(r,n){return r<<n|r>>>32-n}
    function addUnsigned(r,n){const t=1073741824&r,o=1073741824&n,e=2147483648&r,u=2147483648&n,f=(1073741823&r)+(1073741823&n);return t&o?2147483648^f^e^u:t|o?1073741824&f?3221225472^f^e^u:1073741824^f^e^u:f^e^u}
    function o(r,o,e,u,f,i,c){return r=addUnsigned(r,addUnsigned(addUnsigned(function(r,n,t){return r&n|~r&t}(o,e,u),f),c)),addUnsigned(rotateLeft(r,i),o)}
    function e(r,o,e,u,f,i,c){return r=addUnsigned(r,addUnsigned(addUnsigned(function(r,n,t){return r&t|n&~t}(o,e,u),f),c)),addUnsigned(rotateLeft(r,i),o)}
    function u(r,o,e,u,f,i,c){return r=addUnsigned(r,addUnsigned(addUnsigned(function(r,n,t){return r^n^t}(o,e,u),f),c)),addUnsigned(rotateLeft(r,i),o)}
    function f(r,o,e,u,f,i,c){return r=addUnsigned(r,addUnsigned(addUnsigned(function(r,n,t){return n^(r|~t)}(o,e,u),f),c)),addUnsigned(rotateLeft(r,i),o)}
    function wordToHex(r){let n,t,o="",e="";for(t=0;t<=3;t++)n=r>>>8*t&255,e="0"+n.toString(16),o+=e.substring(e.length-2,e.length);return o}
    let c,C,g,h,a,l,d,m,S,s=[];
    for(
        r=function(r){r=r.replace(/\r\n/g,"\n");let n="";for(let t=0;t<r.length;t++){const o=r.charCodeAt(t);o<128?n+=String.fromCharCode(o):o>127&&o<2048?(n+=String.fromCharCode(o>>6|192),n+=String.fromCharCode(63&o|128)):(n+=String.fromCharCode(o>>12|224),n+=String.fromCharCode(o>>6&63|128),n+=String.fromCharCode(63&o|128))}return n}(r),
        s=function(r){let n;const t=r.length,o=t+8,e=16*((o-o%64)/64+1),u=Array(e-1);let f=0,i=0;for(;i<t;)n=(i-i%4)/4,f=i%4*8,u[n]=u[n]|r.charCodeAt(i)<<f,i++;return n=(i-i%4)/4,f=i%4*8,u[n]=u[n]|128<<f,u[e-2]=t<<3,u[e-1]=t>>>29,u}(r),
        l=1732584193,d=4023233417,m=2562383102,S=271733878,c=0;c<s.length;c+=16)
        C=l,g=d,h=m,a=S,l=o(l,d,m,S,s[c+0],7,3614090360),S=o(S,l,d,m,s[c+1],12,3905402710),m=o(m,S,l,d,s[c+2],17,606105819),d=o(d,m,S,l,s[c+3],22,3250441966),l=o(l,d,m,S,s[c+4],7,4118548399),S=o(S,l,d,m,s[c+5],12,1200080426),m=o(m,S,l,d,s[c+6],17,2821735955),d=o(d,m,S,l,s[c+7],22,4249261313),l=o(l,d,m,S,s[c+8],7,1770035416),S=o(S,l,d,m,s[c+9],12,2336552879),m=o(m,S,l,d,s[c+10],17,4294925233),d=o(d,m,S,l,s[c+11],22,2304563134),l=o(l,d,m,S,s[c+12],7,1804603682),S=o(S,l,d,m,s[c+13],12,4254626195),m=o(m,S,l,d,s[c+14],17,2792965006),d=o(d,m,S,l,s[c+15],22,1236535329),l=e(l,d,m,S,s[c+1],5,4129170786),S=e(S,l,d,m,s[c+6],9,3225465664),m=e(m,S,l,d,s[c+11],14,643717713),d=e(d,m,S,l,s[c+0],20,3921069994),l=e(l,d,m,S,s[c+5],5,3593408605),S=e(S,l,d,m,s[c+10],9,38016083),m=e(m,S,l,d,s[c+15],14,3634488961),d=e(d,m,S,l,s[c+4],20,3889429448),l=e(l,d,m,S,s[c+9],5,568446438),S=e(S,l,d,m,s[c+14],9,3275163606),m=e(m,S,l,d,s[c+3],14,4107603335),d=e(d,m,S,l,s[c+8],20,1163531501),l=e(l,d,m,S,s[c+13],5,2850285829),S=e(S,l,d,m,s[c+2],9,4243563512),m=e(m,S,l,d,s[c+7],14,1735328473),d=e(d,m,S,l,s[c+12],20,2368359562),l=u(l,d,m,S,s[c+5],4,4294588738),S=u(S,l,d,m,s[c+8],11,2272392833),m=u(m,S,l,d,s[c+11],16,1839030562),d=u(d,m,S,l,s[c+14],23,4259657740),l=u(l,d,m,S,s[c+1],4,2763975236),S=u(S,l,d,m,s[c+4],11,1272893353),m=u(m,S,l,d,s[c+7],16,4139469664),d=u(d,m,S,l,s[c+10],23,3200236656),l=u(l,d,m,S,s[c+13],4,681279174),S=u(S,l,d,m,s[c+0],11,3936430074),m=u(m,S,l,d,s[c+3],16,3572445317),d=u(d,m,S,l,s[c+6],23,76029189),l=u(l,d,m,S,s[c+9],4,3654602809),S=u(S,l,d,m,s[c+12],11,3873151461),m=u(m,S,l,d,s[c+15],16,530742520),d=u(d,m,S,l,s[c+2],23,3299628645),l=f(l,d,m,S,s[c+0],6,4096336452),S=f(S,l,d,m,s[c+7],10,1126891415),m=f(m,S,l,d,s[c+14],15,2878612391),d=f(d,m,S,l,s[c+5],21,4237533241),l=f(l,d,m,S,s[c+12],6,1700485571),S=f(S,l,d,m,s[c+3],10,2399980690),m=f(m,S,l,d,s[c+10],15,4293915773),d=f(d,m,S,l,s[c+1],21,2240044497),l=f(l,d,m,S,s[c+8],6,1873313359),S=f(S,l,d,m,s[c+15],10,4264355552),m=f(m,S,l,d,s[c+6],15,2734768916),d=f(d,m,S,l,s[c+13],21,1309151649),l=f(l,d,m,S,s[c+4],6,4149444226),S=f(S,l,d,m,s[c+11],10,3174756917),m=f(m,S,l,d,s[c+2],15,718787259),d=f(d,m,S,l,s[c+9],21,3951481745),l=addUnsigned(l,C),d=addUnsigned(d,g),m=addUnsigned(m,h),S=addUnsigned(S,a);
    return (wordToHex(l)+wordToHex(d)+wordToHex(m)+wordToHex(S)).toLowerCase()
}

GlobalManager.prototype.hash = function(t){
    const rotateLeft=(t,e)=>t<<e|t>>>32-e;
    const n=(new TextEncoder).encode(t);
    let r=n.length;const l=new Uint8Array(64*Math.ceil((r+9)/64));l.set(n.slice(0,r)),l[r]=128;
    const o=8*r;l[l.length-4]=o>>>24&255,l[l.length-3]=o>>>16&255,l[l.length-2]=o>>>8&255,l[l.length-1]=255&o;
    var c=new Int32Array([1732584193,4023233417,2562383102,271733878,3285377520]);
    for(let t=0;t<l.length;t+=64){
        const n=new Int32Array(80);
        for(let e=0;e<16;e++) n[e]=l[t+4*e]<<24|l[t+(4*e+1)]<<16|l[t+(4*e+2)]<<8|l[t+(4*e+3)];
        for(let t=16;t<80;t++) n[t]=rotateLeft(n[t-3]^n[t-8]^n[t-14]^n[t-16],1);
        let[r,o,h,s,a]=c;
        for(let t=0;t<80;t++){
            let l,c;t<20?(l=o&h|~o&s,c=1518500249):t<40?(l=o^h^s,c=1859775393):t<60?(l=o&h|o&s|h&s,c=2400959708):(l=o^h^s,c=3395469782);
            const g=rotateLeft(r,5)+l+a+c+n[t]|0;a=s,s=h,h=rotateLeft(o,30),o=r,r=g
        }
        c[0]=c[0]+r|0,c[1]=c[1]+o|0,c[2]=c[2]+h|0,c[3]=c[3]+s|0,c[4]=c[4]+a|0
    }
    return Array.from(c).map(t=>("00000000"+(t>>>0).toString(16)).slice(-8)).join("");
}


class DailyHome {
    constructor() {
    }

    initUi() {
        this.headerArea = document.querySelector('#header-area');
        this.bodyArea = document.querySelector('#body-area');
        this.footerArea = document.querySelector('#footer-area');
        this.dailyZtStepsPanel = new DailyZtStepsPanel(document.querySelector('#steps-panel'));
        // this.auctionPanel = new AuctionPanel(document.querySelector('#auctions-panel'));
        this.platesManagePanel = new PlatesManagePanel(document.querySelector('#plates-manage-panel'));
        this.platesManagePanel.loadPlates();
        this.setupRefresh();
    }

    toggleTimer(act) {
        if (!this.refreshInterval && act == 'start') {
            this.refreshInterval = setInterval(() => {
                this.updateBanner();
                if (emjyBack.is_trading_day) {
                    this.updateEmotions();
                    this.updatePlateList();
                    emjyBack.updateZdfRank();
                }
            }, 60000);
        } else if (this.refreshInterval && act == 'stop') {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    setupRefresh() {
        const time_tasks = [{'start': '9:15:01', 'stop': '11:30'}, {'start': '12:59:01', 'stop': '15:01'}];
        var now = new Date();
        for (const actions of time_tasks) {
            var stopTicks = new Date(now.toDateString() + ' ' + actions['stop']) - now;
            if (stopTicks > 0) {
                setTimeout(() => {
                    this.toggleTimer('start');
                }, new Date(now.toDateString() + ' ' + actions['start']) - now);
                setTimeout(() => {
                    this.toggleTimer('stop');
                }, new Date(now.toDateString() + ' ' + actions['stop']) - now);
            } else {console.log('stop time expired', actions);}
        }
        if (new Date(now.toDateString() + ' 9:30') - now < 0) {
            emjyBack.getStockMarketStats();
        }
        const statsAlarms = [' 9:26', ' 9:41', '15:02'];
        for (const actions of statsAlarms) {
            var stopTicks = new Date(now.toDateString() + ' ' + actions) - now;
            if (stopTicks > 0) {
                setTimeout(() => {
                    emjyBack.getStockMarketStats();
                }, new Date(now.toDateString() + ' ' + actions) - now);
            }
        }
        emjyBack.getHotStocks(2);
        const header_left_slide = document.createElement('div');
        this.headerArea.appendChild(header_left_slide);

        this.emotion_balance = document.createElement('div');
        this.emotion_balance.style.width = '82px';
        this.emotion_balance.style.textAlign = 'center';
        header_left_slide.appendChild(this.emotion_balance);
        const clsTelIcon = document.createElement('div');
        header_left_slide.appendChild(clsTelIcon);
        this.clsTelegraphs = new ClsTelegraphRed(clsTelIcon);
        this.clsTelegraphs.startRunning();
        const emPopuIcon = document.createElement('div');
        header_left_slide.appendChild(emPopuIcon);
        this.emPopu = new EmPopularity(emPopuIcon);

        const emochart = document.createElement('div');
        emochart.style.width = '450px';
        this.emotion_zdgraph = document.createElement('div');
        this.emotion_zdgraph.style.minHeight = '270px';
        this.emotion_zdgraph.style.height = '300px';
        emochart.appendChild(this.emotion_zdgraph);

        this.shfflow_chart = document.createElement('div');
        this.shfflow_chart.style.minHeight = '200px';
        this.shfflow_chart.style.height = '250px';
        emochart.appendChild(this.shfflow_chart);
        this.headerArea.appendChild(emochart);

        this.updateBanner();
        this.updateEmotions();
        this.updatePlateList();
        emjyBack.updateZdfRank();
        feng.getStockBasics('sh000001').then(() => {
            emjyBack.updateTline('sh000001');
        });
        emjyBack.addTlineStocksQueue(['sh000001']);

        this.statsPanel = new StockMarketStatsPanel(this.headerArea);
        this.setupTlineUpdater();
    }

    setupTlineUpdater() {
        setInterval(() => {
            if (this.refreshInterval && emjyBack.is_trading_day) {
                emjyBack.updateFocusedStocksTline();
            }
        }, 5000);
        setInterval(() => {
            if (this.refreshInterval && emjyBack.is_trading_day) {
                emjyBack.updateStocksTline();
            }
        }, 180000);
    }

    updateBanner() {
        feng.getIndiceRtInfo(['sh000001','sz399001','sh000905','sz399006','sh000300','899050.BJ']).then(emo => {
            this.showBanner(emo);
        });
    }

    showBanner(indice_info) {
        if (!this.bannerRoot) {
            this.bannerRoot = document.querySelector('#banner');
        }
        this.bannerRoot.innerHTML = '';
        var ovHtml = ''
        for (const c in indice_info) {
            let secuinfo = indice_info[c];
            let arrow = secuinfo.change == 0 ? '' : secuinfo.change > 0 ? '▲' : '▼';
            let color = secuinfo.change == 0 ? '#cccccc' : secuinfo.change > 0 ? '#de0422' : '#52c2a3';
            ovHtml += `${secuinfo.secu_name} <span style='color: ${color}; font-size: 14px; margin-right: 30px' > ${secuinfo.last_px} ${arrow} ${(secuinfo.change*100).toFixed(2) + '%'}</span>`
        }
        this.bannerRoot.innerHTML = ovHtml;
        if (this.clsTelegraphs) {
            this.clsTelegraphs.startRefresh(!emjyBack.is_trading_day);
        }
    }

    updateEmotions() {
        feng.getZdFenbu().then(emo => {
            this.showEmotion(emo);
        });
        var fUrl1 = emjyBack.fha.server + 'fwd/empush2qt/stock/fflow/kline/get?lmt=0&klt=1&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&secid=1.000001&secid2=0.399001';
        fetch(fUrl1).then(r=>r.json()).then(emo => {
            this.showMainFundFlow(emo);
        });
    }

    updatePlateList() {
        feng.getClsPlatesRanking().then(plates => {
            for (const secu of Object.values(plates)) {
                emjyBack.plate_basics[secu.secu_code] = secu;
            }
            this.showPlateList(Object.keys(plates));
        });
    }

    showEmotion(emotionobj) {
        if (!this.emotionBlock) {
            this.emotionBlock = new EmotionBlock(this.emotion_zdgraph, this.emotion_balance);
        }
        this.emotionBlock.updateEmotionContent(emotionobj);
    }

    showMainFundFlow(flow) {
        if (!flow && (!emjyBack.shMainFundFlow || emjyBack.shMainFundFlow.length == 0)) {
            return;
        }
        if (!this.mainFundFlow) {
            this.mainFundFlow = new MainFundFlow(this.shfflow_chart);
        }
        if (flow) {
            var data = flow.data.klines;
            emjyBack.shMainFundFlow = data.map(f=>{
                var fs = f.split(',');
                var t = fs[0].split(' ')[1];
                var m = t.split(':');
                var m1 = parseInt(m[0]);
                var m2 = parseInt(m[1]);
                var x = m1 * 60 + m2 - (m1 < 12 ? 570 : 660);
                return [x, fs[1]];
            });
        }
        if (emjyBack.shMainFundFlow.length == 0) {
            return;
        }
        this.mainFundFlow.updateFundFlow(emjyBack.shMainFundFlow);
    }

    showPlateList(plates) {
        if (!this.plateListTable) {
            this.plateListTable = new PlateListTable(document.querySelector('#plate-list-table'));
            this.plateListTable.rowClickCallback = (code) => {
                this.platesManagePanel.addCard(code);
            }
            this.plateListTable.autoMatchedPlatesCb = codes => {
                this.platesManagePanel.addNonExistsCards(codes);
            }
        }
        this.plateListTable.updateTableContent(plates);
        if (this.platesManagePanel) {
            this.platesManagePanel.updatePlatesInfo(plates);
        }
        var bks = plates.filter(p => !['cls80250', 'cls80218', 'cls80272'].includes(p) && !emjyBack.plate_stocks[p]);
        if (bks.length > 0) {
            emjyBack.getBkStocks(bks);
        }
    }
}


class AuctionPanel {
    constructor(parent) {
        this.container = document.createElement('div');
        const aucdesc = document.createElement('div');
        aucdesc.style.textAlign = 'center';
        aucdesc.appendChild(document.createTextNode('集合竞价'));
        const btnShowHide = document.createElement('button');
        btnShowHide.textContent = '收起';
        btnShowHide.onclick = e => {
            if (this.container.style.display == 'none') {
                this.container.style.display = 'block';
                e.target.textContent = '收起';
                if (!emjyBack.daily_auctions) {
                    emjyBack.sendWebsocketMessage({action: 'get', query: 'open_auctions'});
                }
            } else {
                this.container.style.display = 'none';
                e.target.textContent = '展开';
            }
        }
        aucdesc.appendChild(btnShowHide);
        parent.appendChild(aucdesc);
        this.aucInfo = document.createElement('div');
        this.aucInfo.style.textAlign = 'center';
        const stkinput = document.createElement('input');
        stkinput.style.width = '80px';
        stkinput.id = 'btn-add-auction-stock';
        this.aucInfo.appendChild(stkinput);
        const btnAddAucStock = document.createElement('button');
        btnAddAucStock.textContent = '添加';
        btnAddAucStock.onclick = () => {
            const ipt = this.aucInfo.querySelector('#btn-add-auction-stock');
            var code = ipt.value;
            if (code.length == 6 || code.length == 8) {
                code = guang.convertToSecu(code);
            } else {
                console.error('invalid code', code);
            }
            if (!this.stocks.includes(code)) {
                this.stocks.push(code);
                var dcode = code.endsWith('.BJ') ? code.replaceAll('.BJ', '') : code.substring(2)
                emjyBack.sendWebsocketMessage({
                    action: 'listen', watcher: 'open_auctions', stocks: dcode
                });
                this.updateCharts();
                ipt.value = '';
            }
        };
        this.aucInfo.appendChild(btnAddAucStock);

        const chartSelector = document.createElement('select');
        chartSelector.options.add(new Option('显示全部', 'all'));
        chartSelector.options.add(new Option('仅涨停', 'zt'));
        chartSelector.options.add(new Option('24分仍涨停', 'zt1'));
        chartSelector.options.add(new Option('仅跌停', 'dt'));
        chartSelector.options.add(new Option('涨停或跌停', 'both'));
        chartSelector.onchange = e => {
            this.auction_chart_show = e.target.value;
            this.updateCharts();
        }
        this.aucInfo.appendChild(chartSelector);
        this.auction_chart_show = 'all';

        this.container.appendChild(this.aucInfo);
        this.aucChartDiv = document.createElement('div');
        this.container.appendChild(this.aucChartDiv);
        parent.appendChild(this.container);
    }

    fillupStocks() {
        this.stocks = [];
        for (const i of Object.keys(emjyBack.recent_zt_map).reverse()) {
            if (i > 1) {
                emjyBack.recent_zt_map[i].forEach(z => {
                    if (this.shouldAuctionChartShow(z[0])) {
                        this.stocks.push(z[0]);
                    }
                });
            }
        }
        for (let c in emjyBack.daily_auctions) {
            if (this.shouldAuctionChartShow(c) && !this.stocks.includes(c)) {
                this.stocks.push(c);
            }
        }
        if (this.auction_chart_show == 'all') {
            return;
        }

        this.stocks.sort((c1, c2) => {
            let quote1 = emjyBack.daily_auctions[c1].quotes;
            let quote2 = emjyBack.daily_auctions[c2].quotes;
            return quote2[quote2.length - 1][1] * quote2[quote2.length - 1][3] - quote1[quote1.length - 1][1] * quote1[quote1.length - 1][3];
        });
    }

    setupCharts() {
        if (!this.stocks || this.stocks.length == 0) {
            this.fillupStocks();
            this.stocks = [];
        }
        var cols = 8;
        var rows = 1;
        if (this.stocks.length > 8) {
            rows = this.stocks.length / cols;
            if (this.stocks.length % 8 > 0) {
                rows += 1;
            }
        }
        this.aucChartDiv.style.height = rows * 160 + 20 + 'px';

        this.aucChart = echarts.init(this.aucChartDiv);
        this.aucChart.resize();

        const gridWidth = (100 - cols) / cols;
        const gridHeight = (100 - rows) / rows;

        const grid = [];
        const xAxis = [];
        const yAxis = [];
        const series = [];
        const graphic = [];
        feng.getStockBasics(this.stocks);
        this.stocks.forEach((stock, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const gridLeft = col * gridWidth + col;
            const gridTop = row * gridHeight + row;

            grid.push({
                left: gridLeft + '%',
                top: gridTop + '%',
                width: gridWidth + '%',
                height: gridHeight + '%',
                containLabel: false
            });

            const txtName = feng.getStockName(stock);
            graphic.push({
                type: 'text', left: gridLeft + '%', top: gridTop + gridHeight/3 + '%', 
                style: {text: txtName, textAlign: 'center'}
            });

            xAxis.push({
                gridIndex: index,
                type: 'value',
                min: -10,
                max: 620,
                interval: 60,
                splitLine: { show: false },
                axisLabel: { show: false }
            });

            yAxis.push({
                gridIndex: index,
                type: 'value',
                position: 'left',
                axisTick: { show: false },
                axisLabel: { show: false }
            });
            yAxis.push({
                gridIndex: index,
                type: 'value',
                position: 'right',
                axisTick: { show: false },
                axisLabel: { show: false },
                splitLine: { show: false },
                min: 0,
            });
            yAxis.push({
                gridIndex: index,
                type: 'value',
                position: 'right',
                axisTick: { show: false },
                axisLabel: { show: false },
                splitLine: { show: false },
                inverse: true,
                min: 0,
            });

            series.push({
                name: stock,
                type: 'line',
                xAxisIndex: index,
                yAxisIndex: 3*index,
                showSymbol: false,
                data: [],
                smooth: true
            });
            series.push({
                type: 'bar',
                xAxisIndex: index,
                yAxisIndex: 3*index + 1,
                data: [],
                itemStyle: {
                    color: function(params) {
                        return params.data.color;
                    }
                }
            });
            series.push({
                type: 'bar',
                xAxisIndex: index,
                yAxisIndex: 3*index + 2,
                data: [],
                itemStyle: {
                    color: function(params) {
                        return params.data.color;
                    }
                }
            });
        });

        var options = {
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    let minute = params[0].value[0] + 900;
                    minute = '9:' + Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    let scode = params[0].seriesName;
                    let preclose_px = emjyBack.daily_auctions[scode].preclose_px;
                    let sname = feng.getStockName(scode);
                    if (!sname) {
                        sname = scode;
                    }
                    var result = sname + ' ' + minute + '<br/>';
                    let change = ((params[0].value[1] - preclose_px) * 100 / preclose_px).toFixed(2) + '%';
                    var mcolor1 = params[0].color === 'transparent' ? params[0].borderColor : params[0].color;
                    var ccolor1 = params[0].value[1] - preclose_px > 0 ? 'red' : 'green';
                    let r0 = `<span style="color: ${mcolor1}">报价: </span><span style="color: ${ccolor1}">${params[0].value[1]}/(${change})</span><br/>`
                    result += params[0].marker + r0;
                    var formatAmt = function(value) {
                        if (Math.abs(value) >= 1e5) {
                            return (value / 1e6).toFixed(2) + ' 亿元';
                        } else if (Math.abs(value) >= 1e3) {
                            return (value / 1e2).toFixed(2) + ' 万元';
                        } else {
                            return value + ' 元';
                        }
                    };

                    var formatVol = function(value) {
                        if (Math.abs(value) >= 1e7) {
                            return (value / 1e8).toFixed(2) + ' 亿手';
                        } else if (Math.abs(value) >= 1e4) {
                            return (value / 1e4).toFixed(2) + ' 万手';
                        } else {
                            return value + ' 手';
                        }
                    };

                    var mcolor2 = params[0].color === 'transparent' ? params[1].borderColor : params[1].color;
                    let mv = formatAmt(params[0].value[1] * params[1].value[1]);
                    let r1 = `<span style="color: ${mcolor2}">匹配量: </span>${formatVol(params[1].value[1])} / ${mv}<br/>`;
                    result += params[1].marker + r1;

                    var mcolor3 = params[0].color === 'transparent' ? params[2].borderColor : params[2].color;
                    let umv = formatAmt(params[0].value[1] * params[2].value[1]);
                    let r2 = `<span style="color: ${mcolor3}">未匹配量: </span>${formatVol(params[2].value[1])} / ${umv}<br/>`;
                    result += params[2].marker + r2;

                    return result;
                }
            },
            grid, graphic, xAxis, yAxis, series
        }

        this.aucChart.setOption(options, true);
    }

    shouldAuctionChartShow(code) {
        if (this.auction_chart_show === 'all') {
            return true;
        }
        const dauc = emjyBack.daily_auctions[code];
        if (!dauc) {
            return false;
        }
        const last_px = dauc.quotes[dauc.quotes.length - 1][1];
        if (this.auction_chart_show === 'zt') {
            return last_px == dauc.up_price;
        }
        if (this.auction_chart_show === 'zt1') {
            let px_24 = last_px;
            for (let i = dauc.quotes.length - 1; i >= 0; i--) {
                if (dauc.quotes[i][0] >= '09:24') {
                    continue;
                }
                px_24 = dauc.quotes[i][1];
                break;
            }
            return px_24 == dauc.up_price;
        }
        if (this.auction_chart_show === 'dt') {
            return last_px == dauc.down_price;
        }
        if (this.auction_chart_show === 'both') {
            return last_px == dauc.up_price || last_px == dauc.down_price;
        }
        return false;
    }

    updateCharts() {
        let showstocks = Object.keys(emjyBack.daily_auctions).filter(c => this.shouldAuctionChartShow(c));
        if (!this.aucChart || this.stocks.length != showstocks.length || this.aucChart.getOption().grid.length != this.stocks.length) {
            if (!this.stocks || this.stocks.length != showstocks.length) {
                this.fillupStocks();
            }
            this.setupCharts();
        }

        const yAxis = [];
        const series = [];
        this.stocks.forEach((stock, index) => {
            if (!emjyBack.daily_auctions || !emjyBack.daily_auctions[stock]) {
                yAxis.push({});yAxis.push({});yAxis.push({});
                series.push({});series.push({});series.push({});
                return;
            }
            const sdata = emjyBack.daily_auctions[stock].quotes;
            const prices = [];
            let v1 = 0, v2 = 0;
            let matchedVolumes = [];
            let unmatchedVolumes = [];
            for (let i = 0; i < sdata.length; i++) {
                var hms = sdata[i][0].split(':');
                if (hms.length == 2) {
                    hms.push('0');
                }
                var tx = hms[1]*60 + parseInt(hms[2]) - 900;
                prices.push([tx, parseFloat(sdata[i][1])]);
                matchedVolumes.push({value: [tx, sdata[i][2]], color: sdata[i][3] > 0 ? 'red':'green'});
                unmatchedVolumes.push({value: [tx, Math.abs(sdata[i][3])], color: sdata[i][3] > 0 ? 'red':'green'});
                if (sdata[i][2] > v1) {
                    v1 = Math.abs(sdata[i][2]);
                }
                if (Math.abs(sdata[i][3]) > v2) {
                    v2 = Math.abs(sdata[i][3]);
                }
            }
            const vrange = v1 + v2;
            yAxis.push({
                gridIndex: index,
                min: emjyBack.daily_auctions[stock].down_price,
                max: emjyBack.daily_auctions[stock].up_price,
                interval: emjyBack.daily_auctions[stock].preclose_px - emjyBack.daily_auctions[stock].down_price,
            });
            yAxis.push({
                gridIndex: index,
                max: vrange
            });
            yAxis.push({
                gridIndex: index,
                max: vrange
            });

            series.push({
                data: prices,
            });
            series.push({
                data: matchedVolumes,
            });
            series.push({
                data: unmatchedVolumes,
            });
        });

        var options = {
            yAxis, series
        }
        this.aucChart.setOption(options);
    }
}


class DailyZtStepsPanel {
    constructor(parent) {
        this.container = document.createElement('div');
        this.container.className = 'info-area';
        const stepsdesc = document.createElement('div');
        stepsdesc.style.textAlign = 'center';
        stepsdesc.appendChild(document.createTextNode('连板梯队'));
        const btnShowHide = document.createElement('button');
        btnShowHide.textContent = '收起';
        btnShowHide.onclick = e => {
            if (this.container.style.display == 'none') {
                this.container.style.display = 'flex';
                e.target.textContent = '收起';
                this.startUpdateInterval();
            } else {
                this.container.style.display = 'none';
                e.target.textContent = '展开';
                if (this.uInterval) {
                    clearInterval(this.uInterval);
                    this.uInterval = null;
                }
            }
        }
        stepsdesc.appendChild(btnShowHide);

        const btnUpdate = document.createElement('button');
        btnUpdate.textContent = '刷新';
        btnUpdate.disabled = emjyBack.is_trading_day;
        btnUpdate.onclick = () => {
            feng.getStockBasics(this.zstep_stocks).then(() => {
                this.updateZtSteps();
            });
        }
        stepsdesc.appendChild(btnUpdate);

        parent.appendChild(stepsdesc);
        parent.appendChild(this.container);
        this.zstep_stockset = document.createElement('div');
        this.zstep_stockset.style.textAlign = 'center';
        parent.appendChild(this.zstep_stockset);
        this.ztstocks_bkrank = new StocksBkRanks(false);
        parent.appendChild(this.ztstocks_bkrank.render());
        this.zstep_stocks = [];
        this.startUpdateInterval();
    }

    startUpdateInterval() {
        if (this.uInterval) {
            return;
        }

        this.uInterval = setInterval(()=>{
            if (emjyBack.is_trading_day && this.zstep_stocks.length > 0) {
                feng.getStockBasics(this.zstep_stocks).then(() => {
                    this.updateZtSteps();
                });
            }
        }, 300000);
    }

    calc_mxwidth(w, l0, l1, l2) {
        if ([l0, l1, l2].filter(l => l == 0).length > 1) {
            return [undefined, undefined, undefined];
        }
        let cols = Math.floor(w / 75);
        let rows = Math.round((l0 + l1 + l2) / cols);
        while (true) {
            if (Math.ceil(l0/rows) + Math.ceil(l1/rows) + Math.ceil(l2/rows) <= cols) {
                break;
            }
            rows ++;
        }
        var w0 = l0 > 0 ? Math.ceil(l0 / rows) * 75: undefined;
        var w1 = l1 > 0 ? Math.ceil(l1 / rows) * 75: undefined;
        var w2 = l2 > 0 ? Math.ceil(l2 / rows) * 75: undefined;
        return [w0, w1, w2];
    }

    createZ0Div(t, wid, up0, brk0, zf0) {
        const zt0div = document.createElement('div');
        zt0div.style.textAlign = 'center';
        zt0div.appendChild(document.createTextNode(t));
        const zt0con = document.createElement('div');
        zt0con.className = 'info-area';
        zt0div.appendChild(zt0con);

        var createzdf0 = function(brk0, text, radius, border, mxwid) {
            const fail0div = document.createElement('div');
            if (mxwid) {
                fail0div.style.maxWidth = mxwid+'px';
            }
            const faildesc = document.createElement('div');
            faildesc.style.textAlign = 'center';
            faildesc.appendChild(document.createTextNode(text));
            fail0div.appendChild(faildesc);
            const zt0fail = document.createElement('div');
            zt0fail.className = 'info-area';
            zt0fail.style.borderRadius = radius;
            zt0fail.style.border = border;
            brk0.forEach(s => {
                const s0 = new SecuCard(s);
                zt0fail.appendChild(s0.element);
            });
            fail0div.appendChild(zt0fail);
            return fail0div;
        }

        const widarr = this.calc_mxwidth(wid, up0.length, brk0.length, zf0.length);
        const zt0suc = createzdf0(up0, '涨停', '3px', '1px solid red', widarr[0]);
        zt0con.appendChild(zt0suc);
        if (brk0.length > 0) {
            const fail0div = createzdf0(brk0, '炸板', '5px', '1px dashed red', widarr[1]);
            zt0con.appendChild(fail0div);
        }
        if (zf0.length > 0) {
            const f0div = createzdf0(zf0, '大涨', '5px', '1px dashed lightsteelblue', widarr[2]);
            zt0con.appendChild(f0div);
        }
        return zt0div;
    }

    showZ0Steps(zt0div, wid, up0, brk0, zf0) {
        feng.getStockBasics([...up0, ...brk0, ...zf0]).then(() => {
            const u0 = up0.filter(c => c.startsWith('sh60') || c.startsWith('sz00'));
            const u0_kc = up0.filter(c => !u0.includes(c));
            const b0 = brk0.filter(c => c.startsWith('sh60') || c.startsWith('sz00'));
            const b0_kc = brk0.filter(c => !b0.includes(c));
            const f0 = zf0.filter(c => c.startsWith('sh60') || c.startsWith('sz00'));
            const f0_kc = zf0.filter(c => !f0.includes(c));
            zt0div.appendChild(this.createZ0Div('主板', wid, u0, b0, f0));
            zt0div.appendChild(this.createZ0Div('创业板', wid, u0_kc, b0_kc, f0_kc));            
        });
    }

    updateZtSteps() {
        if (!emjyBack.recent_zt_map) {
            return;
        }
        this.container.style.height = this.container.clientHeight + 'px';
        this.container.innerHTML = '';
        let zt_brk = emjyBack.getZtOrBrkStocks();
        this.zstep_stocks = Object.values(zt_brk).flat();
        feng.getStockBasics(this.zstep_stocks);
        let z_up_stocks = zt_brk.up_stocks;
        let z_up_brk = zt_brk.up_brk;
        let z_up0 = zt_brk.up0;
        let z_up0_brk = zt_brk.brk0;
        let z_zf0 = zt_brk.zf0;

        const zt0div = document.createElement('div');
        const in1row = emjyBack.recent_zt_map[1].length < 150;
        var width01 = this.container.parentElement.clientWidth;
        if (in1row) {
            width01 = Math.round((this.container.parentElement.clientWidth - 82 * Object.keys(emjyBack.recent_zt_map).length)/2);
            zt0div.style.maxWidth = width01 + 'px';
        }
        this.container.appendChild(zt0div);
        this.showZ0Steps(zt0div, width01, z_up0, z_up0_brk, z_zf0);

        var col0 = zt0div;
        const kstep_name = ['', '一进二', '二进三', '三进四', '四进五', '五进六', '六进七', '七进八', '八进九', '九进十', '高标'];
        let kstep_width = [0, width01 + 'px', '163px', '82px'];
        if (!in1row) {
            let width123 = this.container.parentElement.clientWidth - 82 * (Object.keys(emjyBack.recent_zt_map).length - 3);
            let l1 = emjyBack.recent_zt_map[1]?emjyBack.recent_zt_map[1].length:0;
            let l2 = emjyBack.recent_zt_map[2]?emjyBack.recent_zt_map[2].length:0;
            let l3 = emjyBack.recent_zt_map[3]?emjyBack.recent_zt_map[3].length:0;
            const warr = this.calc_mxwidth(width123, l1, l2, l3);
            for (var i = 0; i < warr.length; i++) {
                kstep_width[i+1] = (warr[i] > 82 ? warr[i] : 82) + 'px';
            }
        }
        for (var k in emjyBack.recent_zt_map) {
            const stepdiv = document.createElement('div');
            stepdiv.style.maxWidth = k < kstep_width.length ? kstep_width[k] : '82px';

            let z_up_i = [];
            let z_brk_i = [];
            const zstocks = emjyBack.recent_zt_map[k];
            for (const zs of zstocks) {
                if (z_up_stocks.includes(zs[0])) {
                    z_up_i.push(zs[0]);
                } else if (z_up_brk.includes(zs[0])) {
                    z_brk_i.push(zs[0]);
                }
            }
            const zsdesc = document.createElement('div');
            zsdesc.appendChild(document.createTextNode(k < kstep_name.length ? kstep_name[k] : kstep_name[kstep_name.length - 1]));
            zsdesc.style.textAlign = 'center';
            stepdiv.appendChild(zsdesc);
            const zsuc = document.createElement('div');
            zsuc.className = 'info-area';
            if (z_up_i.length > 0) {
                zsuc.style.borderRadius = '3px';
                zsuc.style.border = '1px solid red';
            }
            z_up_i.forEach(s => {
                const s_up = new SecuCard(s);
                zsuc.appendChild(s_up.element);
            });
            stepdiv.appendChild(zsuc);
            if (z_brk_i.length > 0) {
                const zbdesc = document.createElement('div');
                zbdesc.appendChild(document.createTextNode('炸板'));
                zbdesc.style.textAlign = 'center';
                const zbrk = document.createElement('div');
                zbrk.className = 'info-area';
                zbrk.style.borderRadius = '3px';
                zbrk.style.border = '1px dashed red';
                z_brk_i.forEach(s => {
                    const s_brk = new SecuCard(s);
                    zbrk.appendChild(s_brk.element);
                });
                stepdiv.appendChild(zbdesc);
                stepdiv.appendChild(zbrk);
            }

            if (zstocks.length > z_up_i.length + z_brk_i.length) {
                const zfdesc = document.createElement("div");
                zfdesc.appendChild(document.createTextNode('等待晋级'));
                zfdesc.style.textAlign = 'center';
                zfdesc.style.fontSize = '0.8em';
                zfdesc.style.color = '#777';
                const zfail = document.createElement('div');
                zfail.className = 'info-area';
                zfail.style.borderRadius = '5px';
                zfail.style.border = '1px dashed lightsteelblue';
                var tjjstocks = [];
                for (const zs of zstocks) {
                    if (!this.zstep_stocks.includes(zs[0])) {
                        this.zstep_stocks.push(zs[0]);
                    }
                    if (z_up_i.includes(zs[0]) || z_brk_i.includes(zs[0])) {
                        continue;
                    }
                    tjjstocks.push(zs[0]);
                }
                tjjstocks = emjyBack.sortStockByChange(tjjstocks);
                tjjstocks.forEach(c => {
                    const s = new SecuCard(c);
                    zfail.appendChild(s.element);
                });
                stepdiv.appendChild(zfdesc);
                stepdiv.appendChild(zfail);
            }
            this.container.insertBefore(stepdiv, col0);
            col0 = stepdiv;
        }
        this.container.style.height = '';
        if (this.ztstocks_bkrank) {
            var optvns = {
                'allzt': '所有涨停('+(z_up_stocks.length+z_up0.length)+')',
                'up0': '首板涨停('+z_up0.length+')',
                'zf': '大涨('+emjyBack.daily_ranks_all.length+')'
            };
            if (emjyBack.daily_ranks_all.length > 250) {
                optvns['zf200'] = '涨幅前200';
            }
            if (emjyBack.daily_ranks_all.length > 120) {
                optvns['zf100'] = '涨幅前100';
            }
            if (emjyBack.daily_ranks_all.length > 60) {
                optvns['zf50'] = '涨幅前50';
            }
            this.updateZstepStockSet(optvns);
            this.updateBkRankStocks();
        }
    }

    updateZstepStockSet(vns) {
        var optval = this.zstep_stockset.querySelector('input[name="zstepradio"]:checked')?.value
        if (!optval || !vns[optval]) {
            optval = emjyBack.daily_ranks_all.length > 0? 'zf':'up0';
        }
        this.zstep_stockset.innerHTML = '';
        for (const k in vns) {
            this.zstep_stockset.innerHTML += 
            `<input type="radio" value="${k}" name="zstepradio" id="zstep_${k}" ${k==optval?'checked="true"':''}><label for="zstep_${k}">${vns[k]}</label>`;
        }
        this.zstep_stockset.querySelectorAll('input[name="zstepradio"]').forEach(ele=> {
            ele.onchange = e => {
                if (e.target.checked) {
                    this.updateBkRankStocks();
                }
            }
        });
    }

    async updateBkRankStocks() {
        var optval = this.zstep_stockset.querySelector('input[name="zstepradio"]:checked')?.value
        var stocks = [];
        if (optval == 'allzt') {
            const stock_basics = await feng.getStockBasics(this.zstep_stocks);
            stocks = this.zstep_stocks.filter(c => stock_basics[c] && stock_basics[c].last_px == stock_basics[c].up_price);
        } else if (optval == 'up0') {
            let zt_brk = emjyBack.getZtOrBrkStocks();
            let z_up0 = zt_brk.up0;
            stocks = z_up0;
        } else if (optval.startsWith('zf')) {
            stocks = emjyBack.daily_ranks_all ? emjyBack.sortStockByChange(emjyBack.daily_ranks_all): [];
            if (optval !== 'zf') {
                var l = parseInt(optval.substring(2));
                stocks = stocks.slice(0, l);
            }
        }
        this.ztstocks_bkrank.updateStocks(stocks);
    }
}


class PlateListTable {
    constructor(container, rowcb) {
        this.container = container;
        this.rowClickCallback = rowcb;
        this.autoMatchedPlatesCb = null;
        this.currentSortColumn = null;
        this.currentSortOrder = 'desc';
        this.showWideTable = true;
        this.initializeTable();
    }

    changeCssPanel(mxWid) {
        for (const cs of document.styleSheets) {
            for (const stl of cs.cssRules) {
                if (stl.selectorText != '.panel') {
                    continue;
                }
                stl.style.maxWidth = mxWid;
                break;
            }
        }
    }

    initializeTable() {
        if (!this.nwbtn) {
            const hdiv = document.createElement('div');
            hdiv.style.display = 'flex';
            hdiv.style.flexDirection = 'row-reverse';
            this.container.appendChild(hdiv);

            this.nwbtn = document.createElement('button');
            this.nwbtn.textContent = '←';
            this.nwbtn.onclick = () => {
                if (this.nwbtn.textContent == '←') {
                    this.showWideTable = false;
                } else {
                    this.showWideTable = true;
                }

                this.nwbtn.textContent = this.showWideTable ? '←' : '→';
                this.container.style.maxWidth = this.showWideTable ? '' : '130px';
                this.initializeTable();
                this.updateTableContent(this.plates);
                this.changeCssPanel(this.showWideTable ? '400px': '640px');
            };
            hdiv.appendChild(this.nwbtn);

            const pickdiv = document.createElement('div');
            // pickdiv.style.display = 'flex';
            pickdiv.textContent = '筛选: 涨幅>';
            this.iptzf = document.createElement('input');
            this.iptzf.style.maxWidth = '12px';
            this.iptzf.value = '8';
            pickdiv.appendChild(this.iptzf);
            pickdiv.appendChild(document.createTextNode('涨停数>'));
            this.iptztcnt = document.createElement('input');
            this.iptztcnt.style.maxWidth = '12px';
            this.iptztcnt.value = '10';
            pickdiv.appendChild(this.iptztcnt);
            hdiv.appendChild(pickdiv);

            this.container.appendChild(hdiv);
            this.tablediv = document.createElement('div');
            this.container.appendChild(this.tablediv);
        }

        let tableHtml = `
            <table id="data-table">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th class="sortable" data-column="change">涨跌%</th>`;
        if (this.showWideTable) {
            tableHtml += `
                        <th class="sortable" data-column="main_fund_diff">净流入</th>
                        <th class="sortable" data-column="limit_up_num">涨停</th>
                        <th class="sortable" data-column="limit_up">上涨</th>
                        <th class="sortable" data-column="limit_down">下跌</th>
                        <th class="sortable" data-column="limit_down_num">跌停</th>`;
        }
        tableHtml += `
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        `;
        this.tablediv.innerHTML = tableHtml;

        // 表头排序功能
        this.container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-column');
                let order = 'desc';
                if (this.currentSortColumn === column) {
                    order = this.currentSortOrder === 'desc' ? 'asc' : 'desc';
                }
                this.sortTable(column, order);
            });
        });
    }

    addTableContent(data) {
        const tableBody = this.container.querySelector('#data-table tbody');
        tableBody.innerHTML = ''; // 清空表格内容

        data.forEach(plt => {
            let item = emjyBack.plate_basics[plt];
            const formattedFund = emjyBack.formatMoney(item.main_fund_diff);
            const formattedChange = this.formatChange(item.change);
            let changeColor = item.change == 0 ? '' : (item.change > 0 ? 'red' : 'green');
            let fundColor = item.main_fund_diff > 0 ? 'red' : 'green';
            let row = `<tr>
                <td class="name" data-code="${item.secu_code}">${item.secu_name}</td>
                <td class="${changeColor} center">${formattedChange}</td>`;
            if (this.showWideTable) {
                row += `
                <td class="${fundColor} center">${formattedFund}</td>
                <td class="red center">${item.limit_up_num}</td>
                <td class="red center">${item.limit_up}</td>
                <td class="green center">${item.limit_down}</td>
                <td class="green center">${item.limit_down_num}</td>`;
            }
            row += `</tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        // 点击名称时在新标签页打开详情页
        this.container.querySelectorAll('.name').forEach(nameCell => {
            nameCell.addEventListener('click', () => {
                const code = nameCell.getAttribute('data-code');
                window.open(`https://www.cls.cn/plate?code=${code}`, '_blank');
            });
        });

        // 行点击事件
        this.container.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                if (this.rowClickCallback) {
                    var secu_code = row.firstElementChild.getAttribute('data-code');
                    this.rowClickCallback(secu_code, this.plates.find(x=>x.secu_code==secu_code));
                }
            });
        });
    }

    formatChange(value) {
        return (value * 100).toFixed(2);
    }

    sortTable(column, order) {
        if (typeof(column) == 'string') {
            column = [column];
        }

        this.currentSortColumn = column[0];
        this.currentSortOrder = order;

        this.plates.sort((ca, cb) => {
            let a = emjyBack.plate_basics[ca];
            let b = emjyBack.plate_basics[cb];
            let valA = a[column[0]];
            let valB = b[column[0]];
            let equal = valA - valB == 0;
            let desc = valB - valA > 0;
            for (let i = 1; equal && i < column.length; i++) {
                if (a[column[i]] - b[column[i]] != 0) {
                    equal = false;
                    desc = b[column[i]] - a[column[i]];
                    break;
                }
            }
            return (order == 'desc') == desc;
        });

        this.addTableContent(this.plates);
    }

    updateTableContent(newData) {
        this.plates = newData;
        if (this.currentSortColumn) {
            this.sortTable(this.currentSortColumn, this.currentSortOrder);
        } else {
            this.sortTable(['limit_up_num', 'change', 'main_fund_diff'], 'desc');
        }
        if (this.autoMatchedPlatesCb) {
            const pmatch = [];
            for (const plt of this.plates) {
                if (emjyBack.plate_basics[plt].change >= this.iptzf.value / 100 && 
                    emjyBack.plate_basics[plt].limit_up_num - this.iptztcnt.value >= 0) {
                    pmatch.push(plt);
                }
            }
            this.autoMatchedPlatesCb(pmatch);
        }
    }
}


class StockCollection {
    constructor(cfg) {
        this.cards = [];
        this.stocks = [];
        this.cfg = cfg;
        this.element = document.createElement('div');
        this.element.classList.add('info-area');
        this.element.innerHTML =
        `<div style="font-weight: bold;margin: 3px;color: ${this.cfg.color};">${this.cfg.text?this.cfg.text:this.cfg.name}</div>`;
    }

    addStocks(secu) {
        if (typeof(secu) == 'string') {
            secu = [secu];
        }
        feng.getStockBasics(secu).then(() => {
            secu.forEach(s => {
                if (this.stocks.includes(s)) {
                    return;
                }
                this.stocks.push(s);
                const card = new SecuCard(s);
                this.cards.push(card);
                this.element.appendChild(card.render());
            });
        });
    }

    removeStocks(secu) {
        if (typeof(secu) == 'string') {
            secu = [secu];
        }
        this.stocks = this.stocks.filter(s=> !secu.includes(s));
        this.cards = this.cards.filter(c=> !secu.includes(c.plate));
        this.element.innerHTML =
        `<div style="font-weight: bold;margin: 3px;color: ${this.cfg.color};">${this.cfg.text?this.cfg.text:this.cfg.name}</div>`;
        this.stocks.forEach(s=> {
            const card = this.cards.find(c=>c.plate == s);
            this.element.appendChild(card.render());
        });
    }

    render() {
        this.element.style.display = this.stocks.length == 0 ? 'none' : '';
        this.element.style.minWidth = this.stocks.length == 0 ? '' : '88px';
        return this.element;
    }
}


class StocksBkRanks {
    constructor(stocks_first=true) {
        this.container = document.createElement('div');
        this.container.innerHTML = `
            <div id='bk_ranks_div' style='display: flex; flex-wrap: wrap' ></div>
            <div id='stats_bk_recentzts_div' style='margin: 0 15px;border-left: dashed grey 2px;'></div>
        `;
        this.show_stocks_in_first = stocks_first;
    }

    updateStocks(stocks) {
        let platecnt = {};
        this.stocks = stocks;
        let nbks = stocks.filter(s => !emjyBack.stock_bks || !emjyBack.stock_bks[s]);
        if (nbks.length > 0) {
            let strstocks = nbks.map(s=> emjyBack.secuConvert(s)).join(',');
            let bUrl = emjyBack.fha.svr5000 + 'stock?act=stockbks&stocks=' + strstocks;
            fetch(bUrl).then(r=>r.json()).then(sbks => {
                for (const s in sbks) {
                    emjyBack.stock_bks[guang.convertToSecu(s)] = sbks[s].map(sn=>sn[0]);
                    for (const sn of sbks[s]) {
                        if (!emjyBack.plate_basics[sn[0]]) {
                            emjyBack.plate_basics[sn[0]] = {secu_code: sn[0], secu_name: sn[1]}
                        }
                    }
                }
                this.updateStocks(this.stocks);
            });
            return;
        }
        stocks.forEach(s => {
            if (!emjyBack.stock_bks[s]) {
                return;
            }
            emjyBack.stock_bks[s].forEach(p => {
                if (!platecnt[p]) {
                    platecnt[p] = 1;
                } else {
                    platecnt[p]++;
                }
            })
        });
        let plates = Object.keys(platecnt);
        for (let i = 1; i < 5; i++) {
            if (plates.length <= 15) {
                break;
            }
            plates = plates.filter(p=>platecnt[p] > i);
        }
        plates.sort((a, b) => platecnt[b] - platecnt[a]);
        let pstats = this.container.querySelector('#bk_ranks_div');
        pstats.innerHTML = '';
        plates.forEach(p=>{
            const pdv = document.createElement('div');
            pdv.style.textAlign = 'center';
            pdv.style.border = '1px solid gray';
            pdv.title = p;
            const pn = document.createElement('div');
            pn.textContent = emjyBack.plate_basics[p] ? emjyBack.plate_basics[p].secu_name : p;
            pdv.appendChild(pn);
            const pc = document.createElement('div');
            const lblCnt = document.createElement('label');
            lblCnt.textContent = platecnt[p];
            lblCnt.style.textDecoration = 'underline';
            lblCnt.style.color = 'blue';
            lblCnt.style.margin = '0 5px';
            lblCnt.onclick = e => {
                var et = e.target.closest('[title]');
                this.showRecentBkZts(et.title);
            }
            pc.appendChild(lblCnt);
            if (emjyBack.home && emjyBack.home.platesManagePanel.checkExists(p)) {
                pdv.style.background = 'rgb(143, 181, 245)';
            } else {
                const btnAdd = document.createElement('button');
                btnAdd.textContent = '+';
                btnAdd.onclick = e => {
                    if (!emjyBack.home) {
                        return;
                    }
                    var et = e.target.closest('[title]');
                    if (et.title.startsWith('BK')) {
                        return;
                    }
                    emjyBack.home.platesManagePanel.addNonExistsCards([et.title]);
                    if (emjyBack.home.platesManagePanel.checkExists(et.title)) {
                        et.style.background = 'rgb(143, 181, 245)';
                        e.target.style.display = 'none';
                    }
                }
                pc.appendChild(btnAdd);
            }
            pdv.appendChild(pc);
            pstats.appendChild(pdv);
        });
    }

    async createZtNztCollectionRow(stocks, text='') {
        const c1 = document.createElement('td');
        const stock_basics = await feng.getStockBasics(stocks);
        let zstocks = stocks.filter(c => stock_basics[c] && stock_basics[c].last_px == stock_basics[c].up_price);
        if (zstocks.length > 0) {
            const zcol = new StockCollection({text: `${text}(${zstocks.length})`});
            zcol.addStocks(emjyBack.sortStockByChange(zstocks));
            c1.appendChild(zcol.render());
        } else {
            c1.appendChild(document.createTextNode(text));
        }
        const c2 = document.createElement('td');
        let nstocks = stocks.filter(c => !zstocks.includes(c));
        if (nstocks.length > 0) {
            const ncol = new StockCollection({text: nstocks.length});
            ncol.addStocks(emjyBack.sortStockByChange(nstocks));
            c2.appendChild(ncol.render());
        }
        const r = document.createElement('tr');
        r.appendChild(c1);
        r.appendChild(c2);
        return r;
    }

    showRecentBkZts(plate) {
        const bkcon = this.container.querySelector('#stats_bk_recentzts_div');
        bkcon.innerHTML = '';
        if (!emjyBack.plate_stocks || !emjyBack.plate_stocks[plate] || emjyBack.plate_stocks[plate].length == 0) {
            emjyBack.getBkStocks(plate, bks => {
                bks.forEach(bk => this.showRecentBkZts(bk));
            });
            return;
        }

        const yztit = document.createElement('div');
        yztit.style.textAlign = 'center';
        yztit.appendChild(document.createTextNode(emjyBack.plate_basics[plate]?emjyBack.plate_basics[plate].secu_name:plate));
        const clsBtn = document.createElement('button');
        clsBtn.textContent = 'X';
        clsBtn.onclick = () => {
            this.container.querySelector('#stats_bk_recentzts_div').innerHTML = '';
        }
        yztit.appendChild(clsBtn);
        bkcon.appendChild(yztit);
        if (this.show_stocks_in_first) {
            let yzstks = this.stocks.filter(c=>emjyBack.plate_stocks[plate].includes(c));
            const yzcol = new StockCollection({text: '一字板' + yzstks.length, color: 'gray'});
            yzcol.addStocks(yzstks);
            bkcon.appendChild(yzcol.render());
        }

        const stbl = document.createElement('table');
        bkcon.appendChild(stbl);
        let bjstks = emjyBack.plate_stocks[plate].filter(c => c.endsWith('.BJ'));
        if (bjstks.length > 0) {
            stbl.appendChild(this.createZtNztCollectionRow(bjstks, '北交所'));
        }

        var stocks_all = this.stocks.filter(c => emjyBack.plate_stocks[plate].includes(c));
        if (emjyBack.daily_ranks_all.length > 0) {
            stocks_all = emjyBack.plate_stocks[plate].filter(c => emjyBack.daily_ranks_all.includes(c) && !c.endsWith('.BJ'));
        }
        var shown = [];
        if (this.show_stocks_in_first) {
            stocks_all = stocks_all.filter(c => !this.stocks.includes(c));
            shown = this.stocks;
        }
        let rstocks = {};
        for (let i in emjyBack.recent_zt_map) {
            let rzt = emjyBack.recent_zt_map[i].filter(c=>emjyBack.plate_stocks[plate].includes(c[0]) && !shown.includes(c[0])).map(c=>c[0]);
            if (rzt.length > 0) {
                rstocks[i] = rzt;
                stocks_all = stocks_all.filter(c=>!rzt.includes(c));
            }
        }
        let z = Object.keys(rstocks).sort((a,b)=> b - a);
        for (let i of z) {
            stbl.appendChild(this.createZtNztCollectionRow(rstocks[i], i));
        }

        if (stocks_all.length > 0) {
            stbl.appendChild(this.createZtNztCollectionRow(stocks_all, '今日涨停'));
        }
    }

    render() {
        return this.container;
    }
}


class StockMarketStatsPanel {
    constructor(parent) {
        this.container = document.createElement('div');
        this.container.style.maxWidth = '70%';
        parent.appendChild(this.container);
        emjyBack.addStatsListener(this);
    }

    onStatsReceived() {
        if (!this.stime) {
            this.container.innerHTML = `
            <div class='info-area'>
                <div style='width: 70%'>
                    <div class='info-area' style='margin-left: 66px' id='stime_box'></div>
                    <div id='stats_stocks_div'></div>
                </div>
                <div style='width: 30%; text-align: center'>
                    热门板块
                    <div class='info-area' id='stats_plates_div'></div>
                </div>
            </div>
            `;
            this.stime = document.createElement('div');
            this.stime.statsid = emjyBack.all_stats.length - 1;
            const tdiv = this.container.querySelector('#stime_box');
            const larrow = document.createElement('button');
            larrow.textContent = '<';
            larrow.onclick = () => {
                if (this.stime.statsid > 0) {
                    this.showStats(this.stime.statsid - 1);
                }
            };
            const rarrow = document.createElement('button');
            rarrow.textContent = '>';
            rarrow.onclick = () => {
                if (this.stime.statsid < emjyBack.all_stats.length - 1) {
                    this.showStats(this.stime.statsid + 1);
                }
            }
            tdiv.appendChild(larrow);
            tdiv.appendChild(this.stime);
            tdiv.appendChild(rarrow);
            tdiv.appendChild(document.createTextNode('热门个股-涨停/跌停/大涨/大跌'));

            this.stocksdiv = this.container.querySelector('#stats_stocks_div');
            this.platesdiv = this.container.querySelector('#stats_plates_div');
        }

        this.showStats(emjyBack.all_stats.length - 1);
        this.updatePlatesStats();
    }

    showStats(i) {
        const stats = emjyBack.all_stats[i];
        if (!stats) return;
        this.stime.statsid = i;
        this.stime.textContent = stats.time;

        this.stocksdiv.innerHTML = '';
        const descs = {'zt_yzb': '一字板', 'zt': '涨停', 'up': '大涨', 'down': '大跌', 'dt': '跌停'}
        for (const k of Object.keys(descs)) {
            const zstocks = stats.stocks[k].map(s=>s.secu_code);
            const zcoll = new StockCollection({text: `${descs[k]}(${zstocks.length})`});
            zcoll.addStocks(zstocks);
            this.stocksdiv.appendChild(zcoll.render());
            if (k == 'zt_yzb') {
                if (!this.yzbBkRanks) {
                    this.yzbBkRanks = new StocksBkRanks(true);
                }
                this.yzbBkRanks.updateStocks(zstocks);
                this.stocksdiv.appendChild(this.yzbBkRanks.render());
            }
        }
    }

    updatePlatesStats() {
        var createPlate = function(p) {
            const pcard = new StatsPlateCard(p);
            return pcard.element;
        }
        this.platesdiv.innerHTML = '';
        if (this.stime.statsid) {
            const stats = emjyBack.all_stats[this.stime.statsid];
            for (const p of stats.plates) {
                if (p.zt_stocks.length < 3) {
                    continue;
                }
                this.platesdiv.appendChild(createPlate(p));
            }
        }
    }
}


class EmotionBlock {
    constructor(chart_container, info_block) {
        this.chart_container = chart_container;
        this.info_block = info_block;
    }

    updateEmotionContent(emoinfo) {
        if (!this.emotionChart) {
            this.emotionChart = echarts.init(this.chart_container);
        }

        var data = emoinfo.up_down_dis;
        var categories = ['涨停', '+10%', '+8%', '+6%', '+4%', '+2%', '平盘', '-2%', '-4%', '-6%', '-8%', '-10%', '跌停'];
        var values = [data.up_num, data.up_10, data.up_8, data.up_6, data.up_4, data.up_2, data.flat_num, data.down_2, data.down_4, data.down_6, data.down_8, data.down_10, data.down_num];

        // 定义颜色映射函数
        function getColor(value, min, max, baseColor) {
            var intensity = (max - value) / (max - min);
            if (baseColor === 'red') {
                return `rgb(${160 + intensity * 95}, 0, 0)`;
            } else if (baseColor === 'green') {
                return `rgb(0, ${160 + intensity * 95}, 0)`;
            } else {
                return '#cccccc';
            }
        }
    
        var maxUp = Math.max(data.up_num, data.up_10, data.up_8, data.up_6, data.up_4, data.up_2);
        var maxDown = Math.max(data.down_num, data.down_10, data.down_8, data.down_6, data.down_4, data.down_2);
        var maxValue = Math.max(maxUp, maxDown);
        var minValue = 0;
    
        var colors = [
            getColor(data.up_num, minValue, maxUp, 'red'),
            getColor(data.up_10, minValue, maxUp, 'red'),
            getColor(data.up_8, minValue, maxUp, 'red'),
            getColor(data.up_6, minValue, maxUp, 'red'),
            getColor(data.up_4, minValue, maxUp, 'red'),
            getColor(data.up_2, minValue, maxUp, 'red'),
            '#cccccc', // 平盘
            getColor(data.down_2, minValue, maxDown, 'green'),
            getColor(data.down_4, minValue, maxDown, 'green'),
            getColor(data.down_6, minValue, maxDown, 'green'),
            getColor(data.down_8, minValue, maxDown, 'green'),
            getColor(data.down_10, minValue, maxDown, 'green'),
            getColor(data.down_num, minValue, maxDown, 'green')
        ];
        var btmFontSize = 15;

        var option = {
            tooltip: {
                show: false
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
            },
            series: [{
                type: 'bar',
                data: values,
                itemStyle: {
                    color: function(params) {
                        return colors[params.dataIndex];
                    }
                },
                label: {
                    show: true,
                    position: 'top'
                }
            }],
            graphic: [
                {
                    type: 'text',
                    left: '10%',
                    bottom: 20,
                    style: {
                        text: `涨: ${data.rise_num} `,
                        fill: '#de0422',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '30%',
                    bottom: 20,
                    style: {
                        text: `平: ${data.flat_num} `,
                        fill: '#666',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '50%',
                    bottom: 20,
                    style: {
                        text: `停牌: ${data.suspend_num} `,
                        fill: '#666',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    left: '70%',
                    bottom: 20,
                    style: {
                        text: `跌: ${data.fall_num} `,
                        fill: '#52c2a3',
                        backgroundColor: '#f4f5fa',
                        fontSize: btmFontSize,
                        fontWeight: 'bold'
                    }
                }
            ]
        };

        this.emotionChart.setOption(option);

        var bcolor = '#52c253';
        if (emoinfo.shsz_balance_change_px && emoinfo.shsz_balance_change_px.includes('+')) {
            bcolor = '#de0422';
        }
        this.info_block.innerHTML = `<br>
        <div>总成交</div><div style='color: ${bcolor}; font-size: 18px'>${emoinfo.shsz_balance}</div>
        <div>较上日</div><div style='color: ${bcolor}; font-size: 18px'>${emoinfo.shsz_balance_change_px}</div>
        <br>
        <div>涨停数</div><div style='color: #de0422; font-size: 18px'>${emoinfo.up_ratio_num}</div>
        <div>开板数</div><div style='color: #de0422; font-size: 18px'>${emoinfo.up_open_num}</div>
        <div>封板率</div><div style='color: #de0422; font-size: 18px'>${emoinfo.up_ratio}</div>
        `;
        if (emjyBack.shMainFundFlow && emjyBack.shMainFundFlow.length > 0) {
            var mf = emjyBack.shMainFundFlow[emjyBack.shMainFundFlow.length - 1];
            bcolor = mf[1] > 0 ? '#de0422' : '#52c253';
            this.info_block.innerHTML += `<br><div>净流入</div><div style='color: ${bcolor}; font-size: 18px'>${emjyBack.formatMoney(mf[1])}</div>`;
        }
    }
}


class MainFundFlow {
    constructor(fcontainer) {
        this.flow_container = fcontainer;
    }

    initOptions(flow) {
        var option = {
            title: {text:this.title, left: 'center'},
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    var x = params[0].value[0];
                    let minute = x > 120 ? x + 660 : x + 570;
                    minute = Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    var result = minute + '<br/>';
                    params.forEach(function (item) {
                        var mcolor = item.color === 'transparent' ? item.borderColor : item.color;
                        var rg = item.value[1] > 0 ? 'red' : 'green';
                        var seriesName = item.seriesName;
                        result += item.marker;
                        if (seriesName=='主力资金') {
                            result += `<span style="color:${mcolor}">主力净流入</span>: ${emjyBack.formatMoney(item.value[1])}<br/>`;
                        } else if (seriesName == '上证指数') {
                            result += `<span style="color:${mcolor}">上证指数:
                                ${emjyBack.stock_tlines['sh000001'][item.value[0]].last_px.toFixed(2)}</span>
                                <span style="color: ${rg}">${(item.value[1]*100).toFixed(2)}%</span><br/>`;
                        } else if (seriesName == '资金速度') {
                            result += `<span style="color:${mcolor}">分时净流入</span>: ${emjyBack.formatMoney(item.value[1])}<br/>`;
                        }
                    });
                    return result;
                }
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: 240,
                interval: 30,
                axisLabel: {
                    formatter: function (value) {
                        if (value % 30 != 0) {
                            return '';
                        }
                        if (value == 120) return '11:30/13:00';
                        var minute = value > 120 ? value + 660 : value + 570;
                        return Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    }
                }
            },
            yAxis: [
                {
                    type: 'value',
                    splitLine: { show: false },
                    axisLine: { show: true },
                    axisTick: { show: false },
                    axisLabel: {
                        formatter: function(value) {
                            return value/1e8;
                        }
                    }
                },
                {
                    type: 'value',
                    splitLine: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                },
                {
                    type: 'value',
                    splitLine: { show: true },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                }
            ],
        }
        option.series = this.getSeries(flow);
        option = this.setYRange(option, option.series);
        this.flowChart.setOption(option);
    }

    getSeries(flow) {
        if (!flow || flow.length === 0) {
            return [];
        }

        var mfflow = flow.map(f=>{
            return {value: f};
        });

        let series = [];
        series.push({
            name: '主力资金',
            color: 'blue',
            type: 'line',
            data: mfflow,
            lineStyle: {width: 1},
            yAxisIndex: 0,
            showSymbol: false
        });
        let delta = [{value: flow[0]}];
        for (var i = 1; i < flow.length; i++) {
            delta.push({value: [flow[i][0], flow[i][1] - flow[i-1][1]]});
        }
        series.push({
            name: '资金速度',
            itemStyle: {
                color: function(param) {
                    return param.data.value[1] > 0 ? 'red' : 'green';
                }
            },
            type: 'bar',
            data: delta,
            yAxisIndex: 1,
            showSymbol: false
        });
        if (emjyBack.stock_tlines && emjyBack.stock_tlines['sh000001'] && emjyBack.stock_tlines['sh000001'].length > 0) {
            series.push({
                name: '上证指数',
                color: 'gray',
                type: 'line',
                data: emjyBack.stock_tlines['sh000001'].map(item =>{
                    return {value: [item.x, item.change]};
                }),
                lineStyle: {width: 1},
                yAxisIndex: 2,
                showSymbol: false
            });
        }
        return series;
    }

    setYRange(option, series) {
        if (!series || series.length < 2) {
            return option;
        }
        let mx1 = 1.05 * Math.max(...series[1].data.map(x=>Math.abs(x.value[1])));
        option.yAxis[1].max = mx1;
        option.yAxis[1].min = -mx1;
        if (series.length > 2) {
            let mx2 = 1.05 * Math.max(...series[2].data.map(x=>Math.abs(x.value[1])));
            option.yAxis[2].max = mx2;
            option.yAxis[2].min = -mx2;
        }
        return option;
    }

    updateFundFlow(flow) {
        if (!this.flowChart) {
            this.flowChart = echarts.init(this.flow_container);
            this.initOptions(flow);
            return;
        }

        var opt = this.flowChart.getOption();
        if (opt.series[0].data.length > flow.length) {
            this.clearChart();
            this.updateFundFlow(flow);
            return;
        }
        var series = this.getSeries(flow);
        var option = this.setYRange({yAxis:[{},{},{}], series}, series);
        this.flowChart.setOption(option);
    }

    clearChart() {
        delete this.flowChart;
        function removeAllChild(ele) {
            while(ele.hasChildNodes()) {
                ele.removeChild(ele.lastChild);
            }
        }

        removeAllChild(this.flow_container);
        this.flow_container.removeAttribute('_echarts_instance_');
    }
}


class StockTimeLine {
    constructor(parent, title='') {
        this.container = document.createElement('div');
        this.container.style.height = '560px';
        this.container.style.width = '750px';
        parent.appendChild(this.container);
        this.title = title;
        this.tchart = echarts.init(this.container);
        this.initOptions();
        this.line_stocks = {};
    }

    initOptions() {
        var option = {
            title: {text:this.title, left: 'center'},
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    var x = params[0].value[0];
                    let minute = x > 120 ? x + 660 : x + 570;
                    minute = Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    var result = minute + '<br/>';
                    params.forEach(function (item) {
                        var mcolor = item.color === 'transparent' ? item.borderColor : item.color;
                        var rg = item.value[1] > 0 ? 'red' : 'green';
                        var seriesName = item.seriesName;
                        result += item.marker;
                        if (seriesName.endsWith('evt')) {
                            const evt_names = {64: '有大买盘', 8193: '大笔买入', 8201: '火箭发射', 8202: '快速反弹'};
                            seriesName = seriesName.split('_')[0];
                            result += `<span style="color:${mcolor}"> ${feng.stock_basics[seriesName]?.secu_name}</span>: ${evt_names[item.data.type]}<br/>`;
                        } else {
                            result += `<span style="color:${mcolor}"> ${feng.stock_basics[seriesName]?.secu_name}:
                                ${emjyBack.stock_tlines[item.seriesName][item.value[0]].last_px.toFixed(2)}</span>
                                <span style="color: ${rg}">${(item.value[1]*100).toFixed(2)}%</span><br/>`;
                        }
                    });
                    return result;
                }
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: 240,
                interval: 30,
                axisLabel: {
                    formatter: function (value) {
                        if (value % 30 != 0) {
                            return '';
                        }
                        if (value == 120) return '11:30/13:00';
                        var minute = value > 120 ? value + 660 : value + 570;
                        return Math.floor(minute/60) + ':' + (''+minute%60).padStart(2,'0');
                    }
                }
            },
            yAxis: [
                {
                    type: 'value',
                    min: -0.109,
                    max: 0.109,
                    splitLine: { show: true },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                },
                {
                    type: 'value',
                    min: -0.21,
                    max: 0.21,
                    splitLine: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                },
                {
                    type: 'value',
                    min: -0.31,
                    max: 0.31,
                    splitLine: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false }
                }
            ],
            series: []
        }
        this.tchart.setOption(option);
    }

    addNewLine(secu_code) {
        var limit = guang.getStockZdf(secu_code) / 100;
        let yAxisIndex = 0;
        if (limit > 0.28) {
            yAxisIndex = 2;
        } else if (limit > 0.15) {
            yAxisIndex = 1;
        } else {
            yAxisIndex = 0;
        }

        var linedata = emjyBack.stock_tlines[secu_code];
        var lineColor = emjyBack.nextRandomColor();
        var series = {
            color: lineColor,
            name: secu_code,
            type: 'line',
            data: linedata.map(item =>{
                return {value: [item.x, item.change]};
            }),
            yAxisIndex: yAxisIndex,
            showSymbol: false,
            lineStyle: {width: 1, color: lineColor},
            endLabel: {
                show: true,
                color: 'inherit',
                formatter: function(params) {
                    return feng.stock_basics[params['seriesName']]?.secu_name;
                }
            },
            labelLayout: {
                moveOverlap: 'shiftY'
            }
        };

        var evdata = [];
        if (linedata[linedata.length - 1]) {
            let date = ''+linedata[linedata.length-1].date;
            date = date.substring(0, 4)+'-'+date.substring(4,6)+'-'+date.substring(6,8);
            if (emjyBack.stock_events[secu_code] && emjyBack.stock_events[secu_code][date]) {
                var events = emjyBack.stock_events[secu_code][date].filter(e=>[64, 8193, 8201, 8202].includes(e.type));
                events.forEach(e=>{
                    var litem = linedata.find(l=>l.x == e.x);
                    e.y = litem?.change;
                    e.symbol = 'circle';
                    if (e.type == 8193) {
                        e.symbol = 'rect';
                    } else if (e.type == 8201) {
                        e.symbol = 'arrow';
                    } else if (e.type == 8202) {
                        e.symbol = 'triangle';
                    }
                });
                evdata = events.map(e => {
                    return {value: [e.x, e.y], symbol: e.symbol, type: e.type}
                });
            }
        }
        var series_evt = {
            name: secu_code+"_evt",
            type: 'scatter',
            data: evdata,
            symbolSize: 6,
            itemStyle: {
                color: 'transparent',
                borderColor: lineColor,
                borderWidth: 1
            },
            yAxisIndex: yAxisIndex,
        };

        var seriesList = this.tchart.getOption().series;
        seriesList.push(series);
        seriesList.push(series_evt);
        this.tchart.setOption({
            series: seriesList
        });
    }

    updateLine(secu_code) {
        if (!emjyBack.stock_tlines[secu_code]) {
            return;
        }
        var series = this.tchart.getOption().series;
        var targetSeries = series.find(s => s.name === secu_code);
        if (targetSeries) {
            targetSeries.data = emjyBack.stock_tlines[secu_code].map(item => [item.x, item.change]);
            this.tchart.setOption({ series: series });
        } else {
            this.addNewLine(secu_code);
        }
    }

    replay() {
        var duration_ms = 30000;
        var option = this.tchart.getOption();
        var data = {}
        var dataLen = 0;
        if (option.series) {
            option.series.forEach(series => {
                data[series.name] = series.data;
                if (data[series.name].length > dataLen) {
                    dataLen = data[series.name].length;
                }
            });
        }
        var x = 0;
        const ntick = 50;
        var animationInterval = setInterval(_=>{
            option.series.forEach(series => {
                series.data = data[series.name].filter(item => item[0] < x || (item.value && item.value[0] < x));
            });
            x += option.xAxis[0].max / (duration_ms/ntick);
            this.tchart.setOption(option);
            if (!option.series.find(series => series.data.length < data[series.name].length)) {
                clearInterval(animationInterval);
            }
        }, ntick);
    }
}


class SecuCard {
    constructor(secu) {
        this.plate = secu;
        this.element = this.createCardElement();
    }

    createCardElement() {
        this.element = document.createElement('div');
        this.element.classList.add('subcard');
        this.updateCardContent(this.plate);
        return this.element;
    }

    async updateCardContent(plate) {
        this.plate = plate;
        const pinfo = await feng.getStockBasics(this.plate);
        if (!pinfo) {
            this.element.innerHTML = this.plate;
            this.element.onmouseenter = () => {
                this.updateCardContent(this.plate);
            }
            return this.element;
        }
        let pextra = emjyBack.stock_extra[this.plate];
        if (!emjyBack.stock_extra[this.plate]) {
            pextra = {};
            emjyBack.stock_extra[this.plate] = pextra;
        }
        this.element.innerHTML = '';

        const name = document.createElement('div');
        name.classList.add('subcard-title');
        if (pextra.focus) {
            this.element.classList.add('selected');
        }
        name.textContent = pinfo.secu_name;
        name.onclick = e => {
            if (this.element.classList.contains('selected')) {
                this.element.classList.remove('selected');
                pextra.focus = false;
                emjyBack.tlineFocused(this.plate, false);
            } else {
                this.element.classList.add('selected');
                pextra.focus = true;
                emjyBack.tlineFocused(this.plate);
            }
            emjyBack.home.platesManagePanel.savePlates();
        };
        this.element.appendChild(name);

        this.element.onmouseenter = () => {
            this.showTooltip();
        }

        return this.element;
    }

    async showTooltip() {
        const tooltip = emjyBack.tooltipPanel();
        this.element.appendChild(tooltip);
        let pinfo = await feng.getStockBasics(this.plate);
        let clsLk = `https://www.cls.cn/stock?code=${this.plate}`;
        let emLk = `https://emweb.securities.eastmoney.com/pc_hsf10/pages/index.html?type=web&code=${emjyBack.secuConvert(this.plate)}#/jyfx`
        if (!pinfo) {
            tooltip.innerHTML = `
            <div class="center"><div class="card-info">
                <div class="left-info"><a target="_blank" href="${clsLk}" >${this.plate}</a></div>
                <div class="left-info"><a target="_blank" href="${emLk}" >F10</a></div>
            </div></div>`;
            return;
        }
        let changeColor = pinfo.change == 0 ? '' : (pinfo.change > 0 ? 'red' : 'green');
        let tipHtml = `<div class="center">
            <div class="card-info">
                <div class="left-info"><a target="_blank" href="${clsLk}" >${this.plate}</a> <a target="_blank" href="${emLk}" >F10</a></div>
                <div class="left-info"></div>
                <div class="left-info">最新：<span class="${changeColor}">${pinfo.last_px}</span>/${pinfo.preclose_px}</div>
                <div class="left-info">涨跌幅：<span class="${changeColor}">${(pinfo.change*100).toFixed(2) + '%'}</span></div>`
        let stockplates = [];
        if (emjyBack.stock_extra[this.plate]) {
            let pextra = emjyBack.stock_extra[this.plate];
            let ztlbc = pextra.lbc == 1 ? '首板' : pextra.days == pextra.lbc ? `${pextra.days}连板` : `${pextra.days}天${pextra.lbc}板`;
            let todate = pextra.ndays > 0 ? `至今: ${pextra.ndays}天` : '今日涨停';
            if (pextra.lbc) {
                tipHtml += `
                <div class="left-info">${pextra.date.substring(5)} ${ztlbc}</div>
                <div class="left-info">${todate}</div>
                `;
            }
            var statsplates = [];
            if (emjyBack.all_stats && emjyBack.all_stats.length > 0) {
                emjyBack.all_stats[emjyBack.all_stats.length - 1].plates.forEach(p => {
                    if (p.zt_stocks.includes(this.plate)) {
                        stockplates.push(p.secu_code);
                    }
                });
                if (stockplates.length == 0) {
                    statsplates = emjyBack.all_stats[emjyBack.all_stats.length - 1].plates.map(p=>p.secu_code);
                }
            }
            if (stockplates.length == 0 && statsplates.length > 0) {
                statsplates.forEach(p => {
                    if (emjyBack.plate_stocks[p] && emjyBack.plate_stocks[p].includes(this.plate)) {
                        stockplates.push(p);
                    }
                });
            }
        }
        if (stockplates.length == 0 && emjyBack.stock_bks) {
            stockplates = emjyBack.stock_bks[this.plate];
            if (!stockplates) {
                stockplates = [];
            }
        }
        if (stockplates.length == 0) {
            for (let p in emjyBack.plate_stocks) {
                if (emjyBack.plate_stocks[p].includes(this.plate)) {
                    stockplates.push(p);
                }
            }
        }
        stockplates = Array.from(new Set(stockplates.map(p => emjyBack.plate_basics[p]?emjyBack.plate_basics[p].secu_name:p)));
        if (stockplates.length > 0) {
            tipHtml += `
                <div class="left-info" style='color: #999'>所属板块>:</div>
                `
            for (var i = 0; i < stockplates.length; i++) {
                tipHtml += `
                <div class="left-info">${stockplates[i]}</div>
                `;
            }
        }
        if (emjyBack.stock_events[this.plate]) {
            let dates = Object.keys(emjyBack.stock_events[this.plate])
            let date = dates.reduce((max, current) => current > max ? current : max, dates[0]);
            if (emjyBack.stock_events[this.plate][date].length > 0) {
                let v64 = emjyBack.stock_events[this.plate][date].filter(e=>e.type == 64).length;
                let v8193 = emjyBack.stock_events[this.plate][date].filter(e=>e.type == 8193).length;
                let v8201 = emjyBack.stock_events[this.plate][date].filter(e=>e.type == 8201).length;
                let v8202 = emjyBack.stock_events[this.plate][date].filter(e=>e.type == 8202).length;
                tipHtml += `
                <div class="left-info">有大买盘: ${v64}</div>
                <div class="left-info">大笔买入: ${v8193}</div>
                <div class="left-info">火箭发射: ${v8201}</div>
                <div class="left-info">快速反弹 ${v8202}</div>
                `
            }
        }
        tipHtml += '</div></div>'
        tooltip.innerHTML = tipHtml;
    }

    render() {
        return this.element;
    }
}


class StatsPlateCard {
    constructor(plate) {
        this.plate = plate;
        this.createCardElement();
    }

    createCardElement() {
        this.element = document.createElement('div');
        this.element.classList.add('card');
        return this.updateCardContent();
    }

    updateCardContent() {
        let pinfo = this.plate;
        var ztcnt = 0;
        if (pinfo.zt_stocks) {
            ztcnt = pinfo.zt_stocks.length;
        }
        let zColor = ztcnt > 0 ? 'red' : '';
        this.element.innerHTML = `
        <div class="card-title">${pinfo.secu_name} <span class="${zColor}">${ztcnt}</span></div>
        `;

        this.element.onmouseenter = () => {
            this.showTooltip();
        }
        return this.element;;
    }

    showTooltip() {
        let pinfo = this.plate;
        const tooltip = emjyBack.tooltipPanel();
        this.element.appendChild(tooltip);
        var url1 = pinfo.secu_code.startsWith('BK') ? `http://quote.eastmoney.com/center/boardlist.html#boards2-90.${pinfo.secu_code}.html` : `https://www.cls.cn/plate?code=${pinfo.secu_code}`;
        var url2 = pinfo.secu_code.startsWith('BK') ? `http://quote.eastmoney.com/bk/90.${pinfo.secu_code}.html` : `https://www.cls.cn/stock?code=${pinfo.secu_code}`;

        var chgColor = pinfo.change_to_date > 3 ? 'red': '';
        tooltip.innerHTML = `<div class="center">
            <div class="card-info">
                <div class="left-info"><a target="_blank" href="${url1}" >详情(${pinfo.secu_code})</a></div>
                <div class="left-info"><a target="_blank" href="${url2}" >板块走势</a></div>
                <div class="left-info">涨停家数: ${pinfo.zt_stocks.length}</div>
                <div class="left-info">启动日: ${pinfo.kickdate.substring(5)}</div>
                <div class="left-info">至今天数: ${pinfo.kick_days}</div>
                <div class="left-info">至今涨幅：<span class="${chgColor}">${pinfo.change_to_date}</span></div>
            </div>
        </div>
        `
    }
}


class PlateCard {
    constructor(plate, isMain = true) {
        this.isMain = isMain;
        this.plate = plate;
        this.createCardElement();
    }

    createCardElement() {
        this.element = document.createElement('div');
        this.element.classList.add('card');
        if (this.isMain) {
            this.element.classList.add('main');
        }
        this.element.draggable = true;

        this.element.addEventListener('dragstart', this.onDragStart.bind(this));
        this.element.addEventListener('dragend', this.onDragEnd.bind(this));

        return this.updateCardContent(this.plate);
    }

    updateCardContent(plate) {
        if (!plate) {
            return this.element;
        }

        this.plate = plate;
        let pinfo = emjyBack.plate_basics[this.plate];
        let changeColor = pinfo.change == 0 ? '' : (pinfo.change > 0 ? 'red' : 'green');
        let fundColor = pinfo.main_fund_diff > 0 ? 'red' : 'green';
        this.element.innerHTML = `
        <div class="card-title">${pinfo.secu_name}</div>
        <div class="card-info">
            <div class="center">
                <span class="${changeColor}">${(pinfo.change*100).toFixed(2) + '%'}</span>
                <span class="${fundColor}">${emjyBack.formatMoney(pinfo.main_fund_diff)}</span>
                 ${pinfo.limit_up_num}</div>
        </div>
        `;
        this.element.onmouseenter = () => {
            this.showTooltip();
        }
        return this.element;;
    }

    showTooltip() {
        let pinfo = emjyBack.plate_basics[this.plate];
        if (!pinfo) {
            return;
        }
        let changeColor = pinfo.change == 0 ? '' : (pinfo.change > 0 ? 'red' : 'green');
        let fundColor = pinfo.main_fund_diff > 0 ? 'red' : 'green';
        const tooltip = emjyBack.tooltipPanel();
        this.element.appendChild(tooltip);
        tooltip.innerHTML = `<div class="center">
            <div class="card-info">
                <div class="left-info"><a target="_blank" href="https://www.cls.cn/plate?code=${pinfo.secu_code}" >详情(${pinfo.secu_code})</a></div>
                <div class="left-info"><a target="_blank" href="https://www.cls.cn/stock?code=${pinfo.secu_code}" >板块走势</a></div>
                <div class="left-info">涨跌幅：<span class="${changeColor}">${(pinfo.change*100).toFixed(2) + '%'}</span></div>
                <div class="left-info">涨跌停：<span class="red">${pinfo.limit_up_num}</span>/${pinfo.limit_down_num}</div>
                <div class="left-info">净流入：<span class="${fundColor}">${emjyBack.formatMoney(pinfo.main_fund_diff)}</span></div>
                <div class="left-info">涨跌比：<span class="red">${pinfo.limit_up}</span>/${pinfo.limit_down}</div>
            </div>
        </div>
        `
    }

    onDragStart(event) {
        event.dataTransfer.setData('text/plain', this.plate);
        event.dataTransfer.setData('isMain', this.isMain);
        event.dataTransfer.setData('originalContainerId', this.element.closest('.container').id);
        event.dataTransfer.effectAllowed = 'move';
        this.element.classList.add('dragging');

        // 显示隐藏区域
        if (!this.panel) {
            this.panel = this.element.closest('.panel');
        }
        if (this.panel) {
            const hiddenArea = this.panel.parentElement.querySelector('.hidden-area');
            hiddenArea.parentElement.removeChild(hiddenArea);
            const currentContainer = this.element.closest('.container');
            currentContainer.parentElement.insertBefore(hiddenArea, currentContainer.nextElementSibling);
            hiddenArea.style.display = 'block';
        }
    }

    onDragEnd(event) {
        this.element.classList.remove('dragging');

        // 隐藏隐藏区域
        if (this.panel) {
            const hiddenArea = this.panel.parentElement.querySelector('.hidden-area');
            hiddenArea.style.display = 'none';
        }
    }

    render() {
        return this.element;
    }
}


class PlatesContainer {
    constructor(panel) {
        this.panel = panel;
        this.cards = [];
        this.subcons = {};
        this.element = this.createContainerElement();
        this.chart_container = document.createElement('div');
        document.querySelector('#charts-panel').appendChild(this.chart_container);
        this.element.containerInstance = this; // 绑定容器实例
    }

    createContainerElement() {
        const container = document.createElement('div');
        container.classList.add('container');
        container.id = 'container_' + Math.random().toString(36).substring(7);

        const actionArea = document.createElement('div');
        actionArea.classList.add('action-area');
        this.addActionButtons(actionArea);

        const infoArea = document.createElement('div');
        infoArea.classList.add('info-area');
        infoArea.id = 'info-area_cards';

        container.appendChild(actionArea);
        container.appendChild(infoArea);

        const sa = {
            hx: {name: '核心', color: `rgb(${160}, 0, 0)`, save: true},
            db: {name: '断板', color: `rgb(${160 + 0.2 * 95}, 0, 0)`, save: true},
            zw: {name: '中位', color: `rgb(${160 + 0.4 * 95}, 0, 0)`, save: false},
            sb: {name: '首板', color: `rgb(${160 + 0.6 * 95}, 0, 0)`, save: false},
            zf: {name: '大涨', color: `rgb(${160 + 0.8 * 95}, 0, 0)`, save: false}
        };
        for (let k in sa) {
            const scon = new StockCollection(sa[k]);
            this.subcons[k] = scon;
            container.appendChild(scon.render());
        }

        container.addEventListener('dragover', this.onDragOver.bind(this));
        container.addEventListener('drop', this.onDrop.bind(this));

        return container;
    }

    addActionButtons(actionArea) {
        const chartBtn = document.createElement('button');
        chartBtn.textContent = 'C';
        chartBtn.id = 'show-chart-btn-action';
        chartBtn.title = '分时图开关';
        chartBtn.classList.add('container-button');
        chartBtn.onclick = e => {
            if (!e.target.classList.contains('pressed')) {
                e.target.classList.add('pressed');
                let substocks = this.subcons['hx'].stocks;
                for (let k in this.subcons) {
                    if (k == 'hx') {
                        continue;
                    }
                    if (this.subcons[k] && this.subcons[k].cards.length > 0) {
                        let subcards = this.subcons[k].cards.filter(s => s.element.classList.contains('selected'));
                        subcards.forEach(s => {
                            if (!substocks.includes(s.plate)) {
                                substocks.push(s.plate);
                            }
                        });
                    }
                }
                emjyBack.addTlineStocksQueue(substocks, true);
                this.tlinechart_stocks = substocks;
                if (this.tlinechart_stocks.filter(s => !emjyBack.stock_tlines[s]).length > 0) {
                    emjyBack.updateFocusedStocksTline();
                }
                this.showTlineChart();
            } else {
                emjyBack.addTlineStocksQueue(this.subcons['hx'].stocks, false);
                e.target.classList.remove('pressed');
            }
        };
        actionArea.appendChild(chartBtn);

        const evtBtn = document.createElement('button');
        evtBtn.textContent = 'E';
        evtBtn.title = '更新个股异动';
        evtBtn.onclick = () => {
            this.queryEvents();
        }
        actionArea.appendChild(evtBtn);

        const subBtn = document.createElement('button');
        subBtn.textContent = 'U';
        subBtn.title = '更新个股列表';
        subBtn.onclick = _ => emjyBack.getBkStocks(this.cards.map(c => c.plate));
        actionArea.appendChild(subBtn);

        const replayBtn = document.createElement('button');
        replayBtn.textContent = 'R';
        replayBtn.title = '分时回放';
        replayBtn.onclick = e => {
            if (this.stockTLineChart) {
                this.stockTLineChart.replay();
            }
        }
        actionArea.appendChild(replayBtn);

        var setEditable = function(dayDiv, cb) {
            dayDiv.classList.add('editable');
            dayDiv.ondblclick = e => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = e.target.textContent;
                input.classList.add('editing');
                input.onblur = ei => {
                    e.target.textContent = ei.target.value;
                    if (typeof(cb) === 'function') {
                        cb(e.target, ei.target.value);
                    }
                }
                input.onkeypress = ei => {
                    if (ei.key === 'Enter') {
                        ei.target.blur();
                    }
                }
                e.target.textContent = '';
                e.target.appendChild(input);
                input.focus();
            }
        }

        const dayDiv = document.createElement('div');
        dayDiv.title = '板块启动日期(双击修改)';
        setEditable(dayDiv, (ele, v) => {
            if (!emjyBack.stock_extra[this.mainsecu]) {
                emjyBack.stock_extra[this.mainsecu] = {};
            }
            emjyBack.stock_extra[this.mainsecu].start_date = v;
        });
        actionArea.appendChild(dayDiv);

        const headBtn = document.createElement('button');
        headBtn.textContent = 'H';
        headBtn.title = '更新领涨股';
        headBtn.onclick = e => {
            this.queryHeadStocks();
        }
        actionArea.appendChild(headBtn);

        const coreDiv = document.createElement('div');
        coreDiv.title = '添加核心股';
        setEditable(coreDiv, (ele, v) => {
            ele.textContent = '';
            if (!v) {
                return;
            }

            let secu = guang.convertToSecu(v);
            if (v.length !== 6 || (!secu.startsWith('sh') && !secu.startsWith('sz') && !secu.endsWith('BJ'))) {
                alert('Wrong stock code!' + v);
                return;
            }
            this.addSubCard(secu);
            emjyBack.home.platesManagePanel.savePlates();
        });
        actionArea.appendChild(coreDiv);

        const rightBlock = document.createElement('div');
        rightBlock.classList.add('right-info');
        rightBlock.style.width = '100%';
        actionArea.appendChild(rightBlock);

        const collapsedBtn = document.createElement('button');
        collapsedBtn.textContent = '高';
        collapsedBtn.classList.add('container-button');
        collapsedBtn.classList.add('collapse-button');
        collapsedBtn.title = '紧凑/与分时图对齐';
        collapsedBtn.onclick = e => {
            if (!e.target.classList.contains('pressed')) {
                this.panel.element.querySelectorAll('button.collapse-button').forEach(b=>b.classList.add('pressed'));
                for (let i = 1; i < this.panel.containers.length; i++) {
                    const con = this.panel.containers[i];
                    if (con.stockTLineChart) {
                        let chart_rect = con.stockTLineChart.container.getBoundingClientRect();
                        let pre_con_rect = this.panel.containers[i-1].element.getBoundingClientRect();
                        if (chart_rect.top > pre_con_rect.bottom) {
                            this.panel.containers[i-1].element.style.minHeight = `${chart_rect.top - pre_con_rect.top}px`;
                        }
                    }
                }
            } else {
                this.panel.containers.forEach(con => {
                    con.element.style.minHeight = '';
                });
                this.panel.element.querySelectorAll('button.collapse-button').forEach(b=>b.classList.remove('pressed'));
            }
        }
        rightBlock.appendChild(collapsedBtn);

        const popBtn = document.createElement('button');
        popBtn.textContent = '↑';
        popBtn.title = '移到最前';
        popBtn.onclick = e => {
            if (this === this.panel.containers[0]) {
                return;
            }
            const parent = this.element.parentElement;
            parent.insertBefore(this.element, parent.firstElementChild);
            const chartparent = this.chart_container.parentElement;
            chartparent.insertBefore(this.chart_container, chartparent.firstElementChild);
            this.panel.containers = this.panel.containers.filter(con => con != this);
            this.panel.containers.unshift(this);
        };
        rightBlock.appendChild(popBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'x';
        delBtn.title = '删除';
        delBtn.onclick = e => {
            this.panel.removeContainer(this);
        };
        rightBlock.appendChild(delBtn);
    }

    addCard(plate) {
        if (this.cards.find(c=> c.plate == plate)) {
            return;
        }
        const card = new PlateCard(plate, this.cards.length === 0);
        this.cards.push(card);
        if (card.isMain) {
            this.mainsecu = card.plate;
            const dayDiv = this.element.querySelector('div.editable');
            if (!emjyBack.stock_extra[this.mainsecu]) {
                emjyBack.stock_extra[this.mainsecu] = {}
            }
            if (!emjyBack.stock_extra[this.mainsecu].start_date) {
                dayDiv.textContent = guang.getTodayDate('-');
                emjyBack.stock_extra[this.mainsecu].start_date = dayDiv.textContent;
            } else {
                dayDiv.textContent = emjyBack.stock_extra[this.mainsecu].start_date;
            }
        }
        if (!emjyBack.plate_stocks[plate]) {
            emjyBack.getBkStocks(plate);
        }
        this.updateInfoArea();
    }

    updateInfoArea(plates) {
        const infoArea = this.element.querySelector('#info-area_cards');
        infoArea.innerHTML = '';
        if (!plates || plates.length == 0) {
            this.cards.forEach(card => infoArea.appendChild(card.render()));
            return;
        }
        this.cards.forEach(card => infoArea.appendChild(card.updateCardContent(plates.find(p => p == card.plate))));
    }

    queryHeadStocks() {
        const hdurl = `${emjyBack.fha.svr5000}stock?act=hdstocks&bks=${this.cards.map(c => c.plate).join(',')}&start=${emjyBack.stock_extra[this.mainsecu].start_date}`;
        fetch(hdurl).then(r=>r.json()).then(bstks => {
            let hds = bstks.map(s => guang.convertToSecu(s));
            feng.getStockBasics(hds).then(() => {
                hds.forEach(s => emjyBack.home.platesManagePanel.addSubCard(this.mainsecu, s));
            });
        });
    }

    queryEvents() {
        emjyBack.sendWebsocketMessage({action: 'get', query: 'stkchanges'});
    }

    lastTradeDayZt(secu) {
        for (var i in emjyBack.recent_zt_map) {
            for (var zr of emjyBack.recent_zt_map[i]) {
                if (zr[0] == secu && zr[1] == emjyBack.last_traded_date) {
                    return true;
                }
            }
        }
        return false;
    }

    recentZt(secu) {
        for (var i in emjyBack.recent_zt_map) {
            for (var zr of emjyBack.recent_zt_map[i]) {
                if (zr[0] == secu) {
                    return true;
                }
            }
        }
        return false;
    }

    addSubCard(secu) {
        if (this.lastTradeDayZt(secu)) {
            this.subcons['hx'].addStocks(secu);
            this.subcons['hx'].render();
            if (this.subcons['db'].stocks.includes(secu)) {
                this.subcons['db'].removeStocks(secu);
                this.subcons['db'].render();
            }
        } else {
            this.subcons['db'].addStocks(secu);
            this.subcons['db'].render();
            if (this.subcons['hx'].stocks.includes(secu)) {
                this.subcons['hx'].removeStocks(secu);
                this.subcons['hx'].render();
            }
        }
    }

    updateSubArea(plates) {
        if (!emjyBack.last_traded_date) {
            setTimeout(() => {
                this.updateSubArea(plates);
            }, 500);
            return;
        }

        const zplates = plates.filter(c => this.lastTradeDayZt(c));
        if (zplates.length > 0) {
            this.subcons['hx'].addStocks(zplates);
            this.subcons['hx'].render();
        }

        const brkplates = plates.filter(c => !zplates.includes(c));
        if (brkplates.length > 0) {
            this.subcons['db'].addStocks(brkplates);
            this.subcons['db'].render();
        }
    }

    updateSubCons(zt_brk) {
        let z_up0 = zt_brk.up0;
        let z_up0_brk = zt_brk.brk0;
        let z_zf0 = zt_brk.zf0;

        let con_plates_stocks = new Set();
        for (const card of this.cards) {
            con_plates_stocks = con_plates_stocks.union(new Set(emjyBack.plate_stocks[card.plate]));
        }
        z_up0 = z_up0.filter(c=>con_plates_stocks.has(c));
        z_up0_brk = z_up0_brk.filter(c=>con_plates_stocks.has(c));
        z_zf0 = z_zf0.filter(c=>con_plates_stocks.has(c));
        if (z_up0.length + z_up0_brk.length > 0) {
            this.subcons['sb'].addStocks(z_up0.concat(z_up0_brk));
            this.subcons['sb'].render();
        }
        if (z_zf0.length > 0) {
            this.subcons['zf'].addStocks(z_zf0);
            this.subcons['zf'].render();
        }

        let z_up_stocks = zt_brk.up_stocks;
        let z_up_brk = zt_brk.up_brk;
        let zw_stocks = z_up_stocks.concat(z_up_brk).filter(c => con_plates_stocks.has(c));
        zw_stocks = zw_stocks.filter(c => !this.subcons['hx'].stocks.includes(c) && !this.subcons['db'].stocks.includes(c));
        if (zw_stocks.length > 0) {
            this.subcons['zw'].addStocks(zw_stocks);
            this.subcons['zw'].render();
        }
    }

    updateDayZtArea(plates) {
        let recentzt = plates.filter(c => this.recentZt(c));
        let rnzt = plates.filter(c=> !recentzt.includes(c));
        if (rnzt.length > 0) {
            this.subcons['sb'].addStocks(rnzt);
            this.subcons['sb'].render();
        }
        let zw = recentzt.filter(c => !this.subcons['hx'].stocks.includes(c) && !this.subcons['db'].stocks.includes(c));
        if (zw.length > 0) {
            this.subcons['zw'].addStocks(zw);
            this.subcons['zw'].render();
        }
    }

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    onDrop(event) {
        event.preventDefault();

        const originalContainerId = event.dataTransfer.getData('originalContainerId');
        if (originalContainerId === this.element.id) {
            return;
        }

        this.addCard(event.dataTransfer.getData('text/plain'));

        const originalContainer = document.getElementById(originalContainerId).containerInstance;
        if (originalContainer.cards.length === 1) {
            this.panel.removeContainer(originalContainer);
        }
    }

    removeCard(secu_code) {
        this.cards = this.cards.filter(card => card.plate !== secu_code);
        if (!this.cards.find(card => card.isMain)) {
            this.cards[0].isMain = true;
            this.mainsecu = this.cards[0].plate;
        }
        this.updateInfoArea();
    }

    render() {
        return this.element;
    }

    showTlineChart() {
        if (!this.stockTLineChart) {
            var ctitle = this.cards.map(c=>emjyBack.plate_basics[c.plate].secu_name).join(' ');
            this.stockTLineChart = new StockTimeLine(this.chart_container, ctitle);
            emjyBack.addTlineListener(this);
        }
        emjyBack.updateStocksTline();
        this.tlinechart_stocks.forEach(stock => {
            if (emjyBack.stock_tlines[stock]) {
                this.onTlineUpdated(stock);
            }
        });
    }

    resetTlineChart() {
        if (this.stockTLineChart) {
            this.stockTLineChart.tchart.clear();
            this.stockTLineChart.initOptions();
        }
    }

    onTlineUpdated(code) {
        if (!this.tlinechart_stocks.includes(code)) {
            return;
        }
        this.stockTLineChart.updateLine(code);
    }

    onEventReceived(codes, date) {
        if (!date) {
            let dates = Object.keys(emjyBack.stock_events[codes[0]])
            date = dates.reduce((max, current) => current > max ? current : max, dates[0]);
        }
        if (this.stockTLineChart) {
            for (const code of codes) {
                if (this.tlinechart_stocks.includes(code)) {
                    this.stockTLineChart.updateLine(code);
                }
            }
        }

        let stocks = new Set();
        for (const card of this.cards) {
            stocks = stocks.union(new Set(emjyBack.plate_stocks[card.plate]));
        }
        let ztstocks = [];
        stocks.forEach(stock => {
            if (emjyBack.stock_events[stock] && emjyBack.stock_events[stock][date]) {
                var ztevents = emjyBack.stock_events[stock][date].filter(e=>[4,16].includes(e.type));
                var ztcnt = 0;
                for (const e of ztevents) {
                    if (e.type === 4) ztcnt++;
                    // else if (e.type === 16) ztcnt--;
                }
                if (ztcnt > 0) {
                    ztstocks.push(stock);
                }
            }
        });
        this.updateDayZtArea(ztstocks);
    }
}

class PlatesManagePanel {
    constructor(parent) {
        this.ignoredPlates = ['cls80250', 'cls80218', 'cls80272'];
        this.parent = parent;
        this.containers = [];
        this.element = this.createPanelElement();
        this.hiddenArea = this.createHiddenArea();
        parent.appendChild(this.element);
        this.element.appendChild(this.hiddenArea);
    }

    savePlates() {
        if (!this.initialized) {
            return;
        }
        var date = guang.getTodayDate('-');
        var selectedPlates = {date, plates: []};
        this.containers.forEach(con=>{
            let splate = {plates: [], stocks: [], extras: []};
            con.cards.forEach(c=>{
                if (c.isMain) {
                    splate.mainsecu = c.plate;
                }
                splate.plates.push(emjyBack.plate_basics[c.plate]);
            });
            splate.stocks = con.subcons['hx'].stocks;
            splate.stocks = con.subcons['db'].stocks;
            selectedPlates.plates.push(splate);
            if (emjyBack.stock_extra) {
                selectedPlates.extras = emjyBack.stock_extra;
            }
        });
        emjyBack.saveToLocal({'selected_plates': selectedPlates});
    }

    loadPlates() {
        emjyBack.getFromLocal('selected_plates', sp => {
            if (sp) {
                var date = sp.date;
                if (sp.extras) {
                    emjyBack.stock_extra = sp.extras
                }
                sp.plates.forEach(p=>{
                    if (p.plates.length == 0) {
                        return;
                    }
                    p.plates.forEach(c=>{
                        if (!emjyBack.plate_basics[c.secu_code]) {
                            emjyBack.plate_basics[c.secu_code] = c;
                        }
                    });
                    const container = new PlatesContainer(this);
                    this.containers.push(container);
                    p.plates.forEach(c=>container.addCard(c.secu_code));
                    feng.getStockBasics(p.stocks).then(() => {
                        container.updateSubArea(p.stocks);
                        this.element.appendChild(container.render());
                    });
                });
            }
            this.initialized = true;
        });
    }

    createPanelElement() {
        const panel = document.createElement('div');
        panel.classList.add('panel');
        return panel;
    }

    createHiddenArea() {
        const hiddenArea = document.createElement('div');
        hiddenArea.classList.add('hidden-area');
        hiddenArea.textContent = 'Drop here to delete';
        hiddenArea.style.display = 'none';

        hiddenArea.addEventListener('dragover', this.onDragOver.bind(this));
        hiddenArea.addEventListener('drop', this.onDrop.bind(this));

        return hiddenArea;
    }

    _add_card(plate) {
        const container = new PlatesContainer(this);
        container.addCard(plate);
        this.containers.push(container);
        this.element.appendChild(container.render());
    }

    addCard(plate) {
        if (this.ignoredPlates.includes(plate)) {
            return;
        }
        if (this.containers.find(con=>con.mainsecu == plate)) {
            return;
        }
        this._add_card(plate);
        this.savePlates();
    }

    checkExists(plate) {
        return this.containers.find(con=>con.cards.find(c=>c.plate == plate));
    }

    addNonExistsCards(plates) {
        let acnt = 0;
        for(const plt of plates) {
            if (this.containers.find(con=>con.cards.find(c=>c.plate == plt)) || this.ignoredPlates.includes(plt)) {
                continue;
            }
            this._add_card(plt);
            acnt += 1;
        }
        if (acnt > 0) {
            this.savePlates();
        }
    }

    addSubCard(mainsecu, subplate) {
        const container = this.containers.find(c => c.mainsecu == mainsecu);
        if (container) {
            container.addSubCard(subplate);
        }
        this.savePlates();
    }

    refreshSubCards(mainsecu, subplates) {
        const container = this.containers.find(c => c.mainsecu == mainsecu);
        if (container) {
            container.updateSubArea(subplates);
            this.savePlates();
        }
    }

    onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    onDrop(event) {
        event.preventDefault();
        const plate = event.dataTransfer.getData('text/plain');
        const isMain = event.dataTransfer.getData('isMain') === 'true';
        this.deleteCard(plate, isMain);
        this.hiddenArea.style.display = 'none';
    }

    deleteCard(plate, isMain) {
        for (const container of this.containers) {
            const index = container.cards.findIndex(card => card.plate === plate && card.isMain === isMain);
            if (index !== -1) {
                container.cards.splice(index, 1);
                container.updateInfoArea();
                if (emjyBack.stockextras && emjyBack.stockextras[container.mainsecu]) {
                    delete(emjyBack.stockextras[container.mainsecu]);
                }
                if (container.cards.length === 0) {
                    this.removeContainer(container);
                }
                break;
            }
        }
        this.savePlates();
    }

    removeContainer(container) {
        const index = this.containers.indexOf(container);
        if (index > -1) {
            this.containers.splice(index, 1);
            this.element.removeChild(container.render());
            document.querySelector('#charts-panel').removeChild(container.chart_container);
        }
        this.savePlates();
    }

    updatePlatesInfo(plates) {
        this.containers.forEach(container => container.updateInfoArea(plates));
    }

    updateStocksInfo() {
        let zt_brk = emjyBack.getZtOrBrkStocks();
        this.containers.forEach(container => container.updateSubCons(zt_brk));
    }
}


class LeftColumnBarItem {
    constructor(parent) {
        this.createIcon(parent);
        parent.onclick = e => {
            this.rootPanel.style.display = 'block';
            this.showRootPanel();
        }
        this.rootPanel = document.createElement('div');
        document.body.appendChild(this.rootPanel);
        this.rootPanel.style.position = 'fixed';
        this.rootPanel.style.left = '5px';
        this.rootPanel.style.top = '20px';
        this.rootPanel.style.bottom = '0px';
        this.rootPanel.style.display = 'none';
        this.rootPanel.style.backgroundColor = 'white';
        this.rootPanel.onmouseleave = () => {
            this.rootPanel.style.display = 'none';
            this.onMouseLeavePanel();
        };
        this.createToolbars();
    }

    createIcon(parent) {
        parent.style.display = 'flex';
        parent.innerHTML = `
        <div style="font-size: 2em">👩‍💼</div>
        <div id="bell_counter" style="color: #eb1515; margin: 0 0 0 -10px;"></div>
        `;
    }

    createToolbars() {}

    onMouseLeavePanel() {}

    showRootPanel() {}
}


class ClsTelegraphRed extends LeftColumnBarItem {
    constructor(parent) {
        super(parent);
        this.allClsTelegraphs = {};
        this.pinnedTelegraphs = [];
        this.markedRead = [];
        this.bellIcon = parent;
    }

    createIcon(parent) {
        parent.style.display = 'flex';
        parent.innerHTML = `
        <div style="font-size: 2em">👩‍💼</div>
        <div id="bell_counter" style="color: #eb1515; margin: 0 0 0 -10px;"></div>
        `;
    }

    createToolbars() {
        this.rootPanel.style.width = '40%';
        this.rootPanel.innerHTML = `
        <div>
            共<span id="tele_total_count">1</span>条 (标红<span id="tele_red_count"></span>条, 已读<span id="tele_read_count"></span>条)
            显示<input id="chk_show_normal" type="checkbox"> <label for="chk_show_normal">普通</label> 
            <input id="chk_show_read" type="checkbox"> <label for="chk_show_read">已读</label>
            <div id="error_lnk_block" style="display: none">
                请求出错，<a id="error_lnk" target="_blank">请点此链接将请求结果填入下方输入框内,然后点击完成按钮</a> <button id="submit" title="">完成</button><br/>
                <textarea id="manual_request_result" style="width:90%;height:400px"> </textarea>
            </div>
        </div>
        <div style="overflow: auto; height: 95%; overscroll-behavior: contain;">
            <div id="telegraph_list"></div>
        </div>
        `
        this.chkShowNormal = this.rootPanel.querySelector('#chk_show_normal');
        this.chkShowNormal.onclick = () => {this.showRootPanel();}
        this.chkShowRead = this.rootPanel.querySelector('#chk_show_read');
        this.chkShowRead.onclick = () => {this.showRootPanel();}
        this.rootPanel.querySelector('#submit').onclick = () => {
            this.getRollList(t => {
                this.onNewRollList(t);
                this.showRootPanel();
            });
        }
    }

    onMouseLeavePanel() {
        this.setUnreadCount();
        this.checkSavedStamp();
    }

    startRunning() {
        emjyBack.getFromLocal('cls_tele_last_stamp', s => {
            if (s) {
                this.saved_stamp = s;
            }
            this.roll_stamp = (new Date().getTime() / 1000).toFixed();
            this.getRollList(t => {
                this.onNewRollList(t);
            });
            this.refreshTelegraph(t => {
                this.onRefreshResponse(t);
            });
            this.updateTelegraphList(t => {
                this.onUpateResponse(t);
            });
        });
        this.startRefresh(true);
    }

    checkSavedStamp() {
        if (!this.saved_stamp || this.latest_stamp - this.saved_stamp != 0) {
            emjyBack.saveToLocal({'cls_tele_last_stamp': this.latest_stamp});
        }
    }

    startRefresh(lazy=false) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => {
            this.refreshTelegraph(t => {
                this.onRefreshResponse(t);
            });
            this.updateTelegraphList(t => {
                this.onUpateResponse(t);
            });
        }, lazy ? 300000: 30000);
    }

    showRootPanel() {
        const tlist_div = this.rootPanel.querySelector('#telegraph_list');
        tlist_div.innerHTML = '';
        this.rootPanel.querySelector('#tele_total_count').textContent = Object.keys(this.allClsTelegraphs).length;
        this.rootPanel.querySelector('#tele_red_count').textContent = Object.values(this.allClsTelegraphs).filter(t=>t.level == 'B' || t.type != -1).length;
        this.rootPanel.querySelector('#tele_read_count').textContent = this.markedRead.length;
        this.pinnedTelegraphs.forEach(d => {
            tlist_div.appendChild(this.createTelegraphItem(this.allClsTelegraphs[d], true));
        });

        var shown = this.rootPanel.querySelector('#chk_show_normal').checked;
        var showr = this.rootPanel.querySelector('#chk_show_read').checked;
        var teles = Object.keys(this.allClsTelegraphs).filter(i => !this.pinnedTelegraphs.includes(i));
        if (!shown) {
            teles = teles.filter(i => this.allClsTelegraphs[i].level == 'B' || this.allClsTelegraphs[i].type != -1);
        }
        if (!showr) {
            teles = teles.filter(i => !this.markedRead.includes(i));
        }
        if (teles.length > 0) {
            teles.sort((a, b)=> this.allClsTelegraphs[a].ctime - this.allClsTelegraphs[b].ctime);
            teles.forEach(d => {
                tlist_div.appendChild(this.createTelegraphItem(this.allClsTelegraphs[d]));
            });
            tlist_div.firstElementChild.scrollIntoView();
        }
    }

    createTelegraphItem(tele, pin=false) {
        const tdiv = document.createElement('div');
        tdiv.style.color = tele.level == 'B' ? '#de0422' : '';
        tdiv.style.margin = '5px';
        let bgclr = pin || this.markedRead.includes(''+tele.id) ? "" : "background-color: #ddd;"
        let content = tele.content?tele.content:tele.brief;
        if (content && content.includes('\n')) {
            content = content.replaceAll('\n', '<br>');
        }
        if (content.startsWith(`【${tele.title}】`)) {
            content = content.replace(`【${tele.title}】`, '');
        }
        tdiv.innerHTML = `
        <span><button id="btn_pin_unpin" title="${pin? "Unpin":"Pin"}">${pin ? "X" : "📌"}</button><strong>${emjyBack.timeString(new Date(tele.ctime*1000))} ${tele.title}</strong></span>
        <div id="telegraph_detail" tele_id="${tele.id}" style="${bgclr} overflow: hidden; text-overflow: ellipsis; max-height: 46px;" >${content}</div>
        `;
        if (tele.stock_list && tele.stock_list.length > 0) {
            tdiv.innerHTML  += `<div style="display: flex;"><div style="width: 70px;"></div>
            <div id="tele_${tele.id}_sl" style="display: flex; flex-flow: wrap;"></div>
            <div style="width: 60px;"></div></div>`;
            const sldiv = tdiv.querySelector(`#tele_${tele.id}_sl`);
            tele.stock_list.forEach(s => {
                const scard = new SecuCard(s.StockID);
                sldiv.appendChild(scard.render());
            });
            feng.getStockBasics(tele.stock_list.map(s=>s.StockID));
        }
        tdiv.querySelector('#btn_pin_unpin').onclick = e => {
            if (e.target.title === 'Pin') {
                var tele = e.target.closest('div').querySelector('#telegraph_detail')
                if (tele) {
                    this.pinTelegraph(tele.getAttribute('tele_id'))
                    e.target.title = 'Unpin';
                    e.target.textContent = 'X';
                }
            } else if (e.target.title === 'Unpin') {
                var tele = e.target.closest('div').querySelector('#telegraph_detail')
                if (tele) {
                    this.unpinTelegraph(tele.getAttribute('tele_id'))
                    e.target.title = 'Pin';
                    e.target.textContent = '📌';
                }
            }
        }
        tdiv.onclick = (e) => {
            if (e.target.tagName.toLowerCase() != 'div') {
                return;
            }
            if (e.target.id == 'telegraph_detail') {
                e.target.style.overflow = '';
                e.target.style.maxHeight = '';
                e.target.style.backgroundColor = '';
                this.markAsRead(e.target.getAttribute('tele_id'));
            }
        }
        return tdiv;
    }

    setUnreadCount() {
        let count = Object.keys(this.allClsTelegraphs).filter(i => !this.markedRead.includes(i)).length;
        this.bellIcon.querySelector('#bell_counter').textContent = count > 0 ? count : '';
        this.bellIcon.title = count > 0 ? count + '条未读消息' : '';
    }

    markAsRead(tid) {
        this.markedRead.push(tid);
    }

    pinTelegraph(tid) {
        if (this.pinnedTelegraphs.includes(tid)) {
            return;
        }
        this.pinnedTelegraphs.push(tid);
        this.pinnedTelegraphs.sort((i, j) => this.allClsTelegraphs[i].ctime - this.allClsTelegraphs[j].ctime);
    }

    unpinTelegraph(tid) {
        this.pinnedTelegraphs = this.pinnedTelegraphs.filter(t => t != tid);
    }

    getRollList(cb) {
        var param = 'app=CailianpressWeb&category=red&last_time=' + this.roll_stamp + '&os=web&refresh_type=1&rn=20&sv=8.4.6'
        var fUrl = emjyBack.fha.server + 'fwd/clscn/v1/roll/get_roll_list?' + param + '&sign=' + emjyBack.md5(emjyBack.hash(param));
        fetch(fUrl).then(r=>{
            if (r.headers.get('Content-Type').includes('application/json')) {
                return r.json();
            } else {
                return r.text();
            }
        }).then(rl => {
            if (typeof(cb) === 'function') {
                if (!rl.data) {
                    this.requestError(fUrl, cb);
                    return;
                }
                cb(rl);
            }
        });
    }

    getUpdatedTimestamp() {
        if (this.latest_stamp) {
            return this.latest_stamp;
        }
        return (new Date().getTime() / 1000).toFixed();
    }

    latestTimeStamp() {
        if (Object.keys(this.allClsTelegraphs).length > 0) {
            return Math.max(...Object.values(this.allClsTelegraphs).map(t => t.ctime));
        }
    }

    refreshTelegraph(cb) {
        var stamp = this.getUpdatedTimestamp();
        var param = 'app=CailianpressWeb&lastTime=' + stamp + '&os=web&sv=8.4.6';
        var fUrl = emjyBack.fha.server + 'fwd/clscn/nodeapi/refreshTelegraphList?' + param + '&sign=' + emjyBack.md5(emjyBack.hash(param));
        fetch(fUrl).then(r=>{
            if (r.headers.get('Content-Type').includes('application/json')) {
                return r.json();
            } else {
                return r.text();
            }
        }).then(tl => {
            if (!tl.l) {
                this.requestError(fUrl);
                return;
            }
            if (typeof(cb) === 'function') {
                cb(tl);
            }
        });
    }

    updateTelegraphList(cb) {
        var stamp = this.getUpdatedTimestamp();
        var param = 'app=CailianpressWeb&category=red&hasFirstVipArticle=0&lastTime=' + stamp + '&os=web&rn=20&subscribedColumnIds=&sv=8.4.6'
        var fUrl = emjyBack.fha.server + 'fwd/clscn/nodeapi/updateTelegraphList?' + param + '&sign=' + emjyBack.md5(emjyBack.hash(param))
        fetch(fUrl).then(r=>{
            if (r.headers.get('Content-Type').includes('application/json')) {
                return r.json();
            } else {
                return r.text();
            }
        }).then(tl => {
            if (!tl.data) {
                this.requestError(fUrl);
                return;
            }
            if (typeof(cb) === 'function') {
                cb(tl);
            }
        });
    }

    onNewRollList(rl) {
        let roll_data = rl.data.roll_data.reverse();
        if (roll_data.length > 0) {
            this.roll_stamp = roll_data[0].ctime;
        }
        roll_data.forEach(d => {
            this.allClsTelegraphs[d.id] = d;
        });
        this.setUnreadCount();
        if (!this.latest_stamp || this.roll_stamp <= this.latest_stamp) {
            this.latest_stamp = this.latestTimeStamp();
            return;
        }
        this.getRollList(t => this.onNewRollList(t));
    }

    onRefreshResponse(ail) {
        for (const ct in ail.l) {
            if (!ail.l[ct].content && !ail.l[ct].brief) {
                continue;
            }
            var otel = this.allClsTelegraphs[ct];
            if (!otel) {
                this.allClsTelegraphs[ct] = ail.l[ct];
                continue;
            }

            for (const k in ail.l[ct]) {
                otel[k] = ail.l[ct][k];
            }
        }
        this.setUnreadCount();
    }

    addUnreadTelegraphs(roll_data) {
        roll_data.forEach(d => {
            if (!this.allClsTelegraphs[d.id]) {
                this.allClsTelegraphs[d.id] = d;
            }
        });
        if (roll_data.length > 0) {
            this.latest_stamp = this.latestTimeStamp();
        }
        this.setUnreadCount();
    }

    onUpateResponse(udata) {
        this.addUnreadTelegraphs(udata.data.roll_data);
        this.addUnreadTelegraphs(udata.vipData);
    }

    requestError(eurl, cb) {
        if (!this.errors) {
            this.errors = [];
        }
        if (typeof(cb) === 'function') {
            this.rootPanel.querySelector('#error_lnk').href = eurl;
            this.rootPanel.querySelector('#error_lnk_block').style.display = 'block';
            this.rootPanel.querySelector('#submit').onclick = () => {
                let vresult = this.rootPanel.querySelector('#manual_request_result').value;
                cb(JSON.parse(vresult));
                this.rootPanel.querySelector('#manual_request_result').value = '';
                this.rootPanel.querySelector('#error_lnk_block').style.display = 'none';
            }
        }
    }
}


class EmPopularity extends LeftColumnBarItem {
    constructor(parent) {
        super(parent);
    }

    createIcon(parent) {
        parent.innerHTML = `
        <div style="font-size: 2em" title="人气榜">🕵️‍♀️</div>
        `;
    }

    createToolbars() {
        this.rootPanel.innerHTML = `
        <div>
            <a href="http://guba.eastmoney.com/rank/" target="_blank">人气榜</a>
            上次更新：<span id="refresh_label"></span>
            <button id="refresh" title="刷新">🔄</button>
            <a href="https://xuangu.eastmoney.com/" target="_blank">选股器</a>
            <br />
            <input id="r_show_main" name="rmarket" type="radio" style="margin: 0;" checked="true"> <label for="r_show_main">全部</label> 
            <input id="r_show_cy" name="rmarket" type="radio" style="margin: 0;"> <label for="r_show_cy">创业</label> 
            <input id="r_show_kc" name="rmarket" type="radio" style="margin: 0;"> <label for="r_show_kc">科创</label> 
            <input id="r_show_bj" name="rmarket" type="radio" style="margin: 0;"> <label for="r_show_bj">北交</label>
            <input id="r_show_st" name="rmarket" type="radio" style="margin: 0;"> <label for="r_show_st">ST</label>
            <input id="r_show_zlead" name="rmarket" type="radio" style="margin: 0;"> <label for="r_show_zlead">高标</label>
        </div>
        <div style="overflow: auto; height: 92%; overscroll-behavior: contain;">
            <div id="popularity_list"></div>
        </div>
        `
        this.rootPanel.querySelector('#r_show_main').onclick = () => {
            this.mktfilter = 'main';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#r_show_cy').onclick = () => {
            this.mktfilter = 'cy';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#r_show_kc').onclick = () => {
            this.mktfilter = 'kc';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#r_show_bj').onclick = () => {
            this.mktfilter = 'bj';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#r_show_st').onclick = () => {
            this.mktfilter = 'st';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#r_show_zlead').onclick = () => {
            this.mktfilter = 'zlead';
            this.showRootPanel();
        }
        this.rootPanel.querySelector('#refresh').onclick = () => {
            this.getPopularity(() => {
                this.showPopularity();
            });
        }
    }

    showRootPanel() {
        if (!this.popularityList) {
            this.getPopularity(() => {
                this.showPopularity();
            });
            return;
        }
        this.showPopularity();
    }

    getPopularity(cb) {
        var fUrl = emjyBack.fha.server + 'fwd/emwebselectiondata/get?type=RPTA_PCNEW_STOCKSELECT&sty=SECURITY_CODE,SECURITY_NAME_ABBR,POPULARITY_RANK,NEWFANS_RATIO&filter=(POPULARITY_RANK>0)(POPULARITY_RANK<=1000)(NEWFANS_RATIO>=0.00)(NEWFANS_RATIO<=100.0)&p=1&ps=1000&st=POPULARITY_RANK&sr=1&source=SELECT_SECURITIES&client=WEB';
        fetch(fUrl).then(r=>{
            if (r.headers.get('Content-Type').includes('application/json')) {
                return r.json();
            } else {
                try {
                    return r.text().then(t => JSON.parse(t));
                } catch (e) {
                    throw new Error("cannot parse");
                }
            }
        }).then(rl => {
            if (!rl.result) {
                console.log('Error: ', rl);
            }
            this.popularityList = rl.result.data;
            this.rootPanel.querySelector('#refresh_label').textContent = emjyBack.timeString(new Date());
            if (typeof(cb) === 'function') {
                cb();
            }
        });
    }

    showPopularity() {
        const plist = this.rootPanel.querySelector('#popularity_list');
        plist.innerHTML = 
        `<div style="display:flex; text-align: center">
            <div style="width: 60px" >排名</div>
            <div style="width: 85px" >个股名称</div>
            <div style="width: 80px" >新晋粉丝</div>
        </div>`;
        var slist = this.popularityList;
        if (this.mktfilter == 'bj') {
            slist = this.popularityList.filter(p => p.SECUCODE.endsWith('BJ'));
        } else if (this.mktfilter == 'cy') {
            slist = this.popularityList.filter(p => p.SECURITY_CODE.startsWith('30'));
        } else if (this.mktfilter == 'kc') {
            slist = this.popularityList.filter(p => p.SECURITY_CODE.startsWith('68'));
        } else if (this.mktfilter == 'st') {
            slist = this.popularityList.filter(p => p.SECURITY_NAME_ABBR.includes('ST'));
        } else if (this.mktfilter == 'zlead') {
            let zleads = [];
            for (const i of Object.keys(emjyBack.recent_zt_map).reverse()) {
                if (emjyBack.recent_zt_map[i].length > zleads.length && zleads.length >= 8) break;
                emjyBack.recent_zt_map[i].forEach(z => {
                    zleads.push(z[0]);
                });
                if (zleads.length >= 10) break;
            }
            slist = this.popularityList.filter(p => zleads.includes(guang.convertToSecu(p.SECURITY_CODE)));
        }
        if (slist.length > 60) {
            slist = slist.slice(0, 60);
        }
        if (slist.length == 0) {
            plist.appendChild(document.createTextNode('暂无数据!'));
            return;
        }

        plist.appendChild(document.createElement('hr'));
        feng.getStockBasics(slist.map(p => guang.convertToSecu(p.SECURITY_CODE))).then(() => {
            let k = 0;
            slist.forEach(p => {
                const srow = document.createElement('div');
                srow.style.display = 'flex';
                srow.style.textAlign = 'center';
                let code = guang.convertToSecu(p.SECURITY_CODE);
                const rk = document.createElement('div');
                rk.style.width = '60px';
                rk.style.margin = '5px 0';
                rk.innerHTML = `<a target="_blank" href="http://guba.eastmoney.com/rank/stock?code=${p.SECURITY_CODE}">${p.POPULARITY_RANK}</a>`
                srow.appendChild(rk);

                const s = new SecuCard(code);
                const stk = document.createElement('div');
                stk.style.width = '85px';
                stk.appendChild(s.render())
                srow.appendChild(stk);

                const fs = document.createElement('div');
                if (p.NEWFANS_RATIO - 70 > 0) {
                    fs.style.color = '#de0422';
                } else if (p.NEWFANS_RATIO - 50 < 0) {
                    fs.style.color = '#aaa';
                }
                fs.style.width = '80px';
                fs.style.margin = '5px 0';
                fs.textContent = p.NEWFANS_RATIO + '%';
                srow.appendChild(fs);
                plist.appendChild(srow);
                k += 1;
                if (k % 5 == 0) {
                    plist.appendChild(document.createElement('hr'));
                }
            });
        });
    }
}


window.onload = e => {
    feng.checkClsWorks()
        .then(() => guang.isTodayTradingDay())
        .then(isTradingDay => {
            emjyBack.is_trading_day = isTradingDay;
            return guang.getLastTradeDate();
        })
        .then(lastTradeDate => {
            emjyBack.last_traded_date = lastTradeDate;
            emjyBack.home = new DailyHome();
            emjyBack.home.initUi();
        });
};
