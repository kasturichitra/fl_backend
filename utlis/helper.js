const generateTransactionId = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const randomComponent = Math.random().toString(36).substr(2, 4).toUpperCase();
  const transactionId = `NB_${date}${time}${randomComponent}`;
  return transactionId;
};

module.exports = { generateTransactionId };
