# EE-Scripts

*Author: Hai Hoang*

## Pack

- See sample `texture_packer.json`.
- Options:
  - All texture packer options <https://www.codeandweb.com/texturepacker/documentation> except single options (e.g. `--enable-rotation`, `--premultiply-alpha`).
  - `flatten_path`: `BOOL` Whether or not to flatten the sprite frame output relative path, default is `True`.
  - `sheet_extension`: `STRING` Output sheet extension, default is `pvr.ccz`.
  - `data_extension`: `STRING` Output data extension, default is `plist`.
  - `input_directories`: `ARRAY` of `STRING` Relative input images directories, default is `['.']` (images in the current directory).
  - `combine_images`: `BOOL` Whether or not to combine images in input directories to a single output or pack separate images, default is `True`.
  - `rotation`: `BOOL` Use this instead of `--enable-rotation` and `--disable-rotation`, default is `False`.
  - `premultiply_alpha`: `BOOL` Use this instead of `--premultiply-alpha`, default is `False`.