import test from "node:test";
import assert from "node:assert/strict";
import { AEVUM_CHAIN_ID, TUSD8, TRANSFER_TOPIC, address, amountUnits,
  formatUnits, encodeTransfer, makeInvoice, topicAddress, txHash, verifyPayment } from "../src/core.mjs";

const merchant = "0x1111111111111111111111111111111111111111";
const payer = "0x2222222222222222222222222222222222222222";
const hash = "0x" + "a".repeat(64);
const invoice = makeInvoice({ ref: "LDN-001", merchant, amount: "25.50" });
function fixture() {
  const transaction = { hash, to: TUSD8, from: payer, value: "0x0", input: encodeTransfer(merchant, "25.5"), blockNumber: "0x64" };
  const receipt = { transactionHash: hash, status: "0x1", blockNumber: "0x64", logs: [
    { address: TUSD8, removed: false, topics: [TRANSFER_TOPIC, topicAddress(payer), topicAddress(merchant)],
      data: "0x" + amountUnits("25.5").toString(16).padStart(64, "0") }
  ] };
  return { transaction, receipt };
}
function run(opts = {}) {
  const { transaction, receipt } = fixture();
  Object.assign(transaction, opts.transaction || {});
  Object.assign(receipt, opts.receipt || {});
  return verifyPayment(opts.invoice || invoice, opts.hash || hash,
    opts.noTransaction ? null : transaction, opts.noReceipt ? null : receipt,
    opts.head || "0x6a", opts.chain || "0xabe5", opts.min || 6);
}
test("QDay Aevum chain ID", () => assert.equal(AEVUM_CHAIN_ID, 44005));
test("strict 6-decimal amount and format", () => {
  assert.equal(amountUnits("25.000001"), 25000001n);
  assert.equal(formatUnits(25000001n), "25.000001");
  assert.equal(amountUnits("25.50"), 25500000n);
  assert.equal(formatUnits(25000000n), "25");
});
test("reject zero, negative, excess precision, exponent and grouping", () => {
  for (const bad of ["0", "-1", "0.0000001", "1e6", "1,000", "1.2.3", "  ", "00.1"])
    assert.throws(() => amountUnits(bad), Error, bad);
});
test("reject invalid merchant, zero, and reference", () => {
  assert.throws(() => address("0x123"), Error);
  assert.throws(() => address("0x" + "0".repeat(40)), Error);
  assert.throws(() => makeInvoice({ merchant, amount: "1", ref: "<script>" }), Error);
});
test("encode transfer uses 6 decimals without float", () => {
  assert.equal(encodeTransfer(merchant, "25.5"),
    "0xa9059cbb" + merchant.slice(2).padStart(64, "0") + (25500000n).toString(16).padStart(64, "0"));
});
test("transaction hash validator rejects partial and extra chars", () => {
  assert.throws(() => txHash("0x" + "1".repeat(63)), Error);
  assert.throws(() => txHash("0x" + "z".repeat(64)), Error);
});
test("valid exact tUSD8 transfer verified after 6 confirmations", () => {
  const r = run();
  assert.equal(r.ok, true);
  assert.equal(r.status, "verified");
  assert.equal(r.confirmations, 7);
  assert.equal(r.payer, payer);
});
test("five confirmations remain pending", () => {
  const r = run({ head: "0x68" });
  assert.equal(r.ok, false);
  assert.equal(r.status, "confirming");
  assert.equal(r.confirmations, 5);
});
test("unmined transaction remains pending", () => {
  assert.equal(run({ noReceipt: true }).status, "pending");
  assert.equal(run({ noTransaction: true }).status, "pending");
});
test("reject chain mismatch", () => assert.match(run({ chain: "0x1" }).reason, /Wrong network/));
test("reject wrong token contract", () => assert.match(run({ transaction: { to: merchant } }).reason, /official tUSD8/));
test("reject incorrect recipient or amount in calldata", () => {
  assert.match(run({ transaction: { input: encodeTransfer(payer, "25.5") } }).reason, /Wrong merchant/);
  assert.match(run({ transaction: { input: encodeTransfer(merchant, "26") } }).reason, /Wrong merchant/);
});
test("reject native-coin payment masquerading as stablecoin", () => assert.match(run({ transaction: { value: "0x1" } }).reason, /native value/));
test("reject reverted transaction", () => assert.match(run({ receipt: { status: "0x0" } }).reason, /reverted/));
test("reject forged log, wrong amount or wrong payer", () => {
  const { receipt: badValue } = fixture();
  badValue.logs[0].data = "0x" + (1n).toString(16).padStart(64, "0");
  assert.match(run({ receipt: { logs: badValue.logs } }).reason, /No matching/);
  const { receipt: wrongPayer } = fixture();
  wrongPayer.logs[0].topics[1] = topicAddress(merchant);
  assert.match(run({ receipt: { logs: wrongPayer.logs } }).reason, /No matching/);
});
test("reject hash mismatch and receipt block mismatch", () => {
  assert.match(run({ transaction: { hash: "0x" + "b".repeat(64) } }).reason, /hash mismatch/);
  assert.match(run({ receipt: { blockNumber: "0x65" } }).reason, /Inconsistent block/);
});
test("reject future receipt block", () => assert.match(run({ head: "0x63" }).reason, /head is behind/));
test("a normal status requires a matching event on the token itself", () => {
  const { receipt } = fixture();
  receipt.logs[0].address = payer;
  assert.equal(run({ receipt: { logs: receipt.logs } }).ok, false);
});
