// CRA sirve public/ sin pasar por Webpack, así que el import ESM con bare
// specifier de la doc oficial de MSAL ("@azure/msal-browser/redirect-bridge")
// no se puede resolver en el navegador. En su lugar vendorizamos el bundle
// UMD que MSAL publica para este mismo propósito y lo copiamos a public/
// cada vez que se instalan dependencias, así queda sincronizado con la
// versión de @azure/msal-browser instalada.
const fs = require("fs");
const path = require("path");

// La package.json "exports" de @azure/msal-browser no expone este archivo
// como subpath público, así que resolvemos la raíz del paquete y accedemos
// a la ruta interna directamente en el filesystem.
const packageRoot = path.dirname(require.resolve("@azure/msal-browser/package.json"));
const source = path.join(packageRoot, "lib", "redirect-bridge", "msal-redirect-bridge.min.js");
const destination = path.join(__dirname, "..", "public", "msal-redirect-bridge.min.js");

fs.copyFileSync(source, destination);
console.log(`msal-redirect-bridge.min.js copiado a public/ (fuente: ${source})`);
