const { deductCredits } = require("../../../services/CreditService");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const handleValidation = require("../../../utils/lengthCheck");
const { faceServiceLogger } = require("../../Logger/logger");

async function handleImageVerification({
  req,
  res,
  serviceKey
}) {
  const { mobileNumber = "" } = req.body;
  const file = req.file;
  const clientId = req.clientId;

  if (!file || !file.buffer) {
    return res.status(400).json({
      ...ERROR_CODES.BAD_REQUEST,
      response: "Image file is required",
    });
  }

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    serviceKey,
    clientId
  );

  const now = new Date();
  const createdTime = now.toLocaleTimeString();
  const createdDate = now.toLocaleDateString();

  try {
    const identifierHash = hashIdentifiers({
      fileName: file.originalname,
      size: file.size,
    });

    // ✅ Rate Limit
    const rateLimit = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
    });

    if (!rateLimit.allowed) {
      return res
        .status(429)
        .json({ success: false, message: rateLimit.message });
    }

    // ✅ Credits
    const txnId = genrateUniqueServiceId();

    const credits = await deductCredits(
      clientId,
      idOfService,
      idOfCategory,
      txnId,
      req.environment
    );

    if (!credits?.result) {
      return res
        .status(500)
        .json({ success: false, message: credits?.message });
    }

    // ✅ Check existing
    const existing = await model.findOne({
      fileName: file.originalname,
      fileSize: file.size,
    });

    if (existing) {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: existing?.response,
        createdTime,
        createdDate,
      });

      return res.status(200).json(
        createApiResponse(
          200,
          existing?.response,
          existing?.response?.message || "Processed"
        )
      );
    }

    // ✅ Select service
    const service = await selectService(idOfCategory, idOfService);
    if (!service) return res.status(404).json(ERROR_CODES.NOT_FOUND);

    // ✅ Call service layer
    const response = await activeServiceFn({ file }, service, 0);

    const isSuccess =
      response?.message?.toUpperCase() === "CLEAR" ||
      response?.message?.toUpperCase() === "VALID";

    // ✅ Store response
    await responseModel.create({
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId,
      result: response?.result,
      createdTime,
      createdDate,
    });

    // ✅ UPSERT (same as your mobile logic)
    const filter = {
      fileName: file.originalname,
      fileSize: file.size,
    };

    const update = {
      $set: {
        response: response?.result,
        status: isSuccess ? 1 : 2,
        serviceName: response?.service,
        ...(mobileNumber && { mobileNumber }),
        createdDate,
        createdTime,
      },
      $setOnInsert: {
        fileName: file.originalname,
        fileSize: file.size,
      },
    };

    try {
      await model.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        await model.findOne(filter);
      } else {
        throw err;
      }
    }

    return res.status(200).json(
      createApiResponse(
        200,
        response?.result,
        response?.message || "Processed"
      )
    );
  } catch (error) {
    const err = mapError(error);
    return res.status(err.httpCode).json(err);
  }
}

exports.verifyImageBlurriness = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "BLUR_CHECK"
  });

exports.verifyAiImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "AI_IMAGE_CHECK"
  });

exports.verifyDeepfakeImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "DEEPFAKE_IMAGE_CHECK"
  });

exports.verifyAiAndDeepfakeImage = (req, res) =>
  handleImageVerification({
    req,
    res,
    serviceKey: "AI_AND_DEEPFAKE_IMAGE_CHECK"
  });

