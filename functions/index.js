const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
initializeApp();
exports.createInstituteAdmin=onCall({region:'asia-south1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Super Admin login required.');
  const db=getFirestore(),caller=await db.doc(`admins/${request.auth.uid}`).get();
  if(!caller.exists||caller.data().active!==true||caller.data().role!=='super_admin')throw new HttpsError('permission-denied','Only an active Super Admin can create accounts.');
  const data=request.data||{},name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||''),phone=String(data.phone||'').trim(),instituteId=String(data.instituteId||'').trim();
  if(!name||!email.includes('@')||password.length<8||!instituteId)throw new HttpsError('invalid-argument','Name, valid email, 8+ character password and institute are required.');
  const institute=await db.doc(`institutes/${instituteId}`).get();
  if(!institute.exists||institute.data().status!=='active')throw new HttpsError('failed-precondition','Select an active institute.');
  let user;try{user=await getAuth().createUser({email,password,displayName:name,phoneNumber:phone.startsWith('+')?phone:undefined});}catch(error){throw new HttpsError(error.code==='auth/email-already-exists'?'already-exists':'internal',error.message);}
  try{await db.doc(`admins/${user.uid}`).set({uid:user.uid,name,email,phone,instituteId,role:'institute_admin',status:'active',active:true,createdAt:FieldValue.serverTimestamp(),createdBy:request.auth.uid,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid});await db.collection('audit_logs').add({action:'institute_admin_created',actorUid:request.auth.uid,targetId:user.uid,instituteId,details:{email,name},createdAt:FieldValue.serverTimestamp()});}catch(error){await getAuth().deleteUser(user.uid);throw new HttpsError('internal','Account creation was rolled back because profile saving failed.');}
  return{uid:user.uid,email};
});
