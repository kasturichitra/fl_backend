const axios = require("axios");
const logger = require("../Logger/logger");

async function apiCall(url, body, headers) {
    console.log('Api call triggred in cashfree', url, body, headers)
    logger.info(`Api call triggred in cashfree, url: ${url} body: ${JSON.stringify(body)} headers: ${headers}`)
    try {
        const res = await axios.post(url, body, {
            headers,
        });
        console.log('Api Call response in cashfree ===>', res?.data);
        return res?.data;

    } catch (err) {
        const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
        if (!isNetworkErr) {
            throw err;
        }
        console.log(`cashfree Retry Attempt error ${err}`);
    }
}

async function verifyBankAccountCashfree(data) {
  const { account_no, ifsc } = data;

  logger.info(
    `verifyBankAccountCashfree called with parameters: account_no: ${account_no}, ifsc: ${ifsc}`
  );
  console.log("account_no, ifsc =====>> ", account_no, ifsc);

  const url = "https://api.cashfree.com/verification/bank-account/sync";
  const headers = {
    "x-client-id": process.env.CASHFREE_CLIENT_ID_AC_VERIFY,
    "x-client-secret": process.env.CASHFREE_CLIENT_SECRET_AC_VERIFY,
    "Content-Type": "application/json",
  };

  const apiData = {
    bank_account: account_no,
    ifsc: ifsc,
  };

  try {
    const cashfreeResponse = await apiCall(url, apiData, headers);
    console.log(
      "Cashfree API response verifyBankAccountCashfree ===>>>",
      cashfreeResponse
    );
    logger.info(
      `Cashfree API response verifyBankAccountCashfree: account_no: ${account_no} ${JSON.stringify(cashfreeResponse)}`
    );

    if (cashfreeResponse?.account_status?.toLowerCase() === "valid") {
      const result = cashfreeResponse || {};

      const returnedObj = {
        name: result.name_at_bank || null,
        status: result.account_status || null,
        success: true,
        message: "Transaction Successful",
        account_no: account_no || null,
        ifsc: ifsc || null,
      };

      return {
        result: returnedObj,
        message: "Valid",
        responseOfService: cashfreeResponse,
        service: "Cashfree",
      };
    } else {
      return {
        result: {},
        message: "Invalid",
        responseOfService: cashfreeResponse,
        service: "Cashfree",
      };
    }
  } catch (error) {
    logger.error(
      `Error performing bank verification in verifyBankAccountCashfree: account_no: ${account_no} ${error}`
    );
    logger.error(
      `Error response from verifyBankAccountCashfree: account_no: ${account_no} ${
        JSON.stringify(error.response?.data) || error.message
      }`
    );

    return {
      result: {},
      message: "Invalid",
      responseOfService: error.response?.data || null,
      service: "Cashfree",
    };
  }
}


module.exports = {
    verifyBankAccountCashfree
};