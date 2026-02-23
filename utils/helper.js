const { verifyPanInvincible } = require("../api/service/provider.invincible");
const { verifyPanTruthScreen } = require("../api/service/provider.truthscreen");
const { verifyPanZoop } = require("../api/service/provider.zoop");

const generateTransactionId = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const randomComponent = Math.random().toString(36).substr(2, 4).toUpperCase();
  const transactionId = `NB_${date}${time}${randomComponent}`;
  return transactionId;
};


const servicesProviderId = {
  zoopProviderId: 'ZOOP',
  invincibleProviderId: 'INVINCIBLE',
  truthscreenProviderId: 'TRUTHSCREEN',
}

const { commonLogger } = require("../api/Logger/logger");

const GetPanResponse = async (providerId, data) => {
  let response;
  switch (providerId) {
    case servicesProviderId?.invincibleProviderId:
      commonLogger.info("Calling INVINCIBLE API for PAN verification...");
      response = await verifyPanInvincible(data);
      break;
    case servicesProviderId?.truthscreenProviderId:
      commonLogger.info("Calling TRUTHSCREEN API for PAN verification...");
      response = await verifyPanTruthScreen(data);
      break;
    case servicesProviderId?.zoopProviderId:
      commonLogger.info("Calling ZOOP API for PAN verification...");
      response = await verifyPanZoop(data);
      break;
    default:
      commonLogger.info("Calling Default (ZOOP) API for PAN verification...");
      response = await verifyPanZoop(data);
  }
  return response
}

module.exports = { generateTransactionId, GetPanResponse };
