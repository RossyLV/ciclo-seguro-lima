"""Genera los gráficos de la simulación Scrum a partir de docs/backlog.json (fuente única de datos)."""
import json, datetime as dt, sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

BASE = Path(__file__).parent
OUT = BASE / "img"
OUT.mkdir(exist_ok=True)
B = json.loads((BASE / "backlog.json").read_text(encoding="utf-8"))
ST = {s["id"]: s for s in B["stories"]}
EP = {e["id"]: e for e in B["epics"]}
D = lambda s: dt.date.fromisoformat(s)
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False, "font.family": "DejaVu Sans"})
C_IDEAL, C_REAL, C_GRID = "#8a94a6", "#1e7b4f", "#e6e9ef"
EP_COLOR = {"EP-1": "#2d6cdf", "EP-2": "#d9534f", "EP-3": "#e0a800", "EP-4": "#6f42c1", "EP-5": "#1e7b4f"}
WIP = {"In Progress": 3, "In Review": 2}


def flow(sprint):
    """Días (1-5) en que cada historia entra a In Progress, In Review y Done. Las no terminadas quedan en curso."""
    res = {}
    for sid in sprint["planned"]:
        done = sprint["done_by_day"].get(sid)
        if done:
            res[sid] = {"start": max(1, done - (3 if ST[sid]["points"] >= 5 else 2)), "review": max(1, done - 1), "done": done}
        else:
            res[sid] = {"start": 3, "review": 5, "done": None}
    return res


def status_at(f, day):
    """Estado al FINAL del día `day` (0 = antes de empezar)."""
    if f["done"] and day >= f["done"]:
        return "Done"
    if f["review"] and day >= f["review"]:
        return "In Review"
    if day >= f["start"]:
        return "In Progress"
    return "To Do"


# -------- validación de datos --------
total_done = 0
for s in B["sprints"]:
    planned = sum(ST[x]["points"] for x in s["planned"])
    done = sum(ST[x]["points"] for x in s["done_by_day"])
    s["planned_pts"], s["done_pts"] = planned, done
    total_done += done
    assert set(s["carried"]) == set(s["planned"]) - set(s["done_by_day"]), s["id"]
    fl = flow(s)
    for day in range(0, 6):
        cnt = {}
        for f in fl.values():
            st = status_at(f, day)
            cnt[st] = cnt.get(st, 0) + 1
        for col, lim in WIP.items():
            assert cnt.get(col, 0) <= lim, f"WIP excedido {s['id']} día {day} {col}={cnt.get(col)}"
backlog_total = sum(x["points"] for x in B["stories"])
print("Total SP backlog:", backlog_total, "| completados:", total_done, "| velocidades:", [s["done_pts"] for s in B["sprints"]])


# -------- 1. Burndown por sprint (ideal vs real) --------
fig, axes = plt.subplots(2, 2, figsize=(11, 7.2))
for ax, s in zip(axes.flat, B["sprints"]):
    days = list(range(0, 6))
    start = D(s["start"])
    labels = ["Inicio"] + [(start + dt.timedelta(days=d - 1)).strftime("%a %d/%m").replace("Mon", "Lun").replace("Tue", "Mar").replace("Wed", "Mié").replace("Thu", "Jue").replace("Fri", "Vie") for d in range(1, 6)]
    ideal = [s["planned_pts"] * (1 - d / 5) for d in days]
    real = [s["planned_pts"] - sum(ST[x]["points"] for x, dd in s["done_by_day"].items() if dd <= d) for d in days]
    ax.plot(days, ideal, "--", color=C_IDEAL, label="Ideal", lw=1.8)
    ax.plot(days, real, "-o", color=C_REAL, label="Real", lw=2.2, ms=5)
    for d, r in zip(days, real):
        ax.annotate(str(r), (d, r), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=8.5, color=C_REAL)
    ax.set_xticks(days, labels, fontsize=8)
    ax.set_ylim(0, max(s["planned_pts"] for s in B["sprints"]) + 4)
    ax.grid(axis="y", color=C_GRID)
    ax.set_ylabel("Story points pendientes")
    extra = f" · arrastra {', '.join(s['carried'])}" if s["carried"] else ""
    ax.set_title(f"{s['name']} — comprometido {s['planned_pts']} SP, velocidad {s['done_pts']} SP{extra}", fontsize=9.5, loc="left")
    ax.legend(fontsize=8, frameon=False)
