#!/usr/bin/env python3
"""
Generate a fresh JWT token for the traffic simulator.
Usage: python get-simulator-token.py [email]
"""
import jwt
import time
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load server .env to get JWT_SECRET
load_dotenv(Path(__file__).parent / 'server' / '.env')

JWT_SECRET = os.getenv('JWT_SECRET', 'change_me')
email = sys.argv[1] if len(sys.argv) > 1 else 'simulator@traffic-intel.local'

# Create a token valid for 30 days
payload = {
    'email': email,
    'sub': '999',  # Reserved simulator user ID
    'iat': int(time.time()),
    'exp': int(time.time()) + (30 * 24 * 60 * 60)  # 30 days
}

token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

print('Generated Simulator JWT Token:')
print('=' * 80)
print(token)
print('=' * 80)
print(f'Valid for: 30 days')
print(f'Email: {email}')
print('\nUpdate traffic-simulator/.env with:')
print(f'SIM_AUTH_TOKEN={token}')
