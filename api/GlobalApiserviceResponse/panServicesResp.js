const { panServiceLogger } = require("../Logger/logger");
const {
  callTruthScreenAPI,
  generateTransactionId,
} = require("../truthScreen/callTruthScreen");

const PANDobActiveServiceResponse = async (data, services = [], index = 0, client) => {
  console.log("PANDobActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANDobActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANDobActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await panDobApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[PANDobActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANDobActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANDobActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANDobActiveServiceResponse(data, services, index + 1);
  }
};

const panDobApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "359",
        panNumber: data?.panNumber,
        fullName: data?.nameToMatch,
        dob: data?.dateOfBirth
      },
      url: process.env.TRUTNSCREEN_PAN_DOB_URL,
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

  const obj = ApiResponse;
  console.log(
    `[GSTApiCall] ${service} API Response Object:`,
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

const PANNameMatchActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
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

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PANNameMatchActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANNameMatchActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANNameMatchActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANNameMatchActiveServiceResponse(data, services, index + 1);
  }
};

const panNameApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "357",
        panNumber: data?.panNumber,
        Name: data?.nameToMatch,
      },
      url: process.env.TRUTNSCREEN_PAN_NAMEMATCH_URL,
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
        "[pan name match api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan name match api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan name match api call] ${service} API Response Object:`,
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

const PANtoGSTActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("PANtoGSTActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANtoGSTActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANtoGSTActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await PanToGstApiCall(data, serviceName, 0);

    if (res?.data) {
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

const PanToGstApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        trans_id: tskId,
        doc_type: "455",
        doc_number: data,
      },
      url: process.env.TRUTHSCREEN_PAN_TO_GST,
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
        "[pan to gst api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan to gst api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan to gst api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );

  let returnedObj = {};

  if (obj.status != "1" || obj.msg == "No record found") {
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

const PANDirectorActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("PANDirectorActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANDirectorActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANDirectorActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await PanDirectorApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PANDirectorActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANDirectorActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANDirectorActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANDirectorActiveServiceResponse(data, services, index + 1);
  }
};

const PanDirectorApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "26",
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
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      panServiceLogger.info(
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan director api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan director api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );
  panServiceLogger.info(
    `[pan director api call] ${service} API Response Object:`,
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
const PANToFatherNameActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("PANToFatherNameActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANToFatherNameActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANToFatherNameActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await PanToFatherNameApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PANToFatherNameActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANToFatherNameActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANToFatherNameActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANToFatherNameActiveServiceResponse(data, services, index + 1);
  }
};

const PanToFatherNameApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "522",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_PAN_TO_FATHER_NAME_URL,
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
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      panServiceLogger.info(
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan director api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan director api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );
  panServiceLogger.info(
    `[pan director api call] ${service} API Response Object:`,
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

const PANItdStatusOtpGenerateActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("PANItdStatusOtpGenerateActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANItdStatusOtpGenerateActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANItdStatusOtpGenerateActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await PanItdStatusOtpGenerateApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PANItdStatusOtpGenerateActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANItdStatusOtpGenerateActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANItdStatusOtpGenerateActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANItdStatusOtpGenerateActiveServiceResponse(data, services, index + 1);
  }
};

const PanItdStatusOtpGenerateApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "349",
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
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      panServiceLogger.info(
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan director api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan director api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );
  panServiceLogger.info(
    `[pan director api call] ${service} API Response Object:`,
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

const PANItdStatusOtpValidateActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log("PANItdStatusOtpValidateActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return PANItdStatusOtpValidateActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[PANItdStatusOtpValidateActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await PanItdStatusOtpValidateApiCall(data, serviceName, 0);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PANItdStatusOtpValidateActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PANItdStatusOtpValidateActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PANItdStatusOtpValidateActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return PANItdStatusOtpValidateActiveServiceResponse(data, services, index + 1);
  }
};

const PanItdStatusOtpValidateApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "349",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_PAN_ITD_STATUS_URL,
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
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      panServiceLogger.info(
        "[pan director api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[pan director api call] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pan director api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );
  panServiceLogger.info(
    `[pan director api call] ${service} API Response Object:`,
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
  PANDobActiveServiceResponse,
  PANNameMatchActiveServiceResponse,
  PANtoGSTActiveServiceResponse,
  PANDirectorActiveServiceResponse,
  PANToFatherNameActiveServiceResponse,
  PANItdStatusOtpGenerateActiveServiceResponse,
  PANItdStatusOtpValidateActiveServiceResponse
};
