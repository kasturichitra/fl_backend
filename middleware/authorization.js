const tokenVerify = require("./verifyToken");

async function checkingDetails (authorized , next){
    if (!authorized) {
      console.log("Authorization header is required");
      let errorMessage = {
        message: "Authorization header is required",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    const token = authorized.split(' ')[1];
    console.log("Token details to save===>", token);
    if (!token) {
      let errorMessage = {
        message: "Token is required",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    const isValidToken = tokenVerify(token);
    console.log("isValidToken===>", isValidToken);
    if (isValidToken.error) {
        let errorMessage = {
            message: "Invalid token",
            statusCode: 400,
          };
        return next(errorMessage);
    }
  
    return token ;
  };

  module.exports = checkingDetails 