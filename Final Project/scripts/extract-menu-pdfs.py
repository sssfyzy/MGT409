"""Read-only PDF research. Extract candidates with provenance; no claim of manual verification."""
import concurrent.futures
import io
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[1]
path = root / 'data' / 'new-haven-restaurants.json'
data = json.loads(path.read_text(encoding='utf-8'))
jobs = []
for restaurant in data['restaurants']:
    for source in restaurant['menuSources']:
        if source['type'] == 'Restaurant-linked PDF menu':
            url = source['url']
            # Explicitly reject other named branches and catering from individual-meal data.
            if re.search(r'delray|catering|wine|cocktail|beverage', urllib.parse.urlparse(url).path, re.I):
                source['status'] = 'Excluded from item extraction: branch or catering/drink scope needs review'
                continue
            jobs.append((restaurant['id'], url))

def extract(job):
    rid, url = job
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'BellyBudgetCourseResearch/0.1'})
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read(8_000_001)
        if len(raw) > 8_000_000 or not raw.startswith(b'%PDF'):
            return rid, url, [], 'Not a PDF under 8 MB'
        rows = []
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for number, page in enumerate(pdf.pages[:6], 1):
                # Split multi-column menus rather than reading across unrelated columns.
                for left, right in [(0, page.width / 2), (page.width / 2, page.width)]:
                    text = page.crop((left, 0, right, page.height)).extract_text() or ''
                    for line in text.splitlines():
                        match = re.match(r'^([A-Za-zÀ-ÿ][^\d$]{2,85}?)\s+\$?\s*(\d{1,3}(?:\.\d{1,2})?)\s*$', line.strip())
                        if not match or re.search(r'tax|gratuity|minimum|fee|per person|calorie|protein|party|year|price|add on', match[1], re.I):
                            continue
                        price = float(match[2])
                        if not 1 <= price <= 200:
                            continue
                        rows.append({'name': match[1].strip(), 'price': price, 'currency': 'USD', 'source': url,
                                     'sourceType': 'PDF text candidate', 'page': number,
                                     'verification': 'Unreviewed PDF extraction candidate. Name/price alignment and branch require visual review; not planner-ready.',
                                     'observedAt': datetime.now(timezone.utc).isoformat()})
        return rid, url, rows, 'PDF read; extracted rows require visual verification'
    except Exception as error:
        return rid, url, [], 'PDF unavailable: ' + type(error).__name__

ledger = []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    for rid, url, rows, status in executor.map(extract, jobs):
        restaurant = next(r for r in data['restaurants'] if r['id'] == rid)
        restaurant.setdefault('pdfCandidates', []).extend(rows)
        for source in restaurant['menuSources']:
            if source['url'] == url:
                source['status'] = status
        ledger.append({'restaurant': rid, 'url': url, 'candidateRows': len(rows), 'status': status})
        print(rid, len(rows), status)

data['coverage']['unreviewedPdfCandidates'] = sum(len(r.get('pdfCandidates', [])) for r in data['restaurants'])
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'output' / 'menu-pdf-extraction-ledger.json').write_text(json.dumps(ledger, indent=2) + '\n', encoding='utf-8')
