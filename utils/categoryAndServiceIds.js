const { commonLogger } = require("../api/Logger/logger");

const CATEGORIES = {
  PAN: "PANSERVICES",
  GEO: "GEOLOCATION",
  VEHICLE: "VEHICLE_TRANSPORT",
  Business: "BUSINESSANDCOMPANY",
};

const SERVICES = {
  PINCODE_GEOFENCING: {
    category: "GEO",
    serviceId: "PINCODEGEOFENCINGAPI",
  },
  LONG_LAT_GEOFENCING: {
    category: "GEO",
    serviceId: "LONGITUDELATITUDEGEOFENCINGAPI",
  },
  LONG_LAT_TO_DIGIPIN: {
    category: "GEO",
    serviceId: "asdfgh",
  },
  DIGIPIN_TO_LONG_LAT: {
    category: "GEO",
    serviceId: "asdfgh",
  },
  LONG_LAT_GEOFENCING: {
    category: "GEO",
    serviceId: "",
  },
  GEO_TAGGING_DISTANCE_CALCULATION: {
    category: "GEO",
    serviceId: "",
  },
  GEO_TAGGING: {
    category: "GEO",
    serviceId: "",
  },
  PANBASIC: {
    category: "PAN",
    serviceId: "",
  },
  PAN_TAN_VERIFY: {
    category: "PAN",
    serviceId: "",
  },
  RC_VERIFICATION: {
    category: "VEHICLE",
    serviceId: "",
  },
  CIN: {
    category: "Business",
    serviceId: "CIN Search",
  },
  CompanyName: {
    category: "Business",
    serviceId: "CIN Based Company Search",
  },
  DIN: {
    category: "Business",
    serviceId: "Din",
  },
};

const getCategoryIdAndServiceId = (type, client) => {
  if (!type) return { categoryId: "", serviceId: "" };

  const key = type.toUpperCase();
  commonLogger.info(
    `[SERVICE AND CATEGORY] key: ${key} in getting category and service for this client: ${client}====>>>`,
  );
  const service = SERVICES[key];
  commonLogger.info(
    `[SERVICE AND CATEGORY] service: ${JSON.stringify(service)} in getting category and service for this client: ${client}====>>>`,
  );

  if (!service) return { categoryId: "", serviceId: "" };

  return {
    idOfCategory: CATEGORIES[service.category] || "",
    idOfService: service.serviceId || "",
  };
};

module.exports = getCategoryIdAndServiceId;
