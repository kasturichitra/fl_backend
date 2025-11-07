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

module.exports = {
  verifyPanZoop,
  verifyAadhaar,
  faceMatch,
  verifyBank,
};
