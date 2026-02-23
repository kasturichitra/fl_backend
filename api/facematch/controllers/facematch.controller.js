const axios = require("axios");
const checkingDetails = require("../../../utlis/authorization");
const FaceMatchModel = require("../models/facematch.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { kycLogger } = require("../../Logger/logger");
const ERROR_CODES = require("../../../utlis/errorCodes");
const { faceMatch } = require("../../service/provider.zoop");
const zoop = require("../../service/provider.zoop");
const invincible = require("../../service/provider.invincible");
const truthscreen = require("../../service/provider.truthscreen");
const {
  selectService,
  updateFailure,
} = require("../../service/serviceSelector");
const {
  callTruth,
  performFaceVerificationEncrypted,
} = require("../../truthScreen/callTruthScreen");
const { generateTransactionId } = require("../../../utlis/helper");

const convertImageToBase64 = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "image/jpeg",
        Accept: "image/jpeg",
      },
    });
    return Buffer.from(response.data, "binary").toString("base64");
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
};
// exports.facematchapi = async (req, res, next) => {
//   try {
//     const { userimage, aadharImage } = req.body;
//     console.log(userimage, aadharImage)

//     const faceMatchingResponse = await axios.post(
//       "https://live.zoop.one/api/v1/in/ml/face/match",
//       {
//         mode: "sync",
//         data: {
//           card_image: aadharImage,
//           user_image: userimage,
//           consent: "Y",
//           consent_text: "I consent to this information being shared with zoop.one",
//         },
//       },
//       {
//         headers: {
//           "app-id": process.env.ZOOP_APP_ID,
//           "api-key": process.env.ZOOP_API_KEY,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const responseObject = faceMatchingResponse.data;
//     console.log("FaceMatch Response: ===>", responseObject);

//     if (responseObject.success) {
//       const exsist = await faceMatch.findOne({ adhaarimage: aadharImage, userimage: userimage })
//       console.log("======>>>>", exsist)
//       if (!exsist) {
//         await faceMatch.create({
//           adhaarimage: aadharImage,
//           userimage: userimage,
//           response: responseObject,
//           MerchantId: MerchantId,
//           token: check,
//           createdDate: new Date().toLocaleDateString(),
//           createdTime: new Date().toLocaleTimeString()
//         })
//       }
//       return res.status(200).json({ message: responseObject?.response_message, success: true, result: responseObject.result });
//     }

//     let errorMessage = {
//       message: "No Match Found",
//       statusCode: 500,
//     };
//     return next(errorMessage);
//   } catch (error) {
//     console.error("Error performing facematch verification:", error);
//     let errorMessage = {
//       message: "Failed to perform facematch verification",
//       statusCode: 500,
//     };
//     return next(errorMessage);
//   }
// };
// exports.FaceVerification = async (
//   userimage,
//   aadharImageUrl,
// ) => {
//   if (!userimage || !aadharImageUrl) {
//     return { error: "All fields are required" };
//   }

//   const url = "https://www.truthscreen.com/api/v2.2/faceapi/token";
//   const username = process.env.TRUTHSCREEN_USERNAME;
//   const password = process.env.TRUTHSCREEN_TOKEN;
//   const transID = generateTransactionId(14);

//   if (!username || !password || !transID) {
//     return { error: "Some thing wrong Please try again" };
//   }

//   const payload = { transID, docType: 201 };
//   const step1Response = await callTruth({ url, payload, username, password });
//   console.log("step1Response in truth screen", step1Response);

//   if (step1Response?.status !== 1) {
//     return { error: "Failed to generate token from TruthScreen" };
//   }

//   const secretToken = step1Response?.msg?.secretToken;
//   const tsTransID = step1Response?.msg?.tsTransID;

//   console.log("secretToken ====>>>", secretToken, tsTransID);

//   try {
//     const step2Response = await performFaceVerificationEncrypted({
//       tsTransID,
//       secretToken,
//       imageBase64: userimage,
//       documentBase64: aadharImageUrl,
//       username,
//       password,
//     });

//     console.log("step2Response ====>>>", step2Response);
//     console.log("step2Response ====>>>", step2Response?.data);
//     console.log("step2Response ====>>>", step2Response?.message);

//     // if (step2Response?.message?.toUpperCase() === "FACE VERIFICATION FAILED") {
//     //   return { error: "Face Verification Failed" };
//     // } else {
//     //   if (step2Response?.data?.status === 1) {
//     //     const faceResponse = {
//     //       userimage,
//     //       adhaarimage: aadharImageUrl,
//     //       response: step2Response?.data,
//     //       MerchantId,
//     //       token,
//     //     };
//     //     // await facematchModel.findOneAndUpdate({ MerchantId }, faceResponse, {
//     //     //   upsert: true,
//     //     //   new: true,
//     //     // });
//     //     return step2Response?.data?.msg;
//     //   } else {
//     //     return { error: "Face Verification Failed" };
//     //   }
//     // }
//   } catch (error) {
//     console.error("facematch Verification Error:", error);
//     return { error: "facematch verification failed" };
//   }
// };

exports.faceMatchVerification = async (req, res) => {
  const { userImage, aadhaarImage, categoryId = "", serviceId = "", clientId="" } = req.body;
  const service = await selectService();
  console.log("----active service for FACEMATCH Verify is ----", service);
  kycLogger.info(`----active service for FACEMATCH Verify is ----, ${service}`);

  const storingClient = req.clientId || clientId;

  const identifierHash = hashIdentifiers({
    user: userImage?.slice(0,10),
    aadhaar:aadhaarImage?.slice(0,10)
  });

  const faceRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: storingClient,
  });

  if (!faceRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: faceRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  console.log("bin txn Id ===>>", tnId);
  kycLogger.info("bin txn Id ===>>", tnId);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    kycLogger.info("credits maintainance started===>>", req.environment);
    maintainanceResponse = await creditsToBeDebited(
      storingClient,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    kycLogger.info("charges maintainance started===>>", req.environment);
    maintainanceResponse = await chargesToBeDebited(
      storingClient,
      serviceId,
      categoryId,
      tnId,
    );
  }

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "InValid",
      response: {},
    });
  }
  if (!userImage || !aadhaarImage) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  if (!service || service === undefined) {
    return res.status(503).json({ error: "No service available" });
  }
  try {
    console.log("FACEMATCH inverify activer service", service?.serviceFor);
    const dataTosend = {
      userImage,
      aadhaarImage,
    };
    let response;
    switch (service?.serviceFor) {
      case "ZOOP":
        response = await zoop.faceMatch(dataTosend, service);
        break;
      case "INVINCIBLE":
        response = await invincible.faceMatch(dataTosend, service);
        break;
      case "TRUTHSCREEN":
        response = await truthscreen.faceMatch(dataTosend, service);
        break;
      default:
        throw new Error(`Unsupported FACEMATCH service`);
    }
    console.log("facematch verify response ===>", JSON.stringify(response));
    // Update in DB
    return res
      .status(200)
      .json({ message: "Success", data: response?.result, success: true });
  } catch (error) {
    console.log("Error While FaceMatchVerification", error);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
