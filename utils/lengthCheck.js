const { ERROR_CODES } = require("./errorCodes");

const ID_RULES = {
  creditCard: {
    min: 13,
    max: 19,
    regex: /^\d+$/,
    displayName: "Credit Card Number",
  },
  pincode: {
    length: 6,
    regex: /^[1-9][0-9]{5}$/, // Indian PIN code (cannot start with 0)
    displayName: "Pincode",
  },
  latitude: {
    regex: /^-?([0-8]?[0-9](\.\d+)?|90(\.0+)?)$/, // -90 to 90
    displayName: "Latitude",
  },
  longitude: {
    regex: /^-?((1[0-7][0-9]|[0-9]?[0-9])(\.\d+)?|180(\.0+)?)$/, // -180 to 180
    displayName: "Longitude",
  },
  voterId: {
    length: 10,
    regex: /^[A-Z]{3}[0-9]{7}$/,
    displayName: "Voter ID Number",
  },
  pan: { length: 10, regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, displayName: "PAN" },
  mobile: { length: 10, regex: /^[6-9]\d{9}$/, displayName: "Mobile Number" },
  aadhaar: { length: 12, regex: /^\d{12}$/, displayName: "Aadhaar Number" },
  cin: {
    length: 21,
    regex: /^[A-Za-z]{1}[0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/,
    displayName: "CIN",
  },
  bin: {
    length: 6,
    regex: /^\d{6}$/,
    displayName: "Bank Identification Number (BIN)",
  },
  gstin: {
    length: 15,
    regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    displayName: "GSTIN",
  },
  accountNumber: {
    min: 9,
    max: 18,
    regex: /^\d+$/,
    displayName: "Bank Account Number",
  },
  firstName: {
    min: 2,
    max: 50,
    regex: /^[A-Za-z\s]+$/,
    displayName: "First Name",
  },
  secondName: {
    min: 2,
    max: 50,
    regex: /^[A-Za-z\s]+$/,
    displayName: "Second Name",
  },
  ifsc: {
    length: 11,
    regex: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    displayName: "IFSC Code",
  },
  udyam: {
    length: 19,
    regex: /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/,
    displayName: "Udyam Number",
  },
  uan: {
    length: 12,
    regex: /^\d{12}$/,
    displayName: "UAN Number",
  },
  license: {
    min: 15,
    max: 16,
    regex: /^[A-Z]{2}[0-9]{13,14}$/,
    displayName: "Driving License Number",
  },
  passportFileNo: {
    length: 12,
    regex: /^[A-Z]{2}[0-9]{2}-[0-9]{7}$/,
    displayName: "Passport File Number",
  },
  StrictDateOfBirth: {
    length: 10,
    regex: /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-(19|20)\d{2}$/,
    displayName: "Date Of Birth",
  },
  DateOfBirth: {
    length: 10,
    regex: /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/,
    displayName: "Date Of Birth",
  },
  passportNumber: {
    length: 8,
    regex: /^[A-Z]{1}[0-9]{7}$/,
    displayName: "Passport Number",
  },
  digipin: {
    length: 10,
    regex: /^[A-Z0-9]{10}$/,
    displayName: "DIGIPIN",
  },
  address: {
    min: 5,
    max: 200,
    regex: /^[A-Za-z0-9\s,.\-/#()]+$/,
    displayName: "Address",
  },
  rc: {
    min: 10,
    max: 15,
    regex: /^[A-Z0-9]+$/,
    displayName: "RC Number",
  },
  vehicleNumber: {
    min: 9,
    max: 13,
    regex: /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/,
    displayName: "Vehicle Registration Number",
  },
  chassisNumber: {
    length: 17,
    regex: /^[A-HJ-NPR-Z0-9]{17}$/,
    displayName: "Chassis Number",
  },
  tan: {
    length: 10,
    regex: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,
    displayName: "TAN Number",
  },
  email: {
    min: 5,
    max: 254,
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    displayName: "Email Address",
  },
  din: {
    length: 8,
    regex: /^\d{8}$/,
    displayName: "Director Identification Number (DIN)",
  },
  CompanyName: {
    min: 2,
    max: 100,
    regex: /^[A-Za-z0-9\s,.\-&#()]+$/,
    displayName: "Company Name",
  },
  DGFT: {
    length: 10,
    regex: /^([A-Z]{5}[0-9]{4}[A-Z]{1}|\d{10})$/,
    displayName: "DGFT / IEC Number",
  },
  LEI: {
    length: 20,
    regex: /^[0-9A-Z]{20}$/,
    displayName: "Legal Entity Identifier (LEI)",
  },
  UAM: {
    length: 12,
    regex: /^[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{7}$/,
    displayName: "Udyog Aadhaar Memorandum (UAM)",
  },
  UAMPhone: {
    length: 12,
    regex: /^[A-Z]{2}[0-9]{2}[A-Z]{1}[0-9]{7}$/,
    displayName: "Udyog Aadhaar Memorandum (UAM)",
  },
  iec: {
    length: 10,
    regex: /^([A-Z]{5}[0-9]{4}[A-Z]{1}|\d{10})$/,
    displayName: "Import Export Code (IEC)",
  },
  tin: {
    length: 11,
    regex: /^\d{11}$/,
    displayName: "Tax Identification Number (TIN)",
  },
};

<<<<<<< HEAD
const validateId = (type, value, clientId="", logger) => {
  const rule = ID_RULES[type];
  logger.info(
    `Rule for this type: ${type} of value: ${value} for this client: ${clientId} ====>> ${JSON.stringify(rule)}`,
=======
const validateId = (type, value, TxnID,logger) => {
  const rule = ID_RULES[type];
  logger.info(
    `Rule for this type: ${type} of value: ${value} for this TxnID: ${TxnID} ====>> ${JSON.stringify(rule)}`,
>>>>>>> vishnu
  );
  if (!rule) throw new Error(`Unknown type: ${type}`);

  if (!value?.trim()) return false; // empty is invalid

  const trimmed = value.trim();

  logger.info(
<<<<<<< HEAD
    `Validating ${type} value ${trimmed} for client ${clientId}`,
=======
    `Validating ${type} value ${trimmed} for TxnID ${TxnID}`,
>>>>>>> vishnu
  );

  if (rule.length && trimmed.length !== rule.length) return {success:false, message: `${value} should be ${rule?.length} in length`};
  if (rule.min && trimmed.length < rule.min) return {success:false, message: `${value} length should be more than ${rule?.min} `};
  if (rule.max && trimmed.length > rule.max) return {success:false, message: `${value} length should be more than ${rule?.length} `};

  logger.info(
<<<<<<< HEAD
    `length check completed successfully for this type: ${type} of value: ${value} for this client: ${clientId} ====>>`,
=======
    `length check completed successfully for this type: ${type} of value: ${value} for this TxnID: ${TxnID} ====>>`,
>>>>>>> vishnu
  );

  // Check format
  if (!rule.regex.test(trimmed)) return false;

  logger.info(
<<<<<<< HEAD
    `regex check completed successfully for this type: ${type} of value: ${value} for this client: ${clientId} ====>>`,
=======
    `regex check completed successfully for this type: ${type} of value: ${value} for this TxnID: ${TxnID} ====>>`,
>>>>>>> vishnu
  );

  return {success:true};
};

const handleValidation = (type, value, res, TxnID,logger) => {
  const rule = ID_RULES[type];
  const stringValue = String(value || "").trim();
  if (!stringValue?.trim() && !["email", "domain"].includes(type)) {
    res.status(400).json({
      ...ERROR_CODES?.BAD_REQUEST,
      response: `${rule.displayName} is Missing 🤦‍♂️`,
    });
    return false;
  }
  const isValid = validateId(type, stringValue, storingClient, logger);

  if (!isValid?.success) {
    logger.info(
      `Validation failed for ${type}: ${stringValue?.length > 5 ? stringValue?.slice(-4) : stringValue} TxnID: ${TxnID} `,
    );

    res.status(400).json({
      ...ERROR_CODES?.BAD_REQUEST,
      response: isValid?.message ? isValid?.message : `${rule.displayName} is Invalid 🤦‍♂️`,
    });
    return false;
  }

  logger.info(
    `Validation passed for ${type}: with value: ${stringValue?.length > 5 ? stringValue?.slice(-4) : stringValue} for this TxnID: ${TxnID}`,
  );
  return true;
};

module.exports = handleValidation;
