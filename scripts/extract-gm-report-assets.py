"""Extract the supplied PDF artwork without carrying any example report values.

Usage: python extract-gm-report-assets.py --availability source.pdf --competitor source.pdf --out public/gm-reports
Requires pypdf and pdftoppm. This is document-resource extraction, not a runtime dependency.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--availability", type=Path, required=True)
    parser.add_argument("--competitor", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--renderer", default="pdftoppm")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    availability, competitor = PdfReader(args.availability), PdfReader(args.competitor)
    for index, name in [(0, "cover"), (1, "summary")]:
        writer = PdfWriter()
        writer.add_page(availability.pages[index])
        page = writer.pages[0]
        content = ContentStream(page.get_contents(), writer)
        operations, in_text = [], False
        for operands, operator in content.operations:
            if operator == b"BT":
                in_text = True
            elif operator == b"ET":
                in_text = False
            elif not in_text:
                operations.append((operands, operator))
        content.operations = operations
        page.replace_contents(content)
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "artwork.pdf"
            writer.write(pdf)
            if PdfReader(pdf).pages[0].extract_text().strip():
                raise RuntimeError("Example text remains in the artwork")
            prefix = Path(directory) / "artwork"
            subprocess.run([args.renderer, "-singlefile", "-scale-to", "2400", "-png", str(pdf), str(prefix)], check=True)
            (args.out / f"{name}.png").write_bytes(prefix.with_suffix(".png").read_bytes())
    for page, image_name, name in [
        (availability.pages[2], "Image37.jpg", "availability-watermark.jpg"),
        (availability.pages[2], "Image17.png", "logo.png"),
        (availability.pages[3], "Image49.png", "availability-legend.png"),
        (competitor.pages[2], "Image41.png", "competitor-corner.png"),
    ]:
        image = next(image for image in page.images if image.name == image_name)
        (args.out / name).write_bytes(image.data)
    manifest = {"sourceSha256": {"availability": hashlib.sha256(args.availability.read_bytes()).hexdigest(), "competitor": hashlib.sha256(args.competitor.read_bytes()).hexdigest()},
        "canvasPoints": [960, 540], "fonts": ["Calibri", "Arial"], "artworkOnly": True}
    (args.out / "source.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
