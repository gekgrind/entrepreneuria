"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clipboard, Download, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Phase = "write" | "screen" | "interview";

type SkillMatchItem = {
  skill: string;
  status: "Confirmed" | "Partial" | "Not Evidenced";
  note: string;
};
type ScreeningData = {
  matchScore: number;
  summary: string;
  skillsMatch: SkillMatchItem[];
  strengths: string[];
  concerns: string[];
  cultureFitAssessment: string;
  recommendation:
    | "Advance to Interview"
    | "Advance with Reservations"
    | "Request More Information"
    | "Do Not Advance";
  recommendationRationale: string;
  followUpQuestions: string[];
};

type InterviewData = {
  categories: {
    categoryName: string;
    categoryIcon: string;
    questions: {
      question: string;
      whyAsk: string;
      strongAnswer: string;
      redFlag: string;
    }[];
  }[];
  beforeInterview: string[];
  scoringRubric: { criterion: string; description: string }[];
  illegalQuestionsToAvoid?: {
    category: string;
    examples: string;
    note: string;
  }[];
};

type ShortlistCandidate = {
  name: string;
  score: number;
  recommendation: string;
};

const STORAGE_KEY = "hiring-assistant-state-v1";

const phaseOrder: Phase[] = ["write", "screen", "interview"];

