# ShotSync Windows GPU Worker

The worker is the primary processing plane. Vercel remains the dashboard and recovery control plane.

1. Install NVIDIA driver and CUDA-compatible ONNX Runtime dependencies.
2. Copy the application environment variables into `gpu-worker/.env`.
3. Run `powershell -ExecutionPolicy Bypass -File .\gpu-worker\install-service.ps1` as Administrator.
4. Confirm the worker heartbeat and throughput in Admin > System Health.

Tasks are claimed transactionally with `FOR UPDATE SKIP LOCKED`. Expired leases are reclaimable, R2 keys are deterministic, and face rows are replaced in one transaction.
