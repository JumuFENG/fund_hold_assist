'use strict';

class Chart {
    constructor(title = '') {
        this.container = document.createElement('div');
        this.container.style = 'display: table; width: 100%; height: 100%;';
        this.titleBar = document.createElement('div');
        this.titleBar.style = 'display: table-row; text-align: center;';
        this.titleBar.appendChild(document.createTextNode(title));
        this.container.appendChild(this.titleBar);
        var center = document.createElement('div');
        this.container.appendChild(center);
        center.style = 'display: flex; flex-direction: row; height: 100%;';
        this.leftPanel = document.createElement('div');
        this.leftPanel.style.width = '20px';
        center.appendChild(this.leftPanel);
        this.corePanel = document.createElement('div');
        this.corePanel.style = 'width: 100%; height: 100%;';
        center.appendChild(this.corePanel);
        this.rightPanel = document.createElement('div');
        this.rightPanel.style.width = '20px';
        center.appendChild(this.rightPanel);
        this.footBar = document.createElement('div');
        this.footBar.style = 'display: table-row; height: 20px;';
        this.container.appendChild(this.footBar);
    }

    init() {
    }

    strokeLine(x1, y1, x2, y2) {
    }

    fillPoint(x, y) {
    }

    fillRect(x, y, w, h) {
    }

    strokeRect(x, y, w, h) {
    }

    strokeWidth(w) {
    }

    fillStyle(clr) {
    }

    strokeStyle(clr) {
    }
}

class KlChart extends Chart {
    constructor(title = '') {
        super(title);
    }

    drawKlines(data) {
        if (!this.canvas) {
            this.init();
        }

        this.stickWidth = this.chartWidth / (1.2 * data.length);
        this.dist = this.stickWidth * 0.2;
        if (this.stickWidth < 5) {
            this.stickWidth = (this.chartWidth - data.length) / data.length;
            this.dist = 1;
        }
        if (this.stickWidth == 1) {
            this.dist = 0;
        }

        var dm = data[0].l;
        var dmx = data[0].h;
        var vmx = data[0].v;
        var vSum = 0;
        for (let i = 0; i < data.length; i++) {
            const kl = data[i];
            if (dm - kl.l > 0) {
                dm = kl.l;
            }
            if (dmx - kl.h < 0) {
                dmx = kl.h;
            }
            if (vmx - kl.v < 0) {
                vmx = kl.v;
            }
            vSum -= kl.v;
        }
        if (vSum < 0) {
            vSum = -vSum;
        }

        this.volRef = vSum / data.length;
        this.volscale = this.volHeight * 0.35 / this.volRef;

        this.klscale = this.klHeight / (dmx - dm);
        this.kloffset = dm;

        for (let i = 0; i < data.length; i++) {
            const kl = data[i];
            var o = (this.klHeight - this.klscale * (kl.o - dm));
            var c = (this.klHeight - this.klscale * (kl.c - dm));
            var h = (this.klHeight - this.klscale * (kl.h - dm));
            var l = (this.klHeight - this.klscale * (kl.l - dm));
            var x = (this.stickWidth + this.dist) * i;
            var och = o;
            var ocl = c;
            if (kl.c == kl.o) {
                if (i > 0 && kl.c - data[i - 1].c < 0) {
                    this.fillStyle('green');
                    this.strokeStyle('green');
                } else {
                    this.fillStyle('red');
                    this.strokeStyle('red');
                }
            } else {
                if (kl.c - kl.o > 0) {
                    this.fillStyle('red');
                    this.strokeStyle('red');
                    och = c;
                    ocl = o;
                    this.strokeRect(x, och, this.stickWidth, ocl - och);
                } else {
                    this.fillStyle('green');
                    this.strokeStyle('green');
                    this.fillRect(x, och, this.stickWidth, ocl - och);
                }
            }

            if (kl.c == kl.o) {
                this.strokeLine(x, och, x + this.stickWidth, och);
            }
            var xmid = x + this.stickWidth / 2;
            this.strokeLine(xmid, h, xmid, och);
            this.strokeLine(xmid, ocl, xmid, l);

            var vHt = (this.volscale * kl.v);
            this.fillRect(x, this.chartHeight - vHt, this.stickWidth, vHt);
        }

        var points = [];
        for (let i = 0; i < data.length; i++) {
            const kl = data[i];
            var x = (this.stickWidth + this.dist) * i;
            var y = (this.klHeight - this.klscale * (kl.ma18 - dm));
            points.push([x, y]);
        }
        this.strokeStyle('deeppink');
        this.strokePolyLine(points);
    }
}

class KlChartCanvas extends KlChart {
    constructor(title = 'Test') {
        super(title);
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.style = 'width: 100%; height: 100%;';
        this.corePanel.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.volHeight = this.canvas.height / 3;
        this.klHeight = this.canvas.height - this.volHeight;
        this.chartWidth = this.canvas.width;
        this.chartHeight = this.canvas.height;
    }

    strokeWidth(w) {
        this.ctx.lineWidth = w;
    }

    fillStyle(clr) {
        this.ctx.fillStyle = clr;
    }

    strokeStyle(clr) {
        this.ctx.strokeStyle = clr;
    }

    strokeLine(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(parseInt(x1) + 0.5, parseInt(y1) + 0.5);
        this.ctx.lineTo(parseInt(x2) + 0.5, parseInt(y2) + 0.5);
        this.ctx.stroke();
    }

    fillRect(x, y, w, h) {
        this.ctx.fillRect(x, y, w, h);
    }

    strokeRect(x, y, w, h) {
        this.ctx.strokeRect(parseInt(x), parseInt(y), parseInt(w), parseInt(h));
    }

