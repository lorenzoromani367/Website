# Font

In uso:

```
fonts/Inter-Regular.ttf     file originale
fonts/Inter-Regular.woff2   stessa font, convertita per un caricamento più leggero
```

**Inter**, licenza SIL Open Font License 1.1 — libera per qualsiasi uso, incluso web e commerciale, nessuna restrizione. Sostituisce IBM Plex Sans.

Nota: abbiamo solo il peso **Regular (400)**, ma il sito lo usa a **peso 600** (`font-weight: 600` in `style.css`) — senza un vero file "SemiBold", il browser lo inspessisce artificialmente (bold finto). Se vuoi un peso 600 "vero", scarica anche `Inter-SemiBold.ttf` dalla stessa famiglia (es. da Google Fonts / rsms/inter su GitHub) e aggiungi un secondo blocco `@font-face` con `font-weight: 600` che punti a quel file — il resto del sito non cambia.
