"""Artifact archive and release-tree checks for entrepreneuria-promote.

Installed root-owned at /usr/local/lib/entrepreneuria/archive_tool.py and run
with `python3 -I -S` (isolated: no user site, no environment, no cwd imports).

  read    <artifact> <max-bytes>        BUILD user: stream its own artifact to stdout
                                        (O_NOFOLLOW, regular file only, bounded size)
  check   <archive>                     root, READ-ONLY: validate every member before anything is extracted
  extract <dest>                        UNPRIVILEGED stage user: extract the archive read from stdin into <dest>
  compare <archive> <tree>              root, READ-ONLY: the copied tree must equal the archive exactly
  policy  <tree> <cache-target>         root, READ-ONLY: final release-tree symlink/ownership policy

Exit status 0 = OK; anything else = reject (reason on stderr).
"""
import hashlib
import os
import posixpath
import stat
import sys
import tarfile

MAX_MEMBERS = 300_000
MAX_TOTAL_BYTES = 6 * 1024 ** 3
# Paths the promoter creates itself; an artifact must never supply them, and no
# archive symlink may resolve INTO or THROUGH them.
RESERVED = ("RELEASE", ".next/cache", ".git")
# The one promoter-created link that may leave the immutable release.
CACHE_LINK = ".next/cache"
PAX_ALLOWED = {"path", "linkpath", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname"}


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


def read_artifact(path, max_bytes):
    """Runs as the BUILD user: root never opens the build-controlled path."""
    if os.geteuid() == 0:
        fail("read must run as the build user, not root")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_NOCTTY)
    except OSError as exc:
        fail(f"cannot open artifact without following links: {exc}")
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode):
        fail("artifact is not a regular file")
    if st.st_size > max_bytes:
        fail("artifact exceeds the size limit")
    out, total = sys.stdout.buffer, 0
    while True:
        chunk = os.read(fd, 1 << 20)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            fail("artifact grew beyond the size limit while reading")
        out.write(chunk)
    out.flush()


def load_index(archive):
    """Open the archive and index it incrementally, enforcing limits as members are
    read (never loading an unbounded member list first)."""
    try:
        tf = tarfile.open(archive, mode="r:gz")
    except (tarfile.TarError, OSError, EOFError) as exc:
        fail(f"unreadable archive: {exc}")
    index, total, count, roots = {}, 0, 0, 0
    try:
        while True:
            m = tf.next()
            if m is None:
                break
            count += 1
            if count > MAX_MEMBERS:
                fail(f"too many members (limit {MAX_MEMBERS})")
            if m.issparse() or any(k.startswith("GNU.sparse") for k in (m.pax_headers or {})):
                fail(f"sparse member {m.name!r} is not supported")
            if m.pax_headers and set(m.pax_headers) - PAX_ALLOWED:
                fail(f"unexpected pax header on {m.name!r}: {sorted(set(m.pax_headers) - PAX_ALLOWED)}")
            path = norm(m.name)
            if path == "":
                roots += 1
                if roots > 1:
                    fail("duplicate archive root entry")
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
            # Symlink permission bits are meaningless on Linux (always 0777 in tar).
            if not m.issym():
                if m.mode & 0o7000:
                    fail(f"setuid/setgid/sticky bit on {path!r}")
                if m.mode & 0o022:
                    fail(f"group/world-writable mode on {path!r}")
            total += m.size
            if total > MAX_TOTAL_BYTES:
                fail("archive too large")
            index[path] = m
    except (tarfile.TarError, OSError, EOFError) as exc:
        fail(f"unreadable archive: {exc}")
    return tf, index


