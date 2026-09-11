const state=window.__firebaseMock||(window.__firebaseMock={records:{},users:{},watchers:[],writes:[]});
export const browserSessionPersistence={},getApp=(name='[DEFAULT]')=>({name}),initializeApp=(cfg,name='[DEFAULT]')=>({name}),getFirestore=()=>({}),getFunctions=()=>({}),getStorage=()=>({}),serverTimestamp=()=>new Date();
export function getAuth(app){const key=app.name;return{key,get currentUser(){return state.users[key]||null}}}
export async function setPersistence(){}
export function onAuthStateChanged(auth,fn){let alive=true;queueMicrotask(()=>alive&&fn(auth.currentUser));state.authListener={auth,fn};return()=>{alive=false}}
export async function signInAnonymously(auth){state.users[auth.key]={uid:'student-one',isAnonymous:true};return{user:auth.currentUser}}
export async function signInWithEmailAndPassword(auth,email){state.users[auth.key]={uid:'admin-one',email,isAnonymous:false};await state.authListener.fn(auth.currentUser);return{user:auth.currentUser}}
export async function signOut(auth){delete state.users[auth.key];await state.authListener?.fn(null)}
export function doc(...parts){return{path:parts.filter(x=>typeof x==='string'||x?.path).map(x=>x.path||x).join('/')}}
export const collection=doc,where=(field,op,value)=>({field,op,value}),query=(ref,...filters)=>({...ref,filters}),orderBy=()=>({}),limit=()=>({});
const snap=ref=>({id:ref.path.split('/').pop(),exists:()=>Object.hasOwn(state.records,ref.path),data:()=>structuredClone(state.records[ref.path])});
export async function getDoc(ref){return snap(ref)}
function list(ref){const prefix=ref.path+'/',docs=Object.keys(state.records).filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes('/')).filter(p=>(ref.filters||[]).every(f=>!f.field||state.records[p][f.field]===f.value)).map(p=>snap({path:p}));return{docs,empty:!docs.length}}
export async function getDocs(ref){return list(ref)}
function emit(){for(const {ref,fn}of state.watchers)fn(ref.path.split('/').length%2?snapCollection(ref):snap(ref))}
const snapCollection=list;
export function onSnapshot(ref,fn){const item={ref,fn};state.watchers.push(item);queueMicrotask(()=>fn(ref.path.split('/').length%2?list(ref):snap(ref)));return()=>{state.watchers=state.watchers.filter(x=>x!==item)}}
export async function setDoc(ref,value,options){state.records[ref.path]=options?.merge?{...state.records[ref.path],...structuredClone(value)}:structuredClone(value);state.writes.push(ref.path);emit()}
export const updateDoc=(ref,value)=>setDoc(ref,value,{merge:true});
export async function deleteDoc(ref){delete state.records[ref.path];emit()}
export function writeBatch(){const writes=[];return{set:(...args)=>writes.push(['set',args]),delete:ref=>writes.push(['delete',[ref]]),commit:async()=>{for(const [kind,args]of writes)await(kind==='set'?setDoc(...args):deleteDoc(...args))}}}
export async function runTransaction(db,fn){const batch=writeBatch();const value=await fn({get:getDoc,set:batch.set,delete:batch.delete});await batch.commit();return value}
export async function addDoc(ref,data){const child=doc(ref,'generated');await setDoc(child,data);return child}
export function httpsCallable(fn,name){return async data=>{state.calls??=[];state.calls.push({name,data});if(name==='joinInstitute'){if(data.code!=='ALPHA')throw Error('Invalid institute code.');return{data:{instituteId:'alpha'}}}return{data:{score:'1.75/2',uid:'created',reset:true}}}}
export const ref=(storage,path)=>({path}),uploadBytes=async()=>{},getDownloadURL=async()=>'';
