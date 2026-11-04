// Kumo MP4 remuxer: turns streamed video (HLS transport streams, fragmented MP4 from
// HLS/DASH, separate audio and video tracks) into one ordinary MP4 file that browsers
// play directly. It only repackages samples; nothing is re-encoded.
(function (scope) {
  'use strict';
  const text = bytes => String.fromCharCode(...bytes);
  const fourcc = type => [...type].map(c => c.charCodeAt(0));

  // ---------- writing ----------
  function concat(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }
  const u8 = value => Uint8Array.of(value & 0xff);
  const u16 = value => Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
  const u32 = value => Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  const i32 = value => u32(value >>> 0);
  function box(type, ...payload) {
    const body = concat(payload.map(part => part instanceof Uint8Array ? part : Uint8Array.from(part)));
    return concat([u32(body.length + 8), Uint8Array.from(fourcc(type)), body]);
  }
  const fullBox = (type, version, flags, ...payload) => box(type, u8(version), Uint8Array.of((flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff), ...payload);
  const matrix = concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));

  function runLength(values) {
    const runs = [];
    for (const value of values) {
      const last = runs.at(-1);
      if (last && last[1] === value) last[0]++;
      else runs.push([1, value]);
    }
    return runs;
  }

  function trackBox(track, chunkOffsets, movieDuration) {
    const samples = track.samples;
    const durations = samples.map(sample => sample.duration);
    const mediaDuration = durations.reduce((sum, value) => sum + value, 0);
    const video = track.handler === 'vide';
    const stts = runLength(durations);
    const offsets = samples.map(sample => sample.cto || 0);
    const ctts = offsets.some(Boolean) ? runLength(offsets) : null;
    const negative = offsets.some(value => value < 0);
    const syncIndexes = samples.map((sample, index) => sample.sync ? index + 1 : 0).filter(Boolean);
    const stbl = box('stbl',
      track.stsd,
      fullBox('stts', 0, 0, u32(stts.length), concat(stts.flatMap(([count, delta]) => [u32(count), u32(delta)]))),
      ...(ctts ? [fullBox('ctts', negative ? 1 : 0, 0, u32(ctts.length), concat(ctts.flatMap(([count, offset]) => [u32(count), i32(offset)])))] : []),
      ...(video && syncIndexes.length < samples.length ? [fullBox('stss', 0, 0, u32(syncIndexes.length), concat(syncIndexes.map(u32)))] : []),
      fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
      fullBox('stsz', 0, 0, u32(0), u32(samples.length), concat(samples.map(sample => u32(sample.size)))),
      fullBox('stco', 0, 0, u32(chunkOffsets.length), concat(chunkOffsets.map(u32)))
    );
    const minf = box('minf',
      video ? fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)) : fullBox('smhd', 0, 0, u16(0), u16(0)),
      box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
      stbl
    );
    const name = video ? 'Kumo Video' : 'Kumo Audio';
    const mdia = box('mdia',
      fullBox('mdhd', 0, 0, u32(0), u32(0), u32(track.timescale), u32(mediaDuration), u16(0x55c4), u16(0)),
      fullBox('hdlr', 0, 0, u32(0), Uint8Array.from(fourcc(track.handler)), u32(0), u32(0), u32(0), Uint8Array.from([...fourcc(name), 0])),
      minf
    );
    const edits = [];
    if (track.emptyEdit > 0) edits.push([track.emptyEdit, -1]);
    edits.push([Math.max(0, Math.round((presentationEnd(track) - track.mediaTime) / track.timescale * 1000)), track.mediaTime]);
    const edts = box('edts', fullBox('elst', 0, 0, u32(edits.length), ...edits.flatMap(([duration, time]) => [u32(duration), i32(time), u16(1), u16(0)])));
    const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(track.id), u32(0), u32(movieDuration), u32(0), u32(0), u16(0), u16(0), u16(video ? 0 : 0x0100), u16(0), matrix, u32((track.width || 0) * 65536), u32((track.height || 0) * 65536));
    return box('trak', tkhd, edts, mdia);
  }

  // The last presented frame can come after the last decoded one when B-frames reorder.
  function presentationEnd(track) {
    let dts = 0, end = 0;
    for (const sample of track.samples) { end = Math.max(end, dts + (sample.cto || 0) + sample.duration); dts += sample.duration; }
    return end;
  }
  // Interleave samples by decode time and write ftyp + moov + mdat. Sample data stays in
  // the source Blobs (sliced lazily), so even long videos are not copied twice.
  function writeMp4(tracks, type = 'video/mp4') {
    tracks = tracks.filter(track => track.samples.length);
    if (!tracks.length) throw new Error('remux_no_samples');
    tracks.forEach((track, index) => { track.id = index + 1; });
    // Where each track starts on the shared timeline, honouring the source's own edit list.
    const starts = tracks.map(track => (track.firstDts + track.mediaTime - (track.editTime || 0)) / track.timescale + (track.emptySeconds || 0));
    const origin = Math.min(...starts);
    tracks.forEach((track, index) => { track.emptyEdit = Math.round((starts[index] - origin) * 1000); });
    const order = [];
    for (const track of tracks) {
      let dts = track.firstDts;
      for (const sample of track.samples) { order.push({track, sample, time: dts / track.timescale}); dts += sample.duration; }
    }
    order.sort((a, b) => a.time - b.time);
    const movieDuration = Math.max(...tracks.map(track => track.emptyEdit + Math.round((presentationEnd(track) - track.mediaTime) / track.timescale * 1000)));
    const ftyp = box('ftyp', Uint8Array.from(fourcc('isom')), u32(512), ...['isom', 'iso2', 'avc1', 'mp41'].map(brand => Uint8Array.from(fourcc(brand))));
    const build = offsets => box('moov',
      fullBox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDuration), u32(0x00010000), u16(0x0100), new Uint8Array(10), matrix, new Uint8Array(24), u32(tracks.length + 1)),
      ...tracks.map(track => trackBox(track, offsets.get(track), movieDuration))
    );
    const placeholder = new Map(tracks.map(track => [track, new Array(track.samples.length).fill(0)]));
    const headerSize = ftyp.length + build(placeholder).length + 8;
    let position = headerSize;
    const offsets = new Map(tracks.map(track => [track, []]));
    const parts = [];
    for (const item of order) {
      offsets.get(item.track).push(position);
      position += item.sample.size;
      parts.push(item.sample.data ? item.sample.data : item.sample.source.slice(item.sample.offset, item.sample.offset + item.sample.size));
    }
    if (position > 0xffffffff) throw new Error('video_too_large');
    const moov = build(offsets);
    return new Blob([ftyp, moov, u32(position - headerSize + 8), Uint8Array.from(fourcc('mdat')), ...parts], {type});
  }

  // ---------- fragmented MP4 (HLS fMP4, DASH, CMAF) ----------
  const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  function children(bytes, start = 0, end = bytes.length) {
    const out = [];
    const data = view(bytes);
    let offset = start;
    while (offset + 8 <= end) {
      let size = data.getUint32(offset);
      const type = text(bytes.subarray(offset + 4, offset + 8));
      let header = 8;
      if (size === 1) { size = Number(data.getBigUint64(offset + 8)); header = 16; }
      else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) break;
      out.push({type, start: offset, end: offset + size, body: offset + header});
      offset += size;
    }
    return out;
  }
  const find = (bytes, parent, type) => children(bytes, parent.body, parent.end).find(child => child.type === type);
  const path = (bytes, parent, ...types) => types.reduce((node, type) => node && find(bytes, node, type), parent);

  function parseMoov(bytes, source) {
    const root = {body: 0, end: bytes.length};
    const moov = find(bytes, root, 'moov');
    if (!moov) throw new Error('remux_missing_moov');
    const data = view(bytes);
    const mvhd = find(bytes, moov, 'mvhd');
    const movieTimescale = mvhd ? data.getUint32(mvhd.body + (bytes[mvhd.body] === 1 ? 20 : 12)) || 1000 : 1000;
    const defaults = new Map();
    const mvex = find(bytes, moov, 'mvex');
    if (mvex) for (const trex of children(bytes, mvex.body, mvex.end).filter(child => child.type === 'trex')) {
      const at = trex.body + 4;
      defaults.set(data.getUint32(at), {duration: data.getUint32(at + 8), size: data.getUint32(at + 12), flags: data.getUint32(at + 16)});
    }
    const tracks = [];
    for (const trak of children(bytes, moov.body, moov.end).filter(child => child.type === 'trak')) {
      const tkhd = find(bytes, trak, 'tkhd'), mdhd = path(bytes, trak, 'mdia', 'mdhd'), hdlr = path(bytes, trak, 'mdia', 'hdlr'), stsd = path(bytes, trak, 'mdia', 'minf', 'stbl', 'stsd');
      if (!tkhd || !mdhd || !hdlr || !stsd) continue;
      const handler = text(bytes.subarray(hdlr.body + 8, hdlr.body + 12));
      if (handler !== 'vide' && handler !== 'soun') continue;
      const tkVersion = bytes[tkhd.body], id = data.getUint32(tkhd.body + (tkVersion === 1 ? 20 : 12));
      const whAt = tkhd.end - 8;
      const mdVersion = bytes[mdhd.body], timescale = data.getUint32(mdhd.body + (mdVersion === 1 ? 20 : 12));
      const entry = text(bytes.subarray(stsd.body + 12, stsd.body + 16));
      if (entry === 'encv' || entry === 'enca') throw new Error('drm_protected_video');
      let editTime = 0, emptySeconds = 0;
      const elst = path(bytes, trak, 'edts', 'elst');
      if (elst) {
        const version = bytes[elst.body], count = data.getUint32(elst.body + 4), size = version === 1 ? 20 : 12;
        for (let index = 0; index < count; index++) {
          const at = elst.body + 8 + index * size;
          const duration = version === 1 ? Number(data.getBigUint64(at)) : data.getUint32(at);
          const time = version === 1 ? Number(data.getBigInt64(at + 8)) : data.getInt32(at + 4);
          if (time >= 0) { editTime = time; break; }
          emptySeconds += duration / movieTimescale;
        }
      }
      const track = {sourceId: id, handler, timescale, stsd: bytes.slice(stsd.start, stsd.end), width: data.getUint32(whAt) >>> 16, height: data.getUint32(whAt + 4) >>> 16, editTime, emptySeconds, defaults: defaults.get(id) || {duration: 0, size: 0, flags: 0}, samples: [], nextDts: null, firstDts: null};
      const stbl = path(bytes, trak, 'mdia', 'minf', 'stbl');
      if (source && stbl) readFlatSamples(bytes, stbl, track, source);
      tracks.push(track);
    }
    if (!tracks.length) throw new Error('remux_no_media_tracks');
    return tracks;
  }

  // SegmentBase DASH often delivers ordinary MP4 tracks, not moof fragments.
  function readFlatSamples(bytes, stbl, track, source) {
    const data = view(bytes), stsz = find(bytes, stbl, 'stsz');
    if (!stsz) return;
    const count = data.getUint32(stsz.body + 8), fixed = data.getUint32(stsz.body + 4);
    if (!count) return;
    if (count > 2000000) throw new Error('remux_sample_count_limit');
    const chunks = find(bytes, stbl, 'stco') || find(bytes, stbl, 'co64'), stsc = find(bytes, stbl, 'stsc'), stts = find(bytes, stbl, 'stts');
    if (!chunks || !stsc || !stts) throw new Error('remux_missing_sample_tables');
    const check = (box, offset, length) => { if (offset < box.body || offset + length > box.end) throw new Error('remux_invalid_sample_table'); };
    const sizes = Array.from({length: count}, (_, index) => { if (fixed) return fixed; check(stsz, stsz.body + 12 + index * 4, 4); return data.getUint32(stsz.body + 12 + index * 4); });
    const expand = (box, signed = false) => {
      const values = new Array(count); if (!box) return values.fill(0);
      let n = 0; const rows = data.getUint32(box.body + 4);
      for (let row = 0; row < rows; row++) {
        const at = box.body + 8 + row * 8; check(box, at, 8);
        const repeat = data.getUint32(at), value = signed ? data.getInt32(at + 4) : data.getUint32(at + 4);
        if (n + repeat > count) throw new Error('remux_invalid_sample_table');
        values.fill(value, n, n + repeat); n += repeat;
      }
      if (n !== count) throw new Error('remux_incomplete_sample_table');
      return values;
    };
    const durations = expand(stts), ctts = find(bytes, stbl, 'ctts'), offsets = expand(ctts, ctts && bytes[ctts.body] === 1);
    const stss = find(bytes, stbl, 'stss'), sync = stss ? new Set() : null;
    if (stss) for (let i = 0; i < data.getUint32(stss.body + 4); i++) { const at = stss.body + 8 + i * 4; check(stss, at, 4); sync.add(data.getUint32(at)); }
    const mappings = [];
    for (let i = 0; i < data.getUint32(stsc.body + 4); i++) { const at = stsc.body + 8 + i * 12; check(stsc, at, 12); if (data.getUint32(at + 8) !== 1) throw new Error('remux_multiple_sample_descriptions'); mappings.push({first: data.getUint32(at), count: data.getUint32(at + 4)}); }
    if (!mappings.length || mappings[0].first !== 1) throw new Error('remux_invalid_sample_table');
    let sample = 0, mapping = 0, dts = 0;
    const chunkCount = data.getUint32(chunks.body + 4), stride = chunks.type === 'co64' ? 8 : 4;
    for (let chunk = 1; chunk <= chunkCount; chunk++) {
      while (mapping + 1 < mappings.length && mappings[mapping + 1].first <= chunk) mapping++;
      const at = chunks.body + 8 + (chunk - 1) * stride; check(chunks, at, stride);
      let offset = stride === 8 ? Number(data.getBigUint64(at)) : data.getUint32(at);
      for (let i = 0; i < mappings[mapping].count; i++) {
        if (sample >= count || !Number.isSafeInteger(offset) || offset < 0 || offset + sizes[sample] > source.size) throw new Error('remux_invalid_sample_offset');
        track.samples.push({source, offset, size: sizes[sample], duration: durations[sample], cto: offsets[sample], sync: !sync || sync.has(sample + 1)});
        offset += sizes[sample]; dts += durations[sample]; sample++;
      }
    }
    if (sample !== count) throw new Error('remux_incomplete_sample_table');
    track.firstDts = 0; track.nextDts = dts;
  }

  function parseMoof(bytes, moofStart, tracks, source, sourceOffset) {
    const data = view(bytes);
    const moof = {body: moofStart + 8, end: moofStart + data.getUint32(moofStart)};
    for (const traf of children(bytes, moof.body, moof.end).filter(child => child.type === 'traf')) {
      const tfhd = find(bytes, traf, 'tfhd');
      if (!tfhd) continue;
      const tfFlags = data.getUint32(tfhd.body) & 0xffffff;
      let at = tfhd.body + 4;
      const track = tracks.find(item => item.sourceId === data.getUint32(at));
      at += 4;
      if (!track) continue;
      let base = moofStart;
      if (tfFlags & 0x1) { base = Number(data.getBigUint64(at)) - sourceOffset; at += 8; }
      if (tfFlags & 0x2) at += 4;
      let defaultDuration = track.defaults.duration, defaultSize = track.defaults.size, defaultFlags = track.defaults.flags;
      if (tfFlags & 0x8) { defaultDuration = data.getUint32(at); at += 4; }
      if (tfFlags & 0x10) { defaultSize = data.getUint32(at); at += 4; }
      if (tfFlags & 0x20) defaultFlags = data.getUint32(at);
      const tfdt = find(bytes, traf, 'tfdt');
      let dts = track.nextDts;
      if (tfdt) {
        const decode = bytes[tfdt.body] === 1 ? Number(data.getBigUint64(tfdt.body + 4)) : data.getUint32(tfdt.body + 4);
        if (track.nextDts === null) dts = decode;
        // A forward gap (missing segment) lengthens the previous sample; a jump backwards
        // (an HLS discontinuity or overlap) continues from where the previous fragment ended.
        else if (decode > track.nextDts && track.samples.length) { track.samples.at(-1).duration += decode - track.nextDts; dts = decode; }
      }
      if (dts === null) dts = 0;
      if (track.firstDts === null) track.firstDts = dts;
      let position = base;
      for (const trun of children(bytes, traf.body, traf.end).filter(child => child.type === 'trun')) {
        const version = bytes[trun.body], flags = data.getUint32(trun.body) & 0xffffff, count = data.getUint32(trun.body + 4);
        let cursor = trun.body + 8;
        if (flags & 0x1) { position = base + data.getInt32(cursor); cursor += 4; }
        let firstFlags = null;
        if (flags & 0x4) { firstFlags = data.getUint32(cursor); cursor += 4; }
        for (let index = 0; index < count; index++) {
          const duration = flags & 0x100 ? data.getUint32(cursor) : defaultDuration; if (flags & 0x100) cursor += 4;
          const size = flags & 0x200 ? data.getUint32(cursor) : defaultSize; if (flags & 0x200) cursor += 4;
          let sampleFlags = flags & 0x400 ? data.getUint32(cursor) : defaultFlags; if (flags & 0x400) cursor += 4;
          if (index === 0 && firstFlags !== null) sampleFlags = firstFlags;
          const cto = flags & 0x800 ? (version === 1 ? data.getInt32(cursor) : data.getUint32(cursor)) : 0; if (flags & 0x800) cursor += 4;
          track.samples.push({source, offset: sourceOffset + position, size, duration, cto, sync: track.handler !== 'vide' || !(sampleFlags & 0x10000)});
          position += size;
          dts += duration;
        }
      }
      track.nextDts = dts;
    }
  }

  async function readBytes(blob, start, end) {
    return new Uint8Array(await blob.slice(start, end).arrayBuffer());
  }
  // Walk top-level boxes without loading media data: only moov/moof are read into memory.
  async function scanFragmented(blob, tracks) {
    let offset = 0;
    while (offset + 8 <= blob.size) {
      const head = await readBytes(blob, offset, Math.min(offset + 16, blob.size));
      const data = view(head);
      let size = data.getUint32(0);
      const type = text(head.subarray(4, 8));
      if (size === 1) size = Number(data.getBigUint64(8));
      else if (size === 0) size = blob.size - offset;
      if (size < 8 || offset + size > blob.size) break;
      if (type === 'moov') {
        if (!tracks.length) tracks.push(...parseMoov(await readBytes(blob, offset, offset + size), blob));
      } else if (type === 'moof') {
        if (!tracks.length) throw new Error('remux_missing_init_segment');
        const bytes = await readBytes(blob, offset, offset + size);
        parseMoof(bytes, 0, tracks, blob, offset);
      }
      offset += size;
    }
    return tracks;
  }

  // inputs: one array of Blobs per separately delivered stream (for example
  // [[videoInit, ...videoSegments], [audioInit, ...audioSegments]] or [[videoFile], [audioFile]]).
  async function fromFragmented(inputs) {
    const all = [];
    for (const parts of inputs) {
      const tracks = [];
      for (const part of parts) await scanFragmented(part, tracks);
      all.push(...tracks);
    }
    for (const track of all) {
      track.firstDts ??= 0;
      // Start where the first frame is presented, and honour an encoder delay from the source edit list.
      let dts = 0, firstPts = Infinity;
      for (const sample of track.samples.slice(0, 256)) { firstPts = Math.min(firstPts, dts + sample.cto); dts += sample.duration; }
      track.mediaTime = Math.max(0, Number.isFinite(firstPts) ? firstPts : 0, track.editTime - track.firstDts);
    }
    return writeMp4(all.filter(track => track.samples.length));
  }

  // ---------- MPEG transport stream (HLS .ts) ----------
  function readBits(bytes) {
    let index = 0;
    const bit = () => (bytes[index >> 3] >> (7 - (index++ & 7))) & 1;
    const bits = count => { let value = 0; for (let i = 0; i < count; i++) value = value * 2 + bit(); return value; };
    const ue = () => { let zeros = 0; while (!bit() && zeros < 32) zeros++; return (2 ** zeros - 1) + bits(zeros); };
    const se = () => { const value = ue(); return value & 1 ? (value + 1) / 2 : -value / 2; };
    return {bit, bits, ue, se, skip: count => { index += count; }};
  }
  function unescapeRbsp(nal) {
    const out = [];
    for (let index = 0; index < nal.length; index++) {
      if (index >= 2 && nal[index] === 3 && nal[index - 1] === 0 && nal[index - 2] === 0) continue;
      out.push(nal[index]);
    }
    return Uint8Array.from(out);
  }
  function spsSize(sps) {
    const r = readBits(unescapeRbsp(sps.subarray(1)));
    const profile = r.bits(8); r.skip(16); r.ue();
    let chroma = 1;
    if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) {
      chroma = r.ue(); if (chroma === 3) r.skip(1);
      r.ue(); r.ue(); r.skip(1);
      if (r.bit()) for (let list = 0; list < (chroma !== 3 ? 8 : 12); list++) if (r.bit()) {
        let last = 8, next = 8;
        for (let index = 0; index < (list < 6 ? 16 : 64); index++) { if (next !== 0) next = (last + r.se() + 256) % 256; last = next === 0 ? last : next; }
      }
    }
    r.ue();
    const pocType = r.ue();
    if (pocType === 0) r.ue();
    else if (pocType === 1) { r.skip(1); r.se(); r.se(); const cycle = r.ue(); for (let index = 0; index < cycle; index++) r.se(); }
    r.ue(); r.skip(1);
    const widthMbs = r.ue() + 1, heightUnits = r.ue() + 1, frameMbsOnly = r.bit();
    if (!frameMbsOnly) r.skip(1);
    r.skip(1);
    let width = widthMbs * 16, height = (2 - frameMbsOnly) * heightUnits * 16;
    if (r.bit()) {
      const left = r.ue(), right = r.ue(), top = r.ue(), bottom = r.ue();
      const cropX = chroma === 0 ? 1 : chroma === 3 ? 1 : 2, cropY = (chroma === 1 ? 2 : 1) * (2 - frameMbsOnly);
      width -= (left + right) * cropX; height -= (top + bottom) * cropY;
    }
    return {width, height};
  }
  function splitNals(bytes) {
    const nals = [];
    let start = -1;
    for (let index = 0; index + 2 < bytes.length; index++) {
      if (bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 1) {
        if (start >= 0) { let end = index; while (end > start && bytes[end - 1] === 0) end--; nals.push(bytes.subarray(start, end)); }
        start = index + 3; index += 2;
      }
    }
    if (start >= 0 && start < bytes.length) nals.push(bytes.subarray(start));
    return nals.filter(nal => nal.length);
  }
  const ADTS_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  function createTsDemuxer() {
    const state = {pmt: null, videoPid: null, audioPid: null, pes: new Map(), video: [], audio: [], sps: null, pps: null, audioConfig: null, audioBuffer: new Uint8Array(0), audioPts: null, audioFrames: 0, rebase: false, offset: 0, lastVideoDts: null, lastVideoDuration: 3000, unsupported: null};
    const pts = (bytes, at) => (bytes[at] & 0x0e) * 536870912 + bytes[at + 1] * 4194304 + (bytes[at + 2] & 0xfe) * 16384 + bytes[at + 3] * 128 + (bytes[at + 4] >> 1);
    function flush(pid) {
      const chunks = state.pes.get(pid);
      state.pes.delete(pid);
      if (!chunks?.length) return;
      const pes = concat(chunks);
      if (pes.length < 9 || pes[0] !== 0 || pes[1] !== 0 || pes[2] !== 1) return;
      const flags = pes[7], headerLength = pes[8];
      let presentation = null, decode = null;
      if (flags & 0x80) presentation = pts(pes, 9);
      if ((flags & 0xc0) === 0xc0) decode = pts(pes, 14); else decode = presentation;
      const payload = pes.subarray(9 + headerLength);
      if (pid === state.videoPid) video(payload, presentation, decode);
      else if (pid === state.audioPid) audio(payload, presentation);
    }
    function video(payload, presentation, decode) {
      const nals = splitNals(payload).filter(nal => (nal[0] & 0x1f) !== 9);
      if (!nals.length) return;
      for (const nal of nals) {
        const type = nal[0] & 0x1f;
        if (type === 7 && !state.sps) state.sps = nal.slice();
        if (type === 8 && !state.pps) state.pps = nal.slice();
      }
      if (decode === null) {
        const last = state.video.at(-1);
        if (last) { last.nals.push(...nals.map(nal => nal.slice())); last.sync ||= nals.some(nal => (nal[0] & 0x1f) === 5); }
        return;
      }
      if (state.rebase && state.lastVideoDts !== null) { state.offset = state.lastVideoDts + state.lastVideoDuration - decode; state.rebase = false; }
      else state.rebase = false;
      decode += state.offset; presentation += state.offset;
      while (state.lastVideoDts !== null && decode < state.lastVideoDts - 4294967296) { decode += 8589934592; presentation += 8589934592; }
      if (state.lastVideoDts !== null && decode > state.lastVideoDts) state.lastVideoDuration = decode - state.lastVideoDts;
      state.lastVideoDts = decode;
      state.video.push({dts: decode, pts: presentation, nals: nals.map(nal => nal.slice()), sync: nals.some(nal => (nal[0] & 0x1f) === 5)});
    }
    function audio(payload, presentation) {
      if (state.audioPts === null && presentation !== null) state.audioPts = presentation + state.offset;
      const buffer = concat([state.audioBuffer, payload]);
      let at = 0;
      while (at + 7 <= buffer.length) {
        if (buffer[at] !== 0xff || (buffer[at + 1] & 0xf0) !== 0xf0) { at++; continue; }
        const length = ((buffer[at + 3] & 0x03) << 11) | (buffer[at + 4] << 3) | (buffer[at + 5] >> 5);
        if (length < 7) { at++; continue; }
        if (at + length > buffer.length) break;
        const header = (buffer[at + 1] & 0x01) ? 7 : 9;
        if (!state.audioConfig) {
          const objectType = ((buffer[at + 2] >> 6) & 0x03) + 1, rateIndex = (buffer[at + 2] >> 2) & 0x0f, channels = ((buffer[at + 2] & 0x01) << 2) | (buffer[at + 3] >> 6);
          state.audioConfig = {objectType, rateIndex, channels, rate: ADTS_RATES[rateIndex] || 44100};
        }
        state.audio.push(buffer.slice(at + header, at + length));
        at += length;
      }
      state.audioBuffer = buffer.slice(at);
    }
    function push(bytes) {
      let start = 0;
      while (start < bytes.length && bytes[start] !== 0x47) start++;
      for (let at = start; at + 188 <= bytes.length; at += 188) {
        if (bytes[at] !== 0x47) { while (at < bytes.length && bytes[at] !== 0x47) at++; at -= 188; continue; }
        const unitStart = bytes[at + 1] & 0x40, pid = ((bytes[at + 1] & 0x1f) << 8) | bytes[at + 2], adaptation = (bytes[at + 3] >> 4) & 0x3;
        let payload = at + 4;
        if (adaptation === 2) continue;
        if (adaptation === 3) payload += 1 + bytes[at + 4];
        if (payload >= at + 188) continue;
        const data = bytes.subarray(payload, at + 188);
        if (pid === 0) {
          if (unitStart) { const section = data.subarray(1 + data[0]); state.pmt = ((section[10] & 0x1f) << 8) | section[11]; }
        } else if (pid === state.pmt) {
          if (!unitStart) continue;
          const section = data.subarray(1 + data[0]), length = ((section[1] & 0x0f) << 8) | section[2], infoLength = ((section[10] & 0x0f) << 8) | section[11];
          for (let cursor = 12 + infoLength; cursor < 3 + length - 4;) {
            const type = section[cursor], elementary = ((section[cursor + 1] & 0x1f) << 8) | section[cursor + 2], esInfo = ((section[cursor + 3] & 0x0f) << 8) | section[cursor + 4];
            if (type === 0x1b && state.videoPid === null) state.videoPid = elementary;
            else if (type === 0x0f && state.audioPid === null) state.audioPid = elementary;
            else if (type === 0x24 && state.videoPid === null) state.unsupported = 'hevc_transport_stream_not_supported';
            cursor += 5 + esInfo;
          }
        } else if (pid === state.videoPid || pid === state.audioPid) {
          if (unitStart) flush(pid);
          if (!state.pes.has(pid)) { if (!unitStart) continue; state.pes.set(pid, []); }
          state.pes.get(pid).push(data.slice());
        }
      }
    }
    function finish() {
      for (const pid of [...state.pes.keys()]) flush(pid);
      return state;
    }
    return {push, finish, discontinuity() { state.rebase = true; }, state};
  }

  function avcTrack(state) {
    if (!state.video.length) return null;
    if (!state.sps || !state.pps) throw new Error('remux_missing_h264_parameters');
    const frames = state.video;
    while (frames.length && !frames[0].sync) frames.shift();
    if (!frames.length) return null;
    const {width, height} = spsSize(state.sps);
    const avcC = box('avcC', Uint8Array.of(1, state.sps[1], state.sps[2], state.sps[3], 0xff, 0xe1), u16(state.sps.length), state.sps, u8(1), u16(state.pps.length), state.pps);
    const avc1 = box('avc1', new Uint8Array(6), u16(1), new Uint8Array(16), u16(width), u16(height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Uint8Array(32), u16(0x18), u16(0xffff), avcC);
    const samples = frames.map((frame, index) => {
      const data = concat(frame.nals.filter(nal => ![7, 8, 9].includes(nal[0] & 0x1f) || frame.sync).flatMap(nal => [u32(nal.length), nal]));
      const next = frames[index + 1];
      return {data, size: data.length, duration: next ? Math.max(1, next.dts - frame.dts) : 0, cto: frame.pts - frame.dts, sync: frame.sync};
    });
    const typical = samples.length > 1 ? samples[samples.length - 2].duration : 3000;
    samples.at(-1).duration = typical;
    const firstPts = Math.min(...frames.slice(0, 64).map(frame => frame.pts));
    return {handler: 'vide', timescale: 90000, width, height, firstDts: frames[0].dts, mediaTime: firstPts - frames[0].dts, samples, stsd: fullBox('stsd', 0, 0, u32(1), avc1)};
  }
  function aacTrack(state) {
    if (!state.audio.length || !state.audioConfig) return null;
    const {objectType, rateIndex, channels, rate} = state.audioConfig;
    const asc = Uint8Array.of((objectType << 3) | (rateIndex >> 1), ((rateIndex & 1) << 7) | (channels << 3));
    const descriptor = (tag, ...payload) => { const body = concat(payload); return concat([u8(tag), u8(body.length), body]); };
    const esds = fullBox('esds', 0, 0, descriptor(3, u16(0), u8(0), descriptor(4, u8(0x40), u8(0x15), Uint8Array.of(0, 0, 0), u32(0), u32(0), descriptor(5, asc)), descriptor(6, u8(2))));
    const mp4a = box('mp4a', new Uint8Array(6), u16(1), new Uint8Array(8), u16(channels || 2), u16(16), u16(0), u16(0), u32(rate * 65536), esds);
    const samples = state.audio.map(frame => ({data: frame, size: frame.length, duration: 1024, cto: 0, sync: true}));
    const firstDts = Math.round((state.audioPts ?? 0) * rate / 90000);
    return {handler: 'soun', timescale: rate, firstDts, mediaTime: 0, samples, stsd: fullBox('stsd', 0, 0, u32(1), mp4a)};
  }

  // segments: Blobs in playback order; discontinuities: indexes of segments that start a new timeline.
  async function fromTransportStream(segments, {discontinuities = []} = {}) {
    const demuxer = createTsDemuxer();
    const breaks = new Set(discontinuities);
    for (let index = 0; index < segments.length; index++) {
      if (breaks.has(index) && index > 0) demuxer.discontinuity();
      demuxer.push(new Uint8Array(await segments[index].arrayBuffer()));
    }
    const state = demuxer.finish();
    if (state.unsupported && !state.video.length) throw new Error(state.unsupported);
    const tracks = [avcTrack(state), aacTrack(state)].filter(Boolean);
    if (!tracks.length) throw new Error('remux_no_supported_tracks');
    return writeMp4(tracks);
  }

  async function sniff(blob) {
    const head = await readBytes(blob, 0, Math.min(blob.size, 400));
    if (head[0] === 0x47 && (head.length < 189 || head[188] === 0x47)) return 'mpegts';
    const first = text(head.subarray(4, 8));
    if (['ftyp', 'styp', 'moov', 'moof', 'sidx', 'free', 'mdat', 'wide'].includes(first)) return 'mp4';
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm';
    if (/^\s*#EXTM3U/.test(text(head.subarray(0, 32)))) return 'hls';
    return 'unknown';
  }
  async function isFragmented(blob) {
    let offset = 0;
    while (offset + 8 <= blob.size) {
      const head = await readBytes(blob, offset, Math.min(offset + 16, blob.size)), data = view(head);
      let size = data.getUint32(0);
      const type = text(head.subarray(4, 8));
      if (type === 'moof') return true;
      if (type === 'mdat') return false;
      if (size === 1) size = Number(data.getBigUint64(8)); else if (size === 0) return false;
      if (size < 8) return false;
      offset += size;
    }
    return false;
  }

  const api = {fromFragmented, fromTransportStream, writeMp4, sniff, isFragmented, createTsDemuxer};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.KumoMp4 = api;
})(globalThis);
