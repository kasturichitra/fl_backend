const { deductCredits } = require("../../../services/CreditService");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const handleValidation = require("../../../utils/lengthCheck");
const { faceServiceLogger } = require("../../Logger/logger");
const crypto = require("crypto");
const FaceModel = require("../models/FaceModel");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { selectService } = require("../../service/serviceSelector");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const { imageActiveServiceResponse } = require("../service/faceServicesResp");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");

async function handleImageVerification({ req, res, serviceKey }) {
  const { mobileNumber = "" } = req.body;
  const file = req.file;
  const clientId = req.clientId || "CID-6140971541";
  const txnId = genrateUniqueServiceId();

  if (mobileNumber) {
    const isValid = await handleValidation(
      "mobile",
      mobileNumber,
      res,
      clientId,
      faceServiceLogger,
    );

    if (!isValid) return;
  }

  if (!file || !file.buffer) {
    return res.status(400).json({
      ...ERROR_CODES.BAD_REQUEST,
      response: "Image file is required",
    });
  }

  // ✅ File validation
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: "Invalid file type",
    });
  }

  if (file.size > MAX_SIZE) {
    return res.status(400).json({
      success: false,
      message: "File too large",
    });
  }

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    serviceKey,
    clientId,
    faceServiceLogger,
  );

  console.log(
    "idOfCategory and idOfService in face and ai services======>>>",
    idOfCategory,
    idOfService,
  );

  const now = new Date();
  const createdTime = now.toLocaleTimeString();
  const createdDate = now.toLocaleDateString();
  try {
    // ✅ Strong hash (content-based)
    const fileHash = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    // ✅ Rate Limit (improved identifiers)
    const rateLimit = await checkingRateLimit({
      identifiers: { fileHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
      req,
      logger: faceServiceLogger,
    });

    if (!rateLimit.allowed) {
      return res
        .status(429)
        .json({ success: false, message: rateLimit.message });
    }

    // ✅ Deduct credits FIRST (as per your flow)

    const credits = await deductCredits(
      clientId,
      idOfService,
      idOfCategory,
      txnId,
      req,
      faceServiceLogger,
    );

    if (!credits?.result) {
      return res
        .status(500)
        .json({ success: false, message: credits?.message });
    }

    // ✅ Check existing (CACHE)
    const existing = await FaceModel.findOne({ fileHash, serviceKey });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
      "success",
      faceServiceLogger,
    );
    if (!analyticsResult.success) {
      faceServiceLogger.info(
        `[FAILED]: Analytics update failed for Shop Establishment verification: client ${clientId}, service ${idOfService}`,
      );
    }

    faceServiceLogger.info(
      `Existing ${existing ? "Found" : "Not Found"} for this image hash ${fileHash} for the client: ${clientId}`,
    );

    if (existing) {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: existing?.response,
        createdDate,
        createdTime,
        TxnID: txnId
      });

      faceServiceLogger.info(
        `Existing response of service: ${serviceKey} returned from Db for the client: ${clientId}`,
      );

      return res
        .status(existing?.status == 1 ? 200 : 404)
        .json(
          createApiResponse(
            existing?.status == 1 ? 200 : 404,
            existing?.response,
            existing?.status == 1 ? "Valid" : "Invalid",
          ),
        );
    }

    // ✅ Select service
    const service = await selectService(
      idOfCategory,
      idOfService,
      txnId,
      req,
      faceServiceLogger
    );

    if (!service?.length) {
      return res.status(404).json(ERROR_CODES.NOT_FOUND);
    }

    // ✅ Call service layer
    const imageResponse = await imageActiveServiceResponse(
      { file },
      service,
      serviceKey,
      0,
      clientId,
    );

    faceServiceLogger.info(
      `Response received from active service ${imageResponse?.service} for image verification with message: ${imageResponse?.message} of response: ${JSON.stringify(imageResponse)}`,
    );

    if (imageResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    // ✅ Safer success detection
    const isSuccess = imageResponse?.message?.toLowerCase() == "valid" 
    // ✅ Store response log
    await responseModel.create({
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
      result: imageResponse?.result,
      createdDate,
      createdTime,
      TxnID: txnId
    });

    // ✅ UPSERT main collection
    const filter = { fileHash, serviceKey };

    const update = {
      $set: {
        serviceKey,
        response: imageResponse?.result,
        status: isSuccess ? 1 : 2,
        serviceName: imageResponse?.service,
        serviceResponse: imageResponse?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        createdTime,
        createdDate,
      },
      $setOnInsert: {
        fileHash
      },
    };

    try {
      await FaceModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        // duplicate race condition fallback
        await FaceModel.findOne(filter);
      } else {
        throw err;
      }
    }

    return res
      .status(isSuccess ? 200 : 404)
      .json(
        createApiResponse(
          isSuccess ? 200 : 404,
          response?.result,
          isSuccess ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
      "failed",
      faceServiceLogger,
    );
    if (!analyticsResult.success) {
      businessServiceLogger.info(
        `[FAILED]: Analytics update failed for Shop Establishment verification: client ${clientId}, service ${idOfService}`,
      );
    }
    const err = mapError(error);
    console.log("err that comes from map error ====>", err);
    return res.status(err.httpCode).json(err);
  }
}

// ✅ Controllers
exports.verifyImageBlurriness = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "BLUR_CHECK",
  });

exports.verifyAiImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "AI_IMAGE_CHECK",
  });

exports.verifyDeepfakeImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "DEEPFAKE_IMAGE_CHECK",
  });

exports.verifyAiAndDeepfakeImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "AI_AND_DEEPFAKE_IMAGE_CHECK",
  });
