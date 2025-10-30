import {nextTick} from "vue";

function _mapClass(input, parentKey='', seperator='.') {

    const result = {}
    for (const [key, value] of Object.entries(input)){
      const fullKey = parentKey ? `${parentKey}${seperator}${key}` : key;
      if (typeof value === String){
          result[fullKey] = value.trim()
      } else if (Array.isArray(value)) {
          result[fullKey] = value.filter(Boolean).join(' ').trim();
      } else if (typeof value === 'object' && value !== null) {
          Object.assign(result, _mapClass(value, fullKey, seperator));
      } else {
          console.warn('Ungültiger Wert für ${fullKey}: ', value)
      }
    }
    return result
}

function _applyDom(map, clear=false) {

    for (const [selector, className] of Object.entries(map)){
        const elements = document.querySelectorAll(selector);
        if (!elements.length) {
            console.warn('Kein Element gefunden für ${selector}')
            continue
        }

        elements.forEach(el => {
            if (clear) {
                el.className = '';
            }
            if (className) {
                el.classList.add(...className.split(/\s+/).filter(Boolean));
            }
        })
    }
}

export async function clsManager(config, options= {}) {
    const {clear = false, seperator = '.'} = options;
    const map = _mapClass(config, '', seperator);
    await nextTick();
    _applyDom(map, clear);
    return map;
}