fig.suptitle("Burndown por sprint (ideal vs. real) — CicloSeguro Lima", fontsize=13, weight="bold")
fig.tight_layout()
fig.savefig(OUT / "burndown_sprints.png", dpi=160)
plt.close(fig)


# -------- 2. Burndown del release + velocidad --------
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
committed_scope = total_done
xs = list(range(0, 5))
ideal = [committed_scope * (1 - i / 4) for i in xs]
real = [committed_scope]
for s in B["sprints"]:
    real.append(real[-1] - s["done_pts"])
a1.plot(xs, ideal, "--", color=C_IDEAL, label="Ideal")
a1.plot(xs, real, "-o", color=C_REAL, label="Real", lw=2.2)
for x, r in zip(xs, real):
    a1.annotate(str(r), (x, r), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=9, color=C_REAL)
a1.set_xticks(xs, ["Inicio", "S1", "S2", "S3", "S4"])
a1.set_ylabel("Story points pendientes del release")
a1.set_title(f"Burndown del release 1.0 ({committed_scope} SP)", loc="left")
a1.grid(axis="y", color=C_GRID)
a1.legend(frameon=False)
names = [s["id"] for s in B["sprints"]]
pl = [s["planned_pts"] for s in B["sprints"]]
dn = [s["done_pts"] for s in B["sprints"]]
w = 0.38
a2.bar([i - w / 2 for i in range(4)], pl, w, color="#c9d3e3", label="Comprometido")
a2.bar([i + w / 2 for i in range(4)], dn, w, color=C_REAL, label="Completado (velocidad)")
for i in range(4):
    a2.text(i - w / 2, pl[i] + 0.4, str(pl[i]), ha="center", fontsize=9)
    a2.text(i + w / 2, dn[i] + 0.4, str(dn[i]), ha="center", fontsize=9, color=C_REAL, weight="bold")
avg = sum(dn) / 4
a2.axhline(avg, color="#555", ls=":", lw=1.2)
a2.text(3.45, avg + 0.4, f"Promedio {avg:.1f} SP", ha="right", fontsize=8.5, color="#555")
a2.set_xticks(range(4), names)
a2.set_ylim(0, 26)
a2.set_title("Velocidad por sprint", loc="left")
a2.legend(frameon=False, fontsize=8, loc="upper left")
fig.tight_layout()
fig.savefig(OUT / "burndown_release_velocidad.png", dpi=160)
plt.close(fig)


# -------- 3. Diagrama de Gantt --------
DEPS = [("US-18", "US-20"), ("US-15", "US-17"), ("US-01", "US-02"), ("US-02", "US-03"),
        ("US-01", "US-05"), ("US-17", "US-06"), ("US-06", "US-07"), ("US-02", "US-08"), ("US-07", "US-08"),
        ("US-07", "US-09"), ("US-11", "US-13"), ("US-12", "US-13"), ("US-07", "US-19")]
rows = []  # (label, start, end, color, kind)
day0 = {s["id"]: D(s["start"]) for s in B["sprints"]}
story_span = {}
for s in B["sprints"]:
    fl = flow(s)
    for sid, f in fl.items():
        if f["done"] is None:
            continue
        # si fue arrastrada, el inicio es el del sprint anterior
        st_date = day0[s["id"]] + dt.timedelta(days=f["start"] - 1)
        if sid in story_span:
            st_date = story_span[sid][0]
        story_span[sid] = (st_date, day0[s["id"]] + dt.timedelta(days=f["done"] - 1))
    for sid in s["carried"]:
        f = fl[sid]
        story_span[sid] = (day0[s["id"]] + dt.timedelta(days=f["start"] - 1), None)
