const { governmentServiceLogger } = require("../../Logger/logger");
const {
  callTruthScreenAPI,
  generateTransactionId,
} = require("../../truthScreen/callTruthScreen");

const domainVerifyActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("domainVerifyActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return domainVerifyActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[domainVerifyActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await domainApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[domainVerifyActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return domainVerifyActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[domainVerifyActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return domainVerifyActiveServiceResponse(data, services, index + 1);
  }
};
const domainApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "10",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_ID_SEARCH_URL,
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
        "[voter id verification api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[voter id verification api call] API Error in ${service}:`,
      error.message,
    );
    if (error?.statusCode != 500) {
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
    return {
      success: false,
      data: null,
    };
  }

  const obj = ApiResponse;
  console.log(
    `[voter id verification api call] ${service} API Response Object:`,
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

const advanceProfileServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("advanceProfileServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return advanceProfileServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[advanceProfileServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await advanceProfileApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[advanceProfileServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return advanceProfileServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[advanceProfileServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return advanceProfileServiceResponse(data, services, index + 1);
  }
};
const advanceProfileApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "306",
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
    governmentServiceLogger.info("Empty provider → defaulting to:", service);
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
        "[passport file no api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[passport file no api call] API Error in ${service}:`,
      error.message,
    );
    if (error?.statusCode != 500) {
      return {
        success: false,
        data: {
          result: "NoDataFound",
          message: "Invalid",
          responseOfService: {},
          service: service,
        },
      }; // fallback trigger
    }
    return {
      success: false,
      data: null,
    };
  }

  const obj = ApiResponse;
  console.log(
    `[passport file no api call] ${service} API Response Object:`,
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

const courtRecordCheckServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("courtRecordCheckServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return courtRecordCheckServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[courtRecordCheckServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await courtRecordCheckApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[courtRecordCheckServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return courtRecordCheckServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[courtRecordCheckServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return courtRecordCheckServiceResponse(data, services, index + 1);
  }
};
const courtRecordCheckApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "306",
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
    governmentServiceLogger.info("Empty provider → defaulting to:", service);
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
        "[passport file no api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[passport file no api call] API Error in ${service}:`,
      error.message,
    );
    if (error?.statusCode != 500) {
      return {
        success: false,
        data: {
          result: "NoDataFound",
          message: "Invalid",
          responseOfService: {},
          service: service,
        },
      }; // fallback trigger
    }
    return {
      success: false,
      data: null,
    };
  }

  const obj = ApiResponse;
  console.log(
    `[passport file no api call] ${service} API Response Object:`,
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
  domainVerifyActiveServiceResponse,
  advanceProfileServiceResponse,
  courtRecordCheckServiceResponse
};
