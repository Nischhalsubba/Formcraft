'use strict';

(() => {
  const textDecoder = new TextDecoder('utf-8');

  function u16(view, offset) { return view.getUint16(offset, true); }
  function u32(view, offset) { return view.getUint32(offset, true); }

  function findEndOfCentralDirectory(view) {
    const min = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
      if (u32(view, offset) === 0x06054b50) return offset;
    }
    throw new Error('This XLSX file has no readable ZIP directory.');
  }

  function centralDirectory(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const eocd = findEndOfCentralDirectory(view);
    const count = u16(view, eocd + 10);
    let offset = u32(view, eocd + 16);
    const files = new Map();
    for (let index = 0; index < count; index += 1) {
      if (u32(view, offset) !== 0x02014b50) throw new Error('The XLSX ZIP directory is malformed.');
      const method = u16(view, offset + 10);
      const compressedSize = u32(view, offset + 20);
      const uncompressedSize = u32(view, offset + 24);
      const fileNameLength = u16(view, offset + 28);
      const extraLength = u16(view, offset + 30);
      const commentLength = u16(view, offset + 32);
      const localOffset = u32(view, offset + 42);
      const name = textDecoder.decode(new Uint8Array(arrayBuffer, offset + 46, fileNameLength));
      files.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return files;
  }

  async function inflateRaw(bytes) {
    if (!globalThis.DecompressionStream) throw new Error('This browser cannot decompress XLSX files. Use CSV instead.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipEntry(arrayBuffer, entry) {
    if (!entry) return '';
    const view = new DataView(arrayBuffer);
    const offset = entry.localOffset;
    if (u32(view, offset) !== 0x04034b50) throw new Error(`XLSX entry ${entry.name} has an invalid local header.`);
    const fileNameLength = u16(view, offset + 26);
    const extraLength = u16(view, offset + 28);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const compressed = new Uint8Array(arrayBuffer, dataOffset, entry.compressedSize);
    let bytes;
    if (entry.method === 0) bytes = compressed;
    else if (entry.method === 8) bytes = await inflateRaw(compressed);
    else throw new Error(`XLSX compression method ${entry.method} is not supported.`);
    return textDecoder.decode(bytes);
  }

  function xml(text) {
    const parsed = new DOMParser().parseFromString(text, 'application/xml');
    if (parsed.querySelector('parsererror')) throw new Error('A required XLSX XML file could not be parsed.');
    return parsed;
  }

  function sharedStrings(documentNode) {
    return [...documentNode.getElementsByTagName('si')].map(node => [...node.getElementsByTagName('t')].map(item => item.textContent || '').join(''));
  }

  function columnIndex(reference) {
    const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let value = 0;
    for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
    return Math.max(0, value - 1);
  }

  function cellValue(cell, strings) {
    const type = cell.getAttribute('t') || '';
    const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
    if (type === 's') return strings[Number(value)] ?? '';
    if (type === 'inlineStr') return [...cell.getElementsByTagName('t')].map(item => item.textContent || '').join('');
    if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
    return value;
  }

  function sheetRows(documentNode, strings) {
    return [...documentNode.getElementsByTagName('row')].map(row => {
      const values = [];
      [...row.getElementsByTagName('c')].forEach(cell => {
        values[columnIndex(cell.getAttribute('r'))] = cellValue(cell, strings);
      });
      return values.map(value => value ?? '');
    });
  }

  function toObjects(rows) {
    const cleaned = rows.filter(row => row.some(value => String(value || '').trim()));
    if (cleaned.length < 2) throw new Error('The first XLSX sheet needs a header row and at least one data row.');
    const headers = cleaned[0].map((value, index) => String(value || `Column${index + 1}`).trim());
    return cleaned.slice(1).map(row => headers.reduce((record, header, index) => {
      record[header] = row[index] ?? '';
      return record;
    }, {}));
  }

  async function parse(file) {
    const buffer = await file.arrayBuffer();
    const files = centralDirectory(buffer);
    const sharedEntry = files.get('xl/sharedStrings.xml');
    const sheetEntry = files.get('xl/worksheets/sheet1.xml')
      || [...files.values()].find(entry => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
    if (!sheetEntry) throw new Error('No worksheet was found in the XLSX file.');
    const strings = sharedEntry ? sharedStrings(xml(await readZipEntry(buffer, sharedEntry))) : [];
    const rows = sheetRows(xml(await readZipEntry(buffer, sheetEntry)), strings);
    return toObjects(rows);
  }

  window.FormcraftXLSX = Object.freeze({ parse });
})();
