import os
import re

def walk(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                yield os.path.join(root, file)

def process_files():
    # Regex to find className attributes: className="...", className={'...'} or className={`...`}
    # This is a bit tricky with nested templates, so we'll just run regex on the entire document for \bclass\b
    # Actually simpler: just find and replace the specific utility classes using word boundaries,
    # but we skip lines that contain specific gradient or colored background classes.
    
    skip_classes = ['bg-primary', 'bg-success', 'bg-danger', 'bg-amber', 'bg-emerald', 
                    'bg-gradient', 'badge', 'btn-primary', 'bg-[#', 'from-', 'to-']
                    
    for file_path in walk('src'):
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        modified = False
        new_lines = []
        for line in lines:
            if any(skip in line for skip in skip_classes):
                new_lines.append(line)
                continue
                
            original_line = line
            # word boundary replacement
            line = re.sub(r'\btext-white\b', 'dark:text-white text-gray-900', line)
            line = re.sub(r'\bbg-white/5\b', 'dark:bg-white/5 bg-black/5', line)
            line = re.sub(r'\bbg-white/10\b', 'dark:bg-white/10 bg-black/10', line)
            line = re.sub(r'\bbg-white/20\b', 'dark:bg-white/20 bg-black/20', line)
            
            line = re.sub(r'\bborder-white/5\b', 'dark:border-white/5 border-black/5', line)
            line = re.sub(r'\bborder-white/10\b', 'dark:border-white/10 border-black/10', line)
            line = re.sub(r'\bborder-white/20\b', 'dark:border-white/20 border-black/20', line)
            
            if original_line != line:
                modified = True
            new_lines.append(line)
            
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"Updated {file_path}")

if __name__ == '__main__':
    process_files()
