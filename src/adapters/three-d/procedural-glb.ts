/**
 * Zero-credit procedural Creature-Sync Console GLB.
 * Deterministic, native to Cloudflare Workers: no provider keys, no fetch,
 * no Mistral quota, no remote job, no publisher runtime dependency.
 *
 * This is a geometric BLOCKOUT, not photogrammetry. Screen motifs are colored
 * geometry (the high-detail Python offline model is distributed separately).
 */
type V = [number,number,number];
type C = [number,number,number,number];
const P = {stone:[.75,.59,.39,1] as C, dark:[.055,.075,.11,1] as C,
  metal:[.15,.18,.22,1] as C, brass:[.77,.50,.20,1] as C,
  gold:[.95,.76,.35,1] as C, cyan:[.10,.78,.98,1] as C,
  purple:[.76,.25,.88,1] as C, blue:[.04,.26,.48,1] as C,
  glass:[.16,.43,.51,1] as C };
const pos:number[] = [], nor:number[] = [], colors:number[] = [];
const add: (a:V,b:V,c:V,color:C) => void = (a,b,c,color) => {
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const l=Math.hypot(...n)||1;
  for(const point of [a,b,c]){
    pos.push(...point);nor.push(n[0]/l,n[1]/l,n[2]/l);colors.push(...color);
  }
};
function box(c:V,s:V,color:C):void{
  const [x,y,z]=c,[w,h,d]=s.map(v=>v/2);
  const p:V[]=[[x-w,y-h,z-d],[x+w,y-h,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
               [x-w,y-h,z+d],[x+w,y-h,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
  for(const q of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],
                  [1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]){
    add(p[q[0]],p[q[1]],p[q[2]],color);
  }
}
function cylinder(a:V,b:V,r:number,color:C,sides=9):void{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],d=Math.hypot(dx,dy,dz);
  if(d<1e-6)return;
  const dir:V=[dx/d,dy/d,dz/d];
  let axis:V=Math.abs(dir[2])<.85?[0,0,1]:[0,1,0];
  let side:V=[dir[1]*axis[2]-dir[2]*axis[1],dir[2]*axis[0]-dir[0]*axis[2],dir[0]*axis[1]-dir[1]*axis[0]];
  const sl=Math.hypot(...side);side=side.map(x=>x/sl) as V;
  axis=[dir[1]*side[2]-dir[2]*side[1],dir[2]*side[0]-dir[0]*side[2],dir[0]*side[1]-dir[1]*side[0]];
  const ring=(origin:V,i:number):V=>{
    const t=i*2*Math.PI/sides;return origin.map((n,j)=>n+r*(side[j]*Math.cos(t)+axis[j]*Math.sin(t))) as V;
  };
  for(let i=0;i<sides;i++){
    const p=ring(a,i),q=ring(a,i+1),s=ring(b,i),t=ring(b,i+1);
    add(p,s,t,color);add(p,t,q,color);add(a,q,p,color);add(b,s,t,color);
  }
}
function rod(a:V,b:V,r:number,c:C):void{ cylinder(a,b,r,c,8); }
function glyph(cx:number,cy:number,cz:number):void{
  const dots:V[]=[];for(let i=0;i<=24;i++){
    const t=Math.PI*2*i/24; dots.push([cx+.24*Math.cos(t),cy,cz+.09*Math.sin(t)]);
  }
  for(let i=0;i<24;i++)rod(dots[i],dots[i+1],.011,P.gold);
  cylinder([cx,cy,cz-.028],[cx,cy,cz+.028],.035,P.gold,16);
}
function init():void{
  // gently arched desktop as many short segments
  for(let j=0;j<30;j++){
    const x=-2.16+4.32*(j+.5)/30;
    const y=.30+.08*(1-(x/2.2)**2);
    box([x,y,1.03],[.155,.91,.11],P.metal);
    box([x,-.22+.19*(1-(x/2.2)**2),1.098],[.155,.045,.012],P.brass);
  }
  for(const sign of [-1,1]){
    const x=sign*1.77;
    box([x,.15,.04],[.76,.67,.08],P.stone);
    for(const [u,v] of [
      [[x-sign*.24,-.23,.08],[x-sign*.14,-.04,.96]],
      [[x+sign*.25,.37,.08],[x+sign*.12,.27,.96]]]){
      cylinder(u as V,v as V,.18,P.stone,12);
    }
    rod([x-sign*.13,-.05,.93],[x+sign*.12,.26,.93],.13,P.stone);
    const sx=sign*2.06;
    cylinder([sx,.55,1.09],[sx,.55,1.54],.10,P.glass,14);
    cylinder([sx,.55,1.05],[sx,.55,1.13],.14,P.brass,14);
    cylinder([sx,.55,1.52],[sx,.55,1.59],.125,P.gold,14);
    cylinder([sx,.55,1.14],[sx,.55,1.47],.012,P.gold,9);
    // mic boom: black-and-brass arm, hanging capsule
    const joints:V[]=[[sign*1.76,.67,1.20],[sign*1.82,.66,1.80],
      [sign*1.33,.50,2.15],[sign*1.13,.47,2.20],[sign*1.03,.43,1.92]];
    for(let i=1;i<joints.length;i++)rod(joints[i-1],joints[i],.018,P.brass);
    cylinder([sign*1.03,.43,1.80],[sign*1.03,.43,1.97],.050,P.metal,12);
    for(let row=0;row<3;row++)for(let k=0;k<6;k++){
      const bx=sign*(.71+k*.13),by=-.18+row*.15;
      box([bx,by,1.11],[.083,.063,.026],(row+k)%5===0?P.cyan:(k===5?P.purple:P.dark));
    }
  }
  for(const [x,w,color] of [[-1.29,1.1,P.purple],[0,1.41,P.blue],[1.29,1.10,P.cyan]] as const){
    const yy=.81;
    box([x,yy,1.67],[w+.05,.12,.72],P.dark);
    box([x,yy-.071,1.67],[w-.06,.017,.61],P.blue);
    box([x,yy-.083,1.67],[w-.11,.004,.54],P.dark);
    // bright non-textured waveform and faux radar screen panels
    const bound=w*.44;
    if(x===0){
      for(const r of [.10,.18,.25]){
        for(let i=0;i<30;i++){
          const p=Math.PI*2*i/30,q=Math.PI*2*(i+1)/30;
          rod([x+r*Math.cos(p),yy-.092,1.67+r*Math.sin(p)],
              [x+r*Math.cos(q),yy-.092,1.67+r*Math.sin(q)],.0038,P.cyan);
        }
      }
      glyph(0,yy-.094,1.67);
    } else {
      for(let i=0;i<38;i++){
        const xx=x-bound+2*bound*i/37;
        const yy2=1.60+.06*Math.sin(i*.7)+.12*Math.sin(i*1.43)*Math.exp(-Math.pow((i-18)/8,2));
        const next=x-bound+2*bound*(i+1)/37;
        const zz=1.60+.06*Math.sin((i+1)*.7)+.12*Math.sin((i+1)*1.43)*Math.exp(-Math.pow(((i+1)-18)/8,2));
        rod([xx,yy-.097,yy2],[next,yy-.097,zz],.004,color);
      }
    }
    box([x,.71,1.23],[.16,.18,.36],P.metal);
  }
  box([0,.03,1.12],[.88,.52,.035],P.dark);
  glyph(0,-.240,.80);
  box([0,-.190,.77],[1.1,.10,.27],P.dark);
  for(let i=0;i<9;i++){
    box([-.4+i*.10,.03,1.147],[.055,.14,.009],i%3?P.blue:P.cyan);
  }
  // mid console fascia + small side equipment
  box([0,-.12,.76],[1.3,.11,.34],P.dark);
  glyph(0,-.181,.77);
  for(const sign of [-1,1]){
    box([sign*1.76,.47,1.13],[.54,.33,.08],P.dark);
    for(let i=0;i<3;i++)box([sign*(1.61+i*.14),.43,1.183],[.075,.2,.009],P.cyan);
  }
}
/** A deterministic GLB; no async pipeline or paid service needed. */
export function buildCreatureSyncProceduralGlb():ArrayBuffer{
  pos.length=0;nor.length=0;colors.length=0;
  init();
  const attributes=[new Float32Array(pos),new Float32Array(nor),new Float32Array(colors)];
  const offsets:number[]=[];let binLength=0;
  for(const a of attributes){offsets.push(binLength);binLength+=a.byteLength;binLength=Math.ceil(binLength/4)*4;}
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<pos.length;i+=3)for(let j=0;j<3;j++){
    bounds.min[j]=Math.min(bounds.min[j],pos[i+j]);
    bounds.max[j]=Math.max(bounds.max[j],pos[i+j]);
  }
  const n=pos.length/3;
  const gltf={
    asset:{version:"2.0",generator:"Blacklace Metaverse Creator procedural v0.1"},
    scene:0, scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"Creature-Sync Console — procedural prototype"}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},material:0}]}],
    materials:[{name:"Procedural vertex-color palette",pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.14,roughnessFactor:.67},doubleSided:true}],
    buffers:[{byteLength:binLength}],
    bufferViews:attributes.map((a,i)=>({buffer:0,byteOffset:offsets[i],byteLength:a.byteLength,target:34962})),
    accessors:[
      {bufferView:0,componentType:5126,count:n,type:"VEC3",min:bounds.min,max:bounds.max},
      {bufferView:1,componentType:5126,count:n,type:"VEC3"},
      {bufferView:2,componentType:5126,count:n,type:"VEC4"},
    ],
  };
  const json=new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJson=Math.ceil(json.length/4)*4;
  const total=12+8+paddedJson+8+binLength;
  const output=new ArrayBuffer(total);const dv=new DataView(output),bytes=new Uint8Array(output);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
  dv.setUint32(12,paddedJson,true);dv.setUint32(16,0x4e4f534a,true);
  bytes.fill(0x20,20,20+paddedJson);bytes.set(json,20);
  const binaryHeader=20+paddedJson;
  dv.setUint32(binaryHeader,binLength,true);
  dv.setUint32(binaryHeader+4,0x004e4942,true);
  const start=binaryHeader+8;
  for(let i=0;i<attributes.length;i++){
    bytes.set(new Uint8Array(attributes[i].buffer),start+offsets[i]);
  }
  return output;
}
