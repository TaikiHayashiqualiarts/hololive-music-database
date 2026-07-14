export async function pushToSheets(webAppUrl, token, payload){
  if(!webAppUrl) return {skipped:true};
  const r=await fetch(webAppUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,...payload})});
  const text=await r.text(); if(!r.ok)throw new Error(`Sheets Web App ${r.status}: ${text}`);
  let result; try{result=JSON.parse(text)}catch{result={text}}; if(result.ok===false)throw new Error(result.error||'Sheets update failed'); return result;
}
