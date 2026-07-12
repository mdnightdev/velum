import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost:3000/",
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.console = {
  log: (...args) => console.log('BROWSER LOG:', ...args),
  error: (...args) => console.error('BROWSER ERROR:', ...args),
  warn: (...args) => console.warn('BROWSER WARN:', ...args),
};

dom.window.addEventListener("error", (event) => {
  console.error("DOM ERROR:", event.error ? event.error.message : event.message, event.filename, event.lineno);
});

const script2 = dom.window.document.createElement("script");
script2.type = "module";
script2.src = "http://localhost:3000/src/main.tsx";
dom.window.document.head.appendChild(script2);

setTimeout(() => {
  console.log("Root HTML:", dom.window.document.getElementById("root").innerHTML.substring(0, 100));
  console.log("Done");
  process.exit(0);
}, 3000);
