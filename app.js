import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile,
  sendPasswordResetEmail, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
await setPersistence(auth,browserLocalPersistence);

const icons=['✈️','🌴','🏖️','🏔️','🏙️','🚗','🏝️','❤️','👨‍👩‍👧‍👦','👯','🎒','♨️','🍷','🎉','🌍'];
const colors=['#4f7cff','#22a699','#f59e0b','#ef6a6a','#9b6cff','#ec4899','#14b8a6','#64748b'];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let authMode='login', currentUser=null, trips=[], currentId=null, editingId=null, selectedIcon=icons[0], selectedColor=colors[0], selectedImage='';
let unsubTrips=null, unsubTrip=null;

function msg(text,ok=false){$('authMessage').textContent=text||'';$('authMessage').className='auth-message '+(ok?'ok':'')}
function showAuth(){ $('authView').classList.remove('hidden'); $('mainApp').classList.add('hidden'); }
function showApp(){ $('authView').classList.add('hidden'); $('mainApp').classList.remove('hidden'); $('loggedUser').textContent=currentUser?.displayName||currentUser?.email||''; }

function setAuthMode(mode){
  authMode=mode;
  $('loginTab').classList.toggle('active',mode==='login');
  $('registerTab').classList.toggle('active',mode==='register');
  $('authName').style.display=mode==='register'?'block':'none';
  $('authName').required=mode==='register';
  $('authPassword').autocomplete=mode==='register'?'new-password':'current-password';
  $('authSubmit').textContent=mode==='register'?'Crear cuenta':'Entrar';
  msg('');
}
$('loginTab').onclick=()=>setAuthMode('login');
$('registerTab').onclick=()=>setAuthMode('register');
$('togglePasswordBtn').onclick=()=>{const p=$('authPassword');p.type=p.type==='password'?'text':'password';$('togglePasswordBtn').textContent=p.type==='password'?'👁️ Ver contraseña':'🙈 Ocultar contraseña'};
$('resetPasswordBtn').onclick=async()=>{
  const email=$('authEmail').value.trim();
  if(!email){msg('Escribe primero tu email.');return}
  try{await sendPasswordResetEmail(auth,email);msg('Te hemos enviado un correo para restablecer la contraseña.',true)}
  catch(e){msg(authError(e))}
};
$('authForm').onsubmit=async e=>{
  e.preventDefault(); msg('');
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  try{
    $('authSubmit').disabled=true;
    if(authMode==='register'){
      const name=$('authName').value.trim();
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{displayName:name||email.split('@')[0]});
      await setDoc(doc(db,'users',cred.user.uid),{uid:cred.user.uid,name:name||email.split('@')[0],email,createdAt:serverTimestamp()},{merge:true});
    }else await signInWithEmailAndPassword(auth,email,password);
  }catch(e){msg(authError(e))}finally{$('authSubmit').disabled=false}
};
$('logoutBtn').onclick=()=>signOut(auth);

function authError(e){
  const c=e?.code||'';
  if(c.includes('invalid-credential')||c.includes('wrong-password'))return 'Email o contraseña incorrectos.';
  if(c.includes('email-already-in-use'))return 'Ese email ya tiene una cuenta.';
  if(c.includes('weak-password'))return 'La contraseña debe tener al menos 6 caracteres.';
  if(c.includes('invalid-email'))return 'El email no es válido.';
  return 'No se ha podido completar la operación. Comprueba la conexión.';
}

function formatDate(s){if(!s)return '';const d=new Date(s+'T12:00:00');return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric'}).format(d)}
function daysBetween(a,b){if(!a||!b)return null;return Math.max(1,Math.round((new Date(b)-new Date(a))/86400000)+1)}
function makeCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s}

function subscribeTrips(){
  if(unsubTrips)unsubTrips();
  const q=query(collection(db,'trips'),where('memberUids','array-contains',currentUser.uid));
  unsubTrips=onSnapshot(q,snap=>{
    trips=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderHome();
    if(currentId)renderTrip(currentId);
  },e=>console.error('Trips sync',e));
}

function renderHome(){
  const grid=$('tripsGrid'),empty=$('emptyState');grid.innerHTML='';
  empty.classList.toggle('hidden',trips.length>0);
  trips.forEach(trip=>{
    const card=document.createElement('article');card.className='trip-card';card.style.setProperty('--trip-color',trip.color||colors[0]);
    const media=trip.image?`<img src="${trip.image}" alt="">`:`<div class="trip-symbol">${esc(trip.icon||'✈️')}</div>`;
    const date=trip.start&&trip.end?`${formatDate(trip.start)} → ${formatDate(trip.end)}`:'Sin fechas';
    card.innerHTML=`<button class="card-main"><div class="trip-media">${media}</div><div class="trip-card-overlay"><div class="trip-destination">${esc(trip.destination||'Sin destino')}</div><h2>${esc(trip.name)}</h2><div class="trip-meta">${date}</div><div class="traveler-line">${esc((trip.memberNames||[]).join(', '))}</div></div></button>`;
    card.querySelector('.card-main').onclick=()=>openTrip(trip.id);
    grid.appendChild(card);
  });
  const join=document.createElement('button');join.className='secondary join-home-btn';join.textContent='🔑 Unirme a un viaje con código';join.onclick=()=>openJoinModal();grid.appendChild(join);
}

