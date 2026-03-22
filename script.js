
(function(){
'use strict';
const STORAGE_KEY = 'calendar_singlefile_v2';
const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const weekdayNames = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const palette = ['tone-1','tone-2','tone-3','tone-4','tone-5','tone-6'];
const eventTypeMeta = {
  'Travail': {icon:'💼', cls:'type-work'},
  'Réunion': {icon:'👥', cls:'type-meeting'},
  'Appel': {icon:'📞', cls:'type-call'},
  'Médecin': {icon:'🩺', cls:'type-medical'},
  'École': {icon:'🎓', cls:'type-school'},
  'Sport': {icon:'🏃', cls:'type-sport'},
  'Famille': {icon:'🏠', cls:'type-family'},
  'Sortie': {icon:'🎉', cls:'type-outing'},
  'Administratif': {icon:'🗂️', cls:'type-admin'},
  'Autre': {icon:'📌', cls:'type-other'}
};
const eventTypes = Object.keys(eventTypeMeta);
function normalizeType(type){ return eventTypeMeta[type] ? type : 'Autre'; }
function inferType(label){ return eventTypes.find(t => String(label||'').trim().toLowerCase()===t.toLowerCase()) || 'Autre'; }
function getEventType(ev){ return normalizeType(ev && ev.type ? ev.type : inferType(ev && ev.label)); }
function typeIcon(type){ return eventTypeMeta[normalizeType(type)].icon; }
function typeClass(type){ return eventTypeMeta[normalizeType(type)].cls; }
function typeOptions(selected){ return eventTypes.map(t=>`<option value="${esc(t)}" ${normalizeType(selected)===t?'selected':''}>${eventTypeMeta[t].icon} ${esc(t)}</option>`).join(''); }
const quickTypeRules = [
  {type:'Médecin', patterns:[/\bdentiste\b/i,/\bmedecin\b/i,/\bdocteur\b/i,/\bvaccin\b/i,/\bophtalmo\b/i,/\borthodontiste\b/i]},
  {type:'École', patterns:[/\becole\b/i,/\bcollege\b/i,/\bdevoirs?\b/i,/\bprof\b/i,/\bclasse\b/i]},
  {type:'Sport', patterns:[/\bsport\b/i,/\bfoot\b/i,/\btennis\b/i,/\bjudo\b/i,/\bdanse\b/i,/\bgym\b/i,/\bnatation\b/i,/\bpiscine\b/i,/\brugby\b/i]},
  {type:'Travail', patterns:[/\breunion\b/i,/\bvisio\b/i,/\btravail\b/i,/\bcall\b/i,/\bclient\b/i,/\bbureau\b/i]},
  {type:'Famille', patterns:[/\banniversaire\b/i,/\bfamille\b/i,/\bparents\b/i,/\bmaison\b/i]},
  {type:'Sortie', patterns:[/\bcinema\b/i,/\bresto\b/i,/\bsortie\b/i,/\bspectacle\b/i,/\bconcert\b/i]},
  {type:'Administratif', patterns:[/\bbanque\b/i,/\bimpots?\b/i,/\bpapier\b/i,/\badministratif\b/i,/\bmairie\b/i,/\bassurance\b/i]}
];

const themeMeta = {
  serious:{badge:'SÉRIEUSE',title:'Calendrier partagé',subtitle:'Un onglet par personne + une vue consolidée de tous les rendez-vous.'},
  ocean:{badge:'OCÉAN',title:'Marée des rendez-vous',subtitle:'Ambiance marine lumineuse et contrastée.'},
  sunset:{badge:'SUNSET',title:'Fin de journée éclatante',subtitle:'Palette chaude et dynamique.'},
  forest:{badge:'FORÊT',title:'Canopée organisée',subtitle:'Version végétale vive et profonde.'},
  lavender:{badge:'LAVANDE',title:'Agenda impérial',subtitle:'Violet assumé, plus premium.'},
  neon:{badge:'NÉON',title:'Console futuriste',subtitle:'Contraste radical et accents fluorescents.'},
  candy:{badge:'CANDY',title:'Calendrier pop',subtitle:'Skin ludique, sucrée et très colorée.'},
  contrast:{badge:'CONTRASTE',title:'Mode impact',subtitle:'Noir fort et lecture maximale.'},
  arcade:{badge:'ARCADE',title:'Salle d\'arcade',subtitle:'Néons rétro et esprit jeu vidéo.'},
  paper:{badge:'PAPIER',title:'Carnet de rendez-vous',subtitle:'Texture claire et style agenda papier.'},
  gold:{badge:'LUXE',title:'Édition prestige',subtitle:'Noir satiné et or plus premium.'},
  darkpremium:{badge:'DARK',title:'Dark mode premium',subtitle:'Noir profond, verre fumé et accents néon haut de gamme.'},
  mangacats:{badge:'NYA',title:'Maison des petits chats',subtitle:'Pastels rosés, reflets nacrés et petits chats façon manga.'},
  mangacatsblue:{badge:'NYA BLUE',title:'Nuit deep blue des petits chats',subtitle:'Bleu nuit profond, reflets cyan et encore plus de chats façon manga.'},
  galaxy:{badge:'GALAXIE',title:'Constellation des RDV',subtitle:'Version spatiale plus spectaculaire.'}
};
let quickMenuDay = null;
let quickMenuNode = null;
let dragState = null;
let lastQuickReveal = null;
function safeId(){ return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id_'+Math.random().toString(36).slice(2,10); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
const defaultPeople = [{id:safeId(),name:'Richard',color:'tone-1'},{id:safeId(),name:'Margot',color:'tone-2'},{id:safeId(),name:'Caroline',color:'tone-3'}];
const defaultState = { currentDate:new Date().toISOString().slice(0,10), activeTab:'all', theme:'serious', people:clone(defaultPeople), events:[] };
function ensureDefaultPeople(s){
  if(!Array.isArray(s.people)) s.people = [];
  const existing = new Set(s.people.map(p => String(p.name||'').trim().toLowerCase()));
  defaultPeople.forEach(p => { if(!existing.has(p.name.toLowerCase())) s.people.push({id:safeId(),name:p.name,color:p.color}); });
  return s;
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const base = saved ? Object.assign(clone(defaultState), saved) : clone(defaultState);
    return ensureDefaultPeople(base);
  }catch(e){
    return clone(defaultState);
  }
}
let state = loadState();
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function normalize(){
  if(!Array.isArray(state.people)) state.people=[];
  if(!Array.isArray(state.events)) state.events=[];
  state.people = state.people.filter(p=>p && p.id && p.name).map((p,i)=>({id:String(p.id),name:String(p.name).trim()||('Personne '+(i+1)),color:p.color||palette[i%palette.length]}));
  if(!state.people.length) state.people = clone(defaultState.people);
  const ids = new Set(state.people.map(p=>p.id));
  state.events = state.events.filter(e=>e && e.date && e.time && e.label).map(e=>({id:e.id||safeId(),ownerId:ids.has(e.ownerId)?e.ownerId:state.people[0].id,date:e.date,time:e.time,label:e.label,type:getEventType(e),location:e.location||'',notes:e.notes||'',duration:Number(e.duration)||30}));
  if(state.activeTab!=='all' && !ids.has(state.activeTab)) state.activeTab='all';
  if(!themeMeta[state.theme]) state.theme='serious';
  saveState();
}
function seedDemo(){
  if(state.events.length) return;
  const now = new Date(), y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  const p1=state.people[0], p2=state.people[1]||state.people[0];
  state.events=[
    {id:safeId(),ownerId:p1.id,date:`${y}-${m}-08`,time:'09:30',label:'Dentiste',type:'Médecin',location:'Cabinet médical',notes:'Contrôle annuel',duration:30},
    {id:safeId(),ownerId:p1.id,date:`${y}-${m}-12`,time:'14:00',label:'Réunion client',type:'Réunion',location:'Teams',notes:'',duration:60},
    {id:safeId(),ownerId:p2.id,date:`${y}-${m}-12`,time:'16:30',label:'Cours de guitare',type:'Sport',location:'Studio',notes:'',duration:45},
    {id:safeId(),ownerId:p2.id,date:`${y}-${m}-20`,time:'11:00',label:'Orthodontiste',type:'Médecin',location:'',notes:'',duration:30}
  ];
  saveState();
}
const $ = id => document.getElementById(id);
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function foldText(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function dateVal(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthDate(){ return new Date(state.currentDate+'T12:00:00'); }
function shiftMonth(delta){ const d=monthDate(); d.setMonth(d.getMonth()+delta); state.currentDate=dateVal(d); saveState(); render(); }
function inferQuickType(title){
  const folded = foldText(title);
  for(const rule of quickTypeRules){
    if(rule.patterns.some(pattern => pattern.test(folded))) return rule.type;
  }
  return 'Autre';
}
function buildFutureDate(day, monthIndex, yearHint){
  const today = new Date();
  today.setHours(12,0,0,0);
  let year = yearHint || today.getFullYear();
  let candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if(!yearHint && candidate < today) candidate = new Date(year + 1, monthIndex, day, 12, 0, 0, 0);
  return candidate;
}
function nextWeekdayDate(targetIndex){
  const base = new Date();
  base.setHours(12,0,0,0);
  const current = (base.getDay() + 6) % 7;
  const delta = (targetIndex - current + 7) % 7;
  base.setDate(base.getDate() + delta);
  return base;
}
function cleanupQuickTitle(text){
  let cleaned = String(text || '').replace(/[–—,.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^(?:le|la|les|du|de|des|a|à)\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+(?:le|la|les|du|de|des|a|à)$/i, '').trim();
  return cleaned || 'Sans titre';
}
function parseQuickEntry(raw){
  const source = String(raw || '').trim();
  if(!source) return {ok:false, message:'Écris un rendez-vous, par exemple : Dentiste mardi 18h.'};
  let working = source;
  let parsedDate = null;
  let parsedTime = null;
  const monthMap = {janvier:0,fevrier:1,mars:2,avril:3,mai:4,juin:5,juillet:6,aout:7,septembre:8,octobre:9,novembre:10,decembre:11};
  let match = working.match(/\b(?:a\s+|à\s*)?(\d{1,2})\s*[:h]\s*(\d{2})\b/i) || working.match(/\b(?:a\s+|à\s*)?(\d{1,2})h\b/i);
  if(match){
    const hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    if(hours <= 23 && minutes <= 59){
      parsedTime = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
      working = working.replace(match[0], ' ');
    }
  }
  const relPatterns = [
    {regex:/\b(?:apr[eè]s[-\s]?demain)\b/i, offset:2},
    {regex:/\bdemain\b/i, offset:1},
    {regex:/\b(?:aujourd['’]?hui|aujourdhui)\b/i, offset:0}
  ];
  for(const item of relPatterns){
    const m = working.match(item.regex);
    if(m){
      const d = new Date();
      d.setHours(12,0,0,0);
      d.setDate(d.getDate() + item.offset);
      parsedDate = dateVal(d);
      working = working.replace(m[0], ' ');
      break;
    }
  }
  if(!parsedDate){
    match = working.match(/\b(?:le\s+)?(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+(\d{4}))?\b/i);
    if(match){
      const foldedMonth = foldText(match[2]);
      const monthIndex = monthMap[foldedMonth];
      if(monthIndex >= 0){
        parsedDate = dateVal(buildFutureDate(Number(match[1]), monthIndex, match[3] ? Number(match[3]) : null));
        working = working.replace(match[0], ' ');
      }
    }
  }
  if(!parsedDate){
    match = working.match(/\b(?:le\s+)?(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);
    if(match){
      let year = match[3] ? Number(match[3]) : null;
      if(year && year < 100) year += 2000;
      parsedDate = dateVal(buildFutureDate(Number(match[1]), Number(match[2]) - 1, year));
      working = working.replace(match[0], ' ');
    }
  }
  if(!parsedDate){
    match = working.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i);
    if(match){
      const weekdayMap = {lundi:0,mardi:1,mercredi:2,jeudi:3,vendredi:4,samedi:5,dimanche:6};
      parsedDate = dateVal(nextWeekdayDate(weekdayMap[foldText(match[1])]));
      working = working.replace(match[0], ' ');
    }
  }
  if(!parsedDate) return {ok:false, message:"Je n'ai pas reconnu la date. Exemples : demain 9h, mardi 18h, 12/04 19h, 12 avril 19h."};
  if(!parsedTime) return {ok:false, message:"Je n'ai pas reconnu l'heure. Exemples : 9h, 18h, 18h30 ou 19:00."};
  const title = cleanupQuickTitle(working);
  return {ok:true, date:parsedDate, time:parsedTime, title:title, type:inferQuickType(title)};
}
function updateQuickEntryStatus(message, tone){
  const status = $('quickEntryStatus');
  if(!status) return;
  status.textContent = message;
  status.classList.remove('error','success');
  if(tone) status.classList.add(tone);
}
function updateQuickEntryUi(){
  const card = $('quickEntryCard');
  const input = $('quickEntryInput');
  const button = $('quickEntryBtn');
  const badge = $('quickEntryBadge');
  const status = $('quickEntryStatus');
  if(!card || !input || !button || !badge || !status) return;
  if(state.activeTab === 'all'){
    badge.textContent = 'Vue totale ouverte';
    input.disabled = true;
    button.disabled = true;
    input.placeholder = "Passe sur Richard, Margot ou Caroline pour utiliser l'ajout rapide.";
    if(!status.dataset.locked) updateQuickEntryStatus("L'ajout rapide fonctionne dans un onglet personne, pas dans Total.", '');
  } else {
    const owner = getPerson(state.activeTab);
    badge.textContent = `Onglet courant : ${owner ? owner.name : 'Personne'}`;
    input.disabled = false;
    button.disabled = false;
    input.placeholder = 'Ex. Dentiste mardi 18h, Piano samedi 10h, Vaccin demain 9h';
    if(!status.dataset.locked) updateQuickEntryStatus('Formats reconnus : demain 9h, mardi 18h, 12/04 19h, 12 avril 19h.', '');
  }
}
function handleQuickEntry(){
  if(state.activeTab === 'all'){
    const status = $('quickEntryStatus');
    if(status) status.dataset.locked = '1';
    updateQuickEntryStatus("Ouvre d'abord un onglet personne pour savoir où ranger le rendez-vous.", 'error');
    return;
  }
  const input = $('quickEntryInput');
  const status = $('quickEntryStatus');
  if(!input || !status) return;
  const parsed = parseQuickEntry(input.value);
  status.dataset.locked = '1';
  if(!parsed.ok){
    updateQuickEntryStatus(parsed.message, 'error');
    return;
  }
  const owner = getPerson(state.activeTab);
  const payload = { id: safeId(), ownerId: state.activeTab, date: parsed.date, type: parsed.type, label: parsed.title, time: parsed.time, duration: 30, location: '', notes: '' };
  state.events.push(payload);
  state.events.sort((a,b)=>(`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
  state.currentDate = payload.date;
  lastQuickReveal = { date: payload.date, eventId: payload.id, ownerId: payload.ownerId };
  saveState();
  input.value = '';
  render();
  const finalStatus = $('quickEntryStatus');
  if(finalStatus) finalStatus.dataset.locked = '1';
  updateQuickEntryStatus(`Rendez-vous ajouté dans ${owner ? owner.name : 'cet onglet'} : ${formatDateFr(payload.date, true)} à ${payload.time}.`, 'success');
}
function formatDateFr(s,short){ const d=new Date(s+'T12:00:00'); return new Intl.DateTimeFormat('fr-FR',{weekday:short?undefined:'long',day:'numeric',month:'long',year:short?undefined:'numeric'}).format(d); }
function formatMonthShort(input){
  const d = typeof input === 'string' ? new Date(input+'T12:00:00') : new Date(input);
  return new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(d).replace('.', '').trim();
}
function getPerson(id){ return state.people.find(p=>p.id===id); }
function startOfWeek(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
function endOfWeek(d){ const x=startOfWeek(d); x.setDate(x.getDate()+6); x.setHours(23,59,59,999); return x; }

function getSearchQuery(){ return ($('searchInput').value||'').trim().toLowerCase(); }
function getMonthEvents(options={}){
  const { ownerId=null, respectSearch=true } = options;
  const q = respectSearch ? getSearchQuery() : '';
  const cur = monthDate(), y = cur.getFullYear(), m = cur.getMonth();
  return state.events
    .filter(e => !ownerId || e.ownerId === ownerId)
    .filter(e => {
      const d = new Date(e.date+'T12:00:00');
      if(d.getFullYear() !== y || d.getMonth() !== m) return false;
      if(!q) return true;
      const owner = (getPerson(e.ownerId)||{}).name || '';
      return [e.label,e.type,e.location,e.notes,owner,e.time].join(' ').toLowerCase().includes(q);
    })
    .sort((a,b)=>(`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
}
function buildOwnerOptions(selectedId){
  return state.people.map(p => `<option value="${p.id}" ${String(selectedId)===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('');
}
function syncEventOwnerField(selectedId){
  const field = $('eventOwnerField');
  const select = $('eventOwnerSelect');
  if(!field || !select) return;
  select.innerHTML = buildOwnerOptions(selectedId || state.people[0].id);
  select.value = selectedId || state.people[0].id;
  field.classList.toggle('hidden', state.people.length <= 1 && state.activeTab !== 'all');
}

function computeDashboard(targetOwnerId){
  const events = getMonthEvents({ ownerId: targetOwnerId || null, respectSearch:false });
  const now = new Date();
  const todayStr = dateVal(now);
  const weekStart = startOfWeek(now), weekEnd = endOfWeek(now);
  const todayCount = events.filter(e => e.date===todayStr).length;
  const weekCount = events.filter(e => { const d = new Date(e.date+'T12:00:00'); return d>=weekStart && d<=weekEnd; }).length;
  const upcoming = events.find(e => new Date(`${e.date}T${e.time}:00`) >= now);
  const byDay = {};
  events.forEach(e => { byDay[e.date] = (byDay[e.date]||0)+1; });
  let busiestDate = '', busiestCount = 0;
  Object.keys(byDay).sort().forEach(date => { if(byDay[date] > busiestCount){ busiestDate = date; busiestCount = byDay[date]; } });
  const byPerson = {};
  events.forEach(e => { byPerson[e.ownerId] = (byPerson[e.ownerId]||0)+1; });
  let topPerson = null;
  Object.keys(byPerson).forEach(id => { if(!topPerson || byPerson[id] > topPerson.count) topPerson = { id, count: byPerson[id] }; });
  return { events, todayCount, weekCount, upcoming, busiestDate, busiestCount, topPerson };
}
function renderDashboard(targetOwnerId){
  const stats=computeDashboard(targetOwnerId);
  const owner=targetOwnerId?getPerson(targetOwnerId):null;
  const title=owner?`Tableau de bord — ${esc(owner.name)}`:'Tableau de bord famille';
  const subtitle=owner?'Résumé immédiat du mois affiché pour cette personne.':'Vue synthétique immédiate du mois affiché pour toute la famille.';
  const topPersonLabel=owner?esc(owner.name):(stats.topPerson?esc((getPerson(stats.topPerson.id)||{}).name||'—'):'—');
  const topPersonMeta=owner?`${stats.events.length} rendez-vous dans le mois affiché`:(stats.topPerson?`${stats.topPerson.count} rendez-vous dans le mois affiché`:'Aucun rendez-vous');
  return `<section class="card dashboard"><div class="legend" style="margin-bottom:12px"><span class="pill">TABLEAU DE BORD</span></div><div class="dashboard-head"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="legend">${targetOwnerId?`<span class="item ${owner?owner.color:'tone-1'}"><span class="dot"></span>${owner?esc(owner.name):'—'}</span>`:state.people.map(p=>`<span class="item ${p.color}"><span class="dot"></span>${esc(p.name)}</span>`).join('')}</div></div><div class="dashboard-cards"><article class="dashboard-card accent"><span class="label">Aujourd'hui</span><span class="value">${stats.todayCount}</span><span class="meta">Rendez-vous prévus aujourd'hui</span></article><article class="dashboard-card success"><span class="label">Cette semaine</span><span class="value">${stats.weekCount}</span><span class="meta">Rendez-vous de lundi à dimanche</span></article><article class="dashboard-card warn"><span class="label">Prochain rendez-vous</span><span class="value">${stats.upcoming?esc(stats.upcoming.time):'—'}</span><span class="meta">${stats.upcoming?`${formatDateFr(stats.upcoming.date,true)} — ${esc(stats.upcoming.label)}`:'Aucun rendez-vous à venir'}</span></article><article class="dashboard-card info"><span class="label">${owner?'Mois affiché':'Personne la plus occupée'}</span><span class="value">${topPersonLabel}</span><span class="meta">${owner?`${stats.events.length} rendez-vous dans le mois affiché`:topPersonMeta}</span></article></div>${stats.busiestDate?`<div class="legend" style="margin-top:14px"><span class="pill">Journée la plus chargée : ${formatDateFr(stats.busiestDate,true)} · ${stats.busiestCount} RDV</span></div>`:''}</section>`;
}
function getFilteredEvents(){
  return getMonthEvents({ ownerId: state.activeTab==='all' ? null : state.activeTab, respectSearch:true });
 }

 function buildMonthMatrix(year,month){ const first=new Date(year,month,1); const firstDay=(first.getDay()+6)%7; const start=new Date(year,month,1-firstDay); const out=[]; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); out.push({date:d,currentMonth:d.getMonth()===month}); } return out; }
 function applyTheme(){ document.documentElement.setAttribute('data-theme', state.theme); const meta=themeMeta[state.theme]; $('themeBadge').textContent=meta.badge; $('heroTitle').textContent=meta.title; $('heroSubtitle').textContent=meta.subtitle; $('themeSelect').value=state.theme; }
 function renderTabs(){ const personTabs = state.people.map(p=>`<button class="tab ${state.activeTab===p.id?'active':''}" data-tab="${p.id}">${esc(p.name)}</button>`).join(''); const totalTab = `<button class="tab ${state.activeTab==='all'?'active':''}" data-tab="all">Total</button>`; $('tabsBar').innerHTML = personTabs + totalTab; document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{ state.activeTab=btn.getAttribute('data-tab'); saveState(); render(); })); }
 function renderMonthLabel(){ const d=monthDate(); $('currentMonthLabel').textContent = monthNames[d.getMonth()]+' '+d.getFullYear(); }
 function eventBtn(e,showOwner){ const owner=getPerson(e.ownerId)||{name:'Sans nom',color:'tone-1'}; const type=getEventType(e); const subtitle=(e.label&&e.label.trim())?e.label.trim():'Sans titre'; const untitled=!(e.label&&e.label.trim()); return `<button class="event ${owner.color} ${typeClass(type)}" draggable="true" data-edit="${e.id}" data-event-id="${e.id}"><div class="event-head"><span class="event-icon">${typeIcon(type)}</span><span class="event-title">${esc(type)}</span></div><div class="event-type-line"><span class="event-subtitle ${untitled?'untitled':''}">${esc(subtitle)}</span><time class="event-meta">${esc(e.time)}</time></div>${showOwner?`<small>${esc(owner.name)}</small>`:(e.location?`<small>${esc(e.location)}</small>`:'')}</button>`; }
 
function getFocusAnchorDate(){
  const shown = monthDate();
  const today = new Date();
  const shownMonth = shown.getMonth(), shownYear = shown.getFullYear();
  if(today.getMonth()===shownMonth && today.getFullYear()===shownYear) return dateVal(today);
  const current = new Date(state.currentDate + 'T12:00:00');
  if(current.getMonth()===shownMonth && current.getFullYear()===shownYear) return dateVal(current);
  return dateVal(new Date(shownYear, shownMonth, 1));
}

function getFocusRange(anchorIso, beforeCount=5, afterCount=7){
  const anchor = new Date(anchorIso+'T12:00:00');
  const start = new Date(anchor);
  start.setDate(start.getDate() - beforeCount);
  const out = [];
  for(let i=0;i<beforeCount+afterCount+1;i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}
function renderFocusStrip(events,isCombined,ownerId){
  const shown = monthDate();
  const anchorDate = getFocusAnchorDate();
  const range = getFocusRange(anchorDate, 5, 7);
  const todayIso = dateVal(new Date());
  const anchorIsToday = anchorDate === todayIso;
  const cards = range.map(dayDate => {
    const iso = dateVal(dayDate);
    const dayEvents = events.filter(e => e.date===iso && (isCombined || e.ownerId===ownerId));
    return dayCell({ date: dayDate, currentMonth: dayDate.getMonth()===shown.getMonth() && dayDate.getFullYear()===shown.getFullYear() }, todayIso, dayEvents, isCombined, ownerId, { variant:'focus', isAnchor: iso===anchorDate });
  });
  const title = anchorIsToday ? "Vue resserrée autour d'aujourd'hui" : `Vue resserrée autour du ${formatDateFr(anchorDate, true)}`;
  const subtitle = anchorIsToday
    ? "Grandes cases horizontales sur 13 jours, centrées autour de la date du jour. Tu gardes la vue mensuelle en dessous, mais ici tu lis beaucoup plus facilement la période proche."
    : `Grandes cases horizontales sur 13 jours, centrées autour du jour repère ${formatDateFr(anchorDate,true)}.`;
  return `<section class="card focus-shell"><div class="focus-head"><div><h2>${title}</h2><p>${subtitle}</p><p class="focus-jump-note">Astuce : clique sur une case de cette vue pour retrouver le même jour dans le calendrier mensuel.</p></div><div class="focus-meta"><span class="focus-badge">5 jours avant</span><span class="focus-badge">Jour repère : ${formatDateFr(anchorDate,true)}</span><span class="focus-badge">7 jours après</span></div></div><div class="focus-strip-wrap" data-focus-strip-wrap="1"><div class="focus-strip" data-focus-strip="1">${cards.join('')}</div></div></section>`;
}
function dayCell(day,today,events,isCombined,ownerId,options={}){
  const variant = options.variant || 'month';
  const isFocus = variant === 'focus';
  const iso=dateVal(day.date), visibleCount=isCombined?4:3, sorted=[...events].sort((a,b)=>a.time.localeCompare(b.time)), primary=sorted.slice(0,visibleCount), extra=sorted.slice(visibleCount), more=extra.length, dayOwner=(ownerId||''), owners=isCombined?[...new Set(sorted.map(e=>(getPerson(e.ownerId)||{}).name).filter(Boolean))]:[], expandExtra=Math.min(Math.max(sorted.length-visibleCount,0)*64 + (sorted.length>visibleCount?22:0), 320);
  const outsideMonth = !day.currentMonth;
  const dayTitle = formatDateFr(iso,false);
  const monthBadge = outsideMonth ? `<span class="day-month day-month-outside">${esc(formatMonthShort(day.date))}</span>` : `<span class="day-month day-month-current">${esc(formatMonthShort(day.date))}</span>`;
  const cardClass = `${isFocus?'focus-card':'day'} ${outsideMonth?'outside':''} ${iso===today?'today':''} ${options.isAnchor?'focus-anchor':''}`.trim();
  const weekdayMini = isFocus ? `<span class="weekday-mini">${esc(new Intl.DateTimeFormat('fr-FR',{weekday:'long'}).format(day.date))}</span>` : '';
  const addOwner = dayOwner;
  return `<article class="${cardClass}" data-day-date="${iso}" data-owner="${addOwner}" data-combined="${isCombined?'1':'0'}" data-variant="${variant}" style="--expand-extra:${expandExtra}px" aria-label="${esc(dayTitle)}" title="${esc(dayTitle)}"><div class="day-head"><div class="day-date-pack">${weekdayMini}<span class="day-number">${day.date.getDate()}</span>${monthBadge}</div><button class="add-mini" data-add-date="${iso}" data-owner="${addOwner}">+</button></div><div class="stack">${sorted.length?`<div class="stack-primary">${primary.map(e=>eventBtn(e,isCombined)).join('')}</div>${extra.length?`<div class="stack-extra">${extra.map(e=>eventBtn(e,isCombined)).join('')}</div>`:''}${more>0?`<div class="more">+ ${more} autre(s)</div>`:''}`:`<div class="empty">Aucun rendez-vous</div>${isCombined && owners.length?`<div class="day-hover-card"><span class="pill">${owners.length} personne(s)</span><div style="margin-top:8px;color:var(--muted)">${owners.join(' · ')}</div></div>`:''}`}</div></article>`;
}
function renderPersonCalendar(personId){ const d=monthDate(), matrix=buildMonthMatrix(d.getFullYear(),d.getMonth()), today=dateVal(new Date()), person=getPerson(personId); const events=getMonthEvents({ ownerId: personId, respectSearch:true }); return `${renderDashboard(personId)}${renderFocusStrip(events,false,personId)}<section class="card calendar-shell"><div class="view-title"><h2>${esc(person?person.name:'Calendrier')}</h2><p>Vue mensuelle de cette personne.</p></div><div class="weekdays">${weekdayNames.map(w=>`<div class="weekday">${w}</div>`).join('')}</div><div class="grid">${matrix.map(day=>dayCell(day,today,events.filter(e=>e.date===dateVal(day.date)),false,personId)).join('')}</div></section>`; }
function renderCombined(){ const d=monthDate(), matrix=buildMonthMatrix(d.getFullYear(),d.getMonth()), today=dateVal(new Date()), events=getMonthEvents({ respectSearch:true }); const groups={}; events.forEach(e=>((groups[e.date]=groups[e.date]||[]).push(e))); const familyCols = state.people.map(p=>{ const personEvents = events.filter(e=>e.ownerId===p.id).sort((a,b)=>(`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`)); return `<section class="family-col card ${p.color}"><div class="family-col-head"><span class="item ${p.color}"><span class="dot"></span>${esc(p.name)}</span><strong>${personEvents.length} RDV</strong></div><div class="family-col-body">${personEvents.length ? personEvents.map(e=>{ const subtitle=(e.label&&e.label.trim())?e.label.trim():'Sans titre'; const untitled=!(e.label&&e.label.trim()); return `<button class="family-event ${typeClass(getEventType(e))}" data-edit="${e.id}"><div class="family-event-top"><span class="agenda-type ${typeClass(getEventType(e))}">${typeIcon(getEventType(e))} ${esc(getEventType(e))}</span><time>${formatDateFr(e.date,true)} · ${esc(e.time)}</time></div><div class="family-event-title">${typeIcon(getEventType(e))} ${esc(getEventType(e))}</div><div class="family-event-subtitle ${untitled?'untitled':''}">${esc(subtitle)}</div><div class="family-event-meta">${esc([e.location,e.notes].filter(Boolean).join(' — ')||'—')}</div></button>`; }).join('') : '<div class="empty">Aucun rendez-vous ce mois-ci.</div>'}</div></section>`; }).join(''); return `${renderDashboard(null)}${renderFocusStrip(events,true,'')}<section class="card agenda-shell" style="margin-top:16px"><div class="view-title"><h2>Vue famille côte à côte</h2><p>Chaque colonne affiche les rendez-vous du mois pour une personne. Clic sur un rendez-vous pour le modifier.</p></div><div class="family-board">${familyCols}</div></section><section class="card calendar-shell" style="margin-top:16px"><div class="weekdays">${weekdayNames.map(w=>`<div class="weekday">${w}</div>`).join('')}</div><div class="grid">${matrix.map(day=>dayCell(day,today,events.filter(e=>e.date===dateVal(day.date)),true,'')).join('')}</div></section><section class="card agenda-shell" style="margin-top:16px"><div class="agenda-list">${Object.keys(groups).length?Object.keys(groups).sort().map(date=>`<section class="agenda-day"><div class="agenda-headline"><div>${formatDateFr(date,false)}</div><div>${groups[date].length} rendez-vous</div></div><div class="table-wrap"><table><thead><tr><th>Heure</th><th>Personne</th><th>Rendez-vous</th><th>Lieu / notes</th><th>Action</th></tr></thead><tbody>${groups[date].sort((a,b)=>a.time.localeCompare(b.time)).map(e=>{ const p=getPerson(e.ownerId)||{name:'Sans nom',color:'tone-1'}; const subtitle=(e.label&&e.label.trim())?e.label.trim():'Sans titre'; const untitled=!(e.label&&e.label.trim()); return `<tr><td>${esc(e.time)}</td><td><span class="item ${p.color}"><span class="dot"></span>${esc(p.name)}</span></td><td><span class="agenda-type ${typeClass(getEventType(e))}">${typeIcon(getEventType(e))} ${esc(getEventType(e))}</span><div style="margin-top:6px;font-size:12px;color:var(--muted);${untitled?'font-style:italic;':''}">${esc(subtitle)}</div></td><td>${esc([e.location,e.notes].filter(Boolean).join(' — ')||'—')}</td><td><button class="ghost" data-edit="${e.id}">Modifier</button></td></tr>`; }).join('')}</tbody></table></div></section>`).join(''):'<div class="empty">Aucun rendez-vous pour les filtres actuels.</div>'}</div></section>`; }
 function handleDayDoubleClick(e){
  const day = e.currentTarget || e.target.closest('.day[data-day-date], .focus-card[data-day-date]');
  if(!day || day.classList.contains('outside')) return;
  if(e.target.closest('.day-menu') || e.target.closest('[data-edit]') || e.target.closest('.add-mini')) return;
  e.preventDefault();
  e.stopPropagation();
  openQuickMenu(day);
 }

 function computeExpandedDayHeight(day){
  const head=day.querySelector('.day-head');
  const stack=day.querySelector('.stack');
  const baseMin = day && day.classList.contains('focus-card') ? 272 : 150;
  if(!head || !stack) return baseMin;
  const cs=getComputedStyle(day);
  const pt=parseFloat(cs.paddingTop)||0;
  const pb=parseFloat(cs.paddingBottom)||0;
  const gap=10;
  const target=Math.ceil((head.offsetHeight||0) + (stack.scrollHeight||0) + pt + pb + gap);
  return Math.max(baseMin,target);
 }

 function activateDayExpand(day){
  if(!day || day.classList.contains('outside')) return;
  day.classList.add('day-expand-active');
  const target=computeExpandedDayHeight(day);
  day.style.height=target+'px';
  day.style.minHeight=target+'px';
 }

 function deactivateDayExpand(day){
  if(!day) return;
  day.classList.remove('day-expand-active');
  day.style.removeProperty('height');
  day.style.removeProperty('min-height');
 }

 function revealQuickAddedEvent(){
  if(!lastQuickReveal || !lastQuickReveal.date) return;
  const target = lastQuickReveal;
  lastQuickReveal = null;
  const day = document.querySelector(`.calendar-shell .day[data-day-date="${target.date}"]:not(.outside)`);
  if(!day) return;
  day.classList.add('quick-added-highlight');
  activateDayExpand(day);
  const eventBtn = target.eventId ? day.querySelector(`[data-event-id="${target.eventId}"]`) : null;
  if(eventBtn) eventBtn.classList.add('quick-added-event-highlight');
  const rect = day.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
  if(rect.top < 120 || rect.bottom > viewportH - 90){
    day.scrollIntoView({behavior:'smooth', block:'center'});
  }
  window.setTimeout(()=>{
    day.classList.remove('quick-added-highlight');
    deactivateDayExpand(day);
    if(eventBtn) eventBtn.classList.remove('quick-added-event-highlight');
  }, 2600);
}

function bindSmoothStripScroll(){
  const wrap = document.querySelector('[data-focus-strip-wrap]');
  if(!wrap || wrap.dataset.wheelBound==='1') return;
  wrap.dataset.wheelBound='1';
  wrap.addEventListener('wheel', e => {
    if(e.ctrlKey) return;
    if(wrap.scrollWidth <= wrap.clientWidth + 2) return;
    const useVertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
    const delta = useVertical ? e.deltaY : e.deltaX;
    if(Math.abs(delta) < 1) return;
    const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const nextLeft = Math.max(0, Math.min(maxLeft, wrap.scrollLeft + delta));
    if(Math.abs(nextLeft - wrap.scrollLeft) < 0.5) return;
    e.preventDefault();
    wrap.scrollLeft = nextLeft;
  }, { passive:false });
}

 function jumpToMonthlyCell(iso){
  if(!iso) return;
  const targetMonth = new Date(iso+'T12:00:00');
  const shown = monthDate();
  if(targetMonth.getMonth() !== shown.getMonth() || targetMonth.getFullYear() !== shown.getFullYear()){
    state.currentDate = iso;
    saveState();
    render();
  }
  const target = document.querySelector(`.calendar-shell .day[data-day-date="${iso}"]`);
  if(!target) return;
  target.classList.add('month-link-highlight');
  activateDayExpand(target);
  target.scrollIntoView({behavior:'smooth', block:'center', inline:'nearest'});
  window.setTimeout(()=>{
    target.classList.remove('month-link-highlight');
    deactivateDayExpand(target);
  }, 2200);
 }

 function bindCardInteractions(card, {allowOutside=false}={}){
  if(!card) return;
  if(!allowOutside && card.classList.contains('outside')) return;
  if(card.dataset.cardBound==='1') return;
  card.dataset.cardBound='1';
  card.addEventListener('dblclick', handleDayDoubleClick);
  card.addEventListener('mouseenter',()=>{
    card.classList.add('day-hover-visible');
    activateDayExpand(card);
  });
  card.addEventListener('mouseleave',()=>{
    card.classList.remove('day-hover-visible');
    deactivateDayExpand(card);
  });
  if(card.classList.contains('focus-card')){
    card.addEventListener('click', e => {
      if(e.target.closest('[data-edit], .add-mini, .day-menu')) return;
      jumpToMonthlyCell(card.getAttribute('data-day-date'));
    });
  }
 }

 function bindDynamic(){
  bindSmoothStripScroll();
  document.querySelectorAll('[data-add-date]').forEach(btn=>btn.addEventListener('click',()=>{ closeQuickMenu(); const ownerId = btn.getAttribute('data-owner') || state.people[0].id; openEvent({id:'',ownerId:ownerId,date:btn.getAttribute('data-add-date'),type:'Autre',label:'',time:'09:00',duration:30,location:'',notes:''}); }));
  document.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',e=>{
    if(dragState && dragState.moved) return;
    const ev=state.events.find(x=>x.id===btn.getAttribute('data-edit')); if(ev) openEvent(ev);
  }));
  document.querySelectorAll('.event[data-event-id]').forEach(btn=>{
    btn.addEventListener('dragstart',e=>e.preventDefault());
    btn.addEventListener('mousedown',startMouseDrag);
  });
  document.querySelectorAll('.calendar-shell .day[data-day-date]').forEach(day=>bindCardInteractions(day));
  document.querySelectorAll('.focus-card[data-day-date]').forEach(card=>bindCardInteractions(card));
 }

 function getDropDayFromPoint(x,y){
  const el = document.elementFromPoint(x,y);
  if(!el) return null;
  const day = el.closest('.day[data-day-date], .focus-card[data-day-date]');
  return day && !day.classList.contains('outside') ? day : null;
 }
 function clearDropTargets(){ document.querySelectorAll('.day.drop-target, .focus-card.drop-target').forEach(d=>d.classList.remove('drop-target')); }
 function removeDragGhost(){ const g=document.querySelector('.drag-ghost'); if(g) g.remove(); }
 function startMouseDrag(e){
  if(e.button!==0) return;
  const btn=e.currentTarget;
  const eventId = btn.getAttribute('data-event-id');
  if(!eventId) return;
  e.preventDefault();
  e.stopPropagation();
  closeQuickMenu();
  dragState = {eventId:eventId, sourceBtn:btn, startX:e.clientX, startY:e.clientY, moved:false, ghost:null, activeDay:null};
  document.addEventListener('mousemove',onMouseDrag);
  document.addEventListener('mouseup',endMouseDrag);
 }
 function onMouseDrag(e){
  if(!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if(!dragState.moved && Math.hypot(dx,dy) < 6) return;
  if(!dragState.moved){
    dragState.moved = true;
    document.body.classList.add('drag-active');
    dragState.sourceBtn.classList.add('dragging');
    dragState.sourceBtn.style.pointerEvents='none';
    const ghost=document.createElement('div');
    ghost.className='drag-ghost';
    ghost.innerHTML=dragState.sourceBtn.innerHTML;
    document.body.appendChild(ghost);
    dragState.ghost=ghost;
  }
  if(dragState.ghost){
    dragState.ghost.style.transform=`translate(${e.clientX+16}px,${e.clientY+16}px)`;
  }
  clearDropTargets();
  const day=getDropDayFromPoint(e.clientX,e.clientY);
  if(day){ day.classList.add('drop-target'); dragState.activeDay=day; } else { dragState.activeDay=null; }
 }
 function endMouseDrag(e){
  document.removeEventListener('mousemove',onMouseDrag);
  document.removeEventListener('mouseup',endMouseDrag);
  if(!dragState) return;
  const moved = dragState.moved;
  const eventId = dragState.eventId;
  const targetDay = moved ? (dragState.activeDay || getDropDayFromPoint(e.clientX,e.clientY)) : null;
  const sourceBtn = dragState.sourceBtn;
  removeDragGhost();
  clearDropTargets();
  document.body.classList.remove('drag-active');
  if(sourceBtn){
    sourceBtn.classList.remove('dragging');
    sourceBtn.style.pointerEvents='';
  }
  dragState=null;
  if(moved && targetDay){
    const targetOwner = state.activeTab==='all' ? null : (targetDay.getAttribute('data-owner') || state.activeTab);
    moveEventToDate(eventId, targetDay.getAttribute('data-day-date'), targetOwner);
  }
 }

 function render(){ applyTheme(); renderTabs(); renderMonthLabel(); $('viewRoot').innerHTML = state.activeTab==='all' ? renderCombined() : renderPersonCalendar(state.activeTab); bindDynamic(); syncFocusStrip(); revealQuickAddedEvent(); updateQuickEntryUi(); }
 function openModal(id){ $(id).classList.add('open'); }
 function closeModal(id){ $(id).classList.remove('open'); }
 function closeQuickMenu(){ if(quickMenuNode){ quickMenuNode.remove(); quickMenuNode=null; } if(quickMenuDay){ quickMenuDay.classList.remove('menu-open'); quickMenuDay=null; } }
 function openQuickMenu(dayEl){
  closeQuickMenu();
  if(!dayEl || dayEl.classList.contains('outside')) return;
  quickMenuDay=dayEl;
  dayEl.classList.add('menu-open');
  const ownerOptions = state.people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const defaultOwner = state.activeTab==='all' ? (dayEl.getAttribute('data-owner')||state.people[0].id) : state.activeTab;
  const ownerRow = state.activeTab==='all' ? `<div class="mini-row one"><div><span class="mini-label">Personne</span><select class="quick-owner">${ownerOptions}</select></div></div>` : '';
  const menuHtml = `<div class="day-menu" role="dialog" aria-label="Choix du rendez-vous"><div class="mini-title">Choisir la nature du rendez-vous</div>${ownerRow}<div class="mini-row one"><div><span class="mini-label">Type de rendez-vous</span><select class="quick-type">${eventTypes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div></div><div class="mini-help">Choisis aussi l'heure avant de continuer.</div><div class="mini-grid-3"><div><span class="mini-label">Heure</span><select class="quick-hour">${Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('')}</select></div><div><span class="mini-label">Minute</span><select class="quick-minute"><option value="00">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option></select></div><div><span class="mini-label">Durée</span><select class="quick-duration"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option></select></div></div><div class="mini-actions"><button type="button" class="primary quick-continue">Continuer</button><button type="button" class="ghost quick-cancel">Annuler</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend', menuHtml);
  const menu = document.body.querySelector('.day-menu:last-of-type');
  quickMenuNode = menu;
  const rect = dayEl.getBoundingClientRect();
  const menuWidth = Math.min(360, window.innerWidth - 24);
  let left = rect.left + 8;
  if(left + menuWidth > window.innerWidth - 12) left = window.innerWidth - menuWidth - 12;
  if(left < 12) left = 12;
  let top = rect.top + 46;
  menu.style.width = menuWidth + 'px';
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  requestAnimationFrame(()=>{
    const mh = menu.offsetHeight || 0;
    if(top + mh > window.innerHeight - 12){
      top = Math.max(12, rect.bottom - mh - 8);
      menu.style.top = top + 'px';
    }
  });
  const ownerSelect = menu.querySelector('.quick-owner');
  if(ownerSelect) ownerSelect.value = defaultOwner;
  const hSel = menu.querySelector('.quick-hour');
  const mSel = menu.querySelector('.quick-minute');
  const dSel = menu.querySelector('.quick-duration');
  hSel.value = '09';
  mSel.value = '00';
  menu.querySelector('.quick-cancel').addEventListener('click', closeQuickMenu);
  menu.querySelector('.quick-continue').addEventListener('click', ()=>{
    const ownerId = ownerSelect ? ownerSelect.value : (state.activeTab==='all' ? state.people[0].id : state.activeTab);
    const label = menu.querySelector('.quick-type').value || 'Autre';
    const time = `${hSel.value || '09'}:${mSel.value || '00'}`;
    const duration = Number(dSel.value || 30);
    closeQuickMenu();
    openEvent({id:'',ownerId:ownerId,date:dayEl.getAttribute('data-day-date'),type:label,label:label,time:time,duration:duration,location:'',notes:''});
  });
 }
 function moveEventToDate(eventId,newDate,newOwnerId){ const ev=state.events.find(e=>e.id===eventId); if(!ev || !newDate) return; ev.date=newDate; if(newOwnerId && state.people.some(p=>p.id===newOwnerId)) ev.ownerId=newOwnerId; state.events.sort((a,b)=>(`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`)); saveState(); render(); }
 function openEvent(ev){ const type=getEventType(ev||{}); const ownerId = ev.ownerId||state.people[0].id; $('eventModalTitle').textContent = ev.id ? 'Modifier le rendez-vous' : 'Ajouter un rendez-vous'; $('eventId').value=ev.id||''; $('eventDate').value=ev.date||dateVal(new Date()); $('eventOwnerId').value=ownerId; syncEventOwnerField(ownerId); $('eventType').innerHTML=typeOptions(type); $('eventType').value=type; $('eventLabel').value=ev.label||''; $('eventTime').value=ev.time||'09:00'; $('eventDuration').value=String(ev.duration||30); $('eventLocation').value=ev.location||''; $('eventNotes').value=ev.notes||''; $('deleteEventBtn').classList.toggle('hidden', !ev.id); openModal('eventModal'); }
 function saveEvent(){ const rawLabel=$('eventLabel').value.trim(); const label=rawLabel||'Sans titre'; const ownerSelect = $('eventOwnerSelect'); const chosenOwner = (ownerSelect && ownerSelect.value) || $('eventOwnerId').value || state.people[0].id; const payload={ id:$('eventId').value||safeId(), ownerId:chosenOwner, date:$('eventDate').value||dateVal(new Date()), type:normalizeType($('eventType').value), label:label, time:$('eventTime').value||'09:00', duration:Number($('eventDuration').value)||30, location:$('eventLocation').value.trim(), notes:$('eventNotes').value.trim() }; const idx=state.events.findIndex(e=>e.id===payload.id); if(idx>=0) state.events[idx]=payload; else state.events.push(payload); state.events.sort((a,b)=>(`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`)); saveState(); closeModal('eventModal'); render(); }
 function deleteEvent(){ const id=$('eventId').value; if(!id) return; state.events = state.events.filter(e=>e.id!==id); saveState(); closeModal('eventModal'); render(); }
 function addPerson(){ const name=$('personNameInput').value.trim(); if(!name){ alert('Entre un nom.'); return; } const p={id:safeId(),name:name,color:palette[state.people.length%palette.length]}; state.people.push(p); state.activeTab=p.id; saveState(); $('personNameInput').value=''; closeModal('personModal'); render(); }
 function bindStatic(){ $('prevMonthBtn').addEventListener('click',()=>{ closeQuickMenu(); shiftMonth(-1); }); $('nextMonthBtn').addEventListener('click',()=>{ closeQuickMenu(); shiftMonth(1); }); $('todayBtn').addEventListener('click',()=>{ closeQuickMenu(); state.currentDate=dateVal(new Date()); saveState(); render(); }); $('searchInput').addEventListener('input',render); $('themeSelect').addEventListener('change',()=>{ closeQuickMenu(); state.theme=$('themeSelect').value; saveState(); render(); }); $('addPersonBtn').addEventListener('click',()=>openModal('personModal')); $('cancelPersonBtn').addEventListener('click',()=>closeModal('personModal')); $('savePersonBtn').addEventListener('click',addPerson); $('cancelEventBtn').addEventListener('click',()=>closeModal('eventModal')); $('saveEventBtn').addEventListener('click',saveEvent); $('deleteEventBtn').addEventListener('click',deleteEvent); $('quickEntryBtn').addEventListener('click', handleQuickEntry); $('quickEntryInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); handleQuickEntry(); } }); $('quickEntryInput').addEventListener('input', ()=>{ const status = $('quickEntryStatus'); if(status) delete status.dataset.locked; updateQuickEntryUi(); }); ['personModal','eventModal'].forEach(id=>$(id).addEventListener('click',e=>{ if(e.target.id===id) closeModal(id); })); document.addEventListener('click',e=>{ if((quickMenuDay || quickMenuNode) && !e.target.closest('.day-menu') && !e.target.closest('.day, .focus-card')) closeQuickMenu(); }); document.addEventListener('contextmenu',e=>{ const day=e.target.closest('.day[data-day-date], .focus-card[data-day-date]'); if(!day || day.classList.contains('outside') || e.target.closest('.day-menu') || e.target.closest('.add-mini')) return; e.preventDefault(); e.stopPropagation(); openQuickMenu(day); }); document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeQuickMenu(); }); }
 try{ normalize(); seedDemo(); bindStatic(); render(); }
 catch(err){ console.error(err); document.body.innerHTML = '<div style="padding:24px;color:white;font-family:Arial,sans-serif"><h2>Erreur de chargement</h2><pre style="white-space:pre-wrap">'+(err && err.stack ? err.stack : String(err))+'</pre></div>'; }
})();
