const { decrypt } = require("dotenv");
const crypto = require("crypto");
const { faceServiceLogger, commonLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
  performFaceVerificationEncrypted,
  callTruthScreenAPIForImage,
  callTruthScreenAPIForFaceMatch,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const FaceMatchActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  TxnID = "",
) => {
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);
  console.log("[FaceMatchActiveServiceResponse] incoming data ===>>", data);
  faceServiceLogger.info(
    "[FaceMatchActiveServiceResponse] incoming data ===>>",
    JSON.stringify(data),
  );

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return FaceMatchActiveServiceResponse(data, services, index + 1, TxnID);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[FaceMatchActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );
  faceServiceLogger.info(
    `[FaceMatchActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    let res = await FaceMatchApiCall(data, serviceName, TxnID);
    console.log('facematch activeserverice response', res)
    if (res?.data) {
      return res.data;
    }

    console.log(
      `[FaceMatchActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return FaceMatchActiveServiceResponse(data, services, index + 1, TxnID);
  } catch (err) {
    console.log(
      `[FaceMatchActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return FaceMatchActiveServiceResponse(data, services, index + 1, TxnID);
  }
};

// =======================================
//         TIN API CALL (ALL SERVICES)
// =======================================

const FaceMatchApiCall = async (data, service, TxnID = "") => {
  const tskId = TxnID || (await generateTransactionId(12));
  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 201,
        docNumber: data,
      },
      url: "https://www.truthscreen.com/api/v2.2/faceapi/verify",
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
    ZOOP: {
      BodyData: {
        mode: "sync",
        data: {
          card_image: data?.userImage,
          user_image: data?.aadhaarImage,
          consent: "Y",
          consent_text:
            "I hear by declare my consent agreement for fetching my information via ZOOP API",
        },
        task_id: "f26eb21e-4c35-4491-b2d5-41fa0e545a34",
      },
      url: process.env.ZOOP_FACEMATCH_URL,
      header: {
        "app-id": process.env.ZOOP_APP_ID,
        "api-key": process.env.ZOOP_API_KEY,
        "Content-Type": "application/json",
      },
    },
  };

  // Empty provider fallback
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
  }

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (service === "TRUTHSCREEN") {
      console.log("Face match api call is triggred");
      STEP1 = await HandleFaceMatchVerification();
      console.log("Step 1 is complated STEP1 Response: ", STEP1);

      if (STEP1?.status) {
        console.log("went for the send step2");
        ApiResponse = await callTruthScreenAPIForFaceMatch({
          url: "https://www.truthscreen.com/api/v2.2/faceapi/verify",
          payload: {
            transID: STEP1?.data?.tsTransID,
            secretToken: STEP1?.data?.secretToken,
          },
          image: data?.userImage,
          document: data?.aadhaarImage,
          username: process.env.TRUTHSCREEN_USERNAME,
          password: process.env.TRUTHSCREEN_TOKEN,
          cId: "CID_125634897",
          logger: faceServiceLogger,
        });
        console.log("ApiResponse for Face match", JSON.stringify(ApiResponse));
      }
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }

    console.log(
      `[FaceMatchApiCall] ${service} API response:`,
      JSON.stringify(ApiResponse?.data || ApiResponse),
    );
  } catch (error) {
    console.log(`[FaceMatchApiCall] API Error in ${service}:`, error.message);
    return { success: false };
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(`Response—${service}:`, obj);

  // =======================================
  //      UNIFIED RESULT NORMALIZATION
  // =======================================

  let returnedObj = {};

  // ------------------------
  // TRUTHSCREEN RESPONSE
  // ------------------------
  if (service === "TRUTHSCREEN") {
    const msg = obj?.msg;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = msg;

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service: service,
      },
    };
  }

  // ===========================
  // DEFAULT VALID RETURN
  // ===========================
  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj?.result,
      service,
    },
  };
};

// =======================================
// INVALID RESPONSE HANDLER (REUSABLE)
// =======================================

const invalidResponse = (service, raw) => ({
  success: false,
  data: {
    result: "NoDataFound",
    message: "Invalid",
    responseOfService: raw || {},
    service,
  },
});

function generateKey(password) {
  const hash = crypto.createHash("sha512");
  hash.update(password, "utf-8");
  return hash.digest("hex").substring(0, 16);
}

function decryptpayload(encryptedText, password) {
  const key = generateKey(password);

  commonLogger.info(
    `encryptedText ===> ${encryptedText} ${typeof encryptedText}`,
  );

  if (typeof encryptedText !== "string") {
    throw new Error("Invalid encryptedText: must be a string");
  }

  const [encryptedData, ivBase64] = encryptedText.split(":");
  const iv = Buffer.from(ivBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

//step1 FaceMatch Truthscreen api's
const HandleFaceMatchVerification = async () => {
  try {
    const url = "https://www.truthscreen.com/api/v2.2/faceapi/token";
    const transID = generateTransactionId(14);
    console.log("Face match api generate TransactionID", transID);
    const detailsToSend = { transID, docType: 201 };

    const form = new FormData();

    form.append("transID", transID);
    form.append("docType", 201);
    const response = await axios.post(url, form, {
      headers: {
        username: process.env.TRUTHSCREEN_USERNAME,
      },
    });

    const decryptres = decryptpayload(
      response.data?.responseData,
      process.env.TRUTHSCREEN_TOKEN,
    );
    const decryptdata = JSON.parse(decryptres);

    console.log(
      "face match api response",
      typeof decryptdata,
      "status",
      decryptdata?.["status"],
    );
    if (decryptdata?.status !== 1) {
      return {
        message: "TxnId is not Generated for step2",
        data: null,
        status: false,
      };
    }
    return {
      message: "TxnId is Generated for step2",
      data: decryptdata?.msg,
      status: true,
    };
  } catch (error) {
    console.log("Error Step1 Facematch verification", error);
    return {
      message: "TxnId is not Generated for step2",
      data: null,
      status: false,
    };
  }
};

module.exports = {
  FaceMatchActiveServiceResponse,
};
