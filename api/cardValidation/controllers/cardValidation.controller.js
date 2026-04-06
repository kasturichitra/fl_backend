const cardValidationModel = require("../models/cardValidationModel");
const { bankServiceLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const {} = require("../../../utils/lengthCheck");
const handleValidation = require("../../../utils/lengthCheck");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");

const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const {
  fullNumberServiceResponse,
} = require("../service/fullNumberServiceResponse");
const { selectService } = require("../../service/serviceSelector");
const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
require("dotenv").config();

const verifyFullCardNumber = async (req, res, next) => {
  const { creditCardNumber, mobileNumber = "" } = req.body;

  const storingClient = req.clientId || clientId;
  const tnId = genrateUniqueServiceId();
  const isValid = handleValidation(
    "creditCard",
    creditCardNumber,
    res,
    storingClient,
    bankServiceLogger
  );
  if (!isValid) return;

  bankServiceLogger.info("All inputs are valid, continue processing...");

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "CARD_VERIFY",
    storingClient,
    bankServiceLogger
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  const identifierHash = hashIdentifiers({
    cardNo: creditCardNumber,
  },bankServiceLogger);

  const fullCardRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: storingClient,
    req,
    TxnID:tnId,
    logger: bankServiceLogger
  });

  if (!fullCardRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: fullCardRateLimitResult.message,
    });
  }

  bankServiceLogger.info("full card verify txn Id ===>>", tnId);
  const maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req,
    bankServiceLogger
  );

  if (!maintainanceResponse?.result) {
    bankServiceLogger.error(
      `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    );
    return res.status(500).json({
      success: false,
      message: maintainanceResponse?.message || "Invalid",
      response: {},
    });
  }

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "Invalid",
      response: {},
    });
  }
  const encryptedCreditCardNumber = encryptData(creditCardNumber);
  bankServiceLogger.debug(
    `encryptedCreditCardNumber ====>>> ${encryptedCreditCardNumber}`,
  );
  bankServiceLogger.info(
    `encryptedCreditCardNumber ====>> ${encryptedCreditCardNumber}`,
  );
  const existingCreditCardNumber = await cardValidationModel.findOne({
    cardNumber: encryptedCreditCardNumber,
  });
  bankServiceLogger.debug(
    `existingCreditCardNumber===> ${JSON.stringify(existingCreditCardNumber)}`,
  );
  bankServiceLogger.info(
    `Existing Credit Card Number Found ${JSON.stringify(existingCreditCardNumber)} for client ${storingClient}`,
  );
  const analyticsRes = await AnalyticsDataUpdate(
    storingClient,
    serviceId,
    categoryId,
    "success",
    tnId,
    bankServiceLogger
  );
  if (!analyticsRes?.success) {
    return res.status(400).json({
      response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    });
  }
  if (existingCreditCardNumber) {
    if (existingCreditCardNumber?.status == 1) {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID:tnId,
        clientId: storingClient,
        result: existingCreditCardNumber?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.json({
        message: "Valid",
        response: existingCreditCardNumber?.response,
        success: true,
      });
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID:tnId,
        clientId: storingClient,
        result: existingCreditCardNumber?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.json({
        message: "Invalid",
        response: existingCreditCardNumber?.response,
        success: false,
      });
    }
  }

  const service = await selectService(categoryId, serviceId,storingClient,req);

  bankServiceLogger.info(
    `----active service for full card Verify is ---- ${JSON.stringify(service)}`,
  );
  if (!service) {
    bankServiceLogger.info("no service in full card verify ===>>>");
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    const cardNumberResponse = await fullNumberServiceResponse(
      creditCardNumber,
      service,
      0,
      storingClient,
    );
    bankServiceLogger.debug(
      `cardNumberResponse ===>> ${JSON.stringify(cardNumberResponse)}`,
    );
    const encryptedNumber = encryptData(creditCardNumber);
    if (cardNumberResponse?.message?.toLowerCase() == "valid") {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: cardNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const objectToBeStored = {
        cardNumber: encryptedNumber,
        response: cardNumberResponse?.result,
        serviceName: cardNumberResponse?.service,
        serviceResponse: cardNumberResponse?.responseOfService,
        status: 1,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await cardValidationModel?.create(objectToBeStored);
      return res.status(200).json({
        message: "Valid",
        success: true,
        response: cardNumberResponse?.result,
      });
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: cardNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const objectToBeStored = {
        cardNumber: encryptedNumber,
        response: cardNumberResponse?.result,
        serviceName: cardNumberResponse?.service,
        serviceResponse: cardNumberResponse?.responseOfService,
        status: 2,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await cardValidationModel?.create(objectToBeStored);
      return res.status(404).json({
        message: "Invalid",
        success: false,
        response: cardNumberResponse?.result,
      });
    }
  } catch (error) {
    bankServiceLogger.error(
      `error in while fetching Credit Card Response ===>> ${error.message}`,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
      tnId,
      bankServiceLogger
    );

    if (!analyticsResult?.success) {
      bankServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = {
  verifyFullCardNumber,
};
