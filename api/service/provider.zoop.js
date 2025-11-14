const axios = require("axios");
const { generateTransactionId } = require("../truthScreen/callTruthScreen");
const {updateFailure} = require("./serviceSelector")
const logger = require("../Logger/logger");

async function apiCall(url, body, headers,service) {
  console.log("Api call triggred in zoop", url, body, headers);

  try {
    const res = await axios.post(url, body, {
      headers,
    });
    console.log("Api Call response in zoop===>", res?.data);
    return res?.data;
  } catch (err) {
    await updateFailure(service);
    console.log(`zoop Retry Attempt error ${err}`);
    const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
    if (!isNetworkErr) {
      throw err;
    }
  }
}

async function verifyPanZoop(data) {
  const { panNumber } = data;
  const tskId = await generateTransactionId(12)
  const url = "https://live.zoop.one/api/v1/in/identity/pan/lite";
  const headers = {
    "app-id": process.env.ZOOP_APP_ID,
    "api-key": process.env.ZOOP_API_KEY,
    "Content-Type": "application/json",
    // "org-id": process.env.ZOOP_ORG_ID,
  };
  const dataToSend = {
    mode: "sync",
    data: {
      customer_pan_number: panNumber,
      consent: "Y",
      consent_text: "Iconsenttothisinformationbeingsharedwithzoop.one",
    },
    task_id: tskId
  };
  try {
    const response = await apiCall(url, dataToSend, headers);

    console.log("response in pan after service call ===>>", response)

    const obj = response.data;
    console.log("obj ===>>",obj);

    if (obj.response_code === "101") {
      return {
      result: "NoDataFound",
      message: "InValid",
      responseOfService: {},
      service: "Zoop",
    };
    }

    const returnedObj = {
      PAN: obj?.result?.pan_number || null,
      Name: obj?.result?.user_full_name || null,
      PAN_Status: obj?.result?.pan_status || null,
      PAN_Holder_Type: obj?.result?.pan_type || null,
    };

    return {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj.result,
      service: "Zoop",
    };
  } catch (error) {
    if (error) {
      throw error;
    }
  }
}
async function verifyAadhaar(data) {
  const url = process.env.ZOOP_AADHAAR_URL;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Zoop-Api-Key ${process.env.ZOOP_API_KEY}`,
  };
  return await apiCall(url, data, headers);
}

async function verifyBank(data) {
  const url = process.env.ZOOP_BANK_URL;
  const headers = {
    Authorization: `Zoop-Api-Key ${process.env.ZOOP_API_KEY}`,
  };

  return await apiCall(url, data, headers);
}

// Vishnu
async function verifyGstin(data,service) {
  console.log('is triggred verifygstin');
  const url = process.env.ZOOP_GSTIN_URL;
  const headers = {
    "app-id": process.env.ZOOP_APP_ID,
    "api-key": process.env.ZOOP_API_KEY,
    "content-type": "application/json",
  }

  const apiresponse = await apiCall(url, data, headers, service);
  console.log(
    "zoop verifyGsting Response ===>>>",
    apiresponse
  );
  logger.info(
    `zoop verifyGsting Response: : GSTNumber:${data?.business_gstin_number} ${JSON.stringify(apiresponse)}`
  );
  const returnedObj = {
    gstinNumber: apiresponse?.result?.gstin,
    business_constitution: apiresponse?.business_constitution,
    central_jurisdiction: apiresponse?.central_jurisdiction,
    gstin: apiresponse?.gstin,
    companyName: apiresponse?.result?.legal_name,
    other_business_address: apiresponse?.result?.other_business_address,
    register_cancellation_date: apiresponse?.result?.register_cancellation_date,
    state_jurisdiction: apiresponse?.result?.state_jurisdiction,
    tax_payer_type: apiresponse?.result?.tax_payer_type,
    trade_name: apiresponse?.result?.trade_name,

    primary_business_address: apiresponse?.result?.primary_business_address
  }
  return {
    gstinNumber: apiresponse?.result?.gstin,
    result: returnedObj,
    message: "Valid",
    responseOfService: apiresponse,
    service: "ZOOP",
  };
};

async function shopEstablishment(data,service) {
  const url = process.env.ZOOP_SHOP_URL;
  const headers = {
    "app-id": process.env.ZOOP_APP_ID,
    "api-key": process.env.ZOOP_API_KEY,
    "content-type": "application/json",
  }
  const apiResponse = await apiCall(url, data, headers, service);
  console.log("Zoop ShopEstablishment Response ===>", apiResponse);
  logger.info(`Zoop ShopEstablishment Response: ${JSON.stringify(apiResponse)}`
  );
  const returnedObj = {
    registrationNumber: data?.registrationNumber,
    state: data?.state,
    shopName: data?.result?.result?.nameOfTheShop,
    shopAddress: data?.result?.result?.address
  }
  console.log('ShopEstablishmenten Response data is', JSON.stringify(returnedObj));

  return {
    registrationNumber: data?.registrationNumber,
    result: returnedObj,
    message: "Valid",
    responseOfService: apiResponse,
    service: "ZOOP",
  };
};

async function faceMatch(data,service) {
  const url = process.env.ZOOP_FACEMATCH_URL;
  const headers = {
    "app-id": process.env.ZOOP_APP_ID,
    "api-key": process.env.ZOOP_API_KEY,
    "Content-Type": "application/json",
  };
  const dataToSend = {
    mode: "sync",
    data: {
      card_image: data?.userImage,
      user_image: data?.aadhaarImage,
      consent: "Y",
      consent_text: "I hear by declare my consent agreement for fetching my information via ZOOP API"
    },
    task_id: "f26eb21e-4c35-4491-b2d5-41fa0e545a34"
  }
  const resData = await apiCall(url, dataToSend, headers, service);
  console.log("Face Match Zoop Response ===>", resData);
  logger.info(`Face Match Zoop Response: ${JSON.stringify(resData)}`);
  const returnedObj = {
    success: resData?.success,
    response_code: resData?.response_code,
    response_message: resData?.response_message,
    result: resData?.result
  }
  console.log('Face match zoop Response data is', JSON.stringify(returnedObj));
  return {
    result: returnedObj,
    message: "Valid",
    responseOfService: resData,
    service: "ZOOP",
  };
}
async function verifyBankAccountZoop(data) {
  const { account_no, ifsc } = data;
  const tskId = generateTransactionId(12);
  console.log("account_no, ifsc ===>>", ifsc, account_no);
  const url = "https://live.zoop.one/api/v1/in/financial/bav/lite";
  const headers = {
    "app-id": ZOOPClientId,
    "api-key": ZOOP_API_KEY,
    "Content-Type": "application/json",
  };
  const dataToSend = {
    mode: "sync",
    data: {
      account_number: account_no,
      ifsc: ifsc,
      consent: "Y",
      consent_text:
        "I hereby declare my consent agreement for fetching my information via ZOOP API",
    },
    task_id: tskId,
  };

  try {
    const bankResponseZoop = await apiCall(url, dataToSend, headers);
    console.log("bankResponseZoop ====>>", bankResponseZoop);

    const zoopObj = bankResponseZoop.data;
    console.log("zoopObj ====>>", JSON.stringify(zoopObj));
    logger.info("zoop response from the api ===>>>", JSON.stringify(zoopObj));

    const result = zoopObj.result || {};

    const returnedObj = {
      name: result.beneficiary_name || null,
      status: result.verification_status || null,
      success: zoopObj.success === true && zoopObj.response_code === "100",
      message:
        zoopObj.response_message ||
        result.transaction_remark ||
        "Transaction Successful",
      account_no: account_no || null,
      ifsc: ifsc || null,
    };

    return {
      result: returnedObj,
      message: "Valid",
      responseOfService: zoopObj,
      service: "Zoop",
    };
  } catch (error) {
    if (error) {
      throw error;
    }
  }
}

module.exports = {
  verifyPanZoop,
  verifyAadhaar,
  faceMatch,
  verifyBank,
  verifyGstin,
  shopEstablishment,
  verifyBankAccountZoop
};
