'use strict';

class KlChart {
    constructor(title = 'Test') {
        this.container = document.createElement('div');
        this.container.style = 'display: flex; flex-direction: column; width: 100%;';
        this.titleBar = document.createElement('div');
        this.titleBar.style.textAlign = 'center';
        this.titleBar.appendChild(document.createTextNode(title));
        this.container.appendChild(this.titleBar);
        var center = document.createElement('div');
        this.container.appendChild(center);
        center.style = 'display: flex; flex-direction: row; height: 100%;';
        this.leftPanel = document.createElement('div');
        this.leftPanel.style.width = '20px';
        center.appendChild(this.leftPanel);
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        center.appendChild(this.canvas);
        this.rightPanel = document.createElement('div');
        this.rightPanel.style.width = '20px';
        center.appendChild(this.rightPanel);
        this.footBar = document.createElement('div');
        this.footBar.style.height = '20px';
        this.container.appendChild(this.footBar);
        this.ctx = this.canvas.getContext('2d');
        this.volHeight = this.canvas.height / 3;
        this.klHeight = this.canvas.height - this.volHeight;
        this.chartWidth = this.canvas.width;
    }

    drawKlines(data) {
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
            if (dm > kl.l) {
                dm = kl.l;
            }
            if (dmx < kl.h) {
                dmx = kl.h;
            }
            if (vmx < kl.v) {
                vmx = kl.v;
            }
            vSum -= kl.v;
        }
        if (vSum < 0) {
            vSum = -vSum;
        }

        this.volRef = vSum / data.length;
        this.volscale = this.volHeight * 0.5 / this.volRef;

        this.klscale = this.klHeight / (dmx - dm);
        this.kloffset = dm;
        for (let i = 0; i < data.length; i++) {
            const kl = data[i];
            var o = this.klHeight - this.klscale * (kl.o - dm);
            var c = this.klHeight - this.klscale * (kl.c - dm);
            var h = this.klHeight - this.klscale * (kl.h - dm);
            var l = this.klHeight - this.klscale * (kl.l - dm);
            var x = (this.stickWidth + this.dist) * i;
            var och = o;
            var ocl = c;
            if (kl.c > kl.o) {
                this.ctx.fillStyle = 'red';
                this.ctx.strokeStyle = 'red';
                och = c;
                ocl = o;
            } else {
                this.ctx.fillStyle = 'green';
                this.ctx.strokeStyle = 'green';
            }

            this.ctx.fillRect(x, och, this.stickWidth, ocl - och);
            var xmid = x + this.stickWidth / 2;
            if (h < och) {
                this.ctx.moveTo(xmid, h);
                this.ctx.lineTo(xmid, och);
                this.ctx.stroke();
            }
            if (l > ocl) {
                this.ctx.moveTo(xmid, ocl);
                this.ctx.lineTo(xmid, l);
                this.ctx.stroke();
            }

            var vHt = this.volscale * kl.v;
            this.ctx.fillRect(x, this.canvas.height - vHt, this.stickWidth, vHt);
        }
    }
}
