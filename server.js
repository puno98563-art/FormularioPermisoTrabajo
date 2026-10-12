"use strict";

const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
const PDF_CONVERSION_TIMEOUT_MS = 120_000;
const INDEX_FILE = path.join(__dirname, "index.html");
const DOCUMENTS_DIR = path.join(__dirname, "generated-documents");
fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

function libreOfficeExecutable() {
  if (process.env.LIBREOFFICE_PATH) {
    return path.isAbsolute(process.env.LIBREOFFICE_PATH) &&
      !fs.existsSync(process.env.LIBREOFFICE_PATH)
      ? null
      : process.env.LIBREOFFICE_PATH;
  }
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
            "LibreOffice",
            "program",
            "soffice.exe",
          ),
          "soffice.exe",
        ]
      : ["soffice"];
  return candidates.find((candidate) =>
    path.isAbsolute(candidate) ? fs.existsSync(candidate) : true,
  );
}

async function convertDocxToPdf(docxBytes, executable) {
  const workDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "formulario-pdf-"));
  try {
    const sourcePath = path.join(workDirectory, "documento-final.docx");
    const profilePath = path.join(workDirectory, "libreoffice-profile");
    await fs.promises.writeFile(sourcePath, docxBytes, { flag: "wx" });
    await new Promise((resolve, reject) => {
      const child = spawn(
        executable,
        [
          `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
          "--headless",
          "--nologo",
          "--nodefault",
          "--nofirststartwizard",
          "--convert-to",
          "pdf:writer_pdf_Export",
          "--outdir",
          workDirectory,
          sourcePath,
        ],
        { windowsHide: true },
      );
      let stderr = "";
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error("La conversión a PDF superó el tiempo límite."));
      }, PDF_CONVERSION_TIMEOUT_MS);
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-4000);
      });
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`LibreOffice terminó con código ${code}: ${stderr.trim()}`));
      });
    });
    const pdfPath = path.join(workDirectory, "documento-final.pdf");
    const pdfBytes = await fs.promises.readFile(pdfPath);
    if (!pdfBytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Error("LibreOffice no generó un PDF válido.");
    return pdfBytes;
  } finally {
    await fs.promises.rm(workDirectory, { recursive: true, force: true });
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readRequestBody(request, response) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_DOCUMENT_BYTES) {
      sendJson(response, 413, { error: "El documento supera el límite de 30 MB." });
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(INDEX_FILE).pipe(response);
    return;
  }

  const uploadMatch = pathname.match(/^\/api\/documents\/([0-9a-f-]{36})$/i);
  if (request.method === "POST" && uploadMatch) {
    const body = await readRequestBody(request, response);
    if (!body) return;
    if (!body.length) {
      sendJson(response, 400, { error: "El documento recibido está vacío." });
      return;
    }
    const documentPath = path.join(DOCUMENTS_DIR, `${uploadMatch[1]}.docx`);
    try {
      await fs.promises.writeFile(documentPath, body, { flag: "wx" });
    } catch (error) {
      if (error.code === "EEXIST") {
        sendJson(response, 409, { error: "El identificador del documento ya existe." });
        return;
      }
      throw error;
    }
    sendJson(response, 201, { persistent: true });
    return;
  }

  if (request.method === "POST" && pathname === "/api/pdf") {
    const body = await readRequestBody(request, response);
    if (!body) return;
    if (body.length < 4 || !body.subarray(0, 2).equals(Buffer.from("PK"))) {
      sendJson(response, 400, { error: "El documento enviado no es un Word .docx válido." });
      return;
    }
    const executable = libreOfficeExecutable();
    if (!executable) {
      sendJson(response, 503, {
        error:
          "No se encontró LibreOffice. Instálalo en el servidor o configura la ruta en LIBREOFFICE_PATH.",
      });
      return;
    }
    let pdfBytes;
    try {
      pdfBytes = await convertDocxToPdf(body, executable);
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 503, {
          error:
            "No se pudo iniciar LibreOffice. Comprueba la instalación o configura LIBREOFFICE_PATH.",
        });
        return;
      }
      console.error("No se pudo convertir el Word final a PDF:", error);
      sendJson(response, error.message.includes("tiempo límite") ? 504 : 422, {
        error: "LibreOffice no pudo generar el PDF. Comprueba que el Word sea válido.",
      });
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdfBytes.length,
      "Content-Disposition": 'attachment; filename="documento-final.pdf"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(pdfBytes);
    return;
  }

  const downloadMatch = pathname.match(/^\/d\/([0-9a-f-]{36})$/i);
  if (request.method === "GET" && downloadMatch) {
    let documentBytes;
    try {
      documentBytes = await fs.promises.readFile(
        path.join(DOCUMENTS_DIR, `${downloadMatch[1]}.docx`),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      sendJson(response, 404, { error: "El documento no existe o fue eliminado." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": documentBytes.length,
      "Content-Disposition": 'attachment; filename="documento-generado.docx"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(documentBytes);
    return;
  }

  sendJson(response, 404, { error: "Ruta no encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log(`Formulario local: http://localhost:${PORT}/`);
  console.log(`Los Word se guardan sin caducidad en ${DOCUMENTS_DIR}.`);
  console.log("Para revocar un enlace, elimina su archivo de generated-documents.");
  if (!libreOfficeExecutable())
    console.warn(
      "La generación de PDF está desactivada. Instala LibreOffice o configura LIBREOFFICE_PATH.",
    );
});
