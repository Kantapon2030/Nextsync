import argparse
import json

import numpy as np


def main():
    parser = argparse.ArgumentParser(description="Choose the highest-recall threshold under a false-positive gate.")
    parser.add_argument("dataset", help="NPZ containing distances and same_person boolean arrays")
    parser.add_argument("--max-fpr", type=float, default=0.005)
    args = parser.parse_args()
    data = np.load(args.dataset)
    distances = data["distances"]
    same = data["same_person"].astype(bool)
    best = None
    for threshold in np.linspace(float(distances.min()), float(distances.max()), 2000):
        predicted = distances <= threshold
        fpr = float((predicted & ~same).sum() / max((~same).sum(), 1))
        recall = float((predicted & same).sum() / max(same.sum(), 1))
        if fpr <= args.max_fpr and (best is None or recall > best["recall"]):
            best = {"threshold": float(threshold), "false_positive_rate": fpr, "recall": recall}
    print(json.dumps(best, indent=2))


if __name__ == "__main__":
    main()
