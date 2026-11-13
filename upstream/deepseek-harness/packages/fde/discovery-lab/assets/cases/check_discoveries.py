"""Closed deterministic source checks. Standard-library only, no teacher/reference lookup.

stdin: {"case": <trusted case.json object>, "itemId": "...", "grantedAssetIds": ["..."]}
CLI: --case cases/finance/case.json --item ID --grants-json '["asset-id", ...]'

Only deterministicChecks.inputs are gated here. The caller separately checks all
item.requiredAssetIds and the committed assistant's evidence/semantic claims.
A successful source check alone must never award learner progress.
"""
from pathlib import Path
from decimal import Decimal, InvalidOperation
import argparse, base64, csv, hashlib, io, json, re, sys, zlib

ROOT = Path(__file__).resolve().parents[1]
OPERATIONS = {
    'finance_c002_invoice_and_missing_detail': 'finance.reviewer.c002',
    'finance_c003_unconfirmed_allocation': 'finance.manager.allocation',
    'finance_c007_queued_not_paid': 'finance.cashier.c007',
}
EXPECTED = {
    'finance_c002_invoice_and_missing_detail': {'invoice_id':'SIM-C002-3','quantity':2,'unit_price_yuan':380,'gross_yuan':760,'missingAttachmentType':'住宿明细'},
    'finance_c003_unconfirmed_allocation': {'claim_id':'C003','filledProject':'P101','allocationConfirmed':False},
    'finance_c007_queued_not_paid': {'claim_id':'C007','paid_yuan':0,'hasSuccessfulBankReceipt':False},
}
INPUTS = {
    'finance_c002_invoice_and_missing_detail': ['finance-invoices','finance-attachments'],
    'finance_c003_unconfirmed_allocation': ['finance-c003'],
    'finance_c007_queued_not_paid': ['finance-cashier-current','finance-cashier-events'],
}

class Rejected(ValueError):
    pass

def require(condition, message):
    if not condition:
        raise Rejected(message)

def decimal(value):
    number = Decimal(str(value))
    require(number.is_finite(), 'Non-finite source number')
    return number

def single(rows, column, value):
    matches = [r for r in rows if r.get(column) == value]
    require(len(matches) == 1, 'Source must contain exactly one matching business row')
    return matches[0]

def csv_rows(data):
    reader = csv.DictReader(io.StringIO(data.decode('utf-8-sig')))
    require(reader.fieldnames and len(reader.fieldnames)==len(set(reader.fieldnames)), 'Invalid CSV header')
    rows = list(reader)
    require(all(None not in r for r in rows), 'CSV row width mismatch')
    return rows

def pdf_literal(encoded):
    """Unescape one PDF literal string, including octal and line continuations."""
    out=bytearray();i=0
    escapes={ord('n'):10,ord('r'):13,ord('t'):9,ord('b'):8,ord('f'):12}
    while i<len(encoded):
        char=encoded[i];i+=1
        if char!=92:
            out.append(char);continue
        require(i<len(encoded), 'Invalid PDF string escape')
        char=encoded[i];i+=1
        if 48<=char<=55:
            digits=bytes([char])
            while i<len(encoded) and len(digits)<3 and 48<=encoded[i]<=55:
                digits+=bytes([encoded[i]]);i+=1
            out.append(int(digits,8))
        elif char in (10,13):
            if char==13 and i<len(encoded) and encoded[i]==10:i+=1
        else:
            out.append(escapes.get(char,char))
    return bytes(out)

