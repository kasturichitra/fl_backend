const { contactServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");
const {
  DOVE_SOFT_USER,
  DOVE_SOFT_KEY,
  DOVE_SOFT_API_URL,
  DOVE_SOFT_ENTITYID,
  DOVE_SOFT_TEMPID,
  DOVE_SOFT_SENDERID,
} = process.env;

const smsOtpActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(
      `[smsOtpActiveServiceResponse] No service with priority ${index + 1}, trying next`,
    );
    contactServiceLogger.info(
      `[smsOtpActiveServiceResponse] No service with priority ${index + 1}, trying next fotr this client: ${client}`,
    );
    return smsOtpActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`[smsOtpActiveServiceResponse] Trying service:`, newService);

  try {
    const res = await smsApiCall(data, serviceName);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[smsOtpActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    contactServiceLogger.info(
      `[smsOtpActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service for this client: ${client}`,
    );
    return smsOtpActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[smsOtpActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return smsOtpActiveServiceResponse(data, services, index + 1);
  }
};

const smsApiCall = async (data, service) => {
  const tskId = generateTransactionId(12);
  const { mobileNumber, message } = data;
  const ApiData = {
    DOVESOFT: {
      url: `${DOVE_SOFT_API_URL}&user=${DOVE_SOFT_USER}&key=${DOVE_SOFT_KEY}&mobile=+91${mobileNumber}&message=${message}&senderid=${DOVE_SOFT_SENDERID}&accusage=1&entityid=${DOVE_SOFT_ENTITYID}&tempid=${DOVE_SOFT_TEMPID}`,
      header: {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 2,
        docNumber: mobileNumber,
      },
      url: process.env.MOBILE_OTP_GENERATE_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

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
        "[smsApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    } else {
      ApiResponse = await axios.get(config.url);
      console.log(
        `[smsApiCall] ${service} API response:`,
        JSON.stringify(ApiResponse?.data || ApiResponse),
      );
    }
  } catch (error) {
    console.log(`[smsApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null };
  }
  const obj = ApiResponse?.data;

  return {
    success: true,
    data: obj,
  };
};

module.exports = {
  smsOtpActiveServiceResponse,
};
