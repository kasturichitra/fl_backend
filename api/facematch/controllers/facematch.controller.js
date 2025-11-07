const axios = require("axios");
const checkingDetails = require("../../../utlis/authorization");
const FaceMatchModel = require("../models/facematch.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const {verifyFaceComparison } = require("../../service/provider.invincible")
const logger = require("../../Logger/logger");
const ERROR_CODES = require("../../../utlis/errorCodes");
const {faceMatch} = require("../../service/provider.zoop")
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
exports.facematchapi = async (req, res) => {
  const startTime = new Date();
  logger.info("FaceMatch API triggered");

  try {
    const { userImage, aadhaarImage } = req.body;
    logger.info(`Request body received: ${JSON.stringify(req.body)}`);

    if (!userImage || !aadhaarImage) {
      logger.warn(`[${ERROR_CODES?.BAD_REQUEST.code}] Missing required fields`);
      return res.status(ERROR_CODES?.BAD_REQUEST.httpCode).json({
        ...ERROR_CODES?.BAD_REQUEST,
        message: "Both userImage and aadhaarImage are required",
      });
    }

    const payload = {
      source_image: aadhaarImage,
      face_image: userImage,
    };
    const response = await faceMatch(payload);
    logger.info(`Zoop API Response: ${JSON.stringify(response.data)}`);
    await FaceMatchModel.findOneAndUpdate(
      { userImage, aadhaarImage },
      { userImage, aadhaarImage, response: response.data },
      { upsert: true, new: true }
    );

    const duration = (new Date() - startTime) / 1000;
    logger.info(`[${ERROR_CODES?.SUCCESS.code}] Face match completed | Duration: ${duration}s`);

    return res.status(200).json({
      message: "Valid",
      response: response.data,
      success: true,
    });
  } catch (err) {
    logger.error(`Error in FaceMatch API => ${err.message || err}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.handleTruthScreenFaceVerification = async (req, res) => {
  const startTime = new Date();
  logger.info("TruthScreen Face Verification API triggered");

  try {
    const { userImage, aadhaarImage } = req.body;
    logger.info(`Request body: ${JSON.stringify(req.body)}`);

    if (!userImage || !aadhaarImage) {
      logger.warn(`[${ERROR_CODES.BAD_REQUEST.code}] Missing required fields`);
      return res.status(ERROR_CODES.BAD_REQUEST.httpCode).json({
        ...ERROR_CODES.BAD_REQUEST,
        message: "Both userImage and aadhaarImage are required",
      });
    }

    const responseData = await callTruthScreenFaceVerification(userImage, aadhaarImage);
    logger.info(`TruthScreen API response: ${JSON.stringify(responseData)}`);

    await FaceMatchModel.findOneAndUpdate(
      { userImage, aadhaarImage },
      { userImage, aadhaarImage, response: responseData },
      { upsert: true, new: true }
    );

    const duration = (new Date() - startTime) / 1000;
    logger.info(`[${ERROR_CODES.SUCCESS.code}] Face verification completed | Duration: ${duration}s`);

    return res.status(200).json({
      message: "Valid",
      response: responseData,
      success: true,
    });

  } catch (err) {
    logger.error(`Error in TruthScreen Face Verification API => ${err.message || err}`);
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.handleFaceComparison = async (req, res) => {
  const startTime = new Date();
  logger.info("Face Comparison API triggered");

  try {
    const { sourceImage, targetImage } = req.body;

    logger.info(`Request body received: ${JSON.stringify(req.body)}`);
    if (!sourceImage || !targetImage) {
      logger.warn(`[${ERROR_CODES?.BAD_REQUEST.code}] Missing required fields: sourceImage or targetImage`);
      return res.status(400).json({
        ...ERROR_CODES?.BAD_REQUEST,
        message: "Both sourceImage and targetImage are required",
      });
    }
    const response = await verifyFaceComparison({ sourceImage, targetImage });

    if (!response) {
      logger.error(`[${ERROR_CODES?.NO_RESPONSE.code}] No response from Face Comparison API`);
      return res.status(502).json(ERROR_CODES?.NO_RESPONSE);
    }
    if (response?.status === "success" || response?.match === true) {
      const duration = (new Date() - startTime) / 1000;
      logger.info(`[${ERROR_CODES?.SUCCESS.code}] Face comparison successful ✅ | Duration: ${duration}s`);

      return res.status(200).json({
        ...ERROR_CODES?.SUCCESS,
        message: "Face comparison completed successfully",
        data: response,
      });
    } else {
      logger.error(`[${ERROR_CODES?.FACE_MISMATCH.code}] Face comparison failed or faces do not match`);
      return res.status(422).json({
        ...ERROR_CODES?.FACE_MISMATCH,
        message: "Face comparison failed — faces do not match",
        data: response,
      });
    }

  } catch (err) {
   const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
// exports.facematchapi = async (req, res, next) => {
//   try {
//     const { userimage, aadharImage } = req.body;
//     console.log(userimage , aadharImage )

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
//       const exsist = await  faceMatch.findOne({adhaarimage : aadharImage ,userimage :userimage  })
//       console.log("======>>>>" , exsist)
//       if(!exsist){
//       await faceMatch.create({
//           adhaarimage : aadharImage,
//           userimage : userimage,
//           response : responseObject,
//           MerchantId : MerchantId,
//           token:check,
//           createdDate:new Date().toLocaleDateString(),
//           createdTime:new Date().toLocaleTimeString()
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
//   if (!userimage || !aadharImageUrl ) {
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

//     if (step2Response?.message?.toUpperCase() === "FACE VERIFICATION FAILED") {
//       return { error: "Face Verification Failed" };
//     } else {
//       if (step2Response?.data?.status === 1) {
//         const faceResponse = {
//           userimage,
//           adhaarimage: aadharImageUrl,
//           response: step2Response?.data,
//           MerchantId,
//           token,
//         };
//         await facematchModel.findOneAndUpdate({ MerchantId }, faceResponse, {
//           upsert: true,
//           new: true,
//         });
//         return step2Response?.data?.msg;
//       } else {
//         return { error: "Face Verification Failed" };
//       }
//     }
//   } catch (error) {
//     console.error("facematch Verification Error:", error.message);
//     return { error: "facematch verification failed" };
//   }
// };




