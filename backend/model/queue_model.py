import threading
import queue
import time
import json
from flask import Flask
from werkzeug.exceptions import HTTPException
from werkzeug.test import EnvironBuilder
from config.data.constant import QUEUE_HANDLER

QUEUE_PENDING = False
QUEUE_METHOD = None

class QueueModel:
    def __init__(self, app: Flask):
        self.app = app
        self.request_queue = queue.Queue()
        self.status_lock = threading.Lock()
        self.status_data = {
            "processing": None,
            "queue_size": 0,
            "total_requests_added": 0,
            "total_requests_processed": 0,
        }
        self.status_history = []

        self.worker_thread = threading.Thread(target=self.worker, daemon=True)
        self.worker_thread.start()

    def worker(self):
        while True:
            func, args, kwargs, done_event, result_container, info = self.request_queue.get()

            with self.status_lock:
                self.status_data["processing"] = {
                    "start_time": time.time(),
                    "info": info
                }
                self.status_data["queue_size"] = self.request_queue.qsize() + 1

            try:
                # pending setzen, wenn Pfad relevant
                is_pending = (
                    info.get("method") == "POST"
                    and any(info.get("path", "").startswith(p) for p in QUEUE_HANDLER)
                )
                QueueModel.set_pending(is_pending, info.get("method"))

                time.sleep(0.1)  # optionale Verzögerung

                with self.app.app_context():
                    content_type = info.get("content_type", "application/x-www-form-urlencoded")

                    if content_type.startswith("application/json"):
                        builder = EnvironBuilder(
                            path=info["path"],
                            method=info["method"],
                            data=json.dumps(kwargs),
                            content_type=content_type
                        )
                    else:
                        builder = EnvironBuilder(
                            path=info["path"],
                            method=info["method"],
                            data=kwargs,
                            content_type=content_type
                        )
                    env = builder.get_environ()

                    with self.app.request_context(env):
                        adapter = self.app.url_map.bind_to_environ(env)
                        endpoint, values = adapter.match()
                        view_func = self.app.view_functions.get(endpoint)

                        if not view_func:
                            result_container['response'] = ("Not Found", 404)
                        else:
                            response = view_func(**values)
                            result_container['response'] = response

            except HTTPException as http_exc:
                result_container['response'] = (http_exc.description, http_exc.code)
            except Exception as e:
                print(f"[Worker Exception]: {e}")
                result_container['response'] = ("Internal Server Error", 500)
            finally:
                with self.status_lock:
                    # Anfrage beendet → Verarbeitung zurücksetzen
                    self.status_data["processing"] = None
                    self.status_data["total_requests_processed"] += 1

                    # Queue Größe aktualisieren
                    if self.status_data["processing"] is not None:
                        self.status_data["queue_size"] = self.request_queue.qsize() + 1
                    else:
                        self.status_data["queue_size"] = self.request_queue.qsize()

                    # Prozent berechnen
                    total_added = self.status_data["total_requests_added"]
                    total_processed = self.status_data["total_requests_processed"]
                    percent = 0
                    if total_added > 0:
                        percent = int((total_processed / total_added) * 100)

                    # Status-Snapshot zur History hinzufügen
                    snapshot = {
                        "timestamp": time.time(),
                        "processing": None,  # Verarbeitung fertig, also None
                        "queue_size": self.status_data["queue_size"],
                        "percent": percent,
                        "info": info
                    }
                    self.status_history.append(snapshot)

                    # Neu: Wenn queue_size 0 ist und vorher Einträge in History waren, resetten
                    if self.status_data["queue_size"] == 0 and len(self.status_history) > 0:
                        self.status_history.clear()
                        # Optional: Zähler zurücksetzen, wenn sinnvoll
                        self.status_data["total_requests_added"] = 0
                        self.status_data["total_requests_processed"] = 0

                done_event.set()
                self.request_queue.task_done()
                QueueModel.set_pending(False, None)

    def add_request(self, func, args=None, kwargs=None, info=None):
        if args is None:
            args = ()
        if kwargs is None:
            kwargs = {}
        done_event = threading.Event()
        result_container = {}

        with self.status_lock:
            self.status_data["total_requests_added"] += 1

        self.request_queue.put((func, args, kwargs, done_event, result_container, info))
        return done_event, result_container

    def set_pending(pending, method=None):
        global QUEUE_PENDING
        global QUEUE_METHOD
        QUEUE_METHOD = method
        if pending != None:
            QUEUE_PENDING = pending

    def get_status(self):
        with self.status_lock:
            total_added = self.status_data["total_requests_added"]
            total_processed = self.status_data["total_requests_processed"]

            if self.status_data["processing"] is not None:
                queue_size = self.request_queue.qsize() + 1
            else:
                queue_size = self.request_queue.qsize()

            percent = 0
            if total_added > 0:
                percent = int((total_processed / total_added) * 100)

            # Kopie der History zurückgeben, damit sie nicht von außen verändert wird
            history_copy = list(self.status_history)

            pendingRef = QUEUE_PENDING
            method = QUEUE_METHOD

            print(QUEUE_METHOD, method)
            if method != "POST":
                QueueModel.set_pending(False, None)

            return {
                "processing": self.status_data["processing"],
                "queue_size": queue_size,
                "percent": percent,
                "history": history_copy,
                "pending": pendingRef
            }
