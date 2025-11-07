const axios = require("axios");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../truthScreen/callTruthScreen");
const username = process.env.TRUTHSCREEN_USERNAME;
const password = process.env.TRUTHSCREEN_TOKEN;

// Vishnu
// function generateKey(password) {
//     console.log('---2. GenerateKey is Called---', password)
//     const hash = crypto.createHash("sha512");
//     hash.update(password, "utf-8");
//     return hash.digest("hex").substring(0, 16);
// }
// function encrypt(plainText, password) {
//     console.log('---1. Encrypt is called ---')
//     const key = generateKey(password);
//     const iv = crypto.randomBytes(16);
//     const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key), iv);

//     let encrypted = cipher.update(plainText, "utf-8", "base64");
//     encrypted += cipher.final("base64");

//     return `${encrypted}:${iv.toString("base64")}`;
// }
// function decrypt(encryptedText, password) {
//     const key = generateKey(password);

//     //   console.log("encryptedText ===>", encryptedText, typeof encryptedText);

//     if (typeof encryptedText !== "string") {
//         throw new Error("Invalid encryptedText: must be a string");
//     }

//     const [encryptedData, ivBase64] = encryptedText.split(":");
//     const iv = Buffer.from(ivBase64, "base64");

//     const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key), iv);
//     let decrypted = decipher.update(encryptedData, "base64", "utf8");
//     decrypted += decipher.final("utf8");

//     return decrypted;
// }
// async function apiCall(url, body, headers) {
//     console.log('Api call triggred', url, body, headers)
//     const password = process.env.TRUTHSCREEN_TOKEN
//     try {
//         console.log('------In api Call try Block ---------')
//         const encryptedData = encrypt(JSON.stringify(body), password);
//         console.log('encrypted Data is ===>', encryptedData)
//         const res = await axios.post(url, { requestData: encryptedData }, {
//             headers,
//         });
//         console.log("response in truth screen", res?.data);

//         const encryptedResponseData = res?.data?.responseData || res?.data;
//         if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
//             throw new Error("Invalid or missing encrypted responseData from TruthScreen");
//         }
//         const decrypted = decrypt(encryptedResponseData, password);

//         return decrypted;

//     } catch (err) {
//         console.log('Error while api call in TruthScreen', err)
//         const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
//         if (!isNetworkErr) {
//             throw err;
//         }
//         console.log(`Invincible Retry Attempt error ${err}`);
//     }
// }

async function apiCall(url, body) {
  console.log("Api call triggred in truth screen", url, body);
  try {
    const truthScreenResponse = await callTruthScreenAPI({
      url,
      payload: body,
      username,
      password,
    });
    console.log("Api Call response in truthScreen===>", truthScreenResponse);
    if (truthScreenResponse?.status == 1) {
      return truthScreenResponse;
    }
  } catch (err) {
    const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
    if (!isNetworkErr) {
      throw err;
    }
    console.log(`truthScreen Retry Attempt error ${err}`);
  }
}

// Poonam
async function verifyPanTruthScreen(data) {
  const { panNumber } = data;
  console.log("panNumber in truthScreen ===>>", panNumber);
  const url = "https://www.truthscreen.com/api/v2.2/idsearch";

  const transID = generateTransactionId(14);

  const payload = {
    transID,
    docType: 2,
    docNumber: panNumber,
  };

  console.log("payload in truthscreen ===>>", payload);

  try {
    const parsedResponse = await apiCall(url, payload);

    console.log("parsedResponse ====>>", parsedResponse);

    const returnedObj = {
      PAN: parsedResponse.msg?.PanNumber || null,
      Name: parsedResponse.msg?.Name || null,
      PAN_Status:
        parsedResponse.msg?.STATUS || parsedResponse.msg?.pan_status || null,
      PAN_Holder_Type:
        parsedResponse.msg?.panHolderStatusType ||
        parsedResponse.msg?.pan_type ||
        null,
    };

    return {
      result: returnedObj,
      message: "Valid",
      responseOfService: parsedResponse?.msg,
      service: "TruthScreen",
    };
  } catch (error) {
    if (error) {
      throw error;
    }
  }
}

async function verifyCinTruthScreen(data) {
  const { CIN } = data;
  console.log("cinNumber in truthScreen ===>>", CIN);

  const url = "https://www.truthscreen.com//api/v2.2/idsearch";
  const transID = generateTransactionId(14);

  const payload = { transID: transID, docType: 15, docNumber: CIN };

  try {
    const CinResponse = await apiCall(url, payload);
    console.log("CinResponse ===>>>", CinResponse);
  } catch (error) {}
}

async function verifyAadhaar(data) {
  const url = process.env.TRUTHSCREEN_AADHAAR_URL;

  return await apiCall(url, data, {
    "x-api-key": process.env.TRUTHSCREEN_API_KEY,
  });
}

