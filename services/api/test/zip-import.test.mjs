import test from 'node:test';import assert from 'node:assert/strict';import {zipSync,strToU8} from 'fflate';import {validateSmallZip} from '../dist/zipImport.js';
test('small ZIP imports actual text and skips dependency folders',()=>{
 const zip=zipSync({'src/main.kt':strToU8('fun main() = println("ok")'),'README.md':strToU8('Project'),'node_modules/pkg/index.js':strToU8('ignored')});
 const result=validateSmallZip(zip);assert.deepEqual(result.files.map(f=>f.path).sort(),['README.md','src/main.kt']);assert.equal(result.skipped,1);assert.equal(new TextDecoder().decode(result.files.find(f=>f.path==='src/main.kt').bytes),'fun main() = println("ok")');
});
test('ZIP rejects traversal, symlinks, compression bombs and invalid files',()=>{
 assert.throws(()=>validateSmallZip(zipSync({'../escape.txt':strToU8('x')})),e=>e.code==='ARCHIVE_UNSAFE_PATH');
 const link=zipSync({'link.txt':strToU8('target')});const view=new DataView(link.buffer,link.byteOffset,link.byteLength);let offset=0;while(view.getUint32(offset,true)!==0x02014b50)offset++;view.setUint32(offset+38,0o120777*65536,true);
 assert.throws(()=>validateSmallZip(link),e=>e.code==='ARCHIVE_SYMLINK');
 assert.throws(()=>validateSmallZip(zipSync({'bomb.txt':new Uint8Array(2*1024*1024)})),e=>e.code==='ARCHIVE_BOMB');
 assert.throws(()=>validateSmallZip(strToU8('not a zip')),e=>e.code==='ARCHIVE_INVALID');
});
test('ZIP enforces compressed size, file count and extracted byte budget before extraction',()=>{
 assert.throws(()=>validateSmallZip(new Uint8Array(3*1024*1024+1)),e=>e.code==='ARCHIVE_TOO_LARGE');
 const files=Object.fromEntries(Array.from({length:201},(_,i)=>[`${i}.txt`,strToU8('file')]));assert.throws(()=>validateSmallZip(zipSync(files)),e=>e.code==='ARCHIVE_TOO_MANY_FILES');
 assert.throws(()=>validateSmallZip(zipSync({'large.txt':new Uint8Array(9*1024*1024)})),e=>e.code==='ARCHIVE_EXTRACTED_TOO_LARGE');
});
