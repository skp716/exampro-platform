'use strict';
function scoreSavedSession(session,draft){
  if(session.status==='logged_in')throw Error('This student has not started the exam. There are no answers to score.');
  if(!Array.isArray(session.grading)||!session.grading.length){
    const source=draft||session;
    if(session.status==='result_pending_feedback'&&/^\d+(\.\d+)?\/\d+$/.test(String(source.score))){
      const [scoreValue,totalMarks]=source.score.split('/').map(Number);
      if(totalMarks>0&&scoreValue<=totalMarks)return{score:source.score,scoreValue,totalMarks,correct:source.correct||0,wrong:source.wrong||0};
    }
    throw Error('This older attempt has no saved grading data. Ask the student to resume and sync before force submission.');
  }
  let correct=0,wrong=0;
  session.grading.forEach((answer,index)=>{
    if(!Number.isInteger(answer)||answer<0)throw Error('Saved answer key is incomplete; this attempt needs review.');
    const selected=session.selectedAnswers?.[index];
    if(selected===undefined||selected===null)return;
    if(!Number.isInteger(selected)||selected<0)throw Error('Saved answer selection is invalid.');
    if(Number(selected)===answer)correct++;else wrong++;
  });
  const penalty=Number(session.penaltiesApplied??0);
  if(!Number.isFinite(penalty)||penalty<0)throw Error('Saved penalty is invalid.');
  const totalMarks=session.grading.length,scoreValue=Math.max(0,Number((correct-wrong*.25-penalty).toFixed(2)));
  return{score:`${scoreValue}/${totalMarks}`,scoreValue,totalMarks,correct,wrong,attempted:correct+wrong,timeTakenSeconds:Math.max(0,Math.round((Math.min(Number(session.finishedAt)||Date.now(),Number(session.examEndTime)||Date.now())-(Number(session.examStartTime)||Date.now()))/1000))};
}
module.exports={scoreSavedSession};
