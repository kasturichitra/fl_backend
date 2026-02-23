const { commonLogger } = require("../api/Logger/logger");

const AnalyticsDataUpdate = async (client, serviceId, categoryId) => {
  if (!client || !serviceId || !categoryId) {
    commonLogger.warn(`Invalid parameters for AnalyticsDataUpdate: client=${client}, serviceId=${serviceId}, categoryId=${categoryId}`);
    return { success: false }
  };

  try {
    commonLogger.debug(`Updating analytics for client: ${client}, service: ${serviceId}, category: ${categoryId}`);
    // First try to increment if service already exists
    const updateResult = await analyticsModel.updateOne(
      {
        clientId: client,
        "services.service": serviceId,
        "services.category": categoryId,
      },
      {
        $inc: { "services.$.count": 1 },
      }
    );

    // If no matching service found, push new one
    if (updateResult.matchedCount === 0) {
      commonLogger.info(`No existing analytics entry for service ${serviceId} found for client ${client}. Creating new entry.`);
      await analyticsModel.updateOne(
        { clientId: client },
        {
          $push: {
            services: {
              service: serviceId,
              category: categoryId,
              count: 1,
            },
          },
        },
        { upsert: true }
      );
    }

    commonLogger.info(`Analytics updated successfully for client: ${client}, service: ${serviceId}`);
    return { success: true }
  } catch (error) {
    commonLogger.error(`Error in AnalyticsDataUpdate for client ${client}, service ${serviceId}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = AnalyticsDataUpdate;
