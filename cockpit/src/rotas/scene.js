import skyUrl from './sky.jpg';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const canvas = document.querySelector('canvas');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');
const tools = document.querySelector('#controls');
function start() {
const mobile = matchMedia('(pointer: coarse)').matches;
const renderer = new T.WebGLRenderer({canvas,antialias:!mobile});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile ? 1 : 1.6));
renderer.shadowMap.enabled=!mobile;
renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
const scene=new T.Scene();
scene.background=new T.Color(0xe7c395);
scene.fog=new T.FogExp2(0xe7c395,0.014);
new T.TextureLoader().load(skyUrl, texture=>{
  texture.colorSpace=T.SRGBColorSpace;
  texture.mapping=T.EquirectangularReflectionMapping;
  scene.background=texture;
});
scene.backgroundRotation.y=-.37;
const camera=new T.PerspectiveCamera(43,1,.1,130);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.minDistance=4; controls.maxDistance=46;
controls.maxPolarAngle=Math.PI*.487;
const sun=new T.DirectionalLight(0xffd29d,3.7);
sun.position.set(-16,12,12); sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);
Object.assign(sun.shadow.camera,{left:-27,right:27,top:27,bottom:-27,near:1,far:70});
sun.shadow.normalBias=.035;
scene.add(sun,new T.HemisphereLight(0xd7edff,0x7d6449,2.25));
const bounce=new T.DirectionalLight(0xffbd84,.48);
bounce.position.set(8,3,10);
scene.add(bounce);
const material=(color,roughness=.86)=>new T.MeshStandardMaterial({color,roughness});
const stone=material(0xc8995e), trim=material(0xe4b77b), shade=material(0x4a332c);
const brass=material(0x9b632f,.48), wood=material(0x845232), teal=material(0x236d70);
const tiles=[0x296b67,0x377d74,0x45877a,0x286e73,0x4f8d7d].map(c=>material(c));
const ground=[0xc6a372,0xbb9a67,0xc8a976,0xd1ae7d,0xb99463].map(c=>material(c));
const greens=[0x526e38,0x637e42,0x78874b,0x394e2d].map(c=>material(c));
const glass=material(0x1e5655,.28), water=material(0x388f89,.23);
let seed=142;
function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const pick=list=>list[Math.floor(rand()*list.length)];
const ball=new T.SphereGeometry(1,12,8), rock=new T.IcosahedronGeometry(1,0), cube=new T.BoxGeometry(1,1,1);
function mesh(geo,mat,x,y,z,sx=1,sy=1,sz=1,parent=scene){
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
const box=(mat,x,y,z,w,h,d,g)=>mesh(cube,mat,x,y,z,w,h,d,g);
function cylinder(mat,x,y,z,r,h,g,bottom=r){return mesh(new T.CylinderGeometry(r,bottom,h,36),mat,x,y,z,1,1,1,g);}
function torus(mat,x,y,z,r,t,g,horizontal=false){
 const m=mesh(new T.TorusGeometry(r,t,8,48),mat,x,y,z,1,1,1,g);if(horizontal)m.rotation.x=Math.PI/2;return m;
}
function arch(w,h){
 const s=new T.Shape();s.moveTo(-w,0);s.lineTo(w,0);s.lineTo(w,h-w);s.absarc(0,h-w,w,0,Math.PI,false);s.closePath();return s;
}
function opening(g,x,y,z,w,h,door=false){
 const outer=arch(w+.17,h+.19);outer.holes.push(arch(w,h));
 mesh(new T.ExtrudeGeometry(outer,{depth:.13,bevelEnabled:false,curveSegments:16}),trim,x,y,z,1,1,1,g);
 mesh(new T.ShapeGeometry(arch(w,h)),door?wood:glass,x,y,z-.008,1,1,1,g);
 if(door){
   for(let i=-3;i<=3;i++)box(shade,x+i*w*.23,y+(h-w)*.5,z+.018,.023,h-w,.032,g);
   mesh(ball,glass,x,y+h-w+.1,z+.03,w*.46,w*.58,.04,g);
   mesh(ball,brass,x+w*.7,y+1,z+.07,.055,.055,.044,g);
 }
}
function dome(g,x,y,z,r,h){
 cylinder(trim,x,y,z,r*1.05,.19,g);
 mesh(new T.SphereGeometry(1,48,30,0,Math.PI*2,0,Math.PI/2),teal,x,y+.09,z,r,h,r,g);
 for(let row=0;row<9;row++){
   const phi=(row+.5)*Math.PI/18;
   const count=Math.max(6,Math.round(34*Math.sin(phi)));
   for(let i=0;i<count;i++){
     const a=(i+(row%2)*.5)*2*Math.PI/count;
     const tile=mesh(rock,pick(tiles),x+Math.sin(a)*r*Math.sin(phi),y+.09+h*Math.cos(phi),z+Math.cos(a)*r*Math.sin(phi),r*.092,r*.044,r*.09,g);
     tile.rotation.y=a;
   }
 }
 cylinder(brass,x,y+h+.23,z,.045,.36,g);
 mesh(ball,brass,x,y+h+.12,z,.12,.13,.12,g);
}
function foliage(g,x,y,z,scale=.3){
 for(let i=0;i<5;i++)mesh(rock,pick(greens),x+(rand()-.5)*scale,y+rand()*scale*.7,z+(rand()-.5)*scale,scale*(.4+rand()*.5),scale*.54,scale*.48,g);
}
function house(x,z,scale,eye=false){
 const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);
 cylinder(stone,0,2.55,0,2.52,5.1,g);
 box(stone,0,2.43,1.69,3.05,4.86,1.31,g);
 for(const side of [-1,1]){
   cylinder(stone,side*2.35,1.65,-.32,1.35,3.3,g);dome(g,side*2.35,3.3,-.32,1.46,1.02);
   opening(g,side*2.48,1.07,.98,.39,1.47);
   for(let i=0;i<17;i++)foliage(g,side*(1.57+Math.sin(i*.45)*.26),4.8-i*.25,2.39,.25);
 }
 for(let i=0;i<5;i++)box(trim,0,.08+i*.127,3.7-i*.22,2.85-i*.14,.16,.52,g);
 opening(g,0,.64,2.36,.96,2.82,true);
 opening(g,-.99,3.65,2.36,.22,.76);opening(g,.99,3.65,2.36,.22,.76);
 if(eye){
   const eyeShape=new T.Shape();eyeShape.moveTo(-.77,0);eyeShape.quadraticCurveTo(0,.8,.77,0);eyeShape.quadraticCurveTo(0,-.66,-.77,0);
   mesh(new T.ExtrudeGeometry(eyeShape,{depth:.08,bevelEnabled:false}),trim,0,4.09,2.39,1,1,1,g);
   mesh(new T.ShapeGeometry(eyeShape),glass,0,4.09,2.49,.86,.82,1,g);
   mesh(ball,teal,0,4.09,2.54,.27,.34,.052,g);
   mesh(ball,shade,0,4.09,2.59,.125,.22,.035,g);
 }
 dome(g,0,5.1,0,2.67,2.16);
 for(let i=0;i<30;i++){
   const a=rand()*Math.PI*2;
   foliage(g,Math.sin(a)*(2.6+rand()*.35),.16,Math.cos(a)*(2.4+rand()*.5),.26+rand()*.45);
 }
}
house(0,-5.6,1,true);house(-6.2,-3.9,.63);house(6,-4.1,.66);
for(let iz=-16;iz<=15;iz++)for(let ix=-13;ix<=13;ix++){
 const x=ix*.91+(iz%2)*.45,z=iz*.77;
 if(x*x/160+z*z/173>1)continue;
 const p=box(pick(ground),x,-.1,z,.89,.18,.748);p.rotation.y=(rand()-.5)*.05;
}
for(const [cx,cz] of [[-5,3.3],[5,3.3],[-6,-.8],[6,-.8],[-2.7,8],[2.7,8]]){
 const points=[];
 for(let i=0;i<=55;i++){const a=i/55*7.9,r=.05+i*.027;points.push(new T.Vector3(cx+Math.cos(a)*r,.005,cz+Math.sin(a)*r));}
 mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),55,.105,6,false),teal,0,0,0,1,.08,1);
}
cylinder(stone,0,.24,1.6,1.63,.52);
cylinder(water,0,.49,1.6,1.46,.05);
torus(trim,0,.52,1.6,1.54,.113,scene,true);
cylinder(brass,0,.69,1.6,.23,.46);
mesh(ball,teal,0,1.1,1.6,.36,.34,.36);
const drops=[];
for(let i=0;i<30;i++)drops.push(mesh(ball,material(0x91d6cc,.25),0,1.2,1.6,.036,.045,.036));
function stall(x,z){
 const g=new T.Group();g.position.set(x,0,z);g.rotation.y=.13;scene.add(g);
 box(wood,0,.54,0,2.64,1.06,1.54,g);
 box(trim,0,1.06,0,2.85,.14,1.73,g);
 for(const a of [-1,1])for(const b of [-1,1])box(wood,a*1.19,1.57,b*.69,.13,2.83,.13,g);
 for(let i=0;i<3;i++)box(teal,(i-1)*.79,.48,.788,.69,.57,.035,g);
 const cloth=new T.ConeGeometry(1,1.06,4,1,true);cloth.rotateY(Math.PI/4);
 mesh(cloth,teal,0,2.72,0,2.22,1,1.39,g);
 for(let i=0;i<27;i++)mesh(ball,pick([greens[1],brass,materialOrange]),(rand()-.5)*2.1,1.22+rand()*.1,(rand()-.5)*1.17,.13,.12,.13,g);
}
const materialOrange=material(0xc47735);
stall(-3.4,5.7);stall(5.5,2.7);
for(const x of [-8.7,8.7,-5.6,5.6]){
 const z=x<0?7.5:6.8;
 cylinder(brass,x,1.26,z,.048,2.5);
 box(trim,x,2.51,z,.23,.32,.23);
 mesh(new T.ConeGeometry(.24,.24,4),teal,x,2.79,z);
}
for(let i=0;i<60;i++){
 const side=i%2?1:-1;
 const x=side*(8.5+rand()*3.9),z=-1+rand()*11;
 foliage(scene,x,.02,z,.35+rand()*.83);
}
cylinder(material(0x637d53),0,-.4,0,24,.4);
scene.updateMatrixWorld(true);
const batches=new Map();
const moving=new Set(drops);
const staticMeshes=[];
scene.traverse(object=>{
 if(!object.isMesh||moving.has(object))return;
 const geometry=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrixWorld);
 if(!batches.has(object.material))batches.set(object.material,[]);
 batches.get(object.material).push(geometry);
 staticMeshes.push(object);
});
for(const object of staticMeshes)object.removeFromParent();
for(const [mat,geometries] of batches){
 const combined=mergeGeometries(geometries);
 mesh(combined,mat,0,0,0);
 for(const geometry of geometries)geometry.dispose();
}
for(const drop of drops)drop.castShadow=false;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=true;
const views={
 overview:[[11,9.5,17],[0,2.6,-1.6]],
 arrival:[[4.4,2.5,12.2],[0,2.5,-3.4]],
 facade:[[3.4,3.6,5.3],[0,3.1,-4.1]],
};
let travel=null;
function view(name,instant=false){
 const [position,target]=views[name];
 if(instant){camera.position.fromArray(position);controls.target.fromArray(target);controls.update();return;}
 travel={from:camera.position.clone(),target:controls.target.clone(),to:new T.Vector3(...position),focus:new T.Vector3(...target),time:performance.now()};
}
controls.addEventListener('start',()=>{travel=null;});
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
view('overview',true);
new ResizeObserver(()=>{
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}).observe(canvas);
let shown=false;
canvas.addEventListener('webglcontextlost', event=>{
 event.preventDefault();
 shown=false;
 preview.hidden=false;
 tools.hidden=true;
 status.hidden=false;
 status.textContent='La 3D a été interrompue. Voici la vue de la place.';
});
renderer.setAnimationLoop(time=>{
 if(renderer.getContext().isContextLost())return;
 if(travel){
   const p=Math.min(1,(time-travel.time)/1200),e=p*p*(3-2*p);
   camera.position.lerpVectors(travel.from,travel.to,e);
   controls.target.lerpVectors(travel.target,travel.focus,e);
   if(p===1)travel=null;
 }
 drops.forEach((m,i)=>{
   const p=(time/1800+i/drops.length)%1,a=i*2.39996;
   m.position.set(Math.cos(a)*p*.94,1.06+Math.sin(Math.PI*p)*.6-p*.56,1.6+Math.sin(a)*p*.94);
 });
 controls.update();renderer.render(scene,camera);
 if(!shown&&canvas.width>0&&canvas.height>0){
   shown=true;
   preview.hidden=true;
   tools.hidden=false;
   status.hidden=true;
 }
});
}
try{start()}catch(error){status.textContent='La 3D interactive est indisponible dans ce navigateur. Tu peux voir la place sur l’image.';console.error(error);}
