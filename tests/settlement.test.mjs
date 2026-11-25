import test from "node:test";
import assert from "node:assert/strict";
import {bindVerifiedPayment, STORAGE_KEY} from "../src/settlement.mjs";
const merchant="0x"+"a".repeat(40), hash="0x"+"1".repeat(64), another="0x"+"2".repeat(64);
const inv={merchant,amount:"0.001",ref:"INV-001"};
const ok=t=>({ok:true,status:"verified",txHash:t});
function store(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
test("new verified transaction binds once; exact replay is idempotent",()=>{const s=store();assert.equal(bindVerifiedPayment(s,inv,hash,ok(hash)).status,"bound");assert.equal(bindVerifiedPayment(s,inv,hash.toUpperCase().replace("0X","0x"),ok(hash)).status,"already-bound");assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).length,1)});
test("same hash cannot settle another invoice",()=>{const s=store();bindVerifiedPayment(s,inv,hash,ok(hash));assert.throws(()=>bindVerifiedPayment(s,{...inv,ref:"INV-002"},hash,ok(hash)),/different invoice/)});
test("same invoice cannot accept another transfer",()=>{const s=store();bindVerifiedPayment(s,inv,hash,ok(hash));assert.throws(()=>bindVerifiedPayment(s,inv,another,ok(another)),/another payment/)});
test("same reference and merchant cannot change amount",()=>{const s=store();bindVerifiedPayment(s,inv,hash,ok(hash));assert.throws(()=>bindVerifiedPayment(s,{...inv,amount:"0.002"},another,ok(another)),/another payment/)});
test("unverified or mismatched transaction cannot bind",()=>{const s=store();assert.throws(()=>bindVerifiedPayment(s,inv,hash,{ok:false}),/verification/);assert.throws(()=>bindVerifiedPayment(s,inv,hash,ok(another)),/verification/);assert.equal(s.getItem(STORAGE_KEY),null)});
test("malformed history fails closed",()=>{const s=store();s.setItem(STORAGE_KEY,"{}");assert.throws(()=>bindVerifiedPayment(s,inv,hash,ok(hash)),/invalid/)});
test("storage failure never reports a recorded allocation",()=>{const s={getItem:()=>null,setItem:()=>{throw Error("quota")}};assert.throws(()=>bindVerifiedPayment(s,inv,hash,ok(hash)),/quota/)});
test("canonical amount spelling does not create another invoice",()=>{const s=store();bindVerifiedPayment(s,inv,hash,ok(hash));assert.equal(bindVerifiedPayment(s,{...inv,amount:"0.001000"},hash,ok(hash)).status,"already-bound")});
