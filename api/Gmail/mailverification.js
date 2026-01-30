const nodemailer = require("nodemailer");
const { createApiResponse } = require("../../utlis/ApiResponseHandler");


// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.userEmail,
        pass: process.env.emailPasskey,
    },
});


const sendEmail = async (req, res) => {
    const { to, subject, text, attachments } = req.body;
    console.log('sendmail req body', req.body)
    try {
        const mailPayload = {
            from: process.env.userEmail,
            to,
            subject,
            text,
            attachments
        }
        const mailres = await transporter.sendMail(mailPayload);
        console.log('Send Email is successfull', mailres.messageId);
        return res.status(200).json(createApiResponse(200, null, mailres.messageId))
    } catch (error) {
        console.log('Server Error', error);
        return res.status(500).json(createApiResponse(500, null, "Server Error"));
    }
}

module.exports = {
    sendEmail
}



