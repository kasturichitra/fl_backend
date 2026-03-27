const crypto = require("crypto");

const genrateUniqueServiceId = () => {
  const timestamp = Date.now(); 
  const random = crypto.randomBytes(4).toString("hex");
  return `TXON${timestamp}${random}`;
};

module.exports = genrateUniqueServiceId;
