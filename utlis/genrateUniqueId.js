const crypto = require("crypto");

const genrateUniqueServiceId = () => {
  const timestamp = Date.now(); 
  console.log("timestamp ====>>", timestamp)
  const random = crypto.randomBytes(4).toString("hex"); 
  console.log("random ===>>", random)
  return `TXON${timestamp}${random}`;
};

module.exports = genrateUniqueServiceId;
