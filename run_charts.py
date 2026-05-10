#!/usr/bin/env python3
"""
Wrapper to run chart generation with error handling
"""
import sys
import subprocess

result = subprocess.run([
    sys.executable, 
    'graph generation/generate_charts_safe.py',
    *sys.argv[1:]
], cwd='/'.join(__file__.split('/')[:-1]) or '.')

sys.exit(result.returncode)
