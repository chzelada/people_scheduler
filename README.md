# People Scheduler

Aplicación de escritorio multiplataforma para programar voluntarios de iglesia (Monaguillos y Lectores) con distribución equitativa, reglas de emparejamiento de hermanos y seguimiento de ausencias.

## Funcionalidades

- **Gestión de Voluntarios**: Agregar, editar y gestionar voluntarios con información de contacto
- **Asignación de Servicios**: Asignar voluntarios a diferentes roles (Monaguillos, Lectores)
- **Programación Inteligente**: Algoritmo de satisfacción de restricciones con puntuación ponderada para distribución equitativa
- **Emparejamiento de Hermanos**: Configurar grupos familiares para programar juntos o separados
- **Seguimiento de Ausencias**: Registrar cuando los voluntarios no están disponibles (con búsqueda integrada)
- **Reportes de Equidad**: Visualizar distribución de asignaciones por persona y por servicio
- **Importación CSV**: Importar voluntarios desde archivo CSV con detección de duplicados
- **Exportación Excel**: Exportar horarios a Excel para imprimir o compartir

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework Desktop | Tauri 2.0 (backend Rust) |
| Frontend | React + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| Base de Datos | DuckDB (local) |
| Exportación Excel | xlsxwriter (Rust) |

## Prerrequisitos

- [Node.js](https://nodejs.org/) (v18 o posterior)
- [Rust](https://www.rust-lang.org/tools/install) (última versión estable)
- Dependencias específicas de plataforma para Tauri:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - **Linux**: Ver [prerrequisitos de Tauri](https://tauri.app/start/prerequisites/)

## Configuración de Desarrollo

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/chzelada/people_scheduler.git
   cd people_scheduler
   ```

2. Instalar dependencias de Node.js:
   ```bash
   npm install
   ```

3. Ejecutar en modo desarrollo:
   ```bash
   npm run tauri dev
   ```

## Compilación para Producción

### macOS
```bash
npm run tauri build
```
La aplicación compilada estará en `src-tauri/target/release/bundle/macos/`

### Windows
```bash
npm run tauri build
```
La aplicación compilada estará en `src-tauri/target/release/bundle/msi/`

## Estructura del Proyecto

```
people_scheduler/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── common/               # Button, Modal, Table, Sidebar
│   │   ├── people/               # PersonList, PersonForm, CSVImport
│   │   ├── schedule/             # ScheduleCalendar, ScheduleGenerator
│   │   └── reports/              # FairnessReport
│   ├── pages/                    # Dashboard, Personas, Horarios, Ausencias
│   ├── stores/                   # Zustand stores
│   ├── services/                 # Wrappers de API Tauri
│   └── types/                    # Tipos TypeScript
├── src-tauri/                    # Backend Rust
│   └── src/
│       ├── db/                   # Conexión DuckDB, migraciones
│       ├── models/               # Person, Job, Schedule, Assignment
│       ├── commands/             # Comandos Tauri
│       ├── scheduler/            # Algoritmo de programación
│       └── export/               # Generación de Excel
└── migrations/                   # Archivos SQL de esquema
```

## Esquema de Base de Datos

La aplicación usa DuckDB como base de datos local embebida:

| Tabla | Propósito |
|-------|-----------|
| `jobs` | Servicios (Monaguillos, Lectores) |
| `people` | Información de voluntarios |
| `person_jobs` | Qué servicios puede hacer cada persona |
| `sibling_groups` | Grupos familiares con reglas de emparejamiento |
| `unavailability` | Períodos cuando no pueden servir |
| `schedules` | Horarios mensuales |
| `service_dates` | Fechas de servicio dentro de un horario |
| `assignments` | Persona asignada a servicio en fecha específica |
| `assignment_history` | Historial para cálculo de equidad |

## Algoritmo de Programación

El programador usa un enfoque de satisfacción de restricciones con puntuación ponderada:

**Restricciones Duras** (debe cumplir):
- La persona debe estar calificada para el servicio
- La persona debe estar disponible en la fecha
- La persona debe estar activa
- No exceder semanas consecutivas máximas

**Restricciones Suaves** (optimizar):
- Distribución equitativa (asignaciones iguales por año)
- Preferencia de frecuencia
- Reglas de emparejamiento de hermanos
- Nivel de preferencia de la persona

**Fórmula de Puntuación**:
```
score = 1.0 / (asignaciones_este_año + 1.0)
```
Menos asignaciones = puntuación más alta = mayor prioridad

**Reglas de Hermanos**:
- **TOGETHER (Juntos)**: Si se selecciona a una persona, se intenta agregar a sus hermanos
- **SEPARATE (Separados)**: Hermanos nunca se programan juntos

## Uso

1. **Agregar Servicios**: Ir a Configuración para crear los servicios
2. **Agregar Personas**: Agregar voluntarios en la página de Personas (manual o CSV)
3. **Registrar Ausencias**: Registrar vacaciones o tiempo libre
4. **Configurar Grupos Familiares**: Crear grupos con reglas de emparejamiento
5. **Generar Horario**: Crear horarios mensuales automáticamente
6. **Revisar y Ajustar**: Hacer cambios manuales si es necesario
7. **Publicar y Exportar**: Finalizar y exportar a Excel

## Reportes

La página de Reportes muestra:
- Distribución de asignaciones por persona
- Conteo de asignaciones como Monaguillo y Lector por separado
- Fecha de última asignación
- Estadísticas generales (promedio, máximo, mínimo)

## Licencia

MIT
