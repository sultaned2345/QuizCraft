import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Clock, Target, TrendingUp, CheckCircle2, Calendar } from "lucide-react"

export default function DashboardPage() {
  const subjects = [
    { name: "Mathematics", progress: 75, nextSession: "Today, 2:00 PM", color: "bg-primary" },
    { name: "Physics", progress: 60, nextSession: "Tomorrow, 10:00 AM", color: "bg-secondary" },
    { name: "Literature", progress: 85, nextSession: "Today, 4:30 PM", color: "bg-accent" },
  ]

  const todayTasks = [
    { task: "Complete Chapter 5 exercises", subject: "Math", done: true },
    { task: "Review Newton's Laws", subject: "Physics", done: true },
    { task: "Read pages 45-60", subject: "Literature", done: false },
    { task: "Practice problem sets", subject: "Math", done: false },
  ]

  return (
    <main className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/90 text-primary-foreground shadow-sm">
                <BookOpen className="h-5 w-5" />
              </div>
              <h1 className="font-serif text-2xl font-normal text-foreground tracking-tight">QuizCraft</h1>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-border/60 bg-card hover:bg-muted/50">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h2 className="font-serif text-4xl font-light text-foreground text-balance mb-3 tracking-tight">
            Good afternoon, Scholar
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            {"You're making great progress. Let's keep the momentum going!"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1.5 font-medium">Study Streak</p>
              <p className="font-serif text-3xl font-light text-foreground tracking-tight">12 days</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/25">
                  <Clock className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1.5 font-medium">Today</p>
              <p className="font-serif text-3xl font-light text-foreground tracking-tight">3.5 hrs</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/40">
                  <CheckCircle2 className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1.5 font-medium">Tasks Done</p>
              <p className="font-serif text-3xl font-light text-foreground tracking-tight">8/12</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1.5 font-medium">This Week</p>
              <p className="font-serif text-3xl font-light text-foreground tracking-tight">18 hrs</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Subjects Progress */}
          <div className="lg:col-span-2">
            <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-2xl font-light text-foreground tracking-tight">
                  Your Subjects
                </CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed text-base">
                  Track your progress across all subjects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-7">
                {subjects.map((subject) => (
                  <div key={subject.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-serif text-lg font-normal text-foreground tracking-tight">
                          {subject.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{subject.nextSession}</p>
                      </div>
                      <span className="font-serif text-lg font-normal text-foreground tracking-tight">
                        {subject.progress}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${subject.color}`}
                        style={{ width: `${subject.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
                <Button className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm mt-6 h-11 font-medium">
                  Start Study Session
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Today's Tasks */}
          <div>
            <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="font-serif text-2xl font-light text-foreground tracking-tight">
                  {"Today's Tasks"}
                </CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed text-base">
                  Stay on track with your goals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {todayTasks.map((item, index) => (
                  <div key={index} className="flex items-start gap-3.5">
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        item.done ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p
                        className={`text-sm leading-relaxed ${
                          item.done ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {item.task}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">{item.subject}</p>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full rounded-xl mt-6 h-11 border-border/60 bg-card hover:bg-muted/50"
                >
                  Add Task
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/25 group-hover:bg-secondary/35 transition-colors">
                  <BookOpen className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-normal text-foreground tracking-tight">Flashcards</h3>
                  <p className="text-sm text-muted-foreground">Review your notes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-normal text-foreground tracking-tight">Pomodoro Timer</h3>
                  <p className="text-sm text-muted-foreground">Focus sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-border/60 bg-card hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/40 group-hover:bg-accent/50 transition-colors">
                  <TrendingUp className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-normal text-foreground tracking-tight">Progress Report</h3>
                  <p className="text-sm text-muted-foreground">View analytics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}