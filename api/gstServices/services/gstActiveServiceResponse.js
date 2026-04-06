const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const gstActiveServiceResponse = async (
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
    return gstActiveServiceResponse(data, services, ActiveSerice, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[gstActiveServiceResponse] Trying service with activeService: ${ActiveSerice} priority ${index + 1}:`,
    newService,
  );

  try {
    let res;
    switch (ActiveSerice) {
      case "ComprehensiveGstApiCall":
        res = await ComprehensiveGstApiCall(data, serviceName, client);
        break;
      case "GstAdvanceApiCall":
        res = await GstAdvanceApiCall(data, serviceName, client);
        break;
    }

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[gstActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service of index: ${index}`,
    );
    return gstActiveServiceResponse(data, services, ActiveSerice, index + 1);
  } catch (err) {
    console.log(
      `[gstActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return gstActiveServiceResponse(data, services, ActiveSerice, index + 1);
  }
};

// ActiveService
const ComprehensiveGstApiCall = async (data, service, CID) => {
  console.log("[CompanySearchApiCall] Triggered with data:", data);
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 375, // company docType
        docNumber: data?.gstNo,
        year: data?.year,
      },
      url: process.env.TRUTNSCREEN_ID_SEARCH_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    }
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
// ActiveService
const GstAdvanceApiCall = async (data, service, CID) => {
  console.log("[CompanySearchApiCall] Triggered with data:", data);
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 457, 
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_UAMADDHAARVERIFICATION_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        password: process.env.TRUTHSCREEN_TOKEN,
      },
    }
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
  gstActiveServiceResponse,
};