order = []
for e in B["epics"]:
    sids = [x for x in story_span if ST[x]["epic"] == e["id"]]
    if not sids:
        continue
    sids.sort(key=lambda x: story_span[x][0])
    es, ee = min(story_span[x][0] for x in sids), max(story_span[x][1] for x in sids)
    order.append((f"{e['id']} {e['name']}", es, ee, EP_COLOR[e["id"]], "epic"))
    for x in sids:
        order.append((f"   {x} {ST[x]['title']}", story_span[x][0], story_span[x][1], EP_COLOR[e["id"]], "story"))
fig, ax = plt.subplots(figsize=(13, 9))
ypos = {}
for i, (lab, s0, s1, col, kind) in enumerate(order):
    y = len(order) - i
    ypos[lab.strip().split(" ")[0]] = y
    left = matplotlib.dates.date2num(s0)
    width = matplotlib.dates.date2num(s1) - left + 1
    if kind == "epic":
        ax.barh(y, width, left=left, height=0.5, color=col, alpha=0.95)
    else:
        ax.barh(y, width, left=left, height=0.6, color=col, alpha=0.45, edgecolor=col)
ax.set_yticks([len(order) - i for i in range(len(order))], [o[0] for o in order], fontsize=8.5)
for t, o in zip(ax.get_yticklabels(), order):
    if o[4] == "epic":
        t.set_fontweight("bold")
for a, b in DEPS:
    if a in ypos and b in ypos:
        xa = matplotlib.dates.date2num(story_span[a][1]) + 1
        xb = matplotlib.dates.date2num(story_span[b][0])
        ax.annotate("", xy=(xb, ypos[b]), xytext=(xa, ypos[a]),
                    arrowprops=dict(arrowstyle="->", color="#444", lw=0.8, connectionstyle="arc3,rad=0.15", alpha=0.7))
for s in B["sprints"]:
    x0 = matplotlib.dates.date2num(D(s["start"]))
    x1 = matplotlib.dates.date2num(D(s["end"])) + 1
    ax.axvspan(x0, x1, color="#f3f5f9" if int(s["id"][1]) % 2 else "#e9eef6", zorder=0)
    ax.text((x0 + x1) / 2, len(order) + 1.2, s["name"], ha="center", fontsize=9.5, weight="bold")
    ax.plot([x1], [len(order) + 0.6], marker="D", color="#c0392b", ms=8)
    ax.text(x1, len(order) + 0.15, "Review", ha="center", fontsize=7, color="#c0392b")
xr = matplotlib.dates.date2num(D(B["sprints"][-1]["end"])) + 1
ax.plot([xr], [0.3], marker="*", color="#c0392b", ms=16)
ax.text(xr - 0.3, 0.3, "Hito: Release 1.0 en producción (20/11)", ha="right", va="center", fontsize=8.5, color="#c0392b", weight="bold")
ax.xaxis_date()
ax.xaxis.set_major_formatter(matplotlib.dates.DateFormatter("%d/%m"))
ax.xaxis.set_major_locator(matplotlib.dates.DayLocator(interval=2))
ax.set_ylim(-0.5, len(order) + 1.8)
ax.grid(axis="x", color=C_GRID)
ax.set_title("Diagrama de Gantt — épicas, historias, dependencias (→) e hitos (◆ ★)", loc="left", fontsize=12, weight="bold")
fig.tight_layout()
fig.savefig(OUT / "gantt.png", dpi=160)
plt.close(fig)


