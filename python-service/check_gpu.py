import tensorflow as tf
import sys

print("==================================================")
print("Python Executable:", sys.executable)
print("TensorFlow Version:", tf.__version__)
print("--------------------------------------------------")

gpus = tf.config.list_physical_devices('GPU')
if gpus:
    print(f"✅ Found {len(gpus)} GPU(s):")
    for gpu in gpus:
        print(f"   - Name: {gpu.name}, Type: {gpu.device_type}")
    print("🎉 TensorFlow can use your RTX 3050!")
else:
    print("❌ No GPU detected by TensorFlow.")
    print("   TensorFlow will run on CPU.")
    print("   Reason: You are likely using tensorflow-cpu or missing CUDA/cuDNN on Windows.")
print("==================================================")
