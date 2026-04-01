const { commonLogger } = require("../api/Logger/logger");
const analyticsModel = require("../api/analytics/model/analyticsModel")

const AnalyticsDataUpdate = async (client, serviceId, categoryId, scenario = "") => {
  if (!client || !serviceId || !categoryId) {
    commonLogger.warn(`Invalid parameters for AnalyticsDataUpdate: client=${client}, serviceId=${serviceId}, categoryId=${categoryId}`);
    return { success: false }
  };

  try {
    commonLogger.debug(`Updating analytics for client: ${client}, service: ${serviceId}, category: ${categoryId}`);
    // First try to increment if service already exists
    const updateResult = await analyticsModel.updateOne(
      { clientId: client },
      {
        $inc: {
          "services.$[elem].totalCount": 1,
          ...(scenario === "success"
            ? { "services.$[elem].successCount": 1 }
            : { "services.$[elem].failedCount": 1 }),
        },
      },
      {
        arrayFilters: [
          { "elem.service": serviceId, "elem.category": categoryId },
        ],
      },
    );
    // if (scenario == "success") {
    //   updateResult = await analyticsModel.updateOne(
    //     {
    //       clientId: client,
    //       "services.service": serviceId,
    //       "services.category": categoryId,
    //     },
    //     {
    //       $inc: { "services.$.successCount": 1, "services.$.totalCount": 1 },
    //     },
    //   );
    // } else {
    //   updateResult = await analyticsModel.updateOne(
    //     {
    //       clientId: client,
    //       "services.service": serviceId,
    //       "services.category": categoryId,
    //     },
    //       {
    //       $inc: { "services.$.failedCount": 1, "services.$.totalCount": 1 },
    //     },
    //   );
    // }

    // If no matching service found, push new one
    if (updateResult.modifiedCount === 0) {
      commonLogger.info(
        `No existing analytics entry for service ${serviceId} found for client ${client}. Creating new entry.`,
      );
      await analyticsModel.updateOne(
        { clientId: client },
        {
          $push: {
            services: {
              service: serviceId,
              category: categoryId,
              totalCount: 1,
              successCount: scenario == "success" ? 1 : 0,
              failedCount: scenario == "success" ? 0 : 1,
            },
          },
        },
        { upsert: true },
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
