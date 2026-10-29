const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isCallAction,hasCallControls}=require('../preload.cjs');
const button=(label,tid,visible=true)=>({textContent:label,getAttribute:key=>key==='aria-label'?label:key==='data-tid'?tid:null,getClientRects:()=>visible?[{}]:[]});
test('observed video and audio call actions are recognized',()=>{
  for(const tid of ['default-chat-call-video-button','chat-call-video-button','chat-call-audio-button']) assert.equal(isCallAction(button('anything',tid)),true);
});
test('join/accept buttons are recognized without starting or changing the action',()=>{
  for(const label of ['Join now','Accept call','Audio call','Video call'])assert.equal(isCallAction(button(label)),true);
});
test('call menus, navigation, and media toggles are not treated as call initiation',()=>{
  for(const label of ['Calls','More call options','Mute mic','Turn camera off','Leave'])assert.equal(isCallAction(button(label)),false);
});
test('active call detection does not depend on exact ARIA wrapper roles',()=>{
  assert.equal(hasCallControls({querySelectorAll:()=>[button('Leave'),button('Mute mic')]}),true);
});
test('hidden call controls and partial controls do not trigger a call',()=>{
  assert.equal(hasCallControls({querySelectorAll:()=>[button('Leave',null,false),button('Mute mic')]}),false);
  assert.equal(hasCallControls({querySelectorAll:()=>[button('Turn camera off')]}),false);
});
