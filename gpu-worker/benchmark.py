import argparse
import json
import time

from face_engine import FaceEngine


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+")
    args = parser.parse_args()
    engine = FaceEngine()
    started = time.perf_counter()
    for path in args.images:
        with open(path, "rb") as handle:
            engine.extract(handle.read())
    elapsed = time.perf_counter() - started
    rate = len(args.images) / max(elapsed, 0.001)
    projected_minutes = 1000 / rate / 60
    print(json.dumps({
        "images": len(args.images),
        "seconds": elapsed,
        "images_per_second": rate,
        "projected_1000_minutes": projected_minutes,
        "passes_60_minute_target": projected_minutes <= 60,
        "device": engine.device,
    }, indent=2))


if __name__ == "__main__":
    main()
