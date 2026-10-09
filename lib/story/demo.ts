/**
 * The demo: the whole admin app filled with made-up sample data, so Play Store
 * reviewers and organisations trying Myithri can explore it without an account.
 * Nothing here is real and nothing is sent to the server. Changes are refused
 * with a friendly note, except a few harmless ones that only change the screen.
 */

import { StoryApiError } from "./api";

export const DEMO_KEY = "demo";
export const isDemo = (key: string | null | undefined) => key === DEMO_KEY;

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const IMG = `${BASE}/demo`;
const SITE = `https://myithri.auraclusive.com${BASE}`;

/** Said when someone tries to change something in the demo. */
export const DEMO_NOTE = "This is the demo, so changes aren't saved. Ask Auraclusive to set up Myithri for your organisation.";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// ---------- organisation ----------

const ORG = {
  org: {
    name: "Demo Para Sports Trust",
    short: "Demo Trust",
    website: "example.org",
    donate: "example.org/donate",
    credentials: "Sample organisation for the Myithri demo. Not a real trust.",
    contact: "hello@example.org",
    donationEn: "Rs 2,500 gives one player a season of coaching, travel and kit.",
    donationKn: "ರೂ 2,500 ಒಬ್ಬ ಆಟಗಾರನಿಗೆ ಒಂದು ಋತುವಿನ ತರಬೇತಿ ನೀಡುತ್ತದೆ.",
    voice: "Sulafat",
  },
  logo: `${IMG}/logo.svg`,
  voices: ["Sulafat", "Aoede", "Leda", "Kore", "Achernar", "Despina", "Vindemiatrix"],
  links: {},
};

// ---------- players (story interviews) ----------

interface P {
  id: string;
  name: string;
  callname: string;
  pronoun: string;
  hometown: string;
  role: string;
  disability: string;
  achievements: string;
  support: string;
  work: string;
  joined: number;
  status: string;
  minutes: number;
  updatedH: number;
  story?: boolean;
  approved?: boolean;
}

const PEOPLE: P[] = [
  { id: "D001", name: "Arjun Hegde", callname: "Arjun", pronoun: "He", hometown: "Mysuru", role: "Opening batter", disability: "Polio, lower limbs", achievements: "Player of the tournament, South Zone 2025", support: "Sports wheelchair, coaching camps, travel to nationals", work: "Accounts assistant", joined: 2019, status: "Approved by player", minutes: 21, updatedH: 30, story: true, approved: true },
  { id: "D002", name: "Kavya Raman", callname: "Kavya", pronoun: "She", hometown: "Hubballi", role: "All-rounder", disability: "Spinal cord injury", achievements: "First woman from her district to play state level", support: "Kit, coaching, fitness programme", work: "Data entry operator", joined: 2021, status: "Story ready - send to player for approval", minutes: 18, updatedH: 5, story: true },
  { id: "D003", name: "Imran Pasha", callname: "Imran", pronoun: "He", hometown: "Kalaburagi", role: "Wicket-keeper", disability: "Below-knee amputation", achievements: "Captain, district team", support: "", work: "Runs a mobile repair shop", joined: 2020, status: "Story ready - send to player for approval", minutes: 16, updatedH: 9, story: true },
  { id: "D004", name: "Lakshmi Devi", callname: "Lakshmi", pronoun: "She", hometown: "Tumakuru", role: "Bowler", disability: "Polio", achievements: "", support: "Travel and stay for camps", work: "Tailor", joined: 2022, status: "Interview done", minutes: 14, updatedH: 2 },
  { id: "D005", name: "Suresh Gowda", callname: "Suresh", pronoun: "He", hometown: "Mandya", role: "Batter", disability: "", achievements: "", support: "", work: "", joined: 2023, status: "Consent given", minutes: 3, updatedH: 46 },
  { id: "D006", name: "Nikhil Shetty", callname: "Nikhil", pronoun: "He", hometown: "Udupi", role: "Bowler", disability: "", achievements: "", support: "", work: "", joined: 2024, status: "Opened link", minutes: 0, updatedH: 3 },
  { id: "D007", name: "Prakash Naik", callname: "Prakash", pronoun: "He", hometown: "Karwar", role: "All-rounder", disability: "", achievements: "", support: "", work: "", joined: 2023, status: "Link sent", minutes: 0, updatedH: 28 },
  { id: "D008", name: "Meera Kulkarni", callname: "Meera", pronoun: "She", hometown: "Belagavi", role: "Batter", disability: "", achievements: "", support: "", work: "", joined: 2025, status: "Link ready - not sent", minutes: 0, updatedH: 50 },
];

