const { ERROR_CODES } = require("./errorCodes");

const ID_RULES = {
  creditCard: {
    min: 13,
    max: 19,
    regex: /^\d+$/,
    displayName: "Credit Card Number",
  },
  pan: { length: 10, regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, displayName: "PAN" },
  aadhaar: { length: 12, regex: /^\d{12}$/, displayName: "Aadhaar Number" },
  cin: {
    length: 21,
    regex: /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
    displayName: "CIN",
  },
    bin: {
    length: 6,
    regex: /^\d{6,8}$/,
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
};

const validateId = (type, value) => {
  const rule = ID_RULES[type];
  if (!rule) throw new Error(`Unknown type: ${type}`);

  if (!value?.trim()) return false; // empty is invalid

  const trimmed = value.trim();

  if (rule.length && trimmed.length !== rule.length) return false;
  if (rule.min && trimmed.length < rule.min) return false;
  if (rule.max && trimmed.length > rule.max) return false;

  // Check format
  if (!rule.regex.test(trimmed)) return false;

  return true;
};

const handleValidation = (type, value, res) => {
  const rule = ID_RULES[type];

  if (!validateId(type, value)) {
    const errorMessage = {
      response: `${rule.displayName} is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    };
    res.status(400).json(errorMessage);
    return false;
  }
  return true;
};

module.exports = handleValidation;
