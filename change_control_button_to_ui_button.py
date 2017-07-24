import os
import sys
import argparse
import plistlib

def find_index(props, key):
    i = 0
    for prop in props:
        if prop['name'] == key:
            return i
        i += 1
    return -1

def change_prop(props, old, new):
    index = find_index(props, old)
    props[index]['name'] = new

def remove_prop(props, key):
    index = find_index(props, key)
    if index != -1:
        del props[index]

def transfer_prop(props, old, new):    
    remove_prop(props, new)
    change_prop(props, old, new)

def check_sprite_frame_enabled(props, key):
    index = find_index(props, key)
    assert(index != -1)
    if props[index]['value'][0] != 'ccbResources/ccbDefaultImages.plist':
        prop = {}
        prop['name'] = key + 'Enabled'
        prop['type'] = 'Checked'
        prop['value'] = True
        props.append(prop)

def dfs(data):
    if data['baseClass'] == 'CCControlButton':
        props = data['properties']

        transfer_prop(props, 'title|1', 'titleText')
        transfer_prop(props, 'titleTTF|1', 'titleFontName')
        transfer_prop(props, 'titleTTFSize|1', 'titleFontSize')
        transfer_prop(props, 'labelAnchorPoint', 'titleAnchorPoint')
        transfer_prop(props, 'preferedSize', 'contentSize')
        transfer_prop(props, 'titleColor|1', 'titleColor')
        remove_prop(props, 'titleColor|2')
        remove_prop(props, 'titleColor|3')
        transfer_prop(props, 'backgroundSpriteFrame|1', 'normalSpriteFrame')
        transfer_prop(props, 'backgroundSpriteFrame|2', 'pressedSpriteFrame')
        transfer_prop(props, 'backgroundSpriteFrame|3', 'disabledSpriteFrame')

        # print props

        check_sprite_frame_enabled(props, 'normalSpriteFrame')
        check_sprite_frame_enabled(props, 'pressedSpriteFrame')
        check_sprite_frame_enabled(props, 'disabledSpriteFrame')

        props.append({'ignoreContentAdaptWithSize', False})
        props.append({'scale9Enabled', True})

    for item in data['children']:
        dfs(item)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('path')

    args = parser.parse_args()
    path = args.path

    with open(path, 'r') as data_file:
        data = plistlib.readPlist(data_file)
        dfs(data['nodeGraph'])

        plistlib.writePlist(data, path + '.converted')
