import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { deleteJournalEntry, insertJournalEntry, listJournalEntries } from "./db";
import { generateJournalReply, getAiIntegrationStatus, mirrorEntryToFirestore, summarizeJournal, type JournalMode } from "./journalAi";

const chatTurn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(6000) });
const mode = z.enum(["journal", "brainstorm", "decide"]);

function parseTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  journal: router({
    status: protectedProcedure.query(() => getAiIntegrationStatus()),
    list: protectedProcedure.query(async ({ ctx }) => {
      const entries = await listJournalEntries(ctx.user.id);
      return entries.map(entry => ({ ...entry, tags: parseTags(entry.tags) }));
    }),
    create: protectedProcedure
      .input(z.object({
        prompt: z.string().trim().min(3, "Write a little more so the reflection has something to work with.").max(5000),
        mode,
        thread: z.array(chatTurn).max(8).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const modeValue = input.mode as JournalMode;
        const generated = await generateJournalReply(input.prompt, modeValue, input.thread);
        const reflection = await summarizeJournal(input.prompt, generated.text);
        const entry = await insertJournalEntry({
          ownerId: ctx.user.id,
          mode: modeValue,
          prompt: input.prompt,
          response: generated.text,
          summary: reflection.summary,
          mood: reflection.mood,
          energy: reflection.energy,
          tags: JSON.stringify(reflection.tags),
          provider: generated.provider,
        });
        if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The entry could not be saved." });
        void mirrorEntryToFirestore({
          id: entry.id,
          ownerOpenId: ctx.user.openId,
          prompt: entry.prompt,
          response: entry.response,
          summary: entry.summary,
          mood: entry.mood,
          energy: entry.energy,
          tags: reflection.tags,
          mode: entry.mode,
          createdAt: entry.createdAt,
        });
        return { entry: { ...entry, tags: reflection.tags }, response: generated.text, reflection, provider: generated.provider };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ success: await deleteJournalEntry(ctx.user.id, input.id) })),
    insights: protectedProcedure.query(async ({ ctx }) => {
      const entries = await listJournalEntries(ctx.user.id);
      const moodCounts = new Map<string, number>();
      const tagCounts = new Map<string, number>();
      let energyTotal = 0;
      const dayKeys = new Set<string>();
      for (const entry of entries) {
        moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1);
        energyTotal += entry.energy;
        dayKeys.add(new Date(entry.createdAt).toISOString().slice(0, 10));
        for (const tag of parseTags(entry.tags)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      const moods = Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
      const themes = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, count]) => ({ label, count }));
      return {
        total: entries.length,
        thisWeek: entries.filter(entry => Date.now() - new Date(entry.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length,
        avgEnergy: entries.length ? Math.round((energyTotal / entries.length) * 10) / 10 : 0,
        activeDays: dayKeys.size,
        moods,
        themes,
        headline: entries.length ? `Your recent notes lean ${moods[0]?.label ?? "curious"}.` : "Your first signal is waiting.",
        nudge: entries.length ? `You have returned ${dayKeys.size} day${dayKeys.size === 1 ? "" : "s"} recently. What deserves another gentle look?` : "A two-minute note is enough to start building a private pattern map.",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
