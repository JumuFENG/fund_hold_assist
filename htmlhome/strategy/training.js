'use strict';

class TrainingPanelPage extends RadioAnchorPage {
    constructor() {
        super('策略调优');
    }

    show() {
        super.show();
        this.container.style.display = 'flex';
        if (!this.topPanel) {
            this.initTrainingView();
        }
    }

    initTrainingView() {
        this.topPanel = document.createElement('div');
        this.container.appendChild(this.topPanel);
    }
}