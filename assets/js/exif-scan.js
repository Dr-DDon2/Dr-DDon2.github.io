/* EXIF / metadata reader for the zero-upload stripper — pure byte parsing.
   Works in the browser (window.ExifScan) and in Node / quickjs (module.exports).
   Nothing here decodes pixels: the page re-encodes through a canvas, and this
   module only tells the user what is about to be thrown away. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ExifScan = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function u16(b, o, le) {
    if (o + 2 > b.length) return 0;
    return le ? (b[o] | (b[o + 1] << 8)) : ((b[o] << 8) | b[o + 1]);
  }

  function u32(b, o, le) {
    if (o + 4 > b.length) return 0;
    if (le) {
      return ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0);
    }
    return (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  }

  function ascii(b, o, len) {
    var s = '';
    for (var i = 0; i < len && o + i < b.length; i++) {
      var c = b[o + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.replace(/[\s\u0000]+$/, '');
  }

  function typeOf(b) {
    if (!b || b.length < 4) return null;
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
    if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') return 'heic';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
    return null;
  }

  /* A TIFF stream: either the payload of a JPEG APP1 "Exif" segment or a bare
     PNG eXIf / WebP EXIF chunk. */
  function parseTiff(b, base) {
    if (!b || base < 0 || base + 8 > b.length) return null;
    var le;
    if (b[base] === 0x49 && b[base + 1] === 0x49) le = true;
    else if (b[base] === 0x4D && b[base + 1] === 0x4D) le = false;
    else return null;
    if (u16(b, base + 2, le) !== 42) return null;

    var out = {
      make: '', model: '', software: '', dateTime: '', dateTimeOriginal: '',
      orientation: 0, hasGps: false, gpsLatitude: false, hasExifIfd: false
    };

    function readIfd(off, isGps, depth) {
      if (depth > 2 || off < base || off + 2 > b.length) return;
      var count = u16(b, off, le);
      if (count > 300) return;
      for (var n = 0; n < count; n++) {
        var e = off + 2 + n * 12;
        if (e + 12 > b.length) return;
        var tag = u16(b, e, le);
        var type = u16(b, e + 2, le);
        var cnt = u32(b, e + 4, le);
        var unit = type === 3 ? 2 : type === 4 ? 4 : type === 5 ? 8 : type === 9 ? 4 : 1;
        var size = cnt * unit;
        var voff = size > 4 ? base + u32(b, e + 8, le) : e + 8;

        if (isGps) {
          if (tag === 0x0002) out.gpsLatitude = true;
          continue;
        }
        if (tag === 0x010F) out.make = ascii(b, voff, Math.min(cnt, 80));
        else if (tag === 0x0110) out.model = ascii(b, voff, Math.min(cnt, 80));
        else if (tag === 0x0112) out.orientation = u16(b, e + 8, le);
        else if (tag === 0x0131) out.software = ascii(b, voff, Math.min(cnt, 80));
        else if (tag === 0x0132) out.dateTime = ascii(b, voff, Math.min(cnt, 32));
        else if (tag === 0x9003) out.dateTimeOriginal = ascii(b, voff, Math.min(cnt, 32));
        else if (tag === 0x8769) { out.hasExifIfd = true; readIfd(base + u32(b, e + 8, le), false, depth + 1); }
        else if (tag === 0x8825) { out.hasGps = true; readIfd(base + u32(b, e + 8, le), true, depth + 1); }
      }
    }

    readIfd(base + u32(b, base + 4, le), false, 0);
    return out;
  }

  function parseJpeg(b) {
    var out = {
      type: 'jpeg', hasExif: false, hasGps: false, hasXmp: false, hasIcc: false,
      hasComment: false, make: '', model: '', software: '', dateTime: '',
      dateTimeOriginal: '', orientation: 0, exifBytes: 0, appSegments: 0
    };
    var o = 2;
    var guard = 0;
    while (o + 4 <= b.length && guard++ < 4000) {
      if (b[o] !== 0xFF) { o++; continue; }
      var marker = b[o + 1];
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0xFF) { o += 2; continue; }
      if (marker === 0xDA || marker === 0xD9) break;
      var len = u16(b, o + 2, false);
      if (len < 2) break;
      var segStart = o + 4;
      var segEnd = o + 2 + len;
      if (segEnd > b.length) break;
      if (marker >= 0xE0 && marker <= 0xEF) out.appSegments++;
      if (marker === 0xE1) {
        if (ascii(b, segStart, 4) === 'Exif') {
          out.hasExif = true;
          out.exifBytes = len - 2;
          var t = parseTiff(b, segStart + 6);
          if (t) {
            out.make = t.make; out.model = t.model; out.software = t.software;
            out.dateTime = t.dateTime; out.dateTimeOriginal = t.dateTimeOriginal;
            out.orientation = t.orientation; out.hasGps = t.hasGps;
          }
        } else if (ascii(b, segStart, 28).indexOf('http://ns.adobe.com/xap') === 0) {
          out.hasXmp = true;
        }
      } else if (marker === 0xE2 && ascii(b, segStart, 11) === 'ICC_PROFILE') {
        out.hasIcc = true;
      } else if (marker === 0xFE) {
        out.hasComment = true;
      }
      o = segEnd;
    }
    return out;
  }

  function parsePng(b) {
    var out = {
      type: 'png', hasExif: false, hasGps: false, hasXmp: false, hasIcc: false,
      hasText: false, textChunks: 0, hasTime: false, make: '', model: '', dateTime: ''
    };
    var o = 8;
    var guard = 0;
    while (o + 12 <= b.length && guard++ < 4000) {
      var len = u32(b, o, false);
      var id = ascii(b, o + 4, 4);
      if (id === 'IEND') break;
      if (len > b.length) break;
      if (id === 'eXIf') {
        out.hasExif = true;
        var t = parseTiff(b, o + 8);
        if (t) { out.hasGps = t.hasGps; out.make = t.make; out.model = t.model; out.dateTime = t.dateTime; }
      } else if (id === 'iTXt' || id === 'tEXt' || id === 'zTXt') {
        out.hasText = true;
        out.textChunks++;
        if (id === 'iTXt' && ascii(b, o + 8, 40).toLowerCase().indexOf('xmp') >= 0) out.hasXmp = true;
      } else if (id === 'ICCP') {
        out.hasIcc = true;
      } else if (id === 'tIME') {
        out.hasTime = true;
      }
      o += 12 + len;
    }
    return out;
  }

  function parseWebp(b) {
    var out = {
      type: 'webp', hasExif: false, hasGps: false, hasXmp: false, hasIcc: false,
      make: '', model: '', dateTime: ''
    };
    var o = 12;
    var guard = 0;
    while (o + 8 <= b.length && guard++ < 4000) {
      var id = ascii(b, o, 4);
      var len = u32(b, o + 4, true);
      if (len > b.length) break;
      if (id === 'EXIF') {
        out.hasExif = true;
        /* Some writers include the "Exif\0\0" prefix inside the chunk. */
        var start = ascii(b, o + 8, 4) === 'Exif' ? o + 14 : o + 8;
        var t = parseTiff(b, start);
        if (t) { out.hasGps = t.hasGps; out.make = t.make; out.model = t.model; out.dateTime = t.dateTime; }
      } else if (id === 'XMP ') {
        out.hasXmp = true;
      } else if (id === 'ICCP') {
        out.hasIcc = true;
      }
      o += 8 + len + (len % 2);
    }
    return out;
  }

  /* What a reader would learn from the file, in the order people care about it. */
  function summarize(bytes) {
    var b = bytes;
    var size = b && b.length ? b.length : 0;
    var type = typeOf(b);
    var base = {
      type: type, size: size, supported: false, hasExif: false, hasGps: false,
      hasXmp: false, hasIcc: false, hasText: false, hasComment: false,
      make: '', model: '', dateTime: '', orientation: 0, fields: []
    };
    if (!type || !size) return base;

    var info = null;
    if (type === 'jpeg') info = parseJpeg(b);
    else if (type === 'png') info = parsePng(b);
    else if (type === 'webp') info = parseWebp(b);
    if (!info) return base;

    for (var k in info) if (Object.prototype.hasOwnProperty.call(info, k)) base[k] = info[k];
    base.supported = true;

    var fields = [];
    if (base.hasExif) fields.push({ key: 'exif', label: 'EXIF block', value: base.exifBytes ? Math.round(base.exifBytes / 1024 * 10) / 10 + ' KB' : 'present' });
    if (base.make || base.model) fields.push({ key: 'camera', label: 'Camera', value: [base.make, base.model].filter(Boolean).join(' ') });
    if (base.dateTimeOriginal || base.dateTime) fields.push({ key: 'date', label: 'Date taken', value: base.dateTimeOriginal || base.dateTime });
    if (base.software) fields.push({ key: 'software', label: 'Software', value: base.software });
    if (base.orientation) fields.push({ key: 'orientation', label: 'Orientation tag', value: String(base.orientation) });
    if (base.hasGps) fields.push({ key: 'gps', label: 'GPS location', value: 'yes — hidden in the file' });
    if (base.hasXmp) fields.push({ key: 'xmp', label: 'XMP / edit history', value: 'present' });
    if (base.hasComment) fields.push({ key: 'comment', label: 'JPEG comment', value: 'present' });
    if (base.hasText) fields.push({ key: 'text', label: 'Text chunks', value: base.textChunks ? base.textChunks + ' chunk(s)' : 'present' });
    base.fields = fields;
    base.risk = (base.hasGps ? 'gps' : (base.hasExif || base.hasXmp || base.hasText || base.hasComment) ? 'meta' : 'clean');
    return base;
  }

  function formatBytes(n) {
    if (!isFinite(n) || n < 0) return '\u2014';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* "IMG_2041.HEIC" -> "IMG_2041-clean.jpg" */
  function cleanFileName(name, mimeType) {
    var base = String(name || 'image').replace(/\.[A-Za-z0-9]+$/, '');
    base = base.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'image';
    var ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    return base + '-clean.' + ext;
  }

  return {
    typeOf: typeOf,
    parseTiff: parseTiff,
    parseJpeg: parseJpeg,
    parsePng: parsePng,
    parseWebp: parseWebp,
    summarize: summarize,
    formatBytes: formatBytes,
    cleanFileName: cleanFileName,
    ascii: ascii,
    u16: u16,
    u32: u32
  };
});