async function verifyBankAccountTruthScreen(data) {
  const { account_no, ifsc } = data;
  const url = "https://www.truthscreen.com/BankAccountVerificationApi";

  const transID = generateTransactionId(14);

  const payload = {
    transID,
    docType: "92",
    beneAccNo: account_no,
    ifsc: ifsc,
  };

  try {
    const bankResponseFromTruthScreen = await apiCall(url, payload);
    console.log(
      "bankResponseFromTruthScreen ===>>",
      bankResponseFromTruthScreen
    );

    const msg = bankResponseFromTruthScreen?.msg || {};

    const returnedObj = {
      name: msg.name || null,
      status: msg.status || null,
      success:
        (bankResponseFromTruthScreen.status === 1 &&
          msg.description?.toLowerCase().includes("success")) ||
        false,
      message: msg.description || "Transaction Successful",
      account_no: account_no || null,
      ifsc: ifsc || null,
    };

    return {
      result: returnedObj,
      message: "Valid",
      responseOfService: bankResponseFromTruthScreen,
      service: "TruthScreen",
    };
  } catch (error) {
    logger.error("Error verifying bank account with TruthScreen:", error);
    throw error;
  }
}

async function verifyBankTruthScreen(data) {
  const { account_no, ifsc } = data;
  const url = "https://www.truthscreen.com/v1/apicall/bank/bav_pennyless";

  const transID = generateTransactionId(14);

  const payload = {
    transID,
    docType: "573",
    to_account_no: account_no,
    toIFSC: ifsc,
    clientRefId: "27Jul2021004",
    narration: "csc",
  };

  try {
    const bankResponseFromTruthScreen = await apiCall(url, payload);
    console.log(
      "bankResponseFromTruthScreen ===>>",
      bankResponseFromTruthScreen
    );

    const msg = bankResponseFromTruthScreen?.msg || {};

    const returnedObj = {
      name: msg.name || null,
      status: msg.status || null,
      success:
        (bankResponseFromTruthScreen.status === 1 &&
          msg.description?.toLowerCase().includes("success")) ||
        false,
      message: msg.description || "Transaction Successful",
      account_no: account_no || null,
      ifsc: ifsc || null,
    };

    return {
      result: returnedObj,
      message: "Valid",
      responseOfService: bankResponseFromTruthScreen,
      service: "TruthScreen",
    };
  } catch (error) {
    logger.error("Error verifying bank account with TruthScreen:", error);
    throw error;
  }
}

async function callTruthScreenFaceVerification(userImage, aadhaarImage) {
  if (!userImage || !aadhaarImage) {
    throw new Error("Both userImage and aadhaarImage are required");
  }

  const username = process.env.TRUTHSCREEN_USERNAME;
  const password = process.env.TRUTHSCREEN_TOKEN;
  const transID = generateTransactionId(14);

  if (!username || !password || !transID) {
    throw new Error("Invalid credentials or transaction ID");
  }

  const step1Payload = { transID, docType: 201 };
  const step1Response = await callTruth({
    url: "https://www.truthscreen.com/api/v2.2/faceapi/token",
    payload: step1Payload,
    username,
    password,
  });

  if (step1Response?.status !== 1) {
    throw new Error("Failed to generate token from TruthScreen");
  }

  const secretToken = step1Response.msg.secretToken;
  const tsTransID = step1Response.msg.tsTransID;

  const step2Response = await performFaceVerificationEncrypted({
    tsTransID,
    secretToken,
    imageBase64: userImage,
    documentBase64: aadhaarImage,
    username,
    password,
  });

  if (
    !step2Response ||
    step2Response.message?.toUpperCase() === "FACE VERIFICATION FAILED"
  ) {
    throw new Error("Face Verification Failed");
  }

  return step2Response.data;
}

// Vishnu
async function shopEstablishment(data) {
  const url = "https://www.truthscreen.com/api/v2.2/utilitysearch";
  const headers = {
    username: process.env.INVINCIBLE_USERNAME,
    "Content-Type": "application/json",
  };
  return await apiCall(url, data, headers);
}
async function verifyGstin(data) {
  const url = "https://www.truthscreen.com/api/v2.2/utilitysearch";
  const headers = {
    username: process.env.INVINCIBLE_USERNAME,
    "Content-Type": "application/json",
  };
  const resData = await apiCall(url, data, headers);
  console.log("VerifyGstIn Response", resData);
  return resData;
}

module.exports = {
  verifyPanTruthScreen,
  verifyCinTruthScreen,
  verifyAadhaar,
  callTruthScreenFaceVerification,
  verifyBankAccountTruthScreen,
  verifyBankTruthScreen,
  shopEstablishment,
  verifyGstin,
};
