# People Scheduler

Aplicación para programar voluntarios de iglesia (Monaguillos y Lectores) con distribución equitativa, reglas de emparejamiento de hermanos y seguimiento de ausencias.

Disponible como:
- **Aplicación Web** (AWS Cloud)
- **Aplicación de Escritorio** (Tauri - macOS/Windows)

## Funcionalidades

- **Gestión de Voluntarios**: Agregar, editar y gestionar voluntarios con información de contacto y foto de perfil
- **Ficha del Servidor**: Click en el nombre para ver tarjeta con edad, cumpleaños, último y próximo servicio
- **Autenticación**: Sistema de login con roles (admin y servidor)
- **Asignación de Servicios**: Asignar voluntarios a diferentes roles (Monaguillos, Lectores)
- **Sub-posiciones por Servicio**:
  - **Monaguillos**: Posiciones 1, 2, 3 y 4
  - **Lectores**: Monitor, Primera Lectura, Salmo y Segunda Lectura
- **Rotación de Posiciones**: Algoritmo de "bolsa" que asegura que cada persona rote por todas las posiciones antes de repetir
- **Programación Inteligente**: Algoritmo de satisfacción de restricciones con puntuación ponderada para distribución equitativa
- **Emparejamiento de Hermanos**: Configurar grupos familiares para programar juntos o separados
- **Seguimiento de Ausencias**: Registrar cuando los voluntarios no están disponibles
- **Reportes de Equidad**: Visualizar distribución de asignaciones por persona y por servicio
- **Importación CSV**: Importar voluntarios desde archivo CSV con detección de duplicados

## Stack Tecnológico

### Versión Web (Cloud)

| Capa | Tecnología |
|------|------------|
| Frontend | React + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| API | Rust + Axum |
| Base de Datos | PostgreSQL (Neon Serverless) |
| Hosting | AWS (Lambda + API Gateway + S3 + CloudFront) |

### Versión Desktop

| Capa | Tecnología |
|------|------------|
| Framework | Tauri 2.0 (backend Rust) |
| Frontend | React + TypeScript + Vite |
| Base de Datos | DuckDB (local) |

---

## Arquitectura AWS

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USUARIOS                                   │
│                               │                                      │
│                               ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      CLOUDFRONT (CDN)                          │  │
│  │                    (tu-distribucion.cloudfront.net)            │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                         │
│           ┌────────────────┴────────────────┐                       │
│           ▼                                  ▼                       │
│  ┌─────────────────┐            ┌─────────────────────────────┐     │
│  │   S3 BUCKET     │            │       API GATEWAY           │     │
│  │   (Frontend)    │            │       (HTTP API)            │     │
│  │                 │            └──────────────┬──────────────┘     │
│  │  React App      │                           │                     │
│  │  HTML/CSS/JS    │                           ▼                     │
│  └─────────────────┘            ┌─────────────────────────────┐     │
│                                 │          LAMBDA              │     │
│                                 │    (Rust API - ARM64)        │     │
│                                 │                               │     │
│                                 │  - Autenticación JWT         │     │
│                                 │  - CRUD de voluntarios       │     │
│                                 │  - Generación de horarios    │     │
│                                 │  - Reportes                  │     │
│                                 └──────────────┬──────────────┘     │
│                                                │                     │
│                                                ▼                     │
│                                 ┌─────────────────────────────┐     │
│                                 │      NEON POSTGRES          │     │
│                                 │   (Database Serverless)     │     │
│                                 └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recursos AWS

| Servicio | Recurso | Propósito |
|----------|---------|-----------|
| CloudFront | CDN Distribution | Cache global y HTTPS |
| S3 | Bucket Frontend | Hosting de archivos estáticos |
| API Gateway | HTTP API | Enrutamiento de peticiones al API |
| Lambda | Función Rust | Backend API (ARM64, 256MB) |
| Neon | PostgreSQL | Base de datos serverless |

---

## Configuración de Desarrollo

### Prerrequisitos

