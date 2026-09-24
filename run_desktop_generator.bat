@echo off
title ThingSpeak Water Quality Telemetry Generator
cd /d "%~dp0"
echo Starting ThingSpeak Water Quality Desktop App...
start "" pythonw.exe thingspeak_generator.py
if errorlevel 1 (
    start "" python.exe thingspeak_generator.py
)
