#!/usr/bin/env python3
import os
import subprocess
import sys

os.environ['DATABASE_URL'] = 'postgresql://finmanager:finmanager_secret_2024@localhost:5432/finmanager'

# Change to backend directory
os.chdir('/Users/rafi/financial-manager/backend')

# Activate venv
venv_python = '/Users/rafi/financial-manager/backend/venv/bin/python'

# Run uvicorn
cmd = [venv_python, '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000']
subprocess.run(cmd)
