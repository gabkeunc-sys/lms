import test from 'node:test';
import assert from 'node:assert/strict';
import {letterGrade, PASS_AVERAGE} from '../server/certs.mjs';

test('certificate letter grades and pass line', () => {
 assert.equal(PASS_AVERAGE, 60);
 assert.deepEqual([96, 90, 87.5, 80, 77.5, 72.5, 66.7, 60, 59.9].map(letterGrade), ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']);
});
