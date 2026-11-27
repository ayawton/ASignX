import assert from 'node:assert/strict'
import { pageNumbers } from '../src/data/pagination.js'
assert.deepEqual(pageNumbers(1, 1), [1])
assert.deepEqual(pageNumbers(3, 5), [1, 2, 3, 4, 5])
assert.deepEqual(pageNumbers(10, 20), [1, 'gap-9', 9, 10, 11, 'gap-20', 20])
assert.deepEqual(pageNumbers(1, 20), [1, 2, 3, 'gap-20', 20])
assert.deepEqual(pageNumbers(20, 20), [1, 'gap-18', 18, 19, 20])
assert.deepEqual(pageNumbers(10, 20, 0), [1, 'gap-10', 10, 'gap-20', 20])
for (let total = 1; total <= 100; total++) for (let current = 1; current <= total; current++) {
 const numbers = pageNumbers(current, total).filter(value => typeof value === 'number')
 assert.equal(numbers[0], 1)
 assert.equal(numbers.at(-1), total)
 assert.ok(numbers.includes(current))
 assert.equal(new Set(numbers).size, numbers.length)
 assert.ok(numbers.length <= 5)
}
console.log('PASS compact pagination, boundary pages, current neighbors, mobile range and direct-jump destinations')
