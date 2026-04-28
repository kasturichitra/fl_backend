const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");
const { commonLogger } = require("../Logger/logger");

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
  const transactionId = `FLOWPIPE_${result}`;
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

  commonLogger.info(
    `encryptedText ===> ${encryptedText} ${typeof encryptedText}`,
  );

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
  commonLogger.info(`encryptedData in decreptData ${encryptedData}`);
  const url = "https://www.truthscreen.com/InstantSearch/encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  commonLogger.info(
    `response in decreptData ${JSON.stringify(decreptedresponse?.data)}`,
  );

  return decreptedresponse;
}

async function callTruthScreen({ url, payload, username, password }) {
  commonLogger.info(
    `payload in truth screen ====>>> ${JSON.stringify(payload)} ${url}`,
  );
  try {
    const encryptedData = await encryptingData(payload, username);

    commonLogger.info(
      `encryptedData in truth screen ====>>> ${JSON.stringify(encryptedData?.data)}`,
    );

    const response = await axios.post(
      url,
      { requestData: encryptedData?.data },
      {
        headers: {
          "Content-Type": "application/json",
          username,
        },
      },
    );

    commonLogger.info(`HTTP Status: ${response?.status}`);
    commonLogger.info(
      `response in shop establishment truth screen ====>>> ${JSON.stringify(response?.data)}`,
    );

    const encryptedResponseData = response?.data;

    commonLogger.info(
      `encryptedResponseData ====>>> ${JSON.stringify(encryptedResponseData)}`,
    );

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    commonLogger.info(
      `decrypted in truth screen ====>>> ${JSON.stringify(decrypted?.data)}`,
    );

    return decrypted;
  } catch (error) {
    commonLogger.error(`error in truth screen: ${error.message}`);
    // return { status: 0, message: error };
    // Re-throwing or returning error structure depends on usage, but keeping original return for now to minimize breakage logic changes,
    // though the original code catches and returns object, then proceeds to do other checks?
    // actually original code had unreachable code after return. Fixing that.

    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        commonLogger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        commonLogger.error(
          `Decryption failed for error response: ${decryptionErr.message}`,
        );
      }
    }

    commonLogger.error(`TruthScreen API Error: ${error.message}`);
    return { status: 0, message: error };
  }
}

// Truth Screen actual api call happen hear
async function callTruthScreenAPI({
  url,
  payload,
  username,
  password,
  cId = "",
  logger = "",
}) {
  // displaying password in logs is bad practice, removing it.
  logger.info(
    `Details for the request with client: ${cId} url: ${url} payload: ${JSON.stringify(payload)} username: ${username} ===>>`,
  );
  try {
    const encryptedData = encrypt(JSON.stringify(payload), password);

    logger.info(
      `encrypted Data successfully in truth screen for this client: ${cId} ====>>>`,
    );

    const response = await axios.post(
      url,
      { requestData: encryptedData },
      {
        headers: {
          "Content-Type": "application/json",
          username: username,
          password: password,
        },
      },
    );

    logger.info(`HTTP Status: ${response?.status}`);
    logger.info(
      `response in truth screen ====>>> ${JSON.stringify(response?.data)}`,
    );

    const encryptedResponseData =
      response?.data?.responseData || response?.data;
    logger.info(
      `encryptedResponseData ====>>> ${JSON.stringify(encryptedResponseData)}`,
    );

    if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = decrypt(encryptedResponseData, password);
    logger.info(`decrypted in truth screen ====>>> ${decrypted}`);

    return JSON.parse(decrypted);
  } catch (error) {
    // console.log("error in truthscreen error?.message===>>", error);
    // console.log("error in truthscreen error?.message===>>", error?.message);
    // console.log(
    //   "error in truthscreen error?.response?.data===>>",
    //   error?.response?.data,
    // );
    logger.error(
      `TruthScreen API Error: ${JSON.stringify(error?.response?.data)} ${JSON.stringify(error.message)}`,
    );
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        logger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        logger.error(
          `Decryption failed for error response: ${decryptionErr.message}`,
        );
      }
    }
    throw new Error(
      `TruthScreen request failed: ${error?.response?.data || error.message}`,
    );
  }
}

