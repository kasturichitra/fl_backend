const { employmentServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");

const basicUanActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client = ""
) => {
  const cid = client || "UN_KNOWN"
  employmentServiceLogger.info(`basicUanActiveServiceResponse called for this client: ${cid}`);

  if (index >= services.length) {
    return { success: false, message: "All services failed" };
  }

  const currentService = services[index];

  if (!currentService) {
    return basicUanActiveServiceResponse(data, services, index + 1, client);
  }

  const serviceName = currentService.providerId || "";

  console.log(`Trying service [${index + 1}]:`, serviceName);

  try {
    const res = await basicUanApiCall(data, serviceName, 0, client);

    // ✅ SUCCESS → STOP
    if (res?.data) {
      console.log(`Success from ${serviceName}`);
      return res.data;
    }

    // ❌ FAIL → NEXT
    console.log(`Failed from ${serviceName}, trying next...`);
    return basicUanActiveServiceResponse(data, services, index + 1, client);

  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return basicUanActiveServiceResponse(data, services, index + 1, client);
  }
};
const basicUanApiCall = async (data, service, CID= "") => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "337",
        uan: data,
      },
      url: process.env.TRUTHSCREEN_EMPLOYMENT_SERVICE,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
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
        password: config.header.token,
        cId: CID,
        logger: employmentServiceLogger
      });
    }
  } catch (error) {
    console.log(`[API ERROR - ${service}]`, error.message);
    return { success: false, data: null };
  }

  // ✅ FIX: normalize response safely
  const obj = ApiResponse?.data || ApiResponse;

  console.log(`[${service}] Normalized Response:`, JSON.stringify(obj));
  employmentServiceLogger.info(`service: [${service}] for this client: ${CID} Normalized Response:`, JSON.stringify(obj));

  // ❌ FAIL CASE: No data found
  if (
    obj?.status === 0 &&
    typeof obj?.msg === "string" &&
    obj.msg.toLowerCase().includes("no record")
  ) {
      employmentServiceLogger.info(`[${service}] no record for this client: ${CID}`);
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

  // ❌ FAIL CASE: invalid structure
  // ❌ Treat as HARD FAILURE → do NOT store
  if (obj?.status !== 1) {
    console.log(`[${service}] Invalid status received → fallback`);
    console.log(`[${service}] Invalid status received → fallback for this client: ${CID}`);
    return { success: false, data: null };
  }

  // ✅ SUCCESS CASE
  let returnedObj;

  if (Array.isArray(obj?.msg)) {
    returnedObj = obj.msg;
  } else if (typeof obj?.msg === "object") {
    returnedObj = [obj.msg];
  } else {
    return {
      success: false,
      data: {
        result: "InvalidFormat",
        message: "Unexpected msg format",
        responseOfService: obj,
        service,
      },
    };
  }

  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service,
    },
  };
};

const dualEmploymentCheckActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("dualEmploymentCheckActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return dualEmploymentCheckActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[dualEmploymentCheckActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await dualEmploymentCheckApiCall(data, serviceName, 0, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[dualEmploymentCheckActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return dualEmploymentCheckActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[dualEmploymentCheckActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return dualEmploymentCheckActiveServiceResponse(data, services, index + 1);
  }
};
const dualEmploymentCheckApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "464",
        uan: data?.uanNumber,
        employer_name: data?.employer
      },
      url: process.env.TRUTHSCREEN_EMPLOYMENT_SERVICE,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  // If service is empty → use first service entry
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
    employmentServiceLogger.info("Empty provider → defaulting to:", service);
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
        password: config.header.token,
        cId: CID,
        logger: employmentServiceLogger
      });
      console.log(
        "[PanApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(`[GSTApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[GSTApiCall] ${service} API Response Object:`,
    JSON.stringify(obj),
  );

  let returnedObj = {};

  if (obj.response_code === "101") {
    return {
      success: false,
      data: {
        result: "NoDataFound",
        message: "Invalid",
        responseOfService: {},
        service: service,
      },
    };
  }

  switch (service) {
    case "TRUTHSCREEN":
      returnedObj = {
        gstinNumber: obj?.result?.essentials?.gstin || "",
      };
      break;
  }
  return {
    success: true,
    data: {
      gstinNumber: data || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

const form16CheckActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("form16CheckActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return form16CheckActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[form16CheckActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await form16VerifyApiCall(data, serviceName, 0, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[form16CheckActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return form16CheckActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[form16CheckActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return form16CheckActiveServiceResponse(data, services, index + 1);
  }
};
const form16VerifyApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "464",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_DUAL_EMPLOYMENT_CHECK,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  // If service is empty → use first service entry
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
    employmentServiceLogger.info("Empty provider → defaulting to:", service);
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
        password: config.header.token,
        cId: CID,
      });
      console.log(
        "[PanApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(`[GSTApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[GSTApiCall] ${service} API Response Object:`,
    JSON.stringify(obj),
  );

  let returnedObj = {};

  if (obj.response_code === "101") {
    return {
      success: false,
      data: {
        result: "NoDataFound",
        message: "Invalid",
        responseOfService: {},
        service: service,
      },
    };
  }

  switch (service) {
    case "TRUTHSCREEN":
      returnedObj = {
        gstinNumber: obj?.result?.essentials?.gstin || "",
      };
      break;
  }
  return {
    success: true,
    data: {
      gstinNumber: data || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

module.exports = {
  basicUanActiveServiceResponse,
  dualEmploymentCheckActiveServiceResponse,
  form16CheckActiveServiceResponse,
};
