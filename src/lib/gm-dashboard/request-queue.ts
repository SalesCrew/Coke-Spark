export type DashboardPriority = 0 | 1 | 2;
type Job = {
  priority: DashboardPriority;
  started: boolean;
  promise: Promise<unknown>;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

// Two slots, at most one speculative read. Visible/user work retains a slot.
// Completed reads are shared for this page/actor; failures can be retried.
export class DashboardRequestQueue {
  private jobs = new Map<string, Job>();
  private active = 0;
  private backgroundActive = 0;
  private backgroundReady = false;
  private disposed = false;
  private generation = 0;

  request<T>(key: string, run: () => Promise<T>, priority: DashboardPriority): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("Dashboard wurde geschlossen."));
    const existing = this.jobs.get(key);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority) as DashboardPriority;
      this.pump();
      return existing.promise as Promise<T>;
    }
    let resolve!: Job["resolve"], reject!: Job["reject"];
    const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
    this.jobs.set(key, { priority, started: false, promise, run, resolve, reject });
    // Collect same-render requests before choosing priorities.
    queueMicrotask(() => this.pump());
    return promise as Promise<T>;
  }

  allowBackground() { this.backgroundReady = true; this.pump(); }
  promote(key: string, priority: DashboardPriority) {
    const job = this.jobs.get(key);
    if (job) job.priority = Math.min(job.priority, priority) as DashboardPriority;
    this.pump();
  }
  promoteAll() {
    for (const job of this.jobs.values()) if (!job.started) job.priority = 1;
    this.pump();
  }
  resume() { this.disposed = false; }
  pause() { this.disposed = true; }
  dispose() {
    this.disposed = true;
    this.generation++;
    for (const job of this.jobs.values()) job.reject(new Error("Dashboard wurde geschlossen."));
    this.jobs.clear();
    this.active = this.backgroundActive = 0;
    this.backgroundReady = false;
  }

  private pump() {
    if (this.disposed) return;
    while (this.active < 2) {
      const entry = [...this.jobs.entries()]
        .filter(([, j]) => !j.started && (j.priority < 2 || (this.backgroundReady && !this.backgroundActive)))
        .sort((a, b) => a[1].priority - b[1].priority)[0];
      if (!entry) return;
      const [key, job] = entry;
      const background = job.priority === 2, generation = this.generation;
      job.started = true;
      this.active++;
      if (background) this.backgroundActive++;
      void Promise.resolve().then(job.run).then(job.resolve, (error) => {
        if (this.jobs.get(key) === job) this.jobs.delete(key);
        job.reject(error);
      }).finally(() => {
        if (generation !== this.generation) return;
        this.active--;
        if (background) this.backgroundActive--;
        this.pump();
      });
    }
  }
}
