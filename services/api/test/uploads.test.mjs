import test from 'node:test';import assert from 'node:assert/strict';
import {uploadInput,imageSignature} from '../dist/uploads.js';import {selectCandidates} from '../dist/routing.js';
test('uploads validate explicit consent, bounded sizes and supported vision previews',()=>{
 const file={name:'image.jpg',mime:'image/jpeg',size:2048,purpose:'VISION',confirmUpload:true};assert.equal(uploadInput.parse(file).size,2048);
 for(const changed of [{confirmUpload:false},{size:0},{size:52428801},{mime:'text/html'},{mime:'video/mp4'},{size:1048577},{extra:'forged'}])assert.equal(uploadInput.safeParse({...file,...changed}).success,false);
 assert.equal(uploadInput.parse({...file,name:'../x\n.jpg'}).name,'.._x_.jpg');
});
test('manual and auto preferences cannot bypass failed models or provider kill switches',()=>{
 const model={id:'model',provider_id:'provider',external_model_id:'chat',display_name:'chat',price_class:'UNKNOWN',context_length:4096,status:'ONLINE',is_available:true,capabilities_json:{chat:'SUPPORTED'},metadata_json:{}};
 for(const mode of ['MANUAL','AUTO']){
  const base={mode,models:[model],providers:[],preferredModelId:'model',fallbackEnabled:true};
  assert.deepEqual(selectCandidates(base),[]);
  assert.deepEqual(selectCandidates({...base,providers:[{id:'provider',status:'DISABLED'}]}),[]);
  assert.deepEqual(selectCandidates({...base,models:[{...model,status:'FAILED'}],providers:[{id:'provider',status:'ONLINE'}]}),[]);
  assert.equal(selectCandidates({...base,providers:[{id:'provider',status:'ONLINE'}]}).length,1);
 }
});

test('vision previews reject renamed documents and unknown file signatures',()=>{
 assert.equal(imageSignature(new Uint8Array([255,216,255]),'image/jpeg'),true);
 assert.equal(imageSignature(new TextEncoder().encode('<html>'),'image/jpeg'),false);
 assert.equal(imageSignature(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);
 assert.equal(imageSignature(new TextEncoder().encode('RIFF0000WEBP'),'image/webp'),true);
 assert.equal(imageSignature(new Uint8Array([]),'image/png'),false);
});
