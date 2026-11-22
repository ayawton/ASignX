import assert from 'node:assert/strict'
import {coursePath,firstUnsolved} from '../src/data/learningPath.js'
const lessons=[{id:'a',completed_at:'saved'},{id:'b',completed_at:null},{id:'c',completed_at:null}]
assert.equal(coursePath(lessons).target.id,'b')
assert.equal(coursePath(lessons,'b').next.id,'c')
assert.equal(coursePath(lessons,'c').next.id,'b','Earlier unfinished lessons remain reachable')
assert.equal(coursePath(lessons).completed,1)
assert.equal(coursePath([]).target,null)
assert.equal(coursePath([]).next,null)
const done=lessons.map(l=>({...l,completed_at:'saved'}))
assert.equal(coursePath(done,'c').next,null)
assert.equal(coursePath(done).target.id,'a','Completed course offers review')
assert.equal(firstUnsolved([{solved:true},{solved:false},{solved:false}]),1)
assert.equal(firstUnsolved([{solved:true}]),0)
assert.equal(firstUnsolved([]),0)
console.log('PASS course continuation, completion, out-of-order learning, and saved-question resume')
