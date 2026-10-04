/**
 * PROTOVIUM — Compact Cube Field
 * Cubes, globe-drag, golden particles, page transitions.
 */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('hologram-canvas');
  if (!canvas) return;

  const C_NEUTRAL = new THREE.Color(0x9ba8b2);
  const C_ACTIVE  = new THREE.Color(0x4c9ff0);
  const BG        = 0xfcfbf9;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BG, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.5);
  d1.position.set(5, 8, 8); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xc8dff5, 0.25);
  d2.position.set(-6, -3, 3); scene.add(d2);

  const group = new THREE.Group();
  scene.add(group);

  // ── Globe rotation ─────────────────────────────────────────────────────────
  const qCurrent = new THREE.Quaternion();
  qCurrent.setFromEuler(new THREE.Euler(-0.25, 0.4, 0.05));
  let isDragging = false, prevX = 0, prevY = 0, velX = 0, velY = 0;
  const DRAG = 0.006, INERTIA = 0.90, AUTO_SPD = 0.0015;
  let autoRot = true, autoTimer;
  const autoAxis = new THREE.Vector3(0.15, 1, 0.08).normalize();

  function applyDelta(dx, dy) {
    const a = Math.sqrt(dx*dx+dy*dy)*DRAG;
    if (a < 0.0001) return;
    qCurrent.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dy,dx,0).normalize(), a)
    );
  }

  const raycaster = new THREE.Raycaster();
  const mouseNDC  = new THREE.Vector2(9999, 9999);

  function sr(s) { const x = Math.sin(s*1.7+2.3)*43758.5453; return x-Math.floor(x); }

  function getGrid() {
    const w = window.innerWidth;
    if (w < 480)  return { n:5, sp:1.15 };
    if (w < 768)  return { n:6, sp:1.15 };
    if (w < 1200) return { n:7, sp:1.12 };
    return              { n:8, sp:1.10 };
  }

  let mesh=null, count=0, instData=[], instPos=null;
  const dummy=new THREE.Object3D(), cBuf=new THREE.Color();

  function buildField() {
    if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    instData=[]; instPos=null;
    const {n,sp} = getGrid();
    count = n*n*n;
    const geo = new THREE.BoxGeometry(0.72,0.72,0.72);
    const mat = new THREE.MeshPhongMaterial({
      color:0xffffff, shininess:45, specular:new THREE.Color(0x99bbdd)
    });
    mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count*3),3);
    instPos = new Float32Array(count*3);
    const off = (n-1)*sp*0.5;
    let i=0;
    for (let z=0;z<n;z++) for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
      const s=x+y*100+z*10000;
      const px=x*sp-off+(sr(s)-0.5)*0.06;
      const py=y*sp-off+(sr(s+3000)-0.5)*0.06;
      const pz=z*sp-off+(sr(s+7000)-0.5)*0.06;
      const sc=0.88+sr(s+200)*0.12;
      dummy.position.set(px,py,pz);
      dummy.rotation.set((sr(s+600)-0.5)*0.18,(sr(s+700)-0.5)*0.18,(sr(s+800)-0.5)*0.10);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      cBuf.copy(C_NEUTRAL); mesh.setColorAt(i, cBuf);
      instPos[i*3]=px; instPos[i*3+1]=py; instPos[i*3+2]=pz;
      instData.push({
        inf:0, cr:C_NEUTRAL.r, cg:C_NEUTRAL.g, cb:C_NEUTRAL.b,
        bx:px, by:py, bz:pz,
        sx:0, sy:0, sz:0, bsc:sc,
        brx:(sr(s+600)-0.5)*0.18, bry:(sr(s+700)-0.5)*0.18, brz:(sr(s+800)-0.5)*0.10
      });
      i++;
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.instanceColor.needsUpdate=true;
    group.add(mesh);
  }

  function positionCamera() {
    const {n,sp}=getGrid(), sz=n*sp;
    const ox = window.innerWidth>900 ? sz*0.28 : 0;
    camera.position.set(ox,0,sz*1.55);
    camera.lookAt(ox*0.4,0,0);
    camera.updateProjectionMatrix();
  }
  function positionGroup() {
    const w=window.innerWidth;
    group.position.set(w>900?(w>1200?4.5:3.0):0,0,0);
  }
  function onResize() {
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect=window.innerWidth/window.innerHeight;
    positionCamera(); positionGroup();
  }
  let resizeTimer;
  window.addEventListener('resize',()=>{
    onResize(); clearTimeout(resizeTimer); resizeTimer=setTimeout(buildField,250);
  });
  onResize(); buildField(); positionGroup();

  // ── Mouse / touch ──────────────────────────────────────────────────────────
  document.addEventListener('mousemove',e=>{
    mouseNDC.x=(e.clientX/window.innerWidth)*2-1;
    mouseNDC.y=-(e.clientY/window.innerHeight)*2+1;
    if(isDragging){
      const dx=e.clientX-prevX,dy=e.clientY-prevY;
      velX=dx;velY=dy;applyDelta(dx,dy);prevX=e.clientX;prevY=e.clientY;
    }
  });
  document.addEventListener('mousedown',e=>{
    if(e.target!==canvas)return;
    isDragging=true;velX=0;velY=0;prevX=e.clientX;prevY=e.clientY;
    autoRot=false;clearTimeout(autoTimer);e.preventDefault();
  });
  document.addEventListener('mouseup',()=>{
    isDragging=false;clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{autoRot=true;},2000);
  });
  document.addEventListener('touchstart',e=>{
    if(e.target!==canvas||e.touches.length!==1)return;
    isDragging=true;velX=0;velY=0;prevX=e.touches[0].clientX;prevY=e.touches[0].clientY;
    autoRot=false;clearTimeout(autoTimer);
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!isDragging||!e.touches.length)return;
    const dx=e.touches[0].clientX-prevX,dy=e.touches[0].clientY-prevY;
    velX=dx;velY=dy;applyDelta(dx,dy);prevX=e.touches[0].clientX;prevY=e.touches[0].clientY;
    mouseNDC.x=(e.touches[0].clientX/window.innerWidth)*2-1;
    mouseNDC.y=-(e.touches[0].clientY/window.innerHeight)*2+1;
  },{passive:true});
  document.addEventListener('touchend',()=>{
    isDragging=false;clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{autoRot=true;},2000);
  });

  // ── Golden particles ───────────────────────────────────────────────────────
  const PC=56,pPos=new Float32Array(PC*3),pVel=Array.from({length:PC},()=>({x:0,y:0,z:0})),pLife=new Float32Array(PC);
  let pIdx=0;
  for(let i=0;i<PC;i++){pPos[i*3]=9999;pLife[i]=0;}
  const pGeo=new THREE.BufferGeometry();
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  const pMat=new THREE.PointsMaterial({
    color:0xf0b429,size:window.innerWidth<768?0.12:0.16,sizeAttenuation:true,
    transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending
  });
  const particles=new THREE.Points(pGeo,pMat);
  particles.renderOrder=2; scene.add(particles);
  const cPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-2);
  const cRay=new THREE.Raycaster(),cWorld=new THREE.Vector3();
  function spawnParticle(){
    cRay.setFromCamera(mouseNDC,camera);
    cRay.ray.intersectPlane(cPlane,cWorld);
    if(!cWorld||cWorld.x>9000)return;
    const i=pIdx%PC;pIdx++;
    pPos[i*3]=cWorld.x+(Math.random()-0.5)*0.3;
    pPos[i*3+1]=cWorld.y+(Math.random()-0.5)*0.3;
    pPos[i*3+2]=cWorld.z;pLife[i]=1.0;
    pVel[i]={x:(Math.random()-0.5)*0.03,y:Math.random()*0.04+0.008,z:(Math.random()-0.5)*0.015};
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  const SPREAD=6.0,SPREAD_SQ=SPREAD*SPREAD,C_IN=0.15,C_OUT=0.04;

  // ── Transition state machine ───────────────────────────────────────────────
  // 'idle' | 'scatter' | 'reform'
  let txState='idle', txProgress=0;
  const TX_SCATTER_DUR = 0.50;  // seconds
  const TX_REFORM_DUR  = 0.80;  // seconds

  function easeIn(t)  { return t*t*t; }
  function easeOut(t) { const u=1-t; return 1-u*u*u; }

  function doScatter() {
    const {n,sp}=getGrid(), range=n*sp*2.2;
    for(let i=0;i<count;i++){
      const d=instData[i];
      const angle=Math.random()*Math.PI*2, pitch=(Math.random()-0.5)*Math.PI;
      const dist=range*(0.6+Math.random()*0.8);
      d.sx=d.bx+Math.cos(pitch)*Math.cos(angle)*dist;
      d.sy=d.by+Math.sin(pitch)*dist*0.7;
      d.sz=d.bz+Math.cos(pitch)*Math.sin(angle)*dist*0.5;
    }
    txState='scatter'; txProgress=0;
  }

  function doReform() {
    txState='reform'; txProgress=0;
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  let frame=0;
  const clock=new THREE.Clock();

  function tick(){
    requestAnimationFrame(tick);
    frame++;
    const dt=Math.min(clock.getDelta(),0.05);

    // Rotation
    if(autoRot){
      qCurrent.premultiply(new THREE.Quaternion().setFromAxisAngle(autoAxis,AUTO_SPD));
    } else if(!isDragging&&(Math.abs(velX)>0.01||Math.abs(velY)>0.01)){
      applyDelta(velX,velY); velX*=INERTIA; velY*=INERTIA;
    }
    group.quaternion.copy(qCurrent);

    // ── Transition animation ──────────────────────────────────────────────
    if(txState==='scatter'){
      txProgress=Math.min(1, txProgress+dt/TX_SCATTER_DUR);
      const e=easeIn(txProgress);
      let needMx=false;
      for(let i=0;i<count;i++){
        const d=instData[i];
        dummy.position.set(
          d.bx+(d.sx-d.bx)*e,
          d.by+(d.sy-d.by)*e,
          d.bz+(d.sz-d.bz)*e
        );
        // spin as they fly out
        const spin=e*Math.PI*2;
        dummy.rotation.set(
          d.brx+spin*(sr(i+1)-0.5)*3,
          d.bry+spin*(sr(i+2)-0.5)*3,
          d.brz+spin*(sr(i+3)-0.5)*2
        );
        dummy.scale.setScalar(d.bsc*(1-e*0.5));
        dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); needMx=true;
      }
      if(needMx) mesh.instanceMatrix.needsUpdate=true;
      if(txProgress>=1) txState='idle';
    }

    else if(txState==='reform'){
      txProgress=Math.min(1, txProgress+dt/TX_REFORM_DUR);
      const e=easeOut(txProgress);
      let needMx=false;
      for(let i=0;i<count;i++){
        const d=instData[i];
        // fly from scatter position back to base
        dummy.position.set(
          d.sx+(d.bx-d.sx)*e,
          d.sy+(d.by-d.sy)*e,
          d.sz+(d.bz-d.sz)*e
        );
        // unwind spin
        const spin=(1-e)*Math.PI*2;
        dummy.rotation.set(
          d.brx+spin*(sr(i+1)-0.5)*3,
          d.bry+spin*(sr(i+2)-0.5)*3,
          d.brz+spin*(sr(i+3)-0.5)*2
        );
        dummy.scale.setScalar(d.bsc*(0.5+e*0.5));
        dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); needMx=true;
      }
      if(needMx) mesh.instanceMatrix.needsUpdate=true;
      if(txProgress>=1){
        txState='idle';
        // Restore exact base matrices
        for(let i=0;i<count;i++){
          const d=instData[i];
          dummy.position.set(d.bx,d.by,d.bz);
          dummy.rotation.set(d.brx,d.bry,d.brz);
          dummy.scale.setScalar(d.bsc);
          dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
      }
    }

    // ── Raycast + color (idle only) ───────────────────────────────────────
    else {
      raycaster.setFromCamera(mouseNDC,camera);
      const hits=mesh?raycaster.intersectObject(mesh):[];
      let hitPt=null;
      if(hits.length>0){
        hitPt=hits[0].point.clone(); group.worldToLocal(hitPt);
        const hid=hits[0].instanceId;
        if(hid!==undefined&&instData[hid]) instData[hid].inf=1.0;
      }
      let needC=false;
      for(let i=0;i<count;i++){
        const d=instData[i]; let target=0;
        if(hitPt&&instPos){
          const dx=instPos[i*3]-hitPt.x,dy=instPos[i*3+1]-hitPt.y,dz=instPos[i*3+2]-hitPt.z;
          const dSq=dx*dx+dy*dy+dz*dz;
          if(dSq<SPREAD_SQ){const t2=1-Math.sqrt(dSq)/SPREAD;target=t2*t2;}
        }
        const spd=target>d.inf?C_IN:C_OUT;
        d.inf+=(target-d.inf)*spd;
        const nr=C_NEUTRAL.r+(C_ACTIVE.r-C_NEUTRAL.r)*d.inf;
        const ng=C_NEUTRAL.g+(C_ACTIVE.g-C_NEUTRAL.g)*d.inf;
        const nb=C_NEUTRAL.b+(C_ACTIVE.b-C_NEUTRAL.b)*d.inf;
        if(Math.abs(nr-d.cr)>0.0005||Math.abs(ng-d.cg)>0.0005||Math.abs(nb-d.cb)>0.0005){
          d.cr=nr;d.cg=ng;d.cb=nb;cBuf.setRGB(nr,ng,nb);mesh.setColorAt(i,cBuf);needC=true;
        }
      }
      if(needC) mesh.instanceColor.needsUpdate=true;
    }

    // ── Particles ─────────────────────────────────────────────────────────
    if(frame%3===0) spawnParticle();
    let needP=false,totalLife=0;
    for(let i=0;i<PC;i++){
      if(pLife[i]<=0)continue;
      pLife[i]-=0.028;
      if(pLife[i]<0){pLife[i]=0;pPos[i*3]=9999;needP=true;continue;}
      pPos[i*3]+=pVel[i].x;pPos[i*3+1]+=pVel[i].y;pPos[i*3+2]+=pVel[i].z;
      pVel[i].x*=0.95;pVel[i].y*=0.96;pVel[i].z*=0.95;
      totalLife+=pLife[i];needP=true;
    }
    pMat.opacity=Math.min(0.92,(totalLife/PC)*10);
    if(needP) pGeo.attributes.position.needsUpdate=true;

    renderer.render(scene,camera);
  }

  tick();

  // ── Public API ─────────────────────────────────────────────────────────────
  window.hologram = { scatter: doScatter, reform: doReform };

})();
