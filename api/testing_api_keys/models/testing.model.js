const mongoose = require("mongoose")

const testingApiKeys = new mongoose.Schema({
    clientId:{
        type:String
    },
    client_id:{
        type:String
    },
    secret_key:{
        type:String
    },
    createdTime:{
        type:String
    },
    createdDate:{
        type:String
    }
},{timestamps:true})

const testingKeys = mongoose.model("testing_api_keys" , testingApiKeys)

module.exports = testingKeys