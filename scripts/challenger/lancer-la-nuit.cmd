@echo off
REM ============================================================
REM  Challenger de nuit du moteur ProFoot.
REM  Lance chaque nuit par le Planificateur de taches de Windows.
REM  Il mesure, il compare, il PROPOSE : il ne met jamais rien
REM  en ligne tout seul.
REM
REM  Node est appele DIRECTEMENT, sans npx. Le 11 septembre 2026,
REM  la premiere execution par le planificateur s'est arretee sur
REM  un ^C (code 0xC000013A) : un fichier de commandes qui en
REM  appelle un autre peut s'interrompre sur une question
REM  "Terminer le programme de commandes (O/N) ?" a laquelle
REM  personne ne repond a deux heures du matin. L'entree est aussi
REM  branchee sur NUL : rien ne peut jamais attendre le clavier.
REM ============================================================
cd /d "%~dp0..\.."
if not exist ".challenger" mkdir ".challenger"
set "NODE=node"
where node >nul 2>&1 || set "NODE=%ProgramFiles%\nodejs\node.exe"
echo ===== debut %date% %time% ===== >> ".challenger\journal.log"
"%NODE%" "node_modules\tsx\dist\cli.mjs" "scripts\challenger\nuit.mts" < NUL >> ".challenger\journal.log" 2>&1
echo ===== fin %date% %time% (code %errorlevel%) ===== >> ".challenger\journal.log"
