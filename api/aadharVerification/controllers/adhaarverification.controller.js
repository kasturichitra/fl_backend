const adhaarverificationwithotpModel = require("../models/adhaarverificationwithotp.model");
const adhaarverificattionwithoutoptModel = require("../models/adhaarverificationwithoutotp.model")
const moment = require("moment")
const { kycLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const {
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const { encryptData, decryptData } = require("../../../utils/EncryptAndDecrypt");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
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
  const { aadharNumber, serviceId = "", categoryId = "" } = req.body;
  const clientId = req.clientId;

  try {
    kycLogger.info(`Executing Aadhaar Masked Verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    if (!aadharNumber) {
      kycLogger.warn(`Aadhaar number missing in request for client ${clientId}`);
      return res.status(400).json(createApiResponse(400, [], 'Invalid request parameters'));
    }

    const identifierHash = hashIdentifiers({
      aadhaarNo: aadharNumber,
    });

    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
    });

    if (!rateLimitResult.allowed) {
      kycLogger.warn(`Rate limit exceeded for Aadhaar Masked: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: rateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    kycLogger.info(`Generated Aadhaar Masked txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      kycLogger.error(`Credit deduction failed for Aadhaar Masked: client ${clientId}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedAadhaar = encryptData(aadharNumber);
    kycLogger.debug(`Encrypted Aadhaar number for DB lookup`);

    const isExistAadhaar = await adhaarverificattionwithoutoptModel.findOne({ aadhaarNumber: encryptedAadhaar });

    const analyticsResult = await AnalyticsDataUpdate(clientId, serviceId, categoryId);
    if (!analyticsResult.success) {
      kycLogger.warn(`Analytics update failed for Aadhaar Masked: client ${clientId}, service ${serviceId}`);
    }

    kycLogger.debug(`Checked for existing Aadhaar record in DB: ${isExistAadhaar ? "Found" : "Not Found"}`);
    if (isExistAadhaar) {
      kycLogger.info(`Returning cached Aadhaar response for client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, isExistAadhaar?.response?.result, 'Valid'))
    };

    const Services = await selectService('AADHAARMASKED');
    if (!Services) {
      kycLogger.warn(`Active service not found for Aadhaar Masked category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    kycLogger.info(`Active service selected for Aadhaar Masked: ${Services.serviceFor}`);
    const response = await AadhaarActiveServiceResponse({ aadharNumber }, Services, 0);

    kycLogger.info(`Response received from active service ${Services.serviceFor}: ${response?.message}`);

    await adhaarverificattionwithoutoptModel.create({
      aadhaarNumber: encryptedAadhaar,
      response,
      message: response?.message || "Aadhaar verification completed",
      success: response?.code === 200 && !!response?.result,
    });

    if (response?.code === 200 && response?.result) {
      kycLogger.info(`Aadhaar verified successfully for client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, response?.result, 'Valid'));
    } else {
      kycLogger.info(`Invalid Aadhaar response received for client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, {}, 'Invalid'));
    }
  } catch (err) {
    kycLogger.error(`System error in Aadhaar Masked Verification for client ${req.clientId}: ${err.message}`, err);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.initiateAadhaarDigilocker = async (req, res) => {
  const { callback_url, redirect_url, mobileNumber = "", serviceId = "", categoryId = "" } = req.body;
  const startTime = new Date();
  kycLogger.info("Aadhaar DigiLocker initiation triggered");

  try {
    const transId = "TS-" + Date.now();
    const username = process.env.TRUTHSCREEN_USERNAME;
    const password = process.env.TRUTHSCREEN_TOKEN;
    const finalCallback = callback_url || process.env.DEFAULT_CALLBACK_URL;
    const finalRedirect = redirect_url || process.env.DEFAULT_REDIRECT_URL;

    const payload = {
      trans_id: transId,
      doc_type: "472",
      action: "LINK",
      callback_url: finalCallback,
      redirect_url: finalRedirect,
    };

    kycLogger.info(`Payload for DigiLocker: ${JSON.stringify(payload)}`);

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
      kycLogger.info(`DigiLocker link generated successfully in ${duration}s`);
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

    kycLogger.error(`DigiLocker link generation failed => ${response?.msg}`);
    return res.status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode).json(ERROR_CODES.THIRD_PARTY_ERROR);

  } catch (err) {
    kycLogger.error(`Error in initiateAadhaarDigilocker => ${err.message}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.checkAadhaarDigilockerStatus = async (req, res) => {
  const startTime = new Date();
  kycLogger.info("Entered checkAadhaarDigilockerStatus controller");

  try {
    const { tsTransId } = req.body;

    if (!tsTransId) {
      kycLogger.warn("Missing tsTransId in request body");
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
    kycLogger.info(`Calling TruthScreen Aadhaar DigiLocker STATUS API => ${url}`);
    kycLogger.info(`Payload: ${JSON.stringify(payload)}`);

    const response = await callTruthScreenAPI({ url, payload, username, password });
    kycLogger.info(`Response received from TruthScreen => ${JSON.stringify(response)}`);

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


    kycLogger.info(`Extracted Aadhaar Details: ${JSON.stringify(aadhaarDetails)}`);
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
      kycLogger.info(`Aadhaar KYC updated successfully for tsTransId: ${tsTransId}`);
      kycLogger.debug(`Updated Record: ${JSON.stringify(updatedRecord)}`);

      const duration = (new Date() - startTime) / 1000;
      kycLogger.info(`[${ERROR_CODES.SUCCESS.httpCode}] Aadhaar retrieved successfully | Duration: ${duration}s`);

      return res.status(ERROR_CODES.SUCCESS.httpCode).json({
        message: "Valid",
        response: response,
        success: true,
      });
    }

    kycLogger.error(`[${ERROR_CODES.THIRD_PARTY_ERROR.httpCode}] Aadhaar DigiLocker STATUS failed => ${response?.msg}`);
    return res.status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode).json(ERROR_CODES.THIRD_PARTY_ERROR);

  } catch (err) {
    kycLogger.error(`Error in checkAadhaarDigilockerStatus => ${err.message}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};



