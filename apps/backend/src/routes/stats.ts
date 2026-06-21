import { Router } from "express";
import { GameEventModel } from "../models/GameEvent.js";
import { UserModel } from "../models/User.js";

// Analytics dashboard data. Protected by a shared secret: set STATS_KEY in the
// environment and pass it as ?key=... (kept simple — this is owner-only data,
// not a public endpoint). If STATS_KEY is unset, access is allowed (dev only).
export function buildStatsRouter(): Router {
  const router = Router();
  const STATS_KEY = process.env.STATS_KEY;

  router.get("/", async (req, res) => {
    if (STATS_KEY && req.query.key !== STATS_KEY) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const since = (() => {
      const days = Number(req.query.days);
      if (!Number.isFinite(days) || days <= 0) return null;
      return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    })();
    const match = since ? { createdAt: { $gte: since } } : {};

    const [
      totalUsers,
      lobbies,
      duelsStarted,
      duelsFinished,
      distinctDuelPlayers,
      factionPicks,
      factionWins,
      durationAgg
    ] = await Promise.all([
      UserModel.countDocuments(since ? { createdAt: { $gte: since } } : {}),
      GameEventModel.countDocuments({ ...match, type: "lobby_created" }),
      GameEventModel.countDocuments({ ...match, type: "duel_started" }),
      GameEventModel.countDocuments({ ...match, type: "duel_finished" }),
      // Distinct players who actually started a duel (engagement reach).
      GameEventModel.distinct("userId", { ...match, type: "duel_started" }),
      // Faction pick rate: unwind the factions array on duel_started.
      GameEventModel.aggregate([
        { $match: { ...match, type: "duel_started" } },
        { $unwind: "$factions" },
        { $group: { _id: "$factions", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      // Faction win rate: winnerFaction on duel_finished.
      GameEventModel.aggregate([
        { $match: { ...match, type: "duel_finished", winnerFaction: { $ne: null } } },
        { $group: { _id: "$winnerFaction", wins: { $sum: 1 } } },
        { $sort: { wins: -1 } }
      ]),
      // Average duel length + duration.
      GameEventModel.aggregate([
        { $match: { ...match, type: "duel_finished" } },
        {
          $group: {
            _id: null,
            avgTurns: { $avg: "$turnCount" },
            avgDurationMs: { $avg: "$durationMs" }
          }
        }
      ])
    ]);

    // Retention proxy: how many distinct players have started >1 duel.
    const repeat = await GameEventModel.aggregate([
      { $match: { ...match, type: "duel_started", userId: { $ne: null } } },
      { $group: { _id: "$userId", duels: { $sum: 1 } } },
      { $group: { _id: null, total: { $sum: 1 }, returning: { $sum: { $cond: [{ $gt: ["$duels", 1] }, 1, 0] } } } }
    ]);
    const retention = repeat[0] ?? { total: 0, returning: 0 };

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
    const dur = durationAgg[0] ?? { avgTurns: null, avgDurationMs: null };

    res.json({
      window: since ? `${req.query.days} days` : "all time",
      funnel: {
        signups: totalUsers,
        lobbiesCreated: lobbies,
        duelsStarted,
        duelsFinished,
        signupToDuelPct: pct(duelsStarted, totalUsers),
        startToFinishPct: pct(duelsFinished, duelsStarted)
      },
      engagement: {
        distinctPlayers: distinctDuelPlayers.length,
        returningPlayers: retention.returning,
        returningPct: pct(retention.returning, retention.total),
        avgTurnsPerDuel: dur.avgTurns ? Math.round(dur.avgTurns * 10) / 10 : null,
        avgDurationMin: dur.avgDurationMs ? Math.round((dur.avgDurationMs / 60000) * 10) / 10 : null
      },
      balance: {
        factionPicks: factionPicks.map((f) => ({ faction: f._id, picks: f.count })),
        factionWins: factionWins.map((f) => ({ faction: f._id, wins: f.wins }))
      }
    });
  });

  return router;
}
