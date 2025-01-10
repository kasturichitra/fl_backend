const crypto = require('crypto'); // Use the native Node.js crypto module
const axios = require('axios');
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model")
const accountdataModel = require("../models/accountdata.model");
require('dotenv').config();
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;
const ZOOPClientId = process.env.ZOOP_APP_ID
const ZOOP_API_KEY = process.env.ZOOP_API_KEY


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
  console.log("account_no, ifsc===>", account_no, ifsc)

  const check = await checkingDetails(authHeader , next)

  try {

    if (!account_no || !ifsc) {
      let errorMessage = {
        message: "Account number and IFSC code are required 😁",
        statusCode: 400,
      };
      return next(errorMessage);
    }

    const merchant = await loginAndSms.findOne({ token : check });
    console.log("merchant==============================>", merchant.merchantId)
    console.log("token==============================>", check)
    if (!merchant) {
      let errorMessage = {
        message: "You are not authorized person for this verification",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    const MerchantId = merchant.merchantId
    if (!MerchantId) {
      let errorMessage = {
        message: "MerchantId is required to proceed",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    const existingAccountDetails = await accountdataModel.findOne({ accountNo: account_no });
    if (existingAccountDetails) {
      const response = {
        BeneficiaryName: existingAccountDetails?.accountHolderName,
        AccountNumber : existingAccountDetails?.accountNo,
        IFSC : existingAccountDetails?.accountIFSCCode,
        Message: existingAccountDetails?.responseData?.result?.verification_status,
      }
      return res.status(200).json( response );
      
    }
    const activeService = await ServiceTrackingModelModel.findOne({ serviceFor: "Account Verify", serviceStatus: "Active" });
    console.log("activeService====>", activeService);
    if (activeService) {
      let response;
      if (activeService?.serviceName === "EaseBuzz") {
        result = await verifyBankAccountEaseBuz(account_no, ifsc, check, MerchantId);
        console.log("response of ease buzz===>", result);
        const response = {
          BeneficiaryName: result?.beneficiaryName,
          AccountNumber : result?.data?.accountNo,
          IFSC : result?.data?.accountIFSCCode,
          Message: result?.data?.responseData?.result?.verification_status,
        }
        return res.status(200).json( response );

      } else if (activeService?.serviceName === "Zoop") {
        result = await verifyBankAccountZoop(account_no, ifsc, check, MerchantId);
        console.log("response of eazz zoop===>", result);
        const response = {
          BeneficiaryName: result?.beneficiaryName,
          AccountNumber : result?.data?.accountNo,
          IFSC : result?.data?.accountIFSCCode,
          Message: result?.data?.responseData?.result?.verification_status,
        }
        return res.status(200).json( response );

      } else {
        let errorMessage = {
          message: "No active service available",
          statusCode: 500,
        };
        return next(errorMessage);
      }
    }
    else {
      console.log("No active service available");
      let errorMessage = {
        message: "No active service available",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.error('Error verifying bank account verifyBankAccount:', error);
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

async function verifyBankAccountZoop(account_no, ifsc, token, MerchantId) {
  console.log("verifying user name in Zoop");

  try {
    const options = {
      method: 'POST',
      url: 'https://live.zoop.one/api/v1/in/financial/bav/lite',
      headers: {
        'app-id': ZOOPClientId,
        'api-key': ZOOP_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        mode: 'sync',
        data: {
          account_number: account_no,
          ifsc: ifsc,
          consent: 'Y',
          consent_text: 'I hereby declare my consent agreement for fetching my information via ZOOP API'
        }
      }
    };

    console.log("Zoop request options: verifyBankAccountZoop", options);

    const response = await axios(options);
    const obj = response.data;
    console.log("Zoop API response in bank account verify: ", JSON.stringify(obj));

    const accountusername = obj?.result?.beneficiary_name;
    const detailsToSave = {
      token: token,
      MerchantId,
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: accountusername,
      responseData: obj,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };
    const beneficiarySmallerName = accountusername?.toLowerCase()
    if (accountusername) {
      await accountdataModel.create(detailsToSave);
      return { beneficiaryName: accountusername, data: detailsToSave , message: "Valid" };


    }
    console.log("merchantSmallerName === panSmallerName >", merchantSmallerName, beneficiarySmallerName)

  

  } catch (error) {
    console.log('Error performing bank verification:', error.response?.data || error.message);
    return { beneficiaryName: "Name Not Found", message: "NameNotFound" };
  }
}
async function verifyBankAccountEaseBuz(account_no, ifsc, token, MerchantId) {
  try {
 

    if (!MerchantId) {
      return { message: 'MerchantId is required to proceed' };
    }

    const hashString = `${EASEBUZZ_KEY}|${account_no}|${ifsc}|${EASEBUZZ_SALT}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const config = {
      headers: {
        'authorization': hash
      }
    };
    const response = await axios.post('https://wire.easebuzz.in/api/v1/beneficiaries/bank_account/verify/', {
      key: EASEBUZZ_KEY,
      account_no: account_no,
      ifsc: ifsc,
    }, config);
    console.log("response.data?.data===>", response.data)
    const accountusername = response.data?.data?.account_name;
    const detailsToSave = {
      token: token,
      MerchantId,
      accountNo: account_no,
      accountIFSCCode: ifsc,
      accountHolderName: accountusername,
      responseData: response.data.data,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };
    if (accountusername) {
      await accountdataModel.create(detailsToSave);
      return { beneficiaryName: accountusername, data: detailsToSave , message: "Valid" };
    }
  
  } catch (error) {
    console.error('Error verifying bank account verifyBankAccountEaseBuz:', error);
    return { error: 'Internal Server Error' };
  }
}
