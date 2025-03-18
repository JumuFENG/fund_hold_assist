const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
    level: 'info', // 日志级别
    format: combine(
        label({ label: 'right meow!' }),
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new transports.Console(), // 输出到控制台
        new transports.File({ filename: 'emtrade.err.log', level: 'error' }), // 输出到文件
        new transports.File({ filename: 'emtrade.log' }) // 输出到文件
    ],
    exceptionHandlers: [
        new transports.File({ filename: 'emtrade.excepts.log' })
    ]
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}
