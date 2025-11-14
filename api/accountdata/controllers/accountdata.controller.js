const accountdataModel = require("../models/accountdata.model");
require("dotenv").config();
const {
  verifyBankAccountCashfree,
} = require("../../service/provider.cashfree");
const logger = require("../../Logger/logger");
const {
  verifyBankAccountTruthScreen,
  verifyBankTruthScreen,
} = require("../../service/provider.truthscreen");
const { verifyBankAccountZoop } = require("../../service/provider.zoop");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const {
  verifyBankAccountEaseBuzz,
} = require("../../service/provider.easebuzz");
const {
  selectService,
  updateFailure,
} = require("../../service/serviceSelector");
const {
  verifyBankAccountInvincible,
  verifyBankInvincible,
} = require("../../service/provider.invincible");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { checkingOfLength } = require("../../../utlis/lengthCheck");

exports.verifyPennyDropBankAccount = async (req, res, next) => {
  const { account_no, ifsc } = req.body;
  const data = req.body;
  console.log("account_no, ifsc===>", account_no, ifsc);
  logger.info(`Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`);

  if (!account_no?.trim() || account_no?.length < 9) {
    let errorMessage = {
      message: "Account number is Missing or Invalid 😁",
      ...ERROR_CODES?.BAD_REQUEST
    };
    return res.status(400).json(errorMessage);
  }

  const resultOfIfsc = checkingOfLength(ifsc, 11);
  if (resultOfIfsc) {
       let errorMessage = {
      message: "Ifsc is Missing or Invalid 😁",
      ...ERROR_CODES?.BAD_REQUEST
    };
    return res.status(400).json(errorMessage);
  }

  const encryptedAccountNumber = encryptData(account_no);
  console.log("encryptedAccountNumber ====>>", encryptedAccountNumber);
  logger.info(
    `encryptedAccountNumber in pennyDrop Account verify ===>> ${encryptedAccountNumber}`
  );
  const existingAccountDetails = await accountdataModel.findOne({
    accountNo: encryptedAccountNumber,
    accountIFSCCode: ifsc,
  });
  if (existingAccountDetails) {
      logger.info(
    `ExistingAccountNumber in pennyDrop Account verify ===>> ${existingAccountDetails}`
  );
    if (existingAccountDetails?.accountHolderName) {
      const decryptedAccountNumber = decryptData(
        existingAccountDetails?.accountNo
      );
      const responseToSend = {
        ...existingAccountDetails?.responseData,
        account_no: decryptedAccountNumber,
      };
      return res.status(200).json({
        message: "Valid",
        success: true,
        response: responseToSend,
      });
    } else {
      return res.status(200).json({
        message: "InValid",
        success: false,
        response: null,
      });
    }
  }
  const service = await selectService("ACCOUNT_VERIFY_PD");

  console.log("----active service for Account Verify is ----", service);
  logger.info(`----active service for Account Verify is ----, ${service}`);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  console.log("----active service name for Account ---", service.serviceFor);
  logger.info(`----active service name for Account --- ${service.serviceFor}`);

  try {
    let response;
    switch (service.serviceFor) {
      case "INVINCIBLE":
        console.log("Calling INVINCIBLE API...");
        response = await verifyBankAccountInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyBankAccountTruthScreen(data);
        break;
      case "EASEBUZZ":
        console.log("Calling EASEBUZZ API...");
        response = await verifyBankAccountEaseBuzz(data);
        break;
      case "ZOOP":
        console.log("Calling ZOOP API...");
        response = await verifyBankAccountZoop(data);
        break;
      case "CASHFREE":
        console.log("Calling CASHFREE API...");
        response = await verifyBankAccountCashfree(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      "response from active service for account verify ===>>",
      response
    );
    logger.info(
      `response from active service for account verify ===>> ${JSON.stringify(
        response
      )}`
    );
    if (response?.message?.toLowerCase() == "valid") {
      const modifiedResponse = {
        ...response?.result,
        account_no: encryptedAccountNumber,
      };
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: modifiedResponse,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);

      return res.status(200).json({
        message: "Valid",
        success: true,
        response: response?.result,
      });
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: "",
        serviceResponse: ERROR_CODES?.NOT_FOUND,
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      return res.status(200).json({
        message: "InValid",
        success: false,
        response: null,
      });
    }
  } catch (error) {
    console.error("Error verifying bank account verifyBankAccount:", error);
    // await updateFailure(service);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPennyLessBankAccount = async (req, res, next) => {
  const { account_no, ifsc } = req.body;
  const data = req.body;
  console.log("account_no, ifsc===>", account_no, ifsc);
  logger.info(`Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`);

  try {
    if (!account_no?.trim() || !ifsc?.trim()) {
      let errorMessage = {
        message: "Account number and IFSC code are required 😁",
        statusCode: 400,
      };
      return next(errorMessage);
    }

    const encryptedAccountNumber = encryptData(account_no);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: ifsc,
    });
    if (existingAccountDetails) {
      const response = {
        BeneficiaryName: existingAccountDetails?.accountHolderName,
        AccountNumber: existingAccountDetails?.accountNo,
        IFSC: existingAccountDetails?.accountIFSCCode,
        Message:
          existingAccountDetails?.responseData?.result?.verification_status,
      };
      return res.status(200).json(response);
    }
    const service = await selectService("ACCOUNT_VERIFY_PL");

    console.log("----active service for Account Verify is ----", service);
    logger.info(`----active service for Account Verify is ----, ${service}`);
    if (!service) {
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    console.log("----active service name for Account ---", service.serviceFor);
    logger.info(
      `----active service name for Account --- ${service.serviceFor}`
    );

    let response;
    switch (service.serviceFor) {
      case "INVINCIBLE":
        console.log("Calling INVINCIBLE API...");
        response = await verifyBankInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyBankTruthScreen(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      "response from active service for account verify ===>>",
      response
    );
    logger.info(
      `response from active service for account verify ===>> ${response}`
    );
    if (response?.message?.toLowerCase() == "valid") {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: response?.result,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);

      return res.status(200).json({
        message: "Valid",
        success: true,
        response: response?.result,
      });
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: "",
        serviceResponse: {},
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      return res.status(200).json({
        message: "InValid",
        success: false,
        response: {},
      });
    }
  } catch (error) {
    console.error("Error verifying bank account verifyBankAccount:", error);
    await updateFailure(service);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
