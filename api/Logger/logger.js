// const { createLogger, format, transports } = require("winston");
// const { combine, timestamp, printf, colorize } = format;

// const logFormat = printf(({ level, message, timestamp }) => {
//   return `${timestamp} [${level.toUpperCase()}]: ${message}`;
// });

// const logger = createLogger({
//   format: combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
//   transports: [
//     new transports.Console(),
//     new transports.File({ filename: "logs/combined.log" }),
//     new transports.File({ filename: "logs/error.log", level: "error" }),
//   ],
// });

// module.exports = logger;


// const { createLogger, format, transports } = require('winston');
// const DailyRotateFile = require('winston-daily-rotate-file');
// const path = require('path');
// const fs = require('fs');
// const logDir = path.join(__dirname, 'logs');
// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }
// const logger = createLogger({
//   level: 'info',
//   format: format.combine(
//     format.timestamp(),
//     format.printf(({ timestamp, level, message }) => {
//       return `${timestamp} [${level}]: ${message}`;
//     })
//   ),
//   transports: [
//     new transports.Console({
//       format: format.combine(
//         format.colorize(),
//         format.simple()
//       )
//     }),
//     new DailyRotateFile({
//       filename: path.join(logDir, 'combined-%DATE%.log'),
//       datePattern: 'YYYY-MM-DD',
//       level: 'info',
//       zippedArchive: false,
//       maxSize: '500m',
//       // maxFiles: '14d'
//     }),
//     new DailyRotateFile({
//       filename: path.join(logDir, 'error-%DATE%.log'),
//       datePattern: 'YYYY-MM-DD',
//       level: 'error',
//       zippedArchive: false,
//       maxSize: '500m',
//       // maxFiles: '14d'
//     }),
//   ]
// });
// module.exports = logger;

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const BASE_LOG_DIR = path.join(__dirname, 'logs');

// Ensure base log directory exists
if (!fs.existsSync(BASE_LOG_DIR)) {
  fs.mkdirSync(BASE_LOG_DIR, { recursive: true });
}

const createSectionLogger = (section) => {
  const sectionDir = path.join(BASE_LOG_DIR, section);

  if (!fs.existsSync(sectionDir)) {
    fs.mkdirSync(sectionDir, { recursive: true });
  }

  return createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
    ),
    transports: [
      // Console log
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      }),

      // Combined logs (250MB OR every 4 hours)
      new DailyRotateFile({
        dirname: sectionDir,
        filename: 'combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        frequency: '4h',
        maxSize: '250m',
        level: 'info',
        zippedArchive: false,
        maxFiles: '7d', // optional retention
      }),

      // Error logs
      new DailyRotateFile({
        dirname: sectionDir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        frequency: '4h',
        maxSize: '250m',
        level: 'error',
        zippedArchive: false,
        maxFiles: '7d',
      }),
    ],
  });
};

module.exports = {
  kycLogger: createSectionLogger('kyc'),
  accountLogger: createSectionLogger('account'),
  cardLogger: createSectionLogger('card'),
  companyLogger: createSectionLogger('company'),
  rechargeLogger: createSectionLogger('recharge'),
  commonLogger: createSectionLogger('common'),
};





// const { createLogger, transports, format } = require('winston');
// const path = require('path');
// const fs = require('fs');

// // Create logs directory if it doesn't exist
// const logDir = path.join(__dirname, 'logs');
// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }

// // Function to get the current date in YYYY-MM-DD format
// const getCurrentDate = () => {
//   const date = new Date();
//   const year = date.getFullYear(); 
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   console.log("date month hyear and day===>",day,date,month,year)
//   return `${year}-${month}-${day}`;
// };

// const logger = createLogger({
//   level: 'info',  
//   format: format.combine(
//     format.timestamp(),
//     format.printf(({ timestamp, level, message }) => {
//       return `${timestamp} [${level}]: ${message}`;
//     })
//   ),
//   transports: [
//     new transports.Console({
//       format: format.combine(
//         format.colorize(),
//         format.simple()
//       )
//     }),
//     // Dynamically create log filename based on the date
//     new transports.File({
//       filename: path.join(logDir, `combined-${getCurrentDate()}.log`),
//       level: 'info',
//     }),
//     new transports.File({
//       filename: path.join(logDir, `error-${getCurrentDate()}.log`),
//       level: 'error',
//     })
//   ]
// });

// module.exports = logger;






