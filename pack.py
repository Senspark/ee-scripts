#!/usr/bin/python

import os
import subprocess
import argparse
import json
import copy
# import yaml

# This key is special: it is can not be inherited.
output_path_key = 'output_path'

def get_current_file_path():
    return os.path.dirname(os.path.realpath(__file__))

# Gets the settings json file path for the specified directory.
# @param dir The directory.
def get_settings_path(dir):
    return os.path.join(dir, 'texture_packer.json')

# Merges the current settings with the specified json data.
# @param settings The current settings.
# @param json_data The json data for merging.
def merge_settings(settings, json_data):
    for key in json_data:
        if key == output_path_key:
            continue
        settings[key] = json_data[key]

def pack_with_output_path_array(relative_dir, current_dir, output_dir, output_path_array, settings):
    output_path = os.path.join(output_dir, *output_path_array)
    return pack(relative_dir, current_dir, output_path, settings)

def parse_command(settings):
    command = []

    # Process each key.
    for key in settings:
        if not key.startswith('--'):
            # Not texture packer command line settings.
            continue

        # Multiple variants.
        if key == '--variant':
            for variant in settings[key]:
                command.extend(['--variant', variant])
            continue

        # Normal settings.
        single_options = [
            '--multipack',
            '--enable-rotation',
            '--disable-rotation',
            '--disable-auto-alias',
            '--flip-pvr',
            '--premultiply-alpha',
            '--force-squared',
            '--force-word-aligned',
            '--force-identical-layout',
            '--reduce-border-artifacts',
            '--disable-clean-transparency',
            '--shape-debug'
        ]
        if key in single_options:
            # Settings that do not have value (only key).
            command.append(key)
        else:
            # Must convert to string.
            command.extend([key, str(settings[key])])

    return command

def pack(relative_dir, current_dir, output_path, settings):
    command = parse_command(settings)

    flatten_path = settings.get('flatten_path', True)
    sheet_extension = settings.get('sheet_extension', 'pvr.ccz')
    data_extension = settings.get('data_extension', 'plist')
    input_directories = settings.get('input_directories', ['.'])
    combine_images = settings.get('combine_images', True)

    if not flatten_path:
        command.extend(['--replace', '^=%s/' % relative_dir])

    # Input.
    input_paths = []
    for input_dir in input_directories:
        full_path = os.path.join(current_dir, input_dir)
        for item in os.listdir(full_path):
            path = os.path.join(full_path, item)
            if path.endswith('.png') or path.endswith('.jpg'):
                # PNG or JPG.
                input_paths.append(path)

    commands = []
    if combine_images:
        command.extend(['--sheet', '%s.%s' % (output_path, sheet_extension)])
        command.extend(['--data', '%s.%s' % (output_path, data_extension)])
        command.extend(input_paths)
        commands.append(command)
    else:
        for path in input_paths:
            # http://stackoverflow.com/questions/678236/how-to-get-the-filename-without-the-extension-from-a-path-in-python
            filename = os.path.splitext(os.path.basename(path))[0]

            clone = list(command)
            clone.append(path)
            clone.extend(['--sheet', '%s.%s' % (os.path.join(output_path, filename), sheet_extension)])
            clone.extend(['--data', os.path.join(get_current_file_path(), '.texture_packer_dummy_{v}.plist')])
            commands.append(clone)

    return commands

# Finds all packing commands.
# @param input_dir The input directory.
# @param output_dir The output directory.
def process(input_dir, output_dir):
    # Currently merged settings.
    settings = {}

    # Used for flatten_paths=False
    relative_dir = ''

    # Depth-first search all sub-directories.
    return dfs(relative_dir, input_dir, output_dir, settings)

# DFS the current directory.
# @param relative_dir The relative directory to the input directory.
# @param current_dir The currently processing directory.
# @param output_dit The output directory.
# @param current_settings The currently merged settings.
def dfs(relative_dir, current_dir, output_dir, current_settings):
    # Result.
    commands = []

    # Gets the settings path for the current directory.
    settings_path = get_settings_path(current_dir)

    if os.path.exists(settings_path):
        with open(settings_path) as data_file:
            # http://stackoverflow.com/questions/956867/how-to-get-string-objects-instead-of-unicode-ones-from-json-in-python
            # data = yaml.safe_load(data_file)
            data = json.load(data_file)
            merge_settings(current_settings, data)

            if output_path_key in data:
                # Process command if output_path_key exists.
                output_path_array = data[output_path_key]
                commands.extend(pack_with_output_path_array(relative_dir, current_dir, output_dir, output_path_array, current_settings))

    # Recurse sub-directories.
    for item in os.listdir(current_dir):
        path = os.path.join(current_dir, item)
        if not os.path.isdir(path):
            continue
        child_settings = copy.deepcopy(current_settings)
        child_relative_dir = os.path.join(relative_dir, item)
        child_commands = dfs(child_relative_dir, path, output_dir, child_settings)
        commands.extend(child_commands)

    return commands

def process_commands(input_dir, output_dir):
    current_dir = get_current_file_path()

    commands = process(input_dir, output_dir)

    # Parallelly packing.
    print 'There are ' + str(len(commands)) + ' packing commands.'
    subprocesses = []
    for command in commands:
        args = ['texturepacker']
        args.extend(command)
        subprocesses.append(subprocess.Popen(args))

    # Wait for subprocesses.
    for s in subprocesses:
        s.wait()

def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-i',
        '--input',
        nargs = 1,
    )
    parser.add_argument(
        '-o',
        '--output',
        nargs = 1,
    )
    args = parser.parse_args()
    input_dir = args.input[0]
    output_dir = args.output[0]
    return input_dir, output_dir

if __name__ == '__main__':
    input_dir, output_dir = parse_arguments()
    process_commands(input_dir, output_dir)
