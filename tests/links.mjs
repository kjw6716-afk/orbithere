// 정적 사이트의 가장 흔한 사고 — 링크가 없는 파일을 가리키거나,
// 페이지를 추가하고 sitemap·푸터에 넣는 걸 잊는 것.
// 빌드 스텝이 없는 사이트라 아무도 대신 잡아주지 않으므로 여기서 잡는다.
//
// 브라우저가 필요 없다. node tests/links.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ✓ ' + name + (extra ? '  ' + extra : ''));
  else { failed++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
};

// 공개되는 페이지 — _archive 는 Jekyll 이 빼므로 제외한다
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));

console.log('\n[1] 내부 링크가 실제 파일을 가리키는지');
{
  let broken = [];
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    const hrefs = [...html.matchAll(/(?:href|src)="([^"#?][^"]*)"/g)].map((m) => m[1]);
    for (const h of hrefs) {
      if (/^(https?:|mailto:|data:|\/\/)/.test(h)) continue;
      const clean = h.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = clean.startsWith('/') ? join(root, clean.slice(1)) : join(root, clean);
      if (!existsSync(target)) broken.push(`${page} → ${h}`);
    }
  }
  ok('깨진 내부 링크 없음', broken.length === 0, broken.length ? '\n      ' + broken.join('\n      ') : `${pages.length}개 페이지 검사`);
}

console.log('\n[2] sitemap 과 실제 페이지가 어긋나지 않는지');
{
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const listed = [...sitemap.matchAll(/<loc>https:\/\/orbithere\.com\/([^<]*)<\/loc>/g)]
    .map((m) => m[1] || 'index.html');

  // 색인에서 빼기로 한 페이지 — robots.txt 와 이유가 같아야 한다
  const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
  const disallowed = [...robots.matchAll(/Disallow:\s*\/(\S*)/g)].map((m) => m[1]);
  const noindex = pages.filter((p) => /<meta[^>]+name="robots"[^>]+noindex/i.test(readFileSync(join(root, p), 'utf8')));

  const shouldList = pages.filter((p) => p !== '404.html' && !noindex.includes(p) && !disallowed.includes(p));
  const missing = shouldList.filter((p) => !listed.includes(p));
  const extra = listed.filter((p) => !existsSync(join(root, p)));

  ok('sitemap 에 빠진 페이지 없음', missing.length === 0, missing.length ? missing.join(', ') : `${listed.length}개 등재`);
  ok('sitemap 에 없는 파일이 실려 있지 않음', extra.length === 0, extra.join(', '));
  for (const p of noindex) ok(`${p} 은 noindex 이므로 sitemap 제외`, !listed.includes(p));
}

console.log('\n[3] 페이지마다 canonical · OG 이미지가 있는지');
{
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    if (/name="robots"[^>]+noindex/i.test(html) || page === '404.html') continue;
    ok(`${page} canonical`, /<link rel="canonical" href="https:\/\/orbithere\.com\//.test(html));
    ok(`${page} og:image`, /property="og:image"/.test(html));
  }
}

console.log('\n[4] 새 localStorage 키는 개인정보처리방침에 적혀 있어야 한다');
{
  // PROJECT_STATUS 가 «키를 늘리면 privacy.html 4항을 같이 고칠 것» 이라고 못 박고 있고,
  // 실제로 두 번 빠뜨린 적이 있다. 사람 기억 대신 검사로 지킨다.
  const privacy = readFileSync(join(root, 'privacy.html'), 'utf8');
  const used = new Set();
  for (const f of [...pages, 'visits.js']) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g)) used.add(m[1]);
    for (const m of src.matchAll(/['"](orbit_[a-z_]+)['"]/g)) used.add(m[1]);
  }
  const undocumented = [...used].filter((k) => !privacy.includes(`<code>${k}</code>`));
  ok('모든 orbit_* 키가 privacy.html 에 적혀 있음', undocumented.length === 0,
     undocumented.length ? '누락: ' + undocumented.join(', ') : [...used].sort().join(' '));
}

console.log('\n' + (failed === 0 ? '링크·문서 검증 — 전부 통과' : `링크·문서 검증 — ${failed}건 실패`));
process.exit(failed === 0 ? 0 : 1);
