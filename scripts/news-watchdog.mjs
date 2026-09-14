import '../news-health.js';
import { pathToFileURL } from 'node:url';

export async function recoverNews({repository,token,request = fetch,now = Date.now()}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token) throw new Error('repository and token required');
  const headers = {Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const api = async (path, options = {}) => {
    const response = await request(`https://api.github.com/repos/${repository}${path}`, {
      ...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
  let feed;
  try {
    const response = await request('https://orbithere.com/data/news.json', {cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (response.ok) feed = await response.json();
  } catch { /* Invalid/unreachable public cache should be checked for recovery too. */ }
  const health = globalThis.orbitNewsHealth(feed,now);
  if (!health.stale && !health.allFailed) return {action:'healthy',health};
  // Avoid duplicate dispatches, including queued runs, and bound retry attempts.
  const {workflow_runs:runs} = await api('/actions/workflows/news.yml/runs?branch=main&per_page=30');
  if (!Array.isArray(runs)) throw new Error('invalid workflow response');
  if (runs.some(r => r.status !== 'completed')) return {action:'already_running',health};
  if (runs.some(r => now - Date.parse(r.created_at) < 45 * 60000)) return {action:'cooldown',health};
  await api('/actions/workflows/news.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});
  return {action:'dispatched',health};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await recoverNews({repository:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN});
    console.log(JSON.stringify(result));
    // A dispatch is a recovery attempt, not evidence that the live feed recovered.
    if (result.health.stale || result.health.allFailed) console.log('::warning::Public news requires attention; recovery status: ' + result.action);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
