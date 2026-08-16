import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, WifiOff, Loader2 } from "lucide-react";
import { trpc } from "../lib/trpc";
import { usePipelineEvents } from "../hooks/usePipelineEvents";
import { type PipelineEvent } from "../hooks/usePipelineEvents";
import { PIPELINE_STAGES, STAGE_WORKSPACE, type PipelineStageKey, type PipelineStageStatus, getStageStatus } from "./PipelineStages";
import { PipelineNode } from "./PipelineNode";
import { PipelineConnector } from "./PipelineConnector";

type TelemetryStatus = "healthy" | "degraded" | "unavailable";

interface PipelineState {
  currentStage: PipelineStageKey | null;
  completedStages: PipelineStageKey[];
  errorStages: PipelineStageKey[];
  lastAdvance: string | null;
}

export function LivePipelineStrip() {
  const { events, connection } = usePipelineEvents();
  const activePipeline = trpc.pipeline.getActive.useQuery(undefined, {
    refetchInterval: 5000,
    staleTime: 2000,
    retry: false,
  });

  const utils = trpc.useUtils();

  const [pipelineState, setPipelineState] = useState<PipelineState>({
    currentStage: null,
    completedStages: [],
    errorStages: [],
    lastAdvance: null,
  });

  useEffect(() => {
    if (activePipeline.data) {
      const stage = activePipeline.data.stage as PipelineStageKey;
      const allStages = PIPELINE_STAGES.filter((s) => s.key !== "done");
      const stageIndex = allStages.findIndex((s) => s.key === stage);

      setPipelineState({
        currentStage: stage,
        completedStages: allStages.slice(0, stageIndex).map((s) => s.key),
        errorStages: [],
        lastAdvance: activePipeline.data.updatedAt,
      });
    } else if (!activePipeline.isLoading) {
      setPipelineState({
        currentStage: null,
        completedStages: [],
        errorStages: [],
        lastAdvance: null,
      });
    }
  }, [activePipeline.data, activePipeline.isLoading]);

  useEffect(() => {
    const advanceEvents = events.filter(
      (e: PipelineEvent) => e.eventType === "pipeline_advance" || e.eventType === "pipeline_handoff",
    );

    if (advanceEvents.length === 0) return;

    const latestEvent = advanceEvents[advanceEvents.length - 1];
    const stageMatch = latestEvent.message.match(/stage[:\s]+(\w+)/i);
    if (stageMatch) {
      const newStage = stageMatch[1] as PipelineStageKey;
      setPipelineState((prev) => {
        const allStages = PIPELINE_STAGES.filter((s) => s.key !== "done");
        const stageIndex = allStages.findIndex((s) => s.key === newStage);
        const completed = allStages.slice(0, stageIndex).map((s) => s.key);

        return {
          currentStage: newStage,
          completedStages: completed,
          errorStages: prev.errorStages.filter((e) => e !== newStage),
          lastAdvance: new Date().toISOString(),
        };
      });
    }

    if (latestEvent.eventType === "error" || latestEvent.eventType === "retry") {
      const stageMatch = latestEvent.message.match(/stage[:\s]+(\w+)/i);
      if (stageMatch) {
        const errorStage = stageMatch[1] as PipelineStageKey;
        setPipelineState((prev) => ({
          ...prev,
          errorStages: [...new Set([...prev.errorStages, errorStage])],
        }));
      }
    }

    if (latestEvent.eventType === "status_changed") {
      utils.pipeline.getActive.invalidate();
    }
  }, [events, utils]);

  const isNoFeed = connection === "connected" && events.length === 0 && !activePipeline.data;
  const telemetryStatus: TelemetryStatus = activePipeline.isError
    ? "unavailable"
    : connection === "connected"
      ? "healthy"
      : connection === "reconnecting"
        ? "degraded"
        : "unavailable";

  const stripState = useMemo(() => {
    if (!activePipeline.data && connection !== "connected") {
      return { label: "CONNECTING", color: "text-amber-300" } as const;
    }
    if (!activePipeline.data) {
      return { label: "NOT CONFIGURED", color: "text-[var(--color-text-muted)]" } as const;
    }
    return null;
  }, [activePipeline.data, connection]);

  return (
    <div className="operator-panel-glow w-full">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Live Pipeline
          </span>
          {stripState ? (
            <span className={`font-[var(--font-mono)] text-[9px] ${stripState.color}`}>
              {stripState.label}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-[var(--font-mono)] text-[9px] text-[var(--color-teal)]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connection === "connected" ? "bg-[var(--color-teal)] shadow-[var(--glow-green)] animate-pulse" : "bg-amber-400"}`}
              />
              {connection === "connected" ? "ONLINE" : connection === "reconnecting" ? "RECONNECTING" : "CONNECTING"}
            </span>
          )}
        </div>

        {telemetryStatus === "unavailable" && (
          <span className="flex items-center gap-1 font-[var(--font-mono)] text-[8px] text-red-400">
            <WifiOff className="h-2.5 w-2.5" />
            NO FEED
          </span>
        )}

        {telemetryStatus === "degraded" && (
          <span className="flex items-center gap-1 font-[var(--font-mono)] text-[8px] text-amber-400">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            DEGRADED
          </span>
        )}

        {telemetryStatus === "healthy" && isNoFeed && (
          <span className="flex items-center gap-1 font-[var(--font-mono)] text-[8px] text-amber-400">
            <Clock className="h-2.5 w-2.5" />
            NO FEED
          </span>
        )}

        {pipelineState.lastAdvance && (
          <span className="font-[var(--font-mono)] text-[8px] text-[var(--color-text-muted)]">
            Last: {new Date(pipelineState.lastAdvance).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="px-2 py-4">
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((stage, index) => {
            const status = getStageStatus(
              pipelineState.currentStage,
              pipelineState.completedStages,
              pipelineState.errorStages,
              stage.key,
            );
            const isCurrent =
              pipelineState.currentStage === stage.key && status === "active";

            return (
              <div key={stage.key} className="flex flex-1 items-center">
                <PipelineNode
                  stage={stage}
                  status={status}
                  isCurrent={isCurrent}
                  detail={getStageDetail(stage.key, pipelineState, connection, activePipeline.data)}
                  onClick={() => {
                    if (status === "active" && STAGE_WORKSPACE[stage.key as Exclude<PipelineStageKey, "done">]) {
                      window.location.assign(`/${STAGE_WORKSPACE[stage.key as Exclude<PipelineStageKey, "done">]}`);
                    }
                  }}
                />
                {index < PIPELINE_STAGES.length - 1 && (
                  <PipelineConnector
                    fromStatus={status}
                    toStatus={
                      getStageStatus(
                        pipelineState.currentStage,
                        pipelineState.completedStages,
                        pipelineState.errorStages,
                        PIPELINE_STAGES[index + 1]!.key,
                      )
                    }
                    isAnimating={isCurrent || pipelineState.currentStage === stage.key}
                  />
                )}
              </div>
            );
          })}
        </div>

        {pipelineState.errorStages.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.04] p-3">
            <p className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.12em] text-red-400">
              Pipeline errors
            </p>
            <p className="mt-1 text-[10px] text-red-300">
              {pipelineState.errorStages.join(", ")} — contact your administrator
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getStageDetail(
  stage: PipelineStageKey,
  state: PipelineState,
  connection: "connecting" | "connected" | "reconnecting",
  pipeline: { stage: string; updatedAt: string } | null | undefined,
): string | undefined {
  if (!pipeline && connection !== "connected") return "CONNECTING";
  if (!pipeline) return "NOT CONFIGURED";

  const status = getStageStatus(state.currentStage, state.completedStages, state.errorStages, stage);
  switch (status) {
    case "completed":
      return "Done";
    case "active":
      return "Running";
    case "blocked":
      return "Awaiting approval";
    case "error":
      return "Check logs";
    case "pending":
      return state.currentStage === null ? "Not started" : undefined;
    default:
      return undefined;
  }
}
