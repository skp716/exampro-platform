'use strict';
const fs=require('fs'),path=require('path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,deleteDoc,writeBatch}=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-exampro',firestore:{rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
 let count=0;
 const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name)};
 try{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
   const db=context.firestore();
   for(const id of ['a','b']){
    await setDoc(doc(db,'institutes',id),{status:'active'});
    await setDoc(doc(db,'admins','admin-'+id),{active:true,role:'institute_admin',instituteId:id});
    await setDoc(doc(db,'institutes',id,'members','student-'+id),{ownerUid:'student-'+id});
    await setDoc(doc(db,'institutes',id,'settings','exam_config'),{entryStartAt:null,entryCloseAt:null});
    await setDoc(doc(db,'institutes',id,'exams','math'),{active:true});
    await setDoc(doc(db,'institutes',id,'question_bank','q'),{examId:'math',q:'1+1?',options:['2','3'],a:'2'});
    await setDoc(doc(db,'institutes',id,'results','completed'),{ownerUid:'student-'+id,completed:true,score:'1/1'});
   }
   await setDoc(doc(db,'admins','owner'),{role:'super_admin',active:true});
  });
  const a=env.authenticatedContext('student-a').firestore(),other=env.authenticatedContext('stranger').firestore(),admin=env.authenticatedContext('admin-a').firestore();
  await check('Unauthenticated question-bank read denied',()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'institutes/a/question_bank/q'))));
  await check('Anonymous non-member question-bank read denied',()=>assertFails(getDoc(doc(other,'institutes/a/question_bank/q'))));
  await check('Member can read its own question bank',()=>assertSucceeds(getDoc(doc(a,'institutes/a/question_bank/q'))));
  await check('Member cannot read another institute question bank',()=>assertFails(getDoc(doc(a,'institutes/b/question_bank/q'))));
  await check('Institute admin can list own results',()=>assertSucceeds(getDocs(collection(admin,'institutes/a/results'))));
  await check('Institute admin cannot list other results',()=>assertFails(getDocs(collection(admin,'institutes/b/results'))));
  await check('Student cannot list results',()=>assertFails(getDocs(collection(a,'institutes/a/results'))));
  await check('Client cannot grant membership',()=>assertFails(setDoc(doc(other,'institutes/a/members/stranger'),{ownerUid:'stranger'})));
  await check('Student cannot list institute codes',()=>assertFails(getDocs(collection(a,'institute_codes'))));
  const attempt='a'.repeat(64),lock=doc(a,'attempt_locks',attempt),session=doc(a,'institutes/a/exam_sessions',attempt),result=doc(a,'institutes/a/results',attempt);
  await check('Member can claim active exam',()=>assertSucceeds(setDoc(lock,{ownerUid:'student-a',email:'a@school.edu',examId:'math',instituteId:'a',createdAt:new Date()})));
  await check('Owner can read missing session for resume check',()=>assertSucceeds(getDoc(session)));
  await check('Session identity must match lock',()=>assertFails(setDoc(session,{ownerUid:'student-a',email:'wrong@school.edu',examId:'math',instituteId:'a',sessionId:attempt,status:'logged_in'})));
  await check('Student can create owned session',()=>assertSucceeds(setDoc(session,{ownerUid:'student-a',email:'a@school.edu',examId:'math',instituteId:'a',sessionId:attempt,status:'logged_in'})));
  await check('Question snapshot and manifest can be written atomically',()=>{const b=writeBatch(a);b.set(doc(a,`institutes/a/exam_sessions/${attempt}/snapshot/0000`),{order:0,questions:[{id:'q'}]});b.set(session,{snapshotParts:1},{merge:true});return assertSucceeds(b.commit())});
  await check('Committed snapshot cannot be replaced',()=>assertFails(setDoc(doc(a,`institutes/a/exam_sessions/${attempt}/snapshot/0000`),{order:0,questions:[]})));
  await check('Session can start',()=>assertSucceeds(setDoc(session,{status:'in_progress'},{merge:true})));
  const identity={ownerUid:'student-a',email:'a@school.edu',examId:'math',instituteId:'a',attemptId:attempt};
  await check('Draft and pending session commit together',()=>{const b=writeBatch(a);b.set(result,{...identity,status:'draft',completed:false,score:'1/1'});b.set(session,{status:'result_pending_feedback'},{merge:true});return assertSucceeds(b.commit())});
  await check('Final result and session commit together',()=>{const b=writeBatch(a);b.set(result,{status:'completed',completed:true},{merge:true});b.set(session,{status:'final_submitted'},{merge:true});return assertSucceeds(b.commit())});
  await check('Completed result cannot be overwritten',()=>assertFails(setDoc(result,{score:'999/1'},{merge:true})));
  await check('Closed session cannot accept delayed progress',()=>assertFails(setDoc(session,{status:'in_progress'},{merge:true})));
  await check('Admin cannot delete client-side retake lock',()=>assertFails(deleteDoc(doc(admin,'attempt_locks',attempt))));
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'institutes/a/settings/exam_config'),{entryCloseAt:new Date(1)},{merge:true}));
  await check('New entry outside window is denied by server rules',()=>assertFails(setDoc(doc(a,'attempt_locks','c'.repeat(64)),{ownerUid:'student-a',email:'a@school.edu',examId:'math',instituteId:'a',createdAt:new Date()})));
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'institutes/a'),{status:'suspended'},{merge:true}));
  await check('Suspended institute student access denied',()=>assertFails(getDoc(doc(a,'institutes/a/question_bank/q'))));
  await check('Suspended institute admin access denied',()=>assertFails(getDocs(collection(admin,'institutes/a/results'))));
  console.log(`${count} Firestore emulator checks passed.`);
 }finally{await env.cleanup()}
})().catch(error=>{console.error(error);process.exitCode=1});
