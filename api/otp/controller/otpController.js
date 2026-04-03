const dotenv = require("dotenv");
const mobileModel = require("../model/otpModel");
const axios = require("axios");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const {
  smsOtpActiveServiceResponse,
} = require("../service/smsOtpResponse");
const { selectService } = require("../../service/serviceSelector");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { contactServiceLogger } = require("../../Logger/logger");
const handleValidation = require("../../../utils/lengthCheck");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");

dotenv.config();

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

const verifyMobileOtp = async (req, res, next) => {
  try {
    const { submittedOtp, mobile } = req.body;
    console.log(submittedOtp);
    const submittedOTP = Number(submittedOtp);
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
            response: ` Mobile Number ${mobile} is Verified with OTP ${submittedOTP}`,
          },
        },
      );

      res.status(200).json(
        createApiResponse(
          200,
          {
            message: ` Mobile Number ${mobile} is Verified with Otp ${submittedOTP}`,
          },
          "Valid",
        ),
      );
    } else {
      let errorMessage = {
        message: "Invalid OTP",
        statusCode: 400,
      };
      return res
        .status(400)
        .json(createApiResponse(400, errorMessage, "Invalid"));
    }
  } catch (error) {
    console.log("Error verifying OTP:", error);
    let errorMessage = {
      message: "Internal Server Error",
      statusCode: 500,
    };
    return res
      .status(500)
      .json(createApiResponse(500, errorMessage, "Invalid"));
  }
};

// step 2
const handleOTPSend = async (mobileNumber, res, storingClient, next) => {
  console.log("handle otp send is Triggred");
  const service = await selectService("SMSOTP");
  console.log("handle Otp Send is called ===>", service);
  try {
    // Generate OTP and message
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashCode = "";
    const message = `OTP: ${otp} ${hashCode} for user verification - NTARBZ`;
    console.log("Generated OTP:", otp);

    // const smsServiceResponse = await sendSMS(mobileNumber, message);
    const smsServiceResponse = await smsOtpActiveServiceResponse(
      { mobileNumber, message },
      service,
      0,
    );

    console.log("Message sent:", message);
    console.log("SMS service response:", smsServiceResponse);

    // Check if the user exists in mobile
    const updateData = {
      otp,
      mobileNumber,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };
    const existingUser = await mobileModel.findOneAndUpdate(
      { mobileNumber },
      { $set: updateData },
      { new: true, upsert: true },
    );
    contactServiceLogger.info("existing otp user==>>>", existingUser);
    const datatoSend = {
      message: `OTP sent to ${mobileNumber}`,
      success: `Otp sent to Your Mobile Number ${mobileNumber}`,
    };
    return res.status(201).json(createApiResponse(200, datatoSend, "Valid"));
  } catch (error) {
    console.error("Error sending OTP:", error);
    let errorMessage = {
      message: "Failed to send OTP",
      statusCode: 500,
    };
    return res
      .status(500)
      .json(createApiResponse(500, errorMessage, "Invalid"));
  }
};

// step 1
const mobileOtpGeneration = async (req, res, next) => {
  const { mobileNumber = "", serviceId = "", categoryId = "" } = req.body;
  console.log("mobile OTP Generation is called", req.body);

  const storingClient = req.clientId;

  const isValid = handleValidation("mobile", mobileNumber, res, storingClient, contactServiceLogger);
  if (!isValid) return;

  try {
    const identifierHash = hashIdentifiers({
      mobileNo: mobileNumber,
    });

    const mobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      logger: contactServiceLogger
    });

    if (!mobileRateLimitResult.allowed) {
      contactServiceLogger.info(
        `Rate limit exceeded for mobile number verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: mobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(
      `Generated mobile otp generation txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      contactServiceLogger
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.info(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }
    await handleOTPSend(mobileNumber, res, storingClient, next);
  } catch (err) {
    return next(ERROR_CODES?.SERVER_ERROR);
  }
};

module.exports = { mobileOtpGeneration, verifyMobileOtp };
