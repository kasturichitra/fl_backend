const CATEGORIES = {
  PAN: "PANSERVICES",
  GEO: "GEOLOCATION",
};

const SERVICES = {
  PINCODE_GEOFENCING: {
    category: "GEO",
    serviceId: "asdfgh",
  },
  LONG_LAT_GEOFENCING: {
    category: "GEO",
    serviceId: "",
  },
  PANBASIC: {
    category: "PAN",
    serviceId: "",
  },
};

const getCategoryIdAndServiceId = (type) => {
  if (!type) return { categoryId: "", serviceId: "" };

  const key = type.toUpperCase();
  const service = SERVICES[key];

  if (!service) return { categoryId: "", serviceId: "" };

  return {
    categoryId: CATEGORIES[service.category] || "",
    serviceId: service.serviceId || "",
  };
};