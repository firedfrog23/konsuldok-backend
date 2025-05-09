import nodemailer from 'nodemailer';
import config from '../config/index.js';
import { ApiError } from './ApiError.js';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

/**
 * Sends an email using the pre-configured transporter.
 * @param {object} mailOptions - Options for Nodemailer sendMail
 * @param {string} mailOptions.to - Recipient email address(es)
 * @param {string} mailOptions.subject - Subject line
 * @param {string} mailOptions.text - Plain text body
 * @param {string} mailOptions.html - HTML body
 */
export const sendEmail = async ({ to, subject, text, html }) => {
    if (config.nodeEnv === 'test') {
        // Avoid sending emails during automated tests
        logger.info(`Skipping email send in test environment to: ${to}, subject: ${subject}`);
        return { messageId: 'test-skipped-email' };
    }

    try {
        const info = await transporter.sendMail({
            from: config.email.from, // Sender address from .env
            to: to,
            subject: subject,
            text: text,
            html: html,
        });

        logger.info(`Email sent successfully via Mailtrap to ${to}. Message ID: ${info.messageId}`);
        // Check Mailtrap inbox online to view the email
        return info;
    } catch (error) {
        logger.error(`Error sending email via Mailtrap to ${to}: ${error.message}`, { error });
        // Depending on use case, you might want to throw a more specific error
        // or handle it gracefully without stopping the entire process.
        // For critical emails like password reset, throwing might be appropriate.
        throw new ApiError(500, 'Failed to send email. Please try again later.');
    }
};
