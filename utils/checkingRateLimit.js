const axios = require("axios");
const apiHitCountModel = require("../api/apiHitCount/model/apiHitCountModel");
const { commonLogger } = require("../api/Logger/logger");

const superAdminUrl = process.env.SUPERADMIN_URL;
const RATE_LIMIT_URL = `${superAdminUrl}/api/v1/apimodule/get-service-rate-limit`;

const checkingRateLimit = async ({
  identifiers,
  serviceId,
  categoryId,
  clientId,
}) => {
  try {
    commonLogger.info(`Rate limit check for service: ${serviceId}, category: ${categoryId}, client: ${clientId}`);

    const rateLimitResponse = await axios.post(RATE_LIMIT_URL, {
      serviceId,
      categoryId,
      clientId,
    });

    commonLogger.debug(`Rate limit response from super admin: ${JSON.stringify(rateLimitResponse?.data)} for this client: ${clientId}`);

    const dayLimit = rateLimitResponse.data?.data?.rateLimit;

    commonLogger.info(
      `Rate limit for category ${categoryId} and service ${serviceId}: ${dayLimit} for this client: ${clientId}`,
    );

    if (!dayLimit) {
      throw new Error(`Rate limit not configured for service ${serviceId} in category ${categoryId}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      identifiers,
      service: serviceId,
      category: categoryId,
      clientId:clientId,
      createdAt: { $gte: today },
    };

    const apiHitCount = await apiHitCountModel.findOne(query);

    if (apiHitCount?.dayHitCount >= dayLimit) {
      commonLogger.warn(`Rate limit exceeded for client ${clientId} of service ${serviceId} and category: ${categoryId}`);
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

    commonLogger.info(`Rate limit hit recorded. Remaining for day: ${dayLimit - apiHit.dayHitCount} for this client: ${clientId}`);

    return {
      allowed: true,
      remaining: dayLimit - apiHit.dayHitCount,
    };
  } catch (error) {
    commonLogger.error(`Rate limit system error for client ${clientId}, service ${serviceId}: ${JSON.stringify(error)}`);
    return {
      allowed: false,
      message: "Rate limit verification failed. Please try again later.",
      error: true
    };
  }
};

module.exports = checkingRateLimit;
