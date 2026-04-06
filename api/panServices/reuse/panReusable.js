const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { panServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");

const STATUS = {
  VALID: 1,
  INVALID: 2,
};

const SERVICE_TYPES = {
  PAN_BASIC: "PAN_BASIC",
  PAN_TO_AADHAAR: "PAN_TO_AADHAAR",
  PAN_TO_GST: "PAN_TO_GST",
  PAN_TO_GST_IN: "PAN_TO_GST_IN_NUBER",
  PAN_TO_FATHER_NAME: "PAN_TO_FATHER_NAME",
};

const panCrypto = {
  encrypt: (pan) => encryptData(pan),
  decrypt: (pan) => decryptData(pan),
};

const getCurrentTime = () => {
  const now = new Date();
  return {
    createdTime: now.toLocaleTimeString(),
    createdDate: now.toLocaleDateString(),
  };
};

async function logResponse({ serviceId, categoryId, clientId, result, txnId }) {
  const { createdTime, createdDate } = getCurrentTime();

  return responseModel.create({
    serviceId,
    categoryId,
    clientId,
    result,
    TxnID: txnId,
    createdTime,
    createdDate,
  });
}

const buildInvalidResponse = (pan, extra = {}) => ({
  pan,
  ...extra,
});

async function handleBillingAndRateLimit({
  pan,
  serviceId,
  categoryId,
  clientId,
  req,
  txnId
}) {
  const identifierHash = hashIdentifiers({ panNo: pan }, panServiceLogger);

  const rateLimit = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId,
    req,
    txnId,
    logger: panServiceLogger
  });

  if (!rateLimit.allowed) {
    return {
      error: {
        status: 429,
        body: {
          success: false,
          message: rateLimit.message,
        },
      },
    };
  }


  const billing = await deductCredits(
    clientId,
    serviceId,
    categoryId,
    txnId,
    req,
    panServiceLogger
  );

  if (!billing?.result) {
    return {
      error: {
        status: 500,
        body: {
          success: false,
          message: billing?.message || "Billing failed",
        },
      },
    };
  }

  return { txnId };
}

async function handleCacheHit({
  existingRecord,
  res,
  serviceId,
  categoryId,
  clientId,
}) {
  const decryptedPan = panCrypto.decrypt(existingRecord.panNumber);
  const { createdTime, createdDate } = getCurrentTime();

  if (existingRecord.status === STATUS.VALID) {
    const response = {
      ...existingRecord.response,
      PAN: decryptedPan,
    };

    await responseModel.create({
      serviceId,
      categoryId,
      clientId,
      result: response,
      createdTime,
      createdDate,
    });

    return res.status(200).json(createApiResponse(200, response, "Valid"));
  }

  await responseModel.create({
    serviceId,
    categoryId,
    clientId,
    result: existingRecord.response,
    createdTime,
    createdDate,
  });

  return res
    .status(404)
    .json(createApiResponse(404, existingRecord.response, "Invalid"));
}

const reusablePanNumberFieldVerification = (panNo, txnId, res) => {
  const capitalPanNumber = panNo?.toUpperCase();

  const isValid = handleValidation("pan", capitalPanNumber, res, txnId, panServiceLogger);
  if (!isValid) return false;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");
  return capitalPanNumber;
};

async function handlePanVerification({
  req,
  res,
  serviceType,
  model,
  activeServiceFn,
  transformValidResponse,
  transformInvalidResponse,
}) {
  const { panNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId || "CID-6140971541";
  const txnId = genrateUniqueServiceId();

  const capitalPan = reusablePanNumberFieldVerification(
    panNumber,
    txnId,
    res
  );
  if (!capitalPan) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    serviceType,
    txnId,
    panServiceLogger
  );

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    // ✅ Billing + Rate limit
    const billingResult = await handleBillingAndRateLimit({
      pan: capitalPan,
      serviceId,
      categoryId,
      clientId,
      req,
      txnId
    });

    if (billingResult?.error) {
      return res
        .status(billingResult.error.status)
        .json(billingResult.error.body);
    }

    const encryptedPan = panCrypto.encrypt(capitalPan);

    // ✅ Parallel execution
    const [existingRecord, analytics] = await Promise.all([
      model.findOne({ panNumber: encryptedPan }),
      AnalyticsDataUpdate(clientId, serviceId, categoryId, "success", txnId, panServiceLogger),
    ]);

    if (!analytics.success) {
      panServiceLogger.warn("Analytics failed", { clientId });
    }

    // ✅ Cache hit
    if (existingRecord) {
      return handleCacheHit({
        existingRecord,
        res,
        serviceId,
        categoryId,
        clientId,
      });
    }

    // ✅ Service selection
    const service = await selectService(categoryId, serviceId, txnId, req, panServiceLogger);
    if (!service) {
      return res.status(500).json(ERROR_CODES?.SERVICE_UNAVAILABLE);
    }

    // ✅ External service call
    const apiResponse = await activeServiceFn(capitalPan, service, 0, clientId);

    if (apiResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    const { createdTime, createdDate } = getCurrentTime();

    // ✅ VALID
    if (apiResponse?.message?.toUpperCase() === "VALID") {
      const result = transformValidResponse(apiResponse.result, encryptedPan);

      await logResponse({
        serviceId,
        categoryId,
        clientId,
        result: apiResponse.result,
        txnId
      });

      await model.findOneAndUpdate(
        { panNumber: encryptedPan },
        {
          panNumber: encryptedPan,
          response: result,
          serviceResponse: apiResponse.responseOfService,
          status: STATUS.VALID,
          ...(mobileNumber && { mobileNumber }),
          serviceName: apiResponse.service,
          createdTime,
          createdDate,
        },
        { upsert: true, new: true }, // creates if not found
      );

      return res
        .status(200)
        .json(createApiResponse(200, apiResponse.result, "Valid"));
    }

    // ❌ INVALID
    const invalidResult = transformInvalidResponse(capitalPan);

    await logResponse({
      serviceId,
      categoryId,
      clientId,
      result: invalidResult,
    });

    await model.findOneAndUpdate(
      { panNumber: encryptedPan },
      {
        panNumber: encryptedPan,
        response: invalidResult,
        serviceResponse: {},
        status: STATUS.INVALID,
        ...(mobileNumber && { mobileNumber }),
        serviceName: apiResponse.service,
        createdTime,
        createdDate,
      },
      { upsert: true, new: true },
    );

    return res
      .status(404)
      .json(createApiResponse(404, invalidResult, "Invalid"));
  } catch (error) {
    panServiceLogger.error("PAN verification error", {
      clientId,
      error: error.message,
    });

    const err = mapError(error);
    return res.status(err.httpCode).json(err);
  }
}

module.exports = {
  handleBillingAndRateLimit,
  handleCacheHit,
  handlePanVerification,
  buildInvalidResponse,
  SERVICE_TYPES,
  reusablePanNumberFieldVerification,
};
