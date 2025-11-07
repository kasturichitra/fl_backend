const { default: axios } = require("axios")
const logger = require("../../Logger/logger")

const plural_client_Id = process.env.PLURAL_CLIENT_ID
const plural_secret_key = process.env.PLURAL_SECRET_KEY
const Plural_Url = process.env.PLURAL_API_URL
exports.generatePluralToken = async (req, res, next) => {
    const data = {
        client_id: plural_client_Id,
        client_secret: plural_secret_key,
        grant_type: 'client_credentials',
    };
    const timestamp = new Date().toISOString();
    const uniqueId = Date.now().toString().slice(-8);
    try {
        const response = await axios.post('https://pluraluat.v2.pinepg.in/api/auth/v1/token', data, {
            headers: {
                'Content-Type': 'application/json',
                'Request-Timestamp': timestamp,
            },
        });
        console.log("response in generatePluralToken", response?.data)
        if (response?.data?.access_token) {
            const data = {
                "merchant_order_reference": uniqueId,
                "order_amount": {
                    "value": 500,
                    "currency": "INR"
                },
                "pre_auth": false,
                "notes": "order1",
                "payment_methods": ["CARD"],
                "payments": [
                    {
                        "payment_method": "CARD",
                        "payment_amount": {
                            "value": 500,
                            "currency": "INR"
                        },
                        "payment_option": {
                            "card_details": {
                                "name": "Anil Reddy",
                                "card_number": "4012001037141112",
                                "cvv": "123",
                                "expiry_month": "04",
                                "expiry_year": "2029",
                                "registered_mobile_number": "9876543210"
                            }
                        }
                    }
                ],
                "purchase_details": {
                    "customer": {
                        "email_id": "kevin.bob@example.com",
                        "first_name": "Kevin",
                        "last_name": "Bob",
                        "customer_id": "192212",
                        "mobile_number": "9876543210",
                        "billing_address": {
                            "address1": "H.No 15, Sector 17",
                            "address2": "",
                            "address3": "",
                            "pincode": "61232112",
                            "city": "CHANDIGARH",
                            "state": "PUNJAB",
                            "country": "INDIA"
                        },
                        "shipping_address": {
                            "address1": "H.No 15, Sector 17",
                            "address2": "",
                            "address3": "",
                            "pincode": "144001123",
                            "city": "CHANDIGARH",
                            "state": "PUNJAB",
                            "country": "INDIA"
                        }
                    },
                    "merchant_metadata": {
                        "key1": "DD",
                        "key2": "XOF",
                    }
                }
            };
            const timestamp = new Date().toISOString();

            try {
                const orderResponse = await axios.post('https://pluraluat.v2.pinepg.in/api/checkout/v1/orders', data, {
                    // const orderResponse = await axios.post('https://pluraluat.v2.pinepg.in/api/pay/v1/orders/order_id/payments', data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${response?.data?.access_token}`,
                        'Request-Timestamp': timestamp,
                    }
                });
                console.log("Response from Create Hosted Checkout:", orderResponse?.data);
                if (orderResponse?.data?.redirect_url) {
                    const newData = {
                        "payments": [
                            {
                                "merchant_payment_reference": "008cf04b-a770-4777-854e-b1e6c12306037",
                                "payment_method": "CARD",
                                "payment_amount": {
                                    "value": 500,
                                    "currency": "INR"
                                },
                                "payment_option": {
                                    "card_details": {
                                        "name": "Anil Reddy",
                                        "card_number": "4012001037141112",
                                        "cvv": "123",
                                        "expiry_month": "04",
                                        "expiry_year": "2025",
                                        "registered_mobile_number": "9876543210"
                                    }
                                }
                            }
                        ]
                    }
                    const orderpay = await axios.post(`https://pluraluat.v2.pinepg.in/api/pay/v1/orders/${orderResponse?.data?.order_id}/payments`, newData, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${response?.data?.access_token}`,
                            'Request-Timestamp': timestamp,
                        }
                    })
                    console.log("orderpay response===>", orderpay?.data)
                    return res.status(200).send({ checkoutUrl: orderpay?.data?.data?.challenge_url, orderResponse: orderResponse?.data });
                } else {
                    let errorMessage = {
                        statsCode: 500,
                        message: "Error creating Order"
                    };
                    next(errorMessage);
                }
            } catch (error) {
                // console.log("Error in Creating Order:", error);
                console.log("Error in Creating Order:", error?.response?.data);
                const errorMessage = {
                    statsCode: 500,
                    message: "Internal Server Error"
                };
                next(errorMessage);
            }
        } else {
            let errorMessage = {
                statsCode: 500,
                message: "Internal Server Error"
            }
            next(errorMessage)
        }

    } catch (error) {
        console.log("error in  generating token===>", error)
        console.log("error in  generating token===>", error?.response?.data)
        const errorMessage = {
            statsCode: 500,
            message: "Internal Server Error"
        }
        next(errorMessage)
    }
}

exports.getTransactionStatus=async(req,res,next)=>{
    const orderId=req.params
    const detailsToSend=req.body
    console.log("detailsToSend in getTransactionStatus===>",detailsToSend)
    try {
        const response=await axios.get(`https://pluraluat.v2.pinepg.in/api/pay/v1/orders/${orderId}`)
        console.log("response after getting transaction status===>",response?.data) 
    } catch (error) {
        
    }
}
exports.getCallbackUrlOfPluralApi = async (req, res, next) => {
    logger.info("calling getCallbackUrlOfPluralApi")
    try {
        const response = req.body
        logger.info("response of getCallbackUrlOfPluralApi", JSON.stringify(response))
    } catch (error) {
        console.log("error while calling getCallbackUrlOfPluralApi")
    }
}