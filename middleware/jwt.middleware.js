const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const registeration = require("../api/registeration/model/registerationModel");
const tokenVerify = require("../utlis/verifyToken");
dotenv.config();

const checkToken = async (req, res, next) => {
  console.log('check token is triggred')
  const authHeader = req.headers.authorization || "";

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
  console.log('check token is ====>', token)
  if (!token) {
    return next({
      message: "Access denied. No token provided.",
      statusCode: 403,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    console.log("Decoded", decoded);
    const Merchant = await registeration.findOne({
      mobileNumber: decoded?.mobileNumber,
    });

    if (!decoded || !Merchant) {
      return next({
        message: "Invalid token",
        statusCode: 400,
      });
    }

    req.tokenData = decoded;
    req.token = token;

    next();
  } catch (err) {
    return next({
      message: "Invalid or expired token.",
      statusCode: 400,
    });
  }
};



module.exports = checkToken;
