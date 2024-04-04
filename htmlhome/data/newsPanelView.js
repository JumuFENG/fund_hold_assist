'use strict';

class NewsPages extends RadioAnchorPage {
    constructor() {
        super('新闻');
    }

    show() {
        super.show();
        if (!this.newsRoot || this.newsRoot.childElementCount == 0) {
            this.initNewsPanel();
        }
    }

    initNewsPanel() {
        this.newsRoot = document.createElement('div');
        this.container.appendChild(this.newsRoot);
        this.getEmHomePage();
    }

    getEmHomePage() {
        if (!emjyBack.fha || !emjyBack.fha.server) {
            return;
        }
        var newsUrl = emjyBack.fha.server + 'api/get?url=' + btoa('https://www.eastmoney.com/')+ '&host=www.eastmoney.com';
        utils.get(newsUrl, null, ns => {
            utils.removeAllChild(this.newsRoot);
            this.showAllNews(ns);
        });
    }

    createLink(href, text) {
        var lk = document.createElement('a');
        lk.target = '_blank';
        lk.href = href;
        lk.textContent = text ? text : href;
        return lk;
    }

    showAllNews(nhtml) {
        var ele = document.createElement('html');
        ele.innerHTML = nhtml;
        var createLink = this.createLink;
        var newsFilters = {
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
                return hnv;
            },
            'cjdd_l': function(e) {
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
            'hsgs_news': function(e) {
                var hsgs = document.createElement('div');
                hsgs.style.float = 'left';
                var lk = createLink('http://stock.eastmoney.com/', '股市焦点');
                hsgs.appendChild(lk);
                hsgs.appendChild(e.querySelector('.nlist'));
                return hsgs;
            }
        };
        var pick_news_l2_img_links = function(img_div) {
            var ul = document.createElement('ul');
            var ztimglks = img_div.querySelectorAll('div.news_l2_img_i>div>a.tip-text');
            for (const a of ztimglks) {
                var lkli = document.createElement('li');
                lkli.appendChild(a);
                ul.appendChild(lkli);
            }
            var ztlks_ir = img_div.querySelectorAll('div.news_l2_img_ir>ul>li');
            for (const l of ztlks_ir) {
                ul.appendChild(l);
            }
            var ztlks_l = img_div.querySelectorAll('div.news_l2_img_l>ul>li');
            for (const l of ztlks_l) {
                ul.appendChild(l);
            }
            return ul;
        }
        var newsMoreFilters = {
            '社区': function(e) {
                var sjview = document.createElement('div');
                sjview.style.float = 'left';
                var lk = createLink('http://guba.eastmoney.com/', '社区');
                sjview.appendChild(lk);
                sjview.appendChild(e.querySelectorAll('div.m3m>div.news_l2.bw.mmt')[0].querySelector('.nlist'));
                return sjview;
            },
            '全球': function(e) {
                var qqview = document.createElement('div');
                qqview.style.float = 'left';
                var lk = createLink('http://stock.eastmoney.com/global.html', '全球');
                qqview.appendChild(lk);
                qqview.appendChild(e.querySelectorAll('div.m3m>div.news_l2.bw.mmt')[1].querySelector('.nlist'));
                return qqview;
            },
            '数据': function(e) {
                var gsjj = document.createElement('div');
                gsjj.style.float = 'left';
                var lk = createLink('https://data.eastmoney.com/center/', '数据');
                gsjj.appendChild(lk);
                gsjj.appendChild(e.querySelectorAll('div.m3r>div.news_l2.bw.mmt')[0].querySelector('.nlist'));
                return gsjj
            },
            '观点': function(e) {
                var gdpl = document.createElement('div');
                gdpl.style.float = 'left';
                var lk = createLink('http://finance.eastmoney.com/pinglun.html', '观点');
                gdpl.appendChild(lk);
                gdpl.appendChild(e.querySelectorAll('div.m3r>div.news_l2.bw.mmt')[1].querySelector('.nlist'));
                return gdpl
            },
            '直播': function(e) {
                var zbview = document.createElement('div');
                zbview.style.float = 'left';
                var lk = createLink('https://roadshow.eastmoney.com/', '直播');
                zbview.appendChild(lk);
                zbview.appendChild(pick_news_l2_img_links(e.querySelector('div.m3m>div.news_l2_img.bw.mmt')));
                return zbview;
            },
            '专题': function(e) {
                var ztview = document.createElement('div');
                ztview.style.float = 'left';
                var lk = createLink('http://topic.eastmoney.com/', '专题');
                ztview.appendChild(lk);
                ztview.appendChild(pick_news_l2_img_links(e.querySelector('div.m3r>div.news_l2_img.bw.mmt')));
                return ztview;
            }
        }
        for (const c in newsFilters) {
            this.newsRoot.appendChild(this.setTarget(newsFilters[c](ele.querySelector('.'+c))));
        }
        this.articalPanel = document.createElement('div');
        this.newsRoot.appendChild(this.articalPanel);
        for (const c in newsMoreFilters) {
            this.newsRoot.appendChild(this.setTarget(newsMoreFilters[c](ele)));
        }
    }

