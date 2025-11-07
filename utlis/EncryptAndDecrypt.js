const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; 
const IV = process.env.ENCRYPTION_IV || "1234567890123456"; 

function encryptData(pan) {
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), IV);
  let encrypted = cipher.update(pan, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptData(encryptedPan) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), IV);
  let decrypted = decipher.update(encryptedPan, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}


module.exports ={
    decryptData,
    encryptData
}