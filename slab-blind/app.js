// 슬랩 블라인드 · 게임 + 카드 올리기
(() => {
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

/* ---------- 기본 카드 (운영자 카드 10장) ---------- */
const SEED=[{"f":"seed/1f.jpg","b":"seed/1b.jpg","company":"BRG","grade":9,"name":"Primal Groudon EX · 2016 CP4 한국판","tier":0,"box":[0.7438,0.0632,0.9344,0.1636]},{"f":"seed/2f.jpg","b":"seed/2b.jpg","company":"BRG","grade":9,"name":"Pikachu · 2021 S8a 25주년 한국판","tier":1,"box":[0.7438,0.0577,0.9344,0.1544]},{"f":"seed/3f.jpg","b":"seed/3b.jpg","company":"BRG","grade":9,"name":"Pikachu · 2022 S10a 일본판","tier":0,"box":[0.7438,0.067,0.9344,0.1637]},{"f":"seed/4f.jpg","b":"seed/4b.jpg","company":"BRG","grade":10,"name":"Espurr · 2026 M3 AR 일본판","tier":1,"box":[0.7438,0.0651,0.9344,0.1619]},{"f":"seed/5f.jpg","b":"seed/5b.jpg","company":"BRG","grade":9,"name":"N's Zekrom · 2026 M2a AR 한국판","tier":1,"box":[0.7438,0.0502,0.9344,0.147]},{"f":"seed/6f.jpg","b":"seed/6b.jpg","company":"BRG","grade":10,"name":"N's Reshiram · 2025 SV9 AR 한국판","tier":1,"box":[0.7438,0.0586,0.9344,0.1553]},{"f":"seed/7f.jpg","b":"seed/7b.jpg","company":"BRG","grade":10,"name":"Rayquaza VMAX · 2023 S12a 한국판","tier":2,"box":[0.7438,0.0586,0.9344,0.1553]},{"f":"seed/8f.jpg","b":"seed/8b.jpg","company":"BRG","grade":9,"name":"Mew VMAX · 2023 S12a 한국판","tier":0,"box":[0.7438,0.0493,0.9344,0.146]},{"f":"seed/9f.jpg","b":"seed/9b.jpg","company":"BRG","grade":10,"name":"Gardevoir ex · 2024 SV4a SSR 한국판","tier":2,"box":[0.7438,0.0577,0.9344,0.1544]},{"f":"seed/10f.jpg","b":"seed/10b.jpg","company":"BRG","grade":9,"name":"Giratina VSTAR · 2023 S12a UR 한국판","tier":2,"box":[0.7438,0.0591,0.9344,0.1558]}];
const COMPANIES=['PSA','CGC','BRG'];
const GNAME={10:'GEM MT',9:'MINT',8:'NM-MT',7:'NM',6:'EX-MT',5:'EX',4:'VG-EX',3:'VG',2:'GOOD',1:'POOR'};
const LEVELS=[
  {name:'초보',desc:'카드 보는 눈이 아직 없어요',how:'두 등급 중 하나 고르기',q:'둘 중 몇 등급일까?',pts:10},
  {name:'중급',desc:'10점짜리는 어느 정도 알아봐요',how:'10등급인지 아닌지 맞히기',q:'이 카드, 10등급일까?',pts:20},
  {name:'상급',desc:'숫자까지 맞힐 자신 있어요',how:'정확한 등급 고르기 · 시간 제한',q:'정확히 몇 등급?',pts:40}];
const gradeLabel=c=>c.pristine?'PRISTINE 10':`${c.grade} ${GNAME[Math.floor(c.grade)]||''}`.trim();
const TEMPLATE={
  BRG:{g:[.74,.05,.935,.165],mf:[[.755,.165,.885,.205]],mb:[[.53,.1,.66,.2],[.755,.165,.885,.205]]},
  PSA:{g:[.7,.05,.94,.13],mf:[[.7,.125,.94,.165]],mb:[[.35,.05,.65,.16],[.7,.11,.94,.16]]},
  CGC:{g:[.06,.05,.3,.16],mf:[[.6,.12,.94,.165]],mb:[[.3,.05,.7,.16],[.7,.1,.94,.16]]}};

/* ---------- 서버 연결 (Supabase) ---------- */
const CFG=window.SLAB_CONFIG||{};
const AI=!!CFG.RECOGNITION; // Claude API 키를 넣었을 때만 true
const sb=(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase)?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const imgUrl=p=>`${CFG.SUPABASE_URL}/storage/v1/object/public/cards/${p}`;
function playerId(){let id=null;try{id=localStorage.getItem('slab_pid')}catch{}
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now()).replace(/-/g,'');try{localStorage.setItem('slab_pid',id)}catch{}}return id}
const PID=playerId();
function tagOf(id){let h=2166136261;for(const ch of String(id)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';h>>>=0;for(let i=0;i<5;i++){s+=A[h%32];h=Math.floor(h/32)}return '사용자-'+s}

/* ---------- 문제 풀 ---------- */
const seedCards=SEED.map((c,i)=>({...c,id:'seed'+i,seed:true,pristine:false}));
let community=[],pool=[...seedCards];
async function loadCommunity(){if(!sb)return;
  const {data,error}=await sb.from('cards').select('id,front_path,back_path,company,grade,pristine,tier,box,name,cond').eq('status','approved').limit(1000);
  if(error||!data)return;
  community=data.filter(c=>COMPANIES.includes(c.company)).map(c=>({id:c.id,f:imgUrl(c.front_path),b:imgUrl(c.back_path),company:c.company,grade:+c.grade,pristine:!!c.pristine,tier:c.tier,box:c.box,name:c.name,cond:c.cond}));
  pool=[...seedCards,...community]}

/* ---------- 화면 전환 ---------- */
function show(v){for(const id of['vHome','vGame','vOver','vUp'])$(id).hidden=id!==v;
  $('tHome').setAttribute('aria-pressed',v!=='vUp');$('tUp').setAttribute('aria-pressed',v==='vUp');
  if(v!=='vGame')stopTimer();window.scrollTo(0,0)}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1600)}

