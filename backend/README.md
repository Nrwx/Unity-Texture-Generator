# backend

```

shader/
├── vertex.glsl
├── fragment.glsl
├── model.js
└── blend/
│   ├── vertex.glsl
│   ├── fragment.glsl
│   ├── model.js
│   └── modes/*.glsl // Blend fragmente blendNormal, blendMultiply..
└── particle/
    ├── vertex.glsl
    ├── fragment.glsl
    ├── model.js
    └── modes/*.glsl // Particle fragmente..

backend/
├── cli.py
├── app.py
├── config.json
├── version.txt
├── patch.txt
└── core/
    ├── __init__.py
    ├── main.py
    ├── data/main.py //Class Data
    ├── registry/main.py //Class Registry
    ├── task/main.py //Class TaskManager
    ├── config/boot/*json
    └── syslink/main.py // Class SysLink
    
    
├── build.json // multi-config element enthält router(config)
│─ view
│   ├─ upload_view.py
│   │
│   ├─ layer_view.py
│   │
│   └─ base
│       └─ main.py //BaseController
│─ controller
│   ├─ upload_controller.py
│   │
│   ├─ layer_controller.py
│   │
│   └─ base
│       └─ main.py //BaseController
│─ model
│   ├─ upload_model.py
│   │
│   ├─ layer_model.py
│   │
│   └─ base
│       └─ main.py //BaseModel und BaseLogic
│
└── core/
    ├── generate/main.py //Genertor
    ├── router/main.py //Router
    └── api/main.py // Dpendency Injection
```
## Build Setup

### LibraryManager
```
dependencies
├─ last_build: "2025-10-24T05:42:46.743884Z"
├─ config
│   └─ library_policy
│       ├─ auto_update: true
│       ├─ enable_cache: false
│       ├─ use_cache: false
│       ├─ auto_fix_requirements: true
│       ├─ fix_with_requirements: false
│       ├─ freeze_strict: true
│       ├─ on_conflict: "restore_freeze"
│       ├─ exclude_from_auto_update: []
│       ├─ work_path: "."
│       ├─ require_info: "requirements.txt"
│       ├─ report_persist: true
│       ├─ report_path: "library_report.json"
│       ├─ reconcile_before_integrity: true
│       └─ always_persist: true
└─ libraries
    ├─ flask
    │   ├─ version: "3.0.3"
    │   └─ freeze: false
    ├─ fastapi
    │   ├─ version: "0.115.0"
    │   └─ freeze: false
    ├─ pandas
    │   ├─ version: "2.2.3"
    │   └─ freeze: false
    └─ … (weitere Pakete)
    
| Bereich / Feld                            | Typ     | Beschreibung                                                    | Beispiel                                          |
|-------------------------------------------|---------|-----------------------------------------------------------------|---------------------------------------------------|
| last_build                                |(ISO8601)| Zeitstempel der letzten Synchronisation / Update-Aktion         | "2025-10-24T05:42:46.743884Z"                     |
| library_policy.auto_update                | bool    | Aktualisiert automatisch Pakete mit "latest"-Version            | true                                              |
| library_policy.enable_cache               | bool    | Aktiviert pip-Cache bei Installationen                          | false                                             |
| library_policy.use_cache                  | bool    | Nutzt Cache bei Installationen                                  | false                                             |
| library_policy.auto_fix_requirements      | bool    | Passt requirements.txt automatisch an erkannte Konflikte        | true                                              |
| library_policy.fix_with_requirements      | bool    | Behebt Konflikte via temporäre requirements.txt                 | false                                             |
| library_policy.freeze_strict              | bool    | Hält gefrorene Versionen strikt ein                             | true                                              |
| library_policy.on_conflict                | string  | Verhalten bei Versionskonflikten (restore_freeze, ignore, etc.) | "restore_freeze"                                  |
| library_policy.exclude_from_auto_update   | list    | Pakete, die vom Auto-Update ausgeschlossen sind                 | []                                                |
| library_policy.work_path                  | string  | Arbeitsverzeichnis für pip-Befehle                              | "."                                               |
| library_policy.require_info               | string  | Name der requirements.txt Datei                                 | "requirements.txt"                                |
| library_policy.report_persist             | bool    | Speichert Sync-Berichte                                         | true                                              |
| library_policy.report_path                | string  | Pfad für den Sync-Bericht                                       | "library_report.json"                             |
| library_policy.reconcile_before_integrity | bool    | Reconcile mit requirements.txt vor Integritätsprüfung           | true                                              |
| library_policy.always_persist             | bool    | Persistiert libraries immer nach Sync                           | true                                              |
| libraries                                 | dict    | Liste verwalteter Pakete mit Version und Freeze-Flag            | { "flask": {"version": "3.0.3", "freeze": false} }|
| libraries.[paket].version                 | string  | Gewünschte Version, "latest" für neueste Version                | "3.0.3"                                           |
| libraries.[paket].freeze                  | bool    | Paketversion einfrieren (nicht automatisch aktualisieren)       | false                                             |

```


