#!/usr/bin/env python3
import os
import re

pattern = r'router\.(get|post|put|delete|patch)\([^,]*,[^,]*authCombined,'
replacement = lambda match: match.group(0).replace('authCombined,', 'authCombined.checkAuth,')

files_to_process = [
    'routes/ai.js',
    'routes/ai-providers.js',
    'routes/api-keys.js',
    'routes/applications.js',
    'routes/cache.js',
    'routes/documentation.js',
    'routes/hl7-ai.js',
    'routes/users.js'
]

for file_path in files_to_process:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue

    with open(file_path, 'r') as file:
        content = file.read()

    updated_content = re.sub(pattern, replacement, content)

    if content != updated_content:
        with open(file_path, 'w') as file:
            file.write(updated_content)
        print(f"Updated {file_path}")
    else:
        print(f"No changes needed in {file_path}")