function openModal(id=null){
  editingId=id;selectedImage='';selectedIcon=icons[0];selectedColor=colors[0];
  $('modalTitle').textContent=id?'Editar viaje':'Crear viaje';
  const tr=trips.find(x=>x.id===id);
  if(tr){
    selectedImage=tr.image||'';selectedIcon=tr.icon||icons[0];selectedColor=tr.color||colors[0];
    [['tripName','name'],['tripDestination','destination'],['tripStart','start'],['tripEnd','end'],['tripTravelers','travelers'],['tripPhrase','phrase']].forEach(([a,b])=>$(a).value=tr[b]||'');
  }else $('tripForm').reset();
  setupPickers();updatePreview();$('tripModal').classList.remove('hidden');
}
function closeModal(){$('tripModal').classList.add('hidden')}
function setupPickers(){
  $('iconPicker').innerHTML=icons.map(x=>`<button type="button" class="pick icon-pick ${x===selectedIcon?'selected':''}" data-v="${x}">${x}</button>`).join('');
  $('colorPicker').innerHTML=colors.map(x=>`<button type="button" class="pick color-pick ${x===selectedColor?'selected':''}" style="--c:${x}" data-v="${x}"></button>`).join('');
  $('iconPicker').querySelectorAll('.pick').forEach(b=>b.onclick=()=>{selectedIcon=b.dataset.v;setupPickers();updatePreview()});
  $('colorPicker').querySelectorAll('.pick').forEach(b=>b.onclick=()=>{selectedColor=b.dataset.v;setupPickers();updatePreview()});
}
function updatePreview(){
  const p=$('tripPreview');p.style.setProperty('--trip-color',selectedColor);
  const name=$('tripName').value||'Nuevo viaje';
  p.innerHTML=selectedImage?`<img src="${selectedImage}" alt=""><div><small>${esc($('tripDestination').value||'')}</small><strong>${esc(name)}</strong></div>`:`<div class="preview-icon">${selectedIcon}</div><div><small>${esc($('tripDestination').value||'')}</small><strong>${esc(name)}</strong></div>`;
}
$('newTripBtn').onclick=()=>openModal();
$('emptyNewTrip').onclick=()=>openModal();
$('closeModal').onclick=closeModal;
$('uploadImageBtn').onclick=()=>$('tripImage').click();
$('tripImage').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1500000){alert('La imagen debe pesar menos de 1,5 MB.');return}const r=new FileReader();r.onload=()=>{selectedImage=r.result;updatePreview()};r.readAsDataURL(f)};
['tripName','tripDestination'].forEach(id=>$(id).addEventListener('input',updatePreview));

$('tripForm').onsubmit=async e=>{
  e.preventDefault();
  const payload={name:$('tripName').value.trim(),destination:$('tripDestination').value.trim(),start:$('tripStart').value,end:$('tripEnd').value,travelers:$('tripTravelers').value.trim(),phrase:$('tripPhrase').value.trim(),icon:selectedIcon,color:selectedColor,image:selectedImage,updatedAt:serverTimestamp()};
  try{
    if(editingId){
      const old=trips.find(x=>x.id===editingId);
      if(!old?.memberUids?.includes(currentUser.uid))throw new Error('No tienes permiso para editar este viaje.');
      await updateDoc(doc(db,'trips',editingId),payload);
      closeModal();openTrip(editingId);
    }else{
      const code=makeCode();
      const ref=await addDoc(collection(db,'trips'),{...payload,code,creatorUid:currentUser.uid,memberUids:[currentUser.uid],memberNames:[currentUser.displayName||currentUser.email],createdAt:serverTimestamp()});
      closeModal();openTrip(ref.id);
    }
  }catch(e){alert(e.message||'No se ha podido guardar el viaje.')}
};

