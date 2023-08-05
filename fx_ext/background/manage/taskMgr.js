'use strict';

class Task {
    constructor(name, data, cb) {
        this.name = name;
        this.data = data;
        this.callback = cb;
    }

    setData(key, val) {
        this.data[key] = val;
    }

    isMatched(data) {
        return this.data.code == data.rzrq.code;
    }

    updateData(data) {
        if (this.name == 'mngr.checkrzrq') {
            this.setData('account', data.rzrq.Status == -1 ? 'normal' : 'collat');
        }
    }

    execute() {
        if (typeof(this.callback) === 'function') {
            this.callback(this.data);
        }
    }
}

class TaskManager {
    constructor() {
        this.taskQue = []
    }

    addTask(task) {
        this.taskQue.push(task);
    }

    action(name, data) {
        var nQue = [];
        var matched = 0;
        for (var task of this.taskQue) {
            if (task.name == name && task.isMatched(data)) {
                task.updateData(data);
                task.execute();
                matched += 1;
            } else {
                nQue.push(task);
            }
        }
        if (matched > 0) {
            this.taskQue = nQue;
        }
    }

    handleMessage(message) {
        this.action(message.command, message);
    }
}
