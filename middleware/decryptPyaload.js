const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load private key (PKCS#8)
const privateKeyPem = fs.readFileSync(
    path.join(__dirname, "..", "keys", "private.pem"),
    "utf8"
);

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
        console.error("Error while decrypting payload:", err);
        throw err;
    }
}

async function decryptMiddleware(req, res, next) {
    try {
        const publicKeyPem = req.body.publicKeyPem;
        if (!req.body.encryptedKey || !req.body.data || !req.body.iv) {
            return res.status(400).json({ error: "Missing encrypted payload" });
        }
        const decryptedData = decryptHybridPayload(req.body);
        req.publicKey = publicKeyPem;
        req.body = decryptedData;
        next();
    } catch (error) {
        console.error(":x:Error occured while decrypting payload:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

async function enceryptMiddleware(req, res, next) {
    try {
        console.log("req.body in enceryptMiddleware ==>>",req.publicKey);
        const publicKey = req.publicKey;
        const oldJson = res.json.bind(res);
        console.log("req.body in enceryptMiddleware ==>>", oldJson,publicKey);
        res.json = function (data) {
            console.log('Encerypt Middleware is called 1 ===>', data);
            try {
                const encrypted = encryptForClient(data, publicKey);
                console.log('Encerypt Middleware is called 2 ===>', encrypted);
                // Always send encrypted payload
                return oldJson({
                    encrypted: true,
                    payload: encrypted,
                });
            } catch (err) {
                console.error("Encryption error:", err);
                return oldJson({
                    encrypted: false,
                    error: "Encryption failed",
                });
            }
        };
        next();

    } catch (error) {
        console.error(":x:Error occured while decrypting payload:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

function encryptForClient(responseObj, clientPublicKeyPem) {
    console.log('encryptForClient is called ===>1',responseObj, clientPublicKeyPem)
    const json = JSON.stringify(responseObj);

    // AES key
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    let encrypted = cipher.update(json, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag().toString("base64");
    // Encrypt AES key using client's public RSA key
    console.log('encryptForClient is called ===>2',authTag)

    const encryptedAesKey = crypto.publicEncrypt(
        {
            key: clientPublicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        aesKey
    ).toString("base64");
    console.log('encryptedAesKey 23 ====>',encryptedAesKey)
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
