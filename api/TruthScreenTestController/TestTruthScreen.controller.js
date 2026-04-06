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

function decrypt(encryptedText, password) {
  const key = generateKey(password);

  commonLogger.info(`encryptedText ===> ${encryptedText} ${typeof encryptedText}`);

  if (typeof encryptedText !== "string") {
    throw new Error("Invalid encryptedText: must be a string");
  }

  const [encryptedData, ivBase64] = encryptedText.split(":");
  const iv = Buffer.from(ivBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
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

const DecryptTruthScreenResponse = async (req, res) => {
  commonLogger.info(`req.body for decryption ===>>> ${JSON.stringify(req.body)}`);
  const { data } = req.body;
  const password = req.headers.password;

  
  if (!data || !password) {
    return res.status(400).json({ error: "Missing data in body or password in headers" });
  }

  try {
    const decryptedData = decrypt(data, password);
    const parsedData = JSON.parse(decryptedData);
    commonLogger.info(`decrypted truthScreenResponse ===>>> ${JSON.stringify(parsedData)}`);
    return res.status(200).json(parsedData);
  } catch (error) {
    commonLogger.error(`Error in DecryptTruthScreenResponse: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  encryptresponseData,
  DecryptTruthScreenResponse
}