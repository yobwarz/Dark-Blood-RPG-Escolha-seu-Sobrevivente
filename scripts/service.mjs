import {ID,all,copy,keys,text,num,asset,DEFAULT_ROLES,charId,ownLevel,availability,raw,presentation,validateTheme} from './model.mjs';
import {guard,activeGM,ensure,read,queue,save,publish} from './store.mjs';import {Changes,start,recover} from './transactions.mjs';
const uid=()=>foundry.utils.randomID();
const row=(b,id)=>{const r=b.roster.find(x=>x.id===id);if(!r)throw Error('Sobrevivente não encontrado.');return r;};
const actor=r=>{const a=game.actors.get(r.actorId);if(!a)throw Error('Ator removido.');return a;};
const self=(u,id)=>{if(!u.isGM&&id&&id!==u.id)throw Error('Não é possível agir por outro jogador.');const target=game.users.get(id??u.id);if(!target||target.isGM)throw Error('Selecione um jogador.');return target;};
const ownClaim=(b,userId)=>Object.entries(b.claims).find(([,c])=>c.userId===userId);
function revokeView(b,change,a,userId){const v=b.views[a.id]?.[userId];if(!v)return;if(ownLevel(a,{id:userId})===v.level&&raw(a,'ownership.'+userId).exists)change.restore(a,'ownership.'+userId,v.before);delete b.views[a.id][userId];if(!Object.keys(b.views[a.id]).length)delete b.views[a.id];}
function release(b,change,user,claimId){const c=b.claims[claimId];if(!c||c.userId!==user.id)throw Error('Essa escolha já mudou. Atualize a galeria.');const r=row(b,claimId),a=actor(r),current=raw(a,'ownership.'+user.id);if(current.exists&&current.value===3)change.restore(a,'ownership.'+user.id,c.before);if(charId(user)===a.id){const back=c.previousCharacter&&game.actors.get(c.previousCharacter)?c.previousCharacter:null;change.set(user,'character',back);}delete b.claims[claimId];delete b.interests[user.id];return c.previousCharacter??null;}
const finishData=b=>({claims:b.claims,views:b.views,interests:b.interests});
async function enrich(html){const TE=foundry.applications.ux.TextEditor.implementation;return TE.enrichHTML(html,{async:true,secrets:false});}
const contracts={theme:['background','panel','text','muted','accent','border','button','gallery'],claim:['id','replace'],release:['id','userId'],inspect:['id'],interest:['id'],add:['uuid'],presentation:['id','revision','img','detail','html','roles','hidden'],hidden:['id','hidden'],remove:['id'],order:['ids'],assign:['id','userId','replace'],roleSave:['id','name','description','img','recommended'],roleDelete:['id'],roleReset:[],media:['background','overlay','hover','select','confirm','volume'],open:['userIds'],clean:[],recover:['action'],sync:[]};
export async function execute(op,data,user,key,nonce){return queue(async()=>{
 guard();await ensure();if(game.users.get(user?.id)!==user||!user.active)throw Error('Solicitante desconectado ou não autenticado.');if(!Object.hasOwn(contracts,op))throw Error('Operação desconhecida.');keys(data,contracts[op]);if(!user.isGM&&!['claim','release','inspect','interest'].includes(op))throw Error('Operação exclusiva do Mestre.');const b=read(),intent='intent:'+user.id+':'+nonce;
 if(b.receipts[key]||b.receipts[intent]){await publish();return b.receipts[key]??b.receipts[intent];}
 if(op==='recover'){if(!user.isGM)throw Error('Operação exclusiva do Mestre.');return recover(b,data.action);}
 if(b.pending)throw Error('O Mestre precisa conferir uma operação pendente antes de novas alterações.');
 const change=new Changes();let after=null,actorIds=[];
 if(op==='claim'||op==='assign'){
  const target=op==='assign'?self(user,data.userId):self(user),r=row(b,data.id),a=actor(r);if(r.hidden&&!user.isGM)throw Error('Esse sobrevivente não está disponível.');const free=availability(b,r,target.id);if(free.blocked)throw Error('Sobrevivente indisponível: '+free.reason+'.');const old=ownClaim(b,target.id);if(old?.[0]===r.id&&charId(target)===a.id){b.receipts[key]=b.receipts[intent]={status:'done'};await save(b);await publish();return {status:'done'};}
  if(charId(target)&&charId(target)!==a.id&&!data.replace)throw Error('O jogador já tem um personagem. Confirme a troca antes de continuar.');let previous=charId(target);if(old){const stillLinked=previous===row(b,old[0]).actorId;const original=release(b,change,target,old[0]);if(stillLinked)previous=original;}
  // Um observador pode ter sido concedido por este módulo; a liberação final volta ao valor anterior à inspeção.
  const before=b.views[a.id]?.[target.id]?.before??raw(a,'ownership.'+target.id);
  for(const userId of Object.keys(b.views[a.id]??{}))revokeView(b,change,a,userId);
  change.set(a,'ownership.'+target.id,3);change.set(target,'character',a.id);b.claims[r.id]={userId:target.id,before,previousCharacter:previous??null};delete b.interests[target.id];after=finishData(b);actorIds=[a.id,...(old?[row(b,old[0]).actorId]:[])];
 }else if(op==='release'){
  const target=self(user,data.userId),r=row(b,data.id);if(!user.isGM&&b.claims[r.id]?.userId!==user.id)throw Error('Essa escolha não pertence a você.');release(b,change,target,r.id);after=finishData(b);actorIds=[r.actorId];
 }else if(op==='inspect'){
  const r=row(b,data.id),a=actor(r);if(user.isGM)return {status:'done',actorId:a.id};if(!game.settings.get(ID,'allowInspect')||r.hidden||b.claims[r.id]&&b.claims[r.id].userId!==user.id||availability(b,r,user.id).blocked)throw Error('A ficha não está disponível para inspeção.');
  if(ownLevel(a,user)<2){b.views[a.id]??={};b.views[a.id][user.id]={before:raw(a,'ownership.'+user.id),level:2};change.set(a,'ownership.'+user.id,2);after=finishData(b);actorIds=[a.id];}else{b.receipts[key]=b.receipts[intent]={status:'done',actorId:a.id};await save(b);await publish();return {status:'done',actorId:a.id};}
 }else if(op==='clean'){
  for(const [actorId,users]of Object.entries(b.views)){const a=game.actors.get(actorId);for(const id of Object.keys(users))if(a)revokeView(b,change,a,id);else delete b.views[actorId];}after=finishData(b);actorIds=change.steps.map(s=>s.uuid.split('.')[1]);
 }else if(op==='interest'){
  if(data.id){const r=row(b,data.id);if(r.hidden||availability(b,r,user.id).blocked)throw Error('Esse sobrevivente não está disponível.');b.interests[user.id]={rowId:r.id,until:Date.now()+45000};}else delete b.interests[user.id];
 }else if(op==='add'){
  const d=await fromUuid(text(data.uuid,300,true));if(d?.documentName!=='Actor')throw Error('Arraste um ator válido.');if(b.roster.length>=100)throw Error('Limite de100 sobreviventes no elenco.');let a=d;
  if(d.pack){const prior=all(game.actors).find(a=>a.flags?.[ID]?.source===d.uuid);if(prior)a=prior;else{const id=uid(),payload=d.toObject();delete payload._id;delete payload._stats;delete payload.folder;Object.assign(payload,{_id:id,ownership:{default:0}});payload.flags??={};payload.flags[ID]={source:d.uuid};const entry={id:uid(),actorId:id,revision:1,img:'',detail:'',html:'',publicHTML:'',roles:[],hidden:false};const roster=[...b.roster,entry];await start(b,{op,key,intent,steps:[{kind:'create',id,data:payload}],after:{roster},actorIds:[id]});return {status:'done'};}}
  if(!b.roster.some(r=>r.actorId===a.id))b.roster.push({id:uid(),actorId:a.id,revision:1,img:'',detail:'',html:'',publicHTML:'',roles:[],hidden:false});
 }else if(op==='presentation'){
  const old=row(b,data.id),next=presentation(data,old,b.roles);next.publicHTML=await enrich(next.html);b.roster[b.roster.indexOf(old)]=next;
 }else if(op==='hidden'){
  const r=row(b,data.id);r.hidden=!!data.hidden;r.revision++;if(r.hidden){const a=actor(r);for(const id of Object.keys(b.views[a.id]??{}))revokeView(b,change,a,id);after={...finishData(b),roster:b.roster};actorIds=[a.id];}
 }else if(op==='remove'){
  const r=row(b,data.id);if(b.claims[r.id])throw Error('Libere a escolha antes de retirar o sobrevivente.');const a=game.actors.get(r.actorId);if(a)for(const id of Object.keys(b.views[a.id]??{}))revokeView(b,change,a,id);b.roster=b.roster.filter(x=>x.id!==r.id);for(const [id,p]of Object.entries(b.interests))if(p.rowId===r.id)delete b.interests[id];after={...finishData(b),roster:b.roster};actorIds=[r.actorId];
 }else if(op==='order'){
  if(!Array.isArray(data.ids)||data.ids.length!==b.roster.length||new Set(data.ids).size!==b.roster.length||data.ids.some(id=>!b.roster.some(r=>r.id===id)))throw Error('Ordem inválida. Atualize a lista.');b.roster=data.ids.map(id=>row(b,id));
 }else if(op==='roleSave'){
  const old=data.id?b.roles.find(r=>r.id===data.id):null;if(data.id&&!old)throw Error('Função removida.');if(!old&&b.roles.length>=30)throw Error('Limite de30 funções.');const r={id:old?.id??uid(),name:text(data.name,60,true),description:text(data.description,1000),img:asset(data.img)};if(old)b.roles[b.roles.indexOf(old)]=r;else b.roles.push(r);b.recommended=b.recommended.filter(id=>id!==r.id);if(data.recommended)b.recommended.push(r.id);
 }else if(op==='roleDelete'){
  b.roles=b.roles.filter(r=>r.id!==data.id);b.recommended=b.recommended.filter(id=>id!==data.id);for(const r of b.roster){r.roles=r.roles.filter(id=>id!==data.id);r.revision++;}
 }else if(op==='roleReset'){
  b.roles=copy(DEFAULT_ROLES);b.recommended=[];for(const r of b.roster){r.roles=r.roles.filter(id=>b.roles.some(x=>x.id===id));r.revision++;}
 }else if(op==='theme')b.theme=validateTheme(data);
 else if(op==='media')b.media={background:asset(data.background),overlay:num(data.overlay,0,1),hover:asset(data.hover),select:asset(data.select),confirm:asset(data.confirm),volume:num(data.volume,0,1)};
 else if(op==='open'){
  if(!Array.isArray(data.userIds)||data.userIds.some(id=>!game.users.get(id)||game.users.get(id).isGM))throw Error('Jogadores inválidos.');for(const id of data.userIds)b.open[id]={nonce:uid(),at:Date.now()};
 }else if(op!=='sync')throw Error('Operação não reconhecida.');
 if(after){if(change.steps.length)await start(b,{op,key,intent,steps:change.steps,after,actorIds});else {for(const [k,v]of Object.entries(after))b[k]=v;b.receipts[key]=b.receipts[intent]={status:'done'};await save(b);await publish();}}
 else{b.receipts[key]=b.receipts[intent]={status:'done'};await save(b);await publish();}
 return {status:'done',...(op==='inspect'?{actorId:row(b,data.id).actorId}:{})};
 });}
