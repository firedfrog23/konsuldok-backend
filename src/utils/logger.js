import winston from 'winston';
import config from '../config/index.js';

// Define logging levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Determine the log level based on the environment
const level = () => {
    const env = config.nodeEnv || 'development';
    return env === 'development' ? 'debug' : 'warn';
};

// Define colors for different log levels (optional)
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
winston.addColors(colors);

// Define the format for log messages
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    // Use colorize only for console output in development
    config.nodeEnv === 'development' ? winston.format.colorize({ all: true }) : winston.format.uncolorize(),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Define transports (where logs should go)
const transports = [
    // Always log to the console
    new winston.transports.Console(),
    // Optionally, log errors to a separate file
    // new winston.transports.File({
    //     filename: 'logs/error.log',
    //     level: 'error',
    // }),
    // Optionally, log all messages to another file
    // new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger instance
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

export default logger;
