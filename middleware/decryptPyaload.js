const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { commonLogger } = require("../api/Logger/logger");

// Load private key (PKCS#8)
const privateKeyPem = fs.readFileSync(
    path.join(__dirname, "..", "keys", "private.pem"),
    "utf8"
);

/**
 * Decrypts a hybrid encrypted payload (RSA encrypted AES key + AES-GCM encrypted data).
 * @param {Object} payload - The encrypted payload containing encryptedKey, data, and iv.
 * @returns {Object} - The decrypted JSON object.
 */
function decryptHybridPayload({ encryptedKey, data, iv }) {

    try {
        // Decrypt AES key using RSA-OAEP
        const aesKey = crypto.privateDecrypt(
            {
                key: privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(encryptedKey, "base64")
        );

        // Split ciphertext + auth tag (AES-GCM uses 16-byte tag)
        const encryptedBuffer = Buffer.from(data, "base64");
        const tagLength = 16;

        const ciphertext = encryptedBuffer.slice(0, encryptedBuffer.length - tagLength);
        const authTag = encryptedBuffer.slice(encryptedBuffer.length - tagLength);

        // AES-256-GCM decryption
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            aesKey,
            Buffer.from(iv, "base64")
        );

        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);

        return JSON.parse(decrypted.toString());
    } catch (err) {
        commonLogger.error(`Error while decrypting payload: ${err.message}`);
        throw err;
    }
}

/**
 * Middleware to intercept and decrypt incoming requests.
 */
async function decryptMiddleware(req, res, next) {
    try {
        const publicKeyPem = req.body.publicKeyPem;

        // Validation: Check for required encryption fields
        if (!req.body.encryptedKey || !req.body.data || !req.body.iv) {
            commonLogger.warn("Missing encrypted payload fields in request.");
            return res.status(400).json({
                error: "Missing encrypted payload",
                success: false
            });
        }

        commonLogger.info("Attempting to decrypt request payload...");
        const decryptedData = decryptHybridPayload(req.body);

        // Attach public key and decrypted body for downstream use
        req.publicKey = publicKeyPem;
        req.body = decryptedData;

        commonLogger.info("Request payload decrypted successfully.");
        next();
    } catch (error) {
        commonLogger.error(`Error occurred while decrypting payload: ${error.message}`);
        res.status(500).json({
            error: "Internal server error during decryption",
            success: false
        });
    }
}

/**
 * Middleware to intercept response.json and encrypt the outgoing body.
 */
async function enceryptMiddleware(req, res, next) {
    try {
        const publicKey = req.publicKey;
        // Bind original json method to use later
        const oldJson = res.json.bind(res);

        // Override res.json to handle encryption automatically
        res.json = function (data) {
            // commonLogger.info(`Encrypt Middleware intercepted response data: ${JSON.stringify(data)}`); // Optional verbose log
            try {
                if (!publicKey) {
                    commonLogger.warn("No public key found for response encryption. Sending unencrypted response.");
                    return oldJson(data);
                }

                commonLogger.info("Encrypting response payload...");
                const encrypted = encryptForClient(data, publicKey);

                // Return encrypted payload structure
                return oldJson({
                    encrypted: true,
                    payload: encrypted,
                    success: true // injected success flag for consistency
                });
            } catch (err) {
                commonLogger.error(`Encryption error: ${err.message}`);
                return oldJson({
                    encrypted: false,
                    error: "Encryption failed",
                    success: false
                });
            }
        };
        next();

    } catch (error) {
        commonLogger.error(`Error in enceryptMiddleware setup: ${error.message}`);
        res.status(500).json({
            error: "Internal server error during encryption setup",
            success: false
        });
    }
}

/**
 * Encrypts a response object for the client using their Public Key.
 * @param {Object} responseObj - The data to encrypt.
 * @param {String} clientPublicKeyPem - The client's public RSA key.
 * @returns {Object} - The encrypted payload.
 */
function encryptForClient(responseObj, clientPublicKeyPem) {
    const json = JSON.stringify(responseObj);

    // Generate random AES key and IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    // Encrypt data with AES-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    let encrypted = cipher.update(json, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag().toString("base64");

    // Encrypt AES key using client's public RSA key
    const encryptedAesKey = crypto.publicEncrypt(
        {
            key: clientPublicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        aesKey
    ).toString("base64");

    return {
        encryptedKey: encryptedAesKey, // RSA encrypted AES key
        data: encrypted,               // AES ciphertext
        iv: iv.toString("base64"),
        tag: authTag                   // AES auth tag separate
    };
}

module.exports = {
    decryptMiddleware,
    encryptForClient,
    enceryptMiddleware
};
