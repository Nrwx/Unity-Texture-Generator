# model/task_model.py
import uuid
import copy
from typing import Any, Dict, List, Optional, Tuple

from model.base.main import BaseModel
from config.data.constant import TASKS
from utils import time

DEFAULT_TASKS = ["storage", "measure"]

TASKS_META: Dict[str, Any] = {
    "active_task_count": 0,
    "pending_tasks": 0,
    "running_tasks_count": 0,
    "running_task_ids": [],
    "completed_tasks": 0,
    "failed_tasks": 0,
    "logs": [],
    "total_tasks": 0,
    "default_tasks": 0,
    "custom_tasks": 0,
    "tasks_with_custom_chain": 0,
    "tasks_progress_avg": 0.0,
    "tasks_last_updated": None
}


class TaskModel(BaseModel):

    @staticmethod
    def _task_manager():
        return syslink.get("task_manager")

    # -----------------------
    # Initialize
    # -----------------------
    @classmethod
    def initialize(cls) -> List[Dict[str, Any]]:
        now = time("unix_ms")
        TASKS.clear()
        for module_name in DEFAULT_TASKS:
            entry = {
                "id": str(uuid.uuid4()),
                "type": "module",
                "active": True,
                "state": "pending",
                "progress": 0,
                "time_val": None,
                "default": True,
                "module": module_name,
                "custom": None,
                "customId": None,
                "created": now,
                "updated": now,
            }
            TASKS.append(entry)
        cls.fetchMeta()
        return TASKS

    # -----------------------
    # Fetch detailed meta
    # -----------------------
    @classmethod
    def fetchMeta(cls) -> Dict[str, Any]:
        active = pending = completed = failed = default_tasks = custom_tasks = tasks_with_chain = running = 0
        total_progress = 0
        last_updated = 0
        running_ids: List[str] = []
        logs = []

        for task in TASKS:
            state = task.get("state", "pending")
            progress = task.get("progress", 0)
            total_progress += progress
            last_updated = max(last_updated, task.get("updated", 0))

            if task.get("active", False):
                active += 1
            if state == "pending":
                pending += 1
            elif state == "complete":
                completed += 1
            elif state == "failed":
                failed += 1
            elif state == "running":
                running += 1
                running_ids.append(task.get("id"))

            if task.get("default", False):
                default_tasks += 1
            else:
                custom_tasks += 1
                if task.get("custom"):
                    tasks_with_chain += 1

            logs.append({
                "id": task.get("id"),
                "module": task.get("module"),
                "state": state,
                "type": task.get("type"),
                "active": task.get("active"),
                "default": task.get("default"),
                "progress": progress,
                "custom_chain_length": len(task.get("custom") or []),
                "created": task.get("created"),
                "updated": task.get("updated"),
                "running": state == "running"
            })

        total_tasks = len(TASKS)
        avg_progress = total_progress / total_tasks if total_tasks else 0.0

        TASKS_META.update({
            "active_task_count": active,
            "pending_tasks": pending,
            "running_tasks_count": running,
            "running_task_ids": running_ids,
            "completed_tasks": completed,
            "failed_tasks": failed,
            "logs": logs,
            "total_tasks": total_tasks,
            "default_tasks": default_tasks,
            "custom_tasks": custom_tasks,
            "tasks_with_custom_chain": tasks_with_chain,
            "tasks_progress_avg": avg_progress,
            "tasks_last_updated": last_updated
        })
        return TASKS_META, 200

    # -----------------------
    # Fetch / Create / Update / Delete
    # -----------------------
    @classmethod
    def fetch(cls, id: Optional[str] = None):
        try:
            if id:
                task = next((t for t in TASKS if t["id"] == id), None)
                if not task:
                    return {"error": "Task not found"}, 404
                return copy.deepcopy(task), 200
            return copy.deepcopy(TASKS), 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def create(cls, type: str = "custom", active: bool = True, state: str = "pending",
               time_val: Optional[int] = None, module: Optional[str] = None,
               custom: Optional[List[Any]] = None) -> Tuple[Dict[str, Any], int]:
        try:
            task_id = str(uuid.uuid4())
            entry = {
                "id": task_id,
                "type": type or "custom",
                "active": bool(active),
                "state": state or "pending",
                "progress": 0,
                "time_val": time_val,
                "default": False,
                "module": module,
                "custom": cls._prepare_custom_chain(custom, {"time_val": time_val}) if custom else ([] if module is None else cls._prepare_custom_chain([{"module": module}], {"time_val": time_val})),
                "customId": None,
                "created": time("unix_ms"),
                "updated": time("unix_ms"),
            }
            TASKS.append(entry)
            cls.fetchMeta()
            return entry, 201
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def update(cls, id: str, **kwargs):
        try:
            task = next((t for t in TASKS if t["id"] == id), None)
            if not task:
                return {"error": "Task not found"}, 404

            if task.get("default", False) and ("default" in kwargs and not kwargs.get("default")):
                kwargs.pop("default", None)

            if "custom" in kwargs:
                task["custom"] = cls._prepare_custom_chain(kwargs.pop("custom"), task)

            allowed = {"type", "active", "state", "time_val", "module", "customId", "progress"}
            for k, v in kwargs.items():
                if k in allowed:
                    task[k] = v

            task["updated"] = time("unix_ms")
            cls.fetchMeta()
            return task, 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def delete(cls, id: str):
        try:
            idx = next((i for i, t in enumerate(TASKS) if t["id"] == id), None)
            if idx is None:
                return {"error": "Task not found"}, 404

            task = TASKS[idx]
            if task.get("default", False):
                task["active"] = False
                task["updated"] = time("unix_ms")
            else:
                TASKS.pop(idx)

            cls.fetchMeta()
            return {"message": "Task deleted or set inactive"}, 200
        except Exception as e:
            return cls.handle_error(e)

    # -----------------------
    # Run / Schedule / Stop convenience
    # -----------------------
    @classmethod
    def run(cls, id: str):
        try:
            task = next((t for t in TASKS if t["id"] == id), None)
            if not task:
                return {"error": "Task not found"}, 404
            return cls._run_task(task)
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def schedule(cls, id: str, delay: Optional[int] = None):
        try:
            task = next((t for t in TASKS if t["id"] == id), None)
            if not task:
                return {"error": "Task not found"}, 404
            if delay is not None:
                task["time_val"] = delay
                task["updated"] = time("unix_ms")
            return cls._schedule_task(task)
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def stop(cls, id: str):
        task = None
        try:
            task = next((t for t in TASKS if t["id"] == id), None)
            if not task:
                return {"error": "Task not found"}, 404

            tm = cls._task_manager()
            if tm is None:
                return {"error": "TaskManager not available"}, 500

            terminated_any = False
            if task.get("default", False):
                module_name = task.get("module")
                if module_name:
                    try:
                        res = tm.terminate_task(module_name)
                        terminated_any = bool(res)
                    except Exception:
                        terminated_any = terminated_any or False
            else:
                chain = cls._ordered_custom_chain(task)
                for step in chain:
                    module_name = step.get("module")
                    if not module_name:
                        continue
                    try:
                        res = tm.terminate_task(module_name)
                        terminated_any = terminated_any or bool(res)
                    except Exception:
                        continue

            if terminated_any:
                task["state"] = "failed"
                task["updated"] = time("unix_ms")
                cls.fetchMeta()
                return {"message": "Task termination attempted and at least one module terminated."}, 200
            else:
                task["updated"] = time("unix_ms")
                cls.fetchMeta()
                return {"message": "No running modules were terminated.", "terminated": False}, 200

        except Exception as e:
            try:
                if task:
                    task["state"] = "failed"
                    task["updated"] = time("unix_ms")
            except Exception:
                pass
            return cls.handle_error(e)

    # -----------------------
    # Run / Schedule helpers
    # -----------------------
    @classmethod
    def _run_task(cls, entry: Dict[str, Any]):
        try:
            tm = cls._task_manager()
            if tm is None:
                return {"error": "TaskManager not available"}, 500

            entry["state"] = "running"
            entry["progress"] = 0
            entry["updated"] = time("unix_ms")

            if entry.get("default", False):
                module_name = entry.get("module")
                if not module_name:
                    return {"error": "Default task has no module configured"}, 400
                tm.run_task(module_name)
            else:
                for step in cls._ordered_custom_chain(entry):
                    if step.get("module"):
                        tm.run_task(step["module"])

            entry["state"] = "complete"
            entry["progress"] = 100
            entry["updated"] = time("unix_ms")
            cls.fetchMeta()
            return {"message": "started"}, 200
        except Exception as e:
            try:
                entry["state"] = "failed"
                entry["updated"] = time("unix_ms")
                cls.fetchMeta()
            except Exception:
                pass
            return cls.handle_error(e)

    @classmethod
    def _schedule_task(cls, entry: Dict[str, Any]):
        try:
            tm = cls._task_manager()
            if tm is None:
                return {"error": "TaskManager not available"}, 500

            delay = int(entry["time_val"]) if isinstance(entry.get("time_val"), (int)) else 0

            module_name = entry.get("module") if entry.get("default", False) else (
                cls._ordered_custom_chain(entry)[0]["module"] if cls._ordered_custom_chain(entry) else entry.get("module")
            )

            if not module_name:
                return {"error": "No module to schedule"}, 400

            tm.schedule_task(module_name, delay)
            entry["state"] = "pending"
            entry["updated"] = time("unix_ms")
            cls.fetchMeta()
            return {"message": "scheduled"}, 200
        except Exception as e:
            return cls.handle_error(e)

    # -----------------------
    # Helpers: prepare / normalize chains
    # -----------------------
    @staticmethod
    def _prepare_custom_chain(custom_list: List[Any], entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for i, c in enumerate(custom_list):
            if isinstance(c, str):
                out.append({"module": c, "order": i, "time_val": entry.get("time_val")})
            elif isinstance(c, dict):
                mod = c.get("module")
                if not mod:
                    continue
                out.append({
                    "module": mod,
                    "order": c.get("order", i),
                    "time_val": c.get("time_val", entry.get("time_val"))
                })
        out_sorted = sorted(out, key=lambda x: (x.get("order", 9999), x.get("time_val") or 0))
        for idx, v in enumerate(out_sorted):
            v["order"] = idx
        return out_sorted

    @staticmethod
    def _ordered_custom_chain(entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        chain = entry.get("custom") or []
        normalized = []
        for i, c in enumerate(chain):
            if isinstance(c, str):
                normalized.append({"module": c, "order": i, "time_val": entry.get("time_val")})
            elif isinstance(c, dict):
                normalized.append({
                    "module": c.get("module"),
                    "order": c.get("order", i),
                    "time_val": c.get("time_val", entry.get("time_val"))
                })
        return sorted(normalized, key=lambda x: (x.get("order", 9999), x.get("time_val") or 0))
