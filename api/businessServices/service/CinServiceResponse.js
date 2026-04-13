const { businessServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const CinActiveServiceResponse = async (
  data,
  services,
  ActiveSerice,
  index = 0,
  TxnID = ""
) => {
  // CID removed
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    businessServiceLogger.info(
      `No service with priority ${index + 1}, trying next with data: ${data?.slice(-4)}`,
    );
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);
  }

  const serviceName = newService.providerId || "";
  businessServiceLogger.info(
    `[CinActiveServiceResponse] Trying service: ${serviceName} for verification of active api call: ${ActiveSerice} with priority: ${index + 1} with data: ${data?.slice(-4)}`,
  );

  try {
    let res;
    switch (ActiveSerice) {
      case "CinApiCall":
        businessServiceLogger.info(
          `[CinActiveServiceResponse] ${ActiveSerice} started with data: ${data?.slice(-4)}`,
        );
        res = await CinApiCall(data, serviceName, TxnID);
        break;
      case "CompanyListApiCall":
        businessServiceLogger.info(
          `[CinActiveServiceResponse] ${ActiveSerice} started with data: ${data?.slice(-4)}`,
        );
        res = await CinCompanyApiCall(data, serviceName, TxnID);
        break;
      case "CompanySearchApiCall":
        businessServiceLogger.info(
          `[CinActiveServiceResponse] ${ActiveSerice} started with data: ${data?.slice(-4)}`,
        );
        res = await CompanySearchApiCall(data, serviceName, TxnID);
        break;
    }

    businessServiceLogger.info(
      `[CinActiveServiceResponse] ${ActiveSerice} response: ${JSON.stringify(res)} with data: ${data?.slice(-4)}`,
    );

    if (res?.data) {
      return res.data;
    }

    businessServiceLogger.info(
      `[CinActiveServiceResponse] ${serviceName} with data: ${data?.slice(-4)} responded failure. Data: ${JSON.stringify(res)} → trying next service of index: ${index}`,
    );
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);
  } catch (err) {
    businessServiceLogger.info(
      `[CinActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);
  }
};

// ActiveService
const CinApiCall = async (data, service, TxnID = "") => {
  businessServiceLogger.info(
    `[CinApiCall] Triggered with data: ${data?.slice(-4)}`
  );
  const tskId = TxnID || generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 15, // company docType
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_BUSINESSVERIFICATION_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
    INVINCIBLE: {
      BodyData: {
        CIN: data,
      },
      url: process.env.INVINCIBLE_CIN_URL,
      header: {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
    },
  };

  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
    businessServiceLogger.info("Empty provider → defaulting to:", service);
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
        cId: TxnID,
        logger: businessServiceLogger
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(`[CIN Api Call] API Error in ${service}:`, error.message);
    businessServiceLogger.info(
      `[CIN Api Call] with data: ${data?.slice(-4)} API Error in ${service}:`,
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
      return { success: false, data: null };
    }
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(
    `[CIN Api Call] ${service} Response Object:`,
    JSON.stringify(obj),
  );
  businessServiceLogger.info(
    `[CIN Api Call] ${service} with data: ${data?.slice(-4)} Response Object:`,
    JSON.stringify(obj),
  );

  /** -------------------------
   *  RESULT NORMALIZATION
   * ------------------------- */

  let returnedObj = {};

  if (service === "INVINCIBLE") {
    const msg = obj?.msg;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = msg;

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service: service,
      },
    };
  }

  if (service === "TRUTHSCREEN") {
    if (
      obj?.status === 0 &&
      typeof obj?.msg === "string" &&
      obj.msg.toLowerCase().includes("no record")
    ) {
      businessServiceLogger.info(
        `[${service}] no record`,
      );
      return {
        success: false,
        data: {
          result: "NoDataFound",
          message: "NO RECORD FOUND",
          responseOfService: obj,
          service,
        },
      };
    }

    if (obj?.status !== 1) {
      console.log(
        `[${service}] Invalid status received → fallback`,
      );
      businessServiceLogger.info(
        `[${service}] Invalid status received → fallback`,
      );
      return { success: false, data: null };
    }
    const msg = obj?.msg;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = msg;

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service: service,
      },
    };
  }
  console.log(
    "[CompanySearchApiCall] Returned Object:",
    JSON.stringify(returnedObj),
  );
  return {
    success: true,
    data: {
      cinNumber: returnedObj.CIN || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service,
    },
  };
};

const CinCompanyApiCall = async (data, service, TxnID = "") => {
  console.log("[CinCompanyApiCall] Triggered with data:", data);
  const tskId = TxnID || generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 382, // CIN company docType
        name: data,
      },
      url: process.env.TRUTNSCREEN_BUSINESSVERIFICATION_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

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
        cId: TxnID,
        logger: businessServiceLogger
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(`[CinCompanyApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null };
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(
    `[CinCompanyApiCall] ${service} Response Object:`,
    JSON.stringify(obj),
  );

  // If truthscreen/others return invalid code
  if (obj?.response_code === "101") {
    return {
      success: false,
      data: {
        result: "NoDataFound",
        message: "Invalid",
        responseOfService: obj,
        service,
      },
    };
  }

  /** -------------------------
   *  RESULT NORMALIZATION
   * ------------------------- */

  let returnedObj = {};

  if (service === "TRUTHSCREEN") {
    const msg = obj?.msg;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = msg;

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service: service,
      },
    };
  }
  console.log(
    "[CinCompanyApiCall] Returned Object:",
    JSON.stringify(returnedObj),
  );
  return {
    success: true,
    data: {
      cinNumber: returnedObj.CIN || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service,
    },
  };
};

const CompanySearchApiCall = async (data, service, TxnID = "") => {
  console.log("[CompanySearchApiCall] Triggered with data:", data);
  const tskId = TxnID || generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 52, // company docType
        docName: data,
      },
      url: process.env.TRUTNSCREEN_BUSINESSVERIFICATION_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

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
        cId: TxnID,
        logger: businessServiceLogger
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(
      `[CompanySearchApiCall] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null };
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(
    `[CompanySearchApiCall] ${service} Response Object:`,
    JSON.stringify(obj),
  );
  businessServiceLogger.info(
    `[CompanySearchApiCall] activeService: ${service} Response Object:`,
    JSON.stringify(obj),
  );

  // If truthscreen/others return invalid code
  if (obj?.response_code === "101") {
    return {
      success: false,
      data: {
        result: "NoDataFound",
        message: "Invalid",
        responseOfService: obj,
        service,
      },
    };
  }

  /** -------------------------
   *  RESULT NORMALIZATION
   * ------------------------- */

  let returnedObj = {};

  if (service === "TRUTHSCREEN") {
    const msg = obj?.msg;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = msg;

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service: service,
      },
    };
  }
  console.log(
    "[CompanySearchApiCall] Returned Object:",
    JSON.stringify(returnedObj),
  );
  return {
    success: true,
    data: {
      cinNumber: returnedObj.CIN || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service,
    },
  };
};

// INVALID RESPONSE
const invalidResponse = (service, raw) => ({
  success: false,
  data: {
    result: "NoDataFound",
    message: "Invalid",
    responseOfService: raw || {},
    service,
  },
});

module.exports = {
  CinActiveServiceResponse,
};