    strokePolyLine(pts) {
        this.ctx.beginPath();
        this.ctx.moveTo(parseInt(pts[0][0]), parseInt(pts[0][1]));
        for (let i = 1; i < pts.length; i++) {
            this.ctx.lineTo(parseInt(pts[i][0]), parseInt(pts[i][1]));
        }
        this.ctx.stroke();
    }
}

class ChartSvg extends Chart {
    strokeWidth(w) {
        this.lineWidth = w;
    }

    fillStyle(clr) {
        this.fillColor = clr;
    }

    strokeStyle(clr) {
        this.strokeColor = clr;
    }

    strokeLine(x1, y1, x2, y2) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('style', 'stroke:' + this.strokeColor + ';stroke-width:' + this.lineWidth);
        this.canvas.appendChild(line);
    }

    fillPoint(x, y) {
        var pt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pt.setAttribute('cx', x);
        pt.setAttribute('cy', y);
        pt.setAttribute('r', this.r);
        pt.setAttribute('fill', this.fillColor);
        this.canvas.appendChild(pt);
    }

    fillRect(x, y, w, h) {
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('style', 'fill:' + this.fillColor + ';');
        this.canvas.appendChild(rect);
    }

    strokeRect(x, y, w, h) {
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('style', 'fill:none; stroke:' + this.strokeColor+ ';stroke-width:' + this.lineWidth + ';');
        this.canvas.appendChild(rect);
    }

    strokePolyLine(pts) {
        var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        var points = [];
        pts.forEach(pt => {
            points.push('' + pt[0] + ',' +pt[1]);
        });
        polyline.setAttribute('points', points.join(' '));
        polyline.setAttribute('style', 'fill:none; stroke:' + this.strokeColor +'; stroke-width:' + this.lineWidth + ';');
        this.canvas.appendChild(polyline);
    }
}

class KlChartSvg extends KlChart {
    constructor(title = '') {
        super(title);
    }

    init() {
        this.canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.canvas.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        this.canvas.style = 'width: 100%; height: 100%;';
        this.corePanel.appendChild(this.canvas);
        this.lineWidth = 1;
        this.chartWidth = this.corePanel.clientWidth;
        this.chartHeight = this.corePanel.clientHeight;
        this.volHeight = this.chartHeight / 3;
        this.klHeight = this.chartHeight - this.volHeight;
    }

    strokeWidth(w) {
        this.lineWidth = w;
    }

    fillStyle(clr) {
        this.fillColor = clr;
    }

    strokeStyle(clr) {
        this.strokeColor = clr;
    }

    strokeLine(x1, y1, x2, y2) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('style', 'stroke:' + this.strokeColor + ';stroke-width:' + this.lineWidth);
        this.canvas.appendChild(line);
    }

    fillRect(x, y, w, h) {
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('style', 'fill:' + this.fillColor + ';');
        this.canvas.appendChild(rect);
    }

    strokeRect(x, y, w, h) {
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('style', 'fill:none; stroke:' + this.strokeColor+ ';stroke-width:' + this.lineWidth + ';');
        this.canvas.appendChild(rect);
    }

    strokePolyLine(pts) {
        var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        var points = [];
        pts.forEach(pt => {
            points.push('' + pt[0] + ',' +pt[1]);
        });
        polyline.setAttribute('points', points.join(' '));
        polyline.setAttribute('style', 'fill:none; stroke:' + this.strokeColor +'; stroke-width:' + this.lineWidth + ';');
        this.canvas.appendChild(polyline);
    }
}

class ScatterChart extends ChartSvg {
    constructor(title = '') {
        super(title);
    }

    init() {
        this.canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.canvas.style = 'width: 100%; height: 100%;';
        this.corePanel.appendChild(this.canvas);
        this.lineWidth = 1;
        this.chartWidth = this.corePanel.clientWidth;
        this.chartHeight = this.corePanel.clientHeight;
        this.r = (this.chartWidth / 100).toFixed();
        this.fillColor = 'red';
        this.strokeColor = 'black';
    }

    drawPoints(data) {
        if (!this.canvas) {
            this.init();
        }

        this.r = (this.chartWidth / data.length).toFixed();
        if (this.r == 0) {
            this.r = 2;
        }
        var xm = data[0][0];
        var xmx = data[0][0];
        var ym = data[0][1];
        var ymx = data[0][1];
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            if (d[0] - xm < 0) {
                xm = d[0];
            } else if (d[0] - xmx > 0) {
                xmx = d[0];
            }
            if (d[1] - ym < 0) {
                ym = d[1];
            } else if (d[1] - ymx > 0) {
                ymx = d[1];
            }
        }
        ym -= 1;
        ymx -= -1;
        xm -= 1;
        xmx -= -1;
        this.xscale = this.chartWidth / (xmx - xm);
        this.yscale = this.chartHeight / (ymx - ym);
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            this.fillPoint(this.xscale * (d[0] - xm), this.chartHeight - this.yscale * (d[1] - ym));
        }

        this.strokeRect(0, 0, this.chartWidth, this.chartHeight);
        this.strokeLine(0, this.chartHeight + this.yscale * ym, this.chartWidth, this.chartHeight + this.yscale * ym);
        this.strokeLine(0, this.chartHeight - this.yscale * (xm - ym), this.xscale * (xmx - xm), this.chartHeight - this.yscale * (xmx - ym));
        this.strokeLine(0, this.chartHeight + this.yscale * (xm + ym), this.xscale * (xmx - xm), this.chartHeight - this.yscale * (- xmx - ym));
    }
}
