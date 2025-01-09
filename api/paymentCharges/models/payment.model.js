const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({
    service:{
        type:String
    },
    charge:{
        type:String
    },
    gst:{
        type:String
    }
})


const payment = mongoose.model("Payments" , paymentSchema )

module.exports = payment ;