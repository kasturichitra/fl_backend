const axios = require('axios');
require('dotenv').config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel =require("../models/BinApiBankModel")
let RapidApiKey = process.env.RAPIDAPI_KEY
let RapidApiHost = process.env.RAPIDAPI_BIN_HOST
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST


exports.getCardDetailsByNumber = async (req ,res)=>{
    const {bin} = req.body; 
    // const bin = 457704; 
    console.log("bin detailes=---> ",bin);
    console.log("RAOPID_API KEY=---> ",RapidApiKey)
    console.log("RAPID Bin API HOST =---> ",RapidApiHost)
    console.log("RAPID Bank  API HOST =---> ",RapidApiBankHost)

 
    const options = {
      method: 'GET',
      url: 'https://bin-info.p.rapidapi.com/bin.php', 
      params:  {bin},
      headers: {
        'x-rapidapi-key':  RapidApiKey,
        'x-rapidapi-host': RapidApiHost,
      },
    };
  
    try {

      const exsistingDetails = await RapidApiModel.findOne({bin})
      console.log("==============================>>>>>bin existing" , exsistingDetails)
      if(exsistingDetails){
        return res.status(200).json({
          message : "valid" , success : true , response : exsistingDetails?.response
         }) 
      }else{
        const response = await axios.request(options);
      if(response.statusText === "OK"){
       let saveData =  await RapidApiModel({
          bin: bin,
          response: response.data 
        })
        console.log("response of bin in back end jus===>",response?.data)
        let done = await saveData.save();
        if(done){
          console.log("Data save to db successfully ")
        }
      }
      return res.status(200).json({
        message : "valid" , success : true , response : response?.data
       })
      }
  
      
    } catch (error) {
      console.error('Error fetching BIN info:', error.message);
      res.status(500).json({ error: 'Failed to fetch BIN information' });
    }
}

exports.getBankDetailsByIfsc = async (req, res) => {
  const { ifsc } = req.body; 

  console.log('IFSC Code:', ifsc);
  // const MerchantId = req.merchantId;
  // const check = req.token;

  const options = {
    method: 'GET',
    url: `https://ifsc-lookup-api.p.rapidapi.com/${ifsc}`,
    headers: {
      'x-rapidapi-key': RapidApiKey,
      'x-rapidapi-host': RapidApiBankHost,
    },
  };

  try {
      const existingBankDetails = await RapidApiBankModel.findOne({Ifsc : ifsc})

      if(existingBankDetails){
        return res.status(200).json({
          message : "valid" , success : true , response : existingBankDetails?.response
         }) 
      }else{
        const response = await axios.request(options);
  
        if(response.statusText === "OK"){
          let saveData =  await RapidApiBankModel({
             Ifsc: ifsc,
             response: response.data
           })
           let done = await saveData.save();
           if(done){
             console.log("Bank Data save to db successfully ")
           }
         }
        console.log('Bank details fetched successfully:', response.data);
        return res.status(200).json({
          message : "valid" , success : true , response : response?.data
         }) 
      }


   
  } catch (error) {
    console.error('Error fetching Bank info:', error.message);
    res.status(500).json({ error: 'Failed to fetch Bank information' });
  }
};

