import {applyTheme} from './theme.mjs';
import {ID,copy} from './model.mjs';import {read} from './store.mjs';import {command} from './requests.mjs';import {bindFiles} from './forms.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class HeroEditor extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={classes:['ess-editor'],tag:'form',window:{title:'Apresentação do sobrevivente',resizable:true},position:{width:830,height:720},form:{handler:HeroEditor.submit,closeOnSubmit:false},actions:{cancel:HeroEditor.cancel}};
 static PARTS={body:{template:`modules/${ID}/templates/editor.hbs`}};
 constructor(options={}){super(options);this.rowId=options.rowId;this.requestId=foundry.utils.randomID();this.snapshot=null;}
 async _prepareContext(){const b=read(),r=b.roster.find(x=>x.id===this.rowId);if(!r)throw Error('Sobrevivente removido.');this.snapshot??=copy(r);const entry=this.snapshot,a=game.actors.get(r.actorId);return {entry,cardPreview:entry.img||a?.img||'icons/svg/mystery-man.svg',detailPreview:entry.detail||entry.img||a?.img||'icons/svg/mystery-man.svg',name:a?.name??'Ator removido',descriptionField:new foundry.data.fields.HTMLField(),roles:b.roles.map(role=>({...role,selected:entry.roles.includes(role.id)}))};}
 _onRender(context,options){super._onRender?.(context,options);bindFiles(this.element);applyTheme(this.element);}
 static async submit(event,form,formData){event.preventDefault();if(this.saving)return;this.saving=true;const button=form.querySelector('[type="submit"]'),output=form.querySelector('[data-form-error]');if(output)output.textContent='';if(button)button.disabled=true;try{const d=formData.object;await command('presentation',{id:this.rowId,revision:this.snapshot.revision,img:d.img??'',detail:d.detail??'',html:d.html??'',hidden:!!d.hidden,roles:Array.from(form.querySelectorAll('[name="role"]:checked')).map(i=>i.value)},{requestId:this.requestId});await this.close();}catch(e){if(output)output.textContent=e.message;else ui.notifications.warn(e.message);}finally{this.saving=false;if(button?.isConnected)button.disabled=false;}}
 static async cancel(){await this.close();}
}
export function edit(rowId){return new HeroEditor({rowId}).render(true);}