### Compiler

### 1. Platzhalter / Variablenzugriff
```
| Syntax                     | Beschreibung |
|-----------------------------|-------------|
| `{{ var }}`                 | Einfacher Zugriff auf Variable `var` |
| `{{ obj.attr }}`            | Zugriff auf Attribut `attr` eines Objekts oder Key eines Dicts |
| `{{ obj?.attr }}`           | Optional chaining: gibt `None` zurück, wenn `obj` None ist |
| `{{ arr[0] }}`              | Indexzugriff auf Listen oder Tupel |
| `{{ arr[1:3] }}`            | Slice: unterstützt `[start:end]` |
| `{{ var | upper | strip }}` | Pipe-Syntax: Übergabe an Funktionen (auch mehrere Pipes möglich) |
| `{{ var | replace("a","b") }}` | Pipe mit Argumenten: ruft Funktion mit Argument auf |
```
### 2. Operatoren
```
| Operator | Beschreibung |
|----------|-------------|
| `+`      | Addition (auch String-Konkatenation) |
| `-`      | Subtraktion |
| `*`      | Multiplikation |
| `/`      | Division |
| `%`      | Modulo |
| `==`     | Gleich |
| `!=`     | Ungleich |
| `<`, `<=`, `>`, `>=` | Vergleichsoperatoren |
| `&&`     | Logisches AND |
| `||`     | Logisches OR |
| `!`      | Logisches NOT |
| `??`     | Nullish-Coalescing: Rückgabe des rechten Wertes, falls linker Wert None |
```
### 3. Ternäre / Bedingte Ausdrücke
```
| Syntax                    | Beschreibung |
|----------------------------|-------------|
| `{{ cond ? true_val : false_val }}` | Rückgabe von `true_val` wenn `cond` True, sonst `false_val` |
```
### 4. Collection-Methoden (Legacy-Support)
```
| Syntax                            | Beschreibung |
|----------------------------------|-------------|
| `{{ dict.items() }}`              | Gibt Liste von `(key, value)` Tupeln |
| `{{ dict.keys() }}`               | Gibt Liste aller Keys |
| `{{ dict.values() }}`             | Gibt Liste aller Values |
| `{{ obj.get('key') }}`            | Zugriff auf Dictionary Key oder Attribut |
```
### 5. Schleifen
```
| Syntax                                         | Beschreibung |
|-----------------------------------------------|-------------|
| `{% for item in iterable %}...{% endfor %}`   | Iteration über Liste, Tupel oder Dict.items() |
| `{% for k, v in dict.items() %}...{% endfor %}` | Iteration über Dictionary (Key-Value) |
```
### 6. Bedingte Blöcke
```
| Syntax                              | Beschreibung |
|------------------------------------|-------------|
| `{% if condition %} ... {% endif %}` | Einfache Bedingung |
| `{% if condition %} ... {% elif other %} ... {% else %} ... {% endif %}` | Komplexe Bedingung mit elif/else |
```
### 7. Standardfunktionen / Pipes
```
- Zugriff auf viele Standardfunktionen direkt im Template:
  `upper`, `lower`, `title`, `strip`, `replace`, `len`, `sum`, `min`, `max`, `abs`, `round`, `list`, `tuple`, `sorted`, `any`, `all`, `zip`, `enumerate`, uvm.
- Pipe-Syntax erlaubt Verkettung: `{{ var | upper | strip }}` 
- Pipes können auch Argumente an Funktionen übergeben: `{{ var | replace("a","b") }}`
- Funktionen aus `config` überschreiben Standardfunktionen.
```
### 8. Besonderheiten
```
- Zugriff auf verschachtelte Attribute über `dotted.names` (z.B. `user.address.city`)  
- Optional chaining (`?.`) schützt vor `None`  
- Slice unterstützt nur `[start:end]` (ohne Schritt)  
- Cache für Expressions optional (`expr_cache_size`)  
- Verbessertes Fehlerreporting mit Zeile, Spalte und Kontext
```
pip list --format=freeze > requirements.txt

cd backend
pip install -r requirements.txt
```

### venv
```
# Linux/macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### packages
```
GTK+ 3 Runtime
----------------
pip install cairosvg
pip install --force-reinstall cairosvg

# Linux
sudo apt install libcairo2

# macOS
brew install cairo

# Windows
https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
```

### intel GPU
```
# Windows
pip install -i https://software.repos.intel.com/python/pypi dpctl dpnp
X86	https://aka.ms/vs/17/release/vc_redist.x86.exe
X64	https://aka.ms/vs/17/release/vc_redist.x64.exe

# Linux
pip install -i https://software.repos.intel.com/python/pypi dpctl dpnp
```

### Anaconda files
```
conda install -c conda-forge cairo pango gdk-pixbuf libxml2 libffi
```

### Start App
```
cd backend
python app.py
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