const STORY_IDS = PEOPLE.filter((p) => p.story).map((p) => p.id);

function player(p: P) {
  const code = "DEMO" + p.id.slice(1);
  return {
    id: p.id,
    name: p.name,
    callname: p.callname,
    greet: p.callname,
    phone: "",
    pronoun: p.pronoun,
    hometown: p.hometown,
    language: p.id === "D004" ? "Kannada" : "English",
    joined: p.joined,
    role: p.role,
    disability: p.disability,
    achievements: p.achievements,
    support: p.support,
    work: p.work,
    notes: "",
    code,
    link: `${SITE}/?c=${code}`,
    whatsapp: "",
    status: p.status,
    consent: p.minutes ? hoursAgo(p.updatedH + 1) : "",
    minutes: p.minutes,
    folder: "",
    uploads: p.story ? "3 photos" : "",
    slides: "",
    pdf_en: p.story ? "demo" : "",
    pdf_kn: "",
    qr: "",
    approved: !!p.approved,
    updated: hoursAgo(p.updatedH),
    row: 0,
    // No phone numbers in the demo, so no WhatsApp buttons.
    canWhatsApp: false,
    folderUrl: "",
    slidesUrl: "",
    pdfEnUrl: p.story ? `${IMG}/${p.id}.pdf` : "",
    pdfKnUrl: "",
  };
}

const file = (id: string, name: string, mime: string, h: number, thumb = "", size = 120000) => ({
  id,
  name,
  mime,
  size,
  created: hoursAgo(h),
  url: "",
  thumb,
  seconds: 0,
});

function media(id: string) {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p || p.minutes < 10) return { folderUrl: "", files: { interview: [], uploads: [], dmsa: [], story: [] }, storyVideo: "", needsCheck: [] };
  const n = PEOPLE.indexOf(p);
  return {
    folderUrl: "",
    files: {
      interview: [file(`${id}-t`, `${p.name} - careful transcript.txt`, "text/plain", p.updatedH + 2)],
      uploads: [0, 1, 2].map((i) => file(`${id}-u${i}`, `${p.callname} photo ${i + 1}.webp`, "image/webp", p.updatedH + 3, `${IMG}/photo-${(n + i) % 6}.webp`)),
      dmsa: [],
      story: p.story ? [file(`${id}-pdf`, `${p.name} - Impact Story.pdf`, "application/pdf", p.updatedH, "", 2400000)] : [],
    },
    storyVideo: "",
    needsCheck: id === "D003" ? ["Add what support the trust gave Imran - the story leaves it general."] : [],
  };
}

