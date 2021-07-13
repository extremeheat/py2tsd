# Written by @fpoli
import argparse
import importlib
import os
# TODO: fix this is JsPyBridge
import sys
sys.path.append(os.getcwd())
from parse import parse
from export import export_json

def export(input_path, output_path):
    """Read source from stdin, parse and export the AST as JSON"""
    with open(input_path) as f:
        source = f.read()
    tree = parse(source)
    json = export_json(tree, True)
    with open(output_path, 'w') as f:
        f.write(json)
    return json

# Find where Python packages are stored and use that
def get_python_installdir(for_package):
    try:
        dirs = importlib.util.find_spec(for_package).submodule_search_locations
    except Exception:
        raise Exception(f'Bad package name {for_package}')
    d = dirs[0]
    return d