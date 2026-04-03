const analyticsModel = require("../api/analytics/model/analyticsModel")

const AnalyticsDataUpdate = async (client, serviceId, categoryId, scenario = "", TxnID, logger) => {
  if (!client || !serviceId || !categoryId) {
    logger.warn(`Invalid parameters for AnalyticsDataUpdate: client=${client}, serviceId=${serviceId}, categoryId=${categoryId}`);
    return { success: false };
  }

  try {
    logger.info(`Updating analytics for client: ${client}, service: ${serviceId}, category: ${categoryId}`);

    // 🔍 Check if service+category already exists
    const existing = await analyticsModel.findOne({
      clientId: client,
      services: {
        $elemMatch: {
          service: serviceId,
          category: categoryId,
        },
      },
    });

    if (existing) {
      // ✅ Update counts
      await analyticsModel.updateOne(
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
        }
      );

      logger.info(`Counts updated for existing service.`);
    } else {
      // ✅ Push new entry (even if category already exists)
      await analyticsModel.updateOne(
        { clientId: client },
        {
          $push: {
            services: {
              service: serviceId,
              category: categoryId,
              totalCount: 1,
              successCount: scenario === "success" ? 1 : 0,
              failedCount: scenario === "success" ? 0 : 1,
            },
          },
        },
        { upsert: true }
      );

      logger.info(`New service entry added.`);
    }

    return { success: true };

  } catch (error) {
    logger.error(`Error in AnalyticsDataUpdate: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = AnalyticsDataUpdate;


