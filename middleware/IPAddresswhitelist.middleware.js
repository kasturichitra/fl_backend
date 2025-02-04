
let whitelist = new Set(["192.168.0.235"]);

const checkWhitelist = (req, res, next) => {
    let ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
    ip = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip;
    
    // Convert ::1 to 127.0.0.1
    if (ip === "::1") {
        ip = "127.0.0.1";
    }

    console.log("Request IP:", ip); // Log IP to debug

    if (whitelist.has(ip)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Your IP is not whitelisted." });
    }
};

module.exports = checkWhitelist;



// Route: Get user data (protected)
// app.get("/user", checkWhitelist, (req, res) => {
//     res.json({ message: "Welcome to the user page!" });
// });

// Route: Get all whitelisted IPs
// app.get("/whitelist", (req, res) => {
//     res.json({ whitelist: Array.from(whitelist) });
// });

// Route: Add an IP to whitelist
// app.post("/whitelist", (req, res) => {
//     const { ip } = req.body;
//     if (ip) {
//         whitelist.add(ip);
//         res.json({ message: "IP added to whitelist", whitelist: Array.from(whitelist) });
//     } else {
//         res.status(400).json({ message: "Invalid IP address" });
//     }
// });

// Route: Remove an IP from whitelist
// app.delete("/whitelist", (req, res) => {
//     const { ip } = req.body;
//     if (ip && whitelist.has(ip)) {
//         whitelist.delete(ip);
//         res.json({ message: "IP removed from whitelist", whitelist: Array.from(whitelist) });
//     } else {
//         res.status(400).json({ message: "IP not found in whitelist" });
//     }
// });

// app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
// });
