// Cloud simulator checks only; UI automation, no training implementation here.
(async()=>{
 const checks=[];
 const wait=async(test,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){if(localStorage.getItem('airplane-avatar-last-error-v1'))throw Error('Worker reported a runtime error');if(test())return;await new Promise(r=>setTimeout(r,250));}throw Error('UI condition timed out');};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
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
  document.querySelectorAll('.mobile-nav button')[2].click();await click('选择棋手与对手 →');
  const select=async(label,value)=>{await wait(()=>document.querySelector(`[aria-label="${label}"]`)&&!document.querySelector(`[aria-label="${label}"]`).disabled);const s=document.querySelector(`[aria-label="${label}"]`);s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));};
  await select('自由对决局数','2');await select('自由对决观看方式','fast');
  for(const [left,right] of [['attack','attack'],['attack','dual'],['dual','dual']]){
   for(const [side,kind] of [['左方',left],['右方',right]]){
    await select(side+'来源',kind==='platform'?'platform':'model');
    if(kind!=='platform'){
     const s=document.querySelector(`[aria-label="${side}版本"]`);
     const option=[...s.options].find(o=>o.text.includes(kind==='attack'?'攻击CNN':'攻防CNN'));
     if(!option)throw Error('Missing arena model choice');await select(side+'版本',option.value);
    }
   }
   await click('开始自由对决');
   await wait(()=>button('开始自由对决')&&!button('开始自由对决').disabled&&document.body.innerText.includes('对战完成 · 训练成果保持不变'),900000);
   checks.push(left+' versus '+right+' completed two full games with runtime and saved-model hash verification');
  }
  if([...document.querySelector('[aria-label="左方来源"]').options].some(o=>o.value==='platform'))throw Error('Unowned platform source still selectable');
  await click('挑战招募');await select('招募目标','random');
  const quantity=document.querySelector('[aria-label="自由对决局数"]');if(!quantity.disabled||quantity.value!=='10')throw Error('Recruitment rules not fixed');
  await click('开始招募挑战');await wait(()=>document.body.innerText.includes('对战完成 · 训练成果保持不变')&&(button('开始招募挑战')&&!button('开始招募挑战').disabled||button('角色已获得')),900000);
  checks.push('owned-only arena choices and ten-game recruitment challenge completed with immutable models');
  report(true);
 }catch(error){report(false,String(error));}
})();