exports.handleImageAPI = async (req, res, next) => {
  const {
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
    apiType, // 🔥 IMPORTANT (BLUR_CHECK / OCR / etc.)
  } = req.body;

  const file = req.file;
  const storingClient = req.clientId || clientId;

  if (!file || !file.buffer) {
    return res.status(400).json({
      success: false,
      message: "Image file is required",
    });
  }

  if (!apiType) {
    return res.status(400).json({
      success: false,
      message: "apiType is required",
    });
  }

  try {
    const identifierHash = hashIdentifiers({
      fileName: file.originalname,
      size: file.size,
    });

    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!rateLimitResult?.allowed) {
      return res.status(429).json({
        success: false,
        message: rateLimitResult?.message,
      });
    }

    const tnId = genrateUniqueServiceId();

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message,
      });
    }

    const services = await selectService(apiType);

    const response = await commonImageServiceResponse(
      { file },
      services,
      apiType,
      0
    );

    return res
      .status(200)
      .json(createApiResponse(200, response, response.message));
  } catch (error) {
    const errorObj = mapError(error);
    return res
      .status(errorObj.httpCode)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};

exports.verifyImageBlurriness = async (req, res, next) => {
  const { docType = "93" } = req.body;

  const file = req.file;

  faceServiceLogger.info(`Incoming blur check request`);

  const storingClient = req.clientId || clientId;

  // ✅ Validate file
  if (!file) {
    return res.status(400).json({
      success: false,
      message: "File is required",
    });
  }

  // ✅ Validate docType
  const isDocTypeValid = handleValidation("docType", docType, res);
  if (!isDocTypeValid) return;

  try {
    faceServiceLogger.info(
      `Executing Blur Check for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`
    );

    const identifierHash = hashIdentifiers({
      fileName: file.originalname,
      size: file.size,
    });

    // ✅ Rate Limit
    const rateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!rateLimitResult?.allowed) {
      faceServiceLogger.warn(`Rate limit exceeded for client ${storingClient}`);
      return res.status(429).json({
        success: false,
        message: rateLimitResult?.message,
      });
    }

    // ✅ Generate txn ID
    const tnId = genrateUniqueServiceId();
    faceServiceLogger.info(`Generated txnId: ${tnId}`);

    // ✅ Deduct credits
    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      faceServiceLogger.error(`Credit deduction failed for client ${storingClient}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
      });
    }

    // ✅ Check if already processed (optional caching)
    const existingRecord = await blurModel.findOne({
      fileName: file.originalname,
      fileSize: file.size,
    });

    if (existingRecord) {
      faceServiceLogger.info(`Returning cached blur response`);

      return res.status(200).json(
        createApiResponse(200, existingRecord.response, "Success")
      );
    }

    // ✅ Select service
    const service = await selectService("BLUR_CHECK");

    if (!service) {
      return res
        .status(404)
        .json(createApiResponse(404, null, "Service not found"));
    }

    faceServiceLogger.info(`Selected service: ${service.serviceFor}`);

    // ✅ Prepare FormData
    const FormData = require("form-data");
    const fs = require("fs");

    const form = new FormData();
    form.append("transID", tnId);
    form.append("docType", docType);
    form.append("file", fs.createReadStream(file.path));

    // ✅ Call external API
    const axios = require("axios");

    const apiResponse = await axios.post(
      process.env.BLUR_API_URL,
      form,
      {
        headers: {
          username: process.env.USERNAME,
          ...form.getHeaders(),
        },
        timeout: 20000,
      }
    );

    faceServiceLogger.info(`Response from Blur API received`);

    const result = apiResponse.data;

    // ✅ Store response
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result,
      createdTime: new Date().toLocaleTimeString(),
      createdDate: new Date().toLocaleDateString(),
    });

    // ✅ Save in DB
    await blurModel.create({
      fileName: file.originalname,
      fileSize: file.size,
      response: result,
      status: result?.status,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    });

    // ✅ Delete temp file
    fs.unlink(file.path, () => {});

    return res.status(200).json(
      createApiResponse(200, result, result?.result || "Processed")
    );

  } catch (error) {
    faceServiceLogger.error(`Error in Blur API: ${error.message}`, error);

    const errorObj = mapError(error);

    return res
      .status(errorObj.httpCode || 500)
      .json(createApiResponse(500, {}, "Server Error"));
  }
};