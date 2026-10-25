import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const test=spawnSync(process.execPath,['--test','--test-reporter=tap'],{cwd:root,encoding:'utf8'});
if(test.status!==0)throw new Error('Tests failed; report was not updated.');
await writeFile(new URL('output/test-results.tap',root),test.stdout);
const count=Number(test.stdout.match(/^# tests (\d+)$/m)?.[1]);if(!count)throw new Error('Cannot establish executed test count.');
const benchmark=JSON.parse(await readFile(new URL('output/planner-benchmark.json',root),'utf8'));
const smoke=JSON.parse(await readFile(new URL('output/fresh-folder-check.json',root),'utf8'));
let html=await readFile(new URL('output/report-template.html',root),'utf8');
const replacements={
 '__SCREENSHOT__':'data:image/png;base64,'+(await readFile(new URL('output/local-menus-desktop.png',root))).toString('base64'),
 '__BENCHMARK__':'<table><tr><th>Case</th><th>Runs</th><th>Median ms</th><th>Range ms</th><th>Total USD</th></tr>'+benchmark.results.map(r=>`<tr><td>${escape(r.case)}</td><td>${r.runs}</td><td>${r.medianMs}</td><td>${r.minMs}–${r.maxMs}</td><td>${r.totalUSD===null?'No feasible plan':r.totalUSD.toFixed(2)}</td></tr>`).join('')+'</table>',
 '__BENCHMARK_NOTE__':escape(`Measured ${benchmark.measuredAt}; ${benchmark.node}. ${benchmark.warmup} ${benchmark.type}`),
 '__TEST_SUMMARY__':`${count} automated checks passed during this draft build. The TAP record is stored locally in output/test-results.tap. These are software checks, not user studies or live model tests.`,
 '__SMOKE__':escape(`Fresh temporary-folder startup check: ${smoke.result}, ${smoke.seconds} seconds on ${smoke.node}; recorded ${smoke.checkedAt}. No dependency installation, secrets or paid calls were used.`),
 '__GENERATED__':escape(new Date().toLocaleString('en-US',{timeZone:'America/New_York'})+' America/New_York')
};
for(const [key,value] of Object.entries(replacements))html=html.replaceAll(key,value);
if(/__(SCREENSHOT|BENCHMARK|SMOKE|TEST_SUMMARY|GENERATED)/.test(html))throw new Error('Unresolved report marker');
await writeFile(new URL('report.html',root),html);
console.log(`Draft report built with ${count} passing checks and embedded screenshot. Live AI/user evidence still pending.`);
