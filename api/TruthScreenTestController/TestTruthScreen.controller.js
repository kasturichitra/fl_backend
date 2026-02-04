const { callTruthScreenAPI } = require("../truthScreen/callTruthScreen");


const TestTruthScreen = async (req, res) => {
  console.log("req.body ===>>>", req.body)
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
    console.log("truthScreenResponse ===>>>", truthScreenResponse);
    res.send(truthScreenResponse);
  } catch (error) {
    res.send(error);
  }
}

module.exports = {
  TestTruthScreen
}