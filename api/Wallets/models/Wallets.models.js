const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema(
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
        }
      },{timestamps:true}
);

const WalletSchemamodal = mongoose.model("MerchantWallet", WalletSchema);

module.exports = WalletSchemamodal;
