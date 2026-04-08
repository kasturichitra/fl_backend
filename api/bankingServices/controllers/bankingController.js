const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const { bankServiceLogger, cibilLogger } = require("../../Logger/logger");
const AdvanceBankModel = require("../models/AdvanceBank.model");
const CibilServicesModel = require("../models/CibilServices.model");
const { BankActiveServiceResponse } = require("../services/bankingServiceResponse");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { deductCredits } = require("../../../services/CreditService");
const { selectService } = require("../../service/serviceSelector");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const BsaViaNbModel = require("../models/BsaViaNbModel");

exports.handleBSAViaNetBanking = async (req, res) => {
  const {
    panNumber,
    mobileNumber = "",
    serviceId: bodyServiceId = "",
    categoryId: bodyCategoryId = "",
    clientId: bodyClientId = "",
  } = req.body;
  const clientId = req.clientId || bodyClientId;
  const TxnID = await generateTransactionId(12);

  if (!panNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const capitalPanNumber = panNumber?.toUpperCase();

  bankServiceLogger.info(`TxnID:${TxnID}, BSA via Net Banking: Pan:${capitalPanNumber}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("BSA_NETBLOCKING", TxnID, bankServiceLogger);

    const isValid = handleValidation("pan", capitalPanNumber, res, TxnID, bankServiceLogger);
    if (!isValid) return;

    bankServiceLogger.info(`TxnID:${TxnID}, Executing BSA via Net Banking for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    // 1. HASH IDENTIFIER
    const identifierHash = hashIdentifiers({ panNo: capitalPanNumber }, bankServiceLogger);

    // 2. CHECK THE RATE LIMIT
    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: bankServiceLogger
    });

    if (!rateLimitResult.allowed) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Rate limit exceeded for BSA via Net Banking: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: rateLimitResult.message,
      });
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Generated BSA via Net Banking txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      bankServiceLogger
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Credit deduction failed for BSA via Net Banking: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB
    const encryptedPan = encryptData(capitalPanNumber);

    const existingRecord = await BsaViaNbModel.findOne({ panNumber: encryptedPan });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      TxnID,
      bankServiceLogger
    );
    if (!analyticsResult.success) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for BSA via Net Banking: client ${clientId}, service ${serviceId}`);
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Checked for existing BSA via Net Banking record in DB: ${existingRecord ? "Found" : "Not Found"}`);

    if (existingRecord) {
      bankServiceLogger.info(`TxnID:${TxnID}, Returning cached BSA via Net Banking response for client: ${clientId}`);
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: existingRecord?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      if (existingRecord?.status == 1) {
        return res.status(200).json(createApiResponse(200, existingRecord?.response, "Valid"));
      } else {
        return res.status(404).json(createApiResponse(404, existingRecord?.response, "inValid"));
      }
    }

    // 7. CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, bankServiceLogger);
    if (!service || !service.length) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Active service not found for BSA via Net Banking category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Active service selected for BSA via Net Banking: ${JSON.stringify(service)}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await BankActiveServiceResponse({ panNumber: capitalPanNumber }, service, "BSAViaNetBankingApiCall", 0, TxnID);

    bankServiceLogger.info(`TxnID:${TxnID}, Active service response received: ${response?.message}`);

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = response?.result;
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 1,
        panNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await BsaViaNbModel.findOneAndUpdate(
        { panNumber: encryptedPan },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      return res.status(200).json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: { panNumber: capitalPanNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        panNumber: encryptedPan,
        response: { panNumber: capitalPanNumber },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await BsaViaNbModel.findOneAndUpdate(
        { panNumber: encryptedPan },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      return res.status(404).json(createApiResponse(404, { panNumber: capitalPanNumber }, "Failed"));
    }
  } catch (error) {
    bankServiceLogger.error(`TxnID:${TxnID}, System error in BSA via Net Banking for client ${clientId}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.AdvanceBankAccountVerification = async (req, res) => {
  const { accountNumber, ifscCode, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!accountNumber || !ifscCode) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  bankServiceLogger.info(`TxnID:${TxnID}, Advance bankAccount verification: AccountNO:${accountNumber}, ifscCode:${ifscCode}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("AddvanceBank", TxnID, bankServiceLogger);

    const isAccountValid = handleValidation("accountNumber", accountNumber, res, TxnID, bankServiceLogger);
    if (!isAccountValid) return;

    const isIfscValid = handleValidation("ifsc", ifscCode, res, TxnID, bankServiceLogger);
    if (!isIfscValid) return;

    bankServiceLogger.info(`TxnID:${TxnID}, Executing Advance bankAccount verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    // 1. HASH IDENTIFIERS
    const indetifierHash = hashIdentifiers({ accountNumber, ifscCode }, bankServiceLogger);

    // 2. CHECK THE RATE LIMIT
    const bankAccRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: bankServiceLogger
    });

    if (!bankAccRateLimitResult.allowed) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Rate limit exceeded for Advance bankAccount verification: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: bankAccRateLimitResult.message,
      });
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Generated Advance bankAccount txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      bankServiceLogger
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Credit deduction failed for Advance bankAccount verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB
    const encryptedAccount = encryptData(accountNumber);
    const encryptedIFSC = encryptData(ifscCode);

    const existingAdvanceBank = await AdvanceBankModel.findOne({ accountNumber: encryptedAccount, ifscCode: encryptedIFSC });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      TxnID,
      bankServiceLogger
    );
    if (!analyticsResult.success) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for Advance bankAccount verification: client ${clientId}, service ${serviceId}`);
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Checked for existing Advance bankAccount record in DB: ${existingAdvanceBank ? "Found" : "Not Found"}`);

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingAdvanceBank) {
      bankServiceLogger.info(`TxnID:${TxnID}, Returning cached Advance bankAccount response for client: ${clientId}`);
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: existingAdvanceBank?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      if (existingAdvanceBank?.status == 1) {
        const decrypted = {
          ...existingAdvanceBank?.response,
          accountNumber,
          ifscCode,
        };
        return res.status(200).json(createApiResponse(200, decrypted, "Valid"));
      } else {
        return res.status(404).json(createApiResponse(404, existingAdvanceBank?.response, "inValid"));
      }
    }

    // 7. CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, bankServiceLogger);
    if (!service || !service.length) {
      bankServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Active service not found for Advance bankAccount category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(`TxnID:${TxnID}, Active service selected for Advance bankAccount verification: ${JSON.stringify(service)}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await BankActiveServiceResponse({ accountNumber, ifscCode }, service, "AdvanceBankApiCall", 0, TxnID);

    bankServiceLogger.info(`TxnID:${TxnID}, Active service response received: ${response?.message}`);

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFSC
      };
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 1,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFSC,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await AdvanceBankModel.findOneAndUpdate(
        { accountNumber: encryptedAccount, ifscCode: encryptedIFSC },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      bankServiceLogger.info(`TxnID:${TxnID}, Valid Advance bankAccount response stored and sent to client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: { accountNumber, ifscCode },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFSC,
        response: { accountNumber, ifscCode },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await AdvanceBankModel.findOneAndUpdate(
        { accountNumber: encryptedAccount, ifscCode: encryptedIFSC },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      bankServiceLogger.info(`TxnID:${TxnID}, Invalid Advance bankAccount response received and sent to client: ${clientId}`);
      return res.status(404).json(createApiResponse(404, { accountNumber, ifscCode }, "Failed"));
    }

  } catch (error) {
    bankServiceLogger.error(`TxnID:${TxnID}, System error in Advance bankAccount verification for client ${clientId}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.CibilVerification = async (req, res) => {
  const { panNumber, customerName, customerMobile, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!panNumber || !customerName || !customerMobile) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  cibilLogger.info(`TxnID:${TxnID}, Cibil verification: Pan:${panNumber}, customerMobile:${customerMobile}, customerName:${customerName}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("CIBIL", TxnID, cibilLogger);

    const isPanValid = handleValidation("pan", panNumber, res, TxnID, cibilLogger);
    if (!isPanValid) return;

    const isMobileValid = handleValidation("mobile", customerMobile, res, TxnID, cibilLogger);
    if (!isMobileValid) return;

    cibilLogger.info(`TxnID:${TxnID}, Executing Cibil verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    // 1. HASH IDENTIFIERS
    const indetifierHash = hashIdentifiers({ panNumber, customerName, customerMobile }, cibilLogger);

    // 2. CHECK THE RATE LIMIT
    const cibilRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: cibilLogger
    });

    if (!cibilRateLimitResult.allowed) {
      cibilLogger.info(`TxnID:${TxnID}, [FAILED]: Rate limit exceeded for Cibil verification: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: cibilRateLimitResult.message,
      });
    }

    cibilLogger.info(`TxnID:${TxnID}, Generated Cibil txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      cibilLogger
    );

    if (!maintainanceResponse?.result) {
      cibilLogger.info(`TxnID:${TxnID}, [FAILED]: Credit deduction failed for Cibil verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB
    const encryptedPanNumber = encryptData(panNumber);
    const encryptedMobile = encryptData(customerMobile);
    const encryptedName = encryptData(customerName);

    const existingCibil = await CibilServicesModel.findOne({ 
      panNumber: encryptedPanNumber, 
      customerName: encryptedName, 
      customerMobile: encryptedMobile 
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      TxnID,
      cibilLogger
    );
    if (!analyticsResult.success) {
      cibilLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for Cibil verification: client ${clientId}, service ${serviceId}`);
    }

    cibilLogger.info(`TxnID:${TxnID}, Checked for existing Cibil record in DB: ${existingCibil ? "Found" : "Not Found"}`);

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingCibil) {
      cibilLogger.info(`TxnID:${TxnID}, Returning cached Cibil response for client: ${clientId}`);
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: existingCibil?.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      if (existingCibil?.status == 1) {
        const decrypted = { 
          ...existingCibil?.response, 
          panNumber, 
          customerName, 
          customerMobile 
        };
        return res.status(200).json(createApiResponse(200, decrypted, "Valid"));
      } else {
        return res.status(404).json(createApiResponse(404, existingCibil?.response, "inValid"));
      }
    }

    // 7. CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, cibilLogger);
    if (!service || !service.length) {
      cibilLogger.info(`TxnID:${TxnID}, [FAILED]: Active service not found for Cibil category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    cibilLogger.info(`TxnID:${TxnID}, Active service selected for Cibil verification: ${JSON.stringify(service)}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await BankActiveServiceResponse({ panNumber, customerName, customerMobile }, service, "CibilApiCall", 0, TxnID);

    cibilLogger.info(`TxnID:${TxnID}, Active service response received: ${response?.message}`);

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPanNumber,
        customerName: encryptedName,
        customerMobile: encryptedMobile
      };
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 1,
        panNumber: encryptedPanNumber,
        customerName: encryptedName,
        customerMobile: encryptedMobile,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await CibilServicesModel.findOneAndUpdate(
        { panNumber: encryptedPanNumber, customerName: encryptedName, customerMobile: encryptedMobile },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      cibilLogger.info(`TxnID:${TxnID}, Valid Cibil response stored and sent to client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: { panNumber, customerName, customerMobile },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        panNumber: encryptedPanNumber,
        customerName: encryptedName,
        customerMobile: encryptedMobile,
        response: { panNumber, customerName, customerMobile },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await CibilServicesModel.findOneAndUpdate(
        { panNumber: encryptedPanNumber, customerName: encryptedName, customerMobile: encryptedMobile },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      cibilLogger.info(`TxnID:${TxnID}, Invalid Cibil response received and sent to client: ${clientId}`);
      return res.status(404).json(createApiResponse(404, { panNumber, customerName, customerMobile }, "Failed"));
    }

  } catch (error) {
    cibilLogger.error(`TxnID:${TxnID}, System error in Cibil verification for client ${clientId}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
