from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUTPUT = ROOT / "merge-towers-poki.zip"
EXCLUDED_SUFFIXES = {".map", ".md"}

if not (DIST / "index.html").is_file():
    raise SystemExit("dist/index.html is missing; run npm run build first")

with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(DIST.rglob("*")):
        if path.is_file() and path.suffix.lower() not in EXCLUDED_SUFFIXES:
            archive.write(path, path.relative_to(DIST).as_posix())

with ZipFile(OUTPUT) as archive:
    bad_file = archive.testzip()
    names = archive.namelist()

if bad_file:
    raise SystemExit(f"ZIP integrity check failed: {bad_file}")
if "index.html" not in names:
    raise SystemExit("ZIP must contain index.html at its root")

print(f"Created {OUTPUT.name}: {OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB, {len(names)} files")
