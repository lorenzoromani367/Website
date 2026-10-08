# Font

In uso:

```
fonts/StrichpunktSans-Regular.ttf     file originale
fonts/StrichpunktSans-Regular.woff2   stessa font, convertita per un caricamento più leggero
```

**Strichpunkt Sans**, licenza SIL Open Font License 1.1 — libera per qualsiasi uso, incluso web e commerciale, nessuna restrizione. Sostituisce Inter.

Nota: abbiamo solo il peso **Regular (400)**, ma il sito lo usa in "grassetto" (`font-weight: 600` sul `body` in `style_v58.css`). Ogni browser, senza un vero file SemiBold, inventava un grassetto finto a modo suo — più sottile su Safari, più spesso su Vivaldi/Chrome. Ora il file è dichiarato valido per tutti i pesi (`font-weight: 100 900` nel `@font-face`, quindi nessun browser inventa nulla) e lo spessore lo disegna il sito stesso con `-webkit-text-stroke` (variabile `--sans-stroke`, 0.035em, misurata per coincidere con Chrome): identico ovunque. Se un giorno arriva un vero file "SemiBold": aggiungi un secondo `@font-face` con `font-weight: 600` e azzera `--sans-stroke` (e il `font-weight: 100 900` del primo).

`Inter-Regular.ttf`/`.woff2` restano nella cartella (non più usati) solo per tornare indietro velocemente, se un giorno si preferisce di nuovo Inter.
