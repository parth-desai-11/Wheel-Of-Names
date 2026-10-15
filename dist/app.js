import { TAU, MAX_ENTRIES, normalizedChances, pickWeightedIndex, rotationForWinner, parseCSV, exportCSV } from './core.js';
import { prepareImage, putImage, getImage, deleteImage } from './images.js';

const $ = selector => document.querySelector(selector);
const colors = ['#e5a27e','#e5c563','#9cbca8','#294e3e','#afbdcf','#d99882','#c7cba0','#7f9983'];
const key = 'wheel-of-names-v1';
const uid = () => crypto.randomUUID();
const sample = () => ['Ava','Liam','Olivia','Noah','Emma','Oliver','Sophia','James'].map(name => ({id:uid(),name,weight:1}));
let state = {entries:sample(),results:[],title:'The lucky pick',duration:5,sound:false,panelHidden:false};
let spinning = false, rotation = 0, lastWinnerId = null, audio = null, toastTimer, confettiFrame;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const imageURLs = new Map();
let editingImageEntryId = null, imageUploadPending = false, winnerImageRequest = 0;

try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && Array.isArray(saved.entries) && saved.entries.length <= MAX_ENTRIES && saved.entries.every(e => typeof e.name === 'string' && e.name.trim() && e.name.length <= 120 && Number.isFinite(e.weight) && e.weight >= 0)) {
    state.entries = saved.entries.map(e => ({id:uid(),name:e.name,weight:e.weight,...(typeof e.imageId==='string' && /^[\da-f-]{36}$/i.test(e.imageId) ? {imageId:e.imageId} : {})}));
    state.results = Array.isArray(saved.results) ? saved.results.filter(r => typeof r.name === 'string' && Number.isFinite(r.time) && Number.isFinite(r.chance)).slice(0,100) : [];
    state.title = typeof saved.title === 'string' && saved.title.trim() ? saved.title.slice(0,60) : state.title;
    state.duration = Number.isFinite(saved.duration) ? Math.max(2,Math.min(12,saved.duration)) : 5;
    state.sound = saved.sound === true;
    state.panelHidden = saved.panelHidden === true;
  }
} catch { /* Browser storage is optional. */ }

function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { $('#save-label').textContent = 'Storage unavailable · export CSV to keep entries'; $('.local-status').textContent = 'Browser storage unavailable'; return false; }
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200); }
function chanceText(chance) { return chance > 0 && chance < 0.001 ? '<0.1%' : `${(chance * 100).toFixed(1).replace(/\.0$/,'')}%`; }
function random() { const buffer = new Uint32Array(1); crypto.getRandomValues(buffer); return buffer[0] / 4294967296; }
function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('icon'); const use = document.createElementNS(svg.namespaceURI,'use'); use.setAttribute('href',`#i-${name}`); svg.append(use); return svg; }

async function imageURL(id) {
  if (!id) return null;
  if (!imageURLs.has(id)) {
    imageURLs.set(id,getImage(id).then(blob => blob ? URL.createObjectURL(blob) : null).catch(() => { imageURLs.delete(id); return null; }));
  }
  return imageURLs.get(id);
}
async function discardImage(id) {
  if (!id) return;
  const cached = imageURLs.get(id);
  imageURLs.delete(id);
  if (cached) { const url = await cached; if (url) URL.revokeObjectURL(url); }
  try { await deleteImage(id); } catch { /* A failed cleanup must not interrupt the wheel. */ }
}
async function loadThumbnail(button, entry) {
  const url = await imageURL(entry.imageId);
  if (!url || !button.isConnected) return;
  const image = document.createElement('img');image.src=url;image.alt='';image.loading='lazy';
  button.replaceChildren(image);button.classList.add('has-image');
}
async function showWinnerImage(entry) {
  const request = ++winnerImageRequest, image = $('#winner-image');
  image.hidden=true;image.removeAttribute('src');$('.winner-star').hidden=false;
  const url = await imageURL(entry.imageId);
  if (!url || request !== winnerImageRequest) return;
  image.src=url;image.alt=`Image for ${entry.name}`;image.hidden=false;$('.winner-star').hidden=true;
}
function removeEntry(id) {
  const entry = state.entries.find(e => e.id === id);
  state.entries=state.entries.filter(e=>e.id!==id);
  render();
  if (save() && entry?.imageId) void discardImage(entry.imageId);
}

