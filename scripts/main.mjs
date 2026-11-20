import {applyAllThemes,alignSettings} from './theme.mjs';
import {ID,all,charId} from './model.mjs';import {activeGM,ensure,read,publish,queue,database} from './store.mjs';import {command,processMessage,reply,closeOld} from './requests.mjs';import {roster,gallery,OpenRoster,OpenGallery,OpenRoles,OpenMedia,OpenColors,refresh,safe} from './ui.mjs';
let lastGM=null,opened=null,ready=false;
export async function syncOpen(){if(!ready)return;applyAllThemes();await refresh();if(game.user.isGM)return;const data=game.settings.get(ID,'public'),o=data?.open?.[game.user.id];if(o&&o.nonce!==opened&&Date.now()-o.at<120000){opened=o.nonce;await gallery();}}
async function boot(){if(!activeGM())return;await queue(ensure);if(!read().pending)await command('clean');await queue(publish);await closeOld();}
Hooks.once('init',()=>{
 game.settings.register(ID,'database',{scope:'world',config:false,type:String,default:''});
 game.settings.register(ID,'public',{scope:'world',config:false,type:Object,default:{schema:1,roster:[],roles:[],recommended:[],media:{},open:{}},onChange:()=>safe(syncOpen)()});
 game.settings.register(ID,'autoOpen',{name:'Abrir seleção ao entrar sem personagem',hint:'Mostra a galeria para jogadores sem personagem atribuído, quando há sobreviventes visíveis no elenco.',scope:'world',config:true,type:Boolean,default:true});
 game.settings.register(ID,'allowInspect',{name:'Permitir inspeção da ficha completa',hint:'O Mestre concede Observador sob demanda; a ficha pode incluir inventário e biografia. Use apenas atores preparados para os jogadores. Acesso temporário é restaurado ao escolher, ocultar, limpar ou reiniciar.',scope:'world',config:true,type:Boolean,default:true,onChange:()=>safe(async()=>{if(activeGM())await command('clean');await refresh();})()});
 for(const [key,name,label,type,restricted]of [['roster','Elenco de sobreviventes','Configurar elenco',OpenRoster,true],['gallery','Seleção de sobreviventes','Abrir seleção',OpenGallery,false],['roles','Funções da equipe','Configurar funções',OpenRoles,true],['media','Fundo e sons','Configurar apresentação',OpenMedia,true],['colors','Cores do módulo','Personalizar cores em HEX',OpenColors,true]])game.settings.registerMenu(ID,key,{name,label,icon:'fas fa-users',type,restricted});
 game.modules.get(ID).api=Object.freeze({version:1,open:()=>game.user.isGM?roster():gallery(),openSelection:()=>gallery(game.user.isGM),addActor:async uuid=>{if(!activeGM())throw Error('Use o Mestre ativo.');const a=await fromUuid(uuid);if(a?.documentName!=='Actor'||a.pack)throw Error('Selecione uma ficha do mundo.');return command('add',{uuid:a.uuid});}});
});
Hooks.on('getSceneControlButtons',config=>{const groups=Array.isArray(config)?config:Object.values(config??{}),g=groups.find(x=>['tokens','token'].includes(x.name))??groups[0];if(!g?.tools)return;const t={name:'escolhaSeuSobrevivente',title:'Sangue Escuro: Escolha seu Sobrevivente',icon:'fas fa-users',button:true,visible:true,onChange:()=>safe(()=>game.user.isGM?roster():gallery())()};if(Array.isArray(g.tools)){if(!g.tools.some(x=>x.name===t.name))g.tools.push(t);}else g.tools[t.name]={...t,order:Object.keys(g.tools).length};});
Hooks.on('renderSettingsConfig',(app,html)=>alignSettings(html?.querySelectorAll?html:html?.[0]??app.element));
Hooks.once('ready',async()=>{
 ready=true;lastGM=game.users.activeGM?.id;
 Hooks.on('createChatMessage',(m,o,u)=>safe(()=>processMessage(m,o,u))());
 Hooks.on('updateChatMessage',m=>reply(m));Hooks.on('renderChatMessageHTML',(m,html)=>{if(!m.flags?.[ID]?.request)return;const el=html?.querySelector?html:html?.[0];el?.classList?.add('ess-request');});
 Hooks.on('sobrevivente.refresh',()=>{applyAllThemes();safe(refresh)();});
 Hooks.on('updateJournalEntryPage',p=>{if(p.parent?.id===database()?.id)safe(refresh)();});
 for(const event of ['updateActor','deleteActor','updateUser','createUser','deleteUser'])Hooks.on(event,(doc,changes,options)=>safe(async()=>{
  if(lastGM!==game.users.activeGM?.id){lastGM=game.users.activeGM?.id;await boot();}
  if(activeGM()&&!options?.sobreviventeTransaction)await queue(async()=>{await ensure();await publish();});await refresh();
 })());
 await safe(boot)();await safe(syncOpen)();
 if(!game.user.isGM&&game.settings.get(ID,'autoOpen')&&!charId(game.user)&&game.settings.get(ID,'public')?.roster?.length)await safe(()=>gallery())();
});
