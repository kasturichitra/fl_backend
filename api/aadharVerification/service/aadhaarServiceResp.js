const { aadhaarServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const AadhaarActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  const fn = "AadhaarActiveServiceResponse";
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    aadhaarServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return AadhaarActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`[${fn}] Trying service with priority ${index + 1}:`, newService);

  try {
    const res = await AadhaarApiCall(data, serviceName, client);
    aadhaarServiceLogger.info(`[${fn}] Response:`, JSON.stringify(res));
    if (res.code === 200) {
      return res;
    }
    aadhaarServiceLogger.info(
      `[${fn}] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return AadhaarActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    aadhaarServiceLogger.info(
      `[${fn}] Error from ${serviceName}:`,
      err.message,
    );
    return AadhaarActiveServiceResponse(data, services, index + 1);
  }
};

// =======================================
//         Aadhaar API CALL (ALL SERVICES)
// =======================================

const AadhaarApiCall = async (data, service, CID) => {
  const tskId = await generateTransactionId(12);
  const ApiData = {
    INVINCIBLE: {
      BodyData: {
        aadhaarNumber: data
      },
      url: process.env.INVINCIBLE_AADHAAR_TO_MASKED_PAN,
      header: {
        "Content-Type": "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "572",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_AADHAAR_TO_MASKED_PAN,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  // Empty provider fallback
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
  }

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (service === "TRUTHSCREEN") {
      ApiResponse = await callTruthScreenAPI({
        url: config.url,
        payload: config.BodyData,
        username: config.header.username,
        password: config.header.password,
        cId: CID,
        logger: aadhaarServiceLogger
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
console.error("asdfghj", error.response?.data || error.message || error);    aadhaarServiceLogger.info(
      `[Aadhaar to masked pan ApiCall] API Error in ${service}:`,
      error.message,
    );
    if (service?.toLowerCase() == "invincible" && error.status == 404) {
      return {
        success: false,
        data: {
          result: "No Data Found",
          message: "Invalid",
          responseOfService: error || {},
          service,
        },
      };
    } else {
      throw error;
    }
  }

  const obj = ApiResponse?.data || ApiResponse;
  aadhaarServiceLogger.info(
    `[Aadhaar to masked pan ApiCall] ${service} Response Object:`,
    JSON.stringify(obj),
  );
  switch (service) {
    case "INVINCIBLE":
      if (!obj?.result?.is_verified) return {success: false, data: null};
      return {
        success: true,
        data: {
          result: {
            cardNumber: obj?.result?.card || "",
          },
          message: "Valid",
          responseOfService: obj,
          service,
        },
      };

    case "TRUTHSCREEN":
      if (obj?.status == 0 && obj?.msg?.toLowerCase().includes("went wrong")) {
        faceServiceLogger.info(
          `[${fn}]active service: ${service} failed for this client: ${CID}`,
        );
        return {
          success: false,
          data: null,
        };
      }

      if (obj?.status !== 1) {
        return {
          success: false,
          data: null,
        };
      }
      if (obj?.status == 1) {
        return {
          success: true,
          data: {
            result: obj?.data,
            message: "Valid",
            responseOfService: obj,
            service,
          },
        };
      }
      break;
  }
};

const digilockerVerifyActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    aadhaarServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return digilockerVerifyActiveServiceResponse(
      data,
      services,
      index + 1,
      client,
    );
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[digilockerVerifyActiveServiceResponse] Trying service: ${serviceName} with priority ${index + 1}:`,
    newService,
  );
  aadhaarServiceLogger.info(
    `[digilockerVerifyActiveServiceResponse] Trying service: ${serviceName} with priority index: ${index + 1} ${newService}`,
  );

  try {
    const res = await digilockerVerifyApiCall(data, serviceName, client);
    console.log(
      "[digilockerVerifyActiveServiceResponse] Response:",
      JSON.stringify(res),
    );
    if (res?.data) {
      return res?.data;
    }
    console.log(
      `[digilockerVerifyActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return digilockerVerifyActiveServiceResponse(
      data,
      services,
      index + 1,
      client,
    );
  } catch (err) {
    console.log(
      `[digilockerVerifyActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return digilockerVerifyActiveServiceResponse(
      data,
      services,
      index + 1,
      client,
    );
  }
};

// =======================================
//         Digilocker account verify API CALL (ALL SERVICES)
// =======================================

const digilockerVerifyApiCall = async (data, service, CID = "") => {
  const tskId = generateTransactionId(12);
  const fn = "digilockerVerifyApiCall";
  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        trans_id: tskId,
        doc_type: "485",
        mobile: data,
        action: "VERIFY",
      },
      url: process.env.TRITHSCREEN_DIGILOCKER_ACCOUNT_VERIFY,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  // Empty provider fallback
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
  }

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (service === "TRUTHSCREEN") {
      ApiResponse = await callTruthScreenAPI({
        url: config.url,
        payload: config.BodyData,
        username: config.header.username,
        password: config.header.password,
        cId: CID,
        logger: aadhaarServiceLogger,
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(
      `[Digilocker verify ApiCall] API Error in ${service}:`,
      error.message,
    );
    aadhaarServiceLogger.info(
      `[Digilocker verify ApiCall] API Error in ${service}:`,
      error.message,
    );
    return { success: false };
  }

  const obj = ApiResponse;
  aadhaarServiceLogger.info(
    `[Digilocker verify ApiCall] ${service} Response Object: ${JSON.stringify(obj)}`,
  );
  switch (service) {
    case "TRUTHSCREEN":
      if (obj?.status == 0 && obj?.msg?.toLowerCase().includes("went wrong")) {
        faceServiceLogger.info(
          `[${fn}]active service: ${service} failed for this client: ${CID}`,
        );
        return {
          success: false,
          data: null,
        };
      }

      if (obj?.status !== 1) {
        return {
          success: false,
          data: null,
        };
      }
      if (obj?.status == 1) {
        return {
          success: true,
          data: {
            result: obj?.data,
            message: "Valid",
            responseOfService: obj,
            service,
          },
        };
      }
      break;
  }

  return {
    success: true,
    data: {
      result: obj,
      message: "Valid",
      responseOfService: obj,
      service,
    },
  };
};

module.exports = {
  AadhaarActiveServiceResponse,
  digilockerVerifyActiveServiceResponse,
};
