# xxteaParse
[English](./README.md) | [中文](./README.zh-CN.md)
对xxtea加密文件进行解密, 如果检查到gzip压缩文件, 则自动解压。 主要用于cocos项目

## 安装

```bash
npm i -g xxtea-parse
```

## 查看帮助

```bash
选项：
      --version      显示版本号                                           [布尔]
      --input        你要加密的文件夹                            [字符串] [必需]
      --xxtea_key    XXTEA密钥用于解密                           [字符串] [必需]
      --parse_ext    要解密的扩展名, 如"jsc,tsc,png"             [字符串] [必需]
      --replace_ext  要重命名的扩展名, 如"js,js,png"             [字符串] [必需]
  -o, --output       指定解密文件的输出路径,
                     如果不指定，则默认解密文件在源文件同目录下         [字符串]
  -d, --delete       是否删除加密文件,true表示删除。只有--output没有指定时生效
                                                           [布尔] [默认值: true]
  -h, --help         显示帮助信息                                         [布尔]
```

### 示例

```bash
xxteaParse \     
    --xxtea_key="eeb98a54-be7d-48" \
    --input="/cocosproj/assets/" \
    --parse_ext="jsc,tsc,png" \
    --replace_ext="js,js,png"
```
