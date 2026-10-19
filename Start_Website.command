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
#    Si aspetta che il server sia in ascolto (al massimo 10 secondi), così la pagina non si apre prima che sia pronto.
#    Prova 1: il browser per nome. Prova 2: per percorso (se nel Mac ci sono più copie dell'app, o una vecchia rimasta nel
#    Cestino, il nome può puntare a quella sbagliata). Prova 3: il browser predefinito. Ogni passo scrive cosa risponde il Mac
#    (righe "[browser]"), e alla fine dice se il browser risulta acceso: se qualcosa non va, si vede qui.
URL="http://localhost:8000"
echo "Apertura del browser ($BROWSER_APP)... Se non si apre da solo, scrivi $URL nella barra degli indirizzi."
(
  # il server è pronto quando qualcosa ascolta sulla porta 8000 (si guarda la porta, non si fa una richiesta web: così
  # non dipende da proxy, VPN o altre impostazioni di rete del Mac)
  for i in $(seq 1 50); do
    lsof -ti:8000 -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.2
  done
  OPENED=""
  OUT=$(open -a "$BROWSER_APP" "$URL" 2>&1) && OPENED="per nome"
  if [ -z "$OPENED" ]; then
    echo "[browser] \"open -a $BROWSER_APP\" non è riuscito: $OUT"
    for APP in "/Applications/$BROWSER_APP.app" "$HOME/Applications/$BROWSER_APP.app"; do
      if [ -d "$APP" ]; then
        OUT=$(open -a "$APP" "$URL" 2>&1) && { OPENED="da $APP"; break; }
        echo "[browser] \"open -a $APP\" non è riuscito: $OUT"
      fi
    done
  fi
  if [ -z "$OPENED" ]; then
    echo "[browser] $BROWSER_APP non si apre: provo con il browser predefinito del Mac."
    open "$URL"
  fi
  sleep 5
  if pgrep -x "$BROWSER_APP" >/dev/null 2>&1; then
    echo "[browser] $BROWSER_APP è acceso${OPENED:+ (aperto $OPENED)}. Se il sito non compare, scrivi $URL nella barra degli indirizzi."
  else
    echo "[browser] $BROWSER_APP NON risulta acceso: aprilo a mano e scrivi $URL nella barra degli indirizzi."
  fi
) &

# 4. Per vedere dall'iPhone (o da un altro telefono) la versione che stai preparando PRIMA di pubblicarla: stesso Wi-Fi del Mac e,
#    nel Safari del telefono, uno degli indirizzi scritti qui sotto. Da quegli indirizzi il sito è in sola lettura (come per chi lo
#    visita: la modalità modifica c'è solo su localhost). La prima volta il Mac può chiedere se "node" può accettare connessioni: Consenti.
#    Se il telefono non si collega, qui compare anche una prova fatta dal Mac stesso (riga "[rete]"): se dice "risponde", il server è
#    a posto e il problema sta nella rete (Wi-Fi diverso, rete "ospiti", VPN acceso sul telefono) o nel firewall del Mac.
IPS=""
for IFACE in en0 en1 en2 en3; do
  ADDR=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
  if [ -n "$ADDR" ]; then IPS="$IPS $ADDR"; fi
done
MACNAME=$(scutil --get LocalHostName 2>/dev/null || true)
if [ -n "$IPS" ]; then
  echo "Dall'iPhone (stesso Wi-Fi del Mac, senza VPN) apri in Safari uno di questi indirizzi:"
  for ADDR in $IPS; do echo "    http://$ADDR:8000"; done
  if [ -n "$MACNAME" ]; then echo "    http://$MACNAME.local:8000"; fi
else
  echo "Per l'iPhone: stesso Wi-Fi del Mac e, in Safari, http://<indirizzo IP del Mac>:8000 (lo trovi in Impostazioni di Sistema → Wi-Fi → Dettagli)."
fi
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -qi "is enabled"; then
  echo "Il firewall del Mac è acceso: se l'iPhone non si collega, apri Impostazioni di Sistema → Rete → Firewall → Opzioni e metti \"node\" su \"Consenti connessioni in entrata\"."
fi
(
  for i in $(seq 1 50); do
    lsof -ti:8000 -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.2
  done
  for ADDR in $IPS; do
    CODE=$(curl -s -o /dev/null -m 4 -w '%{http_code}' "http://$ADDR:8000/" 2>/dev/null || true)
    if [ "$CODE" = "200" ]; then
      echo "[rete] Prova fatta dal Mac: risponde su http://$ADDR:8000. Se l'iPhone non lo apre il server è a posto: controlla il Wi-Fi (lo stesso del Mac, non la rete ospiti), la VPN sul telefono e il firewall."
    else
      echo "[rete] ATTENZIONE: il Mac non risponde su http://$ADDR:8000 (risposta: ${CODE:-nessuna})."
    fi
  done
) &

# 5. Avvia il server Node
echo "Avvio server locale su http://localhost:8000"
node server.js
