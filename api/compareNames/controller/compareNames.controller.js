const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { otherServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const comparingNamesModel = require("../models/compareName.model");
const { NameMatchActiveServiceResponse } = require("../services/services");

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

  console.log(
    "sortedFirstName === sortedSecondName===>",
    sortedFirstName,
    sortedSecondName,
  );
  console.log(
    "sortedFirstName === sortedSecondName===>",
    sortedFirstName,
    sortedSecondName,
  );
  console.log(
    "sortedFirstName === reverseSortedSecondName===>",
    sortedFirstName,
    jumbleReverseSecondName,
  );
  if (sortedFirstName === sortedSecondName) {
    return { similarity: 100, reverseSimilarity: 100 };
  }
  if (sortedFirstName === jumbleReverseSecondName) {
    return { similarity: 100, reverseSimilarity: 100 };
  }

  const similarity = await compareNames(sortedFirstName, sortedSecondName);
  const reverseSimilarity = await compareNames(
    sortedFirstName,
    jumbleReverseSecondName,
  );
  console.log("similarity===>", similarity);
  console.log("reverseSimilarity===>", reverseSimilarity);

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
}

// names verification - own logic 
exports.compareNamesCopy = async (req, res, next) => {
  console.log("Compare Name is triggred");
  console.log("Compare Name is triggred");

  const {
    firstName,
    secondName,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  console.log("firstName and secondName ===>>", secondName, firstName);
  console.log("firstName and secondName ===>>", secondName, firstName);
  const capitalFirstName = firstName?.toUpperCase();
  const capitalSecondName = secondName?.toUpperCase();
  const isFirstValid = handleValidation("firstName", capitalFirstName, res);
  if (!isFirstValid) return;

  const isSecondValid = handleValidation("firstName", capitalSecondName, res);
  if (!isSecondValid) return;

  const storingClient = req.clientId || clientId;

  const identifierHash = hashIdentifiers({
    accNo: account_no,
    ifscCode: capitalIfsc,
  });

  const nameRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: storingClient,
  });

  if (!nameRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: nameRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  console.log("NAME txn Id ===>>", tnId);
  console.log("NAME txn Id ===>>", tnId);
  const maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req.environment,
  );

  if (!maintainanceResponse?.result) {
    console.error(
      `Credit deduction failed for Card BIN check: client ${storingClient}, txnId ${tnId}`,
    );
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
  console.log("response in existing===>", existingDetails);

  try {
    if (existingDetails) {
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
      console.log("======>>>>>result in compareNames", result);
      console.log("result from compareNames in name match ===>>", result);

      const { reverseSimilarity, similarity } = result;

      console.log(
        "reverseSimilarity and similarity ===>>",
        similarity,
        reverseSimilarity,
      );
      console.log(
        "reverseSimilarity and similarity in name match api ===>>",
        similarity,
        reverseSimilarity,
      );

      if (result) {
        const nameMatchResponse = {
          firstName: capitalFirstName,
          secondName: capitalSecondName,
          result: Math.max(similarity, reverseSimilarity),
        };
        console.log(
          "reverseSimilarity and similarity ===>>",
          similarity,
          reverseSimilarity,
        );
        console.log(
          "reverseSimilarity and similarity ===>>",
          similarity,
          reverseSimilarity,
        );
        await comparingNamesModel.create({
          firstName: capitalFirstName,
          secondName: capitalSecondName,
          responseData: nameMatchResponse,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        });
        return res.status(200).json({
          message: "Valid",
          success: true,
          response: nameMatchResponse,
        });
      } else {
        let errorMessage = {
          message: "something Went Wrong 🤦‍♂️",
          ...ERROR_CODES?.SERVICE_UNAVAILABLE,
        };
        return res.status(400).json(errorMessage);
      }
    }
  } catch (error) {
    console.log(
      "Error performing comparing Names:",
      error.response?.data || error.message,
    );
    let errorMessage = {
      message: "Error performing comparing Names Try again after Some time",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

exports.compareNamesWithServices = async (req, res) => {
  const { firstName, secondName, mobileNumber } = req.body;
  const clientId = req.clientId;

  if (!firstName || !secondName) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  otherServiceLogger.info(
    `Compare name with services details firstName:${firstName}, secondName:${secondName}`,
  );
  try {
    const { categoryId, serviceId } = await getCategoryIdAndServiceId(
      "CompareNamewithService",
      clientId,
    );

    const isFistNameValid = handleValidation("Names", firstName, res, clientId);
    const isSecondNameValid = handleValidation(
      "Names",
      secondName,
      res,
      clientId,
    );

    if (!isFistNameValid || !isSecondNameValid) return;

    otherServiceLogger.info(
      `Executing CompareNames with service for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const NameMatchRateLimit = await checkingRateLimit({
      identifiers: { firstName, secondName },
      serviceId,
      categoryId,
      clientId,
    });

    if (!NameMatchRateLimit.allowed) {
      otherServiceLogger.info(
        `[FAILED]: Rate limit exceeded for namematch verification: client ${clientId}, service: ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: NameMatchRateLimit.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    otherServiceLogger.info(`Generated NameMatch Txn id: ${tnId}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      otherServiceLogger.info(
        `[FAILED]: Credit deduction failed for Compare names verfication client: ${clientId}, txnId: ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    // 3. CHECK IN THE DB IS DATA PRESENT
    const existingNames = await Names_verifyModel.findOne({
      firstName,
      secondName,
    });

    // 4. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success"
    );

    if (!analyticsResult?.success) {
      otherServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }

    otherServiceLogger.info(
      `checked for existing Names in DB Records: ${existingNames ? "Found" : "NotFound"}`,
    );

    //5. IF DATA IS PRESENT THEN REUTRN THE RESPONSE

    if (existingNames) {
      if (existingNames?.status == 1) {
        otherServiceLogger.info(
          `Returning Cached Din Response for Client: ${clientId}`,
        );

        await responseModel.create({
          serviceId,
          categoryId,
          result: existingNames?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });

        return res
          .status(200)
          .json(createApiResponse(200, existingNames?.response, "Valid"));
      } else {
        otherServiceLogger.info(
          `Returning cached Name response for client ${clientId}`,
        );

        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingNames?.response,
          createdTime: new Date().toLocaleDateString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingNames?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    // 6.IF NO DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId);
    if (!service.length) {
      otherServiceLogger.info(
        `[FAILED]: Active service not found for CompareName category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    // 7. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await NameMatchActiveServiceResponse(
      { firstName, secondName },
      service,
      0,
    );

    otherServiceLogger.info(
      `Active service selected for Nameverification service ${service.serviceFor}: ${response?.message}`,
    );

    // 8. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      // const encryptedResponse = {
      //   ...response?.result,
      //   dinNumber: encryptedFSSAI,
      // };
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

      await Names_verifyModel.create(storingData);
      otherServiceLogger.info(
        `Valid NameMatch response stored and sent to client: ${clientId}`,
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

      await Names_verifyModel.create(storingData);
      otherServiceLogger.info(
        `Invalid Name match response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { firstName, secondName }, "Failed"));
    }
  } catch (error) {
    otherServiceLogger.error(
      `System error in compare Name with services verification for client ${clientId}: ${error.message}`,
      error,
    );
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed"
    );

    if (!analyticsResult?.success) {
      otherServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

//362 FSSAI Verification
exports.FSSAIVerification = async (req, res) => {
  const { FSSAINumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;

  if (!FSSAINumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  otherServiceLogger.info(`FSSAINumber NUMBER Details: ${FSSAINumber}`);
  try {
    const { categoryId, serviceId } = await getCategoryIdAndServiceId(
      "FSSAINumber",
      clientId,
    );

    const isValid = handleValidation("FSSAINumber", FSSAINumber, res, clientId);
    if (!isValid) return;

    otherServiceLogger.info(
      `Executing FSSAINumber verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH FSSAINumber NUMBER
    const indetifierHash = hashIdentifiers({
      FSSAINumber,
    });

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const FSSAIRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
    });

    if (!FSSAIRateLimitResult.allowed) {
      otherServiceLogger.info(
        `[FAILED]: Rate limit exceeded for FSSAI verification: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: FSSAIRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    otherServiceLogger.info(`Generated FSSAI txn Id: ${tnId}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      otherServiceLogger.info(
        `[FAILED]: Credit deduction failed for FSSAI verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedFSSAI = encryptData(FSSAINumber);

    const existingFssai = await FSSAI_verifyModel.findOne({
      FSSAINumber: encryptedFSSAI,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success"
    );
    if (!analyticsResult.success) {
      otherServiceLogger.info(
        `[FAILED]: Analytics update failed for FSSAI verification: client ${clientId}, service ${serviceId}`,
      );
    }

    otherServiceLogger.info(
      `Checked for existing FSSAI record in DB: ${existingFssai ? "Found" : "Not Found"}, `,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingFssai) {
      if (existingFssai?.status == 1) {
        otherServiceLogger.info(
          `Returning cached FSSAI response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingFssai?.response,
          FSSAINumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingFssai?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        otherServiceLogger.info(
          `Returning cached FSSAI response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingFssai?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingFssai?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId);
    if (!service.length) {
      otherServiceLogger.info(
        `[FAILED]: Active service not found for FSSAI category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    otherServiceLogger.info(
      `Active service selected for FSSAI verification: ${service.serviceFor}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await FSSAIActiveServiceResponse(FSSAINumber, service, 0);

    otherServiceLogger.info(
      `Active service selected for FSSAI verification service ${service.serviceFor}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        FSSAINumber: encryptedFSSAI,
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
        FSSAINumber: encryptedFSSAI,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await FSSAI_verifyModel.create(storingData);
      otherServiceLogger.info(
        `Valid FSSAI response stored and sent to client: ${clientId}`,
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

      await din_verifyModel.create(storingData);
      otherServiceLogger.info(
        `Invalid DIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { FSSAINumber: FSSAINumber }, "Failed"));
    }
  } catch (error) {
    otherServiceLogger.error(
      `System error in DIN verification for client ${clientId}: ${error.message}`,
      error,
    );
        const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "failed"
    );

    if (!analyticsResult?.success) {
      otherServiceLogger.info(
        `[FAILED]: Analytics update failed for CompareName Verification: clientId ${clientId}, service ${serviceId}`,
      );
    }
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
