const { bankServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const IfscActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("IfscActiveServiceResponse called");
  bankServiceLogger.info(
    `IfscActiveServiceResponse called for this client: ${client}`,
  );
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return IfscActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[IfscActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await ifscApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[IfscActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return IfscActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[IfscActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return IfscActiveServiceResponse(data, services, index + 1);
  }
};

const ifscApiCall = async (data, service, CID) => {
  const tskId = await generateTransactionId(12);
  const ApiData = {
    RAPID: {
      url: process.env.RAPID_IFSC_SEARCH,
      header: {
        "x-rapidapi-key": process.env.RAPID_API_KEY,
        "x-rapidapi-host": process.env.RAPID_API_BANK_HOST,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 123,
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_IFSC_SEARCH,
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
        logger: bankServiceLogger,
      });
    } else {
      const urlWithCard = `${config.url}${data}`;
      ApiResponse = await axios.get(urlWithCard, { headers: config.header });
    }
  } catch (error) {
    console.log(`[ifscApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null }; // fallback trigger
  }

  let obj = {};
  if (service?.toLowerCase() == "rapid") {
    obj = ApiResponse?.data;
  } else {
    obj = ApiResponse;
  }
  console.log(`[ifscApiCall] ${service} Response Object:`, obj);
  bankServiceLogger.info(
    `[ifscApiCall] ${service} Response Object:`,
    JSON.stringify(obj),
  );

  // Format responses by provider
  let returnedObj = {};

  switch (service) {
    case "RAPID":
      returnedObj = {
        ifsc: obj?.IFSC,
        bank_name: obj?.BANK,
        branch: obj?.BRANCH,
        address: obj?.ADDRESS,
        city: obj?.CITY,
        district: obj?.DISTRICT,
        state: obj?.STATE,
        micr_code: obj?.MICR,
        contact: obj?.CONTACT,
      };
      break;

    case "TRUTHSCREEN":
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

      if (obj.status == 1) {
        const details = obj?.data?.address_details;

        returnedObj = {
          ifsc: obj?.data?.ifsc_code,
          bank_name: obj?.data?.bank_name,
          branch: details?.branch,
          address: details?.address,
          city: details?.city,
          district: details?.district,
          state: details?.state,
          micr_code: details?.micr_code,
          contact:
            details?.std_code && details?.contact
              ? `+91${details.std_code}${details.contact}`
              : null,
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

module.exports = {
  IfscActiveServiceResponse,
};
