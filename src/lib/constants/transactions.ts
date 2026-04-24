export const TXN_TYPES = [
  "BUY", "SELL", "DIVIDEND", "DRIP", "DEPOSIT", "WITHDRAWAL",
  "INTEREST", "FEE", "TAX_WITHHELD", "SPLIT", "MERGER", "ADJUSTMENT",
  "RETURN_OF_CAPITAL", "FRACTION_CASH", "TRANSFER",
] as const;

export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_TYPES_WITH_SECURITY = ["BUY", "SELL", "DIVIDEND", "DRIP", "SPLIT", "MERGER", "RETURN_OF_CAPITAL", "FRACTION_CASH"] as const;
export const TXN_TYPES_WITH_QTY = ["BUY", "SELL", "DRIP", "SPLIT"] as const;
