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

    commonLogger.debug(`Rate limit response from super admin: ${JSON.stringify(rateLimitResponse?.data)}`);

    const dayLimit = rateLimitResponse.data?.data?.rateLimit;

    commonLogger.info(
      `Rate limit for category ${categoryId} and service ${serviceId}: ${dayLimit}`,
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
      clientId,
      createdAt: { $gte: today },
    };

    const apiHitCount = await apiHitCountModel.findOne(query);

    if (apiHitCount?.dayHitCount >= dayLimit) {
      commonLogger.warn(`Rate limit exceeded for client ${clientId}, service ${serviceId}`);
      return {
        allowed: false,
        message: "Daily rate limit exceeded",
      };
    }

    const apiHit = await apiHitCountModel.findOneAndUpdate(
      query,
      {
        $inc: { dayHitCount: 1, monthHitCount: 1 },
      },
      {
        new: true,
        upsert: true,
      },
    );

    commonLogger.info(`Rate limit hit recorded. Remaining for day: ${dayLimit - apiHit.dayHitCount}`);

    return {
      allowed: true,
      remaining: dayLimit - apiHit.dayHitCount,
    };
  } catch (error) {
    commonLogger.error(`Rate limit system error for client ${clientId}, service ${serviceId}: ${error.message}`);
    return {
      allowed: false,
      message: "Rate limit verification failed. Please try again later.",
      error: true
    };
  }
};

module.exports = checkingRateLimit;
