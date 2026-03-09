const { callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const { commonLogger } = require("../Logger/logger");
const crypto = require("crypto");
const FormData = require("form-data")


function generateKey(password) {
  const hash = crypto.createHash("sha512");
  hash.update(password, "utf-8");
  return hash.digest("hex").substring(0, 16);
}

function generateTransactionId(length = 14) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  const transactionId = `NTAR_${result}`;
  return transactionId;
}

function encrypt(plainText, password) {
  const key = generateKey(password);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key), iv);

  let encrypted = cipher.update(plainText, "utf-8", "base64");
  encrypted += cipher.final("base64");

  return `${encrypted}:${iv.toString("base64")}`;
}

const encryptresponseData = async (req, res) => {
  commonLogger.info(`req.body ===>>> ${JSON.stringify(req.body)}`);
  const payload = req.body;
  const password = req.headers.password;
  try {
    const encryptedData = encrypt(JSON.stringify(payload), password);
    commonLogger.info(`truthScreenResponse ===>>> ${JSON.stringify(encryptedData)}`);
    return res.status(200).json(encryptedData)
  } catch (error) {
    commonLogger.error(`Error in TestTruthScreen: ${error.message}`);
    res.send(error);
  }
}

const DecryptTruthScreenResponse = async(req,res)=>{

}

module.exports = {
  encryptresponseData,
  DecryptTruthScreenResponse
}