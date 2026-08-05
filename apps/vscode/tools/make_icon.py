"""Generate the Marketplace icon (media/activity-bar.png) from activity-bar.svg.

Pure stdlib PNG writer (no PIL needed). The SVG uses stroke=currentColor with no
fill, so we rasterize the geometry at 128x128 on a transparent background with
white strokes, matching the VS Code activity-bar convention.
"""
import struct
import zlib

W = H = 128
# Scale factor from the 24x24 viewBox to 128x128.
S = W / 24.0


def px(x: float, y: float) -> tuple[int, int]:
    return int(round(x * S)), int(round(y * S))


def draw_line(buf, x0, y0, x1, y1, color=(255, 255, 255, 255)):
    # Bresenham with a 2px-wide stroke for visibility at small sizes.
    x0, y0, x1, y1 = int(round(x0 * S)), int(round(y0 * S)), int(round(x1 * S)), int(round(y1 * S))
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                nx, ny = x0 + ox, y0 + oy
                if 0 <= nx < W and 0 <= ny < H:
                    buf[ny][nx] = color
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def draw_rect(buf, x, y, w, h):
    x1, y1 = x + w, y + h
    draw_line(buf, x, y, x1, y)
    draw_line(buf, x1, y, x1, y1)
    draw_line(buf, x1, y1, x, y1)
    draw_line(buf, x, y1, x, y)


def draw_circle(buf, cx, cy, r, color=(255, 255, 255, 255)):
    cx, cy, r = cx * S, cy * S, r * S
    for yy in range(H):
        for xx in range(W):
            if abs(((xx - cx) ** 2 + (yy - cy) ** 2) ** 0.5 - r) <= 2:
                buf[yy][xx] = color


def main():
    buf = [[(0, 0, 0, 0) for _ in range(W)] for _ in range(H)]
    white = (255, 255, 255, 255)
    draw_rect(buf, 2.5, 9, 6, 6)
    draw_rect(buf, 15.5, 9, 6, 6)
    draw_line(buf, 8.5, 12, 15.5, 12)
    draw_line(buf, 12, 12, 12, 18.5)
    draw_circle(buf, 12, 20.5, 1.4)
    draw_line(buf, 5.5, 9, 5.5, 4.5)
    draw_line(buf, 5.5, 4.5, 18.5, 4.5)
    draw_line(buf, 18.5, 4.5, 18.5, 9)

    raw = bytearray()
    for y in range(H):
        raw.append(0)  # filter type 0
        for x in range(W):
            r, g, b, a = buf[y][x]
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open("media/activity-bar.png", "wb") as f:
        f.write(png)
    print("wrote media/activity-bar.png")


if __name__ == "__main__":
    main()
