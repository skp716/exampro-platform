import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const htmlFiles=['index.html','admin.html','super-admin.html','institute-admin.html','test.html','railway.html',
  'ssc-gd/reasoning.html','ssc-gd/gk-gs.html','ssc-gd/maths.html','ssc-gd/english-hindi.html'];

for(const relative of htmlFiles){
  const text=fs.readFileSync(path.join(root,relative),'utf8');
  for(const match of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    const source=match[1].replace(/^\s*import\b[\s\S]*?;\s*$/gm,'');
    try{ new vm.Script(`(async()=>{${source}\n})`); }
    catch(error){ throw new Error(`${relative}: invalid inline JavaScript: ${error.message}`); }
  }
}

const banks={
  'railway.html':{required:100,reserve:10},
  'ssc-gd/reasoning.html':{required:20,reserve:3},
  'ssc-gd/gk-gs.html':{required:20,reserve:2},
  'ssc-gd/maths.html':{required:20,reserve:2},
  'ssc-gd/english-hindi.html':{required:20,reserve:0}
};

for(const [relative,{required,reserve}] of Object.entries(banks)){
  const questions=JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
  const expectedCount=required+reserve;
  if(questions.length!==expectedCount) throw new Error(`${relative}: expected ${required} exam + ${reserve} reserve questions (${expectedCount} total), found ${questions.length}`);
  const ids=new Set();
  questions.forEach((question,index)=>{
    if(ids.has(question.id)) throw new Error(`${relative}: duplicate id ${question.id}`);
    ids.add(question.id);
    if(!Array.isArray(question.options)||question.options.length!==4) throw new Error(`${relative}: question ${index+1} must have four options`);
    if(!question.options.includes(question.a)) throw new Error(`${relative}: question ${index+1} answer is not one of its options`);
  });
}

console.log('Repository validation passed.');
