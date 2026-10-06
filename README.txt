ZeroStress Trips v2 · viajes compartidos

Esta versión transforma la base local en una base colaborativa con Firebase.

Incluye:
- Firebase Authentication con email/contraseña.
- Registro con nombre.
- Inicio de sesión persistente.
- Recuperación de contraseña por email.
- Viajes guardados en Firestore.
- Creador/administrador del viaje.
- Participantes con cuentas individuales.
- Código de invitación de 6 caracteres.
- Unirse a un viaje con código.
- Todos los participantes pueden editar el contenido del viaje.
- El creador mantiene la administración del viaje.
- Los viajes solo son visibles para sus participantes.
- Estructura preparada para itinerario, reservas, gastos y momentos.
- PWA con actualización de caché.

IMPORTANTE:
1. Crear/usar un proyecto Firebase.
2. Activar Authentication → Email/Password.
3. Crear Firestore Database.
4. Copiar la configuración Web de Firebase en firebase-config.js.
5. Publicar firestore.rules en Firestore.
6. Subir todos los archivos a GitHub Pages.

Nota:
- Esta versión todavía NO implementa el contenido completo de itinerario, reservas, gastos y momentos. Solo deja preparada la colaboración y la seguridad para la siguiente fase.
- Las imágenes del viaje se conservan como datos de la propia ficha. Para una versión comercial convendrá moverlas a Firebase Storage.
