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
  try{const batch=db.batch();batch.set(db.doc(`admins/${user.uid}`),{uid:user.uid,name,email,phone,instituteId,role:'institute_admin',status:'active',active:true,createdAt:FieldValue.serverTimestamp(),createdBy:request.auth.uid,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid});batch.set(db.collection('audit_logs').doc(),{action:'institute_admin_created',actorUid:request.auth.uid,targetId:user.uid,instituteId,details:{email,name},timestamp:FieldValue.serverTimestamp()});await batch.commit();}catch(error){await getAuth().deleteUser(user.uid);throw new HttpsError('internal','Account creation was rolled back because profile saving failed.');}
  return{uid:user.uid,email};
});


// Resolve the confidential institute code on the server and grant scoped access.
exports.joinInstitute=onCall({region:'asia-south1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Student sign-in required.');
  const code=String(request.data?.code||'').trim().toLowerCase();
  if(!/^[a-z0-9_-]{1,20}$/.test(code))throw new HttpsError('invalid-argument','Enter a valid institute code.');
  const db=getFirestore(),reservation=await db.doc(`institute_codes/${code}`).get();
  if(!reservation.exists)throw new HttpsError('not-found','Invalid institute code.');
  const id=reservation.data().instituteId,ref=db.doc(`institutes/${id}`),snapshot=await ref.get();
  if(!snapshot.exists||snapshot.data().status!=='active')throw new HttpsError('failed-precondition','This institute is not active.');
  const [cfg,examDocs]=await Promise.all([ref.collection('settings').doc('exam_config').get(),ref.collection('exams').get()]);
  const settings=cfg.exists?cfg.data():{},exams=examDocs.docs.filter(d=>d.data().active===true).map(d=>({...d.data(),id:d.id}));
  if(!settings.activeCenterId)throw new HttpsError('failed-precondition','Institute setup is incomplete: ask the administrator to save an active center.');
  const center=await ref.collection('centers').doc(settings.activeCenterId).get();
  if(!center.exists||center.data().active!==true)throw new HttpsError('failed-precondition','No active examination center is configured.');
  if(!exams.length)throw new HttpsError('failed-precondition','No active exam is configured. Ask the administrator to save exam settings.');
  await ref.collection('members').doc(request.auth.uid).set({ownerUid:request.auth.uid,joinedAt:FieldValue.serverTimestamp()},{merge:true});
  // Return plain JSON; Firestore reads after membership retain Timestamp objects.
  return{instituteId:id};
});

async function requireInstituteAdmin(request){
  if(!request.auth)throw new HttpsError('unauthenticated','Administrator login required.');
  const db=getFirestore(),profile=await db.doc(`admins/${request.auth.uid}`).get();
  const id=String(request.data?.instituteId||'');
  if(!id||id.includes('/'))throw new HttpsError('invalid-argument','Invalid institute.');
  if(!profile.exists||profile.data().active!==true||(!['institute_admin','admin'].includes(profile.data().role)&&profile.data().role!=='super_admin')||(profile.data().role!=='super_admin'&&profile.data().instituteId!==id))throw new HttpsError('permission-denied','Access to this institute is denied.');
  const inst=await db.doc(`institutes/${id}`).get();
  if(!inst.exists||inst.data().status!=='active')throw new HttpsError('failed-precondition','Institute is not active.');
  return{db,id};
}
const {scoreSavedSession}=require('./scoring');
exports.forceSubmitInstituteAttempt=onCall({region:'asia-south1'},async request=>{
  const {db,id}=await requireInstituteAdmin(request),attemptId=String(request.data?.attemptId||'');
  if(!/^[a-f0-9]{64}$/.test(attemptId))throw new HttpsError('invalid-argument','Invalid attempt.');
  return db.runTransaction(async tx=>{
    const sessionRef=db.doc(`institutes/${id}/exam_sessions/${attemptId}`),resultRef=db.doc(`institutes/${id}/results/${attemptId}`);
    const [session,result]=await Promise.all([tx.get(sessionRef),tx.get(resultRef)]);
    if(!session.exists)throw new HttpsError('not-found','Attempt not found.');
    if(result.exists&&result.data().completed===true)return{alreadyCompleted:true};
    const s=session.data();if(s.status==='reset_pending')throw new HttpsError('failed-precondition','This attempt is being reset.');let metrics;
    try{metrics=scoreSavedSession(s,result.exists?result.data():null)}catch(error){throw new HttpsError('failed-precondition',error.message)}
    const now=FieldValue.serverTimestamp(),payload={...(result.exists?result.data():{}),...metrics,ownerUid:s.ownerUid,attemptId,instituteId:id,name:s.name||'',email:s.email||'',examId:s.examId||'',examName:s.examName||'',completed:true,status:'completed',forcedAt:now,forcedBy:request.auth.uid,submittedAt:now,updatedAt:now,lastAnswerSyncAt:s.lastSeen||null,copiesAttempted:s.copiesAttempted||0,penaltiesApplied:s.penaltiesApplied||0,tabSwitches:s.tabSwitches||0};
    tx.set(resultRef,payload,{merge:true});tx.set(sessionRef,{...metrics,status:'final_submitted',forcedAt:now,forcedBy:request.auth.uid,submittedAt:now},{merge:true});
    tx.set(db.doc(`exam_sessions/${attemptId}`),{status:'final_submitted',forcedAt:now,...metrics},{merge:true});
    tx.set(db.collection('audit_logs').doc(),{timestamp:now,actorUid:request.auth.uid,instituteId:id,targetId:attemptId,action:'attempt_force_submitted'});
    return{alreadyCompleted:false,score:metrics.score};
  });
});

