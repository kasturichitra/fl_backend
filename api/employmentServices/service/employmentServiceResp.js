const { employmentServiceLogger } = require("../../Logger/logger");
const { generateTransactionId } = require("../../truthScreen/callTruthScreen");

const basicUanActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("basicUanActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return basicUanActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[basicUanActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await basicUanApiCall(data, serviceName, 0, client);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[basicUanActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return basicUanActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[basicUanActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return basicUanActiveServiceResponse(data, services, index + 1);
  }
};
const basicUanApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "337",
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

  const obj = ApiResponse.data;
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

const dualEmploymentCheckActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
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

    if (res?.success) {
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
        cId: CID
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
  basicUanActiveServiceResponse, dualEmploymentCheckActiveServiceResponse
};
