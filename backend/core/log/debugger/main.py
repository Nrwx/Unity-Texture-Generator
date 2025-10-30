import functools
import inspect
import threading
import time
from typing import Any, Callable, Union, Optional
import json
from datetime import datetime
import traceback

class Debugger:
    """Debugger dokumentiert Funktionen/Klassen/Objekte inkl. Tests und Performance. Logger optional."""
    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls, log: Optional[Any] = None):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, log: Optional[Any] = None):
        if self._initialized:
            return
        self.log = log
        self._lock = threading.RLock()
        self._doc_data = {}
        self._watch_threads = {}
        self._watch_active = {}
        self._initialized = True

    # -----------------------
    # Dokumentation Helper
    # -----------------------
    def _update_doc(self, target: Any, result: Any = None, test_results: Optional[list] = None):
        with self._lock:
            name = getattr(target, "__qualname__", getattr(target, "__name__", str(target)))
            docstring = getattr(target, "__doc__", None)
            entry = self._doc_data.get(name, {})
            entry.update({
                "name": name,
                "type": type(target).__name__,
                "docstring": docstring,
                "params": {},
                "return_type": type(result).__name__ if result is not None else None,
                "last_tested": datetime.utcnow().isoformat(),
                "tests": test_results or []
            })
            if callable(target):
                try:
                    sig = inspect.signature(target)
                    entry["params"] = {k:str(v.default) for k,v in sig.parameters.items()}
                except Exception:
                    entry["params"] = "Unable to retrieve"
            self._doc_data[name] = entry

    # -----------------------
    # Logging Decorator
    # -----------------------
    def _wrap(self, func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            test_results = []
            if self.log:
                self.log.log(func.__qualname__, params={"args": args, "kwargs": kwargs})
            # Syntax/Signature Test
            try:
                sig = inspect.signature(func)
                test_results.append({
                    "test_type": "syntax_check",
                    "args": args,
                    "kwargs": kwargs,
                    "result": "success",
                    "return_value": None,
                    "duration_sec": 0,
                    "exception": None
                })
            except Exception as e:
                test_results.append({
                    "test_type": "syntax_check",
                    "args": args,
                    "kwargs": kwargs,
                    "result": "failure",
                    "return_value": None,
                    "duration_sec": 0,
                    "exception": str(e)
                })
            # Execution + Performance Test
            start = time.perf_counter()
            ret = None
            exc = None
            try:
                ret = func(*args, **kwargs)
                result_status = "success"
            except Exception as e:
                exc = str(e)
                result_status = "exception"
            duration = time.perf_counter() - start
            test_results.append({
                "test_type": "execution",
                "args": args,
                "kwargs": kwargs,
                "result": result_status,
                "return_value": ret,
                "duration_sec": duration,
                "exception": exc
            })
            # Simulierter Overflow/Stress Test
            overflow_ret, overflow_dur, overflow_exc = self._performance_test(func, args, kwargs, iterations=50)
            test_results.append({
                "test_type": "performance_overflow",
                "args": args,
                "kwargs": kwargs,
                "result": "exception" if overflow_exc else "success",
                "return_value": overflow_ret,
                "duration_sec": overflow_dur,
                "exception": str(overflow_exc) if overflow_exc else None
            })
            # Update Dokumentation
            self._update_doc(func, ret, test_results)
            # Log Return und Exception
            if self.log:
                if exc:
                    self.log.log(func.__qualname__, exception=exc)
                else:
                    self.log.log(func.__qualname__, return_value=ret)
            return ret
        return wrapper

    # -----------------------
    # Performance / Overflow Simulation
    # -----------------------
    def _performance_test(self, func, args, kwargs, iterations=100):
        start = time.perf_counter()
        result = None
        exc = None
        try:
            for _ in range(iterations):
                result = func(*args, **kwargs)
        except Exception as e:
            exc = e
        duration = time.perf_counter() - start
        return result, duration, exc

    # -----------------------
    # Test
    # -----------------------
    def test(self, target: Union[type, Callable], *args, **kwargs):
        if isinstance(target, type):
            instance = target(*args, **kwargs)
            self._recursive_watch(instance)
            return instance
        elif callable(target):
            return self._wrap(target)(*args, **kwargs)
        else:
            raise TypeError("test() erwartet Callable oder Klasse")

    # -----------------------
    # Watch
    # -----------------------
    def _recursive_watch(self, obj, visited=None):
        if visited is None:
            visited = set()
        obj_id = id(obj)
        if obj_id in visited:
            return
        visited.add(obj_id)
        for attr_name in dir(obj):
            if attr_name.startswith("_"):
                continue
            attr = getattr(obj, attr_name)
            if callable(attr):
                setattr(obj, attr_name, self._wrap(attr))
            elif inspect.isclass(attr) or hasattr(attr, "__dict__"):
                self._recursive_watch(attr, visited)

    def watch(self, obj, identifier: Optional[str] = None, interval: float = 1.0):
        key = identifier or str(id(obj))
        if key in self._watch_threads:
            return
        self._watch_active[key] = True
        def loop():
            while self._watch_active.get(key, False):
                self.test(obj)
                threading.Event().wait(interval)
        thread = threading.Thread(target=loop, daemon=True)
        self._watch_threads[key] = thread
        thread.start()

    def stop_watch(self, identifier: str):
        self._watch_active[identifier] = False
        self._watch_threads.pop(identifier, None)

    # -----------------------
    # Export Dokumentation
    # -----------------------
    def export(self, path: Optional[str]=None, file_format: str="json"):
        fmt = file_format.lower()
        path = path or f"debugger_doc.{fmt}"
        with self._lock:
            if fmt == "json":
                with open(path,"w",encoding="utf-8") as f:
                    json.dump(self._doc_data,f,indent=4,default=str)
            elif fmt=="txt":
                with open(path,"w",encoding="utf-8") as f:
                    for k,v in self._doc_data.items():
                        f.write(f"Name: {v['name']}\nType: {v['type']}\nDocstring: {v['docstring']}\nParams: {v['params']}\nReturn: {v['return_type']}\nLast Tested: {v['last_tested']}\nTests:\n")
                        for t in v.get("tests", []):
                            f.write(f"  - {t}\n")
                        f.write(f"{'-'*60}\n")
