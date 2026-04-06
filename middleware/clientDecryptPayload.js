const crypto = require("crypto");
const { commonLogger } = require("../api/Logger/logger");
const DUMMY_PASSWORD = process.env.DUMMY_PASSWORD_FOR_ONBOARDING

function generateKey(password) {
    const hash = crypto.createHash("sha512");
    hash.update(password, "utf-8");
    return hash.digest("hex").substring(0, 16);
};

const encrypt = (plainText, password) => {

    const key = generateKey(password);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key), iv);

    let encrypted = cipher.update(plainText, "utf-8", "base64");
    encrypted += cipher.final("base64");

    return `${encrypted}:${iv.toString("base64")}`;
};

exports.encryptPayload = async (req, res, next) => {
    try {
        const password = req.client_secret || DUMMY_PASSWORD;

        const oldJson = res.json.bind(res);
        res.json = async function (data) {
            const encryptData = await encrypt(JSON.stringify(data), password);
            return oldJson(encryptData);
        }
        next();
    } catch (error) {
        commonLogger.error(`[STS] Error in encryptMiddleware setup: ${error.message}`);
        res.status(500).json({
            error: "Internal server error during encryption setup",
            success: false
        });
    }
};

const decrypt = (encryptedText, password) => {

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

exports.decryptPayload = async (req, res, next) => {
    try {
        const password = req.client_secret || DUMMY_PASSWORD
        console.log("req?.body ===>>", req?.body)
        if (!req?.body.data) {
            commonLogger.warn("[STS] Missing encrypted payload fields in request.");
            return res.status(400).json({
                error: "Missing encrypted payload",
                success: false
            });
        };

        commonLogger.info(`[STS] Attempting to decrypt request payload...,password:${password}, PayloadData: ${typeof (req?.body.data)}`);
        const decryptedData = await decrypt(req?.body.data, password);

        req.body = JSON.parse(decryptedData);
        commonLogger.info(`[STS] Request payload decrypted successfully. decryptedData: ${typeof (decryptedData)}`);
        next();

    } catch (error) {
        commonLogger.error(`[STS] Error occurred while decrypting payload: ${error.message}`);
        res.status(500).json({
            error: "Internal server error during decryption",
            success: false
        });
    }
}