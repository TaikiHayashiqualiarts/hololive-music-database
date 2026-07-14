export async function pushToSheets(webAppUrl, token, payload) {
  if (!webAppUrl || !token) return { skipped: true, reason: 'Sheets secrets are not configured.' };

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, ...payload }),
    redirect: 'follow',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Sheets Web App ${response.status}: ${text}`);

  let result;
  try { result = JSON.parse(text); } catch { result = { text }; }
  if (result.ok === false) throw new Error(result.error || 'Sheets update failed.');
  return result;
}
