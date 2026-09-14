#!/usr/bin/env python3
"""Post-process report.docx footers for WPS/Word compatibility:
1. Patch footer PAGE fields with explicit format switches (ROMAN for front matter, arabic for body).
2. Remove empty <w:pgNumType/> elements (confuse WPS).
Identification: first section WITH a footerReference = front matter (ROMAN); later ones = body (arabic).
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/report.docx")
TMP = DOCX.with_suffix(".tmp.docx")

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

def main():
    with zipfile.ZipFile(DOCX, "r") as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    doc_xml = data["word/document.xml"].decode("utf-8")
    rels_xml = data["word/_rels/document.xml.rels"].decode("utf-8")

    # 1. Footer references in document order (default type only)
    footer_ref_ids = re.findall(
        r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', doc_xml)
    if not footer_ref_ids:
        footer_ref_ids = re.findall(
            r'<w:footerReference[^>]*r:id="([^"]+)"[^>]*w:type="default"', doc_xml)
    print(f"footerReference ids in document order: {footer_ref_ids}")

    # 2. Map rId -> footer file target
    rel_map = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))
    footer_files = []
    for rid in footer_ref_ids:
        target = rel_map.get(rid, "")
        target = target.lstrip("/")
        if not target.startswith("word/"):
            target = "word/" + target
        footer_files.append(target)
    print(f"footer files in order: {footer_files}")

    # 3. Patch: first footer -> ROMAN, remaining -> arabic
    def patch_footer(xml: str, fmt: str) -> str:
        def repl(m):
            return m.group(1) + f" PAGE \\* {fmt} \\* MERGEFORMAT " + m.group(2)
        return re.sub(
            r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
            repl, xml)

    if footer_files:
        first = footer_files[0]
        if first in data:
            data[first] = patch_footer(data[first].decode("utf-8"), "ROMAN").encode("utf-8")
            print(f"patched {first} -> ROMAN")
        for f in footer_files[1:]:
            if f in data:
                data[f] = patch_footer(data[f].decode("utf-8"), "arabic").encode("utf-8")
                print(f"patched {f} -> arabic")
    else:
        print("WARNING: no footer references found; nothing patched")

    # 4. Remove empty pgNumType (no attributes) from document.xml
    before = doc_xml.count("<w:pgNumType/>")
    doc_xml = doc_xml.replace("<w:pgNumType/>", "")
    print(f"removed {before} empty <w:pgNumType/> element(s)")
    data["word/document.xml"] = doc_xml.encode("utf-8")

    # 5. Rezip
    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    shutil.move(TMP, DOCX)
    print(f"OK: {DOCX} post-processed")

if __name__ == "__main__":
    main()
