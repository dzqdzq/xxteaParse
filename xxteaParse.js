import fs from 'fs';
import zlib from 'zlib';
import { Duplex } from 'stream';
import path from 'path';

let xxtea = (function(){
  var delta = 0x9E3779B9;

  function toUint8Array(v, includeLength) {
      var length = v.length;
      var n = length << 2;
      if (includeLength) {
          var m = v[length - 1];
          n -= 4;
          if ((m < n - 3) || (m > n)) {
              return null;
          }
          n = m;
      }
      var bytes = new Uint8Array(n);
      for (var i = 0; i < n; ++i) {
          bytes[i] = v[i >> 2] >> ((i & 3) << 3);
      }
      return bytes;
  }

  function toUint32Array(bytes, includeLength) {
      var length = bytes.length;
      var n = length >> 2;
      if ((length & 3) !== 0) {
          ++n;
      }
      var v;
      if (includeLength) {
          v = new Uint32Array(n + 1);
          v[n] = length;
      }
      else {
          v = new Uint32Array(n);
      }
      for (var i = 0; i < length; ++i) {
          v[i >> 2] |= bytes[i] << ((i & 3) << 3);
      }
      return v;
  }

  function mx(sum, y, z, p, e, k) {
      return ((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^ ((sum ^ y) + (k[p & 3 ^ e] ^ z));
  }

  function fixk(k) {
      if (k.length < 16) {
          var key = new Uint8Array(16);
          key.set(k);
          k = key;
      }
      return k;
  }

  function encryptUint32Array(v, k) {
      var length = v.length;
      var n = length - 1;
      var y, z, sum, e, p, q;
      z = v[n];
      sum = 0;
      for (q = Math.floor(6 + 52 / length) | 0; q > 0; --q) {
          sum += delta;
          e = sum >>> 2 & 3;
          for (p = 0; p < n; ++p) {
              y = v[p + 1];
              z = v[p] += mx(sum, y, z, p, e, k);
          }
          y = v[0];
          z = v[n] += mx(sum, y, z, p, e, k);
      }
      return v;
  }

  function decryptUint32Array(v, k) {
      var length = v.length;
      var n = length - 1;
      var y, z, sum, e, p, q;
      y = v[0];
      q = Math.floor(6 + 52 / length);
      for (sum = q * delta; sum !== 0; sum -= delta) {
          e = sum >>> 2 & 3;
          for (p = n; p > 0; --p) {
              z = v[p - 1];
              y = v[p] -= mx(sum, y, z, p, e, k);
          }
          z = v[n];
          y = v[0] -= mx(sum, y, z, p, e, k);
      }
      return v;
  }

  function toBytes(str) {
      var n = str.length;
      // A single code unit uses at most 3 bytes.
      // Two code units at most 4.
      var bytes = new Uint8Array(n * 3);
      var length = 0;
      for (var i = 0; i < n; i++) {
          var codeUnit = str.charCodeAt(i);
          if (codeUnit < 0x80) {
              bytes[length++] = codeUnit;
          }
          else if (codeUnit < 0x800) {
              bytes[length++] = 0xC0 | (codeUnit >> 6);
              bytes[length++] = 0x80 | (codeUnit & 0x3F);
          }
          else if (codeUnit < 0xD800 || codeUnit > 0xDFFF) {
              bytes[length++] = 0xE0 | (codeUnit >> 12);
              bytes[length++] = 0x80 | ((codeUnit >> 6) & 0x3F);
              bytes[length++] = 0x80 | (codeUnit & 0x3F);
          }
          else {
              if (i + 1 < n) {
                  var nextCodeUnit = str.charCodeAt(i + 1);
                  if (codeUnit < 0xDC00 && 0xDC00 <= nextCodeUnit && nextCodeUnit <= 0xDFFF) {
                      var rune = (((codeUnit & 0x03FF) << 10) | (nextCodeUnit & 0x03FF)) + 0x010000;
                      bytes[length++] = 0xF0 | (rune >> 18);
                      bytes[length++] = 0x80 | ((rune >> 12) & 0x3F);
                      bytes[length++] = 0x80 | ((rune >> 6) & 0x3F);
                      bytes[length++] = 0x80 | (rune & 0x3F);
                      i++;
                      continue;
                  }
              }
              throw new Error('Malformed string');
          }
      }
      return bytes.subarray(0, length);
  }

  function toShortString(bytes, n) {
      var charCodes = new Uint16Array(n);
      var i = 0, off = 0;
      for (var len = bytes.length; i < n && off < len; i++) {
          var unit = bytes[off++];
          switch (unit >> 4) {
              case 0:
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
              case 7:
                  charCodes[i] = unit;
                  break;
              case 12:
              case 13:
                  if (off < len) {
                      charCodes[i] = ((unit & 0x1F) << 6) |
                          (bytes[off++] & 0x3F);
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              case 14:
                  if (off + 1 < len) {
                      charCodes[i] = ((unit & 0x0F) << 12) |
                          ((bytes[off++] & 0x3F) << 6) |
                          (bytes[off++] & 0x3F);
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              case 15:
                  if (off + 2 < len) {
                      var rune = (((unit & 0x07) << 18) |
                          ((bytes[off++] & 0x3F) << 12) |
                          ((bytes[off++] & 0x3F) << 6) |
                          (bytes[off++] & 0x3F)) - 0x10000;
                      if (0 <= rune && rune <= 0xFFFFF) {
                          charCodes[i++] = (((rune >> 10) & 0x03FF) | 0xD800);
                          charCodes[i] = ((rune & 0x03FF) | 0xDC00);
                      }
                      else {
                          throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16));
                      }
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              default:
                  throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16));
          }
      }
      if (i < n) {
          charCodes = charCodes.subarray(0, i);
      }
      return String.fromCharCode.apply(String, charCodes);
  }

  function toLongString(bytes, n) {
      var buf = [];
      var charCodes = new Uint16Array(0x18000);
      var i = 0, off = 0;
      for (var len = bytes.length; i < n && off < len; i++) {
          var unit = bytes[off++];
          switch (unit >> 4) {
              case 0:
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
              case 7:
                  charCodes[i] = unit;
                  break;
              case 12:
              case 13:
                  if (off < len) {
                      charCodes[i] = ((unit & 0x1F) << 6) |
                          (bytes[off++] & 0x3F);
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              case 14:
                  if (off + 1 < len) {
                      charCodes[i] = ((unit & 0x0F) << 12) |
                          ((bytes[off++] & 0x3F) << 6) |
                          (bytes[off++] & 0x3F);
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              case 15:
                  if (off + 2 < len) {
                      var rune = (((unit & 0x07) << 18) |
                          ((bytes[off++] & 0x3F) << 12) |
                          ((bytes[off++] & 0x3F) << 6) |
                          (bytes[off++] & 0x3F)) - 0x10000;
                      if (0 <= rune && rune <= 0xFFFFF) {
                          charCodes[i++] = (((rune >> 10) & 0x03FF) | 0xD800);
                          charCodes[i] = ((rune & 0x03FF) | 0xDC00);
                      }
                      else {
                          throw new Error('Character outside valid Unicode range: 0x' + rune.toString(16));
                      }
                  }
                  else {
                      throw new Error('Unfinished UTF-8 octet sequence');
                  }
                  break;
              default:
                  throw new Error('Bad UTF-8 encoding 0x' + unit.toString(16));
          }
          if (i >= 0x7FFF - 1) {
              var size = i + 1;
              buf.push(String.fromCharCode.apply(String, charCodes.subarray(0, size)));
              n -= size;
              i = -1;
          }
      }
      if (i > 0) {
          buf.push(String.fromCharCode.apply(String, charCodes.subarray(0, i)));
      }
      return buf.join('');
  }

  function toString(bytes) {
      var n = bytes.length;
      if (n === 0) return '';
      return ((n < 0x7FFF) ?
          toShortString(bytes, n) :
          toLongString(bytes, n));
  }

  function encrypt(data, key) {
      if (typeof data === 'string') data = toBytes(data);
      if (typeof key === 'string') key = toBytes(key);
      if (data === undefined || data === null || data.length === 0) {
          return data;
      }
      return toUint8Array(encryptUint32Array(toUint32Array(data, true), toUint32Array(fixk(key), false)), false);
  }

  function encryptToString(data, key) {
      return new Buffer(encrypt(data, key)).toString('base64');
  }

  function decrypt(data, key) {
      if (typeof data === 'string') data = new Buffer(data, 'base64');
      if (typeof key === 'string') key = toBytes(key);
      if (data === undefined || data === null || data.length === 0) {
          return data;
      }
      return toUint8Array(decryptUint32Array(toUint32Array(data, false), toUint32Array(fixk(key), false)), true);
  }

  function decryptToString(data, key) {
      return toString(decrypt(data, key));
  }

  return  {
      toBytes,
      toString,
      encrypt,
      encryptToString,
      decrypt,
      decryptToString
  }
})();

let isGzip = function(a, b){ return a ===0x1f && b === 0x8b};

function bufferToStream(buffer) {  
  let stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function gunzip(source, filePath) {
  let unzip = zlib.createGunzip();
  let rs = bufferToStream(source);
  let ws = fs.createWriteStream(filePath);
  rs.pipe(unzip).pipe(ws);
}

/**
 * 
 * @param {string} srcPath 输入文件路径
 * @param {string} dstPath 输出文件路径
 * @param {string} xxtea_key 解密的xxtea密钥
 * @returns 
 */
function parse(srcPath, dstPath, xxtea_key){
    console.log(`decrypt ${srcPath}`);
    const content = xxtea.decrypt(fs.readFileSync(srcPath), xxtea_key);
    if (!content || content.length < 2) {
        console.warn(`[WARN] file content invalid, skip parse ${srcPath}`);
        return;
    }

    const outputDir = path.dirname(dstPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    if(isGzip(content[0], content[1])){
        gunzip(content, dstPath);
    } else {
        fs.writeFileSync(dstPath, content);
    }
    return dstPath;
}

/**
 * 获取文件列表
 * @param {string} dir 
 * @param {string[]} filters [".js", ".ts"]
 */
async function filterFiles(dir, filters){
    const filterMap = filters.reduce((pre, cur) => {
        pre[cur] = true;
        return pre;
    }, {});

    async function getAllJsFiles(dir) {
        const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
            dirents.map(async (dirent) => {
                const res = path.resolve(dir, dirent.name);
                if (dirent.isDirectory()) {
                    return await getAllJsFiles(res);
                }

                const ext = path.extname(res);
                if (dirent.isFile() && filterMap[ext]) {
                    return res;
                }
                return null;
            })
        );
        return files.flat().filter(Boolean);
    }
    return await getAllJsFiles(dir);
}

export {
    parse,
    filterFiles
};
