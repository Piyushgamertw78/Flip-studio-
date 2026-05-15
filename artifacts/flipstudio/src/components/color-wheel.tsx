import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Props { value: string; onChange: (color: string) => void; className?: string; }

function hexToHsv(hex: string): [number,number,number] {
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let hue=0;
  if(d!==0){if(max===r)hue=((g-b)/d)%6;else if(max===g)hue=(b-r)/d+2;else hue=(r-g)/d+4;hue=hue*60;if(hue<0)hue+=360;}
  return [hue,max===0?0:d/max,max];
}
function hsvToHex(h:number,s:number,v:number):string {
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}
  else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
  return '#'+[r+m,g+m,b+m].map(val=>Math.round(val*255).toString(16).padStart(2,'0')).join('');
}

const PRESETS=["#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#a3a3a3","#78350f","#1e1b4b","#0f172a","#fdf4ff","#fff7ed","#f0fdf4","#eff6ff"];

export function ColorWheel({ value, onChange, className }: Props) {
  const svRef=useRef<HTMLCanvasElement>(null);
  const hueRef=useRef<HTMLCanvasElement>(null);
  const [hsv,setHsv]=useState<[number,number,number]>(()=>hexToHsv(value||'#000000'));
  const [hexInput,setHexInput]=useState(value||'#000000');
  const svDown=useRef(false),hueDown=useRef(false);
  const W=200,SH=150,HH=16;

  useEffect(()=>{if(/^#[0-9a-fA-F]{6}$/.test(value)){setHsv(hexToHsv(value));setHexInput(value);}},[value]);

  useEffect(()=>{
    const c=svRef.current;if(!c)return;
    const ctx=c.getContext('2d')!;
    ctx.clearRect(0,0,W,SH);
    const hc='hsl('+hsv[0]+',100%,50%)';
    const gW=ctx.createLinearGradient(0,0,W,0);
    gW.addColorStop(0,'#fff');gW.addColorStop(1,hc);
    ctx.fillStyle=gW;ctx.fillRect(0,0,W,SH);
    const gB=ctx.createLinearGradient(0,0,0,SH);
    gB.addColorStop(0,'rgba(0,0,0,0)');gB.addColorStop(1,'#000');
    ctx.fillStyle=gB;ctx.fillRect(0,0,W,SH);
    const cx=hsv[1]*W,cy=(1-hsv[2])*SH;
    ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();
  },[hsv]);

  useEffect(()=>{
    const c=hueRef.current;if(!c)return;
    const ctx=c.getContext('2d')!;
    const g=ctx.createLinearGradient(0,0,W,0);
    for(let i=0;i<=360;i+=30)g.addColorStop(i/360,'hsl('+i+',100%,50%)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,HH);
    const x=(hsv[0]/360)*W;
    ctx.fillStyle='#fff';ctx.fillRect(x-4,0,8,HH);
    ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.strokeRect(x-4,0,8,HH);
  },[hsv]);

  const pickSV=useCallback((e:React.MouseEvent|React.TouchEvent)=>{
    const c=svRef.current!,r=c.getBoundingClientRect();
    const [cx,cy]='touches' in e?[e.touches[0]!.clientX,e.touches[0]!.clientY]:[(e as React.MouseEvent).clientX,(e as React.MouseEvent).clientY];
    const s=Math.max(0,Math.min(1,(cx-r.left)/r.width));
    const v=Math.max(0,Math.min(1,1-(cy-r.top)/r.height));
    const next:[number,number,number]=[hsv[0],s,v];
    setHsv(next);const hex=hsvToHex(...next);setHexInput(hex);onChange(hex);
  },[hsv,onChange]);

  const pickHue=useCallback((e:React.MouseEvent|React.TouchEvent)=>{
    const c=hueRef.current!,r=c.getBoundingClientRect();
    const cx='touches' in e?e.touches[0]!.clientX:(e as React.MouseEvent).clientX;
    const hue=Math.max(0,Math.min(360,((cx-r.left)/r.width)*360));
    const next:[number,number,number]=[hue,hsv[1],hsv[2]];
    setHsv(next);const hex=hsvToHex(...next);setHexInput(hex);onChange(hex);
  },[hsv,onChange]);

  return (
    <div className={cn("flex flex-col gap-3",className)}>
      <canvas ref={svRef} width={W} height={SH} className="rounded-xl cursor-crosshair touch-none w-full" style={{height:150}}
        onMouseDown={e=>{svDown.current=true;pickSV(e)}} onMouseMove={e=>{if(svDown.current)pickSV(e)}} onMouseUp={()=>{svDown.current=false}}
        onTouchStart={e=>{svDown.current=true;pickSV(e)}} onTouchMove={e=>{if(svDown.current)pickSV(e)}} onTouchEnd={()=>{svDown.current=false}}
      />
      <canvas ref={hueRef} width={W} height={HH} className="rounded cursor-crosshair touch-none w-full" style={{height:22}}
        onMouseDown={e=>{hueDown.current=true;pickHue(e)}} onMouseMove={e=>{if(hueDown.current)pickHue(e)}} onMouseUp={()=>{hueDown.current=false}}
        onTouchStart={e=>{hueDown.current=true;pickHue(e)}} onTouchMove={e=>{if(hueDown.current)pickHue(e)}} onTouchEnd={()=>{hueDown.current=false}}
      />
      <input value={hexInput}
        onChange={e=>{setHexInput(e.target.value);if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)){setHsv(hexToHsv(e.target.value));onChange(e.target.value);}}}
        className="w-full px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/20 text-white font-mono focus:outline-none focus:border-violet-500"
        placeholder="#000000"
      />
      <div className="grid grid-cols-9 gap-1">
        {PRESETS.map(c=>(
          <button key={c} className={cn("w-6 h-6 rounded-md border-2 transition-all hover:scale-110",value===c?"border-violet-400 scale-110":"border-transparent")}
            style={{backgroundColor:c}} onClick={()=>{onChange(c);setHexInput(c);setHsv(hexToHsv(c));}}
          />
        ))}
      </div>
    </div>
  );
}
