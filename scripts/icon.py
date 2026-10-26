"""Writes assets/mado.png: Mado's 1024 x 1024 icon (a window of four panes), with no dependencies.

Usage: python3 -I scripts/icon.py
"""

import pathlib
import struct
import zlib

SIZE = 1024
RADIUS = 228
BACKGROUND = (24, 24, 27)
PANE = (250, 250, 250)


def inside_rounded(x, y, left, top, right, bottom, radius):
    if not (left <= x < right and top <= y < bottom):
        return False
    cx = min(max(x, left + radius), right - radius - 1)
    cy = min(max(y, top + radius), bottom - radius - 1)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius


def pixel(x, y):
    if not inside_rounded(x, y, 0, 0, SIZE, SIZE, RADIUS):
        return (0, 0, 0, 0)
    frame, gap, pane_radius = 252, 36, 40
    span = (SIZE - 2 * frame - gap) // 2
    for row in range(2):
        for column in range(2):
            left = frame + column * (span + gap)
            top = frame + row * (span + gap)
            if inside_rounded(x, y, left, top, left + span, top + span, pane_radius):
                return (*PANE, 255)
    return (*BACKGROUND, 255)


def main():
    rows = b"".join(b"\0" + bytes(c for x in range(SIZE) for c in pixel(x, y)) for y in range(SIZE))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    out = pathlib.Path(__file__).resolve().parent.parent / "assets" / "mado.png"
    out.write_bytes(png)
    print(out)


if __name__ == "__main__":
    main()
