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
      try{
        await setDoc(doc(db,'users',cred.user.uid),{uid:cred.user.uid,name:name||email.split('@')[0],email,createdAt:serverTimestamp()},{merge:true});
      }catch(profileError){
        console.error('ZERO STRESS TRIPS · FIRESTORE USER PROFILE ERROR', profileError);
        msg(`La cuenta de Firebase se creó, pero no se pudo guardar el perfil: ${profileError?.code || profileError?.message || profileError}`);
        return;
      }
    }else await signInWithEmailAndPassword(auth,email,password);
  }catch(e){msg(authError(e))}finally{$('authSubmit').disabled=false}
};
$('logoutBtn').onclick=()=>signOut(auth);

function authError(e){
  console.error('ZERO STRESS TRIPS · ERROR FIREBASE AUTH', {
    code: e?.code,
    message: e?.message,
    name: e?.name,
    customData: e?.customData
  });
  const c=e?.code||'';
  if(c.includes('invalid-credential')||c.includes('wrong-password'))return 'Email o contraseña incorrectos.';
  if(c.includes('email-already-in-use'))return 'Ese email ya tiene una cuenta.';
  if(c.includes('weak-password'))return 'La contraseña debe tener al menos 6 caracteres.';
  if(c.includes('invalid-email'))return 'El email no es válido.';
  if(c.includes('operation-not-allowed'))return 'Firebase no tiene habilitado Correo electrónico/contraseña en Método de acceso.';
  if(c.includes('unauthorized-domain'))return 'Firebase no autoriza este dominio. Añade zerostressapps.github.io en Dominios autorizados.';
  if(c.includes('invalid-api-key'))return 'La API Key de Firebase no es válida.';
  if(c.includes('api-key-not-valid'))return 'La API Key de Firebase no es válida para este proyecto.';
  if(c.includes('network-request-failed'))return 'Firebase no puede conectar con el servidor. Comprueba la conexión.';
  return `Firebase devuelve ${c || 'un error desconocido'}: ${e?.message || 'sin detalle'}`;
}

