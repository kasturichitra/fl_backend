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
  client="",
) => {
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[CinActiveServiceResponse] Trying service with activeService: ${ActiveSerice} priority ${index + 1}:`,
    newService,
  );

  try {
    // const res = await CinApiCall(data, serviceName);

    let res;
    switch (ActiveSerice) {
      case "CinApiCall":
        res = await CinApiCall(data, serviceName, client="");
        break;
      case "CompanyListApiCall":
        res = await CinCompanyApiCall(data, serviceName, client="");
        break;
      case "CompanySearchApiCall":
        res = await CompanySearchApiCall(data, serviceName, client="");
        break;
    }

    if (res?.success) {
      if (
        typeof res.data === "object" &&
        res.data !== null &&
        !Array.isArray(res.data)
      ) {
        return { ...res.data, success: true };
      }
      return res.data;
    }

    console.log(
      `[CinActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service of index: ${index}`,
    );
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1);
  } catch (err) {
    console.log(
      `[CinActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return CinActiveServiceResponse(data, services, ActiveSerice, index + 1);
  }
};

// ActiveService
const CinApiCall = async (data, service, CID="") => {
  console.log("[CompanySearchApiCall] Triggered with data:", data);
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 15, // company docType
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_ID_SEARCH_URL,
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
    `[CIN Api Call] ${service} Response Object:`,
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

const CinCompanyApiCall = async (data, service, CID) => {
  console.log("[CinCompanyApiCall] Triggered with data:", data);
  const tskId = generateTransactionId(12);

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
                cId: CID,
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

const CompanySearchApiCall = async (data, service) => {
  console.log("[CompanySearchApiCall] Triggered with data:", data);
  const tskId = generateTransactionId(12);

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
                cId: CID,
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
    `[CompanySearchApiCall] activeService: ${service} for this client: ${CID} Response Object:`,
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
