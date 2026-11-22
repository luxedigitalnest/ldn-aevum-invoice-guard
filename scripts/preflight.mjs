// Read-only QDay Aevum RPC health proof; never signs, never transfers.
import { rpc, AEVUM_CHAIN_ID, TUSD8 } from "../src/core.mjs";
const safe = async (name, method, params = []) => {
  try { const result = await rpc(method, params); return { name, ok: true, result }; }
  catch (e) { return { name, ok: false, error: String(e.message).slice(0, 200) }; }
};
const chain = await safe("chainId", "eth_chainId");
const block = await safe("blockNumber", "eth_blockNumber");
const code = await safe("tokenCode", "eth_getCode", [TUSD8, "latest"]);
const dec = await safe("tokenDecimals", "eth_call", [{to: TUSD8, data: "0x313ce567"}, "latest"]);
const checks = {
  chainId44005: chain.ok && Number(BigInt(chain.result)) === AEVUM_CHAIN_ID,
  nonzeroBytecode: code.ok && typeof code.result === "string" && /^0x[0-9a-f]+$/i.test(code.result) && code.result.length > 2,
  sixDecimals: dec.ok && Number(BigInt(dec.result)) === 6,
  currentBlock: block.ok && BigInt(block.result) > 0n
};
console.log(JSON.stringify({ observation: new Date().toISOString(), readOnly: true,
  rpc: "https://rpc-test.qday.info", token: TUSD8, checks,
  block: block.ok ? block.result : null,
  errors: [chain, block, code, dec].filter(x => !x.ok).map(x => x.name + ": " + x.error)
}, null, 2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 2;
