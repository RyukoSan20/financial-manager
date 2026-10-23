"""
Background scan jobs.

Scanning a receipt takes a while: the image is restored, several OCR
variants are tried, and the result is structured. Doing that inside the
HTTP request means the user stares at a spinner and, on a slow phone
connection, the request times out.

This module runs the scan in a background thread and exposes it as a job
the client can poll. The flow is:

    POST /api/parser/scan-jobs   -> { job_id, status: "queued" }
    GET  /api/parser/scan-jobs/{id} -> { status, progress, result }

The job store is in-process. That is deliberate: a scan is a short-lived
operation owned by one user, and adding Redis or Celery for it would add a
whole extra service to the stack for no benefit. The trade-off is that
jobs do not survive a backend restart, which is acceptable because the
client re-submits.

For the same reason there is a bounded worker pool: a flood of scans must
not be able to spawn an unbounded number of threads.
"""

import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# Job lifecycle
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"


@dataclass
class ScanJob:
    """The state of one background scan."""

    id: str
    user_id: int
    kind: str  # "receipt" | "qr"
    status: str = STATUS_QUEUED
    progress: int = 0
    message: str = "Menunggu antrean..."
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # The uploaded file, kept so the worker can pick it up.
    payload: Optional[Dict[str, Any]] = field(default=None, repr=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ScanJobManager:
    """
    A small, bounded background worker pool for scan jobs.

    Jobs are kept in memory for a bounded time after they finish, so a
    client that polls a moment too late still gets the result instead of a
    "not found".
    """

    def __init__(self, max_workers: int = 3, retention_seconds: int = 1800):
        self._jobs: Dict[str, ScanJob] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="scan-worker"
        )
        self._retention_seconds = retention_seconds

    def create(
        self,
        user_id: int,
        kind: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> ScanJob:
        job = ScanJob(id=uuid.uuid4().hex, user_id=user_id, kind=kind, payload=payload)
        with self._lock:
            self._prune_locked()
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str, user_id: Optional[int] = None) -> Optional[ScanJob]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if user_id is not None and job.user_id != user_id:
                # A job belongs to the user who created it. Returning None
                # rather than the job keeps other users' scans invisible.
                return None
            return job

    def list_for_user(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        The jobs of one user, as plain dicts.

        Used by the client on mount so a scan that finished while the user
        was on another screen is not lost.
        """
        with self._lock:
            return [
                job.to_dict()
                for job in self._jobs.values()
                if user_id is None or job.user_id == user_id
            ]

    def update(
        self,
        job_id: str,
        *,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
            job.updated_at = datetime.now(timezone.utc)

    def submit(
        self,
        job: ScanJob,
        worker: Callable[[ScanJob], Dict[str, Any]],
    ) -> None:
        """Run `worker` in the background, updating the job as it goes."""
        self._executor.submit(self._run, job.id, worker)

    def _run(self, job_id: str, worker: Callable[[ScanJob], Dict[str, Any]]) -> None:
        self.update(job_id, status=STATUS_RUNNING, progress=10, message="Memproses gambar...")
        try:
            with self._lock:
                job = self._jobs.get(job_id)
            if job is None:
                return
            result = worker(job)
            self.update(
                job_id,
                status=STATUS_COMPLETED,
                progress=100,
                message="Selesai",
                result=result,
            )
        except Exception as exc:  # noqa: BLE001 - a failing job must not kill the worker
            logger.exception(f"Scan job {job_id} failed")
            self.update(
                job_id,
                status=STATUS_FAILED,
                progress=100,
                message="Gagal memproses",
                error=str(exc),
            )

    def _prune_locked(self) -> None:
        """Drop jobs that finished long ago. Called with the lock held."""
        cutoff = datetime.now(timezone.utc).timestamp() - self._retention_seconds
        stale = [
            job_id
            for job_id, job in self._jobs.items()
            if job.status in (STATUS_COMPLETED, STATUS_FAILED)
            and job.updated_at.timestamp() < cutoff
        ]
        for job_id in stale:
            self._jobs.pop(job_id, None)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)


# The application-wide manager.
scan_jobs = ScanJobManager()


def get_scan_manager() -> ScanJobManager:
    return scan_jobs
