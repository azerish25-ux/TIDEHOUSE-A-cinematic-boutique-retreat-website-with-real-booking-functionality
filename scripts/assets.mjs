/** Download a fixed, credited photographic art direction. No random-image service. */
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources = [
 ['hero','1582457746224-e1c79edc1a68','Yves Scheuber','hxHoQpxvKI8','Quiet northern coast and timber cabins'],
 ['lookout','1750967028432-46daeec749fb','Barnabas Davoti','vu_1CFfK6Rk','Dark timber cabin beside a lake'],
 ['driftwood','1775547081703-1472317fe554','Nhi Ly','y6Dcrae8FNs','Modern timber cabin among trees'],
 ['saltbox','1582457746224-e1c79edc1a68','Yves Scheuber','hxHoQpxvKI8','Northern coastal cabin architecture'],
 ['dune','1759299653207-e0e9874752ca','Auroom Wellness','Vtl5uHCWpus','Small timber building beside still water'],
 ['stillwater','1688604693147-ff99ce13e291','Mick Kirchman','DVp3KH_RGqo','Wooden cabin overlooking the ocean'],
 ['bedroom','1758072328635-586f3c121af2','Clay Banks','Xbe5BfScmvM','Natural wood and linen bedroom'],
 ['interior','1664509941658-bb5483d3eba7','Clay Banks','DYJY3Sm8s80','Warm timber living space'],
 ['coast','1518800786813-7be8b2278e2f','Eric Fleming','XCFAo370Vjo','Atlantic waves and shoreline'],
 ['forest','1768345757290-2ac11c5ca644','Ali Kazal','NtTz9QdoE4Q','Woodland boardwalk'],
 ['breakfast','1687783451933-ce93aa1687c9','Olga Pukhalskaya','t3fml85WJv4','Coffee and pastry on a wooden table'],
 ['sauna','1772616748530-7cd73053f326','HUUM','p8VTUqQLLjM','Warm timber sauna interior']
];
await mkdir('public/images',{recursive:true});
const credits=[];
for(const [id,photo,photographer,sourceId,description] of sources){
 const path=`public/images/${id}.jpg`;
 const download=`https://images.unsplash.com/photo-${photo}?auto=format&fm=jpg&fit=crop&w=${id==='hero'?2200:1500}&q=85`;
 let bytes;
 try{if((await stat(path)).size>10000)bytes=await readFile(path);}catch{}
 if(!bytes){
  let lastError;
  for(let attempt=0;attempt<4;attempt++){
   try{
    const response=await fetch(download,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error(`${response.status} ${id}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<10000||bytes[0]!==255||bytes[1]!==216)throw Error(`Invalid JPEG for ${id}`);
    await writeFile(path,bytes);break;
   }catch(error){bytes=undefined;lastError=error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
  }
  if(!bytes)throw lastError;
 }
 credits.push({id,photographer,description,source:`https://unsplash.com/photos/${sourceId}`,license:'Unsplash License',licenseUrl:'https://unsplash.com/license',localPath:`/images/${id}.jpg`,sha256:createHash('sha256').update(bytes).digest('hex'),usage:'Photographic inspiration for a fictional retreat. Not a photograph of TIDEHOUSE.'});
 console.log(`Verified ${id}.jpg (${bytes.length} bytes)`);
}
await writeFile('public/image-credits.json',JSON.stringify({notice:'TIDEHOUSE is fictional. These are real, credited photographs used for atmosphere and architectural inspiration, not AI-generated photographs or documentation of a real bookable property.',images:credits},null,2)+'\n');
