const adhaarverificationwithotpModel = require("../models/adhaarverificationwithotp.model");
const adhaarverificattionwithoutoptModel = require("../models/adhaarverificationwithoutotp.model")
const axios = require('axios');
const panverificationModel = require("../../panVerification/models/panverification.model");
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/newServiceTrackingModel");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel")
const invincibleClientId = process.env.INVINCIBLE_CLIENT_ID
const invincibleSecretKey = process.env.INVINCIBLE_SECRET_KEY
const moment = require("moment")
const logger = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utlis/errorCodes");
const {
  callTruthScreenAPI,
  generateTransactionId,
} = require("../../truthScreen/callTruthScreen");
const { encryptData, decryptData } = require("../../../utlis/EncryptAndDecrypt");
const { verifyAadhaarMasked } = require("../../service/provider.invincible");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const { selectService } = require("../../service/serviceSelector");
const { AadhaarActiveServiceResponse } = require("../../GlobalApiserviceResponse/aadhaarServiceResp");
function generateMerchantId() {
  const now = moment();
  const datePart = now.format("DDMMYYYY");
  const dayPart = now.format("ddd").toUpperCase();
  const timePart = now.format("HHmmss");
  return `MER-${datePart}-${dayPart}-${timePart}`;
}

console.log(generateMerchantId());