async function callTruthScreenAPIForImage({
  url,
  payload,
  file,
  username,
  password,
  cId = "",
  logger = "",
}) {
  // displaying password in logs is bad practice, removing it.
  commonLogger.info(
    `Details for the request with client: ${cId} url: ${url} payload: ${JSON.stringify(payload)} username: ${username} ===>>`,
  );
  const form = new FormData();
  try {
    const encryptedData = encrypt(JSON.stringify(payload), password);

    commonLogger.info(
      `encryptedData: ${encryptedData} in truthscreen for this client: ${cId}`,
    );

    if (payload.docType == 93) {
      form.append("docType", payload.docType);
      form.append("transID", payload.transID);
      // file stays raw (usually required)
      form.append("file", file.buffer, {
        filename: file.originalname,
      });
    } else {
      form.append("doc_type", payload.docType);
      form.append("trans_id", payload.transID);
      // file stays raw (usually required)
      form.append("img", file.buffer, {
        filename: file.originalname,
      });
    }

    commonLogger.info(
      `encrypted Data successfully in truth screen for this client: ${cId} ====>>>`,
    );

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        username: username,
        password: password,
      },
    });

    commonLogger.info(`HTTP Status: ${response?.status}`);
    commonLogger.info(
      `response in truth screen ====>>> ${JSON.stringify(response?.data)} for this client ${cId}`,
    );

    const encryptedResponseData =
      response?.data?.responseData || response?.data;
    commonLogger.info(
      `encryptedResponseData ====>>> ${JSON.stringify(encryptedResponseData)}`,
    );

    if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = decrypt(encryptedResponseData, password);
    commonLogger.info(`decrypted in truth screen ====>>> ${decrypted}`);

    return JSON.parse(decrypted);
  } catch (error) {
    console.log("error in truthscreen error?.message===>>", error?.message);
    console.log(
      "error in truthscreen error?.response?.data===>>",
      error?.response?.data,
    );
    commonLogger.error(
      `TruthScreen API Error: ${JSON.stringify(error?.response?.data)} ${JSON.stringify(error.message)}`,
    );
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        commonLogger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        commonLogger.error(
          `Decryption failed for error response: ${decryptionErr.message}`,
        );
      }
    }
    throw new Error(
      `TruthScreen request failed: ${JSON.stringify(error?.response?.data || error.message)}`,
    );
  }
}

async function callTruthScreenAPIForFaceMatch({
  url,
  payload,
  image,
  document,
  username,
  password,
  cId = "cid4587798",
  logger = "",
}) {
  commonLogger.info(
    `Details for the request with client: ${cId} url: ${url} payload: ${JSON.stringify(payload)} username: ${username} ===>>`,
  );

  const form = new FormData();
   const encryptedPayload = await encryptData(payload?.secretToken, username);

  try {
    // ✅ Validate FIRST
    if (!image) throw new Error("Image is missing from request");
    if (!document) throw new Error("Document is missing from request");

    const encryptedData = encrypt(JSON.stringify(payload), password);

    commonLogger.info(
      `encryptedData: ${JSON.stringify(payload)} in truthscreen for this client: ${cId}`,
    );

    // ✅ Match CURL EXACTLY
    form.append("tsTransID", payload.transID);
    form.append("secretToken", encryptedPayload);

    form.append("image", image.buffer, {
      filename: image.originalname,
      contentType: image.mimetype,
    });

    form.append("document", document.buffer, {
      filename: document.originalname,
      contentType: document.mimetype,
    });

    commonLogger.info(
      `FormData prepared successfully for client: ${cId} ====>>>`,
    );

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        username,
        password,
      },
    });

    commonLogger.info(`HTTP Status: ${response?.status}`);
    commonLogger.info(
      `response in truth screen ====>>> ${JSON.stringify(response?.data)} for this client ${cId}`,
    );

    const encryptedResponseData =
      response?.data?.responseData || response?.data;

    if (!encryptedResponseData || typeof encryptedResponseData !== "string") {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = decrypt(encryptedResponseData, password);
    commonLogger.info(`decrypted in truth screen ====>>> ${decrypted}`);

    return JSON.parse(decrypted);
  } catch (error) {
    console.log("error in truthscreen error?.message===>>", error?.message);
    console.log(
      "error in truthscreen error?.response?.data===>>",
      error?.response?.data,
    );

    commonLogger.error(
      `TruthScreen API Error: ${JSON.stringify(error?.response?.data)} ${JSON.stringify(error.message)}`,
    );

    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        commonLogger.error(`decrypted in error: ${decrypted}`);
      } catch (decryptionErr) {
        commonLogger.error(
          `Decryption failed for error response: ${decryptionErr.message}`,
        );
      }
    }

    throw new Error(
      `TruthScreen request failed: ${JSON.stringify(error?.response?.data || error.message)}`,
    );
  }
}

