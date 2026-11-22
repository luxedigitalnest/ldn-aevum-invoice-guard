// LDN Aevum Invoice Guard: exact-integer payment proofs. No private keys.
export const AEVUM_CHAIN_ID = 44005;
export const AEVUM_RPC = "https://rpc-test.qday.info";
export const AEVUM_EXPLORER = "https://explorer-test.qday.info";
export const TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483";
export const TUSD8_DECIMALS = 6;
export const TRANSFER_SELECTOR = "0xa9059cbb";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_UINT256 = (1n << 256n) - 1n;

export function address(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("Enter a 20-byte Ethereum address");
  if (/^0x0{40}$/i.test(value)) throw new Error("Zero address is not a valid merchant");
  return value.toLowerCase();
}

export function txHash(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("Enter a 32-byte transaction hash");
  return value.toLowerCase();
}

export function amountUnits(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value.trim()))
    throw new Error("Amount must be a positive decimal with at most six places");
  const [whole, fraction = ""] = value.trim().split(".");
  const units = BigInt(whole) * 1000000n + BigInt((fraction + "000000").slice(0, 6));
  if (units <= 0n || units > MAX_UINT256) throw new Error("Amount out of range");
  return units;
}

export function formatUnits(units) {
  const n = BigInt(units);
  const head = (n / 1000000n).toString();
  const fraction = (n % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? head + "." + fraction : head;
}

export function topicAddress(value) {
  return "0x" + address(value).slice(2).padStart(64, "0");
}

export function encodeTransfer(merchant, amount) {
  const to = address(merchant).slice(2).padStart(64, "0");
  const units = amountUnits(amount).toString(16).padStart(64, "0");
  return TRANSFER_SELECTOR + to + units;
}

export function makeInvoice(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Invoice details required");
  const merchant = address(raw.merchant);
  const units = amountUnits(raw.amount);
  const ref = String(raw.ref || "").trim();
  if (!/^[a-zA-Z0-9_-]{3,48}$/.test(ref)) throw new Error("Reference must have 3–48 letters, digits, _ or -");
  return { ref, merchant, amount: formatUnits(units), units: units.toString(), chainId: AEVUM_CHAIN_ID, token: TUSD8 };
}

function big(hex, label) {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]+$/.test(hex)) throw new Error("Invalid RPC " + label);
  return BigInt(hex);
}

export function verifyPayment(invoice, hash, transaction, receipt, latestBlock, chainId, minimumConfirmations = 6) {
  const t = txHash(hash);
  const i = makeInvoice(invoice);
  const fail = (reason) => ({ status: "rejected", ok: false, reason, confirmations: 0 });
  if (!Number.isSafeInteger(minimumConfirmations) || minimumConfirmations < 1) throw new Error("Bad confirmation threshold");
  if (big(chainId, "chain ID") !== BigInt(AEVUM_CHAIN_ID)) return fail("Wrong network; must be Aevum 44005");
  if (!transaction || !receipt) return { status: "pending", ok: false, reason: "Transaction not mined yet", confirmations: 0 };
  if (String(transaction.hash || "").toLowerCase() !== t || String(receipt.transactionHash || "").toLowerCase() !== t)
    return fail("Transaction hash mismatch");
  if (String(transaction.to || "").toLowerCase() !== TUSD8.toLowerCase())
    return fail("Transaction did not call official tUSD8");
  if (big(transaction.value || "0x0", "value") !== 0n) return fail("Unexpected native value");
  if (String(transaction.input || "").toLowerCase() !== encodeTransfer(i.merchant, i.amount).toLowerCase())
    return fail("Wrong merchant, amount, or method");
  if (big(receipt.status || "0x0", "status") !== 1n) return fail("Transaction reverted");
  if (receipt.blockNumber !== transaction.blockNumber || !receipt.blockNumber) return fail("Inconsistent block");
  const from = address(transaction.from);
  const expectedFrom = topicAddress(from);
  const expectedTo = topicAddress(i.merchant);
  const expectedAmount = "0x" + BigInt(i.units).toString(16).padStart(64, "0");
  const actualLog = (receipt.logs || []).some(log =>
    String(log.address || "").toLowerCase() === TUSD8.toLowerCase() &&
    log.removed !== true &&
    Array.isArray(log.topics) && log.topics.length === 3 &&
    String(log.topics[0]).toLowerCase() === TRANSFER_TOPIC &&
    String(log.topics[1]).toLowerCase() === expectedFrom &&
    String(log.topics[2]).toLowerCase() === expectedTo &&
    String(log.data || "").toLowerCase() === expectedAmount
  );
  if (!actualLog) return fail("No matching tUSD8 Transfer event");
  const block = big(receipt.blockNumber, "receipt block");
  const head = big(latestBlock, "latest block");
  if (head < block) return fail("RPC head is behind transaction block");
  const confirmations = Number(head - block + 1n);
  if (confirmations < minimumConfirmations)
    return { status: "confirming", ok: false, reason: "Waiting for " + minimumConfirmations + " confirmations", confirmations };
  return { status: "verified", ok: true, reason: "On-chain transfer matched exactly", confirmations, payer: from, txHash: t };
}

// No backend key or RPC write endpoint: only the wallet itself can sign.
export async function rpc(method, params = [], url = AEVUM_RPC) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }) });
  if (!res.ok) throw new Error("RPC HTTP " + res.status);
  const body = await res.json();
  if (body.error) throw new Error("RPC " + String(body.error.message || body.error.code));
  if (!("result" in body)) throw new Error("Empty RPC response");
  return body.result;
}
