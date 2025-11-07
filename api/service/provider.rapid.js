const axios = require("axios");
let RapidApiKey = process.env.RAPIDAPI_KEY
let RapidApiBinHost = process.env.RAPIDAPI_BIN_HOST
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST

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

async function verifyBinNumber(data){
  const {bin} = data
  const url = `https://bin-info.p.rapidapi.com/bin.php?bin=${bin}`;
  const headers = {
      'x-rapidapi-key': RapidApiKey,
      'x-rapidapi-host': RapidApiBinHost,
  }

  return await apiCall(url, headers);

}

async function verifyIfsc(data){
  const {ifsc} = data
  const url = `https://ifsc-lookup-api.p.rapidapi.com/${ifsc}`
  const headers = {
      'x-rapidapi-key': RapidApiKey,
      'x-rapidapi-host': RapidApiBankHost,
  }

  return await apiCall(url, headers);

}

async function verifyCreditCardNumber(data){
  const {creditCardNumber} = data
  const url = `https://cardverify.p.rapidapi.com/validate/${creditCardNumber}`
  const headers = {
      'x-rapidapi-key': RapidApiKey,
      "x-rapidapi-host": "cardverify.p.rapidapi.com",  }

  return await apiCall(url, headers);

}

module.exports = {
  verifyCreditCardNumber,
  verifyBinNumber,
  verifyIfsc
}
