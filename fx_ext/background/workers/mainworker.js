let tasks = [];

addEventListener('message', function(e) {
    if (e.data.command == 'emjy.sent') {
        if (tasks.length > 0) {
            tasks[0].state = 'started';
        }
        return;
    }

    if (!e.data.state || tasks[0].command != e.data.command) {
        e.data.state = 'queued';
        tasks.push(e.data);
    } else {
        tasks.shift();
    }
});

setInterval(function() {
    if (tasks.length != 0 && tasks[0].state == 'queued') {
        postMessage(tasks[0]);
    }
}, 1000);