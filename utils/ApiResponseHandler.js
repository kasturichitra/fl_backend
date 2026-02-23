function createApiResponse(httpCode, data, message = "Success") {
  return {
    httpCode,
    data,
    message,
    success: httpCode < 400,
  };
}

module.exports = { createApiResponse };