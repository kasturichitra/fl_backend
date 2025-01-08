const axios = require("axios");
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model");
require("dotenv").config();
const panverificationModel = require("../../panVerification/models/panverification.model");
const checkingDetails = require("../../../middleware/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const verifyNameModel = require("../models/verifyName.model");

const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;
const ZOOPClientId = process.env.ZOOP_APP_ID;
const ZOOP_API_KEY = process.env.ZOOP_API_KEY;

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
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
exports.verifyholdername = async (req, res, next) => {
  try {
    const { account_no, ifsc, panHolderName } = req.body;
    const authHeader = req.headers.authorization;

    if (!account_no || !ifsc || !panHolderName) {
      let errorMessage = {
        message: "Required Fields are not there",
        statusCode: 400,
      };
      return next(errorMessage);
    }

    const check = await checkingDetails(authHeader, next);

    const merchantDetails = await loginAndSms.findOne({ token: check });
    const MerchantId = merchantDetails?.merchantId;
    if (!MerchantId) {
      let errorMessage = {
        message: "You are not authorized person for this verification",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    console.log("merchant id in verify name===>", MerchantId);
    console.log("panHolderName===>", panHolderName);

    const existingAccountDetails = await verifyNameModel.findOne({
      accountNo: account_no,
    });
    if (existingAccountDetails) {
      const beneficiaryName = existingAccountDetails?.accountHolderName;
      console.log(
        "beneficiaryName in existing===>",
        beneficiaryName,
        panHolderName
      );
      if (beneficiaryName === panHolderName) {
        console.log(
          "beneficiaryName === panHolderName===>",
          beneficiaryName,
          panHolderName
        );
        return res
          .status(200)
          .json({
            beneficiaryName: beneficiaryName,
            result: existingAccountDetails?.responseData?.result?.verification_status,
            message: `Your Given Name Matches With Your Account Name with Efficiency of more than 99`,
            verificationName: panHolderName,
          });
      } else {
        const panUsernameReverse = panHolderName
          ?.split(" ")
          ?.reverse()
          ?.join(" ");
        if (panUsernameReverse === beneficiaryName) {
          console.log(
            "checking names in reverse comparison===>",
            beneficiaryName,
            panHolderName
          );
          return res
            .status(200)
            .json({
                beneficiaryName: beneficiaryName,
                result: existingAccountDetails?.responseData?.result?.verification_status,
                message: `Your Given Name Matches With Your Account Name with Efficiency of more than 99`,
                verificationName: panHolderName,

            });
        } else {
          console.log(
            "checking names in percentage===>",
            beneficiaryName,
            panHolderName
          );
          const panNamecapital = panUsernameReverse?.toUpperCase();
          const beneficiaryNameCapital = beneficiaryName?.toUpperCase();
          const jumblepanName = panNamecapital
            .split(" ")
            .map((word) => word.trim())
            .filter(Boolean);
          const jumbleBeneficiaryNameCapital = beneficiaryNameCapital
            .split(" ")
            .map((word) => word.trim())
            .filter(Boolean);

          const sortedPanNameParts = jumblepanName.sort().join(" ");
          const sortedBeneficaryName = jumbleBeneficiaryNameCapital
            .sort()
            .join(" ");
          const sortedReversePanName = sortedPanNameParts
            ?.split(" ")
            .reverse()
            .join(" ");

          console.log(
            "sortedPanNameParts in verifyUsername===>",
            sortedPanNameParts
          );
          console.log(
            "sortedBeneficaryName in verifyUsername===>",
            sortedBeneficaryName
          );
          console.log(
            "sortedReversePanName in verifyUsername===>",
            sortedReversePanName
          );
          if (sortedPanNameParts === sortedBeneficaryName) {
            return res
              .status(200)
              .json({
                beneficiaryName: beneficiaryName,
                result: existingAccountDetails?.responseData?.result?.verification_status,
                message: `Your Given Name Matches With Your Account Name with Efficiency of more than 90`,
                verificationName: panHolderName,
              });
          }
          const similarity = await compareNames(
            sortedPanNameParts,
            sortedBeneficaryName
          );
          const reverseCompare = await compareNames(
            sortedReversePanName,
            sortedBeneficaryName
          );
          const similarityThreshold = 75;
          const neededValue =
            similarity >= similarityThreshold ? similarity : reverseCompare;
          console.log("similarity in verifyUsername===>", similarity);
          console.log("reverseCompare in verifyUsername===>", reverseCompare);
          if (
            reverseCompare >= similarityThreshold ||
            similarity >= similarityThreshold
          ) {
            console.log(
              "reverseCompare >= similarityThreshold || similarity >= similarityThreshold===>",
              beneficiaryName,
              panHolderName
            );
            return res
              .status(200)
              .json({
                beneficiaryName: beneficiaryName,
                result: existingAccountDetails?.responseData?.result?.verification_status,
                message: `Your Given Name Matches With Your Account Name with Efficiency of ${neededValue}`,
                verificationName: panHolderName,
              });
          } else {
            console.log("names do not match");
            return res
              .status(200)
              .json({
                beneficiaryName: beneficiaryName,
                message: "NamesDoNotMatch",
                verificationName: panHolderName,
             });
          }
        }
      }
    }
    const activeService = await ServiceTrackingModelModel.findOne({
      serviceFor: "Account Verify",
      serviceStatus: "Active",
    });
    console.log("activeService====>", activeService);
    if (activeService) {
      let response;
      if (activeService?.serviceName === "EaseBuzz") {
        response = await verifyAccountEaseBuz(
          account_no,
          ifsc,
          check,
          MerchantId,
          panHolderName
        );
        console.log("response of ease buzz===>", response);
        return res.status(200).json({ response });
      } else if (activeService?.serviceName === "Zoop") {
        response = await verifyUserNameZoop(
          account_no,
          ifsc,
          check,
          MerchantId,
          panHolderName
        );
        console.log("response of zoop===>", response);
        if(response.message == "limit Exceded"){
            let errorMessage = {
                message: "limit Exceded for this Account Number",
                statusCode: 500,
              };
              return next(errorMessage);
        }
        return res.status(200).json( response );
      }
    } else {
      console.log("No active service available");
      let errorMessage = {
        message: "No Active Service Available",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.log(
      "Error performing bank verification:",
      error.response?.data || error.message
    );
    return res
      .status(500)
      .json({ success: false, message: "Failed to perform bank verification" });
  }
};
async function verifyUserNameZoop(
  account_no,
  ifsc,
  token,
  MerchantId,
  panHolderName
) {
  console.log("verifying user name in Zoop pan details===>", panHolderName);
  let panusername = panHolderName;
  try {
    const options = {
      method: "POST",
      url: "https://live.zoop.one/api/v1/in/financial/bav/lite",
      headers: {
        "app-id": ZOOPClientId,
        "api-key": ZOOP_API_KEY,
        "Content-Type": "application/json",
      },
      data: {
        mode: "sync",
        data: {
          account_number: account_no,
          ifsc: ifsc,
          consent: "Y",
          consent_text:
            "I hereby declare my consent agreement for fetching my information via ZOOP API",
        },
      },
    };

    console.log("Zoop request options: ", options);

    const response = await axios(options);
    const obj = response.data;
    console.log("Zoop API response verifyUserNameZoop: ", JSON.stringify(obj));

    const beneficiaryName = obj?.result?.beneficiary_name;
    const detailsToSave = {
      token: token,
      MerchantId,
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: beneficiaryName,
      responseData: obj,
      verificationName: panHolderName,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };
    if (beneficiaryName) {
      const newAccountVerification = await verifyNameModel.create(
        detailsToSave
      );
      console.log("newAccountVerification===>", newAccountVerification);
    }

    const beneficiarySmallerName = beneficiaryName?.toLowerCase();
    const panSmallerName = panusername?.toLowerCase();
    console.log(
      "beneficiarySmallerName === panSmallerName in verifyUserNameZoop outside if====>",
      beneficiarySmallerName,
      panSmallerName
    );

    if (beneficiarySmallerName === panSmallerName) {
      console.log(
        "beneficiarySmallerName === panSmallerName in verifyUserNameZoop====>",
        beneficiarySmallerName,
        panSmallerName
      );

      return {
        BeneficiaryName: beneficiaryName,
        Result: obj?.result?.verification_status,
        Message: `Your Given Name Matches With Your Account Name with Efficiency more than 98`,
        VerificationName: panHolderName,
      };
    } else {
      const panUsernameReverse = panSmallerName.split(" ").reverse().join(" ");
      if (panUsernameReverse === beneficiarySmallerName) {
        console.log(
          "bpanUsernameReverse === beneficiarySmallerName in verifyUserNameZoop====>",
          panUsernameReverse,
          panusername
        );

        return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency more than 95`,
            VerificationName: panHolderName,
        };
      } else {
        const panNamecapital = panUsernameReverse?.toUpperCase();
        const beneficiaryNameCapital = beneficiarySmallerName?.toUpperCase();
        const jumblepanName = panNamecapital
          .split(" ")
          .map((word) => word.trim())
          .filter(Boolean);
        const jumbleBeneficiaryNameCapital = beneficiaryNameCapital
          .split(" ")
          .map((word) => word.trim())
          .filter(Boolean);

        const sortedPanNameParts = jumblepanName.sort().join(" ");
        const sortedBeneficaryName = jumbleBeneficiaryNameCapital
          .sort()
          .join(" ");
        const sortedReversePanName = sortedPanNameParts
          ?.split(" ")
          .reverse()
          .join(" ");

        console.log(
          "sortedPanNameParts in verifyUserNameZoop===>",
          sortedPanNameParts
        );
        console.log(
          "sortedBeneficaryName in verifyUserNameZoop===>",
          sortedBeneficaryName
        );
        console.log(
          "sortedBeneficaryName in verifyUserNameZoop===>",
          sortedReversePanName
        );
        if (sortedPanNameParts === sortedBeneficaryName) {
          return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency more than 90`,
            VerificationName: panHolderName,
          };
        }
        const similarity = await compareNames(
          sortedBeneficaryName,
          sortedPanNameParts
        );
        const reverseCompare = await compareNames(
          sortedBeneficaryName,
          sortedReversePanName
        );
        const similarityThreshold = 30;
        const neededValue =
        similarity >= similarityThreshold ? similarity : reverseCompare;
        if (
          reverseCompare >= similarityThreshold ||
          similarity >= similarityThreshold
        ) {
          console.log(
            "reverseCompare >= similarityThreshold || similarity >= similarityThreshold====>",
            beneficiaryName,
            panusername
          );

          return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency of ${neededValue}`,
            VerificationName: panHolderName,
          };
        } else {
          console.log(
            "reverseCompare >= NamesDoNotMatch====>",
            beneficiaryName,
            panusername
          );

          return { message: "NamesDoNotMatch" };
        }
      }
    }
  } catch (error) {
    console.log("Error performing bank verification:", error);
    console.log(
      "Error performing bank verification:",
      error.response?.data || error.message
    );
    if(error.response?.data?.response_code == 107){
        return {
            beneficiaryName: "Name Not Found",
            message: "limit Exceded",
          };
    }
    return {
      beneficiaryName: "Name Not Found",
      message: "InternalServerError",
    };
  }
}
async function verifyAccountEaseBuz(
  account_no,
  ifsc,
  token,
  MerchantId,
  panHolderName
) {
  let panusername = panHolderName;
  console.log("panusername verifyAccountEaseBuz===>", panusername);
  try {
    const hashString = `${EASEBUZZ_KEY}|${account_no}|${ifsc}|${EASEBUZZ_SALT}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    const config = {
      headers: {
        authorization: hash,
      },
    };

    const response = await axios.post(
      "https://wire.easebuzz.in/api/v1/beneficiaries/bank_account/verify/",
      {
        key: EASEBUZZ_KEY,
        account_no: account_no,
        ifsc: ifsc,
      },
      config
    );
    console.log(
      "response of easebuzz to verify account verifyAccountEaseBuz===>",
      response?.data
    );

    const accountusername = response?.data?.data?.account_name;
    const detailsToSave = {
      token: token,
      MerchantId,
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: accountusername,
      responseData: response.data.data,
      verificationName: panHolderName,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };
    if (accountusername) {
      const newAccountVerification = await verifyNameModel.create(
        detailsToSave
      );
      console.log("newAccountVerification===>", newAccountVerification);
    }
    const beneficiarySmallerName = accountusername?.toLowerCase();
    const panSmallerName = panusername?.toLowerCase();
    console.log(
      "beneficiarySmallerName === panSmallerName===>",
      beneficiarySmallerName,
      panSmallerName
    );
    if (beneficiarySmallerName === panSmallerName) {
      return {
        BeneficiaryName: beneficiaryName,
        Result: obj?.result?.verification_status,
        Message: `Your Given Name Matches With Your Account Name with Efficiency more than 98`,
        VerificationName: panHolderName,
      };
    } else {
      const panUsernameReverse = panSmallerName.split(" ").reverse().join(" ");
      if (panUsernameReverse === beneficiarySmallerName) {
        console.log(
          "panUsernameReverse === beneficiarySmallerName===>",
          panUsernameReverse,
          beneficiarySmallerName
        );
        return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency more than 95`,
            VerificationName: panHolderName,
        };
      } else {
        const panNamecapital = panUsernameReverse?.toUpperCase();
        const beneficiaryNameCapital = beneficiarySmallerName?.toUpperCase();
        const jumblepanName = panNamecapital
          .split(" ")
          .map((word) => word.trim())
          .filter(Boolean);
        const jumbleBeneficiaryNameCapital = beneficiaryNameCapital
          .split(" ")
          .map((word) => word.trim())
          .filter(Boolean);

        const sortedPanNameParts = jumblepanName.sort().join(" ");
        const sortedBeneficaryName = jumbleBeneficiaryNameCapital
          .sort()
          .join(" ");
        const sortedReversePanName = sortedPanNameParts
          ?.split(" ")
          .reverse()
          .join(" ");
        console.log(
          "sortedPanNameParts in verifyAccountEaseBuz===>",
          sortedPanNameParts
        );
        console.log(
          "sortedBeneficaryName in verifyAccountEaseBuz===>",
          sortedBeneficaryName
        );
        console.log(
          "sortedReversePanName in verifyAccountEaseBuz===>",
          sortedReversePanName
        );
        if (sortedPanNameParts === sortedBeneficaryName) {
          return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency more than 90`,
            VerificationName: panHolderName,
          };
        }

        const similarity = await compareNames(
          sortedPanNameParts,
          sortedBeneficaryName
        );
        const reverseCompare = await compareNames(
          sortedReversePanName,
          sortedBeneficaryName
        );
        const similarityThreshold = 70;
        const neededValue =
        similarity >= similarityThreshold ? similarity : reverseCompare;
        if (
          reverseCompare >= similarityThreshold ||
          similarity >= similarityThreshold
        ) {
          console.log(
            "reverseCompare >= similarityThreshold || similarity >= similarityThreshold====>",
            panUsernameReverse,
            beneficiarySmallerName
          );
          return {
            BeneficiaryName: beneficiaryName,
            Result: obj?.result?.verification_status,
            Message: `Your Given Name Matches With Your Account Name with Efficiency of ${neededValue}`,
            VerificationName: panHolderName,
          };
        } else {
          return { message: "NamesDoNotMatch" };
        }
      }
    }
  } catch (error) {
    console.error("Error verifying bank account in ease buzz:", error);
    return { message: "InternalServerError" };
  }
}
