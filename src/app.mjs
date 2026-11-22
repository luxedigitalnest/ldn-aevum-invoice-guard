import { AEVUM_CHAIN_ID, AEVUM_RPC, AEVUM_EXPLORER, TUSD8, makeInvoice, encodeTransfer, verifyPayment, rpc, txHash } from "./core.mjs";

const $ = id => document.getElementById(id);
let invoice = null, link = "";
const setOut = (id, message, kind = "") => {
  const e = $(id); e.dataset.kind = kind; e.textContent = message;
};
const details = () => makeInvoice({ merchant: $("merchant").value, amount: $("amount").value, ref: $("reference").value });
const short = s => s.slice(0, 8) + "…" + s.slice(-6);

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
  try {
    invoice = details();
    const q = new URLSearchParams({ to: invoice.merchant, amount: invoice.amount, ref: invoice.ref });
    link = location.origin + location.pathname + "?" + q.toString();
    $("copy").disabled = false;
    setOut("create-result", "Invoice " + invoice.ref + " created.\nAmount: " + invoice.amount + " test tUSD8\nMerchant: " + invoice.merchant + "\nLink: " + link, "good");
  } catch (e) { $("copy").disabled = true; setOut("create-result", e.message, "error"); }
});
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(link); setOut("create-result", "Invoice link copied.\n" + link, "good"); }
  catch { setOut("create-result", "Clipboard unavailable. Select and copy the link in the output above.", "warn"); }
});
$("network").addEventListener("click", async () => {
  try {
    if (!window.ethereum) throw new Error("No compatible browser wallet. Install a trusted EIP-1193 wallet.");
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: "0xabe5", chainName: "QDay Aevum Testnet",
      nativeCurrency: { name: "tQDAY Testnet", symbol: "tQDAY", decimals: 18 },
      rpcUrls: [AEVUM_RPC], blockExplorerUrls: [AEVUM_EXPLORER]
    }] });
    setOut("pay-result", "Wallet network request completed. Inspect the network details inside your wallet.", "warn");
  } catch (e) { setOut("pay-result", e.message, "error"); }
});
$("pay").addEventListener("click", async () => {
  try {
    invoice = details();
    if (!window.ethereum) throw new Error("No EIP-1193 wallet found.");
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(chain) !== BigInt(AEVUM_CHAIN_ID)) throw new Error("Wallet is not on Aevum Testnet 44005. Switch manually first.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.[0]) throw new Error("No wallet account approved.");
    const data = encodeTransfer(invoice.merchant, invoice.amount);
    setOut("pay-result", "Review the upcoming WALLET transaction: " + invoice.amount + " TEST tUSD8 to " + invoice.merchant + ". Do not approve if anything differs.", "warn");
    const hash = await window.ethereum.request({ method: "eth_sendTransaction",
      params: [{ from: accounts[0], to: TUSD8, value: "0x0", data }] });
    $("transaction").value = txHash(hash);
    $("explorer").disabled = false;
    setOut("pay-result", "Wallet submitted testnet transaction " + hash + ". Not paid until confirmed independently.", "warn");
  } catch (e) { setOut("pay-result", "No payment proved: " + e.message, "error"); }
});
$("verify").addEventListener("click", async () => {
  try {
    invoice = details();
    const hash = txHash($("transaction").value.trim());
    setOut("pay-result", "Reading QDay Aevum blockchain; no wallet signature is requested.", "warn");
    const chain = await rpc("eth_chainId");
    if (BigInt(chain) !== BigInt(AEVUM_CHAIN_ID)) throw new Error("Configured RPC returned the wrong network.");
    const [transaction, receipt, head] = await Promise.all([
      rpc("eth_getTransactionByHash", [hash]), rpc("eth_getTransactionReceipt", [hash]), rpc("eth_blockNumber")
    ]);
    const result = verifyPayment(invoice, hash, transaction, receipt, head, chain);
    $("explorer").disabled = false;
    if (result.ok) setOut("pay-result", "VERIFIED ON-CHAIN · " + result.confirmations + " confirmations\n"
      + invoice.amount + " test tUSD8 from " + short(result.payer) + " to " + short(invoice.merchant)
      + "\nTX " + hash + "\nReference " + invoice.ref + " is a local label only.", "good");
    else setOut("pay-result", result.status.toUpperCase() + " · " + result.reason +
      (result.confirmations ? " · " + result.confirmations + " confirmations" : "") + "\nNo paid status recorded.", result.status === "rejected" ? "error" : "warn");
  } catch (e) { setOut("pay-result", "Verification unavailable: " + e.message + ". No payment is proven.", "error"); }
});
$("explorer").addEventListener("click", () => {
  try { const hash = txHash($("transaction").value.trim()); window.open(AEVUM_EXPLORER + "/tx/" + hash, "_blank", "noopener,noreferrer"); }
  catch (e) { setOut("pay-result", e.message, "error"); }
});
