const axios = require("axios");
const { generateTransactionId } = require("../truthScreen/callTruthScreen");

async function apiCall(url, body, headers) {
  console.log("Api call triggred in zoop", url, body, headers);
  const data ={...body}

  try {
    const res = await axios.post(url, data, {
      headers,
    });
    console.log("Api Call response in zoop===>", res);
    return res;
  } catch (err) {
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
    console.log(obj);

    if (obj.response_code === "101") {
      return { message: "NoDataFound" };
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

async function faceMatch(data) {
   const url = process.env.ZOOP_FACE_URL || "https://live.zoop.one/api/v1/in/ml/face/match";
  const headers = {
    "app-id": process.env.ZOOP_APP_ID,
    "api-key": process.env.ZOOP_API_KEY,
    "Content-Type": "application/json",
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
async function verifyGstin(data) {
    console.log('is triggred verifygstin');
    const url = 'https://live.zoop.one/api/v1/in/merchant/gstin/lite';
    const headers = {
        "app-id": process.env.ZOOP_APP_ID,
        "api-key": process.env.ZOOP_API_KEY,
        "content-type": "application/json",
    }

    return await apiCall(url, data, headers);

    const apiresponse = await apiCall(url, data, headers);
    const gstnData = JSON.parse(data)
    const gstinData = {
        gstinNumber: gstnData?.gstin,
        serviceRes: 'zoop',
        response: apiresponse,
        companyName: apiresponse?.result?.result?.gstnDetailed?.legalNameOfBusiness,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString()
    };
    console.log('VerifyGSTin Response data is', JSON.stringify(gstinData));
    return gstinData;
}
async function shopEstablishment(data) {
    const url = "https://api.invincibleocean.com/invincible/shopEstablishment";
    const headers = {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    return await apiCall(url, data, headers);
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
