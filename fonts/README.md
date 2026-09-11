# Font — TeX Gyre Heros

Metti qui i file del font con **esattamente** questi nomi (già collegati in `css/style.css`):

```
fonts/TeXGyreHeros-Regular.woff2   (formato preferito, più leggero)
fonts/TeXGyreHeros-Regular.ttf     (fallback per browser più vecchi)
```

Non serve nessun'altra modifica: appena i file sono in questa cartella il sito li carica automaticamente al posto del fallback Helvetica/Arial.

Se hai solo un `.otf` o un `.ttf`, puoi convertirlo in `.woff2` gratuitamente con https://cloudconvert.com/ttf-to-woff2 (o `fonttools`/`woff2_compress` da riga di comando).
