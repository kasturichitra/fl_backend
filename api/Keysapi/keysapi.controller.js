const fs = require("fs");
const path = require("path");

const FetchPublickey = async (req, res) => {
    console.log('Fetch publickey is called ===>')
    try {
        const publicKeyPath = path.join(__dirname,"..", "..", "keys", "public.pem");

        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        console.log('publickey is :', publicKey.length)
        return res.status(200).json({
            httpsCode:200,
            success: true,
            publicKey: publicKey,
            message:'success'
        });

    } catch (error) {
        console.log("Error in FetchPublickey:", error);
        return res.status(500).json({
            success: false,
            message: "Error while fetching public key"
        });
    }
};

module.exports = { FetchPublickey };
