import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),manifest=JSON.parse(await fs.readFile('docs/art/manifest.json','utf8'));
if(manifest.status!=='reference_only'||manifest.images.length<4)throw Error('Expected reference-only ASTRA boards');
const ids=new Set(manifest.images.map(image=>image.id));
if(ids.size!==manifest.images.length)throw Error('Duplicate art reference IDs');
for(const group of manifest.collections??[])for(const id of group.imageIds)if(!ids.has(id))throw Error('Missing collection image: '+id);
for(const file of await fs.readdir('docs/art'))if(file.endsWith('.png')&&!manifest.images.some(image=>image.path===`docs/art/${file}`))throw Error('PNG missing provenance: '+file);
for(const entry of manifest.images){
 const filename=path.resolve(root,entry.path);if(!filename.startsWith(path.join(root,'docs','art')+path.sep))throw Error('Art path outside the reference folder');
 const data=await fs.readFile(filename);
 if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not a PNG: '+entry.path);
 if(createHash('sha256').update(data).digest('hex')!==entry.sha256||data.length!==entry.bytes)throw Error('Art integrity mismatch: '+entry.path);
 if(data.readUInt32BE(16)!==entry.width||data.readUInt32BE(20)!==entry.height)throw Error('Art dimensions mismatch: '+entry.path);
 if(entry.runtimeAsset!==false||entry.aiGenerated!==true||entry.visibleAiLabel!==true||!entry.credit||!entry.rights)throw Error('Incomplete concept provenance: '+entry.path);
 console.log(`${entry.id}: ${entry.width}x${entry.height}, SHA-256 verified, reference only`);
}
console.log(`${manifest.images.length} concept boards verified. Labels were visually inspected; this is not OCR, rig or GPU validation.`);
const beats=JSON.parse(await fs.readFile('content-design/narrative-beats.json','utf8'));
const targetSource=await fs.readFile('src/world/manifest.ts','utf8');
const worldIds=new Set([...targetSource.matchAll(/target\(\s*['"][a-z]+['"]\s*,\s*['"]([^'"]+)/g)].map(match=>match[1]));
for(const beat of beats.beats){
 for(const id of Array.isArray(beat.targetWorldId)?beat.targetWorldId:[beat.targetWorldId])if(id&&!worldIds.has(id))throw Error('Narrative target not in current world: '+id);
}
for(const board of beats.storyboards)if(!manifest.images.some(image=>image.path===board))throw Error('Narrative board missing provenance: '+board);
console.log(`${beats.beats.length} proposed narrative beats reference current world targets; this does not execute scenes.`);

// Production-vision illustrations have their own ledger; they are never runtime assets.
const production=JSON.parse(await fs.readFile('docs/art/production-vision/manifest.json','utf8'));
if(production.status!=='production_concepts_only'||production.images.length!==13)throw Error('Expected 13 production concept boards');
for(const filename of await fs.readdir('docs/art/production-vision'))if(filename.endsWith('.png')&&!production.images.some(entry=>path.basename(entry.path)===filename))throw Error('Production PNG missing provenance: '+filename);
for(const entry of production.images){
 const filename=path.resolve(root,entry.path);
 if(!filename.startsWith(path.join(root,'docs','art','production-vision')+path.sep))throw Error('Production art path outside its folder');
 const data=await fs.readFile(filename);
 if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||createHash('sha256').update(data).digest('hex')!==entry.sha256||data.length!==entry.bytes)throw Error('Production art integrity mismatch: '+entry.path);
 if(data.readUInt32BE(16)!==entry.width||data.readUInt32BE(20)!==entry.height||entry.runtimeAsset!==false||entry.aiGenerated!==true||entry.visibleAiLabel!==true||!entry.credit||!entry.rights)throw Error('Incomplete production concept provenance: '+entry.path);
}
console.log(`${production.images.length} additional production concept boards verified; NASA uniform marks are third-party references, not ASTRA branding or endorsement.`);
