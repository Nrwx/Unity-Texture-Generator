/* Features:
    - Pulse + Soft Light Glow Trail
- Smooth Scroll Behavior
- ID/Array-based init + cleanup */

const activeScrollbars = new Map();

function _ensureArray(v) { return Array.isArray(v)?v:[v]; }

function _createTrackAndThumb(el) {
    const track = document.createElement('div');
    track.className = 'custom-scrollbar-track';
    const thumb = document.createElement('div');
    thumb.className = 'custom-scrollbar-thumb';
    const trail = document.createElement('div');
    trail.className = 'custom-scrollbar-trail';
    track.appendChild(trail);
    track.appendChild(thumb);
    el.appendChild(track);
    return { track, thumb, trail };
}

export function scrollbarCreate(idOrArray){
    const ids = _ensureArray(idOrArray);
    ids.forEach(id=>{
        if(typeof id!=='string'){console.warn('[scrollbars] id must be string:',id); return;}
        if(activeScrollbars.has(id)) return;
        const el = document.getElementById(id);
        if(!el){console.warn('[scrollbars] element not found:',id); return;}

        const prevPos = getComputedStyle(el).position;
        if(!prevPos||prevPos==='static') el.style.position='relative';

        const {track, thumb, trail} = _createTrackAndThumb(el);
        el.style.scrollBehavior='smooth';

        let scrollTimer=null, isDragging=false, startY=0, startScroll=0;

        const fadeIn=()=>track.classList.add('active');
        const fadeOut=()=>track.classList.remove('active');

        const updateThumb=()=>{
            const ratio = el.clientHeight/el.scrollHeight;
            const height = Math.max(ratio*100,8);
            const top = (el.scrollTop/(el.scrollHeight-el.clientHeight))*(100-height);

            thumb.style.height = height+'%';
            thumb.style.top = top+'%';
            trail.style.height = height+'%';
            trail.style.top = top+'%';
        };

        const onScroll=()=>{
            fadeIn();
            updateThumb();
            thumb.classList.add('pulse');
            trail.classList.add('pulse-trail');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(()=>{
                thumb.classList.remove('pulse');
                trail.classList.remove('pulse-trail');
                fadeOut();
            },1000);
        };

        const onResize=()=>updateThumb();

        const onMouseDown=e=>{
            isDragging=true; startY=e.clientY; startScroll=el.scrollTop;
            document.body.classList.add('scrollbar-grabbing'); e.preventDefault();
        };
        const onMouseUp=()=>{ isDragging=false; document.body.classList.remove('scrollbar-grabbing'); };
        const onMouseMove=e=>{ if(!isDragging) return; const dy=e.clientY-startY; const ratio=el.scrollHeight/el.clientHeight; el.scrollTop=startScroll+dy*ratio*0.5; };

        el.addEventListener('scroll', onScroll);
        window.addEventListener('resize', onResize);
        thumb.addEventListener('pointerdown', onMouseDown);
        document.addEventListener('pointerup', onMouseUp);
        document.addEventListener('pointermove', onMouseMove);

        updateThumb(); fadeOut();

        const cleanup=()=>{
            el.removeEventListener('scroll',onScroll);
            window.removeEventListener('resize',onResize);
            thumb.removeEventListener('pointerdown',onMouseDown);
            document.removeEventListener('pointerup',onMouseUp);
            document.removeEventListener('pointermove',onMouseMove);
            track.remove();
            activeScrollbars.delete(id);
        };

        activeScrollbars.set(id,{cleanup});
    });

    console.log('scrollbars', activeScrollbars)
}

export function scrollbarDestroy(idOrArray){
    const ids = _ensureArray(idOrArray);
    ids.forEach(id=>{ const entry=activeScrollbars.get(id); if(entry) entry.cleanup(); });
    console.log('scrollbars cleaned', activeScrollbars)

}

export function scrollbarDestroyAll(){
    activeScrollbars.forEach(entry=>entry.cleanup());
    activeScrollbars.clear();
}