function openTrip(id){currentId=id;$('homeView').classList.remove('active');$('tripView').classList.add('active');renderTrip(id);window.scrollTo({top:0,behavior:'smooth'})}
function renderTrip(id){
  const tr=trips.find(x=>x.id===id);if(!tr)return;
  const isCreator=tr.creatorUid===currentUser.uid;
  $('tripHero').style.setProperty('--trip-color',tr.color||colors[0]);
  $('tripHero').innerHTML=`<div class="hero-image">${tr.image?`<img src="${tr.image}" alt="">`:`<div class="hero-symbol">${esc(tr.icon||'✈️')}</div>`}</div><div class="hero-info"><div class="eyebrow">${esc(tr.destination||'')}</div><h1>${esc(tr.name)}</h1><p>${tr.start&&tr.end?`${formatDate(tr.start)} → ${formatDate(tr.end)} · ${daysBetween(tr.start,tr.end)} días`:'Sin fechas'}</p><p class="phrase">${esc(tr.phrase||'')}</p><p class="members-line">👥 ${esc((tr.memberNames||[]).join(' · '))}</p></div><div class="hero-actions"><button id="tripEditBtn" class="hero-edit">✏️</button><button id="inviteBtn" class="hero-edit">🔑</button></div>`;
  $('tripEditBtn').onclick=()=>openModal(id);
  $('inviteBtn').onclick=()=>showInvite(tr);
  renderTripTab('overview');
}
function renderTripTab(tab){
  document.querySelectorAll('.trip-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const tr=trips.find(x=>x.id===currentId),box=$('tripContent');
  const isCreator=tr?.creatorUid===currentUser.uid;
  if(tab==='overview'){
    box.innerHTML=`<div class="stats"><div><b>${daysBetween(tr?.start,tr?.end)||'—'}</b><span>días</span></div><div><b>${tr?.memberUids?.length||0}</b><span>viajeros</span></div><div><b>${esc(tr?.destination||'—')}</b><span>destino</span></div></div><div class="card welcome-card"><div class="big-emoji">${esc(tr?.icon||'✈️')}</div><h2>${esc(tr?.phrase||tr?.name||'')}</h2><p>Esta sección se irá completando con el contenido colaborativo del viaje.</p>${isCreator?`<p><strong>👑 Administradora:</strong> tú</p>`:''}<button id="showInviteFromTab" class="secondary">🔑 Compartir código del viaje</button></div>`;
    $('showInviteFromTab').onclick=()=>showInvite(tr);
  }else{
    const labels={itinerary:'🗓️ Itinerario',reservations:'🎟️ Reservas',expenses:'💰 Gastos',moments:'❤️ Momentos'};
    box.innerHTML=`<div class="card"><h2>${labels[tab]}</h2><p>La estructura compartida de esta sección está preparada para la siguiente fase. Todos los participantes podrán trabajar sobre ella.</p></div>`;
  }
}
document.querySelectorAll('.trip-tab').forEach(b=>b.onclick=()=>renderTripTab(b.dataset.tab));
$('backBtn').onclick=()=>{currentId=null;$('tripView').classList.remove('active');$('homeView').classList.add('active');renderHome()};

function showInvite(tr){$('inviteCodeDisplay').textContent=tr.code||'------';$('inviteModal').classList.remove('hidden')}
$('closeInviteModal').onclick=()=>$('inviteModal').classList.add('hidden');
$('copyInviteBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('inviteCodeDisplay').textContent);$('copyInviteBtn').textContent='✅ Código copiado'}catch{}};

function openJoinModal(){$('joinCode').value='';$('joinMessage').textContent='';$('joinModal').classList.remove('hidden');setTimeout(()=>$('joinCode').focus(),50)}
$('closeJoinModal').onclick=()=>$('joinModal').classList.add('hidden');
$('joinForm').onsubmit=async e=>{
  e.preventDefault();const code=$('joinCode').value.trim().toUpperCase();
  if(!code)return;
  try{
    const snap=await getDocs(query(collection(db,'trips'),where('code','==',code)));
    if(snap.empty){$('joinMessage').textContent='No hemos encontrado ningún viaje con ese código.';return}
    const d=snap.docs[0],tr=d.data();
    if((tr.memberUids||[]).includes(currentUser.uid)){$('joinMessage').textContent='Ya formas parte de este viaje.';return}
    await updateDoc(d.ref,{memberUids:arrayUnion(currentUser.uid),memberNames:arrayUnion(currentUser.displayName||currentUser.email),updatedAt:serverTimestamp()});
    $('joinMessage').textContent='¡Te has unido al viaje!';$('joinMessage').classList.add('ok');
    setTimeout(()=>{$('joinModal').classList.add('hidden');openTrip(d.id)},500);
  }catch(e){$('joinMessage').textContent='No se ha podido unir al viaje. Revisa las reglas de Firestore.'}
};

$('languageBtn').onclick=()=>{}; // Se conserva el control visual; traducciones se ampliarán después.
onAuthStateChanged(auth,user=>{
  currentUser=user||null;
  if(!user){if(unsubTrips)unsubTrips();showAuth();return}
  showApp();subscribeTrips();
});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.error));
setAuthMode('login');
