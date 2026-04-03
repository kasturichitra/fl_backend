const crypto = require("crypto");

function hashIdentifiers(identifiers,logger) {
  logger.info("identifiers in hashIdentifiers ===>>", identifiers)

  if (!identifiers || typeof identifiers !== "object") {
    logger.info("identifiers in hashIdentifiers are empty or undefined===>>", identifiers)
    throw new Error("Identifiers must be an object");
  }

  const normalizedString = Object.keys(identifiers)
    .sort()
    .map(
      key => `${key}:${String(identifiers[key]).trim()}`
    )
    .join("|");

  logger.info("normalizedString in hashIdentifiers ===>>", normalizedString);

  return crypto
    .createHash("sha256")
    .update(normalizedString)
    .digest("hex");
}

module.exports = { hashIdentifiers };
