#!/usr/bin/env python3
import os
import zipfile

IGNORED_DIRS = {'node_modules', 'dist', '.git', '.cache', '__pycache__', '.aistudio'}
IGNORED_FILES = {'.DS_Store', 'celebria-ai-source.zip', '.env'}

def create_zip(output_filename='celebria-ai-source.zip'):
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    zip_path = os.path.join(root_dir, output_filename)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Prune ignored directories in-place
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            
            for file in files:
                if file in IGNORED_FILES or file.endswith('.pyc') or file.startswith('.env.'):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                zipf.write(full_path, rel_path)
                
    file_size_kb = os.path.getsize(zip_path) / 1024
    print(f"Created {output_filename} successfully ({file_size_kb:.1f} KB)")
    return zip_path

if __name__ == '__main__':
    create_zip()
