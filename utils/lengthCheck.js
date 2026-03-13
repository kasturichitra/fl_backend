const { commonLogger } = require("../api/Logger/logger");
const { ERROR_CODES } = require("./errorCodes");

const ID_RULES = {
  creditCard: {
    min: 13,
    max: 19,
    regex: /^\d+$/,
    displayName: "Credit Card Number",
  },
  pan: { length: 10, regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, displayName: "PAN" },
  mobile: { length: 10, regex: /^\D[0-9]{10}$/, displayName: "Mobile Number" },
  aadhaar: { length: 12, regex: /^\d{12}$/, displayName: "Aadhaar Number" },
  cin: {
    length: 21,
    regex: /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
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
  license: {
    min: 15,
    max: 16,
    regex: /^[A-Z]{2}[0-9]{13,14}$/,
    displayName: "Driving License Number",
  },
  DateOfBirth: {
    length: 10,
    regex: /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-(19|20)\d{2}$/,
    displayName: "Date Of Birth",
  },
};

const validateId = (type, value, clientId) => {
  const rule = ID_RULES[type];
  commonLogger.info(
    `Rule for this type: ${type} of value: ${value} for this client: ${clientId} ====>> ${JSON.stringify(rule)}`,
  );
  if (!rule) throw new Error(`Unknown type: ${type}`);

  if (!value?.trim()) return false; // empty is invalid

  const trimmed = value.trim();

  if (rule.length && trimmed.length !== rule.length) return false;
  if (rule.min && trimmed.length < rule.min) return false;
  if (rule.max && trimmed.length > rule.max) return false;

  commonLogger.info(
    `length check completed successfully for this type: ${type} of value: ${value} for this client: ${clientId} ====>>`,
  );

  // Check format
  if (!rule.regex.test(trimmed)) return false;

  commonLogger.info(
    `regex check completed successfully for this type: ${type} of value: ${value} for this client: ${clientId} ====>>`,
  );

  return true;
};

const handleValidation = (type, value, res, storingClient) => {
  const rule = ID_RULES[type];

  if (!validateId(type, value, storingClient)) {
    commonLogger.info(
      `validation failed for this type: ${type} of value: ${value} for this client: ${storingClient} ====>>`,
    );
    const errorMessage = {
      response: `${rule.displayName} is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    };
    res.status(400).json(errorMessage);
    return false;
  }
  commonLogger.info(
    `validation completed successfully for this type: ${type} of value: ${value} for this client: ${storingClient} ====>>`,
  );
  return true;
};

module.exports = handleValidation;