function formatDate(s){if(!s)return '';const d=new Date(s+'T12:00:00');return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric'}).format(d)}
function daysBetween(a,b){if(!a||!b)return null;return Math.max(1,Math.round((new Date(b)-new Date(a))/86400000)+1)}
function normalizeCode(value){
  return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
}
function suggestedCodeFromName(name){
  const words=String(name||'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  let base=words.join('').slice(0,12);
  if(base.length<4) base=(base+'TRIP').slice(0,12);
  return base;
}
async function codeExists(code, excludeId=''){
  const ref=doc(db,'inviteCodes',code);
  const snap=await getDoc(ref);
  if(!snap.exists()) return false;
  return snap.data()?.tripId !== excludeId;
}

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
  editingId=id;tripCodeManuallyEdited=false;selectedImage='';selectedIcon=icons[0];selectedColor=colors[0];
  $('modalTitle').textContent=id?'Editar viaje':'Crear viaje';
  const tr=trips.find(x=>x.id===id);
  if(tr){
    selectedImage=tr.image||'';selectedIcon=tr.icon||icons[0];selectedColor=tr.color||colors[0];
    [['tripName','name'],['tripDestination','destination'],['tripStart','start'],['tripEnd','end'],['tripTravelers','travelers'],['tripPhrase','phrase']].forEach(([a,b])=>$(a).value=tr[b]||'');
    $('tripCode').value=tr.code||'';
    $('tripCode').readOnly=false;
  }else{
    $('tripForm').reset();
    $('tripCode').value=suggestedCodeFromName('');
    $('tripCode').readOnly=false;
  }
  $('tripEnd').min=$('tripStart').value||'';
  if($('tripStart').value && (!$('tripEnd').value || $('tripEnd').value < $('tripStart').value)){
    $('tripEnd').value=$('tripStart').value;
  }
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
let tripCodeManuallyEdited=false;
$('tripCode').addEventListener('input',()=>{tripCodeManuallyEdited=true;$('tripCode').value=normalizeCode($('tripCode').value)});
$('tripName').addEventListener('input',()=>{
  updatePreview();
  if(!editingId && !tripCodeManuallyEdited){
    $('tripCode').value=suggestedCodeFromName($('tripName').value);
  }
});


// Fechas del viaje: el fin nunca puede quedar antes del inicio.
// Si todavía no hay fecha de fin, se coloca inicialmente el mismo día que el inicio.
// Esto hace que el selector nativo de Android/Chrome abra directamente en el mismo mes
// que el inicio, en lugar de quedarse en el mes actual.
$('tripStart').addEventListener('change',()=>{
  const start=$('tripStart').value;
  const end=$('tripEnd').value;
  if(!start)return;
  $('tripEnd').min=start;
  if(!end || end < start){
    $('tripEnd').value=start;
  }
});


$('tripForm').onsubmit=async e=>{
  e.preventDefault();
  const code=normalizeCode($('tripCode').value);
  if(code.length<4){alert('El código debe tener al menos 4 caracteres.');return}
  if(code.length>12){alert('El código puede tener como máximo 12 caracteres.');return}
  const payload={name:$('tripName').value.trim(),destination:$('tripDestination').value.trim(),start:$('tripStart').value,end:$('tripEnd').value,travelers:$('tripTravelers').value.trim(),phrase:$('tripPhrase').value.trim(),icon:selectedIcon,color:selectedColor,image:selectedImage,code,updatedAt:serverTimestamp()};
  try{
    if(editingId){
      const old=trips.find(x=>x.id===editingId);
      if(!old?.memberUids?.includes(currentUser.uid))throw new Error('No tienes permiso para editar este viaje.');
      if(old.creatorUid!==currentUser.uid)throw new Error('Solo la persona creadora puede cambiar el código del viaje.');
      if(code!==old.code && await codeExists(code,editingId))throw new Error('Este código ya está utilizado. Elige otro.');

      if(code!==old.code){
        // Register the new invite code first, then remove the old one.
        await setDoc(doc(db,'inviteCodes',code),{
          tripId:editingId,
          creatorUid:currentUser.uid,
          createdAt:serverTimestamp()
        });
        if(old.code) await deleteDoc(doc(db,'inviteCodes',old.code));
      }
      await updateDoc(doc(db,'trips',editingId),payload);
      closeModal();openTrip(editingId);
    }else{
      if(await codeExists(code))throw new Error('Este código ya está utilizado. Elige otro.');
      const ref=await addDoc(collection(db,'trips'),{
        ...payload,
        creatorUid:currentUser.uid,
        memberUids:[currentUser.uid],
        memberNames:[currentUser.displayName||currentUser.email],
        createdAt:serverTimestamp()
      });
      try{
        await setDoc(doc(db,'inviteCodes',code),{
          tripId:ref.id,
          creatorUid:currentUser.uid,
          createdAt:serverTimestamp()
        });
      }catch(inviteError){
        // Avoid leaving an inaccessible orphan trip if the invite code cannot be created.
        try{await deleteDoc(ref)}catch{}
        throw inviteError;
      }
      closeModal();openTrip(ref.id);
    }
  }catch(e){
    console.error('ZERO STRESS TRIPS · TRIP SAVE ERROR',e);
    if(e?.code==='permission-denied'){
      alert('Firebase ha rechazado la operación por permisos. Revisa las Firestore Rules de esta versión.');
    }else{
      alert(e.message||'No se ha podido guardar el viaje.');
    }
  }
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
    const inviteRef=doc(db,'inviteCodes',code);
    const inviteSnap=await getDoc(inviteRef);
    if(!inviteSnap.exists()){$('joinMessage').textContent='No hemos encontrado ningún viaje con ese código.';return}
    const invite=inviteSnap.data();
    const d=doc(db,'trips',invite.tripId);
    const tripSnap=await getDoc(d);
    if(!tripSnap.exists()){$('joinMessage').textContent='El código existe pero el viaje ya no está disponible.';return}
    const tr=tripSnap.data();
    if((tr.memberUids||[]).includes(currentUser.uid)){$('joinMessage').textContent='Ya formas parte de este viaje.';return}
    await updateDoc(d,{memberUids:arrayUnion(currentUser.uid),memberNames:arrayUnion(currentUser.displayName||currentUser.email),updatedAt:serverTimestamp()});
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
