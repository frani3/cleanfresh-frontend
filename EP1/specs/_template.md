<!--
  Plantilla para una spec o fix nueva. No es un ítem numerado en sí mismo
  (no lleva id propio, no va en la tabla de specs/README.md).

  Cómo usarla:
  1. Copiá este archivo.
  2. Renombralo a specs/NNN-spec-slug.md o specs/NNN-fix-slug.md, donde
     NNN es el próximo número correlativo (ver la tabla en README.md —
     el número es único entre specs y fixes, no se repite).
  3. Completá el frontmatter y borrá la sección que no corresponda
     (Spec o Fix — dejá solo una).
  4. Escribí el plan técnico aparte (en el chat, no en este archivo) y
     esperá aprobación antes de programar.
  5. Al terminar, agregá la fila en la tabla de specs/README.md.
-->

---
id: 000
type: spec
status: draft
---

# Spec NNN — Título corto de la funcionalidad

## Qué debe hacer

Descripción en lenguaje simple de qué tiene que hacer la funcionalidad
nueva. Si extiende o depende de otra spec/fix, decilo acá
("Extiende la Spec 004...").

## Acceptance Criteria

1. Condición concreta y verificable #1.
2. Condición concreta y verificable #2.
3. ...

---

<!-- Si es un FIX en vez de una SPEC, usá esta estructura en su lugar
     (cambiá también type: fix en el frontmatter y el título a "Fix NNN"): -->

---
id: 000
type: fix
status: draft
---

# Fix NNN — Título corto de qué se corrige

## Qué estaba mal

Descripción de qué comportamiento actual está mal (referenciá la
spec/fix original si corresponde, ej. "Spec 004, AC7").

## Comportamiento correcto esperado

Descripción del comportamiento correcto que debería tener en su lugar.

## Acceptance Criteria

1. Condición concreta y verificable #1.
2. Condición concreta y verificable #2.
3. ...
