const { commonLogger } = require("../api/Logger/logger");
const jwt = require("jsonwebtoken");
const { createApiResponse } = require("../utlis/ApiResponseHandler");

const AuthValidation = (req, res, next) => {
  // Get client, secretkey, secToken form heards
  const client = req.headers["client_id"];
  const secretkey = req.headers["secret_key"];
  const secToken = req.headers["secret_token"];

  try {

    // if Not present return 
    if (!client || !secretkey || !secToken) {
      return res.status(400).json(createApiResponse(400, null, 'client_id or secret_key or secret_token missing'))
    }

    // Decode the token with secretkey
    const decode = jwt.verify(secToken, process.env.JWT_SECRET_KEY);
    console.log('AuthValidation response ', decode);
    const { clientId, secretKey, environment } = decode; // in decode of token we get clientId, secretkey, environment( live or test)

    // validate the clientId, secretkey 
    console.log(client, clientId)
    if ((client != clientId)) {
      commonLogger.warn(`Access denied. Client Id Mismatched.`);
      return res.status(400).json({
        message: "Access denied. Client Id Mismatched.",
        statusCode: 400,
      });
    }
    if (secretkey != secretKey) {
      commonLogger.warn(`Access denied. secret_key Mismatched.`);
      return res.status(400).json({
        message: "Access denied. secret_key Mismatched.",
        statusCode: 400,
      });
    }

    // After verify updated in res with environment 
    req.clientId = client;
    req.secretKey = secretkey;
    req.environment = environment;
    next()
  } catch (err) {
    console.log('AuthValication Error', err.message, err);
    return res.status(500).json(createApiResponse(500, null, 'Server Error!'))
  }
}

module.exports = AuthValidation;
