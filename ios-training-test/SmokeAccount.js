// Simulator-only checks. No real Apple account, provider token or production user is created.
(async()=>{
 const checks=JSON.parse(localStorage.getItem('native-account-checks')||'[]');
 const wait=async f=>{const end=Date.now()+180000;while(Date.now()<end){if(f())return;await new Promise(r=>setTimeout(r,100));}throw Error('Account UI timed out');};
 const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t&&b.getClientRects().length);
 // First load may add the shared growth ledger. Compare all existing identity,
 // progress and current-version fields while allowing this additive migration.
 const stableAgents=()=>{const d=JSON.parse(localStorage.getItem('mobile-training-roles-v1')||'null');if(d)d.roles=d.roles.map(({growth,...identity})=>identity);return JSON.stringify(d);};
 const report=(pass,error)=>window.webkit.messageHandlers.nativeQA.postMessage({pass,checks,error:error||null,diagnostic:pass?null:{ready:document.readyState,root:document.getElementById('root')?.innerHTML.slice(0,1200),body:document.body?.innerText.slice(0,1200),errors:window.__nativeEarlyErrors||[],scripts:[...document.scripts].map(s=>s.src)},scope:'Native secure storage, live US API and account UI; no real provider login'});
 try{
  await wait(()=>document.querySelectorAll('.mobile-nav button').length===5);
  const phase=Number(localStorage.getItem('native-account-phase')||0);
  if(phase===0){
   const previous=window.__nativeAccountResult;let resolve;
   window.__nativeAccountResult=(id,result)=>{if(id==='qa-native-account')resolve(result);else previous?.(id,result);};
   const native=(op,data={})=>new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Native bridge timeout')),10000);resolve=r=>{clearTimeout(timer);r.error?no(Error(r.error)):yes(r);};window.webkit.messageHandlers.nativeAccount.postMessage({id:'qa-native-account',op,...data});});
   const cap=await native('capabilities');if(cap.providers.join(',')!=='apple,google')throw Error('Missing Apple/Google providers');
   if((await native('read')).session)throw Error('QA expected isolated empty Keychain');
   const fixture=JSON.stringify({fixture:'secure-storage-only'});await native('write',{session:fixture});if((await native('read')).session!==fixture)throw Error('Keychain roundtrip failed');await native('clear');if((await native('read')).session)throw Error('Keychain clear failed');window.__nativeAccountResult=previous;
   checks.push('Native Apple bridge and Keychain write/read/delete verified in isolated simulator');
   for(const path of ['profile','summaries/list']){const response=await fetch('https://stampday.tybbtech.com/yijiang/api/'+path);if(response.status!==401)throw Error('Native cloud path did not reach authenticated API: '+path+' status '+response.status);}
   for(const path of ['profile','summaries/sync']){const response=await fetch('https://stampday.tybbtech.com/yijiang/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(response.status!==401)throw Error('Native cloud POST/CORS blocked: '+path);}
   checks.push('WKWebView CSP allows profile and summary GET/POST routes; unauthenticated requests reach API and are rejected401');

   const api='https://stampday.tybbtech.com/yijiang/api/auth/';const r=await fetch(api+'capabilities');if(!r.ok||!(await r.json()).providers.includes('apple'))throw Error('Live API capability request failed');if((await fetch(api+'me')).status!==401)throw Error('Unauthenticated profile was not rejected');
   checks.push('WKWebView reaches live US account API with CORS; unauthenticated profile rejected');
   document.querySelectorAll('.mobile-nav button')[1].click();await wait(()=>document.querySelector('[aria-label="New agent name"]'));
   const input=document.querySelector('[aria-label="New agent name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Account QA');input.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>button('Create agent'));button('Create agent').click();await wait(()=>localStorage.getItem('mobile-training-roles-v1'));
   localStorage.setItem('native-account-agents',stableAgents());
  }
  document.querySelectorAll('.mobile-nav button')[4].click();await wait(()=>button(phase===1?'通过 Apple 登录':'Continue with Apple')&&!button(phase===1?'通过 Apple 登录':'Continue with Apple').disabled);
  if(stableAgents()!==localStorage.getItem('native-account-agents'))throw Error('Account screen changed local agents');
  checks.push(phase===1?'Chinese account UI verified':'English account UI verified');
  if(phase<2){localStorage.setItem('native-account-checks',JSON.stringify(checks));localStorage.setItem('native-account-phase',String(phase+1));const select=document.querySelector('[aria-label="Language"]');await wait(()=>!select.disabled);select.value=phase===0?'zh':'en';select.dispatchEvent(new Event('change',{bubbles:true}));return;}
  checks.push('Account page and both language reloads preserve local identity/progress/current-version fields; additive growth migration allowed');report(true);
 }catch(e){report(false,String(e));}
})();
