const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const { employmentServiceLogger } = require("../../Logger/logger");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const basicUanModel = require("../models/basicUanModel");
const {
  basicUanActiveServiceResponse,
} = require("../service/employmentServiceResp");

exports.handleBasicUanVerify = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  const isValid = handleValidation(
    "mobileToUan",
    mobileNumber,
    res,
    storingClient,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "UAN_BASIC",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    employmentServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    employmentServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      mobileNo: mobileNumber,
    });

    const mobileToUanRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!mobileToUanRateLimitResult.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: mobileToUanRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
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

    const existingUanNumber = await basicUanModel.findOne({
      uanNumber,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
    );
    if (!analyticsResult.success) {
      employmentServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    employmentServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingUanNumber ? "Found" : "Not Found"}`,
    );
    if (existingUanNumber) {
      const decryptedPanNumber = decryptData(existingUanNumber?.uanNumber);
      const resOfUan = existingUanNumber?.response;

      if (existingUanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingUanNumber?.response,
          UAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
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
          result: resOfUan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfUan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    employmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let uanNumberResponse = await basicUanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    employmentServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${uanNumberResponse?.message}`,
    );

    // if (uanNumberResponse?.message?.toUpperCase() == "VALID") {
    //   const encryptedPan = encryptData(uanNumberResponse?.result?.PAN);
    //   const encryptedResponse = {
    //     ...uanNumberResponse?.result,
    //     PAN: encryptedPan,
    //   };

    //   await responseModel.create({
    //     serviceId,
    //     categoryId,
    //     clientId: storingClient,
    //     result: uanNumberResponse?.result,
    //     createdTime: new Date().toLocaleTimeString(),
    //     createdDate: new Date().toLocaleDateString(),
    //   });

    //   const storingData = {
    //     panNumber: encryptedPan,
    //     userName: uanNumberResponse?.result?.Name,
    //     response: encryptedResponse,
    //     serviceResponse: uanNumberResponse?.responseOfService,
    //     status: 1,
    //     mobileNumber,
    //     serviceName: uanNumberResponse?.service,
    //     createdDate: new Date().toLocaleDateString(),
    //     createdTime: new Date().toLocaleTimeString(),
    //   };

    //   await panverificationModel.create(storingData);
    //   employmentServiceLogger.info(
    //     `Valid PAN response stored and sent to client: ${storingClient}`,
    //   );

    //   return res
    //     .status(200)
    //     .json(createApiResponse(200, response?.result, "Valid"));
    // } else {
    //   await responseModel.create({
    //     serviceId,
    //     categoryId,
    //     clientId: storingClient,
    //     result: { uanNumber: uanNumber },
    //     createdTime: new Date().toLocaleTimeString(),
    //     createdDate: new Date().toLocaleDateString(),
    //   });
    //   const storingData = {
    //     uanNumber: encryptedPan,
    //     userName: "",
    //     response: { uanNumber: uanNumber },
    //     serviceResponse: uanNumberResponse?.responseOfService,
    //     status: 2,
    //     mobileNumber,
    //     serviceName: uanNumberResponse?.service,
    //     createdDate: new Date().toLocaleDateString(),
    //     createdTime: new Date().toLocaleTimeString(),
    //   };
    //   await panverificationModel.create(storingData);
    //   employmentServiceLogger.info(
    //     `Invalid PAN response received and sent to client: ${storingClient}`,
    //   );
    //   return res
    //     .status(404)
    //     .json(createApiResponse(404, { uanNumber: uanNumber }, "Invalid"));
    // }

    if (uanNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...uanNumberResponse?.result,
        PAN: encryptedUan,
      };

      // KEEP THIS AS CREATE
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: uanNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedUan,
        userName: uanNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: uanNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: uanNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      // CHANGED HERE
      await basicUanModel.findOneAndUpdate({ mobileNumber }, storingData, {
        upsert: true,
        new: true,
      });

      employmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      // KEEP THIS AS CREATE
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { uanNumber: uanNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        uanNumber: encryptedUan,
        userName: "",
        response: { uanNumber: uanNumber },
        serviceResponse: uanNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: uanNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      // CHANGED HERE
      await basicUanModel.findOneAndUpdate({ mobileNumber }, storingData, {
        upsert: true,
        new: true,
      });

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
        const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
    );

    if (!analyticsResult?.success) {
      employmentServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleDualEmploymentCheck = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  const isValid = handleValidation(
    "mobileToUan",
    mobileNumber,
    res,
    storingClient,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "UAN_BASIC",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    employmentServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    employmentServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      mobileNo: mobileNumber,
    });

    const mobileToUanRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!mobileToUanRateLimitResult.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: mobileToUanRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
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

    const existingUanNumber = await basicUanModel.findOne({
      uanNumber,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
    );
    if (!analyticsResult.success) {
      employmentServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    employmentServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingUanNumber ? "Found" : "Not Found"}`,
    );
    if (existingUanNumber) {
      const decryptedPanNumber = decryptData(existingUanNumber?.uanNumber);
      const resOfUan = existingUanNumber?.response;

      if (existingUanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingUanNumber?.response,
          UAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
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
          result: resOfUan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        employmentServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfUan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    employmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let uanNumberResponse = await basicUanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    employmentServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${uanNumberResponse?.message}`,
    );

    // if (uanNumberResponse?.message?.toUpperCase() == "VALID") {
    //   const encryptedPan = encryptData(uanNumberResponse?.result?.PAN);
    //   const encryptedResponse = {
    //     ...uanNumberResponse?.result,
    //     PAN: encryptedPan,
    //   };

    //   await responseModel.create({
    //     serviceId,
    //     categoryId,
    //     clientId: storingClient,
    //     result: uanNumberResponse?.result,
    //     createdTime: new Date().toLocaleTimeString(),
    //     createdDate: new Date().toLocaleDateString(),
    //   });

    //   const storingData = {
    //     panNumber: encryptedPan,
    //     userName: uanNumberResponse?.result?.Name,
    //     response: encryptedResponse,
    //     serviceResponse: uanNumberResponse?.responseOfService,
    //     status: 1,
    //     mobileNumber,
    //     serviceName: uanNumberResponse?.service,
    //     createdDate: new Date().toLocaleDateString(),
    //     createdTime: new Date().toLocaleTimeString(),
    //   };

    //   await panverificationModel.create(storingData);
    //   employmentServiceLogger.info(
    //     `Valid PAN response stored and sent to client: ${storingClient}`,
    //   );

    //   return res
    //     .status(200)
    //     .json(createApiResponse(200, response?.result, "Valid"));
    // } else {
    //   await responseModel.create({
    //     serviceId,
    //     categoryId,
    //     clientId: storingClient,
    //     result: { uanNumber: uanNumber },
    //     createdTime: new Date().toLocaleTimeString(),
    //     createdDate: new Date().toLocaleDateString(),
    //   });
    //   const storingData = {
    //     uanNumber: encryptedPan,
    //     userName: "",
    //     response: { uanNumber: uanNumber },
    //     serviceResponse: uanNumberResponse?.responseOfService,
    //     status: 2,
    //     mobileNumber,
    //     serviceName: uanNumberResponse?.service,
    //     createdDate: new Date().toLocaleDateString(),
    //     createdTime: new Date().toLocaleTimeString(),
    //   };
    //   await panverificationModel.create(storingData);
    //   employmentServiceLogger.info(
    //     `Invalid PAN response received and sent to client: ${storingClient}`,
    //   );
    //   return res
    //     .status(404)
    //     .json(createApiResponse(404, { uanNumber: uanNumber }, "Invalid"));
    // }

    if (uanNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...uanNumberResponse?.result,
        PAN: encryptedUan,
      };

      // KEEP THIS AS CREATE
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: uanNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedUan,
        userName: uanNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: uanNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: uanNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      // CHANGED HERE
      await basicUanModel.findOneAndUpdate({ mobileNumber }, storingData, {
        upsert: true,
        new: true,
      });

      employmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      // KEEP THIS AS CREATE
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { uanNumber: uanNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        uanNumber: encryptedUan,
        userName: "",
        response: { uanNumber: uanNumber },
        serviceResponse: uanNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: uanNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      // CHANGED HERE
      await basicUanModel.findOneAndUpdate({ mobileNumber }, storingData, {
        upsert: true,
        new: true,
      });

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
        const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
    );

    if (!analyticsResult?.success) {
      employmentServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
}

exports.handleForm16Verification = async (req, res) => {
  const data = req.body;
  const { uanNumber = "", mobileNumber = "" } = data;

  const storingClient = req.clientId;
  const isValid = handleValidation(
    "mobileToUan",
    mobileNumber,
    res,
    storingClient,
  );
  if (!isValid) return;

  employmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "UAN_BASIC",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    employmentServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    employmentServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      mobileNo: mobileNumber,
    });

    const mobileToUanRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!mobileToUanRateLimitResult.allowed) {
      employmentServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: mobileToUanRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
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

    employmentServiceLogger.debug(
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

    if (!service) {
      employmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    employmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    employmentServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${panNumberResponse?.message}`,
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
        serviceId: `${panNumberResponse?.service}_panBasic`,
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
        serviceId: `${panNumberResponse?.service}_panBasic`,
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
