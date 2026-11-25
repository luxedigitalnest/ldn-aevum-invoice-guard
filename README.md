# LDN Invoice Guard — Aevum tUSD8 payment proof

> **2026-11-22 verified update:** The [public Invoice Guard](https://luxedigitalnest.github.io/ldn-aevum-invoice-guard/), [original narrated 2m35s prototype demo](https://luxedigitalnest.github.io/ldn-aevum-invoice-guard/demo.html), 18 passing unit tests, and live Aevum read-only RPC checks are published. Original [DoraHacks BUIDL #51645](https://dorahacks.io/build/51645) has been **submitted and is under organizer review**; no prize has been awarded. The project wallet received **1 test tQDAY and 5 test tUSD8** via the official QDay Discord faucet, verified by successful chain 44005 receipts and token balances. **A real invoice-payment transaction has NOT yet been signed, settled or verified.** This remains an educational testnet prototype, **not production merchant checkout**.

An original, noncustodial **Invoice Payments / Confirmation of Payee** entry under development for [QDay Aevum Builder Challenge #1](https://qday.io/builder-challenge). Build period is Nov 16–Dec 11, **2026-12-11 08:00 UTC** cutoff.

## Verified free testnet funding (22 November 2026)

The **QDay Official Discord faucet** issued a one-time, free testnet allocation to the existing project wallet `0xADFC0cb6819BC49939b021E45b0d43306575e5d3` (no real assets purchased):

- [1 tQDAY transfer](https://explorer-test.qday.info/tx/0x9b40633a04bcf42017543245821bbb4582d5054091332c174e5e3414daeac75e) — success `status=1`, Aevum block `3856363`, native value `1000000000000000000` wei.
- [5 tUSD8 transfer](https://explorer-test.qday.info/tx/0x466bd69301104fc1d81c96737591197670c3a52861b43c9fc940fdd28ae8483d) — success `status=1`, same block, ERC-20 transfer event.
- Independent JSON-RPC balance checks: native balance `1.0 tQDAY`; `balanceOf` on the official tUSD8 token contract returned `5000000` units / `5.0 tUSD8`; 720 confirmations were observed at testnet head `3857082`.

**These receipts are faucet funding, not an invoice settlement.** Never present them as a successful merchant payment or claim tokens again for the same identity. The next genuine milestone is one explicit owner-authorized tUSD8 payment to a clearly confirmed merchant address, followed by proof of the exact recipient, amount, payer, Transfer event and at least six confirmations.

## What it does

1. Merchant enters a **recipient EVM address**, exact positive **tUSD8** amount (maximum 6 decimal places), and a local invoice reference.
2. Browser generates a shareable, no-login invoice URL. This is a **request**, not a payment receipt.
3. Payer opens it, reviews the merchant in their wallet and explicitly authorizes an **ERC-20 direct transfer** (not approval/transferFrom) on **QDay Aevum Testnet**. Our application **never** signs automatically or holds keys.
4. Payer or merchant pastes the resulting Aevum transaction hash. The app independently requests `eth_chainId`, `eth_getTransactionByHash`, `eth_getTransactionReceipt` and `eth_blockNumber` from QDay's documented read-only RPC.
5. The UI marks VERIFIED only if all match: chain ID 44005, official tUSD8 token, transaction hash, direct ERC-20 `transfer(merchant, exactUnits)` calldata, no native value, mined success receipt and matching on-chain `Transfer` event showing exact payer / merchant / 6-decimal amount, with **at least 6 block confirmations**. Missing/reverted/incorrect/immature transfers are never labeled paid.

No external npm dependencies, no backend custody, no access tokens, no analytics, no tracking cookies. This implementation is original; QDay's official network/token parameters are cited.

## Quick start

Requires Node.js 22+; browser with an EIP-1193 EVM wallet is optional for read-only proof viewing.

```sh
npm test
npm run serve
```

Open **http://127.0.0.1:4173**. For live chain check, run `node scripts/preflight.mjs` to inspect public RPC chain, token bytecode, and token decimals **without signing**.

### Canonical QDay configuration

| Field | Value | Source |
|---|---|---|
| Network | **Aevum Testnet**, ID **44005** / `0xabe5` | [Official QDay chain parameters](https://wiki.qday.info/Knowledge/reference/chains) |
| RPC | `https://rpc-test.qday.info` | [Official FAQ](https://wiki.qday.info/guide/faq/) |
| Block explorer | `https://explorer-test.qday.info` | [Official chain parameters](https://wiki.qday.info/Knowledge/reference/chains) |
| Test ERC-20 | **tUSD8** at `0x456569838f1d43009A91ebA4263147Afd7233483` | [Official token list](https://wiki.qday.info/Knowledge/reference/tokens) |
| Decimals | **6** | [Official token list](https://wiki.qday.info/Knowledge/reference/tokens) |
| Gas currency | **tQDAY testnet only** | [Official faucet](https://faucet.qday.info/en) |
| Organizer | [Aevum Builder Challenge #1](https://qday.io/builder-challenge) | $1,500 competitive total; **nothing earned or guaranteed** |

**Warning:** Do not confuse Aevum chain `44005` with QDay Origin chains `44001` and `44003`; test tokens have no monetary value.

## Architecture

```text
Merchant --(invoice URL: ref,to,amount)--> Payer
   |                                     |
   |                         explicit wallet confirmation
   |                                     v
   |                        Aevum tUSD8.transfer(...)
   |                                     |
   +----------- paste real TX hash -------+
                         |
                  read-only QDay RPC
             tx + receipt + logs + head
                         |
       exact checks + >=6 block confirmations
                         |
                  VERIFIED / NOT PAID
```

The local invoice reference is **not** embedded in a standard token transfer. The verifying merchant **must** maintain a separate one-to-one map of invoice IDs to transaction hashes; a real transfer to the same recipient for the same amount could otherwise be shown against several off-chain invoices. There is no guarantee that a payer intended to settle a particular invoice. This prototype is a proof verifier, **not** an accounting ledger or dispute-resolution engine.

### Safety and limitations

- Any person with a URL may replace the merchant address in the link. Confirm the recipient independently before signing. The app does **not** enforce Ethereum EIP-55 mixed-case checksum; users must compare the **entire** recipient address.
- Six observed blocks reduce accidental premature confirmation but are **not absolute finality**, no guarantee against deep reorganizations or RPC errors. The single RPC is a trust dependency. Merchant should cross-check an independent explorer for high-stakes transactions.
- A `VERIFIED` proof is on-chain **test token** transfer evidence only, not fiat value, KYC, legal settlement, beneficiary identity, title to goods or a mainnet payment.
- Read-only network access may fail from a browser due to CORS or endpoint availability; such failure is shown as **unverified**, never assumed paid.
- This app does not request allowance, `approve`, `transferFrom`, wallet seeds, private keys or wallet-exported secrets.
- The application does not create a recipient account or choose an automatic merchant address. Only user-entered recipient addresses are used.
- Security-sensitive actions are initiated only by a direct user click and wallet confirmation. A separate operator/owner must approve any actual testnet transfer.

## Tests / validation

`npm test` checks exact fixed-point math, calldata encoding, address and hash validation, original invoice label validation, successful six-confirmation proof and negative cases for wrong network/contract/merchant/amount/value, revert, forged logs, mismatched hash, wrong block and immature or unmined receipts. Tests use entirely synthetic sample transactions; **they are not blockchain receipts**.

## Live negative-chain verification checkpoint (23 November 2026)

On the [public browser app](https://luxedigitalnest.github.io/ldn-aevum-invoice-guard/), an unsigned sample invoice was generated for recipient `0xadfc0cb6819bc49939b021e45b0d43306575e5d3`, **0.001 tUSD8**, reference `LDN-QDAY-UNSIGNED-20261123`. The published [5 tUSD8 faucet-funding transaction](https://explorer-test.qday.info/tx/0x466bd69301104fc1d81c96737591197670c3a52861b43c9fc940fdd28ae8483d) was then entered as an intentionally mismatching proof. The browser's live read-only verification returned:

> **REJECTED · Wrong merchant, amount, or method**  
> **No paid status recorded.**

This is a **real negative test** against an existing faucet receipt, **not a merchant invoice payment**, not a successful end-to-end settlement, and not new tokens earned. No wallet signature or transfer was initiated. The exact recipient and amount must be independently reviewed before any later owner-approved testnet payment.

## Submitted build: remaining technical proof before judging

- [x] Original documented code and deterministic verifier test suite (18 local tests passed Nov22).
- [x] Live read-only QDay Aevum RPC check with real chain ID, official token bytecode and decimals.
- [x] Public GitHub source and accessible static application.
- [ ] **Actual owner-authorized testnet wallet transfer** with real tUSD8, confirmed on Aevum, transaction hash, screenshot and legitimate invoice mapping. Never sign on the user's behalf without owner approval.
- [ ] Browser smoke test and accessible UI review against a **real** transaction.
- [ ] Genuine original 3–5-minute demo or equivalent organizer deliverable.
- [x] DoraHacks **event registration and original project submission** — existing [BUIDL #51645](https://dorahacks.io/build/51645) is under organizer review. The prototype is accurately labeled; **not** represented as an end-to-end paid invoice.

**Submission deadline:** 11 December 2026 08:00 UTC. Selection of top 5 and prize assessment is discretionary, and any cash prize requires organizer validation.

© 2026 LuxeDigitalNest. MIT license.


## Draft security improvement — 24 November 2026

The `local-invoice-reuse-guard` review branch adds a browser-local one-to-one invoice/transaction binding after successful on-chain verification. It serializes binding operations using Web Locks and fails closed when storage or locking is unavailable. An exact repeat is idempotent; the same transaction cannot be assigned to a different invoice, nor can the same merchant/reference be changed to a new amount or transaction. The local reference is still off-chain. Clearing browser storage, changing origin/device, or using a modified client bypasses this protection; a merchant still requires an authoritative shared ledger. Browser behavior was independently tested in [GitHub Actions run 45418668559](https://github.com/luxedigitalnest/ldn-aevum-invoice-guard/actions/runs/45418668559): one synthetic Playwright scenario passed, confirming binding, persistence after reload, and duplicate rejection in another tab of the same browser. This does not establish cross-device or merchant-wide settlement.

Windows Node.js syntax check and `npm test` at commit `1ea82e5a40deb9a93f1014ee5d637a75ce1e8577` returned 26 passing tests, 0 failures, including 8 new binding tests. These are synthetic test fixtures, not actual settlement. No new wallet transaction was initiated. The live main branch and submitted BUIDL remain unchanged.
