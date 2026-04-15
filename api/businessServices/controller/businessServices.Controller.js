const { deductCredits } = require("../../../services/CreditService.js");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring.js");
const { createApiResponse } = require("../../../utils/ApiResponseHandler.js");
const checkingRateLimit = require("../../../utils/checkingRateLimit.js");
const { encryptData } = require("../../../utils/EncryptAndDecrypt.js");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes.js");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId.js");
const { hashIdentifiers } = require("../../../utils/hashIdentifier.js");
const { businessServiceLogger } = require("../../Logger/logger.js");
const { selectService } = require("../../service/serviceSelector.js");
const responseModel = require("../../serviceResponses/model/serviceResponseModel.js");
const gstin_verifyModel = require("../module/gstin_verify.model.js");
const gstInTaxpayer = require("../module/gstin_taxpayer.model.js")
const gstin_panModel = require("../module/gstin_pan.model.js");
const din_verifyModel = require('../module/dinModel.js');
const iec_Verification = require('../module/iecModel.js');
const lei_Verification = require('../module/lei.model.js');
const UAM_verifyModel = require('../module/uam.model.js');
const uamPhone_Verification = require('../module/uamwithPhone.model.js');
const cinCompanyVerification = require('../module/cinCompany.model.js');
const companyLIstVerification = require('../module/companyList.model.js');
const dgft_verification = require('../module/Dgft.model.js');
const IncorporationCertificateModel = require("../module/IncorporationCertificateModel.js");
const { response } = require("express");
const handleValidation = require("../../../utils/lengthCheck.js");
const { CinActiveServiceResponse } = require("../service/CinServiceResponse.js");
const { DinActiveServiceResponse } = require("../service/dinServiceResponse.js");
const { GstTaxpayerActiveServiceResponse } = require("../service/gstinTaxpayerServiceResp.js");
const { GSTtoPANActiveServiceResponse, GSTActiveServiceResponse } = require("../service/GstServiceResponse.js");
const { IecActiveServiceResponse } = require("../service/iecServiceResp.js");
const { LeiActiveServiceResponse } = require("../service/leiServiceResponse.js");
const { udyamActiveServiceResponse } = require("../service/UdyamServiceResponse.js");
const udhyamVerify = require("../module/udyamModel.js");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds.js");
const { DGFTActiveServiceResponse } = require("../service/DFGTServiceResponse.js");
const { shopActiveServiceResponse } = require("../service/ShopResponse.js");
const shopestablishmentModel = require("../module/shopestablishment.model.js");
const { UamActiveServiceResponse } = require("../service/UAMServiceResponse.js");
const GstinViewTrackModel = require("../module/GstinViewTrack.model.js");
const { GstInViewAndTrackActiveServiceRes } = require("../service/gstinviewandtrack.js");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen.js");

