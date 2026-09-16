import {
  CHAMBER_STATE_LABELS,
  type ChamberState,
} from "@/lib/directorium/advisors";

import { ChamberAtmosphere, CouncilChamber } from "./chamber/CouncilChamber";
import { ProcessStateSync } from "./ProcessStateSync";
import styles from "./process.module.css";

export interface ProcessStep {
  roman: string;
  title: string;
  description: string;
}

/** Each step of the boardroom sequence maps to one chamber composition. */
const STEP_CHAMBER: readonly { state: ChamberState; core: "lit" | "ember" }[] = [
  { state: "dormant", core: "lit" },
  { state: "convened", core: "lit" },
  { state: "debate", core: "lit" },
  { state: "verdict", core: "lit" },
];

/**
 * The structured boardroom — the chamber activates as the visitor reads.
 *
 * Desktop (≥1024px): the chamber is CSS-sticky in the left column while
 * the four steps scroll natively on the right; ProcessStateSync writes
 * the step in the reading band onto the chamber. No pinning.
 *
 * Below 1024px: no sticky element over the copy. Each step carries its
 * own inline chamber, already in that step's state.
 *
 * The steps (ordered list) are the semantic truth; every chamber here is
 * decorative.
 */
export function ProcessSequence({ steps }: { steps: readonly ProcessStep[] }) {
  const caption = (i: number) =>
    `${steps[i].roman} / ${steps[steps.length - 1].roman} — ${
      CHAMBER_STATE_LABELS[STEP_CHAMBER[i].state]
    }`;

  return (
    <ProcessStateSync className={styles.root}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="hidden lg:block" data-process-chamber>
          <div className="sticky top-[var(--header-height)] flex h-[calc(100vh-var(--header-height))] flex-col items-center justify-center">
            <div className="relative w-full max-w-[500px]">
              <ChamberAtmosphere className="inset-[-18%]" />
              <CouncilChamber id="process" state="verdict" />
            </div>
            <p
              data-process-caption
              aria-hidden="true"
              className="mt-8 text-[11px] uppercase tracking-[0.24em] text-white/55 [font-family:var(--font-label)]"
            >
              {caption(steps.length - 1)}
            </p>
          </div>
        </div>

        {/* trailing space keeps the sticky chamber centred while the
            final step is still in the reading band */}
        <ol className={`${styles.rail} flex flex-col gap-16 lg:gap-0 lg:pb-[22vh]`}>
          {steps.map((step, i) => {
            const chamber = STEP_CHAMBER[i] ?? STEP_CHAMBER[STEP_CHAMBER.length - 1];
            return (
              <li
                key={step.roman}
                data-process-step
                data-step-index={i}
                data-state={chamber.state}
                data-core={chamber.core}
                data-caption={caption(i)}
                className={`${styles.step} lg:flex lg:min-h-[76vh] lg:flex-col lg:justify-center`}
              >
                <div
                  data-inline-chamber
                  className="relative mx-auto mb-8 w-full max-w-[280px] sm:max-w-[320px] lg:hidden"
                >
                  <ChamberAtmosphere className="inset-[-14%]" />
                  <CouncilChamber
                    id={`process-${i}`}
                    state={chamber.state}
                    core={chamber.core}
                    labels={false}
                  />
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60 [font-family:var(--font-label)]">
                    Step {step.roman}
                    <span aria-hidden="true" className="text-white/55">
                      {" "}
                      · {CHAMBER_STATE_LABELS[chamber.state]}
                    </span>
                  </p>
                  <h3
                    className={`${styles.stepTitle} mt-4 text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl`}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-md leading-7 text-white/65">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </ProcessStateSync>
  );
}
