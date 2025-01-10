const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const checkToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    let errorMessage = {
      message: "Access denied. No token provided.",
      statusCode: 403,
    };
    return next(errorMessage);
  }

  try {
    const tokenWithoutBearer = token.split(" ")[1];
    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWTSECRET);
    if (decoded) {
      req.tokenData = decoded;
      req.token = tokenWithoutBearer;
      next();
    }
  } catch (err) {
    let errorMessage = {
      message: "Invalid or expired token.",
      statusCode: 400,
    };
    return next(errorMessage);
  }
};

module.exports = checkToken;
