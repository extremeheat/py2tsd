# Written by @fpoli
import argparse
from astexport import __version__, __prog_name__
from astexport.parse import parse
from astexport.export import export_json

def export(input_path, output_path):
    """Read source from stdin, parse and export the AST as JSON"""
    with open(input_path) as f:
        source = f.read()
    tree = parse(source)
    json = export_json(tree, True)
    with open(output_path, 'w') as f:
        f.write(json)
    return json