def resolve(lookup, path, what, depth=0):
    """Resolve `path` (relative to the release root) component by component.
    `lookup(rel)` returns the symlink target text if rel is a symlink, else None.
    Fails if resolution leaves the root, uses an absolute target, or passes
    through ANY reserved component (including the runtime cache link), even if
    the final destination would look internal."""
    if depth > 40:
        fail(f"symlink loop near {path!r}")
    out = []
    for part in [p for p in path.split("/") if p not in ("", ".")]:
        if part == "..":
            if not out:
                fail(f"symlink {what!r} escapes the release")
            out.pop()
            continue
        out.append(part)
        cur = "/".join(out)
        if is_reserved(cur):
            fail(f"symlink {what!r} traverses reserved path {cur!r}")
        target = lookup(cur)
        if target is not None:
            if target.startswith("/"):
                fail(f"symlink {what!r} resolves through absolute link {cur!r} -> {target!r}")
            joined = posixpath.join(posixpath.dirname(cur), target)
            out = [p for p in resolve(lookup, joined, what, depth + 1).split("/") if p]
    return "/".join(out)


def check(archive):
    tf, index = load_index(archive)
    lookup = lambda rel: index[rel].linkname if rel in index and index[rel].issym() else None
    for path, m in index.items():
        parent = posixpath.dirname(path)
        while parent:
            pm = index.get(parent)
            if pm is not None and pm.issym():
                fail(f"member {path!r} lies under symlink {parent!r}")
            parent = posixpath.dirname(parent)
        if m.issym():
            if m.linkname.startswith("/"):
                fail(f"absolute symlink {path!r} -> {m.linkname!r}")
            resolve(lookup, posixpath.join(posixpath.dirname(path), m.linkname), path)
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
    tf, index = load_index(archive)
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


def policy(tree, cache_target):
    """Final symlink and ownership policy for a release tree, evaluated on the real
    filesystem AFTER the promoter attached .next/cache. The cache link (exact target)
    is the only link allowed to leave the release; every other link must resolve
    inside the release without traversing the cache link or any reserved path."""
    tree = tree.rstrip("/")
    st = os.lstat(tree)
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0:
        fail("release root is not a root-owned directory")

    def lookup(rel):
        p = os.path.join(tree, rel)
        try:
            return os.readlink(p) if stat.S_ISLNK(os.lstat(p).st_mode) else None
        except FileNotFoundError:
            return None

    links = 0
    for dirpath, dirnames, filenames in os.walk(tree, followlinks=False):
        for name in dirnames + filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, tree).replace(os.sep, "/")
            st = os.lstat(full)
            if st.st_uid != 0 or st.st_gid != 0:
                fail(f"not root-owned: {rel!r}")
            if stat.S_ISLNK(st.st_mode):
                target = os.readlink(full)
                if rel == CACHE_LINK:
                    if target != cache_target:
                        fail(f"{CACHE_LINK} -> {target!r}, expected {cache_target!r}")
                    continue
                if target.startswith("/"):
                    fail(f"absolute symlink {rel!r} -> {target!r}")
                resolve(lookup, posixpath.join(posixpath.dirname(rel), target), rel)
                links += 1
            elif stat.S_ISDIR(st.st_mode):
                if st.st_mode & 0o7022:
                    fail(f"unsafe directory mode on {rel!r}")
            elif stat.S_ISREG(st.st_mode):
                if st.st_nlink != 1:
                    fail(f"hard-linked file {rel!r}")
                if st.st_mode & 0o7022:
                    fail(f"unsafe file mode on {rel!r}")
            else:
                fail(f"disallowed file type at {rel!r}")
    cache = os.path.join(tree, CACHE_LINK)
    if not (os.path.lexists(cache) and stat.S_ISLNK(os.lstat(cache).st_mode)):
        fail(f"{CACHE_LINK} link missing")
    print(f"ok policy links={links}")


if __name__ == "__main__":
    a = sys.argv
    if len(a) == 4 and a[1] == "read" and a[3].isdigit():
        read_artifact(a[2], int(a[3]))
    elif len(a) == 3 and a[1] == "check":
        check(a[2])
    elif len(a) == 3 and a[1] == "extract":
        extract(a[2])
    elif len(a) == 4 and a[1] == "compare":
        compare(a[2], a[3])
    elif len(a) == 4 and a[1] == "policy":
        policy(a[2], a[3])
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
