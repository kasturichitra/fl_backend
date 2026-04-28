const axios = require("axios");
const checkingDetails = require("../../../utils/authorization");
const FaceMatchModel = require("../models/facematch.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { faceServiceLogger } = require("../../Logger/logger");
const ERROR_CODES = require("../../../utils/errorCodes");
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
const { generateTransactionId } = require("../../../utils/helper");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { FaceMatchActiveServiceResponse } = require("../services/fatchMatch");
const { deductCredits } = require("../../../services/CreditService");

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
  const userImage = req?.files?.userImages?.[0];
  const aadhaarImage = req?.files?.aadhaarImages?.[0];
  // const {userImage, aadhaarImage} = req?.files;
  console.log("req.files ===>", req.files);
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);
  faceServiceLogger.info(`face match service txn Id ${TxnID} ===>>`);

  faceServiceLogger.info(`TxnID:${TxnID}, FACE MATCH Details`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } =
      getCategoryIdAndServiceId("FACE_MATCH", TxnID, faceServiceLogger);
    console.log("idOfService and idOfCategory ====>>", categoryId, serviceId);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      faceServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const service = await selectService(
      categoryId,
      serviceId,
      TxnID,
      req,
      faceServiceLogger,
    );

    if (!service.length) {
      return res.status(503).json({ error: "No service available" });
    }

    console.log("FACEMATCH inverify activer service", service);
    const dataTosend = {
      userImage,
      aadhaarImage,
    };
    let response = await FaceMatchActiveServiceResponse(
      dataTosend,
      service,
      (index = 0),
      TxnID,
    );
    console.log(
      "Face match verification is activer service response message:",
      response,
    );

    return res
      .status(200)
      .json({
        message: "Success",
        data: {
          is_match: response?.result?.is_match,
          match_score: response?.result?.match_score,
        },
        success: true,
      });
  } catch (error) {
    console.log("Error While FaceMatchVerification", error);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};

exports.dinVerification = async (req, res) => {
  const { dinNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!dinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  businessServiceLogger.info(
    `TxnID:${TxnID}, DIN NUMBER Details: ${dinNumber}`,
  );
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } =
      await getCategoryIdAndServiceId("DIN", TxnID, businessServiceLogger);

    const isValid = handleValidation(
      "din",
      dinNumber,
      res,
      TxnID,
      businessServiceLogger,
    );
    if (!isValid) return;

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing DIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH DIN NUMBER
    const indetifierHash = hashIdentifiers(
      {
        dinNo: dinNumber,
      },
      businessServiceLogger,
    );

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const dinRateLimitResult = await checkingRateLimit({
      identifiers: { indetifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger,
    });

    if (!dinRateLimitResult.allowed) {
      businessServiceLogger.info(
        `[FAILED]: Rate limit exceeded for DIN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: dinRateLimitResult.message,
      });
    }
    businessServiceLogger.info(`Generated DIN txnId: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.info(
        `[FAILED]: Credit deduction failed for DIN verification: client ${clientId}, txnId ${TxnID}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT
    const encryptedDin = encryptData(dinNumber);

    const existingDin = await din_verifyModel.findOne({
      dinNumber: encryptedDin,
    });

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      "success",
      TxnID,
      businessServiceLogger,
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `[FAILED]: Analytics update failed for DIN verification txnId: ${TxnID}, client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing DIN record in DB: ${existingDin ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingDin) {
      if (existingDin?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached DIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingDin?.response,
          dinNumber: dinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached din response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingDin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingDin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    }

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(
      categoryId,
      serviceId,
      TxnID,
      req,
      businessServiceLogger,
    );
    if (!service.length) {
      businessServiceLogger.info(
        `[FAILED]: Active service not found for DIN category txnId: ${TxnID}, ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }
    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for DIN verification: ${service}`,
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE
    let response = await DinActiveServiceResponse(dinNumber, service, 0, TxnID);

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for DINverification service ${response.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        dinNumber: encryptedDin,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        dinNumber: encryptedDin,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await din_verifyModel.findOneAndUpdate(
        { dinNumber: encryptedDin },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `Valid DIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        TxnID,
        result: {
          dinNumber: dinNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        dinNumber: encryptedDin,
        response: {
          dinNumber: dinNumber,
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await din_verifyModel.findOneAndUpdate(
        { dinNumber: encryptedDin },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid DIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { dinNumber: dinNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in DIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
