const { callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const { kycLogger } = require("../Logger/logger");


const TestTruthScreen = async (req, res) => {
  kycLogger.info(`req.body ===>>> ${JSON.stringify(req.body)}`);
  const payload = req.body;
  const username = process.env.TRUTHSCREEN_USERNAME;
  const token = process.env.TRUTHSCREEN_TOKEN;
  const url = process.env.TRUTHSCREEN_VOTERID_URL;
  try {
    const truthScreenResponse = await callTruthScreenAPI({
      url: url,
      payload: payload,
      username: username,
      password: token,
    });
    kycLogger.info(`truthScreenResponse ===>>> ${JSON.stringify(truthScreenResponse)}`);
    res.send(truthScreenResponse);
  } catch (error) {
    kycLogger.error(`Error in TestTruthScreen: ${error.message}`);
    res.send(error);
  }
}

module.exports = {
  TestTruthScreen
}