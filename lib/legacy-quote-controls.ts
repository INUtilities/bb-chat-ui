// Controls live beside ProseMirror, never inside its parsed/serialized document.
export const LEGACY_QUOTE_REMOVE = 'data-bb-chat-ui-legacy-quote-remove';
export const LEGACY_QUOTE_HOST = 'data-bb-chat-ui-legacy-quote-controls';
export const COMPOSER_LEGACY_QUOTE = '[data-promptbox-editor-scroll] [data-promptbox-editor-content] .ProseMirror blockquote';
const targets = new WeakMap<Element, HTMLElement>();
const controllers = new WeakMap<Document, {add(quote:HTMLElement):void; prune():void}>();

export function legacyQuoteFromButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const button=target.closest(`button[${LEGACY_QUOTE_REMOVE}]`),quote=button&&targets.get(button);
  return quote?.isConnected && !quote.closest('[aria-busy="true"]') ? quote : null;
}
export function decorateLegacyQuote(quote:HTMLElement):void { controllers.get(quote.ownerDocument)?.add(quote); }
export function pruneLegacyQuoteControls(doc:Document):void {controllers.get(doc)?.prune();}

export function installLegacyQuoteControls(doc:Document):()=>void {
 const view=doc.defaultView;if(!view)return()=>{};
 const editors=new Map<HTMLElement,{add(q:HTMLElement):void;prune():void;stop():void}>();
 function release(editor:HTMLElement){editors.get(editor)?.stop();editors.delete(editor);}
 const controller={
  add(quote:HTMLElement){
   if(!quote.matches(COMPOSER_LEGACY_QUOTE)||quote.closest('[aria-busy="true"]'))return;
   const editor=quote.closest<HTMLElement>('.ProseMirror'),wrapper=editor?.closest<HTMLElement>('[data-promptbox-editor-content]');
   if(!editor||!wrapper)return;
   if(editor.getAttribute('contenteditable')==='false'&&!wrapper.hasAttribute('data-promptbox-compact-content'))return;
   let state=editors.get(editor);
   if(!state){
    const host=doc.createElement('div');host.setAttribute(LEGACY_QUOTE_HOST,'');host.contentEditable='false';
    const position=wrapper.style.position,changedPosition=['','static'].includes(view!.getComputedStyle(wrapper).position);
    if(changedPosition)wrapper.style.position='relative';wrapper.append(host);
    const buttons=new Map<HTMLElement,HTMLButtonElement>();let frame=0;
    const prune=()=>{for(const[q,b]of buttons)if(!q.isConnected||!editor.contains(q)){size?.unobserve(q);targets.delete(b);b.remove();buttons.delete(q);}if(!buttons.size)release(editor);};
    const measure=()=>{frame=0;prune();if(!buttons.size)return;const origin=wrapper.getBoundingClientRect();
      const rows=[...buttons].map(([q,b])=>{const r=q.getBoundingClientRect(),s=view!.getComputedStyle(b);return{b,left:r.right-origin.left-parseFloat(s.width)-(parseFloat(s.getPropertyValue('--bb-chat-ui-legacy-remove-inset'))||3),top:r.top-origin.top+r.height/2};});
      for(const{b,left,top}of rows){if(b.style.left!==`${left}px`)b.style.left=`${left}px`;if(b.style.top!==`${top}px`)b.style.top=`${top}px`;}
    };
    const schedule=()=>{if(!frame)frame=view!.requestAnimationFrame(measure);};
    const size=typeof view!.ResizeObserver==='function'?new view!.ResizeObserver(schedule):null;
    size?.observe(wrapper);size?.observe(editor);
    const content=new view!.MutationObserver(schedule);content.observe(editor,{subtree:true,childList:true,characterData:true});
    state={add(q){if(buttons.has(q))return;const b=doc.createElement('button');b.type='button';b.contentEditable='false';b.setAttribute(LEGACY_QUOTE_REMOVE,'');b.setAttribute('aria-label','인용 삭제');b.title='인용 삭제';targets.set(b,q);buttons.set(q,b);host.append(b);size?.observe(q);measure();},prune,stop(){if(frame)view!.cancelAnimationFrame(frame);content.disconnect();size?.disconnect();for(const b of buttons.values())targets.delete(b);buttons.clear();host.remove();if(changedPosition&&wrapper.style.position==='relative')wrapper.style.position=position;}};
    editors.set(editor,state);
   }
   state.add(quote);
  },prune(){for(const[e,s]of editors){if(!e.isConnected)release(e);else s.prune();}}
 };
 controllers.set(doc,controller);
 for(const q of Array.from(doc.querySelectorAll<HTMLElement>(COMPOSER_LEGACY_QUOTE)))controller.add(q);
 return()=>{controllers.delete(doc);for(const editor of [...editors.keys()])release(editor);};
}
