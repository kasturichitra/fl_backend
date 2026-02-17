const axios = require("axios");
const apiHitCountModel = require("../api/apiHitCount/model/apiHitCountModel");
const { commonLogger } = require("../api/Logger/logger");
const superAdminUrl = process.env.SUPERADMIN_URL;

const RATE_LIMIT_URL = `${superAdminUrl}/api/v1/apimodule/get-service-rate-limit`;

const checkingRateLimit = async ({ identifiers, serviceId, categoryId, clientId }) => {
  try {
    if (!identifiers || typeof identifiers !== "object") {
      throw new Error("Identifiers must be an object");
    }

    const rateLimitResponse = await axios.post(RATE_LIMIT_URL, {
      serviceId,
      categoryId,
      clientId
    });

    console.log(
      "rateLimitResponse from super admin ====>>>",
      rateLimitResponse?.data
    );

    const dayLimit = rateLimitResponse.data?.data?.rateLimit;

    commonLogger.info(`rate limit of category and service: ${categoryId}, ${serviceId} is ${dayLimit}`);
    console.log("serviceId and dayLimit ===>>", dayLimit, serviceId);

    if (!dayLimit) {
      throw new Error("Rate limit not configured for service");
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

    if (apiHitCount?.dayHitCount > dayLimit) {
      return {
        allowed: false,
        message: "Daily rate limit exceeded",
      };
    }

    const apiHit = await apiHitCountModel.findOneAndUpdate(
      query,
      {
        $inc: { dayHitCount: 1, monthHitCount: 1 }
      },
      {
        new: true,
        upsert: true,
      }
    );

    return {
      allowed: true,
      remaining: dayLimit - apiHit.dayHitCount,
    };
  } catch (error) {
    console.error("Rate limit error:", error.message);
    throw error;
  }
};

module.exports = checkingRateLimit;
