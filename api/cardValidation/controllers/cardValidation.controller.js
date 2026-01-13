const cardValidationModel = require("../models/cardValidationModel");
const { cardLogger } = require("../../Logger/logger");
const { mapError, ERROR_CODES } = require("../../../utlis/errorCodes");
const { verifyCreditCardNumber } = require("../../service/provider.rapid");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const {} = require("../../../utlis/lengthCheck");
const handleValidation = require("../../../utlis/lengthCheck");
const { hashIdentifiers } = require("../../../utlis/hashIdentifier");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const genrateUniqueServiceId = require("../../../utlis/genrateUniqueId");
const {
  fullNumberServiceResponse,
} = require("../../GlobalApiserviceResponse/fullNumberServiceResponse");
const { selectService } = require("../../service/serviceSelector");
require("dotenv").config();

const verifyFullCardNumber = async (req, res, next) => {
  const { creditCardNumber } = req.body;
  const data = req.body;

  const isValid = handleValidation("creditCard", creditCardNumber, res);
  if (!isValid) return;

  console.log("All inputs are valid, continue processing...");

  //  const identifierHash = hashIdentifiers({
  //     creditCardNumber,
  //   });

  //   const fullCardRateLimitResult = await checkingRateLimit({
  //     identifiers: { identifierHash },
  //     service: "FULLCARDVERIFY",
  //     clientId: req.userClientId,
  //   });

  //   if (!fullCardRateLimitResult.allowed) {
  //   return res.status(429).json({
  //     success: false,
  //     message: fullCardRateLimitResult.message,
  //   });
  // }

  //   const tnId = genrateUniqueServiceId("FULLCARDVERIFY");
  //   cardLogger.info("full card verify txn Id ===>>", tnId)
  //   await chargesToBeDebited(req.userClientId, "FULLCARDVERIFY", tnId);

  const encryptedCreditCardNumber = encryptData(creditCardNumber);
  console.log("encryptedCreditCardNumber ====>>>", encryptedCreditCardNumber);
  cardLogger.info(
    `encryptedCreditCardNumber ====>> ${encryptedCreditCardNumber}`
  );
  const existingCreditCardNumber = await cardValidationModel.findOne({
    cardNumber: encryptedCreditCardNumber,
  });
  console.log("existingCreditCardNumber===>", existingCreditCardNumber);
  cardLogger.info(
    `Existing Credit Card Number Found ${existingCreditCardNumber}`
  );
  if (existingCreditCardNumber) {
    if (existingCreditCardNumber?.status == 1) {
      return res.json({
        message: "Valid",
        response: existingCreditCardNumber?.response,
        success: true,
      });
    } else {
      return res.json({
        message: "InValid",
        response: existingCreditCardNumber?.response,
        success: false,
      });
    }
  }

  const service = await selectService("FULL_CARD");

  console.log("----active service for full card Verify is ----", service);
  if (!service) {
    cardLogger.info("no service in full card verify ===>>>");
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    const cardNumberResponse = await fullNumberServiceResponse(
      creditCardNumber,
      service,
      0
    );
    // const cardNumberResponse = await verifyCreditCardNumber(data);
    console.log("cardNumberResponse ===>>", cardNumberResponse);
    const encryptedNumber = encryptData(creditCardNumber);
    if (cardNumberResponse?.message?.toLowerCase() == "valid") {
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
      return res.status(200).json({
        message: "InValid",
        success: false,
        response: cardNumberResponse?.result,
      });
    }
  } catch (error) {
    console.log("error in while fetching Credit Card Response ===>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = {
  verifyFullCardNumber,
};
