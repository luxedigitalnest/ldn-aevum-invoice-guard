import { makeInvoice, txHash } from "./core.mjs";
export const STORAGE_KEY = "ldn-aevum-invoice-bindings-v1";

// Scope: this browser/origin only. Not an authoritative merchant ledger.
export function bindVerifiedPayment(storage, invoice, hash, verification) {
  const i = makeInvoice(invoice);
  const t = txHash(hash);
  if (!verification?.ok || verification.status !== "verified" ||
      txHash(verification.txHash) !== t) throw new Error("Payment must pass current on-chain verification first");
  const identity = JSON.stringify([i.chainId, i.token.toLowerCase(), i.merchant, i.ref]);
  const raw = storage.getItem(STORAGE_KEY);
  const rows = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some(r => !r || typeof r.invoice !== "string" ||
      typeof r.units !== "string" || !/^0x[0-9a-f]{64}$/.test(r.hash))) {
    throw new Error("Local binding history is invalid; no payment allocation recorded");
  }
  const byHash = rows.find(r => r.hash === t);
  if (byHash && (byHash.invoice !== identity || byHash.units !== i.units))
    throw new Error("This transaction is already bound to a different invoice in this browser");
  const byInvoice = rows.find(r => r.invoice === identity);
  if (byInvoice && (byInvoice.hash !== t || byInvoice.units !== i.units))
    throw new Error("This invoice reference is already bound to another payment or amount");
  if (byHash && byInvoice) return {status:"already-bound", hash:t};
  storage.setItem(STORAGE_KEY, JSON.stringify([...rows, {invoice:identity, units:i.units, hash:t}]));
  return {status:"bound", hash:t};
}

// Serialize concurrent verification tabs. Fail closed if storage/locking is unavailable.
export async function bindInBrowser(invoice, hash, verification, assertCurrent = () => {}) {
  if (!globalThis.navigator?.locks?.request) throw new Error("Browser lock unavailable; local allocation not recorded");
  return navigator.locks.request(STORAGE_KEY, () => {
    assertCurrent();
    return bindVerifiedPayment(localStorage, invoice, hash, verification);
  });
}
