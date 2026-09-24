"use client";

import { Fragment, useState } from "react";
import { Check, Minus } from "lucide-react";

import {
  COMPARISON,
  getComparisonProduct,
  type Plan,
} from "@/lib/pricing/plans";
import { PRODUCT_STATUS_LABELS } from "@/lib/ecosystem/products";

/**
 * The detailed comparison.
 *
 * ONE semantic table at every width — not a desktop table plus a
 * duplicated mobile version. Below `lg` the reader picks a plan and the
 * other plan columns are hidden with a utility class; the markup, the
 * header associations, and the reading order are identical either way.
 * That keeps the table a table for assistive tech and avoids shipping
 * the same content to the DOM twice for SEO to chew on.
 *
 * Squeezing four columns into 375px is the failure mode this avoids:
 * at phone width the reader compares one plan against the feature list,
 * and switches plans to compare across.
 */

/** `Included` and `—` carry a glyph AND a label, never colour alone. */
function Value({ value }: { value: string }) {
  if (value === "Included") {
    return (
      <span className="inline-flex items-center gap-1.5 text-white/85">
        <Check aria-hidden="true" className="h-4 w-4 text-intelligence" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === "—") {
    return (
      <span className="inline-flex items-center text-white/25">
        <Minus aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-white/70">{value}</span>;
}

export function PlanComparison({ plans }: { plans: readonly Plan[] }) {
  const [active, setActive] = useState<string>(
    (plans.find((p) => p.recommended) ?? plans[plans.length - 1]).id,
  );

  /** Hidden below lg unless it is the plan the reader selected. */
  const columnClass = (id: string) =>
    id === active ? "" : "hidden lg:table-cell";

  return (
    <div>
      {/* Plan switcher — phone and tablet only. */}
      <div className="lg:hidden">
        <p
          id="comparison-switcher-label"
          className="type-label mb-3 text-white/45"
        >
          Compare against
        </p>
        <div
          role="group"
          aria-labelledby="comparison-switcher-label"
          className="flex flex-wrap gap-2"
        >
          {plans.map((plan) => {
            const isActive = plan.id === active;
            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(plan.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,212,255,0.45)] ${
                  isActive
                    ? "border-intelligence/50 bg-intelligence/10 text-white"
                    : "border-white/15 text-white/60 hover:border-white/35 hover:text-white"
                }`}
              >
                {plan.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 lg:mt-0">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Feature comparison across Entrepreneuria plans
          </caption>
          <thead>
            <tr className="border-b border-white/[0.14]">
              <th
                scope="col"
                className="type-label w-[52%] py-4 pr-4 text-left font-normal text-white/45 lg:w-[40%]"
              >
                Feature
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={`py-4 pl-3 text-right lg:px-4 lg:text-center ${columnClass(plan.id)}`}
                >
                  <span className="type-display-xs block text-white">
                    {plan.name}
                  </span>
                  <span className="type-label mt-1 block font-normal text-white/40">
                    ${plan.price}/mo
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {COMPARISON.map((group) => {
            const product = getComparisonProduct(group.productSlug);
            return (
              <Fragment key={group.title}>
                <tbody>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={plans.length + 1}
                      className="pb-3 pt-10 text-left"
                    >
                      <span className="type-label text-intelligence">
                        {group.title}
                      </span>
                      {/* The honest part: a group whose product has not
                          shipped says so, right where the promise is. */}
                      {product && product.status !== "live" ? (
                        <span className="type-label mt-1 block font-normal text-white/35 sm:ml-3 sm:mt-0 sm:inline">
                          {PRODUCT_STATUS_LABELS[product.status]}
                        </span>
                      ) : null}
                    </th>
                  </tr>
                </tbody>

                <tbody>
                  {group.rows.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-t border-white/[0.07] transition-colors hover:bg-white/[0.025]"
                    >
                      <th
                        scope="row"
                        className="py-4 pr-4 text-left font-normal leading-6 text-white/80"
                      >
                        {row.feature}
                      </th>
                      {plans.map((plan) => (
                        <td
                          key={plan.id}
                          className={`py-4 pl-3 text-right lg:px-4 lg:text-center ${columnClass(plan.id)}`}
                        >
                          <Value value={row.values[plan.id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Fragment>
            );
          })}
        </table>
      </div>
    </div>
  );
}
