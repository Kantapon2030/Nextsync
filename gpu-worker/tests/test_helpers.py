import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from db import backoff_seconds
from face_engine import adaptive_batch_size, normalize


def test_normalize_unit_length():
    result = normalize([3.0, 4.0])
    assert np.isclose(np.linalg.norm(result), 1.0)


def test_backoff_is_bounded():
    assert backoff_seconds(1) == 15
    assert backoff_seconds(99) == 1800


def test_cuda_uses_larger_batch():
    assert adaptive_batch_size("CUDAExecutionProvider") > adaptive_batch_size("CPUExecutionProvider")
    assert adaptive_batch_size("CUDAExecutionProvider", 4096) == 4
