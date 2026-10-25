// Cloud simulator checks only; UI automation, no training implementation here.
(async()=>{
 const checks=[];
 const wait=async(test,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){if(localStorage.getItem('airplane-avatar-last-error-v1'))throw Error('Worker reported a runtime error');if(test())return;await new Promise(r=>setTimeout(r,250));}throw Error('UI condition timed out');};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getClientRects().length);
 const click=async text=>{await wait(()=>button(text)&&!button(text).disabled);button(text).click();await new Promise(r=>setTimeout(r,200));};
 const report=(pass,error)=>window.webkit.messageHandlers.nativeQA.postMessage({pass,checks,error:error||null,diagnostic:JSON.parse(localStorage.getItem('airplane-avatar-last-error-v1')||'null')});
 try{
  await wait(()=>document.querySelectorAll('.mobile-nav button').length===5);
  checks.push('five navigation items rendered in WKWebView');
  const restored=JSON.parse(localStorage.getItem('native-qa-models')||'null');
  document.querySelectorAll('.mobile-nav button')[1].click();
  await wait(()=>document.querySelector('[aria-label="新角色名称"]'));
  if(!restored){
   const input=document.querySelector('[aria-label="新角色名称"]');
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'iOS 训练验证');
   input.dispatchEvent(new Event('input',{bubbles:true}));
   await click('新建角色');
  }
  await wait(()=>[...document.querySelectorAll('.training-methods button')].some(b=>b.textContent.includes('智能式训练')&&!b.disabled));
  [...document.querySelectorAll('.training-methods button')].find(b=>b.textContent.includes('智能式训练')).click();
  const ids={};
  for(const [kind,label] of [['attack','攻击 CNN'],['dual','攻防 CNN']]){
   await click(label);
   if(!restored)await click('从零创建分身');
   await wait(()=>button('更换版本 / 管理')||button('收起管理'));
   if(button('更换版本 / 管理'))await click('更换版本 / 管理');
   await wait(()=>{const s=document.querySelector('[aria-label="分身版本"]');return s&&s.value&&!s.disabled;});
   let id=document.querySelector('[aria-label="分身版本"]').value;
   if(restored&&id!==restored[kind])throw Error('Model version did not survive reload: '+kind);
   checks.push(kind+(restored?' saved model survives reload':' real worker initialized and saved model'));
   if(!restored){
    if(kind==='dual'){
     const quantity=document.querySelector('[aria-label="训练数量"]');
     quantity.value='1';quantity.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await click('开始新的训练计划');
    if(kind==='attack'){
     await wait(()=>{const p=document.querySelector('.avatar-progress');return p&&p.hasAttribute('value')&&p.value>0&&p.max>=256;},900000);
     window.pauseForBackground();
    }
    await wait(()=>{const s=document.querySelector('[aria-label="分身版本"]');return s&&!s.disabled&&s.value&&s.value!==id;},900000);
    id=document.querySelector('[aria-label="分身版本"]').value;
    const updates=parseInt(document.querySelector('.training-totals b')?.textContent||'0',10);
    if(!(updates>0))throw Error(kind+' training saved without a weight update');
    if(kind==='attack')await wait(()=>button('继续原训练计划')&&!button('继续原训练计划').disabled);
    checks.push((kind==='attack'?'attack real training paused and new checkpoint saved with resume available':'dual full one-batch training and before-after evaluation completed')+'; weight updates='+updates);
   }
   ids[kind]=id;
   if(!restored)await click('释放计算资源');
  }
  if(!restored){localStorage.setItem('native-qa-models',JSON.stringify(ids));localStorage.setItem('native-qa-training-checks',JSON.stringify(checks));location.reload();return;}
  checks.unshift(...JSON.parse(localStorage.getItem('native-qa-training-checks')||'[]'));
  checks.push('both trained checkpoints survive WKWebView reload');
  if(document.querySelectorAll('.workspace-tabs button').length!==3)throw Error('Missing training workspace tabs');
  for(const text of ['本次结果','历史记录','安排训练'])await click(text);
  if(!document.querySelector('[aria-label="训练数量"]')||!document.querySelector('[aria-label="评测数量"]'))throw Error('Missing original quantity controls');
  if([...document.querySelectorAll('.mobile-segment button')].some(b=>b.textContent.includes('C网络')))throw Error('Unexpected network added');
  checks.push('training workspace layout tabs, original quantities, version management and both non-C networks verified');
  report(true);
 }catch(error){report(false,String(error));}
})();
