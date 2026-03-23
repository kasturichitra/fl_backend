const { locationServiceLogger } = require("../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen")
const { default: axios } = require("axios");

const pincodeGeofencingActiveServiceResponse = async (data, services=[], index = 0, client) => {
    console.log('pincodeGeofencingActiveServiceResponse called');
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return pincodeGeofencingActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[pincodeGeofencingActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await pincodeGeofencingApiCall(data, serviceName, client);

        if (res?.data) {
            return res.data;
        }

        console.log(`[pincodeGeofencingActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return pincodeGeofencingActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[pincodeGeofencingActiveServiceResponse] Error from ${serviceName}:`, err.message);
        locationServiceLogger.info(`[pincodeGeofencingActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return pincodeGeofencingActiveServiceResponse(data, services, index + 1);
    }
};

const pincodeGeofencingApiCall = async (data, service, CID) => {
    const tskId = await generateTransactionId(12);

    const ApiData = {
        "TRUTHSCREEN": {
            BodyData: {
                transID: tskId,
                "docType": "554",
                "docNumber": data
            },
            url: process.env.TRUTHSCREEN_PINCODE_GEOFENCING,
            header: {
                username: process.env.TRUTHSCREEN_USERNAME,
                token: process.env.TRUTHSCREEN_TOKEN,
            }
        }
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

        ApiResponse = await axios.post(
            config.url,
            config.BodyData,
            { headers: config.header }
        );
    } catch (error) {
        console.log(`[pincode geofencing ApiCall] API Error in ${service}:`, error.message);
        return { success: false, data: null }; // fallback trigger
    }

    const obj = ApiResponse;
    console.log(`[pincode geofencing ApiCall] ${service} Response Object:`, JSON.stringify(obj));

    let returnedObj = {};

    if (obj?.status != 1 && obj?.msg == "No Record Found") {
        return {
            success: false,
            data: {
                result: "NoDataFound",
                message: "Invalid",
                responseOfService: {},
                service: service,
            }
        };
    }

    switch (service) {
        case "TRUTHSCREEN":
            returnedObj = {
                gstinNumber: obj?.result?.essentials?.gstin || "",
                business_constitution: obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
                central_jurisdiction: obj?.result?.result?.gstnDetailed?.centreJurisdiction || "",
                gstin: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                companyName: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                other_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || "",
                register_cancellation_date: obj?.result?.result?.gstnDetailed?.cancellationDate || "",
                state_jurisdiction: obj?.result?.result?.gstnDetailed?.stateJurisdiction || "",
                tax_payer_type: obj?.result?.result?.gstnDetailed?.taxPayerType || "",
                trade_name: obj?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
                primary_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || ""
            }
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
        }
    };
};

const longLatGeofencingActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client
) => {
  console.log(
    "longLatGeofencingActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "index increased in gst to pan verify ====>>>",
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
    const res = await longLaotGeofencingApiCall(data, serviceName, client);

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

const longLaotGeofencingApiCall = async (data, service, CID) => {
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
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse;
  console.log("obj ==>", obj);

  let returnedObj = {};

  if (obj.status === 1) {
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
    pincodeGeofencingActiveServiceResponse, longLatGeofencingActiveServiceResponse
}
