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

async function mockReceipt(context, delay = 0) {
  await context.route('https://rpc-test.qday.info/**', async route => {
    if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
    const req=route.request().postDataJSON();
    if(!Object.hasOwn(fixture,req.method)) throw Error('Unexpected RPC method');
    if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:req.id,result:fixture[req.method]})});
  });
}
test('editing a verified invoice invalidates its proof and old share link',async({context,page})=>{
  await mockReceipt(context);
  await page.goto(origin+'/index.html');
  await verify(page,'INV-001');
  await expect(page.locator('#pay-result')).toContainText('VERIFIED ON-CHAIN');
  await page.locator('#create').click();
  await expect(page.locator('#copy')).toBeEnabled();
  await page.locator('#reference').fill('INV-002');
  await expect(page.locator('#pay-result')).toContainText('Current payment is not verified');
  await expect(page.locator('#pay-result')).toHaveAttribute('data-kind','warn');
  await expect(page.locator('#copy')).toBeDisabled();
  await expect(page.locator('#explorer')).toBeDisabled();
  await expect(page.locator('#create-result')).toContainText('Create a new link');
});
test('pending verification locks controls and rejects a programmatic invoice change',async({context,page})=>{
  await mockReceipt(context,500);
  await page.goto(origin+'/index.html');
  await verify(page,'INV-001');
  await expect(page.locator('#verify')).toBeDisabled();
  await expect(page.locator('#pay')).toBeDisabled();
  await expect(page.locator('#reference')).toBeDisabled();
  await page.locator('#reference').evaluate(el=>{el.value='INV-002';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#pay-result')).toContainText('Invoice or transaction changed');
  await expect(page.locator('#verify')).toBeEnabled();
  expect(await page.evaluate(()=>localStorage.getItem('ldn-aevum-invoice-bindings-v1'))).toBeNull();
});
test('wallet network change during account approval prevents transaction request',async({page})=>{
  await page.addInitScript(()=>{
    let calls=0;
    window.walletMethods=[];
    window.ethereum={request:async({method})=>{
      window.walletMethods.push(method);
      if(method==='eth_chainId') return ++calls===1?'0xabe5':'0x1';
      if(method==='eth_requestAccounts') return ['0x'+'b'.repeat(40)];
      throw Error('Unexpected wallet call');
    }};
  });
  await page.goto(origin+'/index.html');
  await page.locator('#merchant').fill(merchant);
  await page.locator('#amount').fill('0.001');
  await page.locator('#reference').fill('INV-001');
  await page.locator('#pay').click();
  await expect(page.locator('#pay-result')).toContainText('Wallet network changed');
  await expect(page.locator('#pay')).toBeEnabled();
  expect(await page.evaluate(()=>window.walletMethods)).toEqual(['eth_chainId','eth_requestAccounts','eth_chainId']);
});
