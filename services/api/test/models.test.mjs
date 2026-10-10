import test from 'node:test';import assert from 'node:assert/strict';import {normalizeModel} from '../dist/models.js';
test('model prices keep empty/missing/negative prices unknown and distinguish reported vs verified free',()=>{
 const row={id:'model',pricing:{prompt:'0',completion:'0'}};
 assert.equal(normalizeModel(row,'OPENROUTER').price_class,'FREE_VERIFIED');
 assert.equal(normalizeModel(row,'CUSTOM').price_class,'FREE_REPORTED');
 for(const pricing of [{prompt:'',completion:''},{prompt:'-1',completion:'0'},{prompt:'NaN',completion:'0'},{}])assert.equal(normalizeModel({id:'model',pricing},'OPENROUTER').price_class,'UNKNOWN');
 assert.equal(normalizeModel({id:'model',pricing:{prompt:'0.000001',completion:'0.000003'}},'OPENROUTER').price_class,'PAID');
});
