import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function setup(value = "") {
  const require = createRequire(import.meta.url), state = [];
  let cursor = 0;
  const module = {exports:{}};
  const source = ts.transpileModule(readFileSync(new URL("../src/components/sm/SmAnswerCommentDialog.tsx",import.meta.url),"utf8"), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(source,{module,exports:module.exports,document:{body:{}},require:name => {
    if(name === "react") return {useEffect(){},useRef:()=>({current:null}),useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=value;}];}};
    if(name === "react-dom")return {createPortal:node=>node};
    if(name === "@/lib/sm/answerComments")return {SM_COMMENT_MAX_LENGTH:2000};
    return require(name);
  }});
  const saves=[];let closes=0;
  const render=()=>{cursor=0;return module.exports.SmAnswerCommentDialog({questionText:"Testfrage",value,onSave:comment=>saves.push(comment),onClose:()=>closes++});};
  const find=(node,predicate)=>{if(!node||typeof node!=="object")return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;};
  return {render,find,saves,get closes(){return closes;}};
}
test("typing never reaches autosave; Übernehmen emits one complete trimmed comment",()=>{
  const f=setup();
  for(const value of ["A","Aufgefüllt","Aufgefüllt wird am Nachmittag."]) {
    f.find(f.render(),node=>node.type==="textarea").props.onChange({target:{value}});
    assert.equal(f.saves.length,0);
  }
  const button=f.find(f.render(),node=>node.type==="button"&&node.props.children==="Übernehmen");
  assert.equal(button.props.disabled,false);button.props.onClick();
  assert.deepEqual(f.saves,["Aufgefüllt wird am Nachmittag."]);
});
test("closing discards unconfirmed typing and preserves the supplied original",()=>{
  const f=setup("Gespeicherter Kommentar");
  assert.equal(f.find(f.render(),node=>node.type==="textarea").props.value,"Gespeicherter Kommentar");
  f.find(f.render(),node=>node.type==="textarea").props.onChange({target:{value:"Noch nicht übernehmen"}});
  f.find(f.render(),node=>node.type==="button"&&node.props.children==="Zurück").props.onClick();
  assert.equal(f.closes,1);assert.equal(f.saves.length,0);
});
test("blank comments cannot be applied and final text is trimmed",()=>{
  const f=setup();
  assert.equal(f.find(f.render(),node=>node.type==="button"&&node.props.children==="Übernehmen").props.disabled,true);
  f.find(f.render(),node=>node.type==="textarea").props.onChange({target:{value:"  Ein vollständiger Kommentar.  "}});
  f.find(f.render(),node=>node.type==="button"&&node.props.children==="Übernehmen").props.onClick();
  assert.deepEqual(f.saves,["Ein vollständiger Kommentar."]);
});