const TRANSCRIPTS: Record<string, [string, string][]> = {
  D001: [
    ["MYITHRI", "Hello Arjun, I'm Myithri, the trust's AI story volunteer. Thank you for making time today. Shall we begin with where you grew up?"],
    ["ARJUN", "Sure. I grew up in Mysuru, near the railway colony. My father drove an auto. I got polio when I was two."],
    ["MYITHRI", "What was school like for you?"],
    ["ARJUN", "The school had stairs everywhere. My friends carried me up every morning. That's where I first watched cricket, from the window."],
    ["MYITHRI", "That's a strong image - watching from the window. When did you first hold a bat yourself?"],
    ["ARJUN", "In 2019 a coach from the trust came to our street. He said, you can play. I didn't believe him until I hit my first four."],
    ["MYITHRI", "What changed after that first season?"],
    ["ARJUN", "Everything. I travelled on a train alone for the first time. I got a job in accounts because I had the confidence to walk into the interview."],
    ["MYITHRI", "If a donor were listening right now, what would you tell them?"],
    ["ARJUN", "Your support doesn't just give us a wheelchair. It gives us a team, and a reason to come out of the house."],
  ],
  D002: [
    ["MYITHRI", "Hi Kavya, I'm Myithri. Thank you for talking with me. Tell me a little about yourself."],
    ["KAVYA", "I'm from Hubballi. I had an accident in college that injured my spine. For two years I didn't go out much."],
    ["MYITHRI", "What brought you back out?"],
    ["KAVYA", "My cousin showed me a video of women playing wheelchair cricket. I messaged the trust the same night."],
    ["MYITHRI", "And now?"],
    ["KAVYA", "Now I'm the first woman from my district at state level. Girls message me asking how to start."],
  ],
  D003: [
    ["MYITHRI", "Hello Imran, I'm Myithri. Shall we start with how you came to cricket?"],
    ["IMRAN", "I always played as a boy. After the accident I thought it was over. Then I found the district team."],
    ["MYITHRI", "You keep wicket now. What do you love about it?"],
    ["IMRAN", "You see the whole game from there. And I'm the loudest voice on the field."],
  ],
  D004: [
    ["MYITHRI", "Namaskara Lakshmi, I'm Myithri. Thank you for joining."],
    ["LAKSHMI", "Namaskara. I'm a tailor in Tumakuru, and I bowl for the district team."],
  ],
};

const transcript = (lines: [string, string][]) =>
  lines.map(([who, t], i) => `[${Math.floor((i * 37) / 60)}:${String((i * 37) % 60).padStart(2, "0")}] ${who}: ${t}`).join("\n");

// ---------- briefs ----------

const TEMPLATES = [
  {
    type: "beneficiary",
    label: "Beneficiary feedback",
    name: "Beneficiary feedback",
    audience: "someone who takes part in, or benefits from, one of your programmes",
    objective: "Understand how people experience the programme - what difference it has made, what works, what is hard, and what they need next.",
    purpose: "improve its programmes and report their impact",
    intro: "Myithri would like to hear about your experience with the programme. It takes about 8 minutes.",
    questions: [
      "How did you first come to the programme, and how long have you been part of it?",
      "What difference has it made in your life?",
      "What has been difficult, or what does not work well for you?",
      "Is there anything you need that the programme does not offer yet?",
    ],
    criteria: [],
    minutes: 8,
    style: "warm",
    evaluate: false,
  },
  {
    type: "volunteer",
    label: "Volunteer feedback",
    name: "Volunteer feedback",
    audience: "a volunteer who has helped at matches, camps or events",
    objective: "Understand how volunteers experience volunteering - what worked, what was hard, and what would make them come back.",
    purpose: "improve its volunteer programme",
    intro: "Myithri would love to hear about your time volunteering. It takes about 8 minutes.",
    questions: ["How did you first get involved?", "What was the best moment of your volunteering?", "Was anything confusing or difficult?", "Would you volunteer again?"],
    criteria: [],
    minutes: 8,
    style: "warm",
    evaluate: false,
  },
  {
    type: "interview",
    label: "Job interview - first round",
    name: "First-round interview",
    audience: "a candidate who has applied for a role",
    role: "Programme Coordinator",
    objective: "Screen candidates fairly and consistently so the team can decide who goes to the next round.",
    purpose: "decide who moves to the next round of hiring",
    intro: "This is the first round of your interview, with Myithri, an AI interviewer. It takes about 15 minutes.",
    questions: ["Please introduce yourself.", "What interests you about this role?", "Tell me about a piece of work you are proud of."],
    criteria: ["Relevant experience", "Communication", "Motivation for the role"],
    minutes: 15,
    style: "professional",
    evaluate: true,
  },
  {
    type: "custom",
    label: "Something else",
    name: "",
    audience: "",
    objective: "",
    purpose: "learn from what people share",
    intro: "Myithri would like to ask you a few questions. It takes about 10 minutes.",
    questions: [],
    criteria: [],
    minutes: 10,
    style: "warm",
    evaluate: false,
  },
];

