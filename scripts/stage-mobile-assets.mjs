import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// Run from the public repository root. Private source stays in the sibling repository.
const input=path.resolve(process.argv[2]||'../private/site-mobile');
const destinationRoot=path.resolve('android-training-test/app/build/generated/mobile-assets');
const evidence=JSON.parse(fs.readFileSync(path.join(input,'build-evidence.json'),'utf8'));
if(JSON.stringify(evidence.networks)!==JSON.stringify(['attack'])||JSON.stringify(evidence.legacyInference)!==JSON.stringify(['dual'])||evidence.enhancedDefense!==true)throw Error('Expected the approved mobile payload');
// The shared duel helper contains program deployment only, no C network/runtime.
if(evidence.inputs.some(p=>/[\\/]avatar[\\/]c[\\/]/.test(p)&&p.replaceAll('\\','/')!=='src/avatar/c/duel.mjs'))throw Error('C implementation is not allowed');
const files=[];
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlinks not accepted');const file=path.join(dir,e.name);if(e.isDirectory())visit(file);else{const rel=path.relative(input,file);if(rel==='build-evidence.json')continue;if(!/\.(?:html|css|js|json|txt)$/.test(rel))throw Error('Unexpected asset extension');files.push({file,rel});}}}
visit(input);if(!files.some(f=>f.rel==='index.html'))throw Error('Missing entry');
const digest=crypto.createHash('sha256');for(const f of files.sort((a,b)=>a.rel.localeCompare(b.rel))){digest.update(f.rel);digest.update(fs.readFileSync(f.file));}
const destination=path.join(destinationRoot,digest.digest('hex').slice(0,16));
// Refuse stale mixed payloads instead of deleting an existing staging directory.
if(fs.existsSync(destination)&&fs.readdirSync(destination).length)throw Error('Use a fresh CI checkout/build directory; staging already exists');
for(const {file,rel} of files){const target=path.join(destination,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
console.log(JSON.stringify({files:files.length,indexSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(destination,'index.html'))).digest('hex'),gradleProperty:'-PmobileAssetsDir='+destination}));
