const { locationServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const pincodeGeofencingActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("pincodeGeofencingActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return pincodeGeofencingActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[pincodeGeofencingActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await pincodeGeofencingApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[pincodeGeofencingActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return pincodeGeofencingActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[pincodeGeofencingActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    locationServiceLogger.info(
      `[pincodeGeofencingActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return pincodeGeofencingActiveServiceResponse(data, services, index + 1);
  }
};
const pincodeGeofencingApiCall = async (data, service, CID) => {
  const tskId = await generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 554,
        pincode: data,
      },
      url: process.env.TRUTHSCREEN_PINCODE_GEOFENCING,
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
        cId: CID,
        logger: locationServiceLogger,
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(
      `[pincode geofencing ApiCall] API Error in ${service}:`,
      error.message,
    );
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(
    `[pincode geofencing ApiCall] ${service} Response Object:`,
    JSON.stringify(obj),
  );

  let returnedObj = {};

  switch (service) {
    case "TRUTHSCREEN":
      if (obj.status == 0) {
        return {
          success: false,
          data: {
            result: "NODATAFOUND",
            message: "Valid",
            responseOfService: {},
            service: service,
          },
        };
      }
      if (obj.status == 1) {
        return {
          success: true,
          data: {
            result: obj.msg,
            message: "Valid",
            responseOfService: obj,
            service: service,
          },
        };
      }
      break;
  }
  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

const longLatGeofencingActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "longLatGeofencingActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    locationServiceLogger.info(
      "index increased in longlat geofencing ====>>>",
      index,
      services?.length,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return longLatGeofencingActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service:`, newService);

  try {
    const res = await longLatGeofencingApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(`${serviceName} responded failure → trying next`);
    return longLatGeofencingActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return longLatGeofencingActiveServiceResponse(data, services, index + 1);
  }
};
const longLatGeofencingApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "553",
        longitude: data?.longitude,
        latitude: data?.latitude,
      },
      url: process.env.TRUTHSCREEN_LONG_LAT_GEOFENCING,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[PanApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status == 0) {
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
      if (obj.status == 1) {
        return {
          success: true,
          data: {
            result: obj?.msg,
            message: "Valid",
            responseOfService: obj,
            service: service,
          },
        };
      }
      break;
  }
  return {
    success: true,
    data: {
      result: obj?.msg,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

const longLatToDigiPinActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "longLatToDigiPinActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "ALL services Failed in getting response for long lat to digipin ===>",
      index,
      services?.length,
    );
    locationServiceLogger.info(
      `[FAILED] ALL services Failed in getting response for long lat to digipin with index: ${index} and length of services: ${services?.length} for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    locationServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return longLatToDigiPinActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service:`, newService);

  try {
    const res = await longLatDigiPinApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(`${serviceName} responded failure → trying next`);
    return longLatToDigiPinActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return longLatToDigiPinActiveServiceResponse(data, services, index + 1);
  }
};
const longLatDigiPinApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        trans_id: tskId,
        docType: "588",
        lng: data?.longitude,
        lat: data?.latitude,
      },
      url: process.env.TRUTHSCREEN_LONG_LAT_DIGI_PIN,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[PanApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log(`obj in longlat to digipin ==> ${obj}`);
  locationServiceLogger.info(
    `obj in longlat to digipin for this client: ${CID} ===> ${obj}`,
  );

  if (obj.status == 0) {
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
      if (obj.status == 1) {
        return {
          success: true,
          data: {
            result: obj?.msg,
            message: "Valid",
            responseOfService: obj,
            service: service,
          },
        };
      }
      break;
  }
  return {
    success: true,
    data: {
      result: obj?.msg,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

const digipinToLongLatActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "digipinToLongLatActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "ALL services Failed in getting response for long lat to digipin ===>",
      index,
      services?.length,
    );
    locationServiceLogger.info(
      `[FAILED] ALL services Failed in getting response for long lat to digipin with index: ${index} and length of services: ${services?.length} for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    locationServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return digipinToLongLatActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service: ${newService} for this client: ${client}`);
  locationServiceLogger.info(
    `Trying service: ${newService} for this client: ${client}`,
  );

  try {
    const res = await digipinToLongLatApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    locationServiceLogger.info(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    return digipinToLongLatActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return digipinToLongLatActiveServiceResponse(data, services, index + 1);
  }
};
const digipinToLongLatApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "586",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_DIGIPIN_TO_LONG_LAT,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      locationServiceLogger.info(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status != 1) {
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

const addressToDigiPinActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "addressToDigiPinActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "ALL services Failed in getting response for long lat to digipin ===>",
      index,
      services?.length,
    );
    locationServiceLogger.info(
      `[FAILED] ALL services Failed in getting response for long lat to digipin with index: ${index} and length of services: ${services?.length} for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    locationServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return addressToDigiPinActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service: ${newService} for this client: ${client}`);
  locationServiceLogger.info(
    `Trying service: ${newService} for this client: ${client}`,
  );

  try {
    const res = await addressToDigiPinApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    locationServiceLogger.info(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    return addressToDigiPinActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return addressToDigiPinActiveServiceResponse(data, services, index + 1);
  }
};
const addressToDigiPinApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "586",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_DIGIPIN_TO_LONG_LAT,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      locationServiceLogger.info(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status != 1) {
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

const geoTaggingActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "geoTaggingActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "ALL services Failed in getting response for long lat to digipin ===>",
      index,
      services?.length,
    );
    locationServiceLogger.info(
      `[FAILED] ALL services Failed in getting response for long lat to digipin with index: ${index} and length of services: ${services?.length} for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    locationServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return geoTaggingActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service: ${newService} for this client: ${client}`);
  locationServiceLogger.info(
    `Trying service: ${newService} for this client: ${client}`,
  );

  try {
    const res = await geoTaggingApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    locationServiceLogger.info(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    return geoTaggingActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return geoTaggingActiveServiceResponse(data, services, index + 1);
  }
};
const geoTaggingApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "586",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_DIGIPIN_TO_LONG_LAT,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      locationServiceLogger.info(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status != 1) {
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

const geoTaggingDistanceCalculationActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log(
    "geoTaggingDistanceCalculationActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "ALL services Failed in getting response for long lat to digipin ===>",
      index,
      services?.length,
    );
    locationServiceLogger.info(
      `[FAILED] ALL services Failed in getting response for long lat to digipin with index: ${index} and length of services: ${services?.length} for this client: ${client}`,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    locationServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return geoTaggingDistanceCalculationActiveServiceResponse(
      data,
      services,
      index + 1,
    );
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service: ${newService} for this client: ${client}`);
  locationServiceLogger.info(
    `Trying service: ${newService} for this client: ${client}`,
  );

  try {
    const res = await geoTaggingDistanceCalculationApiCall(
      data,
      serviceName,
      client,
    );

    if (res?.data) {
      return res.data;
    }

    console.log(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    locationServiceLogger.info(
      `${serviceName} responded failure → trying next for this client: ${client}`,
    );
    return geoTaggingDistanceCalculationActiveServiceResponse(
      data,
      services,
      index + 1,
    );
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return geoTaggingDistanceCalculationActiveServiceResponse(
      data,
      services,
      index + 1,
    );
  }
};
const geoTaggingDistanceCalculationApiCall = async (data, service, CID) => {
  const tskId = generateTransactionId(12);

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: "586",
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_DIGIPIN_TO_LONG_LAT,
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
        cId: CID,
        logger: locationServiceLogger,
      });
      console.log(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
      locationServiceLogger.info(
        "[digipin to long lat] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status != 1) {
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
  pincodeGeofencingActiveServiceResponse,
  longLatGeofencingActiveServiceResponse,
  longLatToDigiPinActiveServiceResponse,
  digipinToLongLatActiveServiceResponse,
  addressToDigiPinActiveServiceResponse,
  geoTaggingActiveServiceResponse,
  geoTaggingDistanceCalculationActiveServiceResponse,
};
