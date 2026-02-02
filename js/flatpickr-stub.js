(function(){
  if (typeof window === 'undefined') return;
  if (window.flatpickr) return;
  if (!Date.prototype.fp_incr) {
    Object.defineProperty(Date.prototype, 'fp_incr', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function(days) {
        const d = new Date(this.getTime());
        const n = Number(days);
        d.setDate(d.getDate() + (Number.isFinite(n) ? n : 0));
        return d;
      }
    });
  }
  function fp(selector, options){
    try{
      const el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if (!el) return { destroy(){}, set(){}, open(){}, close(){} };
      el.addEventListener('focus', () => {
        try{
          if (el.tagName === 'INPUT') {
            if (options && options.enableTime) el.type = 'datetime-local';
            else el.type = 'date';
          }
        }catch(_){}
      });
      return { destroy(){}, set(){}, open(){}, close(){} };
    }catch(_){
      return { destroy(){}, set(){}, open(){}, close(){} };
    }
  }
  fp.l10ns = { zh: {} };
  window.flatpickr = fp;
})(); 
