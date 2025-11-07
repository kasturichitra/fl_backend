const crypto = require("crypto"); // Use the native Node.js crypto module
const axios = require("axios");
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/newServiceTrackingModel");
const accountdataModel = require("../models/accountdata.model");
require("dotenv").config();
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

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
exports.verifyBankAccount = async (req, res, next) => {
  const { account_no, ifsc } = req.body;
  const authHeader = req.headers.authorization;
  console.log("account_no, ifsc===>", account_no, ifsc);

  const check = await checkingDetails(authHeader, next);
  try {
    if (!account_no || !ifsc) {
      let errorMessage = {
        message: "Account number and IFSC code are required 😁",
        statusCode: 400,
      };
      return next(errorMessage);
    }

    const merchant = await loginAndSms.findOne({ token: check });
    console.log("merchant==============================>", merchant.merchantId);
    console.log("token==============================>", check);
    if (!merchant) {
      let errorMessage = {
        message: "You are not authorized person for this verification",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    const MerchantId = merchant.merchantId;
    if (!MerchantId) {
      let errorMessage = {
        message: "MerchantId is required to proceed",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    const existingAccountDetails = await accountdataModel.findOne({
      accountNo: account_no,
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
    const activeService = await ServiceTrackingModelModel.findOne({
      serviceFor: "Account Verify",
      serviceStatus: "Active",
    });
    console.log("activeService====>", activeService);
    if (activeService) {
      const upperServiceName = activeService?.serviceName?.toUpperCase();
      let response = "";
      if (upperServiceName === "EASEBUZZ") {
        response = await verifyBankAccountEaseBuz(account_no, ifsc);
      } else if (upperServiceName === "ZOOP") {
        response = await verifyBankAccountZoop(account_no, ifsc);
      } else if (upperServiceName === "TRUTHSCREEN") {
        response = await verifyBankAccountTruthScreen(account_no, ifsc);
      }

      if (response?.message?.toUpperCase() == "VALID") {
      } else {
      }
    } else {
      console.log("No active service available");
      let errorMessage = {
        message: "No active service available",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.error("Error verifying bank account verifyBankAccount:", error);
    if (error.response && error.response.data) {
      let errorMessage = {
        message: error.response.data,
        statusCode: 500,
      };
      return next(errorMessage);
    } else {
      let errorMessage = {
        message: "Internal Server Error",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  }
};

async function verifyBankAccountZoop(account_no, ifsc) {
  console.log("verifying user name in Zoop");

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

    console.log("Zoop request options: verifyBankAccountZoop", options);

    const response = await axios(options);
    const obj = response.data;
    console.log(
      "Zoop API response in bank account verify: ",
      JSON.stringify(obj)
    );

    const accountusername = obj?.result?.beneficiary_name;
    const detailsToSave = {
      token: token,
      MerchantId,
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: accountusername,
      responseData: obj,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };
    const beneficiarySmallerName = accountusername?.toLowerCase();
    if (accountusername) {
      await accountdataModel.create(detailsToSave);
      return {
        beneficiaryName: accountusername,
        data: detailsToSave,
        message: "Valid",
      };
    }
    console.log(
      "merchantSmallerName === panSmallerName >",
      merchantSmallerName,
      beneficiarySmallerName
    );
  } catch (error) {
    console.log(
      "Error performing bank verification:",
      error.response?.data || error.message
    );
    return { beneficiaryName: "Name Not Found", message: "NameNotFound" };
  }
}
async function verifyBankAccountEaseBuz(account_no, ifsc) {
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
    console.log("response.data?.data===>", response.data);
    const accountusername = response.data?.data?.account_name;
    const detailsToSave = {
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: accountusername,
      responseData: response.data.data,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    };
    if (accountusername) {
      await accountdataModel.create(detailsToSave);
      return {
        beneficiaryName: accountusername,
        data: detailsToSave,
        message: "Valid",
        responseOfService: response.data,
      };
    }
  } catch (error) {
    console.error(
      "Error verifying bank account verifyBankAccountEaseBuz:",
      error
    );
    return { error: "Internal Server Error" };
  }
}
async function verifyBankAccountTruthScreen(beneAccNo, ifsc) {
  logger.info("bankVerification called with parameters:", {
    beneAccNo,
    ifsc,
  });
  if (!beneAccNo || !ifsc) {
    return { error: "All fields are required" };
  }

  const username = process.env.TRUTHSCREEN_USERNAME;
  const password = process.env.TRUTHSCREEN_TOKEN;
  const transID = generateTransactionId(14);

  if (!username || !transID || !password) {
    return { error: "Configuration missing or invalid transaction ID" };
  }

  try {
    const url = "https://www.truthscreen.com/v1/apicall/bank/bav_pennyless";
    const payload = {
      transID,
      docType: "573",
      to_account_no: beneAccNo,
      toIFSC: ifsc,
      clientRefId: "27Jul2021004",
      narration: "csc",
    };

    const bankVerifyResponse = await callTruthScreenAPI({
      url,
      payload,
      username,
      password,
    });

    logger.info(
      `bankVerification response received: account_no: ${beneAccNo}, ifsc: ${ifsc}, response: ${JSON.stringify(
        bankVerifyResponse
      )}`
    );

    if (
      bankVerifyResponse?.status === 1 &&
      bankVerifyResponse?.msg?.status?.toUpperCase() === "SUCCESS"
    ) {
      logger.info(
        `Merchant found in bankVerification: account_no: ${beneAccNo} ${merchant.MerchantId}`
      );
      await accountdataModel.create({
        MerchantId,
        accountHolderName: bankVerifyResponse?.msg?.beneficiaryName,
        responseData: bankVerifyResponse,
        accountNo: beneAccNo,
        accountIFSCCode: ifsc,
        token,
      });

      const accountusername = bankVerifyResponse?.msg?.beneficiaryName;

      logger.info(
        `Account data saved for MerchantId:, account_no: ${beneAccNo}, ifsc: ${ifsc}`
      );
      return {
        beneficiaryName: accountusername,
        data: detailsToSave,
        message: "Valid",
        responseOfService: response.data,
      };
    } else {
      logger.error(
        `Bank verification failed: account_no: ${beneAccNo}, ifsc: ${ifsc}, response: ${JSON.stringify(
          bankVerifyResponse
        )}`
      );
      return { message: "Bank Verification Failed", status: 0 };
    }
  } catch (error) {
    logger.error(
      `Bank verification error: account_no: ${beneAccNo}, ifsc: ${ifsc}, error: ${JSON.stringify(
        error
      )}`
    );

    logger.error(
      `Bank verification error response: account_no: ${beneAccNo}, ifsc: ${ifsc}, response: ${JSON.stringify(
        error.response?.data
      )}`
    );
    if (error.response?.data) {
      console.error("TruthScreen Error:", error.response.data);
    }

    return {
      error: "Bank verification failed",
      details: error.message,
    };
  }
}