const cfg = (type: string, name: string, extra: Record<string, unknown> = {}) => {
  const t = TEMPLATES.find((x) => x.type === type)!;
  return {
    type,
    name,
    org: ORG.org.name,
    audience: t.audience,
    role: (t as { role?: string }).role || "",
    objective: t.objective,
    purpose: t.purpose,
    intro: t.intro,
    questions: t.questions,
    criteria: t.criteria,
    notes: "",
    knowledge: "Camp dates: 12-16 May. Travel is reimbursed within 2 weeks.",
    docs: [],
    minutes: t.minutes,
    language: "choose",
    recording: "voice",
    askPhone: true,
    media: type === "volunteer",
    style: t.style,
    evaluate: t.evaluate,
    ...extra,
  };
};

const CONVS = [
  { id: "U101", name: "Summer camp volunteers", type: "volunteer", status: "Open", code: "U1DEMO01", created: hoursAgo(24 * 9), cfg: cfg("volunteer", "Summer camp volunteers"), counts: { total: 14, done: 11, analysed: 11 } },
  { id: "U102", name: "Sports kit programme", type: "beneficiary", status: "Open", code: "U1DEMO02", created: hoursAgo(24 * 20), cfg: cfg("beneficiary", "Sports kit programme"), counts: { total: 6, done: 5, analysed: 5 } },
  { id: "U103", name: "Programme coordinator - round 1", type: "interview", status: "Closed", code: "U1DEMO03", created: hoursAgo(24 * 30), cfg: cfg("interview", "Programme coordinator - round 1", { style: "professional", recording: "voice", language: "en" }), counts: { total: 3, done: 3, analysed: 3 } },
].map((c) => ({ ...c, link: `${SITE}/?u=${c.code}` }));

interface R {
  id: string;
  conv: string;
  name: string;
  minutes: number;
  h: number;
  sentiment: string;
  summary: string;
  followUp?: string;
  unanswered?: string[];
  answers: [string, string, string][];
  themes: string[];
  suggestions: string[];
  concerns: string[];
  result?: string;
  criteria?: { criterion: string; score: number; evidence: string }[];
}

