'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { INDUSTRIES } from '@innovationos/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(5, 'Min 5 characters').max(120, 'Max 120 characters'),
  description: z.string().min(50, 'Min 50 characters').max(2000, 'Max 2000 characters'),
  problemStatement: z.string().min(20, 'Min 20 characters').max(1000, 'Max 1000 characters'),
  targetAudience: z.string().min(10, 'Min 10 characters').max(500, 'Max 500 characters'),
  industry: z.string().min(1, 'Select an industry'),
  goals: z.string().min(20, 'Min 20 characters').max(1000, 'Max 1000 characters'),
});

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors';

const errorClass = 'mt-1 text-xs text-red-400';

const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

export default function HomePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedFields = watch([
    'title',
    'description',
    'problemStatement',
    'targetAudience',
    'goals',
  ]);

  const charCount = (index: number, max: number) => {
    const val = watchedFields[index] ?? '';
    return `${val.length} / ${max}`;
  };

  async function onSubmit(data: FormData) {
    setSubmitError(null);
    try {
      const project = await api.createProject(data as Record<string, string>);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Hero */}
      <div className="text-center pt-16 pb-10 px-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-primary font-medium">4 AI Agents Ready</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight">
          Turn Your Idea into a{' '}
          <span className="text-primary">Startup</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Our AI agents validate your idea, analyse competitors, build your roadmap, and assess
          feasibility — all in minutes.
        </p>
      </div>

      {/* Form card */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-foreground mb-6">Describe Your Idea</h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            {/* Title */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor="title" className={labelClass}>
                  Project Title <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{charCount(0, 120)}</span>
              </div>
              <input
                id="title"
                type="text"
                placeholder="e.g. AI-powered study planner for university students"
                className={cn(inputClass, errors.title && 'border-red-500 focus:ring-red-500')}
                {...register('title')}
              />
              {errors.title && <p className={errorClass}>{errors.title.message}</p>}
            </div>

            {/* Industry */}
            <div>
              <label htmlFor="industry" className={labelClass}>
                Industry <span className="text-red-400">*</span>
              </label>
              <select
                id="industry"
                className={cn(inputClass, errors.industry && 'border-red-500 focus:ring-red-500')}
                {...register('industry')}
                defaultValue=""
              >
                <option value="" disabled>
                  Select an industry…
                </option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
              {errors.industry && <p className={errorClass}>{errors.industry.message}</p>}
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor="description" className={labelClass}>
                  Description <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{charCount(1, 2000)}</span>
              </div>
              <textarea
                id="description"
                rows={4}
                placeholder="Describe your product or service in detail. What does it do? How does it work? What makes it unique?"
                className={cn(inputClass, errors.description && 'border-red-500 focus:ring-red-500')}
                {...register('description')}
              />
              {errors.description && (
                <p className={errorClass}>{errors.description.message}</p>
              )}
            </div>

            {/* Problem Statement */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor="problemStatement" className={labelClass}>
                  Problem Statement <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{charCount(2, 1000)}</span>
              </div>
              <textarea
                id="problemStatement"
                rows={3}
                placeholder="What specific problem are you solving? Who experiences this problem and how often?"
                className={cn(
                  inputClass,
                  errors.problemStatement && 'border-red-500 focus:ring-red-500'
                )}
                {...register('problemStatement')}
              />
              {errors.problemStatement && (
                <p className={errorClass}>{errors.problemStatement.message}</p>
              )}
            </div>

            {/* Target Audience */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor="targetAudience" className={labelClass}>
                  Target Audience <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{charCount(3, 500)}</span>
              </div>
              <textarea
                id="targetAudience"
                rows={2}
                placeholder="Who are your primary customers? Be specific about demographics, behaviours, and needs."
                className={cn(
                  inputClass,
                  errors.targetAudience && 'border-red-500 focus:ring-red-500'
                )}
                {...register('targetAudience')}
              />
              {errors.targetAudience && (
                <p className={errorClass}>{errors.targetAudience.message}</p>
              )}
            </div>

            {/* Goals */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label htmlFor="goals" className={labelClass}>
                  Goals <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{charCount(4, 1000)}</span>
              </div>
              <textarea
                id="goals"
                rows={3}
                placeholder="What are your key goals for this startup? e.g. reach 1000 users in 6 months, achieve product-market fit, raise seed funding."
                className={cn(inputClass, errors.goals && 'border-red-500 focus:ring-red-500')}
                {...register('goals')}
              />
              {errors.goals && <p className={errorClass}>{errors.goals.message}</p>}
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full rounded-lg px-6 py-3.5 text-sm font-semibold transition-all',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Launching AI Agents…
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Analyse My Idea
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature hints */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: '🔍', label: 'Idea Validation' },
            { icon: '🏆', label: 'Competitor Analysis' },
            { icon: '🗺️', label: 'Roadmap Builder' },
            { icon: '📊', label: 'Feasibility Score' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 bg-card/50 border border-border rounded-xl p-4 text-center"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
