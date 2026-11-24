import { test, expect } from '@playwright/test';
const merchant='0x'+'a'.repeat(40), payer='0x'+'b'.repeat(40), hash='0x'+'1'.repeat(64);
const token='0x456569838f1d43009A91ebA4263147Afd7233483';
const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad=a=>'0x'+a.slice(2).padStart(64,'0');
const units=(1000).toString(16).padStart(64,'0');
const fixture={
 eth_chainId:'0xabe5',eth_blockNumber:'0x106',
 eth_getTransactionByHash:{hash,to:token,from:payer,value:'0x0',input:'0xa9059cbb'+merchant.slice(2).padStart(64,'0')+units,blockNumber:'0x100'},
 eth_getTransactionReceipt:{transactionHash:hash,status:'0x1',blockNumber:'0x100',logs:[{address:token,topics:[topic,pad(payer),pad(merchant)],data:'0x'+units}]}
};
const origin='http://127.0.0.1:4173';
async function verify(page,ref){
 await page.locator('#merchant').fill(merchant);
 await page.locator('#amount').fill('0.001');
 await page.locator('#reference').fill(ref);
 await page.locator('#transaction').fill(hash);
 await page.locator('#verify').click();
}
test('synthetic receipt binds once, survives reload and blocks reuse in another tab',async({context,page})=>{
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(origin+'/')) return route.continue();
  if(url==='https://rpc-test.qday.info/'||url==='https://rpc-test.qday.info'){
   if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
   const req=route.request().postDataJSON();
   if(!Object.hasOwn(fixture,req.method)) throw Error('Unexpected RPC method');
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:req.id,result:fixture[req.method]})});
  }
  return route.abort();
 });
 await page.goto(origin+'/index.html');
 await verify(page,'INV-001');
 await expect(page.locator('#pay-result')).toContainText('bound in this browser only');
 await page.reload();
 await verify(page,'INV-001');
 await expect(page.locator('#pay-result')).toContainText('already-bound');
 const second=await context.newPage();
 await second.goto(origin+'/index.html');
 await verify(second,'INV-002');
 await expect(second.locator('#pay-result')).toContainText('already bound to a different invoice');
 await expect(second.locator('#pay-result')).toHaveAttribute('data-kind','error');
 expect(await second.evaluate(()=>JSON.parse(localStorage.getItem('ldn-aevum-invoice-bindings-v1')).length)).toBe(1);
});
