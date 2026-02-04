
const handleVerifyVoterId = async (req, res) => {
    const { voterId } = req.body;
    try {
        

        res.status(200).json({ status: 1, data: result });
    } catch (error) {
        res.status(500).json({ status: 0, message: error.message });
    }
}

module.exports = {
    handleVerifyVoterId
}