async function decreptData(encryptedData, username) {
  commonLogger.info(`encryptedData in decreptData ${encryptedData}`);
  const url =
    "https://www.truthscreen.com/InstantSearch/decrypt_encrypted_string";
  const payload = encryptedData;

  const headers = {
    "Content-Type": "application/json",
    username,
  };

  const decreptedresponse = await axios.post(url, payload, { headers });

  commonLogger.info(
    `response in decreptData ${JSON.stringify(decreptedresponse?.data)}`,
  );

  return decreptedresponse;
}

async function encryptData(encrypt, username) {
  commonLogger.info(`encryptedData in decreptData ${encrypt}`);
  const url = "https://www.truthscreen.com/api/v2.2/faceapi/tokenEncrypt";

  const form = new FormData();

  form.append("token", encrypt);

  const decreptedresponse = await axios.post(url, form, {
    headers: {
      username: username,
      ...form.getHeaders(),
    },
  });

  commonLogger.info(
    `response in decreptData ${JSON.stringify(decreptedresponse?.data)}`,
  );

  return decreptedresponse?.data;
}

async function callTruth({ url, payload, username, password }) {
  try {
    commonLogger.info(
      `payload in face verification ====>>> ${JSON.stringify(payload)}`,
    );

    const form = new FormData();
    form.append("docType", payload.docType);
    form.append("transID", payload.transID);

    const response = await axios.post(url, form, {
      headers: {
        username: username,
        ...form.getHeaders(),
      },
    });

    commonLogger.info(
      `response in first step of face verification ${JSON.stringify(response?.data)}`,
    );

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);

    return decrypted?.data;
  } catch (error) {
    commonLogger.error(`TruthScreen API Error: ${error.message}`);
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        commonLogger.error(`Decrypted error message: ${decrypted}`);
      } catch (decryptionErr) {
        commonLogger.error(`Decryption failed: ${decryptionErr.message}`);
      }
    }
    throw new Error(
      `TruthScreen request failed: ${
        error?.response?.data?.msg || error.message
      }`,
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
  commonLogger.info(
    `performFaceVerificationEncrypted called for tsTransID: ${tsTransID}`,
  );

  const encryptedPayload = await encryptData(secretToken, username);

  commonLogger.info(`encryptedPayload in face -------->>> ${encryptedPayload}`);

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
  commonLogger.info("calling face match verification");

  try {
    const response = await axios.post(
      "https://www.truthscreen.com/api/v2.2/faceapi/verify",
      form,
      {
        headers: {
          username: username,
          ...form.getHeaders(),
        },
      },
    );

    commonLogger.info(
      `Response in performFaceVerificationEncrypted: ${JSON.stringify(response.data)}`,
    );

    const encryptedResponseData = response?.data;

    if (!encryptedResponseData) {
      throw new Error(
        "Invalid or missing encrypted responseData from TruthScreen",
      );
    }

    const decrypted = await decreptData(encryptedResponseData, username);
    commonLogger.info(
      `decrypted message in performFaceVerificationEncrypted===> ${JSON.stringify(decrypted)}`,
    );
    return decrypted;
  } catch (error) {
    commonLogger.error(
      `Face Verification API error: ${JSON.stringify(error?.response?.data)}`,
    );
    if (error?.response?.data?.responseData) {
      try {
        const decrypted = decrypt(error.response.data.responseData, password);
        commonLogger.error(`Decrypted error message: ${decrypted}`);
      } catch (decryptionErr) {
        commonLogger.error(`Decryption failed: ${decryptionErr.message}`);
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
  callTruthScreenAPIForImage,
  generateTransactionId,
  callTruthScreenAPIForFaceMatch,
};
