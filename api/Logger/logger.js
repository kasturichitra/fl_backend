// logger.js
const { createLogger, transports, format } = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}


const logger = createLogger({
  level: 'info',  
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(), 
        format.simple() 
      )
    }),
    new transports.File({
      filename: path.join(logDir, 'combined.log'), 
      level: 'info',
    }),
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error', 
    })
  ]
});

module.exports = logger;
