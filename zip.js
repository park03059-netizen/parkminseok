/* 여러 파일을 ZIP 하나로 묶는 작은 압축기 (Deflate, 한글 파일 이름 지원) */
(() => {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes, crc = 0xffffffff) {
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return crc;
  }

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // 원본을 조금씩 읽으며 압축해 진행률(0~1)을 알려 준다
  async function deflate(bytes, onProgress) {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const chunks = [];
    const reading = (async () => {
      const reader = cs.readable.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    })();
    const CHUNK = 64 * 1024;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await writer.write(bytes.subarray(i, i + CHUNK));
      onProgress(Math.min(1, (i + CHUNK) / bytes.length));
    }
    await writer.close();
    await reading;
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /**
   * files: [{ name, data: Uint8Array }]
   * onProgress(0~1): 압축한 원본 바이트 기준 진행률
   */
  async function zip(files, { onProgress = () => {} } = {}) {
    const canDeflate = typeof CompressionStream === 'function';
    const enc = new TextEncoder();
    const { time, date } = dosTime(new Date());
    const total = files.reduce((n, f) => n + f.data.length, 0) || 1;
    let doneBytes = 0;
    const parts = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = (crc32(f.data) ^ 0xffffffff) >>> 0;
      let method = 0;
      let body = f.data;
      if (canDeflate) {
        const packed = await deflate(f.data, (r) => onProgress((doneBytes + r * f.data.length) / total));
        if (packed.length < f.data.length) { method = 8; body = packed; }
      }
      doneBytes += f.data.length;
      onProgress(doneBytes / total);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // 파일 이름이 UTF-8
      local.setUint16(8, method, true);
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, body);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, method, true);
      cen.setUint16(12, time, true);
      cen.setUint16(14, date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, body.length, true);
      cen.setUint32(24, f.data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);

      offset += 30 + name.length + body.length;
      await new Promise((r) => setTimeout(r, 0));
    }

    const cenSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  window.Zip = { zip };
})();
