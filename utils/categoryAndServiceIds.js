const CATEGORIES = {
  PAN: "PANSERVICES",
  GEO: "GEOLOCATION",
  VEHICLE: "VEHICLETRANSPORT",
  Business: "BUSINESSCOMPANY",
  GST: "GSTSERVICES",
  CONTACT: "CONTACTCOMMUNICATION",
  AADHAAR: "AADHAARDIGILOCKER",
  GOVERNMENT: "GOVERNMENTIDSERVICES",
  FACE: "FACEAIVERIFICATION",
  BANK: "BANKINGFINANCIAL",
  EMPLOYMENT: "EMPLOYMENTINCOME",
  OTHER: "OTHERSERVICES",
  GSTADVANCE: "GSTSERVICES",
  RISK:"RISKDUEDILIGENCE"

};

const SERVICES = {
  // pan Services
  PAN_BASIC: {
    category: "PAN",
    serviceId: "PAN",
  },
  PAN_TAN_VERIFY: {
    category: "PAN",
    serviceId: "PANTANVERIFICATION",
  },
  PAN_TO_AADHAAR: {
    category: "PAN",
    serviceId: "PANTOMASKEDAADHAR",
  },
  PAN_NAME_MATCH: {
    category: "PAN",
    serviceId: "PANNAMEMATCH",
  },
  PAN_NAME_DOB: {
    category: "PAN",
    serviceId: "PANNAMEDOB",
  },
  PAN_DIRECTOR: {
    category: "PAN",
    serviceId: "PANDIRECTOR",
  },
  PAN_TO_FATHER_NAME: {
    category: "PAN",
    serviceId: "PANTOFATHERNAME",
  },
  PAN_TO_GST_IN_NUBER: {
    category: "PAN",
    serviceId: "KNOWYOURGSTINUSINGPAN",
  },
  PAN_TO_GST: {
    category: "PAN",
    serviceId: "PANTOGST",
  },

  // bank services
  CARD_VERIFY: {
    category: "BANK",
    serviceId: "CARDVALIDATOR",
  },
  ACCOUNT_PENNY_DROP: {
    category: "BANK",
    serviceId: "ACCOUNTPENNYDROP",
  },
  ACCOUNT_PENNY_LESS: {
    category: "BANK",
    serviceId: "ACCOUNTPENNYLESS",
  },
  ADVANCE_BANKACCOUNT_VERY: {
    category: "BANK",
    serviceId: "ADVANCEBANKACCOUNTVERIFICATION",
  },
    IFSC_SEARCH: {
    category: "BANK",
    serviceId: "IFSCCODECHECK",
  },
  BIN_VERIFY: {
    category: "BANK",
    serviceId: "BINVERIFICATION",
  },

  // geo and location
  PINCODE_GEOFENCING: {
    category: "GEO",
    serviceId: "PINCODEGEOFENCING",
  },
  LONG_LAT_GEOFENCING: {
    category: "GEO",
    serviceId: "LONGITUDELATITUDEGEOFENCING",
  },
  LONG_LAT_TO_DIGIPIN: {
    category: "GEO",
    serviceId: "LATLONGTODIGIPIN",
  },
  DIGIPIN_TO_LONG_LAT: {
    category: "GEO",
    serviceId: "DIGIPINTOLATLONG",
  },
  ADDRESS_TO_DIGIPIN: {
    category: "GEO",
    serviceId: "ADDRESSTODIGIPIN",
  },
  GEO_TAGGING_DISTANCE_CALCULATION: {
    category: "GEO",
    serviceId: "GEOTAGGINGDISTANCECALCULATION",
  },
  GEO_TAGGING: {
    category: "GEO",
    serviceId: "GEOTAGGINGSEARCH",
  },

  // vehicle services
  DRIVING_LICENSE: {
    category: "VEHICLE",
    serviceId: "DRIVINGLICENSE",
  },
  VEHICLE_REGISTER: {
    category: "VEHICLE",
    serviceId: "VEHICLERC",
  },
  STOLEN_VEHICLE: {
    category: "VEHICLE",
    serviceId: "STOLENVEHICLEVERIFICATION",
  },
  RC_VERIFICATION: {
    category: "VEHICLE",
    serviceId: "DETAILEDRCVERIFICATION",
  },
  CHALLAN_VIA_RC: {
    category: "VEHICLE",
    serviceId: "CHALLANVIARC",
  },

  // business services
  CIN: {
    category: "Business",
    serviceId: "CINVERIFICATION",
  },
  COMPANYNAME: {
    category: "Business",
    serviceId: "COMPANYNAMESEARCH",
  },
  DIN: {
    category: "Business",
    serviceId: "DINVERIFICATION",
  },
  UDYAMNUMBER: {
    category: "Business",
    serviceId: "UDYAMVERIFICATION",
  },
  GSTIN: {
    category: "Business",
    serviceId: "GSTINVERIFICATION",
  },
  GSTINTOPAN: {
    category: "Business",
    serviceId: "KNOWYOURPANUSINGGSTIN",
  },
  GSTINTAXPAYER: {
    category: "Business",
    serviceId: "GSTINTAXPAYER",
  },
  GSTINVIEWANDTRACK: {
    category: "Business",
    serviceId: "GSTINVIEWANDTRACKRETURN",
  },
  SHOP: {
    category: "Business",
    serviceId: "SHOPESTABLISHMENT",
  },

  // GST_SERVICES
  GSTADVANCE: {
    category: "GSTADVANCE",
    serviceId: "GSTADVANCEDSEARCH",
  },

  // aadhaar services
  AADHAAR_DIGILOCKER: {
    category: "AADHAAR",
    serviceId: "AADHAARNUMBERVALIDATION",
  },
  AADHAAR_TO_MASKED_PAN: {
    category: "AADHAAR",
    serviceId: "AADHAARTOPAN",
  },
  DIGILOCKER_ACCOUNT_VERIFY: {
    category: "AADHAAR",
    serviceId: "DIGILOCKERVERIFYACCOUNT",
  },
  
  // contact services
  MOBILE_OTP_VERIFY: {
    category: "CONTACT",
    serviceId: "MOBILEOTPVERIFICATION",
  },
  MOBILE_TO_PAN: {
    category: "CONTACT",
    serviceId: "MOBILETOPAN",
  },
  MOBILE_TO_UAN: {
    category: "CONTACT",
    serviceId: "MOBILETOUAN",
  },
  ADVANCE_MOBILE_DATA: {
    category: "CONTACT",
    serviceId: "ADVANCEDMOBILEDATASEARCH",
  },

  // face and ai services
  FACE_MATCH: {
    category: "FACE",
    serviceId: "FACEMATCH",
  },
  BLUR_CHECK: {
    category: "FACE",
    serviceId: "BLURINESS",
  },
  AI_IMAGE_CHECK: {
    category: "FACE",
    serviceId: "AIDETECTION",
  },
  DEEPFAKE_IMAGE_CHECK: {
    category: "FACE",
    serviceId: "DEEPFAKEDETECTION",
  },
  AI_AND_DEEPFAKE_IMAGE_CHECK: {
    category: "FACE",
    serviceId: "AIANDDEEPFAKEDETECTION",
  },

  // government services
  PASSPORT_WITH_FILE_NO: {
    category: "GOVERNMENT",
    serviceId: "MOBILETOPAN",
  },
  ELECTRICITY_BILL: {
    category: "GOVERNMENT",
    serviceId: "MOBILETOUAN",
  },
  TIN: {
    category: "GOVERNMENT",
    serviceId: "TINVERIFICATION",
  },
  VOTER_ID: {
    category: "GOVERNMENT",
    serviceId: "ADVANCEDMOBILEDATASEARCH",
  },
  PASSPORT_VERIFY: {
    category: "GOVERNMENT",
    serviceId: "ADVANCEDMOBILEDATASEARCH",
  },

  // employment services
  UAN_BASIC: {
    category: "EMPLOYMENT",
    serviceId: "BASICUANVERIFICATION",
  },
  DUAL_EMPLOYMENT: {
    category: "EMPLOYMENT",
    serviceId: "DUALEMPLOYMENTCHECK",
  },

  // risk and due diligence services
  DOMAIN: {
    category: "RISK",
    serviceId: "DOMAINVERIFICATION",
  },
  COURT_CASE: {
    category: "RISK",
    serviceId: "COURTRECORDSCHECKDIY",
  },
  PROFILE_ADVANCE: {
    category: "RISK",
    serviceId: "PROFILEADVANCE",
  },

  // other services
  NAME_MATCH: {
    category: "OTHER",
    serviceId: "NAMEMATCH",
  },
};

const getCategoryIdAndServiceId = (type, TxnID, logger) => {
  if (!type) return { categoryId: "", serviceId: "" };

  const key = type.toUpperCase();
  logger.info(
    `[SERVICE AND CATEGORY] key: ${key} in getting category and service for this TxnID: ${TxnID}====>>>`,
  );
  const service = SERVICES[key];
  logger.info(
    `[SERVICE AND CATEGORY] service: ${JSON.stringify(service)} in getting category and service for this TxnID: ${TxnID}====>>>`,
  );

  if (!service) return { categoryId: "", serviceId: "" };

  return {
    idOfCategory: CATEGORIES[service?.category] || "",
    idOfService: service?.serviceId || "",
  };
};

module.exports = getCategoryIdAndServiceId;
