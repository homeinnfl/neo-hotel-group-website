const form=document.getElementById('career-form');
const submit=document.getElementById('career-submit'),error=document.getElementById('career-error'),status=document.getElementById('career-status');
const resume=document.getElementById('career-resume'),mode=document.querySelector('meta[name="application-mode"]').content;
const id=document.getElementById('application-id');id.value=crypto.randomUUID();
const role=document.getElementById('career-role');
for(const link of document.querySelectorAll('[data-role]'))link.addEventListener('click',()=>{role.value=link.dataset.role;requestAnimationFrame(()=>role.focus({preventScroll:true}));});
const initialRole=new URLSearchParams(location.search).get('role');if([...role.options].some(o=>o.value===initialRole))role.value=initialRole;
function checkResume(){
 const file=resume.files[0];let message='';
 if(file&&file.size>5*1024*1024)message='Choose a résumé that is 5 MB or smaller.';
 else if(file&&!/\.(pdf|doc|docx)$/i.test(file.name))message='Choose a PDF, DOC or DOCX résumé.';
 resume.setCustomValidity(message);
 document.getElementById('resume-name').textContent=message|| (file?`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`:'No résumé selected. You can still apply without one.');
 return !message;
}
resume.addEventListener('change',checkResume);
form.addEventListener('submit',async event=>{
 event.preventDefault();error.hidden=true;
 if(!checkResume()||!form.reportValidity())return;
 submit.disabled=true;status.textContent='Sending your application…';
 try {
  const data=new FormData(form);
  const response=await fetch(mode==='hosted'?'/api/careers/apply':'/',{method:'POST',body:data});
  let result;
  if(mode==='hosted') {result=await response.json();if(!response.ok||result.ok!==true)throw new Error(result.error||'Your application could not be saved. Please try again.');}
  else if(!response.ok)throw new Error('Your application could not be sent. Please try again or email rickesh@neohotelgroup.com.');
  const selectedRole=role.value;
  form.reset();form.hidden=true;document.querySelector('.application-heading').hidden=true;
  document.getElementById('career-success-message').textContent=`Your application for ${selectedRole} has been received. Our team will review your details and contact you if there’s a suitable opportunity.`;
  document.getElementById('career-reference').textContent=result?.id?`Application reference: ${result.id}`:'';
  const success=document.getElementById('career-success');success.hidden=false;success.focus();success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
 } catch(e){error.textContent=e.message||'Your application could not be sent. Please try again.';error.hidden=false;status.textContent='';error.scrollIntoView({block:'center'});}
 finally{submit.disabled=false;}
});
