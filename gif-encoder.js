/* 외부 라이브러리 없이 동작하는 GIF89a 인코더 (프레임별 median-cut 256색 + LZW) */
(function () {
  'use strict';

  class ByteWriter {
    constructor() { this.buf = new Uint8Array(1 << 16); this.len = 0; }
    ensure(n) {
      if (this.len + n <= this.buf.length) return;
      const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
      next.set(this.buf.subarray(0, this.len));
      this.buf = next;
    }
    byte(b) { this.ensure(1); this.buf[this.len++] = b; }
    u16(v) { this.byte(v & 255); this.byte((v >> 8) & 255); }
    bytes(arr) { this.ensure(arr.length); this.buf.set(arr, this.len); this.len += arr.length; }
    str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
    result() { return this.buf.slice(0, this.len); }
  }

  // 색 줄이기: RGB 각 5비트 히스토그램을 median-cut으로 256개 상자로 나눈다
  function quantize(data) {
    const hist = new Uint32Array(32768);
    for (let i = 0; i < data.length; i += 4) {
      hist[((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)]++;
    }
    const all = [];
    for (let k = 0; k < 32768; k++) if (hist[k]) all.push(k);

    const ch = [(c) => c >> 10, (c) => (c >> 5) & 31, (c) => c & 31];
    const makeBox = (cols) => {
      const min = [31, 31, 31], max = [0, 0, 0];
      let count = 0;
      for (const c of cols) {
        for (let j = 0; j < 3; j++) {
          const v = ch[j](c);
          if (v < min[j]) min[j] = v;
          if (v > max[j]) max[j] = v;
        }
        count += hist[c];
      }
      return { cols, min, max, count };
    };

    const boxes = [makeBox(all)];
    while (boxes.length < 256) {
      let bi = -1, best = -1;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (b.cols.length < 2) continue;
        const range = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
        const score = range * Math.sqrt(b.count);
        if (score > best) { best = score; bi = i; }
      }
      if (bi < 0) break;
      const b = boxes[bi];
      const ranges = [0, 1, 2].map((j) => b.max[j] - b.min[j]);
      const j = ranges.indexOf(Math.max(...ranges));
      const cols = b.cols.slice().sort((x, y) => ch[j](x) - ch[j](y));
      let acc = 0, split = 1;
      const half = b.count / 2;
      for (let i = 0; i < cols.length - 1; i++) {
        acc += hist[cols[i]];
        split = i + 1;
        if (acc >= half) break;
      }
      boxes.splice(bi, 1, makeBox(cols.slice(0, split)), makeBox(cols.slice(split)));
    }

    const palette = new Uint8Array(768);
    const lut = new Uint8Array(32768);
    boxes.forEach((b, i) => {
      let r = 0, g = 0, bl = 0, n = 0;
      for (const c of b.cols) {
        const w = hist[c];
        r += (((c >> 10) << 3) | 4) * w;
        g += ((((c >> 5) & 31) << 3) | 4) * w;
        bl += (((c & 31) << 3) | 4) * w;
        n += w;
        lut[c] = i;
      }
      if (n) {
        palette[i * 3] = Math.round(r / n);
        palette[i * 3 + 1] = Math.round(g / n);
        palette[i * 3 + 2] = Math.round(bl / n);
      }
    });

    const indices = new Uint8Array(data.length / 4);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      indices[p] = lut[((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)];
    }
    return { palette, indices };
  }

  function lzw(indices, minCodeSize, out) {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = new Map();

    const block = new Uint8Array(255);
    let blockLen = 0, cur = 0, curBits = 0;
    const pushByte = (b) => {
      block[blockLen++] = b;
      if (blockLen === 255) { out.byte(255); out.bytes(block); blockLen = 0; }
    };
    const emit = (code) => {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) { pushByte(cur & 255); cur >>>= 8; curBits -= 8; }
    };

    out.byte(minCodeSize);
    emit(clearCode);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) { prefix = found; continue; }
      emit(prefix);
      if (nextCode === 4096) {
        emit(clearCode);
        dict = new Map();
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
      } else {
        if (nextCode >= (1 << codeSize)) codeSize++;
        dict.set(key, nextCode++);
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoiCode);
    if (curBits > 0) pushByte(cur & 255);
    if (blockLen) { out.byte(blockLen); out.bytes(block.subarray(0, blockLen)); }
    out.byte(0);
  }

  const wait = () => new Promise((r) => setTimeout(r, 0));

  // 앞 장면과 달라진 부분의 사각형
  function diffRect(a, b, w, h) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (a[row + x] !== b[row + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          maxY = y;
        }
      }
    }
    if (maxX < 0) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function crop(data, w, r) {
    if (r.x === 0 && r.y === 0 && r.w === w) return data.subarray(0, r.w * r.h * 4);
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) {
      const s = ((r.y + y) * w + r.x) * 4;
      out.set(data.subarray(s, s + r.w * 4), y * r.w * 4);
    }
    return out;
  }

  /**
   * @param {{width:number,height:number,count:number,getFrame:(i:number)=>ImageData,delays:number[],onProgress?:(done:number,total:number)=>void}} opt
   * delays: 장면마다 보여 줄 초
   * @returns {Promise<Uint8Array>}
   */
  async function encode({ width, height, count, getFrame, delays, onProgress }) {
    const out = new ByteWriter();
    out.str('GIF89a');
    out.u16(width); out.u16(height);
    out.byte(0); out.byte(0); out.byte(0);

    // 무한 반복
    out.byte(0x21); out.byte(0xff); out.byte(11); out.str('NETSCAPE2.0');
    out.byte(3); out.byte(1); out.u16(0); out.byte(0);

    let prev = null;
    for (let f = 0; f < count; f++) {
      const data = getFrame(f).data;
      const cur = new Uint32Array(data.buffer, data.byteOffset, width * height);
      const r = prev ? diffRect(prev, cur, width, height) : { x: 0, y: 0, w: width, h: height };
      prev = cur;
      const { palette, indices } = quantize(crop(data, width, r));
      const cs = Math.max(2, Math.round(delays[f] * 100));

      // 장면을 지우지 않고 바뀐 부분만 덮는다 (disposal 1)
      out.byte(0x21); out.byte(0xf9); out.byte(4);
      out.byte(0x04); out.u16(cs); out.byte(0); out.byte(0);

      out.byte(0x2c);
      out.u16(r.x); out.u16(r.y); out.u16(r.w); out.u16(r.h);
      out.byte(0x87);
      out.bytes(palette);

      lzw(indices, 8, out);
      if (onProgress) onProgress(f + 1, count);
      await wait();
    }
    out.byte(0x3b);
    return out.result();
  }

  window.GifEncoder = { encode };
})();