export default function HiringAssistantPage() {
  const [activeTab, setActiveTab] = useState<Phase>("write");
  const [lastTab, setLastTab] = useState<Phase>("write");

  const [jobForm, setJobForm] = useState({
    title: "",
    employmentType: "Freelancer / Contractor",
    workArrangement: "Remote",
    compensation: "",
    experienceLevel: "Mid Level (2–5 years)",
    responsibilities: "",
    requiredSkills: "",
    bonusSkills: "",
    companyName: "",
    companyDescription: "",
    tone: "Warm & Personality-Driven",
    includeEeo: true,
    includeApplicationInstructions: true,
    applicationInstructions: "",
  });
  const [jobDescription, setJobDescription] = useState("");
  const [jobCoachingNote, setJobCoachingNote] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobParseFallback, setJobParseFallback] = useState<string | null>(null);
  const [jobEditMode, setJobEditMode] = useState(false);

  const [screenForm, setScreenForm] = useState({
    title: "",
    requirements: "",
    mustHaves: "",
    cultureWeighting: "Balanced (50/50)",
    candidateName: "",
    informationType: "Resume Text",
    candidateText: "",
    concerns: "",
  });
  const [screenLoading, setScreenLoading] = useState(false);
  const [screeningData, setScreeningData] = useState<ScreeningData | null>(
    null,
  );
  const [screenParseFallback, setScreenParseFallback] = useState<string | null>(
    null,
  );
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);

  const [interviewForm, setInterviewForm] = useState({
    title: "",
    requirements: "",
    format: "Full Interview (45–60 min)",
    focus: "Balanced (skills + culture + experience)",
    concerns: "",
    candidate: "General (no specific candidate)",
    includeIllegalQuestions: true,
  });
  const [interviewData, setInterviewData] = useState<InterviewData | null>(
    null,
  );
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewParseFallback, setInterviewParseFallback] = useState<
    string | null
  >(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.activeTab) setActiveTab(saved.activeTab);
      if (saved.jobForm) setJobForm(saved.jobForm);
      if (saved.jobDescription) setJobDescription(saved.jobDescription);
      if (saved.jobCoachingNote) setJobCoachingNote(saved.jobCoachingNote);
      if (saved.screenForm) setScreenForm(saved.screenForm);
      if (saved.screeningData) setScreeningData(saved.screeningData);
      if (saved.shortlist) setShortlist(saved.shortlist);
      if (saved.interviewForm) setInterviewForm(saved.interviewForm);
      if (saved.interviewData) setInterviewData(saved.interviewData);
    } catch {
      // ignore bad storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeTab,
        jobForm,
        jobDescription,
        jobCoachingNote,
        screenForm,
        screeningData,
        shortlist,
        interviewForm,
        interviewData,
      }),
    );
  }, [
    activeTab,
    interviewData,
    interviewForm,
    jobCoachingNote,
    jobDescription,
    jobForm,
    screenForm,
    screeningData,
    shortlist,
  ]);

  const contextPills = useMemo(() => {
    return [
      ...jobForm.responsibilities.split(/[\n,]/),
      ...jobForm.requiredSkills.split(/[\n,]/),
    ]
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [jobForm.requiredSkills, jobForm.responsibilities]);

  const phaseCompletion = {
    write: Boolean(jobDescription && jobForm.title),
    screen: Boolean(screeningData),
    interview: Boolean(interviewData),
  };

  useEffect(() => {
    if (phaseCompletion.write) {
      const requirements = [jobForm.responsibilities, jobForm.requiredSkills]
        .filter(Boolean)
        .join("\n");
      setScreenForm((prev) => ({
        ...prev,
        title: prev.title || jobForm.title,
        requirements: prev.requirements || requirements,
        mustHaves: prev.mustHaves || jobForm.requiredSkills,
      }));
      setInterviewForm((prev) => ({
        ...prev,
        title: prev.title || jobForm.title,
        requirements: prev.requirements || requirements,
      }));
    }
  }, [
    jobForm.requiredSkills,
    jobForm.responsibilities,
    jobForm.title,
    phaseCompletion.write,
  ]);

  const callApi = async (type: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/hiring-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });

    if (!res.ok)
      throw new Error(
        "Something went wrong. Your next great hire is still out there — try again.",
      );
    return res.json();
  };

  const generateJobDescription = async () => {
    setError(null);
    setJobParseFallback(null);
    setJobLoading(true);
    try {
      const result = await callApi("job-description", jobForm);
      if (result.parseError) {
        setJobParseFallback(result.raw);
        setJobDescription(result.raw);
        setJobCoachingNote(
          "AI output could not be structured as expected. Edit this draft directly and regenerate if needed.",
        );
        return;
      }

      setJobDescription(result.data.jobDescriptionMarkdown ?? "");
      setJobCoachingNote(result.data.aiCoachingNote ?? "");
      setActiveTab("screen");
      setLastTab("write");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJobLoading(false);
    }
  };

  const screenCandidate = async () => {
    setError(null);
    setScreenParseFallback(null);
    setScreenLoading(true);
    try {
      const result = await callApi("screening", screenForm);
      if (result.parseError) {
        setScreenParseFallback(result.raw);
        setScreeningData(null);
        return;
      }
      setScreeningData(result.data as ScreeningData);
      setLastTab("screen");
      setActiveTab("interview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScreenLoading(false);
    }
  };

  const generateInterview = async () => {
    setError(null);
    setInterviewParseFallback(null);
    setInterviewLoading(true);
    try {
      const selected = shortlist.find(
        (s) => s.name === interviewForm.candidate,
      );
      const result = await callApi("interview-questions", {
        ...interviewForm,
        candidateContext: selected
          ? `${selected.name} scored ${selected.score}. Recommendation: ${selected.recommendation}`
          : "General role-based interview",
      });
      if (result.parseError) {
        setInterviewParseFallback(result.raw);
        setInterviewData(null);
        return;
      }
      setInterviewData(result.data as InterviewData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleTabChange = (next: Phase) => {
    setLastTab(activeTab);
    setActiveTab(next);
  };

  const addToShortlist = () => {
    if (!screeningData || !screenForm.candidateName) return;
    if (
      !["Advance to Interview", "Advance with Reservations"].includes(
        screeningData.recommendation,
      )
    )
      return;
    setShortlist((prev) => {
      if (
        prev.some((p) => p.name === screenForm.candidateName) ||
        prev.length >= 10
      )
        return prev;
      return [
        ...prev,
        {
          name: screenForm.candidateName,
          score: screeningData.matchScore,
          recommendation: screeningData.recommendation,
        },
      ];
    });
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const printPage = () => window.print();

  const recommendationColor = (rec?: string) => {
    if (rec === "Advance to Interview")
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
    if (rec === "Advance with Reservations")
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
    if (rec === "Request More Information")
      return "bg-orange-500/20 text-orange-300 border-orange-500/50";
    return "bg-red-500/20 text-red-300 border-red-500/50";
  };

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#081527] text-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-2xl border border-white/10 bg-[#111527] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1
                  className="text-4xl font-semibold tracking-tight"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  Hiring Assistant
                </h1>
                <p className="text-white/75">
                  Hire smarter. Build your team without the HR department.
                </p>
              </div>
              <Badge className="bg-[#d27a2c]/20 text-[#ffb19e] border border-[#d27a2c]/40 animate-pulse">
                AI Hiring Suite
              </Badge>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                key: "write",
                title: "01 · Write",
                desc: "Craft your job description",
              },
              {
                key: "screen",
                title: "02 · Screen",
                desc: "Analyze candidates quickly",
              },
              {
                key: "interview",
                title: "03 · Interview",
                desc: "Build your question guide",
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key as Phase)}
                className={`rounded-xl border p-4 text-left transition ${activeTab === tab.key ? "-translate-y-0.5 border-[#d27a2c] bg-[#1a1f36]" : "border-white/10 bg-[#12172b]"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{tab.title}</p>
                  {phaseCompletion[tab.key as Phase] ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="rounded-full bg-emerald-500/20 p-1">
                          <Check className="h-4 w-4 text-emerald-300" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Phase complete</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-white/65">{tab.desc}</p>
                {activeTab === tab.key ? (
                  <div className="mt-3 h-0.5 w-full bg-[#d27a2c]" />
                ) : null}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {phaseCompletion.write && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-[#d27a2c]/40 bg-[#141a31] p-3"
              >
                <p className="text-sm text-white/70">
                  Active Role:{" "}
                  <span className="font-semibold text-white">
                    {jobForm.title || "Untitled role"}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contextPills.map((pill) => (
                    <Badge
                      key={pill}
                      className="bg-[#d27a2c]/20 text-[#ffc2b4]"
                    >
                      {pill}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.section
              key={activeTab}
              initial={{
                opacity: 0,
                x:
                  phaseOrder.indexOf(activeTab) >= phaseOrder.indexOf(lastTab)
                    ? 24
                    : -24,
              }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === "write" && (
                <Card className="border-[#d27a2c]/30 bg-[#14182d]">
                  <CardHeader>
                    <CardTitle>
                      Write a job description that attracts exactly who you
                      need.
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section className="space-y-3">
                      <p className="font-semibold text-[#ffb29e]">The Role</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          placeholder='e.g., "Social Media Manager"'
                          value={jobForm.title}
                          onChange={(e) =>
                            setJobForm({ ...jobForm, title: e.target.value })
                          }
                        />
                        <Select
                          value={jobForm.employmentType}
                          onValueChange={(value) =>
                            setJobForm({ ...jobForm, employmentType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Full-Time Employee",
                              "Part-Time Employee",
                              "Freelancer / Contractor",
                              "Virtual Assistant",
                              "Intern",
                              "Co-Founder / Equity Partner",
                            ].map((x) => (
                              <SelectItem key={x} value={x}>
                                {x}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={jobForm.workArrangement}
                          onValueChange={(value) =>
                            setJobForm({ ...jobForm, workArrangement: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Remote", "Hybrid", "In-Person", "Flexible"].map(
                              (x) => (
                                <SelectItem key={x} value={x}>
                                  {x}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder='e.g., "$25–$35/hr"'
                          value={jobForm.compensation}
                          onChange={(e) =>
                            setJobForm({
                              ...jobForm,
                              compensation: e.target.value,
                            })
                          }
                        />
                        <Select
                          value={jobForm.experienceLevel}
                          onValueChange={(value) =>
                            setJobForm({ ...jobForm, experienceLevel: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Entry Level (0–2 years)",
                              "Mid Level (2–5 years)",
                              "Senior (5+ years)",
                              "Expert / Specialist",
                              "No Experience Required",
                            ].map((x) => (
                              <SelectItem key={x} value={x}>
                                {x}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <p className="font-semibold text-[#ffb29e]">
                        What They&apos;ll Do
                      </p>
                      <Textarea
                        placeholder="List the 3–5 most important responsibilities for this role"
                        value={jobForm.responsibilities}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            responsibilities: e.target.value,
                          })
                        }
                      />
                      <Textarea
                        placeholder="What skills, tools, or experience are required?"
                        value={jobForm.requiredSkills}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            requiredSkills: e.target.value,
                          })
                        }
                      />
                      <Textarea
                        placeholder="What skills or experience are a bonus but not required?"
                        value={jobForm.bonusSkills}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            bonusSkills: e.target.value,
                          })
                        }
                      />
                    </section>

                    <section className="space-y-3">
                      <p className="font-semibold text-[#ffb29e]">
                        Your Company & Culture
                      </p>
                      <Input
                        placeholder="Company or brand name"
                        value={jobForm.companyName}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            companyName: e.target.value,
                          })
                        }
                      />
                      <Textarea
                        placeholder="Describe your company, mission, and culture in 2–3 sentences"
                        value={jobForm.companyDescription}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            companyDescription: e.target.value,
                          })
                        }
                      />
                      <Select
                        value={jobForm.tone}
                        onValueChange={(value) =>
                          setJobForm({ ...jobForm, tone: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Professional & Formal",
                            "Warm & Personality-Driven",
                            "Bold & Direct",
                            "Startup Energy",
                            "Creative & Expressive",
                          ].map((x) => (
                            <SelectItem key={x} value={x}>
                              {x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={jobForm.includeEeo}
                            onCheckedChange={(checked) =>
                              setJobForm({
                                ...jobForm,
                                includeEeo: Boolean(checked),
                              })
                            }
                          />
                          <Label>
                            Include an equal opportunity employer statement
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={jobForm.includeApplicationInstructions}
                            onCheckedChange={(checked) =>
                              setJobForm({
                                ...jobForm,
                                includeApplicationInstructions:
                                  Boolean(checked),
                              })
                            }
                          />
                          <Label>
                            Include application instructions at the end
                          </Label>
                        </div>
                        {jobForm.includeApplicationInstructions && (
                          <Input
                            placeholder="How should candidates apply?"
                            value={jobForm.applicationInstructions}
                            onChange={(e) =>
                              setJobForm({
                                ...jobForm,
                                applicationInstructions: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    </section>

                    <Button
                      className="bg-[#d27a2c] hover:bg-[#ce553a]"
                      onClick={generateJobDescription}
                      disabled={jobLoading}
                    >
                      {jobLoading
                        ? "Writing your job description..."
                        : "Generate Job Description →"}
                    </Button>
                    <p className="text-sm text-white/60">
                      Your AI-generated job description is a strong starting
                      point — personalize it to match your voice before posting.
                    </p>

                    {jobDescription && (
                      <Card className="border-white/15 bg-[#0f1327]">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>Generated Job Description</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => copyText(jobDescription)}
                            >
                              <Clipboard className="mr-1 h-4 w-4" />
                              Copy Job Description
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={printPage}
                            >
                              <Download className="mr-1 h-4 w-4" />
                              Download as PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setJobEditMode((p) => !p)}
                            >
                              {jobEditMode ? "Done Editing" : "Edit"}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {jobEditMode ? (
                            <Textarea
                              value={jobDescription}
                              onChange={(e) =>
                                setJobDescription(e.target.value)
                              }
                              className="min-h-[360px]"
                            />
                          ) : (
                            <div className="whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0b1022] p-4 text-sm leading-relaxed">
                              {jobDescription}
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Select
                              value={jobForm.tone}
                              onValueChange={(value) =>
                                setJobForm({ ...jobForm, tone: value })
                              }
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  "Professional & Formal",
                                  "Warm & Personality-Driven",
                                  "Bold & Direct",
                                  "Startup Energy",
                                  "Creative & Expressive",
                                ].map((x) => (
                                  <SelectItem key={x} value={x}>
                                    {x}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              onClick={generateJobDescription}
                            >
                              Regenerate
                            </Button>
                          </div>
                          <Card className="mt-4 border-[#d27a2c]/40 bg-[#d27a2c]/10">
                            <CardContent className="pt-4">
                              <p className="font-semibold">AI Coaching Note</p>
                              <p className="text-sm text-white/85">
                                {jobCoachingNote}
                              </p>
                            </CardContent>
                          </Card>
                          {jobParseFallback ? (
                            <p className="mt-3 text-xs text-amber-300">
                              Fallback mode: JSON parsing failed, showing raw
                              model output.
                            </p>
                          ) : null}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeTab === "screen" && (
                <Card className="border-[#89b4ff]/30 bg-[#12182e]">
                  <CardHeader>
                    <CardTitle>
                      Evaluate candidates fast. Let AI do the heavy lifting.
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="bg-[#0f1430] border-white/15">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Role Requirements
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Input
                            placeholder="Role title"
                            value={screenForm.title}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                title: e.target.value,
                              })
                            }
                          />
                          <Textarea
                            placeholder="Key requirements for this role"
                            value={screenForm.requirements}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                requirements: e.target.value,
                              })
                            }
                          />
                          <Textarea
                            placeholder="Must-have qualifications"
                            value={screenForm.mustHaves}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                mustHaves: e.target.value,
                              })
                            }
                          />
                          <Select
                            value={screenForm.cultureWeighting}
                            onValueChange={(value) =>
                              setScreenForm({
                                ...screenForm,
                                cultureWeighting: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "Skills First (70% skills, 30% fit)",
                                "Balanced (50/50)",
                                "Culture First (30% skills, 70% fit)",
                              ].map((x) => (
                                <SelectItem key={x} value={x}>
                                  {x}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                      <Card className="bg-[#0f1430] border-white/15">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Candidate Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Input
                            placeholder="Candidate name"
                            value={screenForm.candidateName}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                candidateName: e.target.value,
                              })
                            }
                          />
                          <Select
                            value={screenForm.informationType}
                            onValueChange={(value) =>
                              setScreenForm({
                                ...screenForm,
                                informationType: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "Resume Text",
                                "LinkedIn Bio",
                                "Application Response",
                                "Interview Notes",
                                "Mixed / Other",
                              ].map((x) => (
                                <SelectItem key={x} value={x}>
                                  {x}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            className="min-h-[220px]"
                            placeholder="Paste candidate information here"
                            value={screenForm.candidateText}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                candidateText: e.target.value,
                              })
                            }
                          />
                          <Input
                            placeholder="Any specific concerns or things to evaluate?"
                            value={screenForm.concerns}
                            onChange={(e) =>
                              setScreenForm({
                                ...screenForm,
                                concerns: e.target.value,
                              })
                            }
                          />
                        </CardContent>
                      </Card>
                    </div>
                    <Button
                      className="bg-[#d27a2c] hover:bg-[#ce553a]"
                      onClick={screenCandidate}
                      disabled={screenLoading}
                    >
                      {screenLoading
                        ? `Screening ${screenForm.candidateName || "candidate"}...`
                        : "Screen This Candidate →"}
                    </Button>
                    <p className="text-sm text-white/60">
                      Screening analysis is AI-generated and should complement —
                      not replace — your own judgment.
                    </p>

                    {screenParseFallback ? (
                      <Card className="border-amber-500/50 bg-amber-500/10">
                        <CardContent className="pt-4">
                          <p className="font-semibold">Fallback Output</p>
                          <pre className="mt-2 whitespace-pre-wrap text-xs">
                            {screenParseFallback}
                          </pre>
                        </CardContent>
                      </Card>
                    ) : null}

                    {screeningData && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <Card className="bg-[#0f1430] border-white/15">
                          <CardContent className="pt-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-white/70">
                                  {screenForm.candidateName} ·{" "}
                                  {screenForm.title} ·{" "}
                                  {screenForm.informationType}
                                </p>
                                <p className="text-4xl font-semibold text-[#d27a2c]">
                                  {Math.round(screeningData.matchScore)}%
                                </p>
                              </div>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge
                                    className={`border px-3 py-1 animate-pulse ${recommendationColor(screeningData.recommendation)}`}
                                  >
                                    {screeningData.recommendation}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {screeningData.recommendation ===
                                  "Advance to Interview"
                                    ? "Ready to interview"
                                    : screeningData.recommendation ===
                                        "Advance with Reservations"
                                      ? "Proceed carefully"
                                      : screeningData.recommendation ===
                                          "Request More Information"
                                        ? "Need more info"
                                        : "Not the right fit"}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <p className="mt-3 font-medium">
                              {screeningData.summary}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="bg-[#0f1430] border-white/15">
                          <CardHeader>
                            <CardTitle className="text-base">
                              Skills Match
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {screeningData.skillsMatch.map((item, i) => (
                              <motion.div
                                key={`${item.skill}-${i}`}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className="rounded border border-white/10 p-3"
                              >
                                <p className="font-medium">
                                  {item.status === "Confirmed"
                                    ? "✅"
                                    : item.status === "Partial"
                                      ? "⚠️"
                                      : "❌"}{" "}
                                  {item.skill}
                                </p>
                                <p className="text-sm text-white/70">
                                  {item.note}
                                </p>
                              </motion.div>
                            ))}
                          </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="bg-[#0f1430] border-white/15">
                            <CardHeader>
                              <CardTitle className="text-base">
                                Strengths
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc space-y-1 pl-5 text-sm">
                                {screeningData.strengths.map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                          <Card className="bg-[#0f1430] border-white/15">
                            <CardHeader>
                              <CardTitle className="text-base">
                                Concerns & Gaps
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc space-y-1 pl-5 text-sm">
                                {screeningData.concerns.map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                        <Card className="bg-[#0f1430] border-white/15">
                          <CardHeader>
                            <CardTitle className="text-base">
                              Culture Fit Assessment
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-white/90">
                              {screeningData.cultureFitAssessment}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1430] border-white/15">
                          <CardHeader>
                            <CardTitle className="text-base">
                              Recommendation
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-white/90">
                              {screeningData.recommendationRationale}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#0f1430] border-white/15">
                          <CardHeader>
                            <CardTitle className="text-base">
                              Suggested Follow-Up Questions
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                              {screeningData.followUpQuestions.map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setScreenForm({
                                ...screenForm,
                                candidateName: "",
                                candidateText: "",
                                concerns: "",
                                informationType: "Resume Text",
                              })
                            }
                          >
                            Screen Another Candidate
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              copyText(JSON.stringify(screeningData, null, 2))
                            }
                          >
                            Copy Report
                          </Button>
                          <Button
                            className="bg-[#d27a2c] hover:bg-[#ce553a]"
                            onClick={addToShortlist}
                          >
                            Add to Shortlist
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    <Card className="bg-[#0f1430] border-white/15">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Your Shortlist</CardTitle>
                        <Badge>
                          {shortlist.length} candidates ready for interview.
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        {shortlist.length === 0 ? (
                          <p className="text-sm text-white/60">
                            No candidates shortlisted yet. Screen your first
                            candidate above.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {shortlist.map((candidate) => (
                              <motion.div
                                key={candidate.name}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between rounded border border-white/10 p-3"
                              >
                                <div>
                                  <p className="font-medium">
                                    {candidate.name}
                                  </p>
                                  <p className="text-xs text-white/70">
                                    {candidate.score}% match
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setShortlist((prev) =>
                                      prev.filter(
                                        (x) => x.name !== candidate.name,
                                      ),
                                    )
                                  }
                                >
                                  Remove
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              )}

              {activeTab === "interview" && (
                <Card className="border-[#d27a2c]/30 bg-[#12182e]">
                  <CardHeader>
                    <CardTitle>
                      Walk into every interview with the right questions — and
                      know what good answers look like.
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      placeholder="Role title"
                      value={interviewForm.title}
                      onChange={(e) =>
                        setInterviewForm({
                          ...interviewForm,
                          title: e.target.value,
                        })
                      }
                    />
                    <Textarea
                      placeholder="Key responsibilities and requirements"
                      value={interviewForm.requirements}
                      onChange={(e) =>
                        setInterviewForm({
                          ...interviewForm,
                          requirements: e.target.value,
                        })
                      }
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select
                        value={interviewForm.format}
                        onValueChange={(value) =>
                          setInterviewForm({ ...interviewForm, format: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Full Interview (45–60 min)",
                            "Short Screen Call (20–30 min)",
                            "Async / Written Interview",
                            "Panel Interview",
                            "Working Interview / Skills Test",
                          ].map((x) => (
                            <SelectItem key={x} value={x}>
                              {x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={interviewForm.focus}
                        onValueChange={(value) =>
                          setInterviewForm({ ...interviewForm, focus: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Balanced (skills + culture + experience)",
                            "Skills & Technical Focus",
                            "Culture & Values Focus",
                            "Problem-Solving & Thinking Style",
                            "Experience & Track Record",
                          ].map((x) => (
                            <SelectItem key={x} value={x}>
                              {x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Any specific topics, skills, or concerns to cover?"
                      value={interviewForm.concerns}
                      onChange={(e) =>
                        setInterviewForm({
                          ...interviewForm,
                          concerns: e.target.value,
                        })
                      }
                    />
                    <Select
                      value={interviewForm.candidate}
                      onValueChange={(value) =>
                        setInterviewForm({ ...interviewForm, candidate: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General (no specific candidate)">
                          General (no specific candidate)
                        </SelectItem>
                        {shortlist.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={interviewForm.includeIllegalQuestions}
                        onCheckedChange={(checked) =>
                          setInterviewForm({
                            ...interviewForm,
                            includeIllegalQuestions: Boolean(checked),
                          })
                        }
                      />
                      <Label>Include illegal questions to avoid</Label>
                    </div>
                    {!phaseCompletion.write ? (
                      <p className="text-sm text-white/60">
                        Complete Phase 1 first to auto-populate your role
                        details — or enter them manually above.
                      </p>
                    ) : null}
                    <Button
                      className="bg-[#d27a2c] hover:bg-[#ce553a]"
                      onClick={generateInterview}
                      disabled={interviewLoading}
                    >
                      {interviewLoading
                        ? "Building your interview guide..."
                        : "Generate Interview Questions →"}
                    </Button>

                    {interviewParseFallback ? (
                      <Card className="border-amber-500/50 bg-amber-500/10">
                        <CardContent className="pt-4">
                          <p className="font-semibold">Fallback Output</p>
                          <pre className="mt-2 whitespace-pre-wrap text-xs">
                            {interviewParseFallback}
                          </pre>
                        </CardContent>
                      </Card>
                    ) : null}

                    {interviewData && (
                      <div className="space-y-4">
                        {interviewData.categories.map((category, i) => (
                          <motion.div
                            key={category.categoryName}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                          >
                            <Card className="bg-[#0f1430] border-white/15">
                              <CardHeader>
                                <CardTitle>
                                  {category.categoryIcon}{" "}
                                  {category.categoryName}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {category.questions.map((q, qi) => {
                                  const key = `${category.categoryName}-${qi}`;
                                  const open = !!expandedCards[key];
                                  return (
                                    <Card
                                      key={key}
                                      className="border-white/10 bg-[#111832]"
                                    >
                                      <CardContent className="pt-4 space-y-2">
                                        <p className="font-semibold">
                                          {q.question}
                                        </p>
                                        <p className="text-sm text-white/80">
                                          Why ask this: {q.whyAsk}
                                        </p>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              setExpandedCards((prev) => ({
                                                ...prev,
                                                [key]: !prev[key],
                                              }))
                                            }
                                          >
                                            {open
                                              ? "Hide guidance"
                                              : "Show guidance"}
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => copyText(q.question)}
                                          >
                                            <Clipboard className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        {open ? (
                                          <div className="space-y-2 text-sm">
                                            <p>
                                              <span className="font-semibold">
                                                What a strong answer looks like:
                                              </span>{" "}
                                              {q.strongAnswer}
                                            </p>
                                            <p>
                                              <span className="font-semibold">
                                                What a red flag answer looks
                                                like:
                                              </span>{" "}
                                              {q.redFlag}
                                            </p>
                                          </div>
                                        ) : null}
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}

                        <div className="grid gap-4 md:grid-cols-2">
                          <Card className="bg-[#0f1430] border-white/15">
                            <CardHeader>
                              <CardTitle>Before the Interview</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc space-y-1 pl-5 text-sm">
                                {interviewData.beforeInterview.map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                          <Card className="bg-[#0f1430] border-white/15">
                            <CardHeader className="flex flex-row items-center justify-between">
                              <CardTitle>Scoring Rubric Template</CardTitle>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  copyText(
                                    JSON.stringify(
                                      interviewData.scoringRubric,
                                      null,
                                      2,
                                    ),
                                  )
                                }
                              >
                                Copy
                              </Button>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2 text-sm">
                                {interviewData.scoringRubric.map((x, i) => (
                                  <li key={i}>
                                    <span className="font-semibold">
                                      {x.criterion}:
                                    </span>{" "}
                                    {x.description}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>

                        {interviewForm.includeIllegalQuestions &&
                        interviewData.illegalQuestionsToAvoid?.length ? (
                          <Card className="border-amber-500/60 bg-amber-500/10">
                            <CardHeader>
                              <CardTitle>Illegal Questions to Avoid</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              {interviewData.illegalQuestionsToAvoid.map(
                                (x, i) => (
                                  <div key={i}>
                                    <p className="font-semibold">
                                      {x.category}
                                    </p>
                                    <p>Examples: {x.examples}</p>
                                    <p className="text-white/75">{x.note}</p>
                                  </div>
                                ),
                              )}
                            </CardContent>
                          </Card>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              copyText(JSON.stringify(interviewData, null, 2))
                            }
                          >
                            Copy Full Interview Guide
                          </Button>
                          <Button variant="secondary" onClick={printPage}>
                            Download as PDF
                          </Button>
                          <Button variant="outline" onClick={generateInterview}>
                            <Sparkles className="mr-1 h-4 w-4" />
                            Regenerate Questions
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
    </TooltipProvider>
  );
}
