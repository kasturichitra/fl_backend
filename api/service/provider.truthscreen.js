const axios = require("axios");
const { generateTransactionId, callTruthScreenAPI, performFaceVerificationEncrypted } = require("../truthScreen/callTruthScreen");
const username = process.env.TRUTHSCREEN_USERNAME;
const password = process.env.TRUTHSCREEN_TOKEN;

async function apiCall(url, body, service) {
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
async function verifyPanTruthScreen(data, service) {
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
    const parsedResponse = await apiCall(url, payload, service);

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

async function verifyCinTruthScreen(data, service) {
  const { CIN } = data;
  console.log("cinNumber in truthScreen ===>>", CIN);

  const url = "https://www.truthscreen.com//api/v2.2/idsearch";
  const transID = generateTransactionId(14);

  const payload = { transID: transID, docType: 15, docNumber: CIN };

  try {
    const CinResponse = await apiCall(url, payload, service);
    console.log("CinResponse ===>>>", CinResponse);
  } catch (error) { }
}

async function verifyUdhyamTruthScreen(data, service) {
  const { udyamNumber } = data;
  console.log("udyamNumber in truthScreen ===>>", udyamNumber);

  const url = "https://www.truthscreen.com/UdyamApi/idsearch";
  const transID = generateTransactionId(14);
  const payload = {
    transID,
    docType: 435,
    udyamNumber,
  };

  try {
    const UdyamResponse = await apiCall(url, payload, service);
    console.log("UdyamResponse ===>>>", JSON.stringify(UdyamResponse));

    const udyamData = UdyamResponse?.msg?.udyamdata || {};
    const status = UdyamResponse?.status;

    if (status === 1 && Object.keys(udyamData).length > 0) {
      // ✅ Construct common structured object (same as Invincible format)
      const commonObject = {
        udyam: udyamNumber,
        "Date of Commencement of Production/Business":
          udyamData["Date of Commencement of Production/Business"],
        "Date of Incorporation": udyamData["Date of Incorporation"],
        "Date of Udyam Registration": udyamData["Date of Udyam Registration"],
        "MSME-DFO": udyamData["MSME-DFO"],
        "Major Activity": udyamData["Major Activity"],
        "Name of Enterprise": udyamData["Name of Enterprise"],
        "Organisation Type": udyamData["Organisation Type"],
        "Social Category": udyamData["Social Category"],
        "Enterprise Type": udyamData["Enterprise Type"]?.map((item) => ({
          "Classification Date": item["Classification Date"],
          "Classification Year": item["Classification Year"],
          "Enterprise Type": item["Enterprise Type"],
        })),
        "National Industry Classification Code(S)": udyamData[
          "National Industry Classification Code(S)"
        ]?.map((item) => ({
          Activity: item["Activity"],
          Date: item["Date"],
          "Nic 2 Digit": item["Nic 2 Digit"],
          "Nic 4 Digit": item["Nic 4 Digit"],
          "Nic 5 Digit": item["Nic 5 Digit"],
        })),
        "Official address of Enterprise": {
          "Flat/Door/Block No":
            udyamData["Official address of Enterprise"]?.[
            "Flat/Door/Block No"
            ] || null,
          "Name of Premises/ Building":
            udyamData["Official address of Enterprise"]?.[
            "Name of Premises/ Building"
            ] || null,
          "Village/Town":
            udyamData["Official address of Enterprise"]?.["Village/Town"] ||
            null,
          Block: udyamData["Official address of Enterprise"]?.["Block"] || null,
          "Road/Street/Lane":
            udyamData["Official address of Enterprise"]?.["Road/Street/Lane"] ||
            null,
          City: udyamData["Official address of Enterprise"]?.["City"] || null,
          State: udyamData["Official address of Enterprise"]?.["State"] || null,
          District:
            udyamData["Official address of Enterprise"]?.["District"] || null,
          Mobile:
            udyamData["Official address of Enterprise"]?.["Mobile"] || null,
          Email: udyamData["Official address of Enterprise"]?.["Email"] || null,
        },
      };

      return {
        result: commonObject,
        message: "Valid",
        responseOfService: UdyamResponse,
        service: "TruthScreen",
      };
    } else {
      return {
        result: {},
        message: "Invalid",
        responseOfService: UdyamResponse,
        service: "TruthScreen",
      };
    }
  } catch (error) {
    console.log("Error in fetching udyam ===>>>", error);
    throw error;
  }
}

async function verifyAadhaar(data, service) {
  const url = process.env.TRUTHSCREEN_API_URL;

  return await apiCall(url, data, service);
}

async function verifyBankAccountTruthScreen(data, service) {
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
    const bankResponseFromTruthScreen = await apiCall(url, payload, service);
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

async function verifyBankTruthScreen(data, service) {
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
    const bankResponseFromTruthScreen = await apiCall(url, payload, service);
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
async function shopEstablishment(data, service) {
  const url = "https://www.truthscreen.com/api/v2.2/utilitysearch";
  return await apiCall(url, data, service)
}
async function verifyGstin(gstinNumber, service) {
  const url = process.env.TRUTHSCREEN_API_URL;
  const transID = generateTransactionId(14);
  const truthscreendata = {
    transID,
    "docType": "23",
    "docNumber": gstinNumber
  };
  const resData = await apiCall(url, truthscreendata, service);
  console.log('VerifyGstIn Response', resData);
  return resData
}
async function faceMatch(data, service) {
  const url = "https://www.truthscreen.com/api/v2.2/utilitysearch";
  const transID = generateTransactionId(14);
  const detailsToSend = { transID, docType: 201 }
  const step1Response = await apiCall(url, detailsToSend, service);
  console.log('face match api response', step1Response)
  if (step1Response?.status !== 1) {
    return { error: "Failed to generate token from TruthScreen" };
  }

  const secretToken = step1Response?.msg?.secretToken;
  const tsTransID = step1Response?.msg?.tsTransID;
  const username = process.env.TRUTHSCREEN_USERNAME;
  const password = process.env.TRUTHSCREEN_TOKEN;

  console.log("secretToken ====>>>", secretToken, tsTransID);
  const step2Response = await performFaceVerificationEncrypted({
    tsTransID,
    secretToken,
    imageBase64: data?.userimage,
    documentBase64: data?.aadharImageUrl,
    username,
    password,
  });
  if (step2Response?.message?.toUpperCase() === "FACE VERIFICATION FAILED") {
    return { error: "Face Verification Failed" };
  }
  const faceResponse = {
    userimage: data?.userimage,
    adhaarimage: data?.aadharImageUrl,
    response: step2Response?.data,
    MerchantId,
    token,
  };
  console.log('Face match Api response ===>', faceResponse)
  return faceResponse;
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
  verifyUdhyamTruthScreen,
  faceMatch
};
