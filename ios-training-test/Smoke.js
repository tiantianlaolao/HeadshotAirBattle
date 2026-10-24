// Cloud simulator checks only; UI automation, no training implementation here.
(async()=>{
 const checks=[];
 const wait=async(test,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,250));}throw Error('UI condition timed out');};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const click=async text=>{await wait(()=>button(text)&&!button(text).disabled);button(text).click();await new Promise(r=>setTimeout(r,200));};
 const report=(pass,error)=>window.webkit.messageHandlers.nativeQA.postMessage({pass,checks,error:error||null});
 try{
  await wait(()=>document.querySelectorAll('.mobile-nav button').length===5);
  checks.push('five navigation items rendered in WKWebView');
  const restored=JSON.parse(localStorage.getItem('native-qa-models')||'null');
  document.querySelectorAll('.mobile-nav button')[1].click();await click('分身训练');
  const ids={};
  for(const [kind,label] of [['attack','攻击 CNN'],['dual','攻防 CNN']]){
   await click(label);
   if(!restored)await click('从零创建分身');
   await wait(()=>{const s=document.querySelector('[aria-label="分身版本"]');return s&&s.value&&!s.disabled;});
   const id=document.querySelector('[aria-label="分身版本"]').value;
   if(restored&&id!==restored[kind])throw Error('Model version did not survive reload: '+kind);
   ids[kind]=id;
   checks.push(kind+(restored?' saved model survives reload':' real worker initialized and saved model'));
   if(!restored)await click('释放计算资源');
  }
  if(!restored){localStorage.setItem('native-qa-models',JSON.stringify(ids));location.reload();return;}
  checks.push('both network initialization and IndexedDB persistence completed');
  report(true);
 }catch(error){report(false,String(error));}
})();
