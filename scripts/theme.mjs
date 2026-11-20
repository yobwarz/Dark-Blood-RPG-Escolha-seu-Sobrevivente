import {ID,theme,DEFAULT_THEME} from './model.mjs';import {view} from './store.mjs';
export function applyTheme(root){const colors=theme(view().theme);for(const [k,v]of Object.entries(colors))root?.style?.setProperty('--ess-'+({background:'bg',border:'line'}[k]??k),v);const rgb=colors.accent.slice(1).match(/../g).map(v=>parseInt(v,16)/255),luma=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;root?.style?.setProperty('--ess-primary-text',luma>.55?'#111317':'#f7f7f7');}
export function applyAllThemes(){for(const root of globalThis.document?.querySelectorAll?.('.ess-window,.ess-editor,.ess-dialog,.ess-gallery')??[])applyTheme(root);}
export function bindColors(root){
 for(const picker of root?.querySelectorAll?.('[data-color-for]')??[]){const input=root.querySelector(`[name="${picker.dataset.colorFor}"]`);if(!input)continue;picker.addEventListener('input',()=>{input.value=picker.value;input.setCustomValidity?.('');});input.addEventListener('input',()=>{const valid=/^#[0-9a-f]{6}$/i.test(input.value);input.setCustomValidity?.(valid?'':'Use o formato #RRGGBB.');if(valid)picker.value=input.value;});}
 root?.querySelector('[data-reset-colors]')?.addEventListener('click',()=>{for(const [key,value]of Object.entries(DEFAULT_THEME)){const input=root.querySelector(`[name="${key}"]`),picker=root.querySelector(`[data-color-for="${key}"]`);if(input){input.value=value;input.setCustomValidity?.('');}if(picker)picker.value=value;}});
}

export function alignSettings(root){for(const b of root?.querySelectorAll?.(`button[data-key^="${ID}."],button[data-menu^="${ID}."]`)??[]){b.closest('.form-group')?.classList.add('ess-settings-menu');b.closest(`[data-category="${ID}"],[data-tab="${ID}"]`)?.classList.add('ess-settings-category');}}
