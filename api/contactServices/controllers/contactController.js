const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const {
  mobileToPanActiveServiceResponse,
  mobileToUanActiveServiceResponse,
  advanceMobileDataOtpActiveServiceResponse,
  advanceMobileDataOtpVerifyActiveServiceResponse,
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
const mobileToPanModel = require("../models/mobileToPanModel");
const mobileToUanModel = require("../models/mobileToUanModel");
const { contactServiceLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");

async function handleMobileVerification({
  req,
  res,
  serviceKey,
  activeServiceFn,
  model,
}) {
  const { mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const txnId = genrateUniqueServiceId();

  if (
    !handleValidation("mobile", mobileNumber, res, txnId, contactServiceLogger)
  )
    return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    serviceKey,
    txnId,
    contactServiceLogger,
  );

  const now = new Date();
  const createdTime = now.toLocaleTimeString();
  const createdDate = now.toLocaleDateString();

  try {
    const identifierHash = hashIdentifiers({ mobileNumber }, contactServiceLogger);

    const rateLimit = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
      req,
      TxnID: txnId,
      logger: contactServiceLogger,
    });

    if (!rateLimit.allowed) {
      return res
        .status(429)
        .json({ success: false, message: rateLimit.message });
    }

    const credits = await deductCredits(
      clientId,
      idOfService,
      idOfCategory,
      txnId,
      req,
      contactServiceLogger,
    );

    if (!credits?.result) {
      return res
        .status(500)
        .json({ success: false, message: credits?.message });
    }

    const existing = await model.findOne({ mobileNumber: mobileNumber });

    contactServiceLogger.info(
      `Checked for existing record for service: ${serviceKey} in DB: ${existing ? "Found" : "Not Found"} for this client: ${clientId}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
      "success",
      txnId,
      contactServiceLogger,
    );

    if (!analyticsResult?.success) {
      contactServiceLogger.info(
        `[FAILED]: Analytics update failed for service: ${serviceKey} client ${clientId}, service ${idOfService}`,
      );
    }

    if (existing) {
      contactServiceLogger.info(
        `Existing Response sent for service: ${serviceKey} client ${clientId}, service ${idOfService}`,
      );
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        TxnID: txnId,
        result: existing.status === 1 ? existing?.response : { mobileNumber },
        createdTime,
        createdDate,
      });
      return res
        .status(existing.status === 1 ? 200 : 404)
        .json(
          createApiResponse(
            existing.status === 1 ? 200 : 404,
            existing.status === 1 ? existing?.response : { mobileNumber },
            existing.status === 1 ? "Valid" : "Invalid",
          ),
        );
    }

    const service = await selectService(
      idOfCategory,
      idOfService,
      txnId,
      req,
      contactServiceLogger,
    );
    if (!service.length) return res.status(404).json(ERROR_CODES.NOT_FOUND);

    const contactResponse = await activeServiceFn(mobileNumber, service, 0);

    contactServiceLogger.info(
      `Response received from active service ${contactResponse?.service} for service: ${serviceKey} with message: ${contactResponse?.message} of response: ${JSON.stringify(contactResponse)}`,
    );

    if (contactResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const isValid = contactResponse?.message?.toUpperCase() === "VALID";

    await responseModel.create({
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
      TxnID: txnId,
      result: isValid ? contactResponse?.result : { mobileNumber },
      createdTime,
      createdDate,
    });

    // 🔁 Replace create with findOneAndUpdate
    const filter = { mobileNumber };

    const update = {
      $set: {
        response: contactResponse?.result,
        status: isValid ? 1 : 2,
        serviceName: contactResponse?.service,
        serviceResponse: contactResponse?.responseOfService,
        createdDate,
        createdTime,
      },
      $setOnInsert: {
        mobileNumber,
      },
    };

    try {
      await model.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate case → fetch existing record
        await model.findOne({ mobileNumber });
      } else {
        throw err;
      }
    }

    contactServiceLogger.info(
      `${
        isValid ? "Valid" : "Invalid"
      } ${serviceKey} response stored and sent to client: ${clientId}`,
    );

    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          contactResponse?.result || { mobileNumber },
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
      "failed",
      txnId,
      contactServiceLogger,
    );

    if (!analyticsResult?.success) {
      contactServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: client ${clientId}, service ${idOfService}`,
      );
    }
    const err = mapError(error);
    return res.status(err.httpCode).json(err);
  }
}

exports.handleMobileToPanVerify = (req, res) =>
  handleMobileVerification({
    req,
    res,
    serviceKey: "MOBILE_TO_PAN",
    activeServiceFn: mobileToPanActiveServiceResponse,
    model: mobileToPanModel,
  });

exports.handleMobileToUanVerify = (req, res) =>
  handleMobileVerification({
    req,
    res,
    serviceKey: "MOBILE_TO_UAN",
    activeServiceFn: mobileToUanActiveServiceResponse,
    model: mobileToUanModel,
  });

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
    "ADVANCE_MOBILE_DATA",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing advance mobile data search for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const advanceMobileRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!advanceMobileRateLimitResult.allowed) {
      contactServiceLogger.warn(
        `Rate limit exceeded for advance mobile data search: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: advanceMobileRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    contactServiceLogger.info(
      `Generated advance mobile data search txn Id: ${tnId}`,
    );

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      contactServiceLogger.error(
        `Credit deduction failed for advance mobile data search: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingMobileNumber = await panNameDob.findOne({
      mobileNumber: encryptedPan,
    });

    contactServiceLogger.info(
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

    const service = await selectService(categoryId, serviceId);

    if (!service.length) {
      contactServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    contactServiceLogger.info(
      `Active service selected for advance mobile data search: ${JSON.stringify(service)}`,
    );
    const response = await advanceMobileDataOtpActiveServiceResponse(
      mobileNumber,
      service,
      0,
    );

    contactServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        mobileNumber: mobileNumber,
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
          "Invalid",
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
  const { otp = "", transactionId = "" } = data;
  const storingClient = req.clientId;
  const isValid = handleValidation("otp", otp, res, storingClient);
  if (!isValid) return;

  contactServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "ADVANCE_MOBILE_DATA",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    contactServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
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
    const response = await advanceMobileDataOtpVerifyActiveServiceResponse(
      otp,
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
        `Valid advance mobile data search response stored and sent to client: ${storingClient}`,
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
        mobileNumber: encryptedPan,
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
          "Invalid",
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
