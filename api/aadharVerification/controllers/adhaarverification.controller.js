const adhaarverificationwithotpModel = require("../models/adhaarverificationwithotp.model");
const adhaarverificattionwithoutoptModel = require("../models/adhaarverificationwithoutotp.model");
const moment = require("moment");
const { aadhaarServiceLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const { callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { selectService } = require("../../service/serviceSelector");
const {
  AadhaarActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/aadhaarServiceResp");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const chargesToBeDebited = require("../../../utils/chargesMaintainance");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");

function generateMerchantId() {
  const now = moment();
  const datePart = now.format("DDMMYYYY");
  const dayPart = now.format("ddd").toUpperCase();
  const timePart = now.format("HHmmss");
  return `MER-${datePart}-${dayPart}-${timePart}`;
}

console.log(generateMerchantId());

exports.handleAadhaarMaskedVerify = async (req, res) => {
  const {
    aadharNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;

  const client_Id = req.clientId;

  try {
    aadhaarServiceLogger.info(
      `Executing Aadhaar Masked Verification for client: ${client_Id}, service: ${serviceId}, category: ${categoryId}`,
    );

    if (!aadharNumber) {
      aadhaarServiceLogger.warn(
        `Aadhaar number missing in request for client ${client_Id}`,
      );
      return res
        .status(400)
        .json(createApiResponse(400, [], "Invalid request parameters"));
    }

    const identifierHash = hashIdentifiers({
      aadhaarNo: aadharNumber,
    });

    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      client_Id,
    });

    if (!rateLimitResult.allowed) {
      aadhaarServiceLogger.warn(
        `Rate limit exceeded for Aadhaar Masked: client ${client_Id}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: rateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    aadhaarServiceLogger.info(`Generated Aadhaar Masked txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      client_Id,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      aadhaarServiceLogger.error(
        `Credit deduction failed for Aadhaar Masked: client ${client_Id}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedAadhaar = encryptData(aadharNumber);
    aadhaarServiceLogger.debug(`Encrypted Aadhaar number for DB lookup`);

    const isExistAadhaar = await adhaarverificattionwithoutoptModel.findOne({
      aadhaarNumber: encryptedAadhaar,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      client_Id,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      aadhaarServiceLogger.warn(
        `Analytics update failed for Aadhaar Masked: client ${client_Id}, service ${serviceId}`,
      );
    }

    aadhaarServiceLogger.debug(
      `Checked for existing Aadhaar record in DB: ${isExistAadhaar ? "Found" : "Not Found"}`,
    );
    if (isExistAadhaar) {
      aadhaarServiceLogger.info(
        `Returning cached Aadhaar response for client: ${client_Id}`,
      );
      if (isExistAadhaar?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: isExistAadhaar?.response?.result,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res
          .status(200)
          .json(
            createApiResponse(200, isExistAadhaar?.response?.result, "Valid"),
          );
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            licenseNumber: licenseNo,
            ...findingInValidResponses("aadhaarToPan"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
  
        return res
          .status(200)
          .json(
            createApiResponse(200, isExistAadhaar?.response?.result, "Valid"),
          );
      }
    }

    const service = await selectService(categoryId, serviceId);
    if (!service.length) {
      aadhaarServiceLogger.warn(
        `Active service not found for Aadhaar Masked category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    aadhaarServiceLogger.info(
      `Active service selected for Aadhaar Masked: ${service}`,
    );
    const response = await AadhaarActiveServiceResponse(
      { aadharNumber },
      service,
      0,
      client_Id
    );

    aadhaarServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    await adhaarverificattionwithoutoptModel.create({
      aadhaarNumber: encryptedAadhaar,
      response,
      status: 1,
      serviceName: response?.service,
      message: response?.message || "Aadhaar verification completed",
      success: response?.code === 200 && !!response?.result,
    });

    if (response?.code === 200 && response?.result) {
      aadhaarServiceLogger.info(
        `Aadhaar verified successfully for client: ${client_Id}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      aadhaarServiceLogger.info(
        `Invalid Aadhaar response received for client: ${client_Id}`,
      );
      return res.status(200).json(createApiResponse(200, {}, "Invalid"));
    }
  } catch (err) {
    aadhaarServiceLogger.error(
      `System error in Aadhaar Masked Verification for client ${req.client_Id}: ${err.message}`,
      err,
    );
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.initiateAadhaarDigilocker = async (req, res) => {
  const {
    callback_url,
    redirect_url,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;
  const startTime = new Date();
  aadhaarServiceLogger.info("Aadhaar DigiLocker initiation triggered");

  const storingClient = req.clientId || clientId;

  const tnId = genrateUniqueServiceId();
  const maintainanceResponse = await deductCredits(
        storingClient,
        serviceId,
        categoryId,
        tnId,
        req.environment,
      );

  if (!maintainanceResponse?.result) {
    aadhaarServiceLogger.error(
      `Credit deduction failed for Aadhaar verification: client ${storingClient}, txnId ${tnId}`,
    );
    return res.status(500).json({
      success: false,
      message: maintainanceResponse?.message || "InValid",
      response: {},
    });
  }

  try {
    const transId = "TS-" + Date.now();
    const username = process.env.TRUTHSCREEN_NTAR_USERNAME;
    const password = process.env.TRUTHSCREEN_NTAR_TOKEN;
    const finalCallback = callback_url || process.env.DEFAULT_CALLBACK_URL;
    const finalRedirect = redirect_url || process.env.DEFAULT_REDIRECT_URL;

    const payload = {
      trans_id: transId,
      doc_type: "472",
      action: "LINK",
      callback_url: finalCallback,
      redirect_url: finalRedirect,
    };

    aadhaarServiceLogger.info(
      `Payload for DigiLocker: ${JSON.stringify(payload)}`,
    );

    const url = "https://www.truthscreen.com/api/v1.0/eaadhaardigilocker/";
    const response = await callTruthScreenAPI({
      url,
      payload,
      username,
      password,
    });

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
      aadhaarServiceLogger.info(
        `DigiLocker link generated successfully in ${duration}s`,
      );
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

    aadhaarServiceLogger.error(
      `DigiLocker link generation failed => ${response?.msg}`,
    );
    return res
      .status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode)
      .json(ERROR_CODES.THIRD_PARTY_ERROR);
  } catch (err) {
    aadhaarServiceLogger.error(
      `Error in initiateAadhaarDigilocker => ${err.message}`,
    );
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.checkAadhaarDigilockerStatus = async (req, res) => {
  const startTime = new Date();
  aadhaarServiceLogger.info("Entered checkAadhaarDigilockerStatus controller");

  try {
    const { tsTransId } = req.body;

    if (!tsTransId) {
      aadhaarServiceLogger.warn("Missing tsTransId in request body");
      return res
        .status(ERROR_CODES.BAD_REQUEST.httpCode)
        .json(ERROR_CODES.BAD_REQUEST);
    }

    const username = process.env.TRUTHSCREEN_NTAR_USERNAME;
    const password = process.env.TRUTHSCREEN_NTAR_TOKEN;

    const payload = {
      ts_trans_id: tsTransId,
      doc_type: "472",
      action: "STATUS",
    };

    const url = "https://www.truthscreen.com/api/v1.0/eaadhaardigilocker/";
    aadhaarServiceLogger.info(
      `Calling TruthScreen Aadhaar DigiLocker STATUS API => ${url}`,
    );
    aadhaarServiceLogger.info(`Payload: ${JSON.stringify(payload)}`);

    const response = await callTruthScreenAPI({
      url,
      payload,
      username,
      password,
    });
    aadhaarServiceLogger.info(
      `Response received from TruthScreen => ${JSON.stringify(response)}`,
    );

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

    aadhaarServiceLogger.info(
      `Extracted Aadhaar Details: ${JSON.stringify(aadhaarDetails)}`,
    );
    const MerchantId = generateMerchantId();
    console.log("Generated Merchant ID:", MerchantId);

    if (response?.status === 1) {
      const updatedRecord =
        await adhaarverificationwithotpModel.findOneAndUpdate(
          { ts_trans_id: tsTransId },
          {
            aadhaarDetails,
            status: "verified",
            response,
            MerchantId,
          },
          { new: true },
        );
      console.log("detailsstores in adhar", updatedRecord);
      aadhaarServiceLogger.info(
        `Aadhaar KYC updated successfully for tsTransId: ${tsTransId}`,
      );
      aadhaarServiceLogger.debug(
        `Updated Record: ${JSON.stringify(updatedRecord)}`,
      );

      const duration = (new Date() - startTime) / 1000;
      aadhaarServiceLogger.info(
        `[${ERROR_CODES.SUCCESS.httpCode}] Aadhaar retrieved successfully | Duration: ${duration}s`,
      );

      return res.status(ERROR_CODES.SUCCESS.httpCode).json({
        message: "Valid",
        response: response,
        success: true,
      });
    }

    aadhaarServiceLogger.error(
      `[${ERROR_CODES.THIRD_PARTY_ERROR.httpCode}] Aadhaar DigiLocker STATUS failed => ${response?.msg}`,
    );
    return res
      .status(ERROR_CODES.THIRD_PARTY_ERROR.httpCode)
      .json(ERROR_CODES.THIRD_PARTY_ERROR);
  } catch (err) {
    aadhaarServiceLogger.error(
      `Error in checkAadhaarDigilockerStatus => ${err.message}`,
    );
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
