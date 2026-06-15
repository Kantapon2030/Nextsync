import os
import servicemanager
import win32event
import win32service
import win32serviceutil

from worker import Worker


class ShotSyncWorkerService(win32serviceutil.ServiceFramework):
    _svc_name_ = "ShotSyncGPUWorker"
    _svc_display_name_ = "ShotSync GPU Worker"
    _svc_description_ = "Processes Drive photos and InsightFace embeddings on the local GPU."

    def __init__(self, args):
        super().__init__(args)
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.worker = Worker()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.worker.running = False
        win32event.SetEvent(self.stop_event)

    def SvcDoRun(self):
        servicemanager.LogInfoMsg("ShotSync GPU Worker starting")
        self.worker.run()


if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(ShotSyncWorkerService)
