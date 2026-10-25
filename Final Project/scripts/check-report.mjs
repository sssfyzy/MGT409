import {readFile} from 'node:fs/promises';

const report=await readFile(new URL('../report.html',import.meta.url),'utf8');
const slides=await readFile(new URL('../slides.html',import.meta.url),'utf8');
const headings=[...report.matchAll(/<h2>(.*?)<\/h2>/g)].map(match=>match[1]);
const required=['1. Title and links','2. Motivation','3. What is new here','4. The agents','5. Tokenomics','6. Safety','7. Impact','8. Limits and next steps'];
const positions=required.map(title=>headings.indexOf(title));
const checks={
  reportPages:(report.match(/<section class="page">/g)||[]).length,
  slides:(slides.match(/<section(?: class="active")?>/g)||[]).length,
  requiredReportSectionsInOrder:positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])),
  embeddedReportScreenshots:(report.match(/data:image\//g)||[]).length,
  embeddedSlideScreenshots:(slides.match(/data:image\//g)||[]).length,
  reportHasNoExternalMedia:!/<(?:img|script|link)[^>]+(?:src|href)=["']https?:/i.test(report),
  noBuildPlaceholders:!/__SCREENSHOT__|__BENCHMARK__|__SMOKE__|__TEST_SUMMARY__/.test(report+slides)
};
console.log(JSON.stringify(checks,null,2));
if(checks.reportPages<10||checks.reportPages>15||checks.slides>10||!checks.requiredReportSectionsInOrder||checks.embeddedReportScreenshots<1||checks.embeddedSlideScreenshots<1||!checks.reportHasNoExternalMedia||!checks.noBuildPlaceholders)process.exitCode=1;
