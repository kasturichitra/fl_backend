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
  digilockerVerifyActiveServiceResponse,
} = require("../service/aadhaarServiceResp");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const handleValidation = require("../../../utils/lengthCheck");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const digilockerverify = require("../models/digilockerVerifyModel");

// aadhaar to masked pan
exports.handleAadhaarMaskedVerify = async (req, res) => {
  const { aadharNumber, mobileNumber = "" } = req.body;

  const client_Id = req.clientId;
  const tnId = genrateUniqueServiceId();
  aadhaarServiceLogger.info(
    `Generated Aadhaar to Masked Pan txn Id: ${tnId} for this client: ${client_Id}`,
  );

  const isValid = handleValidation(
    "aadhaar",
    aadharNumber,
    res,
    tnId,
    aadhaarServiceLogger,
  );
  if (!isValid) return false;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "AADHAAR_TO_MASKED_PAN",
    client_Id,
    aadhaarServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  aadhaarServiceLogger.info(
    `Executing Aadhaar to Masked Pan Verification for client: ${client_Id}, service: ${serviceId}, category: ${categoryId}`,
  );
  try {
    const identifierHash = hashIdentifiers(
      {
        aadhaarNo: aadharNumber,
      },
      aadhaarServiceLogger,
    );

    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: client_Id,
      req,
      TxnID: tnId,
      logger: aadhaarServiceLogger,
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

    const maintainanceResponse = await deductCredits(
      client_Id,
      serviceId,
      categoryId,
      tnId,
      req,
      aadhaarServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      aadhaarServiceLogger.error(
        `Credit deduction failed for Aadhaar Masked: client ${client_Id}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedAadhaar = encryptData(aadharNumber);
    aadhaarServiceLogger.info(`Encrypted Aadhaar number for DB lookup`);

    const isExistAadhaar = await adhaarverificattionwithoutoptModel.findOne({
      aadhaarNumber: encryptedAadhaar,
    });

    const now = new Date();
    const createdTime = now.toLocaleTimeString();
    const createdDate = now.toLocaleDateString();

    const analyticsResult = await AnalyticsDataUpdate(
      client_Id,
      serviceId,
      categoryId,
      "success",
      tnId,
      aadhaarServiceLogger,
    );
    if (!analyticsResult.success) {
      aadhaarServiceLogger.warn(
        `Analytics update failed for Aadhaar Masked: client ${client_Id}, service ${serviceId}`,
      );
    }

    aadhaarServiceLogger.info(
      `Checked for existing Aadhaar to masked pan record in DB: ${isExistAadhaar ? "Found" : "Not Found"} for this client: ${client_Id}`,
    );

    if (isExistAadhaar) {
      aadhaarServiceLogger.info(
        `Returning cached Aadhaar to masked pan response for client: ${client_Id}`,
      );
      const statusOne = isExistAadhaar?.status == 1;

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        TxnID: tnId,
        result: statusOne ? isExistAadhaar?.response : { aadharNumber },
        createdTime,
        createdDate,
      });

      return res
        .status(statusOne ? 200 : 404)
        .json(
          createApiResponse(
            statusOne ? 200 : 404,
            statusOne ? isExistAadhaar?.response : { aadharNumber },
            statusOne ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      aadhaarServiceLogger,
    );
    if (!service.length) {
      aadhaarServiceLogger.warn(
        `Active service not found for Aadhaar Masked category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    const aadhaarResponse = await AadhaarActiveServiceResponse(
      aadharNumber,
      service,
      0,
      client_Id,
    );

    aadhaarServiceLogger.info(
      `Response received from active service: ${aadhaarResponse?.service} with message: ${aadhaarResponse?.message} of response: ${JSON.stringify(aadhaarResponse)}`,
    );

    const isValid = aadhaarResponse?.message?.toUpperCase() === "VALID";
    const noRecord =
      aadhaarResponse?.message?.toUpperCase() === "NO RECORD FOUND";

    await responseModel.create({
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: client_Id,
      TxnID: tnId,
      result: isValid ? aadhaarResponse?.result : { mobileNumber },
      createdTime,
      createdDate,
    });

    const basePayload = {
      aadharNumber: encryptedAadhaar,
      response: isValid ? aadhaarResponse?.result : { mobileNumber },
      serviceName: aadhaarResponse?.service,
      serviceResponse: isValid ? aadhaarResponse?.responseOfService : {},
      createdTime,
      createdDate,
    };

    await digilockerverify.findOneAndUpdate(
      { mobileNumber }, // 🔥 use mobileNumber as filter
      {
        ...basePayload,
        status: isValid ? 1 : noRecord ? 2 : 3,
      },
      { new: true, upsert: true },
    );

    aadhaarServiceLogger.info(
      `Aadhaar verified successfully for client: ${client_Id}`,
    );

    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          isValid ? aadhaarResponse?.result : { aadharNumber },
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (err) {
    aadhaarServiceLogger.error(
      `System error in Aadhaar Masked Verification for client ${req.client_Id}: ${err.message}`,
      err,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      client_Id,
      serviceId,
      categoryId,
      "failed",
      tnId,
      aadhaarServiceLogger,
    );
    if (!analyticsResult.success) {
      aadhaarServiceLogger.warn(
        `Analytics update failed for Aadhaar Masked: client ${client_Id}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// verify digilocker account
exports.handleDigilockerAccountVerify = async (req, res) => {
  const { mobileNumber = "" } = req.body;

  const client_Id = req.clientId;
  const tnId = genrateUniqueServiceId();
  aadhaarServiceLogger.info(
    `Generated Aadhaar digilocker txn Id: ${tnId} for this client: ${client_Id}`,
  );

  const isValid = handleValidation(
    "mobile",
    mobileNumber,
    res,
    tnId,
    aadhaarServiceLogger,
  );
  if (!isValid) return false;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DIGILOCKER_ACCOUNT_VERIFY",
    client_Id,
    aadhaarServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  aadhaarServiceLogger.info(
    `Executing Aadhaar to Masked Pan Verification for client: ${client_Id}, service: ${serviceId}, category: ${categoryId}`,
  );
  try {
    const identifierHash = hashIdentifiers(
      {
        mobileNo: mobileNumber,
      },
      aadhaarServiceLogger,
    );

    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: client_Id,
      req,
      TxnID: tnId,
      logger: aadhaarServiceLogger,
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

    const maintainanceResponse = await deductCredits(
      client_Id,
      serviceId,
      categoryId,
      tnId,
      req,
      aadhaarServiceLogger,
    );
    console.log("maintainanceResponse", maintainanceResponse);
    if (!maintainanceResponse?.result) {
      aadhaarServiceLogger.error(
        `Credit deduction failed for Aadhaar Masked: client ${client_Id}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const isExistAadhaar = await digilockerverify.findOne({
      mobileNumber: mobileNumber,
    });

    const now = new Date();
    const createdTime = now.toLocaleTimeString();
    const createdDate = now.toLocaleDateString();

    const analyticsResult = await AnalyticsDataUpdate(
      client_Id,
      serviceId,
      categoryId,
      "success",
      tnId,
      aadhaarServiceLogger,
    );
    if (!analyticsResult.success) {
      aadhaarServiceLogger.warn(
        `Analytics update failed for Aadhaar Masked: client ${client_Id}, service ${serviceId}`,
      );
    }

    aadhaarServiceLogger.info(
      `Checked for existing Aadhaar record in DB: ${isExistAadhaar ? "Found" : "Not Found"} for this txnId: ${tnId} of client ${client_Id}`,
    );
    aadhaarServiceLogger.info(
      `Returning cached Aadhaar response for client: ${client_Id}`,
    );
    if (isExistAadhaar) {
      const statusOne = isExistAadhaar?.status == 1;
      const noRecord = isExistAadhaar?.status == 3;

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: client_Id,
        TxnID: tnId,
        result: statusOne
          ? isExistAadhaar?.response
          : {
              mobileNumber: mobileNumber,
            },
        createdTime,
        createdDate,
      });

      return res
        .status(statusOne ? 200 : noRecord ? 404 : 400)
        .json(
          createApiResponse(
            statusOne ? 200 : noRecord ? 404 : 400,
            isExistAadhaar?.response,
            statusOne || noRecord ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      aadhaarServiceLogger,
    );
    if (!service.length) {
      aadhaarServiceLogger.warn(
        `Active service not found for Aadhaar Masked category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    const aadhaarResponse = await digilockerVerifyActiveServiceResponse(
      mobileNumber,
      service,
      0,
      client_Id,
    );

    aadhaarServiceLogger.info(
      `Response received from active service ${aadhaarResponse?.service} with message: ${aadhaarResponse?.message} of reponse: ${JSON.stringify(aadhaarResponse)}`,
    );

    if (aadhaarResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const isValid = aadhaarResponse?.message?.toUpperCase() === "VALID";
    const noRecord =
      aadhaarResponse?.message?.toUpperCase() === "NO RECORD FOUND";

    await responseModel.create({
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: client_Id,
      TxnID: tnId,
      result: isValid ? aadhaarResponse?.result : { mobileNumber },
      createdTime,
      createdDate,
    });

    const basePayload = {
      mobileNumber,
      response: isValid ? aadhaarResponse?.result : { mobileNumber },
      serviceName: aadhaarResponse?.service,
      serviceResponse: isValid ? aadhaarResponse?.responseOfService : {},
      createdTime,
      createdDate,
    };

    await digilockerverify.findOneAndUpdate(
      { mobileNumber }, // 🔥 use mobileNumber as filter
      {
        ...basePayload,
        status: isValid ? 1 : noRecord ? 2 : 3,
      },
      { new: true, upsert: true },
    );

    aadhaarServiceLogger.info(
      `Aadhaar ${isValid ? "Valid" : "Invalid"} response sent successfully for client: ${client_Id} with txnId: ${tnId}`,
    );

    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          isValid ? aadhaarResponse?.result : { mobileNumber },
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (err) {
    aadhaarServiceLogger.error(
      `System error in digilocker account verify for client ${client_Id} with txnId: ${tnId}: ${err.message}`,
      err,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      client_Id,
      serviceId,
      categoryId,
      "failed",
      tnId,
      aadhaarServiceLogger,
    );

    if (!analyticsResult?.success) {
      employmentServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: client ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// aadhaar digilocker step 1, step 2
exports.initiateAadhaarDigilocker = async (req, res) => {
  const { callback_url, redirect_url, mobileNumber = "" } = req.body;
  const startTime = new Date();
  aadhaarServiceLogger.info("Aadhaar DigiLocker initiation triggered");

  const storingClient = req.clientId || "CID-6140971541";

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "AADHAAR_DIGILOCKER",
    storingClient,
    aadhaarServiceLogger,
  );

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  const tnId = genrateUniqueServiceId();
  const maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req,
    aadhaarServiceLogger,
  );

  if (!maintainanceResponse?.result) {
    aadhaarServiceLogger.error(
      `Credit deduction failed for Aadhaar verification: client ${storingClient}, txnId ${tnId}`,
    );
    return res.status(500).json({
      success: false,
      message: maintainanceResponse?.message || "Invalid",
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

    if (response?.status === 1) {
      const updatedRecord =
        await adhaarverificationwithotpModel.findOneAndUpdate(
          { ts_trans_id: tsTransId },
          {
            aadhaarDetails,
            status: "verified",
            response,
          },
          { new: true },
        );
      console.log("detailsstores in adhar", updatedRecord);
      aadhaarServiceLogger.info(
        `Aadhaar KYC updated successfully for tsTransId: ${tsTransId}`,
      );
      aadhaarServiceLogger.info(
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