// DIN VERIFICATION ()
exports.dinVerification = async (req, res) => {
  const { dinNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!dinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, DIN NUMBER Details: ${dinNumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('DIN', TxnID, businessServiceLogger);

    const isValid = handleValidation("din", dinNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing DIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const indetifierHash = hashIdentifiers({
      dinNo: dinNumber
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const dinRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!dinRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for DIN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: dinRateLimitResult.message,
      });
    };
    businessServiceLogger.info(`Generated DIN txnId: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for DIN verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedDin = encryptData(dinNumber);

    const existingDin = await din_verifyModel.findOne({ dinNumber: encryptedDin })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `[FAILED]: Analytics update failed for DIN verification txnId: ${TxnID}, client ${clientId}, service ${serviceId}`
      );
    }

    businessServiceLogger.info(`txnId: ${TxnID}, Checked for existing DIN record in DB: ${existingDin ? "Found" : "Not Found"}`);

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingDin) {
      if (existingDin?.status == 1) {
        businessServiceLogger.info(`txnId: ${TxnID}, Returning cached DIN response for client: ${clientId}`);

        const decrypted = {
          ...existingDin?.response,
          dinNumber: dinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(`txnId: ${TxnID}, Returning cached din response for client: ${clientId}`);
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingDin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req);
    if (!service.length) {
      businessServiceLogger.info(`[FAILED]: Active service not found for DIN category txnId: ${TxnID}, ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(`txnId: ${TxnID}, Active service selected for DIN verification: ${service}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await DinActiveServiceResponse(dinNumber, service, 0, TxnID);

    businessServiceLogger.info(`txnId: ${TxnID}, Active service selected for DINverification service ${response.service}: ${response?.message}`);

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        dinNumber: encryptedDin,
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
        dinNumber: encryptedDin,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await din_verifyModel.findOneAndUpdate(
        { dinNumber: encryptedDin },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `Valid DIN response stored and sent to client: ${clientId}`,
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
          dinNumber: dinNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        dinNumber: encryptedDin,
        response: {
          dinNumber: dinNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await din_verifyModel.findOneAndUpdate(
        { dinNumber: encryptedDin },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(`txnId: ${TxnID}, Invalid DIN response received and sent to client: ${clientId}`);
      return res.status(404).json(createApiResponse(404, { dinNumber: dinNumber }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in DIN verification for client ${clientId}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// GST IN VERIFY ✔️ (zoop)
exports.gstinverify = async (req, res, next) => {
  const { gstinNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!gstinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(` TxnID:${TxnID}, GSTIN NUMBER Details: ${gstinNumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('GSTIN', TxnID, businessServiceLogger);

    const capitalGstNumber = gstinNumber?.toUpperCase();

    const isValid = handleValidation("gstin", capitalGstNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(`TxnID:${TxnID}, Executing GSTIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    //1. HASH DIN NUMBER
    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!gstRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for GSTIN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: gstRateLimitResult.message,
      });
    }
    businessServiceLogger.info(`Generated GSTIN txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(`TxnID:${TxnID}, [FAILED]: Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedGst = encryptData(gstinNumber);

    // Check if the record is present in the DB
    const existingGstin = await gstin_verifyModel.findOne({
      gstinNumber: encryptedGst,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      TxnID,
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingGstin) {
      if (existingGstin?.status == 1) {
        businessServiceLogger.info(
          `Returning cached GSTIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GSTIN response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingGstin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for GSTIN verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0, TxnID);
    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received from active service ${response.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
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
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true });

      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          gstinNumber: gstinNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true });
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in GSTIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// GST TO PAN VERIFICATION (doct typer error)
exports.handleGST_INtoPANDetails = async (req, res, next) => {
  const {
    gstinNumber,
    mobileNumber = "",
  } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!gstinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, GSTIN TO PAN Details: ${gstinNumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('GSTINTOPAN', TxnID, businessServiceLogger);

    const capitalGstNumber = gstinNumber?.toUpperCase();
    const isValid = handleValidation("gstin", capitalGstNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing GSTIN TO PAN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
    }, businessServiceLogger);

    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!gstRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for GSTIN TO PAN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: gstRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated GSTIN TO PAN txn Id: ${TxnID}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for GSTIN TO PAN verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedGst = encryptData(gstinNumber);

    const existingGstin = await gstin_panModel.findOne({ gstinNumber: encryptedGst });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for GST to PAN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing GST to PAN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );

    if (existingGstin) {
      if (existingGstin?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GST to PAN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GST to PAN response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingGstin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for GST to PAN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for GST to PAN verification: ${service}`,
    );

    let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0, TxnID);

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
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
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_panModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      )
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid GST to PAN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          gstinNumber: gstinNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber
        },
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_panModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      )
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid GST to PAN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(`txnId: ${TxnID}, Error performing GSTIN TO PAN verification: ${error.message}`, error);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};

// GSTIN TAXPAYER ✔️
exports.gstInTaxPayerVerification = async (req, res) => {
  const { gstinNumber, mobileNumber = "", } = req.body;
  const clientId = req.clientId;
  const isClient = req.role;
  const TxnID = await generateTransactionId(12);

  if (!gstinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, GSTIN TAXPAYER Details: ${gstinNumber}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('GSTINTAXPAYER', TxnID, businessServiceLogger);
    const capitalGstNumber = gstinNumber?.toUpperCase();

    const isValid = handleValidation("gstin", capitalGstNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing GSTIN TAXPAYER verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );
    // 1. HASH THE DATA
    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
    }, businessServiceLogger);

    // 2. CHECK THE RATE LIMIT AND CHECK IS PRODUCT IS SUBSCRIBE
    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!gstRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for GSTIN TAXPAYER verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json(createApiResponse(429, null, gstRateLimitResult?.message))
    };

    businessServiceLogger.info(`Generated GSTIN TAXPAYER txnID: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT ON THE USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for GSTIN TAXPAYER verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || 'Invalid'))
    };

    // 4. CHECK THE DATA IS PRESENT 
    const encryptedGst = encryptData(gstinNumber);

    const existingGstin = await gstInTaxpayer.findOne({ gstinNumber: encryptedGst });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Analytics update failed for GST Taxpayers verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing GST Taxpayers record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );

    if (existingGstin) {
      if (existingGstin?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GSTIN Taxpayers response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GSTIN Taxpayers response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingGstin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Active service not found for GSTIN Taxpayers category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for GSTIN TAXPAYER: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await GstTaxpayerActiveServiceResponse(gstinNumber, service, 0, TxnID);
    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received from active service ${response.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
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
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstInTaxpayer.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid GSTIN Taxpayer response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          gstinNumber: gstinNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstInTaxpayer.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid GSTIN TaxPayers response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber: gstinNumber }, "Failed"));
    }


  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in GSTIN TAXPAYER verification for client ${clientId}: ${error.message}`, error
    );
    return res.status(500).json(createApiResponse(500, null, 'SERVER ERROR'));
  }
};

// GSTIN VIEW AND TRACK RETURN ✔️
exports.gstinViewAndTrack = async (req, res) => {
  const { gstinNumber, Financialyear, mobileNumber } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!gstinNumber || !Financialyear) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  };
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('GSTINVIEWANDTRACK', TxnID, businessServiceLogger);
    const capitalGstNumber = gstinNumber?.toUpperCase();

    const isValid = handleValidation('gstin', capitalGstNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(`TxnID:${TxnID}, GSTIN VIEWANDTRACK VERIFICATION, CLIENTID:${clientId}, SERVICEiD:${serviceId}, CATEGORYID:${categoryId}, GSTNO:${gstinNumber}`)

    // 1. HASH THE DATA
    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
      Financialyear
    }, businessServiceLogger);

    // 2. CHECK THE RATE LIMIT AND CHECK IS PRODUCT IS SUBSCRIBE
    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!gstRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for GSTIN VIEWANDTRACK verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json(createApiResponse(429, null, gstRateLimitResult?.message))
    };

    businessServiceLogger.info(`Generated GSTIN VIEWANDTRACK txnID: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT ON THE USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for GSTIN VIEWANDTRACK verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json(createApiResponse(500, {}, maintainanceResponse?.message || 'Invalid'))
    };

    // 4. CHECK THE DATA IS PRESENT 
    const encryptedGst = encryptData(gstinNumber);

    const existingGstin = await GstinViewTrackModel.findOne({ gstinNumber: encryptedGst, Financialyear });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Analytics update failed for GSTIN VIEWANDTRACK verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing GSTIN VIEWANDTRACK record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );

    if (existingGstin) {
      if (existingGstin?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GSTIN VIEWANDTRACK Taxpayers response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached GSTIN VIEWANDTRACK response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingGstin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Active service not found for GSTIN VIEWANDTRACK Taxpayers category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for GSTIN VIEWANDTRACK verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await GstInViewAndTrackActiveServiceRes({ gstinNumber, Financialyear }, service, 0, TxnID);
    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received from active service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
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
        gstinNumber: encryptedGst,
        Financialyear,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await GstinViewTrackModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid GSTIN VIEWANDTRACK response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          gstinNumber: gstinNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await GstinViewTrackModel.findOneAndUpdate(
        { gstinNumber: encryptedGst },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid GSTIN VIEWANDTRACK response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber: gstinNumber }, "Failed"));
    };

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in GSTIN VIEWANDTRACK verification for client ${clientId}: ${error.message}`, error
    );
    return res.status(500).json(createApiResponse(500, null, 'SERVER ERROR'));
  }
}

// CIN DOC:15 VERIFICATION (CIN Search) ✔️
exports.handleCINVerification = async (req, res, next) => {
  const { CIN, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!CIN) {
    return res.status(480).json(ERROR_CODES?.BAD_REQUEST);
  };

  businessServiceLogger.info(`TxnID:${TxnID}, CIN NUMBER Details: ${CIN}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('CIN', TxnID, businessServiceLogger);

    const isCinValid = handleValidation("cin", CIN, res, TxnID, businessServiceLogger);
    if (!isCinValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing CIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const identifierHash = hashIdentifiers({
      CIN
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const cinRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!cinRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CIN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: cinRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated CIN txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for CIN verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedCIN = encryptData(CIN);

    const existingCIN = await IncorporationCertificateModel.findOne({
      cinNumber: encryptedCIN,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      TxnID,
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for CIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing CIN record in DB: ${existingCIN ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingCIN) {
      if (existingCIN?.status == 1) {
        businessServiceLogger.info(`txnId: ${TxnID}, Returning cached CIN response for client: ${clientId}`);
        const decrypted = {
          ...existingCIN?.response,
          cinNumber: CIN,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCIN?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached Cin response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCIN?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingCIN?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for CIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    };

    businessServiceLogger.info(`txnId: ${TxnID}, Active service selected for CIN verification: ${JSON.stringify(service)}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await CinActiveServiceResponse(CIN, service, 'CinApiCall', 0, TxnID);

    businessServiceLogger.info(`txnId: ${TxnID}, Active service selected for CINverification service ${response?.service}: ${response?.message}`);

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        cinNumber: encryptedCIN,
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
        cinNumber: encryptedCIN,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await IncorporationCertificateModel.findOneAndUpdate(
        { cinNumber: encryptedCIN },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid CIN response stored and sent to client: ${clientId}`
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));

    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          cinNumber: CIN
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        cinNumber: encryptedCIN,
        response: {
          cinNumber: CIN
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      }

      await IncorporationCertificateModel.findOneAndUpdate(
        { cinNumber: encryptedCIN },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid CIN response received and sent to client: ${clientId}`
      );
      return res.status(404).json(createApiResponse(404, { CinNUmber: CIN }, 'Failed'));
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in CIN verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// CIN DOC:382 VERIFICATION (CINCompany List) ✔️
exports.CompanVerification = async (req, res, next) => {
  const { CompanyName, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!CompanyName) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  };

  businessServiceLogger.info(`TxnID:${TxnID}, CompanyName List Details: ${CompanyName}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('CompanyName', TxnID, businessServiceLogger);

    const isCompanyNameValid = handleValidation("CompanyName", CompanyName, res, TxnID, businessServiceLogger);
    if (!isCompanyNameValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing CompanyName list verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const identifierHash = hashIdentifiers({
      CompanyName
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const CompanyNameRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!CompanyNameRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CompanyName list verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: CompanyNameRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated CompanyName txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for CompanyName list verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedCompanyName = encryptData(CompanyName);

    const existingCompanyName = await companyLIstVerification.findOne({
      CompanyName: encryptedCompanyName,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for CompanyName list verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing CompanyName list record in DB: ${existingCompanyName ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingCompanyName) {
      if (existingCompanyName?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached CompanyName list response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingCompanyName?.response,
          CompanyName,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCompanyName?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached CompanyName list response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCompanyName?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingCompanyName?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for CompanyName list category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    };

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for CompanyName list verification: ${service}`
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await CinActiveServiceResponse(CompanyName, service, 'CompanyListApiCall', 0, TxnID);

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for CompanyName list verification service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        CompanyName: encryptedCompanyName,
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
        CompanyName: encryptedCompanyName,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await companyLIstVerification.findOneAndUpdate(
        { CompanyName: encryptedCompanyName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid CompanyName list response stored and sent to client: ${clientId}`
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));

    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          CompanyName: CompanyName
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        CompanyName: encryptedCompanyName,
        response: {
          CompanyName: CompanyName
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      }

      await companyLIstVerification.findOneAndUpdate(
        { CompanyName: encryptedCompanyName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid CompanyName list response received and sent to client: ${clientId}`
      );
      return res.status(404).json(createApiResponse(404, { CompanyName: CompanyName }, 'Failed'));
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in CompanyName list verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// CIN DOC:52 VERIFICATION (company to CIN Search) ✔️
exports.CompanSearchVerification = async (req, res, next) => {
  const { CompanyName, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!CompanyName) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  };

  businessServiceLogger.info(`TxnID:${TxnID}, CompanyName Details: ${CompanyName}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('CompanyName', TxnID, businessServiceLogger);

    const isCompanyNameValid = handleValidation("CompanyName", CompanyName, res, TxnID, businessServiceLogger);
    if (!isCompanyNameValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing CompanyName verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const identifierHash = hashIdentifiers({
      CompanyName
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const CompanyNameRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!CompanyNameRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for CompanyName verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: CompanyNameRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated CompanyName txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for CompanyName verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedCompanyName = encryptData(CompanyName);

    const existingCompanyName = await cinCompanyVerification.findOne({
      CompanyName: encryptedCompanyName,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for CompanyName verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing CompanyName record in DB: ${existingCompanyName ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingCompanyName) {
      if (existingCompanyName?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached CompanyName response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingCompanyName?.response,
          CompanyName,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCompanyName?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached CompanyName response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingCompanyName?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingCompanyName?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for CompanyName category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    };

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for CompanyName verification: ${service}`
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await CinActiveServiceResponse(CompanyName, service, 'CompanySearchApiCall', 0, TxnID);

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for CompanyName verification service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        CompanyName: encryptedCompanyName,
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
        CompanyName: encryptedCompanyName,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await cinCompanyVerification.findOneAndUpdate(
        { CompanyName: encryptedCompanyName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid CompanyName response stored and sent to client: ${clientId}`
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));

    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          CompanyName: CompanyName
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        status: 2,
        CompanyName: encryptedCompanyName,
        response: {
          CompanyName: CompanyName
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await cinCompanyVerification.findOneAndUpdate(
        { CompanyName: encryptedCompanyName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid CompanyName response received and sent to client: ${clientId}`
      );
      return res.status(404).json(createApiResponse(404, { CompanyName: CompanyName }, 'Failed'));
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in CompanyName verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};


exports.handleIECVerification = async (req, res) => {
  const { IEC, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!IEC) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  businessServiceLogger.info(`TxnID:${TxnID}, IEC Number Details: ${IEC}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('IEC', TxnID, businessServiceLogger);
    businessServiceLogger.info(`TxnID:${TxnID}, Executing IEC verification for client:${clientId}, service: ${serviceId}, category: ${categoryId}`)

    //1. HASH IEC NUMBER
    const identifierHash = hashIdentifiers({ iecNumber: IEC }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const iecRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!iecRateLimitResult.allowed) {
      businessServiceLogger.warn(`TxnID:${TxnID}, Rate limit exceeded for IEC verification: client ${clientId}, service ${serviceId}`)
      return res.status(429).json({
        success: false,
        message: iecRateLimitResult?.message
      })
    };

    businessServiceLogger.info(`Generated IEC txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(`TxnID:${TxnID}, Credit deduction failed for IEC verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || 'Invalid',
        response: {}
      })
    };

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedIEC = encryptData(IEC);

    const existingIEC = await iec_Verification.findOne({
      iecNumber: encryptedIEC
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );

    if (!analyticsResult?.success) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Analytics update failed for IEC verification: clientId ${clientId}, service ${serviceId}`
      )
    };

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing IEC record in DB:${existingIEC ? "Found" : "Not Found"} `
    )

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingIEC) {
      if (existingIEC?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached IEC response for client:${clientId}`
        );
        const decrypted = {
          ...existingIEC?.response,
          iecNumber: IEC
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingIEC?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res.status(200).json(createApiResponse(200, dataToShow, 'valid'));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached IEC response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingIEC?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingIEC?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    };

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Active service not found for IEC category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for IEC verification: ${service}`
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await IecActiveServiceResponse(IEC, service, 0, TxnID);
    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received IEC verification from active service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        iecNumber: encryptedIEC,
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
        iecNumber: encryptedIEC,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await iec_Verification.findOneAndUpdate(
        { IEC: encryptedIEC },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid IEC response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          iecNumber: IEC
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        iecNumber: encryptedIEC,
        response: {
          iecNumber: IEC
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await iec_Verification.findOneAndUpdate(
        { IEC: encryptedIEC },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid IEC response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { existingIEC: existingIEC }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in IEC verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// UDYAMNUMBER VERIFICATION
exports.udyamNumberVerfication = async (req, res, next) => {
  const { udyamNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  businessServiceLogger.info(`TxnID:${TxnID}, udyamNumber from request ===> ${udyamNumber} for this client: ${clientId}`);

  const capitalUdyamNumber = udyamNumber?.toUpperCase();
  const isValid = handleValidation("udyam", capitalUdyamNumber, res, TxnID, businessServiceLogger);
  if (!isValid) return;

  businessServiceLogger.info(
    `TxnID:${TxnID}, All inputs in udyam are valid, continue processing... for this client: ${clientId}`,
  );

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('UDYAMNUMBER', TxnID, businessServiceLogger);
    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing Udyam verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      udyamNo: capitalUdyamNumber,
    }, businessServiceLogger);

    const udyamRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!udyamRateLimitResult.allowed) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Rate limit exceeded for Udyam verification: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: udyamRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated Udyam txn Id: ${TxnID}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(
        `TxnID:${TxnID}, Credit deduction failed for Udyam verification: client ${clientId}, txnId ${TxnID}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedUdhyam = encryptData(capitalUdyamNumber);
    businessServiceLogger.info(`TxnID:${TxnID}, Encrypted Udyam number for DB lookup`);

    const existingUdhyamNumber = await udhyamVerify.findOne({
      udyamNumber: encryptedUdhyam,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Analytics update failed for Udyam verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID} Checked for existing Udyam record in DB: ${existingUdhyamNumber ? "Found" : "Not Found"}`,
    );

    if (existingUdhyamNumber) {
      if (existingUdhyamNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingUdhyamNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached valid Udyam response for client: ${clientId}`,
        );
        return res
          .status(200)
          .json(
            createApiResponse(200, existingUdhyamNumber?.response, "Valid"),
          );
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: {
            udyam: udyamNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached invalid Udyam response for client: ${clientId}`,
        );
        return res.status(404).json(
          createApiResponse(
            404,
            {
              udyam: udyamNumber,
            },
            "InValid",
          ),
        );
      }
    }

    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Active service not found for Udyam category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for Udyam verification: ${service}`,
    );
    let udyamResponse = await udyamActiveServiceResponse(
      udyamNumber,
      service,
      0,
      TxnID,
    );

    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received from udyam verification active service ${udyamResponse?.service}: ${udyamResponse?.message}`,
    );

    if (udyamResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...udyamResponse?.result,
        udyam: encryptedUdhyam,
      };

      const storingData = {
        response: encryptedResponse,
        serviceResponse: udyamResponse?.responseOfService,
        status: 1,
        serviceName: udyamResponse?.service,
        ...(mobileNumber && { mobileNumber }),
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      const existingOrNew = await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );

      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: existingOrNew.response,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid Udyam response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, existingOrNew.response, "Valid"));
    } else {
      const InValidData = {
        response: {
          udyam: udyamNumber,
        },
        serviceResponse: {},
        status: 2,
        serviceName: udyamResponse?.service,
        ...(mobileNumber && { mobileNumber }),
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: InValidData },
        { upsert: true, new: true },
      );

      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          udyam: udyamNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid Udyam response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            udyam: udyamNumber,
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in Udyam verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// DGFT  VERIFICATION
exports.DGFTVerification = async (req, res) => {
  const { DGFT, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!DGFT) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, DGFT NUMBER Details: ${DGFT}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('DGFT', TxnID, businessServiceLogger);

    const isValid = handleValidation("DGFT", DGFT, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing DGFT verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DGFT NUMBER
    const identifierHash = hashIdentifiers({
      DGFT: DGFT
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const DGFTRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!DGFTRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for DGFT verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: DGFTRateLimitResult.message,
      });
    };

    businessServiceLogger.info(`Generated DGFT txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for DGFT verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedDGFT = encryptData(DGFT);

    const existingDGFT = await dgft_verification.findOne({ DGFT: DGFT })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for DGFT verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing DGFT record in DB: ${existingDGFT ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingDGFT) {
      if (existingDGFT?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached DGFT response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingDGFT?.response,
          DGFT: DGFT,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDGFT?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached DGFT response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDGFT?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingDGFT?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for DGFT category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for DGFT verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await DGFTActiveServiceResponse(DGFT, service, 0, TxnID);

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for DGFT service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        DGFT: encryptedDGFT,
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
        DGFT: encryptedDGFT,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await dgft_verification.findOneAndUpdate(
        { DGFT: encryptedDGFT },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );

      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid DGFT response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          DGFT: DGFT
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        DGFT: encryptedDGFT,
        response: {
          DGFT: DGFT
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await dgft_verification.findOneAndUpdate(
        { DGFT: encryptedDGFT },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid DGFT response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { DGFT: DGFT }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in DGFT verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// LEI VERIFICATION
exports.LEIVerification = async (req, res) => {
  const { CompanyName, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!CompanyName) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, LEI NUMBER Details: ${CompanyName}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('LEI', TxnID, businessServiceLogger);

    const isValid = handleValidation("LEI", CompanyName, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing LEI verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH LEI NUMBER
    const identifierHash = hashIdentifiers({
      CompanyName: CompanyName
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const LEIRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!LEIRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for LEI verification: client ${clientId}, service ${serviceId}, TxnID:${TxnID}`);
      return res.status(429).json({
        success: false,
        message: LEIRateLimitResult.message,
      });
    };

    businessServiceLogger.info(`Generated LEI txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for LEI verification: client ${clientId}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedLEI = encryptData(CompanyName);

    const existingLEI = await lei_Verification.findOne({ CompanyName: encryptedLEI })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `[FAILED]: Analytics update failed for LEI verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `Checked for existing LEI record in DB: ${existingLEI ? "Found" : "Not Found"}, `,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingLEI) {
      if (existingLEI?.status == 1) {
        businessServiceLogger.info(
          `Returning cached LEI response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingLEI?.response,
          CompanyName: CompanyName,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingLEI?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `Returning cached LEI response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingLEI?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingLEI?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req);
    if (!service.length) {
      businessServiceLogger.info(
        `[FAILED]: Active service not found for LEI category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `Active service selected for LEI verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await LeiActiveServiceResponse(CompanyName, service, 0, TxnID);

    businessServiceLogger.info(
      `Active service selected for LEIverification service ${response}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        CompanyName: encryptedLEI,
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
        CompanyName: encryptedLEI,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await lei_Verification.findOneAndUpdate(
        { CompanyName: encryptedLEI },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );

      businessServiceLogger.info(
        `Valid LEI response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          CompanyName: CompanyName
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        CompanyName: encryptedLEI,
        response: {
          CompanyName: CompanyName
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await lei_Verification.findOneAndUpdate(
        { CompanyName: encryptedLEI },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );

      businessServiceLogger.info(
        `Invalid LEI response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { CompanyName: CompanyName }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `System error in LEI verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// Udyog Aadhaar:
exports.udyogAadhaarVerification = async (req, res) => {
  const { UAMNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!UAMNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, UAM NUMBER Details: ${UAMNumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('UAM', TxnID, businessServiceLogger);

    const isValid = handleValidation("UAM", UAMNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing UAM verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH UAM NUMBER
    const identifierHash = hashIdentifiers({
      UAMNumber: UAMNumber
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const UAMRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!UAMRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for UAM verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: UAMRateLimitResult.message,
      });
    };

    businessServiceLogger.info(`Generated UAM txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for UAM verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedUAM = encryptData(UAMNumber);

    const existingUAM = await UAM_verifyModel.findOne({ UAMNumber: encryptedUAM })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `[FAILED]: Analytics update failed for UAM verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `Checked for existing UAM record in DB: ${existingUAM ? "Found" : "Not Found"}, `,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingUAM) {
      if (existingUAM?.status == 1) {
        businessServiceLogger.info(
          `Returning cached UAM response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingUAM?.response,
          UAMNumber: UAMNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingUAM?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `Returning cached UAM response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingUAM?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingUAM?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req);
    if (!service.length) {
      businessServiceLogger.info(
        `[FAILED]: Active service not found for UAM category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `Active service selected for UAM verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await UamActiveServiceResponse(UAMNumber, service, 'UamApiCall', 0, TxnID);

    businessServiceLogger.info(
      `Active service selected for UAMverification service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        UAMNumber: encryptedUAM,
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
        UAMNumber: encryptedUAM,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await UAM_verifyModel.findOneAndUpdate(
        { UAMNumber: encryptedUAM },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );

      businessServiceLogger.info(
        `Valid UAM response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          UAMNumber: UAMNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        UAMNumber: encryptedUAM,
        response: {
          UAMNumber: UAMNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await UAM_verifyModel.findOneAndUpdate(
        { UAMNumber: encryptedUAM },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `Invalid UAM response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { UAMNumber: UAMNumber }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `System error in UAM verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

//Udyog Aadhaar using Phone Verification:
exports.udyogwithPhoneAadhaarVerification = async (req, res) => {
  const { UAMNumber, customerNumber, mobileNumber = "" } = req.body; // customer number: which is link to Uam, and mobile Number is clientNumber
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!UAMNumber || !customerNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(`TxnID:${TxnID}, UAM Aadhaar using phone NUMBER Details: ${UAMNumber}, number:${customerNumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('UAMPhone', TxnID, businessServiceLogger);

    const isValid = handleValidation("UAMPhone", UAMNumber, res, TxnID, businessServiceLogger);
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing UAM With phone verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH UAM NUMBER
    const identifierHash = hashIdentifiers({
      UAMNumber: UAMNumber
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const UAMRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!UAMRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for UAM with Phone verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: UAMRateLimitResult.message,
      });
    };

    businessServiceLogger.info(`Generated UAM with Phone txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(`[FAILED]: Credit deduction failed for UAM with phone verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedUAM = encryptData(UAMNumber);

    const existingUAM = await uamPhone_Verification.findOne({ UAMNumber: encryptedUAM, customerNumber })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for UAM with Phone verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing UAM with phone record in DB: ${existingUAM ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingUAM) {
      if (existingUAM?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached UAM with phone response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingUAM?.response,
          UAMNumber: UAMNumber,
          customerNumber: customerNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingUAM?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached UAM with phone response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingUAM?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingUAM?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for UAM category ${categoryId}, service ${serviceId}`,
      );
      return res.status(424).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for UAM verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await UamActiveServiceResponse({ UAMNumber, customerNumber }, service, 'UamwithPhoneApiCall', 0, TxnID);

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for UAM verification service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        UAMNumber: encryptedUAM,
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
        UAMNumber: encryptedUAM,
        customerNumber: customerNumber,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await uamPhone_Verification.findOneAndUpdate(
        { UAMNumber: encryptedUAM },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid UAM response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          UAMNumber: UAMNumber,
          customerNumber: customerNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        UAMNumber: encryptedUAM,
        customerNumber: customerNumber,
        response: {
          UAMNumber: UAMNumber,
          customerNumber: customerNumber
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await uamPhone_Verification.findOneAndUpdate(
        { UAMNumber: encryptedUAM },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid UAM response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { UAMNumber: UAMNumber }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in UAM verification for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

// SHOPESTABLISHMENT VERIFICATION
exports.handleCreateShopEstablishment = async (req, res, next) => {
  const { registrationNumber, state, mobileNumber = "" } = req.body;
  const { clientId, environment } = req;
  const TxnID = await generateTransactionId(12);

  if (!registrationNumber || !state) {
    businessServiceLogger.warn(`TxnID:${TxnID}, Missing registrationNumber or state`);
    return res.status(ERROR_CODES?.BAD_REQUEST.httpCode).json(createApiResponse(ERROR_CODES?.BAD_REQUEST.code, [], 'Invalid request parameters'));
  }

  businessServiceLogger.info(`TxnID:${TxnID}, Shop Establishment Details ===>> registrationNumber: ${registrationNumber} --- state: ${state}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('SHOP', TxnID, businessServiceLogger);

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing Shop Establishment verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      registrationNumber,
      state
    }, businessServiceLogger);

    const shopRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!shopRateLimitResult.allowed) {
      businessServiceLogger.info(`[FAILED]: Rate limit exceeded for Shop Establishment verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: shopRateLimitResult.message,
      });
    }

    businessServiceLogger.info(`Generated Shop Establishment txn Id: ${TxnID}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(`TxnID:${TxnID}, [FAILED]: Credit deduction failed for Shop Establishment verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedRegistration = encryptData(registrationNumber);

    const existingDetails = await shopestablishmentModel.findOne({
      registrationNumber: encryptedRegistration,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Analytics update failed for Shop Establishment verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing Shop Establishment record in DB: ${existingDetails ? "Found" : "Not Found"}`,
    );

    if (existingDetails) {
      if (existingDetails?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached valid Shop Establishment response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingDetails?.response,
          registrationNumber: registrationNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDetails?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res
          .status(200)
          .json(createApiResponse(200, decrypted, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached invalid Shop Establishment response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDetails?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res
          .status(404)
          .json(createApiResponse(404, existingDetails?.response, "inValid"));
      }
    }

    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);

    if (!service.length) {
      businessServiceLogger.info(
        `TxnID:${TxnID}, [FAILED]: Active service not found for Shop Establishment category ${categoryId}, service ${serviceId}`,
      );
      return res.status(424).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, active service for Shop Verify is ----, ${service}`,
    );

    let response = await shopActiveServiceResponse({ registrationNumber, state }, service, 0, TxnID);

    if (response?.message?.toUpperCase() == "VALID" || response?.message?.toUpperCase() == "SUCCESS" || response?.result) {
      const encryptedResponse = {
        ...response?.result,
        registrationNumber: encryptedRegistration,
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
        registrationNumber: encryptedRegistration,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message || "Valid",
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await shopestablishmentModel.findOneAndUpdate(
        { registrationNumber: encryptedRegistration },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid Shop Establishment response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          registrationNumber: registrationNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        registrationNumber: encryptedRegistration,
        response: {
          registrationNumber: registrationNumber
        },
        serviceResponse: response?.responseOfService || {},
        serviceName: response?.service || "Unknown",
        mobileNumber,
        message: response?.message || "Failed",
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await shopestablishmentModel.findOneAndUpdate(
        { registrationNumber: encryptedRegistration },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid Shop Establishment response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { registrationNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(`txnId: ${TxnID}, Error performing Shop verification for client ${clientId}: ${error.message}`);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode || 500).json(createApiResponse(errorObj.code || 500, {}, errorObj.message || 'Server Error'));
  }
};

