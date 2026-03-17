#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix encoding issues in test files for Windows compatibility
"""

import os
import sys
from pathlib import Path

def fix_file_encoding(file_path):
    """Fix Unicode characters in a Python file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace Unicode characters with ASCII equivalents
        replacements = {
            '✅': 'OK',
            '❌': 'ERROR', 
            '⚠️': 'WARN',
            '🧪': '',
            '🔍': '',
            '📋': '',
            '💡': '',
            '🎉': 'SUCCESS',
            '🔧': '',
            '📁': '',
            '📦': '',
            '🚀': '',
            '👋': '',
        }
        
        for unicode_char, replacement in replacements.items():
            content = content.replace(unicode_char, replacement)
        
        # Add encoding declaration if not present
        if '# -*- coding: utf-8 -*-' not in content:
            lines = content.split('\n')
            if lines[0].startswith('#!'):
                lines.insert(1, '# -*- coding: utf-8 -*-')
            else:
                lines.insert(0, '# -*- coding: utf-8 -*-')
            content = '\n'.join(lines)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Fixed: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def main():
    """Fix all test files"""
    print("Fixing encoding issues in test files...")
    
    test_files = [
        'tests/test_setup.py',
        'tests/test_health_endpoint.py',
        'tests/test_mongodb_simple.py',
        'tests/test_db_init.py'
    ]
    
    fixed_count = 0
    for file_path in test_files:
        if Path(file_path).exists():
            if fix_file_encoding(file_path):
                fixed_count += 1
    
    print(f"\nFixed {fixed_count} files")
    print("Encoding issues resolved!")

if __name__ == "__main__":
    main()