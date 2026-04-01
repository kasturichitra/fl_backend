const accountdataModel = require("../models/accountdata.model");
require("dotenv").config();
const { bankServiceLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const {
  accountPennyDropSerciveResponse,
} = require("../service/accountPennyDropSerciveResponse");
const {
  accountPennyLessSerciveResponse,
} = require("../service/accountPennyLessSerciveResponse");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { deductCredits } = require("../../../services/CreditService");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds")

exports.verifyPennyDropBankAccount = async (req, res, next) => {
  const { account_no, ifsc, mobileNumber = "" } = req.body;
  const clientId = req.clientId;

  if (!account_no || !ifsc) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  bankServiceLogger.info(`PennyDropBank Account NUMBER Details AccountNo: ${account_no}, IFSC: ${ifsc}`);

  const capitalIfsc = ifsc?.toUpperCase();

  bankServiceLogger.info("All inputs are valid, continue processing...");

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('ACCOUNT_PENNY_DROP', clientId);

    const isAccountValid = handleValidation("accountNumber", account_no, res);
    if (!isAccountValid) return;

    const isIfscValid = handleValidation("ifsc", capitalIfsc, res);
    if (!isIfscValid) return;

    bankServiceLogger.info(
      `Executing Bank Account Penny Drop verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const identifierHash = hashIdentifiers({
      accNo: account_no,
      ifscCode: capitalIfsc,
    });

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const accountPennyDropRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: clientId,
      req: req
    });

    if (!accountPennyDropRateLimitResult.allowed) {
      bankServiceLogger.warn(`Rate limit exceeded for Penny Drop: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: accountPennyDropRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    bankServiceLogger.info(`Generated Penny Drop txn Id: ${tnId}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.error(`Credit deduction failed for Penny Drop: client ${clientId}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedAccountNumber = encryptData(account_no);
    bankServiceLogger.debug(`Encrypted account number for DB lookup`);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: capitalIfsc,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      bankServiceLogger.info(
        `[FAILED]: Analytics update failed for Penny Drop: client ${clientId}, service ${serviceId}`,
      );
    }

    bankServiceLogger.info(
      `Checked for existing Account record in DB: ${existingAccountDetails ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingAccountDetails) {
      if (existingAccountDetails?.status === 1) {
        bankServiceLogger.info(`Returning Cached PennyDrop bank Account for ClientID: ${clientId}`);

        const responseToSend = {
          ...existingAccountDetails?.responseData,
          account_no: account_no,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingAccountDetails?.responseData,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res
          .status(200)
          .json(createApiResponse(200, responseToSend, "Valid"));
      } else {
        bankServiceLogger.info(`Returning Cached Pennydrop Bank Account for clientId: ${clientId}`);
        await responseModel.create({
          serviceId, categoryId, clientId,
          result: existingAccountDetails?.responseData,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString()
        });
        const dataToShow = existingAccountDetails?.responseData
        return res.status(404).json(createApiResponse(404, dataToShow, "Invalid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req);
    if (!service.length) {
      bankServiceLogger.info(
        `Active service not found for Penny Drop category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for Penny Drop: ${JSON.stringify(service)}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    const response = await accountPennyDropSerciveResponse(
      { account_no, ifsc },
      service,
      0,
      clientId,
    );

    bankServiceLogger.info(
      `Response received from active service ${response?.service}Response: ${JSON.stringify(response)}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toLowerCase() == "valid") {
      const modifiedResponse = {
        ...response?.result,
        account_no: encryptedAccountNumber,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        status: 1,
        accountHolderName: response?.result?.name,
        serviceResponse: response?.responseOfService,
        responseData: modifiedResponse,
        ...(mobileNumber && { mobileNumber }),
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      bankServiceLogger.info(
        `Valid Penny Drop response stored and sent to client: ${clientId}`,
      );

      return res.status(200).json(createApiResponse(200, response?.result, "Valid"));
    } else {

      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        result: {
          account_no: account_no, ifsc: capitalIfsc
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: capitalIfsc,
        accountHolderName: "",
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceResponse: {},
        responseData: {
          account_no: account_no,
        },
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      bankServiceLogger.info(
        `Invalid Penny Drop response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(createApiResponse(404, {}, "Invalid"));
    }
  } catch (error) {

    bankServiceLogger.error(
      `System error in pennydrop Bank verification for client ${clientId}: ${error.message}`,
      error
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed",
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

exports.verifyPennyLessBankAccount = async (req, res, next) => {
  const {
    account_no,
    ifsc,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  const data = req.body;
  bankServiceLogger.debug(`account_no, ifsc===> ${account_no}, ${ifsc}`);
  bankServiceLogger.info(
    `Account Details ===>> Acc_No: ${account_no} Ifsc: ${ifsc}`,
  );

  const clientId = req.clientId;

  const isAccountValid = handleValidation("accountNumber", account_no, res);
  if (!isAccountValid) return;

  const isIfscValid = handleValidation("ifsc", ifsc, res);
  if (!isIfscValid) return;

  bankServiceLogger.info("All inputs are valid, continue processing...");

  try {
    const capitalIfsc = ifsc?.toUpperCase();
    bankServiceLogger.info(
      `Executing Bank Account Penny Less verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      accNo: account_no,
      ifscCode: capitalIfsc,
    });

    const accountPennyLessRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: clientId,
      req:req
    });

    if (!accountPennyLessRateLimitResult?.allowed) {
      bankServiceLogger.warn(
        `Rate limit exceeded for Penny Less: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: accountPennyLessRateLimitResult?.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    bankServiceLogger.info(`Generated Penny Less txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.error(
        `Credit deduction failed for Penny Less: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedAccountNumber = encryptData(account_no);

    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: encryptedAccountNumber,
      accountIFSCCode: ifsc,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      bankServiceLogger.warn(
        `Analytics update failed for Penny Less: client ${clientId}, service ${serviceId}`,
      );
      return res.status(400).json({
        response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
        ...ERROR_CODES?.BAD_REQUEST,
      });
    }

    bankServiceLogger.debug(
      `Checked for existing Account record in DB: ${existingAccountDetails ? "Found" : "Not Found"}`,
    );
    if (existingAccountDetails) {
      bankServiceLogger.info(
        `Returning cached Penny Less response for client: ${clientId}`,
      );
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
        clientId: clientId,
        result: response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.status(200).json(createApiResponse(200, response, "Valid"));
    }
    const service = await selectService(categoryId, serviceId);

    if (!service?.length) {
      bankServiceLogger.warn(
        `Active service not found for Penny Less category ${categoryId}, service ${serviceId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, null, "Requested resource not found"));
    }

    bankServiceLogger.info(
      `Active service selected for Penny Less: ${service.serviceFor}`,
    );

    const response = await accountPennyLessSerciveResponse(
      { account_no, ifsc },
      service,
      0,
      clientId,
    );

    bankServiceLogger.info(
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
        ...(mobileNumber && { mobileNumber }),
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      await accountdataModel.create(objectToStoreInDb);
      bankServiceLogger.info(
        `Valid Penny Less response stored and sent to client: ${clientId}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const objectToStoreInDb = {
        accountNo: encryptedAccountNumber,
        accountIFSCCode: ifsc,
        accountHolderName: "",
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        responseData: {
          account_no: account_no,
        },
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await accountdataModel.create(objectToStoreInDb);
      bankServiceLogger.info(
        `Invalid Penny Less response received and sent to client: ${clientId}`,
      );
      return res.status(200).json(createApiResponse(200, {}, "Invalid"));
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in Bank Account Penny Less for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};
