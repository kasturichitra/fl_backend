const { vehicleServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");

const vehicleRcVerificationServiceResponse = async (
  data,
  services = [],
  index = 0,
) => {
  console.log("vehicleRcVerificationServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return vehicleRcVerificationServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[vehicleRcVerificationServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await rcVerificationApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[vehicleRcVerificationServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return vehicleRcVerificationServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[vehicleRcVerificationServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return vehicleRcVerificationServiceResponse(data, services, index + 1);
  }
};
const rcVerificationApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "372",
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

const stolenVehicleVerificationServiceResponse = async (
  data,
  services = [],
  index = 0,
) => {
  console.log("stolenVehicleVerificationServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return stolenVehicleVerificationServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[stolenVehicleVerificationServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await stolenVehicleVerificationApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[stolenVehicleVerificationServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return stolenVehicleVerificationServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[stolenVehicleVerificationServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return stolenVehicleVerificationServiceResponse(data, services, index + 1);
  }
};
const stolenVehicleVerificationApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "371",
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
        "[stolen vehicle verification] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[stolen vehicle verification] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[stolen vehicle verification] ${service} API Response Object:`,
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

const challanViaRcServiceResponse = async (data, services = [], index = 0) => {
  console.log("challanViaRcServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return challanViaRcServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[challanViaRcServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await challanViaRcApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[challanViaRcServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return challanViaRcServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[challanViaRcServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return challanViaRcServiceResponse(data, services, index + 1);
  }
};
const challanViaRcApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "487",
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_CHALLAN_VIA_RC_URL,
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
    `[challan via rc] ${service} API Response Object:`,
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

const drivingLicenseServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("drivingLicenseServiceResponse called");
  vehicleServiceLogger.info(
    `drivingLicenseServiceResponse called for this client: ${client}`,
  );

  if (index >= services?.length) {
    vehicleServiceLogger.info(
      `All services failed in drivingLicenseServiceResponse for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return drivingLicenseServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[drivingLicenseServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );
  vehicleServiceLogger.info(
    `[drivingLicenseServiceResponse] Trying service with priority: ${index + 1} for this client: ${client} of serviceName: ${newService}`,
  );

  try {
    const res = await drivingLicenseApiCall(data, serviceName, 0);

    vehicleServiceLogger.info(
      `response from service: ${res?.service} and it's result ${JSON.stringify(res)} for this client: ${client}`,
    );
    console.log(
      `response from service: ${res?.service} and it's result ${JSON.stringify(res)} for this client: ${client}`,
    );

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[drivingLicenseServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    vehicleServiceLogger.info(
      `[drivingLicenseServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service for this client: ${client}`,
    );
    return drivingLicenseServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[drivingLicenseServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    vehicleServiceLogger.info(
      `[drivingLicenseServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return drivingLicenseServiceResponse(data, services, index + 1);
  }
};
const drivingLicenseApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "326",
        docNumber: data?.capitalLicenseNumber,
        dob: data?.DateOfBirth,
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
        "[Driving License verification Api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[Driving License verification Api call] API Error in ${service}:`,
      error.message,
    );
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

  const obj = ApiResponse;
  console.log(
    `[Driving License verification Api call] ${service} API Response Object:`,
    JSON.stringify(obj),
  );

  let returnedObj = {};

  if (obj.status == 0 && obj?.msg?.toLowerCase() == "no record found.") {
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

const vehicleRegisterationVerificationServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("vehicleRegisterationVerificationServiceResponse called");
  vehicleServiceLogger.info(
    `vehicleRegisterationVerificationServiceResponse called for this client: ${client}`,
  );

  if (index >= services?.length) {
    vehicleServiceLogger.info(
      `All services failed in vehicleRegisterationVerificationServiceResponse for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return vehicleRegisterationVerificationServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[vehicleRegisterationVerificationServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );
  vehicleServiceLogger.info(
    `[vehicleRegisterationVerificationServiceResponse] Trying service with priority: ${index + 1} for this client: ${client} of serviceName: ${newService}`,
  );

  try {
    const res = await vehicleRegisterationApiCall(data, serviceName, client);

    vehicleServiceLogger.info(
      `response from service: ${res?.service} and it's result ${JSON.stringify(res)} for this client: ${client}`,
    );
    console.log(
      `response from service: ${res?.service} and it's result ${JSON.stringify(res)} for this client: ${client}`,
    );

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[vehicleRegisterationVerificationServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    vehicleServiceLogger.info(
      `[vehicleRegisterationVerificationServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service for this client: ${client}`,
    );
    return vehicleRegisterationVerificationServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[vehicleRegisterationVerificationServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    vehicleServiceLogger.info(
      `[vehicleRegisterationVerificationServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return drivingLicenseServiceResponse(data, services, index + 1);
  }
};
const vehicleRegisterationApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "19",
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
        cId: CID
      });
      console.log(
        "[Driving License verification Api call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log(
      `[Driving License verification Api call] API Error in ${service}:`,
      error.message,
    );
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

  const obj = ApiResponse;
  console.log(
    `[Driving License verification Api call] ${service} API Response Object:`,
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

module.exports = {
  vehicleRcVerificationServiceResponse,
  stolenVehicleVerificationServiceResponse,
  challanViaRcServiceResponse,
  drivingLicenseServiceResponse,
  vehicleRegisterationVerificationServiceResponse
};
