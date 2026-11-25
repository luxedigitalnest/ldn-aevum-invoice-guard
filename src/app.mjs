import { AEVUM_CHAIN_ID, AEVUM_RPC, AEVUM_EXPLORER, TUSD8, makeInvoice, encodeTransfer, verifyPayment, rpc, txHash } from "./core.mjs";

import { bindInBrowser } from "./settlement.mjs";

const $ = id => document.getElementById(id);
let invoice = null, link = "";
const setOut = (id, message, kind = "") => {
  const e = $(id); e.dataset.kind = kind; e.textContent = message;
};
const details = () => makeInvoice({ merchant: $("merchant").value, amount: $("amount").value, ref: $("reference").value });
const short = s => s.slice(0, 8) + "…" + s.slice(-6);

// Keep the visible invoice and proof synchronized, and serialize wallet/RPC operations.
// The wallet remains the only authority that can sign.
let busy = false;
const operationControls = ["merchant", "amount", "reference", "transaction", "create", "network", "pay", "verify"];
const selection = () => JSON.stringify(["merchant", "amount", "reference", "transaction"].map(id => $(id).value));
function beginOperation() {
  if (busy) return false;
  busy = true;
  for (const id of operationControls) $(id).disabled = true;
  $("copy").disabled = true;
  $("explorer").disabled = true;
  return true;
}
function endOperation() {
  busy = false;
  for (const id of operationControls) $(id).disabled = false;
  $("copy").disabled = !link;
  try { txHash($("transaction").value.trim()); $("explorer").disabled = false; }
  catch { $("explorer").disabled = true; }
}
function ensureUnchanged(before) {
  if (selection() !== before) throw new Error("Invoice or transaction changed; verify the current details again");
}
for (const id of ["merchant", "amount", "reference", "transaction"]) {
  $(id).addEventListener("input", () => {
    if (id !== "transaction") {
      link = "";
      $("copy").disabled = true;
      setOut("create-result", "Invoice details changed. Create a new link.", "warn");
    }
    $("explorer").disabled = true;
    setOut("pay-result", "Details changed. Current payment is not verified.", "warn");
  });
}


function loadLink() {
  const q = new URLSearchParams(location.search);
  if (!q.has("to")) return;
  $("merchant").value = q.get("to") || "";
  $("amount").value = q.get("amount") || "";
  $("reference").value = q.get("ref") || "";
  try {
    invoice = details();
    setOut("create-result", "Loaded invoice " + invoice.ref + " · " + invoice.amount + " test tUSD8\nMerchant: " + invoice.merchant, "warn");
  } catch (e) { setOut("create-result", "Invalid shared invoice: " + e.message, "error"); }
}
$("reference").value = "LDN-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-001";
loadLink();

