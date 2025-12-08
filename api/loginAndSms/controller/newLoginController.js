const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
const CryptoJS = require("crypto-js")
const registeration = require("../../registeration/model/registerationModel")
const loginAndSms = require("../model/loginAndSmsModel")
const axios = require("axios")
const logger = require("../../Logger/logger")
const checkingDetails = require("../../../utlis/authorization")
const Whitelistapi = require('../../whitelistapi/models/whitelistapi.models')

dotenv.config()
const {
    JWTSECRET,
    DOVE_SOFT_USER,
    DOVE_SOFT_KEY,
    DOVE_SOFT_API_URL,
    DOVE_SOFT_ENTITYID,
    DOVE_SOFT_TEMPID,
    DOVE_SOFT_SENDERID,
    CRYPTO_SECRET_KEY
} = process.env;


const decryptPassword = (encryptedPassword) => {
    console.log("Encrypted Password to decrypt:", encryptedPassword);
    console.log(typeof encryptedPassword)
    const secretKey = CryptoJS.enc.Utf8.parse("ntarPrivate"); // Parse the secret key

    // Split the IV and ciphertext
    const [ivHex, ciphertextHex] = encryptedPassword.split(":");
    if (!ivHex || !ciphertextHex) {
        throw new Error("Invalid encrypted password format");
    }

    const iv = CryptoJS.enc.Hex.parse(ivHex); // Parse IV
    const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex); // Parse ciphertext

    // Decrypt the ciphertext
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext },
        secretKey,
        { iv }
    );

    const decryptedPassword = decrypted.toString(CryptoJS.enc.Utf8); // Convert to UTF-8
    if (!decryptedPassword) {
        throw new Error("Decryption failed. Password might be incorrect.");
    }

    console.log("Decrypted Password:", decryptedPassword);
    return decryptedPassword;
};

const sendSMS = async (mobileNumber, message) => {
    try {
        let config = {
            method: "get",
            url: `${DOVE_SOFT_API_URL}&user=${DOVE_SOFT_USER}&key=${DOVE_SOFT_KEY}&mobile=+91${mobileNumber}&message=${message}&senderid=${DOVE_SOFT_SENDERID}&accusage=1&entityid=${DOVE_SOFT_ENTITYID}&tempid=${DOVE_SOFT_TEMPID}`,
        };
        const response = await axios.request(config);
        console.log(response)
        console.log("SMS Service Response:", response.data);
        return response.data; // Return the response data to be stored
    } catch (error) {
        console.error("Error sending SMS:", error);
        throw error;
    }
};

const getOTP = async (mobileNumber) => {
    try {
        const storedOTP = await loginAndSms.findOne({ mobileNumber }).select('otp');
        return storedOTP ? storedOTP.otp : null;
    } catch (error) {
        console.log('Error getting OTP:', error);
        return null;
    }
};


const handleOTPSend = async (mobileNumber, res, next) => {

    try {
        // Generate OTP and message
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hashCode = "";
        const message = `OTP: ${otp} ${hashCode} for user verification - NTARBZ`;
        console.log("Generated OTP:", otp);

        const smsServiceResponse = await sendSMS(
            mobileNumber,
            message
        );

        console.log("Message sent:", message);
        console.log("SMS service response:", smsServiceResponse);

        const updateData = {
            otp,
            createdDate: new Date().toLocaleDateString(),
            createdTime: new Date().toLocaleTimeString()
        };

        const existingUser = await loginAndSms.findOneAndUpdate(
            { mobileNumber },
            { $set: updateData },
            { new: true, upsert: true } // Creates a new document if none exists
        );

        logger.info("existing otp user==>>>", existingUser)

        res.status(201).json({
            message: `OTP sent to ${mobileNumber}`,
            success: true
        });

    } catch (error) {
        console.error("Error sending OTP:", error);
        let errorMessage = {
            message: "Failed to send OTP",
            statusCode: 500,
        };
        return next(errorMessage);
    }
};

// step 2 vefi
const verifyOtp = async (req, res, next) => {
    const { submittedOtp, mobileNumber } = req.body;
    console.log('verify Otp Response ===>', req.body);
    try {
        const storedOTP = await getOTP(mobileNumber);

        if (!storedOTP) {
            let errorMessage = {
                message: "Please try Mobile Verify Again",
                statusCode: 400,
            };
            return next(errorMessage);
        }

        console.log("Submitted OTP:", submittedOtp);
        console.log("Stored OTP:", storedOTP);

        if (submittedOtp === storedOTP) {
            // Generate JWT token
            const token = jwt.sign({ mobileNumber }, JWTSECRET, { expiresIn: "10h" });
            console.log('Handle Otp send token ===>', token);
            res.status(200).json({ message: "Login Successful", success: true,token })
        } else {
            let errorMessage = {
                message: "Invalid OTP",
                statusCode: 400,
            };
            return next(errorMessage);
        }
    } catch (error) {
        console.log('Error verifying OTP:', error);
        let errorMessage = {
            message: "Internal Server Error",
            statusCode: 500,
        };
        return next(errorMessage);
    }
}

// step 1
const loginDetails = async (req, res, next) => {
    const { mobileNumber } = req.body
    console.log("req.body==>>", req.body)
    if (!mobileNumber) {
        let errorMessage = {
            message: "Mandatory Fields are not there",
            statusCode: 400,
        };
        return next(errorMessage);
    }

    try {
        const isPresent = await registeration.find({ mobileNumber: mobileNumber })
        console.log('Login details is registeration response data in dB', isPresent)
        if (!isPresent.length) {
            return res.status(404).json({ message: 'Register user Not Found with this Number, Pls Register', data: [], success: false, HttpsCode: 404 });
        }
        await handleOTPSend(mobileNumber, res);
    } catch (err) {
        let errorMessage = {
            message: "Internal Server Error",
            statusCode: 500,
        };
        return next(errorMessage);
    }

}

const getUser = async (req, res, next) => {

    const authHeader = req.headers.authorization;
    console.log(authHeader, "authHeader")


    const check = await checkingDetails(authHeader, next)
    console.log(check, "check")

    try {
        const storedUser = await loginAndSms.findOne({ token: check });

        if (!storedUser) {
            let errorMessage = {
                message: "User Not Login correctly",
                statusCode: 404,
            };
            return next(errorMessage);
        }

        const merchantId = storedUser?.merchantId
        const foundUser = await registeration.findOne({ merchantId: merchantId })

        if (!foundUser) {
            let errorMessage = {
                message: "User Not Registered",
                statusCode: 404,
            };
            return next(errorMessage);
        }

        const foundUserResponse = {
            name: foundUser?.name,
            email: foundUser?.email,
            mobileNumber: foundUser?.mobileNumber,
            companyName: foundUser?.companyName,
            createdDate: foundUser?.createdDate,
            MerchantId: foundUser?.merchantId,
            role: foundUser?.role
        }

        res.status(200).json({ message: "valid", success: true, response: foundUserResponse })

    } catch (err) {
        console.log("Err in sending user Details", err)
        let errorMessage = {
            message: "Internal Server Error try again after some time",
            statusCode: 500,
        };
        return next(errorMessage);
    }
}

module.exports = { loginDetails, verifyOtp, getUser };