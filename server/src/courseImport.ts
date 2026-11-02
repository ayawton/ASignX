export type ImportQuestion = {answer_type:'choice'|'boolean'|'recognition';prompt:string;options:{option_text:string;is_correct:boolean}[];target?:string;line:number};
export type ImportLesson = {title:string;content:string;xp_reward:number;signs:string[];exercises:ImportQuestion[];line:number};
export type ImportPlan = {title:string;description:string;lessons:ImportLesson[]};
export class ImportError extends Error {constructor(message:string,readonly line:number){super(`Line ${line}: ${message}`)}}
export const MAX_IMPORT_BYTES=100_000;
/** Plain text only. No evaluation, HTML parsing or generated learning content. */
export function parseCourseText(input:unknown,mode:'course'|'lessons'='course'):ImportPlan {
 if(typeof input!=='string' || !input.trim())throw new ImportError('Paste a course structure or choose a text file.',1);
 if(Buffer.byteLength(input,'utf8')>MAX_IMPORT_BYTES)throw new ImportError('Text must be at most 100 KB.',1);
 const plan:ImportPlan={title:'',description:'',lessons:[]};let lesson:ImportLesson|undefined,question:ImportQuestion|undefined;
 const seen=new Set<string>();let fields=new Set<string>(),qFields=new Set<string>();
 const lines=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 const fail=(message:string,line:number):never=>{throw new ImportError(message,line)};
 const bounded=(value:string,max:number,name:string,line:number)=>{if(!value.trim()||value.length>max)fail(`${name} needs 1–${max} characters.`,line);return value.trim()};
 for(let i=0;i<lines.length;i++){
  const raw=lines[i]!,text=raw.trim(),line=i+1;if(!text || text.startsWith('#'))continue;
  if(text.startsWith('- ')||text.startsWith('* ')){
   if(!question || question.answer_type!=='choice')fail('Choices belong under a choice question. Use * for its correct choice.',line);
   question!.options.push({option_text:bounded(text.slice(2),500,'Choice',line),is_correct:text[0]==='*'});continue;
  }
  const match=/^([A-Za-z]+):\s*(.*)$/.exec(text);if(!match)fail('Use a template field such as Lesson:, Content: or Question:.',line);
  const key=match![1]!.toLowerCase();let value=match![2]!.trim();
  if(value==='|' && ['description','content'].includes(key)){
   const block:string[]=[];
   while(i+1<lines.length && (!lines[i+1]!.trim() || /^( {2}|\t)/.test(lines[i+1]!))){i++;block.push(lines[i]!.replace(/^( {2}|\t)/,''));}
   value=block.join('\n').trim();
  }
  if(key==='course'){
   if(mode==='lessons')fail('Omit Course: when adding lessons to an existing draft.',line);
   if(seen.has(key)||lesson)fail('Course: must appear once, before lessons.',line);
   seen.add(key);plan.title=bounded(value,150,'Course title',line);continue;
  }
  if(key==='description'){
   if(mode==='lessons'||lesson||seen.has(key))fail('Description: belongs once under Course:.',line);
   if(value.length>5000)fail('Description is limited to 5,000 characters.',line);seen.add(key);plan.description=value;continue;
  }
  if(key==='lesson'){
   if(plan.lessons.length>=25)fail('Import up to 25 lessons at a time.',line);
   lesson={title:bounded(value,150,'Lesson title',line),content:'',xp_reward:10,signs:[],exercises:[],line};plan.lessons.push(lesson);question=undefined;fields=new Set();continue;
  }
  if(!lesson)fail('Start a lesson with Lesson: before its fields.',line);
  if(key==='question'){
   if(lesson!.exercises.length>=10)fail('Each lesson supports up to 10 questions.',line);
   const delimiter=value.indexOf('|'),type=value.slice(0,delimiter).trim().toLowerCase();
   if(delimiter<0||!['choice','boolean','recognition'].includes(type))fail('Use Question: choice | prompt, boolean | prompt, or recognition | prompt.',line);
   question={answer_type:type as ImportQuestion['answer_type'],prompt:bounded(value.slice(delimiter+1).trim(),1000,'Question',line),options:[],line};lesson!.exercises.push(question);qFields=new Set();continue;
  }
  if(key==='answer'||key==='target'){
   if(!question||qFields.has(key))fail(`${key}: belongs once under its question.`,line);qFields.add(key);
   if(key==='answer'){
    if(question!.answer_type!=='boolean'||!['true','false'].includes(value.toLowerCase()))fail('Boolean questions need Answer: true or Answer: false.',line);
    question!.options=[{option_text:'True',is_correct:value.toLowerCase()==='true'},{option_text:'False',is_correct:value.toLowerCase()==='false'}];
   }else{
    if(question!.answer_type!=='recognition')fail('Target: belongs under a recognition question.',line);
    question!.target=bounded(value,100,'Target sign label',line);
   }continue;
  }
  if(!['xp','signs','content'].includes(key))fail(`Unknown field ${match![1]}. Use the template field names.`,line);
  if(question||fields.has(key))fail(`${key}: belongs once before this lesson’s questions.`,line);fields.add(key);
  if(key==='xp'){if(!/^\d+$/.test(value)||Number(value)>2147483647)fail('XP must be a whole number from 0 to 2147483647.',line);lesson!.xp_reward=Number(value)}
  if(key==='content')lesson!.content=bounded(value,6000,'Lesson content',line);
  if(key==='signs'){const labels=value?value.split(',').map(s=>s.trim()):[];if(labels.some(s=>!s||s.length>100)||labels.length>50||new Set(labels.map(s=>s.toLowerCase())).size!==labels.length)fail('List up to 50 distinct sign labels, separated by commas.',line);lesson!.signs=labels}
 }
 if(mode==='course'&&!plan.title)fail('Add Course: with a course title.',1);
 if(!plan.lessons.length)fail('Add at least one Lesson:.',1);
 for(const l of plan.lessons){
  if(!l.content)fail(`Add Content: for “${l.title}”.`,l.line);
  for(const q of l.exercises){
   if(q.answer_type==='recognition'&&!q.target)fail('Recognition questions need Target: with an existing sign label.',q.line);
   if(q.answer_type!=='recognition'&&(q.options.length<2||q.options.length>6||q.options.filter(o=>o.is_correct).length!==1))fail('Questions need 2–6 choices and exactly one correct answer (*); boolean questions need Answer:.',q.line);
  }
 }
 return plan;
}
