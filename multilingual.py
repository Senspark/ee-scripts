#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import urllib2
import json
import shutil
import plistlib
import argparse
import io

def read_sheet_data(doc_id, sheet_id):
    doc_url = "http://docs.google.com/spreadsheets/d/%s/gviz/tq?&tq&gid=%s&pref=2&pli=1" % (doc_id, sheet_id)
    request = urllib2.urlopen(doc_url)

    content = request.read()

    # Find the first opening parenthesis.
    first_parenthesis = content.find('{')

    # Find the last closing parenthesis.
    last_parenthesis = content.rfind('}')

    # Retrieve the JSON formatted string.
    result = content[first_parenthesis:last_parenthesis + 1]

    # Convert string to JSON.
    data = json.loads(result)
    return data

def get_number_of_rows(data):
    table = data["table"]
    rows = table["rows"]
    return len(rows)

def get_number_of_columns(data):
    table = data["table"];
    cols = table["cols"]
    return len(cols)

def get_cell(data, row, column):
    table = data["table"]

    row_data = table["rows"][row]
    if row_data == None:
        return None

    col_data = row_data["c"][column]
    if col_data == None:
        return None

    result = col_data["v"]
    return result

# Removes the specified directory if it exists.
def remove_dir_if_exists(dir):
    if os.path.exists(dir):
        shutil.rmtree(dir)

# Creates the specified directory if it does not exist.
def make_dir_if_not_exists(dir):
    if not os.path.exists(dir):
        os.makedirs(dir)

def copy_and_overwrite_with_closure(src_root_dir, dst_root_dir, closure):
    if src_root_dir == dst_root_dir:
        return

    for src_dir, dirs, files in os.walk(src_root_dir):
        dst_dir = src_dir.replace(src_root_dir, dst_root_dir, 1)

        make_dir_if_not_exists(dst_dir)

        for file in files:
            src_file = os.path.join(src_dir, file)
            dst_file = os.path.join(dst_dir, file)

            if os.path.exists(dst_file):
                os.remove(dst_file)

            closure(src_file, dst_file)

def copy_and_overwrite(src_root_dir, dst_root_dir):
    copy_and_overwrite_with_closure(src_root_dir, dst_root_dir, shutil.copy)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    # Spreadsheet id.
    parser.add_argument(
        '-d',
        '--id',
        nargs = 1,
        required = True
    )

    # Sheet id.
    parser.add_argument(
        '-s',
        '--sid',
        nargs = 1,
        required = True
    )

    # Project directory.
    parser.add_argument(
        '-o',
        '--out',
        nargs = 1,
        required = True
    )

    #format out json/plist
    parser.add_argument(
        '-f',
        '--extension',
        nargs = 1,
        required = True
    )

    args = parser.parse_args()

    doc_id = args.id[0]
    sheet_id = args.sid[0]
    output_format = args.out[0];
    extension = args.extension[0];

    data = read_sheet_data(doc_id, sheet_id)
    rows = get_number_of_rows(data)
    cols = get_number_of_columns(data)

    # print "rows = %d col = %d" % (rows, cols)

    for col in range(1, cols):
        output_data = dict()
        raw_lang = get_cell(data, 2, col)
        sub_dir = raw_lang.encode('utf-8')
        for row in range(3, rows):
            raw_key = get_cell(data, row, 0)
            raw_value = get_cell(data, row, col)
            output_data[raw_key] = raw_value

        output_file = output_format % sub_dir
        output_dir = os.path.dirname(output_file)
        os.makedirs(output_dir)
        if extension == 'plist':
            plistlib.writePlist(output_data, output_file)
        else:
            with io.open(output_file, 'w', encoding='utf8') as outfile:
                unicodeData = json.dumps(output_data, sort_keys=True, ensure_ascii=False, indent=4, separators=(',',': '))
                outfile.write(unicode(unicodeData))