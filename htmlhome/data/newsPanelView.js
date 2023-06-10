'use strict';

class NewsPages extends RadioAnchorPage {
    constructor() {
        super('新闻');
    }

    show() {
        super.show();
        if (!this.newsRoot) {
            this.initNewsPanel();
        }
    }

    initNewsPanel() {
        this.newsRoot = document.createElement('div');
        // this.newsRoot.style = 'display: flex; flex-direction: row; height: 100%;';
        this.container.appendChild(this.newsRoot);
        this.getEmHomePage();
    }

    getEmHomePage() {
        var newsUrl = emjyBack.fha.server + 'api/get?url=' + encodeURI('https://www.eastmoney.com/');
        utils.get(newsUrl, null, ns => {
            this.showAllNews(ns);
        });
    }

    showAllNews(nhtml) {
        var ele = document.createElement('html');
        ele.innerHTML = nhtml;
        var createLink = function(href, text) {
            var lk = document.createElement('a');
            lk.target = '_blank';
            lk.href = href;
            lk.textContent = text ? text : href;
            return lk;
        }
        var newsfilters = {
            'head-news': function(e) {
                var hnv = document.createElement('div');
                hnv.style.display = 'flex';
                hnv.style.alignItems = 'center';
                var nbx = e.querySelector('.nmlist');
                var h1 = nbx.querySelector('h1');
                var h2 = nbx.querySelector('h2');
                var lis = nbx.querySelectorAll('li');
                var nmlst = document.createElement('div');
                nmlst.appendChild(h1);
                nmlst.appendChild(h2);
                for(const li of lis) {
                    if (li.innerHTML.includes('pub/web_dfcfsy_wzl')) {
                        continue;
                    }
                    nmlst.appendChild(li);
                }
                hnv.appendChild(nmlst);

                var hs = e.querySelector('#snlist').querySelectorAll('a');
                var ul = document.createElement('ul');
                for(const ha of hs) {
                    var li = document.createElement('li');
                    li.appendChild(ha);
                    ul.appendChild(li);
                }
                hnv.appendChild(ul);
                return hnv;
            },
            'cjdd-view': function(e) {
                var cjdd = document.createElement('div');
                cjdd.style.float = 'right';
                var lk = createLink('http://finance.eastmoney.com/','财经导读');
                var hdr = document.createElement('h3');
                hdr.style.marginLeft = 150;
                hdr.appendChild(lk);
                cjdd.appendChild(hdr);
                var uls = e.querySelectorAll('ul');
                for (const ul of uls) {
                    if (ul.innerHTML.includes('pub/web_dfcfsy_wzl')) {
                        continue;
                    }
                    cjdd.appendChild(ul);
                }
                return cjdd;
            },
            'hsgs-news': function(e) {
                var hsgs = document.createElement('div');
                var lk = createLink('http://stock.eastmoney.com/', '股市焦点');
                hsgs.appendChild(lk);
                hsgs.appendChild(e.querySelector('.nlist'));
                return hsgs;
            },
            'sj-view': function(e) {
                var sjview = document.createElement('div');
                var lk = createLink('http://guba.eastmoney.com/', '社区');
                sjview.appendChild(lk);
                sjview.appendChild(e.querySelector('.nlist'));
                return sjview;
            },
            'qqsc-view': function(e) {
                var qqview = document.createElement('div');
                var lk = createLink('http://stock.eastmoney.com/global.html', '全球');
                qqview.appendChild(lk);
                qqview.appendChild(e.querySelector('.nlist'));
                return qqview;
            },
            'gsjj-view': function(e) {
                var gsjj = document.createElement('div');
                var lk = createLink('https://data.eastmoney.com/center/', '数据');
                gsjj.appendChild(lk);
                gsjj.appendChild(e.querySelector('.nlist'));
                return gsjj
            },
            'gdpl-view': function(e) {
                var gdpl = document.createElement('div');
                var lk = createLink('http://finance.eastmoney.com/pinglun.html', '观点');
                gdpl.appendChild(lk);
                gdpl.appendChild(e.querySelector('.nlist'));
                return gdpl
            },
            'zt-view': function(e) {
                var ztview = document.createElement('div');
                var lk = createLink('http://topic.eastmoney.com/', '专题');
                var btm = e.querySelector('.bottom-list');
                var ztlks = btm.querySelectorAll('li');
                ztview.appendChild(lk);
                var ul = document.createElement('ul');
                var ztimglks = e.querySelectorAll('a.tip-text');
                for (const a of ztimglks) {
                    var lkli = document.createElement('li');
                    lkli.appendChild(a);
                    ul.appendChild(lkli);
                }
                for (const l of ztlks) {
                    ul.appendChild(l);
                }
                ztview.appendChild(ul);
                return ztview;
            }
        }
        var setTarget = function(ele) {
            var lks = ele.querySelectorAll('a');
            for (var lk of lks) {
                lk.target = '_blank';
            }
            return ele;
        }
        for (const c in newsfilters) {
            this.newsRoot.appendChild(setTarget(newsfilters[c](ele.querySelector('.'+c))))
        }
    }
}
