const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { mapError, ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { otherServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const comparingNamesModel = require("../models/compareName.model");
const { NameMatchActiveServiceResponse } = require("../services/services");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen");

async function checkCompareNames(firstName, secondName) {
  console.log("firstName, secondName===>", firstName, secondName);
  const cleanedFirstname = removeTitle(firstName);
  const cleanedSecondName = removeTitle(secondName);

  const firstNameToCompare = normalizeName(cleanedFirstname);
  const secondNameToCompare = normalizeName(cleanedSecondName);

  const reverseFirstName = firstNameToCompare.split(" ").reverse().join(" ");
  const reverseSecondName = secondNameToCompare.split(" ").reverse().join(" ");

  const sortedFirstName = firstNameToCompare.split(" ").sort().join(" ");
  const sortedSecondName = secondNameToCompare.split(" ").sort().join(" ");

  const jumbleReverseSecondName = reverseSecondName.split(" ").sort().join(" ");
  otherServiceLogger.info(
    `[COMMON FUNCTION] reverseFirstName: ${reverseFirstName} ===> && reverseSecondName: ${reverseSecondName} ===>`,
  );
  otherServiceLogger.info(
    `[COMMON FUNCTION] sortedFirstName: ${sortedFirstName} ===> && sortedSecondName: ${sortedSecondName} ===> && jumbleReverseSecondName: ${jumbleReverseSecondName}`,
  );
  if (sortedFirstName === sortedSecondName) {
    return { similarity: 100, reverseSimilarity: 100 };
  }
  if (sortedFirstName === jumbleReverseSecondName) {
    return { similarity: 100, reverseSimilarity: 100 };
  }

  const similarity =  compareNames(sortedFirstName, sortedSecondName);
  const reverseSimilarity =  compareNames(
    sortedFirstName,
    jumbleReverseSecondName,
  );
  otherServiceLogger.info(
    `[COMMON FUNCTION] similarity: ${similarity} ===> && reverseSimilarity: ${reverseSimilarity} ===>`,
  );

  return { similarity: similarity, reverseSimilarity: reverseSimilarity };
}
function normalizeName(name) {
  return name.toUpperCase().replace(/\s+/g, " ").trim();
}
function compareNames(accountName, panName) {
  const distance = levenshteinDistance(accountName, panName);
  const maxLength = Math.max(accountName.length, panName.length);
  const similarity = 1 - distance / maxLength;
  return similarity * 100;
}
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
function removeTitle(name) {
  const titleRegex = /^(MR|MRS|MISS|MS|DR|SIR|LADY|LORD|PROF|REV)\.?\s*/i;
  return name.replace(titleRegex, "").trim();
};

exports.compareNames = async (req, res, next) => {
  const {
    firstName,
    secondName,
    mobileNumber = ""
  } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!firstName || !secondName) {
    return res.status(400).json(createApiResponse(400, null, ERROR_CODES?.BAD_REQUEST));
  }

  const capitalFirstName = firstName?.toUpperCase();
  const capitalSecondName = secondName?.toUpperCase();

  otherServiceLogger.info(`TxnID:${TxnID}, Compare Name Details: firstName:${capitalFirstName}, secondName:${capitalSecondName}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("NAME_MATCH", TxnID, otherServiceLogger);

    const isFirstValid = handleValidation("firstName", capitalFirstName, res, TxnID, otherServiceLogger);
    if (!isFirstValid) return;

    const isSecondValid = handleValidation("firstName", capitalSecondName, res, TxnID, otherServiceLogger);
    if (!isSecondValid) return;

    otherServiceLogger.info(`TxnID:${TxnID}, Executing CompareNames for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    const indetifierHash = hashIdentifiers({
      FN: capitalFirstName,
      SN: capitalSecondName,
    }, otherServiceLogger);

    const nameRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: otherServiceLogger
    });

    if (!nameRateLimitResult.allowed) {
      otherServiceLogger.info(`[FAILED]: Rate limit exceeded for NameMatch: TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: nameRateLimitResult.message,
      });
    }

    otherServiceLogger.info(`Generated NameMatch Txn id: ${TxnID}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      otherServiceLogger
    );

    if (!maintainanceResponse?.result) {
      otherServiceLogger.info(`[FAILED]: Credit deduction failed for NameMatch check: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingDetails = await comparingNamesModel.findOne({
      firstName: capitalFirstName,
      secondName: capitalSecondName,
    });

    otherServiceLogger.info(`TxnID:${TxnID}, Checked for existing NameMatch Records in DB: ${existingDetails ? "Found" : "NotFound"}`);

    if (existingDetails) {
      otherServiceLogger.info(`TxnID:${TxnID}, Returning cached NameMatch response for client: ${clientId}`);
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: existingDetails?.responseData,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      return res.status(200).json({
        message: "Valid",
        success: true,
        response: existingDetails?.responseData,
      });
    } else {
      const result = await checkCompareNames(
        capitalFirstName,
        capitalSecondName,
      );
      otherServiceLogger.info(`TxnID:${TxnID}, result from checkCompareNames in name match ===>> ${JSON.stringify(result)}`);

      const { reverseSimilarity, similarity } = result;

      if (result) {
        const nameMatchResponse = {
          firstName: capitalFirstName,
          secondName: capitalSecondName,
          result: Math.max(similarity, reverseSimilarity),
        };

        const analyticsResult = await AnalyticsDataUpdate(
          clientId,
          serviceId,
          categoryId,
          'success',
          otherServiceLogger
        );

        if (!analyticsResult.success) {
          otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for NameMatch Verification: clientId ${clientId}, service ${serviceId}`);
        }

        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: nameMatchResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });

        const storingData = {
          firstName: capitalFirstName,
          secondName: capitalSecondName,
          responseData: nameMatchResponse,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        };

        await comparingNamesModel.findOneAndUpdate(
          { firstName: capitalFirstName, secondName: capitalSecondName },
          { $setOnInsert: storingData },
          { upsert: true, new: true }
        );

        otherServiceLogger.info(`TxnID:${TxnID}, Valid NameMatch response stored and sent to client: ${clientId}`)

        return res.status(200).json({
          message: "Valid",
          success: true,
          response: nameMatchResponse,
        });
      } else {
        otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: checkCompareNames returned no result for NameMatch: client ${clientId}`);
        return res.status(500).json({
          message: "something Went Wrong 🤦‍♂️",
          ...ERROR_CODES?.SERVICE_UNAVAILABLE,
        });
      }
    }
  } catch (error) {
    otherServiceLogger.error(
      `TxnID:${TxnID}, System error in comparing Names for client ${clientId}: ${error.message}`,
      error
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.compareNamesWithServices = async (req, res) => {
  const { firstName, secondName, mobileNumber } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!firstName || !secondName) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  otherServiceLogger.info(`TxnID:${TxnID}, Compare name with services details firstName:${firstName}, secondName:${secondName}`);

  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("CompareNamewithService", TxnID, otherServiceLogger);

    const isFistNameValid = handleValidation("Names", firstName, res, TxnID, otherServiceLogger);
    if (!isFistNameValid) return;

    const isSecondNameValid = handleValidation("Names", secondName, res, TxnID, otherServiceLogger);
    if (!isSecondNameValid) return;

    otherServiceLogger.info(`TxnID:${TxnID}, Executing CompareNames with service for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      firstName,
      secondName
    }, otherServiceLogger);

    //1. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const NameMatchRateLimit = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: otherServiceLogger
    });

    if (!NameMatchRateLimit.allowed) {
      otherServiceLogger.info(`[FAILED]: Rate limit exceeded for namematch verification: TxnID:${TxnID}, client ${clientId}, service: ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: NameMatchRateLimit.message,
      });
    }

    otherServiceLogger.info(`Generated NameMatch Txn id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      otherServiceLogger
    );

    if (!maintainanceResponse?.result) {
      otherServiceLogger.info(`[FAILED]: Credit deduction failed for Compare names verfication: TxnID:${TxnID}, client: ${clientId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    // 3. CHECK IN THE DB IS DATA PRESENT
    // NOTE: Using comparingNamesModel as Names_verifyModel is undefined in current scope
    const existingNames = await comparingNamesModel.findOne({
      firstName,
      secondName,
    });

    // 4. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      otherServiceLogger
    );

    if (!analyticsResult?.success) {
      otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`);
    }

    otherServiceLogger.info(`TxnID:${TxnID}, Checked for existing Names in DB Records: ${existingNames ? "Found" : "NotFound"}`);

    if (existingNames) {
      if (existingNames?.status == 1) {
        otherServiceLogger.info(`TxnID:${TxnID}, Returning Cached NameMatch Response for Client: ${clientId}`);

        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingNames?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });

        return res.status(200).json(createApiResponse(200, existingNames?.response, "Valid"));
      } else {
        otherServiceLogger.info(`TxnID:${TxnID}, Returning cached NameMatch response for client ${clientId}`);

        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingNames?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingNames?.response;
        return res.status(404).json(createApiResponse(404, dataToShow, "Invalid"));
      }
    }

    // 6.IF NO DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, otherServiceLogger);
    if (!service.length) {
      otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Active service not found for CompareName category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    // 7. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await NameMatchActiveServiceResponse(
      { firstName, secondName },
      service,
      0,
      TxnID
    );

    otherServiceLogger.info(`TxnID:${TxnID}, Active service selected for Nameverification service ${response?.service}: ${response?.message}`);

    // 8. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
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
        firstName,
        secondName,
        response: response?.result,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await comparingNamesModel.findOneAndUpdate(
        { firstName, secondName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      otherServiceLogger.info(`TxnID:${TxnID}, Valid NameMatch response stored and sent to client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          firstName,
          secondName,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        firstName,
        secondName,
        response: {
          firstName,
          secondName,
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await comparingNamesModel.findOneAndUpdate(
        { firstName, secondName },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      otherServiceLogger.info(`TxnID:${TxnID}, Invalid Name match response received and sent to client: ${clientId}`);
      return res.status(404).json(createApiResponse(404, { firstName, secondName }, "Failed"));
    }
  } catch (error) {
    otherServiceLogger.error(
      `TxnID:${TxnID}, System error in compare Name with services verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

//362 FSSAI Verification
exports.FSSAIVerification = async (req, res) => {
  const { FSSAINumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!FSSAINumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  otherServiceLogger.info(`TxnID:${TxnID}, FSSAINumber NUMBER Details: ${FSSAINumber}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId("FSSAINumber", TxnID, otherServiceLogger);

    const isValid = handleValidation("FSSAINumber", FSSAINumber, res, TxnID, otherServiceLogger);
    if (!isValid) return;

    otherServiceLogger.info(`TxnID:${TxnID}, Executing FSSAINumber verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`);

    //1. HASH FSSAINumber NUMBER
    const indetifierHash = hashIdentifiers({
      FSSAINumber,
    }, otherServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const FSSAIRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: otherServiceLogger
    });

    if (!FSSAIRateLimitResult.allowed) {
      otherServiceLogger.info(`[FAILED]: Rate limit exceeded for FSSAI verification: TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: FSSAIRateLimitResult.message,
      });
    }

    otherServiceLogger.info(`Generated FSSAI txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      otherServiceLogger
    );

    if (!maintainanceResponse?.result) {
      otherServiceLogger.info(`[FAILED]: Credit deduction failed for FSSAI verification: TxnID:${TxnID}, client ${clientId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedFSSAI = encryptData(FSSAINumber);

    // Note: FSSAI_verifyModel is undefined in current scope, keeping usage as requested for refactoring pattern
    const existingFssai = await FSSAI_verifyModel.findOne({
      FSSAINumber: encryptedFSSAI,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      otherServiceLogger
    );
    if (!analyticsResult.success) {
      otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Analytics update failed for FSSAI verification: client ${clientId}, service ${serviceId}`);
    }

    otherServiceLogger.info(`TxnID:${TxnID}, Checked for existing FSSAI record in DB: ${existingFssai ? "Found" : "Not Found"}`);

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingFssai) {
      if (existingFssai?.status == 1) {
        otherServiceLogger.info(`TxnID:${TxnID}, Returning cached FSSAI response for client: ${clientId}`);

        const decrypted = {
          ...existingFssai?.response,
          FSSAINumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingFssai?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res.status(200).json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        otherServiceLogger.info(`TxnID:${TxnID}, Returning cached FSSAI response for client: ${clientId}`);
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingFssai?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingFssai?.response;
        return res.status(404).json(createApiResponse(404, dataToShow, "Invalid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, otherServiceLogger);
    if (!service.length) {
      otherServiceLogger.info(`TxnID:${TxnID}, [FAILED]: Active service not found for FSSAI category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    otherServiceLogger.info(`TxnID:${TxnID}, Active service selected for FSSAI verification: ${service.serviceFor}`);

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await FSSAIActiveServiceResponse(FSSAINumber, service, 0, TxnID);

    otherServiceLogger.info(`TxnID:${TxnID}, Active service selected for FSSAI verification service ${response?.service}: ${response?.message}`);

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        FSSAINumber: encryptedFSSAI,
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
        FSSAINumber: encryptedFSSAI,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await FSSAI_verifyModel.findOneAndUpdate(
        { FSSAINumber: encryptedFSSAI },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      otherServiceLogger.info(`TxnID:${TxnID}, Valid FSSAI response stored and sent to client: ${clientId}`);
      return res.status(200).json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          FSSAINumber: FSSAINumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        FSSAINumber: encryptedFSSAI,
        response: {
          FSSAINumber: FSSAINumber,
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await FSSAI_verifyModel.findOneAndUpdate(
        { FSSAINumber: encryptedFSSAI },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      otherServiceLogger.info(`TxnID:${TxnID}, Invalid FSSAI response received and sent to client: ${clientId}`);
      return res.status(404).json(createApiResponse(404, { FSSAINumber: FSSAINumber }, "Failed"));
    }
  } catch (error) {
    otherServiceLogger.error(
      `TxnID:${TxnID}, System error in FSSAI verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
