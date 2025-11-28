const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");
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

  console.log("encryptedText ===>", encryptedText, typeof encryptedText);

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
  console.log("encryptedData in decreptData", encryptedData);
  const url = "https://www.truthscreen.com/InstantSearch/encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  console.log("response in decreptData", decreptedresponse);

  return decreptedresponse;
}

async function callTruthScreen({ url, payload, username, password }) {
  console.log("payload in truth screen ====>>>", payload, url);
  try {
    const encryptedData = await encryptingData(payload, username);

    console.log(
      "encryptedData in truth screen ====>>>",
      encryptedData,
      typeof encryptedData
    );
    console.log(
      "data in truth screen ====>>>",
      encryptedData?.data,
      typeof encryptedData?.data
    );

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

    console.log("HTTP Status:", response?.status);

    console.log(
      "response in shop establishment truth screen ====>>>",
      response
    );
    console.log(
      "response in shop establishment truth screen ====>>>",
      response?.data
    );
    const encryptedResponseData = response?.data;

    console.log("encryptedResponseData ====>>>", encryptedResponseData);

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    console.log("decrypted in truth screen ====>>>", decrypted);

    return decrypted;
  } catch (error) {
    console.log("error in truth screen", error);
    return { status: 0, message: error };
    // console.log("error response in truth screen", error?.response);
    // console.log(
    //   "error response in truth screen error?.response?.data",
    //   error?.response?.data
    // );
    // console.error(
    //   "TruthScreen API Error:",
    //   error?.response?.data || error.response?.message
    // );
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        console.log("decrypted in error", decrypted);
      } catch (decryptionErr) {
        console.error(
          "Decryption failed for error response:",
          decryptionErr.message
        );
      }
    }

    console.error("TruthScreen API Error:", error.message);
    throw new Error(
      `TruthScreen request failed: ${error?.response?.data?.error || error.message
      }`
    );
  }
}

async function callTruthScreenAPI({ url, payload, username, password }) {
  console.log("url payload username password ===>>", url, JSON.stringify(payload), username, password)
  try {
    const encryptedData = encrypt(JSON.stringify(payload), password);

    console.log(
      "encryptedData in truth screen ====>>>",
      encryptedData,
      typeof encryptedData,
      url
    );
    console.log("payload in truth screen ====>>>", payload);

    const response = await axios.post(
      url,
      { requestData: encryptedData },
      {
        headers: {
          "Content-Type": "application/json",
          username: username,
        },
      }
    );

    console.log("HTTP Status:", response?.status);
    console.log("response in truth screen ====>>>", response?.data);

    const encryptedResponseData =
      response?.data?.responseData || response?.data;
    console.log("encryptedResponseData ====>>>", encryptedResponseData);

    if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = decrypt(encryptedResponseData, password);
    console.log("decrypted in truth screen ====>>>", decrypted);

    return JSON.parse(decrypted);
  } catch (error) {
    console.log("error in truth screen", error);
    console.log("error response in truth screen", error?.response);
    console.log(
      "error response in truth screen error?.response?.data",
      error?.response?.data
    );
    console.error(
      "TruthScreen API Error:",
      error?.response?.data || error.response?.message
    );
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        console.log("decrypted in error", decrypted);
      } catch (decryptionErr) {
        console.error(
          "Decryption failed for error response:",
          decryptionErr.message
        );
      }
    }

    console.error("TruthScreen API Error:", error.message);
    throw new Error(
      `TruthScreen request failed: ${error?.response?.data?.error || error.message
      }`
    );
  }
}

async function decreptData(encryptedData, username) {
  console.log("encryptedData in decreptData", encryptedData);
  const url =
    "https://www.truthscreen.com/InstantSearch/decrypt_encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  console.log("response in decreptData", decreptedresponse);

  return decreptedresponse;
}

async function encryptData(encrypt, username) {
  console.log("encryptedData in decreptData", encrypt);
  const url = "https://www.truthscreen.com/api/v2.2/faceapi/tokenEncrypt";

  const form = new FormData();

  form.append("token", encrypt);

  const decreptedresponse = await axios.post(url, form, {
    headers: {
      username: username,
      ...form.getHeaders(),
    },
  });

  console.log("response in decreptData", decreptedresponse);

  return decreptedresponse?.data;
}

async function callTruth({ url, payload, username, password }) {
  try {
    console.log("payload in face verification ====>>>", payload);
    console.log("JSON payload before encryption =>", JSON.stringify(payload));

    const form = new FormData();
    form.append("docType", payload.docType);
    form.append("transID", payload.transID);

    const response = await axios.post(url, form, {
      headers: {
        username: username,
        ...form.getHeaders(),
      },
    });

    console.log("response in first step of face verification", response);

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);

    return decrypted?.data;
  } catch (error) {
    console.error("TruthScreen API Error:", error.message);
    console.log("error", error);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        console.log("Decrypted error message:", decrypted);
      } catch (decryptionErr) {
        console.error("Decryption failed:", decryptionErr.message);
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
  console.log(
    "password ====>>>",
    tsTransID,
    typeof tsTransID,
    typeof secretToken,
    secretToken,
    username,
    password
  );

  const encryptedPayload = await encryptData(secretToken, username);

  console.log("encryptedPayload in face -------->>>", encryptedPayload);

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
  console.log("calling face match verification");

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

    console.log("Response in performFaceVerificationEncrypted:", response.data);

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen"
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    console.log(
      "decrypted message in performFaceVerificationEncrypted===>",
      decrypted
    );
    return decrypted;
  } catch (error) {
    console.error("Face Verification API error:", error?.response?.data);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        console.log("Decrypted error message:", decrypted);
      } catch (decryptionErr) {
        console.error("Decryption failed:", decryptionErr.message);
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