# -------- 4. Tablero Kanban por sprint (foto a mitad de sprint, día 3) y diagrama de flujo acumulado --------
COLS = ["To Do", "In Progress", "In Review", "Done"]
COL_BG = {"To Do": "#eef1f5", "In Progress": "#e7f0ff", "In Review": "#fff4d6", "Done": "#e3f5ea"}
fig, axes = plt.subplots(4, 1, figsize=(12, 13))
SNAP_DAY = 3
for ax, s in zip(axes, B["sprints"]):
    fl = flow(s)
    ax.set_xlim(0, 4)
    ax.set_ylim(0, 4.6)
    ax.axis("off")
    for ci, col in enumerate(COLS):
        ax.add_patch(FancyBboxPatch((ci + 0.03, 0.05), 0.94, 4.0, boxstyle="round,pad=0.01", fc=COL_BG[col], ec="#cfd6e0"))
        lim = f"  (WIP ≤ {WIP[col]})" if col in WIP else ""
        ax.text(ci + 0.5, 3.8, col + lim, ha="center", weight="bold", fontsize=9.5)
        items = [sid for sid in s["planned"] if status_at(fl[sid], SNAP_DAY) == col]
        for k, sid in enumerate(items):
            y = 3.35 - k * 0.62
            ax.add_patch(FancyBboxPatch((ci + 0.08, y - 0.24), 0.84, 0.5, boxstyle="round,pad=0.01", fc="white", ec=EP_COLOR[ST[sid]["epic"]], lw=1.6))
            ax.text(ci + 0.12, y + 0.08, f"{sid} · {ST[sid]['points']} SP", fontsize=8, weight="bold", color=EP_COLOR[ST[sid]["epic"]])
            t = ST[sid]["title"]
            ax.text(ci + 0.12, y - 0.12, t if len(t) < 40 else t[:38] + "…", fontsize=7.2)
    day = D(s["start"]) + dt.timedelta(days=SNAP_DAY - 1)
    ax.text(0.03, 4.35, f"{s['name']} — tablero al cierre del día {SNAP_DAY} ({day.strftime('%d/%m')}) · Sprint goal: {s['goal'][:95]}…", fontsize=9, weight="bold")
fig.tight_layout()
fig.savefig(OUT / "kanban_sprints.png", dpi=150)
plt.close(fig)

fig, axes = plt.subplots(1, 4, figsize=(14, 3.4), sharey=True)
CF = {"Done": "#1e7b4f", "In Review": "#e0a800", "In Progress": "#2d6cdf", "To Do": "#c9d3e3"}
for ax, s in zip(axes, B["sprints"]):
    fl = flow(s)
    days = list(range(0, 6))
    stacks = {c: [sum(1 for f in fl.values() if status_at(f, d) == c) for d in days] for c in ["Done", "In Review", "In Progress", "To Do"]}
    ax.stackplot(days, *stacks.values(), labels=list(stacks), colors=list(CF.values()), alpha=0.9)
    ax.set_title(s["name"], fontsize=10)
    ax.set_xticks(days, ["0", "1", "2", "3", "4", "5"])
    ax.set_xlabel("Día del sprint")
axes[0].set_ylabel("N.º de historias")
axes[-1].legend(loc="upper left", bbox_to_anchor=(1, 1), frameon=False, fontsize=8)
fig.suptitle("Flujo acumulado del tablero Kanban por sprint (evidencia del avance To Do → Done)", fontsize=11, weight="bold")
fig.tight_layout()
fig.savefig(OUT / "flujo_acumulado.png", dpi=160)
plt.close(fig)

# tabla de flujo para el informe
flow_rows = []
for s in B["sprints"]:
    for sid, f in flow(s).items():
        d = lambda n: (D(s["start"]) + dt.timedelta(days=n - 1)).strftime("%d/%m") if n else "—"
        flow_rows.append([s["id"], sid, ST[sid]["points"], d(f["start"]), d(f["review"]), d(f["done"]) if f["done"] else "Arrastrada"])
(BASE / "flujo.json").write_text(json.dumps(flow_rows, ensure_ascii=False, indent=1), encoding="utf-8")
print("Gráficos generados en", OUT)
