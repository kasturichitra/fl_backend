const testingModel = require("../models/testing.model");
const registerationModel = require("../../registeration/model/registerationModel");
const { Readable } = require("stream");
const XLSX = require("xlsx");
const jwt = require("jsonwebtoken");
const { commonLogger } = require("../../Logger/logger");

function generatingApiKey(name) {
  const hashcode = Math.floor(100000000 + Math.random() * 900000000).toString();
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  const firstWord = timestamp.toString().split("").reverse().join("");
  const secondWord = "test"
  const lastWord = name ? name.substring(0, 2) : "XX";

  const apiKey = `${firstWord}_${secondWord}_${hashcode}${lastWord}`;
  return apiKey;
}

function generationApiSalt(name) {
  const hashcode = Math.floor(100000000 + Math.random() * 900000000).toString();
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  const firstWord = timestamp.toString().split("").reverse().join("");
  const secondWord = timestamp.toString();
  const lastWord = name ? name.substring(0, 2) : "XX";

  const apiSaltKey = `${hashcode}${firstWord}${secondWord}${lastWord}`;
  return apiSaltKey;
}

const generateApiKeys = async (req, res, next) => {
  const { clientId } = req.body;

  if (!clientId) {
    commonLogger.error("ClientId not provided in generateApiKeys");
    return res.status(400).json({
      message: "ClientId is required",
      statusCode: 400,
      success: false
    });
  }

  try {
    const existingKeysForService = await testingModel.find({ clientId });

    if (existingKeysForService?.length >= 7) {
      commonLogger.warn(`Key limit reached for client: ${clientId}`);
      return res.status(400).json({
        message: "Your Key Limit Reached You can not Generate another one 😒!",
        statusCode: 400,
        success: false
      });
    }

    const testing_Api_key = generatingApiKey(clientId);
    const testing_Api_salt = generationApiSalt(clientId);

    // Default secret if env var is missing
    const jwtSecret = process.env.JWT_SECRET || process.env.JWTSECRET || "default_secret";

    const token = jwt.sign(
      { client_id: testing_Api_key, type: 'TEST' },
      jwtSecret,
      { expiresIn: "365d" }
    );

    const testDetails = await testingModel.create({
      clientId,
      client_id: testing_Api_key,
      secret_key: testing_Api_salt,
      token,
      createdDate: new Date().toLocaleDateString(),
      createdTime: new Date().toLocaleTimeString(),
    });

    commonLogger.info(`Generated new Test API Key for Client: ${clientId}`);

    const testDetailsResponse = {
      client_id: testing_Api_key,
      secret_key: testing_Api_salt,
      token,
    };

    res.status(200).json({
      message: "Valid",
      success: true,
      response: testDetailsResponse
    });

  } catch (error) {
    commonLogger.error(`Error in generateApiKeys: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong, try again after some time",
      statusCode: 500,
      success: false
    });
  }
};

const getAllApiKeys = async (req, res, next) => {
  const { MerchantId } = req.params;

  if (!MerchantId) {
    return res.status(400).json({
      message: "MerchantId is required",
      statusCode: 400,
      success: false
    });
  }

  try {
    const existingKeys = await testingModel.find({clientId: MerchantId });

    if (existingKeys?.length > 0) {
      commonLogger.info(`Fetched ${existingKeys.length} keys for clientId: ${MerchantId}`);
      res.status(200).json({ message: "Valid", success: true, response: existingKeys });
    } else {
      commonLogger.info(`No keys found for clientId: ${MerchantId}`);
      return res.status(404).json({
        message: "No Keys Found",
        statusCode: 404,
        success: false
      });
    }

  } catch (error) {
    commonLogger.error(`Error in getAllApiKeys: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong, try again after some time",
      statusCode: 500,
      success: false
    });
  }
}

const removeOneApi = async (req, res, next) => {
  const { id } = req.params;

  try {
    const existingKey = await testingModel.findByIdAndDelete(id);

    if (existingKey) {
      commonLogger.info(`Deleted API Key ID: ${id}`);
      res.status(200).json({ message: "Valid", success: true, response: "Deleted Successfully" });
    } else {
      commonLogger.warn(`Attempt to delete non-existent Key ID: ${id}`);
      return res.status(404).json({
        message: "No Key Found",
        statusCode: 404,
        success: false
      });
    }
  } catch (error) {
    commonLogger.error(`Error in removeOneApi: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong, try again after some time",
      statusCode: 500,
      success: false
    });
  }
}

const excelDownload = async (req, res, next) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({
      message: "Id was not provided",
      statusCode: 400,
      success: false
    });
  }

  try {
    const allTestingApiKeys = await testingModel.find({ _id: id });

    const wantedFields = allTestingApiKeys.map((each, index) => ({
      "S.NO": index + 1,
      "client_id": each?.client_id,
      "secret_key": each?.secret_key,
    }));

    const fileName = "ApiKeys.xlsx";

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(wantedFields);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    if (buffer.length === 0) {
      throw new Error("Buffer is empty");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Length", buffer.length);

    res.end(buffer);
  } catch (error) {
    commonLogger.error(`Error exporting JSON to Excel: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong, try again after some time",
      statusCode: 500,
      success: false
    });
  }
};

module.exports = { generateApiKeys, getAllApiKeys, removeOneApi, excelDownload };