$("create").addEventListener("click", () => {
  if (busy) return;
  try {
    invoice = details();
    const q = new URLSearchParams({ to: invoice.merchant, amount: invoice.amount, ref: invoice.ref });
    link = location.origin + location.pathname + "?" + q.toString();
    $("copy").disabled = false;
    setOut("create-result", "Invoice " + invoice.ref + " created.\nAmount: " + invoice.amount + " test tUSD8\nMerchant: " + invoice.merchant + "\nLink: " + link, "good");
  } catch (e) { link = ""; $("copy").disabled = true; setOut("create-result", e.message, "error"); }
});
$("copy").addEventListener("click", async () => {
  if (busy || !link) return;
  const copied = link;
  try { await navigator.clipboard.writeText(copied); if (link === copied) setOut("create-result", "Invoice link copied.\n" + copied, "good"); }
  catch { setOut("create-result", "Clipboard unavailable. Select and copy the link in the output above.", "warn"); }
});
$("network").addEventListener("click", async () => {
  if (!beginOperation()) return;
  try {
    if (!window.ethereum) throw new Error("No compatible browser wallet. Install a trusted EIP-1193 wallet.");
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: "0xabe5", chainName: "QDay Aevum Testnet",
      nativeCurrency: { name: "tQDAY Testnet", symbol: "tQDAY", decimals: 18 },
      rpcUrls: [AEVUM_RPC], blockExplorerUrls: [AEVUM_EXPLORER]
    }] });
    setOut("pay-result", "Wallet network request completed. Inspect the network details inside your wallet.", "warn");
  } catch (e) { setOut("pay-result", e.message, "error"); }
  finally { endOperation(); }
});
$("pay").addEventListener("click", async () => {
  if (!beginOperation()) return;
  const before = selection();
  try {
    const requestedInvoice = details();
    if (!window.ethereum) throw new Error("No EIP-1193 wallet found.");
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(chain) !== BigInt(AEVUM_CHAIN_ID)) throw new Error("Wallet is not on Aevum Testnet 44005. Switch manually first.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.[0]) throw new Error("No wallet account approved.");
    const currentChain = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(currentChain) !== BigInt(AEVUM_CHAIN_ID)) throw new Error("Wallet network changed; switch back to Aevum Testnet 44005 before retrying.");
    ensureUnchanged(before);
    const data = encodeTransfer(requestedInvoice.merchant, requestedInvoice.amount);
    setOut("pay-result", "Review the upcoming WALLET transaction: " + requestedInvoice.amount + " TEST tUSD8 to " + requestedInvoice.merchant + ". Do not approve if anything differs.", "warn");
    const hash = await window.ethereum.request({ method: "eth_sendTransaction",
      params: [{ from: accounts[0], to: TUSD8, value: "0x0", data }] });
    $("transaction").value = txHash(hash);
    $("explorer").disabled = false;
    setOut("pay-result", "Wallet submitted testnet transaction " + hash + ". Not paid until confirmed independently.", "warn");
  } catch (e) { setOut("pay-result", "No payment proved: " + e.message, "error"); }
  finally { endOperation(); }
});
$("verify").addEventListener("click", async () => {
  if (!beginOperation()) return;
  const before = selection();
  try {
    const checkedInvoice = details();
    const hash = txHash($("transaction").value.trim());
    setOut("pay-result", "Reading QDay Aevum blockchain; no wallet signature is requested.", "warn");
    const chain = await rpc("eth_chainId");
    if (BigInt(chain) !== BigInt(AEVUM_CHAIN_ID)) throw new Error("Configured RPC returned the wrong network.");
    const [transaction, receipt, head] = await Promise.all([
      rpc("eth_getTransactionByHash", [hash]), rpc("eth_getTransactionReceipt", [hash]), rpc("eth_blockNumber")
    ]);
    ensureUnchanged(before);
    const result = verifyPayment(checkedInvoice, hash, transaction, receipt, head, chain);
    $("explorer").disabled = false;
    if (result.ok) {
      const binding = await bindInBrowser(checkedInvoice, hash, result, () => ensureUnchanged(before));
      ensureUnchanged(before);
      setOut("pay-result", "VERIFIED ON-CHAIN · " + result.confirmations + " confirmations\n"
        + checkedInvoice.amount + " test tUSD8 from " + short(result.payer) + " to " + short(checkedInvoice.merchant)
        + "\nTX " + hash + "\nReference " + checkedInvoice.ref + " · " + binding.status + " in this browser only. Not a shared merchant ledger.", "good");
    }
    else setOut("pay-result", result.status.toUpperCase() + " · " + result.reason +
      (result.confirmations ? " · " + result.confirmations + " confirmations" : "") + "\nNo paid status recorded.", result.status === "rejected" ? "error" : "warn");
  } catch (e) { setOut("pay-result", "Verification unavailable: " + e.message + ". No payment is proven.", "error"); }
  finally { endOperation(); }
});
$("explorer").addEventListener("click", () => {
  try { const hash = txHash($("transaction").value.trim()); window.open(AEVUM_EXPLORER + "/tx/" + hash, "_blank", "noopener,noreferrer"); }
  catch (e) { setOut("pay-result", e.message, "error"); }
});
