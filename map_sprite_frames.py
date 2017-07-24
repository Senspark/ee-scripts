import os
import sys
import argparse
import plistlib

def dfs(data, plist_dict):
    changed = False
    props = data['properties']
    for prop in props:
        prop_type = prop['type']
        if prop_type != 'SpriteFrame':
            continue            
        old_plist_name = prop['value'][0]
        frame_name = prop['value'][1]

        ok = True
        if not old_plist_name in plist_dict:
            ok = False
        elif not frame_name in plist_dict[old_plist_name]:
            ok = False
        if ok:
            continue

        for plist_name in plist_dict:
            if frame_name in plist_dict[plist_name]:
                prop['value'][0] = plist_name
                changed = True
                break

    for item in data['children']:
        if dfs(item, plist_dict):
            changed = True

    return changed

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-c',
        '--ccb',
        nargs=1
    )
    parser.add_argument(
        '-p',
        '--plist',
        nargs=1
    )

    args = parser.parse_args()
    ccb_path = args.ccb[0]
    plist_path = args.plist[0]

    plist_dict = {}
    for file in os.listdir(plist_path):
        if not file.endswith('.plist'):
            continue
        path = os.path.join(plist_path, file)
        with open(path, 'r') as data_file:
            data = plistlib.readPlist(data_file)
            frames = data['frames']
            frame_names = set()
            for frame in frames:
                frame_names.add(frame)
            plist_dict[file] = frame_names

    for root, dirs, files in os.walk(ccb_path):
        for file in files:
            if not file.endswith('.ccb'):
                continue
            path = os.path.join(root, file)
            with open(path, 'r',) as data_file:
                data = plistlib.readPlist(data_file)
                if dfs(data['nodeGraph'], plist_dict):
                    plistlib.writePlist(data, path)