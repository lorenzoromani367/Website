#!/bin/bash
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

# 3. Apri automaticamente il sito nel browser predefinito
echo "Apertura del browser..."
open http://localhost:8000

# 4. Avvia il server Node
echo "Avvio server locale su http://localhost:8000"
node server.js
