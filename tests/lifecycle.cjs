'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const records=new Map();let failNextBatch=false,passed=0;
const snap=ref=>({exists:()=>records.has(ref.path),data:()=>structuredClone(records.get(ref.path))});
const doc=(db,...parts)=>({path:parts.join('/')});
const put=(ref,value,options)=>records.set(ref.path,options?.merge?{...records.get(ref.path),...structuredClone(value)}:structuredClone(value));
function batch(){const ops=[];return{set:(...args)=>ops.push(args),commit:async()=>{if(failNextBatch){failNextBatch=false;throw Error('simulated network outage')}ops.forEach(args=>put(...args))}}}
const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{value:'',classList:{add(){},remove(){}},style:{},disabled:false,innerHTML:''});return elements.get(id)}
function client(id){
 const attempt=id.repeat(64),storage=new Map();
 const c={db:{},doc,writeBatch:batch,setDoc:async(...args)=>put(...args),runTransaction:async(db,fn)=>{const b=batch(),value=await fn({get:async ref=>snap(ref),set:b.set});await b.commit();return value},
 auth:{currentUser:{uid:'student-'+id}},currentInstitute:{id},currentAttemptId:attempt,draftResultId:attempt,currentStudentName:'Candidate '+id,currentStudentEmail:id+'@school.edu',selectedExamId:'math',selectedExamName:'Math',currentStudentProfile:{},examConfigData:{},
 currentSession:{status:'in_progress',finishedAt:10000},questionsList:[{_questionKey:'q1',options:['A','B'],a:'A'}],reserveQuestions:[],selectedAnswers:{0:0},questionStatus:{0:'answered'},currentQuestionIndex:0,examStartTime:1000,examEndTime:10000,
 finalizedScoreString:'1/1',calculatedScore:1,totalScore:1,finalMetrics:{correct:1,wrong:0,attempted:1,timeTakenSeconds:9},resultSavedForThisAttempt:false,submissionInProgress:false,isExamActive:true,maxTabSwitches:5,tabSwitches:0,copiesAttempted:0,penaltiesApplied:0,securityEvents:[],selectedRating:4,
 document:{getElementById:element},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console:{error(){},warn(){}},showExamModal:(...args)=>{c.lastModal=args},escapeHtmlSafe:String,Date,Promise,progressWriteChain:Promise.resolve()};
 vm.createContext(c);vm.runInContext(cut('    async function saveDraftResult(){',"    document.querySelectorAll('#stars-container")+cut('    async function submitStudentExam() {',"    window.addEventListener('DOMContentLoaded', checkOverallExamWindow)")+cut('    async function saveExamProgress(extra={}){','    function replaceViolatedQuestion(){'),c);
 records.set(`institutes/${id}/exam_sessions/${attempt}`,{status:'in_progress',ownerUid:c.auth.currentUser.uid,instituteId:id});
 return c;
}
async function test(name,fn){await fn();console.log('PASS '+name);passed++}
(async()=>{
 const a=client('a'),b=client('b'),result=c=>`institutes/${c.currentInstitute.id}/results/${c.currentAttemptId}`,session=c=>`institutes/${c.currentInstitute.id}/exam_sessions/${c.currentAttemptId}`;
 await test('Draft network failure leaves result and session unchanged',async()=>{failNextBatch=true;assert.equal(await a.saveDraftResult(),false);assert(!records.has(result(a)));assert.equal(records.get(session(a)).status,'in_progress')});
 await test('Submit retries an unsaved draft and completes A atomically',async()=>{await a.submitStudentExam();assert.equal(records.get(result(a)).completed,true);assert.equal(records.get(session(a)).status,'final_submitted');assert.equal(records.get(result(a)).score,'1/1')});
 await test('A submission leaves B attempt and results untouched',()=>{assert(!records.has(result(b)));assert.equal(records.get(session(b)).status,'in_progress')});
 await test('Repeated submit preserves completed result',async()=>{const original=structuredClone(records.get(result(a)));await a.submitStudentExam();assert.deepEqual(records.get(result(a)),original)});
 await test('B submits its different score to its own result panel',async()=>{b.finalizedScoreString='0/1';b.calculatedScore=0;b.finalMetrics={correct:0,wrong:1};await b.submitStudentExam();assert.equal(records.get(result(b)).score,'0/1');assert.equal(records.get(result(a)).score,'1/1')});
 const c=client('c');
 await test('Pending feedback rejects stale in-progress saves',async()=>{records.set(session(c),{status:'result_pending_feedback'});assert.equal(await c.saveExamProgress(),false);assert.equal(records.get(session(c)).status,'result_pending_feedback')});
 await test('Server-finalized attempt rejects delayed student saves',async()=>{records.set(session(c),{status:'final_submitted'});assert.equal(await c.saveExamProgress(),false);assert.equal(records.get(session(c)).status,'final_submitted')});
 await test('Answer clicks after deadline cannot change selections',()=>{const context={window:{},isExamActive:true,submissionInProgress:false,examEndTime:1,selectedAnswers:{},Date};vm.runInNewContext(cut('    window.selectOption =','    window.clearResponse ='),context);context.window.selectOption(0,1);assert.deepEqual(context.selectedAnswers,{})});
 await test('Deadline automatically calculates and submits without a dialog click',async()=>{
   const calls=[],context={examEndTime:1,timerInterval:0,heartbeatTimer:0,isExamActive:true,clearInterval(){},setInterval(fn){context.tick=fn;return 1},Date,console,calculateAndShowResults:async()=>calls.push('calculate'),submitStudentExam:async()=>calls.push('submit')};
   vm.runInNewContext(cut('    function startExamTimer() {','    function shuffleCurrentQuestion()'),context);context.startExamTimer();context.tick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['calculate','submit']);assert.equal(context.isExamActive,false);
 });
 const loader=cut('    async function loadConfiguredExamQuestions(exam,','      // Railway Group D')+'}';
 function load(rows,subjects){return vm.runInNewContext(loader+'loadConfiguredExamQuestions(exam)',{currentInstitute:{id:'a'},exam:{id:'math',tenant:true,subjects},db:{},getDocs:async()=>({docs:rows.map((row,i)=>({id:String(i),data:()=>row}))}),query:()=>'',collection:()=>'',where:()=>'',getSubjectEntries:e=>Object.entries(e.subjects),getSubjectCount:c=>c.count,getSubjectOrder:c=>c.order||'sequential'});}
 await test('Unconfigured subjects are not added to a paper',async()=>{assert.equal((await load([{subject:'Math'},{subject:'English'}],{m:{name:'Math',count:1}})).length,1)});
 await test('Insufficient bank questions fail before starting',async()=>{await assert.rejects(load([{subject:'Math'}],{m:{name:'Math',count:2}}),/1 questions; 2/)});
 await test('All Questions obeys total count across bank subjects',async()=>{assert.equal((await load([{subject:'Math'},{subject:'English'},{subject:'GK'}],{all:{name:'All Questions',count:2}})).length,2)});
 await test('Wrong subject name fails rather than loading an unrelated paper',async()=>{await assert.rejects(load([{subject:'English'}],{m:{name:'Math',count:1}}),/0 questions/)});
 console.log(`${passed} lifecycle checks passed. Firebase operations are mocked; these are not browser or rules tests.`);
})().catch(error=>{console.error(error);process.exitCode=1});
