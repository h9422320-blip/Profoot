@echo off
REM ============================================================
REM  Challenger de nuit du moteur ProFoot.
REM  Lance chaque nuit par le Planificateur de taches de Windows.
REM  Il mesure, il compare, il PROPOSE : il ne met jamais rien
REM  en ligne tout seul.
REM ============================================================
cd /d "%~dp0..\.."
if not exist ".challenger" mkdir ".challenger"
echo ===== debut %date% %time% ===== >> ".challenger\journal.log"
call npx tsx scripts\challenger\nuit.mts >> ".challenger\journal.log" 2>&1
echo ===== fin %date% %time% (code %errorlevel%) ===== >> ".challenger\journal.log"
