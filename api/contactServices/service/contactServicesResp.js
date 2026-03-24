const { contactServiceLogger } = require("../../Logger/logger");
const { callTruthScreenAPI, generateTransactionId } = require("../../truthScreen/callTruthScreen");

const mobileToPanActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("mobileToPanActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return mobileToPanActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[mobileToPanActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await mobileToPanApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[mobileToPanActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return mobileToPanActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[mobileToPanActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return mobileToPanActiveServiceResponse(data, services, index + 1);
  }
};

const mobileToPanApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "64",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_UTILITY_URL,
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
    contactServiceLogger.info("Empty provider → defaulting to:", service);
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
        "[pan to gst api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(`[pan to gst api call] API Error in ${service}:`, error.message);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan to gst api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );

   let returnedObj = {};

  if (obj.status != "1") {
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
        ...(obj?.msg || ""),
      };
      break;
  }
  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj?.msg,
      service: service,
    },
  };
};

module.exports = {
 mobileToPanActiveServiceResponse
};