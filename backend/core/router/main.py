from __future__ import annotations
import importlib
import inspect
import traceback
from typing import Any, Mapping, Optional, Dict


class Router:
    def __init__(self, app=None, parser=None, config: Optional[Mapping[str, Any]] = None, api: Any = None):
        self.app = app
        self.parser = parser
        self.config = config or {}
        self.api = api
        self.blueprints: Dict[str, Dict[str, Any]] = {}

    def log(self, msg: str, src: str = "ROUTER", lvl: str = "INFO", icon: str = "🧩"):
        print(f"[{src}] {icon} {lvl}: {msg}")

    def _import_try(self, module_name: Optional[str]):
        """
        Import helper, gibt modul oder None zurück. Fehler werden nur geloggt.
        (Hier wird nicht automatisch 'generated.' angehängt — caller erstellt gen_* Strings.)
        """
        if not module_name:
            return None
        try:
            return importlib.import_module(module_name)
        except Exception as e:
            self.log(f"Import failed for module '{module_name}': {e}", "ROUTER", "DEBUG")
            return None

    def _find_primary_class_in_module(self, module):
        if not module:
            return None
        try:
            for name, cls in inspect.getmembers(module, inspect.isclass):
                if cls.__module__ != module.__name__:
                    continue
                if any(k in name.lower() for k in ("controller", "model", "view")):
                    return cls
            for name, cls in inspect.getmembers(module, inspect.isclass):
                if cls.__module__ == module.__name__:
                    return cls
        except Exception:
            pass
        return None

    def _try_instantiate(self, cls, model_instance=None, blueprint_obj=None, router_parameters: Optional[list] = None):
        if not cls:
            return None

        available = {
            "app": self.app,
            "parser": self.parser,
            "api": self.api,
            "log": self.log,
            "config": self.config,
            "model": model_instance,
            "blueprint": blueprint_obj,
        }

        allowed = {"app", "parser", "api", "config", "model", "blueprint"}
        if router_parameters and isinstance(router_parameters, list):
            allowed.update(router_parameters)

        try:
            sig = inspect.signature(cls.__init__)
            kwargs = {}
            for name, param in sig.parameters.items():
                if name == "self":
                    continue
                if name in allowed and available.get(name) is not None:
                    kwargs[name] = available[name]

            try:
                return cls(**kwargs)
            except TypeError:
                try:
                    return cls()
                except Exception as e2:
                    self.log(f"⚠️ Fallback: Could not instantiate {getattr(cls,'__name__','<cls>')}: {e2}", "ROUTER", "WARN")
                    return None

        except Exception as e:
            self.log(f"❌ Failed to instantiate {getattr(cls,'__name__','<cls>')}: {e}\n{traceback.format_exc()}", "ROUTER", "ERROR")
            return None

    def _inject_api_dependencies(self, entry: Dict[str, Any]):
        """
        API injection — verwendet ebenfalls ausschließlich generated.* Modulnamen.
        entry enthält die originalpfade; hier bauen wir lokal gen_mod strings.
        """
        if not self.api:
            return
        deps = entry.get("api", {}).get("dependency", None)
        if not deps:
            return
        try:
            if isinstance(deps, list):
                for mod_path in (entry.get("view_module"), entry.get("controller"), entry.get("model")):
                    if not mod_path:
                        continue
                    gen_mod = mod_path if str(mod_path).startswith("generated.") else f"generated.{mod_path}"
                    try:
                        m = importlib.import_module(gen_mod)
                        self.api.inject(m, deps)
                    except Exception:
                        continue
            elif isinstance(deps, dict):
                if deps.get("view") and entry.get("view_module"):
                    try:
                        gen_mod = entry.get("view_module") if str(entry.get("view_module")).startswith("generated.") else f"generated.{entry.get('view_module')}"
                        m = importlib.import_module(gen_mod)
                        self.api.inject(m, deps["view"])
                    except Exception:
                        pass
                if deps.get("controller") and entry.get("controller"):
                    try:
                        gen_mod = entry.get("controller") if str(entry.get("controller")).startswith("generated.") else f"generated.{entry.get('controller')}"
                        m = importlib.import_module(gen_mod)
                        self.api.inject(m, deps["controller"])
                    except Exception:
                        pass
                if deps.get("model") and entry.get("model"):
                    try:
                        gen_mod = entry.get("model") if str(entry.get("model")).startswith("generated.") else f"generated.{entry.get('model')}"
                        m = importlib.import_module(gen_mod)
                        self.api.inject(m, deps["model"])
                    except Exception:
                        pass
        except Exception as e:
            self.log(f"API injection failed for entry {entry.get('blueprint')}: {e}", "ROUTER", "WARN")

    def init_setup(self):
        """
        Registriert Blueprints basierend auf config["router"].
        WICHTIG: Vor jedem Import hängt der Router LOKAL 'generated.' an (ohne config zu ändern).
        """
        for entry in self.config.get("router", []):
            bp_key = entry.get("blueprint")
            view_cfg = entry.get("view_module")
            ctrl_cfg = entry.get("controller")
            mdl_cfg = entry.get("model")
            url_prefix = entry.get("url")
            router_params = entry.get("router_parameter", None)

            if not bp_key or not view_cfg:
                self.log(f"Skipping entry (missing blueprint or view_module): {entry}", "ROUTER", "WARN")
                continue

            # --- build generated module names locally (do NOT mutate entry/config) ---
            gen_view_name = view_cfg if str(view_cfg).startswith("generated.") else f"generated.{view_cfg}"
            gen_ctrl_name = None if not ctrl_cfg else (ctrl_cfg if str(ctrl_cfg).startswith("generated.") else f"generated.{ctrl_cfg}")
            gen_mdl_name = None if not mdl_cfg else (mdl_cfg if str(mdl_cfg).startswith("generated.") else f"generated.{mdl_cfg}")

            # Strict: import ONLY generated view module
            view_mod = self._import_try(gen_view_name)
            ctrl_mod = self._import_try(gen_ctrl_name)
            if not view_mod:
                self.log(f"ERROR: Could not import generated view module for '{bp_key}'. Tried '{gen_view_name}' only. Aborting this entry.", "ROUTER", "ERROR")
                continue

            # flexible blueprint detection
            blueprint_obj = None
            match_info = "none"
            try:
                from flask import Blueprint as FlaskBlueprint

                candidates = []
                for attr_name in dir(view_mod):
                    try:
                        attr = getattr(view_mod, attr_name)
                        if isinstance(attr, FlaskBlueprint):
                            candidates.append((attr_name, attr))
                    except Exception:
                        continue

                # 1) exact match on bp.name
                for var_name, bp in candidates:
                    try:
                        if str(bp.name) == str(bp_key):
                            blueprint_obj = bp
                            match_info = f"matched by bp.name == '{bp_key}' (attr {var_name})"
                            break
                    except Exception:
                        continue

                # 2) exact match on attribute name
                if not blueprint_obj:
                    for var_name, bp in candidates:
                        if var_name == bp_key or var_name == f"router_{bp_key}":
                            blueprint_obj = bp
                            match_info = f"matched by attr name == '{var_name}'"
                            break

                # 3) variant heuristics
                if not blueprint_obj:
                    for var_name, bp in candidates:
                        try:
                            if str(bp.name) == f"router_{bp_key}" or str(bp.name).endswith(str(bp_key)):
                                blueprint_obj = bp
                                match_info = f"matched by bp.name variant '{bp.name}' (attr {var_name})"
                                break
                        except Exception:
                            continue

                # 4) fallback single blueprint in module
                if not blueprint_obj and len(candidates) == 1:
                    blueprint_obj = candidates[0][1]
                    match_info = f"fallback: single blueprint in module (attr {candidates[0][0]})"

                if blueprint_obj:
                    self.log(f"Found blueprint for '{bp_key}' -> {match_info}", "ROUTER", "DEBUG")
                else:
                    self.log(f"ERROR: Blueprint with name/attr matching '{bp_key}' not found in generated module '{view_mod.__name__}'. Aborting this entry.", "ROUTER", "ERROR")
                    continue

            except Exception as e:
                self.log(f"ERROR locating Blueprint for '{bp_key}': {e}\n{traceback.format_exc()}", "ROUTER", "ERROR")
                continue

            # API injection into generated modules (best-effort)
            try:
                self._inject_api_dependencies(entry)
            except Exception:
                pass

            # instantiate model from generated module (if configured)
            model_instance = None
            if gen_mdl_name:
                mdl_mod = self._import_try(gen_mdl_name)
                if mdl_mod:
                    mdl_cls = self._find_primary_class_in_module(mdl_mod)
                    if mdl_cls:
                        model_instance = self._try_instantiate(mdl_cls, blueprint_obj=blueprint_obj, router_parameters=router_params)
                    else:
                        self.log(f"WARN: No model class found in '{gen_mdl_name}' for blueprint '{bp_key}'", "ROUTER", "WARN")
                else:
                    self.log(f"WARN: Could not import generated model module '{gen_mdl_name}' for blueprint '{bp_key}'", "ROUTER", "WARN")

            # Model-Initialisierung prüfen und blockieren bis abgeschlossen
            if model_instance is not None and entry.get("initialize", False):
                try:
                    if hasattr(model_instance, "initialize") and callable(model_instance.initialize):
                        self.log(f"Initializing model '{model_instance.__class__.__name__}' for blueprint '{bp_key}'...", "ROUTER", "INFO", "⏳")
                        model_instance.initialize()  # BLOCKIERT bis abgeschlossen
                        self.log(f"Model '{model_instance.__class__.__name__}' initialized for blueprint '{bp_key}'", "ROUTER", "INFO", "✅")
                except Exception as e:
                    self.log(f"Failed to initialize model for blueprint '{bp_key}': {e}\n{traceback.format_exc()}", "ROUTER", "ERROR")

            # queue special-case: try generated queue controller first, fallback to runtime controller.queue_controller
            try:
                if model_instance is not None and "queue" in str(bp_key).lower():
                    try:
                        gen_queue_mod = "generated.controller.queue_controller"
                        qc_mod = self._import_try(gen_queue_mod) or self._import_try("controller.queue_controller")
                        if qc_mod and hasattr(qc_mod, "set_queue"):
                            set_queue = getattr(qc_mod, "set_queue")
                            if callable(set_queue):
                                set_queue(model_instance)
                                self.log(f"QueueModel instance registered via set_queue() for '{bp_key}'", "ROUTER", "INFO", "✅")
                    except Exception as e:
                        self.log(f"Could not call set_queue for '{bp_key}': {e}", "ROUTER", "WARN")
            except Exception:
                pass

            # instantiate controller from generated module (if configured)
            controller_instance = None
            if gen_ctrl_name:
                ctrl_mod = self._import_try(gen_ctrl_name)
                if ctrl_mod:
                    ctrl_cls = self._find_primary_class_in_module(ctrl_mod)
                    if ctrl_cls:
                        controller_instance = self._try_instantiate(ctrl_cls, model_instance, blueprint_obj, router_params)
                        if controller_instance and model_instance and not getattr(controller_instance, "_model", None):
                            try:
                                setattr(controller_instance, "_model", model_instance)
                            except Exception:
                                pass
                        if controller_instance and self.parser and not getattr(controller_instance, "_parser", None):
                            try:
                                setattr(controller_instance, "_parser", self.parser)
                            except Exception:
                                pass
                    else:
                        self.log(f"WARN: No controller class found in '{gen_ctrl_name}' for blueprint '{bp_key}'", "ROUTER", "WARN")
                else:
                    self.log(f"WARN: Could not import generated controller module '{gen_ctrl_name}' for blueprint '{bp_key}'", "ROUTER", "WARN")

            # attach placeholders on blueprint
            try:
                if controller_instance is not None:
                    setattr(blueprint_obj, "_controller", controller_instance)
                if self.parser is not None:
                    setattr(blueprint_obj, "_parser", self.parser)
                if model_instance is not None:
                    setattr(blueprint_obj, "_model", model_instance)
            except Exception:
                self.log("Could not attach placeholders to blueprint", "ROUTER", "WARN")

            # instantiate controller class if generator left a class on the blueprint
            try:
                existing_ctrl = getattr(blueprint_obj, "_controller", None)
                if inspect.isclass(existing_ctrl):
                    try:
                        inst = self._try_instantiate(existing_ctrl, model_instance, blueprint_obj, router_params)
                        if inst:
                            setattr(blueprint_obj, "_controller", inst)
                            controller_instance = inst
                            if model_instance and not getattr(controller_instance, "_model", None):
                                try:
                                    setattr(controller_instance, "_model", model_instance)
                                except Exception:
                                    pass
                            if self.parser and not getattr(controller_instance, "_parser", None):
                                try:
                                    setattr(controller_instance, "_parser", self.parser)
                                except Exception:
                                    pass
                            self.log(f"Instantiated controller class on blueprint '{bp_key}' at startup", "ROUTER", "INFO", "✅")
                    except Exception:
                        self.log(f"Could not instantiate controller class attached to blueprint '{bp_key}'", "ROUTER", "WARN")
            except Exception:
                pass

            # attach method_map to blueprint and controller if present
            try:
                method_map = entry.get("method_map", {}) or {}
                try:
                    setattr(blueprint_obj, "_method_map", method_map)
                except Exception:
                    pass
                if controller_instance is not None:
                    try:
                        setattr(controller_instance, "_method_map", method_map)
                    except Exception:
                        pass
                    ctrl_cls = controller_instance.__class__
                    if not hasattr(ctrl_cls, "_method_map") or not getattr(ctrl_cls, "_method_map", None):
                        try:
                            setattr(ctrl_cls, "_method_map", method_map)
                        except Exception:
                            pass
                    try:
                        if not getattr(blueprint_obj, "_controller", None):
                            setattr(blueprint_obj, "_controller", controller_instance)
                    except Exception:
                        pass
                    self.log(f"Attached method_map to controller '{ctrl_cls.__name__}' and blueprint '{bp_key}'", "ROUTER", "DEBUG")

            except Exception as e:
                self.log(f"Could not attach method_map for blueprint '{bp_key}': {e}", "ROUTER", "WARN")

            # dynamic view class properties
            try:
                view_cls = self._find_primary_class_in_module(view_mod)
                if view_cls:
                    def _make_prop(attr_name, bp):
                        return property(lambda self, _bp=bp, _attr=attr_name: getattr(_bp, _attr, None))
                    try:
                        if not isinstance(getattr(view_cls, "_controller", None), property):
                            setattr(view_cls, "_controller", _make_prop("_controller", blueprint_obj))
                        if not isinstance(getattr(view_cls, "_parser", None), property):
                            setattr(view_cls, "_parser", _make_prop("_parser", blueprint_obj))
                        if not isinstance(getattr(view_cls, "_model", None), property):
                            setattr(view_cls, "_model", _make_prop("_model", blueprint_obj))
                    except Exception as e:
                        self.log(f"Could not set dynamic properties on view class '{view_cls.__name__}': {e}", "ROUTER", "WARN")
            except Exception:
                pass

            # controller discovery (best-effort) and attach
            try:
                ctrl_cls = self._find_primary_class_in_module(ctrl_mod)
                if ctrl_cls:
                    def _make_prop(attr_name, bp):
                        return property(lambda self, _bp=bp, _attr=attr_name: getattr(_bp, _attr, None))
                    try:
                        if not isinstance(getattr(ctrl_cls, "_parser", None), property):
                            setattr(ctrl_cls, "_parser", _make_prop("_parser", blueprint_obj))
                        if not isinstance(getattr(ctrl_cls, "_model", None), property):
                            setattr(ctrl_cls, "_model", _make_prop("_model", blueprint_obj))
                    except Exception as e:
                        self.log(f"Could not set dynamic properties on view class '{ctrl_cls.__name__}': {e}", "ROUTER", "WARN")
            except Exception:
                pass

            # register blueprint into flask app (no url_prefix)
            try:
                if self.app and hasattr(self.app, "register_blueprint"):
                    try:
                        self.app.register_blueprint(blueprint_obj, url_prefix=url_prefix)
                        self.log(f"Blueprint '{bp_key}' registered with prefix '{url_prefix}'", "ROUTER", "INFO", "✅")

                    except Exception as e:
                        self.blueprints[bp_key] = {"blueprint": blueprint_obj}
                        self.log(f"Could not register blueprint '{bp_key}': {e}", "ROUTER", "WARN")
                else:
                    self.blueprints[bp_key] = {"blueprint": blueprint_obj}
                    self.log(f"Blueprint '{bp_key}' loaded (no app)", "ROUTER", "INFO", "ℹ️")
            except Exception as e:
                self.log(f"Unexpected error registering blueprint '{bp_key}': {e}\n{traceback.format_exc()}", "ROUTER", "ERROR")
                continue
