import test from 'node:test';
import assert from 'node:assert/strict';
import { composerInfoReads, composerInfoSettings, exposedInfo, infoKinds, listedInfo } from './composer-info-settings.ts';

test('visibility supports top, catalog-only and off while retaining legacy checkbox choices', () => {
  const keys = infoKinds.map(kind => kind.key);
  assert.deepEqual(exposedInfo(), keys);
  assert.deepEqual(listedInfo(), infoKinds.map(kind => kind.key));
  const values = { showDiff:'목록에만 표시', showChildren:'끄기', showGoal:'상단 표시', showWorkflow:'끄기' };
  assert.deepEqual(exposedInfo(values), keys.filter(key => !['diff','children','workflow'].includes(key)));
  assert.ok(listedInfo(values).includes('diff'));
  assert.ok(!listedInfo(values).includes('children'));
  assert.ok(!listedInfo(values).includes('workflow'));
  assert.deepEqual(exposedInfo({ showDiff:false, showGoal:true }), keys.filter(key => key !== 'diff'));
  assert.ok(listedInfo({ showDiff:false }).includes('diff'));
  assert.deepEqual(exposedInfo({ showDiff:'invalid' }), keys);
  for (const kind of infoKinds) {
    const descriptor = composerInfoSettings[kind.setting];
    assert.equal(descriptor.type, 'select');
    assert.equal(descriptor.default, '상단 표시');
    assert.deepEqual(descriptor.options, ['상단 표시','목록에만 표시','끄기']);
  }
  assert.equal(Object.hasOwn(composerInfoSettings,'showEmptyIcons'),false,'the obsolete empty-icon setting stays removed');
});

test('chat ui settings omit the latest layout choice and ignore a stored value', () => {
  assert.equal(Object.hasOwn(composerInfoSettings, 'infoButtonLayout'), false);
  assert.equal(Object.keys(composerInfoSettings)[0], 'showDiff');
  const keys = infoKinds.map(kind => kind.key);
  assert.deepEqual(exposedInfo({ infoButtonLayout:'오른쪽 캡슐', showDiff:'끄기' }), keys.filter(key => key !== 'diff'));
  assert.equal(listedInfo({ infoButtonLayout:'오른쪽 캡슐', showDiff:'끄기' }).includes('diff'), false);
  assert.equal(listedInfo({ infoButtonLayout:'가운데 최신으로' }).length, keys.length);
});

test('read gates stop only explicit off and share the timeline across Plan, Goal and todos', () => {
  assert.deepEqual(composerInfoReads(),{timeline:true,children:true,parent:true,queue:true,pullRequest:true});
  const off=Object.fromEntries(infoKinds.map(kind=>[kind.setting,'끄기']));
  assert.deepEqual(composerInfoReads(off),{timeline:false,children:false,parent:false,queue:false,pullRequest:false});
  for(const key of ['showPlan','showGoal','showTodos']) {
    for(const value of ['상단 표시','목록에만 표시',false,undefined,'unknown']) {
      assert.equal(composerInfoReads({...off,[key]:value}).timeline,true);
    }
  }
  for(const value of ['상단 표시','목록에만 표시',false,undefined,'unknown']) {
    assert.equal(composerInfoReads({...off,showChildren:value}).children,true);
    assert.equal(composerInfoReads({...off,showParent:value}).parent,true);
    assert.equal(listedInfo({...off,showDiff:value}).includes('diff'),true);
  }
});

test('inactive information has an explicit opt-in setting with a hidden default',()=>{
 assert.equal(composerInfoSettings.showInactiveInfo.type,'boolean');
 assert.equal(composerInfoSettings.showInactiveInfo.default,false);
 assert.match(composerInfoSettings.showInactiveInfo.label,/비활성/);
 assert.deepEqual(composerInfoReads({showInactiveInfo:true}),composerInfoReads({showInactiveInfo:false}),'the display option does not change SDK reads');
});
