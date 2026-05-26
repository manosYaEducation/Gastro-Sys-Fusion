

Este documento establece las normas, convenciones y el flujo de trabajo completo (Git Workflow) para la gestión de versiones en los proyectos. El objetivo principal es mantener un historial limpio, escalable, trazable y facilitar la colaboración efectiva entre todos los desarrolladores del equipo.

---

## 1. Estructura de Ramas (Branching Model)

El proyecto se basa en una estructura organizada de ramas para aislar el desarrollo, las pruebas y la producción.

### Ramas Principales
- **`main`**: Contiene el código estable y en producción. Todo el código aquí debe estar verificado y funcional. Nunca se trabaja directamente en esta rama.

### Ramas de Desarrollo y Soporte
Para organizar el trabajo colaborativo y basado en fechas, utilizamos las siguientes ramas, las cuales nacen de `main` o de un entorno de integración y se deben fusionar de vuelta a través de un proceso de *Release*.

| Tipo de Rama | Formato / Prefijo | Ejemplo real | Descripción |
| :--- | :--- | :--- | :--- |
| **Funcionalidad** | `Feature/<Autor>/<YYYY-MM-DD>-<Descripción>` | `Feature/JavieraAB/2026-03-24-vista-icono` | Nuevas características o mejoras de UI/UX. |
| **Corrección / Fix**| `Fix/<Autor>/<YYYY-MM-DD>-<Descripción>` | `fix/GChristian/2026-03-03-correccion-carga` | Corrección de errores aislados. Puede sub-categorizarse como `Fix/Back-end/...` o `Fix/Front-end/...` |
| **Release** | `Release/<Autor>/<YYYY-MM-DD>` o `Release/<YYYY-MM-DD>` | `Release/Fdelfierro/2026-03-30` | Rama de integración de múltiples *features* y *fixes* para preparar un pase a producción (`main`). |
| **Hotfix** | `Hotfix/<YYYY-MM-DD>-<Descripción>` | `Hotfix/2026-03-30-caida-login` | Correcciones críticas directas a `main` que no pueden esperar a un Release. |

---

## 2. Convención de Mensajes de Commit

Adoptamos el estándar de **Conventional Commits**. Esto permite la generación de logs automáticos, versionado semántico y facilita el entendimiento del historial de un vistazo.

**Formato obligatorio:**
`<tipo>(<alcance opcional>): <descripción breve en minúsculas y modo imperativo>`

### Tipos permitidos:
- **`feat`**: Una nueva funcionalidad (ej. `feat: agregar sistema de autenticación JWT`).
- **`fix`**: Corrección de un error (ej. `fix(perfil): resolver superposición de imágenes`).
- **`docs`**: Cambios en la documentación (ej. `docs: actualizar el archivo de GIT_WORKFLOW`).
- **`style`**: Cambios que no afectan la lógica del código (espaciado, formato, punto y coma, etc.).
- **`refactor`**: Cambio en el código que ni corrige un error ni añade funcionalidad (optimización).
- **`perf`**: Mejora de rendimiento (ej. `perf(db): optimizar consultas SQL`).
- **`test`**: Añadir o corregir pruebas unitarias/integración.
- **`chore`**: Cambios en el proceso de construcción, herramientas auxiliares o dependencias.

> **Nota:** Evita mensajes genéricos como "cambios", "fix" o "arreglos". Si la modificación abarca mucho, es una señal de que el commit debió ser más atómico (dividido en partes).

---

## 3. Flujo de Trabajo (Paso a Paso)

### A. Inicio de una Tarea (Desarrollo)
1. **Sincronizar:** Siempre parte posicionándote en el último *Release* (la última versión estable).
   ```bash
   git checkout Release/YYYY-MM-DD
   git pull origin Release/YYYY-MM-DD
   ```
2. **Crear Rama de Feature/Fix:** Utiliza la nomenclatura del proyecto.
   ```bash
   git checkout -b Feature/MiNombre/2026-05-12-creacion-navbar
   ```
3. **Desarrollo y Commits Atómicos:** Trabaja en tu rama, haciendo commits lógicos, pequeños y frecuentes.
   ```bash
   git add .
   git commit -m "feat(navbar): implementar diseño dark-mode en la barra de navegación"
   ```
