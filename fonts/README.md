# Font

In uso:

```
fonts/StrichpunktSans-Regular.ttf     file originale
fonts/StrichpunktSans-Regular.woff2   stessa font, convertita per un caricamento più leggero
```

**Strichpunkt Sans**, licenza SIL Open Font License 1.1 — libera per qualsiasi uso, incluso web e commerciale, nessuna restrizione. Sostituisce Inter.

Nota: abbiamo solo il peso **Regular (400)**, ma il sito lo usa a **peso 600** (`font-weight: 600` in `style.css`) — senza un vero file "SemiBold", il browser lo inspessisce artificialmente (bold finto). Se vuoi un peso 600 "vero", scarica anche `StrichpunktSans-SemiBold.ttf` dalla stessa famiglia e aggiungi un secondo blocco `@font-face` con `font-weight: 600` che punti a quel file — il resto del sito non cambia.

`Inter-Regular.ttf`/`.woff2` restano nella cartella (non più usati) solo per tornare indietro velocemente, se un giorno si preferisce di nuovo Inter.