def reportlab_ucs2_pages(data):
    """Narrow parser for this version-verified case original, not arbitrary PDFs.
    Only page-referenced content streams and STSong-Light /UniGB-UCS2-H text are
    supported. Unknown encodings, encryption or changed format fail closed.
    """
    require(data.startswith(b'%PDF-1.') and b'ReportLab Generated PDF' in data, 'Unsupported case PDF format')
    require(b'/Encrypt' not in data and b'/UniGB-UCS2-H' in data and b'/STSong-Light' in data, 'Unsupported case PDF font/encoding')
    objects={int(m.group(1)):m.group(2) for m in re.finditer(rb'(\d+)\s+0\s+obj\s*(.*?)\s*endobj',data,re.S)}
    font_names=set()
    for body in objects.values():
        if b'/UniGB-UCS2-H' in body and b'/Type /Font' in body:
            name=re.search(rb'/Name\s+/(F\d+)\b',body)
            require(name is not None,'Missing supported font name');font_names.add(name.group(1))
    pages=[]
    for body in objects.values():
        if not re.search(rb'/Type\s*/Page\b',body):continue
        content=re.search(rb'/Contents\s+(\d+)\s+0\s+R',body)
        require(content is not None,'Unsupported PDF page contents')
        obj=objects.get(int(content.group(1)),b'')
        require(b'stream' in obj and b'endstream' in obj,'Missing PDF content stream')
        header,stream=obj.split(b'stream',1);stream=stream.split(b'endstream',1)[0].strip()
        require(b'/ASCII85Decode' in header and b'/FlateDecode' in header,'Unsupported content stream filter')
        packed=base64.a85decode(stream,adobe=True)
        inflater=zlib.decompressobj();unpacked=inflater.decompress(packed,2_000_000)
        require(inflater.eof and not inflater.unconsumed_tail and not inflater.unused_data,'Invalid/oversized PDF stream')
        font=None;strings=[]
        tokens=re.finditer(rb'/(F\d+)\s+[\d.]+\s+Tf|\(((?:\\.|[^\\)])*)\)\s*Tj',unpacked,re.S)
        for token in tokens:
            if token.group(1):font=token.group(1);continue
            if font not in font_names:continue
            raw=pdf_literal(token.group(2))
            require(len(raw)%2==0,'Invalid UCS2 content string')
            strings.append(raw.decode('utf-16-be',errors='strict'))
        require(strings,'No readable page text');pages.append('\n'.join(strings))
    require(len(pages)==8,'Unexpected C003 original page count')
    return pages