const RESPONSES: R[] = [
  {
    id: "C9001", conv: "U101", name: "Ananya", minutes: 9, h: 4, sentiment: "positive",
    summary: "Loved scoring the final match; wants clearer shift timings and a lunch plan for long days.",
    followUp: "Asked whether volunteers can get a certificate for college credit.",
    unanswered: ["Can volunteers get a certificate for college credit?"],
    answers: [
      ["How did you first get involved?", "A friend who coaches at the trust asked for help with scoring.", "I came for one day and stayed the whole week."],
      ["What was the best moment of your volunteering?", "Scoring the final, which went to the last ball.", "When the last ball went for four, the whole ground stood up."],
      ["Was anything confusing or difficult?", "Shift timings changed at short notice and lunch was unclear.", "Nobody told us where lunch was on day two."],
      ["Would you volunteer again?", "Yes, and would bring two friends.", "Count me in for next year."],
    ],
    themes: ["Match-day energy", "Shift planning", "Food and breaks"], suggestions: ["Share a shift sheet a week before"], concerns: ["Long days without a lunch plan"],
  },
  {
    id: "C9002", conv: "U101", name: "Rohit", minutes: 8, h: 7, sentiment: "positive",
    summary: "First-time volunteer; the players' welcome made him want to return. Suggests a short briefing on wheelchair safety.",
    answers: [
      ["How did you first get involved?", "Saw the call for volunteers on Instagram.", "I just filled the form on a whim."],
      ["What was the best moment of your volunteering?", "Players thanked every volunteer by name at the end.", "They knew my name by day two."],
      ["Was anything confusing or difficult?", "Didn't know how to help a player transfer safely.", "I was scared of doing it wrong."],
      ["Would you volunteer again?", "Yes.", "Definitely."],
    ],
    themes: ["Welcome from players", "Safety training"], suggestions: ["A 15-minute safety briefing on day one"], concerns: [],
  },
  {
    id: "C9003", conv: "U101", name: "Farah", minutes: 10, h: 20, sentiment: "neutral",
    summary: "Enjoyed the work but found travel to the ground hard; reimbursement took a month last time.",
    followUp: "Waiting for her travel reimbursement from April.",
    answers: [
      ["How did you first get involved?", "Volunteered at last year's camp too.", "This is my second camp."],
      ["What was the best moment of your volunteering?", "Watching a new player hit her first boundary.", "She cried, I cried."],
      ["Was anything confusing or difficult?", "Travel is two buses; reimbursement was slow.", "I'm still waiting for April's travel money."],
      ["Would you volunteer again?", "Probably, if travel is sorted.", "Sort the travel and I'm there."],
    ],
    themes: ["Travel", "Reimbursement delays"], suggestions: ["Pay travel on the day by UPI"], concerns: ["Reimbursement delays"],
  },
  {
    id: "C9004", conv: "U102", name: "Manjunath", minutes: 7, h: 30, sentiment: "positive",
    summary: "The new kit let him train every day instead of twice a week; asks for gloves in larger sizes.",
    answers: [
      ["What difference has it made in your life?", "Trains daily now with his own wheelchair and bat.", "Before, I waited for my turn on the shared chair."],
      ["What has been difficult?", "Gloves were too small.", "The gloves don't fit big hands."],
    ],
    themes: ["Own equipment", "Sizing"], suggestions: ["Ask sizes before ordering"], concerns: [],
  },
  {
    id: "C9005", conv: "U102", name: "Shobha", minutes: 9, h: 52, sentiment: "positive",
    summary: "Kit and the fitness plan helped her lose the fear of falling; wants a women-only practice slot.",
    followUp: "Asked when a women-only practice slot could start.",
    unanswered: ["When can a women-only practice slot start?"],
    answers: [
      ["What difference has it made in your life?", "Confidence moving on her own.", "I'm not scared of falling any more."],
      ["Is there anything you need?", "A women-only practice time.", "Some of us would come more if it was just women."],
    ],
    themes: ["Confidence", "Women's participation"], suggestions: ["Women-only slot on Sundays"], concerns: [],
  },
  {
    id: "C9006", conv: "U103", name: "Candidate A", minutes: 15, h: 24 * 25, sentiment: "positive",
    summary: "Six years running community programmes; clear, structured answers. Suggested next round.",
    result: "Strong yes 4.4/5",
    answers: [["Please introduce yourself.", "Runs a youth sports programme for a city NGO.", "I've built two programmes from scratch."]],
    themes: ["Programme design"], suggestions: [], concerns: [],
    criteria: [
      { criterion: "Relevant experience", score: 5, evidence: "Six years running community sports programmes." },
      { criterion: "Communication", score: 4, evidence: "Clear, structured answers with examples." },
      { criterion: "Motivation for the role", score: 4, evidence: "Wants to work on disability inclusion specifically." },
    ],
  },
];

const respRow = (r: R) => ({
  id: r.id,
  conv: r.conv,
  name: r.name,
  phone: "",
  status: "Completed",
  started: hoursAgo(r.h),
  finished: hoursAgo(r.h - 0.2),
  minutes: r.minutes,
  language: "English",
  summary: r.summary,
  result: r.result || "",
  folder: "",
  analysis: {
    summary: r.summary,
    sentiment: r.sentiment,
    answers: r.answers.map(([question, answer, quote]) => ({ question, answer, quote })),
    themes: r.themes,
    suggestions: r.suggestions,
    concerns: r.concerns,
    follow_up: r.followUp || "",
    unanswered: r.unanswered || [],
    criteria: r.criteria,
    version: 2,
    at: hoursAgo(r.h - 0.3),
  },
});

const followed: Record<string, string> = {};

