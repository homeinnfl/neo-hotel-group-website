const menu = document.querySelector('#menu');
const nav = document.querySelector('#nav');
function closeNavigation(){nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open navigation');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('open',open);});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNavigation));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){closeNavigation();menu.focus();}});
document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))closeNavigation();});
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const slides=[...document.querySelectorAll('.hero-slide')];
if(slides.length){
 const captions=['Home2 Suites · Stow Akron','Comfort Inn & Suites · Cuyahoga Falls','Comfort Inn & Suites · Akron South','SpringHill Suites · Canton'];
 const hero=document.querySelector('.hero'),pause=document.querySelector('#slide-pause');
 let current=Math.floor(Math.random()*slides.length),playing=!reducedMotion.matches,timer=null,hovered=false;
 function setButton(){pause.textContent=playing?'Ⅱ':'▶';pause.setAttribute('aria-label',playing?'Pause slideshow':'Play slideshow');}
 function schedule(){clearTimeout(timer);if(playing&&!document.hidden&&!hovered&&!hero.contains(document.activeElement))timer=setTimeout(()=>{show(current+1);schedule();},6500);}
 function show(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.setAttribute('aria-hidden',String(i!==current));});document.querySelector('#slide-count').textContent=`${String(current+1).padStart(2,'0')} / 04`;document.querySelector('#slide-caption').textContent=captions[current];}
 document.querySelector('#slide-prev').addEventListener('click',()=>{show(current-1);schedule();});
 document.querySelector('#slide-next').addEventListener('click',()=>{show(current+1);schedule();});
 pause.addEventListener('click',()=>{playing=!playing;setButton();schedule();});
 hero.addEventListener('mouseenter',()=>{hovered=true;schedule();});hero.addEventListener('mouseleave',()=>{hovered=false;schedule();});
 hero.addEventListener('focusin',schedule);hero.addEventListener('focusout',()=>setTimeout(schedule,0));
 document.addEventListener('visibilitychange',schedule);
 reducedMotion.addEventListener('change',e=>{if(e.matches){playing=false;setButton();schedule();}});
 show(current);setButton();schedule();
}
if(!reducedMotion.matches&&window.matchMedia('(min-width:801px)').matches&&'IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('is-waiting');observer.unobserve(e.target);}}),{threshold:.08});
 document.querySelectorAll('.reveal').forEach(el=>{el.classList.add('is-waiting');observer.observe(el);});
}