exports.resetInstituteAttempt=onCall({region:'asia-south1'},async request=>{
  const {db,id}=await requireInstituteAdmin(request),attemptId=String(request.data?.attemptId||'');
  if(!/^[a-f0-9]{64}$/.test(attemptId))throw new HttpsError('invalid-argument','Invalid attempt.');
  const refs=['exam_sessions','results'].map(c=>db.doc(`institutes/${id}/${c}/${attemptId}`));
  const lock=db.doc(`attempt_locks/${attemptId}`),globalSession=db.doc(`exam_sessions/${attemptId}`),globalResult=db.doc(`results/${attemptId}`);
  await db.runTransaction(async tx=>{
    const records=await Promise.all([...refs,lock,globalSession,globalResult].map(r=>tx.get(r)));
    const snapshots=await tx.get(refs[0].collection('snapshot'));
    if(!records.some(d=>d.exists&&d.data().instituteId===id))throw new HttpsError('not-found','No attempt exists for this institute.');
    if(records.some(d=>d.exists&&d.data().instituteId&&d.data().instituteId!==id))throw new HttpsError('permission-denied','Attempt belongs to another institute.');
    if(snapshots.docs.length>450)throw new HttpsError('failed-precondition','This legacy attempt needs an owner-assisted reset.');
    snapshots.docs.forEach(part=>tx.delete(part.ref));
    [...refs,lock,globalSession,globalResult].forEach(ref=>tx.delete(ref));
    tx.set(db.collection('audit_logs').doc(),{timestamp:FieldValue.serverTimestamp(),actorUid:request.auth.uid,instituteId:id,targetId:attemptId,action:'attempt_reset'});
  });
  return{reset:true};
});

exports.assignInstituteAdmin=onCall({region:'asia-south1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Super Admin login required.');
  const db=getFirestore(),caller=await db.doc(`admins/${request.auth.uid}`).get();
  if(!caller.exists||caller.data().active!==true||caller.data().role!=='super_admin')throw new HttpsError('permission-denied','Super Admin access required.');
  const data=request.data||{},uid=String(data.uid||''),instituteId=String(data.instituteId||''),email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim();
  if(!/^[A-Za-z0-9_-]{20,128}$/.test(uid)||!instituteId||instituteId.includes('/')||!name)throw new HttpsError('invalid-argument','Valid UID, name and institute are required.');
  const user=await getAuth().getUser(uid);
  if(user.disabled||!user.email||user.email.toLowerCase()!==email||!user.providerData.some(p=>p.providerId==='password'))throw new HttpsError('failed-precondition','UID must belong to the entered active Email/Password account.');
  const ref=db.doc(`admins/${uid}`);
  await db.runTransaction(async tx=>{const [existing,inst]=await Promise.all([tx.get(ref),tx.get(db.doc(`institutes/${instituteId}`))]);
    if(existing.exists&&existing.data().role==='super_admin')throw new HttpsError('permission-denied','A Super Admin cannot be reassigned.');
    if(!inst.exists||inst.data().status!=='active')throw new HttpsError('failed-precondition','Activate the institute first.');
    const now=FieldValue.serverTimestamp();tx.set(ref,{uid,email,name,instituteId,phone:String(data.phone||''),role:'institute_admin',active:true,status:'active',updatedAt:now,updatedBy:request.auth.uid,...(!existing.exists?{createdAt:now,createdBy:request.auth.uid}:{})},{merge:true});
    tx.set(db.collection('audit_logs').doc(),{timestamp:now,actorUid:request.auth.uid,instituteId,targetId:uid,action:'institute_admin_assigned'});
  });return{uid};
});
