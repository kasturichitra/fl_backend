const { response } = require("express");
const mongoose = require("mongoose");

const RazorPayPayInModel = mongoose.Schema({

    transaction_id : {
        type : String
    },
    order_id : {
        type: String
    },
    amount :{
        type: String
    },
    reciept_no: {
        type : String
    },
    currency :{
        type : String
    },
    email :{
        type: String
    },
    contact:{
        type :Number
    },
    method :{
        type :String
    },
    card :{
        type :Object
    },
    netbanking :{
        type: String
    },
    razorpay_payment_id :{
        type : String
    },
    razorpay_order_id :{
        type :String
    },
    razorpay_signature: {
        type :String
    },
    response:{
        type : Object
    },
    status :{
        type : String
    },
    MerchantId:{
        type:String
    },
    userName:{
        type:String
    },
    mobileNumber:{
        type:String
    },
    chargedAmount:{
        type:Number
    },
    actualAmount:{
        type:Number
    },
    orderCreationResponse:{
        type:Object
    },
    orderStatusResponse:{
        type:Object
    },
    detailsToSend:{
        type:Object
    },
    transactionTime: {
        type: String
    },
    transactionDate: {
        type: String,
    },
 

},{timestamps : true})


module.exports = mongoose.model("RazorPayPayInModel",RazorPayPayInModel);