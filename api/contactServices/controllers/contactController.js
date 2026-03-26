const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const {
  mobileToPanActiveServiceResponse,
  mobileToUanActiveServiceResponse,
} = require("../service/contactServicesResp");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const handleValidation = require("../../../utils/lengthCheck");
const { deductCredits } = require("../../../services/CreditService");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");

const handleMobileReusbale = async (req, res, model, activeService) => {
  const data = req.body;
  const { mobileNumber = "" } = data;
  const storingClient = req.clientId;

    const isValid = handleValidation("mobile", mobileNumber, res, storingClient);
  if (!isValid) return;

};

exports.handleMobileToPanVerify = async (req, res) => {
  const data = req.body;
  const { mobileNumber = "" } = data;
  const storingClient = req.clientId;
  const isValid = handleValidation("mobile", mobileNumber, res, storingClient);
  if (!isValid) return;

  contactServiceLogger.info(
    `All inputs in mobile to pan are valid, continue processing... for this client: ${storingClient}`,
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "MOBILE_TO_PAN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(`Generated PAN Mobile txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for PAN Mobile verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingMobileNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      contactServiceLogger.warn(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingMobileNumber) {
      if (existingMobileNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingMobileNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res.status(200).json(
          createApiResponse(
            200,
            {
              mobileNumber: mobileNumber,
            },
            "Valid",
          ),
        );
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            pan: panNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.status(404).json(
          createApiResponse(
            404,
            {
              mobileNumber: mobileNumber,
            },
            "InValid",
          ),
        );
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await mobileToPanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          mobileNumber: mobileNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            mobileNumber: mobileNumber,
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    contactServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleMobileToUanVerify = async (req, res) => {
  const data = req.body;
  const { mobileNumber = "" } = data;
  const storingClient = req.clientId;
  const isValid = handleValidation("mobile", mobileNumber, res);
  if (!isValid) return;

  contactServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "MOBILE_TO_UAN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(`Generated PAN Mobile txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for PAN Mobile verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingMobileNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      contactServiceLogger.warn(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingMobileNumber) {
      if (existingMobileNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingMobileNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          success: true,
          data: existingMobileNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            uanNumber: uanNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            mobileNumber: mobileNumber,
            ...findingInValidResponses("panNameDob"),
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await mobileToUanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
          ...findingInValidResponses("panNameDob"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    contactServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleAdvanceMobileDataOtp = async (req, res) => {
  const data = req.body;
  const { mobileNumber = "" } = data;
  const storingClient = req.clientId;
  const isValid = handleValidation("mobile", mobileNumber, res);
  if (!isValid) return;

  contactServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "MOBILE_TO_UAN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(`Generated PAN Mobile txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for PAN Mobile verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingMobileNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      contactServiceLogger.warn(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingMobileNumber) {
      if (existingMobileNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingMobileNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          success: true,
          data: existingMobileNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            uanNumber: uanNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            mobileNumber: mobileNumber,
            ...findingInValidResponses("panNameDob"),
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await mobileToUanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
          ...findingInValidResponses("panNameDob"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    contactServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleAdvanceMobileDataOtpVerify = async (req, res) => {
  const data = req.body;
  const { mobileNumber = "" } = data;
  const storingClient = req.clientId;
  const isValid = handleValidation("mobile", mobileNumber, res);
  if (!isValid) return;

  contactServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "MOBILE_TO_UAN",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(`Generated PAN Mobile txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for PAN Mobile verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingMobileNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      contactServiceLogger.warn(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingMobileNumber) {
      if (existingMobileNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingMobileNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          success: true,
          data: existingMobileNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            uanNumber: uanNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        contactServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            mobileNumber: mobileNumber,
            ...findingInValidResponses("panNameDob"),
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await mobileToUanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
          ...findingInValidResponses("panNameDob"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      contactServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    contactServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
