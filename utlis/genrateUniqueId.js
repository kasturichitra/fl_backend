const crypto = require("crypto");

const genrateUniqueServiceId = (service) => {
  const timestamp = Date.now(); 
  const random = crypto.randomBytes(4).toString("hex"); 
  return `TXON${service}${timestamp}${random}`;
};

module.exports = genrateUniqueServiceId;
