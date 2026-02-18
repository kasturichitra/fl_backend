const axios = require("axios");
require("dotenv").config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel = require("../models/BinApiBankModel");
const handleValidation = require("../../../utlis/lengthCheck");
const genrateUniqueServiceId = require("../../../utlis/genrateUniqueId");
const { cardLogger, accountLogger } = require("../../Logger/logger");
const {
  BinActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/BinServiceResponse");
const {
  IfscActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/IfscActiveServiceResponse");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");
let RapidApiKey = process.env.RAPIDAPI_KEY;
let RapidApiHost = process.env.RAPIDAPI_BIN_HOST;
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST;

exports.getCardDetailsByNumber = async (req, res) => {
  const { bin, serviceId = "", categoryId = "", mobileNumber = "" } = req.body;
  const data = req.body;

  console.log("bin detailes=---> ", bin);
  console.log("RAOPID_API KEY=---> ", RapidApiKey);
  console.log("RAPID Bin API HOST =---> ", RapidApiHost);
  console.log("RAPID Bank  API HOST =---> ", RapidApiBankHost);

  const isValid = handleValidation("bin", bin, res);
  if (!isValid) return;

  const identifierHash = hashIdentifiers({
    binNumber: bin,
  });

  const binRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: req.userClientId,
  });

  if (!binRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: binRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  console.log("bin txn Id ===>>", tnId);
  cardLogger.info("bin txn Id ===>>", tnId);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
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
  const encryptedBin = encryptData(bin);
  cardLogger.info("bin encrypted response ====>>", encryptedBin);

  const existingBinNumber = await RapidApiModel.findOne({
    bin: encryptedBin,
  });

  if (existingBinNumber) {
    if (existingBinNumber?.status == 1) {
      return res.status(200).json({
        message: "valid",
        success: true,
        response: existingBinNumber?.response,
      });
    } else {
      return res.status(404).json({
        message: "InValid",
        success: false,
        response: existingBinNumber?.response,
      });
    }
  }

  const service = await selectService(categoryId, serviceId);

  console.log("----active service for bin Verify is ----", service);
  cardLogger.info("----active service for bin Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    const exsistingDetails = await RapidApiModel.findOne({ bin });
    console.log(
      "==============================>>>>>bin existing",
      exsistingDetails,
    );
    let response = await BinActiveServiceResponse(bin, service, 0);
    // const response = await verifyBinNumber(data);
    if (response) {
      console.log("response of bin in back end jus===>", response);
      let saveData = await RapidApiModel({
        bin: bin,
        response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      let done = await saveData.save();
      if (done) {
        console.log("Data save to db successfully ");
      }
    }
    return res.status(200).json({
      message: "valid",
      success: true,
      response: response,
    });
  } catch (error) {
    console.error("Error fetching BIN info:", error.message);
    res.status(500).json({ error: "Failed to fetch BIN information" });
  }
};

exports.getBankDetailsByIfsc = async (req, res) => {
  const { ifsc, serviceId = "", categoryId = "", mobileNumber = "" } = req.body;
  const data = req.body;
  console.log("IFSC Code:", ifsc);

  const tnId = genrateUniqueServiceId();
  accountLogger.info("IFSC txn Id ===>>", tnId);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
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

  const existingBankDetails = await RapidApiBankModel.findOne({ Ifsc: ifsc });

  if (existingBankDetails) {
    return res.status(200).json({
      message: "valid",
      success: true,
      response: existingBankDetails?.response,
    });
  }
    const service = await selectService(categoryId, serviceId);

  try {

    const response = await IfscActiveServiceResponse(data, service, 0);
    console.log("Bank details fetched successfully:", response);
    if (response) {
      let saveData = await RapidApiBankModel({
        Ifsc: ifsc,
        response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      let done = await saveData.save();
      if (done) {
        console.log("Bank Data save to db successfully ");
      }
    }
    return res.status(200).json({
      message: "Valid",
      success: true,
      response: response,
    });
  } catch (error) {
    console.error("Error fetching Bank info:", error.message);
    res.status(500).json({ error: "Failed to fetch Bank information" });
  }
};
