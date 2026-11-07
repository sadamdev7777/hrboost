#!/usr/bin/env python3
"""Tukar fail ujian psql (supabase/tests/*.sql) kepada satu blok DO untuk Supabase SEBENAR.

Fail ujian asal bergantung pada stub local_only (test.uid / test.role). Supabase sebenar
membaca pengguna daripada `request.jwt.claims`, jadi penukar ini:
  * menukar `set test.uid` / `set test.role` kepada set_config('request.jwt.claims', ...)
  * menangkap hasil setiap SELECT ke dalam satu tatasusunan JSON
  * membalut pernyataan dalam blok `\\set ON_ERROR_STOP 0` (ujian "mesti gagal") supaya
    ralat ditangkap dan direkod, bukan menghentikan ujian
  * menamatkan blok dengan RAISE EXCEPTION yang membawa hasil JSON. Ini memaksa
    ROLLBACK penuh: tiada data ujian tertinggal dalam pangkalan data.

Stub local_only TIDAK digunakan dan tidak dijalankan.

Guna: python3 tests_to_supabase.py supabase/tests/<fail>.sql > keluaran.sql
"""
import re
import sys

GSET_TYPES = {"tok": "text", "cid": "uuid"}
SHORT = False  # --short: label nombor sahaja (keluaran lebih kecil)


def strip_comment(line: str) -> str:
    out, q = [], False
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "'":
            q = not q
        if not q and line.startswith("--", i):
            break
        out.append(ch)
        i += 1
    return "".join(out)


def split_statements(text: str):
    stmts, buf, q = [], [], False
    for ch in text:
        if ch == "'":
            q = not q
        if ch == ";" and not q:
            s = "".join(buf).strip()
            if s:
                stmts.append(s)
            buf = []
        else:
            buf.append(ch)
    rest = "".join(buf).strip()
    return stmts, rest


def lit(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def convert(path: str) -> str:
    lines = open(path, encoding="utf-8").read().split("\n")
    body = []
    state = {"uid": "", "role": ""}
    expect_error = False
    label = ""
    seq = 0
    gset_vars = {}
    pending = ""

    def claims_stmt():
        role = state["role"] or "authenticated"
        claims = {"role": role}
        parts = [f"'role', {lit(role)}"]
        if state["uid"]:
            parts.append(f"'sub', {lit(state['uid'])}")
        return f"perform set_config('request.jwt.claims', jsonb_build_object({', '.join(parts)})::text, true);"

    def subst(s: str) -> str:
        def rep(m):
            name = m.group(1)
            return f"v_{name}"
        return re.sub(r":'(\w+)'", rep, s)

    def emit(stmt: str, gset: str | None = None):
        nonlocal seq
        stmt = subst(stmt.strip())
        # auth.users sebenar ada banyak lajur (instance_id dahulu); stub hanya ada id.
        stmt = re.sub(r"^insert into auth\.users select", "insert into auth.users(id) select", stmt, flags=re.I)
        low = stmt.lower()
        m = re.match(r"set\s+test\.(uid|role)\s*=\s*'([^']*)'$", stmt, re.I)
        if m:
            state[m.group(1).lower()] = m.group(2)
            body.append(claims_stmt())
            return
        if re.match(r"set\s+role\s+authenticated$", low):
            body.append("execute 'set role authenticated';")
            return
        if low == "reset role":
            body.append("execute 'reset role';")
            return
        seq += 1
        tag = lit(f"{seq:03d}" if SHORT else f"{seq:03d} {label}".strip())
        if gset:
            # select <expr> as <name>  ->  v_name := (select <expr>)
            expr = re.sub(r"\s+as\s+" + gset + r"\s*$", "", stmt, flags=re.I)
            core = f"v_{gset} := ({expr});"
        elif low.startswith("select"):
            core = (f"_r := _r || jsonb_build_array(jsonb_build_object('n', {tag}, 'r', "
                    f"(select coalesce(jsonb_agg(to_jsonb(_t)), '[]'::jsonb) from ({stmt}) _t)));")
        else:
            core = f"{stmt};"
        if expect_error:
            body.append("begin\n  " + core + "\nexception when others then\n  "
                        f"_r := _r || jsonb_build_array(jsonb_build_object('n', {tag}, 'error', sqlerrm));\nend;")
        else:
            body.append(core)

    for raw in lines:
        line = raw.rstrip()
        s = line.strip()
        if s.startswith("\\"):
            if s.startswith("\\set ON_ERROR_STOP"):
                expect_error = s.endswith("0")
            elif s.startswith("\\echo"):
                label = s[len("\\echo"):].strip().strip("'").strip("=- ").strip()
            continue
        code = strip_comment(line)
        gm = re.search(r"\\gset\s*$", code)
        if gm:
            pending += "\n" + code[: gm.start()]
            stmts, rest = split_statements(pending)
            for st in stmts:
                emit(st)
            name = re.search(r"as\s+(\w+)\s*$", rest, re.I).group(1)
            gset_vars[name] = GSET_TYPES.get(name, "text")
            emit(rest, gset=name)
            pending = ""
            continue
        pending += "\n" + code
        stmts, rest = split_statements(pending)
        for st in stmts:
            emit(st)
        pending = rest
    assert not pending.strip(), f"baki tidak lengkap: {pending!r}"

    decl = "".join(f"  v_{n} {t};\n" for n, t in gset_vars.items())
    return (
        "do $hrboost_test$\n"
        "declare\n  _r jsonb := '[]'::jsonb;\n" + decl +
        "begin\n" + claims_stmt_default() + "\n" +
        "\n".join(body) +
        "\n  execute 'reset role';\n"
        "  raise exception 'HRBOOST_TEST_RESULT:%', _r::text;\n"
        "end\n$hrboost_test$;\n"
    )


def claims_stmt_default() -> str:
    return "perform set_config('request.jwt.claims', jsonb_build_object('role','authenticated')::text, true);"


if __name__ == "__main__":
    SHORT = "--short" in sys.argv
    sys.stdout.write(convert([a for a in sys.argv[1:] if not a.startswith("--")][0]))
