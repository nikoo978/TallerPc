import { getSettings, saveSettings, getCloudSettingsCache, saveCloudSettingsCache } from './db.js';
import { getCloudUser, upsertCloudSettings } from './cloud.js';
import { sanitizeSvg, svgAspect, svgDataUrl } from './svg-sanitize-v221.js';

const root = document.documentElement;
const state = { svg:'', name:'', enabled:false, density:100, aspect:1 };
const $ = s => document.querySelector(s);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||a));

async function activeSettings(){
  if (getCloudUser()) return (await getCloudSettingsCache()) || {};
  return (await getSettings()) || {};
}
async function persist(sync=true){
  const base=await activeSettings();
  const next={...base,customPatternSvg:state.svg,customPatternName:state.name,customPatternEnabled:state.enabled,customPatternAspect:state.aspect,patternDensity:state.density,updatedAt:new Date().toISOString()};
  if(getCloudUser()){
    await saveCloudSettingsCache(next);
    if(sync) try{await upsertCloudSettings(next);}catch(e){console.warn('SVG branding cloud sync',e);}
  } else await saveSettings(next);
}
function clearInline(){['--visual-pattern','--document-pattern','--visual-pattern-size','--document-pattern-size'].forEach(x=>root.style.removeProperty(x));}
function docOn(){return $('#documentPatternToggle')?.checked !== false;}
function setSizes(pxW,pxH,mmW,mmH){
  root.style.setProperty('--visual-pattern-size',`${pxW.toFixed(1)}px ${pxH.toFixed(1)}px`);
  root.style.setProperty('--document-pattern-size',`${mmW.toFixed(2)}mm ${mmH.toFixed(2)}mm`);
}
function applyBuiltInDensity(){
  if(state.enabled) return;
  clearInline(); root.dataset.customPattern='off';
  const p=root.dataset.pattern || 'pinstripe', f=100/state.density;
  if(p==='none') return;
  const sizes={microgrid:[24,24,6,6],dotgrid:[18,18,4.5,4.5],isometric:[36,62,9,15.5],hexmesh:[34,58,8.5,14.5],contour:[160,110,40,27.5]};
  if(sizes[p]){const a=sizes[p];setSizes(a[0]*f,a[1]*f,a[2]*f,a[3]*f);return;}
  const ink='var(--pattern-ink)';
  if(p==='pinstripe'){
    const gap=32*f, dgap=8*f;
    root.style.setProperty('--visual-pattern',`repeating-linear-gradient(90deg,transparent 0 ${Math.max(4,gap-1).toFixed(1)}px,${ink} ${Math.max(4,gap-1).toFixed(1)}px ${gap.toFixed(1)}px)`);
    root.style.setProperty('--document-pattern',docOn()?`repeating-linear-gradient(90deg,transparent 0 ${Math.max(1,dgap-.18).toFixed(2)}mm,${ink} ${Math.max(1,dgap-.18).toFixed(2)}mm ${dgap.toFixed(2)}mm)`:'none');
  } else if(p==='diagonal'){
    const gap=44*f,dgap=11*f,half=gap/2,dhalf=dgap/2;
    root.style.setProperty('--visual-pattern',`repeating-linear-gradient(135deg,transparent 0 ${(half-1).toFixed(1)}px,${ink} ${(half-1).toFixed(1)}px ${half.toFixed(1)}px,transparent ${half.toFixed(1)}px ${gap.toFixed(1)}px)`);
    root.style.setProperty('--document-pattern',docOn()?`repeating-linear-gradient(135deg,transparent 0 ${(dhalf-.2).toFixed(2)}mm,${ink} ${(dhalf-.2).toFixed(2)}mm ${dhalf.toFixed(2)}mm,transparent ${dhalf.toFixed(2)}mm ${dgap.toFixed(2)}mm)`:'none');
  }
}
function apply(){
  state.density=clamp(state.density,25,250);
  if(!state.enabled || !state.svg){applyBuiltInDensity();return;}
  clearInline(); root.dataset.customPattern='on';
  const intensity=clamp($('#patternIntensity')?.value ?? 28,0,100)/100;
  const url=svgDataUrl(state.svg,intensity);
  const f=100/state.density,w=240*f,h=w/state.aspect,dw=60*f,dh=dw/state.aspect;
  root.style.setProperty('--custom-pattern-url',`url("${url}")`);
  root.style.setProperty('--visual-pattern',`url("${url}")`);
  root.style.setProperty('--document-pattern',docOn()?`url("${url}")`:'none');
  setSizes(w,h,dw,dh);
  $('.brand-svg-preview')?.style.setProperty('background-image',`url("${url}")`);
}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
function renderUi(){
  const controls=$('.appearance-controls'), picker=$('#patternPicker'); if(!controls||!picker||$('#customPatternPanel'))return;
  const panel=document.createElement('div');panel.id='customPatternPanel';panel.className='custom-pattern-panel';panel.innerHTML=`<div class="custom-pattern-head"><div><strong>SVG de marca personalizado</strong><small>Patrón vectorial propio de la empresa. Scripts y referencias externas se eliminan al cargar.</small></div><div class="brand-svg-preview" aria-hidden="true"></div></div><div class="custom-pattern-actions"><label class="btn btn-ghost file-btn">Cargar SVG<input id="customPatternInput" type="file" accept="image/svg+xml,.svg" hidden></label><button id="useCustomPattern" class="btn btn-ghost" type="button">Usar personalizado</button><button id="removeCustomPattern" class="mini-link danger" type="button">Quitar</button><span id="customPatternName"></span></div>`;
  picker.parentElement.after(panel);
  const density=document.createElement('label');density.className='field';density.innerHTML=`<span>Densidad / repetición</span><div class="range-setting"><input id="patternDensity" type="range" min="25" max="250" step="5" value="100"><output id="patternDensityValue">100%</output></div><small class="density-help">Más alto = el patrón se repite más veces.</small>`;controls.prepend(density);
  $('#customPatternInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const raw=await file.text();state.svg=sanitizeSvg(raw);state.aspect=svgAspect(state.svg);state.name=file.name.replace(/\.svg$/i,'');state.enabled=true;updateUi();apply();await persist(true);toast('SVG de marca aplicado');}catch(err){toast(err.message||'No se pudo cargar el SVG');}e.target.value='';});
  $('#useCustomPattern').addEventListener('click',async()=>{if(!state.svg)return toast('Primero cargá un SVG');state.enabled=true;updateUi();apply();await persist(true);});
  $('#removeCustomPattern').addEventListener('click',async()=>{state.svg='';state.name='';state.enabled=false;updateUi();apply();await persist(true);toast('SVG personalizado eliminado');});
  $('#patternDensity').addEventListener('input',e=>{state.density=clamp(e.target.value,25,250);$('#patternDensityValue').value=`${state.density}%`;apply();});
  picker.addEventListener('click',async e=>{if(!e.target.closest('button'))return;state.enabled=false;updateUi();setTimeout(apply,0);await persist(false);});
  $('#patternIntensity')?.addEventListener('input',()=>state.enabled&&apply());
  $('#documentPatternToggle')?.addEventListener('change',apply);
}
function updateUi(){
  const n=$('#customPatternName');if(n)n.textContent=state.svg?(state.name||'SVG cargado'):'Sin SVG cargado';
  $('#customPatternPanel')?.classList.toggle('active',state.enabled&&!!state.svg);
  const d=$('#patternDensity');if(d)d.value=state.density;
  const o=$('#patternDensityValue');if(o)o.value=`${state.density}%`;
}
async function load(){
  const s=await activeSettings();state.svg=s.customPatternSvg||'';state.name=s.customPatternName||'';state.enabled=!!s.customPatternEnabled&&!!state.svg;state.aspect=clamp(s.customPatternAspect||1,.2,5);state.density=clamp(s.patternDensity||100,25,250);updateUi();apply();
}
async function init(){renderUi();await load();
  $('#saveSettingsBtn')?.addEventListener('click',()=>setTimeout(()=>persist(true),120));
  $('#cloudSignOutBtn')?.addEventListener('click',()=>setTimeout(load,700));
  $('#cloudSwitchAccountBtn')?.addEventListener('click',()=>setTimeout(load,700));
  $('#cloudAuthForm')?.addEventListener('submit',()=>setTimeout(load,1200));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));else setTimeout(init,120);
