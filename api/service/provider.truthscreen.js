const axios = require("axios");
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const username = process.env.TRUTHSCREEN_USERNAME;
const password = process.env.TRUTHSCREEN_TOKEN;

async function apiCall(url, body) {
  console.log("Api call triggred in truth screen", url, body);
  try {
    const truthScreenResponse = await callTruthScreenAPI({
      url,
      payload:body,
      username,
      password,
    });
    console.log("Api Call response in truthScreen===>", truthScreenResponse);
    if(truthScreenResponse?.status == 1){
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

async function verifyPanTruthScreen(data) {
    const {panNumber} = data
    console.log("panNumber in truthScreen ===>>", panNumber)
  const url = "https://www.truthscreen.com/api/v2.2/idsearch";

  const transID = generateTransactionId(14);

  const payload = {
    transID,
    docType: 2,
    docNumber: panNumber,
  };

  console.log("payload in truthscreen ===>>", payload)

  try {
    const parsedResponse = await apiCall(url, payload);

    console.log("parsedResponse ====>>", parsedResponse)

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
    if(error){
        throw error
    }
  }
}

async function verifyCinTruthScreen(data) {
  const url = process.env.TRUTHSCREEN_AADHAAR_URL;

  return await apiCall(url, data, {
    "x-api-key": process.env.TRUTHSCREEN_API_KEY,
  });
}

async function verifyAadhaar(data) {
  const url = process.env.TRUTHSCREEN_AADHAAR_URL;

  return await apiCall(url, data, {
    "x-api-key": process.env.TRUTHSCREEN_API_KEY,
  });
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
  const step1Response = await callTruth({ url: "https://www.truthscreen.com/api/v2.2/faceapi/token", payload: step1Payload, username, password });

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

  if (!step2Response || step2Response.message?.toUpperCase() === "FACE VERIFICATION FAILED") {
    throw new Error("Face Verification Failed");
  }

  return step2Response.data;
}


// async function faceMatch(data) {
//   const url = process.env.TRUTHSCREEN_FACE_URL;

//   return await apiCall(url, data, {
//     "x-api-key": process.env.TRUTHSCREEN_API_KEY,
//   });
// }

async function verifyBank(data) {
  const url = process.env.TRUTHSCREEN_BANK_URL;

  return await apiCall(url, data, {
    "x-api-key": process.env.TRUTHSCREEN_API_KEY,
  });
}

module.exports = {
  verifyPanTruthScreen,
  verifyCinTruthScreen,
  verifyAadhaar,
  verifyBank,
  callTruthScreenFaceVerification
};