4. **Subir cambios al remoto:** Sube tu rama regularmente como copia de seguridad y para que otros puedan ver tu progreso.
   ```bash
   git push -u origin Feature/MiNombre/2026-05-12-creacion-navbar
   ```

### B. Proceso de Merge (Integración)
Cuando tu funcionalidad esté terminada, se integra al entorno mediante un **Merge Request / Pull Request (PR)**. No hacemos *merge* directo en local para mantener el historial intacto y permitir la revisión de código.

1. Abre un PR desde tu rama `Feature/...` hacia la rama de **Release** activa (ej. `Release/2026-05-15`) o, en su defecto, a `main` si el flujo lo amerita.
2. Solicita revisión (Code Review) de al menos un miembro del equipo.
3. Si hay conflictos, **el desarrollador responsable de la rama** debe resolverlos localmente:
   ```bash
   git fetch origin
   git merge origin/Release/2026-05-15
   # (Resolver conflictos en el editor)
   git commit -m "Merge branch 'Release/2026-05-15' into Feature/..."
   git push origin Feature/...
   ```
4. Una vez aprobado, se aprueba el Merge Request en GitHub. 

> **Tip:** Fomentamos el **Merge Commit** o el **Squash and Merge** en GitHub. El primero mantiene todo el historial atómico, y el segundo agrupa todos los pequeños commits en uno solo más descriptivo y limpio para la rama principal.

### C. Proceso de Release (Pase a Producción)
Una **rama de Release** agrupa todas las *Features* y *Fixes* completadas durante un ciclo de desarrollo (sprint).

1. El encargado de integración crea la rama de release:
   ```bash
   git checkout -b Release/2026-05-30 main
   ```
2. Los desarrolladores integran (fusionan) sus ramas de `Feature` dentro de la rama de `Release`.
3. Se realizan pruebas exhaustivas en el entorno de pruebas sobre esta rama.
4. Una vez estabilizada (solo se admiten `fix` en esta etapa, no nuevos `feat`), la rama se fusiona finalmente hacia `main`:
   ```bash
   git checkout main
   git merge --no-ff Release/2026-05-30
   git tag -a v1.2.0 -m "Versión 1.2.0: Módulo de perfiles y mejoras de UI"
   git push origin main --tags
   ```

---

## 4. Resolución de Conflictos

Los conflictos ocurren cuando dos ramas modifican las mismas líneas de un archivo o cuando un archivo es eliminado en una y modificado en otra.
1. Haz un `git fetch` para obtener los cambios del servidor.
2. Haz `git merge <rama-destino>` en tu rama.
3. Git marcará los conflictos en los archivos afectados con `<<<<<<<`, `=======` y `>>>>>>>`.
4. Abre los archivos en tu editor (ej. VSCode), decide qué código mantener y elimina las marcas de conflicto.
5. Guarda, haz `git add <archivo-resuelto>` y finalmente `git commit`.

---

## 5. Reglas de Oro y Buenas Prácticas

1. **NUNCA modifiques `main` directamente:** Todos los cambios deben pasar por una rama y luego un Pull Request o proceso de Release.
2. **Borrado de ramas:** Tras completar un Merge exitoso a la rama principal/release, la rama de origen (ej. tu Feature) debe ser **eliminada** (tanto local como en el remoto) para mantener el repositorio limpio.
   ```bash
   git branch -d Feature/MiNombre/...
   git push origin --delete Feature/MiNombre/...
   ```
3. **Pule antes de subir:** Asegúrate de que el código corre y compila sin errores antes de hacer un Pull Request.
4. **Commits frecuentes, push diario:** Evita perder trabajo realizando `git push` de tu rama al final del día.
5. **No subas basura:** Revisa siempre tu `.gitignore` para no subir carpetas de dependencias (`node_modules`), compilados (`.exe`, `output.css` innecesarios), ni archivos de entorno (`.env`).

---

*Última actualización: Mayo 2026 - Analizado para ajustarse al flujo histórico real del repositorio.*
