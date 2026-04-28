const cardValidationModel = require("../models/cardValidationModel");
const { bankServiceLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
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

  const storingClient = req.clientId;
  const tnId = genrateUniqueServiceId();
  const isValid = handleValidation(
    "creditCard",
    creditCardNumber,
    res,
    storingClient,
    bankServiceLogger,
  );
  if (!isValid) return;

  bankServiceLogger.info("All inputs are valid, continue processing...");

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "CARD_VERIFY",
    storingClient,
    bankServiceLogger,
  );

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    const identifierHash = hashIdentifiers(
      {
        cardNo: creditCardNumber,
      },
      bankServiceLogger,
    );

    const fullCardRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: bankServiceLogger,
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
      bankServiceLogger,
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
    const encryptedNumber = encryptData(creditCardNumber);
    bankServiceLogger.info(`encryptedNumber ====>>> ${encryptedNumber}`);

    const existingCreditCardNumber = await cardValidationModel.findOne({
      cardNumber: encryptedNumber,
    });

    bankServiceLogger.info(
      `Existing Credit Card Number ${existingCreditCardNumber ? "Found" : "Not found"} ${JSON.stringify(existingCreditCardNumber)} for client ${storingClient}`,
    );
    const analyticsRes = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "success",
      tnId,
      bankServiceLogger,
    );
    if (!analyticsRes?.success) {
      return res.status(400).json({
        response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
        ...ERROR_CODES?.BAD_REQUEST,
      });
    }
    const createdTime = new Date().toLocaleTimeString();
    const createdDate = new Date().toLocaleDateString();

    if (existingCreditCardNumber) {
      const isValid = existingCreditCardNumber?.status == 1;

      await responseModel.create({
        serviceId,
        categoryId,
        TxnID: tnId,
        clientId: storingClient,
        result: existingCreditCardNumber?.response,
        createdTime,
        createdDate,
      });

      return res.json({
        message: isValid ? "Valid" : "Invalid",
        response: existingCreditCardNumber?.response,
        success: isValid,
      });
    }

    const service = await selectService(
      categoryId,
      serviceId,
      tnId,
      req,
      bankServiceLogger,
    );

    bankServiceLogger.info(
      `----active service for full card Verify is ---- ${JSON.stringify(service)}`,
    );
    if (!service?.length) {
      bankServiceLogger.info("no service in full card verify ===>>>");
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    const cardNumberResponse = await fullNumberServiceResponse(
      creditCardNumber,
      service,
      0,
      storingClient,
    );
    bankServiceLogger.info(
      `cardNumberResponse ===>> ${JSON.stringify(cardNumberResponse)}`,
    );
    const isValid = cardNumberResponse?.message?.toLowerCase() === "valid";

    // keep this unchanged
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      TxnID: tnId,
      result: cardNumberResponse?.result,
      createdTime,
      createdDate,
    });

    // build update object
    const updateData = {
      cardNumber: encryptedNumber,
      response: cardNumberResponse?.result,
      serviceName: cardNumberResponse?.service,
      serviceResponse: isValid ? cardNumberResponse?.responseOfService : {},
      status: isValid ? 1 : 2,
      createdDate,
      createdTime,
    };

    // use findOneAndUpdate with upsert
    await cardValidationModel.findOneAndUpdate(
      { cardNumber: encryptedNumber }, // filter (unique key)
      { $set: updateData },
      { new: true, upsert: true },
    );

    // response
    return res.status(isValid ? 200 : 404).json({
      message: isValid ? "Valid" : "Invalid",
      success: isValid,
      response: cardNumberResponse?.result,
    });
  } catch (error) {
    bankServiceLogger.error(
      `error in while fetching Credit Card Response ===>> ${error.message}`,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
      "failed",
      tnId,
      bankServiceLogger,
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
