import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Feather,
  Gem,
  HeartPulse,
  Lightbulb,
  Loader2,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Moon,
  Orbit,
  PanelLeft,
  Plus,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Mode = "journal" | "brainstorm" | "decide";
type ThreadTurn = { role: "user" | "assistant"; content: string };

const modes: Array<{ id: Mode; label: string; description: string; icon: typeof Feather }> = [
  { id: "journal", label: "Reflect", description: "Slow down and notice", icon: Feather },
  { id: "brainstorm", label: "Explore", description: "Open up possibilities", icon: Lightbulb },
  { id: "decide", label: "Decide", description: "Find the next clear step", icon: Scale },
];

const moodColors: Record<string, string> = {
  calm: "#86a98f",
  curious: "#8b94c9",
  energized: "#df9c63",
  tender: "#c8879b",
  heavy: "#6d7896",
  focused: "#65a6ae",
};

function initials(name?: string | null) {
  return (name || "You").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LoadingScreen() {
  return <div className="min-h-screen grid place-items-center bg-[#f5f4ef] text-[#293331]"><div className="flex items-center gap-3 text-sm text-[#78817d]"><Loader2 className="h-4 w-4 animate-spin" />Preparing your private space</div></div>;
}

function SignInScreen() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f4ef] text-[#293331]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative flex flex-col justify-between overflow-hidden px-8 py-8 sm:px-14 lg:px-20 lg:py-12">
          <div className="absolute -left-32 -top-40 h-[500px] w-[500px] rounded-full bg-[#d9e2d5]/70 blur-3xl" />
          <div className="relative flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#293331] text-[#f1c89d]"><Orbit className="h-5 w-5" /></div><span className="font-display text-lg font-bold tracking-tight">gemini journal</span></div>
          <div className="relative max-w-xl py-16">
            <p className="eyebrow mb-5">A quieter kind of AI</p>
            <h1 className="font-display text-5xl font-semibold leading-[.98] tracking-[-.05em] sm:text-7xl">Make room for<br /><span className="text-[#9c6d4b]">what matters.</span></h1>
            <p className="mt-7 max-w-md text-lg leading-8 text-[#66716c]">A private place to think out loud, turn loose thoughts into useful patterns, and keep the important parts.</p>
            <Button onClick={() => startLogin()} size="lg" className="mt-10 h-12 rounded-xl bg-[#293331] px-6 text-[#fffaf3] shadow-[0_10px_30px_rgba(41,51,49,.16)] hover:bg-[#3d4a46]"><LockKeyhole className="mr-2 h-4 w-4" />Enter your journal<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <div className="relative flex items-center gap-3 text-xs text-[#78817d]"><ShieldCheck className="h-4 w-4 text-[#6d8b72]" /> Your entries are scoped to your account and never shared.</div>
        </section>
        <section className="relative hidden overflow-hidden bg-[#293331] lg:block">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-[#b67c59]/35 blur-3xl" />
          <div className="relative flex h-full items-center justify-center p-16">
            <div className="w-full max-w-md rotate-[-3deg] rounded-[2rem] border border-white/10 bg-[#f4eee5] p-8 shadow-[0_30px_100px_rgba(0,0,0,.3)]">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.2em] text-[#9c6d4b]">today, gently</span><Moon className="h-4 w-4 text-[#9c6d4b]" /></div>
              <p className="mt-14 font-display text-3xl font-medium leading-tight text-[#293331]">“The answer may not be a plan. It may be permission to begin.”</p>
              <div className="mt-16 flex items-center justify-between border-t border-[#293331]/10 pt-4 text-xs text-[#78817d]"><span>private reflection</span><span>09:42</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [mode, setMode] = useState<Mode>("journal");
  const [prompt, setPrompt] = useState("");
  const [thread, setThread] = useState<ThreadTurn[]>([]);
  const [activeEntry, setActiveEntry] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const entriesQuery = trpc.journal.list.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: false });
  const insightsQuery = trpc.journal.insights.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: false });
  const statusQuery = trpc.journal.status.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: false });
  const createEntry = trpc.journal.create.useMutation({
    onSuccess: result => {
      setThread(current => [...current, { role: "user", content: prompt.trim() }, { role: "assistant", content: result.response }]);
      setPrompt("");
      setActiveEntry(result.entry.id);
      void utils.journal.list.invalidate();
      void utils.journal.insights.invalidate();
      toast.success("Saved to your private journal", { description: "Your reflection and quiet signal are ready." });
    },
    onError: error => toast.error("Your reflection could not be saved", { description: error.message }),
  });
  const deleteEntry = trpc.journal.delete.useMutation({
    onSuccess: result => {
      if (result.success) {
        setActiveEntry(null);
        void utils.journal.list.invalidate();
        void utils.journal.insights.invalidate();
        toast.success("Entry removed");
      }
    },
  });
  const entries = entriesQuery.data ?? [];
  const selectedEntry = useMemo(() => entries.find(entry => entry.id === activeEntry) ?? entries[0], [activeEntry, entries]);
  const activeMode = modes.find(item => item.id === mode) ?? modes[0];

  if (loading) return <LoadingScreen />;
  if (!user) return <SignInScreen />;

  const submit = () => {
    if (!prompt.trim() || createEntry.isPending) return;
    createEntry.mutate({ prompt, mode, thread });
  };

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#293331]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[250px] flex-col border-r border-[#293331]/10 bg-[#eeeae2] px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#293331] text-[#f1c89d]"><Orbit className="h-4 w-4" /></div><div><p className="font-display text-sm font-bold tracking-tight">gemini journal</p><p className="text-[10px] uppercase tracking-[.16em] text-[#78817d]">private by design</p></div></div>
          <div className="mt-12 space-y-1"><p className="eyebrow px-3 pb-2">Workspace</p><button className="nav-item nav-item-active"><Feather className="h-4 w-4" />Today</button><button className="nav-item"><BookOpen className="h-4 w-4" />Your entries<span className="ml-auto text-xs text-[#78817d]">{entries.length}</span></button><button className="nav-item"><HeartPulse className="h-4 w-4" />Quiet Signals</button></div>
          <div className="mt-auto space-y-4"><div className="rounded-2xl bg-[#dce5d8] p-4"><div className="mb-3 flex items-center gap-2 text-[#51705b]"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold">Security constitution</span></div><p className="text-xs leading-5 text-[#5f7165]">Auth-gated. Server-side AI. Owner-scoped reads and writes.</p><a className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#51705b]" href="#security">View safeguards <ChevronRight className="h-3 w-3" /></a></div><div className="flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#c2cbc1] text-xs font-bold text-[#4f5c54]">{initials(user.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user.name || "Your space"}</p><p className="truncate text-[11px] text-[#78817d]">{user.email || "Signed in"}</p></div><button onClick={() => void logout()} aria-label="Sign out" className="text-[#78817d] transition hover:text-[#293331]"><LogOut className="h-4 w-4" /></button></div></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-[#293331]/10 px-6 py-5 sm:px-10"><div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#293331] text-[#f1c89d]"><Orbit className="h-4 w-4" /></div><span className="font-display text-sm font-bold">gemini journal</span></div><div className="hidden lg:block"><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Good to see you, {user.name?.split(" ")[0] || "friend"}.</h1></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full bg-[#e3e9df] px-3 py-1.5 text-[11px] font-semibold text-[#5b7460] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6d9972]" /> Private session</div><button className="grid h-9 w-9 place-items-center rounded-full bg-[#dce5d8] text-xs font-bold text-[#4f5c54] lg:hidden">{initials(user.name)}</button></div></header>
          <div className="grid gap-6 px-6 py-7 sm:px-10 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-7 flex items-start justify-between gap-4 lg:hidden"><div><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Good to see you, {user.name?.split(" ")[0] || "friend"}.</h1></div><PanelLeft className="mt-2 h-5 w-5 text-[#78817d]" /></div>
              <section className="relative overflow-hidden rounded-[1.75rem] bg-[#293331] p-6 text-[#fffaf3] shadow-[0_18px_50px_rgba(41,51,49,.12)] sm:p-8"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#b67c59]/30 blur-3xl" /><div className="relative"><div className="flex items-start justify-between gap-4"><div><div className="mb-4 flex items-center gap-2 text-[#f1c89d]"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[.18em]">Your thinking space</span></div><h2 className="max-w-lg font-display text-3xl font-medium leading-tight tracking-[-.03em] sm:text-4xl">What wants your attention<br /><span className="text-[#f1c89d]">today?</span></h2></div><div className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/70 sm:block">{thread.length ? "Continuing gently" : "Nothing to solve"}</div></div><div className="mt-8 flex flex-wrap gap-2">{modes.map(item => { const Icon = item.icon; const active = item.id === mode; return <button key={item.id} onClick={() => setMode(item.id)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs transition ${active ? "border-[#f1c89d] bg-[#f1c89d] text-[#293331]" : "border-white/15 text-white/70 hover:border-white/35 hover:text-white"}`}><Icon className="h-3.5 w-3.5" /><span>{item.label}</span></button>; })}</div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.07] p-2 focus-within:border-[#f1c89d]/70"><Textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={activeMode.description + "..."} className="min-h-[126px] resize-none border-0 bg-transparent px-3 py-2 text-base leading-7 text-white placeholder:text-white/35 focus-visible:ring-0" maxLength={5000} /><div className="flex items-center justify-between px-3 pb-1 pt-2"><span className="text-[11px] text-white/40">{prompt.length}/5000 · shift + enter for a new line</span><Button onClick={submit} disabled={!prompt.trim() || createEntry.isPending} className="h-9 rounded-lg bg-[#f1c89d] px-4 text-xs font-bold text-[#293331] hover:bg-[#f7d9b8]">{createEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" />Reflect</>}</Button></div></div></div></section>
              <div className="mt-8 flex items-center justify-between"><div><p className="eyebrow">Your recent reflections</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Keep the thread.</h2></div><button onClick={() => { setActiveEntry(null); setThread([]); setPrompt(""); }} className="flex items-center gap-1.5 text-xs font-semibold text-[#9c6d4b] hover:text-[#7d5338]"><Plus className="h-4 w-4" />New thought</button></div>
              <div className="mt-4 space-y-3">{entriesQuery.isLoading ? <div className="rounded-2xl border border-dashed border-[#293331]/15 p-8 text-center text-sm text-[#78817d]"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Gathering your entries</div> : entries.length === 0 ? <div className="rounded-2xl border border-dashed border-[#293331]/20 bg-white/35 p-8 text-center"><MessageCircle className="mx-auto mb-3 h-6 w-6 text-[#9c6d4b]" /><p className="font-display text-lg font-semibold">Your journal is still quiet.</p><p className="mt-1 text-sm text-[#78817d]">Start with whatever is most present. There is no right way in.</p></div> : entries.slice(0, 6).map(entry => <button key={entry.id} onClick={() => setActiveEntry(entry.id)} className={`group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${selectedEntry?.id === entry.id ? "border-[#9c6d4b]/45 bg-white" : "border-[#293331]/10 bg-white/45"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: moodColors[entry.mood] || "#9c6d4b" }} /><span className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#78817d]">{entry.mode} · {formatDate(entry.createdAt)}</span></div><ChevronRight className="h-4 w-4 shrink-0 text-[#b1b6b1] transition group-hover:translate-x-1 group-hover:text-[#9c6d4b]" /></div><p className="mt-3 line-clamp-1 font-medium text-[#39423e]">{entry.prompt}</p><p className="mt-1 line-clamp-2 text-sm leading-6 text-[#78817d]">{entry.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{entry.tags.map(tag => <Badge key={tag} variant="outline" className="rounded-full border-[#293331]/10 bg-[#f5f4ef] text-[10px] font-medium text-[#78817d]">#{tag}</Badge>)}</div></button>)}</div>
            </div>
            <aside className="space-y-5">
              <Card className="overflow-hidden rounded-[1.5rem] border-[#293331]/10 bg-[#e6eee2] shadow-none"><CardHeader className="pb-3"><div className="flex items-center justify-between"><div><p className="eyebrow text-[#5c7662]">Original feature</p><CardTitle className="mt-1 font-display text-xl tracking-tight text-[#293331]">Quiet Signals</CardTitle></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#cdddc9] text-[#5c7662]"><Activity className="h-4 w-4" /></div></div><CardDescription className="text-xs leading-5 text-[#6c7e70]">A private pattern map, never a diagnosis.</CardDescription></CardHeader><CardContent>{insightsQuery.isLoading ? <div className="py-6 text-center text-xs text-[#6c7e70]"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Finding your signal</div> : <><div className="rounded-xl bg-white/55 p-3"><p className="text-sm font-semibold text-[#405246]">{insightsQuery.data?.headline}</p><p className="mt-1 text-xs leading-5 text-[#6c7e70]">{insightsQuery.data?.nudge}</p></div><div className="mt-5 grid grid-cols-3 gap-2"><div><p className="font-display text-2xl font-semibold">{insightsQuery.data?.thisWeek ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-[#6c7e70]">this week</p></div><div><p className="font-display text-2xl font-semibold">{insightsQuery.data?.activeDays ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-[#6c7e70]">active days</p></div><div><p className="font-display text-2xl font-semibold">{insightsQuery.data?.avgEnergy || "—"}</p><p className="text-[10px] uppercase tracking-wider text-[#6c7e70]">energy / 5</p></div></div>{(insightsQuery.data?.moods?.length ?? 0) > 0 && <div className="mt-6"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#6c7e70]">Mood texture</p><div className="space-y-2">{insightsQuery.data?.moods.slice(0, 4).map(item => <div key={item.label} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: moodColors[item.label] || "#9c6d4b" }} /><span className="capitalize text-[#52665a]">{item.label}</span><div className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-[#cdddc9]"><div className="h-full rounded-full bg-[#77917b]" style={{ width: `${Math.max(18, (item.count / (insightsQuery.data?.total || 1)) * 100)}%` }} /></div></div>)}</div></div>}{(insightsQuery.data?.themes?.length ?? 0) > 0 && <div className="mt-6"><p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#6c7e70]"><Tags className="h-3 w-3" /> recurring themes</p><div className="flex flex-wrap gap-1.5">{insightsQuery.data?.themes.map(item => <span key={item.label} className="rounded-full bg-[#cdddc9] px-2.5 py-1 text-[10px] text-[#52665a]">{item.label}</span>)}</div></div>}</>}</CardContent></Card>
              {selectedEntry ? <Card className="rounded-[1.5rem] border-[#293331]/10 bg-white/65 shadow-none"><CardHeader className="pb-3"><div className="flex items-center justify-between"><div><p className="eyebrow">Selected note</p><CardTitle className="mt-1 line-clamp-1 font-display text-lg tracking-tight">{selectedEntry.prompt}</CardTitle></div><button onClick={() => deleteEntry.mutate({ id: selectedEntry.id })} className="rounded-lg p-2 text-[#a1847a] transition hover:bg-[#f5e9e5] hover:text-[#9b5946]" aria-label="Delete entry"><Trash2 className="h-4 w-4" /></button></div><CardDescription className="flex items-center gap-1 text-xs"><Clock3 className="h-3 w-3" />{formatDate(selectedEntry.createdAt)} · {selectedEntry.mood}</CardDescription></CardHeader><CardContent><div className="prose prose-sm max-w-none text-[#59635e]"><Streamdown>{selectedEntry.response}</Streamdown></div><div className="mt-5 border-t border-[#293331]/10 pt-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#78817d]">Your summary</p><p className="mt-1 text-sm leading-6 text-[#59635e]">{selectedEntry.summary}</p></div></CardContent></Card> : <Card className="rounded-[1.5rem] border-[#293331]/10 bg-white/65 shadow-none"><CardContent className="p-5"><div className="flex items-center gap-2 text-[#9c6d4b]"><Gem className="h-4 w-4" /><p className="text-xs font-semibold">A note about privacy</p></div><p className="mt-2 text-xs leading-5 text-[#78817d]">Your words travel only through an authenticated server boundary. AI keys stay off the client, and every read is scoped by the signed-in user.</p></CardContent></Card>}
              <div id="security" className="rounded-2xl border border-[#293331]/10 bg-white/30 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#6d8b72]" /><span className="text-xs font-semibold">Runtime safeguards</span><Check className="ml-auto h-3.5 w-3.5 text-[#6d8b72]" /></div><div className="mt-3 space-y-2 text-[11px] text-[#78817d]"><p className="flex items-center gap-2"><LockKeyhole className="h-3 w-3 text-[#6d8b72]" />Auth boundary active</p><p className="flex items-center gap-2"><CircleUserRound className="h-3 w-3 text-[#6d8b72]" />Owner-scoped persistence</p><p className="flex items-center gap-2"><BrainCircuit className="h-3 w-3 text-[#6d8b72]" />{statusQuery.data?.provider || "AI gateway protected"}</p></div></div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
