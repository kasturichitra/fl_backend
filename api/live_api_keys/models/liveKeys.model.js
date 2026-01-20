const mongoose = require("mongoose")

const LiveKeys = new mongoose.Schema({
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

const liveKeys = mongoose.model("live_api_keys" , LiveKeys)

module.exports = liveKeys