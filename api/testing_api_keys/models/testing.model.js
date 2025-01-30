const mongoose = require("mongoose")

const testingApiKeys = new mongoose.Schema({
    MerchantId:{
        type:String
    },
    token:{
        type:String
    },
    service:{
        type:String
    },
    test_key:{
        type:String
    },
    test_salt:{
        type:String
    },
    limit:{
        type:Number
    }
})

const testingKeys = mongoose.model("testing_api_keys" , testingApiKeys)

module.exports = testingKeys