exports.handleAadhaarMaskedVerify = async (req, res) => {
  const { aadharNumber } = req.body;
  logger.info(" Aadhaar Masked Verification triggered");
  try {
    console.log('handleAadhaar masked in try block', req.body);
    if (!aadharNumber) {
      logger.warn("Aadhaar number missing in request");
      return res.status(ERROR_CODES?.BAD_REQUEST.httpCode).json(createApiResponse(400, [], 'Invalid request parameters'));
    }
    const encryptedAadhaar = encryptData(aadharNumber);
    console.log('handle Aadhaar Masked Verify in try block', encryptedAadhaar)

    const isExistAadhaar = await adhaarverificattionwithoutoptModel.findOne({ aadhaarNumber: encryptedAadhaar });
    console.log('handle Aadhaar Masked Verify in try block', isExistAadhaar)
    if (isExistAadhaar) {
      return res.status(200).json(createApiResponse(200, isExistAadhaar?.response?.result, 'Valid'))
    };

    console.log('handle Aadhaar Masked Verify in try block')
    const Services = await selectService('AADHAARMASKED');
    logger.info(`Aadhaar encrypted => ${encryptedAadhaar.slice(0, 10)}...`);

    const response = await AadhaarActiveServiceResponse({ aadharNumber }, Services, 0);
    logger.info(`invincible API Response => ${JSON.stringify(response)}`);

    await adhaarverificattionwithoutoptModel.create({
      aadhaarNumber: encryptedAadhaar,
      response,
      message: response?.message || "Aadhaar verification completed",
      success: response?.code === 200 && !!response?.result,
    });
    if (response?.code === 200 && response?.result) {
      logger.info("Aadhaar verified successfully");
      return res.status(ERROR_CODES?.SUCCESS.httpCode).json(createApiResponse(200, response?.result, 'Valid'));
    } else {
      return res.status(200).json(createApiResponse(200, {}, 'Invalid'));
    }
  } catch (err) {
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.initiateAadhaarDigilocker = async (req, res) => {
  const startTime = new Date();
  logger.info("Aadhaar DigiLocker initiation triggered");

  try {
    const transId = "TS-" + Date.now();
    const username = process.env.TRUTHSCREEN_USERNAME;
    const password = process.env.TRUTHSCREEN_TOKEN;
    const { callback_url, redirect_url } = req.body;
    const finalCallback = callback_url || process.env.DEFAULT_CALLBACK_URL;
    const finalRedirect = redirect_url || process.env.DEFAULT_REDIRECT_URL;

    const payload = {
      trans_id: transId,
      doc_type: "472",
      action: "LINK",
      callback_url: finalCallback,
      redirect_url: finalRedirect,
    };

    logger.info(`Payload for DigiLocker: ${JSON.stringify(payload)}`);

    const url = "https://www.truthscreen.com/api/v1.0/eaadhaardigilocker/";
    const response = await callTruthScreenAPI({ url, payload, username, password });

    const kycData = {
      trans_id: transId,
      ts_trans_id: response?.ts_trans_id || null,
      link: response?.data?.url || null,
      status: response?.status === 1 ? "initiated" : "failed",
      response: response || null,
      callback_url: finalCallback,
      redirect_url: finalRedirect,
    };

    await adhaarverificationwithotpModel.create(kycData);

    if (response?.status === 1) {
      const duration = (new Date() - startTime) / 1000;
      logger.info(`DigiLocker link generated successfully in ${duration}s`);
      return res.status(ERROR_CODES.SUCCESS.httpCode).json({
        message: "Valid",
        success: true,
        response: {
          transId,
          ts_trans_id: response?.ts_trans_id,
          link: response?.data?.url,
          callback_url: finalCallback,
          redirect_url: finalRedirect,
        },
      });
    }

    logger.error(`DigiLocker link generation failed => ${response?.msg}`);
    return res.status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode).json(ERROR_CODES.THIRD_PARTY_ERROR);

  } catch (err) {
    logger.error(`Error in initiateAadhaarDigilocker => ${err.message}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.checkAadhaarDigilockerStatus = async (req, res) => {
  const startTime = new Date();
  logger.info("Entered checkAadhaarDigilockerStatus controller");

  try {
    const { tsTransId } = req.body;

    if (!tsTransId) {
      logger.warn("Missing tsTransId in request body");
      return res.status(ERROR_CODES.BAD_REQUEST.httpCode).json(ERROR_CODES.BAD_REQUEST);
    }

    const username = process.env.TRUTHSCREEN_USERNAME;
    const password = process.env.TRUTHSCREEN_TOKEN;

    const payload = {
      ts_trans_id: tsTransId,
      doc_type: "472",
      action: "STATUS",
    };

    const url = "https://www.truthscreen.com/api/v1.0/eaadhaardigilocker/";
    logger.info(`Calling TruthScreen Aadhaar DigiLocker STATUS API => ${url}`);
    logger.info(`Payload: ${JSON.stringify(payload)}`);

    const response = await callTruthScreenAPI({ url, payload, username, password });
    logger.info(`Response received from TruthScreen => ${JSON.stringify(response)}`);

    const outerKey = Object.keys(response.data || {})[0];
    const msg = response.data?.[outerKey]?.msg?.[0] || {};
    const addressData = msg?.data?.address || "";
    const formattedAddress =
      typeof addressData === "object"
        ? Object.values(addressData).filter(Boolean).join(", ")
        : addressData;

    const aadhaarDetails = {
      name: msg?.data?.name || "",
      fatherName: msg?.data?.["Father Name"] || "",
      dob: msg?.data?.dob || "",
      aadhar_number: msg?.data?.aadhar_number || "",
      gender: msg?.data?.gender || "",
      address: formattedAddress,
      co: msg?.data?.co || "",
      photo: msg?.data?.photo || "",
    };


    logger.info(`Extracted Aadhaar Details: ${JSON.stringify(aadhaarDetails)}`);
    const MerchantId = generateMerchantId();
    console.log("Generated Merchant ID:", MerchantId);

    if (response?.status === 1) {
      const updatedRecord = await adhaarverificationwithotpModel.findOneAndUpdate(
        { ts_trans_id: tsTransId },
        {
          aadhaarDetails,
          status: "verified",
          response,
          MerchantId
        },
        { new: true }
      );
      console.log("detailsstores in adhar", updatedRecord)
      logger.info(`Aadhaar KYC updated successfully for tsTransId: ${tsTransId}`);
      logger.debug(`Updated Record: ${JSON.stringify(updatedRecord)}`);

      const duration = (new Date() - startTime) / 1000;
      logger.info(`[${ERROR_CODES.SUCCESS.httpCode}] Aadhaar retrieved successfully | Duration: ${duration}s`);

      return res.status(ERROR_CODES.SUCCESS.httpCode).json({
        message: "Valid",
        response: response,
        success: true,
      });
    }

    logger.error(`[${ERROR_CODES.THIRD_PARTY_ERROR.httpCode}] Aadhaar DigiLocker STATUS failed => ${response?.msg}`);
    return res.status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode).json(ERROR_CODES.THIRD_PARTY_ERROR);

  } catch (err) {
    logger.error(`Error in checkAadhaarDigilockerStatus => ${err.message}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};