- [Node.js](https://nodejs.org/) (v18 o posterior)
- [Rust](https://www.rust-lang.org/tools/install) (última versión estable)
- [PostgreSQL](https://www.postgresql.org/) o cuenta en [Neon](https://neon.tech/)

### 1. Clonar el repositorio

```bash
git clone https://github.com/chzelada/people_scheduler.git
cd people_scheduler
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

#### Frontend (`.env.production`)
```bash
# URL del API (para producción)
VITE_API_URL=https://tu-api-gateway.execute-api.us-east-1.amazonaws.com
```

#### API (`api/.env`)
```bash
# Conexión a PostgreSQL
DATABASE_URL=postgresql://usuario:password@host/database?sslmode=require

# Nivel de logging
RUST_LOG=info

# Secreto para JWT (usar un valor seguro en producción)
JWT_SECRET=tu-secreto-jwt-seguro
```

> **Nota**: Nunca commits el archivo `api/.env`. Usa `api/.env.example` como plantilla.

### 4. Ejecutar en desarrollo

#### Frontend (React)
```bash
npm run dev
```
Abre http://localhost:1420

#### API (Rust)
```bash
cd api
cargo run --bin api
```
El API estará en http://localhost:3000

### 5. Credenciales por defecto

Al iniciar por primera vez, se crea un usuario admin:
- **Usuario**: `admin`
- **Contraseña**: `admin123`

> **Importante**: Cambia la contraseña del admin en producción.

---

## Deploy a AWS

### Prerrequisitos para Deploy

- [AWS CLI](https://aws.amazon.com/cli/) configurado con un profile
- [cargo-zigbuild](https://github.com/rust-cross/cargo-zigbuild) para cross-compilation
- [Zig](https://ziglang.org/) (requerido por cargo-zigbuild)

```bash
# Instalar herramientas de cross-compilation
brew install zig
cargo install cargo-zigbuild
rustup target add aarch64-unknown-linux-gnu
```

### Configurar AWS Profile

```bash
aws configure --profile people-scheduler
```

### Ejecutar Deploy

```bash
./scripts/deploy.sh
```

El script realiza:
1. Compila el API para Lambda (ARM64)
2. Sube el código a Lambda
3. Compila el frontend para producción
4. Sincroniza con S3
5. Invalida el cache de CloudFront

---

## Estructura del Proyecto

```
people_scheduler/
├── src/                          # Frontend React
│   ├── components/               # Componentes reutilizables
│   ├── pages/                    # Páginas de la aplicación
│   ├── stores/                   # Estado global (Zustand)
│   ├── services/                 # Llamadas al API
│   └── types/                    # Tipos TypeScript
├── api/                          # Backend Rust (Web)
│   └── src/
│       ├── auth.rs               # Autenticación JWT
│       ├── routes/               # Endpoints del API
│       ├── models/               # Modelos de datos
│       └── db/                   # Conexión a PostgreSQL
├── src-tauri/                    # Backend Rust (Desktop)
├── migrations-postgres/          # Migraciones SQL
├── scripts/                      # Scripts de deploy
└── .env.production               # Variables de entorno (frontend)
```

---

## Esquema de Base de Datos

| Tabla | Propósito |
|-------|-----------|
| `users` | Usuarios del sistema (admin, servidores) |
| `jobs` | Servicios (Monaguillos, Lectores) |
| `job_positions` | Sub-posiciones por servicio |
| `people` | Información de voluntarios |
| `person_jobs` | Servicios asignados a cada persona |
| `sibling_groups` | Grupos familiares |
| `unavailability` | Períodos de no disponibilidad |
| `schedules` | Horarios mensuales |
| `service_dates` | Fechas de servicio |
| `assignments` | Asignaciones de personas a servicios |
| `assignment_history` | Historial para cálculo de equidad |

---

## Algoritmo de Programación

### Restricciones Duras
- La persona debe estar calificada para el servicio
- La persona debe estar disponible en la fecha
- La persona debe estar activa
- No exceder semanas consecutivas máximas

### Restricciones Suaves
- Distribución equitativa de asignaciones
- Preferencia de frecuencia del voluntario
- Reglas de emparejamiento de hermanos

### Algoritmo de Rotación ("Bolsa")

Cada voluntario tiene una "bolsa" de posiciones pendientes:

1. **Construcción**: Posiciones NO realizadas en el ciclo actual
2. **Priorización**: Asignar primero posiciones más escasas
3. **Asignación**: Elegir al más restringido (bolsa más pequeña)
4. **Renovación**: Al vaciar la bolsa, se rellena (nuevo ciclo)

---

## Seguridad

- **JWT** para autenticación de API
- **Argon2** para hash de contraseñas
- **HTTPS** obligatorio vía CloudFront
- Variables sensibles en AWS Lambda Environment Variables
- Archivos `.env` excluidos del repositorio

---

## Licencia

MIT
