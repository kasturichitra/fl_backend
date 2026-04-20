const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const handleValidation = require("../../../utils/lengthCheck");
const { bankServiceLogger, cibilLogger } = require("../../Logger/logger");
const AdvanceBankModel = require("../models/AdvanceBank.model");
const CibilServicesModel = require("../models/CibilServices.model");
const { BankActiveServiceResponse } = require("../services/bankingServiceResponse");
const { chequeClassifyActiveServiceResponse } = require("../service/bankingServiceResp");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { selectService } = require("../../service/serviceSelector");
const { deductCredits } = require("../../../services/CreditService");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");

exports.handleBSAViaNetBanking = async (req, res) => {
  const { panNumber, mobileNumber = "" } = req.body;
  const capitalPanNumber = panNumber?.toUpperCase();
  const storingClient = req.clientId;
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  bankServiceLogger.info(
    `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
  );

  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  bankServiceLogger.info("All inputs in pan are valid, continue processing...");

  try {
    bankServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Common: hash identifier
    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   bankServiceLogger.warn(
    //     `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //       storingClient,
    //       serviceId,
    //       categoryId,
    //       tnId,
    //       req.environment,
    //     );

    // if (!maintainanceResponse?.result) {
    //   bankServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      bankServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    bankServiceLogger.info(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      bankServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    bankServiceLogger.info(
      `Response received from active service ${service}: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber, ...findingInValidResponses("panBasic") },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: findingInValidResponses("panBasic"),
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber, ...findingInValidResponses("panBasic") },
            "Failed",
          ),
        );
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in bsa via nb for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.AdvanceBankAccountVerification = async (req, res) => {
  const { accountNumber, ifscCode, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = genrateUniqueServiceId();

  if (!accountNumber || !ifscCode) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  bankServiceLogger.info(
    `Advance bankAccount verification, AccountNO:${accountNumber}, ifscCode: ${ifscCode}`,
  );
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('ADVANCE_BANKACCOUNT_VERY', TxnID,bankServiceLogger);

    const isaccount = handleValidation("accountNumber", accountNumber, res, TxnID, bankServiceLogger);
    const isifsc = handleValidation("ifsc", ifscCode, res, TxnID,bankServiceLogger);
    if (!isaccount || !isifsc) return;

    bankServiceLogger.info(
      `Executing Advance bankAccount verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const indetifierHash = hashIdentifiers({ accountNumber, ifscCode }, bankServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const bankAccRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger:bankServiceLogger
    });

    if (!bankAccRateLimitResult.allowed) {
      bankServiceLogger.info(
        `[FAILED]: Rate limit exceeded for Advance bankAccount verification: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: bankAccRateLimitResult.message,
      });
    }

    bankServiceLogger.info(`Generated Advance bankAccount txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      bankServiceLogger
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.info(`[FAILED]: Credit deduction failed for Advance bankAccount verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedAccount = encryptData(accountNumber);
    const encryptedIFFSC = encryptData(ifscCode);

    const existingAdvanceBank = await AdvanceBankModel.findOne({
      accountNumber: encryptedAccount,
      ifscCode: encryptedIFFSC,
    });

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
      bankServiceLogger.info(
        `[FAILED]: Analytics update failed for Advance bankAccount verification: client ${clientId}, service ${serviceId}`,
      );
    }

    bankServiceLogger.info(
      `Checked for existing Advance bankAccount record in DB: ${existingAdvanceBank ? "Found" : "Not Found"}, `,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingAdvanceBank) {
      if (existingAdvanceBank?.status == 1) {
        bankServiceLogger.info(
          `Returning cached Advance bankAccount response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingAdvanceBank?.response,
          accountNumber,
          ifscCode,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          TxnID,
          result: existingAdvanceBank?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        bankServiceLogger.info(
          `Returning cached Advance bankAccount response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingAdvanceBank?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingAdvanceBank?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "Invalid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE 
    const service = await selectService(categoryId, serviceId,TxnID,req,bankServiceLogger);
    if (!service.length) {
      bankServiceLogger.info(
        `[FAILED]: Active service not found for Advance bankAccount category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    bankServiceLogger.info(
      `Active service selected for Advance bankAccount verification: ${service}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await BankActiveServiceResponse({accountNumber, ifscCode,}, service, "AdvanceBankApiCall", 0,TxnID);

    bankServiceLogger.info(
      `Active service selected for Advance bankAccount service ${response.service}: ${JSON.stringify(response)}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFFSC,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        TxnID,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFFSC,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await AdvanceBankModel.create(storingData);
      bankServiceLogger.info(
        `Valid Advance bankAccount response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        TxnID,
        result: {
          accountNumber,
          ifscCode,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFFSC,
        response: {
          accountNumber,
          ifscCode,
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await AdvanceBankModel.create(storingData);
      bankServiceLogger.info(
        `Invalid Advance bankAccount response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            accountNumber,
            ifscCode,
          },
          "Failed",
        ),
      );
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in Advance bankAccount verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.CibilVerification = async (req, res) => {
  const {
    panNumber,
    customerName,
    customerMobile,
    mobileNumber = "",
  } = req.body;
  const clientId = req.clientId;

  if (!panNumber || !customerName || !customerMobile) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  cibilLogger.info(
    `Cibil verification, Pan:${panNumber}, customerNumber: ${customerMobile}, customerName: ${customerName}`,
  );
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } =
      await getCategoryIdAndServiceId("AddvanceBank", clientId);

    const ispanNumber = handleValidation("pan", panNumber, res, clientId);
    const iscustomerMobile = handleValidation(
      "mobile",
      customerMobile,
      res,
      clientId,
    );
    if (!ispanNumber || !iscustomerMobile) return;

    cibilLogger.info(
      `Executing Cibil verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH PAN,NAME,MOBILE NUMBER
    const indetifierHash = hashIdentifiers({
      panNumber,
      customerName,
      customerMobile,
    });

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const cibilRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
    });

    if (!cibilRateLimitResult.allowed) {
      cibilLogger.info(
        `[FAILED]: Rate limit exceeded for Cibil verification: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: cibilRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    cibilLogger.info(`Generated Cibil txn Id: ${tnId}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      cibilLogger.info(
        `[FAILED]: Credit deduction failed for Cibil verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedPanNumber = encryptData(panNumber);
    const encryptedMobile = encryptData(customerMobile);
    const encryptedName = encryptData(customerName);

    const existingCibl = await CibilServicesModel.findOne({
      panNumber: encryptedPanNumber,
      customerName: encryptedName,
      customerMobile: encryptedMobile,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      cibilLogger.info(
        `[FAILED]: Analytics update failed for Cibil verification: client ${clientId}, service ${serviceId}`,
      );
    }

    cibilLogger.info(
      `Checked for existing Cibil record in DB: ${existingCibl ? "Found" : "Not Found"}, `,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingCibl) {
      if (existingCibl?.status == 1) {
        cibilLogger.info(
          `Returning cached Cibil response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingCibl?.response,
          panNumber,
          customerName,
          customerMobile,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingCibl?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        cibilLogger.info(
          `Returning cached Cibil response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingCibl?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingCibl?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "Invalid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId);
    if (!service.length) {
      cibilLogger.info(
        `[FAILED]: Active service not found for Cibil category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    cibilLogger.info(
      `Active service selected for Cibil verification: ${service.serviceFor}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await BankActiveServiceResponse({panNumber, customerName, customerMobile}, service, "AdvanceBankApiCall", 0);

    cibilLogger.info(
      `Active service selected for Cibil service ${service.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        accountNumber: encryptedAccount,
        ifscCode: encryptedIFFSC,
      };
      await responseModel.create({
        serviceId,
        categoryId,
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

      await CibilServicesModel.create(storingData);
      cibilLogger.info(
        `Valid Cibil response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        result: {
          panNumber,
          customerName,
          customerMobile,
        },
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

      await CibilServicesModel.create(storingData);
      cibilLogger.info(
        `Invalid Cibil response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            accountNumber,
            ifscCode,
          },
          "Failed",
        ),
      );
    }
  } catch (error) {
    cibilLogger.error(
      `System error in Cibil verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleChequeClassification = async (req, res) => {
  const data = req.body;
  const { panNumber, mobileNumber = "" } = data;
  const storingClient = req.clientId;
  const capitalPanNumber = panNumber?.toUpperCase();
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  bankServiceLogger.info(
    `Generated cheque classification txn Id: ${tnId} for the client: ${storingClient}`,
  );

  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  bankServiceLogger.info("All inputs in pan are valid, continue processing...");

  try {
    bankServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Common: hash identifier
    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   bankServiceLogger.warn(
    //     `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //       storingClient,
    //       serviceId,
    //       categoryId,
    //       tnId,
    //       req.environment,
    //     );

    // if (!maintainanceResponse?.result) {
    //   bankServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient);
    bankServiceLogger.warn(
      `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
    );

    bankServiceLogger.info(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };

        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        bankServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(
      categoryId,
      serviceId,
      storingClient,
      req,
    );

    if (!service?.length) {
      bankServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await chequeClassifyActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    bankServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: panNumberResponse?.service,
      };

      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      bankServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { pan: panNumber }, "Failed"));
    }
  } catch (error) {
    bankServiceLogger.error(
      `System error in bsa via nb for client ${storingClient}: ${error.message}`,
      error,
    );
  }
};
