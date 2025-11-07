const ERROR_CODES = {
  SUCCESS: { httpCode: 200, message: "Request processed successfully" },
  BAD_REQUEST: { httpCode: 400, message: "Invalid request parameters" },
  UNAUTHORIZED: { httpCode: 401, message: "Unauthorized access" },
  FORBIDDEN: { httpCode: 403, message: "Access denied" },
  NOT_FOUND: { httpCode: 404, message: "Requested resource not found" },
  METHOD_NOT_ALLOWED: { httpCode: 405, message: "HTTP method not allowed" },
  REQUEST_TIMEOUT: { httpCode: 408, message: "Request timed out" },
  CONFLICT: { httpCode: 409, message: "Conflict occurred in the request" },
  VALIDATION_ERROR: { httpCode: 422, message: "Data validation failed" },
  TOO_MANY_REQUESTS: { httpCode: 429, message: "Too many requests, please try again later" },
  SERVER_ERROR: { httpCode: 500, message: "Internal server error" },
  BAD_GATEWAY: { httpCode: 502, message: "Invalid response from upstream server" },
  SERVICE_UNAVAILABLE: { httpCode: 503, message: "Service temporarily unavailable" },
  GATEWAY_TIMEOUT: { httpCode: 504, message: "Gateway timed out" },
  INSUFFICIENT_FUNDS: { httpCode: 402, message: "Insufficient account balance" },
  INVALID_SIGNATURE: { httpCode: 498, message: "Key/Secret or signature mismatch" },
  IP_NOT_WHITELISTED: { httpCode: 403, message: "IP not whitelisted" },
  DUPLICATE_REQUEST: { httpCode: 409, message: "Duplicate request detected" },
  INVALID_INPUT_FIELDS: { httpCode: 422, message: "Invalid input fields provided" },
  TIMEOUT_ERROR: { httpCode: 504, message: "Request timeout occurred" },
  DATABASE_ERROR: { httpCode: 500, message: "Database operation failed" },
  THIRD_PARTY_ERROR: { httpCode: 502, message: "Third-party service failed" },
};

function mapError(err) {
  if (!err) return ERROR_CODES.SERVER_ERROR;

  const mapping = [
    { cond: e => e.message?.includes("signature") || e.code === "INVALID_SIGNATURE", code: "INVALID_SIGNATURE" },
    { cond: e => e.message?.includes("whitelist") || e.code === "IP_NOT_WHITELISTED", code: "IP_NOT_WHITELISTED" },
    { cond: e => ["ECONNABORTED", "ETIMEDOUT"].includes(e.code), code: "TIMEOUT_ERROR" },
    { cond: e => e.response, code: "THIRD_PARTY_ERROR" },
    { cond: e => ["MongoError", "MongooseError"].includes(e.name), code: "DATABASE_ERROR" },
    { cond: e => e.name === "ValidationError", code: "INVALID_INPUT_FIELDS" },
    { cond: e => e.code === 11000, code: "DUPLICATE_REQUEST" },
    { cond: e => e.message?.includes("insufficient"), code: "INSUFFICIENT_FUNDS" },
    { cond: e => ["METHOD_NOT_ALLOWED", "FORBIDDEN", "UNAUTHORIZED", "CONFLICT", "GATEWAY_TIMEOUT", "BAD_GATEWAY", "SERVICE_UNAVAILABLE"].includes(e.code), code: e.code },
  ];

  const matched = mapping.find(m => m.cond(err));
  return ERROR_CODES[matched?.code] || ERROR_CODES.SERVER_ERROR;
}

module.exports = { ERROR_CODES, mapError };
