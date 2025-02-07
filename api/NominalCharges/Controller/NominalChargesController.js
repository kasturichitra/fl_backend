const NominalChargesModel = require('../Model/NominalChargesModel');
const NominalCharges = require('../Model/NominalChargesModel');

// Create a new NominalCharge
exports.createNominalCharge = async (req, res) => {
    console.log("nominal charges from front end===>", req.body);
    const { service, chargeFee, chargePercentage, createdDate, createdTime } = req.body;
    console.log(service, chargeFee, chargePercentage, createdDate, createdTime)

    try {
        const nominalCharge = new NominalCharges({
            service,
            chargeFee: parseFloat(chargeFee),
            chargePercentage: parseFloat(chargePercentage),
            createdDate,
            createdTime
        });
        const existing = await NominalChargesModel.findOne({ service })
        if (existing) {
            const updateCharges = await NominalChargesModel.findOneAndUpdate({ service }, { $set: { chargeFee, chargePercentage, createdDate, createdTime } })
            console.log("updateCharges====>", updateCharges)
            return res.status(201).json({ message: "modified", response: updateCharges });
        }
        const savedCharge = await nominalCharge.save();
        console.log("savedCharge====>", savedCharge);
        return res.status(201).json({ message: "success", response: savedCharge });
    } catch (error) {
        console.error('Error:', error); // Log the error to understand the issue better
        res.status(400).json({ message: error.message });
    }
};

// Get all NominalCharges
exports.getNominalCharges = async (req, res) => {
    try {
        const charges = await NominalChargesModel.find({});
        console.log("charges details===>", charges)
        if (charges && charges?.length > 0) {
            return res.status(200).send({ message: "success", response: charges })
        } else {
            return res.status(200).send({ message: "noRecordsFound", response: charges })

        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single NominalCharge by ID
exports.getNominalChargeByService = async (req, res) => {
    const { service } = req.params
    console.log("service name from front end==>",service)
    try {
        const charges = await NominalCharges.findOne({ service });
        console.log("charges details===>", charges)
        if (charges) {
            return res.status(200).send({ message: "success", response: charges })
        } else {
            return res.status(200).send({ message: "noRecordsFound", response: charges })

        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a NominalCharge by ID
exports.updateNominalCharge = async (req, res) => {
    try {
        const charge = await NominalCharges.findOneAndUpdate(req.body.service, req.body, { new: true, runValidators: true });
        if (!charge) {
            return res.status(404).json({ message: 'Charge not found' });
        }
        res.status(200).json(charge);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


