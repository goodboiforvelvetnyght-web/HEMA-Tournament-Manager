#!/usr/bin/env python3
"""Write a salted scrypt hash to a private temporary file, never stdout."""
import getpass
import hashlib
import os
import secrets
import sys

password = getpass.getpass('Shared admin password (at least 8 characters): ')
if len(password) < 8 or len(password) > 128:
    raise SystemExit('Use 8 to 128 characters.')
if getpass.getpass('Confirm password: ') != password:
    raise SystemExit('Passwords did not match.')
salt = secrets.token_hex(16)
hashed = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.fchmod(fd, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(salt + ':' + hashed)
