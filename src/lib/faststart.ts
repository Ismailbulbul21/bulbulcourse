/**
 * MP4 "faststart" remux in the browser (the qt-faststart algorithm).
 *
 * Screen recorders and phones usually write the moov box (the index the
 * player needs before it can decode ANYTHING) at the END of the file. Over a
 * far-away object storage that means many slow round-trips before playback
 * starts. This moves moov to the front right after ftyp and patches the
 * chunk-offset tables (stco/co64), so videos start streaming immediately.
 *
 * Memory-safe for large files: only box headers and the moov box itself are
 * read into memory — the media data (mdat) is passed through as Blob slices.
 * On ANY parse problem we fall back to the original file.
 */

interface TopBox {
  type: string;
  start: number;
  size: number;
}

const MOOV_CONTAINERS = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "mvex",
  "udta",
]);

async function readTopBoxes(file: Blob): Promise<TopBox[]> {
  const boxes: TopBox[] = [];
  let off = 0;
  while (off + 8 <= file.size) {
    const head = new DataView(
      await file.slice(off, Math.min(off + 16, file.size)).arrayBuffer()
    );
    let size: number = head.getUint32(0);
    const type = String.fromCharCode(
      head.getUint8(4),
      head.getUint8(5),
      head.getUint8(6),
      head.getUint8(7)
    );
    let headerSize = 8;
    if (size === 1) {
      if (head.byteLength < 16) throw new Error("truncated 64-bit box");
      size = Number(head.getBigUint64(8));
      headerSize = 16;
    } else if (size === 0) {
      size = file.size - off; // box extends to end of file
    }
    if (size < headerSize || off + size > file.size) {
      throw new Error(`invalid box ${type}`);
    }
    boxes.push({ type, start: off, size });
    off += size;
  }
  return boxes;
}

/** Add `delta` to every chunk offset (stco/co64) nested inside the moov buffer. */
function patchMoovOffsets(moov: ArrayBuffer, delta: number): void {
  const view = new DataView(moov);

  function walk(start: number, end: number): void {
    let off = start;
    while (off + 8 <= end) {
      let size: number = view.getUint32(off);
      const type = String.fromCharCode(
        view.getUint8(off + 4),
        view.getUint8(off + 5),
        view.getUint8(off + 6),
        view.getUint8(off + 7)
      );
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(off + 8));
        header = 16;
      } else if (size === 0) {
        size = end - off;
      }
      if (size < header || off + size > end) throw new Error(`bad box ${type}`);

      if (type === "stco") {
        // full box: 4 bytes version/flags, 4 bytes entry count, then u32 offsets
        const count = view.getUint32(off + header + 4);
        let p = off + header + 8;
        if (p + count * 4 > off + size) throw new Error("stco out of range");
        for (let i = 0; i < count; i++, p += 4) {
          const patched = view.getUint32(p) + delta;
          if (patched > 0xffffffff) throw new Error("stco overflow");
          view.setUint32(p, patched);
        }
      } else if (type === "co64") {
        const count = view.getUint32(off + header + 4);
        let p = off + header + 8;
        if (p + count * 8 > off + size) throw new Error("co64 out of range");
        for (let i = 0; i < count; i++, p += 8) {
          view.setBigUint64(p, view.getBigUint64(p) + BigInt(delta));
        }
      } else if (MOOV_CONTAINERS.has(type)) {
        walk(off + header, off + size);
      }
      off += size;
    }
  }

  // Skip moov's own header, then walk its children.
  let header = 8;
  if (view.getUint32(0) === 1) header = 16;
  walk(header, moov.byteLength);
}

export interface FastStartResult {
  blob: Blob;
  /** true when the file was restructured for streaming */
  changed: boolean;
}

export async function ensureFastStart(file: File): Promise<FastStartResult> {
  try {
    const looksLikeMp4 =
      /\.(mp4|m4v|mov)$/i.test(file.name) ||
      /mp4|quicktime/i.test(file.type || "");
    if (!looksLikeMp4 || file.size < 1024) return { blob: file, changed: false };

    const boxes = await readTopBoxes(file);
    const moovIdx = boxes.findIndex((b) => b.type === "moov");
    const mdatIdx = boxes.findIndex((b) => b.type === "mdat");
    if (boxes[0]?.type !== "ftyp" || moovIdx < 0 || mdatIdx < 0) {
      return { blob: file, changed: false };
    }
    // Already streamable — nothing to do.
    if (moovIdx < mdatIdx) return { blob: file, changed: false };
    // Simple, safe case only: moov is the LAST top-level box (the layout every
    // screen recorder / phone produces). Anything exotic → upload unchanged.
    if (moovIdx !== boxes.length - 1) return { blob: file, changed: false };

    const moovBox = boxes[moovIdx];
    if (moovBox.size > 128 * 1024 * 1024) return { blob: file, changed: false };

    const moovBuf = await file
      .slice(moovBox.start, moovBox.start + moovBox.size)
      .arrayBuffer();

    // Moving moov to just after ftyp shifts everything between ftyp and moov
    // forward by exactly moov's size — including all mdat chunk data.
    patchMoovOffsets(moovBuf, moovBox.size);

    const ftyp = boxes[0];
    const blob = new Blob(
      [
        file.slice(0, ftyp.start + ftyp.size), // ftyp
        moovBuf, // patched moov (now up front)
        file.slice(ftyp.start + ftyp.size, moovBox.start), // free/uuid/mdat…
      ],
      { type: file.type || "video/mp4" }
    );
    if (blob.size !== file.size) return { blob: file, changed: false };
    return { blob, changed: true };
  } catch {
    return { blob: file, changed: false };
  }
}