def check_discovery(case, item_id, granted_asset_ids):
    """Return a JSON-safe decision; all rejection cases fail closed."""
    try:
        require(isinstance(case,dict) and case.get('schemaVersion')==1 and case.get('id')=='finance','Unsupported case')
        require(isinstance(item_id,str),'Invalid itemId')
        require(isinstance(granted_asset_ids,list) and all(isinstance(x,str) for x in granted_asset_ids),'Invalid grant list')
        items=[x for x in case.get('discoveries',[]) if x.get('id')==item_id]
        require(len(items)==1,'Unknown or duplicate itemId');item=items[0]
        checks=item.get('deterministicChecks')
        require(isinstance(checks,list) and len(checks)==1,'Expected exactly one supported deterministic check')
        check=checks[0];op=check.get('operation')
        require(op in OPERATIONS and OPERATIONS[op]==item_id,'Unsupported check operation/item mapping')
        require(check.get('inputs')==INPUTS[op],'Unexpected deterministic input set')
        require(check.get('expected')==EXPECTED[op],'Unexpected expected assertions')
        grants=set(granted_asset_ids);missing=set(INPUTS[op])-grants
        require(not missing,'Required deterministic inputs have not been obtained')
        assets=case.get('assets',[]);loaded={}
        # Validate all grants/metadata before opening any source bytes.
        paths=[]
        for aid in INPUTS[op]:
            found=[a for a in assets if a.get('id')==aid]
            require(len(found)==1,'Unknown or duplicate input asset');a=found[0]
            require(item.get('roleId') in a.get('roleIds',[]),'Input outside investigation role permission')
            rel=a.get('path');require(isinstance(rel,str) and not Path(rel).is_absolute(),'Invalid source path')
            require(not any(k in rel for k in ['教师','后续事件','研发依据']),'Privileged source excluded')
            path=(ROOT/rel).resolve();require(path.is_relative_to((ROOT/'source-materials/finance').resolve()),'Source path outside case root')
            require(path.is_file(),'Input source unavailable')
            require(path.stat().st_size<=20_000_000,'Input source too large')
            paths.append((aid,a,path))
        for aid,a,path in paths:
            data=path.read_bytes()
            require(hashlib.sha256(data).hexdigest()==a.get('sha256'),'Input source checksum mismatch')
            require(len(data)==a.get('sizeBytes'),'Input source size mismatch')
            loaded[aid]=data
        if op=='finance_c002_invoice_and_missing_detail':
            invoice=single(csv_rows(loaded['finance-invoices']),'invoice_id','SIM-C002-3')
            require(invoice.get('uploaded_for_claim')=='C002' and invoice.get('kind')=='住宿费','C002 invoice identity/type mismatch')
            for key in ['quantity','unit_price_yuan','gross_yuan']:
                require(decimal(invoice[key])==decimal(EXPECTED[op][key]),'C002 invoice amount/quantity mismatch')
            attachments=csv_rows(loaded['finance-attachments'])
            require(any(r.get('claim_id')=='C002' for r in attachments),'C002 absent from complete attachment register')
            require(not any(r.get('claim_id')=='C002' and r.get('type')=='住宿明细' for r in attachments),'C002 detail is no longer missing')
        elif op=='finance_c003_unconfirmed_allocation':
            pages=reportlab_ucs2_pages(loaded['finance-c003'])
            claim_pages=[p for p in pages if '员工费用报销单' in p]
            require(len(claim_pages)==1,'C003 claim page not uniquely identified')
            require('C003' in claim_pages[0] and '填报项目\nP101\n' in claim_pages[0], 'C003 filled project differs')
            event_pages=[p for p in pages if '原系统事件摘录' in p]
            require(len(event_pages)==1,'C003 event page not uniquely identified')
            require('PENDING_PROJECT' in event_pages[0] and '现场任务成立；P101与P102分摊尚未明确' in event_pages[0], 'C003 missing explicit unconfirmed allocation source')
            require(not any(state in event_pages[0] for state in ['PROJECT_CONFIRMED','FINANCE_PASSED','APPROVED','PAID']), 'C003 has later approval/payment state')
        else:
            row=single(csv_rows(loaded['finance-cashier-current']),'claim_id','C007')
            require(row.get('state')=='PAYMENT_QUEUED' and decimal(row['paid_yuan'])==0 and bool(row.get('approved_yuan')),'C007 is not approved/queued/unpaid')
            events=[r for r in csv_rows(loaded['finance-cashier-events']) if r.get('claim_id')=='C007']
            require(events and any(r.get('state')=='APPROVED' for r in events) and any(r.get('state')=='PAYMENT_QUEUED' for r in events),'C007 lacks approval/queue source events')
            require(not any(r.get('state')=='PAID' for r in events),'C007 has successful payment evidence')
            require(max(events,key=lambda r:r['at'])['state']=='PAYMENT_QUEUED','C007 latest state is not queued')
        return {'passed':True,'assertions':EXPECTED[op].copy(),'evidenceAssetIds':INPUTS[op].copy()}
    except (Rejected,KeyError,TypeError,AttributeError,ValueError,OSError,UnicodeError,InvalidOperation,zlib.error) as exc:
        return {'passed':False,'assertions':{},'evidenceAssetIds':[],'error':str(exc)}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case',dest='case_path')
    parser.add_argument('--item')
    parser.add_argument('--grants-json')
    args=parser.parse_args()
    try:
        if args.case_path:
            require(args.item is not None and args.grants_json is not None,'--case requires --item and --grants-json')
            case=json.loads(Path(args.case_path).read_text('utf-8'))
            item_id=args.item;grants=json.loads(args.grants_json)
        else:
            require(args.item is None and args.grants_json is None,'Use complete CLI mode or stdin mode')
            payload=json.load(sys.stdin);case=payload['case'];item_id=payload['itemId'];grants=payload['grantedAssetIds']
        result=check_discovery(case,item_id,grants)
    except (Rejected,KeyError,ValueError,OSError,TypeError) as exc:
        result={'passed':False,'assertions':{},'evidenceAssetIds':[],'error':str(exc)}
    print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    # Business decisions use passed; process failure is reserved for an interpreter crash.
    return 0

if __name__=='__main__':
    raise SystemExit(main())
