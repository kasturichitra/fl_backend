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
  panServiceLogger: createSectionLogger('panService'),
  aadhaarServiceLogger: createSectionLogger('aadhaarService'),
  bankServiceLogger: createSectionLogger('bankService'),
  gstServiceLogger: createSectionLogger('gstService'),
  businessServiceLogger: createSectionLogger('businessService'),
  contactServiceLogger: createSectionLogger('contactService'),
  faceServiceLogger: createSectionLogger('faceService'),
  employmentServiceLogger: createSectionLogger('employmentService'),
  locationServiceLogger: createSectionLogger('locationService'),
  governmentServiceLogger: createSectionLogger('governmentService'),
  ocrServiceLogger: createSectionLogger('ocrService'),
  vehicleServiceLogger: createSectionLogger('vehicleService'),
  riskServiceLogger: createSectionLogger('riskService'),
  otherServiceLogger: createSectionLogger('otherService'),
  professionalLogger:createSectionLogger('professional'),
  cibilLogger:createSectionLogger('cibil'),
  commonLogger: createSectionLogger('common'),
  walletTopupLogger: createSectionLogger('walletTopup'),

};

