const registeration = require("../../registeration/model/registerationModel");


const FetchUserDetails = async (req,res)=>{
    const {mobileNumber} = req.tokenData;
    console.log('Fetch User Details ====>',req.tokenData);
    try{
        const IsMerchant = await registeration.findOne({mobileNumber});
        console.log('Find merchent Details by token ===>', IsMerchant?.name)
        if(!IsMerchant){
            return res.status(404).json({httpsCode:404,data:'',message:'User Not Found',})
        }
        return res.status(200).json({httpsCode: 200, message: "User Found", data: IsMerchant,success:true});
    }catch(error){
        console.log('Fetch User Details ===>', error);
        return res.status(500).json({message:'Server Error',data:'',status:500,httpsCode:500});
    }
};


const updatedMerchantDetails = async (req,res)=>{
    const {mobileNumber,merchantId} = req.body;
    const updateData = req.body;

    console.log('updatedMerchantDetails  Details ====>',req.body);
    if (!mobileNumber || !merchantId) {
        return res.status(400).json({ httpStatusCode: 400, message: 'Mobile Number and Merchant ID are required.', data: null,success:false });
    }
    console.log('Uupdated Merchant details',mobileNumber,merchantId)
    try{
        const updatedMerchantData = await registeration.findOneAndUpdate(
            { mobileNumber, merchantId },
            { $set: updateData },
            { new: true } 
        );
        if (!updatedMerchantData) {
             return res.status(404).json({ httpStatusCode: 404, data: null, message: 'Update failed or User Not Found' });
        }
        console.log('updateMerchatData response after updated ===>', updatedMerchantData);
        console.log('updateMerchatData respnse after updated ===>',updateData)
        return res.status(200).json({httpsCode: 200, message:"Merchant details updated successfully.", data: updatedMerchantData,success:true});
    }catch(error){
        console.log('Fetch User Details ===>', error);
        return res.status(500).json({message:'Server Error',data:'',status:500,httpsCode:500});
    }
};

module.exports = {
    FetchUserDetails,
    updatedMerchantDetails
}