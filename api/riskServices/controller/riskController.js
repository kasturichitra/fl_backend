const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { riskServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const profileAdvanceModel = require("../models/profileAdvanceModel");
const courtRecordModel = require("../models/courtRecordModel");
const {
  domainVerifyActiveServiceResponse,
  courtRecordCheckServiceResponse,
  advanceProfileServiceResponse,
} = require("../service/riskServicesResp");
const domainVerificationModel = require("../models/domainVerificationModel");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");

exports.handleDomainVerification = async (req, res) => {
  const data = req.body;
  const { domain = "", emailAddress = "", mobileNumber = "" } = data;
  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  riskServiceLogger.info(
    `Generated DOMAIN txn Id: ${tnId} for the client: ${storingClient}`,
  );

  if (!domain && !emailAddress) {
    return res.status(400).json({
      ...ERROR_CODES?.BAD_REQUEST,
      response: `Required values are Missing 🤦‍♂️`,
    });
  }

  if (emailAddress) {
    const isValid = handleValidation(
      "email",
      emailAddress,
      res,
      tnId,
      riskServiceLogger,
    );

    if (!isValid) return;
  }
  if (domain) {
    const isValid = handleValidation(
      "domain",
      domain,
      res,
      tnId,
      riskServiceLogger,
    );
    if (!isValid) return;
  }
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DOMAIN",
    tnId,
    riskServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    riskServiceLogger.info(
      `Executing domain verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Common: hash identifier

    const identifierHash = hashIdentifiers(
      domain ? { domain } : { email: emailAddress },
      riskServiceLogger,
    );

    const domainRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: riskServiceLogger,
    });

    if (!domainRateLimitResult.allowed) {
      riskServiceLogger.warn(
        `Rate limit exceeded for domain verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: domainRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      riskServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    let encryptedValue;
    if (domain) {
      encryptedValue = encryptData(domain);
    } else {
      encryptedValue = encryptData(emailAddress);
    }

    let existingDomain;
    if (domain) {
      existingDomain = await domainVerificationModel.findOne({
        domain: encryptedValue,
      });
    } else {
      existingDomain = await domainVerificationModel.findOne({
        emailAddress: encryptedValue,
      });
    }

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      riskServiceLogger,
    );
    if (!analyticsResult.success) {
      riskServiceLogger.warn(
        `Analytics update failed for domain verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing domain verify record in DB: ${existingDomain ? "Found" : "Not Found"}`,
    );
    const now = new Date();
    const createdDate = now.toLocaleDateString();
    const createdTime = now.toLocaleTimeString();

    if (existingDomain) {
      const isValid = existingDomain?.status === 1;

      const responseData = existingDomain?.response;

      // ✅ Always store response
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: responseData,
        createdDate,
        createdTime,
      });

      riskServiceLogger.info(
        `Returning cached ${isValid ? "valid" : "invalid"} PAN response for client: ${storingClient}`,
      );

      return res
        .status(isValid ? 200 : 404)
        .json(
          createApiResponse(
            isValid ? 200 : 404,
            responseData,
            isValid ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!service?.length) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    riskServiceLogger.info(
      `Active service selected for domain verification: ${service.serviceFor}`,
    );
    const confirmedData = domain
      ? { domain: domain, emailAddress: "" }
      : emailAddress
        ? { emailAddress: emailAddress, domain: "" }
        : {};

    let domainResponse = await domainVerifyActiveServiceResponse(
      confirmedData,
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from pan verification active service ${domainResponse?.service} with message: ${domainResponse?.message}`,
    );

    if (domainResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const isValid = domainResponse?.message?.toUpperCase() === "VALID";

    const resultData = isValid
      ? domainResponse?.result
      : { emailAddress, domain };

    // ✅ Always CREATE response log
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result: resultData,
      TxnID: tnId,
      createdDate,
      createdTime,
    });

    // ✅ Decide unique condition dynamically
    const query = emailAddress ? { emailAddress } : { domain };

    // ✅ Prepare storing data
    const storingData = {
      ...(emailAddress ? { emailAddress } : { domain }),
      response: resultData,
      serviceResponse: isValid ? domainResponse?.responseOfService : {},
      status: isValid ? 1 : 2,
      ...(mobileNumber && { mobileNumber }),
      serviceName: domainResponse?.service,
      createdDate,
      createdTime,
    };

    // ✅ Upsert based on available field
    await domainVerificationModel.findOneAndUpdate(query, storingData, {
      upsert: true,
      new: true,
    });

    riskServiceLogger.info(
      `${isValid ? "Valid" : "Invalid"} domain verify response stored and sent to client: ${storingClient}`,
    );

    // ✅ Return response
    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          resultData,
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    riskServiceLogger.error(
      `System error in domain verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      riskServiceLogger,
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for domain Verification: clientId ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleAdvanceProfile = async (req, res) => {
  const data = req.body;
  const { mobileNumber } = data;
  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  riskServiceLogger.info(
    `Generated profile advance txn Id: ${tnId} for the client: ${storingClient}`,
  );

  const isValid = handleValidation(
    "mobile",
    mobileNumber,
    res,
    tnId,
    riskServiceLogger,
  );

  if (!isValid) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PROFILE_ADVANCE",
    tnId,
    riskServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    riskServiceLogger.info(
      `Executing profile advance verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Common: hash identifier
    const identifierHash = hashIdentifiers(
      {
        mobile: mobileNumber,
      },
      riskServiceLogger,
    );

    const profileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: riskServiceLogger,
    });

    if (!profileRateLimitResult.allowed) {
      riskServiceLogger.warn(
        `Rate limit exceeded for profile advance verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: profileRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      riskServiceLogger.error(
        `Credit deduction failed for profile advance verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingProfileData = await profileAdvanceModel.findOne({
      mobileNumber: mobileNumber,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      riskServiceLogger,
    );
    if (!analyticsResult.success) {
      riskServiceLogger.warn(
        `Analytics update failed for profile advance verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing profile advance record in DB: ${existingProfileData ? "Found" : "Not Found"}`,
    );
    const now = new Date();
    const createdTime = now.toLocaleTimeString();
    const createdDate = now.toLocaleDateString();
    if (existingProfileData) {
      const { status, response } = existingProfileData;

      const isValid = status === 1;
      const resultData = isValid ? { ...response } : response;

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        TxnID: tnId,
        result: resultData,
        createdTime,
        createdDate,
      });

      riskServiceLogger.info(
        `Returning cached ${isValid ? "valid" : "invalid"} PAN response for client: ${storingClient}`,
      );

      return res
        .status(isValid ? 200 : 404)
        .json(
          createApiResponse(
            isValid ? 200 : 404,
            resultData,
            isValid ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!service?.length) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    riskServiceLogger.info(
      `Active service selected for profile advance verification: ${service.serviceFor}`,
    );
    let profileResponse = await advanceProfileServiceResponse(
      mobileNumber,
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from advance profile active service ${profileResponse?.service} with message: ${profileResponse?.message}`,
    );

    if (profileResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const isValid = profileResponse?.message?.toUpperCase() === "VALID";

    const resultData = isValid
      ? { ...profileResponse?.result }
      : { mobileNumber };

    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result: isValid ? profileResponse?.result : resultData,
      createdTime,
      createdDate,
    });

    const storingData = {
      mobileNumber,
      response: resultData,
      serviceResponse: isValid ? profileResponse?.responseOfService : {},
      status: isValid ? 1 : 2,
      serviceName: profileResponse?.service,
      createdDate,
      createdTime,
    };

    await profileAdvanceModel.findOneAndUpdate(
      {
        mobileNumber,
      },
      storingData,
      { upsert: true, new: true },
    );

    riskServiceLogger.info(
      `${isValid ? "Valid" : "Invalid"} profile advance response stored and sent
      } to client: ${storingClient}`,
    );

    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          resultData,
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    riskServiceLogger.error(
      `System error in PAN verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      riskServiceLogger,
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleCourtRecords = async (req, res) => {
  const data = req.body;
  const { recordName, address, mobileNumber = "" } = data;
  const storingClient = req.clientId;

  if (!recordName || !address) {
    res.status(400).json({
      ...ERROR_CODES?.BAD_REQUEST,
      response: `Required values are Missing 🤦‍♂️`,
    });
  }
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  riskServiceLogger.info(
    `Generated court record check txn Id: ${tnId} for the client: ${storingClient}`,
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "COURT_CASE",
    tnId,
    riskServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    riskServiceLogger.info(
      `Executing court record check for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Common: hash identifier
    const identifierHash = hashIdentifiers(
      {
        name: recordName,
        address: address,
      },
      riskServiceLogger,
    );

    const courtRecordRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: riskServiceLogger,
    });

    if (!courtRecordRateLimitResult.allowed) {
      riskServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: courtRecordRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      riskServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingCourtRecordData = await courtRecordModel.findOne({
      recordName: recordName,
      address: address,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      riskServiceLogger,
    );
    if (!analyticsResult.success) {
      riskServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing court record check record in DB: ${existingCourtRecordData ? "Found" : "Not Found"}`,
    );

    const now = new Date();
    const createdTime = now.toLocaleTimeString();
    const createdDate = now.toLocaleDateString();

    if (existingCourtRecordData) {
      const resOfcourtRecord = existingCourtRecordData?.response;
      const isValid = existingCourtRecordData?.status == 1;

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        TxnID: tnId,
        result: resOfcourtRecord,
        createdTime,
        createdDate,
      });

      riskServiceLogger.info(
        `Returning cached ${isValid ? "valid" : "Invalid"} court record check response for client: ${storingClient}`,
      );

      return res
        .status(isValid ? 200 : 404)
        .json(
          createApiResponse(
            isValid ? 200 : 404,
            resOfcourtRecord,
            isValid ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      riskServiceLogger,
    );

    if (!service?.length) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    let courtRecordResponse = await courtRecordCheckServiceResponse(
      { address, recordName },
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from court record check active service ${courtRecordResponse?.service} with message: ${courtRecordResponse?.message} and response: ${courtRecordResponse}`,
    );

    if (courtRecordResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const isValid = courtRecordResponse?.message?.toUpperCase() === "VALID";

    const resultData = isValid
      ? { ...courtRecordResponse?.result }
      : { address: address, recordName: recordName };

    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result: resultData,
      TxnID: tnId,
      createdTime,
      createdDate,
    });

    // storing data
    const storingData = {
      address,
      recordName,
      response: resultData,
      serviceResponse: courtRecordResponse?.responseOfService,
      status: isValid ? 1 : 2,
      ...(mobileNumber && { mobileNumber }),
      serviceName: courtRecordResponse?.service,
      createdDate,
      createdTime,
    };

    // only this changed to findOneAndUpdate
    await courtRecordModel.findOneAndUpdate(
      {
        address,
        recordName,
      },
      storingData,
      { upsert: true, new: true },
    );

    riskServiceLogger.info(
      `${isValid ? "Valid" : "Invalid"} court record response stored and sent to client: ${storingClient} fot this txnId: ${tnId}`,
    );

    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          resultData,
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    riskServiceLogger.error(
      `System error in court record check for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      riskServiceLogger,
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for court record check for this clientId ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
