const cardValidationModel = require("../models/cardValidationModel");
const logger = require("../../Logger/logger");
const { mapError } = require("../../../utlis/errorCodes");
const { verifyCreditCardNumber } = require("../../service/provider.rapid");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const {} = require("../../../utlis/lengthCheck");
const handleValidation = require("../../../utlis/lengthCheck");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const { CreditCardActiveServiceResponse } = require("../../GlobalApiserviceResponse/CreditCardServiceResponse");
const { selectService } = require("../../service/serviceSelector");
require("dotenv").config();

const verifyFullCardNumber = async (req, res, next) => {
  const { creditCardNumber } = req.body;
  const data = req.body;

  const isValid = handleValidation("creditCard", creditCardNumber, res);
  if (!isValid) return;

  console.log("All inputs are valid, continue processing...");

  const encryptedCreditCardNumber = encryptData(creditCardNumber);
  console.log("encryptedCreditCardNumber ====>>>", encryptedCreditCardNumber);
  logger.info(`encryptedCreditCardNumber ====>> ${encryptedCreditCardNumber}`);
  const existingCreditCardNumber = await cardValidationModel.findOne({
    cardNumber: encryptedCreditCardNumber,
  });
  console.log("existingCreditCardNumber===>", existingCreditCardNumber);
  logger.info(`Existing Credit Card Number Found ${existingCreditCardNumber}`);
  if (existingCreditCardNumber) {
    return res.status(200).json(createApiResponse(200,existingCreditCardNumber?.response,'Valid'));
  }
  const service = await selectService("CARD_VALIDATION");

  try {
    // const cardNumberResponse = await verifyCreditCardNumber(data);
    const cardNumberResponse = await CreditCardActiveServiceResponse(creditCardNumber,service,0);

    console.log("cardNumberResponse ===>>", cardNumberResponse);
    const encryptedNumber = encryptData(cardNumberResponse?.card_number);
    if (cardNumberResponse?.is_valid) {
      const objectToBeStored = {
        cardNumber: encryptedNumber,
        response: cardNumberResponse,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await cardValidationModel?.create(objectToBeStored);
      return res.status(200).json(createApiResponse(200,objectToBeStored,'Valid'));
    } else {
      return res.status(200).json(createApiResponse(200, {}, 'Invalid'));
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
