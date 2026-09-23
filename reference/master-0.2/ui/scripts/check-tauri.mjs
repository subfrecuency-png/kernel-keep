import Ajv from 'ajv';
import fs from 'node:fs';
const schema=JSON.parse(fs.readFileSync('node_modules/@tauri-apps/cli/config.schema.json'));
const config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json'));
// Upstream schema includes Rust-specific formats and escaped patterns.
// This checks shape/types, not custom formats or native runtime behavior.
const validate=new Ajv({strict:false,unicodeRegExp:false,validateFormats:false}).compile(schema);
const result={valid:validate(config),errors:validate.errors,scope:'Configuration shape/types only; custom formats not checked; native build untested'};
fs.writeFileSync('../evidence/tauri-schema.json',JSON.stringify(result,null,2));console.log(result);if(!result.valid)process.exitCode=1;
