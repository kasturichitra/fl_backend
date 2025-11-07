const axios = require("axios");
const logger = require("../Logger/logger");
const crypto = require("crypto");
const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;

async function apiCall(url, body, headers) {
  console.log("Api call triggred in easebuzz", url, body, headers);
  try {
    const res = await axios.post(url, body, headers);
    console.log("Api Call response in easebuzz ===>", res?.data);
    return res?.data;
  } catch (err) {
    console.log(`Easebuzz Attempt error`, err);
    console.log(
      "Easebuzz Attempt error:",
      err?.response?.status,
      err?.response?.data
    );
    const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
    if (!isNetworkErr) {
      throw err;
    }
  }
}

async function verifyBankAccountEaseBuzz(data) {
  const { account_no, ifsc } = data;
  const url =
    "https://wire.easebuzz.in/api/v1/beneficiaries/bank_account/verify/";
  const hashString = `${EASEBUZZ_KEY}|${account_no}|${ifsc}|${EASEBUZZ_SALT}`;

  console.log("hashString ===>>", hashString);
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");
  console.log("hash ===>>", hash);

  const config = {
    headers: {
      Authorization: hash,
    },
  };

  const requestData = {
    key: EASEBUZZ_KEY,
    account_no: account_no,
    ifsc: ifsc,
  };

  try {
    const responseFromBankWithEaseBuzz = await apiCall(
      url,
      requestData,
      config
    );
    console.log(
      "responseFromBankWithEaseBuzz ===>>>",
      responseFromBankWithEaseBuzz
    );
    if (responseFromBankWithEaseBuzz?.success) {
      return {
        result: returnedObj,
        message: "Valid",
        responseOfService: cashfreeResponse,
        service: "Cashfree",
      };
    } else {
      return {
        message: "InValid",
        responseOfService: cashfreeResponse,
        result: {},
        success: false,
      };
    }
  } catch (error) {
    console.error("verifyBankAccountEaseBuzz error ===>>>", error);
  }
}

module.exports = {
  verifyBankAccountEaseBuzz,
};
