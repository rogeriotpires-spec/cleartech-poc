/* Cleartech PoC v0.1. Local calculation utilities; not a production backend. */
(function(root){
'use strict';
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cleanDocument=v=>text(v).toUpperCase().replace(/[.\/\-\s]/g,'');
function cpfDV(base){let s=0;for(let i=0;i<base.length;i++)s+=Number(base[i])*(base.length+1-i);const m=(s*10)%11;return m===10?0:m;}
function cnpjDV(base){let weight=2,sum=0;for(let i=base.length-1;i>=0;i--){sum+=(base.charCodeAt(i)-48)*weight;weight=weight===9?2:weight+1;}const r=sum%11;return r<2?0:11-r;}
function validateDocument(raw){
 const value=cleanDocument(raw);
 if(!value||['NA','N/A','NULL','NULO','-'].includes(value))return {valid:false,type:null,value,reason:'Documento ausente'};
 if(/^\d{11}$/.test(value)){
  const b=value.slice(0,9),valid=!/^(\d)\1{10}$/.test(value)&&Number(value[9])===cpfDV(b)&&Number(value[10])===cpfDV(value.slice(0,10));
  return {valid,type:'CPF',value,reason:valid?'Válido':'Dígitos verificadores inválidos'};
 }
 if(/^[A-Z0-9]{12}\d{2}$/.test(value)){
  const valid=!/^(\d)\1{13}$/.test(value)&&Number(value[12])===cnpjDV(value.slice(0,12))&&Number(value[13])===cnpjDV(value.slice(0,13));
  return {valid,type:'CNPJ',value,reason:valid?'Válido':'Dígitos verificadores inválidos'};
 }
 return {valid:false,type:null,value,reason:'Formato inválido'};
}
function maskDoc(v){const s=cleanDocument(v);return s.length>4?'•'.repeat(Math.min(s.length-4,10))+s.slice(-4):(s?'••••':'Não informado');}
function analyzeRows(rows,column,headerRow=0){
 const seen=new Set(),result={total:0,eligible:0,cpf:0,cnpj:0,duplicated:0,invalid:0,missing:0,blank:0,issues:[],column,headerRow};
 for(let i=headerRow+1;i<rows.length;i++){
  const row=rows[i]||[];if(row.every(v=>!text(v))){result.blank++;continue;}
  result.total++;const d=validateDocument(row[column]);
  let category='';
  if(d.reason==='Documento ausente'){result.missing++;category=d.reason;}
  else if(!d.valid){result.invalid++;category=d.reason;}
  else {const k=d.type+':'+d.value;if(seen.has(k)){result.duplicated++;category='Documento duplicado';}else{seen.add(k);result.eligible++;result[d.type.toLowerCase()]++;}}
  if(category)result.issues.push({row:i+1,document:maskDoc(row[column]),reason:category});
 }
 return result;
}
function progressivePrice(qty,tiers){
 if(!Number.isSafeInteger(qty)||qty<0)throw Error('Quantidade inválida.');
 let start=0,totalCents=0;const details=[];
 tiers.forEach((t,i)=>{
  const cap=t.limit===null?Infinity:Number(t.limit),price=Number(t.price);
  if((i<tiers.length-1&&!Number.isFinite(cap))||cap<=start||price<0||!Number.isFinite(price))throw Error('Faixas inválidas: use limites crescentes e preços não negativos.');
  const count=Math.max(0,Math.min(qty,cap)-start),unit=Math.round(price*10000);
  const cents=Math.round(count*unit/100);
  if(count)details.push({from:start+1,to:Number.isFinite(cap)?cap:null,count,price:unit/10000,cents});
  totalCents+=cents;start=cap;
 });
 if(start!==Infinity)throw Error('A última faixa deve ser sem limite.');
 return {qty,totalCents,details,average:qty?totalCents/100/qty:0};
}
function parseCSV(source){
 const src=String(source).replace(/^\uFEFF/,'');
 const first=src.split(/\r?\n/).find(x=>x.trim())||'';
 const sep=[';',',','\t'].sort((a,b)=>(first.split(b).length-first.split(a).length))[0];
 const rows=[];let row=[],v='',quoted=false;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(c==='"'){if(quoted&&src[i+1]==='"'){v+='"';i++;}else if(quoted||!v)quoted=!quoted;else v+=c;}
  else if(c===sep&&!quoted){row.push(v);v='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&src[i+1]==='\n')i++;row.push(v);rows.push(row);row=[];v='';}
  else v+=c;
 }
 if(quoted)throw Error('CSV com aspas não fechadas. Revise o arquivo.');
 if(v||row.length){row.push(v);rows.push(row);}
 return rows;
}
function safeCSVCell(v){let s=text(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
const toCSV=rows=>'\uFEFF'+rows.map(r=>r.map(safeCSVCell).join(';')).join('\r\n');
function createSample(){
 const rows=[['identificador','cpf_cnpj','nome_de_teste']];
 for(let i=0;i<8100;i++){let b=String(123450000+i).padStart(9,'0');b+=cpfDV(b);b+=cpfDV(b);rows.push([i+1,b,'Pessoa de teste '+(i+1)]);}
 for(let i=0;i<2700;i++){let b=i<30?('TEST'+String(i).padStart(4,'0')+'0001'):(String(85000000+i)+'0001');b+=cnpjDV(b);b+=cnpjDV(b);rows.push([rows.length,b,'Empresa de teste '+(i+1)]);}
 for(let i=0;i<800;i++)rows.push([rows.length,rows[i+1][1],'Duplicidade de teste']);
 for(let i=0;i<300;i++)rows.push([rows.length,'11111111111','Documento inválido de teste']);
 for(let i=0;i<100;i++)rows.push([rows.length,'','Documento ausente de teste']);
 return rows;
}
function classifyReply(message){
 const t=norm(message);
 if(/descadastr|remov|retir|nao.*(receber|contat)|pare de|exclu/.test(t))return {label:'Descadastramento',stop:true,blocked:true,suggestion:'Seu endereço foi retirado desta sequência de contato. Não serão realizados novos envios comerciais por esta campanha.'};
 if(/nao.*interess|sem interesse/.test(t))return {label:'Não interessado',stop:true,suggestion:'Obrigado pelo retorno. Encerramos esta abordagem e permanecemos à disposição.'};
 if(/orcamento|proposta|preco|valor/.test(t))return {label:'Solicita proposta',stop:true,suggestion:'Obrigado pelo interesse. Para preparar uma proposta adequada, poderia informar o serviço desejado e o volume aproximado da base? Na contratação, serão considerados apenas os documentos válidos e únicos.'};
 if(/depois|proxim[oa]|outro momento|mes que vem/.test(t))return {label:'Contato posterior',stop:true,suggestion:'Obrigado pelo retorno. Qual seria o melhor dia para retomarmos a conversa?'};
 if(/interess|reuniao|convers|agend/.test(t))return {label:'Interessado',stop:true,suggestion:'Obrigado pelo interesse. Podemos agendar uma conversa breve para conhecer a sua operação e apresentar o serviço. Qual dia e horário funcionam melhor?'};
 if(/inform|como|duvida|detalhe/.test(t))return {label:'Solicita informações',stop:true,suggestion:'Obrigado pela mensagem. Poderia detalhar a necessidade da sua operação? Assim, encaminho as informações do serviço mais adequadas ao seu caso.'};
 return {label:'Revisão humana',stop:true,suggestion:'Obrigado pelo retorno. Vou analisar sua solicitação e retornar com as informações necessárias.'};
}
function businessDays(date,days,holidays=[]){const d=new Date(date);d.setHours(12,0,0,0);let count=0;while(count<Math.max(0,Math.ceil(days))){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6&&!holidays.includes(d.toISOString().slice(0,10)))count++;}return d.toISOString();}
function assignTechnician(qty,techs,orders){
 return techs.filter(t=>t.available).map(t=>{const load=orders.filter(o=>o.tech===t.name&&!['Entregue','Cancelado'].includes(o.status)).reduce((n,o)=>n+o.qty,0);return {...t,load,occupation:load/t.capacity,estimatedDays:Math.max(1,Math.ceil((load+qty)/t.capacity))};}).sort((a,b)=>a.occupation-b.occupation)[0]||null;
}
function priority(order,capacity,now=new Date()){
 const days=(new Date(order.due)-new Date(now))/864e5;
 const effort=Math.max(.1,order.qty/(capacity||15000));
 const score=(days<0?100:days<effort?65:days<3?30:0)+(order.contractPriority?25:0);
 return {score,label:score>=90?'Crítica':score>=50?'Alta':score>=25?'Atenção':'Normal',days,effort};
}
const api={text,norm,cleanDocument,validateDocument,maskDoc,analyzeRows,progressivePrice,parseCSV,toCSV,createSample,classifyReply,businessDays,assignTechnician,priority,cpfDV,cnpjDV};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CTCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
