const crypto = require("crypto");
const { commonLogger } = require("../api/Logger/logger");

function hashIdentifiers(identifiers) {
  console.log("identifiers in hashIdentifiers ===>>", identifiers)
  commonLogger.info("identifiers in hashIdentifiers ===>>", identifiers)

  if (!identifiers || typeof identifiers !== "object") {
    commonLogger.info("identifiers in hashIdentifiers are empty or undefined===>>", identifiers)
    throw new Error("Identifiers must be an object");
  }

  const normalizedString = Object.keys(identifiers)
    .sort()
    .map(
      key => `${key}:${String(identifiers[key]).trim()}`
    )
    .join("|");

  commonLogger.info("normalizedString in hashIdentifiers ===>>", normalizedString)
  console.log("normalizedString in hashIdentifiers ===>>", normalizedString)

  return crypto
    .createHash("sha256")
    .update(normalizedString)
    .digest("hex");
}

module.exports = { hashIdentifiers };
