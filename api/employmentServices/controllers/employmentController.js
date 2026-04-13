const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const {
  decryptData,
  encryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const handleValidation = require("../../../utils/lengthCheck");
const { employmentServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const basicUanModel = require("../models/basicUanModel");
const dualEmplymentCheckModel = require("../models/dualEmplymentCheckModel");
const {
  basicUanActiveServiceResponse,
  form16CheckActiveServiceResponse,
} = require("../service/employmentServiceResp");

exports.handleBasicUanVerify = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  employmentServiceLogger.info(
    `Generated basic uan txn Id: ${tnId} for the client: ${storingClient}`,
  );
  const isValid = handleValidation(
    "uan",
    uanNumber,
    res,
    tnId,
    employmentServiceLogger,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    "All inputs in basic uan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "UAN_BASIC",
    tnId,
    employmentServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    employmentServiceLogger.info(
      `Executing basic uan verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers(
      {
        uanNo: uanNumber,
      },
      employmentServiceLogger,
    );

    const uanRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: employmentServiceLogger,
    });

    if (!uanRateLimitResult.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for basic uan verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: uanRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      employmentServiceLogger
    );

    if (!maintainanceResponse?.result) {
      employmentServiceLogger.error(
        `Credit deduction failed for basic uan verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedUan = encryptData(uanNumber);
    console.log("encryptedUan ====>>", encryptedUan);

    const existingUanNumber = await basicUanModel.findOne({
      uanNumber: encryptedUan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      employmentServiceLogger,
    );
    if (!analyticsResult.success) {
      employmentServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    employmentServiceLogger.info(
      `Checked for existing UAN record in DB: ${existingUanNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );
    if (existingUanNumber) {
      const isValid = existingUanNumber?.status == 1;
      const noRecord = existingUanNumber?.status == 3;
      const resOfUan = existingUanNumber?.response;

      employmentServiceLogger.info(
        `Returning cached ${isValid ? "Valid" : "Invalid"} basic uan response for client: ${storingClient}`,
      );

      const destructuredResponse = {
        ...existingUanNumber?.response,
        uan: uanNumber,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        TxnID: tnId,
        result: isValid ? destructuredResponse : existingUanNumber?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      return res
        .status(isValid ? 200 : noRecord ? 404 : 400)
        .json(
          createApiResponse(
            isValid ? 200 : noRecord ? 404 : 400,
            isValid ? destructuredResponse : existingUanNumber?.response,
            isValid ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      categoryId,
      serviceId,
      storingClient,
      req,
      employmentServiceLogger,
    );

    if (!service?.length) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(500).json({
        ...ERROR_CODES?.SERVER_ERROR,
      });
    }

    employmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let uanNumberResponse = await basicUanActiveServiceResponse(
      uanNumber,
      service,
      0,
      storingClient,
    );

    employmentServiceLogger.info(
      `Response received from active service ${uanNumberResponse?.service}: ${uanNumberResponse?.message}`,
    );

    if (uanNumberResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const message = uanNumberResponse?.message?.toUpperCase();

    const isValid = message === "VALID";
    const isNoRecord = message === "NO RECORD FOUND";
    const isInvalid = !isValid && !isNoRecord;

    const constructedData = {
      uan: encryptedUan,
      result: uanNumberResponse?.result,
    };

    // Common responseModel create
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      TxnID: tnId,
      result: isValid
        ? constructedData
        : isNoRecord
          ? { uanNumber, message: "No Record Found" }
          : { uanNumber },
      createdTime: new Date().toLocaleTimeString(),
      createdDate: new Date().toLocaleDateString(),
    });

    // Prepare storing data
    const storingData = {
      uanNumber: encryptedUan,
      userName: isValid ? uanNumberResponse?.result?.Name : "",
      response: isValid ? constructedData : { uanNumber },
      serviceResponse: uanNumberResponse?.responseOfService,
      status: isValid ? 1 : isNoRecord ? 3 : 2, // 1=valid, 2=invalid, 3=no record
      ...(mobileNumber && { mobileNumber }),
      serviceName: uanNumberResponse?.service,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };

    // Upsert once
    await basicUanModel.findOneAndUpdate(
      { uanNumber: encryptedUan },
      storingData,
      { upsert: true, new: true },
    );

    // Logging + response handling
    if (isValid) {
      employmentServiceLogger.info(
        `Valid basic uan response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, constructedData, "Valid"));
    }

    if (isNoRecord) {
      employmentServiceLogger.info(
        `No record found for basic uan: ${encryptedUan} for this client: ${storingClient}`,
      );

      return res
        .status(404)
        .json(createApiResponse(404, { uanNumber }, "No Record Found"));
    }

    // Invalid case
    employmentServiceLogger.info(
      `Invalid basic uan response received and sent to client: ${storingClient}`,
    );

    return res
      .status(400)
      .json(createApiResponse(400, { uanNumber }, "Invalid"));
  } catch (error) {
    employmentServiceLogger.error(
      `System error in basic uan for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      employmentServiceLogger,
    );

    if (!analyticsResult?.success) {
      employmentServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleDualEmploymentCheck = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", employer = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  employmentServiceLogger.info(
    `Generated dual employment check txn Id: ${tnId} for the value: ${encryptedUan} for the client: ${storingClient}`,
  );
  const isValid = handleValidation(
    "uan",
    uanNumber,
    res,
    tnId,
    employmentServiceLogger,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    `All inputs in dual employment are valid for this client: ${storingClient} continue processing...`,
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DUAL_EMPLOYMENT",
    tnId,
    employmentServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  const encryptedUan = encryptData(uanNumber);

  try {
    employmentServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      uanNo: uanNumber,
    });

    const dualEmploymentRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      logger: employmentServiceLogger,
    });

    if (!dualEmploymentRateLimitResult.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: dualEmploymentRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      employmentServiceLogger
    );

    if (!maintainanceResponse?.result) {
      employmentServiceLogger.error(
        `Credit deduction failed for dual employment with client: ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingUanNumber = await dualEmplymentCheckModel.findOne({
      uanNumber: uanNumber,
      employer: employer,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      employmentServiceLogger,
    );
    if (!analyticsResult.success) {
      employmentServiceLogger.warn(
        `Analytics update failed for dual employment with client: ${storingClient} and service: ${serviceId}`,
      );
    }

    employmentServiceLogger.info(
      `Checked for existing dual employment record in DB: ${existingUanNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );
    if (existingUanNumber) {
      const decryptedUanNumber = decryptData(existingUanNumber?.uanNumber);
      const resOfUan = existingUanNumber?.response;

      if (existingUanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingUanNumber?.response,
          UAN: decryptedUanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          TxnID: tnId,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached valid dual employment response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfUan,
          TxnID: tnId,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached invalid dual employment response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfUan, "Invalid"));
      }
    }

    const service = await selectService(
      categoryId,
      serviceId,
      storingClient,
      req,
      employmentServiceLogger,
    );

    if (!service?.length) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    employmentServiceLogger.info(
      `Active service selected for dual employment check: ${service.serviceFor}`,
    );
    let dualEmploymentResponse = await basicUanActiveServiceResponse(
      { uanNumber, employer },
      service,
      0,
      storingClient,
    );

    employmentServiceLogger.info(
      `Response received from active service ${dualEmploymentResponse?.service} with message: ${dualEmploymentResponse?.message}`,
    );

    if (
      dualEmploymentResponse?.message?.toLowerCase() === "all services failed"
    ) {
      throw new Error("All services failed");
    }

    const message = dualEmploymentResponse?.message?.toUpperCase();

    const isValid = message === "VALID";
    const isNoRecord = message === "NO RECORD FOUND";
    const isInvalid = !isValid && !isNoRecord;

    // Common responseModel create
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      TxnID: tnId,
      result: isValid
        ? dualEmploymentResponse?.result
        : isNoRecord
          ? { uanNumber, message: "No Record Found" }
          : { uanNumber },
      createdTime: new Date().toLocaleTimeString(),
      createdDate: new Date().toLocaleDateString(),
    });

    // Prepare storing data
    const storingData = {
      uanNumber: encryptedUan,
      userName: isValid ? dualEmploymentResponse?.result?.Name : "",
      response: isValid
        ? { ...dualEmploymentResponse?.result, uan: encryptedUan }
        : { uanNumber },
      serviceResponse: dualEmploymentResponse?.responseOfService,
      status: isValid ? 1 : isNoRecord ? 3 : 2, // 1=valid, 2=invalid, 3=no record
      ...(mobileNumber && { mobileNumber }),
      serviceName: dualEmploymentResponse?.service,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };

    // Upsert once
    await basicUanModel.findOneAndUpdate(
      { uanNumber: encryptedUan },
      storingData,
      { upsert: true, new: true },
    );

    // Logging + response handling
    if (isValid) {
      employmentServiceLogger.info(
        `Valid basic uan response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, dualEmploymentResponse?.result, "Valid"));
    }

    if (isNoRecord) {
      employmentServiceLogger.info(
        `No record found for basic uan: ${encryptedUan} for this client: ${storingClient}`,
      );

      return res
        .status(404)
        .json(createApiResponse(404, { uanNumber }, "No Record Found"));
    }

    // Invalid case
    employmentServiceLogger.info(
      `Invalid basic uan response received and sent to client: ${storingClient}`,
    );

    return res
      .status(400)
      .json(createApiResponse(400, { uanNumber }, "Invalid"));
  } catch (error) {
    employmentServiceLogger.error(
      `System error in mobile to uan for client ${storingClient}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      employmentServiceLogger,
    );

    if (!analyticsResult?.success) {
      employmentServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: client ${storingClient}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleForm16Verification = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  employmentServiceLogger.info(
    `Generated form 16 verification txn Id: ${tnId} for the client: ${storingClient}`,
  );
  const isValid = handleValidation(
    "mobileToUan",
    mobileNumber,
    res,
    tnId,
    employmentServiceLogger,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "UAN_BASIC",
    tnId,
    employmentServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    employmentServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers(
      {
        mobileNo: mobileNumber,
      },
      employmentServiceLogger,
    );

    const form16ValidationRateLimit = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!form16ValidationRateLimit.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: form16ValidationRateLimit.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
      employmentServiceLogger
    );

    if (!maintainanceResponse?.result) {
      employmentServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingPanNumber = await basicUanModel.findOne({
      mobileNumber,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      employmentServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    employmentServiceLogger.info(
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
          TxnID: tnId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service?.length) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    employmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await form16CheckActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    employmentServiceLogger.info(
      `Response received from active service ${panNumberResponse?.service}: ${panNumberResponse?.message}`,
    );

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
        mobileNumber,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      employmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber, ...findingInValidResponses("panBasic") },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: findingInValidResponses("panBasic"),
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      employmentServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { uanNumber: uanNumber }, "Invalid"));
    }
  } catch (error) {
    employmentServiceLogger.error(
      `System error in mobile to uan for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
