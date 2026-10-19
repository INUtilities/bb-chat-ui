import { popoverRise } from "./motion.ts";

const OPEN_QUEUE = 'section[aria-label="Queued messages"][data-bb-chat-ui-info-open="queue"]';
const MORE = 'button[aria-label^="Queued message "][aria-label$=" actions"]';
const GROUP = 'button[aria-label="Messages above send together"]';
let serial=0;

export function attachQueueControls(stack:HTMLElement) {
  const document=stack.ownerDocument,view=document.defaultView!;
  const originals=new Map<HTMLElement,Map<string,string|null>>();
  let popup:HTMLElement|null=null,anchor:HTMLButtonElement|null=null,motion:Animation|null=null;
  let observedQueue:HTMLElement|null=null;
  let observedDevice:string|null=null;
  let editor:HTMLElement|null=null,saveIcon:SVGElement|null=null,editorMotion:Animation|null=null;
  const cancelEditor=()=>editor?.querySelector<HTMLButtonElement>('button[aria-label="Stop editing queued message"]')?.click();
  const nativeSave=()=>editor?.querySelector<HTMLButtonElement>('[data-promptbox-submit-action],button[type="submit"]')??null;
  const set=(node:HTMLElement,key:string,value:string|null)=>{
    if(node.getAttribute(key)===value)return;
    let attrs=originals.get(node);if(!attrs){attrs=new Map();originals.set(node,attrs);}
    if(!attrs.has(key))attrs.set(key,node.getAttribute(key));
    if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);
  };
  const close=(focus=false)=>{
    const button=anchor;anchor=null;motion?.cancel();motion=null;popup?.remove();popup=null;
    if(button){set(button,'aria-expanded','false');set(button,'aria-controls',null);if(focus&&button.isConnected)button.focus({preventScroll:true});}
  };
  const onOutside=(event:PointerEvent)=>{
    const node=event.target as Node;
    if(popup&&!popup.contains(node)&&!anchor?.contains(node))close();
  };
  const onKey=(event:KeyboardEvent)=>{
    if(popup&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);return;}
    if(editor&&event.key==='Escape'&&!event.isComposing&&!editor.querySelector('[class~="@container/mention-menu"],button[aria-expanded="true"]')){event.preventDefault();event.stopImmediatePropagation();close();cancelEditor();return;}
    if(!popup)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);return;}
    const buttons=Array.from(popup.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End','Tab'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)||event.key==='Tab'&&event.shiftKey?-1:1)+buttons.length)%buttons.length;
      buttons[next]?.focus();
    }
  };
  const onScroll=(event:Event)=>{if(popup&&!popup.contains(event.target as Node))close();};
  const syncWidth=()=>{
    if(!observedQueue)return;
    observedDevice=document.documentElement.getAttribute('data-bb-chat-ui-root-device');
    const inline=observedDevice==='desktop'&&observedQueue.offsetWidth>=340;
    set(observedQueue,'data-bb-chat-ui-queue-inline-actions',String(inline));
    if(inline&&popup)close();
  };
  const resize=typeof view.ResizeObserver==='function'?new view.ResizeObserver(syncWidth):null;
  const onResize=()=>{close();syncWidth();};
  const onClick=(event:MouseEvent)=>{
    const target=event.target instanceof view.Element?event.target:null;
    const button=target?.closest<HTMLButtonElement>(MORE),queue=button?.closest<HTMLElement>(OPEN_QUEUE);
    if(!button||!queue||!stack.contains(queue))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.disabled||button.getAttribute('aria-disabled')==='true')return;
    if(anchor===button){close(true);return;}
    close();
    const row=button.closest('[data-queued-message-row]');
    const actions=Array.from(row?.querySelectorAll<HTMLButtonElement>('[data-queued-message-actions] button')??[]);
    if(!actions.length)return;
    anchor=button;popup=document.createElement('div');popup.id=`bb-queue-actions-${++serial}`;
    popup.setAttribute('data-bb-chat-ui-queue-menu','');popup.setAttribute('role','menu');popup.setAttribute('aria-label','대기 메시지 작업');
    popup.style.setProperty('--bb-chat-ui-glass-base',view.getComputedStyle(queue).getPropertyValue('--bb-chat-ui-glass-base')||'var(--background)');
    for(const original of actions){
      const proxy=document.createElement('button');proxy.type='button';proxy.setAttribute('role','menuitem');
      proxy.setAttribute('aria-label',original.getAttribute('aria-label')??original.textContent??'');proxy.title=proxy.getAttribute('aria-label')!;
      proxy.disabled=original.disabled||original.getAttribute('aria-disabled')==='true';
      for(const child of Array.from(original.childNodes))proxy.append(child.cloneNode(true));
      proxy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      proxy.addEventListener('click',()=>{if(!original.isConnected||original.disabled||original.getAttribute('aria-disabled')==='true'){close(true);return;}close();original.click();});
      popup.append(proxy);
    }
    document.body.append(popup);
    set(button,'aria-haspopup','menu');set(button,'aria-expanded','true');set(button,'aria-controls',popup.id);
    const r=button.getBoundingClientRect(),p=popup.getBoundingClientRect();
    popup.style.left=`${Math.max(8,Math.min(r.right-p.width,view.innerWidth-p.width-8))}px`;
    popup.style.top=`${Math.max(8,r.top-p.height-8>=8?r.top-p.height-8:Math.min(r.bottom+8,view.innerHeight-p.height-8))}px`;
    motion=popoverRise(popup);popup.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
  };
  stack.addEventListener('click',onClick,true);
  document.addEventListener('pointerdown',onOutside,true);
  document.addEventListener('keydown',onKey,true);
  document.addEventListener('scroll',onScroll,true);
  view.addEventListener('resize',onResize);
  const sync=()=>{
      const queue=stack.querySelector<HTMLElement>(OPEN_QUEUE);
      if(queue!==observedQueue){resize?.disconnect();observedQueue=queue;if(queue)resize?.observe(queue);syncWidth();}
      else if(observedDevice!==document.documentElement.getAttribute('data-bb-chat-ui-root-device'))syncWidth();
      const nextEditor=queue?.querySelector<HTMLElement>('[data-queued-message-inline-editor]')??null;
      if(editor!==nextEditor){
        editorMotion?.cancel();editorMotion=null;saveIcon?.remove();saveIcon=null;editor=nextEditor;
        if(editor){
          close();
          set(editor,'role','dialog');set(editor,'aria-label','대기 메시지 편집');
          editorMotion=popoverRise(editor);
        }
      }
      if(queue)set(queue,'data-bb-chat-ui-queue-editing',String(!!editor));
      if(editor){
        // Flatten only the old queue viewport. Keep measurable composer boxes and native controls.
        for(let node=editor.parentElement;node&&node!==queue;node=node.parentElement)set(node,'data-bb-chat-ui-queue-editor-pass','');
        const form=editor.querySelector<HTMLElement>('[data-promptbox]');
        for(let node=form;node&&node!==editor;node=node.parentElement)set(node,'data-bb-chat-ui-queue-editor-flow','');
        const composer=form?.closest<HTMLElement>('[data-follow-up-composer]');
        if(composer&&editor.contains(composer))set(composer,'data-bb-chat-ui-queue-editor-toolbar','');
        const cancel=editor.querySelector<HTMLButtonElement>('button[aria-label="Stop editing queued message"]');
        if(cancel)set(cancel,'data-bb-chat-ui-queue-edit-cancel','');
        const save=nativeSave();
        if(save){
          set(save,'data-bb-chat-ui-queue-edit-save','');set(save,'aria-label','대기 메시지 저장');set(save,'title','저장');
          if(!saveIcon||saveIcon.parentElement!==save){
            saveIcon?.remove();
            saveIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
            saveIcon.setAttribute('data-bb-chat-ui-queue-save-icon','');saveIcon.setAttribute('aria-hidden','true');saveIcon.setAttribute('viewBox','0 0 24 24');saveIcon.setAttribute('fill','none');
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M5 12l4 4L19 6');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.5');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');saveIcon.append(path);save.append(saveIcon);
          }
        }
      }
      if(anchor&&(!anchor.isConnected||anchor.disabled||!anchor.closest(OPEN_QUEUE)))close();
      for(const node of originals.keys())if(!node.isConnected)originals.delete(node);
      for(const button of Array.from(stack.querySelectorAll<HTMLButtonElement>(`${OPEN_QUEUE} ${MORE}`)))set(button,'aria-haspopup','menu');
      for(const button of Array.from(stack.querySelectorAll<HTMLButtonElement>(`${OPEN_QUEUE} ${GROUP}`))){
        const divider=button.closest('[data-queued-message-group-divider]');let count=0;
        for(let row=divider?.previousElementSibling;row;row=row.previousElementSibling)if(row.hasAttribute('data-queued-message-row')||row.hasAttribute('data-queued-message-inline-editor'))count++;
        set(button,'data-bb-chat-ui-queue-grouped',String(count>1));
        if(divider?.parentElement)set(divider.parentElement,'data-bb-chat-ui-queue-end-boundary',String(divider.parentElement.lastElementChild===divider));
      }
  };
  return {
    sync, close,
    cleanup(){
      close();
      editorMotion?.cancel();editorMotion=null;saveIcon?.remove();saveIcon=null;editor=null;
      resize?.disconnect();
      stack.removeEventListener('click',onClick,true);document.removeEventListener('pointerdown',onOutside,true);document.removeEventListener('keydown',onKey,true);document.removeEventListener('scroll',onScroll,true);view.removeEventListener('resize',onResize);
      for(const [node,attrs]of originals)for(const[key,value]of attrs){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}
      originals.clear();
    },
  };
}
