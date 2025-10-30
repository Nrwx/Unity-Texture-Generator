from __future__ import annotations
import re
from typing import Any, Mapping, Optional, Dict, Tuple, List, Callable
import json

class Compiler:
    """
    Template-Compiler mit:
      - {{ expressions }} (sichere Ausdrücke mit dotted.names, optional chaining, Operatoren)
      - {% if ... %} / {% elif ... %} / {% else %} / {% endif %}
      - {% for ... in ... %} / {% endfor %}
    Auflösung: vars_map -> loop/context -> entry -> self.config

    Verbesserte Fehlerausgaben: alle RuntimeErrors enthalten Zeile/Spalte und Kontext.

    Unterstützt:
      - Default-Funktionen (str.upper, len, sum, etc.) direkt im Template
      - Pipe-Syntax: {{ var | func1 | func2(arg) }}
    """

    TAG_RE = re.compile(r"\{%\s*(.+?)\s*%\}", re.S)
    PLACEHOLDER_RE = re.compile(r"\{\{\s*(.+?)\s*\}\}")

    # -------------------------
    # Standardfunktionen für Templates
    # -------------------------
    DEFAULT_FUNCS = {
        # Stringfunktionen
        "capitalize": str.capitalize,
        "upper": str.upper,
        "lower": str.lower,
        "title": str.title,
        "strip": str.strip,
        "lstrip": str.lstrip,
        "rstrip": str.rstrip,
        "replace": str.replace,
        "startswith": str.startswith,
        "endswith": str.endswith,
        "format": str.format,
        "join": lambda s, sep='': sep.join(s) if isinstance(s, (list, tuple)) else s,

        # Zahlenfunktionen
        "abs": abs,
        "round": round,
        "int": int,
        "float": float,
        "min": min,
        "max": max,
        "sum": sum,

        # Listen / Sequenzen
        "len": len,
        "list": list,
        "tuple": tuple,
        "sorted": sorted,
        "reversed": lambda x: list(reversed(x)) if x else x,

        # Allgemein / Hilfsfunktionen
        "str": str,
        "repr": repr,
        "bool": bool,
        "type": type,
        "dict": dict,

        # Sonstige nützliche Funktionen
        "any": any,
        "all": all,
        "enumerate": enumerate,
        "range": range,
        "zip": zip,
        "json": json.dumps
    }

    def __init__(self, config: Mapping[str, Any] = None, expr_cache_size: Optional[int] = 1024):
        # Merge config mit Default-Funktionen
        merged_config = dict(self.DEFAULT_FUNCS)
        if config:
            merged_config.update(config)
        self.config = merged_config

        self._expr_cache_size = expr_cache_size if expr_cache_size and expr_cache_size > 0 else None
        if self._expr_cache_size:
            from functools import lru_cache
            self._compile_cached = lru_cache(maxsize=self._expr_cache_size)(self._compile_expr)
        else:
            self._compile_cached = self._compile_expr

    def clear_expr_cache(self):
        """Leert den Expression-Cache (wenn aktiv)."""
        if hasattr(self, "_compile_cached") and hasattr(self._compile_cached, "cache_clear"):
            self._compile_cached.cache_clear()

    # -------------------------
    # Hilfsfunktionen zur Auflösung
    # -------------------------
    def _get_from_path(self, container: Any, parts: Tuple[str, ...]) -> Any:
        cur = container
        for p in parts:
            if cur is None:
                return None
            if isinstance(cur, dict):
                cur = cur.get(p)
            elif isinstance(cur, (list, tuple)):
                try:
                    idx = int(p)
                    cur = cur[idx] if 0 <= idx < len(cur) else None
                except Exception:
                    return None
            elif hasattr(cur, p):
                try:
                    cur = getattr(cur, p)
                except Exception:
                    return None
            else:
                return None
        return cur

    def _resolve_dotted(self, name: str, context: Dict[str, Any], entry: Dict[str, Any]) -> Any:
        if name in context:
            return context[name]
        if name in entry:
            return entry[name]
        parts = tuple(name.split('.'))
        v = self._get_from_path(context, parts)
        if v is not None:
            return v
        v = self._get_from_path(entry, parts)
        if v is not None:
            return v
        v = self._get_from_path(self.config, parts)
        return v

    # -------------------------
    # Ausdrucksauswertung inkl. Pipe-Handling
    # -------------------------
    def _eval_expr(self, expr: str, context: Dict[str, Any], entry: Dict[str, Any], src: Optional[str] = None, start_idx: int = 0) -> Any:
        expr = expr.strip()

        # Pipes trennen: var | func1 | func2
        parts = [p.strip() for p in expr.split("|")]
        if not parts:
            return None

        val = self._eval_single_expr(parts[0], context, entry, src, start_idx)
        for pipe_expr in parts[1:]:
            # Pipe kann mit Argument: func(arg)
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$", pipe_expr)
            if m:
                fn_name = m.group(1)
                arg_str = m.group(2).strip()
                if arg_str:
                    arg_val = self._eval_single_expr(arg_str, context, entry, src, start_idx)
                    val = self._call_func(fn_name, val, arg_val)
                else:
                    val = self._call_func(fn_name, val)
            else:
                val = self._call_func(pipe_expr, val)

        return val

    def _eval_single_expr(self, expr: str, context: Dict[str, Any], entry: Dict[str, Any], src: Optional[str] = None, start_idx: int = 0):
        expr = expr.strip()

        try:
            # Standard-Ausdruck kompilieren
            comp_fn = self._compile_cached(expr)
        except Exception as e:
            raise RuntimeError(self._format_error(f"Expression compilation error: {e}", src or expr, start_idx))

        try:
            return comp_fn(context, entry)
        except Exception as e:
            raise RuntimeError(self._format_error(f"Expression evaluation error: {e}", src or expr, start_idx))

    def _call_func(self, fn_name: str, val: Any, arg: Any = None) -> Any:
        fn = self._resolve_dotted(fn_name, {}, self.config)
        if not callable(fn):
            raise RuntimeError(f"Pipe function '{fn_name}' is not callable")
        if arg is None:
            return fn(val)
        return fn(val, arg)

    def _compile_expr(self, expr: str) -> Callable[[Dict[str, Any], Dict[str, Any]], Any]:
        """
        Kompiliert einen Ausdrucks-String zu einer Funktion (ctx, entry) -> value.
        Implementierung: Tokenizer + rekursiver Abstieg. (Nur Ausdrücke, keine eval())
        """
        expr = expr.strip()

        # fallback-/short-hand patterns (items/keys/values/get) werden in _eval_expr vorab behandelt,
        # hier also der generelle Parser für alle anderen Ausdrücke.

        # Token-Spezifikation (erweitert: comparisons, not, slicing etc.)
        token_spec = [
            ("WS", r"[ \t\n\r]+"),
            ("EQ", r"=="),
            ("NEQ", r"!="),
            ("LE", r"<="),
            ("GE", r">="),
            ("LT", r"<"),
            ("GT", r">"),
            ("NHCO", r"\?\?"),
            ("OR", r"\|\|"),
            ("AND", r"&&"),
            ("NOT", r"!"),
            ("OPTATTR", r"\?\."),
            ("IN", r"\bin\b"),
            ("DOT", r"\."),
            ("QMARK", r"\?"),
            ("COLON", r":"),
            ("LPAREN", r"\("),
            ("RPAREN", r"\)"),
            ("LBRACK", r"\["),
            ("RBRACK", r"\]"),
            ("COMMA", r","),
            ("STRING", r"'[^']*'|\"[^\"]*\""),
            ("NUMBER", r"\d+(\.\d+)?"),
            ("PLUS", r"\+"),
            ("MINUS", r"-"),
            ("MUL", r"\*"),
            ("DIV", r"/"),
            ("MOD", r"%"),
            ("NAME", r"[A-Za-z_][A-Za-z0-9_\.]*"),
        ]
        tok_regex = "|".join(f"(?P<{n}>{p})" for n, p in token_spec)
        scanner = re.compile(tok_regex)

        # lex
        tokens = [(m.lastgroup, m.group(0)) for m in scanner.finditer(expr) if m.lastgroup != "WS"]
        idx = 0

        def peek():
            return tokens[idx] if idx < len(tokens) else None

        def pop(expected=None):
            nonlocal idx
            if idx >= len(tokens):
                raise RuntimeError(f"Unexpected end of expression: {expr}")
            t = tokens[idx]
            idx += 1
            if expected and t[0] != expected:
                raise RuntimeError(f"Expected {expected} but got {t[0]} in {expr}")
            return t

        # Parser-Funktionen: bauen Closures, die (ctx, entry) -> value zurückgeben.
        def parse_expression():
            cond = parse_or()
            p = peek()
            if p and p[0] == "QMARK":
                pop("QMARK")
                true_f = parse_expression()
                pop("COLON")
                false_f = parse_expression()
                return lambda ctx, en: true_f(ctx, en) if bool(cond(ctx, en)) else false_f(ctx, en)
            return cond

        def parse_or():
            left = parse_nullish()
            while True:
                p = peek()
                if p and p[0] == "OR":
                    pop("OR")
                    right = parse_nullish()
                    left_old = left
                    left = lambda ctx, en, l=left_old, r=right: l(ctx, en) or r(ctx, en)
                else:
                    break
            return left

        def parse_nullish():
            left = parse_and()
            while True:
                p = peek()
                if p and p[0] == "NHCO":
                    pop("NHCO")
                    right = parse_and()
                    left_old = left
                    left = lambda ctx, en, l=left_old, r=right: l(ctx, en) if l(ctx, en) is not None else r(ctx, en)
                else:
                    break
            return left

        def parse_and():
            left = parse_not()
            while True:
                p = peek()
                if p and p[0] == "AND":
                    pop("AND")
                    right = parse_not()
                    left_old = left
                    left = lambda ctx, en, l=left_old, r=right: l(ctx, en) and r(ctx, en)
                else:
                    break
            return left

        def parse_not():
            p = peek()
            if p and p[0] == "NOT":
                pop("NOT")
                operand = parse_not()
                return lambda ctx, en, o=operand: not o(ctx, en)
            return parse_comparison()

        def parse_comparison():
            left = parse_add()
            while True:
                p = peek()
                if p and p[0] in ("EQ", "NEQ", "LT", "LE", "GT", "GE", "IN"):
                    op = pop()[0]
                    right = parse_add()
                    if op == "EQ":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) == r(ctx, en)))
                    elif op == "NEQ":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) != r(ctx, en)))
                    elif op == "LT":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) < r(ctx, en)))
                    elif op == "LE":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) <= r(ctx, en)))
                    elif op == "GT":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) > r(ctx, en)))
                    elif op == "GE":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) >= r(ctx, en)))
                    else:  # IN
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) in (r(ctx, en) or [])))
                else:
                    break
            return left

        def parse_add():
            left = parse_mul()
            while True:
                p = peek()
                if p and p[0] in ("PLUS", "MINUS"):
                    op = pop()[0]
                    right = parse_mul()
                    if op == "PLUS":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) + r(ctx, en)))
                    else:
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) - r(ctx, en)))
                else:
                    break
            return left

        def parse_mul():
            left = parse_unary()
            while True:
                p = peek()
                if p and p[0] in ("MUL", "DIV", "MOD"):
                    op = pop()[0]
                    right = parse_unary()
                    if op == "MUL":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) * r(ctx, en)))
                    elif op == "DIV":
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) / r(ctx, en)))
                    else:
                        left = (lambda l=left, r=right: (lambda ctx, en: l(ctx, en) % r(ctx, en)))
                else:
                    break
            return left

        def parse_unary():
            p = peek()
            if p and p[0] == "PLUS":
                pop("PLUS")
                operand = parse_unary()
                return lambda ctx, en: +operand(ctx, en)
            if p and p[0] == "MINUS":
                pop("MINUS")
                operand = parse_unary()
                return lambda ctx, en: -operand(ctx, en)
            return parse_primary()

        def parse_primary():
            p = peek()
            if not p:
                raise RuntimeError(f"Unexpected end in expr: {expr}")
            if p[0] == "LPAREN":
                pop("LPAREN")
                inner = parse_expression()
                pop("RPAREN")
                return inner
            if p[0] == "STRING":
                val = pop("STRING")[1][1:-1]
                return lambda ctx, en, v=val: v
            if p[0] == "NUMBER":
                t = pop("NUMBER")[1]
                v = float(t) if "." in t else int(t)
                return lambda ctx, en, v=v: v
            if p[0] == "NAME":
                name = pop("NAME")[1]
                # resolve dotted via _resolve_dotted when evaluating
                def base_resolve(ctx, en, n=name):
                    return self._resolve_dotted(n, ctx, en)
                node = base_resolve

                # attribute access, optional chaining, indexing/slicing
                while True:
                    q = peek()
                    if not q:
                        break
                    if q[0] in ("DOT", "OPTATTR"):
                        tok = pop()[0]
                        nxt = peek()
                        if not nxt or nxt[0] != "NAME":
                            raise RuntimeError(f"Expected identifier after '.' or '?.' in {expr}")
                        part = pop("NAME")[1]
                        opt = (tok == "OPTATTR")
                        prev = node
                        def make_attr(prev_func, part_str, opt):
                            def f(ctx, en):
                                base = prev_func(ctx, en)
                                if base is None and opt:
                                    return None
                                if isinstance(base, dict):
                                    return base.get(part_str)
                                if isinstance(base, (list, tuple)):
                                    try:
                                        idx = int(part_str)
                                        return base[idx]
                                    except Exception:
                                        return None
                                return getattr(base, part_str, None)
                            return f
                        node = make_attr(prev, part, opt)
                        continue
                    if q[0] == "LBRACK":
                        pop("LBRACK")
                        # detect slice if ':' appears
                        # parse possible start expression (or immediate ':' -> None)
                        if peek() and peek()[0] == "COLON":
                            start_f = None
                        else:
                            start_f = parse_expression()
                        if peek() and peek()[0] == "COLON":
                            pop("COLON")
                            if peek() and peek()[0] != "RBRACK":
                                end_f = parse_expression()
                            else:
                                end_f = None
                            # optional step not implemented separately (kept simple)
                            pop("RBRACK")
                            prev = node
                            def make_slice(prev_func, s_f, e_f):
                                def f(ctx, en):
                                    base = prev_func(ctx, en)
                                    if base is None:
                                        return None
                                    s = s_f(ctx, en) if s_f else None
                                    e = e_f(ctx, en) if e_f else None
                                    try:
                                        return base[s:e]
                                    except Exception:
                                        return None
                                return f
                            node = make_slice(prev, start_f, end_f)
                        else:
                            # simple index
                            idx_f = parse_expression()
                            pop("RBRACK")
                            prev = node
                            def make_index(prev_func, idx_expr):
                                def f(ctx, en):
                                    base = prev_func(ctx, en)
                                    if base is None:
                                        return None
                                    try:
                                        idxv = idx_expr(ctx, en)
                                        # support negative indices for sequences
                                        if isinstance(base, (list, tuple)) and isinstance(idxv, int):
                                            if idxv < 0:
                                                idxv = len(base) + idxv
                                            return base[idxv] if 0 <= idxv < len(base) else None
                                        if isinstance(base, dict):
                                            return base.get(idxv)
                                        return None
                                    except Exception:
                                        return None
                                return f
                            node = make_index(prev, idx_f)
                            continue
                    break
                return node
            raise RuntimeError(f"Unexpected token {p} in {expr}")

        fn = parse_expression()
        if idx < len(tokens):
            raise RuntimeError(f"Trailing tokens in expression: {expr}")
        return fn

    # -------------------------
    # Fehlerformatierung (Zeile/Spalte + Kontext)
    # -------------------------
    def _pos_info(self, src: str, index: int) -> Tuple[int, int, str]:
        """
        Liefert (line_no, col_no, line_text) für byte-Index index in src.
        Zeilenzahl 1-basiert, Spalte 1-basiert.
        """
        if index < 0:
            index = 0
        prefix = src[:index]
        line_no = prefix.count("\n") + 1
        last_n = prefix.rfind("\n")
        line_start = last_n + 1
        next_n = src.find("\n", line_start)
        if next_n == -1:
            line_end = len(src)
        else:
            line_end = next_n
        line_text = src[line_start:line_end]
        col_no = index - line_start + 1
        return line_no, col_no, line_text

    def _format_error(self, msg: str, src: str, index: int) -> str:
        ln, col, line_text = self._pos_info(src, index)
        pointer = " " * (max(0, col - 1)) + "^"
        return f"{msg} (line {ln}, col {col})\n{line_text}\n{pointer}"

    # -------------------------
    # Render / Parser (rekursiv)
    # -------------------------
    def _render(self, src: str, context: Dict[str, Any], entry: Dict[str, Any]) -> str:
        out: List[str] = []
        pos = 0
        length = len(src)

        while pos < length:
            m = self.TAG_RE.search(src, pos)
            if not m:
                # kein Tag mehr -> rest anhängen
                tail = src[pos:]
                out.append(self._replace_placeholders(tail, context, entry))
                break

            # text vor Tag verarbeiten
            pre = src[pos:m.start()]
            out.append(self._replace_placeholders(pre, context, entry))

            tag = m.group(1).strip()
            tag_pos = m.start()
            pos = m.end()

            try:
                if tag.startswith("for "):
                    header = tag[4:].strip()
                    h_m = re.match(r"^(.+?)\s+in\s+(.+)$", header)
                    if not h_m:
                        raise RuntimeError(self._format_error(f"Invalid for-header: '{header}'", src, tag_pos))
                    lhs = h_m.group(1).strip()
                    expr = h_m.group(2).strip()

                    # finde passendes endfor (index-basierte Suche)
                    start_inner = pos
                    depth = 1
                    inner_block = None
                    search_pos = pos
                    while True:
                        m2 = self.TAG_RE.search(src, search_pos)
                        if not m2:
                            break
                        inner_tag = m2.group(1).strip()
                        if inner_tag.startswith("for "):
                            depth += 1
                        elif inner_tag == "endfor":
                            depth -= 1
                            if depth == 0:
                                inner_block = src[start_inner:m2.start()]
                                pos = m2.end()
                                break
                        search_pos = m2.end()
                    if inner_block is None:
                        raise RuntimeError(self._format_error("Unclosed {% for %} block", src, tag_pos))

                    iterable = self._eval_expr(expr, context, entry, src, tag_pos) or []
                    if isinstance(iterable, dict):
                        iterable = iterable.items()

                    var_names = [v.strip() for v in lhs.split(",")]

                    for item in iterable:
                        loop_ctx = dict(context)
                        if len(var_names) == 1:
                            loop_ctx[var_names[0]] = item
                        else:
                            try:
                                a = tuple(item)
                            except Exception:
                                a = (item,)
                            for i, name in enumerate(var_names):
                                loop_ctx[name] = a[i] if i < len(a) else None
                        rendered = self._render(inner_block, loop_ctx, entry)
                        out.append(rendered)
                    continue

                elif tag.startswith("if "):
                    # robustes If/Elif/Else/Endif Matching (index-basiert)
                    cond_expr = tag[3:].strip()
                    start_inner = pos
                    depth = 1
                    segments: List[Tuple[Optional[str], str, int]] = []
                    last_start = pos
                    search_pos = pos
                    while True:
                        m2 = self.TAG_RE.search(src, search_pos)
                        if not m2:
                            break
                        inner_tag = m2.group(1).strip()
                        if inner_tag.startswith("if "):
                            depth += 1
                        elif inner_tag == "endif":
                            depth -= 1
                            if depth == 0:
                                seg_text = src[last_start:m2.start()]
                                segments.append((cond_expr, seg_text, last_start))
                                pos = m2.end()
                                break
                        elif depth == 1 and inner_tag.startswith("elif "):
                            seg_text = src[last_start:m2.start()]
                            segments.append((cond_expr, seg_text, last_start))
                            cond_expr = inner_tag[5:].strip()
                            last_start = m2.end()
                        elif depth == 1 and inner_tag == "else":
                            seg_text = src[last_start:m2.start()]
                            segments.append((cond_expr, seg_text, last_start))
                            cond_expr = None
                            last_start = m2.end()
                        search_pos = m2.end()

                    if not segments and depth != 0 and pos <= len(src):
                        raise RuntimeError(self._format_error("Unclosed {% if %} block", src, tag_pos))

                    # evaluate segments in order, take the first that matches
                    rendered_seg = ""
                    for cond, text, seg_pos in segments:
                        take = False
                        if cond is None:
                            take = True
                        else:
                            val = self._eval_expr(cond, context, entry, src, seg_pos)
                            take = bool(val)
                        if take:
                            rendered_seg = self._render(text, context, entry)
                            break
                    out.append(rendered_seg)
                    continue

                elif tag in ("endif", "endfor", "else", "elif"):
                    # stray closing tags: ignorieren (wurden bereits beim Öffnen verarbeitet)
                    continue
                else:
                    # unbekanntes Tag: ignoriere es
                    continue

            except RuntimeError:
                raise
            except Exception as e:
                raise RuntimeError(self._format_error(f"Error while processing tag '{tag}': {e}", src, tag_pos))

        return "".join(out)

    def _replace_placeholders(self, text: str, context: Dict[str, Any], entry: Dict[str, Any]) -> str:
        def repl(m: re.Match) -> str:
            expr = m.group(1)
            start_idx = m.start()
            try:
                val = self._eval_expr(expr, context, entry, text, start_idx)
            except RuntimeError:
                raise
            if val is None:
                # differenzierter Fehler: Variable/Expression ergibt None
                raise RuntimeError(self._format_error(f"Template expression '{expr}' could not be resolved (result is None)", text, start_idx))
            if isinstance(val, (list, dict, tuple)):
                return repr(val)
            return str(val)

        try:
            return self.PLACEHOLDER_RE.sub(repl, text)
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(self._format_error(f"Placeholder replacement error: {e}", text, 0))

    # -------------------------
    # Public API
    # -------------------------
    def compile(self, src: str, vars_map: Optional[Dict[str, Any]] = None,
                blueprint_var: Optional[str] = None, entry: Optional[Dict[str, Any]] = None) -> str:
        if vars_map is None:
            vars_map = {}
        if entry is None:
            entry = {}

        # initial context
        context: Dict[str, Any] = {}
        context.update(vars_map)
        context.update({k: v for k, v in entry.items() if isinstance(k, str)})

        if blueprint_var and "blueprint" in entry:
            context[blueprint_var] = entry["blueprint"]

        try:
            return self._render(src, context, entry)
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"Template compilation failed: {e}")
