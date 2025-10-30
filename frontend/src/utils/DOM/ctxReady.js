function checkStyle(ready) {
    const styles = Array.from(document.styleSheets);
    try {
        ready = styles.every((s) => {
            try {
                return s.cssRules !== null;
            } catch {
                return true
            }
        })
    }catch {
        ready = true
        return ready
    }
}

export function ctxReady() {
    return new Promise((resolve) => {
        if (typeof window === 'undefined'||typeof document === 'undefined'){
            resolve (false)
            return;
        }

        if (document.readyState === 'complete'){
            resolve(true)
            return;
        }

        let style = checkStyle(false);
        const interval = setInterval(() => {
          style = checkStyle(false);
          if (document.readyState === 'complete' && style) {
              clearInterval(interval);
              resolve(true)
          }
        }, 50)

        window.addEventListener('load', () => {
            clearInterval(interval);
            resolve(true)
        });

        document.addEventListener('DOMContentLoaded', () => {
            style = checkStyle(false)
        })
    })
}