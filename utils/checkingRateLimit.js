const axios = require("axios");
const apiHitCountModel = require("../api/apiHitCount/model/apiHitCountModel");

const superAdminUrl = process.env.SUPERADMIN_URL;
const RATE_LIMIT_URL = `${superAdminUrl}/api/v1/apimodule/get-service-rate-limit`;

const checkingRateLimit = async ({
  identifiers,
  serviceId,
  categoryId,
  clientId,
  req,
  TxnID,
  logger
}) => {
  try {
    logger.info(
      `TxnID:${TxnID}, Rate limit check for service: ${serviceId}, category: ${categoryId}, client: ${clientId}`,
    );

    console.log("req.client_id and req.client_secret ====>>", req.client_secret, req.client_id)

    const headers = {
      client_id: req.client_id,
      client_secret: req.client_secret,
      projectId: process.env.PROJECT_ID,
    };

    const payLoad =  {
        serviceId,
        categoryId,
        clientId,
      }

    logger.info(
      `TxnID:${TxnID}, Rate limit payload to super admin: ${JSON.stringify(payLoad)}`,
    );

    const rateLimitResponse = await axios.post(
      RATE_LIMIT_URL,
     payLoad,
      { headers: headers },
    );

    logger.info(
      `TxnID:${TxnID}, Rate limit response from super admin: ${JSON.stringify(rateLimitResponse?.data)} for this client: ${clientId}`,
    );

    const dayLimit = rateLimitResponse.data?.data?.rateLimit;

    logger.info(
      `TxnID:${TxnID}, Rate limit for category ${categoryId} and service ${serviceId}: ${dayLimit} for this client: ${clientId}`,
    );

    if (!dayLimit) {
      throw new Error(
        `Rate limit not configured for service ${serviceId} in category ${categoryId}`,
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      identifiers,
      service: serviceId,
      category: categoryId,
      clientId: clientId,
      createdAt: { $gte: today },
    };

    const apiHitCount = await apiHitCountModel.findOne(query);

    if (apiHitCount?.dayHitCount >= dayLimit) {
      logger.warn(
        `Rate limit exceeded for client ${clientId},TxnID:${TxnID} of service ${serviceId} and category: ${categoryId}`,
      );
      return {
        allowed: false,
        message: "Daily rate limit exceeded",
      };
    }

    const apiHit = await apiHitCountModel.findOneAndUpdate(
      query,
      {
        $inc: { dayHitCount: 1 },
      },
      {
        new: true,
        upsert: true,
      },
    );

    logger.info(
      `TxnID:${TxnID}, Rate limit hit recorded. Remaining for day: ${dayLimit - apiHit.dayHitCount} for this client: ${clientId}`,
    );

    return {
      allowed: true,
      remaining: dayLimit - apiHit.dayHitCount,
    };
  } catch (error) {
    console.log("error ==========>>", error);
    logger.error(
      `TxnID:${TxnID}, Rate limit system error for client ${clientId}, service ${serviceId}: ${JSON.stringify(error)}`,
    );
    logger.info(
      `[ERROR] Rate limit system error for client ${clientId}, TxnID:${TxnID}, service ${serviceId}: ${JSON.stringify(error?.response?.data)}`,
    );
    if (error?.response?.data?.statusCode == 400) {
      return {
        allowed: false,
        message: error?.response?.data?.message,
        error: true,
      };
    }
    return {
      allowed: false,
      message: "Rate limit verification failed. Please try again later.",
      error: true,
    };
  }
};

module.exports = checkingRateLimit;
