const {
  callTruthScreenAPI,
  generateTransactionId,
} = require("../truthScreen/callTruthScreen");

const voterIdVerifyServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("voterIdVerifyServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return voterIdVerifyServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[voterIdVerifyServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await voterIdApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[voterIdVerifyServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return voterIdVerifyServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[voterIdVerifyServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return voterIdVerifyServiceResponse(data, services, index + 1);
  }
};

const voterIdApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "10",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_ID_SEARCH_URL,
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

const passportVerifyServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("passportVerifyServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return passportVerifyServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[passportVerifyServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await passportApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[passportVerifyServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return passportVerifyServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[passportVerifyServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return passportVerifyServiceResponse(data, services, index + 1);
  }
};

const passportApiCall = async (data, service) => {
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
  voterIdVerifyServiceResponse,
  passportVerifyServiceResponse,
};