function drawWheel() {
  const canvas = $('#wheel'), ctx = canvas.getContext('2d'), size = canvas.width, center = size / 2, radius = center - 2;
  ctx.clearRect(0,0,size,size);
  ctx.save(); ctx.translate(center,center); ctx.rotate(rotation);
  const entries = state.entries, count = entries.length;
  if (!count) { ctx.fillStyle = '#e5e9dc';ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill(); }
  const slice = TAU / count;
  entries.forEach((entry,index) => {
    const start = -Math.PI/2 + index * slice;
    ctx.beginPath(); ctx.moveTo(0,0);ctx.arc(0,0,radius,start,start+slice);ctx.closePath();ctx.fillStyle=colors[index%colors.length];ctx.fill();
    ctx.strokeStyle='#fff9e838';ctx.lineWidth=count>80?0.6:2;ctx.stroke();
    if(count>120) return;
    const middle=start+slice/2;
    ctx.save();ctx.rotate(middle);ctx.translate(radius * 0.69,0);
    if(Math.cos(middle)<0)ctx.rotate(Math.PI);
    const fontSize=Math.min(40,Math.max(9,620/count));
    ctx.font=`600 ${fontSize}px "DM Sans", sans-serif`;
    ctx.fillStyle=index%colors.length===3?'#fffdf3':'#2a4636';ctx.textAlign='center';ctx.textBaseline='middle';
    let text=entry.name;const maxWidth=radius*0.39;
    while(ctx.measureText(text).width>maxWidth&&text.length>1)text=text.slice(0,-1);
    if(text!==entry.name)text=text.slice(0,-1)+'…';
    ctx.fillText(text,0,0);ctx.restore();
  });
  ctx.restore();
  canvas.setAttribute('aria-label', `Wheel with ${count} equal-sized slices. Selection uses the configured weights.`);
  $('.wheel-stage').classList.toggle('is-empty',!count);$('.empty-wheel').hidden=!!count;
}
function updateChances() {
  const chances=normalizedChances(state.entries);
  document.querySelectorAll('.entry-chance').forEach((element,index)=>element.textContent=chanceText(chances[index]));
  const canSpin=chances.some(chance=>chance>0)&&!spinning;
  $('#spin-button').disabled=!canSpin;$('#hub-button').disabled=!canSpin;
  $('#spin-label').textContent=spinning?'Spinning…':!state.entries.length?'Add names to spin':!canSpin?'Set a positive weight':'Spin the wheel';
  const equal=state.entries.length>0&&state.entries.every(e=>e.weight===state.entries[0].weight);
  $('#weight-mode-label').textContent=equal?'Equal chances':'Custom weights';
}
function renderEntries() {
  const list=$('#entries-list');list.replaceChildren();
  if(!state.entries.length){const empty=document.createElement('div');empty.className='entries-empty';empty.textContent='Every good spin starts with a name. Add your first one below.';list.append(empty);}
  state.entries.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='entry-row';
    const wrap=document.createElement('div');wrap.className='entry-name-wrap';
    const photo=document.createElement('button');photo.className='entry-photo';photo.type='button';photo.style.setProperty('--entry-color',colors[index%colors.length]);photo.append(icon('image'));
    photo.setAttribute('aria-label',`${entry.imageId?'Change':'Add'} image for ${entry.name}`);photo.title=photo.getAttribute('aria-label');
    photo.addEventListener('click',()=>{if(!spinning)openEntryImage(entry.id);});
    const name=document.createElement('input');name.className='entry-name';name.value=entry.name;name.maxLength=120;name.setAttribute('aria-label',`Name for entry ${index+1}`);
    name.addEventListener('input',()=>{const value=name.value.trim();name.setCustomValidity(value?'':'Enter a name');if(value){entry.name=value;photo.setAttribute('aria-label',`${entry.imageId?'Change':'Add'} image for ${entry.name}`);photo.title=photo.getAttribute('aria-label');drawWheel();save();}});
    name.addEventListener('blur',()=>{name.value=entry.name;name.setCustomValidity('');});wrap.append(photo,name);
    const weight=document.createElement('input');weight.type='number';weight.className='entry-weight';weight.min='0';weight.step='any';weight.value=entry.weight;weight.setAttribute('aria-label',`Weight for ${entry.name}`);
    weight.addEventListener('input',()=>{const value=weight.valueAsNumber;if(!Number.isFinite(value)||value<0){weight.setCustomValidity('Enter a finite number of zero or more.');return;}weight.setCustomValidity('');entry.weight=value;updateChances();save();});
    weight.addEventListener('blur',()=>{weight.value=entry.weight;weight.setCustomValidity('');});
    const chance=document.createElement('span');chance.className='entry-chance';
    const remove=document.createElement('button');remove.className='remove-entry';remove.setAttribute('aria-label',`Remove ${entry.name}`);remove.append(icon('close'));
    remove.addEventListener('click',()=>{if(!spinning)removeEntry(entry.id);});
    row.append(wrap,weight,chance,remove);list.append(row);
    if(entry.imageId)void loadThumbnail(photo,entry);
  });
  $('#entry-count').textContent=state.entries.length;updateChances();
}
function renderResults() {
  $('#result-count').textContent=state.results.length;
  const list=$('#results-list');list.replaceChildren();
  if(!state.results.length){const empty=document.createElement('div');empty.className='results-empty';empty.append(icon('clock'),document.createElement('br'),document.createTextNode('A little suspense awaits.'),document.createElement('br'),document.createTextNode('Your picks will appear here.'));list.append(empty);}
  state.results.forEach((result,index)=>{
    const row=document.createElement('div');row.className='result-row';
    const number=document.createElement('span');number.className='result-number';number.textContent=state.results.length-index;
    const info=document.createElement('div');info.className='result-info';const name=document.createElement('strong');name.textContent=result.name;
    const detail=document.createElement('small');detail.textContent=`${chanceText(result.chance)} chance when picked`;info.append(name,detail);
    const time=document.createElement('time');time.dateTime=new Date(result.time).toISOString();time.textContent=new Date(result.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});time.title=new Date(result.time).toLocaleString();
    row.append(number,info,time);list.append(row);
  });
}
function updatePanelVisibility() {
  $('#entries-panel').hidden = state.panelHidden;
  $('.workspace').classList.toggle('panel-hidden',state.panelHidden);
  $('#panel-toggle').setAttribute('aria-expanded',String(!state.panelHidden));
  $('#panel-toggle-label').textContent = state.panelHidden ? 'Show panel' : 'Hide panel';
  // Keep the winner announcement free of probabilities while the panel is hidden.
  $('#winner-probability')?.toggleAttribute('hidden',state.panelHidden);
}
function render() { renderEntries();renderResults();drawWheel();$('#wheel-title').textContent=state.title;updateSoundButton();updatePanelVisibility(); }
function setEditingDisabled(disabled) { document.querySelectorAll('#entries-content input,#entries-content button,.import-trigger,#bulk-button,#edit-title-button,#settings-button').forEach(e=>e.disabled=disabled); }
function initAudio() { if(!state.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{} }
function tone(frequency,duration=.025,volume=.025) { if(!state.sound||!audio||audio.state!=='running')return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=frequency;gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.start();oscillator.stop(audio.currentTime+duration); }

function spin() {
  if(spinning||document.querySelector('dialog[open]'))return;
  const chances=normalizedChances(state.entries);if(!chances.some(c=>c>0)){toast('Add a name and give it a positive weight.');return;}
  initAudio();const index=pickWeightedIndex(state.entries,random()),entry={...state.entries[index]};
  lastWinnerId=entry.id;spinning=true;setEditingDisabled(true);updateChances();
  const startRotation=rotation,target=rotationForWinner(index,state.entries.length,rotation,random(),6+Math.floor(random()*3));
  const duration=reducedMotion.matches?180:state.duration*1000;const start=performance.now();let tick=-1;
  function frame(now){const progress=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-progress,5);rotation=startRotation+(target-startRotation)*eased;drawWheel();const current=Math.floor(rotation/(TAU/state.entries.length));if(current!==tick){tick=current;tone(510+random()*110);}if(progress<1){requestAnimationFrame(frame);return;}
    rotation=target%TAU;spinning=false;setEditingDisabled(false);updateChances();drawWheel();
    state.results.unshift({name:entry.name,chance:chances[index],time:Date.now()});state.results=state.results.slice(0,100);renderResults();save();
    $('#winner-name').textContent=entry.name;
    void showWinnerImage(entry);
    $('#winner-details').textContent=`Picked from ${state.entries.length} ${state.entries.length===1?'entry':'entries'}`;
    const probability=document.createElement('span');probability.id='winner-probability';probability.textContent=` · ${chanceText(chances[index])} chance`;probability.hidden=state.panelHidden;$('#winner-details').append(probability);
    $('#remove-winner').disabled=false;$('#winner-dialog').showModal();
    tone(660,.18,.04);setTimeout(()=>tone(880,.25,.035),120);celebrate();
  }requestAnimationFrame(frame);
}

