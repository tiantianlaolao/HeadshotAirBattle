// Cloud simulator checks only; UI automation, no training implementation here.
(async()=>{
 if(document.documentElement.lang!=='zh-CN'){localStorage.setItem('yijiang-language-v1','zh');location.reload();return;}
 const checks=[];
 const wait=async(test,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){if(localStorage.getItem('airplane-avatar-last-error-v1'))throw Error('Worker reported a runtime error');if(test())return;await new Promise(r=>setTimeout(r,250));}throw Error('UI condition timed out');};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getClientRects().length);
 const click=async text=>{await wait(()=>button(text)&&!button(text).disabled);button(text).click();await new Promise(r=>setTimeout(r,200));};
 const report=(pass,error)=>window.webkit.messageHandlers.nativeQA.postMessage({pass,checks,error:error||null,diagnostic:JSON.parse(localStorage.getItem('airplane-avatar-last-error-v1')||'null')});
 try{
  await wait(()=>document.querySelectorAll('.mobile-nav button').length===5);
  checks.push('five navigation items rendered in WKWebView');
  const restored=JSON.parse(localStorage.getItem('native-qa-models')||'null');
  if(!restored&&window.webkit?.messageHandlers?.nativeAssets){
   const original=window.__arenaAssetsReady,pending=new Map();
   window.__arenaAssetsReady=(id,ready)=>pending.has(id)?pending.get(id)(ready):original?.(id,ready);
   const request=(test)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Local service recovery timed out'));},15000);pending.set(id,ready=>{clearTimeout(timer);pending.delete(id);ready?resolve():reject(Error('Local service unavailable'));});window.webkit.messageHandlers.nativeAssets.postMessage({id,...(test?{test}:{})});});
   try{await request('stop');await Promise.all([request(),request()]);const response=await fetch('./index.html',{cache:'no-store'});if(!response.ok)throw Error('Recovered local origin did not serve assets');checks.push('Native loopback service deliberately stopped and recovered through concurrent health requests; original origin retained');}finally{window.__arenaAssetsReady=original;}
  }

  document.querySelectorAll('.mobile-nav button')[1].click();
  await wait(()=>document.querySelector('[aria-label="新棋手名称"]'));
  if(!restored){
   const input=document.querySelector('[aria-label="新棋手名称"]');
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'iOS 训练验证');
   input.dispatchEvent(new Event('input',{bubbles:true}));
   await click('新建棋手');
  }
  await wait(()=>[...document.querySelectorAll('.training-methods button')].some(b=>b.textContent.includes('智能式训练')&&!b.disabled));
  [...document.querySelectorAll('.training-methods button')].find(b=>b.textContent.includes('智能式训练')).click();
  const ids={};
  for(const [kind,label] of [['attack','基础攻击学习']]){
   if(!restored)await click('从零创建智能棋手');
   await wait(()=>button('更换版本 / 管理')||button('收起管理'));
   if(button('更换版本 / 管理'))await click('更换版本 / 管理');
   await wait(()=>{const s=document.querySelector('[aria-label="智能棋手版本"]');return s&&s.value&&!s.disabled;});
   let id=document.querySelector('[aria-label="智能棋手版本"]').value;
   if(restored&&id!==restored[kind])throw Error('Model version did not survive reload: '+kind);
   checks.push(kind+(restored?' saved model survives reload':' real worker initialized and saved model'));
   if(!restored){
    if(kind==='dual'){
     const quantity=document.querySelector('[aria-label="训练数量"]');
     quantity.value='1';quantity.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await click('开始训练');
    if(kind==='attack'){
     await wait(()=>{const p=document.querySelector('.running-focus progress');return p&&p.hasAttribute('value')&&p.value>0&&p.max>=256;},900000);
     window.pauseForBackground();
    }
    await wait(()=>{const s=document.querySelector('[aria-label="智能棋手版本"]');return s&&!s.disabled&&s.value&&s.value!==id;},900000);
    id=document.querySelector('[aria-label="智能棋手版本"]').value;
    const updates=Number(document.querySelector('.compact-version')?.textContent.match(/累计(\d+)/)?.[1]||0);
    if(!(updates>0))throw Error(kind+' training saved without a weight update');
    if(kind==='attack'){await click('继续安排训练');await wait(()=>button('继续原计划')&&!button('继续原计划').disabled);}
    checks.push((kind==='attack'?'attack real training paused and new checkpoint saved with resume available':'dual full one-batch training and before-after evaluation completed')+'; weight updates='+updates);
   }
   if(!restored){const r=JSON.parse(localStorage.getItem('mobile-training-roles-v1')).roles[0];if(r.current?.id!==id||r.current?.kind!=='model')throw Error('Saved training did not update current combat version');}
   ids[kind]=id;
   if(!restored)await click('释放内存');
  }
  if(!restored){localStorage.setItem('native-qa-models',JSON.stringify(ids));localStorage.setItem('native-qa-training-checks',JSON.stringify(checks));location.reload();return;}
  checks.unshift(...JSON.parse(localStorage.getItem('native-qa-training-checks')||'[]'));
  checks.push('trained attack checkpoint survives WKWebView reload');
  if(document.querySelectorAll('.workspace-tabs button').length!==3)throw Error('Missing training workspace tabs');
  for(const text of ['本次结果','历史记录','安排训练'])await click(text);
  if(!document.querySelector('[aria-label="训练数量"]')||!document.querySelector('[aria-label="评测数量"]'))throw Error('Missing original quantity controls');
  if([...document.querySelectorAll('.mobile-segment button')].some(b=>b.textContent.includes('C网络')))throw Error('Unexpected network added');
  checks.push('ordinary attack training, saved checkpoints and three workspace tabs verified');
  const role=JSON.parse(localStorage.getItem('mobile-training-roles-v1')).roles[0];if(role.current?.id!==restored.attack)throw Error('Browsing training history changed combat version');
  document.querySelectorAll('.mobile-nav button')[3].click();await click('智能棋手');
  await wait(()=>document.querySelectorAll('.chessman-card').length===1);
  if(button('复制棋手')||button('创建棋手'))throw Error('Duplicate creation entry remains');
  await click('赢来的棋手');await click('智能棋手');
  checks.push('one chessman with saved historical versions, single current combat version persists, historical selection does not change combat, three library tabs and no copy/create shortcuts');
  document.querySelectorAll('.mobile-nav button')[2].click();await click('选择棋手与对手 →');
  await click('挑战招募');const counts=[...document.querySelector('[aria-label="招募挑战局数"]').options].map(o=>o.value);if(JSON.stringify(counts)!=='["100","1000"]')throw Error('Wrong recruitment counts');
  await click('升级挑战');if(!document.querySelector('.challenge-panel')&&!document.body.textContent.includes('幽辰'))throw Error('Missing upgrade challenge');
  await click('← 返回上一级');document.querySelectorAll('.mobile-nav button')[4].click();
  if(document.body.textContent.includes('历史模型与实验')||document.body.textContent.includes('技术详情'))throw Error('Research or technical entry exposed');
  await wait(()=>document.querySelector('.account-panel'));
  checks.push('unified upgrade, recruitment100/1000, back navigation, native account UI and no research entry');
  report(true);
 }catch(error){report(false,String(error));}
})();
