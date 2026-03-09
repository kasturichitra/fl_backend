const { deductCredits } = require("../../../services/CreditService");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { otherServiceLogger } = require("../../Logger/logger");
const comparingNamesModel = require("../models/compareName.model");

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
  logger.info(
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

exports.compareNames = async (req, res, next) => {
  console.log("Compare Name is triggred");
  otherServiceLogger.info("Compare Name is triggred");

  const {
    firstName,
    secondName,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  console.log("firstName and secondName ===>>", secondName, firstName);
  otherServiceLogger.info("firstName and secondName ===>>", secondName, firstName);
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
  otherServiceLogger.info("NAME txn Id ===>>", tnId);
  const maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req.environment,
  );

  if (!maintainanceResponse?.result) {
    otherServiceLogger.error(
      `Credit deduction failed for Card BIN check: client ${storingClient}, txnId ${tnId}`,
    );
    return res.status(500).json({
      success: false,
      message: maintainanceResponse?.message || "InValid",
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
      logger.info("result from compareNames in name match ===>>", result);

      const { reverseSimilarity, similarity } = result;

      console.log(
        "reverseSimilarity and similarity ===>>",
        similarity,
        reverseSimilarity,
      );
      logger.info(
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
        logger.info(
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