function celebrate(){cancelAnimationFrame(confettiFrame);const canvas=$('#confetti'),ctx=canvas.getContext('2d');canvas.width=innerWidth;canvas.height=innerHeight;if(reducedMotion.matches)return;const start=performance.now(),pieces=Array.from({length:85},()=>({x:canvas.width*.5,y:canvas.height*.42,vx:(random()-.5)*14,vy:-random()*12-3,color:colors[Math.floor(random()*colors.length)],angle:random()*TAU,size:4+random()*5}));function frame(now){ctx.clearRect(0,0,canvas.width,canvas.height);const elapsed=now-start;for(const p of pieces){p.x+=p.vx;p.y+=p.vy;p.vy+=.16;p.angle+=.08;ctx.save();ctx.globalAlpha=Math.max(0,1-elapsed/3000);ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.55);ctx.restore();}if(elapsed<3000)confettiFrame=requestAnimationFrame(frame);else ctx.clearRect(0,0,canvas.width,canvas.height);}confettiFrame=requestAnimationFrame(frame);}

$('#spin-button').addEventListener('click',spin);$('#hub-button').addEventListener('click',spin);
$('#panel-toggle').addEventListener('click',()=>{state.panelHidden=!state.panelHidden;updatePanelVisibility();save();});
$('#spin-again').addEventListener('click',()=>{$('#winner-dialog').close();spin();});
$('#remove-winner').addEventListener('click',()=>{$('#winner-dialog').close();removeEntry(lastWinnerId);toast('Entry removed. Ready for the next pick.');});
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat&&!['INPUT','TEXTAREA','BUTTON','SELECT','A'].includes(event.target.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();spin();}});
$('#add-form').addEventListener('submit',event=>{event.preventDefault();if(spinning)return;const name=$('#new-name').value.trim();if(!name){$('#new-name').focus();return;}if(state.entries.length>=MAX_ENTRIES){toast(`Your wheel can hold up to ${MAX_ENTRIES.toLocaleString()} entries.`);return;}state.entries.push({id:uid(),name,weight:1});$('#new-name').value='';renderEntries();drawWheel();save();$('#entries-list').scrollTop=$('#entries-list').scrollHeight;$('#new-name').focus();});
$('#equal-button').addEventListener('click',()=>{if(spinning)return;state.entries.forEach(e=>e.weight=1);renderEntries();save();toast('Every name now has the same chance.');});
$('#shuffle-button').addEventListener('click',()=>{if(spinning)return;for(let i=state.entries.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[state.entries[i],state.entries[j]]=[state.entries[j],state.entries[i]];}renderEntries();drawWheel();save();toast('Names shuffled. Your odds stay the same.');});

