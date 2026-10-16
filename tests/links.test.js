import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('link checking covers historical redirects, encoded paths, fragments, and case sensitivity',()=>{
  execFileSync('python3',['tests/test_links.py'],{stdio:'pipe'});
});
