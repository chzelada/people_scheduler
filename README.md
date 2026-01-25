# People Scheduler

Aplicación de escritorio multiplataforma para programar voluntarios de iglesia (Monaguillos y Lectores) con distribución equitativa, reglas de emparejamiento de hermanos y seguimiento de ausencias.

## Funcionalidades

- **Gestión de Voluntarios**: Agregar, editar y gestionar voluntarios con información de contacto
- **Asignación de Servicios**: Asignar voluntarios a diferentes roles (Monaguillos, Lectores)
- **Sub-posiciones por Servicio**:
  - **Monaguillos**: Posiciones 1, 2, 3 y 4
  - **Lectores**: Monitor, Primera Lectura, Salmo y Segunda Lectura
- **Rotación de Posiciones**: Algoritmo de "bolsa" que asegura que cada persona rote por todas las posiciones antes de repetir
- **Programación Inteligente**: Algoritmo de satisfacción de restricciones con puntuación ponderada para distribución equitativa
- **Emparejamiento de Hermanos**: Configurar grupos familiares para programar juntos o separados
- **Seguimiento de Ausencias**: Registrar cuando los voluntarios no están disponibles (con búsqueda integrada)
- **Reportes de Equidad**: Visualizar distribución de asignaciones por persona y por servicio con búsqueda integrada
- **Historial de Posiciones**: Ver el historial detallado de cada voluntario con números de posición e iconos
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
│   │   └── reports/              # FairnessReport, PersonHistoryModal
│   ├── pages/                    # Dashboard, Personas, Horarios, Ausencias
│   ├── stores/                   # Zustand stores
│   ├── services/                 # Wrappers de API Tauri
│   └── types/                    # Tipos TypeScript
├── src-tauri/                    # Backend Rust
│   └── src/
│       ├── db/                   # Conexión DuckDB, migraciones
│       ├── models/               # Person, Job, Schedule, Assignment
│       ├── commands/             # Comandos Tauri (incluye test_data)
│       ├── scheduler/            # Algoritmo de programación y rotación
│       └── export/               # Generación de Excel
├── migrations/                   # Archivos SQL de esquema
└── test_data/                    # CSV para datos de prueba
```

## Esquema de Base de Datos

La aplicación usa DuckDB como base de datos local embebida:

| Tabla | Propósito |
|-------|-----------|
| `jobs` | Servicios (Monaguillos, Lectores) |
| `job_positions` | Sub-posiciones por servicio (ej: Monaguillo 1-4, Lector Monitor) |
| `people` | Información de voluntarios |
| `person_jobs` | Qué servicios puede hacer cada persona |
| `sibling_groups` | Grupos familiares con reglas de emparejamiento |
| `unavailability` | Períodos cuando no pueden servir |
| `schedules` | Horarios mensuales |
| `service_dates` | Fechas de servicio dentro de un horario |
| `assignments` | Persona asignada a servicio en fecha específica (incluye posición) |
| `assignment_history` | Historial para cálculo de equidad y rotación de posiciones |

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

### Algoritmo de Rotación de Posiciones ("Bolsa")

Cada voluntario tiene una "bolsa" de posiciones pendientes por completar. El algoritmo garantiza que cada persona rote por todas las posiciones antes de repetir:

1. **Construcción de la Bolsa**: Para cada persona, se calcula qué posiciones NO ha hecho en el ciclo actual
2. **Priorización por Escasez**: Se asignan primero las posiciones que menos personas tienen disponibles en su bolsa
3. **Asignación por Restricción**: Entre los candidatos con la posición disponible, se elige al más restringido (bolsa más pequeña)
4. **Renovación de Bolsa**: Cuando la bolsa se vacía, se rellena con todas las posiciones (nuevo ciclo)

**Ejemplo de Rotación (Monaguillos)**:
```
Ciclo 1: 3 → 1 → 4 → 2 (bolsa vacía, se rellena)
Ciclo 2: 1 → 2 → 3 → 4 (bolsa vacía, se rellena)
Ciclo 3: 2 → 4 → 1 → ...
```

Esto asegura distribución equitativa de posiciones a largo plazo.

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
- Distribución de asignaciones por persona (con barra de búsqueda)
- Conteo de asignaciones como Monaguillo y Lector por separado
- Fecha de última asignación
- Estadísticas generales (promedio, máximo, mínimo)

**Historial de Posiciones**: Al hacer clic en el nombre de un voluntario, se abre un modal con su historial detallado mostrando:
- Números de posición para Monaguillos (1, 2, 3, 4)
- Iconos para Lectores:
  - 👁 Monitor
  - 📖 Primera Lectura
  - 🎵 Salmo
  - 📚 Segunda Lectura

## Desarrollo

### Datos de Prueba

Para desarrollo y pruebas, la aplicación incluye comandos para importar datos de prueba:

1. Colocar un archivo CSV en `test_data/personas.csv` con el formato:
   ```csv
   Nombre,Apellido,Telefono,Servicios
   Juan,Pérez,555-1234,Monaguillos
   María,García,555-5678,"Monaguillos,Lectores"
   ```

2. En el Dashboard, hacer clic en "Cargar Datos de Prueba" para importar el CSV y generar horarios para todo el año actual

### Ubicación de la Base de Datos

La base de datos DuckDB se guarda en:
- **macOS**: `~/Library/Application Support/com.chzelada.people-scheduler/people_scheduler.duckdb`
- **Windows**: `%APPDATA%\com.chzelada.people-scheduler\people_scheduler.duckdb`

Para reiniciar la base de datos, eliminar el archivo `.duckdb` y sus archivos WAL asociados.

## Licencia

MIT
