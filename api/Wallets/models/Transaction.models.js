const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        MerchantId: {
            type:String,
            required:true
        },
        transactionDate:{
            type:Date,
            required:true
        },
        transactionTime:{
            type:String,
            required:true
        },
        settlementStatus:{
            type:Boolean,
        },
        unSettledAmount:{
            type:Number,
            required:true
        },
        settledAmount:{
            type:Number,
            required:true
        },
        mobileNumber:{
            type:Number,
            required: true
        },
        transactionId:{
            type:String,
            required:true
        },
        service:{
            type:String,
            required:true
        }
      },{timestamps:true}
);

const TransactionschemaModal = mongoose.model("TransactinTracking", transactionSchema);

module.exports = TransactionschemaModal;
