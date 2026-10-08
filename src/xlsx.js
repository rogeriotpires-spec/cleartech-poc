/* Small, read-only XLSX importer. Never evaluates formulas or macros. */
(async function(root){
'use strict';
const MAX_FILE=20*1024*1024,MAX_XML=48*1024*1024,MAX_TOTAL=96*1024*1024,MAX_ROWS=100001;
const decoder=new TextDecoder('utf-8');
const xml=s=>{if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error('Declarações XML não permitidas.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Estrutura XML inválida.');return d;};
const tags=(n,name)=>Array.from(n.getElementsByTagNameNS('*',name));
async function readXLSX(file){
 if(file.size>MAX_FILE)throw Error('Limite da demonstração: 20 MB por arquivo.');
 if(!('DecompressionStream' in root))throw Error('Use uma versão atual do Chrome ou Edge, ou exporte a planilha como CSV.');
 const buf=await file.arrayBuffer(),u=new Uint8Array(buf),v=new DataView(buf);
 let end=-1;for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Arquivo XLSX inválido ou protegido. Use um arquivo sem senha.');
 const entries=new Map(),count=v.getUint16(end+10,true);let p=v.getUint32(end+16,true),total=0;
 if(count>20000)throw Error('Arquivo com itens demais para esta demonstração.');
 for(let i=0;i<count;i++){
  if(p+46>u.length||v.getUint32(p,true)!==0x02014b50)throw Error('Estrutura ZIP inválida.');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),offset=v.getUint32(p+42,true);
  const name=decoder.decode(u.slice(p+46,p+46+nl));
  if(flags&1)throw Error('Planilhas protegidas por senha não são aceitas.');
  if(size>MAX_XML||(total+=size)>MAX_TOTAL)throw Error('Planilha expandida excede o limite seguro da demonstração.');
  entries.set(name,{method,compressed,size,offset});p+=46+nl+xl+cl;
 }
 async function extract(path){
  const e=entries.get(path);if(!e)return null;const p=e.offset;
  if(p+30>u.length||v.getUint32(p,true)!==0x04034b50)throw Error('Entrada ZIP inválida.');
  const start=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true);
  if(start+e.compressed>u.length)throw Error('Arquivo incompleto.');
  const data=u.slice(start,start+e.compressed);let bytes;
  if(e.method===0)bytes=data;
  else if(e.method===8){
   const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();let size=0;const chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_XML||size>e.size){await reader.cancel();throw Error('Tamanho expandido inválido.');}chunks.push(value);}
   bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length;}
  }else throw Error('Compactação XLSX não suportada. Exporte como CSV.');
  if(bytes.length!==e.size)throw Error('Tamanho do arquivo XLSX inconsistente.');return decoder.decode(bytes);
 }
 const workbook=xml(await extract('xl/workbook.xml')||''),rels=xml(await extract('xl/_rels/workbook.xml.rels')||'');
 const paths={};for(const r of tags(rels,'Relationship')){const t=r.getAttribute('Target');if(r.getAttribute('TargetMode')==='External')continue;const full=t.startsWith('/')?t.slice(1):'xl/'+t;const resolved=[];for(const part of full.split('/')){if(part==='..')resolved.pop();else if(part!=='.')resolved.push(part);}paths[r.getAttribute('Id')]=resolved.join('/');}
 const sharedXML=await extract('xl/sharedStrings.xml');const strings=sharedXML?tags(xml(sharedXML),'si').map(si=>tags(si,'t').map(t=>t.textContent).join('')):[];
 const sheets=tags(workbook,'sheet').map(s=>({name:s.getAttribute('name'),path:paths[s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')]})).filter(s=>s.path);
 return {name:file.name,sheets:sheets.map(s=>s.name),async getRows(name){const sheet=sheets.find(s=>s.name===name);if(!sheet)throw Error('Aba não encontrada.');const d=xml(await extract(sheet.path)||'');const rows=[];let cellCount=0;
  for(const row of tags(d,'row')){const rn=Number(row.getAttribute('r'));if(!Number.isInteger(rn)||rn<1||rn>MAX_ROWS)throw Error('Limite: 100 mil linhas de dados.');const values=[];
   for(const c of tags(row,'c')){if(++cellCount>2000000)throw Error('Número de células excede o limite da demonstração.');const letters=(c.getAttribute('r')||'A').replace(/\d/g,'');let ci=0;for(const a of letters)ci=ci*26+a.charCodeAt(0)-64;ci--;if(ci<0||ci>1023)continue;
    const type=c.getAttribute('t'),val=tags(c,'v')[0]?.textContent??'';
    values[ci]=type==='s'?(strings[Number(val)]??''):type==='inlineStr'?tags(c,'t').map(x=>x.textContent).join(''):val;
   }rows[rn-1]=values;
  }return Array.from({length:rows.length},(_,i)=>rows[i]||[]);
 }};
}
root.CTReadFile=async(file)=>{if(file.size>MAX_FILE)throw Error('Limite da demonstração: 20 MB por arquivo.');if(/\.xlsx$/i.test(file.name))return readXLSX(file);if(/\.(csv|txt)$/i.test(file.name)){const b=await file.arrayBuffer();let s=new TextDecoder('utf-8').decode(b);if(s.includes('\ufffd'))s=new TextDecoder('windows-1252').decode(b);const rows=root.CTCore.parseCSV(s);if(rows.length>MAX_ROWS)throw Error('Limite: 100 mil linhas de dados.');return {name:file.name,sheets:['Dados'],async getRows(){return rows;}};}throw Error('Selecione uma planilha .xlsx ou um arquivo .csv.');};
})(globalThis);
