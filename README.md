# xxteaParse

Decrypts files encrypted with XXTEA. If a Gzip compressed file is detected, it will be automatically decompressed. Mainly used for Cocos projects.

## Installation

```bash
npm i -g xxtea-parse
```

## Help

```bash
Options:
      --version      Show version number                                           [boolean]
      --input        The folder you want to decrypt                            [string] [required]
      --xxtea_key    XXTEA key for decryption                           [string] [required]
      --parse_ext    Extensions to decrypt, e.g., "jsc,tsc,png"             [string] [required]
      --replace_ext  Extensions to rename to, e.g., "js,js,png"             [string] [required]
  -o, --output       Specify the output path for decrypted files.
                     If not specified, files are decrypted in the source directory.         [string]
  -d, --delete       Whether to delete the encrypted file. Only effective when --output is not specified.
                                                           [boolean] [default: true]
  -h, --help         Show help information                                         [boolean]
```

### Example

```bash
xxteaParse \
    --xxtea_key="eeb98a54-be7d-48" \
    --input="/cocosproj/assets/" \
    --parse_ext="jsc,tsc,png" \
    --replace_ext="js,js,png"
```