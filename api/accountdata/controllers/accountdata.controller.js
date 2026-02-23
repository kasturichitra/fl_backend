const accountdataModel = require("../models/accountdata.model");
require("dotenv").config();
const { accountLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const {
  accountPennyDropSerciveResponse,
  accountPennyLessSerciveResponse,
} = require("../../GlobalApiserviceResponse/accountPennyDropSerciveResponse");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { deductCredits } = require("../../../services/CreditService");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");

exports.verifyPennyDropBankAccount = async (req, res, next) => {
  const {
    account_no,
    ifsc,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  accountLogger.debug(`account_no, ifsc===> ${account_no}, ${ifsc}`);
  accountLogger.info(
    `Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`,
  );
  const capitalIfsc = ifsc?.toUpperCase();

  const isAccountValid = handleValidation("accountNumber", account_no, res);
  if (!isAccountValid) return;

  const isIfscValid = handleValidation("ifsc", capitalIfsc, res);
  if (!isIfscValid) return;

  accountLogger.info("All inputs are valid, continue processing...");

  try {
    const storingClient = req.clientId;
    accountLogger.info(`Executing Bank Account Penny Drop verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      accNo: account_no,
      ifscCode: capitalIfsc,
    });

    const accountPennyDropRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!accountPennyDropRateLimitResult.allowed) {
      accountLogger.warn(`Rate limit exceeded for Penny Drop: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: accountPennyDropRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    accountLogger.info(`Generated Penny Drop txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      accountLogger.error(`Credit deduction failed for Penny Drop: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedAccountNumber = encryptData(account_no);
    accountLogger.debug(`Encrypted account number for DB lookup`);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: capitalIfsc,
    });

    // Note: AnalyticsDataUpdate was missing, adding it for consistency
    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      accountLogger.warn(`Analytics update failed for Penny Drop: client ${storingClient}, service ${serviceId}`);
    }

    accountLogger.debug(`Checked for existing Account record in DB: ${existingAccountDetails ? "Found" : "Not Found"}`);
    if (existingAccountDetails) {
      accountLogger.info(`Returning cached Penny Drop response for client: ${storingClient}`);
      if (existingAccountDetails?.accountHolderName) {
        const decryptedAccountNumber = decryptData(
          existingAccountDetails?.accountNo,
        );
        const responseToSend = {
          ...existingAccountDetails?.responseData,
          account_no: decryptedAccountNumber,
        };
        return res
          .status(200)
          .json(createApiResponse(200, responseToSend, "Valid"));
      } else {
        return res.status(200).json(createApiResponse(200, {}, "InValid"));
      }
    }
    const service = await selectService(categoryId, serviceId);

    if (!service) {
      accountLogger.warn(`Active service not found for Penny Drop category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    accountLogger.info(`Active service selected for Penny Drop: ${service.serviceFor}`);
    const response = await accountPennyDropSerciveResponse(
      { account_no, ifsc },
      service,
      0,
    );

    accountLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() == "valid") {
      const modifiedResponse = {
        ...response?.result,
        account_no: encryptedAccountNumber,
      };
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        status: 1,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: modifiedResponse,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      accountLogger.info(`Valid Penny Drop response stored and sent to client: ${storingClient}`);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        accountHolderName: "",
        status: 2,
        serviceResponse: ERROR_CODES?.NOT_FOUND,
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      accountLogger.info(`Invalid Penny Drop response received and sent to client: ${storingClient}`);
      return res.status(200).json(createApiResponse(200, {}, "InValid"));
    }
  } catch (error) {
    accountLogger.error(`System error in Bank Account Penny Drop for client ${req.clientId}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};

exports.verifyPennyLessBankAccount = async (req, res, next) => {
  const {
    account_no,
    ifsc,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;
  const data = req.body;
  accountLogger.debug(`account_no, ifsc===> ${account_no}, ${ifsc}`);
  accountLogger.info(
    `Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`,
  );

  const storingClient = req.clientId || clientId;

  const isAccountValid = handleValidation("accountNumber", account_no, res);
  if (!isAccountValid) return;

  const isIfscValid = handleValidation("ifsc", ifsc, res);
  if (!isIfscValid) return;

  accountLogger.info("All inputs are valid, continue processing...");

  try {
    const capitalIfsc = ifsc?.toUpperCase();
    accountLogger.info(`Executing Bank Account Penny Less verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      accNo: account_no,
      ifscCode: capitalIfsc,
    });

    const accountPennyLessRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!accountPennyLessRateLimitResult?.allowed) {
      accountLogger.warn(`Rate limit exceeded for Penny Less: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: accountPennyLessRateLimitResult?.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    accountLogger.info(`Generated Penny Less txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      accountLogger.error(`Credit deduction failed for Penny Less: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedAccountNumber = encryptData(account_no);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: ifsc,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      accountLogger.warn(`Analytics update failed for Penny Less: client ${storingClient}, service ${serviceId}`);
      return res.status(400).json({
        response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
        ...ERROR_CODES?.BAD_REQUEST,
      });
    }

    accountLogger.debug(`Checked for existing Account record in DB: ${existingAccountDetails ? "Found" : "Not Found"}`);
    if (existingAccountDetails) {
      accountLogger.info(`Returning cached Penny Less response for client: ${storingClient}`);
      const response = {
        BeneficiaryName: existingAccountDetails?.accountHolderName,
        AccountNumber: existingAccountDetails?.accountNo,
        IFSC: existingAccountDetails?.accountIFSCCode,
        Message:
          existingAccountDetails?.responseData?.result?.verification_status,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.status(200).json(createApiResponse(200, response, "Valid"));
    }
    const service = await selectService("ACCOUNT_VERIFY_PL");

    if (!service) {
      accountLogger.warn(`Active service not found for Penny Less category ${categoryId}, service ${serviceId}`);
      return res
        .status(404)
        .json(createApiResponse(404, null, "Requested resource not found"));
    }

    accountLogger.info(`Active service selected for Penny Less: ${service.serviceFor}`);

    const response = await accountPennyLessSerciveResponse(
      { account_no, ifsc },
      service,
      0,
    );

    accountLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() == "valid") {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        status: 1,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: response?.result,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      await accountdataModel.create(objectToStoreInDb);
      accountLogger.info(`Valid Penny Less response stored and sent to client: ${storingClient}`);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: "",
        serviceResponse: {},
        status: 2,
        responseData: ERROR_CODES?.NOT_FOUND,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      await accountdataModel.create(objectToStoreInDb);
      accountLogger.info(`Invalid Penny Less response received and sent to client: ${storingClient}`);
      return res.status(200).json(createApiResponse(200, {}, "InValid"));
    }
  } catch (error) {
    accountLogger.error(`System error in Bank Account Penny Less for client ${storingClient}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};

