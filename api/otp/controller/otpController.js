const dotenv = require("dotenv");
const mobileModel = require("../model/otpModel");
const axios = require("axios");
const logger = require("../../Logger/logger");

dotenv.config();

const {
  DOVE_SOFT_USER,
  DOVE_SOFT_KEY,
  DOVE_SOFT_API_URL,
  DOVE_SOFT_ENTITYID,
  DOVE_SOFT_TEMPID,
  DOVE_SOFT_SENDERID,
} = process.env;

const sendSMS = async (mobileNumber, message) => {
  try {
    let config = {
      method: "get",
      url: `${DOVE_SOFT_API_URL}&user=${DOVE_SOFT_USER}&key=${DOVE_SOFT_KEY}&mobile=+91${mobileNumber}&message=${message}&senderid=${DOVE_SOFT_SENDERID}&accusage=1&entityid=${DOVE_SOFT_ENTITYID}&tempid=${DOVE_SOFT_TEMPID}`,
    };
    const response = await axios.request(config);
    console.log("SMS Service Response:", response.data);
    return response.data; // Return the response data to be stored
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw error;
  }
};

const getOTP = async (mNo) => {
  try {
    const storedOTP = await mobileModel
      .findOne({ mobileNumber: mNo })
      .select("otp");
    return storedOTP ? storedOTP.otp : null;
  } catch (error) {
    console.log("Error getting OTP:", error);
    return null;
  }
};

const handleOTPSend = async (merchantId, mobileNumber, token, res, next) => {
  try {
    // Generate OTP and message
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashCode = "";
    const message = `OTP: ${otp} ${hashCode} for user verification - NTARBZ`;
    console.log("Generated OTP:", otp);

    const smsServiceResponse = await sendSMS(mobileNumber, message);

    console.log("Message sent:", message);
    console.log("SMS service response:", smsServiceResponse);

    // Check if the user exists in mobile
    const updateData = {
      otp,
      merchantId,
      mobileNumber,
      token,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };

    const existingUser = await mobileModel.findOneAndUpdate(
      { mobileNumber },
      { $set: updateData },
      { new: true, upsert: true } // Creates a new document if none exists
    );

    logger.info("existing otp user==>>>", existingUser);

    res.status(201).json({
      message: `OTP sent to ${mobileNumber}`,
      success: `Otp sent to Your Mobile Number ${mobileNumber}`,
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

const verifyMobileOtp = async (req, res, next) => {
  try {
    const { submittedOtp, mobile } = req.body;
    console.log(submittedOtp);
    const submittedOTP = Number(submittedOtp);

    const MerchantId = req.merchantId;
    const check = req.token;
    const storedOTP = await getOTP(mobile);

    if (!storedOTP) {
      let errorMessage = {
        message: "Please try Mobile Verify Again",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    console.log("Submitted OTP:", submittedOTP);
    console.log("Stored OTP:", storedOTP);

    if (submittedOTP === storedOTP) {
      await mobileModel.updateOne(
        { otp: storedOTP },
        {
          $set: {
            token: check,
            response: ` Mobile Number ${mobile} is Verified with OTP ${submittedOTP}`,
          },
        }
      );

      res.status(200).json({
        message: {
          message: ` Mobile Number ${mobile} is Verified with Otp ${submittedOTP}`,
        },
      });
    } else {
      let errorMessage = {
        message: "Invalid OTP",
        statusCode: 400,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.log("Error verifying OTP:", error);
    let errorMessage = {
      message: "Internal Server Error",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

const mobileOtpGeneration = async (req, res, next) => {
  const { mobileNumber } = req.body;

  const MerchantId = req.merchantId;
  const check = req.token;

  if (!mobileNumber) {
    let errorMessage = {
      message: "Mobile Number is not there",
      statusCode: 400,
    };
    return next(errorMessage);
  }
  try {
    if (MerchantId) {
      await handleOTPSend(MerchantId, mobileNumber, check, res, next);
    }
  } catch (err) {
    let errorMessage = {
      message: "Internal Server Error",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

module.exports = { mobileOtpGeneration, verifyMobileOtp };
