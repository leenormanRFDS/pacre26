(() => {
const panels=[...document.querySelectorAll('.panel')],anchors=[...document.querySelectorAll('.track>div[id]')],dots=[...document.querySelectorAll('.chapters a')];
const a=document.querySelector('#photo-a'),b=document.querySelector('#photo-b'),mask=document.querySelector('#mask-path'),contour=document.querySelector('#contour-path'),caption=document.querySelector('#visual-caption')||{},motion=document.querySelector('#motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,smooth=0,last=performance.now(),beat=-1;
const photos=[195,195,'care','drone','training',198,194,197],labels=['THE CENTRE','CONSTRUCTION COMPLETE','HEALTH','EDUCATION','TRAINING','TOGETHER UNDER ONE ROOF','OUR COMMUNITIES','OUR PARTNERS'];
// Manual, normalized vector interpretations of observed architecture. These are
// presentation masks, not survey-accurate architectural outlines.
const shapes={corner:[.17,.06,.98,.94,.07,.02,.86,.76,.24,.14],band:[.21,.19,.98,.81,.10,.025,.78,.68,.32,.22],opening:[.26,.09,.98,.91,.09,.015,.84,.70,.30,.16]};
const shapeNames=['corner','band','corner','opening','opening','band','corner','band'];const clamp=(x,l=0,h=1)=>Math.max(l,Math.min(h,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
// Phones get the 1200px photographs (about a third of the bytes); everything else gets 2200px.
const phone=matchMedia('(max-width:800px)');
function imageUrl(n){return `assets/PACRE-${n}-${phone.matches?1200:2200}.webp`}
function setPhoto(node,n){node.style.backgroundImage=`url('${imageUrl(n)}')`;node.style.backgroundSize=n==='drone'?'contain':'';node.style.backgroundPosition=n===191?'43% 54%':n===198?'48% 53%':n===197?'53% 60%':n==='care'?'50% 30%':n==='clinic'?'45% 40%':n==='training'?'66% 35%':'50% 50%'}
// Photographs that are not project photography get their own caption.
const photoCaptions={care:'RFDS PRIMARY HEALTH CARE',clinic:'RFDS RURAL GENERALIST INTERN',training:'RFDS RURAL & REMOTE RETRIEVAL COURSE'};
const photoCaption=n=>photoCaptions[n]||`PROJECT PHOTOGRAPHY · PACRE-${n}${n===192?' · ARCHITECTURAL DETAIL':''}`;
/* Photos for each floor. Each one grows out of the blue floor, holds, then flies
   into the middle of the building, one at a time; the roof then seals them in.
   Entries marked STAND-IN are placeholders until the right photograph arrives:
   replace the id (a file assets/PACRE-<id>-1200/2200.webp) and the focus point. */
const FLOOR_PHOTOS={
  2:[['care','50% 30%'],[191,'45% 55%'],[190,'50% 55%']],            // Health: primary care, consult room, reception
  3:[],                                                               // Education: the model only, Level 02 in blue
  4:[['training','66% 35%'],['clinic','45% 40%']]                     // Training: retrieval course, rural generalist intern
};
const PHOTO_START=.34,PHOTO_END=.93;   // share of each chapter given to its photos
const visualBox=document.querySelector('.visual'),cardLayer=document.createElement('div');cardLayer.className='floor-photos';visualBox.appendChild(cardLayer);
const cards={};for(const b in FLOOR_PHOTOS)cards[b]=FLOOR_PHOTOS[b].map(([id,pos])=>{const el=document.createElement('div');el.className='floor-photo';el.dataset.id=id;el.style.backgroundPosition=pos;cardLayer.appendChild(el);return el});
function loadCards(b){for(const el of cards[b]||[])if(!el.style.backgroundImage)el.style.backgroundImage=`url('${imageUrl(el.dataset.id)}')`}
// Snap points: the model settled, then each photo at its fullest.
for(const b in FLOOR_PHOTOS){const anchor=anchors[b];anchor.querySelectorAll('.snap').forEach(n=>n.remove());const n=FLOOR_PHOTOS[b].length,L=(PHOTO_END-PHOTO_START)/n;for(const at of [.3,...FLOOR_PHOTOS[b].map((_,k)=>PHOTO_START+(k+.48)*L)]){const m=document.createElement('i');m.className='snap';m.style.top=(at*100).toFixed(1)+'%';anchor.appendChild(m)}}
function placeCards(i,p){
  const box=visualBox.getBoundingClientRect(),W=Math.min(box.width*.8,box.height*.78*1.5),H=W/1.5,cx=box.width/2,cy=box.height*.48;
  const an=window.rfdsAnchors||{},floor=an.floor||[cx,box.height*.7],core=an.core||[cx,cy];
  for(const b in cards){const list=cards[b],n=list.length,L=(PHOTO_END-PHOTO_START)/n;
    list.forEach((el,k)=>{
      const t=+b===i?(p-(PHOTO_START+k*L))/L:-1;
      if(t<=0||t>=1){el.style.opacity='0';return}
      el.style.width=W+'px';el.style.height=H+'px';
      let x=cx,y=cy,s=1,o=1;
      if(paused){o=ease(t/.15)*(1-ease((t-.85)/.15))}
      else{const g=ease(t/.28),f=ease((t-.68)/.32);
        if(t<.28){x=floor[0]+(cx-floor[0])*g;y=floor[1]+(cy-floor[1])*g;s=.06+.94*g;o=ease(t/.1)}
        else if(t>.68){x=cx+(core[0]-cx)*f;y=cy+(core[1]-cy)*f;s=1-.96*f;o=1-ease((t-.86)/.14)}}
      el.style.opacity=String(o);el.style.transform=`translate(${(x-W/2).toFixed(1)}px,${(y-H/2).toFixed(1)}px) scale(${s.toFixed(4)})`;
    })}
}
const together2=document.querySelector('.together-2'),mapEl=document.querySelector('#map'),mapCredits=document.querySelector('#map-credits');
function shape(v){const [x,y,r,bt,c,l,cy,ey,sy,ty]=v;const d=`M ${x} ${y} H ${r} V ${bt} H ${x} C ${c} ${bt} ${l} ${cy} ${l} ${ey} V ${sy} C ${l} ${ty} ${c} ${y} ${x} ${y} Z`;mask.setAttribute('d',d);contour.setAttribute('d',d.replace(/\d*\.?\d+/g,n=>String(+n*1000)))}
// Phone layout: the visual takes whatever height is left once the header, the
// chapter bar and the active text panel have been measured, so nothing can overlap.
const stage=document.querySelector('.presentation'),head=document.querySelector('header'),canvas=document.querySelector('#model-canvas');
const openWrap=document.querySelector('#open-wrap'),droneWrap=document.querySelector('#drone-wrap'),openImg=document.querySelector('#photo-open'),droneImg=document.querySelector('#photo-drone');
// Cut-outs with transparent backgrounds. The aerial one loads once the story is under way.
const cutoutUrl=name=>`assets/PACRE-${name}-${phone.matches?1200:2200}.webp`;openImg.src=cutoutUrl('198-cutout');
let droneLoaded=false;function loadDrone(){if(!droneLoaded){droneLoaded=true;droneImg.src=cutoutUrl('drone')}}
function layout(){stage.style.setProperty('--head-h',head.offsetHeight+'px');const p=panels[Math.max(0,beat)];stage.style.setProperty('--text-h',(phone.matches&&p?p.offsetHeight:0)+'px')}
function destination(){let i=0;while(i<anchors.length-1&&scrollY>=anchors[i+1].offsetTop)i++;return i+clamp((scrollY-anchors[i].offsetTop)/anchors[i].offsetHeight,0,.99999)}
function update(now){const dt=Math.max(0,Math.min(80,now-last));last=now;const target=destination();smooth=paused?target:smooth+(target-smooth)*(1-Math.exp(-dt/125));const i=Math.max(0,Math.min(7,Math.floor(smooth))),p=smooth-i;
if(beat!==i){beat=i;layout();loadCards(i);loadCards(i+1);setPhoto(a,photos[i]);setPhoto(b,photos[Math.min(i+1,7)]);if(i>=3)loadDrone();dots.forEach((d,j)=>{if(j===i)d.setAttribute('aria-current','step');else d.removeAttribute('aria-current')});panels.forEach((el,j)=>{el.classList.toggle('active',j===i);el.inert=j!==i})}
panels.forEach((el,j)=>{el.style.opacity=j===i?String((i===0?1:ease(p/.10))*(i===7?1:(1-ease((p-.89)/.11)))):'0';if(paused&&j===i)el.style.opacity='1';el.style.translate=j===i&&!paused?`0 ${14*(1-ease(p/.14))}px`:'0 0'});
/* What is on screen in this chapter. Each value is an opacity from 0 to 1.
   photoA  the chapter's framed photograph       photoB  the next chapter's photograph
   open    the PACRE-198 cut-out (opening)        drone   the aerial cut-out (together)
   model   the 3D model canvas
   The cut-outs are placed by model.js so they sit exactly on the model,
   which is what lets one dissolve into the other.                          */
const ready=!!window.rfdsModelReady,mapReady=!!window.rfdsMapReady;let photoA=1,photoB=0,open=0,drone=0,model=0,sweep=1,push=1,map=0;
if(i===0){photoA=0;photoB=ease((p-.86)/.14);open=1-photoB}
else if(i===1){if(ready){photoA=1-ease((p-.70)/.10);model=ease((p-.80)/.15);open=ease((p-.70)/.10)*(1-model)}}
else if(i>=2&&i<=4){if(ready){photoA=0;model=1}else photoA=1}
else if(i===5){photoA=0;photoB=ease((p-.89)/.11);if(mapReady){map=photoB;photoB=0}if(ready){const r=ease((p-.55)/.17);model=1-r;drone=1-photoB;sweep=paused?1:r;if(paused)drone*=r;push=paused?1:1+.025*ease((p-.72)/.28)}else drone=1-photoB;if(mapReady)drone=(1-map)*(paused&&ready?ease((p-.55)/.17):1)}
else photoB=ease((p-.86)/.14);
if(i>5)photoA=1-photoB;
if(i>5&&mapReady){map=1;photoA=0;photoB=0}
// "Together" arrives with the roof; "under one roof" arrives with the real building.
together2.style.opacity=i===5&&!paused&&ready?String(ease((p-.55)/.17)):'1';
mapEl.style.opacity=String(map);mapCredits.style.opacity=String(map);
a.style.opacity=String(photoA);b.style.opacity=String(photoB);a.style.transform=paused?'none':`scale(${1.015-.015*ease(p)})`;
openWrap.style.opacity=String(open);openWrap.style.transform=i===0&&!paused?`translate(0,${-3*ease(p)}%) scale(${1-.03*ease(p)})`:'none';
droneWrap.style.opacity=String(drone);droneWrap.style.transform=`scale(${push})`;
// The aerial photo appears from the roof down: a soft-edged mask sweeps over it.
const edge=sweep>=1?'#000 100%':`#000 ${(sweep*118-18).toFixed(1)}%,transparent ${(sweep*118).toFixed(1)}%`;droneImg.style.webkitMaskImage=droneImg.style.maskImage=sweep>=1?'none':`linear-gradient(to bottom,${edge})`;
const from=shapes[shapeNames[i]],to=shapes[shapeNames[Math.min(i+1,7)]],t=paused?0:ease((p-.82)/.18);shape(from.map((x,j)=>x+(to[j]-x)*t));
canvas.style.opacity=String(model);contour.style.opacity=String(.35*Math.max(photoA,photoB,map));
const top=Math.max(photoA,photoB,open,drone*sweep,model,map);caption.textContent=top===map&&map>0?(i>=7||(i===6&&p>.9)?'OUTBACK SOUTH AUSTRALIA · SATELLITE':'PORT AUGUSTA · SATELLITE'):top===model&&model>0?'V4 IVORY MODEL · SCHEMATIC PREVIEW':top===drone*sweep&&drone>0?'PROJECT PHOTOGRAPHY · AERIAL':top===open&&open>0?'PROJECT PHOTOGRAPHY · PACRE-198':top===photoB?photoCaption(photos[Math.min(i+1,7)]):photoCaption(photos[i]);
const photoAlpha=1-model;
cardLayer.style.display=ready?'':'none';if(ready)placeCards(i,p);
window.rfdsStory={beat:i,local:p,paused,visible:(i>=2&&i<=5)||(i===1&&p>=.75),photoAlpha,modelAlpha:model};document.querySelector('#progress').style.width=`${100*clamp(scrollY/(document.querySelector('#journey').offsetHeight-innerHeight))}%`;requestAnimationFrame(update)}
if(motion)motion.onclick=()=>{paused=!paused;motion.textContent=paused?'Resume motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused))};if(paused&&motion){motion.textContent='Resume motion';motion.setAttribute('aria-pressed','true')}
addEventListener('resize',()=>beat=-1);reduced.addEventListener('change',e=>{paused=e.matches;if(motion){motion.textContent=paused?'Resume motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused))}});
// Keyboard and chapter links use native document scrolling; wheel and touch are never hijacked.
for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',e=>{const node=document.querySelector(link.getAttribute('href'));if(!node)return;e.preventDefault();const y=node.closest('.track')?node.offsetTop+node.offsetHeight*.18:node.getBoundingClientRect().top+scrollY;scrollTo({top:y,behavior:paused?'instant':'smooth'});history.replaceState(null,'',link.getAttribute('href'))});
const query=new URLSearchParams(location.search);if(query.has('scene')){const index=['opening','construction','health','education','training','together','community','partners'].indexOf(query.get('scene'));if(index>=0)scrollTo(0,anchors[index].offsetTop+anchors[index].offsetHeight*clamp(Number(query.get('phase')||.35),.01,.98))}
smooth=destination();setPhoto(a,195);panels[0].style.opacity='1';requestAnimationFrame(update);
if(document.fonts)document.fonts.ready.then(layout);addEventListener('load',layout);
requestAnimationFrame(()=>requestAnimationFrame(()=>stage.classList.add('ready')));
})();
