# VELORA Store — lista para dominio + Wompi

Tienda full-stack en Node.js sin dependencias externas. Incluye catálogo responsive, selección por color/talla, combos, formulario de envío, creación de órdenes, redirección a Wompi, webhook firmado, página de resultado, inventario simple y panel básico de pedidos.

## Precios configurados

- 1 camiseta: COP $65.000
- 2 camisetas: COP $110.000
- 3 camisetas: COP $160.000

Los precios se calculan **en el servidor**, no en el navegador, para evitar que un cliente modifique el total antes del pago.

## 1. Probar localmente

Requiere Node.js 20 o superior.

```bash
cp .env.example .env
node server.js
```

Abre `http://localhost:3000`.

El sitio se puede navegar sin llaves de Wompi. El botón de pago avisará que la pasarela está pendiente hasta que configures las llaves.

## 2. Configurar Wompi

En `.env`, reemplaza:

```env
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...
```

Empieza en Sandbox. Para producción Wompi usa claves con prefijos `pub_prod_`, `prv_prod_`, `prod_integrity_` y `prod_events_`.

El backend genera la firma SHA-256 de integridad del checkout. El secreto de integridad nunca se expone al navegador.

### Webhook

En el Dashboard de Wompi configura la URL de eventos:

```text
https://TU-DOMINIO.com/api/webhooks/wompi
```

El servidor valida el checksum del evento antes de actualizar el pedido. El inventario se descuenta únicamente cuando llega una transacción `APPROVED` válida.

Documentación oficial:
- https://docs.wompi.co/docs/colombia/widget-checkout-web/
- https://docs.wompi.co/docs/colombia/eventos/
- https://docs.wompi.co/docs/colombia/ambientes-y-llaves/

## 3. Dominio

Cambia en `.env`:

```env
BASE_URL=https://tudominio.com
```

Despliega el proyecto en un hosting que ejecute Node 20. El repositorio incluye `Dockerfile` y `render.yaml` como base. En el proveedor de hosting:

1. Crea el servicio web.
2. Carga las variables de entorno del `.env`.
3. Agrega tu dominio personalizado.
4. En el registrador del dominio crea el registro DNS que te indique el proveedor (normalmente CNAME o A).
5. Activa HTTPS antes de pasar Wompi a producción.

## 4. Datos de la tienda

Edita estas variables:

```env
STORE_NAME=VELORA
STORE_EMAIL=ventas@tudominio.com
STORE_WHATSAPP=573001234567
STORE_CITY=Medellín, Colombia
LEGAL_NAME=...
NIT=...
SHIPPING_FEE_COP=0
```

También completa `public/politicas.html` con tus políticas reales.

## 5. Panel de pedidos

Configura un token largo:

```env
ADMIN_TOKEN=un-token-muy-largo-y-aleatorio
```

Visita:

```text
https://tudominio.com/admin.html
```

Pega el token para consultar las órdenes.

## 6. Inventario

El inventario inicial está en `data/inventory.json`. Las tallas configuradas son S, M, L y XL.

Este paquete usa archivos JSON para que sea fácil de desplegar y entender. **Si vas a manejar volumen real**, usa almacenamiento persistente o migra `orders.json` e `inventory.json` a PostgreSQL/Supabase/MySQL. En servicios con disco efímero, los archivos locales pueden perderse al reiniciar.

## 7. Fotografías y marcas

Las imágenes incluidas son mockups generados durante el diseño de la tienda. Para una tienda comercial, reemplázalas por fotografías reales de los artículos exactos que vas a vender, con colores, referencias y detalles que coincidan con tu inventario.

VELORA está presentada como comercio independiente de reventa y no como tienda oficial de Puma. Mantén facturas/procedencia de los productos y no publiques afirmaciones de autenticidad que no puedas respaldar.

## Estructura

```text
velora-store/
├── server.js                 Backend, checkout y webhook
├── .env.example              Variables que debes completar
├── Dockerfile                Despliegue por contenedor
├── render.yaml               Ejemplo de despliegue
├── data/
│   ├── inventory.json
│   └── orders.json
└── public/
    ├── index.html            Tienda
    ├── app.js
    ├── styles.css
    ├── resultado.html        Estado del pago
    ├── admin.html            Panel de pedidos
    ├── politicas.html
    └── assets/               Imágenes del catálogo
```

## Lista mínima antes de vender

- [ ] Reemplazar imágenes por fotos reales de cada referencia.
- [ ] Completar razón social, NIT y datos de contacto.
- [ ] Publicar políticas reales de envío, cambios, retracto y privacidad.
- [ ] Configurar dominio + HTTPS.
- [ ] Probar todo en Sandbox.
- [ ] Configurar webhook de Sandbox y comprobar `APPROVED`/`DECLINED`.
- [ ] Cambiar a llaves de producción de Wompi.
- [ ] Configurar almacenamiento persistente o una base de datos.
- [ ] Realizar una compra real de bajo valor y validar el flujo completo antes de lanzar publicidad.
