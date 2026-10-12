# Formulario de documentos

Aplicacion local para completar una plantilla Word, generar un documento y, en un paso separado, insertar un QR en los cuadros marcados «QR» y descargar el resultado como PDF.

## Requisitos

- Node.js 18 o posterior.
- LibreOffice para convertir los documentos Word a PDF.

## Ejecutar en Windows

1. Instala Node.js y LibreOffice.
2. Abre PowerShell en la carpeta del proyecto.
3. Ejecuta:

   ```powershell
   npm start
   ```

4. Abre <http://localhost:4173/>.

El servidor acepta el puerto desde la variable `PORT`. Si LibreOffice no está en una ruta reconocida, configura `LIBREOFFICE_PATH` con la ruta completa al ejecutable `soffice.exe` antes de iniciar la aplicación:

```powershell
$env:LIBREOFFICE_PATH = "C:\Program Files\LibreOffice\program\soffice.exe"
npm start
```

## Documentos y privacidad

Los Word generados se guardan en `generated-documents/` y permanecen allí hasta que se eliminen manualmente. Esa carpeta, las plantillas de prueba y los archivos temporales están excluidos de Git para evitar publicar documentos de usuarios accidentalmente.

El servidor no incluye autenticación y escucha en todas las interfaces de red. Úsalo solo en un equipo o red de confianza; no lo publiques directamente en Internet sin añadir controles de acceso y revisar el tratamiento de documentos sensibles.

## GitHub

Antes de publicar, comprueba que los archivos Word privados y cualquier configuración local no estén incluidos:

```powershell
git status --short
```
