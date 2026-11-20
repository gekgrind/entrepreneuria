"""Artifact archive checks for entrepreneuria-promote.

Installed root-owned at /usr/local/lib/entrepreneuria/archive_tool.py and run
with `python3 -I -S` (isolated: no user site, no environment, no cwd imports).

  check   <archive>            root, READ-ONLY: validate every member before anything is extracted
  extract <dest>               UNPRIVILEGED stage user: extract the archive read from stdin into <dest>
  compare <archive> <tree>     root, READ-ONLY: the copied tree must equal the archive exactly

Exit status 0 = OK; anything else = reject (reason on stderr).
"""
import hashlib
import os
import posixpath
import stat
import sys
import tarfile

MAX_MEMBERS = 400_000
MAX_TOTAL_BYTES = 6 * 1024 ** 3
# Paths the promoter creates itself; an artifact must never supply them.
RESERVED = ("RELEASE", ".next/cache", ".git")


def fail(msg):
    print(f"archive rejected: {msg}", file=sys.stderr)
    sys.exit(3)


def norm(name):
    """Normalise a member name; reject anything that is not a plain relative path."""
    if not name or "\x00" in name or any(ord(c) < 0x20 for c in name):
        fail(f"bad member name {name!r}")
    if name.startswith("/"):
        fail(f"absolute path {name!r}")
    parts = [p for p in name.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        fail(f"parent traversal {name!r}")
    return "/".join(parts)  # "" is the archive root


def is_reserved(path):
    return any(path == r or path.startswith(r + "/") for r in RESERVED)


def load_members(archive):
    try:
        tf = tarfile.open(archive, mode="r:gz")
        members = tf.getmembers()
    except (tarfile.TarError, OSError, EOFError) as exc:
        fail(f"unreadable archive: {exc}")
    if len(members) > MAX_MEMBERS:
        fail("too many members")
    return tf, members


def build_index(members):
    """name -> member, after validating names, types, modes and duplicates."""
    index, total = {}, 0
    for m in members:
        path = norm(m.name)
        if path == "":
            if not m.isdir():
                fail("archive root is not a directory")
            continue
        if path in index:
            fail(f"duplicate member {path!r}")
        if is_reserved(path):
            fail(f"reserved path {path!r}")
        if not (m.isreg() or m.isdir() or m.issym()):
            kind = "hard link" if m.islnk() else f"type {m.type!r}"
            fail(f"disallowed member {path!r} ({kind})")
        # Symlink permission bits are meaningless on Linux (always 0777 in tar); check files and dirs.
        if not m.issym():
            if m.mode & 0o7000:
                fail(f"setuid/setgid/sticky bit on {path!r}")
            if m.mode & 0o022:
                fail(f"group/world-writable mode on {path!r}")
        if m.pax_headers and any(k not in ("path", "linkpath", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname") for k in m.pax_headers):
            fail(f"unexpected pax header on {path!r}: {sorted(m.pax_headers)}")
        total += m.size
        if total > MAX_TOTAL_BYTES:
            fail("archive too large")
        index[path] = m
    return index


def resolve(index, path, depth=0):
    """Resolve `path` inside the virtual tree, following symlink members.
    Returns the resolved relative path or fails if it leaves the root."""
    if depth > 40:
        fail(f"symlink loop near {path!r}")
    out = []
    parts = [p for p in path.split("/") if p not in ("", ".")]
    for i, part in enumerate(parts):
        if part == "..":
            if not out:
                fail(f"symlink escapes the release via {path!r}")
            out.pop()
            continue
        out.append(part)
        cur = "/".join(out)
        m = index.get(cur)
        if m is not None and m.issym():
            target = m.linkname
            if target.startswith("/"):
                fail(f"absolute symlink {cur!r} -> {target!r}")
            joined = posixpath.join(posixpath.dirname(cur), target)
            out = [p for p in resolve(index, joined, depth + 1).split("/") if p]
    return "/".join(out)


def check(archive):
    tf, members = load_members(archive)
    index = build_index(members)
    for path, m in index.items():
        # No member may be written through a symlinked parent directory.
        parent = posixpath.dirname(path)
        while parent:
            pm = index.get(parent)
            if pm is not None and pm.issym():
                fail(f"member {path!r} lies under symlink {parent!r}")
            parent = posixpath.dirname(parent)
        if m.issym():
            if m.linkname.startswith("/"):
                fail(f"absolute symlink {path!r} -> {m.linkname!r}")
            target = resolve(index, posixpath.join(posixpath.dirname(path), m.linkname))
            if is_reserved(target):
                fail(f"symlink {path!r} points into reserved path {target!r}")
    tf.close()
    print(f"ok members={len(index)}")


def extract(dest):
    if os.geteuid() == 0:
        fail("extract must not run as root")
    st = os.lstat(dest)
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != os.geteuid() or os.listdir(dest):
        fail("destination must be an empty directory owned by the stage user")
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz") as tf:
        # 'data' filter: refuses absolute/outside paths, links outside, special files;
        # strips setuid and group/world-write bits. Defence in depth after `check`.
        tf.extractall(dest, filter="data")
    print("ok extracted")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb", opener=lambda p, f: os.open(p, f | os.O_NOFOLLOW)) as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def compare(archive, tree):
    tf, members = load_members(archive)
    index = build_index(members)
    seen = set()
    for dirpath, dirnames, filenames in os.walk(tree, followlinks=False):
        for name in dirnames + filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, tree).replace(os.sep, "/")
            seen.add(rel)
            m = index.get(rel)
            if m is None:
                fail(f"unexpected path in copied tree: {rel!r}")
            st = os.lstat(full)
            if st.st_uid != 0 or st.st_gid != 0:
                fail(f"not root-owned: {rel!r}")
            if m.isdir():
                if not stat.S_ISDIR(st.st_mode):
                    fail(f"type changed: {rel!r}")
            elif m.issym():
                if not stat.S_ISLNK(st.st_mode) or os.readlink(full) != m.linkname:
                    fail(f"symlink changed: {rel!r}")
            else:
                if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
                    fail(f"not a single-link regular file: {rel!r}")
                if bool(st.st_mode & 0o111) != bool(m.mode & 0o111):
                    fail(f"executable bit changed: {rel!r}")
                f = tf.extractfile(m)
                h = hashlib.sha256()
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
                if h.hexdigest() != sha256_file(full):
                    fail(f"content differs from the approved archive: {rel!r}")
    missing = set(index) - seen
    if missing:
        fail(f"{len(missing)} archive member(s) missing from the copied tree, e.g. {sorted(missing)[0]!r}")
    tf.close()
    print(f"ok compared={len(seen)}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "check":
        check(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == "extract":
        extract(sys.argv[2])
    elif len(sys.argv) == 4 and sys.argv[1] == "compare":
        compare(sys.argv[2], sys.argv[3])
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