const peopleList = () =>
  RESPONSES.map((r) => {
    const c = CONVS.find((x) => x.id === r.conv)!;
    return {
      id: r.id,
      conv: r.conv,
      convName: c.name,
      convType: c.type,
      name: r.name,
      phone: "",
      status: "Completed",
      started: hoursAgo(r.h),
      finished: hoursAgo(r.h - 0.2),
      minutes: String(r.minutes),
      language: "English",
      sentiment: r.sentiment,
      summary: r.summary,
      followUp: r.followUp || "",
      unanswered: r.unanswered || [],
      followedUp: followed[r.id] || "",
    };
  });

const INSIGHTS: Record<string, unknown> = {
  U101: {
    overview: "Volunteers loved the match-day energy and the players' welcome. The two things that would bring more of them back: a shift plan shared a week ahead, and travel paid on the day.",
    themes: [
      { theme: "Match-day energy", count: 9, detail: "Most volunteers named a match moment as the best part." },
      { theme: "Shift planning", count: 6, detail: "Timings changed late; people want a sheet a week before." },
      { theme: "Travel and reimbursement", count: 4, detail: "Two-bus journeys and slow repayment." },
      { theme: "Safety briefing", count: 3, detail: "First-timers want to know how to help with transfers." },
    ],
    praise: ["Players thanked volunteers by name", "Well-run final day"],
    concerns: ["Reimbursement takes up to a month", "No lunch plan on long days"],
    suggestions: ["Share a shift sheet a week ahead", "Pay travel on the day by UPI", "15-minute safety briefing on day one"],
    quotes: [
      { quote: "When the last ball went for four, the whole ground stood up.", person: "Ananya" },
      { quote: "They knew my name by day two.", person: "Rohit" },
    ],
    actions: ["Send the next camp's shift sheet by 5 May", "Move travel repayment to UPI on the day"],
    at: hoursAgo(3),
    people: 11,
  },
  U102: {
    overview: "Own equipment means daily practice instead of twice a week. Sizing and a women-only slot are the main asks.",
    themes: [
      { theme: "Daily practice", count: 5, detail: "Everyone now trains more often." },
      { theme: "Confidence", count: 3, detail: "Less fear of falling and travelling alone." },
    ],
    praise: ["Fitness plan"],
    concerns: ["Gloves too small"],
    suggestions: ["Ask sizes before ordering", "Women-only Sunday slot"],
    quotes: [{ quote: "I'm not scared of falling any more.", person: "Shobha" }],
    actions: ["Collect glove sizes before the next order"],
    at: hoursAgo(26),
    people: 5,
  },
};

// ---------- reports ----------

const IMPACT = {
  job: { state: "done", lang: "", error: "", at: hoursAgo(20) },
  stories: STORY_IDS.length,
  report: {
    at: hoursAgo(20),
    players: STORY_IDS.length,
    names: true,
    needsCheck: [],
    deckUrl: "",
    pdf: { name: "Demo Trust - Impact report.pdf", size: 3100000 },
    pages: [1, 2, 3].map((n) => `${IMG}/impact-${n}.webp`),
  },
};

// ---------- the handler ----------