function selectTab(selected){for(const name of ['entries','results']){const active=name===selected,tab=$(`#${name}-tab`);tab.classList.toggle('active',active);tab.setAttribute('aria-selected',active);tab.tabIndex=active?0:-1;$(`#${name}-content`).hidden=!active;}}
for(const name of ['entries','results']){$(`#${name}-tab`).addEventListener('click',()=>selectTab(name));$(`#${name}-tab`).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'entries':event.key==='End'?'results':name==='entries'?'results':'entries';selectTab(next);$(`#${next}-tab`).focus();}});}
$('#clear-results').addEventListener('click',()=>{state.results=[];renderResults();save();toast('Results cleared.');});
$('#export-button').addEventListener('click',()=>{if(!state.entries.length){toast('Add some entries before exporting.');return;}const url=URL.createObjectURL(new Blob([exportCSV(state.entries)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='wheel-of-names.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your entries and weights have been exported.');});

async function openEntryImage(id) {
  if(imageUploadPending)return;
  const entry=state.entries.find(e=>e.id===id);if(!entry)return;
  editingImageEntryId=id;
  $('#image-dialog-title').textContent=`Image for ${entry.name}`;
  $('#entry-image-file').value='';$('#image-error').textContent='';$('#image-status').textContent='';
  $('#entry-image-preview').hidden=true;$('#entry-image-preview').removeAttribute('src');
  $('#remove-entry-image').hidden=!entry.imageId;
  $('#image-dialog').showModal();
  const url=await imageURL(entry.imageId);
  if(editingImageEntryId!==id||!$('#image-dialog').open)return;
  if(url){$('#entry-image-preview').src=url;$('#entry-image-preview').alt=`Image for ${entry.name}`;$('#entry-image-preview').hidden=false;}
  else if(entry.imageId)$('#image-error').textContent='This image is unavailable. Choose a new one to replace it.';
}
function setImageBusy(busy) {
  imageUploadPending=busy;$('#entry-image-file').disabled=busy;$('#remove-entry-image').disabled=busy;
  $('#image-status').textContent=busy?'Saving your image…':'';
}
async function uploadEntryImage(file) {
  if(!file||imageUploadPending)return;
  const entry=state.entries.find(e=>e.id===editingImageEntryId);if(!entry)return;
  $('#image-error').textContent='';setImageBusy(true);
  let newId;
  try {
    const blob=await prepareImage(file);
    if(!$('#image-dialog').open||editingImageEntryId!==entry.id)return;
    newId=uid();
    try { await putImage(newId,blob); }
    catch { throw new Error('Could not save the image in this browser. Check available storage or try a smaller image.'); }
    if(!$('#image-dialog').open||editingImageEntryId!==entry.id||!state.entries.includes(entry)){void discardImage(newId);return;}
    const oldId=entry.imageId;entry.imageId=newId;
    if(!save()){
      if(oldId)entry.imageId=oldId;else delete entry.imageId;
      void discardImage(newId);throw new Error('Browser storage is unavailable. The image could not be saved.');
    }
    renderEntries();
    const url=await imageURL(newId);
    if($('#image-dialog').open&&editingImageEntryId===entry.id&&url){$('#entry-image-preview').src=url;$('#entry-image-preview').alt=`Image for ${entry.name}`;$('#entry-image-preview').hidden=false;$('#remove-entry-image').hidden=false;}
    if(oldId)void discardImage(oldId);
    toast(`Image saved for ${entry.name}.`);
  } catch(error) { $('#image-error').textContent=error.message||'Could not save that image. Try a different file.'; }
  finally { setImageBusy(false);$('#entry-image-file').value=''; }
}
$('#entry-image-file').addEventListener('change',event=>void uploadEntryImage(event.target.files[0]));
$('#image-drop-zone').addEventListener('dragover',event=>{event.preventDefault();$('#image-drop-zone').classList.add('dragging');});
$('#image-drop-zone').addEventListener('dragleave',()=>$('#image-drop-zone').classList.remove('dragging'));
$('#image-drop-zone').addEventListener('drop',event=>{event.preventDefault();$('#image-drop-zone').classList.remove('dragging');void uploadEntryImage(event.dataTransfer.files[0]);});
$('#remove-entry-image').addEventListener('click',()=>{
  const entry=state.entries.find(e=>e.id===editingImageEntryId);if(!entry?.imageId||imageUploadPending)return;
  const oldId=entry.imageId;delete entry.imageId;
  if(!save()){entry.imageId=oldId;$('#image-error').textContent='Browser storage is unavailable. The image could not be removed.';return;}
  $('#entry-image-preview').hidden=true;$('#entry-image-preview').removeAttribute('src');$('#remove-entry-image').hidden=true;$('#image-error').textContent='';
  renderEntries();void discardImage(oldId);toast('Image removed.');
});

function openImport(paste=false){if(spinning)return;$('#import-title').textContent=paste?'Paste your names':'Import your entries';$('#import-error').textContent='';$('#import-text').value='';$('#csv-file').value='';$('#import-preview').textContent='';$('#drop-zone').hidden=paste;$('#import-dialog').showModal();if(paste)$('#import-text').focus();}
document.querySelectorAll('.import-trigger').forEach(button=>button.addEventListener('click',()=>openImport()));$('#bulk-button').addEventListener('click',()=>openImport(true));
function previewImport(){try{const entries=parseCSV($('#import-text').value);$('#import-preview').textContent=`${entries.length} ${entries.length===1?'entry':'entries'} ready · ${entries.slice(0,3).map(e=>e.name).join(', ')}${entries.length>3?'…':''}`;$('#import-error').textContent='';}catch{$('#import-preview').textContent='';}}
$('#import-text').addEventListener('input',previewImport);
async function readFile(file){if(!file)return;if(file.size>1024*1024){$('#import-error').textContent='Choose a CSV file smaller than 1 MB.';return;}try{$('#import-text').value=await file.text();previewImport();if(!$('#import-preview').textContent)parseCSV($('#import-text').value);}catch(error){$('#import-error').textContent=error.message||'Could not read that file.';}}
$('#csv-file').addEventListener('change',event=>readFile(event.target.files[0]));
$('#drop-zone').addEventListener('dragover',event=>{event.preventDefault();$('#drop-zone').classList.add('dragging');});$('#drop-zone').addEventListener('dragleave',()=>$('#drop-zone').classList.remove('dragging'));$('#drop-zone').addEventListener('drop',event=>{event.preventDefault();$('#drop-zone').classList.remove('dragging');readFile(event.dataTransfer.files[0]);});
$('#confirm-import').addEventListener('click',()=>{try{const imported=parseCSV($('#import-text').value).map(e=>({...e,id:uid()}));const append=$('input[name="import-mode"]:checked').value==='append';if(append&&state.entries.length+imported.length>MAX_ENTRIES)throw new Error(`Keep the combined wheel under ${MAX_ENTRIES+1} entries.`);const replaced=append?[]:state.entries;state.entries=append?[...state.entries,...imported]:imported;rotation=0;render();if(save())replaced.forEach(e=>{if(e.imageId)void discardImage(e.imageId);});$('#import-dialog').close();selectTab('entries');toast(`${imported.length} ${imported.length===1?'entry':'entries'} imported.`);}catch(error){$('#import-error').textContent=error.message;}});

function updateSoundButton(){$('#sound-button').setAttribute('aria-pressed',state.sound);$('#sound-button').setAttribute('aria-label',`Turn sound ${state.sound?'off':'on'}`);$('#sound-button').title=`Sound ${state.sound?'on':'off'}`;}
$('#sound-button').addEventListener('click',()=>{state.sound=!state.sound;updateSoundButton();save();initAudio();if(state.sound)tone(600,.1);});
function openSettings(){$('#title-input').value=state.title;$('#duration-input').value=state.duration;$('#duration-value').textContent=`${state.duration} seconds`;$('#sound-input').checked=state.sound;$('#settings-dialog').showModal();}
$('#settings-button').addEventListener('click',openSettings);$('#edit-title-button').addEventListener('click',()=>{openSettings();$('#title-input').focus();$('#title-input').select();});
$('#duration-input').addEventListener('input',()=>$('#duration-value').textContent=`${$('#duration-input').value} seconds`);
$('#save-settings').addEventListener('click',()=>{state.title=$('#title-input').value.trim()||'The lucky pick';state.duration=Number($('#duration-input').value);state.sound=$('#sound-input').checked;$('#wheel-title').textContent=state.title;updateSoundButton();save();$('#settings-dialog').close();toast('Settings saved.');});
$('#fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.body.requestFullscreen)await document.body.requestFullscreen();else toast('Use your browser’s full-screen option to expand the wheel.');}catch{toast('Use your browser’s full-screen option to expand the wheel.');}});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
render();save();document.fonts?.ready.then(drawWheel);
