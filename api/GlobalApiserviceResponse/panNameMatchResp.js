const { generateTransactionId } = require("../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const PANNameMatchActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
) => {
  console.log("PANNameMatchActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANNameMatchActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANNameMatchActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await panNameApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[PANtoGSTActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANtoGSTActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANtoGSTActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANtoGSTActiveServiceResponse(data, services, index + 1);
  }
};

const panNameApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "357",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_NAMEMATCH_URL,
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

module.exports = {
  PANNameMatchActiveServiceResponse,
};