const READ: Record<string, (b: Record<string, unknown>) => unknown> = {
  boot: () => ({ list: list(), convList: { conversations: CONVS }, people: { people: peopleList() }, org: ORG }),
  list: () => list(),
  convList: () => ({ conversations: CONVS }),
  people: () => ({ people: peopleList() }),
  orgGet: () => ORG,
  health: () => ({
    status: "ok",
    checks: [
      { level: "ok", text: "Automatic stories and summaries are running (last run 12 min ago)." },
      { level: "ok", text: "Storage is connected." },
      { level: "ok", text: "The AI is answering normally." },
    ],
    log: ["Summarised 2 new conversations", "Wrote Kavya Raman's story"],
    errors: [],
  }),
  convTemplates: () => ({ templates: TEMPLATES }),
  media: (b) => media(String(b.id)),
  text: (b) => ({ text: transcript(TRANSCRIPTS[String(b.id)] || []) }),
  storyPages: (b) => {
    const id = String(b.id);
    if (!STORY_IDS.includes(id) || b.lang === "kn") return { lang: b.lang || "en", pages: [], pdf: null, hasKn: false };
    const pages = [1, 2, 3, 4].map((n) => `${IMG}/${id}-${n}.webp`);
    return { lang: "en", pages: b.first ? pages.slice(0, 1) : pages, deckUrl: "", pdf: { id: `${id}-pdf`, name: `${PEOPLE.find((p) => p.id === id)!.name} - Impact Story.pdf`, size: 2400000 }, hasKn: false };
  },
  storyJob: (b) => {
    const p = PEOPLE.find((x) => x.id === b.id);
    return { job: { state: "done", lang: "en", needsCheck: [], at: hoursAgo(1) }, player: p ? player(p) : null };
  },
  convGet: (b) => {
    const c = CONVS.find((x) => x.id === b.id);
    if (!c) throw new StoryApiError("That brief isn't in the demo.");
    return { conversation: { ...c, responses: RESPONSES.filter((r) => r.conv === c.id).map((r) => ({ ...respRow(r), analysis: null })) } };
  },
  convResponse: (b) => {
    const r = RESPONSES.find((x) => x.id === b.id);
    if (!r) throw new StoryApiError("That conversation isn't in the demo.");
    const files = [file(`${r.id}-t`, `${r.name} - careful transcript.txt`, "text/plain", r.h)];
    if (r.conv === "U101") files.push(file(`${r.id}-s1`, `${r.name} - shared photo 1.webp`, "image/webp", r.h, `${IMG}/photo-4.webp`), file(`${r.id}-s2`, `${r.name} - shared photo 2.webp`, "image/webp", r.h, `${IMG}/photo-5.webp`));
    return { response: respRow(r), files };
  },
  convText: (b) => {
    const r = RESPONSES.find((x) => x.id === b.id);
    if (!r) return { text: "" };
    const lines: [string, string][] = [["MYITHRI", `Hello ${r.name}, I'm Myithri, an AI assistant for ${ORG.org.name}. Thank you for talking with me.`]];
    r.answers.forEach(([q, , quote]) => lines.push(["MYITHRI", q], [r.name.toUpperCase(), quote]));
    lines.push(["MYITHRI", "Thank you, that's really helpful. I'll pass this on to the team."]);
    return { text: transcript(lines) };
  },
  convLog: () => ({ text: "10:02:11 page opened (Android, Chrome)\n10:02:15 consent given\n10:02:16 microphone allowed\n10:02:18 connected\n10:11:40 conversation ended\n10:11:44 recording saved" }),
  convInsights: (b) => ({ insights: INSIGHTS[String(b.id)] || null }),
  impactStatus: (b) => {
    if (b.conv) return { job: null, stories: CONVS.find((c) => c.id === b.conv)?.counts.analysed || 0, report: null };
    if (b.pages === "first") return { ...IMPACT, report: { ...IMPACT.report, pages: IMPACT.report.pages.slice(0, 1) } };
    if (b.pages === "all") return IMPACT;
    return { ...IMPACT, report: { ...IMPACT.report, pages: [] } };
  },
  followDone: (b) => {
    const id = String(b.id);
    if (b.undo) delete followed[id];
    else followed[id] = new Date().toISOString();
    return { id, followedUp: !b.undo };
  },
  report: () => ({ saved: true }),
  blob: (b) => pdfFile(String(b.id), `${PEOPLE.find((p) => p.id === b.id)?.name || "Story"} - Impact Story.pdf`),
  impactPdf: () => pdfFile("impact", "Demo Trust - Impact report.pdf"),
};

function list() {
  return { players: PEOPLE.map(player), linkBase: SITE, tz: "Asia/Kolkata", now: new Date().toISOString() };
}

/** The sample PDFs sit next to the demo images. */
async function pdfFile(id: string, name: string) {
  const res = await fetch(`${IMG}/${id}.pdf`);
  if (!res.ok) throw new StoryApiError("This PDF isn't included in the demo.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name, mime: "application/pdf", data: btoa(bin) };
}

/** Answers an admin request from the sample data, after a short pause like the real thing. */
export async function demoAdmin<T>(op: string, body: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 250));
  const fn = READ[op];
  if (!fn) throw new StoryApiError(DEMO_NOTE);
  return (await fn(body)) as T;
}
