# EE-Scripts

*Author: Hai Hoang*

## Pack V3

- Config file: see `texture_packer_v3.json`.
- Options:
  - `params`: `ARRAY` of texture packer options <https://www.codeandweb.com/texturepacker/documentation/texture-settings>
  - `auto_alias`: see v2. 
  - `data_extension`: see v2.
  - `force_identical_layout`: see v2.
  - `input_files`: `ARRAY` of `ARRAY` of `STRING`: relative input images directories.
  - `output_path`: `ARRAY` of `STRING`: relative output sheet/data files directory.
  - `rotation`: see v2.
  - `sheet_extension`: see v2.
  - `children`: `ARRAY` of options: specify the children options.

- pack.js: to run packer as client:
  - `-t` or `--type`: specify the packer type: `remote` to pack remotely or `local` to pack locally.
  - `-a` or `--address`: specify the remote packer, only required if type is remote.
  - `-i` or `--input`: specify the input config file path.
  - `-o` or `--output`: specify the output directory.
  
- pack_server.js: to run packer as server:
  - Default port: 3456

## Pack V2 (Deprecated)

- See sample `texture_packer.json`.
- Settings files (`.json`) in subdirectories are inherited from their parent directories.
- Options:
  - All texture packer options <https://www.codeandweb.com/texturepacker/documentation> except single options (e.g. `--enable-rotation`, `--premultiply-alpha`).
  - `flatten_path`: `BOOL` Whether or not to flatten the sprite frame output relative path, default is `True`.
  - `sheet_extension`: `STRING` Output sheet extension, default is `pvr.ccz`.
  - `data_extension`: `STRING` Output data extension, default is `plist`.
  - `input_directories`: `ARRAY` of `STRING` Relative input images directories, default is `['.']` (images in the current directory).
  - `combine_images`: `BOOL` Whether or not to combine images in input directories to a single output or pack separate images, default is `True`.
  - `rotation`: `BOOL` Use this instead of `--enable-rotation` and `--disable-rotation`, default is `False`.
  - `premultiply_alpha`: `BOOL` Use this instead of `--premultiply-alpha`, default is `False`.
  - `auto_alias`: `BOOL` Use this instead of `--disable-auto-alias`, default is `True`.
  - `force_identical_layout`: `BOOL` Use this instead of `--force-identical-layout`, default is `False`.
- Notes:
  - `--content-protection`: `STRING` Settings this key to empty to disable (inherited) encryption.