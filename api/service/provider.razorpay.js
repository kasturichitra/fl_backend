const axios = require("axios");

async function apiCall(url, headers) {
  console.log("Api call triggred in rapid ===>>", url, headers);
  try {
    const res = await axios.get(url, {
      headers,
    });
    console.log("Api Call response in rapid api===>", res);
    return res.data;
  } catch (err) {
    console.log(`Rapid Retry Attempt error ${err}`);
    const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
    if (!isNetworkErr) {
      throw err;
    }
  }
}

async function verifyBankRazorpay(data){
  const {bin} = data
  const url = `https://bin-info.p.rapidapi.com/bin.php?bin=${bin}`;
  const headers = {
      'x-rapidapi-key': RapidApiKey,
      'x-rapidapi-host': RapidApiBinHost,
  }

  return await apiCall(url, headers);

}

module.exports = {
  verifyBankRazorpay,
}