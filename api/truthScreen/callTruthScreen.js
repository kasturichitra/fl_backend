const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");
const { kycLogger } = require("../Logger/logger");

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

  kycLogger.debug(`encryptedText ===> ${encryptedText} ${typeof encryptedText}`);

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

async function encryptingData(encryptedData, username) {
  kycLogger.debug(`encryptedData in decreptData ${encryptedData}`);
  const url = "https://www.truthscreen.com/InstantSearch/encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  kycLogger.debug(`response in decreptData ${JSON.stringify(decreptedresponse?.data)}`);

  return decreptedresponse;
}

async function callTruthScreen({ url, payload, username, password }) {
  kycLogger.info(`payload in truth screen ====>>> ${JSON.stringify(payload)} ${url}`);
  try {
    const encryptedData = await encryptingData(payload, username);

    kycLogger.debug(`encryptedData in truth screen ====>>> ${JSON.stringify(encryptedData?.data)}`);

    const response = await axios.post(
      url,
      { requestData: encryptedData?.data },
      {
        headers: {
          "Content-Type": "application/json",
          username,
        },
      }
    );

    kycLogger.info(`HTTP Status: ${response?.status}`);
    kycLogger.debug(`response in shop establishment truth screen ====>>> ${JSON.stringify(response?.data)}`);

    const encryptedResponseData = response?.data;

    kycLogger.debug(`encryptedResponseData ====>>> ${JSON.stringify(encryptedResponseData)}`);

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    kycLogger.info(`decrypted in truth screen ====>>> ${JSON.stringify(decrypted?.data)}`);

    return decrypted;
  } catch (error) {
    kycLogger.error(`error in truth screen: ${error.message}`);
    // return { status: 0, message: error }; 
    // Re-throwing or returning error structure depends on usage, but keeping original return for now to minimize breakage logic changes, 
    // though the original code catches and returns object, then proceeds to do other checks? 
    // actually original code had unreachable code after return. Fixing that.

    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        kycLogger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        kycLogger.error(
          `Decryption failed for error response: ${decryptionErr.message}`
        );
      }
    }

    kycLogger.error(`TruthScreen API Error: ${error.message}`);
    return { status: 0, message: error };
  }
}

async function callTruthScreenAPI({ url, payload, username, password }) {
  // displaying password in logs is bad practice, removing it.
  kycLogger.info(`url payload username ===>> ${url} ${JSON.stringify(payload)} ${username}`);
  try {
    const encryptedData = encrypt(JSON.stringify(payload), password);

    kycLogger.debug(`encryptedData in truth screen ====>>> ${encryptedData} ${url}`);

    const response = await axios.post(
      url,
      { requestData: encryptedData },
      {
        headers: {
          "Content-Type": "application/json",
          username: username,
          password: password,
        },
      }
    );

    kycLogger.info(`HTTP Status: ${response?.status}`);
    kycLogger.debug(`response in truth screen ====>>> ${JSON.stringify(response?.data)}`);

    const encryptedResponseData =
      response?.data?.responseData || response?.data;
    kycLogger.debug(`encryptedResponseData ====>>> ${JSON.stringify(encryptedResponseData)}`);

    if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = decrypt(encryptedResponseData, password);
    kycLogger.info(`decrypted in truth screen ====>>> ${decrypted}`);

    return JSON.parse(decrypted);
  } catch (error) {
    kycLogger.error(`TruthScreen API Error: ${error?.response?.data || error.message}`);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        kycLogger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        kycLogger.error(
          `Decryption failed for error response: ${decryptionErr.message}`
        );
      }
    }
    throw new Error(
      `TruthScreen request failed: ${error?.response?.data?.error || error.message
      }`
    );
  }
}

async function decreptData(encryptedData, username) {
  kycLogger.debug(`encryptedData in decreptData ${encryptedData}`);
  const url =
    "https://www.truthscreen.com/InstantSearch/decrypt_encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  kycLogger.debug(`response in decreptData ${JSON.stringify(decreptedresponse?.data)}`);

  return decreptedresponse;
}

async function encryptData(encrypt, username) {
  kycLogger.debug(`encryptedData in decreptData ${encrypt}`);
  const url = "https://www.truthscreen.com/api/v2.2/faceapi/tokenEncrypt";

  const form = new FormData();

  form.append("token", encrypt);

  const decreptedresponse = await axios.post(url, form, {
    headers: {
      username: username,
      ...form.getHeaders(),
    },
  });

  kycLogger.debug(`response in decreptData ${JSON.stringify(decreptedresponse?.data)}`);

  return decreptedresponse?.data;
}

async function callTruth({ url, payload, username, password }) {
  try {
    kycLogger.info(`payload in face verification ====>>> ${JSON.stringify(payload)}`);

    const form = new FormData();
    form.append("docType", payload.docType);
    form.append("transID", payload.transID);

    const response = await axios.post(url, form, {
      headers: {
        username: username,
        ...form.getHeaders(),
      },
    });

    kycLogger.debug(`response in first step of face verification ${JSON.stringify(response?.data)}`);

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);

    return decrypted?.data;
  } catch (error) {
    kycLogger.error(`TruthScreen API Error: ${error.message}`);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        kycLogger.error(`Decrypted error message: ${decrypted}`);
      } catch (decryptionErr) {
        kycLogger.error(`Decryption failed: ${decryptionErr.message}`);
      }
    }
    throw new Error(
      `TruthScreen request failed: ${error?.response?.data?.msg || error.message
      }`
    );
  }
}

async function performFaceVerificationEncrypted({
  tsTransID,
  secretToken,
  imageBase64,
  documentBase64,
  username,
  password,
}) {
  // Hidden sensitive data logging
  kycLogger.info(
    `performFaceVerificationEncrypted called for tsTransID: ${tsTransID}`
  );

  const encryptedPayload = await encryptData(secretToken, username);

  kycLogger.debug(`encryptedPayload in face -------->>> ${encryptedPayload}`);

  const form = new FormData();
  form.append("tsTransID", tsTransID);
  form.append("secretToken", encryptedPayload);

  const imageBuffer = Buffer.from(imageBase64, "base64");
  form.append("image", imageBuffer, {
    filename: "image.jpg",
    contentType: "image/jpeg",
  });

  const documentBuffer = Buffer.from(documentBase64, "base64");
  form.append("document", documentBuffer, {
    filename: "document.jpg",
    contentType: "image/jpeg",
  });
  kycLogger.info("calling face match verification");

  try {
    const response = await axios.post(
      "https://www.truthscreen.com/api/v2.2/faceapi/verify",
      form,
      {
        headers: {
          username: username,
          ...form.getHeaders(),
        },
      }
    );

    kycLogger.debug(`Response in performFaceVerificationEncrypted: ${JSON.stringify(response.data)}`);

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    kycLogger.info(
      `decrypted message in performFaceVerificationEncrypted===> ${JSON.stringify(decrypted)}`
    );
    return decrypted;
  } catch (error) {
    kycLogger.error(`Face Verification API error: ${JSON.stringify(error?.response?.data)}`);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        kycLogger.error(`Decrypted error message: ${decrypted}`);
      } catch (decryptionErr) {
        kycLogger.error(`Decryption failed: ${decryptionErr.message}`);
      }
    }
    return { message: "Face Verification Failed" };
  }
}

module.exports = {
  callTruthScreenAPI,
  callTruth,
  performFaceVerificationEncrypted,
  callTruthScreen,
  generateTransactionId
};
