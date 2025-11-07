const cardValidationModel = require("../models/cardValidationModel");
const logger = require("../../Logger/logger");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { verifyCreditCardNumber } = require("../../service/provider.rapid");
const { encryptData, decryptData } = require("../../../utlis/EncryptAndDecrypt");
require("dotenv").config();

const verifyFullCardNumber = async (req, res, next) => {
  const { creditCardNumber } = req.body;
  const data = req.body;

  if (!creditCardNumber) {
        return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  if (
    creditCardNumber?.trim()?.length > 16 ||
    creditCardNumber?.trim()?.length < 16
  ) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const encryptedCreditCardNumber = encryptData(creditCardNumber);
  console.log("encryptedCreditCardNumber ====>>>", encryptedCreditCardNumber)
    logger.info(`encryptedCreditCardNumber ====>> ${encryptedCreditCardNumber}`)
  const existingCreditCardNumber = await cardValidationModel.findOne({
    cardNumber: encryptedCreditCardNumber,
  });
  console.log("existingPanNumber===>", existingCreditCardNumber);
  logger.info(`Existing Credit Card Number Found ${existingCreditCardNumber}`)
  if (existingCreditCardNumber) {
    return res.json({
      message: "Valid",
      response: existingCreditCardNumber?.response,
      success: true,
    });
  }

  try {
    const cardNumberResponse = await verifyCreditCardNumber(data)
    console.log("cardNumberResponse ===>>", cardNumberResponse)
    const encryptedNumber = encryptData(cardNumberResponse?.card_number)
    if(cardNumberResponse?.is_valid){
      const objectToBeStored = {
        cardNumber: encryptedNumber,
        response: cardNumberResponse,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      }
      await cardValidationModel?.create(objectToBeStored)
      return res.status(200).json({
        message: "Valid",
        success: true,
        response: cardNumberResponse 
      })
    }else{
        return res.status(200).json({
        message: "InValid",
        success: false,
        response: "" 
      })
    }
  } catch (error) {
    console.log("error in while fetching Credit Card Response ===>>", error)

    if(error?.response?.status == 502){
      res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
  }
};

module.exports = {
  verifyFullCardNumber,
};
