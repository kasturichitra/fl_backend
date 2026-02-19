const analyticsModel = require("../api/analytics/model/analyticsModel");

const AnalyticsDataUpdate = async (client, serviceId, categoryId) => {
  if (!client || !serviceId || !categoryId) return;

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
};

module.exports = AnalyticsDataUpdate;
