# Font

In uso:

```
fonts/IBMPlexSans-Regular.ttf     file originale
fonts/IBMPlexSans-Regular.woff2   stessa font, convertita per un caricamento più leggero
```

**IBM Plex Sans**, licenza SIL Open Font License 1.1 — libera per qualsiasi uso, incluso web e commerciale, nessuna restrizione. Provata come alternativa gratuita a ABC Diatype (font a pagamento, licenza trial non utilizzabile su un sito pubblico), dopo Hanken Grotesk.

Nota: abbiamo solo il peso **Regular (400)**, ma il sito lo usa a **peso 500** (`font-weight: 500` in `style.css`) — senza un vero file "Medium", il browser lo inspessisce artificialmente (bold finto). Se vuoi un peso 500 "vero", scarica anche `IBMPlexSans-Medium.ttf` dalla stessa famiglia (es. da Google Fonts / GitHub IBM/plex) e aggiungi un secondo blocco `@font-face` con `font-weight: 500` che punti a quel file — il resto del sito non cambia.
