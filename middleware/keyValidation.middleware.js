const testingKeysModel = require("../api/testing_api_keys/models/testing.model");
const liveModal = require("../api/live_api_keys/models/liveKeys.model");

const checkKeys = async (req, res, next) => {
  const client = req.headers["client_id"];
  const secret = req.headers["secret_key"];

  console.log(
    "=====>>>>Merchant id and client and secret",
    client,
    secret
  );

  if (!client || !secret) {
    let errorMessage = {
      message: "Access denied. Client or Secret are not provided.",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    const existingKeys = await testingKeysModel.find({
      client_id: client,
      secret_key: secret,
    });
    const existingLiveKeys = await liveModal.find({
      client_id: client,
      secret_key: secret,
    });

    if (existingKeys?.length == 1 || existingLiveKeys?.length == 1) {
      console.log("existingKeys found =====>>>",existingKeys?.length);
      req.userClientId =
        existingLiveKeys[0]?.MerchantId || existingKeys[0]?.MerchantId;
      next();
    } else {
      let errorMessage = {
        message: "You Provided Wrong Keys",
        statusCode: 404,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.log("=====>>>>>error in key validation", error);
    let errorMessage = {
      message: "Some thing went wrong Try Again after some time",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

module.exports = checkKeys;
