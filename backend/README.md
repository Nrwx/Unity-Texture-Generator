# backend

## Project setup
```
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
