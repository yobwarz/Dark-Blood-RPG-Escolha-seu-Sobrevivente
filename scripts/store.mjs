import {ID,all,esc,fresh,projection} from './model.mjs';
export const activeGM=()=>!!game.user?.isGM&&game.users.activeGM?.id===game.user.id;
export function guard(){if(!activeGM())throw Error('É necessário usar o Mestre ativo.');}
let chain=Promise.resolve();export function queue(fn){const p=chain.catch(()=>{}).then(fn);chain=p;return p;}
const PAGE='Estado e recibos de seleção';
const encode=s=>'<pre>'+esc(JSON.stringify(s))+'</pre>';
const decode=s=>s.replace(/^\s*<pre[^>]*>/,'').replace(/<\/pre>\s*$/,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
export const database=()=>game.journal.get(game.settings.get(ID,'database'));
function page(){const d=database();if(!d?.flags?.[ID]?.database)throw Error('Arquivo de seleção indisponível. Restaure o backup; não reinicie os recibos.');const p=all(d.pages).find(p=>p.name===PAGE);if(!p)throw Error('Página de seleção removida. Restaure o backup.');for(const doc of [d,p])if((doc.ownership?.default??0)>0||all(game.users).some(u=>!u.isGM&&(doc.ownership?.[u.id]??0)>0))throw Error('Mantenha o arquivo de seleção e sua página privados aos Mestres.');return p;}
export async function ensure(){guard();if(game.settings.get(ID,'database')){page();return;}const d=await JournalEntry.create({name:'Escolha seu Sobrevivente — Arquivo do Mestre',ownership:{default:0},flags:{[ID]:{database:true}},pages:[{name:PAGE,type:'text',ownership:{default:-1},text:{format:1,content:encode(fresh())}}]});guard();await game.settings.set(ID,'database',d.id);page();}
export function read(){if(!game.user.isGM)throw Error('Arquivo reservado ao Mestre.');if(!game.settings.get(ID,'database'))return fresh();const s=JSON.parse(decode(page().text.content));if(s.schema!==1||!Array.isArray(s.roster)||!s.claims||!s.views||!s.receipts||!Number.isSafeInteger(s.revision))throw Error('Arquivo de seleção inválido.');return s;}
// HTMLField pode normalizar entidades sem mudar o JSON. A confirmação verifica
// todo o estado lido de volta, incluindo revisão, recibos e pendências.
function sameJSON(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>sameJSON(v,b[i]));
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameJSON(a[k],b[k]));
}
export async function save(s){
 guard();s.revision++;
 const expected=JSON.parse(JSON.stringify(s)),content=encode(expected);
 const committed=()=>{try{return sameJSON(read(),expected);}catch{return false;}};
 try{await page().update({'text.content':content});}catch(error){if(!committed())throw error;}
 if(!committed())throw Error('Gravação recusada. Confira o arquivo de seleção.');
 Hooks.callAll('sobrevivente.refresh');
}
export async function publish(){guard();const data=projection(read());if(JSON.stringify(data)!==JSON.stringify(game.settings.get(ID,'public')))await game.settings.set(ID,'public',data);Hooks.callAll('sobrevivente.refresh');}
export const view=()=>game.settings.get(ID,'public')??{schema:1,revision:0,roster:[],roles:[],recommended:[],media:{},open:{}};
