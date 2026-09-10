export const formatCurrency = (amount) => {
  const num = Number(amount);

  if (!Number.isFinite(num)) {
    return "₹0";
  }

  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs < 10000) {
    return `${sign}₹${abs.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }

  if (abs < 1000000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  if (abs < 1000000000) {
    return `${sign}₹${(abs / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  return `${sign}₹${(abs / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
};
