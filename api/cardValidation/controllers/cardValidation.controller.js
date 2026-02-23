const cardValidationModel = require("../models/cardValidationModel");
const { cardLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { } = require("../../../utils/lengthCheck");
const handleValidation = require("../../../utils/lengthCheck");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const checkingRateLimit = require("../../../utils/checkingRateLimit");

const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const {
  fullNumberServiceResponse,
} = require("../../GlobalApiserviceResponse/fullNumberServiceResponse");
const { selectService } = require("../../service/serviceSelector");
const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
require("dotenv").config();

const verifyFullCardNumber = async (req, res, next) => {
  const {
    creditCardNumber,
    mobileNumber = "",
    categoryId = "",
    serviceId = "",
    clientId = "",
  } = req.body;

  const isValid = handleValidation("creditCard", creditCardNumber, res);
  if (!isValid) return;

  cardLogger.info("All inputs are valid, continue processing...");

  cardLogger.debug(`clientId in card ===>> ${clientId}`);

  const storingClient = req.clientId || clientId;

  // const identifierHash = hashIdentifiers({
  //   cardNo: creditCardNumber,
  // });

  // const fullCardRateLimitResult = await checkingRateLimit({
  //   identifiers: { identifierHash },
  //   serviceId,
  //   categoryId,
  //   clientId: storingClient,
  // });

  // if (!fullCardRateLimitResult.allowed) {
  //   return res.status(429).json({
  //     success: false,
  //     message: fullCardRateLimitResult.message,
  //   });
  // }

  // const tnId = genrateUniqueServiceId();
  // cardLogger.info("full card verify txn Id ===>>", tnId)
  // let maintainanceResponse;
  // if (req.environment?.toLowerCase() == "test") {
  //   maintainanceResponse = await creditsToBeDebited(
  //     storingClient,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // } else {
  //   maintainanceResponse = await chargesToBeDebited(
  //     storingClient,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // }

  // if (!maintainanceResponse?.result) {
  //   return res.status(500).json({
  //     success: false,
  //     message: "InValid",
  //     response: {},
  //   });
  // }
  const encryptedCreditCardNumber = encryptData(creditCardNumber);
  cardLogger.debug(`encryptedCreditCardNumber ====>>> ${encryptedCreditCardNumber}`);
  cardLogger.info(
    `encryptedCreditCardNumber ====>> ${encryptedCreditCardNumber}`,
  );
  const existingCreditCardNumber = await cardValidationModel.findOne({
    cardNumber: encryptedCreditCardNumber,
  });
  cardLogger.debug(`existingCreditCardNumber===> ${JSON.stringify(existingCreditCardNumber)}`);
  cardLogger.info(
    `Existing Credit Card Number Found ${JSON.stringify(existingCreditCardNumber)} for client ${storingClient}`,
  );
  const analyticsRes = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
  if (!analyticsRes?.success) {
    return res.status(400).json({
      response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    })
  }
  if (existingCreditCardNumber) {
    if (existingCreditCardNumber?.status == 1) {
      await responseModel.create({
        serviceId,
        categoryId,
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
        clientId: storingClient,
        result: existingCreditCardNumber?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.json({
        message: "InValid",
        response: existingCreditCardNumber?.response,
        success: false,
      });
    }
  }

  const service = await selectService(categoryId, serviceId);

  cardLogger.info(`----active service for full card Verify is ---- ${JSON.stringify(service)}`);
  if (!service) {
    cardLogger.info("no service in full card verify ===>>>");
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    const cardNumberResponse = await fullNumberServiceResponse(
      creditCardNumber,
      service,
      0,
    );
    // const cardNumberResponse = await verifyCreditCardNumber(data);
    cardLogger.debug(`cardNumberResponse ===>> ${JSON.stringify(cardNumberResponse)}`);
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
        serviceId: `${cardNumberResponse?.service}_fullCard`,
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
        serviceId: `${cardNumberResponse?.service}_fullCard`,
        serviceName: cardNumberResponse?.service,
        serviceResponse: cardNumberResponse?.responseOfService,
        status: 2,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await cardValidationModel?.create(objectToBeStored);
      return res.status(404).json({
        message: "InValid",
        success: false,
        response: cardNumberResponse?.result,
      });
    }
  } catch (error) {
    cardLogger.error(`error in while fetching Credit Card Response ===>> ${error.message}`);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = {
  verifyFullCardNumber,
};

