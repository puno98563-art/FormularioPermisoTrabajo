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

## Publicar en Render

El archivo `render.yaml` configura un servicio web con Docker. Para publicarlo:

1. Sube estos cambios a GitHub.
2. En Render, crea un **Blueprint** y conecta el repositorio `FormularioPermisoTrabajo`.
3. Render leerá `render.yaml`; confirma la creación del servicio.
4. Cuando el despliegue termine, abre la URL asignada por Render.

La imagen Docker instala LibreOffice para permitir la conversión de Word a PDF en el servidor. El plan gratuito no ofrece disco persistente para este servicio: los Word guardados pueden desaparecer cuando Render reinicie o vuelva a desplegar la aplicación.

## Documentos y privacidad

Los Word generados se guardan en `generated-documents/` y permanecen allí hasta que se eliminen manualmente. Esa carpeta, las plantillas de prueba y los archivos temporales están excluidos de Git para evitar publicar documentos de usuarios accidentalmente.

El servidor no incluye autenticación y escucha en todas las interfaces de red. Cualquiera que tenga la URL puede utilizarlo, y los enlaces a documentos no sustituyen controles de acceso. No cargues documentos sensibles ni compartas la URL públicamente sin añadir medidas de autenticación y revisar el tratamiento de datos.

## GitHub

Antes de publicar, comprueba que los archivos Word privados y cualquier configuración local no estén incluidos:

```powershell
git status --short
```
