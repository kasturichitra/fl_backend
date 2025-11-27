const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; 
const IV = process.env.ENCRYPTION_IV || "1234567890123456"; 

function encryptData(normalText) {
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), IV);
  let encrypted = cipher.update(normalText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptData(encrypted) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), IV);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}


module.exports ={
    decryptData,
    encryptData
}