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

exports.handleDomainVerification = async (req, res) => {
  const data = req.body;
  const { domain, emailAddress, mobileNumber = "" } = data;
  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  riskServiceLogger.info(
    `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
  );

  if (!domain || !emailAddress) {
    res.status(400).json({
      ...ERROR_CODES?.BAD_REQUEST,
      response: `Required values are Missing 🤦‍♂️`,
    });
  }

  const isValid = handleValidation(
    "email",
    emailAddress,
    res,
    tnId,
    riskServiceLogger,
  );

  if (!isValid) return;
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
    let identifierHash;
    if (domain) {
      identifierHash = hashIdentifiers(
        {
          domain: domain,
        },
        riskServiceLogger,
      );
    } else {
      identifierHash = hashIdentifiers(
        {
          email: emailAddress,
        },
        riskServiceLogger,
      );
    }

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
       existingDomain = await panverificationModel.findOne({
        panNumber: encryptedValue,
      });
    } else {
        existingDomain = await panverificationModel.findOne({
        panNumber: encryptedValue,
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
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing domain verify record in DB: ${existingDomain ? "Found" : "Not Found"}`,
    );
    if (existingDomain) {
      const decryptedPanNumber = decryptData(existingDomain?.panNumber);
      const resOfPan = existingDomain?.response;

      if (existingDomain?.status == 1) {
        const decryptedResponse = {
          ...existingDomain?.response
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    riskServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from pan verification active service ${panNumberResponse?.service} with message: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, panNumberResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { pan: panNumber }, "Invalid"));
    }
  } catch (error) {
    riskServiceLogger.error(
      `System error in PAN verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
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

  const isValid = handleValidation("email", emailAddress, res, storingClient);

  if (!isValid) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DOMAIN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    riskServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    riskServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // Common: hash identifier
    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panRateLimitResult.allowed) {
      riskServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      "PANSERVICES",
      tnId,
      req,
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

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      riskServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    riskServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from pan verification active service ${panNumberResponse?.service} with message: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, panNumberResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { pan: panNumber }, "Invalid"));
    }
  } catch (error) {
    riskServiceLogger.error(
      `System error in PAN verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleDomainVerification = async (req, res) => {
  const data = req.body;
  const { domain, emailAddress, mobileNumber = "" } = data;
  const storingClient = req.clientId;

  const isValid = handleValidation("email", emailAddress, res, storingClient);

  if (!isValid) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DOMAIN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    riskServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    riskServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // Common: hash identifier
    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panRateLimitResult.allowed) {
      riskServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      "PANSERVICES",
      tnId,
      req,
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

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      riskServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    riskServiceLogger.info(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        riskServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      riskServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    riskServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    riskServiceLogger.info(
      `Response received from pan verification active service ${panNumberResponse?.service} with message: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, panNumberResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      riskServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { pan: panNumber }, "Invalid"));
    }
  } catch (error) {
    riskServiceLogger.error(
      `System error in PAN verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
    );

    if (!analyticsResult?.success) {
      riskServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
