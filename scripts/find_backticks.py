from pathlib import Path
p=Path('c:/Users/User/Desktop/7moSemester/Neural_ Networks/final/docs/report/ecosort_ieee.tex')
for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
    if '`' in line:
        print(i, line)