    setTarget(ele) {
        var lks = ele.querySelectorAll('a');
        for (var lk of lks) {
            if (lk.href.includes('finance.eastmoney.com/a')) {
                lk.onclick = e => {
                    var anchor = e.target;
                    if (e.target.tagName != 'A') {
                        anchor = e.target.parentElement;
                    }
                    if (!anchor.href) {
                        console.log(e.target);
                    }
                    this.getEmArticle(anchor.href);
                    return false;
                }
            } else {
                lk.target = '_blank';
            }
            if (lk.textContent.length > 30) {
                lk.style.display = 'block';
                lk.style.maxWidth = 400;
            }
        }
        return ele;
    }

    getEmArticle(emhref) {
        if (this.fetchedArticals && this.fetchedArticals[emhref]) {
            this.showEmArticle(emhref, this.fetchedArticals[emhref]);
            return;
        }
        if (!emjyBack.fha || !emjyBack.fha.server) {
            return;
        }
        var url = emjyBack.fha.server + 'api/get?url=' + btoa(emhref) + '&host=finance.eastmoney.com&referer=https://www.eastmoney.com/';
        utils.get(url, null, arhtml => {
            if (!this.fetchedArticals) {
                this.fetchedArticals = {};
            }
            this.fetchedArticals[emhref] = arhtml;
            this.showEmArticle(emhref, arhtml);
        });
    }

    showEmArticle(href, arhtml) {
        utils.removeAllChild(this.articalPanel);
        var ele = document.createElement('html');
        ele.innerHTML = arhtml;
        var closeLk = document.createElement('a');
        closeLk.textContent = 'X';
        closeLk.href = 'javascript:void(0)';
        closeLk.style.float = 'right';
        closeLk.style.border = 'solid 1px';
        closeLk.style.textDecoration = 'none';
        closeLk.onclick = e => {
            utils.removeAllChild(this.articalPanel);
        }
        this.articalPanel.appendChild(closeLk);
        this.articalPanel.appendChild(this.createLink(href, '原文'));
        this.commntLink = this.createLink('', '看评论');
        this.getArticleComments(href);
        this.articalPanel.appendChild(this.commntLink);
        var vtitle = ele.querySelector('div.title')
        vtitle.style.fontSize = 'x-large';
        vtitle.style.fontWeight = 'bold';
        this.articalPanel.appendChild(vtitle);
        var cbody = ele.querySelector('#ContentBody');
        var child = cbody.firstElementChild;
        while (child) {
            if (child.tagName == 'P') {
                if (child.className || !child.textContent || child.textContent.includes('APP内免费看>>')) {
                    var next = child.nextElementSibling;
                    cbody.removeChild(child);
                    child = next;
                    continue
                }
            }
            child = child.nextElementSibling;
        }
        this.articalPanel.appendChild(cbody);
    }

    getArticleComments(href) {
        if (this.fetchedBriefInfo && this.fetchedBriefInfo[href]) {
            this.setComments(href);
            return;
        }

        var artId = href.split('/').pop();
        artId = artId.split('.')[0];
        var brfInfoUrl = 'https://gbapi.eastmoney.com/abstract/api/PostShort/NewsArticleBriefInfo?postid=' + artId + '&type=1&version=80008000&product=guba&plat=web&deviceid=0d2798cab1716439a343c9965c20c59d&ctoken=null&utoken=null';
        var url = emjyBack.fha.server + 'api/get?url=' + btoa(brfInfoUrl) + '&host=gbapi.eastmoney.com&referer=' + href;
        utils.get(url, null, scmt => {
            if (!this.fetchedBriefInfo) {
                this.fetchedBriefInfo = {};
            }
            var jcmt = JSON.parse(scmt);
            if (jcmt.rc != 1) {
                return;
            }
            this.fetchedBriefInfo[href] = jcmt;
            this.setComments(href);
        });
    }

    setComments(href) {
        var brfInfo = this.fetchedBriefInfo[href];
        var binfo = brfInfo.re[0];
        var pid = binfo.post_id;
        var barid = binfo.stockbar_code;
        var cmt_count = binfo.post_comment_count;
        var href = 'https://guba.eastmoney.com/news,' + barid + ',' + pid + '.html';
        this.commntLink.href = href;
        this.commntLink.referrerPolicy = 'no-referrer';
        this.commntLink.textContent = '看评论 (' + cmt_count + ')';
    }
}
