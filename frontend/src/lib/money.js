// Shared money formatting. Amounts are in major units (dollars for USD).
export function fmtUSD(n) {
  return Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