/* ---------- 첫 화면 ---------- */
LEVELS.forEach((L,i)=>{const b=document.createElement('button');b.className='lv l'+i;
  b.innerHTML=`<span class="badge">${L.name}</span><span><b>${L.desc}</b><small>${L.how} · 정답당 ${L.pts}점</small></span><span class="go">시작 →</span>`;
  b.onclick=()=>startRun(i);$('levels').appendChild(b)});
$('meTag').textContent=`내 이름: ${tagOf(PID)}`;

/* ---------- 이미지 ---------- */
const imgCache=new Map();
function loadImg(src){if(imgCache.has(src))return imgCache.get(src);const p=new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=src});imgCache.set(src,p);p.catch(()=>imgCache.delete(src));return p}
function tapeRect(b,W,H){const x=b[0]*W,y=b[1]*H,w=(b[2]-b[0])*W,h=(b[3]-b[1])*H;return{x:x-w*.06,y:y-h*.06,w:w*1.12,h:h*1.12}}
const tapeColor=()=>getComputedStyle(document.documentElement).getPropertyValue('--tape').trim()||'#f0c43a';
function paint(c,img,box,covered){
  const sc=Math.min(1,1000/img.naturalHeight);c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);
  const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);
  if(covered&&box){const r=tapeRect(box,c.width,c.height);x.save();x.translate(r.x+r.w/2,r.y+r.h/2);x.rotate(-.035);
    x.fillStyle=tapeColor();x.fillRect(-r.w/2,-r.h/2,r.w,r.h);x.fillStyle='rgba(255,255,255,.14)';for(let i=-r.w/2;i<r.w/2;i+=7)x.fillRect(i,-r.h/2,2.5,r.h);
    x.fillStyle='#3a2d05';x.font=`${Math.round(r.h*.32)}px "Do Hyeon",sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText('?',0,0);x.restore()}
}

/* ---------- 게임 진행 ---------- */
let run=null,cur=null,side='f',answered=false,cv=null,halfOn=false;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pickOne=a=>a[Math.floor(Math.random()*a.length)];
function startRun(level){run={start:level,stage:level,streak:0,score:0,used:new Set(),k2:0,log:[],maxStage:level};show('vGame');next()}
function next(){
  const stage=Math.min(2,run.start+Math.floor(run.streak/4));
  if(stage>run.stage)toast(`난이도 UP · ${LEVELS[stage].name}`);
  run.stage=stage;run.maxStage=Math.max(run.maxStage,stage);
  const left=pool.filter(c=>!run.used.has(c.id));
  if(!left.length){finish('clear');return}
  const pref=left.filter(c=>c.tier===stage);cur=pickOne(pref.length?pref:left);run.used.add(cur.id);
  answered=false;side='f';halfOn=false;setSide('f',true);
  $('hStage').className='chip lv'+stage;$('hStage').textContent=LEVELS[stage].name;
  $('hStreak').textContent=run.streak;$('hScore').textContent=run.score;$('hLeft').textContent=left.length-1;
  $('qText').textContent=LEVELS[stage].q;$('result').hidden=true;
  buildPad();
  startTimer(stage===0?0:stage===1?20:Math.max(8,25-2*run.k2));
}
function truthKey(c){return c.pristine?'P10':String(c.grade)}
function buildPad(){
  const pad=$('pad'),st=run.stage;pad.innerHTML='';$('halfWrap').hidden=true;
  if(st===0){
    const t=cur.pristine?10:cur.grade,gaps=run.streak<2?[2]:[1,2],floor=Math.min(5,Math.floor(t)-2);
    const cands=[];for(let g=1;g<=10;g++)if(gaps.includes(Math.abs(g-t))&&g>=floor)cands.push(g);
    const ups=cands.filter(g=>g>t),downs=cands.filter(g=>g<t);
    const d=(ups.length&&(Math.random()<.5||!downs.length))?pickOne(ups):pickOne(downs);
    pad.className='pad two';
    for(const v of shuffle([truthKey(cur),String(d)]))pad.appendChild(mkBtn(`${v==='P10'?'P10':v}<small>${v==='P10'?'PRISTINE':GNAME[Math.floor(+v)]||''}</small>`,v));
  }else if(st===1){
    pad.className='pad two';
    pad.appendChild(mkBtn('10 맞다<small>GEM MINT 이상</small>','yes'));pad.appendChild(mkBtn('10 아니다<small>9 이하</small>','no'));
  }else{
    pad.className='pad ten';$('halfWrap').hidden=false;$('halfBtn').setAttribute('aria-pressed',halfOn);$('halfBtn').textContent=halfOn?'정수 등급 보기':'.5 등급 보기';
    if(cur.company==='CGC'&&!halfOn){const b=mkBtn('PRISTINE 10 <small>CGC 최상위</small>','P10');b.classList.add('wide');pad.appendChild(b)}
    const list=halfOn?[9.5,8.5,7.5,6.5,5.5,4.5,3.5,2.5,1.5].filter(g=>!(cur.company==='PSA'&&g===9.5)):[10,9,8,7,6,5,4,3,2,1];
    for(const g of list)pad.appendChild(mkBtn(`${g}<small>${halfOn?'':GNAME[g]}</small>`,String(g)));
  }
}
$('halfBtn').onclick=()=>{if(answered)return;halfOn=!halfOn;buildPad()};
function mkBtn(html,val){const b=document.createElement('button');b.innerHTML=html;b.dataset.v=val;b.onclick=()=>answer(val,b);return b}
function isRight(val,c){if(val==null)return false;if(run.stage===1)return (val==='yes')===(c.grade>=10);return val===truthKey(c)}
async function answer(val,btn){
  if(answered)return;answered=true;const remain=stopTimer();const c=cur,ok=isRight(val,c),st=run.stage;let gained=0;
  if(ok){gained=LEVELS[st].pts+(st>0?Math.ceil(remain):0);run.score+=gained;run.streak++;if(st===2)run.k2++}
  run.log.push({ok,st});$('hScore').textContent=run.score;$('hStreak').textContent=run.streak;
  for(const b of $('pad').children){b.disabled=true;const v=b.dataset.v;if(st===1?((v==='yes')===(c.grade>=10)):v===truthKey(c))b.classList.add('truth')}
  btn?.classList.add('picked');
  await setSide('f');await reveal(c);
  const r=$('result');const timeout=val==null;
  r.innerHTML=`<div class="verdict"><strong style="color:${ok?'var(--good)':'var(--bad)'}">${ok?'정답':timeout?'시간 초과':'게임 오버'}</strong><span class="pts">${ok?'+'+gained:''}</span></div>
  <div style="font-size:14px">정답 <b style="font-family:var(--mono)">${c.company} ${gradeLabel(c)}</b></div>
  ${c.name?`<div style="font-size:13px;color:var(--muted)">${esc(c.name)}${c.seed?'':' · 커뮤니티 제보'}</div>`:''}
  ${c.cond?`<div class="cond">카드 메모: ${esc(c.cond)}</div>`:''}
  <button class="primary" id="nextBtn">${ok?'다음 카드':'결과 보기'}</button>`;
  r.hidden=false;$('nextBtn').onclick=()=>ok?next():finish('over');
  if(matchMedia('(max-width:760px)').matches)setTimeout(()=>r.scrollIntoView({behavior:'smooth',block:'end'}),200);
}
async function reveal(c){
  const img=await loadImg(c.f).catch(()=>null);if(!img||!cv)return;
  const r=cv.getBoundingClientRect(),pr=$('photo').getBoundingClientRect(),k=r.width/cv.width,t=tapeRect(c.box,cv.width,cv.height);
  const peel=document.createElement('div');peel.className='peel';Object.assign(peel.style,{left:(r.left-pr.left+t.x*k)+'px',top:(r.top-pr.top+t.y*k)+'px',width:t.w*k+'px',height:t.h*k+'px'});
  $('photo').appendChild(peel);paint(cv,img,c.box,false);requestAnimationFrame(()=>requestAnimationFrame(()=>peel.classList.add('off')));setTimeout(()=>peel.remove(),900);
}
async function setSide(s,force){
  if(side===s&&!force)return;side=s;$('sF').setAttribute('aria-pressed',s==='f');$('sB').setAttribute('aria-pressed',s==='b');
  const c=cur;const ph=$('photo');ph.innerHTML='';cv=document.createElement('canvas');ph.appendChild(cv);
  const chip=document.createElement('div');chip.className='co-chip';chip.textContent=c.company;ph.appendChild(chip);
  try{const img=await loadImg(s==='f'?c.f:c.b);if(cur!==c||side!==s)return;paint(cv,img,c.box,s==='f'&&!answered);bindLoupe()}
  catch{ph.insertAdjacentHTML('beforeend','<p style="line-height:1.5;padding:40px">사진을 불러오지 못했어요.</p>')}
  loadImg(s==='f'?c.b:c.f).catch(()=>{});
}
$('sF').onclick=()=>setSide('f');$('sB').onclick=()=>setSide('b');

/* ---------- 타이머 ---------- */
let tState=null;
function startTimer(secs){stopTimer();const el=$('timer');if(!secs){el.hidden=true;return}
  el.hidden=false;el.classList.remove('low');const bar=$('timerBar');const t0=performance.now(),dur=secs*1000;tState={t0,dur,raf:0};
  const tick=now=>{if(!tState)return;const left=Math.max(0,dur-(now-t0));bar.style.transform=`scaleX(${left/dur})`;el.classList.toggle('low',left<4000);
    if(left<=0){tState=null;answer(null,null);return}tState.raf=requestAnimationFrame(tick)};
  tState.raf=requestAnimationFrame(tick)}
function stopTimer(){if(!tState)return 0;cancelAnimationFrame(tState.raf);const left=Math.max(0,tState.dur-(performance.now()-tState.t0))/1000;tState=null;return left}

/* ---------- 게임 끝 ---------- */
const TITLES=s=>s>=400?'슬랩 감별사':s>=200?'숙련 수집가':s>=80?'루키 수집가':'아직 봉투 개봉 중';
async function finish(kind){
  stopTimer();show('vOver');
  $('oHead').textContent=kind==='clear'?'모든 카드를 맞혔어요':'게임 오버';
  $('oScore').textContent=run.score;$('oTitle').textContent=kind==='clear'?'완주':TITLES(run.score);
  $('oSummary').innerHTML=`<span class="chip lv${run.start}">${LEVELS[run.start].name} 시작</span> 연속 정답 <b>${run.streak}</b>개 · 최고 단계 <b>${LEVELS[run.maxStage].name}</b>`;
  $('oLog').innerHTML=run.log.map((l,i)=>`<span style="border-color:${l.ok?'var(--good)':'var(--bad)'}">${i+1}. ${LEVELS[l.st].name} ${l.ok?'○':'×'}</span>`).join('');
  $('share').value=`슬랩 블라인드 ${run.score}점 · ${kind==='clear'?'완주':TITLES(run.score)}\n${LEVELS[run.start].name}에서 시작해 ${run.streak}연속 정답 (최고 ${LEVELS[run.maxStage].name})\n${run.log.map(l=>l.ok?['🟩','🟦','🟥'][l.st]:'⬛').join('')}\n${location.href.split('#')[0]}`;
  const c=cur,lines=kind==='clear'?[['문제가 바닥났어요.','당신 카드로 다음 사람의 문제를 채워 주세요.']]:[
    [`${c.company} ${gradeLabel(c)}에 당했네요.`,'이번엔 당신 카드로 다른 사람을 떨어뜨려 보세요.'],
    ['그레이더 눈은 생각보다 매서워요.','당신 슬랩은 몇 명이나 맞힐까요? 직접 문제로 내 보세요.'],
    [`${run.streak}연속에서 멈췄어요.`,'복수는 내 카드로. 앞뒷면 찍어서 올리면 끝이에요.']];
  const [a,b]=pickOne(lines);$('oCtaTxt').innerHTML=`${esc(a)}<small>${esc(b)}</small>`;
  await saveScore();
}
$('ctaUp').onclick=()=>openUp();
$('retryBtn').onclick=()=>startRun(run.start);$('homeBtn').onclick=()=>show('vHome');
$('copyBtn').onclick=()=>{const t=$('share');const fb=()=>{t.focus();t.select()};try{navigator.clipboard.writeText(t.value).then(()=>{$('copyBtn').textContent='복사됨'},fb)}catch{fb()}};

/* ---------- 랭킹 ---------- */
let board=[],boardLive=false;
async function saveScore(){
  const m=$('saveMsg');m.hidden=false;m.className='status';
  if(!sb){m.hidden=true;return}
  if(run.score<=0){m.textContent='점수가 있어야 랭킹에 올라가요.';return}
  const {data,error}=await sb.rpc('submit_score',{p_player:PID,p_score:run.score,p_streak:run.streak,p_start:run.start});
  if(error){m.className='status err';m.textContent='기록을 저장하지 못했어요.';return}
  if(data>run.score)m.textContent=`내 최고 기록은 ${data}점이에요.`;else{m.className='status ok';m.textContent='새 최고 기록! 랭킹에 올렸어요.'}
  loadBoard();
}
async function loadBoard(){if(!sb)return;
  const {data,error}=await sb.from('scores').select('player_id,best,streak,start_level').order('best',{ascending:false}).limit(100);
  boardLive=true;if(!error&&data)board=data;renderBoard()}
function renderBoard(){
  for(const id of['rankHome','rankOver']){const ol=$(id);
    if(!sb){ol.innerHTML='<div class="empty">랭킹은 준비 중이에요.</div>';continue}
    if(!board.length){ol.innerHTML=`<div class="empty">${boardLive?'아직 기록이 없어요. 첫 번째 주인공이 되어 보세요.':'랭킹을 불러오는 중…'}</div>`;continue}
    const row=(r,i)=>`<li class="${r.player_id===PID?'me':''}"><span class="n">${i+1}</span><span class="nm">${tagOf(r.player_id)}${r.player_id===PID?' (나)':''}</span><span class="chip lv${r.start_level??0}">${LEVELS[r.start_level??0].name}</span><span class="sc">${r.best}</span></li>`;
    const n=id==='rankHome'?10:20;ol.innerHTML=board.slice(0,n).map(row).join('');
    const mi=board.findIndex(r=>r.player_id===PID);if(mi>=n)ol.insertAdjacentHTML('beforeend',row(board[mi],mi));
  }
  $('liveDot').textContent=sb&&boardLive?'● LIVE':'';
}

/* ---------- 돋보기 ---------- */
function bindLoupe(){
  const lp=$('loupe'),x=$('loupeCv').getContext('2d'),stage=$('stage');const c=cv;
  const move=e=>{const r=c.getBoundingClientRect(),sr=stage.getBoundingClientRect();
    const u=(e.clientX-r.left)/r.width,v=(e.clientY-r.top)/r.height;if(u<0||u>1||v<0||v>1){lp.hidden=true;return}
    lp.hidden=false;const touch=e.pointerType==='touch';
    lp.style.left=Math.min(sr.width-150,Math.max(0,e.clientX-sr.left-75))+'px';lp.style.top=Math.max(0,e.clientY-sr.top-(touch?190:75))+'px';
    const span=c.width*(150/(r.width*3));x.fillStyle='#000';x.fillRect(0,0,300,300);
    x.drawImage(c,u*c.width-span/2,v*c.height-span/2,span,span,0,0,300,300)};
  c.addEventListener('pointermove',move);c.addEventListener('pointerdown',move);
  const hide=()=>lp.hidden=true;c.addEventListener('pointerleave',hide);c.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')hide()});c.addEventListener('pointercancel',hide);
}

/* ---------- 카드 올리기 ---------- */
let up=null,files={f:null,b:null};
function openUp(){show('vUp');$('upOff').hidden=!!sb;$('upStep1').hidden=!sb||!!up;}
function setDrop(which,file){
  if(!file||!file.type.startsWith('image/'))return;files[which]=file;const d=$(which==='f'?'dropF':'dropB');
  d.innerHTML=`<img alt="" src="${URL.createObjectURL(file)}"><span style="font-size:12px;color:var(--muted)">${which==='f'?'앞면':'뒷면'} · 다시 고르려면 누르세요</span>`;
  $('nextUp').disabled=!(files.f&&files.b);
}
for(const w of['f','b']){const inp=$(w==='f'?'fileF':'fileB'),d=$(w==='f'?'dropF':'dropB');
  inp.onchange=e=>{setDrop(w,e.target.files[0]);e.target.value=''};
  ['dragenter','dragover'].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.remove('over')}));
  d.addEventListener('drop',e=>setDrop(w,e.dataTransfer.files[0]));
  d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}})}
function gradeOptions(company){
  const s=$('gradeSel');const prev=s.value;s.innerHTML='<option value="">등급 선택</option>';
  const opts=[];if(company==='CGC')opts.push(['P10','Pristine 10']);opts.push(['10','10 Gem Mint']);
  for(let g=9.5;g>=1;g-=.5){if(company==='PSA'&&g===9.5)continue;opts.push([String(g),String(g)+(Number.isInteger(g)?' '+GNAME[g]:'')])}
  for(const[v,l]of opts)s.insertAdjacentHTML('beforeend',`<option value="${v}">${l}</option>`);
  if([...s.options].some(o=>o.value===prev))s.value=prev;
}
COMPANIES.forEach(c=>{const b=document.createElement('button');b.textContent=c;b.type='button';b.setAttribute('aria-pressed','false');b.onclick=()=>{setCompany(c);if(!up.recognized)applyTemplate(c)};$('coSeg').appendChild(b)});
function setCompany(c){up.company=c;for(const b of $('coSeg').children)b.setAttribute('aria-pressed',b.textContent===c);gradeOptions(c);validate()}
function renderTiers(){const t=$('tierSeg');t.innerHTML='';
  LEVELS.forEach((L,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',up.tier===i);
    b.innerHTML=`<span>${L.name}용<small>${L.how}</small></span>${up.rec===i?`<span class="rec">${AI?'AI 추천':'추천'}</span>`:''}`;b.onclick=()=>{up.tier=i;up.tierPicked=true;renderTiers();validate()};t.appendChild(b)})}
function applyTemplate(c){const t=TEMPLATE[c];
  // 자동으로 찾은 QR·바코드가 있으면 그 위치를 쓰고, 없으면 회사별 기본 위치를 씁니다.
  const fc=up.f.codes||[],bc=up.b.codes||[];
  up.f.boxes=[{t:'g',b:[...t.g]},...t.mf.map(b=>({t:'m',b:[...b]})),...fc.map(b=>({t:'m',b}))];
  up.b.boxes=[...(bc.length?t.mb.slice(1):t.mb).map(b=>({t:'m',b:[...b]})),...bc.map(b=>({t:'m',b}))];drawEditor()}
function validate(){const ok=up&&up.company&&$('gradeSel').value&&up.tier!=null&&$('own').checked&&up.f.boxes.some(b=>b.t==='g')&&!!sb;$('submitBtn').disabled=!ok}
$('gradeSel').onchange=()=>{if(!AI&&up){const v=$('gradeSel').value;if(v){const g=v==='P10'?10:parseFloat(v);
  up.rec=(v==='P10'||!Number.isInteger(g))?2:g>=9?1:0;if(!up.tierPicked)up.tier=up.rec;renderTiers()}}validate()};$('own').onchange=validate;
$('cancelBtn').onclick=()=>{up=null;files={f:null,b:null};$('dropF').innerHTML='<b>앞면</b><span style="font-size:13px;color:var(--muted)">라벨 등급이 보이게</span>';$('dropB').innerHTML='<b>뒷면</b><span style="font-size:13px;color:var(--muted)">같은 슬랩의 뒷면</span>';$('nextUp').disabled=true;$('upStep2').hidden=true;$('upStep1').hidden=false};
async function toSide(file){const img=await loadImg(URL.createObjectURL(file));const c=document.createElement('canvas');const sc=Math.min(1,1400/img.naturalHeight);
  c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return{canvas:c,boxes:[]}}
$('nextUp').onclick=async()=>{
  try{up={f:await toSide(files.f),b:await toSide(files.b),side:'f',company:null,tier:null,rec:null,cond:'',recognized:false,tierPicked:false}}catch{return}
  $('upStep1').hidden=true;$('upStep2').hidden=false;$('submitMsg').hidden=true;$('own').checked=false;$('nameIn').value='';$('condTxt').innerHTML=AI?'':'<input type="text" id="condIn" maxlength="120" placeholder="내가 본 상태 (선택) 예: 왼쪽 위 모서리에 작은 흰 점" style="margin-top:4px">';
  for(const b of $('coSeg').children)b.setAttribute('aria-pressed','false');gradeOptions(null);renderTiers();setEditSide('f');validate();recognize();
};
function setEditSide(s){up.side=s;$('eF').setAttribute('aria-pressed',s==='f');$('eB').setAttribute('aria-pressed',s==='b');drawEditor()}
$('eF').onclick=()=>setEditSide('f');$('eB').onclick=()=>setEditSide('b');
function alertMsg(t){const m=$('recog');m.className='status err';m.textContent=t}
function b64Of(c){const s=document.createElement('canvas');const k=Math.min(1,1100/c.height);s.width=Math.round(c.width*k);s.height=Math.round(c.height*k);s.getContext('2d').drawImage(c,0,0,s.width,s.height);return s.toDataURL('image/jpeg',.85).split(',')[1]}
/* ---------- 무료 자동 감지: QR·바코드 (API 키 필요 없음) ---------- */
let jsqrP=null;
function loadJsQR(){if(window.jsQR)return Promise.resolve();if(!jsqrP)jsqrP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});return jsqrP}
async function findCodes(c){
  const W=c.width,H=c.height,out=[],pad=.015;
  const push=(x0,y0,x1,y1)=>{const b=[Math.max(0,x0/W-pad),Math.max(0,y0/H-pad),Math.min(1,x1/W+pad),Math.min(1,y1/H+pad)];if(!out.some(o=>Math.abs(o[0]-b[0])<.03&&Math.abs(o[1]-b[1])<.03))out.push(b)};
  if('BarcodeDetector' in window){try{const d=new BarcodeDetector();for(const r of await d.detect(c)){const bb=r.boundingBox;push(bb.x,bb.y,bb.x+bb.width,bb.y+bb.height)}}catch{}}
  try{await loadJsQR();
    // 라벨이 있는 위쪽 30%만 크게 확대해서 찾습니다.
    const h=Math.round(H*.3),t=document.createElement('canvas'),k=Math.min(2,1600/W);t.width=Math.round(W*k);t.height=Math.round(h*k);
    const x=t.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,W,h,0,0,t.width,t.height);
    const q=window.jsQR(x.getImageData(0,0,t.width,t.height).data,t.width,t.height,{inversionAttempts:'attemptBoth'});
    if(q){const p=q.location,xs=[p.topLeftCorner.x,p.topRightCorner.x,p.bottomLeftCorner.x,p.bottomRightCorner.x].map(v=>v/k),ys=[p.topLeftCorner.y,p.topRightCorner.y,p.bottomLeftCorner.y,p.bottomRightCorner.y].map(v=>v/k);push(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys))}
  }catch{}
  return out;
}
async function localDetect(){
  const m=$('recog');m.className='status';m.textContent='QR·바코드를 찾는 중…';
  up.f.codes=await findCodes(up.f.canvas);up.b.codes=await findCodes(up.b.canvas);
  const n=up.f.codes.length+up.b.codes.length;
  m.textContent=(n?`QR·바코드 ${n}개를 찾아 모자이크 칸을 놓았어요. `:'')+'회사를 고르면 등급 가림 칸과 인증번호 모자이크 칸이 기본 위치에 놓여요. 라벨에 맞게 끌어서 맞춰 주세요.';
  up.b.boxes=up.b.codes.map(b=>({t:'m',b}));up.f.boxes=up.f.codes.map(b=>({t:'m',b}));drawEditor();
}
async function recognize(){
  if(!AI)return localDetect();
  const m=$('recog');m.className='status';m.textContent='라벨과 카드 상태를 읽는 중…';
  const manual='회사, 등급, 단계를 직접 고르면 기본 위치에 가림 칸이 놓여요. 라벨에 맞게 옮겨 주세요.';
  try{
    const {data:r,error}=await sb.functions.invoke('recognize',{body:{front:b64Of(up.f.canvas),back:b64Of(up.b.canvas)}});
    if(error||!r||r.error){const code=r?.error;alertMsg((code==='rate_limited'?'자동 인식을 너무 많이 썼어요. 잠시 뒤 다시 해 주세요. ':code==='recognition_disabled'?'자동 인식이 꺼져 있어요. ':'자동 인식에 실패했어요. ')+manual);return}
    if(!r.isSlab){alertMsg('그레이딩 슬랩 사진으로 보이지 않아요. 라벨이 보이게 다시 찍어 주세요.');return}
    if(!COMPANIES.includes(r.company)){alertMsg(`${r.company==='OTHER'?'이 회사':r.company} 슬랩은 아직 받지 않아요. PSA, CGC, BRG만 올릴 수 있어요.`);return}
    up.recognized=true;setCompany(r.company);
    const ok=b=>Array.isArray(b)&&b.length===4&&b.every(n=>typeof n==='number'&&n>=0&&n<=1)&&b[2]>b[0]&&b[3]>b[1];
    const pad=(b,p)=>[Math.max(0,b[0]-p),Math.max(0,b[1]-p*.6),Math.min(1,b[2]+p),Math.min(1,b[3]+p*.6)];
    const T=TEMPLATE[r.company];
    up.f.boxes=[{t:'g',b:ok(r.front?.gradeBox)?pad(r.front.gradeBox,.015):[...T.g]}];
    const mf=(r.front?.serialBoxes||[]).filter(ok);(mf.length?mf:T.mf).forEach(b=>up.f.boxes.push({t:'m',b:pad(b,.012)}));
    const mb=(r.back?.serialBoxes||[]).filter(ok);up.b.boxes=(mb.length?mb:T.mb).map(b=>({t:'m',b:pad(b,.012)}));
    drawEditor();
    if(r.pristine&&r.company==='CGC')$('gradeSel').value='P10';else if(typeof r.grade==='number')$('gradeSel').value=String(r.grade);
    if(r.cardName)$('nameIn').value=String(r.cardName).slice(0,60);
    const cd=r.condition||{};up.cond=[cd.centering&&`센터링 ${cd.centering}`,cd.corners&&`모서리 ${cd.corners}`,cd.edges&&`에지 ${cd.edges}`,cd.surface&&`표면 ${cd.surface}`].filter(Boolean).join(' · ').slice(0,300);
    if([0,1,2].includes(r.tier)){up.rec=r.tier;up.tier=r.tier}renderTiers();
    $('condTxt').textContent=(cd.summary?cd.summary+' ':'')+(r.tierReason?`(${r.tierReason})`:'');
    const msg=`읽은 결과: ${r.company} ${r.pristine?'Pristine 10':r.grade??'등급 못 읽음'}. 라벨과 같은지 확인하고, 앞뒷면의 가림 칸이 등급·인증번호·QR을 다 덮는지 봐 주세요.`;
    if(r.sameSlab===false){m.className='status err';m.textContent='앞면과 뒷면의 인증번호가 서로 달라 보여요. 같은 슬랩의 사진인지 확인해 주세요. '+msg}else{m.className='status ok';m.textContent=msg}
    validate();
  }catch{alertMsg('자동 인식에 실패했어요. '+manual)}
}
function drawEditor(){
  const ed=$('editor');ed.innerHTML='';const S=up[up.side];ed.appendChild(S.canvas);
  S.boxes.forEach((bx,i)=>{const d=document.createElement('div');d.className='box '+bx.t;
    d.innerHTML=`<span class="tag">${bx.t==='g'?'등급 가림':'모자이크'}</span><span class="h"></span>${bx.t==='m'?'<button class="del" aria-label="모자이크 영역 삭제">×</button>':''}`;
    const place=()=>Object.assign(d.style,{left:bx.b[0]*100+'%',top:bx.b[1]*100+'%',width:(bx.b[2]-bx.b[0])*100+'%',height:(bx.b[3]-bx.b[1])*100+'%'});place();
    d.addEventListener('pointerdown',e=>{if(e.target.classList.contains('del'))return;e.preventDefault();d.setPointerCapture(e.pointerId);
      const r=ed.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,b0=[...bx.b],resize=e.target.classList.contains('h');
      const mv=ev=>{const dx=(ev.clientX-sx)/r.width,dy=(ev.clientY-sy)/r.height;
        if(resize){bx.b[2]=Math.min(1,Math.max(b0[0]+.02,b0[2]+dx));bx.b[3]=Math.min(1,Math.max(b0[1]+.01,b0[3]+dy))}
        else{const w=b0[2]-b0[0],h=b0[3]-b0[1];const x=Math.min(1-w,Math.max(0,b0[0]+dx)),y=Math.min(1-h,Math.max(0,b0[1]+dy));bx.b=[x,y,x+w,y+h]}place()};
      const upf=()=>{d.removeEventListener('pointermove',mv);d.removeEventListener('pointerup',upf);d.removeEventListener('pointercancel',upf)};
      d.addEventListener('pointermove',mv);d.addEventListener('pointerup',upf);d.addEventListener('pointercancel',upf)});
    d.querySelector('.del')?.addEventListener('click',()=>{S.boxes.splice(i,1);drawEditor()});
    ed.appendChild(d)});
  $('previewBtn').textContent='결과 미리보기';validate();
}
$('addMosaic').onclick=()=>{if(!up)return;up[up.side].boxes.push({t:'m',b:[.4,.1,.6,.16]});drawEditor()};
function bake(S){
  const src=S.canvas,sc=Math.min(1,1000/src.height),c=document.createElement('canvas');c.width=Math.round(src.width*sc);c.height=Math.round(src.height*sc);
  const x=c.getContext('2d');x.drawImage(src,0,0,c.width,c.height);
  for(const bx of S.boxes.filter(b=>b.t==='m')){const X=Math.floor(bx.b[0]*c.width),Y=Math.floor(bx.b[1]*c.height),W=Math.ceil((bx.b[2]-bx.b[0])*c.width),H=Math.ceil((bx.b[3]-bx.b[1])*c.height);
    if(W<2||H<2)continue;const blk=Math.max(8,Math.round(Math.min(W,H)/6)),t=document.createElement('canvas');t.width=Math.max(1,Math.round(W/blk));t.height=Math.max(1,Math.round(H/blk));
    t.getContext('2d').drawImage(c,X,Y,W,H,0,0,t.width,t.height);x.imageSmoothingEnabled=false;x.drawImage(t,0,0,t.width,t.height,X,Y,W,H);x.imageSmoothingEnabled=true}
  return c;
}
async function toJpeg(c,limit=380000){let q=.85;for(;;){const b=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(b.size<=limit||q<.45)return b;q-=.08}}
$('previewBtn').onclick=()=>{if(!up)return;const ed=$('editor');
  if(ed.querySelector('.pv')){drawEditor();return}
  const S=up[up.side],c=bake(S),g=S.boxes.find(b=>b.t==='g');const im=new Image();
  im.onload=()=>{const pv=document.createElement('canvas');paint(pv,im,g?g.b:null,!!g);pv.className='pv';pv.style.cssText='display:block;max-width:100%;height:auto;max-height:68vh;border-radius:8px';
    ed.innerHTML='';ed.appendChild(pv);$('previewBtn').textContent='영역 다시 편집'};im.src=c.toDataURL()};
$('submitBtn').onclick=async()=>{
  const btn=$('submitBtn'),msg=$('submitMsg');btn.disabled=true;msg.hidden=false;msg.className='status';msg.textContent='올리는 중…';
  try{
    const v=$('gradeSel').value,pristine=v==='P10',grade=pristine?10:parseFloat(v);const g=up.f.boxes.find(b=>b.t==='g');
    const id=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
    const fp=`pending/${id}-f.jpg`,bp=`pending/${id}-b.jpg`;
    for(const [path,S] of [[fp,up.f],[bp,up.b]]){const {error}=await sb.storage.from('cards').upload(path,await toJpeg(bake(S)),{contentType:'image/jpeg',upsert:false});if(error)throw error}
    const {error}=await sb.from('cards').insert({front_path:fp,back_path:bp,company:up.company,grade,pristine,tier:up.tier,box:g.b.map(n=>+n.toFixed(4)),name:$('nameIn').value.trim().slice(0,60),cond:(AI?up.cond:($('condIn')?.value||'').trim()).slice(0,300),submitter:PID});
    if(error)throw error;
    msg.className='status ok';msg.textContent='올렸어요. 운영자가 확인하면 문제로 나옵니다.';setTimeout(()=>$('cancelBtn').click(),1800);
  }catch{msg.className='status err';msg.textContent='올리지 못했어요. 잠시 뒤 다시 시도해 주세요.';btn.disabled=false}
};

/* ---------- 메뉴 ---------- */
$('tHome').onclick=()=>{if(!$('vGame').hidden)return;show('vHome')};$('logo').onclick=()=>show('vHome');$('tUp').onclick=openUp;

/* ---------- 시작 ---------- */
renderBoard();
if(sb){
  loadCommunity();loadBoard();
  sb.channel('scores-live').on('postgres_changes',{event:'*',schema:'public',table:'scores'},()=>loadBoard()).subscribe();
  setInterval(()=>{if(!document.hidden)loadBoard()},60000);
}
if(location.hash==='#upload')openUp();
})();
