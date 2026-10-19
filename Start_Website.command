#!/bin/bash
# Browser in cui si apre il sito: il nome è quello che vedi nella cartella Applicazioni
# (Vivaldi, Safari, "Google Chrome"...). Se il Mac non lo trova, il sito si apre nel browser predefinito.
BROWSER_APP="Vivaldi"

# Spostati nella cartella in cui si trova questo file
cd "$(dirname "$0")"

echo "====================================="
echo "Avvio ambiente di sviluppo locale..."
echo "====================================="

# 1. Trova e uccidi forzatamente eventuali processi rimasti "appesi" sulla porta 8000
echo "Controllo se ci sono processi orfani sulla porta 8000..."
PID=$(lsof -ti:8000)
if [ ! -z "$PID" ]; then
  echo "Trovato processo attivo sulla porta 8000 (PID: $PID). Terminazione forzata..."
  kill -9 $PID
  sleep 1 # Attendi un secondo per assicurarti che la porta sia liberata
else
  echo "Nessun processo pendente trovato."
fi

# 2. Nessuna compilazione Vite/Webpack necessaria: i file Vanilla JS/CSS si sincronizzano automaticamente al refresh.
echo "Sincronizzazione file completata (Vanilla JS/CSS auto-sync)."

# 3. Apri automaticamente il sito nel browser scelto in cima a questo file (BROWSER_APP).
#    Prima si apriva "il browser predefinito" del Mac: tolto e reinstallato Vivaldi, il predefinito è cambiato (di solito
#    torna Safari) e il sito non si apriva più lì. Ora il browser si sceglie qui; se non c'è, si usa quello predefinito.
#    Si aspetta che il server risponda (al massimo 10 secondi), così la pagina non si apre prima che sia pronto.
echo "Apertura del browser ($BROWSER_APP)..."
(
  for i in $(seq 1 50); do
    curl -s -o /dev/null http://localhost:8000/ && break
    sleep 0.2
  done
  if ! open -a "$BROWSER_APP" http://localhost:8000 2>/dev/null; then
    echo "$BROWSER_APP non trovato: apro il sito nel browser predefinito del Mac."
    open http://localhost:8000
  fi
) &

# 4. Avvia il server Node
echo "Avvio server locale su http://localhost:8000"
node server.js
