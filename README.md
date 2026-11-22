# LDN Invoice Guard — Aevum tUSD8 payment proof

> **2026-11-22 status:** A functioning **publicly deployed** testnet invoice prototype, [live interface](https://luxedigitalnest.github.io/ldn-aevum-invoice-guard/), [original narrated 2m35s demo](https://luxedigitalnest.github.io/ldn-aevum-invoice-guard/demo.html), 18 passing unit tests, and 4 passing live read-only Aevum RPC checks. **No genuine Aevum tUSD8 payment, on-chain settlement receipt, prize, or judged hackathon submission is claimed.** The official tQDAY/tUSD8 faucet reports the linked wallet ineligible for the mainnet-holdings rule. This is a testnet educational prototype, **not production merchant checkout**.

An original, noncustodial **Invoice Payments / Confirmation of Payee** entry under development for [QDay Aevum Builder Challenge #1](https://qday.io/builder-challenge). Build period is Nov 16–Dec 11, **2026-12-11 08:00 UTC** cutoff.

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

## Outstanding before legitimate hackathon submission

- [x] Original documented code and deterministic verifier test suite (18 local tests passed Nov22).
- [ ] Live read-only QDay Aevum RPC check with real chain ID, official token bytecode and decimals.
- [ ] Public GitHub source and accessible static application.
- [ ] **Actual owner-authorized testnet wallet transfer** with real tUSD8, confirmed on Aevum, transaction hash, screenshot and legitimate invoice mapping. Never sign on the user's behalf without owner approval.
- [ ] Browser smoke test and accessible UI review against a **real** transaction.
- [ ] Genuine original 3–5-minute demo or equivalent organizer deliverable.
- [ ] DoraHacks **event registration** and **final project submission** — both must be separately verified (do not submit a test-only concept as a finished payment integration).

**Submission deadline:** 11 December 2026 08:00 UTC. Selection of top 5 and prize assessment is discretionary, and any cash prize requires organizer validation.

© 2026 LuxeDigitalNest. MIT license.
