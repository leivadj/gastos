# Gastos del Hogar

App web para llevar las cuentas de la casa, con un motor de **cuotas
automáticas**: en vez de editar a mano "cuota 03/06" cada mes, guardas la
fecha en que empezó la compra y el número total de cuotas, y la app calcula
sola en qué cuota vas, todos los meses, para siempre.

## Qué incluye

- `supabase/schema.sql` — el esquema completo de base de datos (tablas +
  vistas que calculan la cuota vigente por fecha).
- `supabase/seed.sql` — datos de ejemplo tomados de tu Excel real, para que
  la app no empiece vacía. Revisa y ajusta lo que corresponda desde la app.
- Una app Next.js con 5 pantallas: Inicio (dashboard), Cuotas, Gastos fijos,
  Ingresos y Personas.

## Puesta en marcha (una sola vez)

### 1. Cargar la base de datos

En el dashboard de tu proyecto de Supabase → **SQL Editor** → *New query*:

1. Pega y ejecuta todo el contenido de `supabase/schema.sql`.
2. Pega y ejecuta todo el contenido de `supabase/seed.sql`.
3. (Opcional) Verifica que funcionó: `select * from vista_cuotas_mes_actual;`
   debería mostrarte las compras en cuotas vigentes este mes, ya calculadas.

### 2. Crear tu usuario de acceso

Solo tú vas a entrar a la app por ahora. En el dashboard de Supabase →
**Authentication → Users → Add user** → crea tu usuario con tu correo y una
contraseña (marca "Auto Confirm User"). Esa es la cuenta con la que entras
a la app — no hay registro público.

### 3. Subir el código a GitHub

```
cd gastos-hogar-app
git init
git add .
git commit -m "Primera versión"
```

Crea un repositorio vacío en GitHub (botón "New repository", sin plantilla)
y sigue las instrucciones que te muestra para conectar tu carpeta local y
hacer push (`git remote add origin ...` y `git push -u origin main`).

### 4. Desplegar en Vercel

En vercel.com → **Add New → Project** → elige el repositorio que acabas de
subir. Antes de darle a "Deploy", en **Environment Variables** agrega:

- `NEXT_PUBLIC_SUPABASE_URL` = la URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon/public key

Dale a Deploy. En 1-2 minutos tienes la URL pública de tu app (podrás
agregarla a la pantalla de inicio de tu celular como un ícono más).

## Desarrollo local (opcional)

```
cp .env.example .env.local   # y completa con tus datos de Supabase
npm install
npm run dev
```

## Cómo funciona el motor de cuotas

Cada compra en cuotas guarda: descripción, monto total, número de cuotas y
la fecha en que empezó a pagarse. La vista `vista_cuotas_mes_actual` calcula,
usando la fecha de hoy, en qué cuota vas — sin ningún proceso mensual ni
edición manual. Cuando pasan todas las cuotas, la compra deja de aparecer
sola, sin que nadie tenga que borrarla ni actualizarla.

## Próximos pasos posibles

- Invitar a Marian (o a quien corresponda) con su propio usuario.
- Agregar recordatorios/notificaciones cuando falta poco para que termine
  una cuota.
- Marcar como "pagado" cada cargo del mes (la tabla `pagos` ya está lista
  para eso, falta conectarla a la interfaz).
