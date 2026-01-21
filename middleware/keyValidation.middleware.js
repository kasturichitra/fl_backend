const testingKeysModel = require("../api/testing_api_keys/models/testing.model");
const liveModal = require("../api/live_api_keys/models/liveKeys.model");
const { commonLogger } = require("../api/Logger/logger");

const checkKeys = async (req, res, next) => {
  const client = req.headers["client_id"];
  const secret = req.headers["secret_key"];

  if (!client || !secret) {
    commonLogger.warn(`Access denied. Client or Secret missing.`);
    return res.status(400).json({
      message: "Access denied. Client or Secret are not provided.",
      statusCode: 400,
    });
  }

  try {
    // 1. Check Testing Keys
    const testingKey = await testingKeysModel.findOne({
      client_id: client,
      secret_key: secret,
    });

    if (testingKey) {
      commonLogger.info(`Testing Key Matched for Client: ${client}`);
      req.userClientId = testingKey.MerchantId;
      req.environment = 'TEST';
      return next();
    }

    // 2. Check Live Keys
    const liveKey = await liveModal.findOne({
      client_id: client,
      secret_key: secret,
    });

    if (liveKey) {
      commonLogger.info(`Live Key Matched for Client: ${client}`);
      req.userClientId = liveKey.MerchantId;
      req.environment = 'LIVE';
      return next();
    }

    // 3. No Match
    commonLogger.warn(`Invalid Keys provided: Client: ${client}`);
    return res.status(404).json({
      message: "You Provided Wrong Keys",
      statusCode: 404,
    });

  } catch (error) {
    commonLogger.error(`Error in key validation: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong, Try Again after some time",
      statusCode: 500,
    });
  }
};

module.exports = checkKeys;
