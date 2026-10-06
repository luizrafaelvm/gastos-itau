from pathlib import Path
root = Path(__file__).resolve().parent.parent
core = (root / 'finance-core.js').read_text()
template = (root / 'widget/scriptable-template.js').read_text()
(root / 'widget/Saldo-Livre.js').write_text(template.replace('/* FINANCE_CORE */', core))
